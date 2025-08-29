/**
 * 組織管理 - 員工管理模組
 * 處理員工的 CRUD 操作、權限管理、懸浮卡片等功能
 */
const OrganizationEmployeeModule = (function() {
    'use strict';
    
    // API 端點
    const API_BASE = '/api/organization';
    const ENDPOINTS = {
        users: `${API_BASE}/users`,
        permissionGroups: `/api/permissions/groups`,  // 使用 permissions API
    };
    
    // 數據存儲
    let permissionGroups = [];  // 保留用於員工表單選項
    let users = [];
    let allUsers = [];          // 儲存所有用戶（包含停用）
    let showInactiveUsers = false;  // 是否顯示停用用戶
    let currentPage = 1;
    let totalPages = 1;
    const pageSize = 10;
    
    // 員工懸浮卡片相關
    let employeeHoverCache = new Map(); // 部門員工資料快取
    let currentDeptEmployees = []; // 當前部門員工列表
    let filteredEmployees = []; // 搜尋過濾結果
    let employeeHoverBackdrop = null; // 懸浮卡片背景
    let employeeHoverCard = null; // 懸浮卡片
    const cacheTimeout = 5 * 60 * 1000; // 5分鐘快取有效期
    
    /**
     * 初始化模組
     */
    async function init() {
        // OrganizationEmployeeModule 初始化開始
        
        // 綁定事件
        bindButtonEvents();
        bindModalEvents();
        bindFormEvents();
        
        // 初始化滾動條淡出淡入效果
        if (window.CommonUI && CommonUI.initScrollFadeEffect) {
            CommonUI.initScrollFadeEffect();
        }
        
        // 初始化員工懸浮卡片
        initEmployeeHoverCard();
        
        // 載入初始數據
        await loadPermissionGroups();
        await loadUsers();
        
        // 預載入表單選項（確保編輯時選項已存在）
        loadUserFormOptions();
        
        // OrganizationEmployeeModule 初始化完成
    }
    
    /**
     * 載入權限群組數據
     */
    async function loadPermissionGroups() {
        try {
            const response = await fetch(ENDPOINTS.permissionGroups, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            // 處理不同的回應格式，直接使用 permissionGroups 變數給員工表單使用
            permissionGroups = Array.isArray(data) ? data : (data.data || []);
        } catch (error) {
            console.error('載入權限群組數據失敗:', error);
            // 使用模擬數據作為後備
            permissionGroups = [
                { id: 1, code: 'ADMIN', name: '系統管理員', type: '系統', description: '擁有所有權限', user_count: 2, is_active: true },
                { id: 2, code: 'MANAGER', name: '部門主管', type: '業務', description: '管理部門成員', user_count: 5, is_active: true },
                { id: 3, code: 'USER', name: '一般員工', type: '業務', description: '基本權限', user_count: 50, is_active: false }
            ];
        }
    }
    
    /**
     * 載入員工數據
     */
    async function loadUsers() {
        try {
            const response = await fetch(`${ENDPOINTS.users}?page=${currentPage}&limit=${pageSize}`, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            // API 可能直接返回陣列或包裝在 data 屬性中
            allUsers = Array.isArray(data) ? data : (data.data || data.users || []);
            
            // 根據顯示設定過濾用戶
            filterUsers();
            
            // 更新分頁資訊
            if (data.pagination) {
                totalPages = data.pagination.total_pages || 1;
                updatePagination(data.pagination);
            } else {
                // 如果沒有分頁資訊，計算總頁數
                totalPages = Math.ceil(users.length / pageSize);
            }
            
            renderUserTable();
            updateUserStatistics();
        } catch (error) {
            console.error('載入員工數據失敗:', error);
            // 使用模擬數據作為後備
            allUsers = [
                { 
                    id: 1, 
                    loginid: 'admin',
                    username: '系統管理員', 
                    email: 'admin@example.com',
                    department_name: '總經理室', 
                    permission_group_names: ['系統管理員'], 
                    status: 'active', 
                    auth_type: 'local',
                    last_login: '2024-01-20 10:00:00'
                },
                { 
                    id: 2, 
                    loginid: 'john',
                    username: 'John Doe', 
                    email: 'john@example.com',
                    department_name: '技術部', 
                    permission_group_names: ['部門主管'], 
                    status: 'disabled', 
                    auth_type: 'ldap',
                    last_login: '2024-01-21 09:30:00'
                }
            ];
            filterUsers();
            renderUserTable();
            updateUserStatistics();
        }
    }
    
    /**
     * 渲染用戶表格
     */
    function renderUserTable() {
        const tbody = document.getElementById('employeeTableBody');
        if (!tbody) return;
        
        if (users.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="text-center">
                        <div class="empty-state">
                            <i class="fas fa-users"></i>
                            <h3>尚無用戶資料</h3>
                            <p>點擊「新增帳號」開始建立用戶</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = users.map(user => `
            <tr class="${!user.is_active ? 'inactive-row' : ''}">
                <td><input type="checkbox" name="userSelect" value="${user.user_id || user.id}"></td>
                <td>${user.loginid || user.username}</td>
                <td>${user.username || user.name || ''}</td>
                <td>${user.email || ''}</td>
                <td>${user.department_name || user.department?.name || '未分配'}</td>
                <td>${user.permission_group_names ? user.permission_group_names.join(', ') : (user.permission_groups || []).map(r => r.name).join(', ') || '無'}</td>
                
                <td>
                    <span class="auth-badge auth-${user.auth_type || 'local'}">
                        ${getAuthTypeLabel(user.auth_type)}
                    </span>
                </td>
                <td>
                    <span class="status-badge ${user.is_active ? 'status-active' : 'status-disabled'}">
                        ${user.is_active ? '啟用' : '停用'}
                    </span>
                </td>
                <td>${user.last_login || '從未登入'}</td>
                <td>
                    <button class="btn-icon" onclick="OrganizationEmployeeModule.editUser(${user.user_id || user.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon ${!user.is_active ? 'disabled' : ''}" ${user.is_active ? `onclick="OrganizationEmployeeModule.deleteUser(${user.user_id || user.id})"` : ''}>
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }
    
    /**
     * 獲取認證類型標籤
     */
    function getAuthTypeLabel(type) {
        const labels = {
            'local': '本地',
            'ldap': 'LDAP',
            'sso': 'SSO'
        };
        return labels[type] || '本地';
    }
    
    /**
     * 過濾用戶
     */
    function filterUsers() {
        if (showInactiveUsers) {
            users = [...allUsers]; // 顯示全部用戶（包含停用）
        } else {
            users = allUsers.filter(user => 
                user.is_active === true || user.is_active === 1
            ); // 只顯示啟用用戶（is_active = true 或 1）
        }
    }
    
    /**
     * 切換停用用戶顯示
     */
    function toggleInactiveEmployees() {
        showInactiveUsers = !showInactiveUsers;
        
        // 更新按鈕狀態
        const btn = document.getElementById('toggleInactiveEmployeesBtn');
        if (btn) {
            if (showInactiveUsers) {
                btn.title = '隱藏停用';
                btn.classList.add('active');
                btn.querySelector('i').className = 'fas fa-eye';
            } else {
                btn.title = '顯示停用';
                btn.classList.remove('active');
                btn.querySelector('i').className = 'fas fa-eye-slash';
            }
        }
        
        // 重新過濾並渲染
        filterUsers();
        renderUserTable();
        updateUserStatistics();
    }
    
    /**
     * 更新用戶統計數據
     */
    function updateUserStatistics() {
        const totalUsers = allUsers.length;
        const activeUsers = allUsers.filter(u => u.is_active === true || u.is_active === 1).length;
        const inactiveUsers = allUsers.filter(u => u.is_active === false || u.is_active === 0).length;
        
        const totalCount = document.querySelector('#totalEmployeeCount');
        const activeCount = document.querySelector('#activeEmployeeCount strong');
        const inactiveCount = document.querySelector('#inactiveEmployeeCount strong');
        
        if (totalCount) totalCount.textContent = totalUsers;
        if (activeCount) activeCount.textContent = activeUsers;
        if (inactiveCount) inactiveCount.textContent = inactiveUsers;
        
        // 更新概覽卡片的統計
        const employeeCount = document.querySelector('#employeeCount span');
        if (employeeCount) {
            employeeCount.textContent = users.length;
        }
    }
    
    /**
     * 更新分頁資訊
     */
    function updatePagination(pagination) {
        const pageInfo = document.getElementById('pageInfo');
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        
        if (pageInfo && pagination) {
            pageInfo.textContent = `第 ${pagination.page} 頁，共 ${pagination.total_pages} 頁`;
        }
        
        if (prevBtn) {
            prevBtn.disabled = currentPage <= 1;
        }
        
        if (nextBtn) {
            nextBtn.disabled = currentPage >= totalPages;
        }
    }
    
    /**
     * 生成員工角色和權限 badge HTML
     */
    function generateEmployeeBadges(roleList, permissionList) {
        if (roleList.length === 0 && permissionList.length === 0) {
            return '';
        }

        // 角色處理：按等級排序，管理角色優先
        const sortedRoles = roleList.sort((a, b) => {
            // 管理角色優先
            if (a.type === 'manager' && b.type !== 'manager') return -1;
            if (a.type !== 'manager' && b.type === 'manager') return 1;
            // 然後按層級排序（層級越高越優先）
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
            const icon = role.type === 'manager' ? 'crown' : 'user';
            return `<span class="employee-role-badge ${badgeClass}" title="${role.name}">
                <i class="fas fa-${icon}"></i>${role.name}
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
     * 顯示載入狀態
     */
    function showLoadingState() {
        document.querySelectorAll('.loading-spinner').forEach(spinner => {
            spinner.style.display = 'flex';
        });
    }
    
    /**
     * 隱藏載入狀態
     */
    function hideLoadingState() {
        document.querySelectorAll('.loading-spinner').forEach(spinner => {
            spinner.style.display = 'none';
        });
    }
    
    /**
     * 顯示錯誤訊息
     */
    function showError(message) {
        if (window.Dialog) {
            Dialog.error(message);
        } else {
            alert(message);
        }
    }
    
    /**
     * 顯示成功訊息
     */
    function showSuccess(message) {
        if (window.Dialog) {
            Dialog.success(message);
        } else {
            alert(message);
        }
    }
    
    /**
     * 綁定按鈕事件
     */
    function bindButtonEvents() {
        const addEmployeeBtn = document.getElementById('addEmployeeBtn');
        if (addEmployeeBtn) {
            addEmployeeBtn.addEventListener('click', showAddEmployeeModal);
        }
        
        // 分頁按鈕
        const prevPageBtn = document.getElementById('prevPage');
        const nextPageBtn = document.getElementById('nextPage');
        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', () => changePage(-1));
        }
        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', () => changePage(1));
        }
        
        // 搜尋功能
        const userSearchInput = document.getElementById('userSearchInput');
        if (userSearchInput) {
            userSearchInput.addEventListener('input', debounce(searchUsers, 300));
        }
    }
    
    /**
     * 綁定模態框事件
     */
    function bindModalEvents() {
        // 關閉按鈕事件
        window.closeEmployeeModal = () => closeModal('employeeModal');
        
        // 儲存按鈕事件
        window.saveEmployee = saveEmployee;
    }
    
    /**
     * 綁定表單事件
     */
    function bindFormEvents() {
        const userForm = document.getElementById('userForm');
        if (userForm) {
            userForm.addEventListener('submit', (e) => {
                e.preventDefault();
                saveEmployee();
            });
        }
    }
    
    /**
     * 顯示新增員工模態框
     */
    function showAddEmployeeModal() {
        const modal = document.getElementById('employeeModal');
        if (modal) {
            // 清除表單資料
            const form = document.getElementById('userForm');
            if (form) {
                form.reset();
                document.getElementById('userId').value = '';
                document.getElementById('userLoginid').value = '';
                document.getElementById('userUsername').value = '';
                document.getElementById('userEmail').value = '';
                document.getElementById('userPassword').value = '';
                document.getElementById('userEmployeeNo').value = '';
                document.getElementById('userTitle').value = '';
                document.getElementById('userDepartment').value = '';
                // 檢查 userActive 元素是否存在
                const userActive = document.getElementById('userActive');
                if (userActive) {
                    userActive.checked = true;
                }
                
                // 清除所有權限群組選項
                const permissionGroupCheckboxes = form.querySelectorAll('input[name="permission_group_ids"]');
                permissionGroupCheckboxes.forEach(cb => cb.checked = false);
            }
            
            // 設定標題為新增
            document.getElementById('employeeModalTitle').textContent = '新增員工';
            
            // 新增模式：確保使用者帳號欄位可編輯
            document.getElementById('userLoginid').disabled = false;
            
            // 顯示密碼欄位（新增時需要）
            const passwordGroup = document.getElementById('passwordGroup');
            if (passwordGroup) {
                passwordGroup.style.display = 'block';
            }
            
            // 顯示模態框
            modal.classList.add('show');
            loadUserFormOptions();
        }
    }
    
    /**
     * 載入用戶表單選項
     */
    function loadUserFormOptions() {
        // 載入部門選項
        const deptSelect = document.getElementById('userDepartment');
        if (deptSelect && window.OrganizationDepartmentModule) {
            const departments = window.OrganizationDepartmentModule.getDepartments();
            
            // 更新選項內容
            deptSelect.innerHTML = '<option value="">請選擇部門</option>' +
                departments.map(dept => `<option value="${dept.id}">${dept.name}</option>`).join('');
            
            // 如果已經初始化過 SearchableSelect，則重新載入
            if (deptSelect.searchableSelectInstance) {
                deptSelect.searchableSelectInstance.reload();
            } else if (window.SearchableSelect) {
                // 首次初始化 SearchableSelect
                const searchableOptions = {
                    placeholder: deptSelect.dataset.placeholder || '請選擇部門...',
                    searchPlaceholder: deptSelect.dataset.searchPlaceholder || '搜尋部門名稱...',
                    noResultsText: deptSelect.dataset.noResults || '找不到符合的部門',
                    maxHeight: '200px'
                };
                
                const instance = new SearchableSelect(deptSelect, searchableOptions);
                deptSelect.searchableSelectInstance = instance;
            }
        }
        
        // 載入權限群組選項
        const permissionGroupsContainer = document.querySelector('.permission-group-checkboxes');
        if (permissionGroupsContainer) {
            permissionGroupsContainer.innerHTML = permissionGroups.map(group => `
                <label>
                    <input type="checkbox" name="permission_group_ids" value="${group.id}">
                    ${group.name}
                </label>
            `).join('');
        }
    }
    
    /**
     * 儲存用戶
     */
    async function saveEmployee() {
        const form = document.getElementById('userForm');
        if (!form) return;
        
        const formData = new FormData(form);
        const userId = formData.get('id');
        const isEdit = userId && userId !== '';
        const permissionGroupIds = Array.from(form.querySelectorAll('input[name="permission_group_ids"]:checked'))
            .map(cb => parseInt(cb.value));
        
        // 前端驗證：根據新增/編輯模式檢查必填欄位
        const username = formData.get('username');
        const email = formData.get('email');
        
        // 檢查 username 是否為空（新增和編輯都需要）
        if (!username || username.trim() === '') {
            showError('使用者姓名為必填欄位，請輸入有效的姓名');
            return;
        }
        
        // 檢查 email 是否為空（新增和編輯都需要）
        if (!email || email.trim() === '') {
            showError('Email 為必填欄位，請輸入有效的 Email');
            return;
        }
        
        // 取得部門ID值
        const deptIdValue = formData.get('department_id');
        
        // 建立基本資料（編輯模式使用）
        const data = {
            username: username.trim(),
            email: email.trim(),
            employee_no: formData.get('employee_no'),
            department_id: deptIdValue && deptIdValue !== '' ? parseInt(deptIdValue) : null,
            title: formData.get('title'),
            permission_group_ids: permissionGroupIds,
            is_active: formData.get('is_active') === 'on'
        };
        
        // 新增模式：額外檢查和加入帳號、密碼
        if (!isEdit) {
            const loginid = formData.get('loginid');
            const password = formData.get('password');
            
            // 檢查帳號
            if (!loginid || loginid.trim() === '') {
                showError('登入帳號為必填欄位，請輸入有效的帳號');
                return;
            }
            
            // 檢查密碼
            if (!password) {
                showError('請輸入密碼');
                return;
            }
            
            // 新增模式加入帳號和密碼
            data.loginid = loginid.trim();
            data.password = password;
        }
        
        try {
            let response;
            
            if (isEdit) {
                // 編輯模式：檢查是否要更新密碼
                const passwordField = document.getElementById('userPassword');
                if (passwordField && passwordField.value) {
                    data.password = passwordField.value;
                }
                
                // 使用統一的更新 API
                response = await fetch(`${API_BASE}/users/${userId}`, {
                    method: 'PUT',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
            } else {
                // 新增模式：使用組織管理的用戶建立 API
                response = await fetch(ENDPOINTS.users, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
            }
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.detail || '儲存失敗');
            }
            
            showSuccess(isEdit ? '用戶更新成功' : '用戶新增成功');
            closeModal('employeeModal');
            await loadUsers();
            updateUserStatistics();
            
            // 通知主模組更新統計
            if (window.OrganizationModule) {
                window.OrganizationModule.updateStatistics();
            }
        } catch (error) {
            showError('儲存用戶失敗：' + error.message);
        }
    }
    
    /**
     * 編輯員工
     */
    async function editUser(id) {
        const user = users.find(u => u.user_id === id);
        if (!user) return;
        
        // 先載入表單選項（重要！確保部門和權限群組選項存在）
        loadUserFormOptions();
        
        // 填充基本資料
        document.getElementById('userId').value = user.user_id;
        document.getElementById('userLoginid').value = user.loginid;
        document.getElementById('userUsername').value = user.username;
        document.getElementById('userEmail').value = user.email;
        document.getElementById('userEmployeeNo').value = user.user_extension?.employee_no || '';
        
        // 編輯模式：禁用使用者帳號欄位（不可編輯）
        document.getElementById('userLoginid').disabled = true;
        
        // 延遲設定部門和權限群組，確保選項已經載入並渲染
        setTimeout(() => {
            // 填充組織資訊
            const userDeptSelect = document.getElementById('userDepartment');
            const deptId = user.department?.id || '';
            userDeptSelect.value = deptId;
            
            // 如果使用了 SearchableSelect，也要更新其顯示
            if (userDeptSelect.searchableSelectInstance) {
                userDeptSelect.searchableSelectInstance.setValue(deptId);
            } else if (window.SearchableSelect) {
                // 如果還沒初始化 SearchableSelect，現在初始化
                const searchableOptions = {
                    placeholder: userDeptSelect.dataset.placeholder || '請選擇部門...',
                    searchPlaceholder: userDeptSelect.dataset.searchPlaceholder || '搜尋部門名稱...',
                    noResultsText: userDeptSelect.dataset.noResults || '找不到符合的部門',
                    maxHeight: '200px'
                };
                const instance = new SearchableSelect(userDeptSelect, searchableOptions);
                userDeptSelect.searchableSelectInstance = instance;
                instance.setValue(deptId);
            }
            
            // 填充權限群組
            const userPermissionGroupIds = user.permission_groups.map(r => r.id);
            document.querySelectorAll('.permission-group-checkboxes input[type="checkbox"]').forEach(cb => {
                cb.checked = userPermissionGroupIds.includes(parseInt(cb.value));
            });
        }, 100);
        
        document.getElementById('userTitle').value = user.user_extension?.title || '';
        
        // 設定帳號狀態
        document.getElementById('userActive').checked = user.is_active !== false;  // 預設為啟用
        
        // 設置密碼策略為手動（編輯模式不改密碼）
        document.getElementById('passwordStrategy').value = 'MANUAL';
        document.getElementById('manualPasswordGroup').style.display = 'block';
        document.getElementById('userPassword').value = '';
        document.getElementById('userPassword').placeholder = '不修改請留空';
        
        // 修改標題
        document.getElementById('employeeModalTitle').textContent = '編輯員工';
        
        // 顯示模態框
        showModal('employeeModal');
    }
    
    /**
     * 刪除用戶（軟刪除：設為停用狀態）
     */
    async function deleteUser(id) {
        const user = users.find(u => (u.user_id || u.id) === id);
        const userName = user ? user.username : '此用戶';
        
        Dialog.confirm(`確定要停用用戶「${userName}」嗎？<br><small class="text-muted">停用後可透過編輯功能重新啟用</small>`, async () => {
            try {
                const response = await fetch(`${ENDPOINTS.users}/${id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        is_active: false
                    })
                });
                
                if (!response.ok) {
                    throw new Error('停用失敗');
                }
                
                showSuccess('用戶已停用，可透過編輯功能重新啟用');
                await loadUsers();
                updateUserStatistics();
                
                // 通知主模組更新統計
                if (window.OrganizationModule) {
                    window.OrganizationModule.updateStatistics();
                }
            } catch (error) {
                showError('停用用戶失敗：' + error.message);
            }
        }, {
            allowHTML: true
        });
    }
    
    /**
     * 關閉模態框
     */
    function showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
        }
    }
    
    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
            // 清空表單
            const form = modal.querySelector('form');
            if (form) {
                form.reset();
                
                // 重置 SearchableSelect 元件的顯示
                const searchableSelects = form.querySelectorAll('.searchable-select');
                searchableSelects.forEach(select => {
                    if (select.searchableSelectInstance) {
                        select.searchableSelectInstance.updateDisplay();
                    }
                });
            }
        }
    }
    
    /**
     * 切換頁面
     */
    function changePage(direction) {
        const newPage = currentPage + direction;
        if (newPage < 1 || newPage > totalPages) return;
        
        currentPage = newPage;
        loadUsers();
    }
    
    /**
     * 搜尋用戶
     */
    async function searchUsers() {
        const searchInput = document.getElementById('userSearchInput');
        if (!searchInput) return;
        
        const keyword = searchInput.value.trim();
        if (!keyword) {
            await loadUsers();
            return;
        }
        
        try {
            const response = await fetch(`${ENDPOINTS.users}?search=${encodeURIComponent(keyword)}&page=${currentPage}&limit=${pageSize}`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('搜尋失敗');
            }
            
            const data = await response.json();
            users = data.data || [];
            
            if (data.pagination) {
                totalPages = data.pagination.total_pages || 1;
                updatePagination(data.pagination);
            }
            
            renderUserTable();
        } catch (error) {
            showError('搜尋失敗：' + error.message);
        }
    }
    
    /**
     * 防抖函數
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
    
    /**
     * ========================================
     * 員工懸浮卡片功能
     * ========================================
     */
    
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
            <div class="employee-hover-list">
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
            // 檢查快取
            const cacheKey = `dept_${deptId}`;
            const cached = employeeHoverCache.get(cacheKey);
            
            if (cached && (Date.now() - cached.timestamp < cacheTimeout)) {
                currentDeptEmployees = cached.data;
                filteredEmployees = [...currentDeptEmployees];
                renderEmployeeList();
                return;
            }
            
            // 顯示載入狀態
            showEmployeeLoading();
            
            // 發送 API 請求
            const response = await fetch(`${ENDPOINTS.users}?department_id=${deptId}&limit=1000`, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            const employees = Array.isArray(data) ? data : (data.data || data.users || []);
            
            // 除錯記錄：檢查 API 回傳的資料結構
            // API 回傳的員工資料
            if (employees.length > 0) {
                // 第一個員工的資料結構
                // 是否有 department_roles
                // 是否有 permission_groups
            }
            
            // 快取資料
            employeeHoverCache.set(cacheKey, {
                data: employees,
                timestamp: Date.now()
            });
            
            currentDeptEmployees = employees;
            filteredEmployees = [...employees];
            
            // 渲染員工列表
            renderEmployeeList();
            
        } catch (error) {
            console.error('載入部門員工失敗:', error);
            showEmployeeError('載入員工資料失敗');
        }
    }
    
    /**
     * 過濾員工列表
     */
    function filterEmployees(keyword) {
        if (!keyword.trim()) {
            filteredEmployees = [...currentDeptEmployees];
        } else {
            const searchTerm = keyword.toLowerCase().trim();
            filteredEmployees = currentDeptEmployees.filter(employee => {
                const username = (employee.username || '').toLowerCase();
                const loginid = (employee.loginid || '').toLowerCase();
                const email = (employee.email || '').toLowerCase();
                
                return username.includes(searchTerm) || 
                       loginid.includes(searchTerm) || 
                       email.includes(searchTerm);
            });
        }
        
        renderEmployeeList();
    }
    
    /**
     * 渲染員工列表
     */
    function renderEmployeeList() {
        const listContainer = employeeHoverCard.querySelector('.employee-hover-list');
        
        if (filteredEmployees.length === 0) {
            if (currentDeptEmployees.length === 0) {
                // 沒有員工
                listContainer.innerHTML = `
                    <div class="employee-hover-empty">
                        <i class="employee-hover-empty-icon fas fa-users"></i>
                        <p class="employee-hover-empty-text">此部門尚無員工</p>
                        <p class="employee-hover-empty-subtext">可透過員工管理新增員工至此部門</p>
                    </div>
                `;
            } else {
                // 搜尋無結果
                listContainer.innerHTML = `
                    <div class="employee-hover-empty">
                        <i class="employee-hover-empty-icon fas fa-search"></i>
                        <p class="employee-hover-empty-text">找不到符合的員工</p>
                        <p class="employee-hover-empty-subtext">請嘗試其他關鍵字</p>
                    </div>
                `;
            }
            return;
        }
        
        // 渲染員工列表
        const employeeHtml = filteredEmployees.map(employee => {
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
            if (displayName.includes('測試') || filteredEmployees.indexOf(employee) === 0) {
                // 員工角色資料
                // 員工權限資料
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
        
        listContainer.innerHTML = employeeHtml;
        
        // 綁定角色和權限 badge 的懸停展開事件
        bindEmployeeBadgeEvents();
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
                }, 300); // 300ms 延遲，避免意外收合
            });
        });
    }
    
    /**
     * 顯示員工載入狀態
     */
    function showEmployeeLoading() {
        const listContainer = employeeHoverCard.querySelector('.employee-hover-list');
        listContainer.innerHTML = `
            <div class="employee-hover-loading">
                <div class="employee-hover-loading-spinner"></div>
                <p class="employee-hover-loading-text">載入員工資料中...</p>
            </div>
        `;
    }
    
    /**
     * 顯示員工載入錯誤
     */
    function showEmployeeError(message) {
        const listContainer = employeeHoverCard.querySelector('.employee-hover-list');
        listContainer.innerHTML = `
            <div class="employee-hover-empty">
                <i class="employee-hover-empty-icon fas fa-exclamation-triangle"></i>
                <p class="employee-hover-empty-text">載入失敗</p>
                <p class="employee-hover-empty-subtext">${message}</p>
            </div>
        `;
    }
    
    /**
     * 根據角色名稱判斷角色類型
     */
    function getRoleType(roleName) {
        if (!roleName) return 'default';
        
        const name = roleName.toLowerCase();
        if (name.includes('管理') || name.includes('主管') || name.includes('supervisor') || 
            name.includes('manager') || name.includes('admin')) {
            return 'manager';
        } else if (name.includes('員工') || name.includes('staff') || name.includes('employee')) {
            return 'staff';
        } else if (name.includes('助理') || name.includes('assistant')) {
            return 'assistant';
        } else if (name.includes('系統') || name.includes('system')) {
            return 'system';
        }
        return 'default';
    }
    
    /**
     * 根據角色類型獲取對應圖標
     */
    function getRoleIcon(roleType) {
        switch (roleType) {
            case 'manager': return 'crown';
            case 'staff': return 'user';
            case 'assistant': return 'user-friends';
            case 'system': return 'cogs';
            default: return 'tag';
        }
    }
    
    // 公開 API
    return {
        init: init,
        loadUsers: loadUsers,
        saveEmployee: saveEmployee,
        editUser: editUser,
        deleteUser: deleteUser,
        toggleInactiveEmployees: toggleInactiveEmployees,
        searchUsers: searchUsers,
        showEmployeeHoverCard: showEmployeeHoverCard,
        showModal: showModal,
        closeModal: closeModal,
        loadPermissionGroups: loadPermissionGroups,
        updateUserStatistics: updateUserStatistics
    };
})();

// 確保模組可被全域存取
window.OrganizationEmployeeModule = OrganizationEmployeeModule;