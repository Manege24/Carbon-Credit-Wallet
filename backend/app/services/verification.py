"""
Verification service - ties FR-10 ... FR-14 together (sequence diagram steps 7-16).

  fetch tile -> compute NDVI -> store NDVIScan -> compare recent scans -> issue / withhold / revoke + flag
"""
import enum
import logging
import uuid
from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.carbon_token import CarbonToken
from app.models.enums import EntryType, PlotStatus, TokenStatus
from app.models.imagery_source import ImagerySource
from app.models.ledger_entry import LedgerEntry
from app.models.ndvi_engine_config import NDVIEngineConfig
from app.models.ndvi_scan import NDVIScan
from app.models.tree_plot import TreePlot
from app.services.imagery import ImageryProvider, ImageryUnavailableError, TileRequest
from app.services.ndvi import NoValidPixelsError, summarise_tile

logger = logging.getLogger(__name__)


class Decision(str, enum.Enum):
    PENDING = "pending"      # not enough scans yet to compare
    HEALTHY = "healthy"      # stable / rising  -> issue tokens
    WITHHOLD = "withhold"    # first drop beyond threshold, not yet confirmed -> issue nothing
    DEGRADED = "degraded"    # drop confirmed over consecutive scans -> flag plot + revoke tokens


def evaluate_scans(ndvi_values: list[float], drop_threshold: float, confirmations: int = 2) -> Decision:
    """
    Pure decision logic (FR-11 + FR-14). `ndvi_values` are oldest -> newest.
    The oldest value of the last (confirmations + 1) scans is the baseline.
    """
    needed = confirmations + 1
    if len(ndvi_values) < needed:
        return Decision.PENDING
    window = ndvi_values[-needed:]
    baseline = window[0]
    drops = [round(baseline - v, 6) for v in window[1:]]   # rounding avoids float noise at the threshold
    if drops[-1] <= drop_threshold:
        return Decision.HEALTHY
    if all(d > drop_threshold for d in drops):
        return Decision.DEGRADED
    return Decision.WITHHOLD


@dataclass
class VerificationResult:
    plot_id: uuid.UUID
    outcome: str
    ndvi_value: float | None = None
    cloud_cover_pct: float | None = None
    tokens_issued_kg: int = 0
    tokens_revoked: int = 0
    detail: str | None = None


# ------------------------------------------------------------------ config / source rows
def get_or_create_source(db: Session, provider: ImageryProvider) -> ImagerySource:
    source = db.execute(
        select(ImagerySource).where(ImagerySource.source_name == provider.source_name)
    ).scalar_one_or_none()
    if source is None:
        source = ImagerySource(source_id=uuid.uuid4(), source_name=provider.source_name,
                               catalogue_url=provider.catalogue_url)
        db.add(source)
        db.flush()
    return source


def get_active_config(db: Session) -> NDVIEngineConfig:
    """Latest engine config. If settings changed, a NEW row is written, so old scans keep the old config."""
    config = db.execute(
        select(NDVIEngineConfig).order_by(NDVIEngineConfig.effective_from.desc())
    ).scalars().first()
    if (config is None
            or config.drop_threshold != settings.ndvi_drop_threshold
            or config.cloud_cover_threshold_pct != settings.ndvi_cloud_cover_threshold_pct):
        config = NDVIEngineConfig(config_id=uuid.uuid4(),
                                  cloud_cover_threshold_pct=settings.ndvi_cloud_cover_threshold_pct,
                                  drop_threshold=settings.ndvi_drop_threshold)
        db.add(config)
        db.flush()
    return config


# ------------------------------------------------------------------ token actions
def _issue_tokens(db: Session, plot: TreePlot, scan: NDVIScan) -> int:
    """FR-12. One token record per scan; 1 token = 1 kg CO2 (placeholder carbon factor, see TreeBatch)."""
    already = db.execute(select(CarbonToken).where(CarbonToken.scan_id == scan.scan_id)).first()
    if already:
        return 0
    annual_kg = sum(batch.estimate_carbon_factor() for batch in plot.batches)
    quantity = round(annual_kg / settings.tokens_cycles_per_year)
    if quantity <= 0:
        return 0
    token = CarbonToken(token_id=uuid.uuid4(), plot_id=plot.plot_id, scan_id=scan.scan_id,
                        quantity_kg_co2=quantity, status=TokenStatus.issued)
    db.add(token)
    db.flush()
    db.add(LedgerEntry(entry_id=uuid.uuid4(), token_id=token.token_id, farmer_id=plot.farmer_id,
                       entry_type=EntryType.issuance, amount=quantity))
    return quantity


