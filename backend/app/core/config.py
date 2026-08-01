"""Конфигурация приложения (pydantic-settings, читает .env)."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql+asyncpg://dato@localhost:5432/logisticscrm"
    SECRET_KEY: str = "dev-secret-change-me-in-production-please-32chars"
    SESSION_COOKIE_NAME: str = "lc_session"
    CSRF_COOKIE_NAME: str = "lc_csrf"
    SESSION_MAX_AGE_HOURS: int = 24
    APP_ENV: str = "development"
    FRONTEND_ORIGIN: str = "http://localhost:5173"
    DEFAULT_CURRENCY: str = "USD"


settings = Settings()
