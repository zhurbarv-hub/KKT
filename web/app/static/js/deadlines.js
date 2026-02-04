/**
 * Управление дедлайнами
 */

// Константы API (если ещё не объявлены)
if (typeof API_BASE_URL === 'undefined') {
    var API_BASE_URL = window.location.origin + '/api';
}

const deadlinesSection = document.getElementById('deadlines-section');
let allDeadlines = []; // Храним все дедлайны для фильтрации
let currentPageSize = 20; // По умолчанию 20 записей
let currentFilters = {
    client: '',
    type: '',
    daysRange: 'all',
    status: 'all'
};

/**
 * Загрузка списка дедлайнов
 */
async function loadDeadlinesData() {
    try {
        const token = localStorage.getItem('access_token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');

        let url = `${API_BASE_URL}/deadlines?page=1&page_size=100`; // Максимум 100 записей (ограничение API)

        // Для клиентов показываем только их дедлайны
        if (user.role === 'client') {
            url += `&client_id=${user.id}`;
        }

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                handleLogout();
                return;
            }
            throw new Error('Ошибка загрузки дедлайнов: ' + response.status);
        }

        const data = await response.json();
        allDeadlines = data.deadlines || [];

        renderDeadlinesTable(allDeadlines);
        renderDeadlinesPagination(data);
    } catch (error) {
        console.error('Ошибка загрузки дедлайнов:', error);
        showDeadlinesError('Не удалось загрузить список дедлайнов');
    }
}

/**
 * Отображение таблицы дедлайнов
 */
