import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

from app.core.config import settings


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

Role = Literal["FARMER", "BUYER", "ADMIN"]


class TokenPayload(BaseModel):
    sub: str
    role: Role


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(subject: str, role: Role) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": subject, "role": role, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> TokenPayload:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        return TokenPayload(sub=payload["sub"], role=payload["role"])
    except (JWTError, KeyError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def get_current_token(token: str = Depends(oauth2_scheme)) -> TokenPayload:
    return decode_access_token(token)


def require_role(*allowed_roles: Role):
    def dependency(payload: TokenPayload = Depends(get_current_token)) -> TokenPayload:
        if payload.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{payload.role}' is not permitted to access this resource",
            )
        return payload
    return dependency

def new_refresh_token() -> tuple[str, str]:
    """Returns (plain_token, sha256_hash). Only the hash is stored."""
    plain = secrets.token_urlsafe(48)
    return plain, hash_refresh_token(plain)


def hash_refresh_token(plain: str) -> str:
    return hashlib.sha256(plain.encode()).hexdigest()