import uuid
from datetime import datetime, timezone

from sqlalchemy import Integer, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from app.core.database import Base
from app.models.enums import EntryType


class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    entry_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    token_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("carbon_tokens.token_id"), nullable=False)
    farmer_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("farmers.farmer_id"), nullable=False)
    buyer_account_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("platform_accounts.account_id"), nullable=True
    )
    entry_type: Mapped[EntryType] = mapped_column(SAEnum(EntryType, name="entry_type"), nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    token: Mapped["CarbonToken"] = relationship(back_populates="ledger_entries")
    buyer_account: Mapped["PlatformAccount | None"] = relationship(back_populates="ledger_entries")