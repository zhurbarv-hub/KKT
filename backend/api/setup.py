"""
First-run setup endpoint + public system settings.
Creates the initial admin account when the system has no users.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from backend.database import get_db
from backend.models import User, SystemSettings
from backend.utils.security import get_password_hash

router = APIRouter(prefix="/api/setup", tags=["Setup"])


class SetupStatus(BaseModel):
    needs_setup: bool


class SetupRequest(BaseModel):
    email: EmailStr = Field(..., description="Email администратора")
    password: str = Field(..., min_length=6, description="Пароль (минимум 6 символов)")
    full_name: str = Field(..., min_length=2, description="ФИО администратора")
    company_name: Optional[str] = Field(None, min_length=1, max_length=100, description="Название компании")


class SetupResponse(BaseModel):
    message: str
    email: str


class PublicSettings(BaseModel):
    company_name: str


@router.get("/status", response_model=SetupStatus, summary="Check if initial setup is needed")
async def get_setup_status(db: Session = Depends(get_db)):
    """Returns whether the system needs initial setup (no users exist)."""
    user_count = db.query(User).count()
    return SetupStatus(needs_setup=user_count == 0)


@router.get("/settings", response_model=PublicSettings, summary="Get public system settings")
async def get_public_settings(db: Session = Depends(get_db)):
    """Returns public settings (company name). No auth required."""
    row = db.query(SystemSettings).filter(SystemSettings.key == "company_name").first()
    return PublicSettings(company_name=row.value if row else "KKT System")


@router.post("", response_model=SetupResponse, summary="Create first admin account")
async def create_first_admin(request: SetupRequest, db: Session = Depends(get_db)):
    """
    Creates the first admin account. Only works when the database has no users.
    After the first admin is created, this endpoint returns 403.
    """
    user_count = db.query(User).count()
    if user_count > 0:
        raise HTTPException(
            status_code=403,
            detail="Система уже настроена. Используйте /login для входа."
        )

    # Check email uniqueness (safety)
    existing = db.query(User).filter(User.email == request.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email уже используется")

    admin = User(
        username=request.email.split("@")[0],
        email=request.email,
        password_hash=get_password_hash(request.password),
        full_name=request.full_name,
        role="admin",
        is_active=True,
    )
    db.add(admin)

    # Save company name
    if request.company_name:
        setting = SystemSettings(key="company_name", value=request.company_name)
        db.add(setting)

    db.commit()

    return SetupResponse(
        message="Администратор создан. Войдите в систему.",
        email=request.email,
    )
