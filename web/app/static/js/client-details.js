// client-details.js - Детали клиента с кассами и дедлайнами

const API_BASE = '/api';
let currentUserId = null;
let clientData = null;
let deadlineTypes = [];
let ofdProviders = [];  // Список ОФД провайдеров
let registerDialog = null;
let deadlineDialog = null;

// Получить ID клиента из URL
function getUserIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

// Загрузка данных клиента
async function loadClientDetails() {
    const userId = getUserIdFromUrl();
    if (!userId) {
        alert('ID клиента не указан');
        window.location.href = '/static/dashboard.html';
        return;
    }

    currentUserId = userId;

    try {
        const response = await fetch(`${API_BASE}/users/${userId}/full-details`, {
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });

        if (!response.ok) {
            throw new Error(`Ошибка: ${response.status}`);
        }

        clientData = await response.json();
        console.log('Загруженные данные клиента:', clientData);
        console.log('ID клиента:', clientData.id);
        console.log('Кассы клиента:', clientData.cash_registers);
        if (clientData.cash_registers && clientData.cash_registers.length > 0) {
            console.log('Первая касса:', clientData.cash_registers[0]);
            console.log('ofd_provider_id первой кассы:', clientData.cash_registers[0].ofd_provider_id);
        }
        renderClientDetails();
    } catch (error) {
        console.error('Ошибка загрузки данных клиента:', error);
        alert('Не удалось загрузить данные клиента');
    }
}

