#!/bin/bash
set -e

# Colors
RED="\033[0;31m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
BLUE="\033[0;34m"
NC="\033[0m"

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════╗"
echo "║     KKT System Installer v1.1            ║"
echo "║     Система управления ККТ               ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Ошибка: Запустите скрипт от root (sudo)${NC}"
    exit 1
fi

# Check OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo -e "${RED}Ошибка: Не удалось определить ОС${NC}"
    exit 1
fi

echo -e "${GREEN}Операционная система: $OS $VERSION_ID${NC}"

# Installation directory
INSTALL_DIR="/opt/kkt"
mkdir -p $INSTALL_DIR
cd $INSTALL_DIR

# Collect configuration
echo ""
echo -e "${YELLOW}=== Настройка конфигурации ===${NC}"
echo ""

# Domain or IP
read -p "Домен или IP адрес (например: example.com или оставьте пустым для IP): " DOMAIN
if [ -z "$DOMAIN" ]; then
    DOMAIN=$(curl -s ifconfig.me)
    echo -e "${BLUE}Используется IP: $DOMAIN${NC}"
fi

# Telegram Bot Token
read -p "Telegram Bot Token (от @BotFather): " BOT_TOKEN
while [ -z "$BOT_TOKEN" ]; do
    echo -e "${RED}Bot Token обязателен!${NC}"
    read -p "Telegram Bot Token: " BOT_TOKEN
done

# Admin Telegram ID
read -p "Telegram ID администратора: " ADMIN_ID
while [ -z "$ADMIN_ID" ]; do
    echo -e "${RED}Admin ID обязателен!${NC}"
    read -p "Telegram ID администратора: " ADMIN_ID
done

# Email for SSL (if domain)
if [[ $DOMAIN != *"."* ]] || [[ $DOMAIN =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    USE_SSL="no"
    echo -e "${YELLOW}SSL не будет настроен (используется IP)${NC}"
else
    read -p "Email для SSL сертификата: " SSL_EMAIL
    USE_SSL="yes"
fi

# Generate secrets
DB_PASSWORD=$(openssl rand -base64 32 | tr -dc a-zA-Z0-9 | head -c 32)
JWT_SECRET=$(openssl rand -base64 64 | tr -dc a-zA-Z0-9 | head -c 86)

echo ""
echo -e "${YELLOW}=== Установка Docker ===${NC}"

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "Устанавливаю Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
else
    echo -e "${GREEN}Docker уже установлен${NC}"
fi

# Install Docker Compose plugin
if ! docker compose version &> /dev/null; then
    echo "Устанавливаю Docker Compose..."
    apt-get update && apt-get install -y docker-compose-plugin
fi

echo ""
echo -e "${YELLOW}=== Загрузка конфигурации ===${NC}"

# Download docker-compose and nginx config
curl -sL https://raw.githubusercontent.com/zhurbarv-hub/KKT/main/docker-compose.prod.yml -o docker-compose.yml
curl -sL https://raw.githubusercontent.com/zhurbarv-hub/KKT/main/nginx.prod.conf -o nginx.conf
curl -sL https://raw.githubusercontent.com/zhurbarv-hub/KKT/main/VERSION -o VERSION

# Update nginx config with domain
sed -i "s/DOMAIN/$DOMAIN/g" nginx.conf

# Create .env file (IS_MASTER=false for client installations)
cat > .env << EOF
# Database
DB_USER=kkt_user
DB_PASSWORD=$DB_PASSWORD
DB_NAME=kkt_production

# Security
JWT_SECRET_KEY=$JWT_SECRET

# Telegram Bot
TELEGRAM_BOT_TOKEN=$BOT_TOKEN
ADMIN_TELEGRAM_IDS=$ADMIN_ID

# Domain
DOMAIN=$DOMAIN

# System type (false = client with auto-updates)
IS_MASTER=false
EOF

# Create SSL directory
mkdir -p ssl

echo ""
echo -e "${YELLOW}=== Запуск сервисов ===${NC}"

# Pull images
docker compose pull

# Start core services first
docker compose up -d postgres redis
echo "Ожидаю запуска базы данных..."
sleep 15

# Start all services with client profile (includes Watchtower for auto-updates)
echo "Запускаю все сервисы с автообновлением..."
docker compose --profile client up -d

# SSL certificate (if domain)
if [ "$USE_SSL" = "yes" ]; then
    echo ""
    echo -e "${YELLOW}=== Получение SSL сертификата ===${NC}"
    docker compose run --rm certbot certonly --webroot \
        --webroot-path=/var/www/certbot \
        --email $SSL_EMAIL \
        --agree-tos \
        --no-eff-email \
        -d $DOMAIN || echo -e "${YELLOW}SSL сертификат не получен, можно настроить позже${NC}"
    docker compose restart nginx
fi

# Install kkt CLI
curl -sL https://raw.githubusercontent.com/zhurbarv-hub/KKT/main/kkt-cli.sh -o /usr/local/bin/kkt
chmod +x /usr/local/bin/kkt

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗"
echo "║     Установка завершена!                 ║"
echo "╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "Адрес системы: ${BLUE}http://$DOMAIN${NC}"
if [ "$USE_SSL" = "yes" ]; then
    echo -e "HTTPS: ${BLUE}https://$DOMAIN${NC}"
fi
echo ""
echo -e "Логин по умолчанию:"
echo -e "  Email: ${YELLOW}admin@kkt.local${NC}"
echo -e "  Пароль: ${YELLOW}admin123${NC}"
echo ""
echo -e "${RED}ВАЖНО: Смените пароль после первого входа!${NC}"
echo ""
echo -e "${GREEN}✓ Автообновления включены (Watchtower)${NC}"
echo "  Система будет автоматически обновляться при выходе новых версий"
echo ""
echo "Команды управления:"
echo "  kkt status  - статус сервисов"
echo "  kkt logs    - просмотр логов"
echo "  kkt backup  - создание резервной копии"
echo ""
