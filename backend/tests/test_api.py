from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from .conftest import auth_headers, register


def test_health_and_authentication_required(client: TestClient):
    assert client.get("/health").json()["status"] == "ok"
    response = client.get("/api/v1/subjects")
    assert response.status_code == 401


def test_register_login_and_current_user(client: TestClient):
    token = register(client, "Noel@example.com")
    me = client.get("/api/v1/auth/me", headers=auth_headers(token))
    assert me.status_code == 200
    assert me.json()["email"] == "noel@example.com"

    login = client.post(
        "/api/v1/auth/login",
        json={"email": "NOEL@example.com", "password": "test-password"},
    )
    assert login.status_code == 200
    assert login.json()["access_token"]


def test_duplicate_registration_is_rejected(client: TestClient):
    register(client, "duplicate@example.com")
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "DUPLICATE@example.com", "password": "test-password"},
    )
    assert response.status_code == 409


def test_subjects_are_isolated_between_users(client: TestClient):
    owner = auth_headers(register(client, "owner@example.com"))
    other = auth_headers(register(client, "other@example.com"))

    created = client.post(
        "/api/v1/subjects",
        headers=owner,
        json={"name": "Machine Learning"},
    )
    assert created.status_code == 201
    subject_id = created.json()["id"]

    assert len(client.get("/api/v1/subjects", headers=owner).json()) == 1
    assert client.get("/api/v1/subjects", headers=other).json() == []
    hidden_delete = client.delete(f"/api/v1/subjects/{subject_id}", headers=other)
    assert hidden_delete.status_code == 404


def test_topic_hierarchy_rejects_cross_subject_parent_and_cycles(client: TestClient):
    headers = auth_headers(register(client, "hierarchy@example.com"))
    first = client.post("/api/v1/subjects", headers=headers, json={"name": "Math"}).json()
    second = client.post("/api/v1/subjects", headers=headers, json={"name": "Physics"}).json()

    root = client.post(
        f"/api/v1/subjects/{first['id']}/topics",
        headers=headers,
        json={"title": "Linear Algebra"},
    ).json()
    child = client.post(
        f"/api/v1/subjects/{first['id']}/topics",
        headers=headers,
        json={"title": "Eigenvectors", "parent_topic_id": root["id"]},
    ).json()

    cross_subject = client.post(
        f"/api/v1/subjects/{second['id']}/topics",
        headers=headers,
        json={"title": "Invalid child", "parent_topic_id": root["id"]},
    )
    assert cross_subject.status_code == 400

    cycle = client.patch(
        f"/api/v1/topics/{root['id']}",
        headers=headers,
        json={"parent_topic_id": child["id"]},
    )
    assert cycle.status_code == 400


def test_concept_progress_patch_preserves_omitted_fields(client: TestClient):
    headers = auth_headers(register(client, "progress@example.com"))
    subject = client.post(
        "/api/v1/subjects", headers=headers, json={"name": "AI"}
    ).json()
    topic = client.post(
        f"/api/v1/subjects/{subject['id']}/topics",
        headers=headers,
        json={"title": "Search"},
    ).json()
    concept = client.post(
        f"/api/v1/topics/{topic['id']}/concepts",
        headers=headers,
        json={"title": "A* search"},
    ).json()

    initial = client.patch(
        f"/api/v1/concepts/{concept['id']}/progress",
        headers=headers,
        json={
            "exposure": "studied",
            "understanding": "developing",
            "recall": "needs_practice",
            "confidence": 3,
            "notes": "Review admissibility",
        },
    )
    assert initial.status_code == 200

    partial = client.patch(
        f"/api/v1/concepts/{concept['id']}/progress",
        headers=headers,
        json={"understanding": "strong"},
    )
    assert partial.status_code == 200
    assert partial.json()["exposure"] == "studied"
    assert partial.json()["understanding"] == "strong"
    assert partial.json()["recall"] == "needs_practice"
    assert partial.json()["confidence"] == 3
    assert partial.json()["notes"] == "Review admissibility"


