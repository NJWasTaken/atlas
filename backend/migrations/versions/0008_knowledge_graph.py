"""Add user-owned knowledge graph nodes and edges.

Revision ID: 0008_knowledge_graph
Revises: 0007_explore_highlight_positions
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0008_knowledge_graph"
down_revision: Union[str, None] = "0007_explore_highlight_positions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "knowledge_nodes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(length=24), nullable=False),
        sa.Column("title", sa.String(length=240), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("position_x", sa.Float(), nullable=False),
        sa.Column("position_y", sa.Float(), nullable=False),
        sa.Column("position_z", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_knowledge_nodes_user_id", "knowledge_nodes", ["user_id"])
    op.create_table(
        "knowledge_edges",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_node_id", sa.Integer(), sa.ForeignKey("knowledge_nodes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_node_id", sa.Integer(), sa.ForeignKey("knowledge_nodes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("label", sa.String(length=80), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "source_node_id", "target_node_id", "label", name="uq_knowledge_edge"),
    )
    op.create_index("ix_knowledge_edges_user_id", "knowledge_edges", ["user_id"])
    op.create_index("ix_knowledge_edges_source_node_id", "knowledge_edges", ["source_node_id"])
    op.create_index("ix_knowledge_edges_target_node_id", "knowledge_edges", ["target_node_id"])


def downgrade() -> None:
    op.drop_index("ix_knowledge_edges_target_node_id", table_name="knowledge_edges")
    op.drop_index("ix_knowledge_edges_source_node_id", table_name="knowledge_edges")
    op.drop_index("ix_knowledge_edges_user_id", table_name="knowledge_edges")
    op.drop_table("knowledge_edges")
    op.drop_index("ix_knowledge_nodes_user_id", table_name="knowledge_nodes")
    op.drop_table("knowledge_nodes")
