import uuid
import math
from datetime import datetime, timezone

from sqlalchemy import Float, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from app.core.database import Base
from app.models.enums import PlotStatus


class TreePlot(Base):
    __tablename__ = "tree_plots"

    plot_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    farmer_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("farmers.farmer_id"), nullable=False)
    centroid_lat: Mapped[float] = mapped_column(Float, nullable=False)
    centroid_lng: Mapped[float] = mapped_column(Float, nullable=False)
    radius_m: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[PlotStatus] = mapped_column(
        SAEnum(PlotStatus, name="plot_status"), default=PlotStatus.active, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    farmer: Mapped["Farmer"] = relationship(back_populates="plots")
    batches: Mapped[list["TreeBatch"]] = relationship(back_populates="plot", cascade="all, delete-orphan")
    ndvi_scans: Mapped[list["NDVIScan"]] = relationship(back_populates="plot", cascade="all, delete-orphan")
    carbon_tokens: Mapped[list["CarbonToken"]] = relationship(back_populates="plot", cascade="all, delete-orphan")

    def calculate_bounding_box(self) -> dict:
        deg_lat = self.radius_m / 111_320
        deg_lng = self.radius_m / (111_320 * max(0.01, math.cos(math.radians(self.centroid_lat))))
        return {
            "min_lat": self.centroid_lat - deg_lat, "max_lat": self.centroid_lat + deg_lat,
            "min_lng": self.centroid_lng - deg_lng, "max_lng": self.centroid_lng + deg_lng,
        }