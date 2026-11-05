from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import Subject, User
from app.academics_models import Topic, Concept, ConceptProgress, Exam
from app.academics_schemas import (
    TopicCreate, TopicUpdate, TopicOut, ConceptCreate, ConceptOut,
    ProgressUpdate, ProgressOut, ExamCreate, ExamUpdate, ExamOut
)
from app.security import get_current_user

router = APIRouter(tags=["academics"])

def owned_subject(db: Session, subject_id: int, user_id: int):
    subject = db.scalar(select(Subject).where(Subject.id == subject_id, Subject.user_id == user_id))
    if not subject:
        raise HTTPException(404, "Subject not found")
    return subject

def owned_topic(db: Session, topic_id: int, user_id: int):
    topic = db.scalar(select(Topic).join(Subject, Topic.subject_id == Subject.id).where(Topic.id == topic_id, Subject.user_id == user_id))
    if not topic:
        raise HTTPException(404, "Topic not found")
    return topic

def owned_concept(db: Session, concept_id: int, user_id: int):
    concept = db.scalar(select(Concept).join(Topic, Concept.topic_id == Topic.id).join(Subject, Topic.subject_id == Subject.id).where(
        Concept.id == concept_id, Subject.user_id == user_id
    ))
    if not concept:
        raise HTTPException(404, "Concept not found")
    return concept

