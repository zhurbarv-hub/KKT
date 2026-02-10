# KKT System — Техническая документация

> Система управления дедлайнами обслуживания контрольно-кассовой техники (ККТ)
>
> Последнее обновление: 2026-02-10 (v2 — исправления бота и уведомлений)

---

## Оглавление

1. [Обзор системы](#1-обзор-системы)
2. [Архитектура](#2-архитектура)
3. [Стек технологий](#3-стек-технологий)
4. [Серверная инфраструктура](#4-серверная-инфраструктура)
5. [Бэкенд (FastAPI)](#5-бэкенд-fastapi)
6. [Фронтенд (React)](#6-фронтенд-react)
7. [Telegram-бот](#7-telegram-бот)
8. [База данных](#8-база-данных)
9. [API-эндпоинты](#9-api-эндпоинты)
10. [Аутентификация и безопасность](#10-аутентификация-и-безопасность)
11. [Система бекапов](#11-система-бекапов)
12. [Кэширование (Redis)](#12-кэширование-redis)
13. [Уведомления](#13-уведомления)
14. [Развёртывание и управление](#14-развёртывание-и-управление)
15. [Структура файлов](#15-структура-файлов)

---

## 1. Обзор системы

KKT System — веб-приложение для учёта и мониторинга сроков обслуживания контрольно-кассовой техники. Система отслеживает дедлайны по ФН, ОФД, регистрациям и другим услугам, отправляет уведомления через Telegram-бота и предоставляет дашборд для менеджеров.

**Основные функции:**
- Управление клиентами (компании, контакты, ИНН)
- Учёт кассовых аппаратов (ККТ) с привязкой к клиентам
- Отслеживание дедлайнов с цветовой индикацией (зелёный/жёлтый/красный/просрочен)
- Автоматические уведомления через Telegram (за 14, 7, 3 дня)
- Ежедневная сводка для администраторов
- Резервное копирование и восстановление БД
- Экспорт данных

**Домен:** `https://kkt-box.net`

---

## 2. Архитектура

```
┌─────────────────────────────────────────────────────────┐
│                      Nginx (HTTPS)                       │
│                    kkt-box.net:443                        │
├──────────────┬──────────────┬───────────────────────────┤
│   /          │  /api/*      │  /api/deployer/*           │
│  Static SPA  │  FastAPI     │  Deployer                  │
│  (React)     │  :8000       │  :8001                     │
└──────────────┴──────┬───────┴───────────────────────────┘
                      │
            ┌─────────┴──────────┐
            │   PostgreSQL 16    │    ┌──────────────┐
            │   :5432            │◄───│  Telegram Bot │
            └────────────────────┘    │  (aiogram)   │
            ┌────────────────────┐    └──────────────┘
            │     Redis 7        │
            │   :6379            │
            └────────────────────┘
```

**Гибридное развёртывание:**
- **Бэкенд (FastAPI)** — запускается через systemd (uvicorn), работает на `0.0.0.0:8000` (доступен из Docker-сети)
- **PostgreSQL и Redis** — Docker-контейнеры
- **Telegram-бот** — Docker-контейнер
- **Deployer** — Docker-контейнер (автодеплой через GitHub Webhooks)
- **Фронтенд** — статические файлы, раздаются Nginx

---

## 3. Стек технологий

### Бэкенд
| Компонент | Версия | Назначение |
|-----------|--------|------------|
| Python | 3.12 | Язык |
| FastAPI | latest | Web-фреймворк |
| SQLAlchemy | 2.x | ORM |
| Alembic | latest | Миграции БД |
| Pydantic | 2.x | Валидация данных |
| bcrypt | latest | Хэширование паролей |
| PyJWT | latest | JWT-токены |
| Redis (aioredis) | latest | Кэширование |

### Фронтенд
| Компонент | Версия | Назначение |
|-----------|--------|------------|
| React | 19.2 | UI-фреймворк |
| TypeScript | 5.9 | Типизация |
| Vite | 7.x | Сборщик |
| Tailwind CSS | 4.x | Стили |
| TanStack Query | 5.x | Серверное состояние |
| Zustand | 5.x | Клиентское состояние |
| React Router | 7.x | Маршрутизация |
| lucide-react | latest | Иконки |
| date-fns | 4.x | Работа с датами |
| PWA (vite-plugin-pwa) | latest | Офлайн-поддержка |

### Инфраструктура
| Компонент | Версия | Назначение |
|-----------|--------|------------|
| PostgreSQL | 16 (Alpine) | Основная БД |
| Redis | 7 (Alpine) | Кэш дашборда |
| Nginx | latest | Reverse proxy + SSL |
| Docker Compose | v2 | Оркестрация контейнеров |
| Let's Encrypt | — | SSL-сертификат |
| systemd | — | Управление бэкендом |

### Telegram-бот
| Компонент | Версия | Назначение |
|-----------|--------|------------|
| aiogram | 3.x | Telegram Bot API |
| APScheduler | latest | Планировщик уведомлений |

---

## 4. Серверная инфраструктура

### Сервер
- **IP:** 185.185.71.248
- **ОС:** Ubuntu 24.04 LTS
- **Проект:** `/home/kktapp/kkt-system/`
- **Виртуальное окружение:** `/home/kktapp/kkt-system/venv/`

### Порты
| Порт | Сервис | Доступ |
|------|--------|--------|
| 443 | Nginx (HTTPS) | Внешний |
| 80 | Nginx (HTTP → HTTPS redirect) | Внешний |
| 8000 | FastAPI (uvicorn) | localhost + Docker-сеть (UFW ограничивает) |
| 8001 | Deployer | Только localhost |
| 5432 | PostgreSQL | localhost + Docker-сеть (172.20.0.1) |
| 6379 | Redis | Только Docker-сеть |

### Docker-сеть
- Имя: `kkt-system_kkt-network`
- Подсеть: `172.20.0.0/16`
- Bridge IP: `172.20.0.1` (хост PostgreSQL доступен боту)

### Systemd-сервис
```ini
# /etc/systemd/system/kkt-backend.service
[Unit]
Description=KKT Backend API

[Service]
WorkingDirectory=/home/kktapp/kkt-system
ExecStart=/home/kktapp/kkt-system/venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

Команды управления:
```bash
systemctl status kkt-backend
systemctl restart kkt-backend
journalctl -u kkt-backend -f  # логи в реальном времени
```

---

## 5. Бэкенд (FastAPI)

### Структура
```
backend/
├── main.py              # Точка входа FastAPI
├── config.py            # Конфигурация (Pydantic Settings)
├── database.py          # SQLAlchemy engine и сессии
├── models.py            # ORM-модели (7 таблиц)
├── schemas.py           # Pydantic-схемы валидации
├── dependencies.py      # DI-зависимости (auth, pagination, filters)
├── cache.py             # Redis-кэширование
├── api/
│   ├── auth.py          # Авторизация (login/logout/me)
│   ├── users.py         # CRUD пользователей
│   ├── deadlines.py     # CRUD дедлайнов
│   ├── dashboard.py     # Дашборд и статистика
│   ├── deadline_types.py # Типы дедлайнов
│   ├── cash_registers.py # ККТ (кассовые аппараты)
│   ├── ofd_providers.py  # ОФД-операторы
│   └── database.py      # Бекапы и управление БД
└── utils/
    ├── security.py      # bcrypt, JWT
    └── validators.py    # Валидаторы (ИНН, телефон, email)
```

### Конфигурация (.env)
```bash
# База данных
DB_USER=kkt_user
DB_PASSWORD=KKT2024SecurePass
DB_NAME=kkt_production
DB_HOST=localhost
DB_PORT=5432

# JWT
JWT_SECRET_KEY=<секретный ключ>
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24

# Telegram
TELEGRAM_BOT_TOKEN=<токен бота>
TELEGRAM_ADMIN_IDS=1157881217,1329276055,556319278,166724079

# CORS
CORS_ORIGINS=https://kkt-box.net,http://localhost:3000

# Бот
BOT_API_USERNAME=bot-service@kkt-system.ru
BOT_API_PASSWORD=BotService2026Secure

# Web API для бота (Docker bridge IP)
WEB_API_BASE_URL=http://172.20.0.1:8000
```

---

## 6. Фронтенд (React)

### Структура
```
web/src/
├── App.tsx                    # Маршрутизация и React Query
├── main.tsx                   # Точка входа
├── index.css                  # Tailwind + тема (light/dark)
├── types/index.ts             # TypeScript-типы
├── services/api.ts            # Axios API-клиент
├── hooks/
│   ├── useAuth.ts             # Zustand-стор авторизации
│   ├── useTheme.ts            # Zustand-стор темы
│   └── useEscapeKey.ts        # Хук для закрытия модалок
├── components/
│   ├── layout/
│   │   ├── MainLayout.tsx     # Общий layout
│   │   └── Sidebar.tsx        # Боковая навигация
│   └── ClientDetailsModal.tsx # Модалка клиента (ККТ + дедлайны)
└── pages/
    ├── DashboardPage.tsx      # Главная — статистика и графики
    ├── UsersPage.tsx          # Управление клиентами
    ├── DeadlinesPage.tsx      # Таблица дедлайнов
    ├── DeadlineTypesPage.tsx  # Типы услуг
    ├── ManagersPage.tsx       # Управление менеджерами
    ├── DatabasePage.tsx       # Бекапы и БД
    ├── ExportPage.tsx         # Экспорт данных
    ├── SupportPage.tsx        # Обращения
    ├── SystemPage.tsx         # Системная информация
    └── LoginPage.tsx          # Страница входа
```

### Маршруты
| Путь | Страница | Доступ |
|------|----------|--------|
| `/login` | LoginPage | Публичный |
| `/` | DashboardPage | Авторизованный |
| `/users` | UsersPage | Авторизованный |
| `/deadlines` | DeadlinesPage | Авторизованный |
| `/deadline-types` | DeadlineTypesPage | Авторизованный |
| `/managers` | ManagersPage | Менеджер/Админ |
| `/export` | ExportPage | Менеджер/Админ |
| `/support` | SupportPage | Менеджер/Админ |
| `/database` | DatabasePage | Админ |
| `/system` | SystemPage | Админ |

### Тема
Поддержка светлой и тёмной темы через CSS-переменные и класс `.dark` на `<html>`. Переключатель в сайдбаре. Настройка сохраняется в localStorage.

### PWA
Приложение поддерживает PWA (Service Worker) с кэшированием API-запросов (NetworkFirst, TTL 1 час).

### Сборка
```bash
cd /home/kktapp/kkt-system/web
npm run build  # Собирает в dist/
```

Собранные файлы раздаются Nginx из `/home/kktapp/kkt-system/web/dist/`.

---

## 7. Telegram-бот

### Функции
- **Привязка клиента:** по 8-символьному коду (генерируется в веб-интерфейсе)
- **Уведомления:** автоматические напоминания о дедлайнах (за 14, 7, 3 дня)
- **Ежедневная сводка:** отправляется администраторам в 09:00 МСК
- **Команды:** /start, /help, /status, /check, /health, /list, /today, /week, /next, /search, /export, /settings

### Планировщик (APScheduler)
- `09:00 Europe/Moscow` — проверка дедлайнов + отправка уведомлений
- `09:00 Europe/Moscow` — ежедневная сводка администраторам
- `misfire_grace_time=3600` — если бот пропустил 09:00 (перезапуск), задача выполнится в течение 1 часа

### Подключение к БД
Бот работает в Docker-контейнере и подключается к **хостовому PostgreSQL** через `172.20.0.1:5432` (bridge IP Docker-сети). Firewall (UFW) разрешает порт 5432 из подсети `172.20.0.0/16`.

> **ВАЖНО:** На сервере работают ДВА PostgreSQL — хостовый (systemd, порт 5432, актуальные данные) и Docker (`kkt-postgres`, устаревшие данные). Бот и бэкенд ДОЛЖНЫ использовать хостовый PostgreSQL (`172.20.0.1:5432` для Docker, `localhost:5432` для хоста).

### Web API интеграция
Бот может использовать Web API для получения данных (`WEB_API_BASE_URL=http://172.20.0.1:8000`). При недоступности API автоматически переключается на прямые SQL-запросы (fallback).

### Docker-конфигурация бота
```yaml
bot:
  image: ghcr.io/zhurbarv-hub/kkt-bot:latest
  environment:
    DATABASE_URL: postgresql://kkt_user:...@172.20.0.1:5432/kkt_production
    WEB_API_BASE_URL: http://172.20.0.1:8000
    NOTIFICATION_TIMEZONE: Europe/Moscow
    NOTIFICATION_CHECK_TIME: "09:00"
    NOTIFICATION_DAYS: "14,7,3"
    NOTIFICATION_INCLUDE_ADMINS: "true"
    ADMIN_SUMMARY_ENABLED: "true"
    BOT_API_USERNAME: bot-service@kkt-system.ru
    BOT_API_PASSWORD: ...
  volumes:
    - ./bot:/app/bot         # Локальный код бота
    - ./backend:/app/backend # Локальный код бэкенда
```

### Формат уведомлений
Для типов «Замена ФН» и «Продление ОФД» сообщение включает:
- Тип дедлайна
- Наименование кассы, модель, номер ФН
- Адрес ККТ
- Клиент (компания, ИНН)
- Срок истечения и оставшиеся дни

### Запуск
```bash
cd /home/kktapp/kkt-system
docker stop kkt-bot && docker rm kkt-bot && docker compose up -d bot
docker logs -f kkt-bot  # Логи
```

---

## 8. База данных

### Подключение
- **Хост:** localhost:5432
- **БД:** kkt_production
- **Пользователь:** kkt_user
- **Пароль:** KKT2024SecurePass

### Модели (7 таблиц)

#### users
Единая модель пользователя (клиенты, менеджеры, администраторы).

| Поле | Тип | Описание |
|------|-----|----------|
| id | int, PK | ID |
| email | varchar, unique | Email (логин) |
| username | varchar | Имя пользователя (авто) |
| password_hash | varchar | Хэш пароля (bcrypt) |
| full_name | varchar | ФИО контактного лица |
| company_name | varchar | Название компании |
| inn | varchar(12) | ИНН (10 или 12 цифр) |
| phone | varchar | Телефон (+7XXXXXXXXXX) |
| address | text | Адрес |
| role | varchar | Роль: `client`, `manager`, `admin` |
| is_active | bool | Активен |
| telegram_id | bigint | Telegram ID |
| telegram_username | varchar | Telegram @username |
| notification_enabled | bool | Уведомления включены |
| notification_days | JSON | Дни уведомлений [14, 7, 3] |
| notes | text | Примечания |
| registration_code | varchar | Код для привязки Telegram |
| code_expires_at | datetime | Срок действия кода |
| registered_at | datetime | Дата регистрации |

#### deadline_types
Каталог типов услуг.

| Поле | Тип | Описание |
|------|-----|----------|
| id | int, PK | ID |
| type_name | varchar(100), unique | Название типа |
| description | text | Описание |
| is_system | bool | Системный тип (нельзя удалить) |
| is_active | bool | Активен |

#### deadlines
Дедлайны обслуживания.

| Поле | Тип | Описание |
|------|-----|----------|
| id | int, PK | ID |
| user_id | int, FK → users | Клиент |
| client_id | int | Legacy-поле (= user_id) |
| cash_register_id | int, FK → cash_registers | Привязанная ККТ |
| deadline_type_id | int, FK → deadline_types | Тип услуги |
| expiration_date | date | Дата истечения |
| status | varchar | active / expired / renewed |
| notes | text | Примечание |
| notification_enabled | bool | Уведомления |

**Вычисляемые свойства:**
- `days_until_expiration` — дней до истечения
- `status_color` — green (>14д), yellow (7-14д), red (<7д), expired

#### cash_registers
Кассовые аппараты.

| Поле | Тип | Описание |
|------|-----|----------|
| id | int, PK | ID |
| client_id | int, FK → users | Клиент |
| register_name | varchar | Название кассы |
| model | varchar | Модель |
| factory_number | varchar | Заводской номер |
| registration_number | varchar | Регистрационный номер |
| fn_number | varchar | Номер ФН |
| installation_address | text | Адрес установки |
| fn_expiry_date | date | Срок ФН |
| ofd_expiry_date | date | Срок ОФД |
| ofd_provider_id | int, FK → ofd_providers | ОФД-оператор |

**Автосинхронизация дедлайнов:** при создании/обновлении ККТ автоматически создаются/обновляются дедлайны типов «Замена ФН» (type_id=6) и «Продление ОФД» (type_id=7).

#### ofd_providers
Справочник ОФД-операторов.

| Поле | Тип | Описание |
|------|-----|----------|
| id | int, PK | ID |
| name | varchar, unique | Название |
| website | varchar | Сайт |
| support_phone | varchar | Телефон поддержки |
| support_email | varchar | Email поддержки |

#### support_requests
Обращения клиентов.

| Поле | Тип | Описание |
|------|-----|----------|
| id | int, PK | ID |
| user_id | int, FK → users | Автор |
| subject | varchar | Тема |
| message | text | Сообщение |
| status | varchar | new / in_progress / resolved / closed |
| priority | varchar | low / medium / high |

#### notification_logs
Журнал уведомлений. Используется для дедупликации (не отправлять повторно).

| Поле | Тип | Описание |
|------|-----|----------|
| id | int, PK | ID |
| deadline_id | int, FK → deadlines | Дедлайн |
| recipient_telegram_id | varchar | Telegram ID получателя |
| days_before | int | Дней до истечения (14, 7, 3) — ключ дедупликации |
| message_text | text | Текст сообщения |
| status | varchar | sent / failed |
| error_message | text | Сообщение об ошибке (если failed) |
| sent_at | datetime | Дата отправки |

**Дедупликация:** уведомление считается отправленным при совпадении `deadline_id` + `recipient_telegram_id` + `days_before`. Это позволяет отправлять 3 разных уведомления (за 14, 7, 3 дня) для одного дедлайна.

---

## 9. API-эндпоинты

### Аутентификация (`/api/auth`)
| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/auth/login` | Вход (email + password → JWT) |
| POST | `/api/auth/logout` | Выход |
| GET | `/api/auth/me` | Текущий пользователь |

### Пользователи (`/api/users`)
| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/users` | Список (пагинация, фильтр по роли, поиск) |
| GET | `/api/users/{id}` | Детали пользователя |
| POST | `/api/users` | Создание |
| PUT | `/api/users/{id}` | Обновление |
| DELETE | `/api/users/{id}` | Деактивация (soft delete) |
| POST | `/api/users/{id}/generate-code` | Код для Telegram |

### Дедлайны (`/api/deadlines`)
| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/deadlines` | Список (фильтр: client_id, type_id, status) |
| GET | `/api/deadlines/{id}` | Детали дедлайна |
| POST | `/api/deadlines` | Создание |
| PUT | `/api/deadlines/{id}` | Обновление |
| DELETE | `/api/deadlines/{id}` | Удаление |

### Дашборд (`/api/dashboard`)
| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/dashboard/stats` | Статистика (кэш 60с) |
| GET | `/api/dashboard/summary` | Сводка + срочные дедлайны |
| GET | `/api/dashboard/stats/by-type` | Статистика по типам |
| GET | `/api/dashboard/stats/by-client` | Топ-10 клиентов |

### Типы дедлайнов (`/api/deadline-types`)
| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/deadline-types` | Список типов |
| POST | `/api/deadline-types` | Создание (админ) |
| PUT | `/api/deadline-types/{id}` | Обновление (админ) |
| DELETE | `/api/deadline-types/{id}` | Деактивация (админ) |

### ККТ (`/api/cash-registers`)
| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/cash-registers` | Список всех ККТ |
| GET | `/api/cash-registers/client/{id}` | ККТ клиента |
| POST | `/api/cash-registers` | Создание + автодедлайны |
| PUT | `/api/cash-registers/{id}` | Обновление + синхр. дедлайнов |
| DELETE | `/api/cash-registers/{id}` | Удаление + удаление дедлайнов |

### ОФД-операторы (`/api/ofd-providers`)
| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/ofd-providers` | Список операторов |

### База данных (`/api/database`)
| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/database/backups` | Список бекапов |
| POST | `/api/database/backup` | Создать бекап (pg_dump) |
| POST | `/api/database/upload` | Загрузить .sql файл |
| POST | `/api/database/restore` | Восстановить из бекапа (пароль!) |
| GET | `/api/database/stats` | Статистика БД |
| GET | `/api/database/backups/{file}` | Скачать бекап |

---

## 10. Аутентификация и безопасность

### JWT-токены
- Алгоритм: HS256
- Время жизни: 24 часа
- Хранение на клиенте: `localStorage` (ключ `access_token`)
- Передача: заголовок `Authorization: Bearer <token>`

### Роли
| Роль | Доступ |
|------|--------|
| `client` | Только свой профиль (через Telegram-бот) |
| `manager` | Клиенты, дедлайны, экспорт, обращения |
| `admin` | Всё + управление БД, пользователи, системные настройки |

### Пароли
- Хэширование: bcrypt (salt rounds 12)
- Минимум: 8 символов, 1 буква + 1 цифра
- Пароль обязателен для менеджеров/админов, опционален для клиентов

### Nginx SSL
- Сертификат: Let's Encrypt (автообновление certbot)
- Заголовки: HSTS, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection

---

## 11. Система бекапов

### Автоматические бекапы
- **Расписание:** ежедневно в 03:00 MSK (cron)
- **Скрипт:** `/home/kktapp/backup-database.sh`
- **Хранилище:** `/home/kktapp/kkt-system/backups/database/`
- **Ретенция:** 7 дней (автобекапы старше 7 дней удаляются)
- **Формат:** `kkt_auto_backup_YYYYMMDD_HHMMSS.sql`
- **Лог:** `/var/log/kkt-backup.log`

### Ручные бекапы (через веб-интерфейс)
- Формат: `kkt_backup_YYYYMMDD_HHMMSS.sql`
- Метаданные: `backup_metadata.json` (автор, описание, дата)
- Ручные бекапы не удаляются автоматически

### Восстановление
1. Автоматически создаётся страховочный бекап (`kkt_pre_restore_*`)
2. Очищается schema public (`DROP SCHEMA public CASCADE`)
3. Выполняется `psql -f backup.sql`
4. Требуется пароль администратора

### Cron
```
0 3 * * * /home/kktapp/backup-database.sh >> /var/log/kkt-backup.log 2>&1
```

---

## 12. Кэширование (Redis)

- **Подключение:** `redis://redis:6379/0` (Docker-сеть)
- **Префикс ключей:** `kkt:`
- **TTL по умолчанию:** 60 секунд

### Кэшируемые данные
| Ключ | TTL | Данные |
|------|-----|--------|
| `kkt:dashboard:summary` | 60с | Статистика дашборда |
| `kkt:dashboard:stats_by_type` | 60с | Статистика по типам |
| `kkt:dashboard:stats_by_client` | 60с | Статистика по клиентам |
| `kkt:deadlines:urgent` | 60с | Срочные дедлайны |

Кэш инвалидируется при создании/обновлении/удалении дедлайнов и ККТ.

---

## 13. Уведомления

### Архитектура уведомлений
```
Планировщик (09:00 MSK)
  └── scheduled_deadline_check()
        ├── process_deadline_notifications(days=14)
        ├── process_deadline_notifications(days=7)
        └── process_deadline_notifications(days=3)
              ├── get_expiring_deadlines(days)     — получение дедлайнов (API или fallback SQL)
              ├── get_notification_recipients()     — получатели (админы + менеджеры + клиент)
              ├── check_notification_sent()          — дедупликация по (deadline_id, recipient, days_before)
              ├── format_deadline_notification()     — форматирование (с данными кассы)
              └── send_notification() + log_notification()
```

### Диапазонная фильтрация дедлайнов
Вместо точного совпадения (ровно N дней) используются диапазоны:
| Проверка | Диапазон days_remaining | Описание |
|----------|------------------------|----------|
| days=14 | 7 < remaining ≤ 14 | Дедлайны через 8-14 дней |
| days=7 | 3 < remaining ≤ 7 | Дедлайны через 4-7 дней |
| days=3 | remaining ≤ 3 | Дедлайны через 0-3 дня + просроченные |

Это гарантирует, что уведомление не потеряется, даже если бот был недоступен в нужный день.

### Получатели
1. **Администраторы** (из `TELEGRAM_ADMIN_IDS`) — получают ВСЕ уведомления
2. **Менеджеры** (из `telegram_manager_ids`) — получают ВСЕ уведомления
3. **Клиент** — получает уведомления только о своих дедлайнах (если `telegram_id` привязан и `notifications_enabled=true`)

### Дедупликация
Ключ: `(deadline_id, recipient_telegram_id, days_before)`.
- За один дедлайн каждый получатель получает максимум 3 уведомления (14д, 7д, 3д)
- Повторный запуск в тот же день — все skipped

### Формат сообщений
Для дедлайнов с привязанной кассой (Замена ФН, Продление ОФД):
```
🔴 КРИТИЧЕСКИ СРОЧНО!
━━━━━━━━━━━━━━━━━━━━
🛠 Тип: Замена ФН
🖨 Касса: АЗС Волжский
   • Модель: Казначей ФА
   • ФН: 7380440801354440
📍 Адрес ККТ: Самарская обл. п. Волжский, ул. Горького, 2б

🏢 Клиент: ИП Чиркова Н.А.
   • ИНН: 631819375338

⏰ Срок: 12.02.2026
⏳ Осталось: 2 дн.
```

### Ежедневная сводка администраторам
Отправляется в 09:00 МСК. Содержит:
- Статусы дедлайнов (зелёные, жёлтые, красные, просроченные)
- 5 ближайших дедлайнов (7 дней)

### Ключевые файлы бота
| Файл | Назначение |
|------|-----------|
| `bot/scheduler.py` | APScheduler — настройка cron-задач |
| `bot/services/checker.py` | Получение дедлайнов, получателей, дедупликация |
| `bot/services/notifier.py` | Отправка через Telegram, запись логов |
| `bot/services/formatter.py` | Форматирование сообщений (с данными кассы) |
| `bot/services/api_client.py` | HTTP-клиент для Web API |
| `bot/handlers/admin.py` | Команда /check (ручной запуск уведомлений) |

---

## 14. Развёртывание и управление

### Обычные операции
```bash
# Перезапуск бэкенда
systemctl restart kkt-backend

# Логи бэкенда
journalctl -u kkt-backend -f

# Пересборка фронтенда
cd /home/kktapp/kkt-system/web && npm run build

# Перезапуск бота (с пересозданием контейнера)
cd /home/kktapp/kkt-system && docker stop kkt-bot && docker rm kkt-bot && docker compose up -d bot

# Статус всех Docker-контейнеров
docker ps

# Подключение к БД
PGPASSWORD=KKT2024SecurePass psql -U kkt_user -d kkt_production -h localhost

# Создание бекапа вручную
/home/kktapp/backup-database.sh

# Логи бекапов
cat /var/log/kkt-backup.log
```

### Docker Compose сервисы
```bash
docker compose up -d postgres redis bot deployer  # Запуск всех
docker compose logs -f bot                         # Логи бота
```

### Обновление кода
1. Обновить файлы на сервере
2. `cd /home/kktapp/kkt-system/web && npm run build` (фронтенд)
3. `systemctl restart kkt-backend` (бэкенд)
4. `docker compose restart bot` (бот, если менялся)

---

## 15. Структура файлов

```
/home/kktapp/kkt-system/
├── .env                      # Переменные окружения
├── docker-compose.yml        # Docker Compose конфигурация
├── alembic.ini               # Конфигурация Alembic
├── backup-database.sh → /home/kktapp/backup-database.sh
├── backups/
│   └── database/             # SQL-бекапы
│       ├── backup_metadata.json
│       └── *.sql
├── backend/
│   ├── main.py               # FastAPI приложение
│   ├── config.py             # Настройки
│   ├── database.py           # SQLAlchemy
│   ├── models.py             # ORM-модели
│   ├── schemas.py            # Pydantic-схемы
│   ├── dependencies.py       # DI-зависимости
│   ├── cache.py              # Redis
│   ├── api/                  # API-роутеры
│   └── utils/                # Утилиты
├── bot/                      # Telegram-бот
│   ├── main.py
│   ├── config.py
│   ├── handlers/
│   └── services/
├── web/                      # React-фронтенд
│   ├── package.json
│   ├── vite.config.ts
│   ├── src/
│   └── dist/                 # Собранные файлы
├── deployment/               # Скрипты развёртывания
├── deployment-service/       # Deployer (GitHub webhooks)
├── _scripts_archive/         # Архив одноразовых скриптов
└── KKT_TECH_DOC.md          # Этот документ
```

---

## 16. Деплой на клиентские серверы

### Файлы деплоя
- `docker-compose.prod.yml` — Docker Compose для клиентских серверов (все сервисы в Docker)
- `nginx.prod.conf` — Nginx конфигурация для клиентских серверов
- `Dockerfile.frontend` / `Dockerfile.backend` / `Dockerfile.bot` — Docker-образы
- `.github/workflows/docker-build.yml` — CI/CD (сборка образов в GitHub Actions)
- `install.sh` — Скрипт установки на новый сервер

### CI/CD Pipeline
GitHub Actions собирает Docker-образы при пуше в `main`:
- `ghcr.io/zhurbarv-hub/kkt-backend:latest`
- `ghcr.io/zhurbarv-hub/kkt-bot:latest`
- `ghcr.io/zhurbarv-hub/kkt-frontend:latest`
- `ghcr.io/zhurbarv-hub/kkt-deployer:latest`

Фронтенд собирается из директории `web/` (не `web-new/`).

### nginx.prod.conf
- **По умолчанию** работает на HTTP (порт 80) без SSL
- **SSL опционален** — раздел HTTPS закомментирован с инструкциями по включению
- Инструкция по SSL: получить сертификат через certbot, раскомментировать секцию, добавить порт 443 в docker-compose

### Автообновление
На клиентских серверах используется **Watchtower** (профиль `client`) — автоматически обновляет контейнеры `kkt-backend`, `kkt-bot`, `kkt-nginx` при появлении новых образов в реестре (каждые 5 минут).

### Исправленные проблемы деплоя (2026-02-10)

| Проблема | Решение |
|----------|---------|
| SW urlPattern захардкожен на `kkt-box.net` | Заменён на универсальный `/\/api\/.*/i` |
| Редирект-петля авторизации (401 → reload → stale zustand → 401) | Очистка `auth-storage` из localStorage + защита от двойного редиректа |
| nginx.prod.conf: HTTP→HTTPS без SSL | HTTP работает по умолчанию, SSL опционален |
| GitHub Actions: `web-new/` не существует | Исправлено на `web/` |
| Бот не подключался к Redis | Добавлен `REDIS_HOST: redis` в environment (код использует REDIS_HOST, не REDIS_URL) |

### PWA / Service Worker
- `registerType: 'autoUpdate'` с `skipWaiting` — автообновление при появлении нового SW
- `navigateFallback: null` — отключён precache навигации (предотвращает кэширование стейл-версии index.html)
- API-кэш: `NetworkFirst` с TTL 1 час, максимум 100 записей
- urlPattern: `/\/api\/.*/i` — универсальный, работает на любом домене

### Защита от редирект-петли (api.ts)
При получении 401:
1. Удаляется `access_token` из localStorage
2. Удаляется `auth-storage` (zustand persist) из localStorage
3. Редирект на `/login` только если текущий путь не `/login`
4. Флаг `isRedirecting` предотвращает множественные редиректы

### Известные ограничения
- Роутер `support-requests` не зарегистрирован в `backend/main.py` (endpoint возвращает 404)
- На мастер-сервере используется **host PostgreSQL** (systemd), на клиентах — **Docker PostgreSQL**
