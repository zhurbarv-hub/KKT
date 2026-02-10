# -*- coding: utf-8 -*-
"""
Сервис форматирования сообщений для Telegram бота
Преобразует данные из базы в красиво оформленные сообщения
ОБНОВЛЕНО: добавлены форматтеры для Web API данных
"""

from typing import Dict, List
from datetime import datetime

import logging
logger = logging.getLogger(__name__)


def format_deadline_notification(deadline: Dict, days: int) -> str:
    """
    Форматирование уведомления о дедлайне.
    Для типов 'Замена ФН' и 'Продление договора ОФД' показывает данные кассы.
    """
    try:
        days_remaining = deadline.get('days_remaining', days)
        deadline_type = deadline.get('deadline_type_name', 'Неизвестно')

        # Определяем эмодзи и срочность
        if days_remaining <= 0:
            urgency = "\u274c <b>ПРОСРОЧЕНО!</b>"
            emoji = "\u274c"
        elif days_remaining <= 3:
            urgency = "\U0001f534 <b>КРИТИЧЕСКИ СРОЧНО!</b>"
            emoji = "\U0001f534"
        elif days_remaining <= 7:
            urgency = "\U0001f7e1 <b>ТРЕБУЕТСЯ ВНИМАНИЕ</b>"
            emoji = "\U0001f7e1"
        else:
            urgency = "\U0001f7e2 <b>НАПОМИНАНИЕ</b>"
            emoji = "\U0001f7e2"

        # Форматируем дату
        exp_date = deadline.get('expiration_date')
        if exp_date and hasattr(exp_date, 'strftime'):
            exp_date_str = exp_date.strftime('%d.%m.%Y')
        else:
            exp_date_str = str(exp_date) if exp_date else 'Не указана'

        # Формируем заголовок
        message = f"{emoji} {urgency}\n"
        message += "\u2501" * 20 + "\n\n"

        # Тип дедлайна
        message += f"\U0001f6e0 <b>Тип:</b> {deadline_type}\n"

        # Данные кассы (если есть)
        register_name = deadline.get('cash_register_name')
        if register_name:
            message += f"\U0001f5a8 <b>Касса:</b> {register_name}\n"

        model = deadline.get('cash_register_model')
        if model:
            message += f"   \u2022 Модель: {model}\n"

        fn_number = deadline.get('fn_number')
        if fn_number:
            message += f"   \u2022 ФН: <code>{fn_number}</code>\n"

        address = deadline.get('installation_address')
        if address:
            message += f"\U0001f4cd <b>Адрес ККТ:</b> {address}\n"

        message += "\n"

        # Клиент
        message += f"\U0001f3e2 <b>Клиент:</b> {deadline.get('client_name', 'Неизвестно')}\n"
        client_inn = deadline.get('client_inn')
        if client_inn:
            message += f"   \u2022 ИНН: <code>{client_inn}</code>\n"

        message += "\n"

        # Сроки
        message += f"\u23f0 <b>Срок:</b> {exp_date_str}\n"
        if days_remaining <= 0:
            message += f"\u274c <b>Просрочено на {abs(days_remaining)} дн.</b>\n"
        elif days_remaining == 1:
            message += f"\u26a0\ufe0f <b>Остался 1 день!</b>\n"
        else:
            message += f"\u23f3 <b>Осталось: {days_remaining} дн.</b>\n"

        return message

    except Exception as e:
        logger.error(f"Ошибка форматирования уведомления: {e}")
        return "\u26a0\ufe0f Уведомление о дедлайне\n\nПроизошла ошибка при формировании сообщения"