@router.get("/subjects/{subject_id}/topics", response_model=list[TopicOut])
def list_topics(subject_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    owned_subject(db, subject_id, user.id)
    return list(db.scalars(select(Topic).where(Topic.subject_id == subject_id).order_by(Topic.position, Topic.id)))

@router.post("/subjects/{subject_id}/topics", response_model=TopicOut, status_code=201)
def create_topic(subject_id: int, data: TopicCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    owned_subject(db, subject_id, user.id)
    if data.parent_topic_id is not None:
        parent = owned_topic(db, data.parent_topic_id, user.id)
        if parent.subject_id != subject_id:
            raise HTTPException(400, "Parent topic must belong to the same subject")
    topic = Topic(subject_id=subject_id, **data.model_dump())
    db.add(topic); db.commit(); db.refresh(topic)
    return topic

@router.patch("/topics/{topic_id}", response_model=TopicOut)
def update_topic(topic_id: int, data: TopicUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    topic = owned_topic(db, topic_id, user.id)
    changes = data.model_dump(exclude_unset=True)
    if "parent_topic_id" in changes and changes["parent_topic_id"] is not None:
        parent = owned_topic(db, changes["parent_topic_id"], user.id)
        if parent.subject_id != topic.subject_id or parent.id == topic.id:
            raise HTTPException(400, "Invalid parent topic")
        # Walk upwards from the proposed parent; if we encounter this topic,
        # the move would create a cycle in the hierarchy.
        ancestor = parent
        while ancestor is not None:
            if ancestor.id == topic.id:
                raise HTTPException(400, "A topic cannot be nested under one of its descendants")
            ancestor = db.get(Topic, ancestor.parent_topic_id) if ancestor.parent_topic_id else None
    for key, value in changes.items(): setattr(topic, key, value)
    db.commit(); db.refresh(topic)
    return topic

@router.delete("/topics/{topic_id}", status_code=204)
def delete_topic(topic_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    topic = owned_topic(db, topic_id, user.id)
    db.delete(topic); db.commit()
    return None

@router.get("/subjects/{subject_id}/concepts", response_model=list[ConceptOut])
def list_concepts(subject_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    owned_subject(db, subject_id, user.id)
    return list(db.scalars(select(Concept).join(Topic, Concept.topic_id == Topic.id).where(Topic.subject_id == subject_id).order_by(Topic.position, Concept.position, Concept.id)))

@router.post("/topics/{topic_id}/concepts", response_model=ConceptOut, status_code=201)
def create_concept(topic_id: int, data: ConceptCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    topic = owned_topic(db, topic_id, user.id)
    concept = Concept(topic_id=topic.id, **data.model_dump())
    db.add(concept); db.commit(); db.refresh(concept)
    return concept

@router.delete("/concepts/{concept_id}", status_code=204)
def delete_concept(concept_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    concept = owned_concept(db, concept_id, user.id)
    db.delete(concept); db.commit()
    return None

@router.get("/concepts/{concept_id}/progress", response_model=ProgressOut | None)
def get_progress(concept_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    owned_concept(db, concept_id, user.id)
    return db.scalar(select(ConceptProgress).where(ConceptProgress.user_id == user.id, ConceptProgress.concept_id == concept_id))

@router.patch("/concepts/{concept_id}/progress", response_model=ProgressOut)
def update_progress(concept_id: int, data: ProgressUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    owned_concept(db, concept_id, user.id)
    progress = db.scalar(select(ConceptProgress).where(ConceptProgress.user_id == user.id, ConceptProgress.concept_id == concept_id))
    if progress is None:
        progress = ConceptProgress(user_id=user.id, concept_id=concept_id)
        db.add(progress)
    for key, value in data.model_dump(exclude_unset=True).items(): setattr(progress, key, value)
    progress.last_reviewed = datetime.now(timezone.utc)
    db.commit(); db.refresh(progress)
    return progress

@router.get("/subjects/{subject_id}/readiness")
def subject_readiness(subject_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    owned_subject(db, subject_id, user.id)
    rows = db.execute(
        select(ConceptProgress.understanding, func.count(Concept.id))
        .join(Concept, Concept.id == ConceptProgress.concept_id)
        .join(Topic, Topic.id == Concept.topic_id)
        .where(Topic.subject_id == subject_id, ConceptProgress.user_id == user.id)
        .group_by(ConceptProgress.understanding)
    ).all()
    total = db.scalar(select(func.count(Concept.id)).join(Topic, Topic.id == Concept.topic_id).where(Topic.subject_id == subject_id)) or 0
    counts = {key: count for key, count in rows}
    assessed = sum(counts.values())
    return {
        "subject_id": subject_id,
        "total_concepts": total,
        "strong": counts.get("strong", 0),
        "developing": counts.get("developing", 0),
        "weak": counts.get("weak", 0),
        "not_assessed": total - assessed + counts.get("not_assessed", 0),
        "recommendations": [
            {"reason": "weak_understanding", "count": counts.get("weak", 0), "message": "Revisit concepts marked as weak."},
            {"reason": "not_assessed", "count": total - assessed + counts.get("not_assessed", 0), "message": "Assess concepts you have not reviewed yet."},
        ]
    }

@router.get("/exams", response_model=list[ExamOut])
def list_exams(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return list(db.scalars(select(Exam).where(Exam.user_id == user.id).order_by(Exam.exam_date)))

@router.post("/exams", response_model=ExamOut, status_code=201)
def create_exam(data: ExamCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    owned_subject(db, data.subject_id, user.id)
    exam = Exam(user_id=user.id, **data.model_dump())
    db.add(exam); db.commit(); db.refresh(exam)
    return exam

@router.patch("/exams/{exam_id}", response_model=ExamOut)
def update_exam(exam_id: int, data: ExamUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    exam = db.scalar(select(Exam).where(Exam.id == exam_id, Exam.user_id == user.id))
    if not exam: raise HTTPException(404, "Exam not found")
    for key, value in data.model_dump(exclude_unset=True).items(): setattr(exam, key, value)
    db.commit(); db.refresh(exam)
    return exam

@router.delete("/exams/{exam_id}", status_code=204)
def delete_exam(exam_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    exam = db.scalar(select(Exam).where(Exam.id == exam_id, Exam.user_id == user.id))
    if not exam: raise HTTPException(404, "Exam not found")
    db.delete(exam); db.commit()
    return None
