import uuid
from datetime import date

from app.core.database import SessionLocal
from app.models.carbon_token import CarbonToken
from app.models.enums import TokenStatus
from app.models.imagery_source import ImagerySource
from app.models.ndvi_scan import NDVIScan
from app.services.verification import get_active_config


def test_history_returns_outcome_and_tokens(client):
    # 1. register and log in a farmer
    reg = client.post("/farmers/register", json={
        "full_name": "History Farmer",
        "phone_number": "0788000111",
        "county": "Nairobi",
        "device_id": "hist-dev",
        "password": "secret123",
    })
    assert reg.status_code == 201
    farmer_id = reg.json()["farmer_id"]

    login = client.post("/auth/login", data={"username": "0788000111", "password": "secret123"})
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    # 2. create a plot through the API
    plot = client.post("/plots", json={"centroid_lat": -1.2386, "centroid_lng": 36.8286, "radius_m": 50},
                       headers=headers)
    assert plot.status_code in (200, 201)
    plot_id = uuid.UUID(plot.json()["plot_id"])

    # 3. insert five scans directly: stable, stable, stable, big drop, confirmed drop
    values = [0.75, 0.74, 0.73, 0.50, 0.40]
    dates = [date(2026, m, 1) for m in (2, 4, 6, 8, 10)]
    db = SessionLocal()
    try:
        source = ImagerySource(source_id=uuid.uuid4(), source_name="TEST-SOURCE", catalogue_url="http://test")
        db.add(source)
        db.flush()
        config = get_active_config(db)
        scan_ids = []
        for i, (v, d) in enumerate(zip(values, dates)):
            sid = uuid.uuid4()
            scan_ids.append(sid)
            db.add(NDVIScan(scan_id=sid, plot_id=plot_id, source_id=source.source_id,
                            config_id=config.config_id, scan_date=d, ndvi_value=v,
                            cloud_cover_pct=0.0, tile_source=f"TEST-{i}"))
        db.flush()
        # a 105 kg token issued by the third scan
        db.add(CarbonToken(token_id=uuid.uuid4(), plot_id=plot_id, scan_id=scan_ids[2],
                           quantity_kg_co2=105, status=TokenStatus.issued))
        db.commit()
    finally:
        db.close()

    # 4. read the history
    res = client.get(f"/farmers/{farmer_id}/verification-history", headers=headers)
    assert res.status_code == 200
    items = res.json()
    assert len(items) == 5

    oldest_first = list(reversed(items))          # the endpoint returns newest first
    assert [i["outcome"] for i in oldest_first] == [
        "pending", "pending", "verified", "withheld", "degraded"
    ]
    assert oldest_first[2]["tokens_issued_kg"] == 105
    assert oldest_first[0]["tokens_issued_kg"] == 0
    assert oldest_first[2]["tokens_revoked_kg"] == 0
    # old fields still present
    assert {"plot_id", "scan_date", "ndvi_value"} <= set(items[0].keys())