// Отображение данных клиента
function renderClientDetails() {
    if (!clientData) return;

    // Заголовок с возможностью редактирования
    const clientNameElement = document.getElementById('clientName');
    clientNameElement.innerHTML = `
        <i class="material-icons" style="font-size: 32px; color: white;">business</i>
        <span id="companyNameText">${clientData.name || 'Без названия'}</span>
        <i class="material-icons edit-company-icon" onclick="editCompanyName()" title="Редактировать название">edit</i>
    `;

    const phoneInfo = clientData.phone ? ` | Телефон: ${clientData.phone}` : '';
    document.getElementById('clientInfo').textContent = `ИНН: ${clientData.inn || '-'} | Email: ${clientData.email || '-'}${phoneInfo}`;

    // Статус Telegram
    const telegramStatus = document.getElementById('telegramStatus');
    const telegramStatusText = document.getElementById('telegramStatusText');
    const sendToTelegramBtn = document.getElementById('sendToTelegramBtn');

    if (clientData.telegram_id) {
        telegramStatus.classList.remove('disconnected');
        telegramStatus.classList.add('connected');
        telegramStatusText.textContent = 'Подключен';

        // Показываем кнопку отправки в Telegram
        if (sendToTelegramBtn) {
            sendToTelegramBtn.style.display = 'inline-flex';
        }
    } else {
        telegramStatus.classList.remove('connected');
        telegramStatus.classList.add('disconnected');
        telegramStatusText.textContent = 'Не подключен';
    }

    // Сетка информации о клиенте
    const detailsGrid = document.getElementById('clientDetailsGrid');

    // Формируем карточки с информацией
    let cardsHTML = '';

    // Контактное лицо
    cardsHTML += `
        <div class="client-info-item editable-field" data-field="contact_person">
            <div class="client-info-icon">
                <i class="material-icons">person</i>
            </div>
            <div class="client-info-content">
                <div class="client-info-label">Контактное лицо</div>
                <div class="client-info-value ${!clientData.contact_person ? 'empty' : ''}">
                    ${clientData.contact_person || 'Не указано'}
                </div>
            </div>
        </div>
    `;

    // Телефон
    cardsHTML += `
        <div class="client-info-item editable-field" data-field="phone">
            <div class="client-info-icon">
                <i class="material-icons">phone</i>
            </div>
            <div class="client-info-content">
                <div class="client-info-label">Телефон</div>
                <div class="client-info-value ${!clientData.phone ? 'empty' : ''}">
                    ${clientData.phone ? `<a href="tel:${clientData.phone}">${clientData.phone}</a>` : 'Не указан'}
                </div>
            </div>
        </div>
    `;

    // Email
    cardsHTML += `
        <div class="client-info-item editable-field" data-field="email">
            <div class="client-info-icon">
                <i class="material-icons">email</i>
            </div>
            <div class="client-info-content">
                <div class="client-info-label">Email</div>
                <div class="client-info-value ${!clientData.email ? 'empty' : ''}">
                    ${clientData.email ? `<a href="mailto:${clientData.email}">${clientData.email}</a>` : 'Не указан'}
                </div>
            </div>
        </div>
    `;

    // Адрес
    cardsHTML += `
        <div class="client-info-item editable-field" data-field="address">
            <div class="client-info-icon">
                <i class="material-icons">location_on</i>
            </div>
            <div class="client-info-content">
                <div class="client-info-label">Адрес</div>
                <div class="client-info-value ${!clientData.address ? 'empty' : ''}">
                    ${clientData.address || 'Не указан'}
                </div>
            </div>
        </div>
    `;

    // Примечания
    cardsHTML += `
        <div class="client-info-item editable-field" data-field="notes">
            <div class="client-info-icon">
                <i class="material-icons">notes</i>
            </div>
            <div class="client-info-content">
                <div class="client-info-label">Примечания</div>
                <div class="client-info-value ${!clientData.notes ? 'empty' : ''}">
                    ${clientData.notes || 'Нет примечаний'}
                </div>
            </div>
        </div>
    `;

    // Telegram регистрация (только если не подключен)
    if (!clientData.telegram_id) {
        cardsHTML += `
            <div class="client-info-item telegram-item">
                <div class="client-info-icon">
                    <i class="material-icons">telegram</i>
                </div>
                <div class="client-info-content">
                    <div class="client-info-label">Telegram регистрация</div>
                    <div class="client-info-value">
                        <button class="mdl-button mdl-js-button mdl-button--raised mdl-button--colored" 
                                onclick="generateTelegramCode()" 
                                style="height: 32px; line-height: 32px; font-size: 13px; margin: 0;">
                            <i class="material-icons" style="font-size: 16px; vertical-align: middle;">vpn_key</i>
                            Сгенерировать код
                        </button>
                        <div class="telegram-code-block" id="telegramCodeBlock" style="display: none;">
                            <span class="telegram-code-display" id="telegramCodeDisplay"></span>
                            <button class="mdl-button mdl-js-button mdl-button--icon" 
                                    onclick="copyTelegramCode()" 
                                    title="Копировать код" 
                                    id="copyCodeButton">
                                <i class="material-icons" style="font-size: 18px;">content_copy</i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    detailsGrid.innerHTML = cardsHTML;

    // Добавление обработчиков для inline редактирования
    setTimeout(() => {
        const editableFields = document.querySelectorAll('.editable-field');
        editableFields.forEach(field => {
            field.addEventListener('click', function () {
                makeFieldEditable(field);
            });
        });
    }, 100);

    // Кассовые аппараты
    renderCashRegisters();

    // Дедлайны
    renderDeadlines();
}

// Отображение кассовых аппаратов
function renderCashRegisters() {
    const section = document.getElementById('cashRegistersSection');
    const count = document.getElementById('registersCount');
    const registers = clientData.cash_registers || [];

    count.textContent = registers.length;

    if (registers.length === 0) {
        section.innerHTML = '<p style="color: #999;">Кассовые аппараты не найдены</p>';
        return;
    }

    console.log('=== Начало рендеринга касс ===');
    console.log('Всего ОФД провайдеров загружено:', ofdProviders.length);
    console.log('Список ОФД провайдеров:', ofdProviders);

    // Создаём таблицу
    let html = `
        <div class="table-wrapper">
        <table class="mdl-data-table mdl-js-data-table" style="width: 100%;">
            <thead>
                <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                    <th class="mdl-data-table__cell--non-numeric" style="padding: 12px; font-weight: 600; border: none;">Название ККТ</th>
                    <th class="mdl-data-table__cell--non-numeric" style="padding: 12px; font-weight: 600; border: none;">Заводской номер</th>
                    <th class="mdl-data-table__cell--non-numeric" style="padding: 12px; font-weight: 600; border: none;">Номер ФН</th>
                    <th class="mdl-data-table__cell--non-numeric" style="padding: 12px; font-weight: 600; border: none;">Срок действия ФН</th>
                    <th class="mdl-data-table__cell--non-numeric" style="padding: 12px; font-weight: 600; border: none;">Срок действия ОФД</th>
                    <th class="mdl-data-table__cell--non-numeric" style="padding: 12px; font-weight: 600; text-align: center; border: none;">Действия</th>
                </tr>
            </thead>
            <tbody>
    `;

    registers.forEach(reg => {
        // Находим название ОФД провайдера по ID
        const ofdProvider = reg.ofd_provider_id
            ? ofdProviders.find(p => p.id === reg.ofd_provider_id)
            : null;
        const ofdName = ofdProvider ? ofdProvider.name : '-';

        // Форматирование дат
        const fnDate = reg.fn_expiry_date ? formatDateRU(reg.fn_expiry_date) : '-';
        const ofdDate = reg.ofd_expiry_date ? formatDateRU(reg.ofd_expiry_date) : '-';

        // Определяем цвет строки в зависимости от срока
        let rowBgColor = 'white';
        if (reg.fn_expiry_date || reg.ofd_expiry_date) {
            const today = new Date();
            const fnExpiry = reg.fn_expiry_date ? new Date(reg.fn_expiry_date) : null;
            const ofdExpiry = reg.ofd_expiry_date ? new Date(reg.ofd_expiry_date) : null;

            const fnDays = fnExpiry ? Math.floor((fnExpiry - today) / (1000 * 60 * 60 * 24)) : 999;
            const ofdDays = ofdExpiry ? Math.floor((ofdExpiry - today) / (1000 * 60 * 60 * 24)) : 999;
            const minDays = Math.min(fnDays, ofdDays);

            if (minDays < 0) {
                rowBgColor = '#ffebee'; // Просрочено - красный
            } else if (minDays <= 7) {
                rowBgColor = '#fff3e0'; // Критично - оранжевый
            } else if (minDays <= 14) {
                rowBgColor = '#fffde7'; // Внимание - жёлтый
            }
        }

        html += `
            <tr data-register-id="${reg.id}" 
                style="background: ${rowBgColor}; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;" 
                onmouseover="this.style.transform='scale(1.01)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'" 
                onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='none'">
                <td class="mdl-data-table__cell--non-numeric" style="padding: 12px; border-bottom: 1px solid #e0e0e0;">
                    <div style="font-weight: 600; color: #333;">${reg.register_name || reg.model || 'Касса'}</div>
                    <div style="font-size: 11px; color: #666; margin-top: 2px;">${reg.model || ''}</div>
                </td>
                <td class="mdl-data-table__cell--non-numeric" style="padding: 12px; border-bottom: 1px solid #e0e0e0;">
                    <span style="font-family: monospace; font-size: 13px;">${reg.factory_number || '-'}</span>
                </td>
                <td class="mdl-data-table__cell--non-numeric" style="padding: 12px; border-bottom: 1px solid #e0e0e0;">
                    <span style="font-family: monospace; font-size: 13px;">${reg.fn_number || '-'}</span>
                </td>
                <td class="mdl-data-table__cell--non-numeric" style="padding: 12px; border-bottom: 1px solid #e0e0e0;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <i class="material-icons" style="font-size: 16px; color: #666;">event</i>
                        <span style="font-weight: 500;">${fnDate}</span>
                    </div>
                </td>
                <td class="mdl-data-table__cell--non-numeric" style="padding: 12px; border-bottom: 1px solid #e0e0e0;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <i class="material-icons" style="font-size: 16px; color: #666;">event</i>
                        <span style="font-weight: 500;">${ofdDate}</span>
                    </div>
                </td>
                <td class="mdl-data-table__cell--non-numeric" style="padding: 12px; text-align: center; border-bottom: 1px solid #e0e0e0;">
                    <button class="mdl-button mdl-js-button mdl-button--icon" onclick="event.stopPropagation(); deleteRegister(${reg.id})" title="Удалить">
                        <i class="material-icons" style="color: #dc3545;">delete</i>
                    </button>
                </td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
        </div>
    `;

    section.innerHTML = html;

    // Добавление обработчиков клика на строки таблицы
    setTimeout(() => {
        const rows = document.querySelectorAll('#cashRegistersSection tr[data-register-id]');
        rows.forEach(row => {
            row.addEventListener('click', function (e) {
                // Проверяем, что клик не по кнопке удаления
                if (!e.target.closest('button') && !e.target.closest('.mdl-button')) {
                    const registerId = parseInt(row.getAttribute('data-register-id'));
                    editRegister(registerId);
                }
            });
        });
    }, 100);
}

// Отображение дедлайнов
function renderDeadlines() {
    renderRegisterDeadlines();
    renderGeneralDeadlines();
}

// Отображение дедлайнов по кассам
function renderRegisterDeadlines() {
    const section = document.getElementById('registerDeadlinesSection');
    const count = document.getElementById('registerDeadlinesCount');
    const deadlines = clientData.register_deadlines || [];

    count.textContent = deadlines.length;

    if (deadlines.length === 0) {
        section.innerHTML = '<p style="color: #999;">Дедлайны по кассам не найдены</p>';
        return;
    }

    // Создаём таблицу
    let html = `
        <div class="table-wrapper">
        <table class="mdl-data-table mdl-js-data-table" style="width: 100%;">
            <thead>
                <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                    <th class="mdl-data-table__cell--non-numeric" style="padding: 12px; font-weight: 600; border: none;">Название ККТ</th>
                    <th class="mdl-data-table__cell--non-numeric" style="padding: 12px; font-weight: 600; border: none;">Тип дедлайна</th>
                    <th class="mdl-data-table__cell--non-numeric" style="padding: 12px; font-weight: 600; border: none;">Адрес ККТ</th>
                    <th class="mdl-data-table__cell--non-numeric" style="padding: 12px; font-weight: 600; border: none;">Дата истечения</th>
                    <th class="mdl-data-table__cell--non-numeric" style="padding: 12px; font-weight: 600; border: none; text-align: center;">Остаток дней</th>
                    <th class="mdl-data-table__cell--non-numeric" style="padding: 12px; font-weight: 600; text-align: center; border: none;">Действия</th>
                </tr>
            </thead>
            <tbody>
    `;

    deadlines.forEach(dl => {
        // Определяем цвет строки в зависимости от срока
        let rowBgColor = 'white';
        if (dl.days_until_expiration < 0) {
            rowBgColor = '#ffebee'; // Просрочено - красный
        } else if (dl.days_until_expiration <= 7) {
            rowBgColor = '#fff3e0'; // Критично - оранжевый
        } else if (dl.days_until_expiration <= 14) {
            rowBgColor = '#fffde7'; // Внимание - жёлтый
        }

        const daysText = dl.days_until_expiration < 0
            ? `<span style="color: #d32f2f; font-weight: 600;">Просрочено на ${Math.abs(dl.days_until_expiration)} дн.</span>`
            : `<span style="font-weight: 600;">${dl.days_until_expiration} дн.</span>`;

        html += `
            <tr data-deadline-id="${dl.deadline_id}" 
                style="background: ${rowBgColor}; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;" 
                onmouseover="this.style.transform='scale(1.01)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'" 
                onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='none'">
                <td class="mdl-data-table__cell--non-numeric" style="padding: 12px; border-bottom: 1px solid #e0e0e0;">
                    <div style="font-weight: 600; color: #333;">
                        <i class="material-icons" style="font-size: 16px; vertical-align: middle; color: #666;">point_of_sale</i>
                        ${dl.cash_register_name || 'Касса'}
                    </div>
                </td>
                <td class="mdl-data-table__cell--non-numeric" style="padding: 12px; border-bottom: 1px solid #e0e0e0;">
                    <span style="font-weight: 500; color: #555;">${dl.deadline_type_name}</span>
                </td>
                <td class="mdl-data-table__cell--non-numeric" style="padding: 12px; border-bottom: 1px solid #e0e0e0;">
                    ${dl.installation_address ? `
                        <div style="font-size: 13px; color: #666;">
                            <i class="material-icons" style="font-size: 14px; vertical-align: middle; color: #999;">place</i>
                            ${dl.installation_address}
                        </div>
                    ` : '<span style="color: #999;">-</span>'}
                </td>
                <td class="mdl-data-table__cell--non-numeric" style="padding: 12px; border-bottom: 1px solid #e0e0e0;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <i class="material-icons" style="font-size: 16px; color: #666;">event</i>
                        <span style="font-weight: 500;">${formatDateRU(dl.expiration_date)}</span>
                    </div>
                </td>
                <td class="mdl-data-table__cell--non-numeric" style="padding: 12px; text-align: center; border-bottom: 1px solid #e0e0e0;">
                    ${daysText}
                </td>
                <td class="mdl-data-table__cell--non-numeric" style="padding: 12px; text-align: center; border-bottom: 1px solid #e0e0e0;">
                    <button class="mdl-button mdl-js-button mdl-button--icon" onclick="event.stopPropagation(); deleteDeadline(${dl.deadline_id})" title="Удалить">
                        <i class="material-icons" style="color: #dc3545;">delete</i>
                    </button>
                </td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
        </div>
    `;

    section.innerHTML = html;

    // Добавление обработчиков клика на строки таблицы
    setTimeout(() => {
        const rows = document.querySelectorAll('#registerDeadlinesSection tr[data-deadline-id]');
        rows.forEach(row => {
            row.addEventListener('click', function (e) {
                // Проверяем, что клик не по кнопке удаления
                if (!e.target.closest('button') && !e.target.closest('.mdl-button')) {
                    const deadlineId = parseInt(row.getAttribute('data-deadline-id'));
                    editDeadline(deadlineId, 'register');
                }
            });
        });
    }, 100);
}

// Отображение общих дедлайнов
function renderGeneralDeadlines() {
    const section = document.getElementById('generalDeadlinesSection');
    const count = document.getElementById('generalDeadlinesCount');
    const deadlines = clientData.general_deadlines || [];

    count.textContent = deadlines.length;

    if (deadlines.length === 0) {
        section.innerHTML = '<p style="color: #999;">Общие дедлайны не найдены</p>';
        return;
    }

    let html = '';
    deadlines.forEach(dl => {
        const statusClass = `status-${dl.status_color}`;
        const badgeClass = `badge-${dl.status_color}`;
        const daysText = dl.days_until_expiration < 0
            ? `Просрочено на ${Math.abs(dl.days_until_expiration)} дн.`
            : `Осталось ${dl.days_until_expiration} дн.`;

        html += `
            <div class="deadline-item ${statusClass}" data-deadline-id="${dl.deadline_id}" data-deadline-type="general">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <strong>${dl.deadline_type_name}</strong>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="badge ${badgeClass}">${daysText}</span>
                        <button class="mdl-button mdl-js-button mdl-button--icon" onclick="deleteDeadline(${dl.deadline_id})" title="Удалить">
                            <i class="material-icons" style="font-size: 18px;">delete</i>
                        </button>
                    </div>
                </div>
                <div style="font-size: 13px; color: #555;">
                    <i class="material-icons" style="font-size: 14px; vertical-align: middle;">event</i>
                    ${formatDateRU(dl.expiration_date)}
                </div>
                ${dl.notes ? `<div style="font-size: 12px; color: #777; margin-top: 4px;">${dl.notes}</div>` : ''}
            </div>
        `;
    });

    section.innerHTML = html;

    // Добавление обработчиков клика на общие дедлайны
    setTimeout(() => {
        const deadlineItems = document.querySelectorAll('#generalDeadlinesSection .deadline-item');
        deadlineItems.forEach(item => {
            item.style.cursor = 'pointer';
            item.addEventListener('click', function (e) {
                // Проверяем, что клик не по кнопке удаления
                if (!e.target.closest('button') && !e.target.closest('.mdl-button')) {
                    const deadlineId = parseInt(item.getAttribute('data-deadline-id'));
                    editDeadline(deadlineId, 'general');
                }
            });
        });
    }, 100);
}

// ========== ФУНКЦИИ ДЛЯ INLINE РЕДАКТИРОВАНИЯ ПОЛЕЙ КЛИЕНТА ==========

// Сделать поле редактируемым
function makeFieldEditable(fieldElement) {
    const fieldName = fieldElement.getAttribute('data-field');
    const currentValue = clientData[fieldName] || '';

    // Находим контейнер со значением
    const valueContainer = fieldElement.querySelector('.client-info-value');
    if (!valueContainer) {
        console.error('Не найден контейнер .client-info-value');
        return;
    }

    // Если это уже input, ничего не делаем
    if (valueContainer.querySelector('input') || valueContainer.querySelector('textarea')) {
        return;
    }

    let inputElement;
    if (fieldName === 'notes' || fieldName === 'address') {
        // Для больших полей используем textarea
        inputElement = document.createElement('textarea');
        inputElement.rows = 3;
        inputElement.style.width = '100%';
        inputElement.style.padding = '8px';
        inputElement.style.border = '2px solid #667eea';
        inputElement.style.borderRadius = '4px';
        inputElement.style.fontFamily = 'inherit';
        inputElement.style.fontSize = 'inherit';
        inputElement.style.boxSizing = 'border-box';
    } else {
        // Для остальных полей используем input
        inputElement = document.createElement('input');
        inputElement.type = 'text';
        inputElement.style.width = '100%';
        inputElement.style.padding = '8px';
        inputElement.style.border = '2px solid #667eea';
        inputElement.style.borderRadius = '4px';
        inputElement.style.fontFamily = 'inherit';
        inputElement.style.fontSize = 'inherit';
        inputElement.style.boxSizing = 'border-box';
    }

    inputElement.value = currentValue;

    // Заменяем содержимое valueContainer на input
    valueContainer.innerHTML = '';
    valueContainer.appendChild(inputElement);
    inputElement.focus();
    inputElement.select();

    // Обработчик потери фокуса
    inputElement.addEventListener('blur', async function () {
        const newValue = inputElement.value.trim();
        await saveClientField(fieldName, newValue, fieldElement);
    });

    // Обработчик Enter (кроме textarea)
    if (inputElement.tagName !== 'TEXTAREA') {
        inputElement.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                inputElement.blur();
            } else if (e.key === 'Escape') {
                // Отмена редактирования - восстанавливаем старое значение
                const oldValue = clientData[fieldName];
                let displayValue;
                if (fieldName === 'phone' && oldValue) {
                    displayValue = `<a href="tel:${oldValue}">${oldValue}</a>`;
                } else if (fieldName === 'email' && oldValue) {
                    displayValue = `<a href="mailto:${oldValue}">${oldValue}</a>`;
                } else {
                    displayValue = oldValue || (fieldName === 'notes' ? 'Нет примечаний' : 'Не указано');
                }
                valueContainer.innerHTML = displayValue;
            }
        });
    } else {
        // Для textarea только Escape
        inputElement.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                const oldValue = clientData[fieldName];
                valueContainer.innerHTML = oldValue || (fieldName === 'notes' ? 'Нет примечаний' : 'Не указано');
            }
        });
    }
}

// Сохранить изменение поля клиента
async function saveClientField(fieldName, newValue, fieldElement) {
    try {
        const updateData = {
            [fieldName]: newValue || null
        };

        const response = await fetch(`${API_BASE}/users/${currentUserId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify(updateData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Ошибка сохранения');
        }

        // Обновляем локальные данные
        clientData[fieldName] = newValue || null;

        // Восстанавливаем отображение с правильной HTML-структурой
        const valueContainer = fieldElement.querySelector('.client-info-value');
        if (valueContainer) {
            // Определяем правильное отображение в зависимости от поля
            let displayValue;
            if (fieldName === 'phone' && newValue) {
                displayValue = `<a href="tel:${newValue}">${newValue}</a>`;
            } else if (fieldName === 'email' && newValue) {
                displayValue = `<a href="mailto:${newValue}">${newValue}</a>`;
            } else {
                displayValue = newValue || (fieldName === 'notes' ? 'Нет примечаний' : 'Не указано');
            }

            valueContainer.innerHTML = displayValue;

            // Обновляем класс empty при необходимости
            if (!newValue) {
                valueContainer.classList.add('empty');
            } else {
                valueContainer.classList.remove('empty');
            }
        }
        fieldElement.style.cursor = 'pointer';

        // Обновляем заголовок если изменился телефон
        if (fieldName === 'phone') {
            const phoneInfo = clientData.phone ? ` | Телефон: ${clientData.phone}` : '';
            document.getElementById('clientInfo').textContent = `ИНН: ${clientData.inn || '-'} | Email: ${clientData.email || '-'}${phoneInfo}`;
        }

        // Показываем уведомление об успехе
        showNotification('Изменения сохранены');
    } catch (error) {
        console.error('Ошибка сохранения поля:', error);
        alert(`Ошибка: ${error.message}`);
        // Возвращаем старое значение с правильной HTML-структурой
        const valueContainer = fieldElement.querySelector('.client-info-value');
        if (valueContainer) {
            const oldValue = clientData[fieldName];
            let displayValue;
            if (fieldName === 'phone' && oldValue) {
                displayValue = `<a href="tel:${oldValue}">${oldValue}</a>`;
            } else if (fieldName === 'email' && oldValue) {
                displayValue = `<a href="mailto:${oldValue}">${oldValue}</a>`;
            } else {
                displayValue = oldValue || (fieldName === 'notes' ? 'Нет примечаний' : 'Не указано');
            }
            valueContainer.innerHTML = displayValue;
            if (!oldValue) {
                valueContainer.classList.add('empty');
            } else {
                valueContainer.classList.remove('empty');
            }
        }
        fieldElement.style.cursor = 'pointer';
    }
}

// Показать уведомление
function showNotification(message) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.right = '20px';
    notification.style.backgroundColor = '#4CAF50';
    notification.style.color = 'white';
    notification.style.padding = '12px 24px';
    notification.style.borderRadius = '4px';
    notification.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
    notification.style.zIndex = '10000';
    notification.style.fontSize = '14px';

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.transition = 'opacity 0.3s';
        notification.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 2000);
}

