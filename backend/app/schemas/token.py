import uuid
from datetime import datetime
from pydantic import BaseModel, Field
from app.models.enums import TokenStatus


class CarbonTokenOut(BaseModel):
    token_id: uuid.UUID
    plot_id: uuid.UUID
    quantity_kg_co2: int
    issue_date: datetime
    status: TokenStatus
    model_config = {"from_attributes": True}


class PurchaseRequest(BaseModel):
    token_id: uuid.UUID
    quantity_kg_co2: int = Field(..., gt=0)