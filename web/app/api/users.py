# -*- coding: utf-8 -*-
"""
API endpoints для управления унифицированными пользователями
(клиенты, менеджеры, администраторы)
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional
from datetime import datetime, timedelta
import math
import secrets
import string

from ..dependencies import get_db
from ..models.user import User
from ..models.client import Deadline
from ..models.cash_register import CashRegister
from ..models.user_schemas import (
    UserCreateByAdmin,
    UserUpdate,
    UserResponse,
    UserListResponse,
    ResendInvitationRequest,
    InvitationResponse,
    TelegramRegistrationRequest,
    TelegramRegistrationResponse
)
from ..models.schemas import MessageResponse, CodeGenerationResponse
from ..services.auth_service import get_password_hash, decode_token, create_access_token
from ..services.email_service import EmailService
from ..services.env_manager import env_manager
from ..config import settings
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

router = APIRouter(prefix="/api/users", tags=["Users"])
security = HTTPBearer()
email_service = EmailService()


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Получение текущего пользователя из JWT токена"""
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный или истёкший токен",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


def check_admin_or_manager_role(current_user: dict = Depends(get_current_user)):
    """Проверка прав администратора или менеджера"""
    if current_user.get('role') not in ['admin', 'manager']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для управления пользователями"
        )
    return current_user


def check_admin_role(current_user: dict = Depends(get_current_user)):
    """Проверка прав администратора"""
    if current_user.get('role') != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только администратор может выполнять это действие"
        )
    return current_user


def generate_registration_code(length: int = 6) -> str:
    """Генерация уникального кода регистрации для Telegram"""
    chars = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(chars) for _ in range(length))


@router.get("", response_model=UserListResponse)
async def get_users(
    page: int = Query(1, ge=1, description="Номер страницы"),
    page_size: int = Query(50, ge=1, le=100, description="Количество записей на странице"),
    search: Optional[str] = Query(None, description="Поиск по email, названию, ИНН"),
    role: Optional[str] = Query(None, pattern="^(client|manager|admin)$", description="Фильтр по роли"),
    is_active: Optional[bool] = Query(None, description="Фильтр по активности"),
    has_password: Optional[bool] = Query(None, description="Фильтр по наличию пароля"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(check_admin_or_manager_role)
):
    """
    Получить список всех пользователей с пагинацией и фильтрами
    Доступно для администраторов и менеджеров
    """
    # Базовый запрос
    query = db.query(User)
    
    # Применение фильтров
    if role:
        query = query.filter(User.role == role)
    
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    
    if has_password is not None:
        if has_password:
            query = query.filter(User.password_hash.isnot(None))
        else:
            query = query.filter(User.password_hash.is_(None))
    
    # Поиск
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                User.email.ilike(search_pattern),
                User.full_name.ilike(search_pattern),
                User.company_name.ilike(search_pattern),
                User.inn.like(search_pattern)
            )
        )
    
    # Подсчёт общего количества
    total = query.count()
    
    # Пагинация
    offset = (page - 1) * page_size
    users = query.order_by(User.full_name).offset(offset).limit(page_size).all()
    
    # Добавление флага has_password
    users_with_flag = []
    for user in users:
        user_dict = UserResponse.model_validate(user).model_dump()
        user_dict['has_password'] = user.password_hash is not None
        users_with_flag.append(UserResponse(**user_dict))
    
    # Расчёт количества страниц
    total_pages = math.ceil(total / page_size) if total > 0 else 1
    
    return UserListResponse(
        total=total,
        users=users_with_flag,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(check_admin_or_manager_role)
):
    """
    Получить пользователя по ID
    """
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Пользователь с ID {user_id} не найден"
        )
    
    # Добавление флага has_password
    user_dict = UserResponse.model_validate(user).model_dump()
    user_dict['has_password'] = user.password_hash is not None
    return UserResponse(**user_dict)


