import uuid
from datetime import date

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.enums import AccountRole
from app.models.farmer import Farmer
from app.models.platform_account import PlatformAccount
from app.models.tree_batch import TreeBatch
from app.models.tree_plot import TreePlot


def _login(client, role, username):
    db = SessionLocal()
    db.add(PlatformAccount(account_id=uuid.uuid4(), role=role, display_name=username,
                           username=username, password_hash=hash_password("pw12345")))
    db.commit()
    db.close()
    return client.post("/auth/login", data={"username": username, "password": "pw12345"}).json()["access_token"]


def _plot(with_trees: bool = True):
    db = SessionLocal()
    farmer = Farmer(farmer_id=uuid.uuid4(), full_name="API Farmer",
                    phone_number=f"+2547{uuid.uuid4().int % 10**8:08d}", county="Nakuru")
    db.add(farmer)
    db.flush()
    plot = TreePlot(plot_id=uuid.uuid4(), farmer_id=farmer.farmer_id, centroid_lat=-0.3,
                    centroid_lng=36.0, radius_m=50)
    db.add(plot)
    db.flush()
    if with_trees:
        db.add(TreeBatch(batch_id=uuid.uuid4(), plot_id=plot.plot_id, tree_count=30,
                         species_type="Test", date_planted=date(2026, 1, 1)))
    db.commit()
    pid = plot.plot_id
    db.close()
    return pid


def test_admin_can_verify_a_single_plot(client):
    token = _login(client, AccountRole.admin, "verify_admin")
    plot_id = _plot()
    resp = client.post(f"/admin/plots/{plot_id}/verify?as_of=2026-01-15", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["outcome"] == "pending" and body["ndvi_value"] is not None


def test_plot_without_trees_is_not_verified(client):
    token = _login(client, AccountRole.admin, "verify_admin_empty")
    plot_id = _plot(with_trees=False)
    resp = client.post(f"/admin/plots/{plot_id}/verify?as_of=2026-01-15", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["outcome"] == "no_trees"


def test_admin_can_run_full_cycle_and_own_plot_is_included(client):
    token = _login(client, AccountRole.admin, "cycle_admin")
    plot_id = str(_plot())
    resp = client.post("/admin/verification/run?as_of=2026-02-15", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert plot_id in [r["plot_id"] for r in resp.json()]


def test_buyer_cannot_trigger_verification(client):
    token = _login(client, AccountRole.buyer, "verify_buyer")
    resp = client.post("/admin/verification/run", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


def test_unknown_plot_returns_404(client):
    token = _login(client, AccountRole.admin, "verify_admin2")
    resp = client.post(f"/admin/plots/{uuid.uuid4()}/verify", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 404


def test_copernicus_selected_without_credentials_gives_503(client, monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, "imagery_provider", "copernicus")
    monkeypatch.setattr(settings, "copernicus_client_id", "")
    token = _login(client, AccountRole.admin, "verify_admin3")
    resp = client.post("/admin/verification/run", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 503
    assert "COPERNICUS_CLIENT_ID" in resp.json()["detail"]