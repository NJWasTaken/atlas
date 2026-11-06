from tests.conftest import register, auth_headers
from app.routers import knowledge


def test_graph_node_and_edge_lifecycle_is_user_scoped(client):
    token = register(client, "graph@example.com")
    headers = auth_headers(token)
    first = client.post("/api/v1/explore/graph/nodes", headers=headers, json={"kind": "topic", "title": "Neural networks"})
    second = client.post("/api/v1/explore/graph/nodes", headers=headers, json={"kind": "concept", "title": "Backpropagation", "position_x": 24, "position_y": 8, "position_z": -4})
    assert first.status_code == 201
    assert second.status_code == 201
    edge = client.post("/api/v1/explore/graph/edges", headers=headers, json={"source_node_id": first.json()["id"], "target_node_id": second.json()["id"], "label": "uses"})
    assert edge.status_code == 201
    graph = client.get("/api/v1/explore/graph", headers=headers).json()
    assert len(graph["nodes"]) == 2
    assert graph["edges"][0]["label"] == "uses"
    updated = client.patch(f"/api/v1/explore/graph/nodes/{second.json()['id']}", headers=headers, json={"title": "Backpropagation algorithm", "position_z": 9})
    assert updated.status_code == 200
    assert updated.json()["position_z"] == 9
    assert client.delete(f"/api/v1/explore/graph/nodes/{first.json()['id']}", headers=headers).status_code == 204
    graph = client.get("/api/v1/explore/graph", headers=headers).json()
    assert len(graph["nodes"]) == 1
    assert graph["edges"] == []


def test_graph_rejects_self_edges_and_cross_user_access(client):
    owner = auth_headers(register(client, "graph-owner@example.com"))
    other = auth_headers(register(client, "graph-other@example.com"))
    node = client.post("/api/v1/explore/graph/nodes", headers=owner, json={"title": "Private idea"}).json()
    self_edge = client.post("/api/v1/explore/graph/edges", headers=owner, json={"source_node_id": node["id"], "target_node_id": node["id"]})
    assert self_edge.status_code == 422
    assert client.get("/api/v1/explore/graph", headers=other).json()["nodes"] == []
    assert client.patch(f"/api/v1/explore/graph/nodes/{node['id']}", headers=other, json={"title": "Steal it"}).status_code == 404
    assert client.delete(f"/api/v1/explore/graph/nodes/{node['id']}", headers=other).status_code == 404


def test_search_requires_a_server_side_brave_key(client):
    token = register(client, "search@example.com")
    response = client.post("/api/v1/explore/search", headers=auth_headers(token), json={"q": "knowledge graphs"})
    assert response.status_code == 503
    assert "BRAVE_SEARCH_API_KEY" in response.json()["detail"]


def test_search_maps_provider_results_without_persisting_them(client, monkeypatch):
    token = register(client, "search-mock@example.com")

    async def fake_search(query, count):
        assert query == "graph databases"
        assert count == 10
        return {"web": {"results": [{"title": "Graph databases", "url": "https://example.org/graphs", "description": "A guide"}]}, "query": {"more_results_available": True}}

    monkeypatch.setattr(knowledge, "search_web", fake_search)
    response = client.post("/api/v1/explore/search", headers=auth_headers(token), json={"q": "graph databases"})
    assert response.status_code == 200
    assert response.json()["results"][0]["domain"] == "example.org"
    assert response.json()["more_results_available"] is True


def test_browser_rejects_non_public_and_non_http_urls(client, monkeypatch):
    token = register(client, "browser@example.com")
    monkeypatch.setattr(knowledge, "validate_public_url", lambda value: (_ for _ in ()).throw(knowledge.HTTPException(400, "Use a public HTTP or HTTPS URL.")))
    response = client.post("/api/v1/explore/browse", headers=auth_headers(token), json={"url": "file:///etc/passwd"})
    assert response.status_code == 400
