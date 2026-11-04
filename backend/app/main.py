from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db import Base, engine
from app import models
from app.routers import auth, quotes, subjects

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Atlas API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router, prefix="/api/v1")
app.include_router(quotes.router, prefix="/api/v1")
app.include_router(subjects.router, prefix="/api/v1")

@app.get("/health")
def health():
    return {"status": "ok", "service": "atlas-api"}
