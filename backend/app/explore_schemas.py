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
