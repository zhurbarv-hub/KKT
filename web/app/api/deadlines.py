# -*- coding: utf-8 -*-
"""
API endpoints для управления дедлайнами
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from typing import Optional, List
from datetime import date, datetime, timedelta
import math

from ..dependencies import get_db
from ..models.client import Deadline, DeadlineType
from ..models.user import User
from ..models.client_schemas import (
    DeadlineCreate,
    DeadlineUpdate,
    DeadlineResponse,
    DeadlineDetailResponse,
    DeadlineListResponse
)
from ..services.auth_service import decode_token
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

router = APIRouter(prefix="/api/deadlines", tags=["Deadlines"])
security = HTTPBearer()


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


def calculate_days_until_expiration(expiration_date: date) -> int:
    """Расчёт дней до истечения"""
    delta = expiration_date - date.today()
    return delta.days


def calculate_status_color(days: int) -> str:
    """Расчёт цвета статуса на основе дней до истечения"""
    if days is None:
        return "unknown"
    if days < 0:
        return "expired"
    elif days < 7:
        return "red"
    elif days < 14:
        return "yellow"
    else:
        return "green"

def enrich_deadline_with_details(deadline: Deadline, db: Session = None) -> dict:
    """Обогащение данных дедлайна дополнительной информацией"""
    client = None
    deadline_type = None
    
    if db:
        # Поддержка дедлайнов с client_id (все дедлайны теперь используют User)
        if deadline.client_id:
            client = db.query(User).filter(User.id == deadline.client_id).first()
        
        if deadline.deadline_type_id:
            deadline_type = db.query(DeadlineType).filter(DeadlineType.id == deadline.deadline_type_id).first()
    
    return {
        "id": deadline.id,
        "client_id": deadline.client_id,
        "deadline_type_id": deadline.deadline_type_id,
        "cash_register_id": deadline.cash_register_id,
        "expiration_date": deadline.expiration_date,
        "status": deadline.status,
        "notes": deadline.notes,
        "created_at": deadline.created_at,
        "updated_at": deadline.updated_at,
        "client": {
            "id": client.id if client else None,
            "company_name": client.company_name if client else None,
            "inn": client.inn if client else None,
        } if client else None,
        "deadline_type": {
            "id": deadline_type.id if deadline_type else None,
            "name": deadline_type.type_name if deadline_type else None,
            "type_name": deadline_type.type_name if deadline_type else None,
        } if deadline_type else None,
        "notification_enabled": getattr(client, 'notifications_enabled', True) if client else True,
        "days_until_expiration": calculate_days_until_expiration(deadline.expiration_date), "status_color": calculate_status_color(calculate_days_until_expiration(deadline.expiration_date))
    }


@router.get("", response_model=DeadlineListResponse)
async def get_deadlines(
    page: int = Query(1, ge=1, description="Номер страницы"),
    page_size: int = Query(50, ge=1, le=100, description="Количество записей на странице"),
    client_id: Optional[int] = Query(None, description="Фильтр по клиенту"),
    deadline_type_id: Optional[int] = Query(None, description="Фильтр по типу дедлайна"),
    cash_register_id: Optional[int] = Query(None, description="Фильтр по кассовому аппарату"),
    deadline_status: Optional[str] = Query(None, description="Фильтр по статусу"),
    date_from: Optional[date] = Query(None, description="Дата от"),
    date_to: Optional[date] = Query(None, description="Дата до"),
    days_until: Optional[int] = Query(None, description="Истекает через N дней"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Получить список всех дедлайнов с фильтрами и пагинацией"""
    
    try:
        # Базовый запрос - LEFT JOIN по client_id (все дедлайны теперь используют client_id)
        from ..models.cash_register import CashRegister
        
        query = db.query(Deadline)\
            .outerjoin(User, Deadline.client_id == User.id)\
            .outerjoin(DeadlineType, Deadline.deadline_type_id == DeadlineType.id)\
            .outerjoin(CashRegister, Deadline.cash_register_id == CashRegister.id)
        
        # Фильтр по статусу по умолчанию - только активные
        if deadline_status:
            query = query.filter(Deadline.status == deadline_status)
        else:
            # По умолчанию показываем только активные
            query = query.filter(Deadline.status == 'active')
        
        # Примечание: фильтры по активности клиентов/касс убраны,
        # так как дедлайны теперь физически удаляются при деактивации
        
        # Применение фильтров
        if client_id:
            query = query.filter(Deadline.client_id == client_id)
        
        if deadline_type_id:
            query = query.filter(Deadline.deadline_type_id == deadline_type_id)
        
        if cash_register_id:
            query = query.filter(Deadline.cash_register_id == cash_register_id)
        
        if date_from:
            query = query.filter(Deadline.expiration_date >= date_from)
        
        if date_to:
            query = query.filter(Deadline.expiration_date <= date_to)
        
        # Фильтр по дням до истечения
        if days_until is not None:
            target_date = date.today() + timedelta(days=days_until)
            query = query.filter(
                and_(
                    Deadline.expiration_date >= date.today(),
                    Deadline.expiration_date <= target_date
                )
            )
        
        # Подсчёт общего количества
        total = query.count()
        
        # Пагинация
        offset = (page - 1) * page_size
        deadlines = query.order_by(Deadline.expiration_date).offset(offset).limit(page_size).all()
        
        # Обогащение данных
        enriched_deadlines = []
        print(f"\n=== ОБРАБОТКА {len(deadlines)} ДЕДЛАЙНОВ ===")
        for idx, d in enumerate(deadlines, 1):
            try:
                print(f"{idx}. Обрабатываем дедлайн ID={d.id}...")
                enriched_deadlines.append(enrich_deadline_with_details(d, db))
                print(f"   ✓ Успешно")
            except Exception as e:
                # Откатываем транзакцию при ошибке, чтобы избежать InFailedSqlTransaction
                db.rollback()
                import traceback
                print(f"   ✖ ОШИБКА: Не удалось обработать дедлайн ID={d.id}")
                print(f"   Причина: {str(e)}")
                print(f"   client_id={d.client_id}, user_id={getattr(d, 'user_id', None)}, deadline_type_id={d.deadline_type_id}")
                print(f"   Traceback:\n{traceback.format_exc()}")
                continue
        print(f"=== ИТОГО: Успешно обработано {len(enriched_deadlines)} из {len(deadlines)} дедлайнов ===\n")
        
        # Расчёт количества страниц
        total_pages = math.ceil(total / page_size) if total > 0 else 1
        
        return DeadlineListResponse(
            total=total,
            deadlines=enriched_deadlines,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )
    except Exception as e:
        import traceback
        print(f"Error in get_deadlines: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при загрузке дедлайнов: {str(e)}"
        )


