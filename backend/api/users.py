"""
User Management API Endpoints for KKT Services Expiration Management System

This module provides CRUD operations for unified user management (clients, managers, admins):
- GET /api/users - List users with pagination, search, and role filtering
- GET /api/users/{id} - Get single user with details
- POST /api/users - Create new user (client, manager, or admin)
- PUT /api/users/{id} - Update existing user
- DELETE /api/users/{id} - Soft delete user (deactivate)
- POST /api/users/{id}/generate-code - Generate Telegram registration code
- POST /api/users/register-telegram - Register user via Telegram code

Unified User Roles:
- 'client': Organization clients (have inn, company_name, can use Telegram)
- 'manager': Support team members with limited admin rights
- 'admin': Full system administrators
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import List, Optional
from datetime import datetime, timedelta
import secrets
import string

from backend.database import get_db
from backend.models import User, Deadline
from backend.schemas import (
    UserCreate,
    UserUpdate,
    UserResponse,
    UserWithDetails,
    UserListResponse,
    MessageResponse,
    DeadlineResponse
)
from backend.dependencies import (
    get_current_active_user,
    get_pagination_params,
    PaginationParams
)
from backend.utils.security import get_password_hash


# Create API router
router = APIRouter(prefix="/api/users", tags=["Users"])


# ============================================
# Helper Functions
# ============================================

def generate_registration_code(length: int = 8) -> str:
    """
    Generate random registration code for Telegram linking
    
    Args:
        length: Code length (default 8 characters)
        
    Returns:
        Random alphanumeric code (uppercase)
    """
    alphabet = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def generate_username(db: Session, role: str, email: str, inn: str = None) -> str:
    """
    Generate unique username for new user.
    For clients: client_{inn} or client_{email_prefix}
    For managers/admins: email prefix
    """
    if role == 'client' and inn:
        base = f"client_{inn}"
    else:
        base = email.split('@')[0] if email else 'user'
    
    username = base
    counter = 1
    while db.query(User).filter(User.username == username).first():
        username = f"{base}_{counter}"
        counter += 1
    return username


# ============================================
# User CRUD Endpoints
# ============================================

@router.get("", response_model=UserListResponse, summary="Список пользователей")
async def list_users(
    pagination: PaginationParams = Depends(get_pagination_params),
    role: Optional[str] = None,
    search: Optional[str] = None,
    active_only: bool = True,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Получить список пользователей с пагинацией и фильтрацией
    
    **Параметры запроса:**
    - page: Номер страницы (по умолчанию: 1)
    - limit: Элементов на странице (по умолчанию: 50, макс: 100)
    - role: Фильтр по роли (client, manager, admin)
    - search: Поиск по имени, email, ИНН, названию организации
    - active_only: Только активные пользователи (по умолчанию: true)
    
    **Ответ:**
    - total: Общее количество пользователей
    - page: Текущая страница
    - limit: Элементов на странице
    - users: Массив объектов пользователей
    
    **Авторизация:**
    Требуется валидный JWT токен
    """
    # Build base query
    query = db.query(User)
    
    # Apply role filter
    if role:
        if role not in ['client', 'manager', 'admin']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Role must be one of: client, manager, admin"
            )
        query = query.filter(User.role == role)
    
    # Apply active filter
    if active_only:
        query = query.filter(User.is_active == True)
    
    # Apply search filter
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                User.full_name.ilike(search_term),
                User.email.ilike(search_term),
                User.inn.ilike(search_term),
                User.company_name.ilike(search_term)
            )
        )
    
    # Get total count before pagination
    total = query.count()
    
    # Apply pagination and ordering
    users = query.order_by(User.created_at.desc())\
                 .offset(pagination.offset)\
                 .limit(pagination.limit)\
                 .all()
    
    # Convert to response schema
    user_responses = [UserResponse.model_validate(user) for user in users]
    
    return UserListResponse(
        total=total,
        page=pagination.page,
        limit=pagination.limit,
        users=user_responses
    )


