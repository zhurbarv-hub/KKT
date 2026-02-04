"""
Redis Cache Module for KKT System

Provides caching functionality for frequently accessed data like dashboard statistics.
"""

import json
import redis
from typing import Optional, Any
from functools import wraps
import os


# Redis connection settings
REDIS_HOST = os.getenv('REDIS_HOST', 'localhost')
REDIS_PORT = int(os.getenv('REDIS_PORT', 6379))
REDIS_DB = int(os.getenv('REDIS_DB', 0))
REDIS_PASSWORD = os.getenv('REDIS_PASSWORD', None)

# Default cache TTL in seconds
DEFAULT_TTL = 60  # 1 minute

# Cache key prefixes
CACHE_PREFIX = 'kkt:'


class RedisCache:
    """Redis cache wrapper with connection pooling"""
    
    _instance: Optional['RedisCache'] = None
    _pool: Optional[redis.ConnectionPool] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._pool = redis.ConnectionPool(
                host=REDIS_HOST,
                port=REDIS_PORT,
                db=REDIS_DB,
                password=REDIS_PASSWORD,
                decode_responses=True
            )
        return cls._instance
    
    @property
    def client(self) -> redis.Redis:
        return redis.Redis(connection_pool=self._pool)
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        try:
            value = self.client.get(f'{CACHE_PREFIX}{key}')
            if value:
                return json.loads(value)
            return None
        except (redis.RedisError, json.JSONDecodeError) as e:
            print(f'Cache get error: {e}')
            return None
    
    def set(self, key: str, value: Any, ttl: int = DEFAULT_TTL) -> bool:
        """Set value in cache with TTL"""
        try:
            serialized = json.dumps(value, default=str)
            return self.client.setex(f'{CACHE_PREFIX}{key}', ttl, serialized)
        except (redis.RedisError, TypeError) as e:
            print(f'Cache set error: {e}')
            return False
    
    def delete(self, key: str) -> bool:
        """Delete key from cache"""
        try:
            return bool(self.client.delete(f'{CACHE_PREFIX}{key}'))
        except redis.RedisError as e:
            print(f'Cache delete error: {e}')
            return False
    
    def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching pattern"""
        try:
            keys = self.client.keys(f'{CACHE_PREFIX}{pattern}')
            if keys:
                return self.client.delete(*keys)
            return 0
        except redis.RedisError as e:
            print(f'Cache delete_pattern error: {e}')
            return 0
    
    def ping(self) -> bool:
        """Check if Redis is available"""
        try:
            return self.client.ping()
        except redis.RedisError:
            return False


# Global cache instance
cache = RedisCache()


def cached(key_prefix: str, ttl: int = DEFAULT_TTL):
    """
    Decorator for caching function results
    
    Usage:
        @cached('dashboard_summary', ttl=60)
        async def get_dashboard_summary(...):
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            cache_key = key_prefix
            
            # Try to get from cache
            cached_value = cache.get(cache_key)
            if cached_value is not None:
                return cached_value
            
            # Execute function and cache result
            result = await func(*args, **kwargs)
            
            # Convert Pydantic models to dict for serialization
            if hasattr(result, 'model_dump'):
                cache_data = result.model_dump()
            elif hasattr(result, 'dict'):
                cache_data = result.dict()
            else:
                cache_data = result
            
            cache.set(cache_key, cache_data, ttl)
            return result
        
        return wrapper
    return decorator


def invalidate_cache(*keys: str):
    """
    Decorator to invalidate cache keys after function execution
    
    Usage:
        @invalidate_cache('dashboard_summary', 'deadlines:*')
        async def create_deadline(...):
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            result = await func(*args, **kwargs)
            
            # Invalidate specified cache keys
            for key in keys:
                if '*' in key:
                    cache.delete_pattern(key)
                else:
                    cache.delete(key)
            
            return result
        return wrapper
    return decorator


# Cache key constants
class CacheKeys:
    DASHBOARD_SUMMARY = 'dashboard:summary'
    DASHBOARD_STATS_BY_TYPE = 'dashboard:stats:by_type'
    DASHBOARD_STATS_BY_CLIENT = 'dashboard:stats:by_client'
    DEADLINES_URGENT = 'deadlines:urgent:{days}'
    
    @staticmethod
    def user_deadlines(user_id: int) -> str:
        return f'user:{user_id}:deadlines'


# ============================================
# Testing
# ============================================

if __name__ == '__main__':
    print('Testing Redis connection...')
    if cache.ping():
        print('✅ Redis is available')
        
        # Test set/get
        cache.set('test_key', {'foo': 'bar'}, ttl=10)
        value = cache.get('test_key')
        print(f'Test value: {value}')
        
        # Cleanup
        cache.delete('test_key')
        print('✅ Cache operations working')
    else:
        print('❌ Redis is not available')