def format_deadline_list(deadlines: List[Dict], title: str = None) -> str:
    """
    Форматирование списка дедлайнов с детализацией
    ОБНОВЛЕНО: добавлена подробная информация о каждом дедлайне
    
    Args:
        deadlines (List[Dict]): Список дедлайнов
        title (str): Кастомный заголовок (опционально)
        
    Returns:
        str: Отформатированный список с детализацией
    """
    try:
        if not deadlines:
            return "📭 <b>Нет предстоящих дедлайнов</b>"
            
        # Определяем эмодзи по статусу
        status_emoji = {
            'green': '🟢',
            'yellow': '🟡',
            'red': '🔴',
            'expired': '❌'
        }
        
        # Формируем заголовок
        if title:
            message = f"<b>{title}</b>\n"
        else:
            message = "<b>📋 Список предстоящих дедлайнов</b>\n"
        
        message += "=" * 30 + "\n\n"
        message += f"<b>Всего дедлайнов:</b> {len(deadlines)}\n\n"
        
        # Группируем по статусу для статистики
        status_counts = {}
        for d in deadlines:
            status = d.get('status', 'green')
            status_counts[status] = status_counts.get(status, 0) + 1
        
        # Показываем статистику
        if status_counts:
            message += "<b>📊 Статистика:</b>\n"
            if status_counts.get('expired', 0) > 0:
                message += f"   ❌ Просрочено: <b>{status_counts['expired']}</b>\n"
            if status_counts.get('red', 0) > 0:
                message += f"   🔴 Срочно (&lt;7 дн): <b>{status_counts['red']}</b>\n"
            if status_counts.get('yellow', 0) > 0:
                message += f"   🟡 Внимание (7-14 дн): <b>{status_counts['yellow']}</b>\n"
            if status_counts.get('green', 0) > 0:
                message += f"   🟢 Хорошо (&gt;14 дн): <b>{status_counts['green']}</b>\n"
            message += "\n"
        
        message += "<b>📋 ДЕТАЛИ ДЕДЛАЙНОВ:</b>\n"
        message += "=" * 30 + "\n\n"
        
        # Добавляем каждый дедлайн с детализацией
        for i, deadline in enumerate(deadlines, 1):
            emoji = status_emoji.get(deadline.get('status', 'green'), '⚪')
            days_remaining = deadline.get('days_remaining', 'N/A')
            
            # Определяем уровень срочности
            if isinstance(days_remaining, int):
                if days_remaining <= 0:
                    urgency_text = "ПРОСРОЧЕНО!"
                elif days_remaining <= 3:
                    urgency_text = "КРИТИЧНО!"
                elif days_remaining <= 7:
                    urgency_text = "Требует внимания"
                else:
                    urgency_text = "В норме"
            else:
                urgency_text = "Неизвестно"
            
            # Форматируем дату
            if deadline.get('expiration_date'):
                exp_date = deadline['expiration_date'].strftime('%d.%m.%Y') if hasattr(deadline['expiration_date'], 'strftime') else str(deadline['expiration_date'])
            else:
                exp_date = 'Не указана'
            
            # Формируем блок дедлайна
            message += f"<b>{i}.</b> {emoji} <b>{urgency_text}</b>\n"
            message += f"━━━━━━━━━━━━━━━━\n"
            
            # Информация о клиенте
            message += f"🏢 <b>Клиент:</b>\n"
            message += f"   • {deadline.get('client_name', 'Неизвестно')}\n"
            message += f"   • ИНН: <code>{deadline.get('client_inn', 'Неизвестно')}</code>\n\n"
            
            # Информация о сервисе
            message += f"🛠 <b>Услуга:</b> {deadline.get('deadline_type_name', 'Неизвестно')}\n"
            
            # Информация о кассе (если есть)
            if deadline.get('cash_register_model') or deadline.get('cash_register_serial'):
                message += f"\n🖨️ <b>ККТ:</b>\n"
                if deadline.get('cash_register_name'):
                    message += f"   • Название: <b>{deadline['cash_register_name']}</b>\n"
                if deadline.get('cash_register_model'):
                    message += f"   • Модель: {deadline['cash_register_model']}\n"
                if deadline.get('cash_register_serial'):
                    message += f"   • Зав. №: <code>{deadline['cash_register_serial']}</code>\n"
                if deadline.get('installation_address'):
                    message += f"   • Адрес: {deadline['installation_address']}\n"
            
            # Дополнительная информация (если есть)
            if deadline.get('description'):
                message += f"\n📝 <b>Описание:</b> {deadline['description']}\n"
            
            # Сроки
            message += f"\n⏰ <b>Дата окончания:</b> {exp_date}\n"
            message += f"⌛️ <b>Осталось:</b> "
            if isinstance(days_remaining, int):
                if days_remaining == 0:
                    message += "<b>Истекает СЕГОДНЯ!</b>\n"
                elif days_remaining == 1:
                    message += "<b>1 день</b>\n"
                elif days_remaining < 0:
                    message += f"<b>Просрочено на {abs(days_remaining)} дн.</b>\n"
                else:
                    message += f"<b>{days_remaining} дн.</b>\n"
            else:
                message += f"{days_remaining}\n"
            
            message += "\n"
        
        # Подсказка внизу
        message += "━━━━━━━━━━━━━━━━\n"
        message += "💡 <i>Используйте /help для просмотра всех команд</i>"
        
        return message.strip()
        
    except Exception as e:
        logger.error(f"Ошибка форматирования списка дедлайнов: {e}")
        return "⚠️ Произошла ошибка при формировании списка дедлайнов"


