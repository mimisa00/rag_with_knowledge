/**
 * 組織管理 - 員工懸浮卡片子模組
 * 負責處理部門員工懸浮顯示功能
 */
window.OrganizationEmployeeHoverCardModule = (function() {
    'use strict';
    
    // 內部變數
    let employeeHoverBackdrop = null;
    let employeeHoverCard = null;
    let currentDeptEmployees = [];
    let filteredEmployees = [];
    let CRUD = null;  // 將通過初始化時傳入
    
    /**
     * 初始化模組
     * @param {Object} crudModule - CRUD 模組實例
     */
    function init(crudModule) {
        // 接收 CRUD 模組引用
        CRUD = crudModule || window.OrganizationEmployeeCrudModule;
        
        if (!CRUD) {
            console.error('OrganizationEmployeeHoverCardModule: CRUD 模組未找到');
            return;
        }
        
        // 初始化懸浮卡片
        initEmployeeHoverCard();
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
                    <span class="dept-name"></span>
                </h3>
                <p class="employee-hover-card-subtitle">共 <span class="employee-count">0</span> 位員工</p>
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
                    <p class="employee-hover-loading-text">載入員工資料中...</p>
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
        closeBtn.addEventListener('click', hideEmployeeHoverCard);
        
        // 背景點擊關閉
        employeeHoverBackdrop.addEventListener('click', (e) => {
            if (e.target === employeeHoverBackdrop) {
                hideEmployeeHoverCard();
            }
        });
        
        // ESC 鍵關閉
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && employeeHoverBackdrop.classList.contains('show')) {
                hideEmployeeHoverCard();
            }
        });
        
        // 搜尋輸入事件
        const searchInput = employeeHoverCard.querySelector('.employee-hover-search-input');
        searchInput.addEventListener('input', debounce((e) => {
            filterEmployees(e.target.value);
        }, 300));
    }
    
    /**
     * 顯示員工懸浮卡片
     */
    async function showEmployeeHoverCard(deptId) {
        // 從部門模組取得部門資料
        if (!window.OrganizationDepartmentModule) return;
        
        const departments = window.OrganizationDepartmentModule.getDepartments();
        const dept = departments.find(d => d.id == deptId);
        if (!dept) return;
        
        // 更新卡片標題
        const deptNameEl = employeeHoverCard.querySelector('.dept-name');
        const employeeCountEl = employeeHoverCard.querySelector('.employee-count');
        deptNameEl.textContent = dept.name;
        employeeCountEl.textContent = dept.user_count || 0;
        
        // 清空搜尋框
        const searchInput = employeeHoverCard.querySelector('.employee-hover-search-input');
        searchInput.value = '';
        
        // 顯示背景遮罩
        employeeHoverBackdrop.classList.add('show');
        
        // 聚焦搜尋框
        setTimeout(() => {
            searchInput.focus();
        }, 300);
        
        // 載入員工資料
        await loadDepartmentEmployees(deptId);
    }
    
    /**
     * 隱藏員工懸浮卡片
     */
    function hideEmployeeHoverCard() {
        employeeHoverBackdrop.classList.remove('show');
        
        // 清理資料
        currentDeptEmployees = [];
        filteredEmployees = [];
        
        // 重置搜尋框
        const searchInput = employeeHoverCard.querySelector('.employee-hover-search-input');
        if (searchInput) {
            searchInput.value = '';
        }
    }
    
    /**
     * 載入部門員工資料
     */
    async function loadDepartmentEmployees(deptId) {
        try {
            currentDeptEmployees = await CRUD.loadDepartmentEmployees(deptId);
            filteredEmployees = currentDeptEmployees;
            
            console.log(`載入部門 ${deptId} 的員工:`, currentDeptEmployees);
            
            // 渲染員工列表
            renderEmployeeList(filteredEmployees);
            
        } catch (error) {
            console.error('載入部門員工失敗:', error);
            
            // 顯示錯誤訊息
            const listEl = employeeHoverCard.querySelector('.employee-hover-list');
            listEl.innerHTML = `
                <div class="employee-hover-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>載入員工資料失敗</p>
                    <small>${error.message}</small>
                </div>
            `;
        }
    }
    
    /**
     * 渲染員工列表
     */
    function renderEmployeeList(employees) {
        const listEl = employeeHoverCard.querySelector('.employee-hover-list');
        
        if (!employees || employees.length === 0) {
            listEl.innerHTML = `
                <div class="employee-hover-empty">
                    <i class="employee-hover-empty-icon fas fa-users"></i>
                    <p class="employee-hover-empty-text">此部門暫無員工</p>
                    <p class="employee-hover-empty-subtext">可透過員工管理新增員工至此部門</p>
                </div>
            `;
            return;
        }
        
        // 渲染員工列表
        const employeeHtml = employees.map(employee => {
            const displayName = employee.username || employee.name || '未命名';
            const loginid = employee.loginid || '';
            const email = employee.email || '';
            const title = employee.user_extension?.title || employee.title || '';
            
            // 提取部門角色資訊
            let roleList = [];
            if (employee.department_roles && Array.isArray(employee.department_roles)) {
                roleList = employee.department_roles.map(r => ({
                    name: r.name,
                    type: r.role_type,
                    level: r.level || 0,
                    isPrimary: r.is_primary
                }));
            }
            
            // 提取權限群組資訊
            let permissionList = [];
            if (employee.permission_groups && Array.isArray(employee.permission_groups)) {
                permissionList = employee.permission_groups.map(p => ({
                    name: typeof p === 'object' ? p.name : p,
                    type: typeof p === 'object' ? p.permission_type : 'default',
                    level: typeof p === 'object' ? (p.level || 0) : 0
                }));
            } else if (employee.permission_group_names && Array.isArray(employee.permission_group_names)) {
                permissionList = employee.permission_group_names.map(name => ({
                    name: name,
                    type: 'default',
                    level: 0
                }));
            }
            
            // 除錯記錄：檢查角色和權限提取結果
            if (displayName.includes('測試') || employees.indexOf(employee) === 0) {
                console.log(`員工 ${displayName} 角色資料:`, roleList);
                console.log(`員工 ${displayName} 權限資料:`, permissionList);
            }
            
            // 生成角色和權限的智能顯示HTML
            const badgesHtml = generateEmployeeBadges(roleList, permissionList);
            
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
        
        listEl.innerHTML = employeeHtml;
        
        // 綁定角色和權限 badge 的懸停展開事件
        bindEmployeeBadgeEvents();
    }
    
    /**
     * 過濾員工列表
     */
    function filterEmployees(searchTerm) {
        if (!searchTerm.trim()) {
            filteredEmployees = currentDeptEmployees;
        } else {
            const term = searchTerm.toLowerCase();
            filteredEmployees = currentDeptEmployees.filter(emp => {
                return (emp.username && emp.username.toLowerCase().includes(term)) ||
                       (emp.loginid && emp.loginid.toLowerCase().includes(term)) ||
                       (emp.email && emp.email.toLowerCase().includes(term)) ||
                       (emp.user_extension?.title && emp.user_extension.title.toLowerCase().includes(term)) ||
                       (emp.user_extension?.employee_no && emp.user_extension.employee_no.toLowerCase().includes(term));
            });
        }
        
        // 重新渲染列表
        renderEmployeeList(filteredEmployees);
    }
    
    /**
     * 生成員工角色和權限 badges
     */
    function generateEmployeeBadges(roleList, permissionList) {
        if (roleList.length === 0 && permissionList.length === 0) {
            return '';
        }

        // 角色處理：主要角色優先，然後按管理角色和層級排序
        const sortedRoles = roleList.sort((a, b) => {
            // 主要角色最優先
            if (a.isPrimary && !b.isPrimary) return -1;
            if (!a.isPrimary && b.isPrimary) return 1;
            
            // 管理角色優先於一般角色
            if (a.type === 'manager' && b.type !== 'manager') return -1;
            if (a.type !== 'manager' && b.type === 'manager') return 1;
            
            // 最後按層級排序（層級越高越優先）
            return (b.level || 0) - (a.level || 0);
        });

        // 權限處理：按等級排序
        const sortedPermissions = permissionList.sort((a, b) => {
            return (b.level || 0) - (a.level || 0);
        });

        // 取得最高等級的角色和權限
        const primaryRole = sortedRoles[0] || null;
        const primaryPermission = sortedPermissions[0] || null;
        
        // 生成角色 badge HTML
        const generateRoleBadge = (role, isExpanded = false) => {
            const badgeClass = role.type === 'manager' ? 'role-manager' : 'role-staff';
            const icon = role.type === 'manager' ? 'user-tie' : 'user';
            const primaryClass = role.isPrimary ? 'primary-role' : '';
            const primaryIcon = role.isPrimary ? '<i class="fas fa-star" style="font-size: 8px; margin-left: 2px;"></i>' : '';
            return `<span class="employee-role-badge ${badgeClass} ${primaryClass}" title="${role.name}${role.isPrimary ? ' (主要角色)' : ''}">
                <i class="fas fa-${icon}"></i>${role.name}${primaryIcon}
            </span>`;
        };

        // 生成權限 badge HTML
        const generatePermissionBadge = (permission, isExpanded = false) => {
            const badgeClass = `permission-${permission.type}`;
            let icon = 'shield-alt';
            if (permission.type === 'admin') icon = 'user-shield';
            else if (permission.type === 'manager') icon = 'user-tie';
            else if (permission.type === 'user') icon = 'user';
            
            return `<span class="employee-permission-badge ${badgeClass}" title="${permission.name}">
                <i class="fas fa-${icon}"></i>${permission.name}
            </span>`;
        };

        let html = '<div class="employee-badges-container">';

        // 左側：角色 badges
        if (sortedRoles.length > 0) {
            html += '<div class="employee-roles-section">';
            
            if (sortedRoles.length === 1) {
                // 只有一個角色，直接顯示
                html += generateRoleBadge(primaryRole);
            } else {
                // 多個角色，建立可展開的容器
                html += `<div class="employee-badge-expandable" data-type="roles">`;
                html += generateRoleBadge(primaryRole);
                if (sortedRoles.length > 1) {
                    html += `<span class="employee-badge-more">+${sortedRoles.length - 1}</span>`;
                }
                
                // 隱藏的展開內容
                html += '<div class="employee-badge-expanded">';
                sortedRoles.slice(1).forEach(role => {
                    html += generateRoleBadge(role, true);
                });
                html += '</div></div>';
            }
            
            html += '</div>';
        }

        // 右側：權限 badges
        if (sortedPermissions.length > 0) {
            html += '<div class="employee-permissions-section">';
            
            if (sortedPermissions.length === 1) {
                // 只有一個權限，直接顯示
                html += generatePermissionBadge(primaryPermission);
            } else {
                // 多個權限，建立可展開的容器
                html += `<div class="employee-badge-expandable" data-type="permissions">`;
                html += generatePermissionBadge(primaryPermission);
                if (sortedPermissions.length > 1) {
                    html += `<span class="employee-badge-more">+${sortedPermissions.length - 1}</span>`;
                }
                
                // 隱藏的展開內容
                html += '<div class="employee-badge-expanded">';
                sortedPermissions.slice(1).forEach(permission => {
                    html += generatePermissionBadge(permission, true);
                });
                html += '</div></div>';
            }
            
            html += '</div>';
        }

        html += '</div>';
        
        return html;
    }
    
    /**
     * 綁定員工 badge 懸停展開事件
     */
    function bindEmployeeBadgeEvents() {
        // 為每個可展開的 badge 容器綁定事件
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
    return {
        init,
        showEmployeeHoverCard,
        hideEmployeeHoverCard,
        generateEmployeeBadges,
        bindEmployeeBadgeEvents
    };
})();

// 確保模組可被存取
if (typeof OrganizationEmployeeHoverCardModule === 'undefined') {
    var OrganizationEmployeeHoverCardModule = window.OrganizationEmployeeHoverCardModule;
}