import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import TokenPayload, require_role
from app.models.carbon_token import CarbonToken
from app.models.enums import EntryType, TokenStatus
from app.models.ledger_entry import LedgerEntry
from app.schemas.ledger import LedgerEntryOut
from app.schemas.token import CarbonTokenOut, PurchaseRequest

router = APIRouter(tags=["tokens"])


@router.get("/tokens/available", response_model=list[CarbonTokenOut])
def view_available_tokens(db: Session = Depends(get_db), current: TokenPayload = Depends(require_role("BUYER"))):
    return db.execute(select(CarbonToken).where(CarbonToken.status == TokenStatus.issued)).scalars().all()


@router.post("/tokens/purchase-requests", response_model=LedgerEntryOut, status_code=status.HTTP_201_CREATED)
def purchase_tokens(payload: PurchaseRequest, db: Session = Depends(get_db),
                     current: TokenPayload = Depends(require_role("BUYER"))):
    token = db.get(CarbonToken, payload.token_id)
    if not token or token.status != TokenStatus.issued:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Token not available for purchase")
    if payload.quantity_kg_co2 != token.quantity_kg_co2:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Tokens are sold whole: quantity must equal {token.quantity_kg_co2} kg",
        )
    token.status = TokenStatus.purchased
    entry = LedgerEntry(entry_id=uuid.uuid4(), token_id=token.token_id, farmer_id=token.plot.farmer_id,
                         buyer_account_id=uuid.UUID(current.sub), entry_type=EntryType.purchase, amount=payload.quantity_kg_co2)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/buyers/{account_id}/purchases", response_model=list[LedgerEntryOut])
def view_purchase_history(account_id: uuid.UUID, db: Session = Depends(get_db),
                           current: TokenPayload = Depends(require_role("BUYER"))):
    if str(account_id) != current.sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    entries = db.execute(select(LedgerEntry).where(LedgerEntry.buyer_account_id == account_id,
                          LedgerEntry.entry_type == EntryType.purchase).order_by(LedgerEntry.timestamp.desc())).scalars().all()
    return entries