"""
Satellite imagery providers (FR-07).

Two implementations behind one interface:
  * StubImageryProvider  - synthetic data, for development and tests (no credentials needed)
  * CopernicusClient     - real Sentinel-2 L2A via the Copernicus Data Space Sentinel Hub Process API

The verification service only talks to the ImageryProvider interface, so switching
from stub to real imagery is a one-line settings change (IMAGERY_PROVIDER=copernicus).
"""
import math
import uuid
from dataclasses import dataclass
from datetime import date
from typing import Protocol

import numpy as np
import requests
from rasterio.io import MemoryFile

from app.core.config import settings


class ImageryUnavailableError(Exception):
    """Raised when imagery could not be obtained (bad credentials, no scene, network error...)."""


@dataclass(frozen=True)
class TileRequest:
    bbox: dict                       # {"min_lat","max_lat","min_lng","max_lng"} from TreePlot.calculate_bounding_box()
    start: date
    end: date
    max_cloud_pct: float
    plot_id: uuid.UUID | None = None  # used only by the stub, for reproducible demos
    sequence_index: int = 0           # used only by the stub (how many scans this plot already has)


@dataclass
class TileResult:
    red: np.ndarray          # Sentinel-2 band B04 reflectance, shape (rows, cols)
    nir: np.ndarray          # Sentinel-2 band B08 reflectance
    cloud_mask: np.ndarray   # True where the pixel is cloud / shadow / no-data
    acquired_on: date
    tile_source: str         # identifier stored in NDVIScan.tile_source


class ImageryProvider(Protocol):
    source_name: str
    catalogue_url: str

    def fetch_least_cloudy_tile(self, request: TileRequest) -> TileResult: ...


# --------------------------------------------------------------------------- stub
class StubImageryProvider:
    source_name = "Stub imagery (development)"
    catalogue_url = "stub://local"

    # NDVI the stub "measures" on the 1st, 2nd, 3rd... scan of a plot
    SCENARIOS = {
        "healthy": [0.72, 0.74, 0.73, 0.75, 0.74, 0.76],
        "degrading": [0.74, 0.75, 0.72, 0.66, 0.50, 0.40],
    }

    def __init__(self, scenario: str = "healthy"):
        if scenario not in self.SCENARIOS:
            raise ImageryUnavailableError(f"Unknown stub scenario '{scenario}' (use healthy or degrading)")
        self.scenario = scenario

    def fetch_least_cloudy_tile(self, request: TileRequest) -> TileResult:
        values = self.SCENARIOS[self.scenario]
        target = values[min(request.sequence_index, len(values) - 1)]

        # pick reflectances that give exactly `target`:  (nir - red) / (nir + red) = target
        red = np.full((5, 5), 0.10, dtype="float32")
        nir = (red * (1 + target) / (1 - target)).astype("float32")
        cloud = np.zeros((5, 5), dtype=bool)

        plot_part = str(request.plot_id)[:8] if request.plot_id else "noplot"
        return TileResult(
            red=red, nir=nir, cloud_mask=cloud, acquired_on=request.end,
            tile_source=f"STUB-{self.scenario}-{plot_part}-{request.end.isoformat()}",
        )


