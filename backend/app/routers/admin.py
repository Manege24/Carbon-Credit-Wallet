import io
import uuid
from datetime import datetime, timezone

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import TokenPayload, require_role
from app.models.carbon_token import CarbonToken
from app.models.enums import AccountStatus, EntryType, PlotStatus, TokenStatus
from app.models.farmer import Farmer
from app.models.ledger_entry import LedgerEntry
from app.models.ndvi_scan import NDVIScan
from app.models.tree_plot import TreePlot
from app.schemas.farmer import FarmerOut
from app.schemas.ledger import LedgerEntryOut

router = APIRouter(prefix="/admin", tags=["admin"])


@router.patch("/farmers/{farmer_id}/status", response_model=FarmerOut)
def manage_farmer_account(farmer_id: uuid.UUID, new_status: AccountStatus, db: Session = Depends(get_db),
                           current: TokenPayload = Depends(require_role("ADMIN"))):
    farmer = db.get(Farmer, farmer_id)
    if not farmer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farmer not found")
    farmer.account_status = new_status
    db.commit()
    db.refresh(farmer)
    return farmer


@router.get("/ledger", response_model=list[LedgerEntryOut])
def monitor_token_ledger(db: Session = Depends(get_db), current: TokenPayload = Depends(require_role("ADMIN"))):
    return db.execute(select(LedgerEntry).order_by(LedgerEntry.timestamp.desc())).scalars().all()


@router.get("/plots/{plot_id}/ndvi-trend")
def view_ndvi_trend(plot_id: uuid.UUID, db: Session = Depends(get_db),
                     current: TokenPayload = Depends(require_role("ADMIN"))):
    plot = db.get(TreePlot, plot_id)
    if not plot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plot not found")
    scans = db.execute(select(NDVIScan).where(NDVIScan.plot_id == plot_id).order_by(NDVIScan.scan_date.asc())).scalars().all()
    if not scans:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No NDVI scans recorded for this plot yet")

    dates = [s.scan_date for s in scans]
    values = [s.ndvi_value for s in scans]

    fig, ax = plt.subplots(figsize=(7, 4), dpi=120)
    ax.plot(dates, values, marker="o", color="#2f6b2f", linewidth=2)
    ax.set_title(f"NDVI trend \u2014 Plot {str(plot_id)[:8]}\u2026 ({plot.status.value})")
    ax.set_xlabel("Scan date")
    ax.set_ylabel("NDVI value")
    ax.set_ylim(-0.1, 1.0)
    ax.grid(True, alpha=0.3)
    fig.autofmt_xdate()
    fig.tight_layout()

    buf = io.BytesIO()
    fig.savefig(buf, format="png")
    plt.close(fig)
    buf.seek(0)
    return Response(content=buf.getvalue(), media_type="image/png")


@router.get("/reports/verification")
def generate_verification_report(db: Session = Depends(get_db), current: TokenPayload = Depends(require_role("ADMIN"))):
    total_plots = db.execute(select(func.count()).select_from(TreePlot)).scalar_one()
    degraded_plots = db.execute(select(func.count()).select_from(TreePlot).where(TreePlot.status == PlotStatus.degraded)).scalar_one()
    flagged = db.execute(select(TreePlot).where(TreePlot.status == PlotStatus.degraded)).scalars().all()
    tokens_issued = db.execute(select(func.coalesce(func.sum(CarbonToken.quantity_kg_co2), 0)).where(CarbonToken.status == TokenStatus.issued)).scalar_one()
    tokens_revoked = db.execute(select(func.count()).select_from(CarbonToken).where(CarbonToken.status == TokenStatus.revoked)).scalar_one()

    entry_counts = {}
    for et in EntryType:
        c = db.execute(select(func.count()).select_from(LedgerEntry).where(LedgerEntry.entry_type == et)).scalar_one()
        entry_counts[et.value] = c

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "plot_summary": {"total_plots": total_plots, "verified_plots": total_plots - degraded_plots, "degraded_plots": degraded_plots},
        "flagged_plots": [{"plot_id": p.plot_id, "farmer_id": p.farmer_id, "centroid_lat": p.centroid_lat,
                            "centroid_lng": p.centroid_lng, "flagged_since": p.created_at} for p in flagged],
        "token_summary": {"total_kg_co2_issued_active": tokens_issued, "tokens_revoked_count": tokens_revoked},
        "ledger_activity": entry_counts,
    }