# -*- coding: utf-8 -*-
"""
Менеджер JWT токенов для аутентификации бота с Web API
Автоматически обновляет токены при истечении срока действия
"""

import asyncio
import aiohttp
import logging
from datetime import datetime, timedelta
from typing import Optional
from .exceptions import TokenRefreshError

logger = logging.getLogger(__name__)


class TokenManager:
    """
    Управление жизненным циклом JWT токенов
    
    Attributes:
        api_base_url: Базовый URL Web API
        username: Имя пользователя для аутентификации
        password: Пароль пользователя
        refresh_interval: Интервал обновления токена (секунды)
    """
    
    def __init__(
        self,
        api_base_url: str,
        username: str,
        password: str,
        refresh_interval: int = 3600
    ):
        """
        Инициализация менеджера токенов
        
        Args:
            api_base_url: URL Web API (например, http://localhost:8000)
            username: Имя пользователя бота
            password: Пароль бота
            refresh_interval: Время жизни токена в секундах (по умолчанию 1 час)
        """
        self.api_base_url = api_base_url.rstrip('/')
        self.username = username
        self.password = password
        self.refresh_interval = refresh_interval
        
        self._token: Optional[str] = None
        self._token_expires_at: Optional[datetime] = None
        self._lock = asyncio.Lock()
        
        logger.info(f"TokenManager инициализирован для {api_base_url}")
    
    async def get_token(self) -> str:
        """
        Получение валидного JWT токена
        
        Автоматически обновляет токен если он истёк или отсутствует.
        Потокобезопасно благодаря asyncio.Lock.
        
        Returns:
            str: Валидный JWT токен
            
        Raises:
            TokenRefreshError: Если не удалось получить токен
        """
        # Проверяем валидность текущего токена
        if self._is_token_valid():
            logger.debug("Используется кэшированный токен")
            return self._token
        
        # Обновляем токен (потокобезопасно)
        async with self._lock:
            # Двойная проверка после получения блокировки
            if self._is_token_valid():
                return self._token
            
            logger.info("Обновление JWT токена...")
            await self._refresh_token()
            return self._token
    
    def _is_token_valid(self) -> bool:
        """
        Проверка валидности токена
        
        Returns:
            bool: True если токен существует и не истёк
        """
        if self._token is None or self._token_expires_at is None:
            return False
        
        # Добавляем буфер 60 секунд перед истечением
        return datetime.now() < (self._token_expires_at - timedelta(seconds=60))
    
    async def _refresh_token(self):
        """
        Обновление JWT токена через API
        
        Raises:
            TokenRefreshError: Если не удалось получить токен
        """
        login_url = f"{self.api_base_url}/api/auth/login"
        
        try:
            async with aiohttp.ClientSession() as session:
                # Отправляем запрос на авторизацию
                async with session.post(
                    login_url,
                    json={
                        "email": self.username,
                        "password": self.password
                    },
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    
                    if response.status == 200:
                        data = await response.json()
                        self._token = data.get('access_token')
                        
                        if not self._token:
                            raise TokenRefreshError("Токен отсутствует в ответе API")
                        
                        # Устанавливаем время истечения
                        self._token_expires_at = datetime.now() + timedelta(
                            seconds=self.refresh_interval
                        )
                        
                        logger.info(
                            f"✅ Токен успешно обновлён. "
                            f"Истекает в {self._token_expires_at.strftime('%H:%M:%S')}"
                        )
                    
                    elif response.status == 401:
                        error_text = await response.text()
                        raise TokenRefreshError(
                            f"Неверные учётные данные бота: {error_text}"
                        )
                    
                    else:
                        error_text = await response.text()
                        raise TokenRefreshError(
                            f"HTTP {response.status}: {error_text}"
                        )
        
        except aiohttp.ClientError as e:
            logger.error(f"Ошибка подключения к API: {e}")
            raise TokenRefreshError(f"Не удалось подключиться к {login_url}: {e}")
        
        except Exception as e:
            logger.error(f"Неожиданная ошибка при обновлении токена: {e}")
            raise TokenRefreshError(f"Ошибка обновления токена: {e}")
    
    async def invalidate_token(self):
        """Принудительная инвалидация токена (например, при 401 ошибке)"""
        async with self._lock:
            logger.warning("Токен инвалидирован принудительно")
            self._token = None
            self._token_expires_at = None


# Для тестирования
if __name__ == "__main__":
    import sys
    
    async def test_token_manager():
        """Тестирование менеджера токенов"""
        print("=" * 60)
        print("ТЕСТ TOKEN MANAGER")
        print("=" * 60)
        
        # Инициализация
        manager = TokenManager(
            api_base_url="http://localhost:8000",
            username="admin",  # Замените на реальные данные
            password="admin",
            refresh_interval=3600
        )
        
        try:
            # Получение токена
            token = await manager.get_token()
            print(f"✅ Токен получен: {token[:30]}...")
            
            # Повторное получение (должен использовать кэш)
            token2 = await manager.get_token()
            print(f"✅ Кэшированный токен: {token2[:30]}...")
            
            assert token == token2, "Токены должны совпадать!"
            
            print("\n" + "=" * 60)
            print("✅ ВСЕ ТЕСТЫ ПРОЙДЕНЫ")
            print("=" * 60)
        
        except Exception as e:
            print(f"\n❌ ОШИБКА: {e}")
            sys.exit(1)
    
    # Запуск теста
    asyncio.run(test_token_manager())