// ========== ФУНКЦИИ ДЛЯ TELEGRAM РЕГИСТРАЦИИ ==========

// Генерация кода регистрации для Telegram
async function generateTelegramCode() {
    try {
        const response = await fetch(`${API_BASE}/users/${currentUserId}/generate-code`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Ошибка генерации кода');
        }

        const result = await response.json();

        // Извлекаем код из сообщения (формат: "Код регистрации: XXXXX (действителен 24 часа)")
        const codeMatch = result.message.match(/Код регистрации: ([A-Z0-9]+)/);
        if (codeMatch && codeMatch[1]) {
            const code = codeMatch[1];

            // Отображаем код в новой структуре
            const codeDisplay = document.getElementById('telegramCodeDisplay');
            const codeBlock = document.getElementById('telegramCodeBlock');
            const copyButton = document.getElementById('copyCodeButton');

            if (codeDisplay && codeBlock && copyButton) {
                codeDisplay.textContent = code;
                codeBlock.style.display = 'flex';

                // Сохраняем код для копирования
                window.currentTelegramCode = code;

                showNotification('Код успешно сгенерирован. Отправьте его боту в Telegram. Код действителен 72 часа.');
            }
        } else {
            throw new Error('Не удалось извлечь код из ответа');
        }
    } catch (error) {
        console.error('Ошибка генерации кода:', error);
        alert(`Ошибка: ${error.message}`);
    }
}

