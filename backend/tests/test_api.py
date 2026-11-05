from datetime import date, timedelta

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

