import pytest
from pydantic import ValidationError

from app.core.config import Settings

PRODUCTION_DATABASE_URL = "postgresql+psycopg://atlas:production-secret@db.example.com/atlas"


def test_production_requires_a_strong_non_default_jwt_secret():
    with pytest.raises(ValidationError, match="Production requires"):
        Settings(environment="production", frontend_origin="https://atlas.example.com", database_url=PRODUCTION_DATABASE_URL)


def test_production_rejects_wildcard_and_localhost_cors_origins():
    with pytest.raises(ValidationError, match="wildcards"):
        Settings(
            environment="production",
            database_url=PRODUCTION_DATABASE_URL,
            jwt_secret="a-unique-production-secret-that-is-long-enough",
            cors_origins="*",
        )
    with pytest.raises(ValidationError, match="localhost"):
        Settings(
            environment="production",
            database_url=PRODUCTION_DATABASE_URL,
            jwt_secret="a-unique-production-secret-that-is-long-enough",
            frontend_origin="http://localhost:3000",
        )


def test_production_accepts_explicit_trusted_origins():
    settings = Settings(
        environment="production",
        database_url=PRODUCTION_DATABASE_URL,
        jwt_secret="a-unique-production-secret-that-is-long-enough",
        cors_origins="https://atlas.example.com,https://www.atlas.example.com",
    )
    assert settings.allowed_origins == [
        "https://atlas.example.com",
        "https://www.atlas.example.com",
    ]


def test_development_keeps_local_defaults():
    settings = Settings(environment="development")
    assert settings.allowed_origins == ["http://localhost:3000"]


def test_production_rejects_local_development_database_url():
    with pytest.raises(ValidationError, match="local development database"):
        Settings(
            environment="production",
            jwt_secret="a-unique-production-secret-that-is-long-enough",
            frontend_origin="https://atlas.example.com",
            database_url="postgresql+psycopg://atlas:atlas_dev_password@localhost:5432/atlas",
        )