def test_progress_validation_and_readiness_counts(client: TestClient):
    headers = auth_headers(register(client, "readiness@example.com"))
    subject = client.post(
        "/api/v1/subjects", headers=headers, json={"name": "Statistics"}
    ).json()
    topic = client.post(
        f"/api/v1/subjects/{subject['id']}/topics",
        headers=headers,
        json={"title": "Distributions"},
    ).json()
    concept = client.post(
        f"/api/v1/topics/{topic['id']}/concepts",
        headers=headers,
        json={"title": "Normal distribution"},
    ).json()

    invalid = client.patch(
        f"/api/v1/concepts/{concept['id']}/progress",
        headers=headers,
        json={"confidence": 6},
    )
    assert invalid.status_code == 422

    readiness = client.get(
        f"/api/v1/subjects/{subject['id']}/readiness", headers=headers
    )
    assert readiness.status_code == 200
    assert readiness.json()["total_concepts"] == 1
    assert readiness.json()["not_assessed"] == 1

    exam = client.post(
        "/api/v1/exams",
        headers=headers,
        json={
            "subject_id": subject["id"],
            "title": "Statistics final",
            "exam_date": (datetime.now(timezone.utc) + timedelta(days=5)).isoformat(),
        },
    )
    assert exam.status_code == 201
    readiness_with_exam = client.get(
        f"/api/v1/subjects/{subject['id']}/readiness", headers=headers
    ).json()
    assert readiness_with_exam["next_exam"]["title"] == "Statistics final"
    assert readiness_with_exam["next_exam"]["days_until"] == 5
    assert any(item["reason"] == "upcoming_exam" for item in readiness_with_exam["recommendations"])


def test_calendar_notes_are_user_scoped_and_validate_ranges(client: TestClient):
    owner = auth_headers(register(client, "calendar-owner@example.com"))
    other = auth_headers(register(client, "calendar-other@example.com"))
    day = date.today().isoformat()

    saved = client.put(
        f"/api/v1/calendar/{day}",
        headers=owner,
        json={"note": "Revise probability"},
    )
    assert saved.status_code == 200
    assert len(client.get(
        f"/api/v1/calendar?start={day}&end={day}", headers=owner
    ).json()) == 1
    assert client.get(
        f"/api/v1/calendar?start={day}&end={day}", headers=other
    ).json() == []

    invalid_range = client.get(
        f"/api/v1/calendar?start={day}&end={(date.today() + timedelta(days=63)).isoformat()}",
        headers=owner,
    )
    assert invalid_range.status_code == 400


