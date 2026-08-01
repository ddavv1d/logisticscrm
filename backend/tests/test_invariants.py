"""Тесты критических инвариантов (council punch-list)."""

import pytest

# loop_scope="session" — тесты идут на том же loop, что session-scoped client/engine
pytestmark = pytest.mark.asyncio(loop_scope="session")


async def test_login_and_me(client, owner):
    r = await client.get("/api/auth/me", cookies=owner)
    assert r.status_code == 200
    assert r.json()["role"] == "owner"


async def test_manager_cannot_see_money_in_raw_json(client, manager):
    """Council #30: маржа не должна утечь менеджеру даже в сыром JSON."""
    lst = (await client.get("/api/containers", cookies=manager)).json()
    cid = lst[0]["id"]
    detail = (await client.get(f"/api/containers/{cid}", cookies=manager)).json()
    assert detail["money"] is None
    assert detail["charges"] == []


async def test_manager_forbidden_dashboard(client, manager):
    r = await client.get("/api/dashboard", cookies=manager)
    assert r.status_code == 403


async def test_owner_sees_margin_in_usd(client, owner):
    lst = (await client.get("/api/containers", cookies=owner)).json()
    cid = lst[0]["id"]
    detail = (await client.get(f"/api/containers/{cid}", cookies=owner)).json()
    assert detail["money"] is not None
    assert "margin_usd" in detail["money"]


async def test_multicurrency_margin_is_usd(client, owner):
    """Мультивалюта: маржа считается в USD через amount_usd."""
    d = (await client.get("/api/dashboard", cookies=owner)).json()
    # маржа положительна и в USD (демо-данные прибыльны)
    assert d["money"]["margin_usd"] > 0
    assert d["money"]["receivable_usd"] >= 0


async def test_csrf_required_for_stage_change(client, owner):
    lst = (await client.get("/api/containers", cookies=owner)).json()
    cid = lst[0]["id"]
    # без CSRF-заголовка → 403
    r = await client.post(
        f"/api/containers/{cid}/stage", json={"stage_code": "loading"}, cookies=owner
    )
    assert r.status_code == 403


async def test_stage_change_appends_journal_and_syncs(client, owner):
    """Council #2: current_stage == последняя запись журнала (одна транзакция)."""
    csrf = owner.get("lc_csrf")
    lst = (await client.get("/api/containers", cookies=owner)).json()
    cid = lst[0]["id"]
    before = (await client.get(f"/api/containers/{cid}/history", cookies=owner)).json()
    r = await client.post(
        f"/api/containers/{cid}/stage",
        json={"stage_code": "customs_uz", "comment": "тест"},
        cookies=owner,
        headers={"X-CSRF-Token": csrf},
    )
    assert r.status_code == 200
    assert r.json()["current_stage_code"] == "customs_uz"
    after = (await client.get(f"/api/containers/{cid}/history", cookies=owner)).json()
    assert len(after) == len(before) + 1
    assert after[0]["stage_code"] == "customs_uz"  # newest first


async def test_create_container_preset_and_start_stage(client, owner):
    """Council #4: создание ставит стадию booking + 4 плеча пресета."""
    csrf = owner.get("lc_csrf")
    r = await client.post(
        "/api/containers",
        json={"apply_corridor_preset": True},
        cookies=owner,
        headers={"X-CSRF-Token": csrf},
    )
    assert r.status_code == 200
    d = r.json()
    assert d["current_stage_code"] == "booking"
    assert d["leg_count"] == 4


async def test_search_by_container_no(client, owner):
    """Council: поиск по container_no («где мой груз MSKU…»)."""
    lst = (await client.get("/api/containers", cookies=owner)).json()
    cn = next((c["container_no"] for c in lst if c["container_no"]), None)
    assert cn
    found = (await client.get(f"/api/containers?search={cn[:6]}", cookies=owner)).json()
    assert any(c["container_no"] == cn for c in found)


async def test_stuck_detection(client, owner):
    """Застрявшие детектятся по порогу стадии (демо: 3 штуки)."""
    counts = (await client.get("/api/containers/counts", cookies=owner)).json()
    assert counts["stuck"] >= 1
    stuck = (await client.get("/api/containers?chip=stuck", cookies=owner)).json()
    assert all(c["is_stuck"] for c in stuck)


async def test_export_xlsx(client, owner):
    r = await client.get("/api/export/containers.xlsx", cookies=owner)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith(
        "application/vnd.openxmlformats"
    )
    assert len(r.content) > 1000