// Копирование кода в буфер обмена
async function copyTelegramCode() {
    if (!window.currentTelegramCode) {
        alert('Код не сгенерирован');
        return;
    }

    try {
        await navigator.clipboard.writeText(window.currentTelegramCode);
        showNotification('Код скопирован в буфер обмена');
    } catch (error) {
        console.error('Ошибка копирования:', error);
        // Fallback для старых браузеров
        const textArea = document.createElement('textarea');
        textArea.value = window.currentTelegramCode;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showNotification('Код скопирован в буфер обмена');
        } catch (err) {
            alert('Не удалось скопировать код');
        }
        document.body.removeChild(textArea);
    }
}

// ========== ФУНКЦИИ ДЛЯ РАБОТЫ С КАССОВЫМИ АППАРАТАМИ ==========

// Функции для работы с РН ККТ (разбитое на 4 части)
function handleRnInput(input, nextFieldId) {
    // Разрешаем только цифры
    input.value = input.value.replace(/[^0-9]/g, '');

    // Автоматический переход на следующее поле
    if (input.value.length === 4 && nextFieldId) {
        document.getElementById(nextFieldId).focus();
    }
}

function handleRnBackspace(event, prevFieldId) {
    // При Backspace на пустом поле переходим на предыдущее
    if (event.key === 'Backspace' && event.target.value === '' && prevFieldId) {
        const prevField = document.getElementById(prevFieldId);
        prevField.focus();
        prevField.setSelectionRange(prevField.value.length, prevField.value.length);
    }
}

