import uuid
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.enums import AccountRole
from app.models.platform_account import PlatformAccount


def _create_account(role, username="user1", password="pw12345"):
    db = SessionLocal()
    account = PlatformAccount(account_id=uuid.uuid4(), role=role, display_name="Test",
                               username=username, password_hash=hash_password(password))
    db.add(account)
    db.commit()
    db.close()
    return account


def test_buyer_cannot_access_admin_only_endpoint(client):
    _create_account(AccountRole.buyer, username="buyer_boundary")
    login = client.post("/auth/login", data={"username": "buyer_boundary", "password": "pw12345"})
    token = login.json()["access_token"]
    resp = client.get("/admin/ledger", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


def test_admin_can_access_admin_only_endpoint(client):
    _create_account(AccountRole.admin, username="admin_boundary")
    login = client.post("/auth/login", data={"username": "admin_boundary", "password": "pw12345"})
    token = login.json()["access_token"]
    resp = client.get("/admin/ledger", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200