@router.post("", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreateByAdmin,
    db: Session = Depends(get_db),
    current_user: dict = Depends(check_admin_or_manager_role)
):
    """
    Создать нового пользователя (доступно для администратора и менеджера)
    При создании клиента без пароля отправляется email-приглашение
    """
    # Проверка уникальности email
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Пользователь с email '{user_data.email}' уже существует"
        )
    
    # Проверка уникальности username
    existing_username = db.query(User).filter(User.username == user_data.username).first()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Пользователь с логином '{user_data.username}' уже существует"
        )
    
    # Проверка уникальности ИНН для клиентов
    if user_data.inn:
        existing_inn = db.query(User).filter(User.inn == user_data.inn).first()
        if existing_inn:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Пользователь с ИНН {user_data.inn} уже существует"
            )
    
    # Проверка уникальности Telegram ID
    if user_data.telegram_id:
        existing_telegram = db.query(User).filter(User.telegram_id == user_data.telegram_id).first()
        if existing_telegram:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Telegram ID {user_data.telegram_id} уже используется пользователем '{existing_telegram.full_name}' ({existing_telegram.username})"
            )
    
    # Подготовка данных для создания
    user_dict = user_data.model_dump(exclude={'password', 'send_invitation'})
    
    # Установка пароля если предоставлен
    if user_data.password:
        user_dict['password_hash'] = get_password_hash(user_data.password)
    else:
        user_dict['password_hash'] = None
    
    # Генерация кода регистрации для Telegram (только для клиентов)
    registration_code = None
    code_expires_at = None
    if user_data.role == 'client':
        # Генерируем уникальный код
        for _ in range(10):  # Максимум 10 попыток
            code = generate_registration_code()
            existing_code = db.query(User).filter(User.registration_code == code).first()
            if not existing_code:
                registration_code = code
                code_expires_at = datetime.now() + timedelta(hours=72)
                break
        
        if not registration_code:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось сгенерировать уникальный код регистрации"
            )
        
        user_dict['registration_code'] = registration_code
        user_dict['code_expires_at'] = code_expires_at
    
    # Создание пользователя
    new_user = User(**user_dict)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Если создаём администратора или менеджера с Telegram ID - добавляем в .env
    if user_data.role in ['admin', 'manager'] and user_data.telegram_id:
        try:
            success = env_manager.add_admin_telegram_id(user_data.telegram_id)
            if success:
                # Перезапускаем бота для применения изменений
                env_manager.restart_bot_service()
                print(f"✅ Telegram ID {user_data.telegram_id} добавлен в .env для пользователя {new_user.full_name}")
            else:
                print(f"⚠️  Не удалось добавить Telegram ID {user_data.telegram_id} в .env")
        except Exception as e:
            print(f"❌ Ошибка при добавлении Telegram ID в .env: {e}")
            # Не прерываем создание пользователя из-за ошибки .env
    
    # Отправка email-приглашения если не установлен пароль
    email_sent = False
    if user_data.send_invitation and not user_data.password:
        # Создание токена активации (действителен 48 часов)
        activation_token = create_access_token(
            data={
                "sub": str(new_user.id),
                "email": new_user.email,
                "type": "activation"
            },
            expires_delta=timedelta(hours=48)
        )
        
        # Отправка email
        email_sent = email_service.send_invitation_email(
            to_email=new_user.email,
            full_name=new_user.full_name,
            company_name=new_user.company_name or "",
            activation_token=activation_token,
            registration_code=registration_code,
            code_expires_at=code_expires_at
        )
    
    message = f"Пользователь '{new_user.full_name}' успешно создан"
    if email_sent:
        message += f". Приглашение отправлено на {new_user.email}"
    elif user_data.send_invitation and not user_data.password:
        message += ". Не удалось отправить email-приглашение"
    
    return MessageResponse(
        message=message,
        id=new_user.id
    )


