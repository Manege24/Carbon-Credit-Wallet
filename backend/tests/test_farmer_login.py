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