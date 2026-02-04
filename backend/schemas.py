"""
Pydantic Schemas for KKT Services Expiration Management System

This module defines Pydantic models for request validation, response serialization,
and automatic API documentation generation.

Schemas serve three critical functions:
1. Request Validation - Validate incoming API data before processing
2. Response Serialization - Format database objects for API responses
3. Documentation - Auto-generate API documentation with examples
"""

from pydantic import BaseModel, Field, EmailStr, validator, ConfigDict
from typing import Optional, List
from datetime import date, datetime
import re


# ============================================
# Authentication Schemas
# ============================================

class LoginRequest(BaseModel):
    """User login credentials"""
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., min_length=8, description="User password (minimum 8 characters)")


class Token(BaseModel):
    """JWT token response"""
    access_token: str = Field(..., description="JWT access token")
    token_type: str = Field(default="bearer", description="Token type")
    expires_in: int = Field(..., description="Token expiration time in seconds")


class TokenData(BaseModel):
    """Decoded JWT token payload"""
    email: Optional[str] = None
    user_id: Optional[int] = None
    role: Optional[str] = None


# ============================================
# User Schemas (Unified: includes clients, managers, admins)
# ============================================

class UserBase(BaseModel):
    """
    Base user fields for all user types (clients, managers, admins)
    
    For clients (role='client'):
    - inn and company_name are required
    - Can have Telegram integration
    - Has notification settings
    
    For support (role='manager' or 'admin'):
    - inn and company_name should be None
    - No Telegram integration needed
    - No notification settings
    """
    email: EmailStr = Field(..., description="User email address (unique)")
    full_name: str = Field(..., min_length=1, max_length=255, description="Full name or contact person name")
    role: str = Field(default="client", description="User role: client, manager, admin")
    
    # Client-specific fields (NULL for managers/admins)
    inn: Optional[str] = Field(None, description="Tax identification number (10 or 12 digits) - only for clients")
    company_name: Optional[str] = Field(None, max_length=255, description="Organization name - only for clients")
    
    # Contact information (for all users)
    phone: Optional[str] = Field(None, max_length=20, description="Contact phone number")
    address: Optional[str] = Field(None, description="Physical address")
    notes: Optional[str] = Field(None, description="Additional notes")
    
    # Notification settings (only for clients)
    notification_days: str = Field(default='14,7,3', description="Comma-separated notification days (e.g., '30,14,7,3')")
    notifications_enabled: bool = Field(default=True, description="Enable/disable notifications")
    
    @validator('role')
    def validate_role(cls, v):
        """Validate role values"""
        if v not in ['client', 'manager', 'admin']:
            raise ValueError("Role must be one of: client, manager, admin")
        return v
    
    @validator('inn')
    def validate_inn(cls, v, values):
        """Validate INN format if provided (required for clients)"""
        if v is None:
            # INN is required for clients
            if values.get('role') == 'client':
                raise ValueError('INN is required for client users')
            return v
        
        # Validate INN format
        v = v.strip()
        if not v.isdigit():
            raise ValueError('INN must contain only digits')
        if len(v) not in [10, 12]:
            raise ValueError('INN must be exactly 10 or 12 digits')
        return v
    
    @validator('phone')
    def validate_phone(cls, v):
        """Validate Russian phone format: +7XXXXXXXXXX"""
        if v is None:
            return v
        v = v.replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
        if not re.match(r'^\+?7\d{10}$', v):
            raise ValueError('Phone must be in format: +7XXXXXXXXXX')
        return v
    
    @validator('notification_days')
    def validate_notification_days(cls, v):
        """Validate and sort notification days"""
        try:
            days = [int(day.strip()) for day in v.split(',') if day.strip()]
            if not days:
                raise ValueError('At least one notification day is required')
            if any(day < 1 or day > 365 for day in days):
                raise ValueError('Notification days must be between 1 and 365')
            # Sort descending and remove duplicates
            return ','.join(map(str, sorted(set(days), reverse=True)))
        except ValueError as e:
            if 'invalid literal' in str(e):
                raise ValueError('Invalid format. Use comma-separated numbers: "30,14,7,3"')
            raise