@router.put("/{user_id}", response_model=MessageResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(check_admin_or_manager_role)
):
    """
    Обновить данные пользователя
    """
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Пользователь с ID {user_id} не найден"
        )
    
    # Обновление данных
    update_data = user_data.model_dump(exclude_unset=True)
    
    # Обработка смены пароля
    if 'password' in update_data and update_data['password']:
        update_data['password_hash'] = get_password_hash(update_data['password'])
        del update_data['password']
    
    # Проверка уникальности email при изменении
    if 'email' in update_data and update_data['email'] != user.email:
        existing = db.query(User).filter(
            User.email == update_data['email'],
            User.id != user_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Пользователь с email '{update_data['email']}' уже существует"
            )
    
    # Проверка уникальности ИНН при изменении
    if 'inn' in update_data and update_data['inn'] and update_data['inn'] != user.inn:
        existing = db.query(User).filter(
            User.inn == update_data['inn'],
            User.id != user_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Пользователь с ИНН {update_data['inn']} уже существует"
            )
    
    # Проверка уникальности Telegram ID при изменении
    if 'telegram_id' in update_data and update_data['telegram_id'] and update_data['telegram_id'] != user.telegram_id:
        existing = db.query(User).filter(
            User.telegram_id == update_data['telegram_id'],
            User.id != user_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Telegram ID {update_data['telegram_id']} уже используется пользователем '{existing.full_name}' ({existing.username})"
            )
    
    # Применение изменений
    for field, value in update_data.items():
        setattr(user, field, value)
    
    db.commit()
    db.refresh(user)
    
    return MessageResponse(
        message=f"Пользователь '{user.full_name}' успешно обновлён",
        id=user.id
    )


@router.patch("/{user_id}/toggle-status", response_model=MessageResponse)
async def toggle_user_status(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(check_admin_role)
):
    """
    Изменить статус активности пользователя (активировать/деактивировать)
    Только для администратора
    """
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Пользователь с ID {user_id} не найден"
        )
    
    # Запрет на изменение статуса самого себя
    if user.id == int(current_user.get('sub', 0)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя изменить статус своей учётной записи"
        )
    
    # Переключение статуса
    user.is_active = not user.is_active
    
    # Если деактивируем - ФИЗИЧЕСКИ УДАЛЯЕМ все дедлайны
    if not user.is_active:
        deadlines_to_delete = db.query(Deadline).filter(
            Deadline.client_id == user_id
        ).all()
        
        deleted_count = len(deadlines_to_delete)
        for deadline in deadlines_to_delete:
            db.delete(deadline)
        
        print(f"[ДЕАКТИВАЦИЯ КЛИЕНТА] Клиент ID={user_id}: физически удалено {deleted_count} дедлайнов")
    
    db.commit()
    
    status_text = "активирован" if user.is_active else "деактивирован"
    return MessageResponse(
        message=f"Пользователь '{user.full_name}' {status_text}"
    )


@router.delete("/{user_id}", response_model=MessageResponse)
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(check_admin_role)
):
    """
    Физически удалить пользователя (только для администратора)
    При удалении администратора/менеджера - удаляет Telegram ID из .env
    """
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Пользователь с ID {user_id} не найден"
        )
    
    # Запрет на удаление самого себя
    if user.id == int(current_user.get('sub', 0)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя удалить свою учётную запись"
        )
    
    # Сохраняем данные для логирования
    user_full_name = user.full_name
    user_telegram_id = user.telegram_id
    user_role = user.role
    
    # ФИЗИЧЕСКОЕ УДАЛЕНИЕ связанных данных
    
    # 1. Удаляем все дедлайны (если клиент)
    if user.role == 'client':
        deadlines_to_delete = db.query(Deadline).filter(
            Deadline.client_id == user_id
        ).all()
        deleted_deadlines_count = len(deadlines_to_delete)
        for deadline in deadlines_to_delete:
            db.delete(deadline)
        print(f"[УДАЛЕНИЕ ПОЛЬЗОВАТЕЛЯ] Пользователь ID={user_id}: физически удалено {deleted_deadlines_count} дедлайнов")
    
    # 2. Удаляем все кассы (если клиент)
    if user.role == 'client':
        cash_registers_to_delete = db.query(CashRegister).filter(
            CashRegister.client_id == user_id
        ).all()
        deleted_cash_count = len(cash_registers_to_delete)
        for cash_register in cash_registers_to_delete:
            db.delete(cash_register)
        print(f"[УДАЛЕНИЕ ПОЛЬЗОВАТЕЛЯ] Пользователь ID={user_id}: физически удалено {deleted_cash_count} касс")
    
    # 3. ФИЗИЧЕСКИ УДАЛЯЕМ пользователя
    db.delete(user)
    db.commit()
    
    print(f"[УДАЛЕНИЕ ПОЛЬЗОВАТЕЛЯ] ✅ Пользователь ID={user_id} ({user_full_name}) физически удалён из БД")
    
    # 4. Если это администратор/менеджер с Telegram ID - удаляем из .env
    if user_role in ['admin', 'manager'] and user_telegram_id:
        try:
            success = env_manager.remove_admin_telegram_id(user_telegram_id)
            if success:
                # Перезапускаем бота для применения изменений
                env_manager.restart_bot_service()
                print(f"✅ Telegram ID {user_telegram_id} удалён из .env после удаления пользователя {user_full_name}")
            else:
                print(f"⚠️  Не удалось удалить Telegram ID {user_telegram_id} из .env")
        except Exception as e:
            print(f"❌ Ошибка при удалении Telegram ID из .env: {e}")
    
    return MessageResponse(
        message=f"Пользователь '{user_full_name}' физически удалён"
    )