function renderDeadlinesTable(deadlines) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = ['admin', 'manager'].includes(user.role);

    // Ограничиваем количество отображаемых записей
    const totalDeadlines = deadlines.length;
    const displayDeadlines = deadlines.slice(0, currentPageSize);

    // Создаем уникальные списки для фильтров
    const uniqueClients = [...new Set(allDeadlines.map(d => d.client?.company_name || d.client?.name).filter(Boolean))];
    const uniqueTypes = [...new Set(allDeadlines.map(d => d.deadline_type?.name || d.deadline_type?.type_name).filter(Boolean))];

    const tableHTML = `
        <div class="section-header">
            <h2>⏰ Управление дедлайнами</h2>
            ${isAdmin ? `
            <button class="mdl-button mdl-js-button mdl-button--raised mdl-button--colored" 
                    onclick="showAddDeadlineModal()">
                <i class="material-icons">add</i> Добавить дедлайн
            </button>
            ` : ''}
        </div>
        
        <!-- Панель фильтров -->
        <div class="mdl-card mdl-shadow--4dp" style="width: 100%; margin-bottom: 24px; border-radius: 12px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; color: white;">
                <h4 style="margin: 0; font-size: 18px; font-weight: 500; display: flex; align-items: center; gap: 8px;">
                    <i class="material-icons" style="font-size: 24px;">filter_alt</i>
                    Фильтры и настройки
                </h4>
            </div>
            <div style="padding: 24px;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px;">
                    ${isAdmin ? `
                    <div>
                        <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #555; font-size: 13px;">
                            <i class="material-icons" style="font-size: 16px; vertical-align: middle; margin-right: 4px; color: #667eea;">business</i>
                            Клиент
                        </label>
                        <select id="filterClient" style="width: 100%; padding: 12px 14px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; background: white; transition: all 0.3s; cursor: pointer; box-sizing: border-box;" 
                                onchange="applyFilters()"
                                onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102,126,234,0.1)'"
                                onblur="this.style.borderColor='#e0e0e0'; this.style.boxShadow='none'">
                            <option value="">Все клиенты</option>
                            ${uniqueClients.map(client => `<option value="${client}">${client}</option>`).join('')}
                        </select>
                    </div>
                    ` : ''}
                    
                    <div>
                        <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #555; font-size: 13px;">
                            <i class="material-icons" style="font-size: 16px; vertical-align: middle; margin-right: 4px; color: #667eea;">category</i>
                            Тип услуги
                        </label>
                        <select id="filterType" style="width: 100%; padding: 12px 14px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; background: white; transition: all 0.3s; cursor: pointer; box-sizing: border-box;"
                                onchange="applyFilters()"
                                onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102,126,234,0.1)'"
                                onblur="this.style.borderColor='#e0e0e0'; this.style.boxShadow='none'">
                            <option value="">Все типы</option>
                            ${uniqueTypes.map(type => `<option value="${type}">${type}</option>`).join('')}
                        </select>
                    </div>
                    
                    <div>
                        <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #555; font-size: 13px;">
                            <i class="material-icons" style="font-size: 16px; vertical-align: middle; margin-right: 4px; color: #667eea;">schedule</i>
                            Осталось дней
                        </label>
                        <select id="filterDays" style="width: 100%; padding: 12px 14px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; background: white; transition: all 0.3s; cursor: pointer; box-sizing: border-box;"
                                onchange="applyFilters()"
                                onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102,126,234,0.1)'"
                                onblur="this.style.borderColor='#e0e0e0'; this.style.boxShadow='none'">
                            <option value="all">Все</option>
                            <option value="expired">Просрочено (< 0)</option>
                            <option value="urgent">Срочно (0-7 дн.)</option>
                            <option value="soon">Скоро (8-30 дн.)</option>
                            <option value="normal">Активно (> 30 дн.)</option>
                        </select>
                    </div>
                    
                    <div>
                        <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #555; font-size: 13px;">
                            <i class="material-icons" style="font-size: 16px; vertical-align: middle; margin-right: 4px; color: #667eea;">check_circle</i>
                            Статус
                        </label>
                        <select id="filterStatus" style="width: 100%; padding: 12px 14px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; background: white; transition: all 0.3s; cursor: pointer; box-sizing: border-box;"
                                onchange="applyFilters()"
                                onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102,126,234,0.1)'"
                                onblur="this.style.borderColor='#e0e0e0'; this.style.boxShadow='none'">
                            <option value="all">Все</option>
                            <option value="Просрочено">Просрочено</option>
                            <option value="Срочно">Срочно</option>
                            <option value="Скоро">Скоро</option>
                            <option value="Активно">Активно</option>
                        </select>
                    </div>
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                    <button onclick="resetFilters()" 
                            style="padding: 10px 20px; background: white; border: 2px solid #e0e0e0; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500; color: #555; transition: all 0.3s; display: flex; align-items: center; gap: 6px;"
                            onmouseover="this.style.background='#f5f5f5'; this.style.borderColor='#667eea';"
                            onmouseout="this.style.background='white'; this.style.borderColor='#e0e0e0';">
                        <i class="material-icons" style="font-size: 18px;">refresh</i>
                        Сбросить фильтры
                    </button>
                    
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <label style="font-weight: 500; color: #555; font-size: 14px;">
                            <i class="material-icons" style="font-size: 18px; vertical-align: middle; margin-right: 4px; color: #667eea;">view_list</i>
                            Показывать по:
                        </label>
                        <select id="pageSizeSelect" style="padding: 10px 14px; border: 2px solid #667eea; border-radius: 8px; font-size: 14px; font-weight: 500; background: white; cursor: pointer; color: #667eea; transition: all 0.3s; box-sizing: border-box;"
                                onchange="changePageSize()"
                                onfocus="this.style.boxShadow='0 0 0 3px rgba(102,126,234,0.2)'"
                                onblur="this.style.boxShadow='none'">
                            <option value="20" selected>20</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="mdl-card mdl-shadow--2dp" style="width: 100%;">
            <div class="table-wrapper">
                <table class="mdl-data-table mdl-js-data-table" style="min-width: 860px;">
                <thead>
                    <tr>
                        ${isAdmin ? '<th class="mdl-data-table__cell--non-numeric">Клиент</th>' : ''}
                        <th class="mdl-data-table__cell--non-numeric">Тип услуги</th>
                        <th>Дата истечения</th>
                        <th>Осталось дней</th>
                        <th>Статус</th>
                        <th>Уведомления</th>
                        ${isAdmin ? '<th>Действия</th>' : ''}
                    </tr>
                </thead>
                <tbody>
                    ${displayDeadlines.length > 0 ? displayDeadlines.map((deadline) => {
        const daysLeft = deadline.days_until_expiration;
        const status = getDeadlineStatus(daysLeft);
        const clientName = deadline.client?.company_name || deadline.client?.name || '-';
        const typeName = deadline.deadline_type?.name || deadline.deadline_type?.type_name || '-';

        return `
                            <tr data-deadline-id="${deadline.id}">
                                ${isAdmin ? `<td class="mdl-data-table__cell--non-numeric">${clientName}</td>` : ''}
                                <td class="mdl-data-table__cell--non-numeric">${typeName}</td>
                                <td>${formatDate(deadline.expiration_date)}</td>
                                <td style="color: ${status.color}">${daysLeft}</td>
                                <td>
                                    <span class="status-pill ${status.className}">
                                        ${status.label}
                                    </span>
                                </td>
                                <td>
                                    <span class="status-pill ${deadline.notification_enabled ? 'status-pill--success' : 'status-pill--muted'}">
                                        ${deadline.notification_enabled ? 'Включены' : 'Отключены'}
                                    </span>
                                </td>
                                ${isAdmin ? `
                                <td>
                                    <button class="mdl-button mdl-js-button mdl-button--icon" onclick="deleteDeadline(${deadline.id})">
                                        <i class="material-icons">delete</i>
                                    </button>
                                </td>
                                ` : ''}
                            </tr>
                        `;
    }).join('') : `
                        <tr>
                            <td colspan="${isAdmin ? '7' : '5'}" style="text-align: center; padding: 20px;">
                                Дедлайны отсутствуют
                            </td>
                        </tr>
                    `}
                </tbody>
            </table>
            </div>
        </div>
        <div id="deadlinesPagination" style="margin-top: 20px; text-align: center;">
            <p>Показано <strong>${displayDeadlines.length}</strong> из <strong>${totalDeadlines}</strong> дедлайнов</p>
        </div>
    `;

    deadlinesSection.innerHTML = tableHTML;

    // Устанавливаем выбранное значение размера страницы
    setTimeout(() => {
        const pageSizeSelect = document.getElementById('pageSizeSelect');
        if (pageSizeSelect) {
            pageSizeSelect.value = currentPageSize.toString();
        }
    }, 10);

    // Обновляем MDL компоненты
    if (typeof componentHandler !== 'undefined') {
        componentHandler.upgradeDom();
    }

    // Добавляем обработчик клика на строки для редактирования
    setTimeout(() => {
        const rows = document.querySelectorAll('#deadlines-section tbody tr');
        rows.forEach(row => {
            const deadlineId = row.getAttribute('data-deadline-id');
            if (deadlineId) {
                row.style.cursor = 'pointer';
                row.addEventListener('click', function (e) {
                    // Проверяем, что клик не по кнопке удаления
                    if (!e.target.closest('button') && !e.target.closest('.mdl-button')) {
                        editDeadline(parseInt(deadlineId));
                    }
                });
            }
        });
    }, 100);
}

