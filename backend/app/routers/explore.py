import ipaddress
import os
import re
import socket
import uuid
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import urlparse
import httpx
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from pypdf import PdfReader, PdfWriter
from pypdf.generic import ArrayObject, DictionaryObject, FloatObject, NameObject, NumberObject, TextStringObject
from sqlalchemy import select
from sqlalchemy.orm import Session
from io import BytesIO

from app.db import get_db
from app.models import User
from app.security import get_current_user
from app.explore_models import ExploreDocument, ExploreBookmark, ExploreAnnotation
from app.explore_schemas import (
    DocumentOut, DocumentProgressUpdate, UrlImport, BookmarkCreate, BookmarkOut,
    AnnotationCreate, AnnotationUpdate, AnnotationOut,
)

router = APIRouter(prefix="/explore", tags=["explore"])
MAX_PDF_BYTES = 50 * 1024 * 1024
PDF_STORAGE_DIR = Path(os.getenv("ATLAS_PDF_STORAGE_DIR", "data/pdfs"))


def inspect_pdf(content: bytes) -> tuple[int, str | None]:
    if not content.startswith(b"%PDF-"):
        raise HTTPException(422, "This file does not appear to be a valid PDF.")
    try:
        reader = PdfReader(BytesIO(content), strict=False)
        if reader.is_encrypted:
            raise HTTPException(422, "Password-protected PDFs are not supported yet.")
        pages = len(reader.pages)
        if pages < 1:
            raise HTTPException(422, "The PDF does not contain any pages.")
        metadata_title = (reader.metadata.title or "").strip() if reader.metadata else ""
        return pages, metadata_title or None
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(422, "Atlas could not read this PDF. Try exporting it again.") from exc


def owned_document(db: Session, document_id: int, user_id: int) -> ExploreDocument:
    document = db.scalar(select(ExploreDocument).where(
        ExploreDocument.id == document_id, ExploreDocument.user_id == user_id
    ))
    if document is None:
        raise HTTPException(404, "Document not found")
    return document


def safe_public_url(value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
        raise HTTPException(400, "Use a public HTTP or HTTPS PDF link.")
    try:
        addresses = {item[4][0] for item in socket.getaddrinfo(parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80), type=socket.SOCK_STREAM)}
        if not addresses or any(not ipaddress.ip_address(address).is_global for address in addresses):
            raise HTTPException(400, "This URL does not point to a publicly accessible host.")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(400, "Atlas could not resolve that PDF link.") from exc
    return value


def create_document(db: Session, user: User, content: bytes, filename: str, title: str | None, source_url: str | None = None):
    if len(content) > MAX_PDF_BYTES:
        raise HTTPException(413, "PDFs are limited to 50 MB.")
    page_count, metadata_title = inspect_pdf(content)
    safe_name = filename.replace(chr(92), "/").split("/")[-1][:255] or "document.pdf"
    clean_title = (title or metadata_title or safe_name.rsplit(".", 1)[0]).strip()[:240]
    if not clean_title:
        clean_title = "Untitled document"
    stored_name = f"{uuid.uuid4().hex}.pdf"
    PDF_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    stored_file = PDF_STORAGE_DIR / stored_name
    document = ExploreDocument(
        user_id=user.id, title=clean_title, filename=safe_name, source_url=source_url,
        pdf_data=None, storage_path=stored_name, page_count=page_count,
        size_bytes=len(content), last_page=1,
    )
    try:
        db.add(document)
        db.flush()
        stored_file.write_bytes(content)
        db.commit()
        db.refresh(document)
        return document
    except Exception:
        db.rollback()
        stored_file.unlink(missing_ok=True)
        raise


def read_document_bytes(document: ExploreDocument) -> bytes:
    if document.storage_path:
        try:
            return (PDF_STORAGE_DIR / document.storage_path).read_bytes()
        except OSError as exc:
            raise HTTPException(503, "This PDF is unavailable on the Atlas storage volume.") from exc
    if document.pdf_data:
        return document.pdf_data
    raise HTTPException(503, "This PDF is unavailable on the Atlas storage volume.")


