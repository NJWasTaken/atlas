"""Persist normalized PDF highlight rectangles.

Revision ID: 0007_explore_highlight_positions
Revises: 0006_explore_library
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0007_explore_highlight_positions"
down_revision: Union[str, None] = "0006_explore_library"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("explore_annotations", sa.Column("highlight_rects", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("explore_annotations", "highlight_rects")