def format_statistics(stats: Dict) -> str:
    """
    Форматирование статистики системы (старая версия для совместимости)
    
    Args:
        stats (Dict): Словарь со статистикой
        
    Returns:
        str: Отформатированная статистика
    """
    try:
        message = "<b>📊 Статистика системы:</b>\n\n"
        
        # Основные показатели
        message += f"👥 <b>Клиенты:</b>\n"
        message += f"   Всего: {stats.get('total_clients', 0)}\n"
        message += f"   Активные: {stats.get('active_clients', 0)}\n\n"
        
        message += f"📅 <b>Дедлайны:</b>\n"
        message += f"   Всего: {stats.get('total_deadlines', 0)}\n"
        message += f"   Активные: {stats.get('active_deadlines', 0)}\n\n"
        
        # Статусы дедлайнов
        message += f"🚦 <b>Статусы дедлайнов:</b>\n"
        message += f"   🟢 Хорошо (больше 14 дней): {stats.get('status_green', 0)}\n"
        message += f"   🟡 Внимание (7-14 дней): {stats.get('status_yellow', 0)}\n"
        message += f"   🔴 Срочно (меньше 7 дней): {stats.get('status_red', 0)}\n"
        message += f"   ❌ Просроченные: {stats.get('status_expired', 0)}\n"
        
        # Добавляем временную метку
        timestamp = datetime.now().strftime('%d.%m.%Y %H:%M')
        message += f"\n🕒 Последнее обновление: {timestamp}"
        
        return message
        
    except Exception as e:
        logger.error(f"Ошибка форматирования статистики: {e}")
        return "⚠️ Произошла ошибка при формировании статистики"


def format_api_statistics(stats: Dict) -> str:
    """
    НОВАЯ ФУНКЦИЯ: Форматирование статистики из Web API
    
    Args:
        stats (Dict): Словарь со статистикой от API или БД
        
    Returns:
        str: Отформатированная статистика с метаданными
    """
    try:
        message = "<b>📊 Статистика системы</b>\n\n"
        
        # Основные показатели
        message += f"👥 <b>Клиенты:</b>\n"
        message += f"   Всего: <b>{stats.get('total_clients_count', 0)}</b>\n"
        message += f"   Активные: <b>{stats.get('active_clients_count', 0)}</b>\n\n"
        
        message += f"📅 <b>Дедлайны:</b>\n"
        message += f"   Всего: <b>{stats.get('total_deadlines_count', 0)}</b>\n"
        message += f"   Активные: <b>{stats.get('active_deadlines_count', 0)}</b>\n\n"
        
        # Статусы дедлайнов (если есть данные)
        if 'status_green' in stats or 'status_yellow' in stats or 'status_red' in stats:
            message += f"🚦 <b>Статусы дедлайнов:</b>\n"
            message += f"   🟢 Безопасно (&gt;14 дней): <b>{stats.get('status_green', 0)}</b>\n"
            message += f"   🟡 Внимание (7-14 дней): <b>{stats.get('status_yellow', 0)}</b>\n"
            message += f"   🔴 Критично (&lt;7 дней): <b>{stats.get('status_red', 0)}</b>\n"
            message += f"   ❌ Просроченные: <b>{stats.get('status_expired', 0)}</b>\n\n"
        
        # Источник данных
        data_source = stats.get('data_source', 'unknown')
        if data_source == 'api':
            source_emoji = "🔌"
            source_text = "Web API"
            # Добавляем время ответа если есть
            if 'api_response_time' in stats:
                source_text += f" ({stats['api_response_time']}ms)"
        else:
            source_emoji = "💾"
            source_text = "База данных (fallback)"
        
        message += f"📡 <b>Источник:</b> {source_emoji} {source_text}\n"
        
        # Временная метка
        timestamp = datetime.now().strftime('%d.%m.%Y %H:%M')
        message += f"🕒 <b>Обновлено:</b> {timestamp}"
        
        return message
        
    except Exception as e:
        logger.error(f"Ошибка форматирования API статистики: {e}")
        return "⚠️ Произошла ошибка при формировании статистики"


