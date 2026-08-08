#!/bin/bash
cd /home/kktapp/kkt-system
source venv/bin/activate

echo "============================================================"
echo "БЫСТРЫЙ ТЕСТ ВОССТАНОВЛЕНИЯ БД"
echo "============================================================"

BACKUP="/home/kktapp/kkt-system/backups/database/kkt_test_backup.sql"

echo ""
echo "📊 Проверка наличия бэкапа..."
if [ ! -f "$BACKUP" ]; then
    echo "❌ Файл не найден: $BACKUP"
    exit 1
fi

SIZE=$(du -h "$BACKUP" | cut -f1)
echo "✅ Найден: $SIZE"

echo ""
echo "🔄 Запуск оптимизированного восстановления..."
START=$(date +%s)

PGPASSWORD="<DB_PASSWORD из .env>" psql \
    -h localhost \
    -p 5432 \
    -U kkt_user \
    -d kkt_production \
    -f "$BACKUP" \
    --single-transaction \
    --set ON_ERROR_STOP=on \
    -v ON_ERROR_STOP=1 \
    -q

EXIT_CODE=$?
END=$(date +%s)
ELAPSED=$((END - START))

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Восстановление завершено за ${ELAPSED} сек"
else
    echo "❌ Ошибка восстановления (код: $EXIT_CODE)"
    exit 1
fi

echo ""
echo "============================================================"
echo "РЕЗУЛЬТАТ: ✅ УСПЕХ"
echo "Время: ${ELAPSED} секунд"
echo "============================================================"
