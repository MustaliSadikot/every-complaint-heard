"""
TEST SUITE: Complaints API (Integration)
==========================================
End-to-end API tests using in-memory SQLite and ASGI test client.

Test IDs: TC-API-001 through TC-API-020
"""

import json
import io
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch

pytestmark = pytest.mark.asyncio


# ─── TC-API-001: Health check ────────────────────────────────────────────────
async def test_health(client):
    """TC-API-001 | GET /health → 200 ok."""
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


# ─── TC-API-002: Create a valid complaint ────────────────────────────────────
async def test_create_complaint_valid(client):
    """TC-API-002 | POST /api/complaints with valid data → 201, has id and classification."""
    payload = {
        "text": "The lift at Riverfront station is broken.",
        "language": "en",
        "station": "Riverfront",
        "source_channel": "Kiosk",
    }
    resp = await client.post("/api/complaints/", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert "id" in data
    assert data["department"] is not None
    assert data["urgency_score"] >= 0
    assert data["draft_reply"] is not None
    assert data["classification_mode"] in ("AI", "Fallback")


# ─── TC-API-003: Empty text rejected ─────────────────────────────────────────
async def test_create_complaint_empty_text(client):
    """TC-API-003 | POST with blank text → 422 validation error."""
    resp = await client.post("/api/complaints/", json={"text": "   ", "language": "en"})
    assert resp.status_code == 422


# ─── TC-API-004: Missing text field ──────────────────────────────────────────
async def test_create_complaint_missing_text(client):
    """TC-API-004 | POST without text field → 422 validation error."""
    resp = await client.post("/api/complaints/", json={"language": "en"})
    assert resp.status_code == 422


# ─── TC-API-005: Safety complaint gets safety_flag ───────────────────────────
async def test_safety_complaint_flagged(client):
    """TC-API-005 | Safety complaint → safety_flag=True, urgency_score≥80."""
    payload = {
        "text": "Emergency! There is a fire on the platform near the exit gate!",
        "language": "en",
        "station": "Kalupur",
    }
    resp = await client.post("/api/complaints/", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["safety_flag"] is True
    assert data["urgency_score"] >= 80
    assert data["urgency_level"] == "Critical"


# ─── TC-API-006: Get complaint by ID ─────────────────────────────────────────
async def test_get_complaint_by_id(client):
    """TC-API-006 | GET /api/complaints/{id} → returns the created complaint."""
    create_resp = await client.post("/api/complaints/", json={
        "text": "The washroom is very dirty at Vastral station.",
        "language": "en",
        "station": "Vastral",
    })
    cid = create_resp.json()["id"]
    resp = await client.get(f"/api/complaints/{cid}")
    assert resp.status_code == 200
    assert resp.json()["id"] == cid


# ─── TC-API-007: Get non-existent complaint ──────────────────────────────────
async def test_get_complaint_not_found(client):
    """TC-API-007 | GET with unknown id → 404."""
    resp = await client.get("/api/complaints/nonexistent-id-xyz")
    assert resp.status_code == 404


# ─── TC-API-008: List complaints with pagination ─────────────────────────────
async def test_list_complaints_pagination(client):
    """TC-API-008 | GET /api/complaints/?page=1&page_size=5 → pagination fields present."""
    for i in range(3):
        await client.post("/api/complaints/", json={
            "text": f"Complaint number {i + 1}: the escalator is broken.",
            "language": "en",
            "station": "Station A",
        })
    resp = await client.get("/api/complaints/?page=1&page_size=5")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert "total_pages" in data
    assert data["total"] == 3


# ─── TC-API-009: Update complaint status ─────────────────────────────────────
async def test_update_complaint_status(client):
    """TC-API-009 | PATCH status → reflects in GET response."""
    create_resp = await client.post("/api/complaints/", json={
        "text": "I was overcharged on my metro card.",
        "language": "en",
        "station": "Apparel",
    })
    cid = create_resp.json()["id"]
    patch_resp = await client.patch(f"/api/complaints/{cid}", json={"status": "In Review"})
    assert patch_resp.status_code == 200
    assert patch_resp.json()["status"] == "In Review"


# ─── TC-API-010: Approve a reply ─────────────────────────────────────────────
async def test_approve_reply(client):
    """TC-API-010 | Set approved_reply and review_state=Approved → stored correctly."""
    create_resp = await client.post("/api/complaints/", json={
        "text": "Staff member at gate 2 was very rude to me.",
        "language": "en",
        "station": "GEC",
    })
    cid = create_resp.json()["id"]
    patch_resp = await client.patch(f"/api/complaints/{cid}", json={
        "approved_reply": "Dear passenger, we sincerely apologise and have taken note.",
        "review_state": "Approved",
    })
    assert patch_resp.status_code == 200
    data = patch_resp.json()
    assert data["approved_reply"] is not None
    assert data["review_state"] == "Approved"


# ─── TC-API-011: Filter by urgency level ─────────────────────────────────────
async def test_filter_by_urgency(client):
    """TC-API-011 | GET with urgency_level filter → returns only matching records."""
    await client.post("/api/complaints/", json={
        "text": "FIRE on platform right now, emergency!",
        "language": "en",
        "station": "Terminus",
    })
    resp = await client.get("/api/complaints/?urgency_level=Critical")
    assert resp.status_code == 200
    data = resp.json()
    for item in data["items"]:
        assert item["urgency_level"] == "Critical"


# ─── TC-API-012: Search by text ──────────────────────────────────────────────
async def test_search_by_text(client):
    """TC-API-012 | GET with search param → returns matching complaints."""
    await client.post("/api/complaints/", json={
        "text": "The escalator at Kalupur station is making a loud noise.",
        "language": "en",
        "station": "Kalupur",
    })
    resp = await client.get("/api/complaints/?search=escalator")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1


# ─── TC-API-013: JSON batch import ───────────────────────────────────────────
async def test_import_json_batch(client):
    """TC-API-013 | POST /api/complaints/import/json → imports all valid records."""
    batch = [
        {"text": "Dirty platform at station X.", "language": "en", "station": "Station X"},
        {"text": "Escalator fault at station Y.", "language": "en", "station": "Station Y"},
        {"text": "Staff rude at station Z.", "language": "en", "station": "Station Z"},
    ]
    file_content = json.dumps(batch).encode()
    resp = await client.post(
        "/api/complaints/import/json",
        files={"file": ("batch.json", io.BytesIO(file_content), "application/json")},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["imported"] == 3
    assert data["skipped"] == 0


# ─── TC-API-014: JSON import duplicate prevention ────────────────────────────
async def test_import_json_duplicate_prevention(client):
    """TC-API-014 | Importing same id twice → second import skips it (idempotent)."""
    batch = [{"id": "FIXED-ID-001", "text": "Test duplicate complaint.", "language": "en"}]
    file_bytes = json.dumps(batch).encode()

    resp1 = await client.post(
        "/api/complaints/import/json",
        files={"file": ("b.json", io.BytesIO(file_bytes), "application/json")},
    )
    assert resp1.json()["imported"] == 1

    resp2 = await client.post(
        "/api/complaints/import/json",
        files={"file": ("b.json", io.BytesIO(file_bytes), "application/json")},
    )
    assert resp2.json()["imported"] == 0
    assert resp2.json()["skipped"] == 1


# ─── TC-API-015: CSV import ──────────────────────────────────────────────────
async def test_import_csv_batch(client):
    """TC-API-015 | POST /api/complaints/import/csv → valid CSV rows imported."""
    csv_content = (
        "text,language,station,source_channel\n"
        "Lift broken at Sector 3,en,Sector 3,In Person\n"
        "Toilet dirty at junction,hi,Junction,Mobile App\n"
    ).encode()
    resp = await client.post(
        "/api/complaints/import/csv",
        files={"file": ("data.csv", io.BytesIO(csv_content), "text/csv")},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["imported"] == 2


# ─── TC-API-016: Dashboard stats ─────────────────────────────────────────────
async def test_dashboard_stats(client):
    """TC-API-016 | GET /api/dashboard/stats → returns correct structure."""
    await client.post("/api/complaints/", json={"text": "Dirty station", "language": "en"})
    resp = await client.get("/api/dashboard/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert "total_complaints" in data
    assert "critical_count" in data
    assert "department_counts" in data
    assert data["total_complaints"] >= 1


# ─── TC-API-017: Sync status ─────────────────────────────────────────────────
async def test_sync_status(client):
    """TC-API-017 | GET /api/sync/status → returns valid sync status object."""
    resp = await client.get("/api/sync/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "server_configured" in data
    assert "pending_count" in data


# ─── TC-API-018: Reclassify endpoint ─────────────────────────────────────────
async def test_reclassify(client):
    """TC-API-018 | POST /api/complaints/{id}/reclassify → updates classification."""
    create_resp = await client.post("/api/complaints/", json={
        "text": "The rubbish bins are overflowing on the platform.",
        "language": "en",
        "station": "Maninagar",
    })
    cid = create_resp.json()["id"]
    resp = await client.post(f"/api/complaints/{cid}/reclassify")
    assert resp.status_code == 200
    assert resp.json()["department"] is not None


# ─── TC-API-019: Delete complaint ────────────────────────────────────────────
async def test_delete_complaint(client):
    """TC-API-019 | DELETE /api/complaints/{id} → 204, subsequent GET returns 404."""
    create_resp = await client.post("/api/complaints/", json={"text": "Test delete complaint.", "language": "en"})
    cid = create_resp.json()["id"]
    del_resp = await client.delete(f"/api/complaints/{cid}")
    assert del_resp.status_code == 204
    get_resp = await client.get(f"/api/complaints/{cid}")
    assert get_resp.status_code == 404


# ─── TC-API-020: AI unavailable graceful fallback ────────────────────────────
async def test_ai_unavailable_uses_fallback(client):
    """TC-API-020 | When Ollama is unavailable → complaint is still created using Fallback mode."""
    with patch("app.core.ai_engine.check_ai_available", new_callable=AsyncMock, return_value=False):
        resp = await client.post("/api/complaints/", json={
            "text": "The ticket gate is stuck and I cannot exit.",
            "language": "en",
            "station": "Vastral Metro",
        })
    assert resp.status_code == 201
    data = resp.json()
    assert data["classification_mode"] == "Fallback"
    assert data["draft_reply"] is not None


# ─── TC-API-021: Hindi complaint classification ───────────────────────────────
async def test_hindi_complaint(client):
    """TC-API-021 | Hindi fare complaint → classified correctly."""
    resp = await client.post("/api/complaints/", json={
        "text": "Mujhe metro ticket me jyada paise kaat liye, refund chahiye",
        "language": "hi",
        "station": "Kalupur",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["department"] is not None
    assert data["language"] == "hi"


# ─── TC-API-022: Import invalid JSON ─────────────────────────────────────────
async def test_import_invalid_json(client):
    """TC-API-022 | Invalid JSON file → 400 error."""
    resp = await client.post(
        "/api/complaints/import/json",
        files={"file": ("bad.json", io.BytesIO(b"NOT JSON {{{"), "application/json")},
    )
    assert resp.status_code == 400


# ─── TC-API-023: Persistence across sessions (same DB) ───────────────────────
async def test_persistence(client):
    """TC-API-023 | Complaint created in one request is retrievable in a subsequent request."""
    create_resp = await client.post("/api/complaints/", json={
        "text": "Smoke smell in the tunnel near Platform 2.",
        "language": "en",
        "station": "Maninagar",
    })
    assert create_resp.status_code == 201
    cid = create_resp.json()["id"]

    # Simulate second request (same in-memory DB within test scope)
    get_resp = await client.get(f"/api/complaints/{cid}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == cid
    assert get_resp.json()["safety_flag"] is True   # smoke signal
