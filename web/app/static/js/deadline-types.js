/**
 * Управление типами услуг (типами дедлайнов)
 */

// Константы API (если ещё не объявлены)
if (typeof API_BASE_URL === 'undefined') {
    var API_BASE_URL = window.location.origin + '/api';
}

const deadlineTypesSection = document.getElementById('deadline-types-section');

/**
 * Загрузка списка типов услуг
 */
async function loadDeadlineTypesData() {
    try {
        const token = localStorage.getItem('access_token');

        // Загружаем только активные типы (без include_inactive)
        const response = await fetch(`${API_BASE_URL}/deadline-types`, {
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
            throw new Error('Ошибка загрузки типов услуг');
        }

        const types = await response.json();
        renderDeadlineTypesTable(types || []);
        renderDeadlineTypesPagination({ total: types.length, deadline_types: types });
    } catch (error) {
        console.error('Ошибка при загрузке типов услуг:', error);
        showDeadlineTypesError('Не удалось загрузить список типов услуг');
    }
}

/**
 * Отображение таблицы типов услуг
 */
function renderDeadlineTypesTable(types) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = user.role === 'admin';  // Только admin может редактировать и удалять

    const tableHTML = `
        <div class="section-header">
            <h2>📋 Типы услуг</h2>
            ${isAdmin ? `
            <button class="mdl-button mdl-js-button mdl-button--raised mdl-button--colored" 
                    onclick="showAddDeadlineTypeModal()">
                <i class="material-icons">add</i> Добавить тип
            </button>
            ` : ''}
        </div>
        <div class="mdl-card mdl-shadow--2dp" style="width: 100%;">
            <div class="table-wrapper">
                <table class="mdl-data-table mdl-js-data-table">
                <thead>
                    <tr>
                        <th class="mdl-data-table__cell--non-numeric">Название</th>
                        <th>Статус</th>
                        ${isAdmin ? '<th>Действия</th>' : ''}
                    </tr>
                </thead>
                <tbody>
                    ${types.length > 0 ? types.map(type => {
        // Объединяем название и описание (используем type_name из API)
        const displayName = type.description
            ? `${type.type_name} (${type.description})`
            : type.type_name;

        return `
                        <tr data-type-id="${type.id}">
                            <td class="mdl-data-table__cell--non-numeric"><strong>${displayName}</strong></td>
                            <td>
                                <span class="status-pill ${type.is_active ? 'status-pill--success' : 'status-pill--muted'}">
                                    ${type.is_active ? 'Активен' : 'Неактивен'}
                                </span>
                            </td>
                            ${isAdmin ? `
                            <td>
                                <button class="mdl-button mdl-js-button mdl-button--icon" onclick="event.stopPropagation(); editDeadlineType(${type.id})" title="Редактировать" style="color: #2196F3;">
                                    <i class="material-icons">edit</i>
                                </button>
                                <button class="mdl-button mdl-js-button mdl-button--icon" onclick="event.stopPropagation(); deleteDeadlineType(${type.id})" title="Удалить" style="color: #f44336;">
                                    <i class="material-icons">delete</i>
                                </button>
                            </td>
                            ` : ''}
                        </tr>
                        `;
    }).join('') : `
                        <tr>
                            <td colspan="${isAdmin ? '3' : '2'}" style="text-align: center; padding: 20px;">
                                Типы услуг отсутствуют
                            </td>
                        </tr>
                    `}
                </tbody>
                </table>
            </div>
        </div>
        <div id="deadlineTypesPagination" style="margin-top: 20px; text-align: center;"></div>
    `;

    deadlineTypesSection.innerHTML = tableHTML;

    // Обновляем MDL компоненты
    if (typeof componentHandler !== 'undefined') {
        componentHandler.upgradeDom();
    }

    // Добавляем обработчик клика на строки для редактирования
    setTimeout(() => {
        const rows = document.querySelectorAll('#deadline-types-section tbody tr');
        rows.forEach(row => {
            const typeId = row.getAttribute('data-type-id');
            if (typeId) {
                row.style.cursor = 'pointer';
                row.addEventListener('click', function (e) {
                    // Проверяем, что клик не по кнопке удаления
                    if (!e.target.closest('button') && !e.target.closest('.mdl-button')) {
                        editDeadlineType(parseInt(typeId));
                    }
                });
            }
        });
    }, 100);
}

/**
 * Отображение пагинации
 */
function renderDeadlineTypesPagination(data) {
    const paginationDiv = document.getElementById('deadlineTypesPagination');
    if (!paginationDiv) return;

    paginationDiv.innerHTML = `
        <p>Показано ${data.deadline_types?.length || 0} из ${data.total || 0} типов услуг</p>
    `;
}

/**
 * Показать ошибку
 */
function showDeadlineTypesError(message) {
    deadlineTypesSection.innerHTML = `
        <div class="mdl-card mdl-shadow--2dp" style="width: 100%; padding: 20px;">
            <p style="color: red; text-align: center;">${message}</p>
        </div>
    `;
}

/**
 * Модальное окно добавления типа услуги
 */
function showAddDeadlineTypeModal() {
    const modal = createDeadlineTypeModal('add');
    document.body.appendChild(modal);
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);
}

/**
 * Редактирование типа услуги
 */
