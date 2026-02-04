# -*- coding: utf-8 -*-
"""
API для управления кассовыми аппаратами
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime
from pydantic import BaseModel, Field

from ..models import CashRegister
from ..models.user import User
from ..dependencies import get_db
from ..services.auth_service import decode_token
from ..services.cash_register_deadline_service import CashRegisterDeadlineService
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

router = APIRouter(prefix="/api/cash-registers", tags=["Cash Registers"])
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


# Schemas
class CashRegisterCreate(BaseModel):
    client_id: int = Field(..., description="ID клиента")
    factory_number: Optional[str] = Field(None, max_length=100, description="Заводской номер")
    registration_number: Optional[str] = Field(None, max_length=100, description="Регистрационный номер")
    model: Optional[str] = Field(None, max_length=255, description="Модель ККТ")
    register_name: Optional[str] = Field(None, max_length=255, description="Название кассы")
    installation_address: Optional[str] = Field(None, description="Адрес установки")
    fn_number: Optional[str] = Field(None, max_length=100, description="Номер ФН")
    ofd_provider_id: Optional[int] = Field(None, description="ID провайдера ОФД")
    ofd_contract_date: Optional[date] = Field(None, description="Дата договора с ОФД")
    ofd_expiry_date: Optional[date] = Field(None, description="Дата окончания договора с ОФД")
    fn_expiry_date: Optional[date] = Field(None, description="Дата окончания действия ФН")
    registration_expiry_date: Optional[date] = Field(None, description="Дата окончания регистрации")
    notes: Optional[str] = Field(None, description="Примечание")


class CashRegisterUpdate(BaseModel):
    factory_number: Optional[str] = Field(None, max_length=100)
    registration_number: Optional[str] = Field(None, max_length=100)
    model: Optional[str] = Field(None, max_length=255)
    register_name: Optional[str] = Field(None, max_length=255)
    installation_address: Optional[str] = Field(None)
    fn_number: Optional[str] = Field(None, max_length=100)
    ofd_provider_id: Optional[int] = Field(None)
    ofd_contract_date: Optional[date] = Field(None)
    ofd_expiry_date: Optional[date] = Field(None)
    fn_expiry_date: Optional[date] = Field(None)
    registration_expiry_date: Optional[date] = Field(None)
    notes: Optional[str] = Field(None)
    is_active: Optional[bool] = Field(None)


class CashRegisterResponse(BaseModel):
    id: int
    client_id: int
    factory_number: Optional[str] = None
    registration_number: Optional[str] = None
    model: Optional[str] = None
    register_name: Optional[str] = None
    installation_address: Optional[str] = None
    fn_number: Optional[str] = None
    ofd_provider_id: Optional[int] = None
    ofd_contract_date: Optional[date] = None
    ofd_expiry_date: Optional[date] = None
    fn_expiry_date: Optional[date] = None
    registration_expiry_date: Optional[date] = None
    notes: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


# Endpoints
@router.get("", response_model=List[CashRegisterResponse])
async def list_cash_registers(
    user_id: int = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Получить список кассовых аппаратов"""
    query = db.query(CashRegister)
    
    if user_id:
        query = query.filter(CashRegister.client_id == user_id)
    
    query = query.filter(CashRegister.is_active == True)
    registers = query.all()
    
    return registers




@router.get("/client/{client_id}", response_model=List[CashRegisterResponse])
async def get_cash_registers_by_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Получить список кассовых аппаратов клиента"""
    registers = db.query(CashRegister).filter(
        CashRegister.client_id == client_id,
        CashRegister.is_active == True
    ).all()
    
    return registers

@router.get("/{register_id}", response_model=CashRegisterResponse)
async def get_cash_register(
    register_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Получить кассовый аппарат по ID"""
    register = db.query(CashRegister).filter(CashRegister.id == register_id).first()
    
    if not register:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Кассовый аппарат не найден"
        )
    
    return register


