from datetime import datetime
from typing import Annotated, Literal
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, field_validator


NodeKind = Literal["topic", "concept", "question", "note", "source", "claim"]


class KnowledgeNodeCreate(BaseModel):
    kind: NodeKind = "concept"
    title: str = Field(min_length=1, max_length=240)
    body: str = Field(default="", max_length=20000)
    source_url: str | None = Field(default=None, max_length=2048)
    position_x: float = Field(default=0, ge=-10000, le=10000)
    position_y: float = Field(default=0, ge=-10000, le=10000)
    position_z: float = Field(default=0, ge=-10000, le=10000)

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("A node needs a title")
        return value

    @field_validator("body")
    @classmethod
    def clean_body(cls, value: str) -> str:
        return value.strip()

    @field_validator("source_url")
    @classmethod
    def clean_source_url(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        value = value.strip()
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError("Use a public HTTP or HTTPS source URL")
        return value


class KnowledgeNodeUpdate(BaseModel):
    kind: NodeKind | None = None
    title: str | None = Field(default=None, min_length=1, max_length=240)
    body: str | None = Field(default=None, max_length=20000)
    source_url: str | None = Field(default=None, max_length=2048)
    position_x: float | None = Field(default=None, ge=-10000, le=10000)
    position_y: float | None = Field(default=None, ge=-10000, le=10000)
    position_z: float | None = Field(default=None, ge=-10000, le=10000)

    @field_validator("title")
    @classmethod
    def clean_updated_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("A node needs a title")
        return value

    @field_validator("body")
    @classmethod
    def clean_updated_body(cls, value: str | None) -> str | None:
        return value.strip() if value is not None else None

    @field_validator("source_url")
    @classmethod
    def clean_updated_source_url(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        value = value.strip()
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError("Use a public HTTP or HTTPS source URL")
        return value


class KnowledgeNodeOut(BaseModel):
    id: int
    kind: NodeKind
    title: str
    body: str
    source_url: str | None
    position_x: float
    position_y: float
    position_z: float
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class KnowledgeEdgeCreate(BaseModel):
    source_node_id: Annotated[int, Field(gt=0)]
    target_node_id: Annotated[int, Field(gt=0)]
    label: str = Field(default="related to", min_length=1, max_length=80)

    @field_validator("label")
    @classmethod
    def clean_label(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("A relationship needs a label")
        return value


class KnowledgeEdgeOut(BaseModel):
    id: int
    source_node_id: int
    target_node_id: int
    label: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class GraphOut(BaseModel):
    nodes: list[KnowledgeNodeOut]
    edges: list[KnowledgeEdgeOut]


class WebSearchRequest(BaseModel):
    q: str = Field(min_length=2, max_length=600)
    count: int = Field(default=10, ge=1, le=20)

    @field_validator("q")
    @classmethod
    def clean_query(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Enter a search query")
        return value


class WebSearchResult(BaseModel):
    title: str
    url: str
    description: str = ""
    age: str | None = None
    domain: str | None = None


class WebSearchResponse(BaseModel):
    results: list[WebSearchResult]
    more_results_available: bool = False


class BrowseRequest(BaseModel):
    url: str = Field(min_length=8, max_length=2048)

    @field_validator("url")
    @classmethod
    def clean_url(cls, value: str) -> str:
        return value.strip()


class BrowseResponse(BaseModel):
    url: str
    title: str
    site_name: str | None = None
    author: str | None = None
    published_date: str | None = None
    content_markdown: str
    excerpt: str = ""
