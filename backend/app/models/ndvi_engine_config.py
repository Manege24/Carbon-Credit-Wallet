import uuid
from datetime import datetime, timezone

from sqlalchemy import Float, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from app.core.database import Base


class NDVIEngineConfig(Base):
    __tablename__ = "ndvi_engine_configs"

    config_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    cloud_cover_threshold_pct: Mapped[float] = mapped_column(Float, nullable=False)
    drop_threshold: Mapped[float] = mapped_column(Float, nullable=False, default=0.15)
    effective_from: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    ndvi_scans: Mapped[list["NDVIScan"]] = relationship(back_populates="engine_config")