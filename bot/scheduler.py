"""
Планировщик автоматических задач Telegram бота
Настройка и управление фоновыми задачами (ежедневные проверки)
"""
import logging
from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from aiogram import Bot
from sqlalchemy.orm import Session

from bot.services.notifier import process_deadline_notifications
from bot.services.api_client import WebAPIClient
from bot.services.integrity import enforce_bot_integrity
from bot.services.exceptions import APIError, ConnectionError as APIConnectionError
from backend.config import settings

logger = logging.getLogger(__name__)


async def scheduled_deadline_check(bot: Bot, db_session: Session, api_client: WebAPIClient = None):
    """
    Запланированная проверка дедлайнов
    Вызывается автоматически по расписанию
    
    Args:
        bot: Экземпляр бота для отправки уведомлений
        db_session: Сессия базы данных
        api_client: API клиент для проверки здоровья (опционально)
    """
    logger.info("⏰ ЗАПУСК АВТОМАТИЧЕСКОЙ ПРОВЕРКИ ДЕДЛАЙНОВ")
    
    # Health check API перед началом проверки
    api_available = True
    if api_client:
        try:
            logger.info("🔍 Проверка доступности Web API...")
            stats = await api_client.get_dashboard_stats()
            logger.info(f"✅ Web API доступен. Активных дедлайнов: {stats.get('active_deadlines_count', 0)}")
        except (APIError, APIConnectionError, Exception) as e:
            logger.warning(f"⚠️ Web API недоступен, будет использован fallback: {e}")
            api_available = False
    
    try:
        # Получаем дни для проверки из конфигурации
        days_list = settings.notification_days_list
        
        total_stats = {
            'checked': 0,
            'sent': 0,
            'failed': 0,
            'skipped': 0,
            'api_used': api_available
        }
        
        # Проверяем для каждого периода
        for days in days_list:
            logger.info(f"📅 Проверка дедлайнов за {days} дней")
            
            stats = await process_deadline_notifications(
                bot=bot,
                days=days
            )
            
            # Суммируем статистику
            total_stats['checked'] += stats.get('total_deadlines', 0)
            total_stats['sent'] += stats['sent']
            total_stats['failed'] += stats['failed']
            total_stats['skipped'] += stats['skipped']
        
        logger.info(
            f"✅ Автоматическая проверка завершена: "
            f"проверено={total_stats['checked']}, "
            f"отправлено={total_stats['sent']}, "
            f"пропущено={total_stats['skipped']}, "
            f"ошибок={total_stats['failed']}"
        )
        
        # Уведомляем администратора о результатах
        if total_stats['sent'] > 0 or total_stats['failed'] > 0:
            # Добавляем информацию об источнике данных
            data_source = "🔌 Web API" if api_available else "💾 База данных (fallback)"
            
            report = f"""
🔔 <b>Автоматическая проверка завершена</b>

📊 <b>Результаты:</b>
• Проверено: {total_stats['checked']}
• Отправлено: {total_stats['sent']}
• Пропущено: {total_stats['skipped']}
• Ошибок: {total_stats['failed']}

📡 <b>Источник данных:</b> {data_source}
⏰ <b>Время проверки:</b> {datetime.now().strftime('%H:%M:%S')}
""".strip()
            
            try:
                await bot.send_message(
                    chat_id=settings.telegram_admin_id,
                    text=report,
                    parse_mode='HTML'
                )
            except Exception as e:
                logger.error(f"❌ Не удалось отправить отчёт администратору: {e}")
        
    except Exception as e:
        logger.error(f"❌ Ошибка при автоматической проверке: {e}")
        import traceback
        logger.error(traceback.format_exc())
        
        # Уведомляем администратора об ошибке
        try:
            await bot.send_message(
                chat_id=settings.telegram_admin_id,
                text=f"❌ <b>Ошибка автоматической проверки</b>\n\n<code>{str(e)[:200]}</code>",
                parse_mode='HTML'
            )
        except:
            pass


