"""Async engine + session. Одна транзакция на запрос (commit/rollback в зависимости)."""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


def _async_url(url: str) -> str:
    """Нормализуем DATABASE_URL под async-драйвер asyncpg.

    Render/Heroku дают 'postgres://' или 'postgresql://' (sync psycopg).
    asyncpg также не понимает query-параметр sslmode — убираем его
    (TLS asyncpg включает через отдельный ssl-контекст автоматически на managed БД).
    """
    if url.startswith("postgres://"):
        url = "postgresql+asyncpg://" + url[len("postgres://"):]
    elif url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://"):]
    # выкинуть ?sslmode=... / &sslmode=... (asyncpg его не принимает)
    if "sslmode=" in url:
        import re
        url = re.sub(r"[?&]sslmode=[^&]*", "", url)
        url = url.replace("?&", "?").rstrip("?&")
    return url


engine = create_async_engine(_async_url(settings.DATABASE_URL), echo=False, pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Одна транзакция на запрос: commit при успехе, rollback при ошибке.

    Роутеры НЕ делают explicit commit — иначе частичная запись при поздней ошибке.
    """
    async with SessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
