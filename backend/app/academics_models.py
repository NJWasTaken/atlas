from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, ForeignKey, Integer, UniqueConstraint, CheckConstraint, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db import Base

class Topic(Base):
    __tablename__ = "topics"
    id: Mapped[int] = mapped_column(primary_key=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"), index=True)
    parent_topic_id: Mapped[int | None] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), nullable=True)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_pages: Mapped[list[int] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    parent = relationship("Topic", remote_side="Topic.id", back_populates="children")
    children = relationship("Topic", back_populates="parent", cascade="all, delete-orphan")
    concepts = relationship("Concept", cascade="all, delete-orphan", back_populates="topic")

class Concept(Base):
    __tablename__ = "concepts"
    id: Mapped[int] = mapped_column(primary_key=True)
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_pages: Mapped[list[int] | None] = mapped_column(JSON, nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    topic = relationship("Topic", back_populates="concepts")
    progress = relationship("ConceptProgress", cascade="all, delete-orphan", back_populates="concept")

class ConceptProgress(Base):
    __tablename__ = "concept_progress"
    __table_args__ = (
        UniqueConstraint("user_id", "concept_id", name="uq_progress_user_concept"),
        CheckConstraint("confidence IS NULL OR (confidence >= 1 AND confidence <= 5)", name="ck_progress_confidence"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    concept_id: Mapped[int] = mapped_column(ForeignKey("concepts.id", ondelete="CASCADE"), index=True)
    exposure: Mapped[str] = mapped_column(String(20), default="not_started")
    understanding: Mapped[str] = mapped_column(String(20), default="not_assessed")
    recall: Mapped[str] = mapped_column(String(20), default="not_assessed")
    confidence: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_reviewed: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_review_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    concept = relationship("Concept", back_populates="progress")

class Exam(Base):
    __tablename__ = "exams"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(160), default="Examination")
    exam_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class SyllabusVersion(Base):
    __tablename__ = "syllabus_versions"
    __table_args__ = (UniqueConstraint("subject_id", "version_number", name="uq_syllabus_subject_version"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"), index=True)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    label: Mapped[str] = mapped_column(String(160), nullable=False)
    snapshot: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class ConceptReview(Base):
    __tablename__ = "concept_reviews"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    concept_id: Mapped[int] = mapped_column(ForeignKey("concepts.id", ondelete="CASCADE"), index=True)
    reviewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    exposure: Mapped[str] = mapped_column(String(20), nullable=False)
    understanding: Mapped[str] = mapped_column(String(20), nullable=False)
    recall: Mapped[str] = mapped_column(String(20), nullable=False)
    confidence: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