function handleRnPaste(event) {
    event.preventDefault();
    const pasteData = event.clipboardData.getData('text').replace(/[^0-9]/g, '');

    if (pasteData.length > 0) {
        // Распределяем цифры по полям
        const part1 = pasteData.substring(0, 4);
        const part2 = pasteData.substring(4, 8);
        const part3 = pasteData.substring(8, 12);
        const part4 = pasteData.substring(12, 16);

        document.getElementById('rnPart1').value = part1;
        if (part2) document.getElementById('rnPart2').value = part2;
        if (part3) document.getElementById('rnPart3').value = part3;
        if (part4) document.getElementById('rnPart4').value = part4;

        // Фокус на последнем заполненном поле
        if (part4) {
            document.getElementById('rnPart4').focus();
        } else if (part3) {
            document.getElementById('rnPart3').focus();
        } else if (part2) {
            document.getElementById('rnPart2').focus();
        } else {
            document.getElementById('rnPart1').focus();
        }
    }
}

function getRnValue() {
    // Собираем РН из 4 полей
    const part1 = document.getElementById('rnPart1').value;
    const part2 = document.getElementById('rnPart2').value;
    const part3 = document.getElementById('rnPart3').value;
    const part4 = document.getElementById('rnPart4').value;

    const fullRn = part1 + part2 + part3 + part4;
    return fullRn || null;
}

function setRnValue(value) {
    // Заполняем 4 поля из строки
    const rn = (value || '').replace(/[^0-9]/g, '');
    document.getElementById('rnPart1').value = rn.substring(0, 4) || '';
    document.getElementById('rnPart2').value = rn.substring(4, 8) || '';
    document.getElementById('rnPart3').value = rn.substring(8, 12) || '';
    document.getElementById('rnPart4').value = rn.substring(12, 16) || '';
}

// ========== ФУНКЦИИ ДЛЯ РАБОТЫ С КАССОВЫМИ АППАРАТАМИ ==========

// Загрузить список ОФД провайдеров
async function loadOFDProviders() {
    try {
        const response = await fetch(`${API_BASE}/ofd-providers?active_only=true`, {
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });

        if (!response.ok) {
            throw new Error(`Ошибка: ${response.status}`);
        }

        ofdProviders = await response.json();
        console.log('Загружено ОФД провайдеров:', ofdProviders.length);
    } catch (error) {
        console.error('Ошибка загрузки ОФД провайдеров:', error);
        ofdProviders = [];
    }
}

// Открыть диалог добавления кассы
function showAddRegisterDialog() {
    document.getElementById('registerDialogTitle').textContent = 'Добавить кассовый аппарат';
    document.getElementById('registerForm').reset();
    document.getElementById('registerId').value = '';

    // Заполняем список ОФД провайдеров
    const ofdSelect = document.getElementById('ofdProvider');
    ofdSelect.innerHTML = '<option value="">Не выбран</option>';
    ofdProviders.forEach(provider => {
        const option = document.createElement('option');
        option.value = provider.id;
        option.textContent = provider.name;  // Используем поле 'name' вместо 'provider_name'
        ofdSelect.appendChild(option);
    });

    registerDialog.showModal();
}

// Редактировать кассу
function editRegister(registerId) {
    const register = clientData.cash_registers.find(r => r.id === registerId);
    if (!register) {
        alert('Касса не найдена');
        return;
    }

    document.getElementById('registerDialogTitle').textContent = 'Редактировать кассовый аппарат';
    document.getElementById('registerId').value = register.id;
    document.getElementById('registerName').value = register.register_name || '';  // Название кассы
    document.getElementById('registerModel').value = register.model || '';  // Модель ККТ
    document.getElementById('serialNumber').value = register.factory_number || '';  // factory_number вместо serial_number
    setRnValue(register.registration_number);  // РН ККТ - используем новую функцию
    document.getElementById('fiscalDriveNumber').value = register.fn_number || '';  // fn_number вместо fiscal_drive_number
    document.getElementById('installationAddress').value = register.installation_address || '';  // Адрес установки
    document.getElementById('registerNotes').value = register.notes || '';
    document.getElementById('fnReplacementDate').value = register.fn_expiry_date || '';  // fn_expiry_date вместо fn_replacement_date
    document.getElementById('ofdRenewalDate').value = register.ofd_expiry_date || '';  // ofd_expiry_date вместо ofd_renewal_date

    // Заполняем список ОФД провайдеров и устанавливаем выбранный
    const ofdSelect = document.getElementById('ofdProvider');
    ofdSelect.innerHTML = '<option value="">Не выбран</option>';
    ofdProviders.forEach(provider => {
        const option = document.createElement('option');
        option.value = provider.id;
        option.textContent = provider.name;  // Используем поле 'name' вместо 'provider_name'
        if (register.ofd_provider_id && provider.id === register.ofd_provider_id) {
            option.selected = true;
        }
        ofdSelect.appendChild(option);
    });

    // Обновляем MDL textfield
    document.querySelectorAll('#registerForm .mdl-textfield').forEach(field => {
        field.MaterialTextfield.checkDirty();
    });

    registerDialog.showModal();
}

