/**
 * Управление пользователями системы (менеджеры и администраторы)
 */

// Константы API (если ещё не объявлены)
if (typeof API_BASE_URL === 'undefined') {
    var API_BASE_URL = window.location.origin + '/api';
}

const managersSection = document.getElementById('managers-section');

/**
 * Загрузка списка пользователей
 */
async function loadManagersData() {
    try {
        const token = localStorage.getItem('access_token');

        // Загружаем всех пользователей с ролями admin и manager
        const response = await fetch(`${API_BASE_URL}/users?page=1&page_size=50`, {
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
            throw new Error('Ошибка загрузки пользователей');
        }

        const data = await response.json();

        // Фильтруем пользователей с ролями admin и manager
        const staffUsers = (data.users || []).filter(u => ['admin', 'manager'].includes(u.role));

        renderManagersTable(staffUsers);
        renderManagersPagination(data);
    } catch (error) {
        console.error('Ошибка при загрузке пользователей:', error);
        showManagersError('Не удалось загрузить список пользователей');
    }
}

/**
 * Отображение таблицы пользователей
 */
function renderManagersTable(users) {
    const tableHTML = `
        <div class="section-header">
            <h2>👤 Управление пользователями</h2>
            <button class="mdl-button mdl-js-button mdl-button--raised mdl-button--colored" 
                    onclick="showAddManagerModal()">
                <i class="material-icons">add</i> Добавить пользователя
            </button>
        </div>
        <div class="mdl-card mdl-shadow--2dp" style="width: 100%;">
            <div class="table-wrapper">
                <table class="mdl-data-table mdl-js-data-table">
                <thead>
                    <tr>
                        <th>ФИО</th>
                        <th>Email</th>
                        <th>Телефон</th>
                        <th>Роль</th>
                        <th>Статус</th>
                        <th>Последний вход</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.length > 0 ? users.map(user => `
                        <tr data-user-id="${user.id}" style="cursor: pointer;" class="manager-row">
                            <td><strong>${user.full_name || '-'}</strong></td>
                            <td>${user.email || '-'}</td>
                            <td>${user.phone || '-'}</td>
                            <td>
                                <span class="status-pill ${user.role === 'admin' ? 'status-pill--info' : 'status-pill--warning'}">
                                    ${getRoleLabel(user.role)}
                                </span>
                            </td>
                            <td>
                                <span class="status-pill ${user.is_active ? 'status-pill--success' : 'status-pill--muted'}">
                                    ${user.is_active ? 'Активен' : 'Неактивен'}
                                </span>
                            </td>
                            <td>${user.last_login ? formatDateTime(user.last_login) : 'Никогда'}</td>
                        </tr>
                    `).join('') : `
                        <tr>
                            <td colspan="6" style="text-align: center; padding: 20px;">
                                Пользователи отсутствуют
                            </td>
                        </tr>
                    `}
                </tbody>
                </table>
            </div>
        </div>
        <div id="managersPagination" style="margin-top: 20px; text-align: center;"></div>
    `;

    managersSection.innerHTML = tableHTML;

    // Добавляем обработчики кликов на строки
    setTimeout(() => {
        const managerRows = document.querySelectorAll('.manager-row');
        managerRows.forEach(row => {
            const userId = parseInt(row.getAttribute('data-user-id'));

            row.addEventListener('click', function () {
                editManager(userId);
            });

            row.addEventListener('mouseenter', function () {
                row.style.backgroundColor = '#f5f5f5';
            });

            row.addEventListener('mouseleave', function () {
                row.style.backgroundColor = '';
            });
        });
    }, 100);

    // Обновляем MDL компоненты
    if (typeof componentHandler !== 'undefined') {
        componentHandler.upgradeDom();
    }
}

/**
 * Получение метки роли
 */
function getRoleLabel(role) {
    const labels = {
        'admin': 'Администратор',
        'manager': 'Менеджер',
        'client': 'Клиент'
    };
    return labels[role] || role;
}

/**
 * Форматирование даты и времени - российский формат ДД.ММ.ГГГГ ЧЧ:ММ
 */
function formatDateTime(dateString) {
    return formatDateTimeRU(dateString);
}

/**
 * Отображение пагинации
 */
function renderManagersPagination(data) {
    const paginationDiv = document.getElementById('managersPagination');
    if (!paginationDiv) return;

    const staffCount = (data.users || []).filter(u => ['admin', 'manager'].includes(u.role)).length;

    paginationDiv.innerHTML = `
        <p>Показано ${staffCount} пользователей системы</p>
    `;
}

/**
 * Показать ошибку
 */
function showManagersError(message) {
    managersSection.innerHTML = `
        <div class="mdl-card mdl-shadow--2dp" style="width: 100%; padding: 20px;">
            <p style="color: red; text-align: center;">${message}</p>
        </div>
    `;
}

/**
 * Модальное окно добавления пользователя
 */
function showAddManagerModal() {
    const modal = createManagerModal('add');
    document.body.appendChild(modal);
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);
}

