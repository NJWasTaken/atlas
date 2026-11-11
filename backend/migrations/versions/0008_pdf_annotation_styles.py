"""Add style metadata to PDF annotations.

Revision ID: 0008_pdf_annotation_styles
Revises: 0007_explore_highlight_positions
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0008_pdf_annotation_styles"
down_revision: Union[str, None] = "0007_explore_highlight_positions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("explore_annotations", sa.Column("annotation_type", sa.String(length=20), nullable=False, server_default="highlight"))
    op.add_column("explore_annotations", sa.Column("color", sa.String(length=20), nullable=False, server_default="yellow"))


def downgrade() -> None:
    op.drop_column("explore_annotations", "color")
    op.drop_column("explore_annotations", "annotation_type")
