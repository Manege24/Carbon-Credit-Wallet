import numpy as np
import pytest

from app.services.imagery import TileResult
from app.services.ndvi import (NoValidPixelsError, circular_mask, compute_ndvi_array, summarise_tile)
from datetime import date


def test_ndvi_formula_known_values():
    red = np.array([[0.1, 0.2]], dtype="float32")
    nir = np.array([[0.5, 0.2]], dtype="float32")
    out = compute_ndvi_array(red, nir)
    assert out[0, 0] == pytest.approx(0.6667, abs=1e-3)   # (0.5-0.1)/(0.5+0.1)
    assert out[0, 1] == pytest.approx(0.0, abs=1e-6)


def test_ndvi_zero_denominator_is_nan_not_crash():
    out = compute_ndvi_array(np.zeros((2, 2)), np.zeros((2, 2)))
    assert np.isnan(out).all()


BBOX = {"min_lat": -1.0005, "max_lat": -0.9995, "min_lng": 36.9995, "max_lng": 37.0005}


def test_circular_mask_keeps_center_and_drops_corners():
    mask = circular_mask((21, 21), BBOX, -1.0, 37.0, radius_m=55)
    assert mask[10, 10]
    assert not mask[0, 0] and not mask[0, 20] and not mask[20, 0] and not mask[20, 20]


def _tile(red_val, nir_val, cloud=None, shape=(9, 9)):
    red = np.full(shape, red_val, dtype="float32")
    nir = np.full(shape, nir_val, dtype="float32")
    cloud = np.zeros(shape, dtype=bool) if cloud is None else cloud
    return TileResult(red=red, nir=nir, cloud_mask=cloud, acquired_on=date(2026, 1, 1), tile_source="t")


def test_summarise_clear_tile():
    s = summarise_tile(_tile(0.1, 0.5), BBOX, -1.0, 37.0, 55)
    assert s.mean_ndvi == pytest.approx(0.6667, abs=1e-3)
    assert s.cloud_cover_pct == 0.0


def test_summarise_ignores_cloudy_pixels_and_reports_cloud_pct():
    cloud = np.zeros((9, 9), dtype=bool)
    cloud[:, :3] = True                                  # left third is cloud
    tile = _tile(0.1, 0.5, cloud)
    s = summarise_tile(tile, BBOX, -1.0, 37.0, 55)
    assert 0 < s.cloud_cover_pct < 100
    assert s.mean_ndvi == pytest.approx(0.6667, abs=1e-3)


def test_all_cloudy_raises():
    tile = _tile(0.1, 0.5, np.ones((9, 9), dtype=bool))
    with pytest.raises(NoValidPixelsError):
        summarise_tile(tile, BBOX, -1.0, 37.0, 55)