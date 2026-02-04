#!/bin/bash
set -e

# Colors
RED="\033[0;31m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
BLUE="\033[0;34m"
NC="\033[0m"

INSTALL_DIR="/opt/kkt"
cd $INSTALL_DIR 2>/dev/null || { echo -e "${RED}KKT не установлен. Запустите install.sh${NC}"; exit 1; }

case "$1" in
    status)
        echo -e "${BLUE}=== Статус сервисов KKT ===${NC}"
        docker compose ps
        ;;
    
    logs)
        SERVICE=${2:-""}
        if [ -z "$SERVICE" ]; then
            docker compose logs -f --tail=100
        else
            docker compose logs -f --tail=100 $SERVICE
        fi
        ;;
    
    update)
        echo -e "${YELLOW}=== Обновление KKT System ===${NC}"
        echo "Загружаю новые образы..."
        docker compose pull
        echo "Перезапускаю сервисы..."
        docker compose up -d
        echo -e "${GREEN}Обновление завершено!${NC}"
        ;;
    
    backup)
        BACKUP_DIR="$INSTALL_DIR/backups"
        mkdir -p $BACKUP_DIR
        TIMESTAMP=$(date +%Y%m%d_%H%M%S)
        BACKUP_FILE="$BACKUP_DIR/kkt_backup_$TIMESTAMP.sql.gz"
        
        echo -e "${YELLOW}=== Создание резервной копии ===${NC}"
        source .env
        docker compose exec -T postgres pg_dump -U $DB_USER $DB_NAME | gzip > $BACKUP_FILE
        echo -e "${GREEN}Бэкап создан: $BACKUP_FILE${NC}"
        
        # Keep only last 7 backups
        ls -t $BACKUP_DIR/*.sql.gz 2>/dev/null | tail -n +8 | xargs -r rm
        echo "Сохранено последних 7 бэкапов"
        ;;
    
    restore)
        if [ -z "$2" ]; then
            echo "Доступные бэкапы:"
            ls -la $INSTALL_DIR/backups/*.sql.gz 2>/dev/null || echo "Нет бэкапов"
            echo ""
            echo "Использование: kkt restore <файл.sql.gz>"
            exit 1
        fi
        
        BACKUP_FILE="$2"
        if [ ! -f "$BACKUP_FILE" ]; then
            BACKUP_FILE="$INSTALL_DIR/backups/$2"
        fi
        
        if [ ! -f "$BACKUP_FILE" ]; then
            echo -e "${RED}Файл не найден: $2${NC}"
            exit 1
        fi
        
        echo -e "${YELLOW}=== Восстановление из бэкапа ===${NC}"
        echo -e "${RED}ВНИМАНИЕ: Все текущие данные будут заменены!${NC}"
        read -p "Продолжить? (y/n): " CONFIRM
        if [ "$CONFIRM" != "y" ]; then
            echo "Отменено"
            exit 0
        fi
        
        source .env
        gunzip -c $BACKUP_FILE | docker compose exec -T postgres psql -U $DB_USER $DB_NAME
        echo -e "${GREEN}Восстановление завершено!${NC}"
        ;;
    
    restart)
        echo -e "${YELLOW}=== Перезапуск сервисов ===${NC}"
        docker compose restart
        echo -e "${GREEN}Готово!${NC}"
        ;;
    
    stop)
        echo -e "${YELLOW}=== Остановка сервисов ===${NC}"
        docker compose stop
        echo -e "${GREEN}Сервисы остановлены${NC}"
        ;;
    
    start)
        echo -e "${YELLOW}=== Запуск сервисов ===${NC}"
        docker compose up -d
        echo -e "${GREEN}Сервисы запущены${NC}"
        ;;
    
    shell)
        SERVICE=${2:-"backend"}
        echo -e "${BLUE}Подключение к $SERVICE...${NC}"
        docker compose exec $SERVICE /bin/sh
        ;;
    
    db)
        echo -e "${BLUE}Подключение к PostgreSQL...${NC}"
        source .env
        docker compose exec postgres psql -U $DB_USER $DB_NAME
        ;;
    
    ssl-renew)
        echo -e "${YELLOW}=== Обновление SSL сертификата ===${NC}"
        docker compose run --rm certbot renew
        docker compose restart nginx
        echo -e "${GREEN}SSL сертификат обновлён${NC}"
        ;;
    
    version)
        echo -e "${BLUE}KKT System${NC}"
        echo "CLI version: 1.0.0"
        echo ""
        echo "Docker images:"
        docker compose images
        ;;
    
    *)
        echo -e "${BLUE}KKT System CLI${NC}"
        echo ""
        echo "Использование: kkt <команда> [параметры]"
        echo ""
        echo "Команды:"
        echo "  status        Статус всех сервисов"
        echo "  logs [сервис] Просмотр логов (backend|bot|nginx|postgres)"
        echo "  update        Обновить до последней версии"
        echo "  backup        Создать резервную копию БД"
        echo "  restore <файл> Восстановить из бэкапа"
        echo "  restart       Перезапустить все сервисы"
        echo "  start         Запустить сервисы"
        echo "  stop          Остановить сервисы"
        echo "  shell [сервис] Открыть shell в контейнере"
        echo "  db            Подключиться к PostgreSQL"
        echo "  ssl-renew     Обновить SSL сертификат"
        echo "  version       Показать версии"
        echo ""
        ;;
esac