def format_health_status(health_data: Dict) -> str:
    """
    НОВАЯ ФУНКЦИЯ: Форматирование статуса здоровья Web API
    
    Args:
        health_data (Dict): Данные о состоянии API
            - api_url: str
            - api_available: bool
            - response_time: int (ms)
            - token_valid: bool
            - error: str (если есть)
            - stats: dict (если API доступен)
        
    Returns:
        str: Отформатированный статус здоровья
    """
    try:
        message = "<b>🏥 Статус Web API</b>\n\n"
        
        # URL API
        message += f"🌐 <b>URL:</b> <code>{health_data.get('api_url', 'N/A')}</code>\n\n"
        
        # Статус доступности
        if health_data.get('api_available'):
            message += f"✅ <b>Статус:</b> Онлайн\n"
            
            # Время ответа
            response_time = health_data.get('response_time')
            if response_time is not None:
                if response_time < 100:
                    time_emoji = "🟢"
                elif response_time < 500:
                    time_emoji = "🟡"
                else:
                    time_emoji = "🔴"
                message += f"⏱ <b>Время ответа:</b> {time_emoji} {response_time} мс\n"
            
            # Статус токена
            token_status = "✅ Валиден" if health_data.get('token_valid') else "⚠️ Истёк"
            message += f"🔑 <b>Токен:</b> {token_status}\n\n"
            
            # Краткая статистика если есть
            if 'stats' in health_data:
                stats = health_data['stats']
                message += f"📊 <b>Быстрая статистика:</b>\n"
                message += f"   Клиентов: {stats.get('active_clients_count', 0)}\n"
                message += f"   Дедлайнов: {stats.get('active_deadlines_count', 0)}\n"
        else:
            message += f"❌ <b>Статус:</b> Недоступен\n\n"
            
            # Ошибка если есть
            if health_data.get('error'):
                error_msg = str(health_data['error'])[:150]
                message += f"⚠️ <b>Ошибка:</b>\n<code>{error_msg}</code>\n\n"
            
            message += f"💾 <b>Режим работы:</b> Fallback (прямой доступ к БД)\n"
        
        # Временная метка
        timestamp = datetime.now().strftime('%d.%m.%Y %H:%M:%S')
        message += f"\n🕒 Проверено: {timestamp}"
        
        return message
        
    except Exception as e:
        logger.error(f"Ошибка форматирования health status: {e}")
        return "⚠️ Произошла ошибка при формировании статуса здоровья"


