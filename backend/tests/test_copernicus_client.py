"""The real client is tested against a FAKE server: the token call and the imagery call are mocked,
but the GeoTIFF is a genuine file parsed by rasterio - so the parsing code is really exercised."""
from datetime import date

import numpy as np
import pytest
import rasterio
from rasterio.io import MemoryFile
from rasterio.transform import from_bounds

from app.services.imagery import CopernicusClient, ImageryUnavailableError, TileRequest

BBOX = {"min_lat": -1.0005, "max_lat": -0.9995, "min_lng": 36.9995, "max_lng": 37.0005}


def _geotiff_bytes(red=0.1, nir=0.5, bad_cols=0, size=6):
    data = np.zeros((3, size, size), dtype="float32")
    data[0], data[1] = red, nir
    data[2][:, :bad_cols] = 1.0
    profile = dict(driver="GTiff", height=size, width=size, count=3, dtype="float32",
                   crs="EPSG:4326", transform=from_bounds(36.9995, -1.0005, 37.0005, -0.9995, size, size))
    with MemoryFile() as mem:
        with mem.open(**profile) as ds:
            ds.write(data)
        return mem.read()


class FakeResponse:
    def __init__(self, status=200, json_body=None, content=b""):
        self.status_code, self._json, self.content = status, json_body, content

    def json(self):
        return self._json


class FakeSession:
    def __init__(self, token_resp, imagery_resp):
        self.token_resp, self.imagery_resp, self.calls = token_resp, imagery_resp, []

    def post(self, url, **kwargs):
        self.calls.append((url, kwargs))
        return self.token_resp if "token" in url else self.imagery_resp


def _client(session):
    return CopernicusClient("id", "secret", "https://x/token", "https://x/process", session=session)


REQUEST = TileRequest(bbox=BBOX, start=date(2026, 1, 1), end=date(2026, 1, 14), max_cloud_pct=30.0)


def test_successful_fetch_parses_bands_and_cloud_mask():
    session = FakeSession(FakeResponse(json_body={"access_token": "abc"}),
                          FakeResponse(content=_geotiff_bytes(bad_cols=2)))
    tile = _client(session).fetch_least_cloudy_tile(REQUEST)
    assert tile.red.shape == (6, 6)
    assert float(tile.red[0, 0]) == pytest.approx(0.1) and float(tile.nir[0, 0]) == pytest.approx(0.5)
    assert tile.cloud_mask[:, :2].all() and not tile.cloud_mask[:, 2:].any()
    # request was built correctly
    url, kwargs = session.calls[1]
    assert kwargs["headers"]["Authorization"] == "Bearer abc"
    data_filter = kwargs["json"]["input"]["data"][0]["dataFilter"]
    assert data_filter["mosaickingOrder"] == "leastCC" and data_filter["maxCloudCoverage"] == 30.0
    assert kwargs["json"]["input"]["bounds"]["bbox"] == [36.9995, -1.0005, 37.0005, -0.9995]


def test_bad_credentials_raise_clear_error():
    session = FakeSession(FakeResponse(status=401), FakeResponse())
    with pytest.raises(ImageryUnavailableError, match="login failed"):
        _client(session).fetch_least_cloudy_tile(REQUEST)


def test_imagery_http_error_raises():
    session = FakeSession(FakeResponse(json_body={"access_token": "abc"}), FakeResponse(status=500))
    with pytest.raises(ImageryUnavailableError, match="HTTP 500"):
        _client(session).fetch_least_cloudy_tile(REQUEST)


def test_garbage_image_raises():
    session = FakeSession(FakeResponse(json_body={"access_token": "abc"}), FakeResponse(content=b"not a tiff"))
    with pytest.raises(ImageryUnavailableError, match="unreadable"):
        _client(session).fetch_least_cloudy_tile(REQUEST)