class UserCreate(UserBase):
    """
    Schema for creating new user
    
    For clients: password is optional (can register later via Telegram)
    For managers/admins: password is required
    """
    password: Optional[str] = Field(None, min_length=8, description="User password (optional for clients)")
    
    @validator('password')
    def validate_password(cls, v, values):
        """Password required for managers/admins, optional for clients"""
        role = values.get('role')
        if role in ['manager', 'admin'] and not v:
            raise ValueError('Password is required for manager and admin users')
        return v


class UserUpdate(BaseModel):
    """
    Schema for updating user (all fields optional)
    Allows partial updates to any user field
    """
    email: Optional[EmailStr] = None
    full_name: Optional[str] = Field(None, max_length=255)
    role: Optional[str] = None
    password: Optional[str] = Field(None, min_length=8)
    
    # Client fields
    inn: Optional[str] = None
    company_name: Optional[str] = Field(None, max_length=255)
    
    # Contact info
    phone: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = None
    notes: Optional[str] = None
    
    # Notification settings
    notification_days: Optional[str] = None
    notifications_enabled: Optional[bool] = None
    
    # Status
    is_active: Optional[bool] = None
    
    # Same validators as UserBase
    @validator('role')
    def validate_role(cls, v):
        if v is not None and v not in ['client', 'manager', 'admin']:
            raise ValueError("Role must be one of: client, manager, admin")
        return v
    
    @validator('inn')
    def validate_inn(cls, v):
        if v is None:
            return v
        v = v.strip()
        if not v.isdigit():
            raise ValueError('INN must contain only digits')
        if len(v) not in [10, 12]:
            raise ValueError('INN must be exactly 10 or 12 digits')
        return v
    
    @validator('phone')
    def validate_phone(cls, v):
        if v is None:
            return v
        v = v.replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
        if not re.match(r'^\+?7\d{10}$', v):
            raise ValueError('Phone must be in format: +7XXXXXXXXXX')
        return v
    
    @validator('notification_days')
    def validate_notification_days(cls, v):
        if v is None:
            return v
        try:
            days = [int(day.strip()) for day in v.split(',') if day.strip()]
            if not days:
                raise ValueError('At least one notification day is required')
            if any(day < 1 or day > 365 for day in days):
                raise ValueError('Notification days must be between 1 and 365')
            return ','.join(map(str, sorted(set(days), reverse=True)))
        except ValueError as e:
            if 'invalid literal' in str(e):
                raise ValueError('Invalid format. Use comma-separated numbers: "30,14,7,3"')
            raise


class UserResponse(BaseModel):
    """
    Schema for user API response
    Includes all user fields for comprehensive data access
    """
    id: int
    email: EmailStr
    full_name: str
    role: str
    
    # Client-specific fields
    inn: Optional[str] = None
    company_name: Optional[str] = None
    
    # Contact information
    phone: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    
    # Telegram integration
    telegram_id: Optional[str] = None
    telegram_username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    registration_code: Optional[str] = None
    code_expires_at: Optional[datetime] = None
    
    # Notification settings
    notification_days: str = '14,7,3'
    notifications_enabled: bool = True
    
    # Status and metadata
    is_active: bool
    registered_at: datetime
    last_interaction: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class UserWithDetails(UserResponse):
    """
    Schema for user with nested deadlines
    Used for detailed user view with all related data
    """
    deadlines: List['DeadlineResponse'] = []
    
    model_config = ConfigDict(from_attributes=True)


class UserListResponse(BaseModel):
    """Paginated list of users"""
    total: int = Field(..., description="Total number of matching users")
    page: int = Field(..., description="Current page number")
    limit: int = Field(..., description="Items per page")
    users: List[UserResponse] = Field(..., description="List of users")


# ============================================
# DEPRECATED: Client Schemas (Replaced by User schemas)
# ============================================
# Clients are now unified with Users (role='client')
# Use UserBase, UserCreate, UserUpdate, UserResponse instead
# These schemas kept temporarily for backward compatibility

