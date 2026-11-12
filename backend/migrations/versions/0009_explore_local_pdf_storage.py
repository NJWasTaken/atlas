"""Store new Explore PDFs on the backend filesystem.

Revision ID: 0009_explore_local_pdf_storage
Revises: 0008_pdf_annotation_styles
Create Date: 2026-11-12
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0009_explore_local_pdf_storage"
down_revision: Union[str, None] = "0008_pdf_annotation_styles"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("explore_documents", sa.Column("storage_path", sa.String(length=80), nullable=True))
    op.alter_column("explore_documents", "pdf_data", existing_type=sa.LargeBinary(), nullable=True)


def downgrade() -> None:
    connection = op.get_bind()
    has_files = connection.execute(sa.text(
        "SELECT 1 FROM explore_documents WHERE storage_path IS NOT NULL LIMIT 1"
    )).first()
    if has_files:
        raise RuntimeError("Cannot downgrade while filesystem-backed PDFs exist; migrate them into pdf_data first.")
    op.alter_column("explore_documents", "pdf_data", existing_type=sa.LargeBinary(), nullable=False)
    op.drop_column("explore_documents", "storage_path")
