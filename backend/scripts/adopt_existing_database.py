"""Safely mark a pre-Alembic Atlas database at its verified schema revision.

Run from backend/:
    python -m scripts.adopt_existing_database
    python -m scripts.adopt_existing_database --backup-verified --apply

The script never upgrades tables. It only stamps a detected compatible revision.
"""
import argparse
from pathlib import Path

import sqlalchemy as sa
from alembic import command
from alembic.config import Config

from app.core.config import settings


BASELINE_COLUMNS = {
    "users": {"id", "email", "password_hash", "created_at"},
    "subjects": {"id", "user_id", "name", "code", "description", "created_at"},
    "day_notes": {"id", "user_id", "day", "note", "created_at", "updated_at"},
    "topics": {"id", "subject_id", "parent_topic_id", "title", "position", "description", "created_at"},
    "concepts": {"id", "topic_id", "title", "description", "position"},
    "concept_progress": {"id", "user_id", "concept_id", "exposure", "understanding", "recall", "confidence", "last_reviewed", "notes", "updated_at"},
    "exams": {"id", "user_id", "subject_id", "title", "exam_date", "created_at"},
}


def columns(inspector: sa.Inspector, table: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table)} if table in inspector.get_table_names() else set()


def require_columns(inspector: sa.Inspector, table: str, required: set[str]) -> None:
    missing = required - columns(inspector, table)
    if missing:
        raise RuntimeError(f"Table {table} is missing required columns: {', '.join(sorted(missing))}")


def detect_revision(engine: sa.Engine) -> str:
    inspector = sa.inspect(engine)
    tables = set(inspector.get_table_names())
    if "alembic_version" in tables:
        raise RuntimeError("An alembic_version table already exists. Inspect the current revision; this adoption helper will not overwrite it.")

    missing_tables = set(BASELINE_COLUMNS) - tables
    if missing_tables:
        raise RuntimeError(f"Database is missing baseline tables: {', '.join(sorted(missing_tables))}")
    for table, required in BASELINE_COLUMNS.items():
        require_columns(inspector, table, required)

    topic_pages = "source_pages" in columns(inspector, "topics")
    concept_pages = "source_pages" in columns(inspector, "concepts")
    if topic_pages != concept_pages:
        raise RuntimeError("Only one source_pages column exists. This is a partial schema; inspect and repair it manually.")

    subject_columns = columns(inspector, "subjects")
    has_term = "term" in subject_columns
    has_year = "academic_year" in subject_columns
    has_next_review = "next_review_at" in columns(inspector, "concept_progress")
    has_versions = "syllabus_versions" in tables
    has_reviews = "concept_reviews" in tables
    has_prerequisites = "concept_prerequisites" in tables

    if has_term != has_year:
        raise RuntimeError("Subject term/year metadata is only partially present; inspect the schema manually.")

    review_flags = {has_next_review, has_versions, has_reviews}
    if len(review_flags) > 1:
        raise RuntimeError("Syllabus/review schema is only partially present. Do not stamp automatically; compare the schema manually.")
    has_review_schema = all(review_flags)
    if has_review_schema and not has_term:
        raise RuntimeError("Syllabus/review schema exists without subject metadata; the migration chain is incomplete.")
    if has_prerequisites and not has_review_schema:
        raise RuntimeError("Prerequisite schema exists without syllabus/review tables; the migration chain is incomplete.")

    if has_versions:
        require_columns(inspector, "syllabus_versions", {"id", "subject_id", "version_number", "label", "snapshot", "created_by", "created_at"})
        require_columns(inspector, "concept_reviews", {"id", "user_id", "concept_id", "reviewed_at", "exposure", "understanding", "recall", "confidence", "notes"})
    if has_prerequisites:
        require_columns(inspector, "concept_prerequisites", {"id", "concept_id", "prerequisite_concept_id", "created_at"})

    if has_prerequisites:
        if not topic_pages:
            raise RuntimeError("Prerequisites exist but source_pages is missing. The migration chain is incomplete.")
        return "0005_concept_prerequisites"
    if has_versions:
        if not topic_pages:
            raise RuntimeError("Academic-planning tables exist but source_pages is missing. The migration chain is incomplete.")
        return "0004_syllabus_versions_reviews"
    if has_term:
        if not topic_pages:
            raise RuntimeError("Subject metadata exists but source_pages is missing. The migration chain is incomplete.")
        return "0003_subject_term"
    if topic_pages:
        return "0002_source_pages"
    return "0001_initial"


def main() -> None:
    parser = argparse.ArgumentParser(description="Detect and stamp a compatible existing Atlas database.")
    parser.add_argument("--backup-verified", action="store_true", help="Confirm that a restorable database backup exists.")
    parser.add_argument("--apply", action="store_true", help="Actually stamp the detected revision. Without this flag the command is a dry run.")
    args = parser.parse_args()

    engine = sa.create_engine(settings.database_url, pool_pre_ping=True)
    try:
        revision = detect_revision(engine)
    finally:
        engine.dispose()

    print(f"Detected compatible schema revision: {revision}")
    if not args.apply:
        print("Dry run only. No database changes were made.")
        print("After verifying a restorable backup, rerun with --backup-verified --apply.")
        return
    if not args.backup_verified:
        parser.error("--apply requires --backup-verified. Take and verify a restorable backup first.")

    config_path = Path(__file__).resolve().parents[1] / "alembic.ini"
    config = Config(str(config_path))
    config.set_main_option("sqlalchemy.url", settings.database_url.replace("%", "%%"))
    command.stamp(config, revision)
    print(f"Stamped database at {revision}. Next run: python -m alembic upgrade head")


if __name__ == "__main__":
    main()
