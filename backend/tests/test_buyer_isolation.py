import uuid

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.enums import AccountRole
from app.models.platform_account import PlatformAccount
from app.models.carbon_token import CarbonToken
from app.models.enums import TokenStatus


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

def _make_token_for_new_farmer(client) -> uuid.UUID:
    suffix = uuid.uuid4().hex[:8]
    phone = f"07{suffix[:8]}"
    reg = client.post("/farmers/register", json={
        "full_name": "Seller", "phone_number": phone, "county": "Nairobi",
        "device_id": "d", "password": "secret123"})
    assert reg.status_code == 201
    login = client.post("/auth/login", data={"username": phone, "password": "secret123"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    plot = client.post("/plots", json={"centroid_lat": -1.2, "centroid_lng": 36.8, "radius_m": 40},
                       headers=headers)
    plot_id = uuid.UUID(plot.json()["plot_id"])
    token_id = uuid.uuid4()
    db = SessionLocal()
    try:
        db.add(CarbonToken(token_id=token_id, plot_id=plot_id, scan_id=None,
                           quantity_kg_co2=105, status=TokenStatus.issued))
        db.commit()
    finally:
        db.close()
    return token_id


def test_tokens_are_sold_whole_and_only_once(client):
    token_id = _make_token_for_new_farmer(client)
    suffix = uuid.uuid4().hex[:8]
    name = f"buyer-whole-{suffix}"
    _make_buyer(name, "BuyerPass123")
    headers = _login(client, name, "BuyerPass123")

    partial = client.post("/tokens/purchase-requests",
                          json={"token_id": str(token_id), "quantity_kg_co2": 10}, headers=headers)
    assert partial.status_code == 409

    whole = client.post("/tokens/purchase-requests",
                        json={"token_id": str(token_id), "quantity_kg_co2": 105}, headers=headers)
    assert whole.status_code == 201
    assert whole.json()["amount"] == 105

    again = client.post("/tokens/purchase-requests",
                        json={"token_id": str(token_id), "quantity_kg_co2": 105}, headers=headers)
    assert again.status_code == 409