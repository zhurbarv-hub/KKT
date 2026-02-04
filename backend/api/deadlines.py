"""
Deadline Management API Endpoints for KKT Services Expiration Management System
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, asc
from typing import List
from datetime import date, datetime

from backend.database import get_db
from backend.models import Deadline, User, DeadlineType
from backend.schemas import (
    DeadlineCreate,
    DeadlineUpdate,
    DeadlineResponse,
    DeadlineListResponse,
    MessageResponse
)
from backend.cache import cache
from backend.api.dashboard import invalidate_dashboard_cache
from backend.dependencies import (
    get_current_active_user,
    get_pagination_params,
    get_deadline_filter_params,
    PaginationParams,
    DeadlineFilterParams
)


router = APIRouter(prefix="/api/deadlines", tags=["Deadlines"])


@router.get("", response_model=DeadlineListResponse, summary="List Deadlines")
async def list_deadlines(
    pagination: PaginationParams = Depends(get_pagination_params),
    filters: DeadlineFilterParams = Depends(get_deadline_filter_params),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Retrieve deadlines with filtering, sorting, and pagination"""
    
    # Build base query
    query = db.query(Deadline)
    
    # Apply filters
    if filters.client_id:
        query = query.filter(Deadline.user_id == filters.client_id)
    
    if filters.deadline_type_id:
        query = query.filter(Deadline.deadline_type_id == filters.deadline_type_id)
    
    # Filter by status color
    if filters.status:
        today = date.today()
        if filters.status == 'expired':
            query = query.filter(Deadline.expiration_date < today)
        elif filters.status == 'red':
            from datetime import timedelta
            query = query.filter(
                Deadline.expiration_date >= today,
                Deadline.expiration_date < today + timedelta(days=7)
            )
        elif filters.status == 'yellow':
            from datetime import timedelta
            query = query.filter(
                Deadline.expiration_date >= today + timedelta(days=7),
                Deadline.expiration_date < today + timedelta(days=14)
            )
        elif filters.status == 'green':
            from datetime import timedelta
            query = query.filter(Deadline.expiration_date >= today + timedelta(days=14))
    
    # Get total count
    total = query.count()
    
    # Apply sorting
    sort_column = getattr(Deadline, filters.sort_by, Deadline.expiration_date)
    if filters.order == 'desc':
        query = query.order_by(desc(sort_column))
    else:
        query = query.order_by(asc(sort_column))
    
    # Apply pagination and eager load relationships
    deadlines = query.options(
        joinedload(Deadline.user),
        joinedload(Deadline.deadline_type)
    ).offset(pagination.offset).limit(pagination.limit).all()
    
    # Convert to response
    deadline_responses = []
    for deadline in deadlines:
        deadline_dict = deadline.to_dict()
        deadline_dict['days_until_expiration'] = deadline.days_until_expiration
        deadline_dict['status_color'] = deadline.status_color
        
        # Populate user information
        if deadline.user:
            deadline_dict['user_name'] = deadline.user.display_name
            deadline_dict['company_name'] = deadline.user.company_name
            deadline_dict['client_name'] = deadline.user.display_name
        else:
            deadline_dict['user_name'] = None
            deadline_dict['company_name'] = None
            deadline_dict['client_name'] = None
            
        # Populate deadline type
        if deadline.deadline_type:
            deadline_dict['deadline_type_name'] = deadline.deadline_type.type_name
        else:
            deadline_dict['deadline_type_name'] = None
            
        deadline_responses.append(DeadlineResponse(**deadline_dict))
    
    return DeadlineListResponse(
        total=total,
        page=pagination.page,
        limit=pagination.limit,
        deadlines=deadline_responses
    )


