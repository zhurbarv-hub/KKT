"""
FastAPI Dependencies for KKT Services Expiration Management System

This module provides reusable dependencies for:
- Database session management
- User authentication and authorization
- Current user extraction from JWT tokens
"""

from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import JWTError

from backend.database import get_db
from backend.models import User
from backend.utils.security import decode_access_token
from backend.schemas import TokenData


# ============================================
# Security Scheme Configuration
# ============================================

# HTTP Bearer token authentication scheme
security = HTTPBearer()


# ============================================
# Authentication Dependencies
# ============================================

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Extract and validate current user from JWT token
    
    This dependency:
    1. Extracts Bearer token from Authorization header
    2. Validates and decodes JWT token
    3. Queries database for user
    4. Returns User object
    
    Args:
        credentials: HTTP Bearer credentials from request header
        db: Database session
    
    Returns:
        User: Authenticated user object
    
    Raises:
        HTTPException: 401 if token invalid or user not found
    
    Usage:
        @app.get("/protected")
        def protected_route(current_user: User = Depends(get_current_user)):
            return {"user": current_user.email}
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Extract token from credentials
        token = credentials.credentials
        
        # Decode token
        payload = decode_access_token(token)
        
        if payload is None:
            raise credentials_exception
        
        # Extract email from token
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        
        token_data = TokenData(
            email=email,
            user_id=payload.get("user_id"),
            role=payload.get("role")
        )
        
    except JWTError:
        raise credentials_exception
    
    # Query user from database
    user = db.query(User).filter(User.email == token_data.email).first()
    
    if user is None:
        raise credentials_exception
    
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Ensure current user is active
    
    This dependency checks that the authenticated user has is_active=True
    
    Args:
        current_user: User object from get_current_user dependency
    
    Returns:
        User: Active user object
    
    Raises:
        HTTPException: 403 if user is inactive
    
    Usage:
        @app.get("/active-only")
        def active_route(user: User = Depends(get_current_active_user)):
            return {"user": user.email}
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    
    return current_user