def _revoke_window_tokens(db: Session, plot: TreePlot, window: list[NDVIScan]) -> int:
    """FR-13. Revoke unsold tokens issued from scans inside the comparison window."""
    baseline_date = window[0].scan_date
    tokens = db.execute(
        select(CarbonToken)
        .join(NDVIScan, CarbonToken.scan_id == NDVIScan.scan_id)
        .where(CarbonToken.plot_id == plot.plot_id,
               CarbonToken.status == TokenStatus.issued,
               NDVIScan.scan_date >= baseline_date)
    ).scalars().all()
    for token in tokens:
        token.revoke("NDVI decline confirmed")
        db.add(LedgerEntry(entry_id=uuid.uuid4(), token_id=token.token_id, farmer_id=plot.farmer_id,
                           entry_type=EntryType.revocation, amount=token.quantity_kg_co2))
    return len(tokens)


# ------------------------------------------------------------------ main entry points
def verify_plot(db: Session, plot: TreePlot, provider: ImageryProvider,
                as_of: date | None = None) -> VerificationResult:
    as_of = as_of or date.today()
    if not plot.batches:
        return VerificationResult(plot.plot_id, "no_trees", detail="Plot has no recorded trees")
    source = get_or_create_source(db, provider)
    config = get_active_config(db)

    scan_count = db.execute(
        select(func.count()).select_from(NDVIScan).where(NDVIScan.plot_id == plot.plot_id)
    ).scalar_one()
    bbox = plot.calculate_bounding_box()
    request = TileRequest(bbox=bbox, start=as_of - timedelta(days=settings.ndvi_search_window_days),
                          end=as_of, max_cloud_pct=config.cloud_cover_threshold_pct,
                          plot_id=plot.plot_id, sequence_index=scan_count)

    try:
        tile = provider.fetch_least_cloudy_tile(request)
    except ImageryUnavailableError as exc:
        db.rollback()
        return VerificationResult(plot.plot_id, "imagery_unavailable", detail=str(exc))

    duplicate = db.execute(
        select(NDVIScan).where(NDVIScan.plot_id == plot.plot_id, NDVIScan.tile_source == tile.tile_source)
    ).scalar_one_or_none()
    if duplicate:
        return VerificationResult(plot.plot_id, "already_processed", ndvi_value=duplicate.ndvi_value,
                                  cloud_cover_pct=duplicate.cloud_cover_pct)

    try:
        summary = summarise_tile(tile, bbox, plot.centroid_lat, plot.centroid_lng, plot.radius_m)
    except NoValidPixelsError as exc:
        return VerificationResult(plot.plot_id, "no_valid_data", detail=str(exc))

    if summary.cloud_cover_pct > config.cloud_cover_threshold_pct:
        return VerificationResult(plot.plot_id, "skipped_cloudy", cloud_cover_pct=summary.cloud_cover_pct,
                                  detail="Too cloudy - scan discarded")

    scan = NDVIScan(scan_id=uuid.uuid4(), plot_id=plot.plot_id, source_id=source.source_id,
                    config_id=config.config_id, scan_date=tile.acquired_on, ndvi_value=summary.mean_ndvi,
                    cloud_cover_pct=summary.cloud_cover_pct, tile_source=tile.tile_source)
    db.add(scan)
    db.flush()

    scans = db.execute(
        select(NDVIScan).where(NDVIScan.plot_id == plot.plot_id).order_by(NDVIScan.scan_date.asc())
    ).scalars().all()
    confirmations = settings.ndvi_consecutive_scans_required
    decision = evaluate_scans([s.ndvi_value for s in scans], config.drop_threshold, confirmations)

    result = VerificationResult(plot.plot_id, decision.value, ndvi_value=summary.mean_ndvi,
                                cloud_cover_pct=summary.cloud_cover_pct)
    if decision == Decision.HEALTHY:
        result.outcome = "verified"
        result.tokens_issued_kg = _issue_tokens(db, plot, scan)
    elif decision == Decision.WITHHOLD:
        result.outcome = "withheld"
    elif decision == Decision.DEGRADED:
        plot.status = PlotStatus.degraded                                   # FR-14
        result.tokens_revoked = _revoke_window_tokens(db, plot, scans[-(confirmations + 1):])   # FR-13
    db.commit()
    return result


def run_verification_cycle(db: Session, provider: ImageryProvider,
                           as_of: date | None = None) -> list[VerificationResult]:
    """One bi-monthly cycle over every active plot. One plot failing never stops the others."""
    plots = db.execute(select(TreePlot).where(TreePlot.status == PlotStatus.active)).scalars().all()
    results = []
    for plot in plots:
        try:
            results.append(verify_plot(db, plot, provider, as_of))
        except Exception as exc:  # noqa: BLE001 - deliberate: isolate failures per plot
            db.rollback()
            logger.exception("Verification failed for plot %s", plot.plot_id)
            results.append(VerificationResult(plot.plot_id, "error", detail=str(exc)))
    return results