# --------------------------------------------------------------------------- real
class CopernicusClient:
    """
    Sentinel-2 L2A from the Copernicus Data Space Ecosystem, through the Sentinel Hub
    Process API. The API returns a small GeoTIFF already cropped to the plot's bounding
    box, so no multi-gigabyte scene download is needed.

    Needs an OAuth client (id + secret) created in the Copernicus Data Space dashboard.
    """
    source_name = "Copernicus Data Space (Sentinel-2 L2A)"
    catalogue_url = "https://dataspace.copernicus.eu"

    # Band 1 = red (B04), band 2 = NIR (B08), band 3 = 1 where the pixel is unusable.
    # SCL classes: 1 saturated/defective, 3 cloud shadow, 8/9 cloud, 10 thin cirrus.
    EVALSCRIPT = """//VERSION=3
function setup() {
  return { input: ["B04", "B08", "SCL", "dataMask"],
           output: { bands: 3, sampleType: "FLOAT32" } };
}
function evaluatePixel(s) {
  var bad = (s.dataMask == 0 || s.SCL == 1 || s.SCL == 3 || s.SCL == 8 || s.SCL == 9 || s.SCL == 10) ? 1 : 0;
  return [s.B04, s.B08, bad];
}
"""

    def __init__(self, client_id: str, client_secret: str, token_url: str, process_url: str,
                 session: requests.Session | None = None, timeout: int = 120, resolution_m: int = 10):
        self.client_id = client_id
        self.client_secret = client_secret
        self.token_url = token_url
        self.process_url = process_url
        self.session = session or requests.Session()
        self.timeout = timeout
        self.resolution_m = resolution_m

    def _get_token(self) -> str:
        try:
            resp = self.session.post(
                self.token_url,
                data={"grant_type": "client_credentials", "client_id": self.client_id,
                      "client_secret": self.client_secret},
                timeout=self.timeout,
            )
        except requests.RequestException as exc:
            raise ImageryUnavailableError(f"Could not reach the Copernicus login server: {exc}") from exc
        if resp.status_code != 200:
            raise ImageryUnavailableError(f"Copernicus login failed (HTTP {resp.status_code}) - check client id/secret")
        return resp.json()["access_token"]

    def _grid_size(self, bbox: dict) -> tuple[int, int]:
        lat_mid = (bbox["min_lat"] + bbox["max_lat"]) / 2
        width_m = (bbox["max_lng"] - bbox["min_lng"]) * 111_320 * math.cos(math.radians(lat_mid))
        height_m = (bbox["max_lat"] - bbox["min_lat"]) * 111_320
        width = min(2500, max(3, round(width_m / self.resolution_m)))
        height = min(2500, max(3, round(height_m / self.resolution_m)))
        return width, height

    def fetch_least_cloudy_tile(self, request: TileRequest) -> TileResult:
        token = self._get_token()
        bbox = request.bbox
        width, height = self._grid_size(bbox)
        payload = {
            "input": {
                "bounds": {
                    "bbox": [bbox["min_lng"], bbox["min_lat"], bbox["max_lng"], bbox["max_lat"]],
                    "properties": {"crs": "http://www.opengis.net/def/crs/EPSG/0/4326"},
                },
                "data": [{
                    "type": "sentinel-2-l2a",
                    "dataFilter": {
                        "timeRange": {"from": f"{request.start.isoformat()}T00:00:00Z",
                                      "to": f"{request.end.isoformat()}T23:59:59Z"},
                        "maxCloudCoverage": request.max_cloud_pct,
                        "mosaickingOrder": "leastCC",
                    },
                }],
            },
            "output": {"width": width, "height": height,
                       "responses": [{"identifier": "default", "format": {"type": "image/tiff"}}]},
            "evalscript": self.EVALSCRIPT,
        }
        try:
            resp = self.session.post(
                self.process_url, json=payload,
                headers={"Authorization": f"Bearer {token}", "Accept": "image/tiff"},
                timeout=self.timeout,
            )
        except requests.RequestException as exc:
            raise ImageryUnavailableError(f"Could not reach the Copernicus imagery server: {exc}") from exc
        if resp.status_code != 200:
            raise ImageryUnavailableError(f"Copernicus imagery request failed (HTTP {resp.status_code})")

        try:
            with MemoryFile(resp.content) as mem, mem.open() as ds:
                data = ds.read()
        except Exception as exc:  # rasterio raises several error types for bad files
            raise ImageryUnavailableError(f"Copernicus returned an unreadable image: {exc}") from exc
        if data.shape[0] < 3:
            raise ImageryUnavailableError("Copernicus image has fewer than 3 bands")

        return TileResult(
            red=data[0], nir=data[1], cloud_mask=data[2] > 0.5,
            # The Process API does not report the scene date; the end of the search window is
            # used as the observation date (refine later with the Catalog API if needed).
            acquired_on=request.end,
            tile_source=f"S2L2A-leastCC-{request.start.isoformat()}_{request.end.isoformat()}",
        )


# --------------------------------------------------------------------------- factory
def get_imagery_provider() -> ImageryProvider:
    if settings.imagery_provider == "copernicus":
        if not settings.copernicus_client_id or not settings.copernicus_client_secret:
            raise ImageryUnavailableError(
                "IMAGERY_PROVIDER=copernicus but COPERNICUS_CLIENT_ID / COPERNICUS_CLIENT_SECRET are not set in .env"
            )
        return CopernicusClient(
            settings.copernicus_client_id, settings.copernicus_client_secret,
            settings.copernicus_token_url, settings.copernicus_process_url,
        )
    return StubImageryProvider(settings.stub_scenario)