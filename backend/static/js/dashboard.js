// Константы API (если ещё не объявлены)
if (typeof API_BASE_URL === 'undefined') {
    var API_BASE_URL = window.location.origin + '/api';
}

// Глобальные переменные (если потребуются в будущем)

// Проверка авторизации при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('access_token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    // Отображение имени пользователя
    const userElement = document.getElementById('userName');
    if (userElement) {
        userElement.textContent = user.full_name || user.username || 'Пользователь';
    }

    // Инициализация навигации
    initNavigation();

    // Фильтрация меню по роли пользователя
    filterMenuByRole(user.role);

    // Восстановление последней активной секции или переход по hash
    const hash = window.location.hash.substring(1);
    const lastSection = hash || localStorage.getItem('lastActiveSection') || 'statistics';
    switchSection(lastSection);

    // Настройка кнопок выхода
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');
    if (sidebarLogoutBtn) {
        sidebarLogoutBtn.addEventListener('click', handleLogout);
    }

    // Обновление имени пользователя в сайдбаре
    const sidebarUserName = document.getElementById('sidebarUserName');
    if (sidebarUserName) {
        sidebarUserName.textContent = user.full_name || user.username || 'Пользователь';
    }
});

// Загрузка данных дашборда
async function loadDashboardData() {
    try {
        const token = localStorage.getItem('access_token');
        if (!token) {
            handleLogout();
            return;
        }

        // Параллельная загрузка данных
        const [summaryResponse, urgentResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/dashboard/stats`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }),
            fetch(`${API_BASE_URL}/deadlines/urgent?days=14`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })
        ]);

        if (!summaryResponse.ok) {
            if (summaryResponse.status === 401) {
                handleLogout();
                return;
            }
            const errorText = await summaryResponse.text();
            showError(`Не удалось загрузить данные дашборда: ${summaryResponse.status}`);
            throw new Error(`Ошибка загрузки данных: ${summaryResponse.status}`);
        }

        const summaryData = await summaryResponse.json();
        const urgentData = urgentResponse.ok ? await urgentResponse.json() : [];

        // Обновление карточек статистики
        updateStatisticsCards(summaryData);

        // Заполнение таблицы срочных дедлайнов
        renderUrgentDeadlines(urgentData);

    } catch (error) {
        console.error('Ошибка загрузки дашборда:', error);
        showError(`Не удалось отобразить данные дашборда: ${error.message}`);
    }
}

// Обновление карточек статистики
function updateStatisticsCards(data) {
    // Всего клиентов
    const totalClientsEl = document.getElementById('totalClients');
    if (totalClientsEl) totalClientsEl.textContent = data.total_clients || 0;

    // Активных клиентов
    const activeClientsEl = document.getElementById('activeClients');
    if (activeClientsEl) activeClientsEl.textContent = data.active_clients || 0;

    // Всего касс
    const totalCashRegistersEl = document.getElementById('totalCashRegisters');
    if (totalCashRegistersEl) {
        totalCashRegistersEl.textContent = data.total_cash_registers || 0;
    }

    // Всего сроков
    const totalDeadlinesEl = document.getElementById('totalDeadlines');
    if (totalDeadlinesEl) totalDeadlinesEl.textContent = data.total_deadlines || 0;

    // Срочных дедлайнов (красные + желтые)
    const urgentCount = (data.status_red || 0) + (data.status_yellow || 0);
    const urgentCountEl = document.getElementById('urgentCount');
    if (urgentCountEl) urgentCountEl.textContent = urgentCount;

    // Просроченных
    const expiredCountEl = document.getElementById('expiredCount');
    if (expiredCountEl) expiredCountEl.textContent = data.status_expired || 0;
}



// Отрисовка таблицы срочных дедлайнов (включая просроченные)
function renderUrgentDeadlines(deadlines) {
    const tableBody = document.getElementById('urgentDeadlinesTable');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    if (!deadlines || deadlines.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 20px; color: #999;">
                    Нет срочных дедлайнов
                </td>
            </tr>
        `;
        return;
    }

    deadlines.forEach(deadline => {
        const row = document.createElement('tr');
        row.classList.add('clickable-row');
        row.addEventListener('click', () => {
            if (typeof editDeadline === 'function') {
                editDeadline(deadline.id);
            }
        });

        // Определение статуса и цвета
        let statusText = '';
        let statusColor = '';
        let statusClass = 'status-pill--muted';
        const daysRemaining = deadline.days_until_expiration;

        if (daysRemaining < 0) {
            statusText = 'Просрочено';
            statusColor = '#9E9E9E';
            statusClass = 'status-pill--danger';
        } else if (daysRemaining <= 7) {
            statusText = 'Срочно';
            statusColor = '#F44336';
            statusClass = 'status-pill--danger';
        } else if (daysRemaining <= 14) {
            statusText = 'Внимание';
            statusColor = '#FFC107';
            statusClass = 'status-pill--warning';
        } else {
            statusText = 'Норма';
            statusColor = '#4CAF50';
            statusClass = 'status-pill--success';
        }

        // Форматирование даты в российский формат ДД.ММ.ГГГГ
        const formattedDate = formatDateRU(deadline.expiration_date);

        // Получение имени клиента и типа дедлайна
        const clientName = deadline.client?.company_name || 'Не указан';
        const deadlineType = deadline.deadline_type?.name || deadline.deadline_type?.type_name || 'Не указан';

        console.log('📖 Дедлайн ID=' + deadline.id + ':', {
            client: deadline.client,
            deadline_type: deadline.deadline_type,
            clientName,
            deadlineType
        });

        row.innerHTML = `
            <td class="mdl-data-table__cell--non-numeric">${clientName}</td>
            <td class="mdl-data-table__cell--non-numeric">${deadlineType}</td>
            <td class="mdl-data-table__cell--non-numeric">${formattedDate}</td>
            <td class="mdl-data-table__cell--non-numeric" style="font-weight: bold; color: ${statusColor};">
                ${daysRemaining} дн.
            </td>
            <td class="mdl-data-table__cell--non-numeric">
                <span class="status-pill ${statusClass}">
                    ${statusText}
                </span>
            </td>
        `;

        tableBody.appendChild(row);
    });
}

// Инициализация навигации
function initNavigation() {
    // Обработчики кликов на элементы навигации
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const section = item.dataset.section;
            if (section) {
                // Только для элементов с data-section блокируем переход
                e.preventDefault();
                switchSection(section);
                window.location.hash = section;
            }
            // Для элементов без data-section разрешаем обычный переход по ссылке
        });
    });

    // Обработчик изменения hash (browser back/forward)
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.substring(1);
        if (hash) {
            switchSection(hash);
        }
    });
}

