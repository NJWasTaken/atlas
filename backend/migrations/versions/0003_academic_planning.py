"""Add academic terms, syllabus snapshots, and concept review scheduling.

Revision ID: 0003_academic_planning
Revises: 0002_source_pages
Create Date: 2026-11-05
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0003_academic_planning"
down_revision: Union[str, None] = "0002_source_pages"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("subjects", sa.Column("term", sa.String(length=60), nullable=True))
    op.add_column("concept_progress", sa.Column("next_review_at", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "syllabus_versions",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("subject_id", sa.Integer(), nullable=False),
        sa.Column("version_name", sa.String(length=100), nullable=False),
        sa.Column("snapshot", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_syllabus_versions_subject_id", "syllabus_versions", ["subject_id"], unique=False)

    op.create_table(
        "concept_reviews",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("concept_id", sa.Integer(), nullable=False),
        sa.Column("exposure", sa.String(length=20), nullable=False),
        sa.Column("understanding", sa.String(length=20), nullable=False),
        sa.Column("recall", sa.String(length=20), nullable=False),
        sa.Column("confidence", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("next_review_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["concept_id"], ["concepts.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_concept_reviews_user_id", "concept_reviews", ["user_id"], unique=False)
    op.create_index("ix_concept_reviews_concept_id", "concept_reviews", ["concept_id"], unique=False)
    op.create_index("ix_concept_reviews_next_review_at", "concept_reviews", ["next_review_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_concept_reviews_next_review_at", table_name="concept_reviews")
    op.drop_index("ix_concept_reviews_concept_id", table_name="concept_reviews")
    op.drop_index("ix_concept_reviews_user_id", table_name="concept_reviews")
    op.drop_table("concept_reviews")
    op.drop_index("ix_syllabus_versions_subject_id", table_name="syllabus_versions")
    op.drop_table("syllabus_versions")
    op.drop_column("concept_progress", "next_review_at")
    op.drop_column("subjects", "term")
