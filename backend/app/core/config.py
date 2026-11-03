from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg2://carbon:carbon@localhost:5432/carbon_wallet"
    jwt_secret_key: str = "change-me-in-.env"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 15
    expose_api_docs: bool = True
    refresh_expire_days: int = 30

    # --- Sprint 3: satellite imagery + NDVI verification ---
    imagery_provider: str = "stub"          # "stub" (development) or "copernicus" (real imagery)
    stub_scenario: str = "healthy"          # stub only: "healthy" or "degrading"
    copernicus_client_id: str = ""
    copernicus_client_secret: str = ""
    copernicus_token_url: str = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
    copernicus_process_url: str = "https://sh.dataspace.copernicus.eu/api/v1/process"

    ndvi_drop_threshold: float = 0.15               # FR-11: drop beyond this counts as a decline
    ndvi_consecutive_scans_required: int = 2        # FR-14: decline must be confirmed over this many scans
    ndvi_cloud_cover_threshold_pct: float = 30.0    # scans cloudier than this are discarded
    ndvi_search_window_days: int = 14               # FR-07: two-week window for the least-cloudy tile
    tokens_cycles_per_year: int = 6                 # bi-monthly verification -> 6 cycles per year


settings = Settings()