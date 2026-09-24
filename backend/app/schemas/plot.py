import uuid
from datetime import date, datetime
from pydantic import BaseModel, Field
from app.models.enums import PlotStatus


class PlotRegisterRequest(BaseModel):
    centroid_lat: float = Field(..., ge=-90, le=90)
    centroid_lng: float = Field(..., ge=-180, le=180)
    radius_m: float = Field(..., gt=0, le=2000)


class PlotOut(BaseModel):
    plot_id: uuid.UUID
    farmer_id: uuid.UUID
    centroid_lat: float
    centroid_lng: float
    radius_m: float
    status: PlotStatus
    created_at: datetime
    model_config = {"from_attributes": True}


class TreeBatchRequest(BaseModel):
    tree_count: int = Field(..., gt=0)
    species_type: str
    date_planted: date


class TreeBatchOut(BaseModel):
    batch_id: uuid.UUID
    plot_id: uuid.UUID
    tree_count: int
    species_type: str
    date_planted: date
    model_config = {"from_attributes": True}