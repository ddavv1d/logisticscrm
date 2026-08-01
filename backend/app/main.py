"""LogisticsCRM API — точка входа. В проде также раздаёт собранный фронт (SPA)."""

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

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


# --- раздача собранного фронта (SPA) в проде ---
# Фронт кладётся в app/static (COPY в Dockerfile). Локально папки нет — фронт на Vite.
_STATIC = Path(__file__).resolve().parent / "static"
if _STATIC.is_dir():
    # ассеты Vite (/assets/*) + прочие файлы
    app.mount("/assets", StaticFiles(directory=_STATIC / "assets"), name="assets")

    @app.get("/")
    async def _index():
        return FileResponse(_STATIC / "index.html")

    # SPA-fallback: любой не-API путь без файла → index.html (React Router)
    @app.exception_handler(StarletteHTTPException)
    async def _spa_fallback(request, exc):
        if exc.status_code == 404 and not request.url.path.startswith("/api"):
            idx = _STATIC / "index.html"
            if idx.is_file():
                return FileResponse(idx)
        from fastapi.responses import JSONResponse
        return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)