@router.get("/{user_id}", response_model=UserWithDetails, summary="Получить пользователя по ID")
async def get_user(
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Получить данные пользователя с полной информацией, включая дедлайны
    
    **Параметры пути:**
    - user_id: ID пользователя
    
    **Ответ:**
    - Объект пользователя с вложенными данными:
      - deadlines: Массив активных дедлайнов (только для клиентов)
    
    **Ошибки:**
    - 404 Not Found: Пользователь не найден
    
    **Авторизация:**
    Требуется валидный JWT токен
    """
    # Query user
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Пользователь с ID {user_id} не найден"
        )
    
    # Convert to response with details
    user_dict = user.to_dict()
    
    # Add deadlines with calculated fields (only for clients)
    deadlines = []
    if user.is_client:
        for deadline in user.deadlines:
            deadline_dict = deadline.to_dict()
            deadline_dict['days_until_expiration'] = deadline.days_until_expiration
            deadline_dict['status_color'] = deadline.status_color
            deadline_dict['user_name'] = user.display_name
            deadline_dict['company_name'] = user.company_name
            deadline_dict['deadline_type_name'] = deadline.deadline_type.type_name if deadline.deadline_type else None
            deadlines.append(DeadlineResponse(**deadline_dict))
    
    user_dict['deadlines'] = deadlines
    
    return UserWithDetails(**user_dict)


@router.post("", response_model=MessageResponse, status_code=status.HTTP_201_CREATED, summary="Создать пользователя")
async def create_user(
    user_data: UserCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Создать нового пользователя (клиента, менеджера или администратора)
    
    **Тело запроса:**
    - email: Email адрес (обязательно, уникальный)
    - full_name: Полное имя (обязательно)
    - role: Роль (client/manager/admin, по умолчанию: client)
    - password: Пароль (обязательно для manager/admin, опционально для client)
    - inn: ИНН (обязательно для client, 10 или 12 цифр)
    - company_name: Название организации (для client)
    - phone: Телефон (формат: +7XXXXXXXXXX)
    - address: Адрес
    - notes: Примечания
    - notification_days: Дни уведомлений (формат: "30,14,7,3")
    - notifications_enabled: Включены ли уведомления
    
    **Валидация:**
    - Email должен быть уникальным
    - ИНН должен быть уникальным и ровно 10 или 12 цифр (для клиентов)
    - Телефон в формате +7XXXXXXXXXX
    - Пароль обязателен для manager/admin
    
    **Ответ:**
    - message: Сообщение об успехе
    - id: ID нового пользователя
    
    **Ошибки:**
    - 400 Bad Request: Ошибки валидации
    - 409 Conflict: Email или ИНН уже существует
    
    **Авторизация:**
    Требуется валидный JWT токен
    """
    # Check for duplicate email
    existing_email = db.query(User).filter(User.email == user_data.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Пользователь с email {user_data.email} уже существует"
        )
    
    # Check for duplicate INN (only for clients)
    if user_data.role == 'client' and user_data.inn:
        existing_inn = db.query(User).filter(User.inn == user_data.inn).first()
        if existing_inn:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Клиент с ИНН {user_data.inn} уже существует"
            )
    
    # Hash password if provided
    password_hash = None
    if user_data.password:
        password_hash = get_password_hash(user_data.password)
    
    # Generate unique username
    username = generate_username(db, user_data.role, user_data.email, user_data.inn)
    
    # Create new user
    user_dict = user_data.model_dump(exclude={'password'})
    new_user = User(**user_dict, password_hash=password_hash, username=username)
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return MessageResponse(
        message=f"Пользователь '{new_user.full_name}' успешно создан",
        id=new_user.id
    )


