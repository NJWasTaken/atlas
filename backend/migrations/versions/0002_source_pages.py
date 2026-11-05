"""Persist source page references for syllabus imports.

Revision ID: 0002_source_pages
Revises: 0001_initial
Create Date: 2026-11-05
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002_source_pages"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("topics", sa.Column("source_pages", sa.JSON(), nullable=True))
    op.add_column("concepts", sa.Column("source_pages", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("concepts", "source_pages")
    op.drop_column("topics", "source_pages")
