from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db import Base, engine
from app import models  # noqa: F401
from app import academics_models  # noqa: F401
from app.routers import auth, quotes, subjects, calendar, academics


def create_app(*, create_tables: bool | None = None) -> FastAPI:
    """Build the API application.

    Local development may create missing tables for convenience. Production
    must use Alembic migrations and rejects this fallback in its settings.
    """
    application = FastAPI(title="Atlas API", version="0.1.0")
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(auth.router, prefix="/api/v1")
    application.include_router(quotes.router, prefix="/api/v1")
    application.include_router(subjects.router, prefix="/api/v1")
    application.include_router(calendar.router, prefix="/api/v1")
    application.include_router(academics.router, prefix="/api/v1")

    should_create_tables = settings.create_tables_on_startup if create_tables is None else create_tables
    if should_create_tables:
        @application.on_event("startup")
        def create_database_tables() -> None:
            if settings.environment.lower() in {"production", "prod"}:
                raise RuntimeError("Automatic table creation is disabled in production. Run Alembic migrations.")
            Base.metadata.create_all(bind=engine)

    @application.get("/health")
    def health():
        return {"status": "ok", "service": "atlas-api"}

    return application


app = create_app()
