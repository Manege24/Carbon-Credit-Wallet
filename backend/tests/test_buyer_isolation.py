import uuid

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.enums import AccountRole
from app.models.platform_account import PlatformAccount


def _make_buyer(username: str, password: str) -> str:
    db = SessionLocal()
    try:
        account_id = uuid.uuid4()
        db.add(PlatformAccount(account_id=account_id, role=AccountRole("BUYER"),
                               display_name=username, username=username,
                               password_hash=hash_password(password)))
        db.commit()
        return str(account_id)
    finally:
        db.close()


def _login(client, username: str, password: str) -> dict:
    res = client.post("/auth/login", data={"username": username, "password": password})
    assert res.status_code == 200
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def test_buyer_cannot_read_another_buyers_purchases(client):
    suffix = uuid.uuid4().hex[:8]
    name1, name2 = f"iso-buyer-a-{suffix}", f"iso-buyer-b-{suffix}"
    id1 = _make_buyer(name1, "BuyerPass123")
    id2 = _make_buyer(name2, "BuyerPass123")

    headers = _login(client, name1, "BuyerPass123")

    own = client.get(f"/buyers/{id1}/purchases", headers=headers)
    assert own.status_code == 200

    other = client.get(f"/buyers/{id2}/purchases", headers=headers)
    assert other.status_code == 404