// Переключение между разделами
function switchSection(sectionId) {

    // Скрыть все секции
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
        section.classList.add('hidden');
    });

    // Убрать активность со всех пунктов меню
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    // Показать выбранную секцию
    const targetSection = document.getElementById(`${sectionId}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
        targetSection.classList.remove('hidden');
    }

    // Активировать соответствующий пункт меню
    const navItem = document.querySelector(`[data-section="${sectionId}"]`);
    if (navItem) {
        navItem.classList.add('active');
    }

    // Обновить заголовок страницы
    const sectionTitles = {
        'statistics': 'Управление Дедлайнами',
        'users': 'Клиенты',
        'deadlines': 'Дедлайны',
        'deadline-types': 'Типы дедлайнов',
        'managers': 'Пользователи',
        'export': 'Экспорт данных'
    };
    document.title = `${sectionTitles[sectionId] || 'Управление Дедлайнами'} - Релабс Центр`;

    // Загрузить данные для секции
    loadSectionData(sectionId);

    // Сохранить в localStorage
    localStorage.setItem('lastActiveSection', sectionId);
}

// Загрузка данных для конкретной секции
function loadSectionData(sectionId) {
    switch (sectionId) {
        case 'statistics':
            loadDashboardData();
            break;
        case 'users':
            if (typeof loadUsersData === 'function') {
                loadUsersData();
            }
            break;
        case 'deadlines':
            if (typeof loadDeadlinesData === 'function') {
                loadDeadlinesData();
            }
            break;
        case 'deadline-types':
            if (typeof loadDeadlineTypesData === 'function') {
                loadDeadlineTypesData();
            }
            break;
        case 'managers':
            if (typeof loadManagersData === 'function') {
                loadManagersData();
            }
            break;
        case 'export':
            if (typeof loadExportData === 'function') {
                loadExportData();
            }
            break;
    }
}

// Фильтрация меню по роли пользователя
function filterMenuByRole(role) {
    // Общая обработка всех элементов с data-role
    document.querySelectorAll('[data-role]').forEach(item => {
        const allowedRoles = item.dataset.role.split(',').map(r => r.trim());
        if (!allowedRoles.includes(role)) {
            item.style.display = 'none';
        }
    });

    // Для клиентов показываем только их данные
    if (role === 'client') {
        // Раздел "Клиенты" переименовываем в "Мои данные"
        const usersNavItem = document.querySelector('[data-section="users"]');
        if (usersNavItem) {
            const span = usersNavItem.querySelector('span');
            if (span) span.textContent = 'Мои данные';
        }
    }
}

// Обработка выхода
function handleLogout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    localStorage.removeItem('lastActiveSection');
    window.location.href = '/login.html';
}

// Отображение ошибки
function showError(message) {

    // Попытка использовать snackbar
    const snackbar = document.getElementById('demo-snackbar');
    if (snackbar && snackbar.MaterialSnackbar) {
        snackbar.MaterialSnackbar.showSnackbar({
            message: message,
            timeout: 5000
        });
    } else {
        // Fallback на alert если snackbar недоступен
        console.warn('⚠️ Snackbar недоступен, используется alert');
        alert(message);
    }
}

// Функции навигации для кликабельных карточек статистики
function navigateToClients() {
    // Сбрасываем фильтр неактивных клиентов
    if (typeof showInactiveUsers !== 'undefined') {
        showInactiveUsers = false;
    }
    switchSection('users');
    window.location.hash = 'users';
}

function navigateToAllDeadlines() {
    switchSection('deadlines');
    window.location.hash = 'deadlines';
    // Сбросим все фильтры для отображения всех дедлайнов
    setTimeout(() => {
        if (typeof resetFilters === 'function') {
            resetFilters();
        }
    }, 100);
}

function navigateToUrgentDeadlines() {
    switchSection('deadlines');
    window.location.hash = 'deadlines';
    // Установим фильтр для срочных дедлайнов (0-7 дней)
    setTimeout(() => {
        // Дождемся загрузки данных и отрисовки фильтров
        const checkAndApply = () => {
            const filterDays = document.getElementById('filterDays');
            if (filterDays) {
                filterDays.value = 'urgent';
                if (typeof applyFilters === 'function') {
                    applyFilters();
                }
            } else {
                // Если элемент еще не появился, повторим через 50мс
                setTimeout(checkAndApply, 50);
            }
        };
        checkAndApply();
    }, 100);
}

function navigateToExpiredDeadlines() {
    switchSection('deadlines');
    window.location.hash = 'deadlines';
    // Установим фильтр для просроченных дедлайнов
    setTimeout(() => {
        // Дождемся загрузки данных и отрисовки фильтров
        const checkAndApply = () => {
            const filterDays = document.getElementById('filterDays');
            if (filterDays) {
                filterDays.value = 'expired';
                if (typeof applyFilters === 'function') {
                    applyFilters();
                }
            } else {
                // Если элемент еще не появился, повторим через 50мс
                setTimeout(checkAndApply, 50);
            }
        };
        checkAndApply();
    }, 100);
}
