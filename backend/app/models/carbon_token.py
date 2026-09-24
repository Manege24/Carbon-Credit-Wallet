import uuid
from datetime import datetime, timezone

from sqlalchemy import Integer, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid
from sqlalchemy import String

from app.core.database import Base
from app.models.enums import TokenStatus


class CarbonToken(Base):
    __tablename__ = "carbon_tokens"

    token_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    plot_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("tree_plots.plot_id"), nullable=False)
    scan_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("ndvi_scans.scan_id"), nullable=True)
    quantity_kg_co2: Mapped[int] = mapped_column(Integer, nullable=False)
    issue_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    status: Mapped[TokenStatus] = mapped_column(
        SAEnum(TokenStatus, name="token_status"), default=TokenStatus.issued, nullable=False
    )

    plot: Mapped["TreePlot"] = relationship(back_populates="carbon_tokens")
    ledger_entries: Mapped[list["LedgerEntry"]] = relationship(back_populates="token")

    def issue(self, quantity: int) -> None:
        self.quantity_kg_co2 = quantity
        self.status = TokenStatus.issued

    def revoke(self, reason: str) -> None:
        self.status = TokenStatus.revoked
        