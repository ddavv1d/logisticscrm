"""Argon2id хеширование + подписанные opaque-сессии (itsdangerous).

Сессия — opaque cookie (подписанный user_id + issued_at). Рефрешить нечего
(решение council: убрали silent-refresh как scope-creep). CSRF — double-submit.
"""

import secrets

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from itsdangerous import BadSignature, URLSafeTimedSerializer

from app.core.config import settings

_ph = PasswordHasher()
_serializer = URLSafeTimedSerializer(settings.SECRET_KEY, salt="lc-session")


def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _ph.verify(password_hash, password)
    except VerifyMismatchError:
        return False


def make_session_token(user_id: int) -> str:
    return _serializer.dumps({"uid": user_id})


def read_session_token(token: str) -> int | None:
    max_age = settings.SESSION_MAX_AGE_HOURS * 3600
    try:
        data = _serializer.loads(token, max_age=max_age)
        return int(data["uid"])
    except (BadSignature, KeyError, ValueError, TypeError):
        return None


def new_csrf_token() -> str:
    return secrets.token_urlsafe(32)
