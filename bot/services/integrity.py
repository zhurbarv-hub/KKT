# -*- coding: utf-8 -*-
"""
Контроль целостности настроек бота в Telegram (самозащита от угона токена).

Зачем: если токен бота утекает, злоумышленник МОЖЕТ через обычный Bot API:
  - поставить свой webhook (get_webhook_info().url != "") и перехватить ВСЕ
    сообщения пользователей — наш polling при этом просто перестаёт получать
    апдейты, и внешне это выглядит как «бот молчит»;
  - подменить имя бота (set_my_name), описание и меню команд — так бот начинает
    рекламировать сторонние сервисы.

Именно так произошёл инцидент 08.08.2026: токен лежал в публичном
.env.example на GitHub, бота переименовали в рекламу казино и увели
трафик на webhook ssh.inkognit.org.

Модуль периодически сверяет фактические настройки с эталонными,
автоматически восстанавливает их и шлёт алерт администраторам.

ВАЖНО: это компенсирующая мера, а НЕ замена ротации утёкшего токена.
"""
import logging
import os

from aiogram import Bot
from aiogram.types import BotCommand

logger = logging.getLogger(__name__)

# Эталонные настройки. Имя можно переопределить через .env (BOT_EXPECTED_NAME).
EXPECTED_NAME = os.getenv("BOT_EXPECTED_NAME", "KKT System")

EXPECTED_COMMANDS = [
    BotCommand(command="start", description="Запустить бота"),
]


async def _notify_admins(bot: Bot, admin_ids, violations):
    """Отправка алерта администраторам о подмене настроек бота."""
    if not admin_ids:
        logger.warning("Список админов пуст — алерт о подмене настроек не отправлен")
        return

    text = (
        "🚨 <b>ТРЕВОГА: настройки бота были изменены извне</b>\n\n"
        "Обнаружено и автоматически исправлено:\n"
        + "\n".join(f"• {v}" for v in violations)
        + "\n\n<b>Это означает, что токен бота знает посторонний.</b>\n"
        "Необходимо немедленно отозвать токен: @BotFather → /mybots → "
        "выбрать бота → API Token → Revoke current token, "
        "затем прописать новый токен в .env и перезапустить kkt-bot."
    )
    for admin_id in admin_ids:
        try:
            await bot.send_message(admin_id, text)
        except Exception as exc:
            logger.error(f"Не удалось отправить алерт админу {admin_id}: {exc}")


async def enforce_bot_integrity(bot: Bot, admin_ids=None, notify: bool = True):
    """
    Сверяет настройки бота с эталоном, восстанавливает расхождения.

    Args:
        bot: экземпляр aiogram Bot
        admin_ids: кому слать алерт при обнаружении подмены
        notify: слать ли алерт (при старте бота — да)

    Returns:
        list[str]: список обнаруженных нарушений (пустой = всё в порядке)
    """
    violations = []

    # --- 1. Чужой webhook: самое опасное, перехватывает весь трафик ---
    try:
        webhook = await bot.get_webhook_info()
        if webhook.url:
            violations.append(f"установлен чужой webhook: <code>{webhook.url}</code> — удалён")
            logger.critical(f"🚨 Обнаружен ЧУЖОЙ webhook: {webhook.url} — удаляю")
            await bot.delete_webhook(drop_pending_updates=True)
    except Exception as exc:
        logger.error(f"Проверка webhook не удалась: {exc}")

    # --- 2. Подмена имени бота ---
    try:
        me = await bot.get_me()
        if me.first_name != EXPECTED_NAME:
            violations.append(
                f"подменено имя бота: «{me.first_name}» — возвращено «{EXPECTED_NAME}»"
            )
            logger.critical(f"🚨 Имя бота подменено на «{me.first_name}» — восстанавливаю")
            await bot.set_my_name(name=EXPECTED_NAME)
    except Exception as exc:
        logger.error(f"Проверка имени бота не удалась: {exc}")

    # --- 3. Подмена меню команд ---
    try:
        current = await bot.get_my_commands()
        current_pairs = [(c.command, c.description) for c in current]
        expected_pairs = [(c.command, c.description) for c in EXPECTED_COMMANDS]
        if current_pairs != expected_pairs:
            violations.append(f"подменено меню команд: {current_pairs} — восстановлено")
            logger.critical(f"🚨 Меню команд подменено: {current_pairs} — восстанавливаю")
            await bot.set_my_commands(EXPECTED_COMMANDS)
    except Exception as exc:
        logger.error(f"Проверка команд бота не удалась: {exc}")

    # --- 4. Подмена описаний (используются для рекламы) ---
    try:
        description = (await bot.get_my_description()).description
        if description:
            violations.append(f"подменено описание бота: «{description[:60]}» — очищено")
            logger.critical("🚨 Описание бота подменено — очищаю")
            await bot.set_my_description(description="")
    except Exception as exc:
        logger.error(f"Проверка описания бота не удалась: {exc}")

    try:
        short = (await bot.get_my_short_description()).short_description
        if short:
            violations.append(f"подменено краткое описание: «{short[:60]}» — очищено")
            logger.critical("🚨 Краткое описание подменено — очищаю")
            await bot.set_my_short_description(short_description="")
    except Exception as exc:
        logger.error(f"Проверка краткого описания не удалась: {exc}")

    if violations:
        logger.critical(f"🚨 ЦЕЛОСТНОСТЬ БОТА НАРУШЕНА, найдено проблем: {len(violations)}")
        if notify:
            await _notify_admins(bot, admin_ids or [], violations)
    else:
        logger.info("🔒 Проверка целостности настроек бота: всё в порядке")

    return violations
