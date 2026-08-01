"""LogisticsCRM API — точка входа."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, containers, dashboard, export, meta
from app.core.config import settings

app = FastAPI(title="LogisticsCRM API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(meta.router)
app.include_router(containers.router)
app.include_router(dashboard.router)
app.include_router(export.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
