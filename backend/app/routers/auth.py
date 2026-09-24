import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.models.enums import AccountStatus
from app.models.farmer import Farmer
from app.models.platform_account import PlatformAccount
from app.schemas.auth import FarmerRegisterRequest, TokenResponse
from app.schemas.farmer import FarmerOut

router = APIRouter(tags=["auth"])


@router.post("/farmers/register", response_model=FarmerOut, status_code=status.HTTP_201_CREATED)
def register_farmer(payload: FarmerRegisterRequest, db: Session = Depends(get_db)):
    existing = db.execute(select(Farmer).where(Farmer.phone_number == payload.phone_number)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Phone number already registered")
    farmer = Farmer(farmer_id=uuid.uuid4(), full_name=payload.full_name, phone_number=payload.phone_number,
                     county=payload.county, device_id=payload.device_id)
    db.add(farmer)
    db.commit()
    db.refresh(farmer)
    return farmer


@router.post("/auth/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    farmer = db.execute(select(Farmer).where(Farmer.phone_number == form_data.username)).scalar_one_or_none()
    if farmer:
        if farmer.account_status != AccountStatus.active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account is not active")
        token = create_access_token(subject=str(farmer.farmer_id), role="FARMER")
        return TokenResponse(access_token=token, role="FARMER")

    account = db.execute(select(PlatformAccount).where(PlatformAccount.username == form_data.username)).scalar_one_or_none()
    if not account or not verify_password(form_data.password, account.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if account.account_status != AccountStatus.active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account is not active")
    token = create_access_token(subject=str(account.account_id), role=account.role.value)
    return TokenResponse(access_token=token, role=account.role.value)