"""
Полная инициализация базы данных с данными для тестирования
"""
from backend.database import init_db, get_db
from backend.models import User, DeadlineType
from backend.utils.security import get_password_hash
from datetime import datetime

def create_test_data():
    """Создать тестовые данные в БД"""
    
    print("\n📊 Создание тестовых данных...")
    
    db = next(get_db())
    
    try:
        # 1. Создать администратора
        admin_password = "admin123"
        admin = User(
            email="admin@kkt.ru",
            password_hash=get_password_hash(admin_password),
            full_name="Главный Администратор",
            role="admin",
            is_active=True
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
        print(f"  ✓ Создан администратор: {admin.email}")
        
        # 2. Создать менеджера
        manager_password = "manager123"
        manager = User(
            email="manager@kkt.ru",
            password_hash=get_password_hash(manager_password),
            full_name="Иван Менеджеров",
            role="manager",
            phone="+7 (900) 123-45-67",
            is_active=True
        )
        db.add(manager)
        db.commit()
        db.refresh(manager)
        print(f"  ✓ Создан менеджер: {manager.email}")
        
        # 3. Создать клиентов
        client1 = User(
            email="client1@example.com",
            full_name="Петров Петр Петрович",
            role="client",
            inn="7708123456",
            company_name='ООО "Рога и Копыта"',
            phone="+7 (901) 234-56-78",
            address="Москва, ул. Ленина, д. 1",
            notification_days="30,14,7,3",
            notifications_enabled=True,
            is_active=True
        )
        db.add(client1)
        
        client2 = User(
            email="client2@example.com",
            full_name="Сидорова Анна Ивановна",
            role="client",
            inn="7709987654",
            company_name='ИП "Сидорова А.И."',
            phone="+7 (902) 345-67-89",
            address="Санкт-Петербург, Невский пр., д. 100",
            telegram_id="123456789",
            telegram_username="anna_sidorova",
            first_name="Анна",
            last_name="Сидорова",
            notification_days="14,7,3",
            notifications_enabled=True,
            is_active=True,
            registered_at=datetime.now()
        )
        db.add(client2)
        
        client3 = User(
            email="client3@example.com",
            full_name="Васильев Сергей",
            role="client",
            inn="7710111222",
            company_name='ООО "Технологии Будущего"',
            phone="+7 (903) 456-78-90",
            notification_days="7,3,1",
            notifications_enabled=True,
            is_active=True
        )
        db.add(client3)
        
        db.commit()
        print(f"  ✓ Создан клиент: {client1.company_name}")
        print(f"  ✓ Создан клиент: {client2.company_name} (с Telegram)")
        print(f"  ✓ Создан клиент: {client3.company_name}")
        
        # 4. Создать типы дедлайнов
        deadline_types = [
            DeadlineType(
                type_name="Регистрация ККТ",
                description="Регистрация контрольно-кассовой техники в налоговой",
                is_system=True
            ),
            DeadlineType(
                type_name="Замена ФН",
                description="Замена фискального накопителя",
                is_system=True
            ),
            DeadlineType(
                type_name="Техническое обслуживание",
                description="Плановое техническое обслуживание ККТ",
                is_system=False
            ),
            DeadlineType(
                type_name="Продление договора",
                description="Продление договора на обслуживание",
                is_system=False
            )
        ]
        
        for dt in deadline_types:
            db.add(dt)
        
        db.commit()
        print(f"  ✓ Создано типов дедлайнов: {len(deadline_types)}")
        
        print("\n✅ Тестовые данные успешно созданы!")
        print("\n📝 Учётные данные для входа:")
        print("  👤 Администратор:")
        print("     Email: admin@kkt.ru")
        print("     Пароль: admin123")
        print("  👤 Менеджер:")
        print("     Email: manager@kkt.ru")
        print("     Пароль: manager123")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Ошибка создания тестовых данных: {e}")
        db.rollback()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    print("=" * 60)
    print("ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ")
    print("=" * 60)
    
    # 1. Создать таблицы
    print("\n🔨 Создание структуры БД...")
    init_db()
    
    # 2. Добавить тестовые данные
    create_test_data()
    
    print("\n" + "=" * 60)
    print("✅ ИНИЦИАЛИЗАЦИЯ ЗАВЕРШЕНА")
    print("=" * 60)