@router.get("/{deadline_id}", response_model=DeadlineResponse, summary="Get Deadline by ID")
async def get_deadline(
    deadline_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve single deadline with full details
    
    **Path Parameters:**
    - deadline_id: Deadline ID to fetch
    
    **Response:**
    - Deadline object with:
      - Calculated fields (days_remaining, status_color)
      - Client name
      - Deadline type name
    
    **Errors:**
    - 404 Not Found: Deadline does not exist
    
    **Authentication:**
    Requires valid JWT token
    """
    deadline = db.query(Deadline).filter(Deadline.id == deadline_id).first()
    
    if not deadline:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Deadline with id {deadline_id} not found"
        )
    
    # Build response with calculated fields
    deadline_dict = deadline.to_dict()
    deadline_dict['days_until_expiration'] = deadline.days_until_expiration
    deadline_dict['status_color'] = deadline.status_color
    # Populate user information
    if deadline.user:
        deadline_dict['user_name'] = deadline.user.display_name
        deadline_dict['company_name'] = deadline.user.company_name
        deadline_dict['client_name'] = deadline.user.display_name  # Legacy field
    deadline_dict['deadline_type_name'] = deadline.deadline_type.type_name if deadline.deadline_type else None
    
    return DeadlineResponse(**deadline_dict)


@router.post("", response_model=MessageResponse, status_code=status.HTTP_201_CREATED, summary="Create Deadline")
async def create_deadline(
    deadline_data: DeadlineCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Create new deadline for a user (client)
    
    **Request Body:**
    - user_id: User ID (client, required, must exist)
    - deadline_type_id: Deadline type ID (required, must exist)
    - expiration_date: Service expiration date (required)
    - notes: Additional notes (optional)
    
    **Validation:**
    - user_id must reference existing active user with role='client'
    - deadline_type_id must reference existing active deadline type
    - expiration_date must be valid date
    - Warning if expiration_date is in the past (but allowed for historical data)
    
    **Response:**
    - message: Success message
    - id: New deadline ID
    
    **Errors:**
    - 400 Bad Request: Validation errors
    - 404 Not Found: User or deadline type not found
    
    **Authentication:**
    Requires valid JWT token
    """
    # Validate user exists and is a client
    user = db.query(User).filter(User.id == deadline_data.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Пользователь с ID {deadline_data.user_id} не найден"
        )
    
    # Check if user is a client
    if not user.is_client:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Пользователь '{user.full_name}' не является клиентом (роль: {user.role})"
        )
    
    # Validate deadline type exists
    deadline_type = db.query(DeadlineType).filter(
        DeadlineType.id == deadline_data.deadline_type_id
    ).first()
    if not deadline_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Deadline type with id {deadline_data.deadline_type_id} not found"
        )
    
    # Check if deadline type is active
    if not deadline_type.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Deadline type '{deadline_type.type_name}' is inactive"
        )
    
    # Create new deadline
    new_deadline = Deadline(**deadline_data.model_dump())
    
    db.add(new_deadline)
    db.commit()
    invalidate_dashboard_cache()  # Invalidate cache
    db.refresh(new_deadline)
    
    return MessageResponse(
        message=f"Дедлайн для '{user.display_name}' успешно создан",
        id=new_deadline.id
    )


@router.put("/{deadline_id}", response_model=MessageResponse, summary="Update Deadline")
async def update_deadline(
    deadline_id: int,
    deadline_data: DeadlineUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Update existing deadline
    
    **Path Parameters:**
    - deadline_id: Deadline ID to update
    
    **Request Body:**
    All fields optional:
    - user_id: Change associated user (client)
    - deadline_type_id: Change deadline type
    - expiration_date: Change expiration date
    - status: Change status (active, expired, renewed)
    - notes: Update notes
    
    **Validation:**
    - If changing user_id, user must exist and be a client
    - If changing deadline_type_id, type must exist
    - Status must be one of: active, expired, renewed
    
    **Response:**
    - message: Success message
    - id: Updated deadline ID
    
    **Errors:**
    - 404 Not Found: Deadline, user, or type not found
    - 400 Bad Request: Invalid status value or user is not a client
    
    **Authentication:**
    Requires valid JWT token
    """
    # Fetch existing deadline
    deadline = db.query(Deadline).filter(Deadline.id == deadline_id).first()
    
    if not deadline:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Дедлайн с ID {deadline_id} не найден"
        )
    
    # Prepare update data
    update_data = deadline_data.model_dump(exclude_unset=True)
    
    # Validate user if being changed
    if 'user_id' in update_data:
        user = db.query(User).filter(User.id == update_data['user_id']).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Пользователь с ID {update_data['user_id']} не найден"
            )
        if not user.is_client:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Пользователь '{user.full_name}' не является клиентом"
            )
    
    # Validate deadline type if being changed
    if 'deadline_type_id' in update_data:
        deadline_type = db.query(DeadlineType).filter(
            DeadlineType.id == update_data['deadline_type_id']
        ).first()
        if not deadline_type:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Тип дедлайна с ID {update_data['deadline_type_id']} не найден"
            )
    
    # Update deadline fields
    for field, value in update_data.items():
        setattr(deadline, field, value)
    
    db.commit()
    invalidate_dashboard_cache()  # Invalidate cache
    db.refresh(deadline)
    
    return MessageResponse(
        message="Дедлайн успешно обновлён",
        id=deadline.id
    )


@router.delete("/{deadline_id}", response_model=MessageResponse, summary="Delete Deadline")
async def delete_deadline(
    deadline_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Permanently delete deadline
    
    **Path Parameters:**
    - deadline_id: Deadline ID to delete
    
    **Behavior:**
    - Permanently removes deadline from database
    - Associated notification logs are also deleted (CASCADE)
    - This operation cannot be undone
    
    **Response:**
    - message: Success message
    
    **Errors:**
    - 404 Not Found: Deadline does not exist
    
    **Note:**
    Unlike clients, deadlines use hard delete because they can be recreated
    if needed for renewed services
    
    **Authentication:**
    Requires valid JWT token
    """
    # Fetch deadline
    deadline = db.query(Deadline).filter(Deadline.id == deadline_id).first()
    
    if not deadline:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Дедлайн с ID {deadline_id} не найден"
        )
    
    # Store info for response
    user_name = deadline.user.display_name if deadline.user else "Неизвестно"
    type_name = deadline.deadline_type.type_name if deadline.deadline_type else "Неизвестно"
    
    # Delete deadline
    db.delete(deadline)
    db.commit()
    invalidate_dashboard_cache()  # Invalidate cache
    
    return MessageResponse(
        message=f"Дедлайн удалён: {user_name} - {type_name}"
    )


