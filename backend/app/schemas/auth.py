from pydantic import BaseModel, Field


class FarmerRegisterRequest(BaseModel):
    full_name: str
    phone_number: str = Field(..., examples=["+254712345678"])
    county: str
    device_id: str | None = None
    password: str = Field(min_length=6, max_length=128)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str