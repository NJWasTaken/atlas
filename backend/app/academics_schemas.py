from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, model_validator
from typing import Literal

Exposure = Literal["not_started", "studied"]
Understanding = Literal["not_assessed", "weak", "developing", "strong"]
Recall = Literal["not_assessed", "needs_practice", "comfortable"]

class TopicCreate(BaseModel):
    title: str = Field(min_length=1, max_length=180)
    parent_topic_id: int | None = None
    description: str | None = None
    position: int = 0

class TopicUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=180)
    parent_topic_id: int | None = None
    description: str | None = None
    position: int | None = None

    @model_validator(mode="after")
    def reject_null_required_fields(self):
        if "title" in self.model_fields_set and self.title is None:
            raise ValueError("title cannot be null")
        if "position" in self.model_fields_set and self.position is None:
            raise ValueError("position cannot be null")
        return self

class TopicOut(BaseModel):
    id: int
    subject_id: int
    parent_topic_id: int | None
    title: str
    description: str | None
    position: int
    model_config = ConfigDict(from_attributes=True)

class ConceptCreate(BaseModel):
    title: str = Field(min_length=1, max_length=180)
    description: str | None = None
    position: int = 0

class ConceptOut(BaseModel):
    id: int
    topic_id: int
    title: str
    description: str | None
    position: int
    model_config = ConfigDict(from_attributes=True)

class ProgressUpdate(BaseModel):
    exposure: Exposure = "not_started"
    understanding: Understanding = "not_assessed"
    recall: Recall = "not_assessed"
    confidence: int | None = Field(default=None, ge=1, le=5)
    notes: str | None = None

class ProgressOut(ProgressUpdate):
    id: int
    concept_id: int
    last_reviewed: datetime | None
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class ExamCreate(BaseModel):
    subject_id: int
    title: str = Field(default="Examination", min_length=1, max_length=160)
    exam_date: datetime

class ExamUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    exam_date: datetime | None = None

    @model_validator(mode="after")
    def reject_null_required_fields(self):
        if "title" in self.model_fields_set and self.title is None:
            raise ValueError("title cannot be null")
        if "exam_date" in self.model_fields_set and self.exam_date is None:
            raise ValueError("exam_date cannot be null")
        return self

class ExamOut(BaseModel):
    id: int
    subject_id: int
    title: str
    exam_date: datetime
    model_config = ConfigDict(from_attributes=True)