@router.post("/{user_id}/generate-code", response_model=CodeGenerationResponse)
async def generate_telegram_code(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(check_admin_or_manager_role)
):
    """
    Генерация кода регистрации для привязки Telegram аккаунта
    Доступно для администраторов и менеджеров
    """
    # Поиск пользователя
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Пользователь с ID {user_id} не найден"
        )
    
    # Проверка - только для клиентов
    if user.role != 'client':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Только клиенты могут привязывать Telegram аккаунт"
        )
    
    # Проверка - не привязан ли уже Telegram
    if user.telegram_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Telegram уже привязан к этому пользователю (@{user.telegram_username})"
        )
    
    # Генерация уникального кода
    code = None
    for _ in range(10):
        code = generate_registration_code()
        existing_code = db.query(User).filter(User.registration_code == code).first()
        if not existing_code:
            break
        code = None
    
    if not code:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось сгенерировать уникальный код регистрации"
        )
    
    # Сохранение кода с датой истечения (72 часа - как в боте)
    user.registration_code = code
    user.code_expires_at = datetime.now() + timedelta(hours=72)
    db.commit()
    db.refresh(user)
    
    return CodeGenerationResponse(
        code=code,
        expires_at=user.code_expires_at,
        message=f"Код регистрации: {code} (действителен 72 часа)"
    )

@router.post("/resend-invitation", response_model=InvitationResponse)
async def resend_invitation(
    request: ResendInvitationRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(check_admin_or_manager_role)
):
    """
    Повторно отправить приглашение пользователю
    """
    user = db.query(User).filter(User.id == request.user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Пользователь с ID {request.user_id} не найден"
        )
    
    # Проверка - приглашения отправляются только пользователям без пароля
    if user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь уже установил пароль"
        )
    
    # Регенерация кода регистрации если запрошено
    registration_code = user.registration_code
    code_expires_at = user.code_expires_at
    
    if request.regenerate_code and user.role == 'client':
        # Генерируем новый уникальный код
        for _ in range(10):
            code = generate_registration_code()
            existing_code = db.query(User).filter(User.registration_code == code).first()
            if not existing_code:
                registration_code = code
                code_expires_at = datetime.now() + timedelta(hours=72)
                user.registration_code = registration_code
                user.code_expires_at = code_expires_at
                db.commit()
                break
    
    # Создание нового токена активации
    activation_token = create_access_token(
        data={
            "sub": str(user.id),
            "email": user.email,
            "type": "activation"
        },
        expires_delta=timedelta(hours=48)
    )
    
    # Отправка email
    email_sent = email_service.send_invitation_email(
        to_email=user.email,
        full_name=user.full_name,
        company_name=user.company_name or "",
        activation_token=activation_token,
        registration_code=registration_code,
        code_expires_at=code_expires_at
    )
    
    if not email_sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось отправить email-приглашение"
        )
    
    return InvitationResponse(
        success=True,
        message=f"Приглашение отправлено на {user.email}",
        activation_token=activation_token,
        registration_code=registration_code,
        code_expires_at=code_expires_at
    )


