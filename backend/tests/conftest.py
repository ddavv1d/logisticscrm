"""Async-интеграционные тесты на реальном Postgres.

Ключ к стабильности async-engine в тестах: engine.dispose() в начале сессии
(пул пересоздаётся уже на тестовом loop) и в конце. Всё session-scoped.
"""

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.core.db import engine
from app.main import app
from app.seed import run as seed_run


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _db():
    await engine.dispose()
    await seed_run()
    yield
    await engine.dispose()


@pytest_asyncio.fixture(scope="session")
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture(scope="session")
async def owner(client):
    r = await client.post("/api/auth/login", json={"email": "owner@demo.lc", "password": "demo1234"})
    return r.cookies


@pytest_asyncio.fixture(scope="session")
async def manager(client):
    r = await client.post("/api/auth/login", json={"email": "manager@demo.lc", "password": "demo1234"})
    return r.cookies
