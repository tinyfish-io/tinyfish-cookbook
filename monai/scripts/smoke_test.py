"""Quick smoke test for MónAI backend + frontend proxy."""
import json
import sys
import urllib.error
import urllib.request

BACKEND = "http://127.0.0.1:8000"
FRONTEND_CANDIDATES = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
]

passed = 0
failed = 0


def check(name: str, ok: bool, detail: str = "") -> None:
    global passed, failed
    if ok:
        passed += 1
        print(f"  PASS  {name}" + (f" — {detail}" if detail else ""))
    else:
        failed += 1
        print(f"  FAIL  {name}" + (f" — {detail}" if detail else ""))


def body_detail(body: dict | str, key: str | None = None, fallback: str = "") -> str:
    if isinstance(body, dict):
        return str(body.get(key, fallback)) if key else fallback
    return str(body)[:120] if body else ""


def get(path: str) -> tuple[int, dict | str]:
    req = urllib.request.Request(f"{BACKEND}{path}")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read().decode()
            try:
                return resp.status, json.loads(body)
            except json.JSONDecodeError:
                return resp.status, body
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            return e.code, json.loads(body)
        except json.JSONDecodeError:
            return e.code, body


def post(path: str, payload: dict) -> tuple[int, dict | str]:
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{BACKEND}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read().decode()
            try:
                return resp.status, json.loads(body)
            except json.JSONDecodeError:
                return resp.status, body
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            return e.code, json.loads(body)
        except json.JSONDecodeError:
            return e.code, body


def frontend_get(path: str) -> int:
    for base in FRONTEND_CANDIDATES:
        req = urllib.request.Request(f"{base}{path}")
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                return resp.status
        except urllib.error.HTTPError as e:
            return e.code
        except urllib.error.URLError:
            continue
    return 0


print("\n=== MónAI Smoke Test ===\n")

print("Backend")
code, health = get("/health")
health_ok = code == 200 and isinstance(health, dict) and health.get("status") == "ok"
check("GET /health", health_ok, body_detail(health, "service"))

code, emerging = get("/api/trends/emerging?location=TP.HCM&category=beverage")
emerging_ok = code == 200 and isinstance(emerging, dict) and "emerging_trends" in emerging
check(
    "GET /api/trends/emerging",
    emerging_ok,
    f"{len(emerging.get('emerging_trends', []))} trends" if emerging_ok else body_detail(emerging),
)

code, forecast = get("/api/trends/forecast?trend_name=Salt+Coffee&location=Da+Nang")
check("GET /api/trends/forecast", code == 200 and isinstance(forecast, dict) and "forecast" in forecast)

code, regional = get("/api/trends/regional?region_a=Ha+Noi&region_b=TP.HCM&category=beverage")
check("GET /api/trends/regional", code == 200 and isinstance(regional, dict) and "comparison" in regional)

code, menu = post(
    "/api/analysis/menu-gap",
    {"current_menu_items": ["Ca phe sua da"], "location": "Ha Noi", "competitor_urls": []},
)
check("POST /api/analysis/menu-gap", code == 200 and isinstance(menu, dict) and "menu_gap_analysis" in menu)

code, suppliers = post(
    "/api/suppliers/discover",
    {
        "trend_name": "Matcha Coconut Coffee",
        "ingredients": ["matcha", "coconut cream"],
        "location": "TP.HCM",
    },
)
check("POST /api/suppliers/discover", code == 200 and isinstance(suppliers, dict) and "suppliers" in suppliers)

code, outreach = post(
    "/api/suppliers/outreach",
    {"supplier_info": "Example Supplier Co.", "product_needs": "bulk matcha, monthly delivery"},
)
check("POST /api/suppliers/outreach", code == 200 and isinstance(outreach, dict) and "rfq_template" in outreach)

print("\nFrontend (via Vite dev server)")
for path in ["/", "/dashboard"]:
    status = frontend_get(path)
    check(f"GET {path}", status == 200, f"HTTP {status}")

print(f"\n=== Results: {passed} passed, {failed} failed ===\n")
sys.exit(1 if failed else 0)
