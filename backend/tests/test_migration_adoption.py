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


def add_source_pages(connection):
    connection.execute(sa.text("ALTER TABLE topics ADD COLUMN source_pages JSON"))
    connection.execute(sa.text("ALTER TABLE concepts ADD COLUMN source_pages JSON"))


def add_subject_metadata(connection):
    connection.execute(sa.text("ALTER TABLE subjects ADD COLUMN term VARCHAR(60)"))
    connection.execute(sa.text("ALTER TABLE subjects ADD COLUMN academic_year VARCHAR(16)"))


def add_review_schema(connection):
    connection.execute(sa.text("ALTER TABLE concept_progress ADD COLUMN next_review_at DATETIME"))
    connection.execute(sa.text("""
        CREATE TABLE syllabus_versions (
            id INTEGER, subject_id INTEGER, version_number INTEGER, label VARCHAR(160),
            snapshot JSON, created_by INTEGER, created_at DATETIME
        )
    """))
    connection.execute(sa.text("""
        CREATE TABLE concept_reviews (
            id INTEGER, user_id INTEGER, concept_id INTEGER, reviewed_at DATETIME,
            exposure VARCHAR(20), understanding VARCHAR(20), recall VARCHAR(20),
            confidence INTEGER, notes TEXT
        )
    """))


def add_prerequisites(connection):
    connection.execute(sa.text("""
        CREATE TABLE concept_prerequisites (
            id INTEGER, concept_id INTEGER, prerequisite_concept_id INTEGER, created_at DATETIME
        )
    """))


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
            add_source_pages(connection)
        assert detect_revision(engine) == "0002_source_pages"
    finally:
        engine.dispose()


def test_adoption_detects_subject_metadata_revision():
    engine = baseline_engine()
    try:
        with engine.begin() as connection:
            add_source_pages(connection)
            add_subject_metadata(connection)
        assert detect_revision(engine) == "0003_subject_term"
    finally:
        engine.dispose()


def test_adoption_detects_syllabus_and_review_revision():
    engine = baseline_engine()
    try:
        with engine.begin() as connection:
            add_source_pages(connection)
            add_subject_metadata(connection)
            add_review_schema(connection)
        assert detect_revision(engine) == "0004_syllabus_versions_reviews"
    finally:
        engine.dispose()


def test_adoption_detects_complete_prerequisite_revision():
    engine = baseline_engine()
    try:
        with engine.begin() as connection:
            add_source_pages(connection)
            add_subject_metadata(connection)
            add_review_schema(connection)
            add_prerequisites(connection)
        assert detect_revision(engine) == "0005_concept_prerequisites"
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


def test_adoption_rejects_partial_academic_metadata():
    engine = baseline_engine()
    try:
        with engine.begin() as connection:
            add_source_pages(connection)
            connection.execute(sa.text("ALTER TABLE subjects ADD COLUMN term VARCHAR(60)"))
        with pytest.raises(RuntimeError, match="term/year metadata"):
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
