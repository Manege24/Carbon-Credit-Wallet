import uuid
from datetime import datetime
from pydantic import BaseModel
from app.models.enums import AccountStatus


class FarmerOut(BaseModel):
    farmer_id: uuid.UUID
    full_name: str
    phone_number: str
    county: str
    account_status: AccountStatus
    registered_at: datetime
    model_config = {"from_attributes": True}