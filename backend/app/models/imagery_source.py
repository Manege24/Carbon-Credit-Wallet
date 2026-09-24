import uuid

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid

from app.core.database import Base


class ImagerySource(Base):
    __tablename__ = "imagery_sources"

    source_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    source_name: Mapped[str] = mapped_column(String(100), nullable=False)
    catalogue_url: Mapped[str] = mapped_column(String(255), nullable=False)

    ndvi_scans: Mapped[list["NDVIScan"]] = relationship(back_populates="imagery_source")