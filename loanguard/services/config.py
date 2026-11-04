"""Shared configuration and constants for LoanGuard services.

All secrets come from environment variables. Never hardcode or log keys.
"""

from __future__ import annotations

import os

try:
    from dotenv import load_dotenv  # type: ignore

    load_dotenv()
except Exception:  # pragma: no cover
    pass

# Root of the project (parent of /services)
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EVIDENCE_DIR = os.path.join(PROJECT_ROOT, "static", "evidence")


def get_api_key() -> str:
    return os.getenv("TINYFISH_API_KEY", "").strip()


def get_rbi_url() -> str:
    return os.getenv("RBI_DLA_URL", "https://www.rbi.org.in/").strip()


def is_demo_mode() -> bool:
    return os.getenv("DEMO_MODE", "1").strip() == "1"


def get_port() -> int:
    try:
        return int(os.getenv("PORT", "8000"))
    except ValueError:
        return 8000


def has_api_key() -> bool:
    return bool(get_api_key())


# Complaint keywords counted across fetched public pages. Context matters —
# these are signals, never proof. (per the master spec)
COMPLAINT_KEYWORDS = [
    "harass",
    "threat",
    "blackmail",
    "morph",
    "extort",
    "abuse",
    "scam",
    "fraud",
    "fake",
    "illegal",
]

# Verdict bands
VERDICT_LOW = "LOWER RISK"
VERDICT_UNCLEAR = "UNCLEAR"
VERDICT_HIGH = "HIGH RISK"

# TinyFish REST endpoints (Browser has no SDK method; we call it directly)
BROWSER_API_URL = "https://api.browser.tinyfish.ai"
