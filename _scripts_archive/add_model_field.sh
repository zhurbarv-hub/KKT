#!/bin/bash
set -e

echo "=== Добавление поля 'модель ККТ' в таблицы ==="

echo "1. Изменяем тип поля model в cash_registers..."
sudo -u postgres psql -d kkt_production -c "ALTER TABLE cash_registers ALTER COLUMN model TYPE VARCHAR(100);"

echo "2. Добавляем поле cash_register_model в deadlines..."
sudo -u postgres psql -d kkt_production -c "ALTER TABLE deadlines ADD COLUMN IF NOT EXISTS cash_register_model VARCHAR(100);"

echo "3. Заполняем поле cash_register_model из связанных cash_registers..."
sudo -u postgres psql -d kkt_production -c "UPDATE deadlines d SET cash_register_model = cr.model FROM cash_registers cr WHERE d.cash_register_id = cr.id AND d.cash_register_id IS NOT NULL;"

echo "4. Проверяем изменения..."
sudo -u postgres psql -d kkt_production -c "SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE (table_name = 'cash_registers' AND column_name = 'model') OR (table_name = 'deadlines' AND column_name = 'cash_register_model');"

echo "5. Пример данных..."
sudo -u postgres psql -d kkt_production -c "SELECT id, cash_register_id, cash_register_model, expiration_date FROM deadlines WHERE cash_register_id IS NOT NULL LIMIT 3;"

echo "=== Готово! ==="
