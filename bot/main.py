"""
Главный модуль запуска Telegram бота
Инициализация бота, диспетчера, middleware, API клиента и запуск polling

Обновлено: Redis storage для FSM состояний
"""
import asyncio
import logging
import os
from aiogram import Bot, Dispatcher
from aiogram.enums import ParseMode
from aiogram.client.default import DefaultBotProperties

from bot.config import bot_config
from bot.middlewares.auth import AuthMiddleware
from bot.middlewares.logging import LoggingMiddleware

# Импорт обработчиков
from bot.handlers import common, admin, deadlines, registration
from bot.handlers import settings as settings_handler
from bot.handlers import search, export, client_buttons

from bot.scheduler import setup_scheduler
from backend.database import SessionLocal
from backend.config import settings

# Импорт API клиента
from bot.services.token_manager import TokenManager
from bot.services.api_client import WebAPIClient
from bot.services import checker
from bot.services.integrity import enforce_bot_integrity

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/bot.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)


# Redis configuration
REDIS_HOST = os.getenv('REDIS_HOST', 'localhost')
REDIS_PORT = int(os.getenv('REDIS_PORT', 6379))
REDIS_DB = int(os.getenv('REDIS_DB', 1))  # Use DB 1 for bot FSM


def create_bot() -> Bot:
    """
    Создание экземпляра бота с валидированной конфигурацией
    
    Returns:
        Bot: Настроенный экземпляр бота
    """
    return Bot(
        token=bot_config.telegram_bot_token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML)
    )


def create_dispatcher() -> Dispatcher:
    """
    Создание диспетчера для обработки обновлений
    Использует Redis storage для персистентных FSM состояний
    
    Returns:
        Dispatcher: Настроенный диспетчер
    """
    try:
        from aiogram.fsm.storage.redis import RedisStorage
        from redis.asyncio import Redis
        
        redis_client = Redis(
            host=REDIS_HOST,
            port=REDIS_PORT,
            db=REDIS_DB,
            decode_responses=True
        )
        storage = RedisStorage(redis=redis_client)
        logger.info(f"✅ Redis FSM storage инициализирован ({REDIS_HOST}:{REDIS_PORT}, db={REDIS_DB})")
    except Exception as e:
        logger.warning(f"⚠️ Redis недоступен, используем MemoryStorage: {e}")
        from aiogram.fsm.storage.memory import MemoryStorage
        storage = MemoryStorage()
    
    return Dispatcher(storage=storage)


async def create_api_client() -> WebAPIClient:
    """
    Создание и инициализация Web API клиента
    
    Returns:
        WebAPIClient: Настроенный API клиент
    """
    logger.info("🔌 Инициализация Web API клиента...")
    
    # Создаём менеджер токенов
    token_manager = TokenManager(
        api_base_url=settings.web_api_base_url,
        username=settings.bot_api_username,
        password=settings.bot_api_password,
        refresh_interval=settings.bot_token_refresh_interval
    )
    
    # Создаём API клиент
    api_client = WebAPIClient(
        base_url=settings.web_api_base_url,
        token_manager=token_manager,
        timeout=settings.web_api_timeout
    )
    
    # Проверяем подключение к API
    try:
        stats = await api_client.get_dashboard_stats()
        logger.info(f"✅ Web API подключён успешно!")
        logger.info(f"   Клиентов: {stats.get('active_clients_count', 0)}, Дедлайнов: {stats.get('active_deadlines_count', 0)}")
    except Exception as e:
        logger.warning(f"⚠️ Web API недоступен (будет использован fallback): {e}")
    
    return api_client


def setup_middlewares(dp: Dispatcher):
    """
    Регистрация middleware в правильном порядке
    
    Args:
        dp: Диспетчер
    """
    # Важно: порядок регистрации имеет значение!
    # LoggingMiddleware должен быть первым для логирования всех запросов
    dp.message.middleware(LoggingMiddleware())
    
    # AuthMiddleware добавляет информацию о роли пользователя
    # Он сам создаёт сессию БД внутри
    dp.message.middleware(AuthMiddleware())
    
    # Аналогично для callback_query (для inline кнопок)
    dp.callback_query.middleware(LoggingMiddleware())
    dp.callback_query.middleware(AuthMiddleware())
    
    logger.info("✅ Middleware зарегистрированы")


