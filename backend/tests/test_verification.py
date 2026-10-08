"""End-to-end verification pipeline against a real (SQLite) database, using the stub provider."""
import uuid
from datetime import date

import numpy as np
from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.carbon_token import CarbonToken
from app.models.enums import EntryType, PlotStatus, TokenStatus
from app.models.farmer import Farmer
from app.models.ledger_entry import LedgerEntry
from app.models.ndvi_engine_config import NDVIEngineConfig
from app.models.ndvi_scan import NDVIScan
from app.models.tree_batch import TreeBatch
from app.models.tree_plot import TreePlot
from app.services.imagery import StubImageryProvider, TileResult
from app.services.verification import verify_plot

BIMONTHLY = [date(2026, m, 15) for m in (1, 3, 5, 7, 9, 11)]


def _make_plot(db, trees=30):
    farmer = Farmer(farmer_id=uuid.uuid4(), full_name="V Farmer",
                    phone_number=f"+2547{uuid.uuid4().int % 10**8:08d}", county="Kiambu")
    db.add(farmer)
    db.flush()
    plot = TreePlot(plot_id=uuid.uuid4(), farmer_id=farmer.farmer_id, centroid_lat=-1.17,
                    centroid_lng=36.83, radius_m=60)
    db.add(plot)
    db.flush()
    db.add(TreeBatch(batch_id=uuid.uuid4(), plot_id=plot.plot_id, tree_count=trees,
                     species_type="Grevillea", date_planted=date(2025, 3, 1)))
    db.commit()
    return plot


def test_healthy_plot_gets_tokens_from_third_scan():
    db = SessionLocal()
    plot = _make_plot(db, trees=30)        # 30 trees * 21 kg / 6 cycles = 105 kg per cycle
    provider = StubImageryProvider("healthy")
    outcomes = [verify_plot(db, plot, provider, d).outcome for d in BIMONTHLY[:4]]
    assert outcomes == ["pending", "pending", "verified", "verified"]
    tokens = db.execute(select(CarbonToken).where(CarbonToken.plot_id == plot.plot_id)).scalars().all()
    assert len(tokens) == 2 and all(t.quantity_kg_co2 == 105 and t.status == TokenStatus.issued for t in tokens)
    ledger = db.execute(select(LedgerEntry).where(LedgerEntry.farmer_id == plot.farmer_id)).scalars().all()
    assert len(ledger) == 2 and all(e.entry_type == EntryType.issuance for e in ledger)
    db.close()


def test_degrading_plot_is_withheld_then_flagged_and_tokens_revoked():
    db = SessionLocal()
    plot = _make_plot(db, trees=30)
    provider = StubImageryProvider("degrading")
    results = [verify_plot(db, plot, provider, d) for d in BIMONTHLY]
    assert [r.outcome for r in results[:6]] == ["pending", "pending", "verified", "verified", "withheld", "degraded"]
    assert results[5].tokens_revoked == 1
    db.refresh(plot)
    assert plot.status == PlotStatus.degraded
    tokens = db.execute(select(CarbonToken).where(CarbonToken.plot_id == plot.plot_id)
                        .order_by(CarbonToken.issue_date)).scalars().all()
    assert sorted(t.status.value for t in tokens) == ["issued", "revoked"]
    types = sorted(e.entry_type.value for e in db.execute(
        select(LedgerEntry).where(LedgerEntry.farmer_id == plot.farmer_id)).scalars().all())
    assert types == ["issuance", "issuance", "revocation"]
    db.close()


def test_same_scan_is_never_processed_twice():
    db = SessionLocal()
    plot = _make_plot(db)
    provider = StubImageryProvider("healthy")
    assert verify_plot(db, plot, provider, BIMONTHLY[0]).outcome == "pending"
    again = verify_plot(db, plot, provider, BIMONTHLY[0])
    assert again.outcome == "already_processed"
    count = db.execute(select(NDVIScan).where(NDVIScan.plot_id == plot.plot_id)).scalars().all()
    assert len(count) == 1
    db.close()


def test_scan_records_source_and_config_provenance():
    db = SessionLocal()
    plot = _make_plot(db)
    verify_plot(db, plot, StubImageryProvider("healthy"), BIMONTHLY[0])
    scan = db.execute(select(NDVIScan).where(NDVIScan.plot_id == plot.plot_id)).scalar_one()
    assert scan.imagery_source.source_name == StubImageryProvider.source_name
    assert scan.engine_config.drop_threshold == 0.15
    db.close()


def test_cloudy_tile_is_discarded_not_stored():
    class CloudyProvider:
        source_name, catalogue_url = "Cloudy test provider", "test://cloudy"

        def fetch_least_cloudy_tile(self, request):
            cloud = np.zeros((9, 9), dtype=bool)
            cloud[:, :5] = True                       # more than 30 % of the plot is cloud
            return TileResult(red=np.full((9, 9), 0.1, "float32"), nir=np.full((9, 9), 0.5, "float32"),
                              cloud_mask=cloud, acquired_on=request.end, tile_source="cloudy-1")

    db = SessionLocal()
    plot = _make_plot(db)
    result = verify_plot(db, plot, CloudyProvider(), BIMONTHLY[0])
    assert result.outcome == "skipped_cloudy"
    assert db.execute(select(NDVIScan).where(NDVIScan.plot_id == plot.plot_id)).first() is None
    db.close()


def test_changing_settings_creates_a_new_config_version(monkeypatch):
    from app.core.config import settings
    db = SessionLocal()
    plot = _make_plot(db)
    verify_plot(db, plot, StubImageryProvider("healthy"), BIMONTHLY[0])
    before = len(db.execute(select(NDVIEngineConfig)).scalars().all())
    monkeypatch.setattr(settings, "ndvi_drop_threshold", 0.20)
    verify_plot(db, plot, StubImageryProvider("healthy"), BIMONTHLY[1])
    after = len(db.execute(select(NDVIEngineConfig)).scalars().all())
    assert after == before + 1
    db.close()