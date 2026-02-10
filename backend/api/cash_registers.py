"""
Cash Register Management API Endpoints with Auto-Deadline Creation
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date

from backend.database import get_db
from backend.models import CashRegister, User, Deadline, DeadlineType
from backend.schemas import (
    CashRegisterCreate,
    CashRegisterUpdate,
    CashRegisterResponse,
    CashRegisterListResponse,
    MessageResponse
)
from backend.dependencies import get_current_active_user
from backend.api.dashboard import invalidate_dashboard_cache


router = APIRouter(prefix="/api/cash-registers", tags=["Cash Registers"])

# Deadline type IDs
FN_DEADLINE_TYPE_ID = 6  # Замена ФН
OFD_DEADLINE_TYPE_ID = 7  # Продление договора ОФД


def sync_deadlines_for_register(db: Session, register: CashRegister):
    """Create or update deadlines based on cash register expiry dates"""
    
    # Handle FN deadline
    if register.fn_expiry_date:
        fn_deadline = db.query(Deadline).filter(
            Deadline.cash_register_id == register.id,
            Deadline.deadline_type_id == FN_DEADLINE_TYPE_ID
        ).first()
        
        if fn_deadline:
            # Update existing deadline
            fn_deadline.expiration_date = register.fn_expiry_date
            fn_deadline.user_id = register.client_id
        else:
            # Create new deadline
            fn_deadline = Deadline(client_id=register.client_id, 
                user_id=register.client_id,
                deadline_type_id=FN_DEADLINE_TYPE_ID,
                cash_register_id=register.id,
                expiration_date=register.fn_expiry_date,
                status='active'
            )
            db.add(fn_deadline)
    else:
        # Remove FN deadline if date cleared
        db.query(Deadline).filter(
            Deadline.cash_register_id == register.id,
            Deadline.deadline_type_id == FN_DEADLINE_TYPE_ID
        ).delete()
    
    # Handle OFD deadline
    if register.ofd_expiry_date:
        ofd_deadline = db.query(Deadline).filter(
            Deadline.cash_register_id == register.id,
            Deadline.deadline_type_id == OFD_DEADLINE_TYPE_ID
        ).first()
        
        if ofd_deadline:
            # Update existing deadline
            ofd_deadline.expiration_date = register.ofd_expiry_date
            ofd_deadline.user_id = register.client_id
        else:
            # Create new deadline
            ofd_deadline = Deadline(client_id=register.client_id, 
                user_id=register.client_id,
                deadline_type_id=OFD_DEADLINE_TYPE_ID,
                cash_register_id=register.id,
                expiration_date=register.ofd_expiry_date,
                status='active'
            )
            db.add(ofd_deadline)
    else:
        # Remove OFD deadline if date cleared
        db.query(Deadline).filter(
            Deadline.cash_register_id == register.id,
            Deadline.deadline_type_id == OFD_DEADLINE_TYPE_ID
        ).delete()


@router.get("", response_model=CashRegisterListResponse, summary="List all cash registers")
async def list_cash_registers(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Retrieve all cash registers"""
    registers = db.query(CashRegister).filter(CashRegister.is_active == True).all()
    return CashRegisterListResponse(
        total=len(registers),
        cash_registers=[CashRegisterResponse.model_validate(r) for r in registers]
    )


@router.get("/client/{client_id}", response_model=CashRegisterListResponse, summary="List cash registers by client")
async def list_cash_registers_by_client(
    client_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Retrieve cash registers for a specific client"""
    registers = db.query(CashRegister).filter(
        CashRegister.client_id == client_id,
        CashRegister.is_active == True
    ).all()
    return CashRegisterListResponse(
        total=len(registers),
        cash_registers=[CashRegisterResponse.model_validate(r) for r in registers]
    )


@router.get("/{register_id}", response_model=CashRegisterResponse, summary="Get cash register by ID")
async def get_cash_register(
    register_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Retrieve a specific cash register by ID"""
    register = db.query(CashRegister).filter(CashRegister.id == register_id).first()
    if not register:
        raise HTTPException(status_code=404, detail="Cash register not found")
    return CashRegisterResponse.model_validate(register)


@router.post("", response_model=CashRegisterResponse, status_code=status.HTTP_201_CREATED, summary="Create cash register")
async def create_cash_register(
    data: CashRegisterCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new cash register with auto-deadline creation"""
    # Verify client exists
    client = db.query(User).filter(User.id == data.client_id, User.role == 'client').first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    register = CashRegister(
        client_id=data.client_id,
        factory_number=data.factory_number,
        registration_number=data.registration_number,
        model=data.model,
        register_name=data.register_name,
        installation_address=data.installation_address,
        fn_number=data.fn_number,
        ofd_provider_id=data.ofd_provider_id,
        ofd_expiry_date=data.ofd_expiry_date,
        fn_expiry_date=data.fn_expiry_date,
        notes=data.notes
    )
    db.add(register)
    db.flush()  # Get the ID before creating deadlines
    
    # Auto-create deadlines
    sync_deadlines_for_register(db, register)
    
    db.commit()
    db.refresh(register)
    invalidate_dashboard_cache()
    
    return CashRegisterResponse.model_validate(register)


@router.put("/{register_id}", response_model=CashRegisterResponse, summary="Update cash register")
async def update_cash_register(
    register_id: int,
    data: CashRegisterUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update an existing cash register with auto-deadline sync"""
    register = db.query(CashRegister).filter(CashRegister.id == register_id).first()
    if not register:
        raise HTTPException(status_code=404, detail="Cash register not found")
    
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(register, field, value)
    
    # Sync deadlines after update
    sync_deadlines_for_register(db, register)
    
    db.commit()
    db.refresh(register)
    invalidate_dashboard_cache()
    
    return CashRegisterResponse.model_validate(register)


@router.delete("/{register_id}", response_model=MessageResponse, summary="Delete cash register")
async def delete_cash_register(
    register_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Soft delete a cash register and its deadlines"""
    register = db.query(CashRegister).filter(CashRegister.id == register_id).first()
    if not register:
        raise HTTPException(status_code=404, detail="Cash register not found")
    
    # Delete associated deadlines
    db.query(Deadline).filter(Deadline.cash_register_id == register_id).delete()
    
    register.is_active = False
    db.commit()
    invalidate_dashboard_cache()
    
    return MessageResponse(message="Cash register deleted successfully")


@router.post("/sync-all-deadlines", response_model=MessageResponse, summary="Sync all deadlines")
async def sync_all_deadlines(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Sync deadlines for all active cash registers (admin operation)"""
    registers = db.query(CashRegister).filter(CashRegister.is_active == True).all()
    count = 0
    for register in registers:
        sync_deadlines_for_register(db, register)
        count += 1
    
    db.commit()
    invalidate_dashboard_cache()
    
    return MessageResponse(message=f"Synced deadlines for {count} cash registers")
