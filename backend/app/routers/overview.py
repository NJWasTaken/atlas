from datetime import datetime, timezone
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends

from app.db import get_db
from app.models import Subject, User
from app.academics_models import Topic, Concept, ConceptProgress, Exam
from app.security import get_current_user

router = APIRouter(prefix="/overview", tags=["overview"])


@router.get("")
def overview_summary(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    today = now.date()

    exam_rows = db.execute(
        select(Exam, Subject.name)
        .join(Subject, Subject.id == Exam.subject_id)
        .where(Exam.user_id == user.id, Exam.exam_date >= now)
        .order_by(Exam.exam_date.asc())
        .limit(8)
    ).all()
    upcoming_exams = [
        {
            "id": exam.id,
            "subject_id": exam.subject_id,
            "subject_name": subject_name,
            "title": exam.title,
            "exam_date": exam.exam_date,
            "days_until": max(0, (exam.exam_date.date() - today).days),
        }
        for exam, subject_name in exam_rows
    ]
    next_exam_by_subject = {}
    for exam, subject_name in exam_rows:
        next_exam_by_subject.setdefault(exam.subject_id, (exam, subject_name))

    recent_rows = db.execute(
        select(ConceptProgress, Concept.title, Topic.title, Subject.id, Subject.name)
        .join(Concept, Concept.id == ConceptProgress.concept_id)
        .join(Topic, Topic.id == Concept.topic_id)
        .join(Subject, Subject.id == Topic.subject_id)
        .where(ConceptProgress.user_id == user.id, Subject.user_id == user.id)
        .order_by(func.coalesce(ConceptProgress.last_reviewed, ConceptProgress.updated_at).desc())
        .limit(6)
    ).all()
    recent_activity = [
        {
            "concept_id": progress.concept_id,
            "concept_title": concept_title,
            "topic_title": topic_title,
            "subject_id": subject_id,
            "subject_name": subject_name,
            "understanding": progress.understanding,
            "recall": progress.recall,
            "last_reviewed": progress.last_reviewed or progress.updated_at,
        }
        for progress, concept_title, topic_title, subject_id, subject_name in recent_rows
    ]

    concept_rows = db.execute(
        select(Concept, Topic, Subject, ConceptProgress)
        .join(Topic, Topic.id == Concept.topic_id)
        .join(Subject, Subject.id == Topic.subject_id)
        .outerjoin(
            ConceptProgress,
            and_(
                ConceptProgress.concept_id == Concept.id,
                ConceptProgress.user_id == user.id,
            ),
        )
        .where(Subject.user_id == user.id)
    ).all()

    suggestions = []
    for concept, topic, subject, progress in concept_rows:
        reasons = []
        priority = 0
        if progress is None or progress.understanding == "not_assessed":
            reasons.append("not_assessed")
            priority = 1
        elif progress.understanding == "weak":
            reasons.append("weak_understanding")
            priority = 4
        if progress is not None and progress.recall == "needs_practice":
            reasons.append("recall_practice")
            priority = max(priority, 3)
        if progress is not None and progress.next_review_at is not None:
            due_at = progress.next_review_at
            if due_at.tzinfo is None:
                due_at = due_at.replace(tzinfo=timezone.utc)
            if due_at <= now:
                reasons.append("due_for_review")
                priority = max(priority, 5)
        if not reasons:
            continue

        next_exam = next_exam_by_subject.get(subject.id)
        days_until_exam = None
        exam_title = None
        if next_exam:
            exam, _ = next_exam
            days_until_exam = max(0, (exam.exam_date.date() - today).days)
            exam_title = exam.title
            if days_until_exam <= 14:
                priority += 2
        suggestions.append({
            "concept_id": concept.id,
            "concept_title": concept.title,
            "topic_title": topic.title,
            "subject_id": subject.id,
            "subject_name": subject.name,
            "reason": reasons,
            "priority": priority,
            "days_until_exam": days_until_exam,
            "exam_title": exam_title,
        })

    suggestions.sort(key=lambda item: (-item["priority"], item["days_until_exam"] if item["days_until_exam"] is not None else 9999, item["concept_title"].casefold()))
    return {
        "recent_activity": recent_activity,
        "continue_learning": recent_activity[:4],
        "revision_suggestions": suggestions[:8],
        "upcoming_exams": upcoming_exams,
    }
