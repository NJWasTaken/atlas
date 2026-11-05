"""Create the current Atlas schema baseline.

Revision ID: 0001_initial
Revises:
Create Date: 2026-11-05
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "subjects",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("code", sa.String(length=32), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_subjects_user_id", "subjects", ["user_id"], unique=False)

    op.create_table(
        "day_notes",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "day", name="uq_day_notes_user_day"),
    )
    op.create_index("ix_day_notes_user_id", "day_notes", ["user_id"], unique=False)
    op.create_index("ix_day_notes_day", "day_notes", ["day"], unique=False)

    op.create_table(
        "topics",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("subject_id", sa.Integer(), nullable=False),
        sa.Column("parent_topic_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=180), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["parent_topic_id"], ["topics.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_topics_subject_id", "topics", ["subject_id"], unique=False)

    op.create_table(
        "concepts",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("topic_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=180), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["topic_id"], ["topics.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_concepts_topic_id", "concepts", ["topic_id"], unique=False)

    op.create_table(
        "concept_progress",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("concept_id", sa.Integer(), nullable=False),
        sa.Column("exposure", sa.String(length=20), nullable=False),
        sa.Column("understanding", sa.String(length=20), nullable=False),
        sa.Column("recall", sa.String(length=20), nullable=False),
        sa.Column("confidence", sa.Integer(), nullable=True),
        sa.Column("last_reviewed", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "confidence IS NULL OR (confidence >= 1 AND confidence <= 5)",
            name="ck_progress_confidence",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["concept_id"], ["concepts.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "concept_id", name="uq_progress_user_concept"),
    )
    op.create_index("ix_concept_progress_user_id", "concept_progress", ["user_id"], unique=False)
    op.create_index("ix_concept_progress_concept_id", "concept_progress", ["concept_id"], unique=False)

    op.create_table(
        "exams",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("subject_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("exam_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_exams_user_id", "exams", ["user_id"], unique=False)
    op.create_index("ix_exams_subject_id", "exams", ["subject_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_exams_subject_id", table_name="exams")
    op.drop_index("ix_exams_user_id", table_name="exams")
    op.drop_table("exams")

    op.drop_index("ix_concept_progress_concept_id", table_name="concept_progress")
    op.drop_index("ix_concept_progress_user_id", table_name="concept_progress")
    op.drop_table("concept_progress")

    op.drop_index("ix_concepts_topic_id", table_name="concepts")
    op.drop_table("concepts")

    op.drop_index("ix_topics_subject_id", table_name="topics")
    op.drop_table("topics")

    op.drop_index("ix_day_notes_day", table_name="day_notes")
    op.drop_index("ix_day_notes_user_id", table_name="day_notes")
    op.drop_table("day_notes")

    op.drop_index("ix_subjects_user_id", table_name="subjects")
    op.drop_table("subjects")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
