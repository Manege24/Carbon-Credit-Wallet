import uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import TokenPayload, require_role
from app.models.tree_plot import TreePlot
from app.schemas.plot import PlotOut, PlotRegisterRequest

router = APIRouter(tags=["sync"])


class SyncPlotItem(PlotRegisterRequest):
    plot_id: uuid.UUID


@router.post("/sync/plots", response_model=list[PlotOut], status_code=status.HTTP_200_OK)
def sync_plots(items: list[SyncPlotItem], db: Session = Depends(get_db),
                current: TokenPayload = Depends(require_role("FARMER"))):
    results = []
    for item in items:
        existing = db.get(TreePlot, item.plot_id)
        if existing:
            results.append(existing)
            continue
        plot = TreePlot(plot_id=item.plot_id, farmer_id=uuid.UUID(current.sub),
                         centroid_lat=item.centroid_lat, centroid_lng=item.centroid_lng, radius_m=item.radius_m)
        db.add(plot)
        results.append(plot)
    db.commit()
    for r in results:
        db.refresh(r)
    return results