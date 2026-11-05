from pydantic import BaseModel, EmailStr, ConfigDict, Field, model_validator
from datetime import date, datetime

class AuthInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=4, max_length=128)

class TokenOutput(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserOutput(BaseModel):
    id: int
    email: EmailStr
    model_config = ConfigDict(from_attributes=True)

class QuoteOutput(BaseModel):
    quote: str
    author: str
    work: str | None = None

class SubjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    code: str | None = Field(default=None, max_length=32)
    description: str | None = None
    term: str | None = Field(default=None, max_length=32)
    academic_year: str | None = Field(default=None, max_length=16)

class SubjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    code: str | None = Field(default=None, max_length=32)
    description: str | None = None
    term: str | None = Field(default=None, max_length=32)
    academic_year: str | None = Field(default=None, max_length=16)

    @model_validator(mode="after")
    def reject_null_name(self):
        if "name" in self.model_fields_set and self.name is None:
            raise ValueError("name cannot be null")
        return self


class SubjectOutput(BaseModel):
    id: int
    name: str
    code: str | None
    description: str | None
    term: str | None
    academic_year: str | None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class DayNoteUpsert(BaseModel):
    note: str = Field(min_length=1, max_length=4000)

class DayNoteOutput(BaseModel):
    day: date
    note: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
