#!/usr/bin/env sh
set -e

echo "[start] running migrations..."
alembic upgrade head || echo "[start] alembic failed (continuing — tables may exist)"

# сид только если БД пустая (не затираем данные при рестартах)
echo "[start] seeding demo data if empty..."
python - <<'PY' || echo "[start] seed skipped"
import asyncio
from sqlalchemy import text
from app.core.db import SessionLocal

async def main():
    async with SessionLocal() as s:
        try:
            n = (await s.execute(text("SELECT count(*) FROM container"))).scalar()
        except Exception:
            n = 0
    if not n:
        from app.seed import run
        await run()
        print("[start] seeded")
    else:
        print(f"[start] already has {n} containers, skip seed")

asyncio.run(main())
PY

echo "[start] launching uvicorn on :${PORT:-8000}"
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
