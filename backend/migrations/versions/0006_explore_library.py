"""Add persistent Explore PDF library, bookmarks and annotations.

Revision ID: 0006_explore_library
Revises: 0005_concept_prerequisites
Create Date: 2026-11-05
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0006_explore_library"
down_revision: Union[str, None] = "0005_concept_prerequisites"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "explore_documents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=240), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("pdf_data", sa.LargeBinary(), nullable=False),
        sa.Column("page_count", sa.Integer(), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("last_page", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("last_opened_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_explore_documents_user_id", "explore_documents", ["user_id"])
    op.create_table(
        "explore_bookmarks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.Column("page_number", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=160), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["explore_documents.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("document_id", "page_number", name="uq_explore_bookmark_page"),
    )
    op.create_index("ix_explore_bookmarks_document_id", "explore_bookmarks", ["document_id"])
    op.create_table(
        "explore_annotations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.Column("page_number", sa.Integer(), nullable=False),
        sa.Column("selected_text", sa.Text(), nullable=True),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["explore_documents.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_explore_annotations_document_id", "explore_annotations", ["document_id"])


def downgrade() -> None:
    op.drop_index("ix_explore_annotations_document_id", table_name="explore_annotations")
    op.drop_table("explore_annotations")
    op.drop_index("ix_explore_bookmarks_document_id", table_name="explore_bookmarks")
    op.drop_table("explore_bookmarks")
    op.drop_index("ix_explore_documents_user_id", table_name="explore_documents")
    op.drop_table("explore_documents")
