from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    openai_api_key: str
    secret_key: str
    database_url: str = "sqlite:///./interview.db"
    elevenlabs_api_key: str = ""
    tts_provider: str = "openai"  # "openai" or "elevenlabs"
    access_token_expire_minutes: int = 1440  # 24 hours
    upload_dir: str = "uploads"
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_email: str = ""
    smtp_password: str = ""
    smtp_from_name: str = "AI Interview Platform"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
