import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import TokenPayload, require_role
from app.models.carbon_token import CarbonToken
from app.models.enums import TokenStatus
from app.models.farmer import Farmer
from app.models.ndvi_scan import NDVIScan
from app.models.tree_batch import TreeBatch
from app.models.tree_plot import TreePlot
from app.schemas.plot import PlotOut, PlotRegisterRequest, TreeBatchOut, TreeBatchRequest
from app.services.verification import Decision, evaluate_scans, get_active_config


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


@router.get("/farmers/me")
def my_profile(db: Session = Depends(get_db),
               current: TokenPayload = Depends(require_role("FARMER"))):
    farmer = db.get(Farmer, uuid.UUID(current.sub))
    if farmer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return {
        "farmer_id": farmer.farmer_id,
        "full_name": farmer.full_name,
        "phone_number": farmer.phone_number,
        "county": farmer.county,
    }


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
    scans = db.execute(
        select(NDVIScan).where(NDVIScan.plot_id.in_(plot_ids)).order_by(NDVIScan.scan_date.asc())
    ).scalars().all()

    # tokens per scan
    tokens = db.execute(select(CarbonToken).where(CarbonToken.plot_id.in_(plot_ids))).scalars().all()
    issued: dict = {}
    revoked: dict = {}
    for t in tokens:
        if t.scan_id is None:
            continue
        bucket = revoked if t.status == TokenStatus.revoked else issued
        bucket[t.scan_id] = bucket.get(t.scan_id, 0) + t.quantity_kg_co2

    config = get_active_config(db)
    confirmations = settings.ndvi_consecutive_scans_required

    items = []
    by_plot: dict = {}
    for s in scans:                                   # oldest -> newest, per plot
        series = by_plot.setdefault(s.plot_id, [])
        series.append(s.ndvi_value)
        decision = evaluate_scans(series, config.drop_threshold, confirmations)
        outcome = {Decision.PENDING: "pending", Decision.HEALTHY: "verified",
                   Decision.WITHHOLD: "withheld", Decision.DEGRADED: "degraded"}[decision]
        items.append({
            "plot_id": s.plot_id,
            "scan_date": s.scan_date,
            "ndvi_value": s.ndvi_value,
            "outcome": outcome,
            "tokens_issued_kg": issued.get(s.scan_id, 0) + revoked.get(s.scan_id, 0),
            "tokens_revoked_kg": revoked.get(s.scan_id, 0),
        })
    items.sort(key=lambda i: i["scan_date"], reverse=True)
    return items