"""Add independent exploration sessions and saved items.

Revision ID: 0008_explore_sessions
Revises: 0007_explore_highlight_positions
Create Date: 2026-11-06
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0008_explore_sessions"
down_revision: Union[str, None] = "0007_explore_highlight_positions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "explore_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=240), nullable=False),
        sa.Column("central_question", sa.Text(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_explore_sessions_user_id", "explore_sessions", ["user_id"])
    op.create_table(
        "explore_session_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("explore_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("title", sa.String(length=240), nullable=False),
        sa.Column("body", sa.Text(), nullable=False, server_default=""),
        sa.Column("url", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_explore_session_items_session_id", "explore_session_items", ["session_id"])


def downgrade() -> None:
    op.drop_index("ix_explore_session_items_session_id", table_name="explore_session_items")
    op.drop_table("explore_session_items")
    op.drop_index("ix_explore_sessions_user_id", table_name="explore_sessions")
    op.drop_table("explore_sessions")
