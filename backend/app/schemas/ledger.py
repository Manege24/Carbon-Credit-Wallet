import uuid
from datetime import datetime
from pydantic import BaseModel
from app.models.enums import EntryType


class LedgerEntryOut(BaseModel):
    entry_id: uuid.UUID
    token_id: uuid.UUID
    farmer_id: uuid.UUID
    buyer_account_id: uuid.UUID | None
    entry_type: EntryType
    amount: int
    timestamp: datetime
    model_config = {"from_attributes": True}