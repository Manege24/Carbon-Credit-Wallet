import uuid
from datetime import date

from sqlalchemy import Float, String, Date, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from app.core.database import Base


class NDVIScan(Base):
    __tablename__ = "ndvi_scans"

    scan_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    plot_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("tree_plots.plot_id"), nullable=False)
    source_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("imagery_sources.source_id"), nullable=False)
    config_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("ndvi_engine_configs.config_id"), nullable=False)
    scan_date: Mapped[date] = mapped_column(Date, nullable=False)
    ndvi_value: Mapped[float] = mapped_column(Float, nullable=False)
    cloud_cover_pct: Mapped[float] = mapped_column(Float, nullable=False)
    tile_source: Mapped[str] = mapped_column(String(255), nullable=False)

    plot: Mapped["TreePlot"] = relationship(back_populates="ndvi_scans")
    imagery_source: Mapped["ImagerySource"] = relationship(back_populates="ndvi_scans")
    engine_config: Mapped["NDVIEngineConfig"] = relationship(back_populates="ndvi_scans")

    @staticmethod
    def compute_ndvi(nir: float, red: float) -> float:
        denom = nir + red
        if denom == 0:
            raise ValueError("NIR + Red is zero; cannot compute NDVI")
        return (nir - red) / denom

    def compare_to_previous(self, previous: "NDVIScan") -> float:
        return previous.ndvi_value - self.ndvi_value

    def is_drop_beyond_threshold(self, previous: "NDVIScan", threshold: float) -> bool:
        return self.compare_to_previous(previous) > threshold