"""
class ClientBase(BaseModel):
    # Base client fields
    name: str = Field(..., min_length=1, max_length=255, description="Client organization name")
    inn: str = Field(..., description="Tax identification number (10 or 12 digits)")
    contact_person: Optional[str] = Field(None, max_length=255, description="Primary contact person")
    phone: Optional[str] = Field(None, max_length=20, description="Contact phone number")
    email: Optional[EmailStr] = Field(None, description="Contact email address")
    address: Optional[str] = Field(None, description="Physical address")
    notes: Optional[str] = Field(None, description="Additional notes")


class ClientCreate(ClientBase):
    # Schema for creating new client
    pass


class ClientUpdate(BaseModel):
    # Schema for updating client (all fields optional)
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    inn: Optional[str] = None
    contact_person: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class ClientResponse(ClientBase):
    # Schema for client API response
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class ClientWithDetails(ClientResponse):
    # Schema for client with nested deadlines and contacts
    deadlines: List['DeadlineResponse'] = []
    contacts: List['ContactResponse'] = []
    
    model_config = ConfigDict(from_attributes=True)
"""  # End of deprecated Client schemas


# ============================================
# Deadline Type Schemas
# ============================================

class DeadlineTypeBase(BaseModel):
    """Base deadline type fields"""
    type_name: str = Field(..., min_length=1, max_length=100, description="Service type name")
    description: Optional[str] = Field(None, description="Type description")


class DeadlineTypeCreate(DeadlineTypeBase):
    """Schema for creating new deadline type"""
    pass


class DeadlineTypeResponse(DeadlineTypeBase):
    """Schema for deadline type API response"""
    id: int
    is_system: bool
    is_active: bool
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# ============================================
# Deadline Schemas
# ============================================

class DeadlineBase(BaseModel):
    """
    Base deadline fields for KKT service expiration tracking
    Updated to use user_id instead of client_id (clients are now users with role='client')
    """
    user_id: int = Field(..., description="Reference to user (client with role='client')")
    deadline_type_id: int = Field(..., description="Reference to deadline type")
    expiration_date: date = Field(..., description="Service expiration date")
    notes: Optional[str] = Field(None, description="Additional notes")


class DeadlineCreate(DeadlineBase):
    """Schema for creating new deadline"""
    
    @validator('expiration_date')
    def validate_future_date(cls, v):
        """Warn if expiration date is in the past (but allow it)"""
        if v < date.today():
            # For new deadlines, we warn but don't reject past dates
            # as they might be importing historical data
            pass
        return v


class DeadlineUpdate(BaseModel):
    """Schema for updating deadline (all fields optional)"""
    user_id: Optional[int] = Field(None, description="Reference to user")
    deadline_type_id: Optional[int] = None
    expiration_date: Optional[date] = None
    status: Optional[str] = Field(None, description="Deadline status (active, expired, renewed)")
    notes: Optional[str] = None
    
    @validator('status')
    def validate_status(cls, v):
        """Validate status values"""
        if v is not None and v not in ['active', 'expired', 'renewed']:
            raise ValueError("Status must be one of: active, expired, renewed")
        return v


class DeadlineResponse(BaseModel):
    """
    Schema for deadline API response with calculated fields
    Now includes user information instead of client
    """
    id: int
    user_id: Optional[int] = None
    deadline_type_id: int
    expiration_date: date
    notes: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime
    
    # Calculated fields
    days_until_expiration: Optional[int] = Field(None, description="Days remaining until expiration")
    status_color: str = Field(default='unknown', description="Status color indicator (green/yellow/red/expired)")
    
    # Nested object names (populated from relationships)
    user_name: Optional[str] = Field(None, description="User display name (company or full name)")
    company_name: Optional[str] = Field(None, description="Company name for client users")
    deadline_type_name: Optional[str] = Field(None, description="Deadline type name")
    
    # Legacy compatibility field (deprecated)
    client_name: Optional[str] = Field(None, description="DEPRECATED: Use user_name instead")
    
    model_config = ConfigDict(from_attributes=True)


# ============================================
# DEPRECATED: Contact Schemas (Replaced by User schemas)
# ============================================
# Contacts are now unified with Users (Telegram fields in User model)
# Use User model's telegram_id, telegram_username, first_name, last_name instead
# These schemas kept temporarily for backward compatibility

