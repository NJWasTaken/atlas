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
    annotation = client.post(f"/api/v1/explore/documents/{document_id}/annotations", headers=headers, json={"page_number": 1, "selected_text": "A useful passage", "note": "Revisit this", "annotation_type": "underline", "color": "blue", "highlight_rects": [{"x": 0.1, "y": 0.2, "width": 0.4, "height": 0.03}]})
    assert annotation.status_code == 201
    saved = client.get(f"/api/v1/explore/documents/{document_id}/annotations", headers=headers).json()[0]
    assert saved["selected_text"] == "A useful passage"
    assert saved["annotation_type"] == "underline"
    assert saved["color"] == "blue"
    assert saved["highlight_rects"] == [{"x": 0.1, "y": 0.2, "width": 0.4, "height": 0.03}]
    mark_only = client.post(f"/api/v1/explore/documents/{document_id}/annotations", headers=headers, json={"page_number": 1, "selected_text": "A second passage", "highlight_rects": [{"x": 0.2, "y": 0.4, "width": 0.3, "height": 0.02}]})
    assert mark_only.status_code == 201
    assert mark_only.json()["note"] == ""
    assert mark_only.json()["annotation_type"] == "highlight"
    assert mark_only.json()["color"] == "yellow"
    page_only_note = client.post(f"/api/v1/explore/documents/{document_id}/annotations", headers=headers, json={"page_number": 1, "note": "Standalone page note"})
    assert page_only_note.status_code == 422
    invalid_style = client.post(f"/api/v1/explore/documents/{document_id}/annotations", headers=headers, json={"page_number": 1, "selected_text": "Invalid style", "annotation_type": "circle", "color": "orange", "highlight_rects": [{"x": 0.2, "y": 0.4, "width": 0.3, "height": 0.02}]})
    assert invalid_style.status_code == 422
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
