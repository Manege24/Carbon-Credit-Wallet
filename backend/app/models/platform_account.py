import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from app.core.database import Base
from app.models.enums import AccountRole, AccountStatus


class PlatformAccount(Base):
    __tablename__ = "platform_accounts"

    account_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    role: Mapped[AccountRole] = mapped_column(SAEnum(AccountRole, name="account_role"), nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    account_status: Mapped[AccountStatus] = mapped_column(
        SAEnum(AccountStatus, name="account_status_platform"), default=AccountStatus.active, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    ledger_entries: Mapped[list["LedgerEntry"]] = relationship(back_populates="buyer_account")