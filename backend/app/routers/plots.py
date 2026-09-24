import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import TokenPayload, require_role
from app.models.carbon_token import CarbonToken
from app.models.enums import TokenStatus
from app.models.ndvi_scan import NDVIScan
from app.models.tree_batch import TreeBatch
from app.models.tree_plot import TreePlot
from app.schemas.plot import PlotOut, PlotRegisterRequest, TreeBatchOut, TreeBatchRequest

router = APIRouter(tags=["plots"])


@router.post("/plots", response_model=PlotOut, status_code=status.HTTP_201_CREATED)
def register_plot(payload: PlotRegisterRequest, db: Session = Depends(get_db),
                   current: TokenPayload = Depends(require_role("FARMER"))):
    plot = TreePlot(plot_id=uuid.uuid4(), farmer_id=uuid.UUID(current.sub),
                     centroid_lat=payload.centroid_lat, centroid_lng=payload.centroid_lng, radius_m=payload.radius_m)
    db.add(plot)
    db.commit()
    db.refresh(plot)
    return plot


@router.post("/plots/{plot_id}/batches", response_model=TreeBatchOut, status_code=status.HTTP_201_CREATED)
def record_tree_batch(plot_id: uuid.UUID, payload: TreeBatchRequest, db: Session = Depends(get_db),
                       current: TokenPayload = Depends(require_role("FARMER"))):
    plot = db.get(TreePlot, plot_id)
    if not plot or str(plot.farmer_id) != current.sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plot not found")
    batch = TreeBatch(batch_id=uuid.uuid4(), plot_id=plot_id, tree_count=payload.tree_count,
                       species_type=payload.species_type, date_planted=payload.date_planted)
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


@router.get("/farmers/{farmer_id}/balance")
def view_token_balance(farmer_id: uuid.UUID, db: Session = Depends(get_db),
                        current: TokenPayload = Depends(require_role("FARMER"))):
    if str(farmer_id) != current.sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    plot_ids = db.execute(select(TreePlot.plot_id).where(TreePlot.farmer_id == farmer_id)).scalars().all()
    if not plot_ids:
        return {"farmer_id": farmer_id, "balance_kg_co2": 0}
    tokens = db.execute(select(CarbonToken).where(CarbonToken.plot_id.in_(plot_ids), CarbonToken.status == TokenStatus.issued)).scalars().all()
    return {"farmer_id": farmer_id, "balance_kg_co2": sum(t.quantity_kg_co2 for t in tokens)}


@router.get("/farmers/{farmer_id}/verification-history")
def view_verification_history(farmer_id: uuid.UUID, db: Session = Depends(get_db),
                               current: TokenPayload = Depends(require_role("FARMER"))):
    if str(farmer_id) != current.sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    plot_ids = db.execute(select(TreePlot.plot_id).where(TreePlot.farmer_id == farmer_id)).scalars().all()
    scans = db.execute(select(NDVIScan).where(NDVIScan.plot_id.in_(plot_ids)).order_by(NDVIScan.scan_date.desc())).scalars().all()
    return [{"plot_id": s.plot_id, "scan_date": s.scan_date, "ndvi_value": s.ndvi_value} for s in scans]