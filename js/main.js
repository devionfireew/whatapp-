// Devi Onfire - WhatsApp Bot Hub - Main JavaScript
// Owner: Devi Onfire

(function() {
    'use strict';

    // ==================== CONFIG ====================
    const CONFIG = {
        API_BASE: window.location.origin,
        TOKEN_KEY: 'devi_onfire_token',
        USER_KEY: 'devi_onfire_user',
        REFRESH_INTERVAL: 5000
    };

    // ==================== STATE ====================
    let state = {
        user: null,
        token: null,
        sessions: [],
        tasks: [],
        groups: [],
        logs: [],
        activeTab: 'sessions',
        refreshTimer: null
    };

    // ==================== DOM ELEMENTS ====================
    const $ = (id) => document.getElementById(id);
    const $$ = (sel) => document.querySelectorAll(sel);

    // ==================== TOAST SYSTEM ====================
    function showToast(message, type = 'info') {
        const container = $('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast-fire';

        const icons = {
            success: '<i class="fas fa-check-circle text-green-400 text-xl"></i>',
            error: '<i class="fas fa-times-circle text-red-500 text-xl"></i>',
            warning: '<i class="fas fa-exclamation-triangle text-yellow-400 text-xl"></i>',
            info: '<i class="fas fa-info-circle text-cyan-400 text-xl"></i>'
        };

        toast.innerHTML = `
            ${icons[type] || icons.info}
            <span class="text-white font-semibold">${message}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('hide');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ==================== API HELPERS ====================
    async function apiRequest(endpoint, options = {}) {
        const url = `${CONFIG.API_BASE}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (state.token) {
            headers['Authorization'] = `Bearer ${state.token}`;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (err) {
            console.error('API Error:', err);
            throw err;
        }
    }

    // ==================== AUTH ====================
    function initAuth() {
        // Check stored auth
        const storedToken = localStorage.getItem(CONFIG.TOKEN_KEY);
        const storedUser = localStorage.getItem(CONFIG.USER_KEY);

        if (storedToken && storedUser) {
            state.token = storedToken;
            state.user = JSON.parse(storedUser);
            showDashboard();
        }

        // Login/Register toggle
        $('show-register').addEventListener('click', (e) => {
            e.preventDefault();
            $('login-form').classList.add('hidden');
            $('register-form').classList.remove('hidden');
        });

        $('show-login').addEventListener('click', (e) => {
            e.preventDefault();
            $('register-form').classList.add('hidden');
            $('login-form').classList.remove('hidden');
        });

        // Login form
        $('login-form-submit').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = $('login-username').value.trim();
            const password = $('login-password').value;

            try {
                // Simulate API call - replace with real endpoint
                // const data = await apiRequest('/api/auth/login', {
                //     method: 'POST',
                //     body: JSON.stringify({ username, password })
                // });

                // Demo mode - accept any credentials
                await new Promise(r => setTimeout(r, 800));

                const data = {
                    token: 'demo_token_' + Date.now(),
                    user: { username, id: 'user_' + Date.now() }
                };

                state.token = data.token;
                state.user = data.user;
                localStorage.setItem(CONFIG.TOKEN_KEY, data.token);
                localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(data.user));

                showToast('Welcome back, ' + username + '!', 'success');
                showDashboard();
            } catch (err) {
                showToast(err.message || 'Login failed', 'error');
            }
        });

        // Register form
        $('register-form-submit').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = $('register-username').value.trim();
            const password = $('register-password').value;

            try {
                // Simulate API call
                await new Promise(r => setTimeout(r, 800));

                const data = {
                    token: 'demo_token_' + Date.now(),
                    user: { username, id: 'user_' + Date.now() }
                };

                state.token = data.token;
                state.user = data.user;
                localStorage.setItem(CONFIG.TOKEN_KEY, data.token);
                localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(data.user));

                showToast('Account created! Welcome to Devi Onfire!', 'success');
                showDashboard();
            } catch (err) {
                showToast(err.message || 'Registration failed', 'error');
            }
        });

        // Logout
        $('logout-btn').addEventListener('click', () => {
            Swal.fire({
                title: 'Logout?',
                text: 'Are you sure you want to sign out?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Yes, logout',
                cancelButtonText: 'Cancel',
                background: '#12121a',
                color: '#fff',
                confirmButtonColor: '#ff4e00',
                cancelButtonColor: '#6b7280'
            }).then((result) => {
                if (result.isConfirmed) {
                    localStorage.removeItem(CONFIG.TOKEN_KEY);
                    localStorage.removeItem(CONFIG.USER_KEY);
                    state.token = null;
                    state.user = null;
                    state.sessions = [];
                    state.tasks = [];
                    state.groups = [];
                    clearInterval(state.refreshTimer);

                    $('auth-view').classList.remove('hidden');
                    $('dashboard-view').classList.add('hidden');
                    $('login-form').classList.remove('hidden');
                    $('register-form').classList.add('hidden');
                    $('login-username').value = '';
                    $('login-password').value = '';

                    showToast('Logged out successfully', 'info');
                }
            });
        });
    }

    // ==================== DASHBOARD ====================
    function showDashboard() {
        $('auth-view').classList.add('hidden');
        $('dashboard-view').classList.remove('hidden');

        // Load initial data
        loadSessions();
        loadTasks();

        // Start refresh timer
        state.refreshTimer = setInterval(() => {
            if (state.activeTab === 'sessions') loadSessions();
            if (state.activeTab === 'tasks') loadTasks();
            if (state.activeTab === 'logs') loadLogs();
        }, CONFIG.REFRESH_INTERVAL);
    }

    // ==================== NAVIGATION ====================
    function initNavigation() {
        $$('.nav-btn-fire').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                switchTab(tab);
            });
        });
    }

    function switchTab(tab) {
        state.activeTab = tab;

        // Update nav buttons
        $$('.nav-btn-fire').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tab) {
                btn.classList.add('active');
            }
        });

        // Update content
        $$('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });
        $(tab + '-content').classList.remove('hidden');

        // Load tab-specific data
        if (tab === 'sessions') loadSessions();
        if (tab === 'tasks') loadTasks();
        if (tab === 'groups') loadGroups();
        if (tab === 'logs') loadLogs();
    }

    // ==================== SESSIONS ====================
    async function loadSessions() {
        try {
            // Replace with real API
            // const data = await apiRequest('/api/sessions');
            // state.sessions = data.sessions || [];

            // Demo data if empty
            if (state.sessions.length === 0) {
                state.sessions = [
                    { id: 'sess_1', name: 'Main Phone', status: 'connected', phone: '1234567890' },
                    { id: 'sess_2', name: 'Business', status: 'disconnected', phone: null }
                ];
            }

            renderSessions();
            updateStats();
            updateSessionSelects();
        } catch (err) {
            console.error('Load sessions error:', err);
        }
    }

    function renderSessions() {
        const container = $('sessions-list');

        if (state.sessions.length === 0) {
            container.innerHTML = `
                <div class="card-fire p-8 text-center">
                    <i class="fas fa-mobile-alt text-4xl text-gray-600 mb-4"></i>
                    <p class="text-gray-400 text-lg">No sessions yet</p>
                    <p class="text-gray-500 text-sm mt-2">Add a new session to get started</p>
                </div>
            `;
            return;
        }

        container.innerHTML = state.sessions.map(session => {
            const statusClass = 'status-' + session.status;
            const statusText = session.status.replace('_', ' ').toUpperCase();

            return `
                <div class="card-fire p-5">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-4">
                            <div class="h-12 w-12 rounded-xl flex items-center justify-center" 
                                 style="background: linear-gradient(135deg, #ff4e00, #f7931e);">
                                <i class="fab fa-whatsapp text-white text-xl"></i>
                            </div>
                            <div>
                                <h3 class="text-lg font-bold text-white">${session.name}</h3>
                                <div class="flex items-center mt-1">
                                    <span class="status-dot ${statusClass}"></span>
                                    <span class="text-sm text-gray-400">${statusText}</span>
                                </div>
                                ${session.phone ? `<p class="text-xs text-gray-500 mt-1"><i class="fas fa-phone mr-1"></i>${session.phone}</p>` : ''}
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            ${session.status === 'disconnected' || session.status === 'logged_out' ? `
                                <button class="action-btn connect" onclick="connectSession('${session.id}')" title="Connect">
                                    <i class="fas fa-plug"></i>
                                </button>
                            ` : `
                                <button class="action-btn disconnect" onclick="disconnectSession('${session.id}')" title="Disconnect">
                                    <i class="fas fa-unlink"></i>
                                </button>
                            `}
                            <button class="action-btn qr" onclick="showQR('${session.id}')" title="Show QR">
                                <i class="fas fa-qrcode"></i>
                            </button>
                            <button class="action-btn delete" onclick="deleteSession('${session.id}')" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function updateSessionSelects() {
        const selects = [$('task-session-select'), $('groups-session-select')];
        selects.forEach(select => {
            if (!select) return;
            const currentVal = select.value;
            select.innerHTML = '<option value="">-- Select a Session --</option>';
            state.sessions.forEach(s => {
                select.innerHTML += `<option value="${s.id}">${s.name}</option>`;
            });
            select.value = currentVal;
        });
    }

    // ==================== TASKS ====================
    async function loadTasks() {
        try {
            if (state.tasks.length === 0) {
                state.tasks = [
                    { id: 'task_1', name: 'Marketing Campaign', sessionId: 'sess_1', target: '1234567890', targetType: 'contact', status: 'running', messages: ['Hello!', 'How are you?'], prefix: 'Devi Onfire', interval: 30 },
                    { id: 'task_2', name: 'Group Broadcast', sessionId: 'sess_1', target: 'group@g.us', targetType: 'group', status: 'stopped', messages: ['Welcome!'], prefix: '', interval: 60 }
                ];
            }
            renderTasks();
            updateStats();
        } catch (err) {
            console.error('Load tasks error:', err);
        }
    }

    function renderTasks() {
        const container = $('tasks-list');

        if (state.tasks.length === 0) {
            container.innerHTML = `
                <div class="card-fire p-8 text-center">
                    <i class="fas fa-tasks text-4xl text-gray-600 mb-4"></i>
                    <p class="text-gray-400 text-lg">No tasks yet</p>
                    <p class="text-gray-500 text-sm mt-2">Create a new task to start messaging</p>
                </div>
            `;
            return;
        }

        container.innerHTML = state.tasks.map(task => {
            const session = state.sessions.find(s => s.id === task.sessionId);
            const sessionName = session ? session.name : 'Unknown';

            return `
                <div class="card-fire p-5">
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center gap-3">
                            <div class="h-10 w-10 rounded-xl flex items-center justify-center" 
                                 style="background: linear-gradient(135deg, #ff4e00, #f7931e);">
                                <i class="fas fa-paper-plane text-white"></i>
                            </div>
                            <div>
                                <h3 class="text-lg font-bold text-white">${task.name}</h3>
                                <p class="text-xs text-gray-500"><i class="fas fa-mobile-alt mr-1"></i>${sessionName}</p>
                            </div>
                        </div>
                        <span class="task-badge ${task.status}">${task.status}</span>
                    </div>

                    <div class="grid grid-cols-2 gap-3 mb-4 text-sm">
                        <div class="bg-black/30 rounded-lg p-3">
                            <p class="text-gray-500 text-xs uppercase tracking-wider mb-1">Target</p>
                            <p class="text-white font-semibold truncate">${task.target}</p>
                            <span class="text-xs text-orange-400">${task.targetType === 'group' ? '👥 Group' : '📱 Contact'}</span>
                        </div>
                        <div class="bg-black/30 rounded-lg p-3">
                            <p class="text-gray-500 text-xs uppercase tracking-wider mb-1">Messages</p>
                            <p class="text-white font-semibold">${task.messages.length} messages</p>
                            <span class="text-xs text-orange-400">${task.interval}s delay</span>
                        </div>
                    </div>

                    ${task.prefix ? `<p class="text-xs text-gray-500 mb-3"><i class="fas fa-tag mr-1"></i>Prefix: ${task.prefix}</p>` : ''}

                    <div class="flex items-center gap-2 pt-3 border-t border-white/5">
                        ${task.status === 'stopped' || task.status === 'completed' ? `
                            <button class="btn-fire flex-1 py-2 rounded-xl text-sm font-bold" onclick="startTask('${task.id}')">
                                <i class="fas fa-play mr-1"></i>Start
                            </button>
                        ` : `
                            <button class="btn-outline-fire flex-1 py-2 rounded-xl text-sm font-bold" onclick="stopTask('${task.id}')">
                                <i class="fas fa-stop mr-1"></i>Stop
                            </button>
                        `}
                        <button class="action-btn qr" onclick="editTask('${task.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete" onclick="deleteTask('${task.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ==================== GROUPS ====================
    async function loadGroups() {
        // Groups are fetched per session
        renderGroups();
    }

    function renderGroups() {
        const container = $('groups-list');

        if (state.groups.length === 0) {
            container.innerHTML = `
                <div class="card-fire p-8 text-center">
                    <i class="fas fa-users text-4xl text-gray-600 mb-4"></i>
                    <p class="text-gray-400 text-lg">No groups loaded</p>
                    <p class="text-gray-500 text-sm mt-2">Select a session and fetch groups</p>
                </div>
            `;
            return;
        }

        container.innerHTML = state.groups.map(group => `
            <div class="card-fire p-4 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="h-10 w-10 rounded-xl flex items-center justify-center bg-purple-500/20">
                        <i class="fas fa-users text-purple-400"></i>
                    </div>
                    <div>
                        <h3 class="text-white font-bold">${group.name}</h3>
                        <p class="text-xs text-gray-500 font-mono">${group.id}</p>
                    </div>
                </div>
                <button class="btn-outline-fire px-4 py-2 rounded-xl text-xs font-bold" onclick="copyGroupId('${group.id}')">
                    <i class="fas fa-copy mr-1"></i>Copy ID
                </button>
            </div>
        `).join('');
    }

    // ==================== LOGS ====================
    async function loadLogs() {
        // Logs are pushed via WebSocket or polling
        // Demo: add random log occasionally
        if (state.logs.length === 0) {
            state.logs = [
                { type: 'info', message: 'System initialized', time: new Date().toLocaleTimeString() },
                { type: 'success', message: 'Dashboard loaded successfully', time: new Date().toLocaleTimeString() }
            ];
        }
        renderLogs();
    }

    function renderLogs() {
        const container = $('logs-display');
        container.innerHTML = state.logs.map(log => `
            <div class="log-line log-${log.type}">
                <span class="text-gray-500 text-xs mr-2">[${log.time}]</span>
                ${log.message}
            </div>
        `).join('');
        container.scrollTop = container.scrollHeight;
    }

    function addLog(message, type = 'info') {
        state.logs.push({
            type,
            message,
            time: new Date().toLocaleTimeString()
        });
        if (state.logs.length > 100) state.logs.shift();
        if (state.activeTab === 'logs') renderLogs();
    }

    // ==================== STATS ====================
    function updateStats() {
        const activeSessions = state.sessions.filter(s => s.status === 'connected').length;
        const runningTasks = state.tasks.filter(t => t.status === 'running').length;

        $('sessions-count').textContent = activeSessions;
        $('tasks-count').textContent = runningTasks;
    }

    // ==================== MODALS ====================
    function initModals() {
        // Add Session Modal
        $('add-session-btn').addEventListener('click', () => {
            $('add-session-modal').classList.remove('hidden');
        });

        $('add-session-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = $('new-session-name').value.trim();
            const fileInput = $('creds-file-input');

            try {
                let credsData = null;
                if (fileInput.files.length > 0) {
                    const file = fileInput.files[0];
                    const text = await file.text();
                    credsData = JSON.parse(text);
                }

                // Simulate API call
                await new Promise(r => setTimeout(r, 600));

                const newSession = {
                    id: 'sess_' + Date.now(),
                    name,
                    status: 'disconnected',
                    phone: null
                };

                state.sessions.push(newSession);
                renderSessions();
                updateStats();
                updateSessionSelects();

                closeModal('add-session-modal');
                $('add-session-form').reset();
                showToast('Session added successfully!', 'success');
                addLog(`Session "${name}" added`, 'success');
            } catch (err) {
                showToast(err.message || 'Failed to add session', 'error');
            }
        });

        // Add Task Modal
        $('add-task-btn').addEventListener('click', () => {
            $('task-modal-title').textContent = 'Add New Task';
            $('task-submit-text').innerHTML = '<i class="fas fa-rocket mr-2"></i>Create Task';
            $('edit-task-id').value = '';
            $('add-task-form').reset();
            $('add-task-modal').classList.remove('hidden');
        });

        $('add-task-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const editId = $('edit-task-id').value;

            const taskData = {
                name: $('new-task-name').value.trim(),
                sessionId: $('task-session-select').value,
                targetType: $('task-target-type').value,
                target: $('task-target').value.trim(),
                messages: $('task-messages').value.split('\n').filter(m => m.trim()),
                prefix: $('task-prefix').value.trim(),
                interval: parseInt($('task-interval').value)
            };

            try {
                await new Promise(r => setTimeout(r, 600));

                if (editId) {
                    const idx = state.tasks.findIndex(t => t.id === editId);
                    if (idx !== -1) {
                        state.tasks[idx] = { ...state.tasks[idx], ...taskData };
                        showToast('Task updated!', 'success');
                        addLog(`Task "${taskData.name}" updated`, 'info');
                    }
                } else {
                    const newTask = {
                        id: 'task_' + Date.now(),
                        ...taskData,
                        status: 'stopped'
                    };
                    state.tasks.push(newTask);
                    showToast('Task created!', 'success');
                    addLog(`Task "${taskData.name}" created`, 'success');
                }

                renderTasks();
                updateStats();
                closeModal('add-task-modal');
                $('add-task-form').reset();
            } catch (err) {
                showToast(err.message || 'Failed to save task', 'error');
            }
        });

        // Fetch Groups
        $('fetch-groups-btn').addEventListener('click', async () => {
            const sessionId = $('groups-session-select').value;
            if (!sessionId) {
                showToast('Please select a session first', 'warning');
                return;
            }

            try {
                showToast('Fetching groups...', 'info');
                await new Promise(r => setTimeout(r, 1000));

                // Demo groups
                state.groups = [
                    { id: '1234567890@g.us', name: 'Test Group 1' },
                    { id: '0987654321@g.us', name: 'Test Group 2' },
                    { id: '1122334455@g.us', name: 'Marketing Team' }
                ];

                renderGroups();
                showToast(`Found ${state.groups.length} groups!`, 'success');
                addLog(`Fetched ${state.groups.length} groups`, 'success');
            } catch (err) {
                showToast(err.message || 'Failed to fetch groups', 'error');
            }
        });

        // Close modal buttons
        $$('.close-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('[id$="-modal"]');
                if (modal) closeModal(modal.id);
            });
        });

        // Close on backdrop click
        $$('[id$="-modal"]').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal(modal.id);
            });
        });
    }

    function closeModal(modalId) {
        $(modalId).classList.add('hidden');
    }

    // ==================== SESSION ACTIONS ====================
    window.connectSession = async function(sessionId) {
        try {
            showToast('Connecting...', 'info');
            await new Promise(r => setTimeout(r, 1500));

            const session = state.sessions.find(s => s.id === sessionId);
            if (session) {
                session.status = 'connected';
                session.phone = '9' + Math.floor(Math.random() * 1000000000);
                renderSessions();
                updateStats();
                showToast(`Session "${session.name}" connected!`, 'success');
                addLog(`Session "${session.name}" connected`, 'success');
            }
        } catch (err) {
            showToast('Connection failed', 'error');
        }
    };

    window.disconnectSession = async function(sessionId) {
        try {
            const session = state.sessions.find(s => s.id === sessionId);
            if (!session) return;

            Swal.fire({
                title: 'Disconnect?',
                text: `Disconnect session "${session.name}"?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Disconnect',
                cancelButtonText: 'Cancel',
                background: '#12121a',
                color: '#fff',
                confirmButtonColor: '#ff4e00',
                cancelButtonColor: '#6b7280'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    await new Promise(r => setTimeout(r, 500));
                    session.status = 'disconnected';
                    session.phone = null;
                    renderSessions();
                    updateStats();
                    showToast(`Session "${session.name}" disconnected`, 'info');
                    addLog(`Session "${session.name}" disconnected`, 'warning');
                }
            });
        } catch (err) {
            showToast('Disconnect failed', 'error');
        }
    };

    window.deleteSession = async function(sessionId) {
        const session = state.sessions.find(s => s.id === sessionId);
        if (!session) return;

        Swal.fire({
            title: 'Delete Session?',
            text: `Are you sure you want to delete "${session.name}"? This cannot be undone!`,
            icon: 'error',
            showCancelButton: true,
            confirmButtonText: 'Delete',
            cancelButtonText: 'Cancel',
            background: '#12121a',
            color: '#fff',
            confirmButtonColor: '#ff2d55',
            cancelButtonColor: '#6b7280'
        }).then(async (result) => {
            if (result.isConfirmed) {
                await new Promise(r => setTimeout(r, 500));
                state.sessions = state.sessions.filter(s => s.id !== sessionId);
                renderSessions();
                updateStats();
                updateSessionSelects();
                showToast('Session deleted', 'success');
                addLog(`Session "${session.name}" deleted`, 'warning');
            }
        });
    };

    window.showQR = function(sessionId) {
        const session = state.sessions.find(s => s.id === sessionId);
        Swal.fire({
            title: 'QR Code',
            text: session ? `QR for ${session.name}` : 'QR Code',
            html: `
                <div class="p-4 rounded-xl" style="background: #0a0a0f;">
                    <div class="w-48 h-48 mx-auto rounded-xl flex items-center justify-center" style="background: white;">
                        <i class="fas fa-qrcode text-black text-6xl"></i>
                    </div>
                    <p class="text-gray-400 text-sm mt-4">Scan with WhatsApp to connect</p>
                </div>
            `,
            showConfirmButton: false,
            showCloseButton: true,
            background: '#12121a',
            color: '#fff'
        });
    };

    // ==================== TASK ACTIONS ====================
    window.startTask = async function(taskId) {
        try {
            const task = state.tasks.find(t => t.id === taskId);
            if (!task) return;

            showToast(`Starting task "${task.name}"...`, 'info');
            await new Promise(r => setTimeout(r, 800));

            task.status = 'running';
            renderTasks();
            updateStats();
            showToast(`Task "${task.name}" is now running!`, 'success');
            addLog(`Task "${task.name}" started`, 'success');
        } catch (err) {
            showToast('Failed to start task', 'error');
        }
    };

    window.stopTask = async function(taskId) {
        try {
            const task = state.tasks.find(t => t.id === taskId);
            if (!task) return;

            showToast(`Stopping task "${task.name}"...`, 'info');
            await new Promise(r => setTimeout(r, 500));

            task.status = 'stopped';
            renderTasks();
            updateStats();
            showToast(`Task "${task.name}" stopped`, 'info');
            addLog(`Task "${task.name}" stopped`, 'warning');
        } catch (err) {
            showToast('Failed to stop task', 'error');
        }
    };

    window.editTask = function(taskId) {
        const task = state.tasks.find(t => t.id === taskId);
        if (!task) return;

        $('task-modal-title').textContent = 'Edit Task';
        $('task-submit-text').innerHTML = '<i class="fas fa-save mr-2"></i>Update Task';
        $('edit-task-id').value = taskId;
        $('new-task-name').value = task.name;
        $('task-session-select').value = task.sessionId;
        $('task-target-type').value = task.targetType;
        $('task-target').value = task.target;
        $('task-messages').value = task.messages.join('\n');
        $('task-prefix').value = task.prefix || '';
        $('task-interval').value = task.interval;

        $('add-task-modal').classList.remove('hidden');
    };

    window.deleteTask = async function(taskId) {
        const task = state.tasks.find(t => t.id === taskId);
        if (!task) return;

        Swal.fire({
            title: 'Delete Task?',
            text: `Delete task "${task.name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Delete',
            cancelButtonText: 'Cancel',
            background: '#12121a',
            color: '#fff',
            confirmButtonColor: '#ff2d55',
            cancelButtonColor: '#6b7280'
        }).then(async (result) => {
            if (result.isConfirmed) {
                await new Promise(r => setTimeout(r, 400));
                state.tasks = state.tasks.filter(t => t.id !== taskId);
                renderTasks();
                updateStats();
                showToast('Task deleted', 'success');
                addLog(`Task "${task.name}" deleted`, 'warning');
            }
        });
    };

    // ==================== GROUP ACTIONS ====================
    window.copyGroupId = function(groupId) {
        navigator.clipboard.writeText(groupId).then(() => {
            showToast('Group ID copied!', 'success');
        }).catch(() => {
            const textarea = document.createElement('textarea');
            textarea.value = groupId;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showToast('Group ID copied!', 'success');
        });
    };

    // ==================== DEMO LOG GENERATOR ====================
    function startDemoLogs() {
        const logMessages = [
            { msg: 'Connected to WhatsApp server', type: 'success' },
            { msg: 'Session heartbeat received', type: 'info' },
            { msg: 'Message sent successfully', type: 'success' },
            { msg: 'Waiting for next message...', type: 'info' },
            { msg: 'Task progress: 50%', type: 'info' },
            { msg: 'Rate limit detected, slowing down', type: 'warning' },
            { msg: 'Reconnected after timeout', type: 'success' },
            { msg: 'New message received', type: 'info' },
            { msg: 'Group info updated', type: 'info' },
            { msg: 'Session token refreshed', type: 'success' }
        ];

        setInterval(() => {
            if (Math.random() > 0.7) {
                const log = logMessages[Math.floor(Math.random() * logMessages.length)];
                addLog(log.msg, log.type);
            }
        }, 3000);
    }

    // ==================== INIT ====================
    function init() {
        initAuth();
        initNavigation();
        initModals();
        startDemoLogs();

        console.log('%c🔥 Devi Onfire WhatsApp Bot Hub', 'color: #ff4e00; font-size: 20px; font-weight: bold;');
        console.log('%cOwner: Devi Onfire', 'color: #f7931e; font-size: 14px;');
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