// Сохранить кассу
async function saveRegister() {
    const registerId = document.getElementById('registerId').value;
    const registerName = document.getElementById('registerName').value.trim();
    const registerModel = document.getElementById('registerModel').value.trim();
    const serialNumber = document.getElementById('serialNumber').value.trim();
    const registrationNumber = getRnValue();  // РН ККТ - используем новую функцию
    const fiscalDriveNumber = document.getElementById('fiscalDriveNumber').value.trim();
    const installationAddress = document.getElementById('installationAddress').value.trim();
    const ofdProviderId = document.getElementById('ofdProvider').value;  // Получаем ID провайдера
    const registerNotes = document.getElementById('registerNotes').value.trim();
    const fnReplacementDate = document.getElementById('fnReplacementDate').value || null;
    const ofdRenewalDate = document.getElementById('ofdRenewalDate').value || null;

    if (!registerName || !registerModel || !serialNumber || !fiscalDriveNumber) {
        alert('Заполните все обязательные поля');
        return;
    }

    const data = {
        client_id: clientData.id,  // Используем client_id вместо user_id
        register_name: registerName,  // Название кассы
        model: registerModel,  // Модель ККТ
        factory_number: serialNumber,  // Заводской номер (вместо serial_number)
        registration_number: registrationNumber || null,  // РН ККТ
        fn_number: fiscalDriveNumber,  // Номер ФН (вместо fiscal_drive_number)
        installation_address: installationAddress,  // Адрес установки
        ofd_provider_id: ofdProviderId ? parseInt(ofdProviderId) : null,
        notes: registerNotes || '',
        fn_expiry_date: fnReplacementDate,  // Дата окончания ФН (вместо fn_replacement_date)
        ofd_expiry_date: ofdRenewalDate  // Дата окончания договора ОФД (вместо ofd_renewal_date)
    };

    console.log('Текущий clientData:', clientData);
    console.log('Используемый user_id:', clientData.id, 'type:', typeof clientData.id);

    try {
        console.log('Отправка данных кассы:', data);

        let response;
        if (registerId) {
            // Редактирование
            response = await fetch(`${API_BASE}/cash-registers/${registerId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify(data)
            });
        } else {
            // Создание
            response = await fetch(`${API_BASE}/cash-registers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify(data)
            });
        }

        console.log('Статус ответа:', response.status, response.statusText);

        if (!response.ok) {
            let errorMessage = `Ошибка HTTP: ${response.status} ${response.statusText}`;
            try {
                const errorData = await response.json();
                console.log('Данные ошибки:', errorData);

                if (errorData.detail) {
                    // FastAPI возвращает ошибки в поле detail
                    if (typeof errorData.detail === 'string') {
                        errorMessage = errorData.detail;
                    } else if (Array.isArray(errorData.detail)) {
                        // Pydantic validation errors
                        errorMessage = errorData.detail.map(err =>
                            `${err.loc.join('.')}: ${err.msg}`
                        ).join(', ');
                    } else {
                        errorMessage = JSON.stringify(errorData.detail);
                    }
                } else if (errorData.message) {
                    errorMessage = errorData.message;
                } else {
                    errorMessage = JSON.stringify(errorData);
                }
            } catch (parseError) {
                console.error('Не удалось распарсить ошибку:', parseError);
                // Если не удалось распарсить JSON, попробуем получить текст
                try {
                    const textError = await response.text();
                    if (textError) {
                        errorMessage = textError;
                    }
                } catch (textError) {
                    console.error('Не удалось получить текст ошибки:', textError);
                }
            }
            throw new Error(errorMessage);
        }

        const result = await response.json();
        console.log('Касса успешно сохранена:', result);

        registerDialog.close();
        await loadClientDetails(); // Перезагрузка данных
        alert(registerId ? 'Касса успешно обновлена' : 'Касса успешно добавлена');
    } catch (error) {
        console.error('Ошибка сохранения кассы:', error);

        let errorMessage = 'Неизвестная ошибка';
        if (error.message) {
            errorMessage = error.message;
        } else if (typeof error === 'object') {
            try {
                errorMessage = JSON.stringify(error);
            } catch (e) {
                errorMessage = String(error);
            }
        } else {
            errorMessage = String(error);
        }

        alert(`Ошибка при сохранении кассы: ${errorMessage}`);
    }
}

// Удалить кассу
async function deleteRegister(registerId) {
    if (!confirm('Вы уверены, что хотите удалить эту кассу?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/cash-registers/${registerId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Ошибка удаления');
        }

        await loadClientDetails();
        alert('Касса успешно удалена');
    } catch (error) {
        console.error('Ошибка удаления кассы:', error);
        alert(`Ошибка: ${error.message}`);
    }
}

// ========== ФУНКЦИИ ДЛЯ РАБОТЫ С ДЕДЛАЙНАМИ ==========

// Загрузить типы дедлайнов
async function loadDeadlineTypes() {
    try {
        const response = await fetch(`${API_BASE}/deadline-types`, {
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });

        if (!response.ok) {
            throw new Error('Ошибка загрузки типов дедлайнов');
        }

        deadlineTypes = await response.json();
    } catch (error) {
        console.error('Ошибка загрузки типов:', error);
    }
}

// Открыть диалог добавления дедлайна
function showAddDeadlineDialog() {
    const modal = createDeadlineModal('add');
    document.body.appendChild(modal);
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);
}

// Открыть диалог добавления дедлайна по кассам (с предвыбранной кассой)
function showAddRegisterDeadlineDialog() {
    const modal = createDeadlineModal('add');
    document.body.appendChild(modal);
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);
}

// Редактировать дедлайн
function editDeadline(deadlineId, deadlineType) {
    let deadline = null;

    // Найти дедлайн в соответствующем массиве
    if (deadlineType === 'register') {
        deadline = clientData.register_deadlines.find(d => d.deadline_id === deadlineId);
    } else {
        deadline = clientData.general_deadlines.find(d => d.deadline_id === deadlineId);
    }

    if (!deadline) {
        alert('Дедлайн не найден');
        return;
    }

    // Преобразуем данные дедлайна в формат, аналогичный API
    const deadlineData = {
        id: deadlineId,
        deadline_type_id: deadline.deadline_type_id,
        cash_register_id: deadline.cash_register_id || null,
        expiration_date: deadline.expiration_date,
        notify_days_before: deadline.notify_days_before || 7,
        notification_enabled: deadline.notification_enabled !== false,
        notes: deadline.notes || ''
    };

    const modal = createDeadlineModal('edit', deadlineData);
    document.body.appendChild(modal);
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);
}

