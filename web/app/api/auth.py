# -*- coding: utf-8 -*-
"""
API endpoints для аутентификации и активации пользователей
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

# ОТНОСИТЕЛЬНЫЕ ИМПОРТЫ
from ..models.schemas import LoginRequest, TokenResponse, UserInfo, MessageResponse
from ..models.user_schemas import (
    ActivationTokenValidate,
    ActivationTokenResponse,
    SetPasswordRequest,
    PasswordResetRequest,
    PasswordResetConfirm
)
from ..models.user import User, WebUser
from ..services.auth_service import authenticate_user, create_access_token, decode_token, get_password_hash
from ..services.email_service import EmailService
from ..dependencies import get_db
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
email_service = EmailService()


@router.post("/login", response_model=TokenResponse)
async def login(
    credentials: LoginRequest,
    db: Session = Depends(get_db)
):
    """Вход в систему"""
    user = authenticate_user(db, credentials.username, credentials.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверное имя пользователя или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Обновить время последнего входа
    user.last_login = datetime.now()
    db.commit()
    
    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "username": user.username,
            "role": user.role
        }
    )
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserInfo(
            id=user.id,
            username=user.username,
            email=user.email,
            full_name=user.full_name,
            role=user.role
        )
    )


@router.post("/validate-activation-token", response_model=ActivationTokenResponse)
async def validate_activation_token(
    request: ActivationTokenValidate,
    db: Session = Depends(get_db)
):
    """
    Валидация токена активации из email-приглашения
    """
    # Декодирование токена
    payload = decode_token(request.token)
    
    if not payload:
        return ActivationTokenResponse(
            valid=False,
            message="Неверный или истёкший токен"
        )
    
    # Проверка типа токена
    if payload.get("type") != "activation":
        return ActivationTokenResponse(
            valid=False,
            message="Неверный тип токена"
        )
    
    # Поиск пользователя
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first()
    
    if not user:
        return ActivationTokenResponse(
            valid=False,
            message="Пользователь не найден"
        )
    
    # Проверка - уже активирован?
    if user.password_hash:
        return ActivationTokenResponse(
            valid=False,
            message="Пользователь уже активирован"
        )
    
    return ActivationTokenResponse(
        valid=True,
        email=user.email,
        full_name=user.full_name,
        company_name=user.company_name,
        message="Токен действителен"
    )


@router.post("/set-password", response_model=MessageResponse)
async def set_password(
    request: SetPasswordRequest,
    db: Session = Depends(get_db)
):
    """
    Установка пароля при активации аккаунта
    """
    # Декодирование токена
    payload = decode_token(request.token)
    
    if not payload or payload.get("type") != "activation":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный или истёкший токен"
        )
    
    # Поиск пользователя
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )
    
    # Проверка - уже активирован?
    if user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь уже активирован"
        )
    
    # Установка пароля
    user.password_hash = get_password_hash(request.password)
    user.is_active = True
    user.registered_at = datetime.now()
    db.commit()
    
    return MessageResponse(
        message=f"Пароль успешно установлен. Добро пожаловать, {user.full_name}!"
    )


@router.post("/request-password-reset", response_model=MessageResponse)
async def request_password_reset(
    request: PasswordResetRequest,
    db: Session = Depends(get_db)
):
    """
    Запрос на сброс пароля
    """
    # Поиск пользователя
    user = db.query(User).filter(User.email == request.email).first()
    
    if not user:
        # Не раскрываем, есть ли пользователь с таким email
        return MessageResponse(
            message="Если такой email зарегистрирован, вам придёт письмо со ссылкой для сброса пароля"
        )
    
    # Создание токена сброса пароля (1 час)
    reset_token = create_access_token(
        data={
            "sub": str(user.id),
            "email": user.email,
            "type": "password_reset"
        },
        expires_delta=timedelta(hours=1)
    )
    
    # Отправка email
    email_sent = email_service.send_password_reset_email(
        to_email=user.email,
        full_name=user.full_name,
        reset_token=reset_token
    )
    
    if not email_sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось отправить email"
        )
    
    return MessageResponse(
        message="Письмо для сброса пароля отправлено на " + request.email
    )


@router.post("/confirm-password-reset", response_model=MessageResponse)
async def confirm_password_reset(
    request: PasswordResetConfirm,
    db: Session = Depends(get_db)
):
    """
    Подтверждение сброса пароля
    """
    # Декодирование токена
    payload = decode_token(request.token)
    
    if not payload or payload.get("type") != "password_reset":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный или истёкший токен"
        )
    
    # Поиск пользователя
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )
    
    # Установка нового пароля
    user.password_hash = get_password_hash(request.new_password)
    db.commit()
    
    return MessageResponse(
        message="Пароль успешно изменён"

    )


from fastapi import Request

@router.get("/me")
async def get_me(
    request: Request,
    db: Session = Depends(get_db)
):
    """Получить информацию о текущем пользователе"""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header.split(" ")[1]
    payload = decode_token(token)
    
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role
    }