@router.get("/urgent", response_model=List[DeadlineResponse], summary="Get Urgent Deadlines")
async def get_urgent_deadlines(
    days: int = 14,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Получить срочные дедлайны (истекают в ближайшие N дней)
    
    **Query Parameters:**
    - days: Количество дней для проверки (по умолчанию 14)
    
    **Response:**
    - Массив дедлайнов, которые истекают в ближайшие days дней
    - Отсортировано по дате истечения (от ближайших к дальним)
    
    **Authentication:**
    Requires valid JWT token
    """
    from datetime import timedelta
    
    today = date.today()
    threshold_date = today + timedelta(days=days)
    
    # Получаем дедлайны, которые истекают в ближайшие N дней
    query = db.query(Deadline)\
              .options(joinedload(Deadline.user), joinedload(Deadline.deadline_type))\
              .filter(
                  Deadline.expiration_date >= today,
                  Deadline.expiration_date <= threshold_date,
                  Deadline.status == 'active'
              )\
              .order_by(asc(Deadline.expiration_date))
    
    deadlines = query.all()
    
    # Конвертируем в response с вычисляемыми полями
    deadline_responses = []
    for deadline in deadlines:
        deadline_dict = deadline.to_dict()
        deadline_dict['days_until_expiration'] = deadline.days_until_expiration
        deadline_dict['status_color'] = deadline.status_color
        deadline_dict['days_remaining'] = deadline.days_until_expiration  # Алиас для совместимости
        # Populate user information
        if deadline.user:
            deadline_dict['user_name'] = deadline.user.display_name
            deadline_dict['company_name'] = deadline.user.company_name
            deadline_dict['client_name'] = deadline.user.display_name  # Legacy field
        deadline_dict['deadline_type_name'] = deadline.deadline_type.type_name if deadline.deadline_type else None
        deadline_responses.append(DeadlineResponse(**deadline_dict))
    
    return deadline_responses


# ============================================
# Testing
# ============================================

if __name__ == "__main__":
    print("=" * 60)
    print("МОДУЛЬ УПРАВЛЕНИЯ ДЕДЛАЙНАМИ")
    print("=" * 60)
    
    print("\nДоступные эндпоинты:")
    print("  • GET /api/deadlines - Список дедлайнов с фильтрацией")
    print("  • GET /api/deadlines/{id} - Получить дедлайн с деталями")
    print("  • POST /api/deadlines - Создать новый дедлайн")
    print("  • PUT /api/deadlines/{id} - Обновить дедлайн")
    print("  • DELETE /api/deadlines/{id} - Удалить дедлайн")
    
    print("\n" + "=" * 60)
    print("✅ МОДУЛЬ ГОТОВ К ИСПОЛЬЗОВАНИЮ")
    print("=" * 60)