@router.post("/telegram/register", response_model=TelegramRegistrationResponse)
async def register_telegram(
    request: TelegramRegistrationRequest,
    db: Session = Depends(get_db)
):
    """
    Регистрация пользователя в Telegram боте по коду
    Эндпоинт вызывается Telegram ботом
    """
    # Поиск пользователя по коду регистрации
    user = db.query(User).filter(
        User.registration_code == request.registration_code
    ).first()
    
    if not user:
        return TelegramRegistrationResponse(
            success=False,
            message="Неверный код регистрации"
        )
    
    # Проверка срока действия кода
    if user.code_expires_at and user.code_expires_at < datetime.now():
        return TelegramRegistrationResponse(
            success=False,
            message="Срок действия кода истёк. Обратитесь к менеджеру"
        )
    
    # Проверка - не занят ли уже этот telegram_id
    existing_telegram = db.query(User).filter(
        User.telegram_id == request.telegram_id,
        User.id != user.id
    ).first()
    
    if existing_telegram:
        return TelegramRegistrationResponse(
            success=False,
            message="Этот Telegram аккаунт уже зарегистрирован"
        )
    
    # Обновление данных Telegram
    user.telegram_id = request.telegram_id
    user.telegram_username = request.telegram_username
    user.first_name = request.first_name
    user.last_name = request.last_name
    user.last_interaction = datetime.now()
    
    # Очистка кода регистрации (использован)
    user.registration_code = None
    user.code_expires_at = None
    
    db.commit()
    
    return TelegramRegistrationResponse(
        success=True,
        message=f"Регистрация успешна! Добро пожаловать, {user.full_name}",
        user_id=user.id,
        email=user.email,
        company_name=user.company_name
    )


