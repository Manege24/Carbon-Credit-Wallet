import os
os.environ["DATABASE_URL"] = "sqlite:///./test_pytest.db"
os.environ["JWT_SECRET_KEY"] = "pytest-secret"

import pytest
from fastapi.testclient import TestClient

from app.core.database import Base, engine
from app.main import app


@pytest.fixture(scope="session", autouse=True)
def _create_schema():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    if os.path.exists("test_pytest.db"):
        os.remove("test_pytest.db")


@pytest.fixture()
def client():
    return TestClient(app)