def register_handlers(dp: Dispatcher):
    """
    Регистрация роутеров обработчиков команд
    
    Args:
        dp: Диспетчер
    """
    # ВАЖНО: Порядок регистрации имеет значение!
    # Роутеры с КОМАНДАМИ должны быть ПЕРВЫМИ
    
    # 1. Команды (обрабатываются первыми)
    dp.include_router(common.router)                 # /start, /help
    dp.include_router(admin.router)                  # /status, /check, /health
    dp.include_router(deadlines.router)              # /list, /today, /week, /next
    dp.include_router(search.router)                 # /search
    dp.include_router(settings_handler.router)       # /settings
    dp.include_router(export.router)                 # /export + callbacks
    
    # 2. Регистрация клиентов (обработка FSM состояний)
    dp.include_router(registration.router)           # Авторизация клиентов
    
    # 3. Кнопки для клиентов (обработка кнопок клавиатуры)
    dp.include_router(client_buttons.router)         # Помощь, Мои дедлайны
    
    logger.info("✅ Обработчики команд зарегистрированы:")
    logger.info("   - common (общие команды)")
    logger.info("   - admin (статистика, проверки)")
    logger.info("   - deadlines (просмотр дедлайнов)")
    logger.info("   - search (поиск)")
    logger.info("   - settings (настройки)")
    logger.info("   - export (экспорт данных)")
    logger.info("   - client_buttons (кнопки клиентов)")


async def main():
    """
    Главная асинхронная функция запуска бота
    """
    logger.info("=" * 60)
    logger.info("🚀 ЗАПУСК TELEGRAM БОТА ККТ")
    logger.info("=" * 60)
    
    # Создаём экземпляры
    bot = create_bot()
    dp = create_dispatcher()
    db_session = SessionLocal()
    
    # Создаём и настраиваем API клиент
    api_client = await create_api_client()
    
    # Устанавливаем API клиент в checker service
    checker.set_api_client(api_client)
    logger.info("✅ API клиент установлен в сервисы бота")
    
    # Настройка middleware и обработчиков
    setup_middlewares(dp)
    register_handlers(dp)
    
    # Настройка планировщика (передаём api_client)
    scheduler = setup_scheduler(bot, db_session, api_client)
    scheduler.start()
    logger.info("✅ Планировщик запущен")
    
    # Получаем информацию о боте
    try:
        bot_info = await bot.get_me()
        logger.info("=" * 60)
        logger.info(f"🤖 Бот запущен: @{bot_info.username}")
        logger.info(f"🆔 ID бота: {bot_info.id}")
        logger.info(f"👤 Имя: {bot_info.first_name}")
        logger.info("=" * 60)
        logger.info(f"⏰ Время проверки: {bot_config.notification_check_time} ({bot_config.notification_timezone})")
        logger.info(f"📅 Дни уведомлений: {', '.join(map(str, bot_config.notification_days_list))}")
        logger.info(f"🔌 Web API: {settings.web_api_base_url}")
        logger.info(f"🗄️ FSM Storage: Redis ({REDIS_HOST}:{REDIS_PORT})")
        logger.info("=" * 60)
        logger.info("📋 Доступные команды:")
        logger.info("Общие: /start, /help, /next, /list, /today, /week")
        logger.info("Поиск: /search")
        logger.info("Экспорт: /export")
        logger.info("Система (админ): /status, /check, /health")
        logger.info("=" * 60)
        logger.info("✅ Бот готов к работе! Нажмите Ctrl+C для остановки")
        logger.info("=" * 60)
        
        # Проверка целостности настроек бота в Telegram.
        # Если токен утёк, злоумышленник может поставить свой webhook и увести
        # весь трафик пользователей — тогда polling ниже просто не получит
        # ни одного апдейта. Сверяем и восстанавливаем ДО запуска polling.
        await enforce_bot_integrity(bot, bot_config.telegram_admin_ids_list)

        # Запуск polling
        await dp.start_polling(
            bot,
            allowed_updates=dp.resolve_used_update_types(),
            drop_pending_updates=True  # Пропускаем старые обновления
        )
        
    except Exception as e:
        logger.error(f"❌ Ошибка при запуске бота: {e}")
        raise
    finally:
        # Graceful shutdown
        logger.info("🛑 Остановка бота...")
        scheduler.shutdown(wait=False)
        db_session.close()
        
        # Закрываем API клиент
        await api_client.close()
        logger.info("✅ API клиент закрыт")
        
        # Закрываем Redis storage если используется
        if hasattr(dp.storage, 'redis'):
            await dp.storage.redis.close()
            logger.info("✅ Redis storage закрыт")
        
        await bot.session.close()
        logger.info("✅ Бот остановлен")


if __name__ == '__main__':
    try:
        # Создаём директорию для логов
        os.makedirs('logs', exist_ok=True)
        
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("👋 Бот остановлен пользователем (Ctrl+C)")
    except Exception as e:
        logger.error(f"💥 Критическая ошибка: {e}")
        import traceback
        logger.error(traceback.format_exc())
