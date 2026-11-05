# Module A — Academics (first backend slice)

## Included in this slice
- Relational syllabus hierarchy: subjects -> topics -> concepts.
- Nested topics via `parent_topic_id`.
- Per-user concept progress with separate exposure, understanding, recall, confidence and notes.
- Subject readiness distribution without a fabricated percentage.
- Exam CRUD with ownership checks.
- All endpoints require the existing bearer-token authentication.

## Important compatibility decision
This extends the existing integer-key schema. It does not convert existing users or subjects to UUIDs. UUID migration should be a separate Alembic migration after the MVP data model stabilizes.

## Endpoints
- `GET/POST /api/v1/subjects/{id}/topics`
- `PATCH/DELETE /api/v1/topics/{id}`
- `GET /api/v1/subjects/{id}/concepts`
- `POST /api/v1/topics/{id}/concepts`
- `DELETE /api/v1/concepts/{id}`
- `GET/PATCH /api/v1/concepts/{id}/progress`
- `GET /api/v1/subjects/{id}/readiness`
- `GET/POST /api/v1/exams`
- `PATCH/DELETE /api/v1/exams/{id}`

## First-run database note
The current application uses `Base.metadata.create_all()` at startup. Import `academics_models` before that call so SQLAlchemy registers the new tables. This is acceptable for the current local prototype, but it is not a migration strategy. Before adding syllabus versions or changing existing columns, introduce Alembic and generate a migration.

## Next slice
1. Build the subject detail UI for manual chapter/topic/concept editing.
2. Add PDF upload + PyMuPDF extraction into a draft structure.
3. Add a review/confirm screen before persisting extracted content.
4. Add progress controls to each concept row.
5. Add tests for cross-user access, parent-topic validation, and readiness counts.