@router.get("/expiring-soon", response_model=List[DeadlineDetailResponse])
@router.get("/urgent", response_model=List[DeadlineDetailResponse])  # Alias для совместимости
async def get_expiring_soon(
    days: int = Query(14, ge=1, le=90, description="Количество дней"),
    include_expired: bool = Query(True, description="Включать просроженные дедлайны"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Получить дедлайны, истекающие в ближайшие N дней (и просроченные, если include_expired=True)"""
    
    target_date = date.today() + timedelta(days=days)
    
    # Базовый запрос
    base_query = db.query(Deadline)\
        .outerjoin(User, Deadline.user_id == User.id)\
        .join(DeadlineType, Deadline.deadline_type_id == DeadlineType.id)\
        .filter(Deadline.status == 'active')
    
    # Если нужно включить просроченные (по умолчанию True)
    if include_expired:
        # Включаем все дедлайны до target_date (включая просроченные)
        deadlines = base_query.filter(
            Deadline.expiration_date <= target_date
        ).order_by(Deadline.expiration_date).all()
    else:
        # Только будущие дедлайны
        deadlines = base_query.filter(
            and_(
                Deadline.expiration_date >= date.today(),
                Deadline.expiration_date <= target_date
            )
        ).order_by(Deadline.expiration_date).all()
    
    return [enrich_deadline_with_details(d, db) for d in deadlines]


@router.get("/by-client/{client_id}", response_model=List[DeadlineDetailResponse])
async def get_deadlines_by_client(
    client_id: int,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Получить все дедлайны конкретного клиента"""
    
    # Проверка существования клиента (ищем в таблице users)
    client = db.query(User).filter(and_(User.id == client_id, User.role == 'client')).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Клиент с ID {client_id} не найден"
        )
    
    query = db.query(Deadline)\
        .join(DeadlineType, Deadline.deadline_type_id == DeadlineType.id)\
        .filter(or_(Deadline.user_id == client_id, Deadline.client_id == client_id))
    
    if not include_inactive:
        query = query.filter(Deadline.status == 'active')
    
    deadlines = query.order_by(Deadline.expiration_date).all()
    
    return [enrich_deadline_with_details(d, db) for d in deadlines]


@router.get("/{deadline_id}", response_model=DeadlineDetailResponse)
async def get_deadline(
    deadline_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Получить конкретный дедлайн"""
    
    deadline = db.query(Deadline).filter(Deadline.id == deadline_id).first()
    
    if not deadline:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Дедлайн с ID {deadline_id} не найден"
        )
    
    return enrich_deadline_with_details(deadline, db)


@router.post("", response_model=DeadlineDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_deadline(
    deadline_data: DeadlineCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Создать новый дедлайн"""
    
    # Проверка прав доступа
    if current_user.get('role') not in ['admin', 'manager']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для создания дедлайнов"
        )
    
    # Проверка существования клиента (в таблице users)
    client = db.query(User).filter(and_(User.id == deadline_data.client_id, User.role == 'client')).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Клиент с ID {deadline_data.client_id} не найден"
        )
    
    # Проверка существования типа дедлайна
    deadline_type = db.query(DeadlineType).filter(
        DeadlineType.id == deadline_data.deadline_type_id
    ).first()
    if not deadline_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Тип дедлайна с ID {deadline_data.deadline_type_id} не найден"
        )
    
    # Создание дедлайна с маппингом client_id -> user_id (и сохранением обоих для совместимости)
    deadline_dict = deadline_data.model_dump()
    client_id_value = deadline_dict.get('client_id')
    
    # Устанавливаем и user_id (новое поле), и оставляем client_id (старое поле) для совместимости
    deadline_dict['user_id'] = client_id_value
    deadline_dict['client_id'] = client_id_value
    
    new_deadline = Deadline(**deadline_dict)
    db.add(new_deadline)
    
    try:
        db.commit()
        db.refresh(new_deadline)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при создании дедлайна: {str(e)}"
        )
    
    # TODO: Отправить уведомление в Telegram
    # await send_telegram_notification(new_deadline, db)
    
    return enrich_deadline_with_details(new_deadline, db)


@router.put("/{deadline_id}", response_model=DeadlineDetailResponse)
async def update_deadline(
    deadline_id: int,
    deadline_data: DeadlineUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Обновить дедлайн"""
    
    # Проверка прав доступа
    if current_user.get('role') not in ['admin', 'manager']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для редактирования дедлайнов"
        )
    
    # Поиск дедлайна
    deadline = db.query(Deadline).filter(Deadline.id == deadline_id).first()
    if not deadline:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Дедлайн с ID {deadline_id} не найден"
        )
    
    # Обновление полей
    update_data = deadline_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(deadline, field, value)
    
    db.commit()
    db.refresh(deadline)
    
    return enrich_deadline_with_details(deadline, db)


@router.delete("/{deadline_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_deadline(
    deadline_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Удалить дедлайн"""
    
    # Проверка прав доступа (только админ)
    if current_user.get('role') != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только администратор может удалять дедлайны"
        )
    
    # Поиск дедлайна
    deadline = db.query(Deadline).filter(Deadline.id == deadline_id).first()
    if not deadline:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Дедлайн с ID {deadline_id} не найден"
        )
    
    # Удаление
    db.delete(deadline)
    db.commit()
    
    return None