import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import analysis, suppliers, trends

load_dotenv()

app = FastAPI(
    title="MónAI API",
    description="Backend for Vietnam's AI-Powered Food Trend Intelligence & Supplier Discovery Platform",
    version="1.0.0",
)


def _allowed_origins() -> list[str]:
    raw = os.getenv("ALLOWED_ORIGINS", "") or os.getenv("FRONTEND_URL", "")
    origins: list[str] = []
    for origin in raw.split(","):
        cleaned = origin.strip().rstrip("/")
        if cleaned:
            origins.append(cleaned)
    if not origins:
        origins = [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:4173",
        ]
    return origins


_origins = _allowed_origins()
print(f"CORS allowed origins: {_origins}", flush=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept", "X-Requested-With"],
    expose_headers=["Content-Type"],
)

app.include_router(trends.router)
app.include_router(analysis.router)
app.include_router(suppliers.router)


@app.get("/")
async def root():
    return {"message": "Welcome to the MónAI API. Check /docs for API documentation."}


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "MónAI API",
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
