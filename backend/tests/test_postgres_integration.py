import os

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import Base
from app.models import User, Subject
from app.academics_models import Topic, Concept, ConceptProgress

DATABASE_URL = os.getenv("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="TEST_DATABASE_URL is not configured")


@pytest.fixture(scope="module")
def postgres_engine():
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def test_postgres_persists_json_source_pages_and_review_constraints(postgres_engine):
    with Session(postgres_engine) as session:
        user = User(email="postgres-integration@example.com", password_hash="test-hash")
        session.add(user)
        session.flush()
        subject = Subject(user_id=user.id, name="Distributed Systems", term="Semester 6", academic_year="2026-27")
        session.add(subject)
        session.flush()
        topic = Topic(subject_id=subject.id, title="Consensus", source_pages=[2, 3])
        session.add(topic)
        session.flush()
        concept = Concept(topic_id=topic.id, title="Raft", source_pages=[4])
        session.add(concept)
        session.flush()
        progress = ConceptProgress(
            user_id=user.id,
            concept_id=concept.id,
            understanding="developing",
            recall="needs_practice",
            confidence=3,
        )
        session.add(progress)
        session.commit()

        stored_topic = session.scalar(select(Topic).where(Topic.id == topic.id))
        stored_concept = session.scalar(select(Concept).where(Concept.id == concept.id))
        assert stored_topic.source_pages == [2, 3]
        assert stored_concept.source_pages == [4]
        assert session.scalar(select(Subject).where(Subject.id == subject.id)).term == "Semester 6"

        session.add(ConceptProgress(user_id=user.id, concept_id=concept.id, confidence=6))
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()