"""
class ContactBase(BaseModel):
    # Base contact fields
    telegram_id: str = Field(..., max_length=50, description="Telegram user ID")
    telegram_username: Optional[str] = Field(None, max_length=100, description="Telegram username")
    first_name: Optional[str] = Field(None, max_length=100, description="First name")
    last_name: Optional[str] = Field(None, max_length=100, description="Last name")


class ContactCreate(ContactBase):
    # Schema for creating new contact
    client_id: int = Field(..., description="Reference to client")


class ContactUpdate(BaseModel):
    # Schema for updating contact
    telegram_username: Optional[str] = Field(None, max_length=100)
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    notifications_enabled: Optional[bool] = None


class ContactResponse(ContactBase):
    # Schema for contact API response
    id: int
    client_id: int
    notifications_enabled: bool
    registered_at: datetime
    last_interaction: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)
"""  # End of deprecated Contact schemas


# ============================================
# Notification Log Schemas
# ============================================

class NotificationLogResponse(BaseModel):
    """Schema for notification log API response"""
    id: int
    deadline_id: int
    recipient_telegram_id: str
    message_text: str
    status: str
    sent_at: datetime
    error_message: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


# ============================================
# Dashboard Schemas
# ============================================

class StatusBreakdown(BaseModel):
    """Status count breakdown"""
    green: int = Field(default=0, description="Deadlines > 14 days")
    yellow: int = Field(default=0, description="Deadlines 7-14 days")
    red: int = Field(default=0, description="Deadlines < 7 days")
    expired: int = Field(default=0, description="Expired deadlines")


class UrgentDeadline(BaseModel):
    """Urgent deadline summary"""
    client_name: str
    deadline_type: str
    expiration_date: date
    days_remaining: int


class DashboardSummary(BaseModel):
    """Dashboard statistics summary"""
    total_clients: int = Field(default=0, description="Total number of clients")
    active_clients: int = Field(default=0, description="Number of active clients")
    total_deadlines: int = Field(default=0, description="Total number of deadlines")
    status_breakdown: StatusBreakdown = Field(default_factory=StatusBreakdown, description="Breakdown by status")
    urgent_deadlines: List[UrgentDeadline] = Field(default_factory=list, description="Most urgent deadlines")


# ============================================
# Pagination Schemas
# ============================================

class PaginatedResponse(BaseModel):
    """Generic paginated response"""
    total: int = Field(..., description="Total number of items")
    page: int = Field(..., description="Current page number")
    limit: int = Field(..., description="Items per page")
    items: List = Field(default_factory=list, description="List of items")


# ============================================
# DEPRECATED: Pagination Schemas (Use UserListResponse instead)
# ============================================
# ClientListResponse is deprecated - use UserListResponse with role filter

"""
class ClientListResponse(BaseModel):
    # Paginated client list response
    total: int
    page: int
    limit: int
    clients: List[ClientResponse]
"""  # End of deprecated ClientListResponse


class DeadlineListResponse(BaseModel):
    """Paginated deadline list response"""
    total: int
    page: int
    limit: int
    deadlines: List[DeadlineResponse]


# ============================================
# Error Response Schemas
# ============================================

class ErrorDetail(BaseModel):
    """Error detail for validation errors"""
    field: str = Field(..., description="Field name that caused error")
    message: str = Field(..., description="Error message")


class ErrorResponse(BaseModel):
    """Standard error response"""
    error: dict = Field(..., description="Error information")
    
    class Config:
        json_schema_extra = {
            "example": {
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Invalid input data",
                    "details": [
                        {
                            "field": "inn",
                            "message": "INN must be exactly 10 or 12 digits"
                        }
                    ]
                }
            }
        }



# ============================================
# Generic Success Response
# ============================================

class MessageResponse(BaseModel):
    """Generic success message response"""
    message: str = Field(..., description="Success message")
    id: Optional[int] = Field(None, description="ID of created/updated resource")


# Update forward references for schemas with nested relationships
UserWithDetails.model_rebuild()
DeadlineResponse.model_rebuild()
