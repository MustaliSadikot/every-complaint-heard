"""
Application configuration — Every Complaint Heard
All settings can be overridden via environment variables.
"""

from pydantic_settings import BaseSettings
from pydantic import Field


class UrgencyThresholds(BaseSettings):
    """Configurable urgency band thresholds (prototype defaults per FR-03)."""
    critical_min: int = Field(default=80, ge=0, le=100)
    high_min: int = Field(default=60, ge=0, le=100)
    medium_min: int = Field(default=30, ge=0, le=100)
    # low = 0 .. medium_min - 1


class Settings(BaseSettings):
    # Application
    app_name: str = "Every Complaint Heard"
    app_version: str = "1.0.0"
    debug: bool = False

    # Database
    database_url: str = "sqlite+aiosqlite:///./complaints.db"
    database_path: str = "./complaints.db"

    # Ollama / local AI
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "llama3.1"
    ollama_timeout_seconds: float = 30.0
    ai_enabled: bool = True

    # Urgency thresholds
    urgency_critical_min: int = 80
    urgency_high_min: int = 60
    urgency_medium_min: int = 30

    # Sync
    sync_server_url: str = ""   # empty = no server configured
    sync_retry_max: int = 3

    # CORS origins (space-separated)
    cors_origins: str = "http://localhost:5173 http://127.0.0.1:5173"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    def get_cors_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split() if o.strip()]

    def get_urgency_thresholds(self) -> UrgencyThresholds:
        return UrgencyThresholds(
            critical_min=self.urgency_critical_min,
            high_min=self.urgency_high_min,
            medium_min=self.urgency_medium_min,
        )


settings = Settings()
