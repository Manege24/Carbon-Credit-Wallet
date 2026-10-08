import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import TokenPayload, require_role
from app.models.tree_plot import TreePlot
from app.schemas.verification import VerificationResultOut
from app.services.imagery import ImageryUnavailableError, get_imagery_provider
from app.services.verification import run_verification_cycle, verify_plot

router = APIRouter(prefix="/admin", tags=["verification"])


def _provider_or_503():
    try:
        return get_imagery_provider()
    except ImageryUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.post("/verification/run", response_model=list[VerificationResultOut])
def run_cycle(as_of: date | None = None, db: Session = Depends(get_db),
              current: TokenPayload = Depends(require_role("ADMIN"))):
    """FR-10..FR-14 for every active plot. Manual trigger standing in for the bi-monthly scheduled job."""
    return run_verification_cycle(db, _provider_or_503(), as_of)


@router.post("/plots/{plot_id}/verify", response_model=VerificationResultOut)
def verify_single_plot(plot_id: uuid.UUID, as_of: date | None = None, db: Session = Depends(get_db),
                       current: TokenPayload = Depends(require_role("ADMIN"))):
    """Same pipeline for one plot."""
    plot = db.get(TreePlot, plot_id)
    if not plot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plot not found")
    return verify_plot(db, plot, _provider_or_503(), as_of)