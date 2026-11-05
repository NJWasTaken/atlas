"""Add semester metadata to subjects.

Revision ID: 0003_subject_term
Revises: 0002_source_pages
Create Date: 2026-11-05
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0003_subject_term"
down_revision: Union[str, None] = "0002_source_pages"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("subjects", sa.Column("term", sa.String(length=32), nullable=True))
    op.add_column("subjects", sa.Column("academic_year", sa.String(length=16), nullable=True))


def downgrade() -> None:
    op.drop_column("subjects", "academic_year")
    op.drop_column("subjects", "term")
