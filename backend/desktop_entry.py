"""Packaged Atlas API entry point for the Electron desktop application."""
from __future__ import annotations

import os
import sys
from pathlib import Path


def runtime_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(getattr(sys, "_MEIPASS"))
    return Path(__file__).resolve().parent


def main() -> None:
    data_dir = Path(os.environ["ATLAS_USER_DATA_DIR"]).expanduser().resolve()
    data_dir.mkdir(parents=True, exist_ok=True)
    pdf_dir = data_dir / "pdfs"
    pdf_dir.mkdir(parents=True, exist_ok=True)

    database_path = data_dir / "atlas.sqlite3"
    os.environ["DATABASE_URL"] = f"sqlite:///{database_path.as_posix()}"
    os.environ["ATLAS_PDF_STORAGE_DIR"] = str(pdf_dir)
    os.environ.setdefault("ENVIRONMENT", "development")

    root = runtime_root()
    from alembic import command
    from alembic.config import Config

    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "migrations"))
    config.set_main_option("sqlalchemy.url", os.environ["DATABASE_URL"].replace("%", "%%"))
    command.upgrade(config, "head")

    from app.main import app
    import uvicorn
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=int(os.environ.get("ATLAS_API_PORT", "43121")),
        log_level="info",
        workers=1,
    )


if __name__ == "__main__":
    main()
