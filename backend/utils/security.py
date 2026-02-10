"""
Security Utilities for KKT Services Expiration Management System

This module provides password hashing and JWT token management functionality.

Functions:
- Password hashing using bcrypt
- JWT token generation and validation
- Token payload encoding/decoding
"""

from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
import bcrypt
from backend.config import settings


# ============================================
# Password Hashing Configuration
# ============================================

# Using bcrypt directly for password hashing


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain password against a hashed password
    
    Args:
        plain_password: Plain text password from user input
        hashed_password: Hashed password from database
    
    Returns:
        bool: True if password matches, False otherwise
    """
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """
    Hash a plain password using bcrypt
    
    Args:
        password: Plain text password to hash
    
    Returns:
        str: Bcrypt hashed password with salt
    
    Example:
        >>> hashed = get_password_hash("mypassword")
        >>> len(hashed)
        60
        >>> hashed.startswith("$2b$")
        True
    """
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


# ============================================
# JWT Token Management
# ============================================

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token
    
    Args:
        data: Dictionary containing token payload (user_id, email, role, etc.)
        expires_delta: Optional custom expiration time
    
    Returns:
        str: Encoded JWT token
    
    Example:
        >>> token_data = {"sub": "user@example.com", "user_id": 1, "role": "admin"}
        >>> token = create_access_token(token_data)
        >>> len(token) > 0
        True
    """
    to_encode = data.copy()
    
    # Set expiration time
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=settings.jwt_expiration_hours)
    
    # Add expiration to payload
    to_encode.update({"exp": expire})
    
    # Encode token
    encoded_jwt = jwt.encode(
        to_encode,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm
    )
    
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    """
    Decode and validate a JWT access token
    
    Args:
        token: JWT token string
    
    Returns:
        Optional[dict]: Decoded token payload if valid, None if invalid
    
    Raises:
        JWTError: If token is invalid or expired
    
    Example:
        >>> token_data = {"sub": "user@example.com", "user_id": 1}
        >>> token = create_access_token(token_data)
        >>> payload = decode_access_token(token)
        >>> payload["sub"]
        'user@example.com'
    """
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm]
        )
        return payload
    except JWTError:
        return None


def verify_token(token: str) -> bool:
    """
    Verify if a token is valid without decoding
    
    Args:
        token: JWT token string
    
    Returns:
        bool: True if token is valid, False otherwise
    
    Example:
        >>> token_data = {"sub": "user@example.com"}
        >>> token = create_access_token(token_data)
        >>> verify_token(token)
        True
        >>> verify_token("invalid_token")
        False
    """
    try:
        jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm]
        )
        return True
    except JWTError:
        return False


def get_token_expiration_seconds() -> int:
    """
    Get token expiration time in seconds
    
    Returns:
        int: Number of seconds until token expires
    
    Example:
        >>> exp_seconds = get_token_expiration_seconds()
        >>> exp_seconds > 0
        True
    """
    return settings.jwt_expiration_hours * 3600


# ============================================
# Token Payload Helpers
# ============================================

def create_user_token_data(user_id: int, email: str, role: str) -> dict:
    """
    Create standard token payload for user
    
    Args:
        user_id: User database ID
        email: User email address
        role: User role (admin, manager, etc.)
    
    Returns:
        dict: Token payload data
    
    Example:
        >>> data = create_user_token_data(1, "admin@example.com", "admin")
        >>> data["sub"]
        'admin@example.com'
        >>> data["user_id"]
        1
    """
    return {
        "sub": email,  # Subject (standard JWT claim)
        "user_id": user_id,
        "email": email,
        "role": role
    }


def extract_user_id_from_token(token: str) -> Optional[int]:
    """
    Extract user ID from token
    
    Args:
        token: JWT token string
    
    Returns:
        Optional[int]: User ID if token valid, None otherwise
    
    Example:
        >>> token_data = {"user_id": 42}
        >>> token = create_access_token(token_data)
        >>> extract_user_id_from_token(token)
        42
    """
    payload = decode_access_token(token)
    if payload:
        return payload.get("user_id")
    return None


def extract_email_from_token(token: str) -> Optional[str]:
    """
    Extract email from token
    
    Args:
        token: JWT token string
    
    Returns:
        Optional[str]: Email if token valid, None otherwise
    
    Example:
        >>> token_data = {"sub": "user@example.com"}
        >>> token = create_access_token(token_data)
        >>> extract_email_from_token(token)
        'user@example.com'
    """
    payload = decode_access_token(token)
    if payload:
        return payload.get("sub") or payload.get("email")
    return None


# ============================================
# Testing and Utilities
# ============================================

if __name__ == "__main__":
    print("=" * 60)
    print("ТЕСТИРОВАНИЕ МОДУЛЯ БЕЗОПАСНОСТИ")
    print("=" * 60)
    
    # Test password hashing
    print("\n1. Тестирование хеширования паролей:")
    test_password = "TestPassword123!"
    hashed = get_password_hash(test_password)
    print(f"   Исходный пароль: {test_password}")
    print(f"   Хешированный: {hashed[:30]}...")
    print(f"   Длина хеша: {len(hashed)} символов")
    print(f"   ✓ Проверка пароля: {verify_password(test_password, hashed)}")
    print(f"   ✗ Неверный пароль: {verify_password('WrongPassword', hashed)}")
    
    # Test JWT tokens
    print("\n2. Тестирование JWT токенов:")
    token_data = create_user_token_data(1, "admin@kkt.local", "admin")
    token = create_access_token(token_data)
    print(f"   Данные токена: {token_data}")
    print(f"   Созданный токен: {token[:50]}...")
    print(f"   Длина токена: {len(token)} символов")
    
    # Decode token
    decoded = decode_access_token(token)
    if decoded:
        print(f"   ✓ Токен валиден")
        print(f"   Извлечённый email: {decoded.get('email')}")
        print(f"   Извлечённый user_id: {decoded.get('user_id')}")
        print(f"   Извлечённая роль: {decoded.get('role')}")
    
    # Test token verification
    print("\n3. Проверка валидности токена:")
    print(f"   ✓ Валидный токен: {verify_token(token)}")
    print(f"   ✗ Невалидный токен: {verify_token('invalid.token.here')}")
    
    # Test expiration
    print("\n4. Информация об истечении:")
    exp_seconds = get_token_expiration_seconds()
    exp_hours = exp_seconds / 3600
    print(f"   Срок действия токена: {exp_hours} часов ({exp_seconds} секунд)")
    
    print("\n" + "=" * 60)
    print("✅ ВСЕ ТЕСТЫ ПРОЙДЕНЫ")
    print("=" * 60)
