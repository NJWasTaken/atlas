from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db import get_db
from app.models import Subject, User
from app.schemas import SubjectCreate, SubjectOutput
from app.security import get_current_user

router = APIRouter(prefix="/subjects", tags=["subjects"])

@router.get("", response_model=list[SubjectOutput])
def list_subjects(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return list(db.scalars(select(Subject).where(Subject.user_id == user.id).order_by(Subject.created_at.desc())))

@router.post("", response_model=SubjectOutput, status_code=201)
def create_subject(data: SubjectCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    subject = Subject(user_id=user.id, name=data.name.strip(), code=data.code, description=data.description)
    db.add(subject)
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
