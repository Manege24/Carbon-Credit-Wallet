"""
NDVI computation (FR-10). Pure numpy - no database, no network - so it is fully unit-testable.
"""
import math
from dataclasses import dataclass

import numpy as np

from app.services.imagery import TileResult


class NoValidPixelsError(Exception):
    """No usable (inside-the-plot, cloud-free) pixels were available."""


@dataclass
class ScanSummary:
    mean_ndvi: float
    cloud_cover_pct: float
    valid_pixels: int


def compute_ndvi_array(red: np.ndarray, nir: np.ndarray) -> np.ndarray:
    """NDVI = (NIR - Red) / (NIR + Red), vectorised (NFR-04). Pixels where NIR + Red == 0 become NaN."""
    red = red.astype("float32")
    nir = nir.astype("float32")
    denom = nir + red
    out = np.full(denom.shape, np.nan, dtype="float32")
    np.divide(nir - red, denom, out=out, where=denom != 0)
    return out


def circular_mask(shape: tuple[int, int], bbox: dict, centroid_lat: float,
                  centroid_lng: float, radius_m: float) -> np.ndarray:
    """True for pixels whose centre lies inside the plot circle (the 'clip to boundary' step)."""
    rows, cols = shape
    lat_step = (bbox["max_lat"] - bbox["min_lat"]) / rows
    lng_step = (bbox["max_lng"] - bbox["min_lng"]) / cols
    lats = bbox["max_lat"] - (np.arange(rows) + 0.5) * lat_step   # row 0 is the northern edge
    lngs = bbox["min_lng"] + (np.arange(cols) + 0.5) * lng_step
    dy = (lats - centroid_lat) * 111_320
    dx = (lngs - centroid_lng) * 111_320 * math.cos(math.radians(centroid_lat))
    dist2 = dy[:, None] ** 2 + dx[None, :] ** 2
    return dist2 <= radius_m ** 2


def summarise_tile(tile: TileResult, bbox: dict, centroid_lat: float,
                   centroid_lng: float, radius_m: float) -> ScanSummary:
    """Mean NDVI over the cloud-free pixels inside the plot, plus the cloud cover inside the plot."""
    inside = circular_mask(tile.red.shape, bbox, centroid_lat, centroid_lng, radius_m)
    if not inside.any():
        raise NoValidPixelsError("The plot is smaller than one image pixel")

    cloudy = tile.cloud_mask.astype(bool)
    cloud_pct = 100.0 * float((cloudy & inside).sum()) / float(inside.sum())

    ndvi = compute_ndvi_array(tile.red, tile.nir)
    valid = inside & ~cloudy & np.isfinite(ndvi)
    if not valid.any():
        raise NoValidPixelsError("Every pixel inside the plot is cloudy or has no data")

    return ScanSummary(mean_ndvi=float(ndvi[valid].mean()), cloud_cover_pct=cloud_pct,
                       valid_pixels=int(valid.sum()))