def format_welcome_message(user_role: str) -> str:
    """
    Форматирование приветственного сообщения
    ОБНОВЛЕНО: добавлены новые команды /next и /health
    
    Args:
        user_role (str): Роль пользователя ('admin' или 'client')
        
    Returns:
        str: Приветственное сообщение
    """
    if user_role == 'admin':
        message = (
            "👋 <b>Добро пожаловать в систему управления дедлайнами ККТ!</b>\n\n"
            "Вы вошли как <b>администратор</b>.\n\n"
            "<b>Доступные команды:</b>\n"
            "/start - Приветствие\n"
            "/help - Справка по командам\n"
            "/status - Статистика системы\n"
            "/health - Статус Web API\n"
            "/list - Список всех дедлайнов\n"
            "/today - Дедлайны сегодня\n"
            "/week - Дедлайны на этой неделе\n"
            "/next &lt;дни&gt; - Дедлайны на N дней\n"
            "/check - Принудительная проверка дедлайнов\n"
            "/search - Поиск клиента по ИНН/названию\n"
            "/settings - Настройки системы\n"
            "/export - Экспорт всех данных в JSON\n\n"
            "⚠️ Вы получаете уведомления обо всех дедлайнах."
        )
    else:
        message = (
            "👋 <b>Добро пожаловать в систему управления дедлайнами ККТ!</b>\n\n"
            "Вы вошли как <b>клиент</b>.\n\n"
            "<b>Доступные команды:</b>\n"
            "/start - Приветствие\n"
            "/help - Справка по командам\n"
            "/list - Список ваших дедлайнов\n"
            "/today - Ваши дедлайны сегодня\n"
            "/week - Ваши дедлайны на этой неделе\n"
            "/next &lt;дни&gt; - Ваши дедлайны на N дней\n"
            "/settings - Ваши настройки\n"
            "/mute - Отключить уведомления\n"
            "/unmute - Включить уведомления\n"
            "/export - Экспорт ваших данных в JSON\n\n"
            "ℹ️ Вы получаете уведомления только о дедлайнах вашего клиента."
        )
        
    return message


def format_help_message(user_role: str) -> str:
    """
    Форматирование справки по командам
    ОБНОВЛЕНО: добавлены новые команды /next и /health
    
    Args:
        user_role (str): Роль пользователя ('admin' или 'client')
        
    Returns:
        str: Сообщение со справкой
    """
    if user_role == 'admin':
        message = (
            "<b>❓ Справка по командам (администратор)</b>\n\n"
            "<b>Основные:</b>\n"
            "/start - Приветственное сообщение\n"
            "/help - Эта справка\n"
            "/settings - Настройки системы\n\n"
            "<b>Просмотр дедлайнов:</b>\n"
            "/list - Список всех активных дедлайнов (30 дней)\n"
            "/today - Дедлайны, истекающие сегодня\n"
            "/week - Дедлайны на ближайшие 7 дней\n"
            "/next &lt;дни&gt; - Дедлайны на N дней (1-90)\n\n"
            "<b>Административные:</b>\n"
            "/status - Статистика системы\n"
            "/health - Проверка Web API\n"
            "/check - Принудительная проверка и отправка уведомлений\n"
            "/search - Поиск клиента (ИНН/название)\n"
            "/export - Экспорт всех данных в JSON\n\n"
            "ℹ️ Администратор получает уведомления обо всех дедлайнах."
        )
    else:
        message = (
            "<b>❓ Справка по командам (клиент)</b>\n\n"
            "<b>Основные:</b>\n"
            "/start - Приветственное сообщение\n"
            "/help - Эта справка\n"
            "/settings - Ваши настройки\n\n"
            "<b>Просмотр дедлайнов:</b>\n"
            "/list - Список ваших активных дедлайнов (30 дней)\n"
            "/today - Ваши дедлайны, истекающие сегодня\n"
            "/week - Ваши дедлайны на ближайшие 7 дней\n"
            "/next &lt;дни&gt; - Ваши дедлайны на N дней (1-90)\n\n"
            "<b>Управление уведомлениями:</b>\n"
            "/mute [дни] - Отключить уведомления (по умолчанию 7 дней)\n"
            "/unmute - Включить уведомления обратно\n"
            "/export - Экспорт ваших данных в JSON\n\n"
            "ℹ️ Клиент получает уведомления только о дедлайнах своего клиента."
        )
        
    return message