function editDeadlineType(id) {
    const token = localStorage.getItem('access_token');
    fetch(`${API_BASE_URL}/deadline-types/${id}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
        .then(response => response.json())
        .then(type => {
            const modal = createDeadlineTypeModal('edit', type);
            document.body.appendChild(modal);
            setTimeout(() => {
                modal.classList.add('show');
            }, 10);
        })
        .catch(error => {
            console.error('Ошибка загрузки типа услуги:', error);
            alert('Не удалось загрузить данные типа услуги');
        });
}

/**
 * Удаление типа услуги
 */
async function deleteDeadlineType(id) {
    if (!confirm('Вы уверены, что хотите удалить этот тип услуги?')) {
        return;
    }

    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`${API_BASE_URL}/deadline-types/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.detail || 'Ошибка удаления типа услуги';
            throw new Error(errorMessage);
        }

        alert('Тип услуги успешно удалён');
        loadDeadlineTypesData();
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка: ' + error.message);
    }
}

/**
 * Создание модального окна для типа услуги
 */
function createDeadlineTypeModal(mode, type = {}) {
    const isEdit = mode === 'edit';
    const title = isEdit ? 'Редактирование типа услуги' : 'Добавить тип услуги';

    const modalDiv = document.createElement('div');
    modalDiv.className = 'modal-overlay';
    modalDiv.style.zIndex = '999999';
    modalDiv.innerHTML = `
        <div class="modal" style="width: 500px; max-width: 90vw; border-radius: 12px; padding: 0; box-shadow: 0 10px 40px rgba(0,0,0,0.2);">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px 12px 0 0; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                <h3 style="margin: 0; font-size: 20px; font-weight: 500;">
                    <i class="material-icons" style="vertical-align: middle; margin-right: 8px; font-size: 24px;">admin_panel_settings</i>
                    ${title}
                </h3>
                <button class="close-btn" onclick="closeDeadlineTypeModal(this)">
                    <i class="material-icons">close</i>
                </button>
            </div>
            <div class="modal-body" style="padding: 24px;">
                <form id="deadlineTypeForm" onsubmit="submitDeadlineTypeForm(event, '${mode}', ${type.id || 'null'})">
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 6px; font-size: 13px; font-weight: 500; color: #555;">
                            <i class="material-icons" style="font-size: 16px; vertical-align: middle; margin-right: 4px; color: #667eea;">label</i>
                            Название *
                        </label>
                        <input type="text" id="type_name" value="${type.type_name || ''}" required
                               style="width: 100%; padding: 10px 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; background: white; transition: all 0.3s; box-sizing: border-box;"
                               onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102,126,234,0.1)'"
                               onblur="this.style.borderColor='#e0e0e0'; this.style.boxShadow='none'">
                    </div>
                    
                    <div style="margin-bottom: 24px;">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none;">
                            <input type="checkbox" id="is_active" ${type.is_active !== false ? 'checked' : ''}
                                   style="width: 18px; height: 18px; cursor: pointer;">
                            <span style="font-size: 14px; color: #555;">Активен</span>
                        </label>
                    </div>
                    
                    <div style="display: flex; justify-content: flex-end; gap: 12px; padding-top: 16px; border-top: 2px solid #f0f0f0;">
                        <button type="button" class="mdl-button" onclick="closeDeadlineTypeModal(this)"
                                style="padding: 8px 20px; border: 1px solid #ddd; border-radius: 6px; background: white; cursor: pointer; font-size: 14px; transition: all 0.3s;"
                                onmouseover="this.style.background='#f5f5f5'"
                                onmouseout="this.style.background='white'">
                            Отмена
                        </button>
                        <button type="submit" class="mdl-button mdl-button--raised mdl-button--colored"
                                style="padding: 8px 24px; border: none; border-radius: 6px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.3s; box-shadow: 0 2px 8px rgba(102,126,234,0.3);"
                                onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(102,126,234,0.4)'"
                                onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(102,126,234,0.3)'">
                            ${isEdit ? 'Сохранить' : 'Создать'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    setTimeout(() => {
        if (typeof componentHandler !== 'undefined') {
            componentHandler.upgradeElements(modalDiv.querySelectorAll('.mdl-textfield, .mdl-checkbox'));
        }
    }, 50);

    return modalDiv;
}

/**
 * Отправка формы типа услуги
 */
async function submitDeadlineTypeForm(event, mode, typeId) {
    event.preventDefault();

    const formData = {
        type_name: document.getElementById('type_name').value,  // Используем type_name вместо name
        description: null,  // Убрали поле описания
        days_before_notification: null,  // Убрали поле дней до уведомления
        is_active: document.getElementById('is_active').checked
    };

    const token = localStorage.getItem('access_token');
    const url = mode === 'edit' ? `${API_BASE_URL}/deadline-types/${typeId}` : `${API_BASE_URL}/deadline-types`;
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
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || 'Ошибка сохранения');
        }

        alert(mode === 'edit' ? 'Тип услуги успешно обновлён' : 'Тип услуги успешно создан');
        closeDeadlineTypeModal(event.target);
        loadDeadlineTypesData();
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка: ' + error.message);
    }
}

/**
 * Закрытие модального окна типа услуги
 */
function closeDeadlineTypeModal(element) {
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
