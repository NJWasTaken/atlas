import ipaddress
import socket
from urllib.parse import urljoin, urlparse

import httpx
import trafilatura
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db import get_db
from app.models import User
from app.security import get_current_user
from app.knowledge_models import KnowledgeNode, KnowledgeEdge
from app.knowledge_schemas import (
    BrowseRequest, BrowseResponse, GraphOut, KnowledgeEdgeCreate, KnowledgeEdgeOut,
    KnowledgeNodeCreate, KnowledgeNodeOut, KnowledgeNodeUpdate, WebSearchRequest,
    WebSearchResponse, WebSearchResult,
)

router = APIRouter(prefix="/explore", tags=["knowledge"])
MAX_PAGE_BYTES = 3 * 1024 * 1024
BROWSER_TIMEOUT = 15


def validate_public_url(value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
        raise HTTPException(400, "Use a public HTTP or HTTPS URL.")
    try:
        if parsed.port not in {None, 80, 443}:
            raise HTTPException(400, "Only standard HTTP and HTTPS ports are supported.")
        addresses = {
            item[4][0] for item in socket.getaddrinfo(
                parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80),
                type=socket.SOCK_STREAM,
            )
        }
        if not addresses or any(not ipaddress.ip_address(address).is_global for address in addresses):
            raise HTTPException(400, "This URL does not point to a publicly accessible host.")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(400, "Atlas could not resolve that website.") from exc
    return value


def owned_node(db: Session, node_id: int, user_id: int) -> KnowledgeNode:
    node = db.scalar(select(KnowledgeNode).where(
        KnowledgeNode.id == node_id, KnowledgeNode.user_id == user_id
    ))
    if node is None:
        raise HTTPException(404, "Knowledge node not found")
    return node


async def search_web(query: str, count: int) -> dict:
    if not settings.brave_search_api_key:
        raise HTTPException(503, "Web search is not configured. Add BRAVE_SEARCH_API_KEY to the backend environment.")
    headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": settings.brave_search_api_key,
    }
    params = {"q": query, "count": count, "country": "IN", "search_lang": "en", "safesearch": "moderate"}
    try:
        async with httpx.AsyncClient(timeout=12, trust_env=False) as client:
            response = await client.get("https://api.search.brave.com/res/v1/web/search", headers=headers, params=params)
        if response.status_code == 401:
            raise HTTPException(503, "The configured Brave Search API key was rejected.")
        if response.status_code == 429:
            raise HTTPException(429, "The search provider is rate-limiting requests. Try again shortly.")
        response.raise_for_status()
        return response.json()
    except HTTPException:
        raise
    except httpx.HTTPError as exc:
        raise HTTPException(502, "The web search provider could not be reached.") from exc


async def fetch_article(url: str) -> dict:
    current = validate_public_url(url)
    headers = {
        "User-Agent": "AtlasResearchReader/1.0 (+https://github.com/NJWasTaken/atlas)",
        "Accept": "text/html,application/xhtml+xml",
    }
    try:
        async with httpx.AsyncClient(timeout=BROWSER_TIMEOUT, follow_redirects=False, trust_env=False) as client:
            html = None
            for _ in range(5):
                async with client.stream("GET", current, headers=headers) as streamed:
                    if streamed.status_code in {301, 302, 303, 307, 308}:
                        location = streamed.headers.get("location")
                        if not location:
                            raise HTTPException(422, "This website returned an invalid redirect.")
                        current = validate_public_url(urljoin(current, location))
                        continue
                    if streamed.status_code != 200:
                        raise HTTPException(422, f"The website returned HTTP {streamed.status_code}.")
                    media_type = streamed.headers.get("content-type", "").split(";", 1)[0].lower()
                    if media_type not in {"text/html", "application/xhtml+xml"}:
                        raise HTTPException(415, "This reader currently supports HTML articles. Open PDFs in the PDF library.")
                    chunks = []
                    size = 0
                    async for chunk in streamed.aiter_bytes():
                        size += len(chunk)
                        if size > MAX_PAGE_BYTES:
                            raise HTTPException(413, "This page is too large to open in the research reader.")
                        chunks.append(chunk)
                    html = b"".join(chunks).decode(streamed.encoding or "utf-8", errors="replace")
                    break
            if html is None:
                raise HTTPException(422, "This website redirected too many times.")
    except HTTPException:
        raise
    except httpx.HTTPError as exc:
        raise HTTPException(502, "Atlas could not load this website.") from exc

    metadata = trafilatura.extract_metadata(html)
    content = trafilatura.extract(
        html,
        output_format="markdown",
        include_links=True,
        include_tables=True,
        include_images=False,
        favor_precision=True,
    ) or ""
    if not content.strip():
        raise HTTPException(422, "Atlas could not extract readable article text from this page. Try opening the original website.")
    parsed = urlparse(current)
    title = (metadata.title if metadata else None) or parsed.hostname or "Untitled page"
    return {
        "url": current,
        "title": title[:500],
        "site_name": parsed.hostname,
        "author": metadata.author if metadata else None,
        "published_date": metadata.date if metadata else None,
        "content_markdown": content[:120000],
        "excerpt": content[:360].replace("\n", " ").strip(),
    }


