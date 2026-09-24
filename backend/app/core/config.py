from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg2://carbon:carbon@localhost:5432/carbon_wallet"
    jwt_secret_key: str = "change-me-in-.env"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60
    copernicus_client_id: str = ""
    copernicus_client_secret: str = ""
    ndvi_drop_threshold: float = 0.15
    ndvi_consecutive_scans_required: int = 2
    expose_api_docs: bool = True


settings = Settings()