from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class KnowledgeNode(Base):
    __tablename__ = "knowledge_nodes"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(24), nullable=False, default="concept")
    title: Mapped[str] = mapped_column(String(240), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    position_x: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    position_y: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    position_z: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class KnowledgeEdge(Base):
    __tablename__ = "knowledge_edges"
    __table_args__ = (
        UniqueConstraint("user_id", "source_node_id", "target_node_id", "label", name="uq_knowledge_edge"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    source_node_id: Mapped[int] = mapped_column(ForeignKey("knowledge_nodes.id", ondelete="CASCADE"), index=True)
    target_node_id: Mapped[int] = mapped_column(ForeignKey("knowledge_nodes.id", ondelete="CASCADE"), index=True)
    label: Mapped[str] = mapped_column(String(80), nullable=False, default="related to")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