/**
 * Вычисление оставшихся дней
 */
function calculateDaysLeft(expiryDate) {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

/**
 * Получение статуса дедлайна
 */
function getDeadlineStatus(daysLeft) {
    if (daysLeft < 0) {
        return { label: 'Просрочено', color: '#dc3545', className: 'status-pill--danger' };
    } else if (daysLeft <= 7) {
        return { label: 'Срочно', color: '#ff6b6b', className: 'status-pill--danger' };
    } else if (daysLeft <= 30) {
        return { label: 'Скоро', color: '#ffa500', className: 'status-pill--warning' };
    } else {
        return { label: 'Активно', color: '#28a745', className: 'status-pill--success' };
    }
}

/**
 * Форматирование даты - используем российский формат ДД.ММ.ГГГГ
 */
function formatDate(dateString) {
    return formatDateRU(dateString);
}

/**
 * Отображение пагинации
 */
function renderDeadlinesPagination(data) {
    const paginationDiv = document.getElementById('deadlinesPagination');
    if (!paginationDiv) return;

    paginationDiv.innerHTML = `
        <p>Показано ${data.deadlines?.length || 0} из ${data.total || 0} дедлайнов</p>
    `;
}

/**
 * Показать ошибку
 */
function showDeadlinesError(message) {
    deadlinesSection.innerHTML = `
        <div class="mdl-card mdl-shadow--2dp" style="width: 100%; padding: 20px;">
            <p style="color: red; text-align: center;">${message}</p>
        </div>
    `;
}

/**
 * Модальное окно добавления дедлайна
 */
function showAddDeadlineModal() {
    const modal = createDeadlineModal('add');
    document.body.appendChild(modal);
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);
}

/**
 * Редактирование дедлайна
 */
function editDeadline(id) {
    const token = localStorage.getItem('access_token');
    fetch(`${API_BASE_URL}/deadlines/${id}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
        .then(response => response.json())
        .then(deadline => {
            const modal = createDeadlineModal('edit', deadline);
            document.body.appendChild(modal);
            setTimeout(() => {
                modal.classList.add('show');
            }, 10);
        })
        .catch(error => {
            console.error('Ошибка загрузки дедлайна:', error);
            alert('Не удалось загрузить данные дедлайна');
        });
}

/**
 * Удаление дедлайна
 */
async function deleteDeadline(id) {
    if (!confirm('Вы уверены, что хотите удалить этот дедлайн?')) {
        return;
    }

    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`${API_BASE_URL}/deadlines/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Ошибка удаления дедлайна');
        }

        alert('Дедлайн успешно удалён');
        loadDeadlinesData();
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка: ' + error.message);
    }
}