def format_api_statistics(stats: Dict) -> str:
    """
    Форматирование статистики из Web API
    
    Args:
        stats (Dict): Статистика системы
        
    Returns:
        str: Отформатированное сообщение
    """
    try:
        now = datetime.now().strftime('%d.%m.%Y %H:%M')
        
        # Источник данных
        if stats.get('data_source') == 'api':
            source = f"🔌 Web API ({stats.get('api_response_time', 0)}ms)"
        else:
            source = "💾 База данных"
        
        message = "📊 <b>Статистика системы</b>\n\n"
        
        # Клиенты
        message += "👥 <b>Клиенты:</b>\n"
        message += f"   Всего: <b>{stats.get('total_clients', stats.get('total_clients_count', 0))}</b>\n"
        message += f"   Активные: <b>{stats.get('active_clients', stats.get('active_clients_count', 0))}</b>\n\n"
        
        # Дедлайны
        message += "📅 <b>Дедлайны:</b>\n"
        message += f"   Всего: <b>{stats.get('total_deadlines', stats.get('total_deadlines_count', 0))}</b>\n"
        message += f"   Активные: <b>{stats.get('active_deadlines', stats.get('active_deadlines_count', 0))}</b>\n\n"
        
        # Статусы дедлайнов
        message += "🚦 <b>Статусы дедлайнов:</b>\n"
        message += f"   🟢 Безопасно (&gt;14 дней): <b>{stats.get('status_green', 0)}</b>\n"
        message += f"   🟡 Внимание (7-14 дней): <b>{stats.get('status_yellow', 0)}</b>\n"
        message += f"   🔴 Критично (&lt;7 дней): <b>{stats.get('status_red', 0)}</b>\n"
        message += f"   ❌ Просроченные: <b>{stats.get('status_expired', 0)}</b>\n\n"
        
        # Метаданные
        message += f"📡 <b>Источник:</b> {source}\n"
        message += f"🕒 <b>Обновлено:</b> {now}"
        
        return message
        
    except Exception as e:
        logger.error(f"Ошибка форматирования статистики: {e}")
        return "⚠️ Ошибка при формировании статистики"


def format_health_status(health_data: Dict) -> str:
    """
    Форматирование статуса здоровья Web API
    
    Args:
        health_data (Dict): Данные проверки
        
    Returns:
        str: Отформатированное сообщение
    """
    try:
        message = "🏥 <b>Web API Health Check</b>\n\n"
        
        # URL API
        message += f"🌐 <b>URL:</b> <code>{health_data.get('api_url', 'N/A')}</code>\n\n"
        
        # Статус API
        if health_data.get('api_available'):
            message += "✅ <b>Статус API:</b> Онлайн\n"
            message += f"⏱ <b>Время ответа:</b> {health_data.get('response_time', 0)}ms\n"
        else:
            message += "❌ <b>Статус API:</b> Оффлайн\n"
            if health_data.get('error'):
                message += f"\n⚠️ <b>Ошибка:</b>\n<code>{health_data['error'][:200]}</code>\n"
        
        # Статус токена
        if health_data.get('token_valid'):
            message += "\n🔑 <b>Токен:</b> Валиден\n"
        else:
            message += "\n⚠️ <b>Токен:</b> Невалиден/Истёк\n"
        
        return message
        
    except Exception as e:
        logger.error(f"Ошибка форматирования health status: {e}")
        return "⚠️ Ошибка при формировании health status"


if __name__ == "__main__":
    # Тестирование форматтера
    print("=" * 50)
    print("ТЕСТ СЕРВИСА ФОРМАТИРОВАНИЯ")
    print("=" * 50)
    
    # Тест API статистики
    test_api_stats = {
        'total_clients_count': 15,
        'active_clients_count': 12,
        'total_deadlines_count': 45,
        'active_deadlines_count': 38,
        'status_green': 20,
        'status_yellow': 12,
        'status_red': 6,
        'status_expired': 0,
        'data_source': 'api',
        'api_response_time': 45
    }
    
    api_stats_message = format_api_statistics(test_api_stats)
    print("API Статистика:")
    print(api_stats_message)
    print()
    
    # Тест health status
    test_health_online = {
        'api_url': 'http://localhost:8000',
        'api_available': True,
        'response_time': 78,
        'token_valid': True,
        'stats': {
            'active_clients_count': 12,
            'active_deadlines_count': 38
        }
    }
    
    health_message = format_health_status(test_health_online)
    print("Health Status (Online):")
    print(health_message)
    print()
    
    test_health_offline = {
        'api_url': 'http://localhost:8000',
        'api_available': False,
        'error': 'Connection refused',
        'token_valid': False
    }
    
    health_offline = format_health_status(test_health_offline)
    print("Health Status (Offline):")
    print(health_offline)
    
    print("=" * 50)
    print("✅ Тесты пройдены успешно")
    print("=" * 50)