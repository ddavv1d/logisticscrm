"""FastAPI-зависимости: current_user из cookie, ролевые гейты, CSRF (RBAC в сервисном слое)."""

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.db import get_session
from app.core.security import read_session_token
from app.models.models import User


async def current_user(
    request: Request, session: AsyncSession = Depends(get_session)
) -> User:
    token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    uid = read_session_token(token) if token else None
    if uid is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Не авторизован")
    user = await session.get(User, uid)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Не авторизован")
    return user


def require_roles(*roles: str):
    async def _guard(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Недостаточно прав")
        return user

    return _guard


async def csrf_protect(request: Request, user: User = Depends(current_user)) -> None:
    """Double-submit: заголовок X-CSRF-Token должен совпасть с cookie."""
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return
    header = request.headers.get("x-csrf-token")
    cookie = request.cookies.get(settings.CSRF_COOKIE_NAME)
    if not header or not cookie or header != cookie:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "CSRF-проверка не пройдена")