def test_exam_crud_is_scoped_to_owner(client: TestClient):
    owner = auth_headers(register(client, "exam-owner@example.com"))
    other = auth_headers(register(client, "exam-other@example.com"))
    subject = client.post(
        "/api/v1/subjects", headers=owner, json={"name": "Deep Learning"}
    ).json()

    created = client.post(
        "/api/v1/exams",
        headers=owner,
        json={
            "subject_id": subject["id"],
            "title": "Mid-semester",
            "exam_date": "2026-12-01T09:00:00",
        },
    )
    assert created.status_code == 201
    exam_id = created.json()["id"]

    assert len(client.get("/api/v1/exams", headers=owner).json()) == 1
    assert client.get("/api/v1/exams", headers=other).json() == []
    assert client.patch(
        f"/api/v1/exams/{exam_id}", headers=other, json={"title": "Hijack"}
    ).status_code == 404

    updated = client.patch(
        f"/api/v1/exams/{exam_id}",
        headers=owner,
        json={"title": "Final exam"},
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "Final exam"

    deleted = client.delete(f"/api/v1/exams/{exam_id}", headers=owner)
    assert deleted.status_code == 204
    assert client.get("/api/v1/exams", headers=owner).json() == []

def test_academic_resources_are_hidden_from_other_users(client: TestClient):
    owner = auth_headers(register(client, "academic-owner@example.com"))
    other = auth_headers(register(client, "academic-other@example.com"))
    subject = client.post(
        "/api/v1/subjects", headers=owner, json={"name": "Algorithms"}
    ).json()
    topic = client.post(
        f"/api/v1/subjects/{subject['id']}/topics",
        headers=owner,
        json={"title": "Graph algorithms"},
    ).json()
    concept = client.post(
        f"/api/v1/topics/{topic['id']}/concepts",
        headers=owner,
        json={"title": "Dijkstra's algorithm"},
    ).json()

    assert client.get(
        f"/api/v1/subjects/{subject['id']}/topics", headers=other
    ).status_code == 404
    assert client.get(
        f"/api/v1/subjects/{subject['id']}/concepts", headers=other
    ).status_code == 404
    assert client.get(
        f"/api/v1/concepts/{concept['id']}/progress", headers=other
    ).status_code == 404

def test_topic_patch_updates_fields_and_rejects_null_required_values(client: TestClient):
    headers = auth_headers(register(client, "topic-patch@example.com"))
    subject = client.post(
        "/api/v1/subjects", headers=headers, json={"name": "Mathematics"}
    ).json()
    root = client.post(
        f"/api/v1/subjects/{subject['id']}/topics",
        headers=headers,
        json={"title": "Algebra"},
    ).json()
    child = client.post(
        f"/api/v1/subjects/{subject['id']}/topics",
        headers=headers,
        json={"title": "Groups", "parent_topic_id": root["id"]},
    ).json()

    updated = client.patch(
        f"/api/v1/topics/{child['id']}",
        headers=headers,
        json={"title": "Group theory", "description": "Abstract structures", "position": 2},
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "Group theory"
    assert updated.json()["description"] == "Abstract structures"
    assert updated.json()["position"] == 2

    moved_to_root = client.patch(
        f"/api/v1/topics/{child['id']}",
        headers=headers,
        json={"parent_topic_id": None},
    )
    assert moved_to_root.status_code == 200
    assert moved_to_root.json()["parent_topic_id"] is None

    assert client.patch(
        f"/api/v1/topics/{child['id']}", headers=headers, json={"title": None}
    ).status_code == 422
    assert client.patch(
        f"/api/v1/topics/{child['id']}", headers=headers, json={"position": None}
    ).status_code == 422


def test_topic_and_concept_creation_validate_required_titles(client: TestClient):
    headers = auth_headers(register(client, "required-title@example.com"))
    subject = client.post(
        "/api/v1/subjects", headers=headers, json={"name": "Computer Science"}
    ).json()

    invalid_topic = client.post(
        f"/api/v1/subjects/{subject['id']}/topics",
        headers=headers,
        json={"title": ""},
    )
    assert invalid_topic.status_code == 422

    topic = client.post(
        f"/api/v1/subjects/{subject['id']}/topics",
        headers=headers,
        json={"title": "Data structures"},
    ).json()
    invalid_concept = client.post(
        f"/api/v1/topics/{topic['id']}/concepts",
        headers=headers,
        json={"title": ""},
    )
    assert invalid_concept.status_code == 422


def test_concept_delete_removes_its_progress(client: TestClient):
    headers = auth_headers(register(client, "concept-delete@example.com"))
    subject = client.post(
        "/api/v1/subjects", headers=headers, json={"name": "Algorithms"}
    ).json()
    topic = client.post(
        f"/api/v1/subjects/{subject['id']}/topics",
        headers=headers,
        json={"title": "Trees"},
    ).json()
    concept = client.post(
        f"/api/v1/topics/{topic['id']}/concepts",
        headers=headers,
        json={"title": "Binary search tree"},
    ).json()
    progress = client.patch(
        f"/api/v1/concepts/{concept['id']}/progress",
        headers=headers,
        json={"understanding": "strong"},
    )
    assert progress.status_code == 200

    deleted = client.delete(f"/api/v1/concepts/{concept['id']}", headers=headers)
    assert deleted.status_code == 204
    assert client.get(
        f"/api/v1/concepts/{concept['id']}/progress", headers=headers
    ).status_code == 404
    assert client.get(
        f"/api/v1/subjects/{subject['id']}/concepts", headers=headers
    ).json() == []


def test_exam_patch_rejects_null_required_fields_and_foreign_subject(client: TestClient):
    owner = auth_headers(register(client, "exam-validation-owner@example.com"))
    other = auth_headers(register(client, "exam-validation-other@example.com"))
    foreign_subject = client.post(
        "/api/v1/subjects", headers=other, json={"name": "Private subject"}
    ).json()

    rejected = client.post(
        "/api/v1/exams",
        headers=owner,
        json={
            "subject_id": foreign_subject["id"],
            "title": "Unauthorized exam",
            "exam_date": "2026-12-10T10:00:00",
        },
    )
    assert rejected.status_code == 404

    own_subject = client.post(
        "/api/v1/subjects", headers=owner, json={"name": "Databases"}
    ).json()
    exam = client.post(
        "/api/v1/exams",
        headers=owner,
        json={
            "subject_id": own_subject["id"],
            "title": "Final",
            "exam_date": "2026-12-15T10:00:00",
        },
    ).json()

    assert client.patch(
        f"/api/v1/exams/{exam['id']}", headers=owner, json={"title": None}
    ).status_code == 422
    assert client.patch(
        f"/api/v1/exams/{exam['id']}", headers=owner, json={"exam_date": None}
    ).status_code == 422


def test_calendar_note_can_be_updated_and_deleted(client: TestClient):
    headers = auth_headers(register(client, "calendar-crud@example.com"))
    day = date.today().isoformat()

    first = client.put(
        f"/api/v1/calendar/{day}", headers=headers, json={"note": "Read chapter 1"}
    )
    second = client.put(
        f"/api/v1/calendar/{day}", headers=headers, json={"note": "Solve exercises"}
    )
    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["note"] == "Solve exercises"

    deleted = client.delete(f"/api/v1/calendar/{day}", headers=headers)
    assert deleted.status_code == 204
    listed = client.get(
        f"/api/v1/calendar?start={day}&end={day}", headers=headers
    )
    assert listed.status_code == 200
    assert listed.json() == []



def test_concept_update_is_partial_validated_and_user_scoped(client: TestClient):
    owner = auth_headers(register(client, "concept-edit-owner@example.com"))
    other = auth_headers(register(client, "concept-edit-other@example.com"))
    subject = client.post(
        "/api/v1/subjects", headers=owner, json={"name": "Machine Learning"}
    ).json()
    topic = client.post(
        f"/api/v1/subjects/{subject['id']}/topics",
        headers=owner,
        json={"title": "Neural networks"},
    ).json()
    concept = client.post(
        f"/api/v1/topics/{topic['id']}/concepts",
        headers=owner,
        json={"title": "Backpropagation", "description": "Initial note", "position": 1},
    ).json()

    updated = client.patch(
        f"/api/v1/concepts/{concept['id']}",
        headers=owner,
        json={"title": "Backpropagation algorithm", "description": "Chain rule applied"},
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "Backpropagation algorithm"
    assert updated.json()["description"] == "Chain rule applied"
    assert updated.json()["position"] == 1

    assert client.patch(
        f"/api/v1/concepts/{concept['id']}", headers=owner, json={"title": None}
    ).status_code == 422
    assert client.patch(
        f"/api/v1/concepts/{concept['id']}", headers=owner, json={"position": None}
    ).status_code == 422
    assert client.patch(
        f"/api/v1/concepts/{concept['id']}", headers=other, json={"title": "Hijack"}
    ).status_code == 404


def test_subject_update_is_partial_validated_and_user_scoped(client: TestClient):
    owner = auth_headers(register(client, "subject-edit-owner@example.com"))
    other = auth_headers(register(client, "subject-edit-other@example.com"))
    subject = client.post("/api/v1/subjects", headers=owner, json={"name": "Artificial Intelligence", "code": "CS301", "description": "Old description"}).json()
    updated = client.patch(f"/api/v1/subjects/{subject['id']}", headers=owner, json={"name": "Applied AI", "description": "Updated description"})
    assert updated.status_code == 200
    assert updated.json()["name"] == "Applied AI"
    assert updated.json()["description"] == "Updated description"
    assert updated.json()["code"] == "CS301"
    assert client.patch(f"/api/v1/subjects/{subject['id']}", headers=owner, json={"name": None}).status_code == 422
    assert client.patch(f"/api/v1/subjects/{subject['id']}", headers=other, json={"name": "Hijack"}).status_code == 404


def test_syllabus_pdf_draft_is_review_only_and_user_scoped(client: TestClient, monkeypatch):
    owner = auth_headers(register(client, "syllabus-draft-owner@example.com"))
    other = auth_headers(register(client, "syllabus-draft-other@example.com"))
    subject = client.post("/api/v1/subjects", headers=owner, json={"name": "Data Structures"}).json()

    parsed = {
        "page_count": 4,
        "extracted_characters": 420,
        "topics": [{"title": "Trees", "source_pages": [2], "concepts": [{"title": "AVL trees", "source_pages": [3]}]}],
        "warnings": [],
    }
    monkeypatch.setattr("app.routers.academics.parse_syllabus_pdf", lambda _content: parsed)

    response = client.post(
        f"/api/v1/subjects/{subject['id']}/syllabus/draft",
        headers=owner,
        files={"file": ("ds-syllabus.pdf", b"%PDF-mock", "application/pdf")},
    )
    assert response.status_code == 200
    assert response.json()["topics"] == parsed["topics"]
    assert client.get(f"/api/v1/subjects/{subject['id']}/topics", headers=owner).json() == []

    hidden = client.post(
        f"/api/v1/subjects/{subject['id']}/syllabus/draft",
        headers=other,
        files={"file": ("ds-syllabus.pdf", b"%PDF-mock", "application/pdf")},
    )
    assert hidden.status_code == 404

    invalid_extension = client.post(
        f"/api/v1/subjects/{subject['id']}/syllabus/draft",
        headers=owner,
        files={"file": ("notes.txt", b"%PDF-mock", "application/pdf")},
    )
    assert invalid_extension.status_code == 400


def test_syllabus_confirm_persists_reviewed_items_and_page_references(client: TestClient):
    headers = auth_headers(register(client, "syllabus-confirm@example.com"))
    subject = client.post("/api/v1/subjects", headers=headers, json={"name": "Operating Systems"}).json()
    existing = client.post(f"/api/v1/subjects/{subject['id']}/topics", headers=headers, json={"title": "Existing manual chapter"}).json()
    response = client.post(
        f"/api/v1/subjects/{subject['id']}/syllabus/confirm",
        headers=headers,
        json={"topics": [
            {"title": "Processes", "source_pages": [1, 2], "concepts": [
                {"title": "Process states", "source_pages": [2]},
                {"title": "Context switching", "source_pages": [3]},
            ]},
            {"title": "Memory management", "source_pages": [8], "concepts": []},
        ]},
    )
    assert response.status_code == 201
    assert response.json()["topics_created"] == 2
    assert response.json()["concepts_created"] == 2

    topics = client.get(f"/api/v1/subjects/{subject['id']}/topics", headers=headers).json()
    concepts = client.get(f"/api/v1/subjects/{subject['id']}/concepts", headers=headers).json()
    assert topics[1]["source_pages"] == [1, 2]
    assert concepts[0]["source_pages"] == [2]
    assert [topic["title"] for topic in topics] == ["Existing manual chapter", "Processes", "Memory management"]
    assert topics[1]["position"] > existing["position"]


def test_syllabus_confirm_rejects_empty_draft_and_other_users(client: TestClient):
    owner = auth_headers(register(client, "syllabus-confirm-owner@example.com"))
    other = auth_headers(register(client, "syllabus-confirm-other@example.com"))
    subject = client.post("/api/v1/subjects", headers=owner, json={"name": "Networks"}).json()
    url = f"/api/v1/subjects/{subject['id']}/syllabus/confirm"

    assert client.post(url, headers=owner, json={"topics": []}).status_code == 422
    assert client.post(url, headers=owner, json={"topics": [{"title": "   ", "concepts": []}]}).status_code == 422
    assert client.post(url, headers=owner, json={"topics": [{"title": "Valid", "source_pages": [0], "concepts": []}]}).status_code == 422
    assert client.post(url, headers=other, json={"topics": [{"title": "Hidden", "concepts": []}]}).status_code == 404


def test_syllabus_pdf_parser_rejects_non_pdf_and_detects_page_references(monkeypatch):
    from types import SimpleNamespace
    from app import syllabus_import

    with pytest.raises(ValueError, match="valid PDF"):
        syllabus_import.parse_syllabus_pdf(b"not a PDF")

    class FakePage:
        def __init__(self, text):
            self.text = text

        def extract_text(self):
            return self.text

    fake_reader = SimpleNamespace(
        is_encrypted=False,
        pages=[
            FakePage("UNIT I: INTRODUCTION\n1.1 Overview\n1.2 Data structures\n- Arrays and lists"),
            FakePage("Continuation of introduction notes\nUNIT II: TREES\n2.1 Binary trees\n- Traversals"),
        ],
    )
    monkeypatch.setattr(syllabus_import, "PdfReader", lambda *_args, **_kwargs: fake_reader)
    parsed = syllabus_import.parse_syllabus_pdf(b"%PDF-mocked-content")
    assert parsed["page_count"] == 2
    assert parsed["topics"][0]["title"] == "INTRODUCTION"
    assert parsed["topics"][0]["source_pages"] == [1, 2]
    assert parsed["topics"][0]["concepts"][0] == {"title": "Overview", "source_pages": [1]}
    assert parsed["topics"][1]["title"] == "TREES"

    monkeypatch.setattr(syllabus_import, "PdfReader", lambda *_args, **_kwargs: SimpleNamespace(is_encrypted=False, pages=[FakePage("")]))
    with pytest.raises(ValueError, match="selectable text"):
        syllabus_import.parse_syllabus_pdf(b"%PDF-scanned-image-only")


def test_subject_term_metadata_can_be_created_updated_and_cleared(client: TestClient):
    headers = auth_headers(register(client, "subject-term@example.com"))
    created = client.post(
        "/api/v1/subjects",
        headers=headers,
        json={"name": "Machine Learning", "term": "Semester 5", "academic_year": "2026-27"},
    )
    assert created.status_code == 201
    subject = created.json()
    assert subject["term"] == "Semester 5"
    assert subject["academic_year"] == "2026-27"

    updated = client.patch(
        f"/api/v1/subjects/{subject['id']}",
        headers=headers,
        json={"term": "Semester 6"},
    )
    assert updated.status_code == 200
    assert updated.json()["term"] == "Semester 6"
    assert updated.json()["academic_year"] == "2026-27"

    cleared = client.patch(
        f"/api/v1/subjects/{subject['id']}",
        headers=headers,
        json={"term": None, "academic_year": None},
    )
    assert cleared.status_code == 200
    assert cleared.json()["term"] is None
    assert cleared.json()["academic_year"] is None


def test_quote_endpoints_fall_back_when_provider_is_not_configured(client: TestClient, monkeypatch):
    from app.routers import quotes

    monkeypatch.setattr(quotes.settings, "x_api_key", None)
    headers = auth_headers(register(client, "quote-fallback@example.com"))

    daily = client.get("/api/v1/quotes/daily", headers=headers)
    random = client.get("/api/v1/quotes/random", headers=headers)
    assert daily.status_code == 200
    assert daily.json()["quote"]
    assert daily.json()["author"]
    assert random.status_code == 200
    assert random.json()["quote"]


def test_overview_summary_is_user_scoped_and_prioritizes_revision(client: TestClient):
    owner = auth_headers(register(client, "overview-owner@example.com"))
    other = auth_headers(register(client, "overview-other@example.com"))
    subject = client.post(
        "/api/v1/subjects", headers=owner, json={"name": "Algorithms"}
    ).json()
    topic = client.post(
        f"/api/v1/subjects/{subject['id']}/topics",
        headers=owner,
        json={"title": "Graph theory"},
    ).json()
    weak = client.post(
        f"/api/v1/topics/{topic['id']}/concepts",
        headers=owner,
        json={"title": "Dijkstra"},
    ).json()
    untouched = client.post(
        f"/api/v1/topics/{topic['id']}/concepts",
        headers=owner,
        json={"title": "Bellman-Ford"},
    ).json()
    client.patch(
        f"/api/v1/concepts/{weak['id']}/progress",
        headers=owner,
        json={"understanding": "weak", "recall": "needs_practice"},
    )
    client.post(
        "/api/v1/exams",
        headers=owner,
        json={"subject_id": subject["id"], "title": "Final", "exam_date": "2026-12-01T09:00:00+00:00"},
    )

    summary = client.get("/api/v1/overview", headers=owner)
    assert summary.status_code == 200
    payload = summary.json()
    assert payload["recent_activity"][0]["concept_id"] == weak["id"]
    assert payload["revision_suggestions"][0]["concept_id"] == weak["id"]
    assert payload["revision_suggestions"][0]["reason"] == ["weak_understanding", "recall_practice"]
    assert any(item["concept_id"] == untouched["id"] for item in payload["revision_suggestions"])
    assert payload["upcoming_exams"][0]["subject_name"] == "Algorithms"

    hidden = client.get("/api/v1/overview", headers=other)
    assert hidden.status_code == 200
    assert hidden.json()["recent_activity"] == []
    assert hidden.json()["revision_suggestions"] == []
    assert hidden.json()["upcoming_exams"] == []


def test_concept_reviews_record_history_and_schedule_next_review(client: TestClient):
    owner = auth_headers(register(client, "review-history-owner@example.com"))
    other = auth_headers(register(client, "review-history-other@example.com"))
    subject = client.post("/api/v1/subjects", headers=owner, json={"name": "Databases"}).json()
    topic = client.post(f"/api/v1/subjects/{subject['id']}/topics", headers=owner, json={"title": "Indexing"}).json()
    concept = client.post(f"/api/v1/topics/{topic['id']}/concepts", headers=owner, json={"title": "B-trees"}).json()

    first = client.patch(
        f"/api/v1/concepts/{concept['id']}/progress",
        headers=owner,
        json={"understanding": "weak", "recall": "needs_practice", "confidence": 2},
    )
    assert first.status_code == 200
    assert first.json()["next_review_at"]
    first_due = datetime.fromisoformat(first.json()["next_review_at"].replace("Z", "+00:00"))
    assert timedelta(days=1) <= first_due - datetime.now(timezone.utc) <= timedelta(days=3)

    second = client.patch(
        f"/api/v1/concepts/{concept['id']}/progress",
        headers=owner,
        json={"understanding": "strong", "recall": "comfortable", "confidence": 5},
    )
    assert second.status_code == 200
    second_due = datetime.fromisoformat(second.json()["next_review_at"].replace("Z", "+00:00"))
    assert timedelta(days=13) <= second_due - datetime.now(timezone.utc) <= timedelta(days=15)

    history = client.get(f"/api/v1/concepts/{concept['id']}/reviews", headers=owner)
    assert history.status_code == 200
    assert len(history.json()) == 2
    assert history.json()[0]["understanding"] == "strong"
    assert history.json()[1]["understanding"] == "weak"
    assert client.get(f"/api/v1/concepts/{concept['id']}/reviews", headers=other).status_code == 404


def test_syllabus_versions_capture_changes_and_can_be_restored(client: TestClient):
    headers = auth_headers(register(client, "syllabus-versions@example.com"))
    subject = client.post("/api/v1/subjects", headers=headers, json={"name": "Operating Systems"}).json()
    topic = client.post(
        f"/api/v1/subjects/{subject['id']}/topics",
        headers=headers,
        json={"title": "Processes"},
    ).json()
    concept = client.post(
        f"/api/v1/topics/{topic['id']}/concepts",
        headers=headers,
        json={"title": "Process states"},
    ).json()

    versions = client.get(f"/api/v1/subjects/{subject['id']}/syllabus/versions", headers=headers)
    assert versions.status_code == 200
    assert [item["version_number"] for item in versions.json()] == [2, 1]
    baseline = versions.json()[-1]
    detail = client.get(
        f"/api/v1/subjects/{subject['id']}/syllabus/versions/{versions.json()[0]['id']}",
        headers=headers,
    )
    assert detail.status_code == 200
    assert detail.json()["snapshot"]["topics"][0]["concepts"][0]["title"] == "Process states"

    client.patch(
        f"/api/v1/concepts/{concept['id']}",
        headers=headers,
        json={"title": "Process lifecycle"},
    )
    restored = client.post(
        f"/api/v1/subjects/{subject['id']}/syllabus/versions/{versions.json()[0]['id']}/restore",
        headers=headers,
    )
    assert restored.status_code == 200
    current = client.get(f"/api/v1/subjects/{subject['id']}/concepts", headers=headers)
    assert current.json()[0]["title"] == "Process states"
    assert len(client.get(f"/api/v1/subjects/{subject['id']}/syllabus/versions", headers=headers).json()) == 4
