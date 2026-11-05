"""Add concept prerequisite relationships.

Revision ID: 0005_concept_prerequisites
Revises: 0004_syllabus_versions_reviews
Create Date: 2026-11-05
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0005_concept_prerequisites"
down_revision: Union[str, None] = "0004_syllabus_versions_reviews"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "concept_prerequisites",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("concept_id", sa.Integer(), nullable=False),
        sa.Column("prerequisite_concept_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["concept_id"], ["concepts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["prerequisite_concept_id"], ["concepts.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("concept_id", "prerequisite_concept_id", name="uq_concept_prerequisite"),
        sa.CheckConstraint("concept_id != prerequisite_concept_id", name="ck_concept_prerequisite_not_self"),
    )
    op.create_index("ix_concept_prerequisites_concept_id", "concept_prerequisites", ["concept_id"], unique=False)
    op.create_index("ix_concept_prerequisites_prerequisite_concept_id", "concept_prerequisites", ["prerequisite_concept_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_concept_prerequisites_prerequisite_concept_id", table_name="concept_prerequisites")
    op.drop_index("ix_concept_prerequisites_concept_id", table_name="concept_prerequisites")
    op.drop_table("concept_prerequisites")
