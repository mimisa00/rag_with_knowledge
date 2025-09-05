/**
 * 組織角色用戶懸浮卡片模組
 * 處理角色用戶的懸浮顯示功能
 */
const __OrganizationRolesHoverCardModule = (function() {
    'use strict';
    
    // API 端點
    const API_BASE = '/api/organization';
    
    // 懸浮卡片相關變數
    let roleUsersHoverBackdrop = null;
    let roleUsersHoverCard = null;
    let currentRoleUsers = [];
    let filteredRoleUsers = [];
    
    /**
     * 初始化角色用戶懸浮卡片
     */
    function init() {
        // 創建背景遮罩
        roleUsersHoverBackdrop = document.createElement('div');
        roleUsersHoverBackdrop.className = 'employee-hover-backdrop';
        
        // 創建懸浮卡片
        roleUsersHoverCard = document.createElement('div');
        roleUsersHoverCard.className = 'employee-hover-card';
        
        // 建立卡片內容結構（與部門管理一致）
        roleUsersHoverCard.innerHTML = `
            <div class="employee-hover-card-header">
                <h3 class="employee-hover-card-title">
                    <i class="fas fa-user-cog"></i>
                    <span class="role-name"></span>
                </h3>
                <p class="employee-hover-card-subtitle">共 <span class="users-count">0</span> 位使用者</p>
                <button class="employee-hover-card-close" type="button">
                    <i class="fas fa-times"></i>
                </button>
                <div class="employee-hover-search">
                    <input type="text" class="employee-hover-search-input" placeholder="搜尋用戶姓名、帳號或 Email...">
                </div>
            </div>
            <div class="employee-hover-list scrollable-fade">
                <div class="employee-hover-loading">
                    <div class="employee-hover-loading-spinner"></div>
                    <p class="employee-hover-loading-text">載入用戶資料中...</p>
                </div>
            </div>
        `;
        
        // 組裝結構
        roleUsersHoverBackdrop.appendChild(roleUsersHoverCard);
        document.body.appendChild(roleUsersHoverBackdrop);
        
        // 綁定事件
        bindEvents();
    }
    
    /**
     * 綁定角色用戶懸浮卡片事件
     */
    function bindEvents() {
        // 關閉按鈕事件
        const closeBtn = roleUsersHoverCard.querySelector('.employee-hover-card-close');
        closeBtn.addEventListener('click', hide);
        
        // 背景點擊關閉
        roleUsersHoverBackdrop.addEventListener('click', (e) => {
            if (e.target === roleUsersHoverBackdrop) {
                hide();
            }
        });
        
        // ESC 鍵關閉
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && roleUsersHoverBackdrop.classList.contains('show')) {
                hide();
            }
        });
        
        // 搜尋輸入事件
        const searchInput = roleUsersHoverCard.querySelector('.employee-hover-search-input');
        searchInput.addEventListener('input', debounce((e) => {
            filterUsers(e.target.value);
        }, 300));
    }
    
    /**
     * 顯示角色用戶懸浮卡片
     * @param {number} roleId - 角色ID
     * @param {Object} departmentRolesCache - 部門角色快取
     */
    async function show(roleId, departmentRolesCache) {
        const role = await getRoleById(roleId, departmentRolesCache);
        if (!role) return;
        
        // 更新卡片標題
        const roleNameEl = roleUsersHoverCard.querySelector('.role-name');
        const usersCountEl = roleUsersHoverCard.querySelector('.users-count');
        roleNameEl.textContent = role.name;
        usersCountEl.textContent = role.user_count || 0;
        
        // 清空搜尋框
        const searchInput = roleUsersHoverCard.querySelector('.employee-hover-search-input');
        searchInput.value = '';
        
        // 顯示背景遮罩
        roleUsersHoverBackdrop.classList.add('show');
        
        // 延遲聚焦搜尋框，確保動畫完成
        setTimeout(() => {
            searchInput.focus();
        }, 300);
        
        // 載入角色用戶資料
        await loadRoleUsers(roleId);
    }
    
    /**
     * 隱藏角色用戶懸浮卡片
     */
    function hide() {
        roleUsersHoverBackdrop.classList.remove('show');
        
        // 清理資料
        currentRoleUsers = [];
        filteredRoleUsers = [];
        
        // 重置搜尋框
        const searchInput = roleUsersHoverCard.querySelector('.employee-hover-search-input');
        if (searchInput) {
            searchInput.value = '';
        }
    }
    
    /**
     * 載入角色用戶資料
     */
    async function loadRoleUsers(roleId) {
        // 顯示載入動畫（使用預設的載入結構）
        const listContainer = roleUsersHoverCard.querySelector('.employee-hover-list');
        const loadingContainer = listContainer.querySelector('.employee-hover-loading');
        if (loadingContainer) {
            loadingContainer.style.display = 'block';
        }
        
        try {
            const response = await fetch(`${API_BASE}/department-roles/${roleId}/users`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('載入用戶資料失敗');
            }
            
            const users = await response.json();
            currentRoleUsers = users || [];
            filteredRoleUsers = [...currentRoleUsers];
            
            renderUsersList();
            
        } catch (error) {
            console.error('載入角色用戶資料失敗:', error);
            listContainer.innerHTML = `
                <div class="employee-hover-error">
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle fa-2x text-danger"></i>
                        <p class="text-danger">載入失敗，請稍後再試</p>
                    </div>
                </div>
            `;
        }
    }
    
    /**
     * 渲染角色用戶列表
     */
    function renderUsersList() {
        const listContainer = roleUsersHoverCard.querySelector('.employee-hover-list');
        
        if (filteredRoleUsers.length === 0) {
            listContainer.innerHTML = `
                <div class="employee-hover-empty">
                    <div class="empty-state">
                        <i class="fas fa-users fa-2x text-muted"></i>
                        <p class="text-muted">此角色目前沒有用戶使用</p>
                    </div>
                </div>
            `;
            return;
        }
        
        // 使用與部門管理一致的HTML結構和CSS類別
        const userHtml = filteredRoleUsers.map(user => {
            // 使用姓名首字作為頭像
            const displayName = user.username || user.loginid || '未知';
            const avatar = displayName.charAt(0).toUpperCase();
            
            return `
                <div class="employee-hover-item">
                    <div class="employee-hover-item-icon">${avatar}</div>
                    <div class="employee-hover-item-info">
                        <h4 class="employee-hover-item-name">${displayName}</h4>
                        <p class="employee-hover-item-details">
                            ${user.loginid ? `<i class="fas fa-user-circle"></i>帳號：${user.loginid}` : ''}
                            ${user.loginid && user.email ? '<br>' : ''}
                            ${user.email ? `<i class="fas fa-envelope"></i>Email：${user.email}` : ''}
                            ${user.department_name ? `<br><i class="fas fa-building"></i>部門：${user.department_name}` : ''}
                            ${user.title ? `<br><i class="fas fa-briefcase"></i>職稱：${user.title}` : ''}
                        </p>
                    </div>
                </div>
            `;
        }).join('');
        
        listContainer.innerHTML = userHtml;
    }
    
    /**
     * 過濾角色用戶
     */
    function filterUsers(keyword) {
        if (!keyword.trim()) {
            filteredRoleUsers = [...currentRoleUsers];
        } else {
            const searchTerm = keyword.toLowerCase();
            filteredRoleUsers = currentRoleUsers.filter(user => 
                user.username.toLowerCase().includes(searchTerm) ||
                user.loginid.toLowerCase().includes(searchTerm) ||
                (user.email && user.email.toLowerCase().includes(searchTerm)) ||
                (user.department_name && user.department_name.toLowerCase().includes(searchTerm))
            );
        }
        renderUsersList();
    }
    
    /**
     * 根據角色ID獲取角色資料
     * @param {number} roleId - 角色ID
     * @param {Object} departmentRolesCache - 部門角色快取
     */
    async function getRoleById(roleId, departmentRolesCache) {
        // 先從快取中查找
        if (departmentRolesCache) {
            for (const deptRoles of Object.values(departmentRolesCache)) {
                if (Array.isArray(deptRoles)) {
                    const role = deptRoles.find(r => r.id == roleId);
                    if (role) return role;
                }
            }
        }
        
        // 如果快取中找不到，發送API請求
        try {
            const response = await fetch(`${API_BASE}/department-roles/${roleId}`, {
                credentials: 'include'
            });
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('獲取角色資料失敗:', error);
        }
        
        return null;
    }
    
    /**
     * 防抖動函數
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    // 公開 API
    return {
        init,
        show,
        hide
    };
})();

// 註冊到全域
window.__OrganizationRolesHoverCardModule = __OrganizationRolesHoverCardModule;