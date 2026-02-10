#!/bin/bash
echo "=== Перезапуск kkt-web.service ==="
sudo systemctl restart kkt-web.service
sleep 3

echo "=== Проверка статуса ==="
systemctl status kkt-web.service --no-pager -n 5

echo ""
echo "=== Тестирование API дедлайнов ==="
bash /tmp/test_api.sh
