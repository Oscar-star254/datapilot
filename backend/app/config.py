from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_role_key: str
    supabase_jwt_secret: str
    supabase_anon_key: str
    frontend_url: str = "http://localhost:5173"
    max_file_size_mb: int = 25
    max_rows: int = 5_000_000
    query_timeout_seconds: int = 10
    rate_limit: str = "100/minute"
    storage_limit_bytes: int = 1_073_741_824  # 1 GB

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