@router.get("/{user_id}/full-details")
async def get_user_full_details(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Получить полную детализацию пользователя (клиента) с кассами и дедлайнами
    """
    from datetime import date
    
    # Получить пользователя
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Пользователь с ID {user_id} не найден"
        )
    
    # Получить кассовые аппараты
    cash_registers = db.query(CashRegister).filter(
        CashRegister.client_id == user_id,
        CashRegister.is_active == True
    ).order_by(CashRegister.factory_number).all()
    
    # Получить дедлайны
    deadlines = db.query(Deadline).filter(
        Deadline.client_id == user_id,
        Deadline.status == 'active'
    ).order_by(Deadline.expiration_date).all()
    
    today = date.today()
    
    # Разделить дедлайны на две группы
    register_deadlines = []
    general_deadlines = []
    
    for deadline in deadlines:
        days_diff = (deadline.expiration_date - today).days
        
        # Определение цвета
        if days_diff < 0:
            status_color = "red"
        elif days_diff <= 7:
            status_color = "red"
        elif days_diff <= 14:
            status_color = "orange"
        elif days_diff <= 30:
            status_color = "yellow"
        else:
            status_color = "green"
        
        deadline_data = {
            "id": deadline.id,
            "deadline_type_name": deadline.deadline_type.type_name if deadline.deadline_type else "Неизвестно",
            "expiration_date": deadline.expiration_date,
            "days_until_expiration": days_diff,
            "status_color": status_color,
            "notes": deadline.notes,
            "cash_register_id": deadline.cash_register_id
        }
        
        if deadline.cash_register_id:
            # Найти кассу
            register = next((r for r in cash_registers if r.id == deadline.cash_register_id), None)
            if register:
                # Используем register_name если есть, иначе model
                register_display_name = register.register_name or register.model or f"Касса #{register.id}"
                deadline_data["cash_register_name"] = register_display_name
                deadline_data["installation_address"] = register.installation_address
            else:
                deadline_data["cash_register_name"] = f"Касса #{deadline.cash_register_id}"
                deadline_data["installation_address"] = None
            deadline_data["deadline_id"] = deadline.id
            register_deadlines.append(deadline_data)
        else:
            deadline_data["cash_register_name"] = None
            deadline_data["installation_address"] = None
            deadline_data["deadline_id"] = deadline.id
            general_deadlines.append(deadline_data)
    
    # Формирование ответа
    return {
        "id": user.id,
        "name": user.company_name or user.full_name,
        "inn": user.inn,
        "contact_person": user.full_name,
        "phone": user.phone,
        "email": user.email,
        "address": user.address,
        "notes": user.notes,
        "is_active": user.is_active,
        "telegram_id": user.telegram_id,
        "telegram_username": user.telegram_username,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
        "cash_registers": [
            {
                "id": reg.id,
                "factory_number": reg.factory_number,
                "registration_number": reg.registration_number,
                "model": reg.model,
                "register_name": reg.register_name,
                "installation_address": reg.installation_address,
                "fn_number": reg.fn_number,
                "ofd_provider_id": reg.ofd_provider_id,
                "notes": reg.notes,
                "fn_expiry_date": reg.fn_expiry_date,
                "ofd_expiry_date": reg.ofd_expiry_date,
                "is_active": reg.is_active
            }
            for reg in cash_registers
        ],
        "register_deadlines": register_deadlines,
        "general_deadlines": general_deadlines
    }


@router.post("/{user_id}/send-deadlines-telegram", response_model=MessageResponse)
async def send_deadlines_to_telegram(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(check_admin_or_manager_role)
):
    """
    Отправить текущие дедлайны клиента в Telegram
    Доступно только для администраторов и менеджеров
    """
    from datetime import date
    import os
    import sys
    
    # Проверяем существование пользователя
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Пользователь с ID {user_id} не найден"
        )
    
    # Проверяем, что это клиент
    if user.role != 'client':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Отправка дедлайнов доступна только для клиентов"
        )
    
    # Проверяем наличие Telegram ID
    if not user.telegram_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Клиент {user.company_name or user.full_name} не подключен к Telegram"
        )
    
    # Получаем активные дедлайны клиента
    deadlines = db.query(Deadline).filter(
        Deadline.client_id == user_id,
        Deadline.status == 'active'
    ).order_by(Deadline.expiration_date).all()
    
    if not deadlines:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"У клиента {user.company_name or user.full_name} нет активных дедлайнов"
        )
    
    # Формируем список дедлайнов для отправки
    today = date.today()
    deadlines_data = []
    
    for deadline in deadlines:
        days_diff = (deadline.expiration_date - today).days
        
        # Определение статуса
        if days_diff < 0:
            status_color = "expired"
        elif days_diff <= 7:
            status_color = "red"
        elif days_diff <= 14:
            status_color = "yellow"
        else:
            status_color = "green"
        
        # Базовая информация о дедлайне
        deadline_info = {
            'deadline_id': deadline.id,
            'client_name': user.company_name or user.full_name,
            'client_inn': user.inn or 'Не указано',
            'deadline_type_name': deadline.deadline_type.type_name if deadline.deadline_type else 'Неизвестно',
            'expiration_date': deadline.expiration_date,
            'days_remaining': days_diff,
            'status': status_color
        }
        
        # Добавляем информацию о кассе, если дедлайн привязан к кассе
        if deadline.cash_register_id and deadline.cash_register:
            cash_register = deadline.cash_register
            deadline_info['cash_register_model'] = cash_register.model or 'Не указана'
            deadline_info['cash_register_serial'] = cash_register.factory_number or 'Не указан'
            deadline_info['cash_register_name'] = cash_register.register_name or cash_register.model or 'ККТ'
            deadline_info['installation_address'] = cash_register.installation_address
        
        deadlines_data.append(deadline_info)
    
    # Добавляем путь к bot в sys.path для импорта
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
    if project_root not in sys.path:
        sys.path.insert(0, project_root)
    
    try:
        # Импортируем сервисы бота
        from bot.services.formatter import format_deadline_list
        from bot.services.notifier import send_notification
        from aiogram import Bot
        from bot.config import settings as bot_settings
        
        # Создаем экземпляр бота
        bot = Bot(token=bot_settings.telegram_bot_token)
        
        # Форматируем сообщение
        title = f"📄 Ваши текущие дедлайны ({len(deadlines_data)})"
        message = format_deadline_list(deadlines_data, title=title)
        message += f"\n\nℹ️ <i>Отправлено {current_user.get('full_name', 'администратором')}</i>"
        
        # Отправляем уведомление
        success = await send_notification(bot, int(user.telegram_id), message)
        
        # Закрываем бота
        await bot.session.close()
        
        if success:
            return MessageResponse(
                message=f"Дедлайны успешно отправлены клиенту {user.company_name or user.full_name} в Telegram"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось отправить сообщение в Telegram"
            )
            
    except ImportError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка импорта модулей бота: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при отправке дедлайнов: {str(e)}"
        )
