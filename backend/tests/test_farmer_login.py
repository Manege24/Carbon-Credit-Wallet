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