from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy import select, func, and_, case
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import Subject, User
from app.academics_models import Topic, Concept, ConceptProgress, Exam, SyllabusVersion, ConceptReview
from app.syllabus_import import MAX_PDF_BYTES, parse_syllabus_pdf
from app.academics_schemas import (
    TopicCreate, TopicUpdate, TopicOut, ConceptCreate, ConceptUpdate, ConceptOut,
    ProgressUpdate, ProgressOut, ExamCreate, ExamUpdate, ExamOut, SyllabusConfirm,
    SyllabusVersionCreate, SyllabusVersionOut, ConceptReviewOut
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


def is_due(value: datetime | None, now: datetime) -> bool:
    if value is None:
        return False
    normalized = value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value
    return normalized <= now


def review_interval_days(progress: ConceptProgress) -> int:
    if progress.understanding == "weak" or progress.recall == "needs_practice":
        return 1
    if progress.understanding == "developing" or (progress.confidence is not None and progress.confidence <= 2):
        return 3
    if progress.understanding == "strong" and progress.recall == "comfortable" and (progress.confidence or 0) >= 4:
        return 14
    return 7


def syllabus_snapshot(db: Session, subject_id: int) -> dict:
    topics = list(db.scalars(select(Topic).where(Topic.subject_id == subject_id).order_by(Topic.position, Topic.id)))
    topic_ids = [topic.id for topic in topics]
    concepts = list(db.scalars(select(Concept).where(Concept.topic_id.in_(topic_ids)).order_by(Concept.position, Concept.id))) if topic_ids else []
    concepts_by_topic: dict[int, list[dict]] = {}
    for concept in concepts:
        concepts_by_topic.setdefault(concept.topic_id, []).append({
            "id": concept.id, "title": concept.title, "description": concept.description,
            "position": concept.position, "source_pages": concept.source_pages,
        })
    return {"topics": [{
        "id": topic.id, "title": topic.title, "parent_topic_id": topic.parent_topic_id,
        "description": topic.description, "position": topic.position,
        "source_pages": topic.source_pages, "concepts": concepts_by_topic.get(topic.id, []),
    } for topic in topics]}

@router.get("/overview")
def overview_data(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    subjects = list(db.scalars(select(Subject).where(Subject.user_id == user.id).order_by(Subject.name)))
    subject_ids = [subject.id for subject in subjects]
    summaries = []
    if subject_ids:
        concept_rows = db.execute(
            select(Subject.id, Subject.name, Subject.term, func.count(Concept.id),
                   func.sum(case((ConceptProgress.id.is_not(None), 1), else_=0)))
            .outerjoin(Topic, Topic.subject_id == Subject.id)
            .outerjoin(Concept, Concept.topic_id == Topic.id)
            .outerjoin(ConceptProgress, and_(ConceptProgress.concept_id == Concept.id, ConceptProgress.user_id == user.id))
            .where(Subject.id.in_(subject_ids))
            .group_by(Subject.id, Subject.name, Subject.term)
        ).all()
        for subject_id, name, term, total, assessed in concept_rows:
            summaries.append({"subject_id": subject_id, "subject_name": name, "term": term,
                              "total_concepts": total or 0, "assessed_concepts": assessed or 0})
    upcoming_exams = list(db.scalars(
        select(Exam).where(Exam.user_id == user.id, Exam.exam_date >= now)
        .order_by(Exam.exam_date).limit(8)
    ))
    continue_rows = db.execute(
        select(Concept, Topic, Subject, ConceptProgress)
        .join(Topic, Topic.id == Concept.topic_id)
        .join(Subject, Subject.id == Topic.subject_id)
        .outerjoin(ConceptProgress, and_(ConceptProgress.concept_id == Concept.id, ConceptProgress.user_id == user.id))
        .where(Subject.user_id == user.id)
    ).all()
    continue_learning = []
    for concept, topic, subject, progress in continue_rows:
        reason = None
        if progress is None or progress.understanding == "not_assessed":
            reason = "not_assessed"
        elif progress.understanding == "weak" or progress.recall == "needs_practice":
            reason = "needs_practice"
        elif is_due(progress.next_review_at, now):
            reason = "review_due"
        if reason:
            continue_learning.append({"concept_id": concept.id, "title": concept.title,
                "topic_title": topic.title, "subject_id": subject.id, "subject_name": subject.name,
                "reason": reason, "next_review_at": progress.next_review_at if progress else None})
    continue_learning.sort(key=lambda item: (0 if item["reason"] == "needs_practice" else 1 if item["reason"] == "review_due" else 2,
        ((item["next_review_at"].replace(tzinfo=timezone.utc) if item["next_review_at"] and item["next_review_at"].tzinfo is None else item["next_review_at"]) or now)))
    recent_rows = db.execute(
        select(ConceptReview, Concept.title, Subject.name)
        .join(Concept, Concept.id == ConceptReview.concept_id)
        .join(Topic, Topic.id == Concept.topic_id)
        .join(Subject, Subject.id == Topic.subject_id)
        .where(ConceptReview.user_id == user.id)
        .order_by(ConceptReview.reviewed_at.desc()).limit(8)
    ).all()
    recent_activity = [{"concept_title": title, "subject_name": subject_name,
                        "reviewed_at": review.reviewed_at, "understanding": review.understanding,
                        "recall": review.recall} for review, title, subject_name in recent_rows]
    return {"subjects": summaries,
            "upcoming_exams": [{"id": exam.id, "subject_id": exam.subject_id, "title": exam.title,
                                "exam_date": exam.exam_date} for exam in upcoming_exams],
            "continue_learning": continue_learning[:8], "recent_activity": recent_activity}


@router.post("/subjects/{subject_id}/syllabus/draft")
async def create_syllabus_draft(
    subject_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    owned_subject(db, subject_id, user.id)
    filename = (file.filename or "syllabus.pdf").replace(chr(92), "/").split("/")[-1]
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Please upload a PDF file.")
    content = await file.read(MAX_PDF_BYTES + 1)
    await file.close()
    if len(content) > MAX_PDF_BYTES:
        raise HTTPException(413, "This PDF is larger than the 12 MB upload limit.")
    try:
        parsed = parse_syllabus_pdf(content)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    return {
        "file_name": filename,
        "page_count": parsed["page_count"],
        "extracted_characters": parsed["extracted_characters"],
        "topics": parsed["topics"],
        "warnings": parsed["warnings"],
    }


@router.post("/subjects/{subject_id}/syllabus/confirm", status_code=201)
def confirm_syllabus_import(
    subject_id: int,
    data: SyllabusConfirm,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    owned_subject(db, subject_id, user.id)
    topic_count = 0
    concept_count = 0
    existing_position = db.scalar(select(func.max(Topic.position)).where(Topic.subject_id == subject_id))
    first_position = (existing_position if existing_position is not None else -1) + 1
    try:
        for topic_position, topic_draft in enumerate(data.topics, start=first_position):
            topic = Topic(
                subject_id=subject_id,
                title=topic_draft.title.strip(),
                position=topic_position,
                source_pages=topic_draft.source_pages or None,
            )
            db.add(topic)
            db.flush()
            topic_count += 1
            for concept_position, concept_draft in enumerate(topic_draft.concepts):
                db.add(Concept(
                    topic_id=topic.id,
                    title=concept_draft.title.strip(),
                    position=concept_position,
                    source_pages=concept_draft.source_pages or None,
                ))
                concept_count += 1
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {"subject_id": subject_id, "topics_created": topic_count, "concepts_created": concept_count}



@router.get("/subjects/{subject_id}/syllabus/versions", response_model=list[SyllabusVersionOut])
def list_syllabus_versions(subject_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    owned_subject(db, subject_id, user.id)
    return list(db.scalars(select(SyllabusVersion).where(SyllabusVersion.subject_id == subject_id).order_by(SyllabusVersion.created_at.desc())))


@router.post("/subjects/{subject_id}/syllabus/versions", response_model=SyllabusVersionOut, status_code=201)
def create_syllabus_version(subject_id: int, data: SyllabusVersionCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    owned_subject(db, subject_id, user.id)
    version = SyllabusVersion(subject_id=subject_id, version_name=data.version_name, snapshot=syllabus_snapshot(db, subject_id))
    db.add(version)
    db.commit()
    db.refresh(version)
    return version


@router.get("/subjects/{subject_id}/syllabus/versions/{version_id}")
def get_syllabus_version(subject_id: int, version_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    owned_subject(db, subject_id, user.id)
    version = db.scalar(select(SyllabusVersion).where(SyllabusVersion.id == version_id, SyllabusVersion.subject_id == subject_id))
    if not version:
        raise HTTPException(404, "Syllabus version not found")
    return {"id": version.id, "subject_id": subject_id, "version_name": version.version_name, "created_at": version.created_at, "snapshot": version.snapshot}


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

@router.patch("/concepts/{concept_id}", response_model=ConceptOut)
def update_concept(concept_id: int, data: ConceptUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    concept = owned_concept(db, concept_id, user.id)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(concept, key, value)
    db.commit(); db.refresh(concept)
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
    reviewed_at = datetime.now(timezone.utc)
    progress.last_reviewed = reviewed_at
    progress.next_review_at = reviewed_at + timedelta(days=review_interval_days(progress))
    review = ConceptReview(
        user_id=user.id, concept_id=concept_id, exposure=progress.exposure,
        understanding=progress.understanding, recall=progress.recall,
        confidence=progress.confidence, notes=progress.notes,
        reviewed_at=reviewed_at, next_review_at=progress.next_review_at,
    )
    db.add(review)
    db.commit(); db.refresh(progress)
    return progress


@router.get("/concepts/{concept_id}/reviews", response_model=list[ConceptReviewOut])
def list_concept_reviews(concept_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    owned_concept(db, concept_id, user.id)
    return list(db.scalars(
        select(ConceptReview).where(ConceptReview.user_id == user.id, ConceptReview.concept_id == concept_id)
        .order_by(ConceptReview.reviewed_at.desc()).limit(50)
    ))

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
    now = datetime.now(timezone.utc)
    upcoming_exam = db.scalar(select(Exam).where(Exam.user_id == user.id, Exam.subject_id == subject_id, Exam.exam_date >= now).order_by(Exam.exam_date).limit(1))
    exam_at = (upcoming_exam.exam_date.replace(tzinfo=timezone.utc) if upcoming_exam and upcoming_exam.exam_date.tzinfo is None else upcoming_exam.exam_date if upcoming_exam else None)
    days_until_exam = max(0, (exam_at - now).days) if exam_at else None
    concept_rows = db.execute(
        select(Concept, Topic, ConceptProgress)
        .join(Topic, Topic.id == Concept.topic_id)
        .outerjoin(ConceptProgress, and_(ConceptProgress.concept_id == Concept.id, ConceptProgress.user_id == user.id))
        .where(Topic.subject_id == subject_id)
        .order_by(Topic.position, Concept.position, Concept.id)
    ).all()
    items = []
    for concept, topic, progress in concept_rows:
        reason = None
        due_at = progress.next_review_at if progress else None
        if progress is None or progress.understanding == "not_assessed":
            reason = "not_assessed"
        elif progress.understanding == "weak" or progress.recall == "needs_practice":
            reason = "needs_practice"
        elif is_due(due_at, now):
            reason = "review_due"
        if reason:
            items.append({
                "concept_id": concept.id, "title": concept.title, "topic_title": topic.title,
                "reason": reason, "next_review_at": due_at,
                "exam_date": upcoming_exam.exam_date if upcoming_exam else None,
                "exam_title": upcoming_exam.title if upcoming_exam else None,
                "days_until_exam": days_until_exam,
                "priority": "high" if days_until_exam is not None and days_until_exam <= 14 else "normal",
            })
    items.sort(key=lambda item: (0 if item["priority"] == "high" else 1, 0 if item["reason"] == "needs_practice" else 1 if item["reason"] == "review_due" else 2, (item["next_review_at"].replace(tzinfo=timezone.utc) if item["next_review_at"] and item["next_review_at"].tzinfo is None else item["next_review_at"]) or now))
    return {
        "subject_id": subject_id,
        "total_concepts": total,
        "strong": counts.get("strong", 0),
        "developing": counts.get("developing", 0),
        "weak": counts.get("weak", 0),
        "not_assessed": total - assessed + counts.get("not_assessed", 0),
        "next_exam": {"title": upcoming_exam.title, "exam_date": upcoming_exam.exam_date, "days_until": days_until_exam} if upcoming_exam else None,
        "items": items[:12],
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
