import uuid
from datetime import date

from sqlalchemy import String, Integer, Date, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from app.core.database import Base


class TreeBatch(Base):
    __tablename__ = "tree_batches"

    batch_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    plot_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("tree_plots.plot_id"), nullable=False)
    tree_count: Mapped[int] = mapped_column(Integer, nullable=False)
    species_type: Mapped[str] = mapped_column(String(100), nullable=False)
    date_planted: Mapped[date] = mapped_column(Date, nullable=False)

    plot: Mapped["TreePlot"] = relationship(back_populates="batches")

    def estimate_carbon_factor(self) -> float:
        return 21.0 * self.tree_count