from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://atlas:atlas_dev_password@localhost:5432/atlas"
    jwt_secret: str = "development-only-change-me"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 60
    frontend_origin: str = "http://localhost:3000"

    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")

settings = Settings()
