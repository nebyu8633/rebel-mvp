"""Application configuration, loaded from environment variables / .env."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    database_url: str = "postgresql+psycopg2://invoice_guard:invoice_guard@localhost:5432/invoice_guard"

    # AI (Vision-capable LLM)
    ai_api_key: str = ""
    ai_model: str = "claude-sonnet-4-5"

    # WhatsApp Business Cloud API
    whatsapp_access_token: str = ""
    whatsapp_phone_number_id: str = ""
    whatsapp_verify_token: str = ""
    whatsapp_api_base_url: str = "https://graph.facebook.com/v20.0"

    # Price Guard configuration
    price_alert_threshold: float = 0.03
    price_alert_critical_threshold: float = 0.10
    min_confidence: float = 0.85

    # How far back to look for price history
    price_history_window_days: int = 60


@lru_cache
def get_settings() -> Settings:
    return Settings()
