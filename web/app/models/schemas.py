# -*- coding: utf-8 -*-
"""
Pydantic схемы для валидации запросов и ответов
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class LoginRequest(BaseModel):
    """Схема запроса на вход"""
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)


class UserInfo(BaseModel):
    """Информация о пользователе"""
    id: int
    username: str
    email: str
    full_name: Optional[str] = None
    role: str
    
    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    """Ответ с токеном доступа"""
    access_token: str
    token_type: str = "bearer"
    user: UserInfo


class UserCreate(BaseModel):
    """Схема для создания пользователя"""
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    email: str = Field(...)
    full_name: Optional[str] = None
    role: str = Field(default="manager", pattern="^(admin|manager)$")
    is_active: bool = True


class UserUpdate(BaseModel):
    """Схема для обновления пользователя"""
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    password: Optional[str] = Field(None, min_length=6)
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = Field(None, pattern="^(admin|manager)$")
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    """Схема ответа с данными пользователя"""
    id: int
    username: str
    email: str
    full_name: Optional[str] = None
    role: str
    is_active: bool
    
    class Config:
        from_attributes = True


class CodeGenerationResponse(BaseModel):
    """Ответ генерации кода регистрации"""
    code: str
    expires_at: datetime
    message: str


class MessageResponse(BaseModel):
    """Общий ответ с сообщением"""
    message: str
    id: Optional[int] = None