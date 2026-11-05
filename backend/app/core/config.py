from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    environment: str = "development"
    database_url: str = "postgresql+psycopg://atlas:atlas_dev_password@localhost:5432/atlas"
    jwt_secret: str = "development-only-change-me"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 60
    frontend_origin: str = "http://localhost:3000"
    create_tables_on_startup: bool = True
    x_api_key: str | None = None

    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_origin.split(",") if origin.strip()]

    @model_validator(mode="after")
    def validate_runtime_security(self):
        production = self.environment.lower() in {"production", "prod"}
        if production:
            if len(self.jwt_secret) < 32 or self.jwt_secret == "development-only-change-me":
                raise ValueError("JWT_SECRET must be a unique secret of at least 32 characters in production.")
            if self.create_tables_on_startup:
                raise ValueError("CREATE_TABLES_ON_STARTUP must be false in production; use Alembic migrations.")
            if not self.allowed_origins or any("*" in origin for origin in self.allowed_origins):
                raise ValueError("FRONTEND_ORIGIN must contain explicit trusted origins in production.")
        return self
