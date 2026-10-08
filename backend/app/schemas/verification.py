import uuid
from pydantic import BaseModel


class VerificationResultOut(BaseModel):
    plot_id: uuid.UUID
    outcome: str
    ndvi_value: float | None = None
    cloud_cover_pct: float | None = None
    tokens_issued_kg: int = 0
    tokens_revoked: int = 0
    detail: str | None = None
    model_config = {"from_attributes": True}