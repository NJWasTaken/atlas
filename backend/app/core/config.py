from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    environment: Literal["development", "test", "production"] = "development"
    database_url: str = "postgresql+psycopg://atlas:atlas_dev_password@localhost:5432/atlas"
    jwt_secret: str = "development-only-change-me"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 60
    frontend_origin: str = "http://localhost:3000"
    cors_origins: str | None = None
    x_api_key: str | None = None

    @property
    def allowed_origins(self) -> list[str]:
        configured = self.cors_origins or self.frontend_origin
        return [origin.strip() for origin in configured.split(",") if origin.strip()]

    @model_validator(mode="after")
    def validate_production_settings(self):
        if self.environment == "production":
            if self.jwt_secret == "development-only-change-me" or len(self.jwt_secret) < 32:
                raise ValueError("Production requires a unique JWT_SECRET with at least 32 characters.")
            if not self.allowed_origins or "*" in self.allowed_origins:
                raise ValueError("Production CORS_ORIGINS must contain explicit trusted origins; wildcards are not allowed.")
            if any(origin.startswith("http://localhost") for origin in self.allowed_origins):
                raise ValueError("Production CORS origins cannot include localhost.")
        return self

    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")


settings = Settings()
