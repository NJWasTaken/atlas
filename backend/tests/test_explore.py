from io import BytesIO
from pypdf import PdfWriter

from tests.conftest import register, auth_headers


def sample_pdf():
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    output = BytesIO()
    writer.write(output)
    return output.getvalue()


def test_upload_list_progress_and_delete_document(client):
    token = register(client, "reader@example.com")
    headers = auth_headers(token)
    response = client.post("/api/v1/explore/documents", headers=headers, files={"file": ("notes.pdf", sample_pdf(), "application/pdf")})
    assert response.status_code == 201
    document = response.json()
    assert document["page_count"] == 1
    assert document["title"] == "notes"
    assert client.get(f"/api/v1/explore/documents/{document['id']}/file", headers=headers).content.startswith(b"%PDF-")
    assert client.patch(f"/api/v1/explore/documents/{document['id']}", headers=headers, json={"last_page": 2}).status_code == 422
    updated = client.patch(f"/api/v1/explore/documents/{document['id']}", headers=headers, json={"last_page": 1})
    assert updated.status_code == 200
    assert updated.json()["last_page"] == 1
    assert len(client.get("/api/v1/explore/documents", headers=headers).json()) == 1
    assert client.delete(f"/api/v1/explore/documents/{document['id']}", headers=headers).status_code == 204
    assert client.get("/api/v1/explore/documents", headers=headers).json() == []


def test_bookmarks_and_annotations_are_document_scoped(client):
    token = register(client, "reader-notes@example.com")
    headers = auth_headers(token)
    created = client.post("/api/v1/explore/documents", headers=headers, files={"file": ("paper.pdf", sample_pdf(), "application/pdf")}).json()
    document_id = created["id"]
    bookmark = client.post(f"/api/v1/explore/documents/{document_id}/bookmarks", headers=headers, json={"page_number": 1, "label": "Important"})
    assert bookmark.status_code == 201
    assert client.post(f"/api/v1/explore/documents/{document_id}/bookmarks", headers=headers, json={"page_number": 1, "label": "Updated"}).json()["label"] == "Updated"
    annotation = client.post(f"/api/v1/explore/documents/{document_id}/annotations", headers=headers, json={"page_number": 1, "selected_text": "A useful passage", "note": "Revisit this", "highlight_rects": [{"x": 0.1, "y": 0.2, "width": 0.4, "height": 0.03}]})
    assert annotation.status_code == 201
    saved = client.get(f"/api/v1/explore/documents/{document_id}/annotations", headers=headers).json()[0]
    assert saved["selected_text"] == "A useful passage"
    assert saved["highlight_rects"] == [{"x": 0.1, "y": 0.2, "width": 0.4, "height": 0.03}]
    invalid_rect = client.post(f"/api/v1/explore/documents/{document_id}/annotations", headers=headers, json={"page_number": 1, "note": "Invalid", "highlight_rects": [{"x": 1.2, "y": 0.2, "width": 0.4, "height": 0.03}]})
    assert invalid_rect.status_code == 422
    other = register(client, "other-reader@example.com")
    assert client.get(f"/api/v1/explore/documents/{document_id}/file", headers=auth_headers(other)).status_code == 404
    assert client.delete(f"/api/v1/explore/documents/{document_id}/bookmarks/{bookmark.json()['id']}", headers=auth_headers(other)).status_code == 404


def test_reject_invalid_pdf_and_non_pdf_upload(client):
    token = register(client, "invalid-reader@example.com")
    headers = auth_headers(token)
    invalid = client.post("/api/v1/explore/documents", headers=headers, files={"file": ("fake.pdf", b"not a pdf", "application/pdf")})
    assert invalid.status_code == 422
    wrong_extension = client.post("/api/v1/explore/documents", headers=headers, files={"file": ("notes.txt", b"hello", "text/plain")})
    assert wrong_extension.status_code == 400


def test_url_import_rejects_non_http_and_private_targets(client):
    token = register(client, "url-reader@example.com")
    headers = auth_headers(token)
    unsupported = client.post("/api/v1/explore/documents/import-url", headers=headers, json={"url": "file:///etc/passwd"})
    assert unsupported.status_code == 400
    assert "public HTTP or HTTPS" in unsupported.json()["detail"]


def test_exploration_sessions_save_questions_and_discoveries_with_ownership(client):
    token = register(client, "explorer@example.com")
    headers = auth_headers(token)
    created = client.post("/api/v1/explore/sessions", headers=headers, json={
        "title": "How do brains learn?",
        "central_question": "What connects memory and neural networks?",
        "notes": "Start with the biological analogy.",
    })
    assert created.status_code == 201
    session = created.json()
    assert session["item_count"] == 0

    discovery = client.post(f"/api/v1/explore/sessions/{session['id']}/items", headers=headers, json={
        "kind": "discovery", "title": "Hebbian learning", "body": "Neurons that fire together strengthen their connection."
    })
    assert discovery.status_code == 201
    question = client.post(f"/api/v1/explore/sessions/{session['id']}/items", headers=headers, json={
        "kind": "question", "title": "Where does forgetting fit?", "body": "Look into synaptic pruning."
    })
    assert question.status_code == 201
    resource = client.post(f"/api/v1/explore/sessions/{session['id']}/items", headers=headers, json={
        "kind": "resource", "title": "A useful article", "url": "https://example.com/article"
    })
    assert resource.status_code == 201

    detail = client.get(f"/api/v1/explore/sessions/{session['id']}", headers=headers)
    assert detail.status_code == 200
    assert {item["kind"] for item in detail.json()["items"]} == {"discovery", "question", "resource"}
    assert detail.json()["item_count"] == 3

    updated = client.patch(f"/api/v1/explore/sessions/{session['id']}", headers=headers, json={"status": "completed"})
    assert updated.status_code == 200
    assert updated.json()["status"] == "completed"

    other = auth_headers(register(client, "another-explorer@example.com"))
    assert client.get(f"/api/v1/explore/sessions/{session['id']}", headers=other).status_code == 404
    assert client.delete(f"/api/v1/explore/sessions/{session['id']}/items/{discovery.json()['id']}", headers=other).status_code == 404
    assert client.delete(f"/api/v1/explore/sessions/{session['id']}", headers=other).status_code == 404


def test_exploration_session_validation_and_cascade_delete(client):
    headers = auth_headers(register(client, "explore-validation@example.com"))
    blank = client.post("/api/v1/explore/sessions", headers=headers, json={"title": " ", "central_question": " "})
    assert blank.status_code == 422
    created = client.post("/api/v1/explore/sessions", headers=headers, json={
        "title": "A small investigation", "central_question": "Why do leaves change colour?"
    }).json()
    invalid_url = client.post(f"/api/v1/explore/sessions/{created['id']}/items", headers=headers, json={
        "kind": "resource", "title": "Not a safe URL", "url": "javascript:alert(1)"
    })
    assert invalid_url.status_code == 422
    item = client.post(f"/api/v1/explore/sessions/{created['id']}/items", headers=headers, json={
        "kind": "question", "title": "What triggers the change?"
    })
    assert item.status_code == 201
    assert client.delete(f"/api/v1/explore/sessions/{created['id']}", headers=headers).status_code == 204
    assert client.get(f"/api/v1/explore/sessions/{created['id']}", headers=headers).status_code == 404
