from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import Subject, User
from app.academics_models import Topic, Concept, ConceptProgress, ConceptReview, SyllabusVersion, Exam
from app.syllabus_import import MAX_PDF_BYTES, parse_syllabus_pdf
from app.academics_schemas import (
    TopicCreate, TopicUpdate, TopicOut, ConceptCreate, ConceptUpdate, ConceptOut,
    ProgressUpdate, ProgressOut, ExamCreate, ExamUpdate, ExamOut, SyllabusConfirm,
    ConceptReviewOut, SyllabusVersionOut, SyllabusVersionDetail, SyllabusVersionCreate
)
from app.security import get_current_user

router = APIRouter(tags=["academics"])

def owned_subject(db: Session, subject_id: int, user_id: int):
    subject = db.scalar(select(Subject).where(Subject.id == subject_id, Subject.user_id == user_id))
    if not subject:
        raise HTTPException(404, "Subject not found")
    return subject



def save_syllabus_version(db: Session, subject_id: int, user_id: int, label: str):
    topic_rows = list(db.scalars(
        select(Topic).where(Topic.subject_id == subject_id).order_by(Topic.position, Topic.id)
    ))
    concept_rows = list(db.scalars(
        select(Concept)
        .join(Topic, Topic.id == Concept.topic_id)
        .where(Topic.subject_id == subject_id)
        .order_by(Concept.position, Concept.id)
    ))
    concepts_by_topic = {}
    for concept in concept_rows:
        concepts_by_topic.setdefault(concept.topic_id, []).append({
            "id": concept.id,
            "title": concept.title,
            "description": concept.description,
            "position": concept.position,
            "source_pages": concept.source_pages,
        })
    snapshot = {
        "topics": [
            {
                "id": topic.id,
                "parent_topic_id": topic.parent_topic_id,
                "title": topic.title,
                "description": topic.description,
                "position": topic.position,
                "source_pages": topic.source_pages,
                "concepts": concepts_by_topic.get(topic.id, []),
            }
            for topic in topic_rows
        ]
    }
    latest = db.scalar(
        select(func.max(SyllabusVersion.version_number))
        .where(SyllabusVersion.subject_id == subject_id)
    )
    version = SyllabusVersion(
        subject_id=subject_id,
        version_number=(latest or 0) + 1,
        label=label,
        snapshot=snapshot,
        created_by=user_id,
    )
    db.add(version)
    return version


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
        save_syllabus_version(db, subject_id, user.id, "Imported syllabus")
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {"subject_id": subject_id, "topics_created": topic_count, "concepts_created": concept_count}