// Создание модального окна для дедлайна
function createDeadlineModal(mode, deadline = {}) {
    const isEdit = mode === 'edit';
    const title = isEdit ? 'Редактирование дедлайна' : 'Добавить дедлайн';

    const modalDiv = document.createElement('div');
    modalDiv.className = 'modal-overlay';
    modalDiv.style.zIndex = '999999';
    modalDiv.innerHTML = `
        <div class="modal" style="width: 600px; max-width: 90vw; border-radius: 12px; padding: 0; box-shadow: 0 10px 40px rgba(0,0,0,0.2);">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px 12px 0 0; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                <h3 style="margin: 0; font-size: 20px; font-weight: 500;">
                    <i class="material-icons" style="vertical-align: middle; margin-right: 8px; font-size: 24px;">event</i>
                    ${title}
                </h3>
                <button class="close-btn" onclick="closeDeadlineModal(this)">
                    <i class="material-icons">close</i>
                </button>
            </div>
            <div class="modal-body" style="padding: 24px; max-height: 70vh; overflow-y: auto;">
                <form id="deadlineForm" onsubmit="submitDeadlineForm(event, '${mode}', ${deadline.id || 'null'})">
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 6px; font-size: 13px; font-weight: 500; color: #555;">
                            <i class="material-icons" style="font-size: 16px; vertical-align: middle; margin-right: 4px; color: #667eea;">category</i>
                            Тип услуги *
                        </label>
                        <select id="deadline_type_id" required 
                                style="width: 100%; padding: 10px 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; background: white; transition: all 0.3s; cursor: pointer; box-sizing: border-box;"
                                onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102,126,234,0.1)'"
                                onblur="this.style.borderColor='#e0e0e0'; this.style.boxShadow='none'">
                            <option value="">Выберите тип услуги</option>
                        </select>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 6px; font-size: 13px; font-weight: 500; color: #555;">
                            <i class="material-icons" style="font-size: 16px; vertical-align: middle; margin-right: 4px; color: #667eea;">computer</i>
                            Кассовый аппарат
                        </label>
                        <select id="cash_register_id" 
                                style="width: 100%; padding: 10px 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; background: white; transition: all 0.3s; cursor: pointer; box-sizing: border-box;" 
                                onchange="updateCashRegisterModelField()"
                                onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102,126,234,0.1)'"
                                onblur="this.style.borderColor='#e0e0e0'; this.style.boxShadow='none'">
                            <option value="">Общий дедлайн (не привязан к кассе)</option>
                        </select>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 6px; font-size: 13px; font-weight: 500; color: #555;">
                            <i class="material-icons" style="font-size: 16px; vertical-align: middle; margin-right: 4px; color: #667eea;">devices</i>
                            Модель ККТ
                        </label>
                        <input type="text" id="cash_register_model" maxlength="100" 
                               value="${deadline.cash_register_model || ''}" 
                               style="width: 100%; padding: 10px 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; transition: all 0.3s; box-sizing: border-box;"
                               placeholder="Автоматически заполняется при выборе кассы"
                               onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102,126,234,0.1)'"
                               onblur="this.style.borderColor='#e0e0e0'; this.style.boxShadow='none'">
                        <small style="display: block; margin-top: 4px; font-size: 12px; color: #666;">Можно указать вручную для общих дедлайнов</small>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
                        <div>
                            <label style="display: block; margin-bottom: 6px; font-size: 13px; font-weight: 500; color: #555;">
                                <i class="material-icons" style="font-size: 16px; vertical-align: middle; margin-right: 4px; color: #667eea;">event</i>
                                Дата истечения *
                            </label>
                            <input type="date" id="expiration_date" required 
                                   value="${deadline.expiration_date || ''}" 
                                   style="width: 100%; padding: 10px 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; transition: all 0.3s; box-sizing: border-box;"
                                   onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102,126,234,0.1)'"
                                   onblur="this.style.borderColor='#e0e0e0'; this.style.boxShadow='none'">
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 6px; font-size: 13px; font-weight: 500; color: #555;">
                                <i class="material-icons" style="font-size: 16px; vertical-align: middle; margin-right: 4px; color: #667eea;">notifications</i>
                                Уведомлять за (дней) *
                            </label>
                            <input type="number" id="notify_days_before" min="1" required 
                                   value="${deadline.notify_days_before || 7}" 
                                   style="width: 100%; padding: 10px 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; transition: all 0.3s; box-sizing: border-box;"
                                   onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102,126,234,0.1)'"
                                   onblur="this.style.borderColor='#e0e0e0'; this.style.boxShadow='none'">
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 20px; padding: 12px; background: #f0f8ff; border-radius: 8px; border-left: 4px solid #667eea;">
                        <label style="display: flex; align-items: center; cursor: pointer; font-size: 14px; font-weight: 500; color: #555;">
                            <input type="checkbox" id="notification_enabled" ${deadline.notification_enabled !== false ? 'checked' : ''} 
                                   style="margin-right: 8px; width: 18px; height: 18px; cursor: pointer;">
                            <i class="material-icons" style="font-size: 18px; vertical-align: middle; margin-right: 6px; color: #667eea;">notifications_active</i>
                            Включить уведомления
                        </label>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 6px; font-size: 13px; font-weight: 500; color: #555;">
                            <i class="material-icons" style="font-size: 16px; vertical-align: middle; margin-right: 4px; color: #667eea;">notes</i>
                            Заметки
                        </label>
                        <textarea id="notes" rows="3" 
                                  style="width: 100%; padding: 10px 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; resize: vertical; font-family: inherit; transition: all 0.3s; box-sizing: border-box;"
                                  onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102,126,234,0.1)'"
                                  onblur="this.style.borderColor='#e0e0e0'; this.style.boxShadow='none'">${deadline.notes || ''}</textarea>
                    </div>
                    
                    <div style="padding: 16px 24px; background: #f8f9fa; border-radius: 0 0 12px 12px; display: flex; gap: 12px; justify-content: flex-end; margin: 0 -24px -24px -24px;">
                        <button type="button" onclick="closeDeadlineModal(this)" 
                                style="padding: 10px 24px; border: 2px solid #e0e0e0; background: white; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.3s; display: inline-flex; align-items: center; gap: 6px;"
                                onmouseover="this.style.background='#f5f5f5'"
                                onmouseout="this.style.background='white'">
                            <i class="material-icons" style="font-size: 18px;">close</i>
                            Отмена
                        </button>
                        <button type="submit" 
                                style="padding: 10px 24px; border: none; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; box-shadow: 0 2px 8px rgba(102,126,234,0.3); transition: all 0.3s; display: inline-flex; align-items: center; gap: 6px;"
                                onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(102,126,234,0.4)'"
                                onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(102,126,234,0.3)'">
                            <i class="material-icons" style="font-size: 18px;">save</i>
                            ${isEdit ? 'Сохранить' : 'Создать'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    // Загружаем списки типов и касс
    setTimeout(() => {
        loadDeadlineTypesForModal(deadline.deadline_type_id);
        loadCashRegistersForModal(deadline.cash_register_id);
    }, 50);

    return modalDiv;
}

// Загрузить типы дедлайнов для модального окна
function loadDeadlineTypesForModal(selectedId) {
    const select = document.getElementById('deadline_type_id');
    if (!select) return;

    select.innerHTML = '<option value="">Выберите тип услуги</option>';
    deadlineTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type.id;
        option.textContent = type.type_name;
        if (selectedId && type.id === selectedId) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

// Загрузить кассовые аппараты для модального окна
function loadCashRegistersForModal(selectedId) {
    const select = document.getElementById('cash_register_id');
    if (!select) return;

    select.innerHTML = '<option value="">Общий дедлайн (не привязан к кассе)</option>';
    if (clientData.cash_registers) {
        clientData.cash_registers.forEach(reg => {
            if (reg.is_active) {
                const option = document.createElement('option');
                option.value = reg.id;
                option.textContent = reg.register_name || `Касса #${reg.id}`;
                option.setAttribute('data-model', reg.model || '');  // Сохраняем модель в data-атрибуте
                if (selectedId && reg.id === selectedId) {
                    option.selected = true;
                }
                select.appendChild(option);
            }
        });
    }
}

// Обновить поле модели ККТ при выборе кассы
function updateCashRegisterModelField() {
    const cashRegisterSelect = document.getElementById('cash_register_id');
    const modelInput = document.getElementById('cash_register_model');

    if (!cashRegisterSelect || !modelInput) return;

    const selectedOption = cashRegisterSelect.options[cashRegisterSelect.selectedIndex];
    const model = selectedOption.getAttribute('data-model') || '';

    if (cashRegisterSelect.value) {
        // Если выбрана касса, автоматически заполняем модель
        modelInput.value = model;
    }
    // Если не выбрана (общий дедлайн), поле остается для ручного ввода
}

// Закрыть модальное окно дедлайна
function closeDeadlineModal(element) {
    const modal = element.closest('.modal-overlay');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 300);
    }
}