@router.get("/graph", response_model=GraphOut)
def get_graph(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    nodes = list(db.scalars(select(KnowledgeNode).where(KnowledgeNode.user_id == user.id).order_by(KnowledgeNode.created_at)))
    edges = list(db.scalars(select(KnowledgeEdge).where(KnowledgeEdge.user_id == user.id).order_by(KnowledgeEdge.created_at)))
    return {"nodes": nodes, "edges": edges}


@router.post("/graph/nodes", response_model=KnowledgeNodeOut, status_code=201)
def create_node(data: KnowledgeNodeCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    node = KnowledgeNode(user_id=user.id, **data.model_dump())
    db.add(node)
    db.commit()
    db.refresh(node)
    return node


@router.patch("/graph/nodes/{node_id}", response_model=KnowledgeNodeOut)
def update_node(node_id: int, data: KnowledgeNodeUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    node = owned_node(db, node_id, user.id)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(node, key, value)
    db.commit()
    db.refresh(node)
    return node


@router.delete("/graph/nodes/{node_id}", status_code=204)
def delete_node(node_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    node = owned_node(db, node_id, user.id)
    db.execute(
        KnowledgeEdge.__table__.delete().where(
            (KnowledgeEdge.user_id == user.id) &
            ((KnowledgeEdge.source_node_id == node_id) | (KnowledgeEdge.target_node_id == node_id))
        )
    )
    db.delete(node)
    db.commit()


@router.post("/graph/edges", response_model=KnowledgeEdgeOut, status_code=201)
def create_edge(data: KnowledgeEdgeCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if data.source_node_id == data.target_node_id:
        raise HTTPException(422, "A node cannot connect to itself.")
    owned_node(db, data.source_node_id, user.id)
    owned_node(db, data.target_node_id, user.id)
    existing = db.scalar(select(KnowledgeEdge).where(
        KnowledgeEdge.user_id == user.id,
        KnowledgeEdge.source_node_id == data.source_node_id,
        KnowledgeEdge.target_node_id == data.target_node_id,
        KnowledgeEdge.label == data.label,
    ))
    if existing:
        return existing
    edge = KnowledgeEdge(user_id=user.id, **data.model_dump())
    db.add(edge)
    db.commit()
    db.refresh(edge)
    return edge


@router.delete("/graph/edges/{edge_id}", status_code=204)
def delete_edge(edge_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    edge = db.scalar(select(KnowledgeEdge).where(KnowledgeEdge.id == edge_id, KnowledgeEdge.user_id == user.id))
    if edge is None:
        raise HTTPException(404, "Knowledge connection not found")
    db.delete(edge)
    db.commit()


@router.post("/search", response_model=WebSearchResponse)
async def web_search(data: WebSearchRequest, user: User = Depends(get_current_user)):
    payload = await search_web(data.q, data.count)
    results = []
    for item in payload.get("web", {}).get("results", []):
        url = item.get("url")
        title = item.get("title")
        if not url or not title:
            continue
        parsed = urlparse(url)
        results.append(WebSearchResult(
            title=title[:500],
            url=url,
            description=(item.get("description") or "")[:1200],
            age=item.get("age"),
            domain=parsed.hostname,
        ))
    more = bool(payload.get("query", {}).get("more_results_available", False))
    return {"results": results, "more_results_available": more}


@router.post("/browse", response_model=BrowseResponse)
async def browse_page(data: BrowseRequest, user: User = Depends(get_current_user)):
    return await fetch_article(data.url)
