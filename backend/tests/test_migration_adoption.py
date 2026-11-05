import pytest
import sqlalchemy as sa

from scripts.adopt_existing_database import BASELINE_COLUMNS, detect_revision


def baseline_engine():
    engine = sa.create_engine("sqlite://")
    metadata = sa.MetaData()
    for table, columns in BASELINE_COLUMNS.items():
        sa.Table(table, metadata, *(sa.Column(name, sa.String()) for name in columns))
    metadata.create_all(engine)
    return engine


def test_adoption_detects_legacy_baseline_revision():
    engine = baseline_engine()
    try:
        assert detect_revision(engine) == "0001_initial"
    finally:
        engine.dispose()


def test_adoption_detects_existing_source_page_migration():
    engine = baseline_engine()
    try:
        with engine.begin() as connection:
            connection.execute(sa.text("ALTER TABLE topics ADD COLUMN source_pages JSON"))
            connection.execute(sa.text("ALTER TABLE concepts ADD COLUMN source_pages JSON"))
        assert detect_revision(engine) == "0002_source_pages"
    finally:
        engine.dispose()


def test_adoption_detects_current_academic_planning_schema():
    engine = baseline_engine()
    try:
        with engine.begin() as connection:
            connection.execute(sa.text("ALTER TABLE topics ADD COLUMN source_pages JSON"))
            connection.execute(sa.text("ALTER TABLE concepts ADD COLUMN source_pages JSON"))
            connection.execute(sa.text("ALTER TABLE subjects ADD COLUMN term VARCHAR(60)"))
            connection.execute(sa.text("ALTER TABLE concept_progress ADD COLUMN next_review_at DATETIME"))
            connection.execute(sa.text("CREATE TABLE syllabus_versions (id INTEGER, subject_id INTEGER, version_name VARCHAR(100), snapshot JSON, created_at DATETIME)"))
            connection.execute(sa.text("CREATE TABLE concept_reviews (id INTEGER, user_id INTEGER, concept_id INTEGER, exposure VARCHAR(20), understanding VARCHAR(20), recall VARCHAR(20), confidence INTEGER, notes TEXT, reviewed_at DATETIME, next_review_at DATETIME)"))
        assert detect_revision(engine) == "0003_academic_planning"
    finally:
        engine.dispose()


def test_adoption_rejects_partial_source_page_and_planning_schemas():
    engine = baseline_engine()
    try:
        with engine.begin() as connection:
            connection.execute(sa.text("ALTER TABLE topics ADD COLUMN source_pages JSON"))
        with pytest.raises(RuntimeError, match="Only one source_pages"):
            detect_revision(engine)
    finally:
        engine.dispose()


def test_adoption_refuses_existing_alembic_version_table():
    engine = baseline_engine()
    try:
        with engine.begin() as connection:
            connection.execute(sa.text("CREATE TABLE alembic_version (version_num VARCHAR(32))"))
        with pytest.raises(RuntimeError, match="already exists"):
            detect_revision(engine)
    finally:
        engine.dispose()