@router.post("/subjects/{subject_id}/syllabus/versions", response_model=SyllabusVersionOut, status_code=201)
def create_syllabus_snapshot(subject_id: int, data: SyllabusVersionCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    owned_subject(db, subject_id, user.id)
    version = save_syllabus_version(db, subject_id, user.id, data.label)
    db.commit()
    db.refresh(version)
    return version


@router.get("/subjects/{subject_id}/syllabus/versions", response_model=list[SyllabusVersionOut])
def list_syllabus_versions(subject_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    owned_subject(db, subject_id, user.id)
    return list(db.scalars(select(SyllabusVersion).where(SyllabusVersion.subject_id == subject_id).order_by(SyllabusVersion.version_number.desc())))



@router.post("/subjects/{subject_id}/syllabus/versions/{version_id}/restore")
def restore_syllabus_version(subject_id: int, version_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    owned_subject(db, subject_id, user.id)
    version = db.scalar(select(SyllabusVersion).where(
        SyllabusVersion.id == version_id,
        SyllabusVersion.subject_id == subject_id,
    ))
    if not version:
        raise HTTPException(404, "Syllabus version not found")

    save_syllabus_version(db, subject_id, user.id, "Before restoring version " + str(version.version_number))
    db.flush()
    current_topics = list(db.scalars(select(Topic).where(Topic.subject_id == subject_id)))
    for topic in current_topics:
        db.delete(topic)
    db.flush()

    remaining = list(version.snapshot.get("topics", []))
    id_map = {}
    while remaining:
        made_progress = False
        for item in remaining[:]:
            old_parent = item.get("parent_topic_id")
            if old_parent is not None and old_parent not in id_map:
                continue
            topic = Topic(
                subject_id=subject_id,
                parent_topic_id=id_map.get(old_parent),
                title=item["title"],
                description=item.get("description"),
                position=item.get("position", 0),
                source_pages=item.get("source_pages"),
            )
            db.add(topic)
            db.flush()
            id_map[item["id"]] = topic.id
            for concept_data in item.get("concepts", []):
                db.add(Concept(
                    topic_id=topic.id,
                    title=concept_data["title"],
                    description=concept_data.get("description"),
                    position=concept_data.get("position", 0),
                    source_pages=concept_data.get("source_pages"),
                ))
            remaining.remove(item)
            made_progress = True
        if not made_progress:
            db.rollback()
            raise HTTPException(400, "This syllabus snapshot contains an invalid topic hierarchy")

    save_syllabus_version(db, subject_id, user.id, "Restored version " + str(version.version_number))
    db.commit()
    return {"restored_version": version.version_number}


@router.get("/subjects/{subject_id}/syllabus/versions/{version_id}", response_model=SyllabusVersionDetail)
def get_syllabus_version(subject_id: int, version_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    owned_subject(db, subject_id, user.id)
    version = db.scalar(select(SyllabusVersion).where(SyllabusVersion.id == version_id, SyllabusVersion.subject_id == subject_id))
    if not version:
        raise HTTPException(404, "Syllabus version not found")
    return version

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
    db.add(topic); db.flush()
    save_syllabus_version(db, subject_id, user.id, "Chapter added")
    db.commit(); db.refresh(topic)
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
    if changes:
        save_syllabus_version(db, topic.subject_id, user.id, "Chapter updated")
    db.commit(); db.refresh(topic)
    return topic

@router.delete("/topics/{topic_id}", status_code=204)
def delete_topic(topic_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    topic = owned_topic(db, topic_id, user.id)
    subject_id = topic.subject_id
    db.delete(topic); db.flush()
    save_syllabus_version(db, subject_id, user.id, "Chapter removed")
    db.commit()
    return None

@router.get("/subjects/{subject_id}/concepts", response_model=list[ConceptOut])
def list_concepts(subject_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    owned_subject(db, subject_id, user.id)
    return list(db.scalars(select(Concept).join(Topic, Concept.topic_id == Topic.id).where(Topic.subject_id == subject_id).order_by(Topic.position, Concept.position, Concept.id)))

@router.post("/topics/{topic_id}/concepts", response_model=ConceptOut, status_code=201)
def create_concept(topic_id: int, data: ConceptCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    topic = owned_topic(db, topic_id, user.id)
    concept = Concept(topic_id=topic.id, **data.model_dump())
    db.add(concept); db.flush()
    save_syllabus_version(db, topic.subject_id, user.id, "Concept added")
    db.commit(); db.refresh(concept)
    return concept

@router.patch("/concepts/{concept_id}", response_model=ConceptOut)
def update_concept(concept_id: int, data: ConceptUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    concept = owned_concept(db, concept_id, user.id)
    changes = data.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(concept, key, value)
    if changes:
        topic = db.get(Topic, concept.topic_id)
        save_syllabus_version(db, topic.subject_id, user.id, "Concept updated")
    db.commit(); db.refresh(concept)
    return concept


@router.delete("/concepts/{concept_id}", status_code=204)
def delete_concept(concept_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    concept = owned_concept(db, concept_id, user.id)
    topic = db.get(Topic, concept.topic_id)
    subject_id = topic.subject_id
    db.delete(concept); db.flush()
    save_syllabus_version(db, subject_id, user.id, "Concept removed")
    db.commit()
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
    now = datetime.now(timezone.utc)
    progress.last_reviewed = now
    if progress.understanding == "weak" or progress.recall == "needs_practice":
        interval_days = 2
    elif progress.understanding == "strong" and progress.recall == "comfortable":
        interval_days = 14
    elif progress.understanding == "strong":
        interval_days = 7
    elif progress.understanding == "developing":
        interval_days = 4
    else:
        interval_days = 1
    progress.next_review_at = now + timedelta(days=interval_days)
    db.flush()
    db.add(ConceptReview(
        user_id=user.id,
        concept_id=concept_id,
        reviewed_at=now,
        exposure=progress.exposure,
        understanding=progress.understanding,
        recall=progress.recall,
        confidence=progress.confidence,
        notes=progress.notes,
    ))
    db.commit(); db.refresh(progress)
    return progress


@router.get("/concepts/{concept_id}/reviews", response_model=list[ConceptReviewOut])
def list_concept_reviews(concept_id: int, limit: int = 20, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    owned_concept(db, concept_id, user.id)
    safe_limit = min(max(limit, 1), 100)
    return list(db.scalars(
        select(ConceptReview)
        .where(ConceptReview.user_id == user.id, ConceptReview.concept_id == concept_id)
        .order_by(ConceptReview.reviewed_at.desc())
        .limit(safe_limit)
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
    next_exam = db.scalar(
        select(Exam)
        .where(Exam.user_id == user.id, Exam.subject_id == subject_id, Exam.exam_date >= now)
        .order_by(Exam.exam_date.asc())
    )
    due_count = db.scalar(
        select(func.count(ConceptProgress.id))
        .join(Concept, Concept.id == ConceptProgress.concept_id)
        .join(Topic, Topic.id == Concept.topic_id)
        .where(
            Topic.subject_id == subject_id,
            ConceptProgress.user_id == user.id,
            ConceptProgress.next_review_at.is_not(None),
            ConceptProgress.next_review_at <= now,
        )
    ) or 0
    days_until_exam = max(0, (next_exam.exam_date.date() - now.date()).days) if next_exam else None
    recommendations = [
        {"reason": "weak_understanding", "count": counts.get("weak", 0), "message": "Revisit concepts marked as weak."},
        {"reason": "not_assessed", "count": total - assessed + counts.get("not_assessed", 0), "message": "Assess concepts you have not reviewed yet."},
        {"reason": "due_for_review", "count": due_count, "message": "These concepts have reached their suggested review date."},
    ]
    if next_exam and days_until_exam is not None and days_until_exam <= 14:
        recommendations.append({
            "reason": "upcoming_exam",
            "count": counts.get("weak", 0) + due_count,
            "message": next_exam.title + " is in " + str(days_until_exam) + " days. Prioritize weak and due concepts first.",
        })
    return {
        "subject_id": subject_id,
        "total_concepts": total,
        "strong": counts.get("strong", 0),
        "developing": counts.get("developing", 0),
        "weak": counts.get("weak", 0),
        "not_assessed": total - assessed + counts.get("not_assessed", 0),
        "due_for_review": due_count,
        "next_exam": {
            "title": next_exam.title,
            "exam_date": next_exam.exam_date,
            "days_until": days_until_exam,
        } if next_exam else None,
        "recommendations": recommendations,
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
