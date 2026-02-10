# -*- coding: utf-8 -*-
"""
Модуль конфигурации Telegram бота
Обеспечивает доступ к настройкам бота из основной конфигурации приложения
"""

from backend.config import settings
import logging

logger = logging.getLogger(__name__)


def get_bot_config():
    """
    Получение конфигурации Telegram бота
    
    Returns:
        dict: Словарь с настройками бота
    """
    try:
        config = {
            'telegram_bot_token': settings.telegram_bot_token,
            'telegram_admin_id': settings.telegram_admin_id,
            'telegram_admin_ids': settings.telegram_admin_ids_list,
            'notification_check_time': settings.notification_check_time,
            'notification_timezone': settings.notification_timezone,
            'notification_retry_attempts': settings.notification_retry_attempts,
            'notification_retry_delay': settings.notification_retry_delay,
            'notification_days': settings.notification_days_list,
        }
        
        # Валидация токена
        if not config['telegram_bot_token'] or config['telegram_bot_token'] == 'YOUR_BOT_TOKEN_FROM_BOTFATHER':
            raise ValueError("Не установлен TELEGRAM_BOT_TOKEN в .env файле")
            
        # Валидация ID администратора
        if not config['telegram_admin_ids'] or len(config['telegram_admin_ids']) == 0:
            raise ValueError("Не установлен TELEGRAM_ADMIN_IDS в .env файле")
            
        logger.info("✅ Конфигурация бота загружена успешно")
        return config
        
    except Exception as e:
        logger.error(f"❌ Ошибка загрузки конфигурации бота: {e}")
        raise


def validate_bot_token(token: str) -> bool:
    """
    Валидация формата токена Telegram бота
    
    Args:
        token (str): Токен для проверки
        
    Returns:
        bool: True если токен валиден, False в противном случае
    """
    if not token:
        return False
    
    # Токен обычно содержит цифры, двоеточие и буквы
    parts = token.split(':')
    if len(parts) != 2:
        return False
        
    if not parts[0].isdigit():
        return False
        
    return len(parts[1]) > 20  # Токен обычно длиннее 20 символов



# Создаём экземпляр конфигурации при импорте модуля
bot_config = settings


# Экспорт для удобного импорта
__all__ = ['get_bot_config', 'validate_bot_token', 'bot_config']


if __name__ == "__main__":
    # Тестирование конфигурации
    try:
        config = get_bot_config()
        print("=" * 50)
        print("ТЕСТ КОНФИГУРАЦИИ TELEGRAM БОТА")
        print("=" * 50)
        print(f"Token: {config['telegram_bot_token'][:20]}...")
        print(f"Admin IDs: {config['telegram_admin_ids']}")
        print(f"Check Time: {config['notification_check_time']}")
        print(f"Timezone: {config['notification_timezone']}")
        print(f"Days: {config['notification_days']}")
        print(f"Retry Attempts: {config['notification_retry_attempts']}")
        print(f"Retry Delay: {config['notification_retry_delay']}s")
        print("=" * 50)
        print("✅ Конфигурация загружена успешно")
        print("=" * 50)
    except Exception as e:
        print(f"❌ Ошибка: {e}")