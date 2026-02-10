"""
OFD Providers API Endpoints
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel

from backend.database import get_db
from backend.dependencies import get_current_active_user
from backend.models import User


router = APIRouter(prefix="/api/ofd-providers", tags=["OFD Providers"])


class OFDProviderResponse(BaseModel):
    id: int
    name: str
    website: str | None = None
    support_phone: str | None = None
    support_email: str | None = None
    is_active: bool
    
    class Config:
        from_attributes = True


@router.get("", response_model=List[OFDProviderResponse], summary="List OFD providers")
async def list_ofd_providers(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Retrieve all active OFD providers"""
    from backend.models import OFDProvider
    providers = db.query(OFDProvider).order_by(OFDProvider.name).all()
    return [OFDProviderResponse.model_validate(p) for p in providers]
