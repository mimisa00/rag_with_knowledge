/**
 * 統一員工懸浮卡片模組
 * 支援部門、角色、權限群組的員工詳情懸浮顯示
 */
window.EmployeeHoverCard = (function() {
    'use strict';
    
    // 內部變數
    let employeeHoverBackdrop = null;
    let employeeHoverCard = null;
    let currentData = [];
    let filteredData = [];
    let currentConfig = null;
    let isInitialized = false;
    
    /**
     * 初始化模組
     */
    function init() {
        if (isInitialized) return;
        
        console.log('初始化員工懸浮卡片元件');
        
        // 創建懸浮卡片
        initEmployeeHoverCard();
        
        isInitialized = true;
    }
    
    /**
     * 初始化員工懸浮卡片
     */
    function initEmployeeHoverCard() {
        // 創建背景遮罩
        employeeHoverBackdrop = document.createElement('div');
        employeeHoverBackdrop.className = 'employee-hover-backdrop';
        
        // 創建懸浮卡片
        employeeHoverCard = document.createElement('div');
        employeeHoverCard.className = 'employee-hover-card';
        
        // 建立卡片內容結構
        employeeHoverCard.innerHTML = `
            <div class="employee-hover-card-header">
                <h3 class="employee-hover-card-title">
                    <i class="fas fa-users"></i>
                    <span class="card-title-text"></span>
                </h3>
                <p class="employee-hover-card-subtitle">共 <span class="employee-count">0</span> <span class="employee-unit">位員工</span></p>
                <button class="employee-hover-card-close" type="button">
                    <i class="fas fa-times"></i>
                </button>
                <div class="employee-hover-search">
                    <input type="text" class="employee-hover-search-input" placeholder="搜尋員工姓名、帳號或 Email...">
                </div>
            </div>
            <div class="employee-hover-list scrollable-fade">
                <div class="employee-hover-loading">
                    <div class="employee-hover-loading-spinner"></div>
                    <p class="employee-hover-loading-text">載入資料中...</p>
                </div>
            </div>
        `;
        
        employeeHoverBackdrop.appendChild(employeeHoverCard);
        document.body.appendChild(employeeHoverBackdrop);
        
        // 綁定事件
        bindEmployeeHoverEvents();
    }
    
    /**
     * 綁定員工懸浮卡片事件
     */
    function bindEmployeeHoverEvents() {
        // 關閉按鈕事件
        const closeBtn = employeeHoverCard.querySelector('.employee-hover-card-close');
        closeBtn.addEventListener('click', hide);
        
        // 背景點擊關閉
        employeeHoverBackdrop.addEventListener('click', (e) => {
            if (e.target === employeeHoverBackdrop) {
                hide();
            }
        });
        
        // ESC 鍵關閉
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && employeeHoverBackdrop.classList.contains('show')) {
                hide();
            }
        });
        
        // 搜尋輸入事件
        const searchInput = employeeHoverCard.querySelector('.employee-hover-search-input');
        searchInput.addEventListener('input', debounce((e) => {
            filterData(e.target.value);
        }, 300));
    }
    
    /**
     * 顯示員工懸浮卡片
     */
    async function show(config) {
        const defaultConfig = {
            type: 'custom',
            id: null,
            title: '員工資訊',
            subtitle: '位員工',
            apiUrl: null,
            placeholder: '搜尋員工姓名、帳號或 Email...',
            emptyText: '暫無員工資料',
            emptySubtext: '',
            loadingText: '載入資料中...',
            dataTransform: null
        };
        
        currentConfig = { ...defaultConfig, ...config };
        
        // 根據類型設定預設配置
        if (config.type === 'department' && !config.apiUrl) {
            currentConfig.apiUrl = '/api/organization/departments/{id}/employees';
            currentConfig.title = config.title || '部門員工';
            currentConfig.emptyText = '此部門目前沒有員工';
            currentConfig.emptySubtext = '可透過員工管理新增員工至此部門';
        } else if (config.type === 'role' && !config.apiUrl) {
            currentConfig.apiUrl = '/api/organization/department-roles/{id}/users';
            currentConfig.title = config.title || '角色用戶';
            currentConfig.subtitle = '位用戶';
            currentConfig.emptyText = '此角色目前沒有用戶';
            currentConfig.emptySubtext = '可透過用戶管理指派用戶到此角色';
        } else if (config.type === 'permission' && !config.apiUrl) {
            currentConfig.apiUrl = '/api/permissions/groups/{id}/users';
            currentConfig.title = config.title || '權限群組用戶';
            currentConfig.subtitle = '位使用者';
            currentConfig.emptyText = '此權限群組目前沒有使用者';
            currentConfig.emptySubtext = '可透過權限管理指派使用者到此群組';
        }
        
        // 更新 UI 文字
        updateUI(currentConfig);
        
        // 顯示背景遮罩
        employeeHoverBackdrop.classList.add('show');
        
        // 聚焦搜尋框
        setTimeout(() => {
            const searchInput = employeeHoverCard.querySelector('.employee-hover-search-input');
            searchInput.focus();
        }, 300);
        
        // 載入資料
        if (currentConfig.apiUrl && currentConfig.id) {
            await loadData(currentConfig);
        }
    }
    
    /**
     * 更新 UI 文字
     */
    function updateUI(config) {
        const titleEl = employeeHoverCard.querySelector('.card-title-text');
        const unitEl = employeeHoverCard.querySelector('.employee-unit');
        const searchInput = employeeHoverCard.querySelector('.employee-hover-search-input');
        const loadingText = employeeHoverCard.querySelector('.employee-hover-loading-text');
        
        if (titleEl) titleEl.textContent = config.title;
        if (unitEl) unitEl.textContent = config.subtitle;
        if (searchInput) searchInput.placeholder = config.placeholder;
        if (loadingText) loadingText.textContent = config.loadingText;
    }
    
    /**
     * 隱藏員工懸浮卡片
     */
    function hide() {
        employeeHoverBackdrop.classList.remove('show');
        
        // 清理資料
        currentData = [];
        filteredData = [];
        currentConfig = null;
        
        // 重置搜尋框
        const searchInput = employeeHoverCard.querySelector('.employee-hover-search-input');
        if (searchInput) {
            searchInput.value = '';
        }
    }
    
    /**
     * 載入資料
     */
    async function loadData(config) {
        try {
            showLoading();
            
            const url = config.apiUrl.replace('{id}', config.id);
            const response = await fetch(url, {
                method: 'GET',
                credentials: 'include'  // 自動包含 cookie 中的認證資訊
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            let data = await response.json();
            
            // 支援自訂資料轉換
            if (config.dataTransform) {
                data = config.dataTransform(data);
            }
            
            // 根據不同的回應格式提取資料
            currentData = extractDataFromResponse(data);
            filteredData = currentData;
            
            console.log(`載入 ${config.type} ${config.id} 的資料:`, currentData);
            
            // 渲染列表
            renderList(filteredData);
            
        } catch (error) {
            console.error('載入資料失敗:', error);
            showError(error.message);
        }
    }
    
    /**
     * 從回應中提取資料
     */
    function extractDataFromResponse(data) {
        // 如果是陣列，直接返回
        if (Array.isArray(data)) {
            return data;
        }
        
        // 常見的資料結構
        if (data.data && Array.isArray(data.data)) {
            return data.data;
        }
        
        if (data.users && Array.isArray(data.users)) {
            return data.users;
        }
        
        if (data.employees && Array.isArray(data.employees)) {
            return data.employees;
        }
        
        if (data.items && Array.isArray(data.items)) {
            return data.items;
        }
        
        // 如果都不是，返回空陣列
        console.warn('無法從回應中提取資料:', data);
        return [];
    }
    
    /**
     * 顯示載入中
     */
    function showLoading() {
        const listEl = employeeHoverCard.querySelector('.employee-hover-list');
        listEl.innerHTML = `
            <div class="employee-hover-loading">
                <div class="employee-hover-loading-spinner"></div>
                <p class="employee-hover-loading-text">${currentConfig ? currentConfig.loadingText : '載入資料中...'}</p>
            </div>
        `;
    }
    
    /**
     * 顯示錯誤訊息
     */
    function showError(message) {
        const listEl = employeeHoverCard.querySelector('.employee-hover-list');
        listEl.innerHTML = `
            <div class="employee-hover-error">
                <i class="fas fa-exclamation-triangle"></i>
                <p>載入資料失敗</p>
                <small>${message}</small>
            </div>
        `;
    }
    
    /**
     * 渲染列表
     */
    function renderList(data) {
        const listEl = employeeHoverCard.querySelector('.employee-hover-list');
        const countEl = employeeHoverCard.querySelector('.employee-count');
        
        // 更新計數
        countEl.textContent = data.length;
        
        if (!data || data.length === 0) {
            listEl.innerHTML = `
                <div class="employee-hover-empty">
                    <i class="employee-hover-empty-icon fas fa-users"></i>
                    <p class="employee-hover-empty-text">${currentConfig.emptyText}</p>
                    <p class="employee-hover-empty-subtext">${currentConfig.emptySubtext}</p>
                </div>
            `;
            return;
        }
        
        // 渲染列表
        const itemsHtml = data.map(item => {
            const displayName = item.username || item.name || '未命名';
            const loginid = item.loginid || '';
            const email = item.email || '';
            const title = item.user_extension?.title || item.title || '';
            
            // 提取角色資訊
            let roleList = [];
            if (item.department_roles && Array.isArray(item.department_roles)) {
                roleList = item.department_roles.map(r => ({
                    name: r.role_name,
                    type: r.role_type,
                    level: r.role_level || 0,
                    isPrimary: r.is_primary
                }));
            }
            
            // 提取權限資訊 - 處理直接權限和角色權限
            let permissionList = [];
            
            // 優先使用合併後的權限資料
            if (item.all_permissions && item.all_permissions.combined && Array.isArray(item.all_permissions.combined)) {
                permissionList = item.all_permissions.combined.map(p => ({
                    name: typeof p === 'object' ? p.name : p,
                    type: typeof p === 'object' ? p.permission_type : 'default',
                    level: typeof p === 'object' ? (p.level || 0) : 0,
                    source: typeof p === 'object' ? p.source : 'unknown'
                }));
            } else {
                // 手動合併直接權限和角色權限並檢測重疊
                const directPermissions = [];
                const rolePermissions = [];
                
                // 處理直接權限
                if (item.permission_groups && Array.isArray(item.permission_groups)) {
                    directPermissions.push(...item.permission_groups.map(p => ({
                        name: typeof p === 'object' ? p.name : p,
                        type: typeof p === 'object' ? p.permission_type : 'default',
                        level: typeof p === 'object' ? (p.level || 0) : 0,
                        source: 'direct'
                    })));
                }
                
                // 處理角色權限
                if (item.role_permission_groups && Array.isArray(item.role_permission_groups)) {
                    rolePermissions.push(...item.role_permission_groups.map(p => ({
                        name: typeof p === 'object' ? p.name : p,
                        type: typeof p === 'object' ? p.permission_type : 'default',
                        level: typeof p === 'object' ? (p.level || 0) : 0,
                        source: 'role'
                    })));
                }
                
                // 建立權限映射並檢測重疊
                const permissionMap = new Map();
                
                // 先加入直接權限
                directPermissions.forEach(p => {
                    permissionMap.set(p.name, p);
                });
                
                // 處理角色權限
                rolePermissions.forEach(p => {
                    if (permissionMap.has(p.name)) {
                        // 發現重疊，標記為 both
                        const existing = permissionMap.get(p.name);
                        permissionMap.set(p.name, {
                            ...existing,
                            source: 'both'
                        });
                    } else {
                        // 沒有重疊，純角色權限
                        permissionMap.set(p.name, p);
                    }
                });
                
                permissionList = Array.from(permissionMap.values());
                
                // 備用方案：舊格式相容性
                if (permissionList.length === 0 && item.permission_group_names && Array.isArray(item.permission_group_names)) {
                    permissionList = item.permission_group_names.map(name => ({
                        name: name,
                        type: 'default',
                        level: 0,
                        source: 'legacy'
                    }));
                }
            }
            
            // 生成 badges HTML
            const badgesHtml = generateBadges(roleList, permissionList);
            
            // 使用姓名首字作為頭像
            const avatar = displayName.charAt(0).toUpperCase();
            
            return `
                <div class="employee-hover-item">
                    <div class="employee-hover-item-icon">${avatar}</div>
                    <div class="employee-hover-item-info">
                        <h4 class="employee-hover-item-name">${displayName}</h4>
                        ${badgesHtml}
                        <p class="employee-hover-item-details">
                            ${loginid ? `<i class="fas fa-user-circle"></i>帳號：${loginid}` : ''}
                            ${loginid && email ? '<br>' : ''}
                            ${email ? `<i class="fas fa-envelope"></i>Email：${email}` : ''}
                            ${title ? `<br><i class="fas fa-briefcase"></i>職稱：${title}` : ''}
                        </p>
                    </div>
                </div>
            `;
        }).join('');
        
        listEl.innerHTML = itemsHtml;
        
        // 綁定 badge 展開事件
        bindBadgeEvents();
    }
    
    /**
     * 過濾資料
     */
    function filterData(searchTerm) {
        if (!searchTerm.trim()) {
            filteredData = currentData;
        } else {
            const term = searchTerm.toLowerCase();
            filteredData = currentData.filter(item => {
                return (item.username && item.username.toLowerCase().includes(term)) ||
                       (item.loginid && item.loginid.toLowerCase().includes(term)) ||
                       (item.email && item.email.toLowerCase().includes(term)) ||
                       (item.user_extension?.title && item.user_extension.title.toLowerCase().includes(term)) ||
                       (item.user_extension?.employee_no && item.user_extension.employee_no.toLowerCase().includes(term));
            });
        }
        
        // 重新渲染列表
        renderList(filteredData);
    }
    
    /**
     * 生成 badges HTML
     */
    function generateBadges(roleList, permissionList) {
        if (roleList.length === 0 && permissionList.length === 0) {
            return '';
        }

        // 角色處理：主要角色優先，然後按管理角色和層級排序
        const sortedRoles = roleList.sort((a, b) => {
            if (a.isPrimary && !b.isPrimary) return -1;
            if (!a.isPrimary && b.isPrimary) return 1;
            if (a.type === 'manager' && b.type !== 'manager') return -1;
            if (a.type !== 'manager' && b.type === 'manager') return 1;
            return (b.level || 0) - (a.level || 0);
        });

        // 權限處理：按等級排序
        const sortedPermissions = permissionList.sort((a, b) => {
            return (b.level || 0) - (a.level || 0);
        });

        // 生成角色 badge HTML
        const generateRoleBadge = (role) => {
            const badgeClass = role.type === 'manager' ? 'role-manager' : 'role-staff';
            const icon = role.type === 'manager' ? 'user-tie' : 'user';
            const primaryClass = role.isPrimary ? 'primary-role' : '';
            const primaryIcon = role.isPrimary ? '<i class="fas fa-star" style="font-size: 8px; margin-left: 2px;"></i>' : '';
            return `<span class="employee-role-badge ${badgeClass} ${primaryClass}" title="${role.name}${role.isPrimary ? ' (主要角色)' : ''}">
                <i class="fas fa-${icon}"></i>${role.name}${primaryIcon}
            </span>`;
        };

        // 生成權限 badge HTML
        const generatePermissionBadge = (permission) => {
            const badgeClass = `permission-${permission.type}`;
            let icon = 'shield-alt';
            if (permission.type === 'admin') icon = 'user-shield';
            else if (permission.type === 'manager') icon = 'user-tie';
            else if (permission.type === 'user') icon = 'user';
            
            // 判斷權限來源並加入對應的 class
            let sourceClass = '';
            let sourceText = '';
            if (permission.source === 'role') {
                sourceClass = 'from-role';
                sourceText = ' (來自部門角色)';
            } else if (permission.source === 'direct') {
                sourceClass = 'from-direct';
                sourceText = ' (個人指派)';
            } else if (permission.source === 'both') {
                sourceClass = 'from-both';
                sourceText = ' (部門角色 + 個人指派)';
            }
            
            return `<span class="employee-permission-badge ${badgeClass} ${sourceClass}" title="${permission.name}${sourceText}">
                <i class="fas fa-${icon}"></i>${permission.name}
            </span>`;
        };

        let html = '<div class="employee-badges-container">';

        // 左側：角色 badges
        if (sortedRoles.length > 0) {
            html += '<div class="employee-roles-section">';
            
            if (sortedRoles.length === 1) {
                html += generateRoleBadge(sortedRoles[0]);
            } else {
                html += `<div class="employee-badge-expandable" data-type="roles">`;
                html += generateRoleBadge(sortedRoles[0]);
                html += `<span class="employee-badge-more">+${sortedRoles.length - 1}</span>`;
                
                html += '<div class="employee-badge-expanded">';
                sortedRoles.slice(1).forEach(role => {
                    html += generateRoleBadge(role);
                });
                html += '</div></div>';
            }
            
            html += '</div>';
        }

        // 右側：權限 badges
        if (sortedPermissions.length > 0) {
            html += '<div class="employee-permissions-section">';
            
            if (sortedPermissions.length === 1) {
                html += generatePermissionBadge(sortedPermissions[0]);
            } else {
                html += `<div class="employee-badge-expandable" data-type="permissions">`;
                html += generatePermissionBadge(sortedPermissions[0]);
                html += `<span class="employee-badge-more">+${sortedPermissions.length - 1}</span>`;
                
                html += '<div class="employee-badge-expanded">';
                sortedPermissions.slice(1).forEach(permission => {
                    html += generatePermissionBadge(permission);
                });
                html += '</div></div>';
            }
            
            html += '</div>';
        }

        html += '</div>';
        return html;
    }
    
    /**
     * 綁定 badge 展開事件
     */
    function bindBadgeEvents() {
        document.querySelectorAll('.employee-badge-expandable').forEach(container => {
            let hoverTimeout;
            
            // 滑鼠進入時展開
            container.addEventListener('mouseenter', function() {
                clearTimeout(hoverTimeout);
                const expanded = this.querySelector('.employee-badge-expanded');
                if (expanded) {
                    expanded.classList.add('show');
                }
                this.classList.add('expanded');
            });
            
            // 滑鼠離開時收合
            container.addEventListener('mouseleave', function() {
                const expanded = this.querySelector('.employee-badge-expanded');
                hoverTimeout = setTimeout(() => {
                    if (expanded) {
                        expanded.classList.remove('show');
                    }
                    this.classList.remove('expanded');
                }, 200);
            });
        });
    }
    
    /**
     * 防抖動輔助函數
     */
    function debounce(func, delay) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }
    
    // 公開 API
    const publicAPI = {
        init,
        show,
        hide,
        generateBadges,
        bindBadgeEvents
    };
    
   
    // 將相容性介面合併到公開 API
    return { ...publicAPI, };
})();


// 確保模組可被存取
if (typeof EmployeeHoverCard === 'undefined') {
    var EmployeeHoverCard = window.EmployeeHoverCard;
}