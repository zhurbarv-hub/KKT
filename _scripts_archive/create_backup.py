# -*- coding: utf-8 -*-
"""
Создание полного бекапа проекта KKT
"""
import os
import shutil
import sqlite3
from datetime import datetime
import zipfile

# Конфигурация
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKUP_DIR = os.path.join(PROJECT_DIR, "backups")
TIMESTAMP = datetime.now().strftime("%Y%m%d_%H%M%S")
BACKUP_NAME = f"kkt_backup_{TIMESTAMP}"
BACKUP_PATH = os.path.join(BACKUP_DIR, BACKUP_NAME)

# Файлы и папки для бекапа
INCLUDE_PATHS = [
    "web/",
    "bot/",
    "backend/",
    "scheduler/",
    "database/",
    "frontend/",
    "*.py",
    "*.sql",
    "*.md",
    "*.txt",
    "*.bat",
    ".env.example",
    ".gitignore",
    "kkt_system.db"
]

# Исключения
EXCLUDE_PATTERNS = [
    "__pycache__",
    "*.pyc",
    ".git",
    "venv",
    "venv_web",
    "logs/*.log",
    "*.exe"
]


def should_exclude(path):
    """Проверка, нужно ли исключить путь"""
    for pattern in EXCLUDE_PATTERNS:
        if pattern in path or path.endswith(pattern.replace("*", "")):
            return True
    return False


def create_backup():
    """Создание бекапа проекта"""
    print("=" * 70)
    print(f"📦 СОЗДАНИЕ БЕКАПА ПРОЕКТА KKT")
    print("=" * 70)
    print(f"\n🕐 Время: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"📁 Проект: {PROJECT_DIR}")
    print(f"💾 Бекап: {BACKUP_PATH}")
    
    # Создание директории бекапов
    os.makedirs(BACKUP_DIR, exist_ok=True)
    
    # Создание временной директории для бекапа
    os.makedirs(BACKUP_PATH, exist_ok=True)
    
    print("\n📋 Копирование файлов...")
    
    files_copied = 0
    total_size = 0
    
    # Копирование файлов
    for root, dirs, files in os.walk(PROJECT_DIR):
        # Пропускаем исключённые директории
        dirs[:] = [d for d in dirs if not should_exclude(os.path.join(root, d))]
        
        # Относительный путь
        rel_root = os.path.relpath(root, PROJECT_DIR)
        
        if rel_root == "." or rel_root.startswith("backups"):
            continue
        
        for file in files:
            src_file = os.path.join(root, file)
            rel_path = os.path.relpath(src_file, PROJECT_DIR)
            
            # Проверка исключений
            if should_exclude(src_file):
                continue
            
            # Целевой путь
            dst_file = os.path.join(BACKUP_PATH, rel_path)
            dst_dir = os.path.dirname(dst_file)
            
            # Создание директории
            os.makedirs(dst_dir, exist_ok=True)
            
            # Копирование файла
            shutil.copy2(src_file, dst_file)
            
            file_size = os.path.getsize(src_file)
            total_size += file_size
            files_copied += 1
            
            # Показываем прогресс каждые 10 файлов
            if files_copied % 10 == 0:
                print(f"  Скопировано файлов: {files_copied}...", end="\r")
    
    print(f"\n✅ Скопировано файлов: {files_copied}")
    print(f"📊 Общий размер: {total_size / 1024 / 1024:.2f} MB")
    
    # Создание дампа базы данных
    db_path = os.path.join(PROJECT_DIR, "kkt_system.db")
    if os.path.exists(db_path):
        print("\n💾 Создание дампа базы данных...")
        dump_path = os.path.join(BACKUP_PATH, "database_dump.sql")
        
        try:
            conn = sqlite3.connect(db_path)
            with open(dump_path, 'w', encoding='utf-8') as f:
                for line in conn.iterdump():
                    f.write(f"{line}\n")
            conn.close()
            
            dump_size = os.path.getsize(dump_path) / 1024
            print(f"✅ SQL дамп создан: {dump_size:.2f} KB")
        except Exception as e:
            print(f"⚠️  Ошибка создания дампа: {e}")
    
    # Создание архива
    print("\n📦 Создание ZIP архива...")
    zip_path = f"{BACKUP_PATH}.zip"
    
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(BACKUP_PATH):
            for file in files:
                file_path = os.path.join(root, file)
                arc_name = os.path.relpath(file_path, BACKUP_PATH)
                zipf.write(file_path, arc_name)
    
    # Удаление временной директории
    shutil.rmtree(BACKUP_PATH)
    
    zip_size = os.path.getsize(zip_path) / 1024 / 1024
    print(f"✅ ZIP архив создан: {zip_size:.2f} MB")
    
    # Создание README для бекапа
    readme_path = os.path.join(BACKUP_DIR, f"{BACKUP_NAME}_README.txt")
    with open(readme_path, 'w', encoding='utf-8') as f:
        f.write(f"БЕКАП ПРОЕКТА KKT\n")
        f.write(f"=" * 70 + "\n\n")
        f.write(f"Дата создания: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Файлов: {files_copied}\n")
        f.write(f"Размер: {total_size / 1024 / 1024:.2f} MB\n")
        f.write(f"Архив: {os.path.basename(zip_path)}\n")
        f.write(f"Размер архива: {zip_size:.2f} MB\n\n")
        f.write(f"ВОССТАНОВЛЕНИЕ:\n")
        f.write(f"1. Распакуйте архив {os.path.basename(zip_path)}\n")
        f.write(f"2. Скопируйте файлы в директорию проекта\n")
        f.write(f"3. Восстановите базу данных из database_dump.sql (если нужно)\n")
        f.write(f"4. Создайте виртуальное окружение и установите зависимости\n")
    
    print(f"\n📄 README создан: {os.path.basename(readme_path)}")
    
    # Список существующих бекапов
    print("\n📚 Существующие бекапы:")
    backups = sorted([f for f in os.listdir(BACKUP_DIR) if f.endswith('.zip')])
    for i, backup in enumerate(backups[-5:], 1):  # Последние 5
        backup_path = os.path.join(BACKUP_DIR, backup)
        size = os.path.getsize(backup_path) / 1024 / 1024
        print(f"  {i}. {backup} ({size:.2f} MB)")
    
    print("\n" + "=" * 70)
    print(f"✅ БЕКАП УСПЕШНО СОЗДАН!")
    print(f"📁 Путь: {zip_path}")
    print("=" * 70)


if __name__ == "__main__":
    try:
        create_backup()
    except Exception as e:
        print(f"\n❌ ОШИБКА: {e}")
        import traceback
        traceback.print_exc()