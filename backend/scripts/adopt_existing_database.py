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


def detect_revision(engine: sa.Engine) -> str:
    inspector = sa.inspect(engine)
    tables = set(inspector.get_table_names())
    if "alembic_version" in tables:
        raise RuntimeError("An alembic_version table already exists. Inspect the current revision; this adoption helper will not overwrite it.")

    missing_tables = set(BASELINE_COLUMNS) - tables
    if missing_tables:
        raise RuntimeError(f"Database is missing baseline tables: {', '.join(sorted(missing_tables))}")

    for table, required in BASELINE_COLUMNS.items():
        actual = {column["name"] for column in inspector.get_columns(table)}
        missing = required - actual
        if missing:
            raise RuntimeError(f"Table {table} is missing baseline columns: {', '.join(sorted(missing))}")

    topic_pages = "source_pages" in {column["name"] for column in inspector.get_columns("topics")}
    concept_pages = "source_pages" in {column["name"] for column in inspector.get_columns("concepts")}
    if topic_pages != concept_pages:
        raise RuntimeError("Only one source_pages column exists. This is a partial schema; inspect and repair it manually.")

    subject_term = "term" in {column["name"] for column in inspector.get_columns("subjects")}
    progress_next = "next_review_at" in {column["name"] for column in inspector.get_columns("concept_progress")}
    has_versions = "syllabus_versions" in tables
    has_reviews = "concept_reviews" in tables
    planning_flags = {subject_term, progress_next, has_versions, has_reviews}
    if len(planning_flags) != 1:
        raise RuntimeError("Academic-planning schema is only partially present. Do not stamp automatically; compare the schema manually.")

    if all(planning_flags):
        return "0003_academic_planning"
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