@router.put("/{user_id}", response_model=MessageResponse, summary="Обновить пользователя")
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Обновить данные существующего пользователя
    
    **Параметры пути:**
    - user_id: ID пользователя для обновления
    
    **Тело запроса:**
    Все поля опциональны:
    - email: Email адрес (должен быть уникальным)
    - full_name: Полное имя
    - role: Роль (client/manager/admin)
    - password: Новый пароль (будет захеширован)
    - inn: ИНН (должен быть уникальным для клиентов)
    - company_name: Название организации
    - phone: Телефон
    - address: Адрес
    - notes: Примечания
    - notification_days: Дни уведомлений
    - notifications_enabled: Включены ли уведомления
    - is_active: Статус активности
    
    **Ответ:**
    - message: Сообщение об успехе
    - id: ID обновлённого пользователя
    
    **Ошибки:**
    - 404 Not Found: Пользователь не найден
    - 409 Conflict: Email или ИНН уже существует
    
    **Авторизация:**
    Требуется валидный JWT токен
    """
    # Fetch existing user
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Пользователь с ID {user_id} не найден"
        )
    
    # Prepare update data (exclude unset fields)
    update_data = user_data.model_dump(exclude_unset=True, exclude={'password'})
    
    # Check for duplicate email if being changed
    if 'email' in update_data and update_data['email'] != user.email:
        existing_email = db.query(User).filter(
            User.email == update_data['email'],
            User.id != user_id
        ).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Пользователь с email {update_data['email']} уже существует"
            )
    
    # Check for duplicate INN if being changed
    if 'inn' in update_data and update_data['inn'] and update_data['inn'] != user.inn:
        existing_inn = db.query(User).filter(
            User.inn == update_data['inn'],
            User.id != user_id
        ).first()
        if existing_inn:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Клиент с ИНН {update_data['inn']} уже существует"
            )
    
    # Hash new password if provided
    if user_data.password:
        update_data['password_hash'] = get_password_hash(user_data.password)
    
    # Update user fields
    for field, value in update_data.items():
        setattr(user, field, value)
    
    db.commit()
    db.refresh(user)
    
    return MessageResponse(
        message=f"Пользователь '{user.full_name}' успешно обновлён",
        id=user.id
    )


@router.delete("/{user_id}", response_model=MessageResponse, summary="Удалить пользователя")
async def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Мягкое удаление пользователя (установка is_active = False)
    
    **Параметры пути:**
    - user_id: ID пользователя для удаления
    
    **Поведение:**
    - Устанавливает is_active = False (мягкое удаление)
    - Сохраняет все данные для аудита
    - Связанные дедлайны остаются в базе данных
    - Пользователь исключается из активных запросов
    
    **Ответ:**
    - message: Сообщение об успехе
    
    **Ошибки:**
    - 404 Not Found: Пользователь не найден
    
    **Примечание:**
    Для жёсткого удаления с каскадным удалением дедлайнов
    администратор может использовать инструменты базы данных напрямую
    
    **Авторизация:**
    Требуется валидный JWT токен
    """
    # Fetch user
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Пользователь с ID {user_id} не найден"
        )
    
    # Soft delete
    user.is_active = False
    
    db.commit()
    
    return MessageResponse(
        message=f"Пользователь '{user.display_name}' успешно деактивирован"
    )


# ============================================
# Telegram Integration Endpoints
# ============================================

@router.post("/{user_id}/generate-code", response_model=MessageResponse, summary="Генерировать код регистрации")
async def generate_telegram_code(
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Генерация кода регистрации для привязки Telegram аккаунта
    
    **Параметры пути:**
    - user_id: ID пользователя (клиента)
    
    **Поведение:**
    - Генерирует уникальный 8-символьный код
    - Устанавливает срок действия 24 часа
    - Код можно использовать в Telegram боте для привязки аккаунта
    
    **Ответ:**
    - message: Код регистрации
    - id: ID пользователя
    
    **Ошибки:**
    - 404 Not Found: Пользователь не найден
    - 400 Bad Request: Пользователь не является клиентом
    - 400 Bad Request: Telegram уже привязан
    
    **Авторизация:**
    Требуется валидный JWT токен
    """
    # Fetch user
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Пользователь с ID {user_id} не найден"
        )
    
    # Check if user is client
    if not user.is_client:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Только клиенты могут привязывать Telegram аккаунт"
        )
    
    # Check if already linked
    if user.telegram_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Telegram уже привязан к этому пользователю (@{user.telegram_username})"
        )
    
    # Generate unique code
    code = generate_registration_code()
    
    # Check for duplicates (very unlikely, but just in case)
    while db.query(User).filter(User.registration_code == code).first():
        code = generate_registration_code()
    
    # Update user
    user.registration_code = code
    user.code_expires_at = datetime.utcnow() + timedelta(hours=24)
    
    db.commit()
    db.refresh(user)
    
    return MessageResponse(
        message=f"Код регистрации: {code} (действителен 24 часа)",
        id=user.id
    )


# ============================================
# Testing
# ============================================

if __name__ == "__main__":
    print("=" * 60)
    print("МОДУЛЬ УПРАВЛЕНИЯ ПОЛЬЗОВАТЕЛЯМИ (УНИФИЦИРОВАННЫЙ)")
    print("=" * 60)
    
    print("\nДоступные эндпоинты:")
    print("  • GET /api/users - Список пользователей с фильтрацией по роли")
    print("  • GET /api/users/{id} - Получить пользователя с деталями")
    print("  • POST /api/users - Создать нового пользователя")
    print("  • PUT /api/users/{id} - Обновить пользователя")
    print("  • DELETE /api/users/{id} - Удалить пользователя (soft delete)")
    print("  • POST /api/users/{id}/generate-code - Генерация кода для Telegram")
    
    print("\n" + "=" * 60)
    print("✅ МОДУЛЬ ГОТОВ К ИСПОЛЬЗОВАНИЮ")
    print("=" * 60)