// Отправка формы дедлайна
async function submitDeadlineForm(event, mode, deadlineId) {
    event.preventDefault();

    const formData = {
        client_id: clientData.id,
        deadline_type_id: parseInt(document.getElementById('deadline_type_id').value),
        cash_register_id: document.getElementById('cash_register_id').value ? parseInt(document.getElementById('cash_register_id').value) : null,
        cash_register_model: document.getElementById('cash_register_model').value.trim() || null,  // Модель ККТ
        expiration_date: document.getElementById('expiration_date').value,
        notify_days_before: parseInt(document.getElementById('notify_days_before').value),
        notification_enabled: document.getElementById('notification_enabled').checked,
        notes: document.getElementById('notes').value || '',
        status: 'active'
    };

    console.log('Отправка формы дедлайна:', mode, formData);

    const token = getToken();
    const url = mode === 'edit' ? `${API_BASE}/deadlines/${deadlineId}` : `${API_BASE}/deadlines`;
    const method = mode === 'edit' ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Ошибка сохранения');
        }

        // Закрыть модальное окно
        const modal = document.querySelector('.modal-overlay');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 300);
        }

        // Перезагрузить данные клиента
        await loadClientDetails();
        alert(mode === 'edit' ? 'Дедлайн успешно обновлен' : 'Дедлайн успешно добавлен');
    } catch (error) {
        console.error('Ошибка сохранения дедлайна:', error);
        alert(`Ошибка: ${error.message}`);
    }
}

// Удалить дедлайн
async function deleteDeadline(deadlineId) {
    if (!confirm('Вы уверены, что хотите удалить этот дедлайн?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/deadlines/${deadlineId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Ошибка удаления');
        }

        await loadClientDetails();
        alert('Дедлайн успешно удален');
    } catch (error) {
        console.error('Ошибка удаления дедлайна:', error);
        alert(`Ошибка: ${error.message}`);
    }
}

// Отправить дедлайны в Telegram
async function sendDeadlinesToTelegram() {
    if (!currentUserId) {
        alert('Не удалось определить ID клиента');
        return;
    }

    // Проверяем, подключен ли Telegram
    if (!clientData.telegram_id) {
        alert('Клиент не подключен к Telegram');
        return;
    }

    // Подтверждение отправки
    const clientName = clientData.company_name || clientData.full_name || 'клиенту';
    const totalDeadlines = (clientData.register_deadlines?.length || 0) + (clientData.general_deadlines?.length || 0);

    if (totalDeadlines === 0) {
        alert('У клиента нет активных дедлайнов для отправки');
        return;
    }

    if (!confirm(`Отправить ${totalDeadlines} дедлайн(ов) клиенту ${clientName} в Telegram?`)) {
        return;
    }

    // Отключаем кнопку и показываем индикатор загрузки
    const btn = document.getElementById('sendToTelegramBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="material-icons" style="font-size: 16px; vertical-align: middle; margin-right: 6px;">hourglass_empty</i>Отправка...';

    try {
        const response = await fetch(`${API_BASE}/users/${currentUserId}/send-deadlines-telegram`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Ошибка отправки');
        }

        const result = await response.json();

        // Успех
        showNotification(result.message || 'Дедлайны успешно отправлены в Telegram!');

        // Возвращаем кнопку в исходное состояние с галочкой
        btn.innerHTML = '<i class="material-icons" style="font-size: 16px; vertical-align: middle; margin-right: 6px;">check</i>Отправлено';
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }, 2000);

    } catch (error) {
        console.error('Ошибка отправки дедлайнов:', error);
        alert(`Ошибка: ${error.message}`);

        // Возвращаем кнопку в исходное состояние
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// Обработчики кнопок
document.addEventListener('DOMContentLoaded', function () {
    // Проверка авторизации
    if (!getToken()) {
        window.location.href = '/static/login.html';
        return;
    }

    // Установка имени пользователя
    const currentUser = getCurrentUser();
    if (currentUser) {
        document.getElementById('sidebarUserName').textContent = currentUser.username || currentUser.email;
    }

    // Кнопка выхода
    document.getElementById('sidebarLogoutBtn').addEventListener('click', function () {
        logout();
        window.location.href = '/static/login.html';
    });

    // Инициализация диалогов
    registerDialog = document.getElementById('registerDialog');

    // Кнопки добавления
    document.getElementById('addRegisterBtn').addEventListener('click', showAddRegisterDialog);
    document.getElementById('addDeadlineBtn').addEventListener('click', showAddDeadlineDialog);
    document.getElementById('addRegisterDeadlineBtn').addEventListener('click', showAddRegisterDeadlineDialog);

    // Кнопки сохранения в диалогах
    document.getElementById('saveRegisterBtn').addEventListener('click', saveRegister);

    // Кнопки закрытия диалогов
    document.getElementById('closeRegisterDialog').addEventListener('click', function () {
        registerDialog.close();
    });

    // Кнопка отправки в Telegram
    const sendToTelegramBtn = document.getElementById('sendToTelegramBtn');
    if (sendToTelegramBtn) {
        sendToTelegramBtn.addEventListener('click', sendDeadlinesToTelegram);
    }

    // Загрузка данных
    Promise.all([
        loadDeadlineTypes(),
        loadOFDProviders()
    ]).then(() => {
        loadClientDetails();
    });
});

// ========== РЕДАКТИРОВАНИЕ НАЗВАНИЯ КОМПАНИИ ==========

// Редактировать название компании
function editCompanyName() {
    const companyNameText = document.getElementById('companyNameText');
    const currentName = clientData.name || '';

    // Создаём input для редактирования
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.className = 'company-name-input';
    input.style.maxWidth = '600px';

    // Заменяем текст на input
    companyNameText.replaceWith(input);
    input.focus();
    input.select();

    // Обработчик потери фокуса
    input.addEventListener('blur', async function () {
        const newName = input.value.trim();
        await saveCompanyName(newName, input);
    });

    // Обработчик Enter
    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            input.blur();
        } else if (e.key === 'Escape') {
            // Отмена - восстанавливаем старое значение
            const span = document.createElement('span');
            span.id = 'companyNameText';
            span.textContent = currentName || 'Без названия';
            input.replaceWith(span);
        }
    });
}

// Сохранить новое название компании
async function saveCompanyName(newName, inputElement) {
    if (!newName) {
        alert('Название компании не может быть пустым');
        // Возвращаем старое значение
        restoreCompanyNameDisplay(clientData.name || 'Без названия', inputElement);
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/users/${currentUserId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({ company_name: newName })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Ошибка сохранения');
        }

        // Обновляем локальные данные
        clientData.name = newName;

        // Восстанавливаем отображение с иконкой редактирования
        restoreCompanyNameDisplay(newName, inputElement);

        showNotification('Название компании успешно обновлено');
    } catch (error) {
        console.error('Ошибка сохранения названия:', error);
        alert(`Ошибка: ${error.message}`);

        // Возвращаем старое значение
        restoreCompanyNameDisplay(clientData.name || 'Без названия', inputElement);
    }
}

// Восстановить отображение названия компании
function restoreCompanyNameDisplay(name, inputElement) {
    const span = document.createElement('span');
    span.id = 'companyNameText';
    span.textContent = name;
    inputElement.replaceWith(span);
}