/**
 * Создание модального окна для дедлайна
 */
function createDeadlineModal(mode, deadline = {}) {
    const isEdit = mode === 'edit';
    const title = isEdit ? 'Редактирование дедлайна' : 'Добавить дедлайн';

    const modalDiv = document.createElement('div');
    modalDiv.className = 'modal-overlay';
    modalDiv.style.zIndex = '999999';
    modalDiv.innerHTML = `
        <div class="modal" style="width: 600px; max-width: 90vw; border-radius: 12px; padding: 0; box-shadow: 0 10px 40px rgba(0,0,0,0.2); z-index: 999999;">
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
                            <i class="material-icons" style="font-size: 16px; vertical-align: middle; margin-right: 4px; color: #667eea;">business</i>
                            Клиент *
                        </label>
                        <select id="client_id" required
                                style="width: 100%; padding: 10px 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; background: white; transition: all 0.3s; cursor: pointer; box-sizing: border-box;"
                                onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102,126,234,0.1)'"
                                onblur="this.style.borderColor='#e0e0e0'; this.style.boxShadow='none'">
                            <option value="">Выберите клиента</option>
                        </select>
                    </div>
                    
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

    // Загружаем списки клиентов, типов и касс
    setTimeout(async () => {
        await loadClientsForSelect(deadline.client_id);
        await loadDeadlineTypesForSelect(deadline.deadline_type_id);
        if (deadline.client_id) {
            await loadCashRegistersForSelect(deadline.client_id, deadline.cash_register_id);
        }
    }, 50);

    return modalDiv;
}

/**
 * Загрузка клиентов для выпадающего списка
 */
async function loadClientsForSelect(selectedId = null) {
    try {
        console.log('=== НАЧАЛО ЗАГРУЗКИ КЛИЕНТОВ ===');
        console.log('Selected ID:', selectedId);

        const token = localStorage.getItem('access_token');
        console.log('Token exists:', !!token);

        const url = `${API_BASE_URL}/users?role=client&page=1&page_size=100`;
        console.log('Request URL:', url);

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Response status:', response.status);
        console.log('Response OK:', response.ok);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Response error text:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Данные получены:', data);
        console.log('Количество клиентов:', data.users ? data.users.length : 0);

        const select = document.getElementById('client_id');
        if (!select) {
            console.error('❌ Select элемент client_id не найден!');
            return;
        }
        console.log('✅ Select элемент найден');

        // Очищаем все опции кроме первой
        while (select.options.length > 1) {
            select.remove(1);
        }
        console.log('Select очищен, осталось опций:', select.options.length);

        if (!data.users || data.users.length === 0) {
            console.warn('⚠️ Нет доступных клиентов');
            return;
        }

        data.users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.company_name || user.full_name;
            if (selectedId && user.id === selectedId) {
                option.selected = true;
            }
            select.appendChild(option);
            console.log('Добавлен клиент:', user.id, '-', option.textContent);
        });

        // Добавляем обработчик изменения клиента
        select.addEventListener('change', async function () {
            const clientId = this.value;
            if (clientId) {
                await loadCashRegistersForSelect(parseInt(clientId), null);
            } else {
                // Очищаем список касс
                const cashRegSelect = document.getElementById('cash_register_id');
                if (cashRegSelect) {
                    cashRegSelect.innerHTML = '<option value="">Общий дедлайн (не привязан к кассе)</option>';
                }
            }
        });

        console.log(`✅ Добавлено ${data.users.length} клиентов в select`);
        console.log('Всего опций в select:', select.options.length);
        console.log('=== КОНЕЦ ЗАГРУЗКИ КЛИЕНТОВ ===');
    } catch (error) {
        console.error('❌ ОШИБКА ЗАГРУЗКИ КЛИЕНТОВ:', error);
        console.error('Error stack:', error.stack);
        alert('Не удалось загрузить список клиентов. Проверьте консоль для деталей.');
    }
}

/**
 * Загрузка типов дедлайнов для выпадающего списка
 */
async function loadDeadlineTypesForSelect(selectedId = null) {
    try {
        console.log('Загрузка типов дедлайнов для select...');
        const token = localStorage.getItem('access_token');

        // Загружаем только активные типы (без include_inactive)
        const response = await fetch(`${API_BASE_URL}/deadline-types`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const types = await response.json();
        console.log('Типы дедлайнов загружены:', types);

        const select = document.getElementById('deadline_type_id');
        if (!select) {
            console.error('Select элемент deadline_type_id не найден!');
            return;
        }

        // Очищаем все опции кроме первой
        while (select.options.length > 1) {
            select.remove(1);
        }

        if (!types || types.length === 0) {
            console.warn('Нет доступных типов дедлайнов');
            return;
        }

        types.forEach(type => {
            const option = document.createElement('option');
            option.value = type.id;

            // Используем type_name из API, объединяем с description если есть
            const displayName = type.description
                ? `${type.type_name} (${type.description})`
                : type.type_name;

            option.textContent = displayName;

            if (selectedId && type.id === selectedId) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        console.log(`Добавлено ${types.length} типов в select`);
    } catch (error) {
        console.error('Ошибка загрузки типов дедлайнов:', error);
        alert('Не удалось загрузить список типов услуг');
    }
}

/**
 * Загрузка кассовых аппаратов для выпадающего списка
 */
async function loadCashRegistersForSelect(clientId, selectedId = null) {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`${API_BASE_URL}/cash-registers?user_id=${clientId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const registers = await response.json();

        const select = document.getElementById('cash_register_id');
        if (!select) return;

        select.innerHTML = '<option value="">Общий дедлайн (не привязан к кассе)</option>';

        if (registers && registers.length > 0) {
            registers.forEach(reg => {
                const option = document.createElement('option');
                option.value = reg.id;
                option.textContent = reg.register_name || reg.model || `Касса #${reg.id}`;
                option.setAttribute('data-model', reg.model || '');
                if (selectedId && reg.id === selectedId) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Ошибка загрузки касс:', error);
    }
}

/**
 * Обновление поля модели ККТ при выборе кассы
 */
function updateCashRegisterModelField() {
    const cashRegisterSelect = document.getElementById('cash_register_id');
    const modelInput = document.getElementById('cash_register_model');

    if (!cashRegisterSelect || !modelInput) return;

    const selectedOption = cashRegisterSelect.options[cashRegisterSelect.selectedIndex];
    const model = selectedOption.getAttribute('data-model') || '';

    if (cashRegisterSelect.value) {
        modelInput.value = model;
    }
}

/**
 * Отправка формы дедлайна
 */
async function submitDeadlineForm(event, mode, deadlineId) {
    event.preventDefault();

    const formData = {
        client_id: parseInt(document.getElementById('client_id').value),
        deadline_type_id: parseInt(document.getElementById('deadline_type_id').value),
        cash_register_id: document.getElementById('cash_register_id').value ? parseInt(document.getElementById('cash_register_id').value) : null,
        cash_register_model: document.getElementById('cash_register_model').value.trim() || null,
        expiration_date: document.getElementById('expiration_date').value,
        notify_days_before: parseInt(document.getElementById('notify_days_before').value),
        notification_enabled: document.getElementById('notification_enabled').checked,
        notes: document.getElementById('notes').value,
        status: 'active'
    };

    console.log('Отправка формы дедлайна:', mode, formData);

    const token = localStorage.getItem('access_token');
    const url = mode === 'edit' ? `${API_BASE_URL}/deadlines/${deadlineId}` : `${API_BASE_URL}/deadlines`;
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

        console.log('Response status:', response.status);
        console.log('Response OK:', response.ok);

        if (!response.ok) {
            // Пытаемся распарсить JSON ответ
            const contentType = response.headers.get('content-type');
            console.log('Response Content-Type:', contentType);

            let errorMessage = 'Ошибка сохранения';

            if (contentType && contentType.includes('application/json')) {
                try {
                    const error = await response.json();
                    console.log('Error response:', error);
                    errorMessage = error.detail || JSON.stringify(error);
                } catch (jsonError) {
                    console.error('Ошибка парсинга JSON:', jsonError);
                    const text = await response.text();
                    console.log('Response text:', text);
                    errorMessage = `Ошибка ${response.status}: ${text.substring(0, 200)}`;
                }
            } else {
                // Если не JSON, получаем текст
                const text = await response.text();
                console.log('Response text (not JSON):', text);
                errorMessage = `Ошибка сервера ${response.status}: ${text.substring(0, 200)}`;
            }

            throw new Error(errorMessage);
        }

        const result = await response.json();
        console.log('Успешно сохранено:', result);

        alert(mode === 'edit' ? 'Дедлайн успешно обновлён' : 'Дедлайн успешно создан');
        closeDeadlineModal(event.target);
        loadDeadlinesData();
    } catch (error) {
        console.error('❌ ОШИБКА:', error);
        console.error('Error stack:', error.stack);
        alert('Ошибка: ' + error.message);
    }
}

/**
 * Закрытие модального окна дедлайна
 */
function closeDeadlineModal(element) {
    // Ищем overlay - либо через closest, либо через document
    let overlay = null;

    if (element && element.closest) {
        overlay = element.closest('.modal-overlay');
    }

    // Если не нашли через closest, ищем в document
    if (!overlay) {
        overlay = document.querySelector('.modal-overlay');
    }

    if (overlay) {
        // Проверяем, не закрывается ли уже модальное окно
        if (overlay.dataset.closing === 'true') {
            return; // Уже закрывается, не делаем ничего
        }

        // Отмечаем, что началось закрытие
        overlay.dataset.closing = 'true';

        const modal = overlay.querySelector('.modal');
        if (modal) {
            modal.classList.remove('show');
        }
        setTimeout(() => overlay.remove(), 300);
    }
}

/**
 * Применение фильтров
 */
function applyFilters() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = ['admin', 'manager'].includes(user.role);

    // Считываем значения фильтров
    const filterClient = isAdmin ? (document.getElementById('filterClient')?.value || '') : '';
    const filterType = document.getElementById('filterType')?.value || '';
    const filterDays = document.getElementById('filterDays')?.value || 'all';
    const filterStatus = document.getElementById('filterStatus')?.value || 'all';

    console.log('Применение фильтров:', { filterClient, filterType, filterDays, filterStatus });

    // Сохраняем текущие фильтры
    currentFilters = {
        client: filterClient,
        type: filterType,
        daysRange: filterDays,
        status: filterStatus
    };

    // Фильтруем дедлайны
    let filtered = allDeadlines.filter(deadline => {
        const clientName = deadline.client?.company_name || deadline.client?.name || '-';
        const typeName = deadline.deadline_type?.name || deadline.deadline_type?.type_name || '-';
        const daysLeft = deadline.days_until_expiration;
        const status = getDeadlineStatus(daysLeft);

        // Фильтр по клиенту
        if (filterClient && clientName !== filterClient) {
            return false;
        }

        // Фильтр по типу услуги
        if (filterType && typeName !== filterType) {
            return false;
        }

        // Фильтр по оставшимся дням
        if (filterDays !== 'all') {
            if (filterDays === 'expired' && daysLeft >= 0) return false;
            if (filterDays === 'urgent' && (daysLeft < 0 || daysLeft > 7)) return false;
            if (filterDays === 'soon' && (daysLeft < 8 || daysLeft > 30)) return false;
            if (filterDays === 'normal' && daysLeft <= 30) return false;
        }

        // Фильтр по статусу
        if (filterStatus !== 'all' && status.label !== filterStatus) {
            return false;
        }

        return true;
    });

    console.log(`Отфильтровано: ${filtered.length} из ${allDeadlines.length} дедлайнов`);

    // Перерисовываем таблицу
    renderDeadlinesTable(filtered);
}

/**
 * Сброс фильтров
 */
function resetFilters() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = ['admin', 'manager'].includes(user.role);

    // Сбрасываем значения фильтров
    if (isAdmin && document.getElementById('filterClient')) {
        document.getElementById('filterClient').value = '';
    }
    if (document.getElementById('filterType')) {
        document.getElementById('filterType').value = '';
    }
    if (document.getElementById('filterDays')) {
        document.getElementById('filterDays').value = 'all';
    }
    if (document.getElementById('filterStatus')) {
        document.getElementById('filterStatus').value = 'all';
    }

    // Сбрасываем текущие фильтры
    currentFilters = {
        client: '',
        type: '',
        daysRange: 'all',
        status: 'all'
    };

    console.log('Фильтры сброшены');

    // Показываем все дедлайны
    renderDeadlinesTable(allDeadlines);
}

/**
 * Изменение размера страницы
 */
function changePageSize() {
    const select = document.getElementById('pageSizeSelect');
    if (select) {
        currentPageSize = parseInt(select.value) || 20;
        console.log('Размер страницы изменён на:', currentPageSize);

        // Применяем текущие фильтры с новым размером
        applyFilters();
    }
}