@router.get("/documents", response_model=list[DocumentOut])
def list_documents(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return list(db.scalars(
        select(ExploreDocument).where(ExploreDocument.user_id == user.id)
        .order_by(ExploreDocument.last_opened_at.desc().nullslast(), ExploreDocument.created_at.desc())
    ))


@router.post("/documents", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(file: UploadFile = File(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    filename = (file.filename or "document.pdf").replace(chr(92), "/").split("/")[-1]
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Please choose a PDF file.")
    content = await file.read(MAX_PDF_BYTES + 1)
    await file.close()
    return create_document(db, user, content, filename, None)


@router.post("/documents/import-url", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def import_document_url(data: UrlImport, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    url = safe_public_url(data.url)
    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=False, trust_env=False) as client:
            async with client.stream("GET", url, headers={"Accept": "application/pdf,application/octet-stream"}) as response:
                if response.status_code != 200:
                    raise HTTPException(422, f"The PDF link returned HTTP {response.status_code}.")
                content_type = response.headers.get("content-type", "").split(";")[0].lower()
                if content_type not in {"application/pdf", "application/octet-stream", "binary/octet-stream"}:
                    raise HTTPException(422, "That link did not return a PDF document.")
                length = response.headers.get("content-length")
                if length and int(length) > MAX_PDF_BYTES:
                    raise HTTPException(413, "PDFs are limited to 50 MB.")
                chunks = []
                size = 0
                async for chunk in response.aiter_bytes():
                    size += len(chunk)
                    if size > MAX_PDF_BYTES:
                        raise HTTPException(413, "PDFs are limited to 50 MB.")
                    chunks.append(chunk)
                content = b"".join(chunks)
    except HTTPException:
        raise
    except httpx.HTTPError as exc:
        raise HTTPException(422, "Atlas could not download that PDF. Check the link and try again.") from exc
    parsed = urlparse(url)
    filename = (parsed.path.rsplit("/", 1)[-1] or "imported-document.pdf")
    if not filename.lower().endswith(".pdf"):
        filename += ".pdf"
    return create_document(db, user, content, filename, data.title, url)


@router.get("/documents/{document_id}", response_model=DocumentOut)
def get_document(document_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    document = owned_document(db, document_id, user.id)
    document.last_opened_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(document)
    return document


@router.get("/documents/{document_id}/file")
def get_document_file(document_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    document = owned_document(db, document_id, user.id)
    return Response(
        content=read_document_bytes(document), media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{re.sub(r"[^A-Za-z0-9._-]", "_", document.filename) or "document.pdf"}"', "Cache-Control": "private, no-store"},
    )


@router.patch("/documents/{document_id}", response_model=DocumentOut)
def update_document_progress(document_id: int, data: DocumentProgressUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    document = owned_document(db, document_id, user.id)
    if data.last_page > document.page_count:
        raise HTTPException(422, "Page number is outside this document.")
    document.last_page = data.last_page
    document.last_opened_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(document)
    return document


@router.delete("/documents/{document_id}", status_code=204)
def delete_document(document_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    document = owned_document(db, document_id, user.id)
    stored_file = PDF_STORAGE_DIR / document.storage_path if document.storage_path else None
    db.delete(document)
    db.commit()
    if stored_file:
        stored_file.unlink(missing_ok=True)


@router.get("/documents/{document_id}/bookmarks", response_model=list[BookmarkOut])
def list_bookmarks(document_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    owned_document(db, document_id, user.id)
    return list(db.scalars(select(ExploreBookmark).where(ExploreBookmark.document_id == document_id).order_by(ExploreBookmark.page_number)))


@router.post("/documents/{document_id}/bookmarks", response_model=BookmarkOut, status_code=201)
def add_bookmark(document_id: int, data: BookmarkCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    document = owned_document(db, document_id, user.id)
    if data.page_number > document.page_count:
        raise HTTPException(422, "Page number is outside this document.")
    existing = db.scalar(select(ExploreBookmark).where(ExploreBookmark.document_id == document_id, ExploreBookmark.page_number == data.page_number))
    if existing:
        existing.label = data.label.strip()
        db.commit()
        db.refresh(existing)
        return existing
    bookmark = ExploreBookmark(document_id=document_id, page_number=data.page_number, label=data.label.strip())
    db.add(bookmark)
    db.commit()
    db.refresh(bookmark)
    return bookmark


@router.delete("/documents/{document_id}/bookmarks/{bookmark_id}", status_code=204)
def delete_bookmark(document_id: int, bookmark_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    owned_document(db, document_id, user.id)
    bookmark = db.scalar(select(ExploreBookmark).where(ExploreBookmark.id == bookmark_id, ExploreBookmark.document_id == document_id))
    if bookmark is None:
        raise HTTPException(404, "Bookmark not found")
    db.delete(bookmark)
    db.commit()


@router.get("/documents/{document_id}/annotations", response_model=list[AnnotationOut])
def list_annotations(document_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    owned_document(db, document_id, user.id)
    return list(db.scalars(select(ExploreAnnotation).where(ExploreAnnotation.document_id == document_id).order_by(ExploreAnnotation.page_number, ExploreAnnotation.created_at.desc())))


@router.post("/documents/{document_id}/annotations", response_model=AnnotationOut, status_code=201)
def add_annotation(document_id: int, data: AnnotationCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    document = owned_document(db, document_id, user.id)
    if data.page_number > document.page_count:
        raise HTTPException(422, "Page number is outside this document.")
    annotation = ExploreAnnotation(document_id=document_id, page_number=data.page_number, selected_text=data.selected_text, highlight_rects=[rect.model_dump() for rect in data.highlight_rects], note=data.note.strip(), annotation_type=data.annotation_type, color=data.color)
    db.add(annotation)
    db.commit()
    db.refresh(annotation)
    return annotation


@router.patch("/documents/{document_id}/annotations/{annotation_id}", response_model=AnnotationOut)
def update_annotation(document_id: int, annotation_id: int, data: AnnotationUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    owned_document(db, document_id, user.id)
    annotation = db.scalar(select(ExploreAnnotation).where(ExploreAnnotation.id == annotation_id, ExploreAnnotation.document_id == document_id))
    if annotation is None:
        raise HTTPException(404, "Annotation not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        if key in {"annotation_type", "color"} and value is None:
            continue
        if key == "highlight_rects" and value is not None:
            value = [rect.model_dump() if hasattr(rect, "model_dump") else rect for rect in value]
        setattr(annotation, key, value.strip() if isinstance(value, str) else value)
    db.commit()
    db.refresh(annotation)
    return annotation



@router.get("/documents/{document_id}/export")
def export_annotated_document(document_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Return a separate PDF copy with Atlas marks embedded as standard PDF annotations."""
    document = owned_document(db, document_id, user.id)
    try:
        reader = PdfReader(BytesIO(read_document_bytes(document)), strict=False)
        writer = PdfWriter()
        writer.clone_document_from_reader(reader)
        palette = {
            "yellow": (0.96, 0.78, 0.24),
            "green": (0.34, 0.68, 0.42),
            "blue": (0.32, 0.58, 0.82),
            "pink": (0.82, 0.40, 0.60),
        }
        subtype = {"highlight": "/Highlight", "underline": "/Underline", "strikeout": "/StrikeOut"}
        marks = db.scalars(select(ExploreAnnotation).where(ExploreAnnotation.document_id == document_id))
        for mark in marks:
            if not mark.highlight_rects or mark.annotation_type not in subtype:
                continue
            page_index = mark.page_number - 1
            if page_index < 0 or page_index >= len(writer.pages):
                continue
            page = writer.pages[page_index]
            box = page.mediabox
            page_width = float(box.width)
            page_height = float(box.height)
            page_left = float(box.left)
            page_bottom = float(box.bottom)
            for rect in mark.highlight_rects:
                x1 = float(rect["x"]) * page_width + page_left
                y2 = page_height - float(rect["y"]) * page_height + page_bottom
                x2 = x1 + float(rect["width"]) * page_width
                y1 = y2 - float(rect["height"]) * page_height
                color = palette.get(mark.color, palette["yellow"])
                annotation = DictionaryObject({
                    NameObject("/Type"): NameObject("/Annot"),
                    NameObject("/Subtype"): NameObject(subtype[mark.annotation_type]),
                    NameObject("/Rect"): ArrayObject([FloatObject(x1), FloatObject(y1), FloatObject(x2), FloatObject(y2)]),
                    NameObject("/QuadPoints"): ArrayObject([
                        FloatObject(x1), FloatObject(y1), FloatObject(x2), FloatObject(y1),
                        FloatObject(x1), FloatObject(y2), FloatObject(x2), FloatObject(y2),
                    ]),
                    NameObject("/C"): ArrayObject([FloatObject(channel) for channel in color]),
                    NameObject("/CA"): FloatObject(0.38),
                    NameObject("/F"): NumberObject(4),
                    NameObject("/Contents"): TextStringObject(mark.note or mark.selected_text or ""),
                    NameObject("/T"): TextStringObject("Atlas"),
                    NameObject("/Subj"): TextStringObject("Atlas " + mark.annotation_type),
                })
                writer.add_annotation(page_index, annotation)
        output = BytesIO()
        writer.write(output)
        filename = (document.filename.rsplit(".", 1)[0] or "document") + "-annotated.pdf"
        safe_filename = re.sub(r"[^A-Za-z0-9._-]", "-", filename)
        return Response(
            content=output.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="' + safe_filename + '"'},
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, "Atlas could not export this annotated PDF.") from exc

@router.delete("/documents/{document_id}/annotations/{annotation_id}", status_code=204)
def delete_annotation(document_id: int, annotation_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    owned_document(db, document_id, user.id)
    annotation = db.scalar(select(ExploreAnnotation).where(ExploreAnnotation.id == annotation_id, ExploreAnnotation.document_id == document_id))
    if annotation is None:
        raise HTTPException(404, "Annotation not found")
    db.delete(annotation)
    db.commit()
