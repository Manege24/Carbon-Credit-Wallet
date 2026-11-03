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
from app.schemas.auth import FarmerRegisterRequest, TokenResponse, RefreshRequest
from app.schemas.farmer import FarmerOut

from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.core.security import hash_refresh_token, new_refresh_token
from app.models.refresh_token import RefreshToken


router = APIRouter(tags=["auth"])


@router.post("/farmers/register", response_model=FarmerOut, status_code=status.HTTP_201_CREATED)
def register_farmer(payload: FarmerRegisterRequest, db: Session = Depends(get_db)):
    existing = db.execute(select(Farmer).where(Farmer.phone_number == payload.phone_number)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Phone number already registered")
    farmer = Farmer(
        farmer_id=uuid.uuid4(),
        full_name=payload.full_name,
        phone_number=payload.phone_number,
        county=payload.county,
        device_id=payload.device_id,
        password_hash=hash_password(payload.password),
    )
    db.add(farmer)
    db.commit()
    db.refresh(farmer)
    return farmer

def _issue_refresh(db: Session, farmer_id) -> str:
    plain, hashed = new_refresh_token()
    db.add(RefreshToken(token_id=uuid.uuid4(), farmer_id=farmer_id, token_hash=hashed,
                        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_expire_days)))
    db.commit()
    return plain

@router.post("/auth/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    farmer = db.execute(select(Farmer).where(Farmer.phone_number == form_data.username)).scalar_one_or_none()
    if farmer:
        if not farmer.password_hash or not verify_password(form_data.password, farmer.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        if farmer.account_status != AccountStatus.active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account is not active")
        token = create_access_token(subject=str(farmer.farmer_id), role="FARMER")
        return TokenResponse(access_token=token, role="FARMER",
                             refresh_token=_issue_refresh(db, farmer.farmer_id))

    account = db.execute(select(PlatformAccount).where(PlatformAccount.username == form_data.username)).scalar_one_or_none()
    if not account or not verify_password(form_data.password, account.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if account.account_status != AccountStatus.active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account is not active")
    token = create_access_token(subject=str(account.account_id), role=account.role.value)
    return TokenResponse(access_token=token, role=account.role.value)

@router.post("/auth/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    row = db.execute(select(RefreshToken).where(
        RefreshToken.token_hash == hash_refresh_token(payload.refresh_token))).scalar_one_or_none()
    expires = row.expires_at if row else None
    if expires is not None and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)   # SQLite returns naive datetimes
    if (row is None or row.revoked or expires < datetime.now(timezone.utc)):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    farmer = db.get(Farmer, row.farmer_id)
    if farmer is None or farmer.account_status != AccountStatus.active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account is not active")
    row.revoked = True                       # rotation: one use only
    db.commit()
    token = create_access_token(subject=str(farmer.farmer_id), role="FARMER")
    return TokenResponse(access_token=token, role="FARMER",
                         refresh_token=_issue_refresh(db, farmer.farmer_id))


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(payload: RefreshRequest, db: Session = Depends(get_db)):
    row = db.execute(select(RefreshToken).where(
        RefreshToken.token_hash == hash_refresh_token(payload.refresh_token))).scalar_one_or_none()
    if row:
        row.revoked = True
        db.commit()