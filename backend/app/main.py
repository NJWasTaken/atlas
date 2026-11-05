from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db import Base, engine
from app import models  # noqa: F401
from app import academics_models  # noqa: F401
from app.routers import auth, quotes, subjects, calendar, academics


def create_app(*, create_tables: bool = True) -> FastAPI:
    """Build the API application.

    Table creation remains enabled for the current local-development workflow,
    but is deferred until startup so tests can import the app without connecting
    to the configured development database.
    """
    application = FastAPI(title="Atlas API", version="0.1.0")
    application.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_origin],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(auth.router, prefix="/api/v1")
    application.include_router(quotes.router, prefix="/api/v1")
    application.include_router(subjects.router, prefix="/api/v1")
    application.include_router(calendar.router, prefix="/api/v1")
    application.include_router(academics.router, prefix="/api/v1")

    if create_tables:
        @application.on_event("startup")
        def create_database_tables() -> None:
            Base.metadata.create_all(bind=engine)

    @application.get("/health")
    def health():
        return {"status": "ok", "service": "atlas-api"}

    return application


app = create_app()
