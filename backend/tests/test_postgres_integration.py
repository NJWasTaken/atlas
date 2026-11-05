"""Small real-PostgreSQL integration check for database-specific schema behavior."""
import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.models import User, Subject
from app.academics_models import Topic, Concept, ConceptProgress, SyllabusVersion, ConceptReview


DATABASE_URL = os.getenv("ATLAS_TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="ATLAS_TEST_DATABASE_URL is not configured")


def test_postgres_persists_academic_json_and_review_timestamps():
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    user_id = None
    try:
        with Session() as db:
            user = User(email=f"pg-{uuid4().hex}@example.test", password_hash="test-hash")
            db.add(user)
            db.flush()
            user_id = user.id

            subject = Subject(user_id=user.id, name="PostgreSQL integration", term="Semester 7")
            db.add(subject)
            db.flush()
            topic = Topic(subject_id=subject.id, title="Transactions", source_pages=[2, 4])
            db.add(topic)
            db.flush()
            concept = Concept(topic_id=topic.id, title="Isolation", source_pages=[4])
            db.add(concept)
            db.flush()

            now = datetime.now(timezone.utc)
            progress = ConceptProgress(
                user_id=user.id, concept_id=concept.id, exposure="studied",
                understanding="developing", recall="needs_practice", confidence=3,
                last_reviewed=now, next_review_at=now + timedelta(days=3),
            )
            version = SyllabusVersion(
                subject_id=subject.id, version_name="PG snapshot",
                snapshot={"topics": [{"title": "Transactions", "source_pages": [2, 4]}]},
            )
            review = ConceptReview(
                user_id=user.id, concept_id=concept.id, exposure="studied",
                understanding="developing", recall="needs_practice", confidence=3,
                reviewed_at=now, next_review_at=now + timedelta(days=3),
            )
            db.add_all([progress, version, review])
            db.commit()

            db.refresh(topic)
            db.refresh(version)
            db.refresh(progress)
            assert topic.source_pages == [2, 4]
            assert version.snapshot["topics"][0]["source_pages"] == [2, 4]
            assert progress.next_review_at is not None
            assert progress.next_review_at.tzinfo is not None
            assert db.scalar(select(ConceptReview).where(ConceptReview.user_id == user.id)) is not None
    finally:
        if user_id is not None:
            with Session() as cleanup:
                user = cleanup.get(User, user_id)
                if user is not None:
                    cleanup.delete(user)
                    cleanup.commit()
        engine.dispose()
