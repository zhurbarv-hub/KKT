# -*- coding: utf-8 -*-
"""
Генерация секретного ключа для JWT и создание .env файла
"""

import secrets
import os

def generate_env_file():
    """Генерация рабочего .env файла с новым секретным ключом"""
    
    print("=" * 60)
    print("ГЕНЕРАЦИЯ .ENV ФАЙЛА")
    print("=" * 60)
    
    # Генерируем секретный ключ
    jwt_secret = secrets.token_urlsafe(32)
    print(f"\n✓ JWT секретный ключ сгенерирован: {jwt_secret[:20]}...")
    
    # Проверяем существование .env
    env_path = ".env"
    if os.path.exists(env_path):
        response = input("\n⚠️  Файл .env уже существует. Перезаписать? (yes/no): ")
        if response.lower() != 'yes':
            print("Отменено.")
            return False
    
    # Создаём .env файл
    env_content = f"""# ============================================
# Database Configuration
# ============================================
DATABASE_PATH=database/kkt_services.db

# ============================================
# JWT Authentication
# ============================================
JWT_SECRET_KEY={jwt_secret}
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24

# ============================================
# Telegram Bot Configuration
# ============================================
# ⚠️  ЗАМЕНИТЕ НА ВАШ ТОКЕН ОТ @BotFather
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN_FROM_BOTFATHER

# ============================================
# Notification Settings
# ============================================
NOTIFICATION_TIME=02:00
ALERT_THRESHOLD_DAYS=14

# ============================================
# API Server Configuration
# ============================================
API_HOST=0.0.0.0
API_PORT=8000
API_RELOAD=True

# ============================================
# Logging Configuration
# ============================================
LOG_LEVEL=INFO
LOG_FILE=logs/application.log

# ============================================
# CORS Settings
# ============================================
CORS_ORIGINS=http://localhost:8000,http://127.0.0.1:8000
"""
    
    with open(env_path, 'w', encoding='utf-8') as f:
        f.write(env_content)
    
    print(f"\n✅ Файл .env создан успешно!")
    print("\n📝 Следующие шаги:")
    print("   1. Откройте файл .env")
    print("   2. Замените TELEGRAM_BOT_TOKEN на ваш токен от @BotFather")
    print("   3. При необходимости измените другие параметры")
    
    print("\n" + "=" * 60)
    print("СГЕНЕРИРОВАННЫЕ ЗНАЧЕНИЯ:")
    print("=" * 60)
    print(f"JWT_SECRET_KEY={jwt_secret}")
    print("\n⚠️  ВАЖНО: Никогда не публикуйте эти значения в Git!")
    print("=" * 60)
    
    return True

if __name__ == '__main__':
    try:
        generate_env_file()
        input("\nНажмите Enter для выхода...")
    except Exception as e:
        print(f"\n❌ ОШИБКА: {e}")
        input("\nНажмите Enter для выхода...")
