from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db import get_db
from app.models import Subject, User
from app.schemas import SubjectCreate, SubjectUpdate, SubjectOutput
from app.security import get_current_user

router = APIRouter(prefix="/subjects", tags=["subjects"])

@router.get("", response_model=list[SubjectOutput])
def list_subjects(term: str | None = Query(default=None, max_length=60), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    query = select(Subject).where(Subject.user_id == user.id)
    if term is not None:
        query = query.where(Subject.term == term)
    return list(db.scalars(query.order_by(Subject.created_at.desc())))

@router.post("", response_model=SubjectOutput, status_code=201)
def create_subject(data: SubjectCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    subject = Subject(user_id=user.id, name=data.name.strip(), code=data.code, description=data.description, term=data.term.strip() if data.term else None)
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject

@router.patch("/{subject_id}", response_model=SubjectOutput)
def update_subject(subject_id: int, data: SubjectUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    subject = db.scalar(select(Subject).where(Subject.id == subject_id, Subject.user_id == user.id))
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(subject, key, value.strip() if key in {"name", "code", "term"} and value is not None else value)
    db.commit()
    db.refresh(subject)
    return subject


@router.delete("/{subject_id}", status_code=204)
def delete_subject(subject_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    subject = db.scalar(select(Subject).where(Subject.id == subject_id, Subject.user_id == user.id))
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    db.delete(subject)
    db.commit()
