# -*- coding: utf-8 -*-
"""
Сервис отправки уведомлений через Telegram
Отправляет сообщения пользователям и записывает логи отправки
"""

import asyncio
import logging
from typing import Dict, List
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend import models

logger = logging.getLogger(__name__)


async def send_notification(bot, chat_id: int, message: str) -> bool:
    """
    Отправка уведомления через Telegram бот
    
    Args:
        bot: Экземпляр Telegram бота
        chat_id (int): ID чата получателя
        message (str): Текст сообщения (поддерживает HTML разметку)
        
    Returns:
        bool: True если отправка успешна, False в случае ошибки
    """
    try:
        await bot.send_message(chat_id=chat_id, text=message, parse_mode='HTML')
        logger.info(f"✅ Уведомление отправлено пользователю {chat_id}")
        return True
    except Exception as e:
        logger.error(f"❌ Ошибка отправки уведомления пользователю {chat_id}: {e}")
        return False


def log_notification(deadline_id: int, recipient_id: str, days: int, status: str, error: str = None):
    """
    Запись информации об отправке уведомления в базу данных
    
    Args:
        deadline_id (int): ID дедлайна
        recipient_id (str): Telegram ID получателя
        days (int): Количество дней до истечения
        status (str): Статус отправки ('sent', 'failed')
        error (str, optional): Сообщение об ошибке
    """
    try:
        db: Session = SessionLocal()
        
        # Создаем запись в логе уведомлений
        log_entry = models.NotificationLog(
            deadline_id=deadline_id,
            recipient_telegram_id=recipient_id,
            days_before=days,
            message_text=f"Уведомление за {days} дней до истечения",
            status=status,
            error_message=error
        )
        
        db.add(log_entry)
        db.commit()
        db.refresh(log_entry)
        
        logger.debug(f"Лог уведомления сохранен: deadline_id={deadline_id}, recipient={recipient_id}, status={status}")
        
    except Exception as e:
        logger.error(f"Ошибка записи лога уведомления: {e}")
        if 'db' in locals():
            db.rollback()
    finally:
        if 'db' in locals():
            db.close()


async def process_deadline_notifications(bot, days: int) -> Dict:
    """
    Обработка уведомлений для дедлайнов, истекающих через указанное количество дней
    
    Args:
        bot: Экземпляр Telegram бота
        days (int): Количество дней до истечения
        
    Returns:
        Dict: Статистика отправки уведомлений
    """
    from bot.services.checker import get_expiring_deadlines, get_notification_recipients, check_notification_sent
    
    stats = {
        'sent': 0,
        'failed': 0,
        'skipped': 0,
        'total_deadlines': 0,
        'total_notifications': 0
    }
    
    try:
        # Получаем дедлайны, истекающие через указанное количество дней
        deadlines = await get_expiring_deadlines(days)
        stats['total_deadlines'] = len(deadlines)
        
        if not deadlines:
            logger.info(f"Нет дедлайнов, истекающих через {days} дней")
            return stats
            
        logger.info(f"Найдено {len(deadlines)} дедлайнов, истекающих через {days} дней")
        
        # Для каждого дедлайна отправляем уведомления
        for deadline in deadlines:
            # Получаем список получателей
            recipients = get_notification_recipients(deadline['deadline_id'])
            
            if not recipients:
                logger.warning(f"Нет получателей для дедлайна {deadline['deadline_id']}")
                continue
                
            # Форматируем сообщение
            from bot.services.formatter import format_deadline_notification
            message = format_deadline_notification(deadline, days)
            
            # Отправляем уведомления каждому получателю
            for recipient in recipients:
                telegram_id = recipient['telegram_id']
                
                # Проверяем, было ли уже отправлено уведомление
                if check_notification_sent(deadline['deadline_id'], days, telegram_id):
                    stats['skipped'] += 1
                    logger.debug(f"Уведомление для дедлайна {deadline['deadline_id']} получателю {telegram_id} уже было отправлено")
                    continue
                    
                # Отправляем уведомление
                try:
                    success = await send_notification(bot, int(telegram_id), message)
                    
                    if success:
                        stats['sent'] += 1
                        log_status = 'sent'
                        error_msg = None
                    else:
                        stats['failed'] += 1
                        log_status = 'failed'
                        error_msg = 'Failed to send message'
                        
                    # Записываем лог
                    log_notification(
                        deadline_id=deadline['deadline_id'],
                        recipient_id=telegram_id,
                        days=days,
                        status=log_status,
                        error=error_msg
                    )
                    
                    stats['total_notifications'] += 1
                    
                except ValueError as e:
                    logger.error(f"Некорректный Telegram ID {telegram_id}: {e}")
                    stats['failed'] += 1
                    log_notification(
                        deadline_id=deadline['deadline_id'],
                        recipient_id=telegram_id,
                        days=days,
                        status='failed',
                        error=f"Invalid Telegram ID: {e}"
                    )
                except Exception as e:
                    logger.error(f"Ошибка отправки уведомления получателю {telegram_id}: {e}")
                    stats['failed'] += 1
                    log_notification(
                        deadline_id=deadline['deadline_id'],
                        recipient_id=telegram_id,
                        days=days,
                        status='failed',
                        error=str(e)
                    )
                    
        logger.info(f"Обработка уведомлений за {days} дней завершена: "
                   f"отправлено={stats['sent']}, ошибок={stats['failed']}, пропущено={stats['skipped']}")
                   
    except Exception as e:
        logger.error(f"Ошибка обработки уведомлений за {days} дней: {e}")
        
    return stats


if __name__ == "__main__":
    # Тестирование сервиса
    print("=" * 50)
    print("ТЕСТ СЕРВИСА ОТПРАВКИ УВЕДОМЛЕНИЙ")
    print("=" * 50)
    
    print("Сервис готов к использованию")
    print("Для тестирования необходимо запустить бота")
    
    print("=" * 50)
    print("✅ Сервис готов к работе")
    print("=" * 50)