async def get_current_admin_user(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    Ensure current user has admin role
    
    This dependency checks that the user has role='admin'
    
    Args:
        current_user: Active user object from get_current_active_user
    
    Returns:
        User: Admin user object
    
    Raises:
        HTTPException: 403 if user is not admin
    
    Usage:
        @app.delete("/admin-only")
        def admin_route(user: User = Depends(get_current_admin_user)):
            return {"message": "Admin access granted"}
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    return current_user


# ============================================
# Optional Authentication
# ============================================

async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Extract user from token if provided, otherwise return None
    
    This dependency allows endpoints to work both with and without authentication
    
    Args:
        credentials: Optional HTTP Bearer credentials
        db: Database session
    
    Returns:
        Optional[User]: User object if authenticated, None otherwise
    
    Usage:
        @app.get("/public-or-private")
        def flexible_route(user: Optional[User] = Depends(get_optional_user)):
            if user:
                return {"message": f"Hello {user.email}"}
            return {"message": "Hello guest"}
    """
    if credentials is None:
        return None
    
    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        
        if payload is None:
            return None
        
        email = payload.get("sub")
        if email is None:
            return None
        
        user = db.query(User).filter(User.email == email).first()
        return user
        
    except JWTError:
        return None


# ============================================
# Pagination Dependencies
# ============================================

class PaginationParams:
    """
    Pagination parameters for list endpoints
    
    Attributes:
        page: Page number (1-indexed)
        limit: Items per page (max 100)
    """
    def __init__(self, page: int = 1, limit: int = 50):
        self.page = max(1, page)  # Minimum page 1
        self.limit = min(100, max(1, limit))  # Between 1 and 100
        
    @property
    def offset(self) -> int:
        """Calculate offset for database query"""
        return (self.page - 1) * self.limit


def get_pagination_params(page: int = 1, limit: int = 50) -> PaginationParams:
    """
    Dependency for pagination parameters
    
    Args:
        page: Page number (default: 1)
        limit: Items per page (default: 50, max: 100)
    
    Returns:
        PaginationParams: Validated pagination parameters
    
    Usage:
        @app.get("/items")
        def list_items(
            pagination: PaginationParams = Depends(get_pagination_params),
            db: Session = Depends(get_db)
        ):
            items = db.query(Item).offset(pagination.offset).limit(pagination.limit).all()
            return items
    """
    return PaginationParams(page=page, limit=limit)


# ============================================
# Query Filter Dependencies
# ============================================

class UserFilterParams:
    """
    Filter parameters for user list endpoint (replaces ClientFilterParams)
    
    Attributes:
        role: Filter by user role (client/manager/admin)
        search: Search query for name, email, INN, or company name
        active_only: Filter only active users
    """
    def __init__(
        self,
        role: Optional[str] = None,
        search: Optional[str] = None,
        active_only: bool = True
    ):
        self.role = role
        self.search = search
        self.active_only = active_only


def get_user_filter_params(
    role: Optional[str] = None,
    search: Optional[str] = None,
    active_only: bool = True
) -> UserFilterParams:
    """
    Dependency for user filter parameters
    
    Args:
        role: Optional role filter (client/manager/admin)
        search: Optional search query
        active_only: Whether to show only active users
    
    Returns:
        UserFilterParams: Filter parameters
    """
    return UserFilterParams(role=role, search=search, active_only=active_only)


def get_client_filter_params(
    search: Optional[str] = None,
    active_only: bool = True
) -> UserFilterParams:
    """
    DEPRECATED: Use get_user_filter_params instead
    
    Legacy dependency for backward compatibility
    Filters users with role='client'
    """
    return UserFilterParams(role='client', search=search, active_only=active_only)


class DeadlineFilterParams:
    """
    Filter parameters for deadline list endpoint
    
    Attributes:
        client_id: Filter by user (client) - DEPRECATED, use user_id
        user_id: Filter by user (client)
        deadline_type_id: Filter by deadline type
        status: Filter by status color
        sort_by: Sort field
        order: Sort order (asc/desc)
    """
    def __init__(
        self,
        client_id: Optional[int] = None,  # Legacy parameter
        user_id: Optional[int] = None,
        deadline_type_id: Optional[int] = None,
        status: Optional[str] = None,
        sort_by: str = "expiration_date",
        order: str = "asc"
    ):
        # Support both client_id (legacy) and user_id
        self.client_id = user_id or client_id  # client_id used for backward compatibility
        self.user_id = user_id or client_id
        self.deadline_type_id = deadline_type_id
        self.status = status
        self.sort_by = sort_by
        self.order = order.lower() if order else "asc"


def get_deadline_filter_params(
    client_id: Optional[int] = None,  # Legacy parameter
    user_id: Optional[int] = None,
    deadline_type_id: Optional[int] = None,
    status: Optional[str] = None,
    sort_by: str = "expiration_date",
    order: str = "asc"
) -> DeadlineFilterParams:
    """
    Dependency for deadline filter parameters
    
    Args:
        client_id: DEPRECATED - Use user_id instead (kept for backward compatibility)
        user_id: Optional user ID filter
        deadline_type_id: Optional deadline type ID filter
        status: Optional status filter (green/yellow/red/expired)
        sort_by: Sort field (default: expiration_date)
        order: Sort order (default: asc)
    
    Returns:
        DeadlineFilterParams: Filter parameters
    """
    return DeadlineFilterParams(
        client_id=client_id,
        user_id=user_id,
        deadline_type_id=deadline_type_id,
        status=status,
        sort_by=sort_by,
        order=order
    )


# ============================================
# Resource Validation Dependencies
# ============================================

def get_user_or_404(user_id: int, db: Session = Depends(get_db)):
    """
    Get user by ID or raise 404
    
    Args:
        user_id: User ID to fetch
        db: Database session
    
    Returns:
        User: User object
    
    Raises:
        HTTPException: 404 if user not found
    
    Usage:
        @app.get("/users/{user_id}")
        def get_user_details(user = Depends(get_user_or_404)):
            return user
    """
    user = db.query(User).filter(User.id == user_id).first()
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Пользователь с ID {user_id} не найден"
        )
    
    return user


def get_deadline_or_404(deadline_id: int, db: Session = Depends(get_db)):
    """
    Get deadline by ID or raise 404
    
    Args:
        deadline_id: Deadline ID to fetch
        db: Database session
    
    Returns:
        Deadline: Deadline object
    
    Raises:
        HTTPException: 404 if deadline not found
    """
    from backend.models import Deadline
    
    deadline = db.query(Deadline).filter(Deadline.id == deadline_id).first()
    
    if deadline is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Дедлайн с ID {deadline_id} не найден"
        )
    
    return deadline


# ============================================
# Testing
# ============================================

if __name__ == "__main__":
    print("=" * 60)
    print("МОДУЛЬ ЗАВИСИМОСТЕЙ FASTAPI")
    print("=" * 60)
    
    print("\nДоступные зависимости:")
    print("  • get_current_user - Извлечение текущего пользователя из токена")
    print("  • get_current_active_user - Проверка активности пользователя")
    print("  • get_current_admin_user - Проверка прав администратора")
    print("  • get_optional_user - Опциональная аутентификация")
    print("  • get_pagination_params - Параметры пагинации")
    print("  • get_user_filter_params - Фильтры для списка пользователей")
    print("  • get_deadline_filter_params - Фильтры для списка дедлайнов")
    print("  • get_user_or_404 - Получение пользователя или 404")
    print("  • get_deadline_or_404 - Получение дедлайна или 404")
    
    print("\n" + "=" * 60)
    print("✅ МОДУЛЬ ГОТОВ К ИСПОЛЬЗОВАНИЮ")
    print("=" * 60)
