# -*- coding: utf-8 -*-
"""
Сервис проверки сроков истечения услуг
Использует Web API для получения данных с fallback на прямые запросы к БД
"""

from typing import List, Dict, Optional
from datetime import date
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend import models
import logging

logger = logging.getLogger(__name__)

# Глобальная переменная для API клиента (будет установлена из main.py)
_api_client = None


def set_api_client(api_client):
    """
    Установка глобального API клиента
    
    Args:
        api_client: Экземпляр WebAPIClient
    """
    global _api_client
    _api_client = api_client
    logger.info("API клиент установлен в checker service")


async def get_expiring_deadlines(days: int) -> List[Dict]:
    """
    Получение списка дедлайнов, истекающих через указанное количество дней
    
    Использует Web API с fallback на прямые запросы к БД при недоступности API.
    
    Args:
        days (int): Количество дней до истечения
        
    Returns:
        List[Dict]: Список словарей с информацией о дедлайнах
    """
    # Попытка 1: Использовать Web API
    if _api_client is not None:
        try:
            logger.debug(f"Запрос дедлайнов через Web API (days={days})")
            api_deadlines = await _api_client.get_expiring_deadlines(days)
            
            # Преобразуем формат API к формату checker
            deadlines = []
            today = date.today()
            
            for d in api_deadlines:
                # API возвращает enriched данные
                days_remaining = d.get('days_until_expiration', 0)
                
                # Определяем статус цвета
                if days_remaining < 7:
                    status = 'red'
                elif days_remaining < 14:
                    status = 'yellow'
                else:
                    status = 'green'
                
                deadlines.append({
                    'deadline_id': d.get('id'),
                    'client_name': d.get('client_name'),
                    'client_inn': d.get('client_inn'),
                    'deadline_type_name': d.get('deadline_type_name'),
                    'expiration_date': date.fromisoformat(d.get('expiration_date')) if isinstance(d.get('expiration_date'), str) else d.get('expiration_date'),
                    'days_remaining': days_remaining,
                    'status': status
                })
            
            logger.info(f"✅ Получено {len(deadlines)} дедлайнов через Web API")
            return deadlines
            
        except Exception as e:
            logger.warning(f"⚠️ Web API недоступен, переключение на fallback: {e}")
            # Продолжаем к fallback
    
    # Попытка 2: Fallback на прямые запросы к БД
    return _get_expiring_deadlines_fallback(days)