@router.post("", response_model=CashRegisterResponse, status_code=status.HTTP_201_CREATED)
async def create_cash_register(
    data: CashRegisterCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Создать новый кассовый аппаратс автоматическим созданием дедлайнов"""
    try:
        # Проверка существования клиента
        user = db.query(User).filter(User.id == data.client_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Клиент не найден"
            )
        
        # Создание кассы
        register = CashRegister(
            client_id=data.client_id,
            factory_number=data.factory_number,
            registration_number=data.registration_number,
            model=data.model,
            register_name=data.register_name,
            installation_address=data.installation_address,
            fn_number=data.fn_number,
            ofd_provider_id=data.ofd_provider_id,
            ofd_contract_date=data.ofd_contract_date,
            ofd_expiry_date=data.ofd_expiry_date,
            fn_expiry_date=data.fn_expiry_date,
            registration_expiry_date=data.registration_expiry_date,
            notes=data.notes
        )
        
        db.add(register)
        db.flush()  # Получить ID до commit
        
        # Автоматическое создание дедлайнов (если сервис доступен)
        try:
            deadline_service = CashRegisterDeadlineService(db)
            # Используем register_name если заполнено, иначе model или дефолтное значение
            display_name = data.register_name or data.model or f"Касса #{register.id}"
            deadline_service.sync_deadlines_on_create(
                cash_register_id=register.id,
                user_id=register.client_id,
                register_name=display_name,
                fn_replacement_date=data.fn_expiry_date,
                ofd_renewal_date=data.ofd_expiry_date
            )
        except Exception as e:
            # Логируем ошибку, но не прерываем создание кассы
            print(f"Предупреждение: не удалось создать дедлайны: {e}")
        
        db.commit()
        db.refresh(register)
        
        return register
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при создании кассового аппарата: {str(e)}"
        )


@router.put("/{register_id}", response_model=CashRegisterResponse)
async def update_cash_register(
    register_id: int,
    data: CashRegisterUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Обновить кассовый аппарат с автоматической синхронизацией дедлайнов"""
    try:
        register = db.query(CashRegister).filter(CashRegister.id == register_id).first()
        
        if not register:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Кассовый аппарат не найден"
            )
        
        # Проверка уникальности заводского номера при изменении
        if data.factory_number and data.factory_number != register.factory_number:
            existing = db.query(CashRegister).filter(
                CashRegister.factory_number == data.factory_number,
                CashRegister.id != register_id
            ).first()
            
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Кассовый аппарат с таким заводским номером уже существует"
                )
        
        # Сохранение старых значений дат для сравнения
        old_fn_date = register.fn_expiry_date
        old_ofd_date = register.ofd_expiry_date
        
        # Обновление полей
        update_data = data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(register, field, value)
        
        db.flush()  # Применить изменения до commit
        
        # Автоматическая синхронизация дедлайнов
        try:
            deadline_service = CashRegisterDeadlineService(db)
            # Используем register_name если заполнено, иначе model или дефолтное значение
            display_name = register.register_name or register.model or f"Касса #{register.id}"
            deadline_service.sync_deadlines_on_update(
                cash_register_id=register.id,
                user_id=register.client_id,
                register_name=display_name,
                old_fn_date=old_fn_date,
                new_fn_date=register.fn_expiry_date,
                old_ofd_date=old_ofd_date,
                new_ofd_date=register.ofd_expiry_date
            )
        except Exception as e:
            # Логируем ошибку, но не прерываем обновление кассы
            print(f"Предупреждение: не удалось синхронизировать дедлайны: {e}")
        
        db.commit()
        db.refresh(register)
        
        return register
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при обновлении кассового аппарата: {str(e)}"
        )


@router.delete("/{register_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cash_register(
    register_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Удалить (деактивировать) кассовый аппарат"""
    register = db.query(CashRegister).filter(CashRegister.id == register_id).first()
    
    if not register:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Кассовый аппарат не найден"
        )
    
    # Мягкое удаление кассы
    register.is_active = False
    
    # ФИЗИЧЕСКИ УДАЛЯЕМ все связанные дедлайны
    from ..models.client import Deadline
    
    deadlines_to_delete = db.query(Deadline).filter(
        Deadline.cash_register_id == register_id
    ).all()
    
    deleted_count = len(deadlines_to_delete)
    for deadline in deadlines_to_delete:
        db.delete(deadline)
    
    print(f"[УДАЛЕНИЕ КАССЫ] Касса ID={register_id}: физически удалено {deleted_count} дедлайнов")
    
    db.commit()
    
    return None
