from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Annotated


class DocumentOut(BaseModel):
    id: int
    title: str
    filename: str
    source_url: str | None
    page_count: int
    size_bytes: int
    last_page: int
    last_opened_at: datetime | None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class DocumentProgressUpdate(BaseModel):
    last_page: Annotated[int, Field(ge=1)]


class UrlImport(BaseModel):
    url: str = Field(min_length=8, max_length=2048)
    title: str | None = Field(default=None, max_length=240)

    @field_validator("url")
    @classmethod
    def clean_url(cls, value: str) -> str:
        return value.strip()


class BookmarkCreate(BaseModel):
    page_number: Annotated[int, Field(ge=1)]
    label: str = Field(default="Bookmarked page", min_length=1, max_length=160)

    @field_validator("label")
    @classmethod
    def clean_label(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Bookmark label cannot be blank")
        return value


class BookmarkOut(BaseModel):
    id: int
    page_number: int
    label: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class HighlightRect(BaseModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    width: float = Field(gt=0, le=1)
    height: float = Field(gt=0, le=1)


class AnnotationCreate(BaseModel):
    page_number: Annotated[int, Field(ge=1)]
    selected_text: str | None = Field(default=None, max_length=12000)
    highlight_rects: list[HighlightRect] = Field(default_factory=list, max_length=500)
    note: str = Field(min_length=1, max_length=12000)

    @field_validator("note")
    @classmethod
    def clean_note(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("A note cannot be blank")
        return value


class AnnotationUpdate(BaseModel):
    selected_text: str | None = Field(default=None, max_length=12000)
    highlight_rects: list[HighlightRect] | None = Field(default=None, max_length=500)
    note: str | None = Field(default=None, min_length=1, max_length=12000)


class AnnotationOut(BaseModel):
    id: int
    page_number: int
    selected_text: str | None
    highlight_rects: list[dict[str, float]] | None = None
    note: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ExploreSessionCreate(BaseModel):
    title: str = Field(min_length=1, max_length=240)
    central_question: str = Field(min_length=1, max_length=4000)
    notes: str = Field(default="", max_length=20000)

    @field_validator("title", "central_question")
    @classmethod
    def clean_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be blank")
        return value


class ExploreSessionUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=240)
    central_question: str | None = Field(default=None, min_length=1, max_length=4000)
    notes: str | None = Field(default=None, max_length=20000)
    status: str | None = Field(default=None, pattern="^(active|paused|completed)$")

    @field_validator("title", "central_question", "notes")
    @classmethod
    def clean_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value and value != "":
            raise ValueError("This field cannot be blank")
        return value


class ExploreSessionItemCreate(BaseModel):
    kind: str = Field(pattern="^(discovery|question|resource)$")
    title: str = Field(min_length=1, max_length=240)
    body: str = Field(default="", max_length=12000)
    url: str | None = Field(default=None, max_length=2048)

    @field_validator("title")
    @classmethod
    def clean_item_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("A title is required")
        return value

    @field_validator("url")
    @classmethod
    def validate_resource_url(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        value = value.strip()
        from urllib.parse import urlparse
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("Use a public HTTP or HTTPS link")
        return value


class ExploreSessionItemUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=240)
    body: str | None = Field(default=None, max_length=12000)
    url: str | None = Field(default=None, max_length=2048)


class ExploreSessionItemOut(BaseModel):
    id: int
    session_id: int
    kind: str
    title: str
    body: str
    url: str | None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ExploreSessionOut(BaseModel):
    id: int
    title: str
    central_question: str
    notes: str
    status: str
    item_count: int = 0
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ExploreSessionDetail(ExploreSessionOut):
    items: list[ExploreSessionItemOut] = Field(default_factory=list)
