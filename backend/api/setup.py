"""
First-run setup endpoint.
Creates the initial admin account when the system has no users.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, EmailStr
from backend.database import get_db
from backend.models import User
from backend.utils.security import get_password_hash

router = APIRouter(prefix="/api/setup", tags=["Setup"])


class SetupStatus(BaseModel):
    needs_setup: bool


class SetupRequest(BaseModel):
    email: EmailStr = Field(..., description="Email администратора")
    password: str = Field(..., min_length=6, description="Пароль (минимум 6 символов)")
    full_name: str = Field(..., min_length=2, description="ФИО администратора")


class SetupResponse(BaseModel):
    message: str
    email: str


@router.get("/status", response_model=SetupStatus, summary="Check if initial setup is needed")
async def get_setup_status(db: Session = Depends(get_db)):
    """Returns whether the system needs initial setup (no users exist)."""
    user_count = db.query(User).count()
    return SetupStatus(needs_setup=user_count == 0)


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
    db.commit()

    return SetupResponse(
        message="Администратор создан. Войдите в систему.",
        email=request.email,
    )
