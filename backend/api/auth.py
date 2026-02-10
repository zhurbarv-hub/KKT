"""
Authentication API Endpoints for KKT Services Expiration Management System
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from backend.database import get_db
from backend.models import User
from backend.schemas import LoginRequest, Token, MessageResponse
from backend.utils.security import (
    verify_password,
    create_access_token,
    create_user_token_data,
    get_token_expiration_seconds
)
from backend.dependencies import get_current_user


router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/login", response_model=Token, summary="User Login")
async def login(
    credentials: LoginRequest,
    db: Session = Depends(get_db)
):
    """Authenticate user and obtain JWT access token"""
    
    # Try to find user by exact email match first
    user = db.query(User).filter(User.email == credentials.email).first()
    
    # If not found, try to match by username part (before @)
    if not user and '@' not in credentials.email:
        user = db.query(User).filter(
            User.email.ilike(f"{credentials.email}@%")
        ).first()
    
    # Check if user exists
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verify password
    if not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Аккаунт деактивирован"
        )
    
    # Create token data
    token_data = create_user_token_data(
        user_id=user.id,
        email=user.email,
        role=user.role
    )
    
    # Generate JWT token
    access_token = create_access_token(data=token_data)
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=get_token_expiration_seconds()
    )


@router.post("/logout", response_model=MessageResponse, summary="User Logout")
async def logout(current_user: User = Depends(get_current_user)):
    """Logout current user"""
    return MessageResponse(message=f"User {current_user.email} logged out successfully")


@router.get("/me", response_model=dict, summary="Get Current User Info")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get information about currently authenticated user"""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None
    }
