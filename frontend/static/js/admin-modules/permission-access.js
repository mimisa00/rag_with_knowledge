/**
 * 權限存取管理模組
 * 管理 URL、API 和動作的權限對應
 */
const PermissionAccessModule = (function () {
    'use strict';

    // API 端點
    const API_BASE = '/api/permissions/access';
    const ENDPOINTS = {
        urls: `${API_BASE}/urls`,
        apis: `${API_BASE}/apis`,
        actions: `${API_BASE}/actions`,
        cache: `${API_BASE}/cache`,
        matrix: '/api/permissions/matrix'
    };

    // 模組狀態
    let state = {
        activeTab: 'urls',
        urls: [],
        apis: [],
        actions: [],
        permissions: [],
        cacheInfo: null,
        filters: {
            urls: '',
            apis: '',
            actions: ''
        }
    };

    /**
     * 初始化模組
     */
    async function init() {
        setupEventListeners();
        await loadPermissions();
        await loadAccessData();
        updateStatistics();
        // 初始化滾動條淡出淡入效果
        if (window.CommonUI && CommonUI.initScrollFadeEffect) {
            CommonUI.initScrollFadeEffect();
        }
    }

    /**
     * 設置事件監聽器
     */
    function setupEventListeners() {
        // 標籤頁切換
        document.querySelectorAll('.access-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.currentTarget.dataset.tab;
                switchTab(tabName);
            });
        });

        // 新增按鈕
        document.getElementById('addUrlBtn')?.addEventListener('click', () => showUrlModal());
        document.getElementById('addApiBtn')?.addEventListener('click', () => showApiModal());
        document.getElementById('addActionBtn')?.addEventListener('click', () => showActionModal());

        // 搜尋功能
        document.getElementById('urlSearchInput')?.addEventListener('input', (e) => {
            state.filters.urls = e.target.value;
            renderUrlTable();
        });

        document.getElementById('apiSearchInput')?.addEventListener('input', (e) => {
            state.filters.apis = e.target.value;
            renderApiTable();
        });

        document.getElementById('actionSearchInput')?.addEventListener('input', (e) => {
            state.filters.actions = e.target.value;
            renderActionCards();
        });

        // 快取管理
        document.getElementById('refreshCacheBtn')?.addEventListener('click', refreshCache);
        document.getElementById('clearCacheBtn')?.addEventListener('click', clearCache);

        // 測試工具
        document.getElementById('testUrlBtn')?.addEventListener('click', testUrlAccess);
        document.getElementById('testApiBtn')?.addEventListener('click', testApiAccess);
    }

    /**
     * 切換標籤頁
     */
    function switchTab(tabName) {
        state.activeTab = tabName;

        // 更新標籤樣式
        document.querySelectorAll('.access-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // 更新內容顯示
        document.querySelectorAll('.access-tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-section`);
        });

        // 載入對應資料
        switch (tabName) {
            case 'urls':
                loadUrls();
                break;
            case 'apis':
                loadApis();
                break;
            case 'actions':
                loadActions();
                break;
            case 'cache':
                loadCacheInfo();
                break;
        }
    }

    /**
     * 載入權限矩陣資料
     */
    async function loadPermissions() {
        try {
            const response = await fetch(ENDPOINTS.matrix, {
                credentials: 'include'
            });

            if (!response.ok) throw new Error('載入權限失敗');

            const data = await response.json();
            state.permissions = data.items || [];
        } catch (error) {
            console.error('載入權限失敗:', error);
            if (window.Dialog) {
                Dialog.error('載入權限資料失敗');
            }
        }
    }

    /**
     * 載入存取資料
     */
    async function loadAccessData() {
        // 使用 Promise.allSettled 而非 Promise.all，避免單一失敗影響其他
        const results = await Promise.allSettled([
            loadUrls(),
            loadApis(),
            loadActions()
        ]);
  
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                const types = ['URLs', 'APIs', 'Actions'];
                console.error(`載入 ${types[index]} 失敗:`, result.reason);
            }
        });
    }

    /**
     * 載入 URL 權限資料
     */
    async function loadUrls() {
        try {
            showLoadingState('urlTableBody');

            const response = await fetch(ENDPOINTS.urls, {
                credentials: 'include'
            });

            if (!response.ok) throw new Error('載入 URL 權限失敗');

            const data = await response.json();
            state.urls = data.items || data || [];
            renderUrlTable();
            updateUrlStatistics();

        } catch (error) {
            console.error('載入 URL 權限失敗:', error);
            showEmptyState('urlTableBody', '載入 URL 權限資料失敗');
        }
    }

    /**
     * 載入 API 權限資料
     */
    async function loadApis() {
        try {
            showLoadingState('apiTableBody');

            const response = await fetch(ENDPOINTS.apis, {
                credentials: 'include'
            });

            if (!response.ok) throw new Error('載入 API 權限失敗');

            const data = await response.json();
            state.apis = data.items || data || [];
            renderApiTable();
            updateApiStatistics();

        } catch (error) {
            console.error('載入 API 權限失敗:', error);
            showEmptyState('apiTableBody', '載入 API 權限資料失敗');
        }
    }

    /**
     * 載入動作權限資料
     */
    async function loadActions() {
        try {
            showLoadingState('actionCardsContainer');

            const response = await fetch(ENDPOINTS.actions, {
                credentials: 'include'
            });

            if (!response.ok) throw new Error('載入動作權限失敗');

            const data = await response.json();
            state.actions = data.items || data || [];
            renderActionCards();
            updateActionStatistics();

        } catch (error) {
            console.error('載入動作權限失敗:', error);
            showEmptyState('actionCardsContainer', '載入動作權限資料失敗');
        }
    }

    /**
     * 載入快取資訊
     */
    async function loadCacheInfo() {
        try {
            const response = await fetch(ENDPOINTS.cache, {
                credentials: 'include'
            });

            if (!response.ok) throw new Error('載入快取資訊失敗');

            const data = await response.json();
            state.cacheInfo = data;
            renderCacheInfo();

        } catch (error) {
            console.error('載入快取資訊失敗:', error);
            if (window.Dialog) {
                Dialog.error('載入快取資訊失敗');
            }
        }
    }

    /**
     * 渲染 URL 表格
     */
    function renderUrlTable() {
        const tbody = document.getElementById('urlTableBody');
        if (!tbody) return;

        let filteredUrls = state.urls;
        if (state.filters.urls) {
            const searchTerm = state.filters.urls.toLowerCase();
            filteredUrls = state.urls.filter(url =>
                url.url_pattern.toLowerCase().includes(searchTerm) ||
                url.description?.toLowerCase().includes(searchTerm) ||
                url.module_key?.toLowerCase().includes(searchTerm)
            );
        }

        if (filteredUrls.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">
                        <div class="empty-state">
                            <i class="fas fa-link"></i>
                            <h3>尚無 URL 權限設定</h3>
                            <p>點擊「新增 URL 權限」開始設定</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filteredUrls.map(url => `
            <tr>
                <td><span class="pattern-display">${url.url_pattern}</span></td>
                <td><span class="method-badge method-${url.method.toLowerCase()}">${url.method}</span></td>
                <td>
                    ${url.permission_matrix_id ?
                `<div class="permission-display">
                            <span class="permission-code">${getPermissionCode(url.permission_matrix_id)}</span>
                            <span class="permission-name">${getPermissionName(url.permission_matrix_id)}</span>
                        </div>` :
                `<span class="text-muted">無需權限</span>`
            }
                </td>
                <td>
                    ${url.is_public ?
                '<span class="auth-badge public">公開</span>' :
                '<span class="auth-badge auth-required">需認證</span>'
            }
                </td>
                <td><span class="priority-badge">${url.priority}</span></td>
                <td>
                    <span class="status-badge ${url.is_active ? 'status-active' : 'status-disabled'}">
                        ${url.is_active ? '啟用' : '停用'}
                    </span>
                </td>
                <td>
                    <button class="btn-icon" onclick="PermissionAccessModule.editUrl(${url.id})" title="編輯">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon" onclick="PermissionAccessModule.deleteUrl(${url.id})" title="刪除">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    /**
     * 渲染 API 表格
     */
    function renderApiTable() {
        const tbody = document.getElementById('apiTableBody');
        if (!tbody) return;

        let filteredApis = state.apis;
        if (state.filters.apis) {
            const searchTerm = state.filters.apis.toLowerCase();
            filteredApis = state.apis.filter(api =>
                api.api_pattern.toLowerCase().includes(searchTerm) ||
                api.description?.toLowerCase().includes(searchTerm) ||
                api.module_key?.toLowerCase().includes(searchTerm)
            );
        }

        if (filteredApis.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">
                        <div class="empty-state">
                            <i class="fas fa-plug"></i>
                            <h3>尚無 API 權限設定</h3>
                            <p>點擊「新增 API 權限」開始設定</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filteredApis.map(api => `
            <tr>
                <td><span class="pattern-display">${api.api_pattern}</span></td>
                <td><span class="method-badge method-${api.method.toLowerCase()}">${api.method}</span></td>
                <td>
                    ${api.permission_matrix_id ?
                `<div class="permission-display">
                            <span class="permission-code">${getPermissionCode(api.permission_matrix_id)}</span>
                            <span class="permission-name">${getPermissionName(api.permission_matrix_id)}</span>
                        </div>` :
                `<span class="text-muted">無需權限</span>`
            }
                </td>
                <td>
                    ${api.require_auth ?
                '<span class="auth-badge auth-required">需認證</span>' :
                '<span class="auth-badge public">公開</span>'
            }
                </td>
                <td><span class="priority-badge">${api.priority}</span></td>
                <td>
                    <span class="status-badge ${api.is_active ? 'status-active' : 'status-disabled'}">
                        ${api.is_active ? '啟用' : '停用'}
                    </span>
                </td>
                <td>
                    <button class="btn-icon" onclick="PermissionAccessModule.editApi(${api.id})" title="編輯">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon" onclick="PermissionAccessModule.deleteApi(${api.id})" title="刪除">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    /**
     * 渲染動作卡片
     */
    function renderActionCards() {
        const container = document.getElementById('actionCardsContainer');
        if (!container) return;

        let filteredActions = state.actions;
        if (state.filters.actions) {
            const searchTerm = state.filters.actions.toLowerCase();
            filteredActions = state.actions.filter(action =>
                action.name.toLowerCase().includes(searchTerm) ||
                action.description?.toLowerCase().includes(searchTerm) ||
                action.module_key?.toLowerCase().includes(searchTerm) ||
                action.action_key?.toLowerCase().includes(searchTerm)
            );
        }

        if (filteredActions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-cogs"></i>
                    <h3>尚無動作權限設定</h3>
                    <p>點擊「新增動作權限」開始設定</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filteredActions.map(action => `
            <div class="action-card">
                <div class="action-card-header">
                    <span class="action-card-title">${action.name}</span>
                    <span class="action-card-module">${action.module_key}</span>
                </div>
                <div class="action-card-body">
                    <div class="permission-code">${action.permission_code}</div>
                    <div class="text-muted">${action.description || '無描述'}</div>
                </div>
                ${action.dependencies && action.dependencies.length > 0 ? `
                    <div class="action-dependencies">
                        <div class="dependency-label">依賴權限：</div>
                        <div class="dependency-tags">
                            ${action.dependencies.map(dep =>
            `<span class="dependency-tag">${dep}</span>`
        ).join('')}
                        </div>
                    </div>
                ` : ''}
                <div class="action-card-footer">
                    <button class="btn-icon" onclick="PermissionAccessModule.editAction(${action.id})" title="編輯">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon" onclick="PermissionAccessModule.deleteAction(${action.id})" title="刪除">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    /**
     * 渲染快取資訊
     */
    function renderCacheInfo() {
        if (!state.cacheInfo) return;

        // 更新快取統計
        document.getElementById('totalCacheCount').textContent = state.cacheInfo.total || 0;
        document.getElementById('activeCacheCount').textContent = state.cacheInfo.active || 0;
        document.getElementById('expiredCacheCount').textContent = state.cacheInfo.expired || 0;
        document.getElementById('cacheHitRate').textContent =
            state.cacheInfo.hit_rate ? `${(state.cacheInfo.hit_rate * 100).toFixed(1)}%` : '0%';
    }

    /**
     * 取得權限代碼
     */
    function getPermissionCode(matrixId) {
        const permission = state.permissions.find(p => p.id === matrixId);
        return permission ? permission.permission_key : '';
    }

    /**
     * 取得權限名稱
     */
    function getPermissionName(matrixId) {
        const permission = state.permissions.find(p => p.id === matrixId);
        return permission ? `${permission.module_name} - ${permission.action_name}` : '';
    }

    /**
     * 更新統計資訊
     */
    function updateStatistics() {
        updateUrlStatistics();
        updateApiStatistics();
        updateActionStatistics();
    }

    function updateUrlStatistics() {
        const total = state.urls.length;
        const active = state.urls.filter(u => u.is_active).length;
        const publicUrls = state.urls.filter(u => u.is_public).length;

        document.getElementById('totalUrlCount').textContent = total;
        document.getElementById('activeUrlCount').textContent = active;
        document.getElementById('publicUrlCount').textContent = publicUrls;
    }

    function updateApiStatistics() {
        const total = state.apis.length;
        const active = state.apis.filter(a => a.is_active).length;
        const publicApis = state.apis.filter(a => !a.require_auth).length;

        document.getElementById('totalApiCount').textContent = total;
        document.getElementById('activeApiCount').textContent = active;
        document.getElementById('publicApiCount').textContent = publicApis;
    }

    function updateActionStatistics() {
        const total = state.actions.length;
        const active = state.actions.filter(a => a.is_active).length;

        document.getElementById('totalActionCount').textContent = total;
        document.getElementById('activeActionCount').textContent = active;
    }

    /**
     * 顯示載入狀態
     */
    function showLoadingState(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = `
                <div class="loading-spinner">
                    <div class="spinner"></div>
                    <p>載入中...</p>
                </div>
            `;
        }
    }

    /**
     * 顯示空狀態
     */
    function showEmptyState(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>${message}</p>
                </div>
            `;
        }
    }

    /**
     * 新增 URL 權限
     */
    async function saveUrl(data) {
        try {
            const url = data.id ? `${ENDPOINTS.urls}/${data.id}` : ENDPOINTS.urls;
            const method = data.id ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) throw new Error('儲存失敗');

            if (window.Dialog) {
                Dialog.success('URL 權限儲存成功');
            }

            await loadUrls();
            closeUrlModal();

        } catch (error) {
            console.error('儲存 URL 權限失敗:', error);
            if (window.Dialog) {
                Dialog.error('儲存 URL 權限失敗');
            }
        }
    }

    /**
     * 刪除 URL 權限
     */
    async function deleteUrl(id) {
        if (!confirm('確定要刪除此 URL 權限設定嗎？')) return;

        try {
            const response = await fetch(`${ENDPOINTS.urls}/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) throw new Error('刪除失敗');

            if (window.Dialog) {
                Dialog.success('URL 權限已刪除');
            }

            await loadUrls();

        } catch (error) {
            console.error('刪除 URL 權限失敗:', error);
            if (window.Dialog) {
                Dialog.error('刪除 URL 權限失敗');
            }
        }
    }

    /**
     * 重新整理快取
     */
    async function refreshCache() {
        try {
            const response = await fetch(`${ENDPOINTS.cache}/refresh`, {
                method: 'POST',
                credentials: 'include'
            });

            if (!response.ok) throw new Error('重新整理失敗');

            if (window.Dialog) {
                Dialog.success('權限快取已重新整理');
            }

            await loadCacheInfo();

        } catch (error) {
            console.error('重新整理快取失敗:', error);
            if (window.Dialog) {
                Dialog.error('重新整理快取失敗');
            }
        }
    }

    /**
     * 清除快取
     */
    async function clearCache() {
        if (!confirm('確定要清除所有權限快取嗎？')) return;

        try {
            const response = await fetch(ENDPOINTS.cache, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) throw new Error('清除失敗');

            if (window.Dialog) {
                Dialog.success('權限快取已清除');
            }

            await loadCacheInfo();

        } catch (error) {
            console.error('清除快取失敗:', error);
            if (window.Dialog) {
                Dialog.error('清除快取失敗');
            }
        }
    }

    /**
     * 測試 URL 存取
     */
    async function testUrlAccess() {
        const url = document.getElementById('testUrlInput').value;
        const method = document.getElementById('testUrlMethod').value;

        if (!url) {
            if (window.Dialog) {
                Dialog.warning('請輸入要測試的 URL');
            }
            return;
        }

        try {
            const response = await fetch(`${ENDPOINTS.urls}/test`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url, method })
            });

            const result = await response.json();
            showTestResult('url', result);

        } catch (error) {
            console.error('測試失敗:', error);
            if (window.Dialog) {
                Dialog.error('測試失敗');
            }
        }
    }

    /**
     * 顯示測試結果
     */
    function showTestResult(type, result) {
        const resultDiv = document.getElementById(`test${type.charAt(0).toUpperCase() + type.slice(1)}Result`);
        if (!resultDiv) return;

        resultDiv.className = `test-result ${result.has_permission ? 'success' : 'error'}`;
        resultDiv.innerHTML = `
            <div class="test-result-header">
                ${result.has_permission ?
                '<i class="fas fa-check-circle"></i> 可以存取' :
                '<i class="fas fa-times-circle"></i> 無法存取'
            }
            </div>
            <div class="test-result-details">
                <div>原因：${result.reason}</div>
                ${result.required_permission ?
                `<div>需要權限：${result.required_permission}</div>` : ''
            }
            </div>
        `;
    }

    /**
     * 顯示 URL 模態框
     */
    function showUrlModal(id = null) {
        // 創建或取得模態框
        let modal = document.getElementById('urlModal');
        if (!modal) {
            modal = createUrlModal();
            document.body.appendChild(modal);
        }

        // 重置表單
        const form = modal.querySelector('#urlForm');
        if (form) form.reset();

        // 如果是編輯模式，載入資料
        if (id) {
            const url = state.urls.find(u => u.id === id);
            if (url) {
                form.querySelector('[name="id"]').value = url.id;
                form.querySelector('[name="url_pattern"]').value = url.url_pattern;
                form.querySelector('[name="method"]').value = url.method;
                form.querySelector('[name="permission_matrix_id"]').value = url.permission_matrix_id || '';
                form.querySelector('[name="module_key"]').value = url.module_key || '';
                form.querySelector('[name="description"]').value = url.description || '';
                form.querySelector('[name="priority"]').value = url.priority;
                form.querySelector('[name="is_public"]').checked = url.is_public;
                form.querySelector('[name="is_active"]').checked = url.is_active;
            }
            modal.querySelector('h3').textContent = '編輯 URL 權限';
        } else {
            modal.querySelector('h3').textContent = '新增 URL 權限';
        }

        // 載入權限選項
        loadPermissionOptions(modal.querySelector('[name="permission_matrix_id"]'));

        // 顯示模態框
        modal.classList.add('show');
    }

    /**
     * 創建 URL 模態框
     */
    function createUrlModal() {
        const modalHtml = `
        <div id="urlModal" class="modal">
            <div class="modal-content modal-lg">
                <div class="modal-header">
                    <h3>新增 URL 權限</h3>
                    <button class="modal-close" onclick="PermissionAccessModule.closeUrlModal()">
                        <i class="fa-solid fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="urlForm">
                        <input type="hidden" name="id">
                        <div class="form-row">
                            <div class="form-group col-8">
                                <label class="form-label">URL 模式 <span class="required">*</span></label>
                                <input type="text" class="form-control" name="url_pattern" required
                                       placeholder="例如: /admin/* 或 /api/users">
                            </div>
                            <div class="form-group col-4">
                                <label class="form-label">HTTP 方法</label>
                                <select class="form-control" name="method">
                                    <option value="GET">GET</option>
                                    <option value="POST">POST</option>
                                    <option value="PUT">PUT</option>
                                    <option value="DELETE">DELETE</option>
                                    <option value="PATCH">PATCH</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group col-6">
                                <label class="form-label">權限需求</label>
                                <select class="form-control" name="permission_matrix_id">
                                    <option value="">無需權限</option>
                                </select>
                            </div>
                            <div class="form-group col-6">
                                <label class="form-label">所屬模組</label>
                                <input type="text" class="form-control" name="module_key"
                                       placeholder="例如: system, user, permission">
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">說明</label>
                            <textarea class="form-control" name="description" rows="2"></textarea>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group col-4">
                                <label class="form-label">優先級</label>
                                <input type="number" class="form-control" name="priority" value="100" min="1">
                            </div>
                            <div class="form-group col-4">
                                <label class="form-label">
                                    <input type="checkbox" name="is_public"> 公開存取
                                </label>
                            </div>
                            <div class="form-group col-4">
                                <label class="form-label">
                                    <input type="checkbox" name="is_active" checked> 啟用
                                </label>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="PermissionAccessModule.closeUrlModal()">取消</button>
                    <button class="btn btn-primary" onclick="PermissionAccessModule.saveUrl()">儲存</button>
                </div>
            </div>
        </div>
    `;

        const div = document.createElement('div');
        div.innerHTML = modalHtml;
        return div.firstElementChild;
    }

    /**
     * 關閉 URL 模態框
     */
    function closeUrlModal() {
        const modal = document.getElementById('urlModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    /**
     * 儲存 URL 權限
     */
    async function saveUrlFromForm() {
        const form = document.getElementById('urlForm');
        if (!form) return;

        const formData = new FormData(form);
        const data = {
            id: formData.get('id') || undefined,
            url_pattern: formData.get('url_pattern'),
            method: formData.get('method'),
            permission_matrix_id: formData.get('permission_matrix_id') || null,
            module_key: formData.get('module_key') || null,
            description: formData.get('description') || null,
            priority: parseInt(formData.get('priority')) || 100,
            is_public: formData.get('is_public') === 'on',
            is_active: formData.get('is_active') === 'on'
        };

        await saveUrl(data);
    }

    // 類似地為 API 和 Action 創建對應的 Modal 函數
    function showApiModal(id = null) {
        // 與 showUrlModal 類似的實作
        let modal = document.getElementById('apiModal');
        if (!modal) {
            modal = createApiModal();
            document.body.appendChild(modal);
        }

        const form = modal.querySelector('#apiForm');
        if (form) form.reset();

        if (id) {
            const api = state.apis.find(a => a.id === id);
            if (api) {
                // 填充表單資料
                form.querySelector('[name="id"]').value = api.id;
                form.querySelector('[name="api_pattern"]').value = api.api_pattern;
                form.querySelector('[name="method"]').value = api.method;
                form.querySelector('[name="permission_matrix_id"]').value = api.permission_matrix_id || '';
                form.querySelector('[name="module_key"]').value = api.module_key || '';
                form.querySelector('[name="description"]').value = api.description || '';
                form.querySelector('[name="priority"]').value = api.priority;
                form.querySelector('[name="require_auth"]').checked = api.require_auth;
                form.querySelector('[name="is_active"]').checked = api.is_active;
            }
            modal.querySelector('h3').textContent = '編輯 API 權限';
        } else {
            modal.querySelector('h3').textContent = '新增 API 權限';
        }

        loadPermissionOptions(modal.querySelector('[name="permission_matrix_id"]'));
        modal.classList.add('show');
    }

    function createApiModal() {
        const modalHtml = `
        <div id="apiModal" class="modal">
            <div class="modal-content modal-lg">
                <div class="modal-header">
                    <h3>新增 API 權限</h3>
                    <button class="modal-close" onclick="PermissionAccessModule.closeApiModal()">
                        <i class="fa-solid fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="apiForm">
                        <input type="hidden" name="id">
                        <div class="form-row">
                            <div class="form-group col-8">
                                <label class="form-label">API 路徑模式 <span class="required">*</span></label>
                                <input type="text" class="form-control" name="api_pattern" required
                                       placeholder="例如: /api/users/* 或 /api/permissions/matrix">
                            </div>
                            <div class="form-group col-4">
                                <label class="form-label">HTTP 方法 <span class="required">*</span></label>
                                <select class="form-control" name="method" required>
                                    <option value="GET">GET</option>
                                    <option value="POST">POST</option>
                                    <option value="PUT">PUT</option>
                                    <option value="DELETE">DELETE</option>
                                    <option value="PATCH">PATCH</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group col-6">
                                <label class="form-label">權限需求</label>
                                <select class="form-control" name="permission_matrix_id">
                                    <option value="">無需權限</option>
                                </select>
                            </div>
                            <div class="form-group col-6">
                                <label class="form-label">所屬模組</label>
                                <input type="text" class="form-control" name="module_key"
                                       placeholder="例如: user, permission, system">
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">說明</label>
                            <textarea class="form-control" name="description" rows="2"></textarea>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group col-4">
                                <label class="form-label">優先級</label>
                                <input type="number" class="form-control" name="priority" value="100" min="1">
                            </div>
                            <div class="form-group col-4">
                                <label class="form-label">
                                    <input type="checkbox" name="require_auth" checked> 需要認證
                                </label>
                            </div>
                            <div class="form-group col-4">
                                <label class="form-label">
                                    <input type="checkbox" name="is_active" checked> 啟用
                                </label>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="PermissionAccessModule.closeApiModal()">取消</button>
                    <button class="btn btn-primary" onclick="PermissionAccessModule.saveApi()">儲存</button>
                </div>
            </div>
        </div>
    `;

        const div = document.createElement('div');
        div.innerHTML = modalHtml;
        return div.firstElementChild;
    }

    function closeApiModal() {
        const modal = document.getElementById('apiModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    async function saveApiFromForm() {
        const form = document.getElementById('apiForm');
        if (!form) return;

        const formData = new FormData(form);
        const data = {
            id: formData.get('id') || undefined,
            api_pattern: formData.get('api_pattern'),
            method: formData.get('method'),
            permission_matrix_id: formData.get('permission_matrix_id') || null,
            module_key: formData.get('module_key') || null,
            description: formData.get('description') || null,
            priority: parseInt(formData.get('priority')) || 100,
            require_auth: formData.get('require_auth') === 'on',
            is_active: formData.get('is_active') === 'on'
        };

        await saveApi(data);
    }

    async function saveApi(data) {
        try {
            const url = data.id ? `${ENDPOINTS.apis}/${data.id}` : ENDPOINTS.apis;
            const method = data.id ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) throw new Error('儲存失敗');

            if (window.Dialog) {
                Dialog.success('API 權限儲存成功');
            }

            await loadApis();
            closeApiModal();

        } catch (error) {
            console.error('儲存 API 權限失敗:', error);
            if (window.Dialog) {
                Dialog.error('儲存 API 權限失敗');
            }
        }
    }

    async function deleteApi(id) {
        if (!confirm('確定要刪除此 API 權限設定嗎？')) return;

        try {
            const response = await fetch(`${ENDPOINTS.apis}/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) throw new Error('刪除失敗');

            if (window.Dialog) {
                Dialog.success('API 權限已刪除');
            }

            await loadApis();

        } catch (error) {
            console.error('刪除 API 權限失敗:', error);
            if (window.Dialog) {
                Dialog.error('刪除 API 權限失敗');
            }
        }
    }

    // Action Modal 相關函數
    function showActionModal(id = null) {
        let modal = document.getElementById('actionModal');
        if (!modal) {
            modal = createActionModal();
            document.body.appendChild(modal);
        }

        const form = modal.querySelector('#actionForm');
        if (form) form.reset();

        if (id) {
            const action = state.actions.find(a => a.id === id);
            if (action) {
                form.querySelector('[name="id"]').value = action.id;
                form.querySelector('[name="module_key"]').value = action.module_key;
                form.querySelector('[name="action_key"]').value = action.action_key;
                form.querySelector('[name="permission_code"]').value = action.permission_code;
                form.querySelector('[name="name"]').value = action.name;
                form.querySelector('[name="description"]').value = action.description || '';
                form.querySelector('[name="dependencies"]').value =
                    action.dependencies ? JSON.stringify(action.dependencies) : '';
                form.querySelector('[name="is_active"]').checked = action.is_active;
            }
            modal.querySelector('h3').textContent = '編輯動作權限';
        } else {
            modal.querySelector('h3').textContent = '新增動作權限';
        }

        modal.classList.add('show');
    }

    function createActionModal() {
        const modalHtml = `
        <div id="actionModal" class="modal">
            <div class="modal-content modal-lg">
                <div class="modal-header">
                    <h3>新增動作權限</h3>
                    <button class="modal-close" onclick="PermissionAccessModule.closeActionModal()">
                        <i class="fa-solid fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="actionForm">
                        <input type="hidden" name="id">
                        <div class="form-row">
                            <div class="form-group col-6">
                                <label class="form-label">模組代碼 <span class="required">*</span></label>
                                <input type="text" class="form-control" name="module_key" required
                                       placeholder="例如: user, permission">
                            </div>
                            <div class="form-group col-6">
                                <label class="form-label">動作代碼 <span class="required">*</span></label>
                                <input type="text" class="form-control" name="action_key" required
                                       placeholder="例如: import, export">
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group col-6">
                                <label class="form-label">權限代碼 <span class="required">*</span></label>
                                <input type="text" class="form-control" name="permission_code" required
                                       placeholder="例如: user.import">
                            </div>
                            <div class="form-group col-6">
                                <label class="form-label">動作名稱 <span class="required">*</span></label>
                                <input type="text" class="form-control" name="name" required
                                       placeholder="例如: 批次匯入">
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">動作說明</label>
                            <textarea class="form-control" name="description" rows="2"></textarea>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">依賴權限 (JSON 格式)</label>
                            <textarea class="form-control" name="dependencies" rows="2"
                                      placeholder='["user.view", "user.create"]'></textarea>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">
                                <input type="checkbox" name="is_active" checked> 啟用
                            </label>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="PermissionAccessModule.closeActionModal()">取消</button>
                    <button class="btn btn-primary" onclick="PermissionAccessModule.saveAction()">儲存</button>
                </div>
            </div>
        </div>
    `;

        const div = document.createElement('div');
        div.innerHTML = modalHtml;
        return div.firstElementChild;
    }

    function closeActionModal() {
        const modal = document.getElementById('actionModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    async function saveActionFromForm() {
        const form = document.getElementById('actionForm');
        if (!form) return;

        const formData = new FormData(form);
        let dependencies = null;
        try {
            const depValue = formData.get('dependencies');
            if (depValue) {
                dependencies = JSON.parse(depValue);
            }
        } catch (e) {
            if (window.Dialog) {
                Dialog.error('依賴權限 JSON 格式錯誤');
            }
            return;
        }

        const data = {
            id: formData.get('id') || undefined,
            module_key: formData.get('module_key'),
            action_key: formData.get('action_key'),
            permission_code: formData.get('permission_code'),
            name: formData.get('name'),
            description: formData.get('description') || null,
            dependencies: dependencies,
            is_active: formData.get('is_active') === 'on'
        };

        await saveAction(data);
    }

    async function saveAction(data) {
        try {
            const url = data.id ? `${ENDPOINTS.actions}/${data.id}` : ENDPOINTS.actions;
            const method = data.id ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) throw new Error('儲存失敗');

            if (window.Dialog) {
                Dialog.success('動作權限儲存成功');
            }

            await loadActions();
            closeActionModal();

        } catch (error) {
            console.error('儲存動作權限失敗:', error);
            if (window.Dialog) {
                Dialog.error('儲存動作權限失敗');
            }
        }
    }

    async function deleteAction(id) {
        if (!confirm('確定要刪除此動作權限設定嗎？')) return;

        try {
            const response = await fetch(`${ENDPOINTS.actions}/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) throw new Error('刪除失敗');

            if (window.Dialog) {
                Dialog.success('動作權限已刪除');
            }

            await loadActions();

        } catch (error) {
            console.error('刪除動作權限失敗:', error);
            if (window.Dialog) {
                Dialog.error('刪除動作權限失敗');
            }
        }
    }

    /**
     * 載入權限選項
     */
    async function loadPermissionOptions(selectElement) {
        if (!selectElement) return;

        selectElement.innerHTML = '<option value="">無需權限</option>';

        state.permissions.forEach(perm => {
            const option = document.createElement('option');
            option.value = perm.id;
            option.textContent = `${perm.permission_key} - ${perm.module_name} ${perm.action_name}`;
            selectElement.appendChild(option);
        });
    }

    /**
     * 測試 API 存取
     */
    async function testApiAccess() {
        const api = document.getElementById('testApiInput').value;
        const method = document.getElementById('testApiMethod').value;

        if (!api) {
            if (window.Dialog) {
                Dialog.warning('請輸入要測試的 API 路徑');
            }
            return;
        }

        try {
            const response = await fetch(`${ENDPOINTS.apis}/test`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ api, method })
            });

            const result = await response.json();
            showTestResult('api', result);

        } catch (error) {
            console.error('測試失敗:', error);
            if (window.Dialog) {
                Dialog.error('測試失敗');
            }
        }
    }

    // 公開 API
    // 更新公開 API 以包含所有函數
    return {
        init: init,
        // URL 相關
        showUrlModal: showUrlModal,
        closeUrlModal: closeUrlModal,
        saveUrl: saveUrlFromForm,
        editUrl: (id) => showUrlModal(id),
        deleteUrl: deleteUrl,
        // API 相關
        showApiModal: showApiModal,
        closeApiModal: closeApiModal,
        saveApi: saveApiFromForm,
        editApi: (id) => showApiModal(id),
        deleteApi: deleteApi,
        // Action 相關
        showActionModal: showActionModal,
        closeActionModal: closeActionModal,
        saveAction: saveActionFromForm,
        editAction: (id) => showActionModal(id),
        deleteAction: deleteAction,
        // 測試
        testApiAccess: testApiAccess
    };
})();

// 確保模組可被全域存取
window.PermissionAccessModule = PermissionAccessModule;