async def send_admin_daily_summary(bot: Bot, db_session: Session):
    """
    НОВАЯ ФУНКЦИЯ: Отправка ежедневной сводки администраторам и менеджерам
    Содержит статистику по дедлайнам и ближайшим истекающим дедлайнам
    
    Args:
        bot: Экземпляр бота
        db_session: Сессия базы данных
    """
    if not settings.admin_summary_enabled:
        logger.info("⏭️ Ежедневная сводка отключена в настройках")
        return
    
    logger.info("📊 Генерация ежедневной сводки...")
    
    try:
        from backend.models import User, Deadline, DeadlineType
        from datetime import date, timedelta
        
        summary_text = "🕒 <b>Ежедневная сводка</b>\n\n"
        
        # Основная статистика
        active_deadlines = db_session.query(Deadline).filter(
            Deadline.status == 'active'
        ).all()
        
        today = date.today()
        green_count = 0
        yellow_count = 0
        red_count = 0
        expired_count = 0
        
        for deadline in active_deadlines:
            days_remaining = (deadline.expiration_date - today).days
            if days_remaining < 0:
                expired_count += 1
            elif days_remaining < 7:
                red_count += 1
            elif days_remaining < 14:
                yellow_count += 1
            else:
                green_count += 1
        
        summary_text += "🚦 <b>Статус дедлайнов:</b>\n"
        summary_text += f"   🟢 Безопасно (&gt;14 дней): <b>{green_count}</b>\n"
        summary_text += f"   🟡 Внимание (7-14 дней): <b>{yellow_count}</b>\n"
        summary_text += f"   🔴 Критично (&lt;7 дней): <b>{red_count}</b>\n"
        if expired_count > 0:
            summary_text += f"   ❌ Просроченные: <b>{expired_count}</b>\n"
        summary_text += "\n"
        
        # Ближайшие дедлайны (7 дней)
        upcoming_date = today + timedelta(days=7)
        upcoming = db_session.query(Deadline).join(
            User, Deadline.user_id == User.id
        ).join(
            DeadlineType, Deadline.deadline_type_id == DeadlineType.id
        ).filter(
            Deadline.status == 'active',
            Deadline.expiration_date >= today,
            Deadline.expiration_date <= upcoming_date
        ).order_by(Deadline.expiration_date).limit(5).all()
        
        if upcoming:
            summary_text += "⏰ <b>Ближайшие дедлайны (7 дней):</b>\n"
            for d in upcoming:
                days_left = (d.expiration_date - today).days
                emoji = '🔴' if days_left < 7 else '🟡'
                summary_text += f"   {emoji} {d.user.company_name}: {d.deadline_type.type_name} - {d.expiration_date.strftime('%d.%m')} ({days_left} дн.)\n"
            summary_text += "\n"
        
        # Временная метка
        summary_text += f"📅 <b>Дата:</b> {today.strftime('%d.%m.%Y')}\n"
        summary_text += f"⏰ <b>Время:</b> {datetime.now().strftime('%H:%M')}"
        
        # Отправляем админам и менеджерам
        recipients = [settings.telegram_admin_id]
        recipients.extend(settings.telegram_manager_ids_list)
        
        for recipient_id in recipients:
            try:
                await bot.send_message(
                    chat_id=recipient_id,
                    text=summary_text,
                    parse_mode='HTML'
                )
                logger.info(f"✅ Сводка отправлена пользователю {recipient_id}")
            except Exception as e:
                logger.error(f"❌ Ошибка отправки сводки пользователю {recipient_id}: {e}")
        
        logger.info("✅ Ежедневная сводка отправлена")
        
    except Exception as e:
        logger.error(f"❌ Ошибка при генерации ежедневной сводки: {e}")
        import traceback
        logger.error(traceback.format_exc())


async def integrity_watchdog(bot: Bot):
    """
    Периодическая проверка целостности настроек бота в Telegram.

    Ловит ситуацию, когда посторонний со знанием токена ставит свой webhook
    (перехват всех сообщений) или подменяет имя/описание/меню команд бота.
    Восстанавливает эталон и уведомляет администраторов.
    """
    try:
        await enforce_bot_integrity(bot, settings.telegram_admin_ids_list)
    except Exception as exc:
        logger.error(f"❌ Ошибка контроля целостности настроек бота: {exc}")


def setup_scheduler(bot: Bot, db_session: Session, api_client: WebAPIClient = None) -> AsyncIOScheduler:
    """
    Настройка и запуск планировщика задач
    
    Args:
        bot: Экземпляр бота
        db_session: Сессия базы данных
        api_client: API клиент для health checks (опционально)
        
    Returns:
        AsyncIOScheduler: Настроенный планировщик
    """
    scheduler = AsyncIOScheduler(timezone=settings.notification_timezone)
    
    # Парсим время из конфигурации (формат "HH:MM")
    time_parts = settings.notification_check_time.split(':')
    hour = int(time_parts[0])
    minute = int(time_parts[1]) if len(time_parts) > 1 else 0
    
    # Создаём cron-триггер для ежедневного запуска
    trigger = CronTrigger(
        hour=hour,
        minute=minute,
        timezone=settings.notification_timezone
    )
    
    # Добавляем задачу в планировщик
    # misfire_grace_time=3600 — если бот пропустил 09:00 (напр., перезапуск),
    # задача запустится в течение 1 часа после планового времени
    scheduler.add_job(
        scheduled_deadline_check,
        trigger=trigger,
        args=[bot, db_session, api_client],
        id='deadline_check',
        name='Ежедневная проверка дедлайнов',
        replace_existing=True,
        misfire_grace_time=3600
    )
    
    # Добавляем задачу ежедневной сводки (если включено)
    if settings.admin_summary_enabled:
        # Сводка отправляется утром в 9:00
        summary_trigger = CronTrigger(
            hour=9,
            minute=0,
            timezone=settings.notification_timezone
        )
        
        scheduler.add_job(
            send_admin_daily_summary,
            trigger=summary_trigger,
            args=[bot, db_session],
            id='daily_summary',
            name='Ежедневная сводка',
            replace_existing=True,
            misfire_grace_time=3600
        )
        logger.info("📊 Ежедневная сводка включена: отправка каждый день в 09:00 ({settings.notification_timezone})")
    
    # Периодический контроль целостности настроек бота (защита от угона токена).
    # Проверяет, не подменил ли кто-то извне webhook / имя / меню команд,
    # и восстанавливает эталон с алертом администраторам.
    scheduler.add_job(
        integrity_watchdog,
        trigger=IntervalTrigger(minutes=15),
        args=[bot],
        id='bot_integrity_check',
        name='Контроль целостности настроек бота',
        replace_existing=True,
        misfire_grace_time=300
    )
    logger.info("🔒 Контроль целостности настроек бота: каждые 15 минут")

    logger.info(
        f"📅 Планировщик настроен: проверка каждый день в {settings.notification_check_time} "
        f"({settings.notification_timezone})"
    )
    logger.info(f"📋 Дни уведомлений: {', '.join(map(str, settings.notification_days_list))}")
    
    if api_client:
        logger.info(f"🔌 Web API интеграция включена")
    else:
        logger.warning(f"⚠️ API клиент не передан, будет использоваться только БД")
    
    return scheduler


# Экспорт функций
__all__ = ['setup_scheduler', 'scheduled_deadline_check', 'send_admin_daily_summary']