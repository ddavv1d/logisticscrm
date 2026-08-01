"""Аутентификация: логин/логаут/me. Opaque cookie-сессия + CSRF cookie."""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user
from app.core.config import settings
from app.core.db import get_session
from app.core.security import make_session_token, new_csrf_token, verify_password
from app.models.models import User
from app.schemas.schemas import LoginIn, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])

_COOKIE = dict(httponly=True, samesite="lax", secure=False, path="/")


@router.post("/login", response_model=UserOut)
async def login(body: LoginIn, response: Response, session: AsyncSession = Depends(get_session)):
    row = await session.execute(select(User).where(User.email == body.email))
    user = row.scalar_one_or_none()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Неверный email или пароль")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Аккаунт отключён")

    max_age = settings.SESSION_MAX_AGE_HOURS * 3600
    csrf = new_csrf_token()
    response.set_cookie(
        settings.SESSION_COOKIE_NAME, make_session_token(user.id), max_age=max_age, **_COOKIE
    )
    # CSRF cookie — читаемый фронтом (не httponly), живёт как сессия
    response.set_cookie(
        settings.CSRF_COOKIE_NAME, csrf, max_age=max_age,
        httponly=False, samesite="lax", secure=False, path="/",
    )
    return user


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(settings.SESSION_COOKIE_NAME, path="/")
    response.delete_cookie(settings.CSRF_COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(current_user)):
    return user
