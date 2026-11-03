def test_farmer_login_requires_correct_password(client):
    r = client.post("/farmers/register", json={
        "full_name": "Test Farmer",
        "phone_number": "0711000111",
        "county": "Nairobi",
        "device_id": "dev-1",
        "password": "secret123",
    })
    assert r.status_code == 201

    wrong = client.post("/auth/login", data={"username": "0711000111", "password": "wrongpass"})
    assert wrong.status_code == 401

    ok = client.post("/auth/login", data={"username": "0711000111", "password": "secret123"})
    assert ok.status_code == 200
    assert ok.json()["role"] == "FARMER"

def test_farmer_profile_endpoint(client):
    client.post("/farmers/register", json={
        "full_name": "Profile Farmer", "phone_number": "0799000222",
        "county": "Kiambu", "device_id": "p-dev", "password": "secret123",
    })
    login = client.post("/auth/login", data={"username": "0799000222", "password": "secret123"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    res = client.get("/farmers/me", headers=headers)
    assert res.status_code == 200
    assert res.json()["full_name"] == "Profile Farmer"
    assert res.json()["county"] == "Kiambu"
    assert "password_hash" not in res.json()

def test_my_plots_endpoint(client):
    client.post("/farmers/register", json={
        "full_name": "Plots Farmer", "phone_number": "0799000333",
        "county": "Kiambu", "device_id": "pl-dev", "password": "secret123",
    })
    login = client.post("/auth/login", data={"username": "0799000333", "password": "secret123"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    plot = client.post("/plots", json={"centroid_lat": -1.2, "centroid_lng": 36.8, "radius_m": 40}, headers=headers)
    pid = plot.json()["plot_id"]
    client.post(f"/plots/{pid}/batches", json={"tree_count": 12, "species_type": "Mango",
                                              "date_planted": "2026-01-10"}, headers=headers)
    res = client.get("/farmers/me/plots", headers=headers)
    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]["batches"][0]["tree_count"] == 12

def test_archive_plot_rules(client):
    def farmer(phone):
        client.post("/farmers/register", json={"full_name": "A", "phone_number": phone,
                    "county": "Nairobi", "device_id": "a", "password": "secret123"})
        res = client.post("/auth/login", data={"username": phone, "password": "secret123"})
        return {"Authorization": f"Bearer {res.json()['access_token']}"}

    owner = farmer("0755111001")
    other = farmer("0755111002")
    plot_id = client.post("/plots", json={"centroid_lat": -1.2, "centroid_lng": 36.8, "radius_m": 40},
                          headers=owner).json()["plot_id"]

    # another farmer cannot archive it
    assert client.patch(f"/plots/{plot_id}/archive", headers=other).status_code == 404

    # owner can, and it is idempotent
    res = client.patch(f"/plots/{plot_id}/archive", headers=owner)
    assert res.status_code == 200
    assert res.json()["status"] == "archived"
    assert client.patch(f"/plots/{plot_id}/archive", headers=owner).status_code == 200

    # no more trees on an archived plot
    batch = client.post(f"/plots/{plot_id}/batches", headers=owner,
                        json={"tree_count": 5, "species_type": "Mango", "date_planted": "2026-01-01"})
    assert batch.status_code == 409

    # the server still lists it, marked archived
    plots = client.get("/farmers/me/plots", headers=owner).json()
    assert plots[0]["status"] == "archived"

def test_verification_skips_plot_without_trees(client):
    from app.core.database import SessionLocal
    from app.models.tree_plot import TreePlot
    from app.services.imagery import get_imagery_provider
    from app.services.verification import verify_plot

    client.post("/farmers/register", json={"full_name": "E", "phone_number": "0755222001",
                "county": "Nairobi", "device_id": "e", "password": "secret123"})
    login = client.post("/auth/login", data={"username": "0755222001", "password": "secret123"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    plot_id = client.post("/plots", json={"centroid_lat": -1.2, "centroid_lng": 36.8, "radius_m": 40},
                          headers=headers).json()["plot_id"]
    db = SessionLocal()
    try:
        plot = db.get(TreePlot, __import__("uuid").UUID(plot_id))
        result = verify_plot(db, plot, get_imagery_provider())
        assert result.outcome == "no_trees"
    finally:
        db.close()