def _get_expiring_deadlines_fallback(days: int) -> List[Dict]:
    """
    Fallback метод: прямые запросы к базе данных
    ОБНОВЛЕНО: использует User вместо Client
    
    Args:
        days (int): Количество дней до истечения
        
    Returns:
        List[Dict]: Список словарей с информацией о дедлайнах
    """
    try:
        logger.info(f"🔄 Использование fallback (прямые запросы к БД)")
        db: Session = SessionLocal()
        
        # Запрос с использованием User модели + данные кассы
        query = db.query(
            models.Deadline.id.label('deadline_id'),
            models.User.company_name.label('client_name'),
            models.User.inn.label('client_inn'),
            models.DeadlineType.type_name.label('deadline_type_name'),
            models.Deadline.expiration_date.label('expiration_date'),
            models.CashRegister.register_name.label('cash_register_name'),
            models.CashRegister.model.label('cash_register_model'),
            models.CashRegister.factory_number.label('factory_number'),
            models.CashRegister.fn_number.label('fn_number'),
            models.CashRegister.installation_address.label('installation_address'),
        ).join(
            models.User, models.Deadline.user_id == models.User.id
        ).join(
            models.DeadlineType, models.Deadline.deadline_type_id == models.DeadlineType.id
        ).outerjoin(
            models.CashRegister, models.Deadline.cash_register_id == models.CashRegister.id
        ).filter(
            models.Deadline.status == 'active',
            models.User.is_active == True,
            models.User.role == 'client'
        )
        
        results = query.all()
        
        # Фильтруем и вычисляем в Python
        today = date.today()
        deadlines = []
        for row in results:
            days_remaining = (row.expiration_date - today).days
            
            # Фильтруем по диапазонам (чтобы не дублировать между периодами):
            # days=14: 7 < remaining <= 14
            # days=7:  3 < remaining <= 7
            # days=3:  remaining <= 3 (включая просроченные)
            lower_bound = {14: 7, 7: 3, 3: -9999}.get(days, -9999)
            if lower_bound < days_remaining <= days:
                # Определяем статус
                if days_remaining <= 0:
                    status = 'expired'
                elif days_remaining < 7:
                    status = 'red'
                elif days_remaining < 14:
                    status = 'yellow'
                else:
                    status = 'green'
                
                deadlines.append({
                    'deadline_id': row.deadline_id,
                    'client_name': row.client_name,
                    'client_inn': row.client_inn,
                    'deadline_type_name': row.deadline_type_name,
                    'expiration_date': row.expiration_date,
                    'days_remaining': days_remaining,
                    'status': status,
                    'cash_register_name': row.cash_register_name,
                    'cash_register_model': row.cash_register_model,
                    'factory_number': row.factory_number,
                    'fn_number': row.fn_number,
                    'installation_address': row.installation_address,
                })
            
        logger.info(f"✅ Fallback: найдено {len(deadlines)} дедлайнов")
        return deadlines
        
    except Exception as e:
        logger.error(f"❌ Ошибка fallback получения дедлайнов: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return []
    finally:
        if 'db' in locals():
            db.close()


def get_notification_recipients(deadline_id: int) -> List[Dict]:
    """
    Получение списка получателей уведомлений для конкретного дедлайна
    ОБНОВЛЕНО: поддержка ролевой модели (admin, manager, client)
    
    Args:
        deadline_id (int): ID дедлайна
        
    Returns:
        List[Dict]: Список словарей с информацией о получателях
    """
    try:
        db: Session = SessionLocal()
        
        # Получаем информацию о дедлайне
        deadline = db.query(models.Deadline).filter(models.Deadline.id == deadline_id).first()
        if not deadline:
            logger.warning(f"Дедлайн с ID {deadline_id} не найден")
            return []
            
        recipients = []
        
        # Получаем конфигурацию для добавления админов и менеджеров
        from backend.config import settings
        from bot.config import get_bot_config
        config = get_bot_config()
        
        # 1. Добавляем администраторов как получателей (если включено в настройках)
        if settings.notification_include_admins:
            # Главный админ
            recipients.append({
                'telegram_id': str(config['telegram_admin_id']),
                'recipient_type': 'admin',
                'user_id': None
            })
            
            # Дополнительные админы из списка
            for admin_id in config.get('telegram_admin_ids', []):
                if admin_id != config['telegram_admin_id']:  # Избегаем дублирования
                    recipients.append({
                        'telegram_id': str(admin_id),
                        'recipient_type': 'admin',
                        'user_id': None
                    })
        
        # 2. Добавляем менеджеров (если есть в настройках)
        for manager_id in settings.telegram_manager_ids_list:
            recipients.append({
                'telegram_id': str(manager_id),
                'recipient_type': 'manager',
                'user_id': None
            })
        
        # 3. Добавляем клиента, которому принадлежит дедлайн
        if deadline.user_id:
            # Получаем пользователя-клиента
            client = db.query(models.User).filter(
                models.User.id == deadline.user_id,
                models.User.role == 'client',
                models.User.is_active == True,
                models.User.notifications_enabled == True,
                models.User.telegram_id.isnot(None)
            ).first()
            
            if client:
                recipients.append({
                    'telegram_id': client.telegram_id,
                    'recipient_type': 'client',
                    'user_id': client.id
                })
                logger.debug(f"Добавлен клиент {client.id} ({client.company_name}) в список получателей")
            else:
                logger.warning(f"Клиент для дедлайна {deadline_id} (user_id={deadline.user_id}) не найден или не настроен для уведомлений")
        else:
            logger.warning(f"Дедлайн {deadline_id} не привязан к клиенту (user_id отсутствует)")
            
        logger.debug(f"Найдено {len(recipients)} получателей для дедлайна {deadline_id}: "
                    f"{sum(1 for r in recipients if r['recipient_type'] == 'admin')} админов, "
                    f"{sum(1 for r in recipients if r['recipient_type'] == 'manager')} менеджеров, "
                    f"{sum(1 for r in recipients if r['recipient_type'] == 'client')} клиентов")
        return recipients
        
    except Exception as e:
        logger.error(f"Ошибка получения получателей для дедлайна {deadline_id}: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return []
    finally:
        if 'db' in locals():
            db.close()


def check_notification_sent(deadline_id: int, days: int, recipient_id: str) -> bool:
    """
    Проверка, было ли уже отправлено уведомление для конкретного дедлайна, дня и получателя
    
    Args:
        deadline_id (int): ID дедлайна
        days (int): Количество дней до истечения
        recipient_id (str): Telegram ID получателя
        
    Returns:
        bool: True если уведомление уже было отправлено, False в противном случае
    """
    try:
        db: Session = SessionLocal()
        
        # Проверяем наличие записи в логах уведомлений (с учётом days_before)
        existing_log = db.query(models.NotificationLog).filter(
            models.NotificationLog.deadline_id == deadline_id,
            models.NotificationLog.recipient_telegram_id == recipient_id,
            models.NotificationLog.days_before == days
        ).first()
        
        result = existing_log is not None
        if result:
            logger.debug(f"Уведомление для дедлайна {deadline_id}, получателя {recipient_id} уже было отправлено")
            
        return result
        
    except Exception as e:
        logger.error(f"Ошибка проверки отправки уведомления: {e}")
        return False
    finally:
        db.close()


if __name__ == "__main__":
    # Тестирование сервиса
    import asyncio
    
    async def test():
        print("=" * 50)
        print("ТЕСТ СЕРВИСА ПРОВЕРКИ ДЕДЛАЙНОВ")
        print("=" * 50)
        
        try:
            # Тестируем получение дедлайнов через 14 дней (с fallback)
            deadlines = await get_expiring_deadlines(14)
            print(f"Дедлайны через 14 дней: {len(deadlines)}")
            
            if deadlines:
                # Тестируем получение получателей для первого дедлайна
                first_deadline = deadlines[0]
                recipients = get_notification_recipients(first_deadline['deadline_id'])
                print(f"Получатели для дедлайна {first_deadline['deadline_id']}: {len(recipients)}")
                
                # Тестируем проверку отправки уведомления
                if recipients:
                    first_recipient = recipients[0]
                    sent = check_notification_sent(
                        first_deadline['deadline_id'], 
                        14, 
                        first_recipient['telegram_id']
                    )
                    print(f"Уведомление отправлено: {sent}")
            
            print("=" * 50)
            print("✅ Тесты пройдены успешно")
            print("=" * 50)
            
        except Exception as e:
            print(f"❌ Ошибка тестирования: {e}")
            import traceback
            traceback.print_exc()
    
    asyncio.run(test())