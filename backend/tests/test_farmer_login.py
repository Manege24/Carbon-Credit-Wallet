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