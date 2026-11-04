from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import DayNote, User
from app.schemas import DayNoteOutput, DayNoteUpsert
from app.security import get_current_user

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("", response_model=list[DayNoteOutput])
def list_day_notes(start: date = Query(...), end: date = Query(...),
                   db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if end < start:
        raise HTTPException(status_code=400, detail="End date must be on or after start date")
    if (end - start).days > 62:
        raise HTTPException(status_code=400, detail="Calendar range cannot exceed 63 days")
    return list(db.scalars(select(DayNote).where(
        DayNote.user_id == user.id, DayNote.day >= start, DayNote.day <= end
    ).order_by(DayNote.day.asc())))


@router.put("/{day}", response_model=DayNoteOutput)
def upsert_day_note(day: date, data: DayNoteUpsert, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    note = db.scalar(select(DayNote).where(DayNote.user_id == user.id, DayNote.day == day))
    if note is None:
        note = DayNote(user_id=user.id, day=day, note=data.note.strip())
        db.add(note)
    else:
        note.note = data.note.strip()
    db.commit()
    db.refresh(note)
    return note


@router.delete("/{day}", status_code=status.HTTP_204_NO_CONTENT)
def delete_day_note(day: date, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    note = db.scalar(select(DayNote).where(DayNote.user_id == user.id, DayNote.day == day))
    if note is not None:
        db.delete(note)
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
