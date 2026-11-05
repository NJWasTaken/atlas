"""Conservative, review-first PDF syllabus extraction helpers."""
from __future__ import annotations

import io
import re

from pypdf import PdfReader

MAX_PDF_BYTES = 12 * 1024 * 1024
MAX_PDF_PAGES = 100
MAX_EXTRACTED_CHARS = 1_000_000

_UNIT_HEADING = re.compile(
    r"^(?:UNIT|MODULE|CHAPTER|PART|SECTION)\s+(?:[0-9IVX]+|[A-Z])(?:\s*[:.\-–—)]\s*|\s+).{2,150}$",
    re.IGNORECASE,
)
_NUMBERED_HEADING = re.compile(r"^\d+(?:\.\d+)*[.)]?\s+.{2,150}$")
_BULLET = re.compile(r"^(?:[-*•▪◦]|\(?\d+[.)])\s+(.{3,150})$")
_ROMAN_HEADING = re.compile(r"^[IVX]+[.)]\s+.{2,150}$")
_BULLET_PREFIX = re.compile(r"^(?:[-*•▪◦]|\(?\d+[.)])\s+")


def _clean_line(line: str) -> str:
    return re.sub(r"\s+", " ", line).strip(" \t•·")


def _is_heading(line: str) -> bool:
    if not 3 <= len(line) <= 150:
        return False
    if _UNIT_HEADING.match(line) or _ROMAN_HEADING.match(line) or _NUMBERED_HEADING.match(line):
        return True
    letters = [char for char in line if char.isalpha()]
    return len(letters) >= 5 and len(line) <= 90 and sum(char.isupper() for char in letters) / len(letters) >= 0.82


def parse_syllabus_pdf(pdf_bytes: bytes) -> dict:
    if not pdf_bytes.startswith(b"%PDF-"):
        raise ValueError("This file does not look like a valid PDF.")
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes), strict=False)
    except Exception as exc:
        raise ValueError("Atlas couldn't read this PDF. Try exporting it again as a standard PDF.") from exc

    if reader.is_encrypted:
        raise ValueError("This PDF is password-protected. Please upload an unlocked copy.")
    if len(reader.pages) > MAX_PDF_PAGES:
        raise ValueError(f"This PDF has {len(reader.pages)} pages. The current limit is {MAX_PDF_PAGES} pages.")

    pages: list[tuple[int, str]] = []
    total_chars = 0
    for page_number, page in enumerate(reader.pages, start=1):
        try:
            text = page.extract_text() or ""
        except Exception:
            text = ""
        total_chars += len(text)
        if total_chars > MAX_EXTRACTED_CHARS:
            raise ValueError("This PDF contains too much extractable text. Split it into smaller files and try again.")
        pages.append((page_number, text))

    if total_chars < 40:
        raise ValueError(
            "Atlas couldn't find selectable text in this PDF. It may be a scanned document; OCR isn't supported yet. "
            "You can still add the syllabus manually."
        )

    topics: list[dict] = []
    current_topic: dict | None = None
    warnings: list[str] = []
    seen: set[tuple[str, int]] = set()

    def add_topic(title: str, page: int) -> None:
        nonlocal current_topic
        normalized = re.sub(r"^(?:UNIT|MODULE|CHAPTER|PART|SECTION)\s+(?:[0-9IVX]+|[A-Z])\s*[:.\-–—)]?\s*", "", title, flags=re.IGNORECASE)
        normalized = re.sub(r"^\d+(?:\.\d+)*[.)]?\s+", "", normalized).strip(" .:-–—")
        key = (normalized.casefold(), page)
        if not normalized or key in seen:
            return
        seen.add(key)
        current_topic = {"title": normalized[:180], "source_pages": [page], "concepts": []}
        topics.append(current_topic)

    for page_number, page_text in pages:
        for raw_line in page_text.splitlines():
            line = _clean_line(raw_line)
            if not line or len(line) < 3:
                continue
            if _is_heading(line):
                # Deeply numbered headings are treated as concepts under the
                # current unit; major numbered headings start a new unit.
                number = re.match(r"^(\d+(?:\.\d+)*)", line)
                depth = number.group(1).count(".") if number else 0
                if _UNIT_HEADING.match(line) or _ROMAN_HEADING.match(line) or (number and depth == 0):
                    add_topic(line, page_number)
                elif current_topic is not None:
                    title = re.sub(r"^\d+(?:\.\d+)*[.)]?\s+", "", line).strip()
                    if title and not any(c["title"].casefold() == title.casefold() for c in current_topic["concepts"]):
                        current_topic["concepts"].append({"title": title[:180], "source_pages": [page_number]})
                else:
                    add_topic(line, page_number)
                continue
            bullet = _BULLET.match(line)
            if bullet and current_topic is not None:
                title = bullet.group(1).strip()
                if title and not any(c["title"].casefold() == title.casefold() for c in current_topic["concepts"]):
                    current_topic["concepts"].append({"title": title[:180], "source_pages": [page_number]})

    # A weak fallback keeps the draft editable rather than pretending the
    # parser found a reliable hierarchy.
    if not topics:
        first_lines = [
            _clean_line(line)
            for _, text in pages
            for line in text.splitlines()
            if len(_clean_line(line)) >= 8
        ]
        if first_lines:
            topics.append({
                "title": "Extracted syllabus content",
                "source_pages": [1],
                "concepts": [
                    {"title": line[:180], "source_pages": [page]}
                    for page, text in pages
                    for line in text.splitlines()
                    if len(_clean_line(line)) >= 8
                    for _ in [0]
                ][:30],
            })
            warnings.append("No clear chapter headings were detected. Review and rename the extracted lines before confirming.")

    if not topics:
        raise ValueError("Atlas extracted text but couldn't identify syllabus sections. Add the syllabus manually instead.")

    if len(topics) > 80:
        warnings.append("Many possible headings were detected. Review the draft carefully before importing.")
        topics = topics[:80]
    for topic in topics:
        topic["concepts"] = topic["concepts"][:100]

    if not any(topic["concepts"] for topic in topics):
        warnings.append("Chapter headings were detected, but few concept-level items were found. You can add concepts in the review step.")

    return {
        "page_count": len(reader.pages),
        "extracted_characters": total_chars,
        "topics": topics,
        "warnings": warnings,
    }