/**
 * Просмотр пользователя
 */
function viewManager(id) {
    const token = localStorage.getItem('access_token');
    fetch(`${API_BASE_URL}/users/${id}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
        .then(response => response.json())
        .then(user => {
            const modal = createManagerModal('view', user);
            document.body.appendChild(modal);
            setTimeout(() => {
                modal.classList.add('show');
            }, 10);
        })
        .catch(error => {
            console.error('Ошибка загрузки пользователя:', error);
            alert('Не удалось загрузить данные пользователя');
        });
}

/**
 * Редактирование пользователя
 */
function editManager(id) {
    const token = localStorage.getItem('access_token');
    fetch(`${API_BASE_URL}/users/${id}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
        .then(response => response.json())
        .then(user => {
            const modal = createManagerModal('edit', user);
            document.body.appendChild(modal);
            setTimeout(() => {
                modal.classList.add('show');
            }, 10);
        })
        .catch(error => {
            console.error('Ошибка загрузки пользователя:', error);
            alert('Не удалось загрузить данные пользователя');
        });
}

/**
 * Удаление пользователя
 */
async function deleteManager(id) {
    if (!confirm('Вы уверены, что хотите удалить этого пользователя?')) {
        return;
    }

    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`${API_BASE_URL}/users/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Ошибка удаления пользователя');
        }

        alert('Пользователь успешно удалён');
        loadManagersData();
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка: ' + error.message);
    }
}

/**
 * Создание модального окна для пользователя
 */
function createManagerModal(mode, user = {}) {
    const isView = mode === 'view';
    const isEdit = mode === 'edit';
    const isAdd = mode === 'add';
    const title = isView ? 'Просмотр пользователя' : isEdit ? 'Редактирование пользователя' : 'Добавить пользователя';

    const modalDiv = document.createElement('div');
    modalDiv.className = 'modal-overlay';
    modalDiv.style.zIndex = '999999';
    modalDiv.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="close-btn" onclick="closeManagerModal(this)">
                    <i class="material-icons">close</i>
                </button>
            </div>
            <div class="modal-body">
                <form id="managerForm" class="modal-form" onsubmit="submitManagerForm(event, '${mode}', ${user.id || 'null'})">
                    <div class="form-grid">
                        ${isAdd ? `
                        <div class="form-group">
                            <label for="username">Логин *</label>
                            <input type="text" id="username" required pattern="[a-zA-Z0-9_]+" minlength="3" maxlength="50">
                            <small class="form-helper">Латинские буквы, цифры, подчеркивание (3-50 символов)</small>
                        </div>
                        ` : ''}
                        
                        ${isView || isEdit ? `
                        <div class="form-group">
                            <label for="username_view">Логин</label>
                            <input type="text" id="username_view" value="${user.username || ''}" disabled>
                        </div>
                        ` : ''}
                        
                        <div class="form-group">
                            <label for="full_name">ФИО *</label>
                            <input type="text" id="full_name" value="${user.full_name || ''}" ${isView ? 'disabled' : 'required'}>
                        </div>
                        
                        <div class="form-group">
                            <label for="email">Email *</label>
                            <input type="email" id="email" value="${user.email || ''}" ${isView ? 'disabled' : 'required'}>
                        </div>
                        
                        <div class="form-group">
                            <label for="phone">Телефон</label>
                            <input type="tel" id="phone" value="${user.phone || ''}" ${isView ? 'disabled' : ''}>
                        </div>
                        
                        <div class="form-group">
                            <label for="telegram_id">Telegram ID ${!isView ? '*' : ''}</label>
                            <input type="text" id="telegram_id" value="${user.telegram_id || ''}" ${isView ? 'disabled' : ''} pattern="[0-9]+" title="Только цифры">
                            ${!isView ? `<small class="form-helper">Введите числовой Telegram ID</small>` : ''}
                        </div>
                        
                        ${!isView ? `
                        <div class="form-group form-group--full">
                            <label for="password">Пароль ${isAdd ? '*' : '(оставьте пустым, чтобы не менять)'}</label>
                            <input type="password" id="password" ${isAdd ? 'required' : ''}>
                        </div>
                        ` : ''}
                        
                        <div class="form-group form-group--full">
                            <label for="role">Роль *</label>
                            <select id="role" ${isView ? 'disabled' : 'required'}>
                                <option value="manager" ${user.role === 'manager' ? 'selected' : ''}>Менеджер</option>
                                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Администратор</option>
                            </select>
                        </div>
                        
                        <div class="form-group form-group--full">
                            <label class="checkbox-row">
                                <input type="checkbox" id="is_active" ${user.is_active !== false ? 'checked' : ''} ${isView ? 'disabled' : ''}>
                                <span>Активен</span>
                            </label>
                        </div>
                    </div>
                    
                    ${user.last_login ? `
                    <div class="form-note">
                        <strong>Последний вход:</strong> ${formatDateTime(user.last_login)}
                    </div>
                    ` : ''}
                    
                    ${user.telegram_id ? `
                    <div class="form-note">
                        <strong>Telegram ID:</strong> ${user.telegram_id}
                    </div>
                    ` : ''}
                    
                    <div class="modal-footer">
                        <button type="button" class="mdl-button" onclick="closeManagerModal(this)">Закрыть</button>
                        ${isEdit ? `<button type="button" class="mdl-button delete-btn" onclick="showDeleteConfirmation(${user.id}, '${user.full_name}')">
                            <i class="material-icons" style="font-size: 18px; vertical-align: middle;">delete</i> Удалить
                        </button>` : ''}
                        ${!isView ? `<button type="submit" class="mdl-button mdl-button--raised mdl-button--colored">${isEdit ? 'Сохранить' : 'Создать'}</button>` : ''}
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
 * Отправка формы пользователя
 */
async function submitManagerForm(event, mode, userId) {
    event.preventDefault();

    const formData = {
        full_name: document.getElementById('full_name').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        role: document.getElementById('role').value,
        is_active: document.getElementById('is_active').checked
    };

    // Проверяем Telegram ID - обязателен для админов и менеджеров
    const telegramIdField = document.getElementById('telegram_id');
    const telegramId = telegramIdField ? telegramIdField.value.trim() : '';

    if ((formData.role === 'admin' || formData.role === 'manager') && !telegramId) {
        alert('Ошибка: Telegram ID обязателен для администраторов и менеджеров');
        telegramIdField.focus();
        return;
    }

    // Добавляем Telegram ID если указан
    if (telegramId) {
        formData.telegram_id = telegramId;
    }

    // Добавляем username только при создании
    if (mode === 'add') {
        const usernameField = document.getElementById('username');
        if (usernameField && usernameField.value) {
            formData.username = usernameField.value;
        }
    }

    // Добавляем пароль только если он указан
    const passwordField = document.getElementById('password');
    if (passwordField && passwordField.value) {
        formData.password = passwordField.value;
    }

    const token = localStorage.getItem('access_token');
    const url = mode === 'edit' ? `${API_BASE_URL}/users/${userId}` : `${API_BASE_URL}/users`;
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

        alert(mode === 'edit' ? 'Пользователь успешно обновлён' : 'Пользователь успешно создан');
        closeManagerModal(event.target);
        loadManagersData();
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка: ' + error.message);
    }
}

/**
 * Закрытие модального окна пользователя
 */
function closeManagerModal(element) {
    const overlay = element.closest('.modal-overlay');
    if (overlay) {
        overlay.querySelector('.modal').classList.remove('show');
        setTimeout(() => overlay.remove(), 300);
    }
}

/**
 * Показать диалог подтверждения удаления
 */
function showDeleteConfirmation(userId, userName) {
    const modalDiv = document.createElement('div');
    modalDiv.className = 'modal-overlay';
    modalDiv.style.zIndex = '999999';
    modalDiv.innerHTML = `
        <div class="modal" style="max-width: 450px;">
            <div class="modal-header" style="background: linear-gradient(135deg, #d32f2f 0%, #c62828 100%);">
                <h3><i class="material-icons" style="vertical-align: middle; margin-right: 8px;">warning</i> Подтверждение удаления</h3>
                <button class="close-btn" onclick="closeDeleteConfirmation(this)">
                    <i class="material-icons">close</i>
                </button>
            </div>
            <div class="modal-body">
                <p style="margin-bottom: 20px; font-size: 16px;">
                    Вы действительно хотите удалить пользователя:<br>
                    <strong style="color: #d32f2f;">${userName}</strong>?
                </p>
                <p style="margin-bottom: 20px; color: #666; font-size: 14px;">
                    Это действие нельзя отменить. Для подтверждения введите ваш пароль:
                </p>
                <form id="deleteConfirmForm" onsubmit="confirmDeleteManager(event, ${userId})">
                    <div class="mdl-textfield mdl-js-textfield mdl-textfield--floating-label" style="width: 100%;">
                        <input class="mdl-textfield__input" type="password" id="delete_password" required autocomplete="current-password">
                        <label class="mdl-textfield__label" for="delete_password">Введите пароль</label>
                    </div>
                    <div class="modal-footer" style="margin-top: 20px;">
                        <button type="button" class="mdl-button" onclick="closeDeleteConfirmation(this)">Отмена</button>
                        <button type="submit" class="mdl-button mdl-button--raised" style="background-color: #d32f2f; color: white;">
                            <i class="material-icons" style="font-size: 18px; vertical-align: middle; margin-right: 4px;">delete</i>
                            Удалить
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.appendChild(modalDiv);
    setTimeout(() => {
        modalDiv.classList.add('show');
        if (typeof componentHandler !== 'undefined') {
            componentHandler.upgradeElements(modalDiv.querySelectorAll('.mdl-textfield'));
        }
        // Фокус на поле пароля
        document.getElementById('delete_password').focus();
    }, 10);
}

/**
 * Закрыть диалог подтверждения
 */
function closeDeleteConfirmation(element) {
    const overlay = element.closest('.modal-overlay');
    if (overlay) {
        overlay.classList.remove('show');
        setTimeout(() => overlay.remove(), 300);
    }
}

/**
 * Подтверждение удаления с проверкой пароля
 */
async function confirmDeleteManager(event, userId) {
    event.preventDefault();

    const password = document.getElementById('delete_password').value;
    const token = localStorage.getItem('access_token');

    try {
        // Сначала проверяем пароль через API авторизации
        const currentUserData = JSON.parse(atob(token.split('.')[1]));
        const username = currentUserData.username || currentUserData.sub;

        const authResponse = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                password: password
            })
        });

        if (!authResponse.ok) {
            throw new Error('Неверный пароль');
        }

        // Пароль верен, удаляем пользователя
        const deleteResponse = await fetch(`${API_BASE_URL}/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!deleteResponse.ok) {
            const error = await deleteResponse.json();
            throw new Error(error.detail || 'Ошибка удаления');
        }

        // Закрываем все модальные окна
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.remove();
        });

        alert('Пользователь успешно удалён');
        loadManagersData();

    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка: ' + error.message);
        // Очищаем поле пароля
        document.getElementById('delete_password').value = '';
        document.getElementById('delete_password').focus();
    }
}
