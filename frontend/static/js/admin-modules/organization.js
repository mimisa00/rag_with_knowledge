/**
 * 組織管理主模組
 * 處理部門、角色、帳號的 CRUD 操作
 */
const OrganizationModule = (function() {
    'use strict';
    
    // API 端點
    const API_BASE = '/api/organization';
    const ENDPOINTS = {
        departments: `${API_BASE}/departments`,
        roles: `${API_BASE}/roles`,
        users: `${API_BASE}/users`,
        permissions: `${API_BASE}/roles/permissions`
    };
    
    // 數據存儲
    let allDepartments = [];  // 儲存所有部門（包含停用）
    let departments = [];      // 顯示用的部門列表
    let roles = [];
    let allRoles = [];          // 儲存所有角色（包含停用）
    let users = [];
    let allUsers = [];          // 儲存所有用戶（包含停用）
    let permissions = [];
    let showInactiveDepts = false;  // 是否顯示停用部門
    let showInactiveRoles = false;  // 是否顯示停用角色
    let showInactiveUsers = false;  // 是否顯示停用用戶
    let selectedRoleId = null;      // 當前選中的角色ID
    let selectedDepartmentId = null; // 當前選中的部門ID
    let currentPage = 1;
    let totalPages = 1;
    const pageSize = 10;
    
    /**
     * 初始化模組
     */
    async function init() {
        console.log('OrganizationModule 初始化開始');
        
        // 綁定事件
        bindButtonEvents();
        bindModalEvents();
        bindFormEvents();
        
        // 初始化滾動條淡出淡入效果
        initScrollFadeEffect();
        
        // 載入初始數據
        await loadAllData();
        
        // 預載入表單選項（確保編輯時選項已存在）
        loadUserFormOptions();
        
        // 監聽區塊切換事件
        window.addEventListener('orgSectionChange', async (e) => {
            await loadSectionData(e.detail.section);
            // 重新初始化滾動條效果
            setTimeout(() => {
                initScrollFadeEffect();
            }, 100);
        });
        
        console.log('OrganizationModule 初始化完成');
    }
    
    /**
     * 載入所有數據
     */
    async function loadAllData() {
        try {
            showLoadingState();
            
            await Promise.all([
                loadDepartments(),
                loadRoles(),
                loadUsers(),
                loadPermissions()
            ]);
            
            hideLoadingState();
            updateStatistics();
        } catch (error) {
            console.error('載入數據失敗:', error);
            hideLoadingState();
            showError('載入數據失敗，部分功能可能無法正常使用');
        }
    }
    
    /**
     * 載入區塊數據
     */
    async function loadSectionData(section) {
        switch(section) {
            case 'departments':
                await loadDepartments();
                break;
            case 'roles':
                await loadRoles();
                break;
            case 'users':
                await loadUsers();
                break;
        }
        updateStatistics();
    }
    
    /**
     * 載入部門數據
     */
    async function loadDepartments() {
        try {
            console.log('開始載入部門數據...');
            const response = await fetch(ENDPOINTS.departments, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('API 回應:', data);
            
            // 處理不同的回應格式
            let rawDepartments = Array.isArray(data) ? data : (data.data || []);
            
            // 確保每個部門都有必要的欄位並標準化數據類型
            allDepartments = rawDepartments.map(dept => ({
                id: Number(dept.id),
                name: dept.name || '未命名部門',
                code: dept.code || '',
                parent_id: dept.parent_id ? Number(dept.parent_id) : null,
                description: dept.description || '',
                user_count: Number(dept.user_count || 0),
                is_active: dept.is_active === true || dept.is_active === 1,
                sort_order: Number(dept.sort_order || 0),
                created_at: dept.created_at,
                updated_at: dept.updated_at
            }));
            
            console.log('處理後的所有部門數據:', allDepartments);
            
            // 根據開關過濾部門
            filterDepartments();
        } catch (error) {
            console.error('載入部門數據失敗:', error);
            console.log('使用模擬數據...');
            
            // 使用模擬數據作為後備
            allDepartments = [
                { id: 1, name: '總經理室', code: 'CEO', parent_id: null, description: '公司最高管理層', user_count: 5, is_active: true, sort_order: 1 },
                { id: 2, name: '技術部', code: 'TECH', parent_id: 1, description: '負責技術研發', user_count: 20, is_active: true, sort_order: 2 },
                { id: 3, name: '前端組', code: 'FE', parent_id: 2, description: '前端開發', user_count: 8, is_active: true, sort_order: 1 },
                { id: 4, name: '後端組', code: 'BE', parent_id: 2, description: '後端開發', user_count: 12, is_active: true, sort_order: 2 },
                { id: 5, name: '業務部', code: 'SALES', parent_id: 1, description: '負責業務推廣', user_count: 15, is_active: false, sort_order: 3 },
                { id: 6, name: '人資部', code: 'HR', parent_id: 1, description: '人力資源管理', user_count: 3, is_active: true, sort_order: 4 }
            ];
            filterDepartments();
        }
    }
    
    /**
     * 載入角色數據
     */
    async function loadRoles() {
        try {
            const response = await fetch(ENDPOINTS.roles, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            // 處理不同的回應格式
            allRoles = Array.isArray(data) ? data : (data.data || []);
            
            // 根據顯示設定過濾角色
            filterRoles();
            renderRoleTable();
            updateRoleStatistics();
        } catch (error) {
            console.error('載入角色數據失敗:', error);
            // 使用模擬數據作為後備
            allRoles = [
                { id: 1, code: 'ADMIN', name: '系統管理員', type: '系統', description: '擁有所有權限', user_count: 2, is_active: true },
                { id: 2, code: 'MANAGER', name: '部門主管', type: '業務', description: '管理部門成員', user_count: 5, is_active: true },
                { id: 3, code: 'USER', name: '一般員工', type: '業務', description: '基本權限', user_count: 50, is_active: false }
            ];
            filterRoles();
            renderRoleTable();
            updateRoleStatistics();
        }
    }
    
    /**
     * 載入用戶數據
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
            console.error('載入用戶數據失敗:', error);
            // 使用模擬數據作為後備
            allUsers = [
                { 
                    id: 1, 
                    loginid: 'admin',
                    username: '系統管理員', 
                    email: 'admin@example.com',
                    department_name: '總經理室', 
                    role_names: ['系統管理員'], 
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
                    role_names: ['部門主管'], 
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
     * 載入權限數據
     */
    async function loadPermissions() {
        try {
            const response = await fetch(ENDPOINTS.permissions, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            // 權限矩陣包含 modules 陣列
            if (data.modules) {
                // 將 modules 轉換為扁平的權限列表
                permissions = [];
                data.modules.forEach(module => {
                    module.actions.forEach(action => {
                        permissions.push({
                            id: `${module.key}.${action.key}`,
                            code: `${module.key}.${action.key}`,
                            name: action.name,
                            category: module.name,
                            module: module.key,
                            action: action.key,
                            description: action.description
                        });
                    });
                });
            } else {
                permissions = data.data || [];
            }
        } catch (error) {
            console.error('載入權限數據失敗:', error);
            // 使用模擬權限數據
            permissions = [
                // 知識庫管理
                { id: 1, code: 'kb.create', name: '建立', category: '知識庫管理' },
                { id: 2, code: 'kb.view', name: '檢視', category: '知識庫管理' },
                { id: 3, code: 'kb.edit', name: '編輯', category: '知識庫管理' },
                { id: 4, code: 'kb.delete', name: '刪除', category: '知識庫管理' },
                { id: 5, code: 'kb.index', name: '建立索引', category: '知識庫管理' },
                // 文件管理
                { id: 6, code: 'doc.upload', name: '上傳', category: '文件管理' },
                { id: 7, code: 'doc.view', name: '檢視', category: '文件管理' },
                { id: 8, code: 'doc.edit', name: '編輯', category: '文件管理' },
                { id: 9, code: 'doc.delete', name: '刪除', category: '文件管理' },
                { id: 10, code: 'doc.download', name: '下載', category: '文件管理' },
                // 使用者管理
                { id: 11, code: 'user.create', name: '建立', category: '使用者管理' },
                { id: 12, code: 'user.view', name: '檢視', category: '使用者管理' },
                { id: 13, code: 'user.edit', name: '編輯', category: '使用者管理' },
                { id: 14, code: 'user.delete', name: '刪除', category: '使用者管理' },
                { id: 15, code: 'user.reset_password', name: '重設密碼', category: '使用者管理' },
                // 組織管理
                { id: 16, code: 'org.manage_dept', name: '管理部門', category: '組織管理' },
                { id: 17, code: 'org.manage_role', name: '管理角色', category: '組織管理' },
                { id: 18, code: 'org.assign_role', name: '分配角色', category: '組織管理' },
                { id: 19, code: 'org.view_structure', name: '檢視架構', category: '組織管理' },
                // 系統設定
                { id: 20, code: 'sys.settings', name: '系統設定', category: '系統設定' },
                { id: 21, code: 'sys.audit_log', name: '審計日誌', category: '系統設定' },
                { id: 22, code: 'sys.backup', name: '備份還原', category: '系統設定' },
                { id: 23, code: 'sys.maintenance', name: '系統維護', category: '系統設定' },
                // 對話管理
                { id: 24, code: 'chat.use', name: '使用對話', category: '對話管理' },
                { id: 25, code: 'chat.history', name: '檢視歷史', category: '對話管理' },
                { id: 26, code: 'chat.export', name: '匯出對話', category: '對話管理' },
                { id: 27, code: 'chat.prompt', name: '管理提示詞', category: '對話管理' }
            ];
        }
    }
    
    /**
     * 過濾部門
     */
    function filterDepartments() {
        if (showInactiveDepts) {
            departments = [...allDepartments];
        } else {
            departments = allDepartments.filter(dept => dept.is_active);
        }
        
        console.log(`過濾後的部門數量: ${departments.length} (總共: ${allDepartments.length})`);
        
        // 更新統計
        updateDepartmentStats();
        
        // 重新渲染樹狀結構
        renderDepartmentTree();
        
        // 如果有選中的部門，重新顯示其詳情（保持選中狀態）
        if (selectedDepartmentId) {
            showDepartmentDetails(selectedDepartmentId);
        }
    }
    
    /**
     * 更新部門統計
     */
    function updateDepartmentStats() {
        const activeDepts = allDepartments.filter(d => d.is_active).length;
        const inactiveDepts = allDepartments.filter(d => !d.is_active).length;
        
        const totalCount = document.getElementById('totalDeptCount');
        const activeCount = document.querySelector('#activeDeptCount strong');
        const inactiveCount = document.querySelector('#inactiveDeptCount strong');
        
        if (totalCount) totalCount.textContent = allDepartments.length;
        if (activeCount) activeCount.textContent = activeDepts;
        if (inactiveCount) inactiveCount.textContent = inactiveDepts;
    }
    
    /**
     * 切換顯示停用部門
     */
    function toggleInactiveDepts() {
        // 使用新的眼睛圖標按鈕切換
        const toggleBtn = document.getElementById('toggleInactiveBtn');
        if (toggleBtn) {
            // 切換狀態
            showInactiveDepts = !showInactiveDepts;
            
            // 更新按鈕圖標和樣式
            const icon = toggleBtn.querySelector('i');
            if (showInactiveDepts) {
                toggleBtn.classList.add('active');
                icon.className = 'fas fa-eye';
                toggleBtn.title = '隱藏停用';
            } else {
                toggleBtn.classList.remove('active');
                icon.className = 'fas fa-eye-slash';
                toggleBtn.title = '顯示停用';
            }
        } else {
            // 向後兼容：如果還有舊的 checkbox
            const checkbox = document.getElementById('showInactiveDepts');
            showInactiveDepts = checkbox ? checkbox.checked : false;
        }
        
        filterDepartments();
    }
    
    /**
     * 渲染部門樹狀結構
     */
    function renderDepartmentTree() {
        const container = document.getElementById('departmentTree');
        if (!container) {
            console.error('部門樹狀結構容器不存在');
            return;
        }
        
        console.log('開始渲染部門樹，部門數量:', departments.length);
        
        if (departments.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-sitemap"></i>
                    <h3>尚無部門資料</h3>
                    <p>點擊「新增部門」開始建立組織架構</p>
                </div>
            `;
            return;
        }
        
        // 構建樹狀結構
        const tree = buildTree(departments);
        console.log('樹狀結構構建完成:', tree);
        
        // 如果沒有根節點，顯示平面列表
        if (tree.length === 0) {
            console.log('沒有根節點，顯示平面列表');
            container.innerHTML = `
                <div class="tree-node root-drop-zone" data-id="root" data-level="-1">
                    <div class="node-content" style="border: 2px dashed #ccc; background: #f9f9f9;">
                        <i class="fas fa-layer-group" style="margin-right: 0.5rem;"></i>
                        <span style="color: #999;">拖曳到此處移至頂層</span>
                    </div>
                </div>
                <div class="tree-scrollable-content">
                    ${renderFlatList(departments)}
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="tree-node root-drop-zone" data-id="root" data-level="-1">
                    <div class="node-content" style="border: 2px dashed #ccc; background: #f9f9f9;">
                        <i class="fas fa-layer-group" style="margin-right: 0.5rem;"></i>
                        <span style="color: #999;">拖曳到此處移至頂層</span>
                    </div>
                </div>
                <div class="tree-scrollable-content">
                    ${renderTreeNodes(tree)}
                </div>
            `;
        }
        
        // 綁定展開/收合事件
        bindTreeEvents();
    }
    
    /**
     * 構建樹狀結構
     */
    function buildTree(items, parentId = null) {
        return items
            .filter(item => {
                // 處理 null 值的特殊情況
                if (parentId === null || parentId === undefined) {
                    return item.parent_id === null || item.parent_id === undefined || item.parent_id === 0;
                }
                // 確保數字比較（轉換為數字後比較）
                return Number(item.parent_id) === Number(parentId);
            })
            .map(item => ({
                ...item,
                children: buildTree(items, item.id)
            }));
    }
    
    /**
     * 渲染樹節點
     */
    function renderTreeNodes(nodes, level = 0, expandFirstLevel = true) {
        if (!nodes || nodes.length === 0) return '';
        
        return nodes.map(node => {
            const hasChildren = node.children && node.children.length > 0;
            // 只展開第一層（根節點的直接子節點）
            const shouldExpand = expandFirstLevel && level === 0 && hasChildren;
            
            return `
                <div class="tree-node ${!node.is_active ? 'inactive' : ''}" data-id="${node.id}" data-level="${level}" draggable="true">
                    <div class="node-content" style="padding-left: ${level * 20}px">
                        <span class="drag-handle" title="拖曳以移動部門">
                            <i class="fas fa-grip-vertical"></i>
                        </span>
                        <span class="node-toggle ${hasChildren ? '' : 'invisible'}" data-node-id="${node.id}">
                            <i class="fas fa-chevron-${shouldExpand ? 'down' : 'right'}"></i>
                        </span>
                        <span class="node-icon">
                            <i class="fas fa-${hasChildren ? 'folder' : 'file'}${!node.is_active ? '-slash' : ''}"></i>
                        </span>
                        <span class="node-name">${node.name || '未命名'}${!node.is_active ? ' (停用)' : ''}</span>
                        <span class="node-count">(${node.user_count || 0})</span>
                        <span class="node-actions">
                            <button class="btn-icon" onclick="OrganizationModule.editDepartment(${node.id})" title="編輯">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-icon ${!node.is_active ? 'disabled' : ''}" ${node.is_active ? `onclick="OrganizationModule.deleteDepartment(${node.id})"` : ''} title="刪除">
                                <i class="fas fa-trash"></i>
                            </button>
                        </span>
                    </div>
                    ${hasChildren ? `
                        <div class="tree-children${shouldExpand ? ' expanded' : ''}" data-parent-id="${node.id}">
                            ${renderTreeNodes(node.children, level + 1, false)}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }
    
    /**
     * 渲染平面列表（當沒有樹狀結構時使用）
     */
    function renderFlatList(items) {
        return items.map(item => `
            <div class="tree-node" data-id="${item.id}" data-level="0" draggable="true">
                <div class="node-content">
                    <span class="drag-handle" title="拖曳以移動部門">
                        <i class="fas fa-grip-vertical"></i>
                    </span>
                    <span class="node-icon">
                        <i class="fas fa-folder"></i>
                    </span>
                    <span class="node-name">${item.name || '未命名'}</span>
                    <span class="node-count">(${item.user_count || 0})</span>
                    <span class="node-actions">
                        <button class="btn-icon" onclick="OrganizationModule.editDepartment(${item.id})" title="編輯">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon ${!item.is_active ? 'disabled' : ''}" ${item.is_active ? `onclick="OrganizationModule.deleteDepartment(${item.id})"` : ''} title="刪除">
                            <i class="fas fa-trash"></i>
                        </button>
                    </span>
                </div>
            </div>
        `).join('');
    }
    
    /**
     * 渲染角色表格
     */
    function renderRoleTable() {
        const tbody = document.getElementById('roleTableBody');
        if (!tbody) return;
        
        if (roles.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">
                        <div class="empty-state">
                            <i class="fas fa-user-shield"></i>
                            <h3>尚無角色資料</h3>
                            <p>點擊「新增角色」開始建立角色</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = roles.map(role => `
            <tr class="${role.is_active === false ? 'inactive-row' : ''}" onclick="OrganizationModule.selectRole(${role.id})" data-role-id="${role.id}">
                <td>${role.code || ''}</td>
                <td>${role.name}</td>
                <td>${role.role_type == 'custom' ? '自訂' : '系統'}</td>
                <td>${role.user_count || 0}</td>
                <td>
                    <span class="status-badge ${role.is_active !== false ? 'status-active' : 'status-disabled'}">
                        ${role.is_active !== false ? '啟用' : '停用'}
                    </span>
                </td>
                <td onclick="event.stopPropagation()">
                    <button class="btn-icon" onclick="OrganizationModule.editRole(${role.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon ${!role.is_active ? 'disabled' : ''}" ${role.is_active ? `onclick="OrganizationModule.deleteRole(${role.id})"` : ''}>
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }
    
    /**
     * 渲染過濾後的角色表格
     */
    function renderRoleTableWithFiltered(filteredRoles) {
        const tbody = document.getElementById('roleTableBody');
        if (!tbody) return;
        
        if (filteredRoles.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">
                        <div class="empty-state">
                            <i class="fas fa-search"></i>
                            <h3>找不到符合的角色</h3>
                            <p>請嘗試其他搜尋關鍵字</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = filteredRoles.map(role => `
            <tr onclick="OrganizationModule.selectRole(${role.id})" data-role-id="${role.id}">
                <td>${role.code || ''}</td>
                <td>${role.name}</td>
                <td>${(role.role_type || role.type) === 'system' ? '系統' : '自訂'}</td>
                <td>${role.user_count || 0}</td>
                <td>
                    <span class="status-badge ${role.is_active ? 'status-active' : 'status-disabled'}">
                        ${role.is_active ? '啟用' : '停用'}
                    </span>
                </td>
                <td onclick="event.stopPropagation()">
                    <button class="btn-icon" onclick="OrganizationModule.editRole(${role.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon ${!role.is_active ? 'disabled' : ''}" ${role.is_active ? `onclick="OrganizationModule.deleteRole(${role.id})"` : ''}>
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }
    
    /**
     * 渲染用戶表格
     */
    function renderUserTable() {
        const tbody = document.getElementById('userTableBody');
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
                <td>${user.role_names ? user.role_names.join(', ') : (user.roles || []).map(r => r.name).join(', ') || '無'}</td>
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
                    <button class="btn-icon" onclick="OrganizationModule.editUser(${user.user_id || user.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon ${!user.is_active ? 'disabled' : ''}" ${user.is_active ? `onclick="OrganizationModule.deleteUser(${user.user_id || user.id})"` : ''}>
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
     * 過濾角色
     */
    function filterRoles() {
        if (showInactiveRoles) {
            roles = [...allRoles];
        } else {
            roles = allRoles.filter(role => role.is_active !== false);
        }
    }
    
    /**
     * 切換停用角色顯示
     */
    function toggleInactiveRoles() {
        showInactiveRoles = !showInactiveRoles;
        
        // 更新按鈕狀態
        const btn = document.getElementById('toggleInactiveRolesBtn');
        if (btn) {
            if (showInactiveRoles) {
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
        filterRoles();
        renderRoleTable();
        updateRoleStatistics();
    }
    
    /**
     * 更新角色統計數據
     */
    function updateRoleStatistics() {
        const totalRoles = allRoles.length;
        const activeRoles = allRoles.filter(r => r.is_active !== false).length;
        const inactiveRoles = allRoles.filter(r => r.is_active === false).length;
        
        const totalCount = document.querySelector('#totalRoleCount');
        const activeCount = document.querySelector('#activeRoleCount strong');
        const inactiveCount = document.querySelector('#inactiveRoleCount strong');
        
        if (totalCount) totalCount.textContent = totalRoles;
        if (activeCount) activeCount.textContent = activeRoles;
        if (inactiveCount) inactiveCount.textContent = inactiveRoles;
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
    function toggleInactiveUsers() {
        showInactiveUsers = !showInactiveUsers;
        
        // 更新按鈕狀態
        const btn = document.getElementById('toggleInactiveUsersBtn');
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
        
        const totalCount = document.querySelector('#totalUserCount');
        const activeCount = document.querySelector('#activeUserCount strong');
        const inactiveCount = document.querySelector('#inactiveUserCount strong');
        
        if (totalCount) totalCount.textContent = totalUsers;
        if (activeCount) activeCount.textContent = activeUsers;
        if (inactiveCount) inactiveCount.textContent = inactiveUsers;
    }
    
    /**
     * 更新統計資訊
     */
    function updateStatistics() {
        // 更新部門統計
        const deptCount = document.querySelector('#departmentCount span');
        if (deptCount) {
            deptCount.textContent = departments.length;
        }
        
        // 更新角色統計
        const roleCount = document.querySelector('#roleCount span');
        if (roleCount) {
            roleCount.textContent = roles.length;
        }
        
        // 更新用戶統計
        const userCount = document.querySelector('#userCount span');
        if (userCount) {
            userCount.textContent = users.length;
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
        // 新增按鈕
        const addDeptBtn = document.getElementById('addDepartmentBtn');
        if (addDeptBtn) {
            addDeptBtn.addEventListener('click', showAddDepartmentModal);
        }
        
        const addRoleBtn = document.getElementById('addRoleBtn');
        if (addRoleBtn) {
            addRoleBtn.addEventListener('click', showAddRoleModal);
        }
        
        const addUserBtn = document.getElementById('addUserBtn');
        if (addUserBtn) {
            addUserBtn.addEventListener('click', showAddUserModal);
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
        
        // 部門搜尋功能
        const deptSearchInput = document.getElementById('deptSearchInput');
        if (deptSearchInput) {
            deptSearchInput.addEventListener('input', debounce(searchDepartment, 300));
            // Enter 鍵觸發搜尋
            deptSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    searchDepartment();
                }
            });
        }
        
        // 角色搜尋功能
        const roleSearchInput = document.getElementById('roleSearchInput');
        if (roleSearchInput) {
            roleSearchInput.addEventListener('input', debounce(searchRole, 300));
            // Enter 鍵觸發搜尋
            roleSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    searchRole();
                }
            });
        }
    }
    
    /**
     * 綁定模態框事件
     */
    function bindModalEvents() {
        // 關閉按鈕事件
        window.closeDepartmentModal = () => closeModal('departmentModal');
        window.closeRoleModal = () => closeModal('roleModal');
        window.closeUserModal = () => closeModal('userModal');
        
        // 儲存按鈕事件
        window.saveDepartment = saveDepartment;
        window.saveRole = saveRole;
        window.saveUser = saveUser;
    }
    
    /**
     * 綁定表單事件
     */
    function bindFormEvents() {
        // 表單提交事件
        const deptForm = document.getElementById('departmentForm');
        if (deptForm) {
            deptForm.addEventListener('submit', (e) => {
                e.preventDefault();
                saveDepartment();
            });
        }
        
        const roleForm = document.getElementById('roleForm');
        if (roleForm) {
            roleForm.addEventListener('submit', (e) => {
                e.preventDefault();
                saveRole();
            });
        }
        
        const userForm = document.getElementById('userForm');
        if (userForm) {
            userForm.addEventListener('submit', (e) => {
                e.preventDefault();
                saveUser();
            });
        }
    }
    
    /**
     * 綁定樹狀結構事件
     */
    function bindTreeEvents() {
        // 綁定展開/收合事件
        document.querySelectorAll('.node-toggle:not(.invisible)').forEach(toggle => {
            toggle.addEventListener('click', function(e) {
                e.stopPropagation();
                const node = this.closest('.tree-node');
                const children = node.querySelector('.tree-children');
                const icon = this.querySelector('i');
                
                if (children) {
                    const isExpanded = children.classList.contains('expanded');
                    
                    if (isExpanded) {
                        // 收合
                        children.classList.remove('expanded');
                        if (icon) {
                            icon.classList.remove('fa-chevron-down');
                            icon.classList.add('fa-chevron-right');
                        }
                    } else {
                        // 展開
                        children.classList.add('expanded');
                        if (icon) {
                            icon.classList.remove('fa-chevron-right');
                            icon.classList.add('fa-chevron-down');
                        }
                    }
                }
            });
        });
        
        // 綁定選擇事件
        document.querySelectorAll('.node-content').forEach(content => {
            content.addEventListener('click', function(e) {
                // 防止點擊按鈕時觸發選擇
                if (e.target.closest('.node-actions')) {
                    return;
                }
                
                document.querySelectorAll('.node-content').forEach(c => c.classList.remove('selected'));
                this.classList.add('selected');
                const nodeId = this.closest('.tree-node').dataset.id;
                showDepartmentDetails(nodeId);
            });
        });
        
        // 綁定拖曳事件
        bindDragEvents();
    }
    
    /**
     * 綁定拖曳事件
     */
    function bindDragEvents() {
        let draggedElement = null;
        let draggedDeptId = null;
        
        document.querySelectorAll('.tree-node').forEach(node => {
            // 只允許非根節點被拖曳
            if (node.dataset.id === 'root') {
                node.setAttribute('draggable', 'false');
            }
            
            // 開始拖曳
            node.addEventListener('dragstart', function(e) {
                // 阻止事件冒泡，避免父節點也被拖曳
                e.stopPropagation();
                
                // 檢查是否點擊了操作按鈕（編輯、刪除），如果是則不允許拖曳
                if (e.target.closest('.node-actions') || e.target.closest('.btn-icon')) {
                    e.preventDefault();
                    return;
                }
                
                // 檢查是否為根節點
                if (this.dataset.id === 'root') {
                    e.preventDefault();
                    return;
                }
                
                draggedElement = this;
                draggedDeptId = this.dataset.id;
                this.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', this.innerHTML);
            });
            
            // 拖曳經過
            node.addEventListener('dragover', function(e) {
                if (e.preventDefault) {
                    e.preventDefault();
                }
                e.dataTransfer.dropEffect = 'move';
                
                const targetDeptId = this.dataset.id;
                
                // 清除之前的樣式
                this.classList.remove('drag-over', 'drag-invalid', 'drag-over-top', 'drag-over-bottom');
                
                // 根節點特殊處理
                if (targetDeptId === 'root') {
                    this.classList.add('drag-over');
                    this.dataset.dropPosition = 'inside';
                    return false;
                }
                
                // 不能拖到自己
                if (draggedDeptId === targetDeptId) {
                    this.classList.add('drag-invalid');
                    delete this.dataset.dropPosition;
                    return false;
                }
                
                // 不能拖到子部門
                if (isDescendant(draggedDeptId, targetDeptId)) {
                    this.classList.add('drag-invalid');
                    delete this.dataset.dropPosition;
                    return false;
                }
                
                // 檢查是否為同級節點
                const draggedDept = departments.find(d => d.id == draggedDeptId);
                const targetDept = departments.find(d => d.id == targetDeptId);
                const isSibling = draggedDept && targetDept && 
                                 draggedDept.parent_id === targetDept.parent_id;
                
                // 使用內容區域的邊界來判斷位置（排除縮排影響）
                const content = this.querySelector('.node-content');
                const rect = content ? content.getBoundingClientRect() : this.getBoundingClientRect();
                const y = e.clientY - rect.top;
                const height = rect.height;
                
                // 同級節點之間只允許排序（before/after）
                if (isSibling) {
                    const threshold = 0.5; // 50% 作為分界線
                    if (y < height * threshold) {
                        // 上半部：插入到目標之前
                        this.classList.add('drag-over-top');
                        this.dataset.dropPosition = 'before';
                    } else {
                        // 下半部：插入到目標之後
                        this.classList.add('drag-over-bottom');
                        this.dataset.dropPosition = 'after';
                    }
                } else {
                    // 非同級節點：允許三種位置
                    const threshold = 0.3; // 30% 的區域作為邊界
                    if (y < height * threshold) {
                        // 上部：插入到目標之前（成為兄弟）
                        this.classList.add('drag-over-top');
                        this.dataset.dropPosition = 'before';
                    } else if (y > height * (1 - threshold)) {
                        // 下部：插入到目標之後（成為兄弟）
                        this.classList.add('drag-over-bottom');
                        this.dataset.dropPosition = 'after';
                    } else {
                        // 中間：作為子部門
                        this.classList.add('drag-over');
                        this.dataset.dropPosition = 'inside';
                    }
                }
                
                return false;
            });
            
            // 拖曳進入
            node.addEventListener('dragenter', function(e) {
                // 不處理子元素的進入事件
                if (e.target === this || e.target.closest('.tree-node') === this) {
                    const targetDeptId = this.dataset.id;
                    if (canDropHere(draggedDeptId, targetDeptId)) {
                        this.classList.add('drag-over');
                    } else {
                        this.classList.add('drag-invalid');
                    }
                }
            });
            
            // 拖曳離開
            node.addEventListener('dragleave', function(e) {
                // 確保是離開整個節點，而不是內部元素
                if (e.target === this || !this.contains(e.relatedTarget)) {
                    this.classList.remove('drag-over', 'drag-invalid', 'drag-over-top', 'drag-over-bottom');
                    delete this.dataset.dropPosition;
                }
            });
            
            // 放置
            node.addEventListener('drop', function(e) {
                if (e.stopPropagation) {
                    e.stopPropagation();
                }
                e.preventDefault();
                
                this.classList.remove('drag-over', 'drag-invalid', 'drag-over-top', 'drag-over-bottom');
                
                const targetDeptId = this.dataset.id;
                const dropPosition = this.dataset.dropPosition || 'inside';
                
                // 清除位置數據
                delete this.dataset.dropPosition;
                
                // 檢查是否可以放置
                if (draggedDeptId === targetDeptId) {
                    return false;
                }
                
                if (targetDeptId !== 'root' && isDescendant(draggedDeptId, targetDeptId)) {
                    showError('不能將部門移動到其子部門下');
                    return false;
                }
                
                // 執行部門移動和排序
                moveDepartmentWithSort(draggedDeptId, targetDeptId, dropPosition);
                
                return false;
            });
            
            // 拖曳結束
            node.addEventListener('dragend', function(e) {
                this.classList.remove('dragging');
                // 清理所有拖曳相關的樣式和數據
                document.querySelectorAll('.tree-node').forEach(el => {
                    el.classList.remove('drag-over', 'drag-invalid', 'drag-over-top', 'drag-over-bottom');
                    delete el.dataset.dropPosition;
                });
                draggedElement = null;
                draggedDeptId = null;
            });
        });
    }
    
    /**
     * 檢查是否可以放置部門
     */
    function canDropHere(draggedId, targetId) {
        // 可以放置到頂層
        if (targetId === 'root') {
            return true;
        }
        
        // 不能拖曳到自己
        if (draggedId === targetId) {
            return false;
        }
        
        // 不能拖曳到自己的子部門（避免循環引用）
        if (isDescendant(draggedId, targetId)) {
            return false;
        }
        
        return true;
    }
    
    /**
     * 檢查 targetId 是否為 parentId 的子部門
     */
    function isDescendant(parentId, targetId) {
        const parent = departments.find(d => d.id == parentId);
        if (!parent) return false;
        
        // 遞迴檢查所有子部門
        const checkChildren = (deptId) => {
            const children = departments.filter(d => d.parent_id == deptId);
            for (const child of children) {
                if (child.id == targetId) {
                    return true;
                }
                if (checkChildren(child.id)) {
                    return true;
                }
            }
            return false;
        };
        
        return checkChildren(parentId);
    }
    
    /**
     * 計算新的排序值
     */
    function calculateSortOrder(draggedId, targetId, position) {
        const draggedDept = departments.find(d => d.id == draggedId);
        const targetDept = departments.find(d => d.id == targetId);
        
        if (!draggedDept) return 0;
        
        let newParentId = null;
        let siblings = [];
        
        if (position === 'inside' || targetId === 'root') {
            // 作為子部門或移到頂層
            newParentId = targetId === 'root' ? null : targetId;
            siblings = departments.filter(d => {
                if (newParentId === null) {
                    return d.parent_id === null || d.parent_id === 0;
                }
                return d.parent_id == newParentId;
            }).filter(d => d.id != draggedId); // 排除自己
        } else {
            // 作為兄弟部門（before 或 after）
            newParentId = targetDept ? targetDept.parent_id : null;
            siblings = departments.filter(d => {
                if (newParentId === null) {
                    return d.parent_id === null || d.parent_id === 0;
                }
                return d.parent_id == newParentId;
            }).filter(d => d.id != draggedId); // 排除自己
        }
        
        // 按 sort_order 排序
        siblings.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        
        if (position === 'inside' || targetId === 'root') {
            // 放到最後
            const lastOrder = siblings.length > 0 ? 
                (siblings[siblings.length - 1].sort_order || 0) : 0;
            return lastOrder + 100;
        }
        
        // 找到目標位置
        const targetIndex = siblings.findIndex(d => d.id == targetId);
        if (targetIndex === -1) return 100;
        
        if (position === 'before') {
            // 插入到目標之前
            const prevOrder = targetIndex > 0 ? 
                (siblings[targetIndex - 1].sort_order || 0) : 0;
            const targetOrder = siblings[targetIndex].sort_order || 100;
            return (prevOrder + targetOrder) / 2;
        } else {
            // 插入到目標之後
            const targetOrder = siblings[targetIndex].sort_order || 0;
            const nextOrder = targetIndex < siblings.length - 1 ? 
                (siblings[targetIndex + 1].sort_order || 100) : targetOrder + 100;
            return (targetOrder + nextOrder) / 2;
        }
    }
    
    /**
     * 移動部門並更新排序
     */
    async function moveDepartmentWithSort(draggedId, targetId, position) {
        const draggedDept = departments.find(d => d.id == draggedId);
        
        if (!draggedDept) {
            showError('找不到要移動的部門');
            return;
        }
        
        // 計算新的父部門和排序值
        let newParentId = null;
        let targetName = '頂層';
        
        if (position === 'inside') {
            // 作為子部門
            if (targetId === 'root') {
                newParentId = null;
                targetName = '頂層';
            } else {
                const targetDept = departments.find(d => d.id == targetId);
                if (targetDept) {
                    newParentId = parseInt(targetId);
                    targetName = targetDept.name;
                }
            }
        } else {
            // 作為兄弟部門
            const targetDept = departments.find(d => d.id == targetId);
            if (targetDept) {
                newParentId = targetDept.parent_id;
                if (newParentId) {
                    const parentDept = departments.find(d => d.id == newParentId);
                    targetName = parentDept ? parentDept.name : '頂層';
                } else {
                    targetName = '頂層';
                }
            }
        }
        
        // 計算新的排序值
        const newSortOrder = calculateSortOrder(draggedId, targetId, position);
        
        const sourceName = draggedDept.name;
        const positionText = position === 'before' ? '之前' : 
                           position === 'after' ? '之後' : '下';
        
        // 確認對話框
        const targetDept = departments.find(d => d.id == targetId);
        const confirmMessage = position === 'inside' ? 
            `確定要將「${sourceName}」移動到「${targetName}」下嗎？` :
            `確定要將「${sourceName}」移動到「${targetDept ? targetDept.name : '頂層'}」${positionText}嗎？`;
            
        Dialog.confirm(confirmMessage, async () => {
            try {
            // 呼叫 API 更新部門
            const response = await fetch(`${ENDPOINTS.departments}/${draggedId}`, {
                method: 'PUT',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    parent_id: newParentId,
                    sort_order: Math.round(newSortOrder)
                })
            });
            
            if (!response.ok) {
                throw new Error('移動部門失敗');
            }
            
            showSuccess(`已將「${sourceName}」移動完成`);
            
            // 重新載入部門列表
            await loadDepartments();
            
            // 展開目標部門以顯示移動結果
            if (position === 'inside' && targetId !== 'root') {
                const targetNode = document.querySelector(`.tree-node[data-id="${targetId}"]`);
                if (targetNode) {
                    const children = targetNode.querySelector('.tree-children');
                    if (children && !children.classList.contains('expanded')) {
                        children.classList.add('expanded');
                        const toggle = targetNode.querySelector('.node-toggle i');
                        if (toggle) {
                            toggle.classList.remove('fa-chevron-right');
                            toggle.classList.add('fa-chevron-down');
                        }
                    }
                }
            }
            
        } catch (error) {
            showError('移動部門失敗：' + error.message);
        }
        }, {
            title: '確認移動部門',
            type: 'warning'
        });
    }
    
    /**
     * 移動部門到新的上級部門（舊版，保留相容性）
     */
    async function moveDepartment(draggedId, targetId) {
        const draggedDept = departments.find(d => d.id == draggedId);
        
        if (!draggedDept) {
            showError('找不到要移動的部門');
            return;
        }
        
        // 處理移動到頂層的情況
        let targetDept = null;
        let targetName = '頂層';
        let newParentId = null;
        
        if (targetId !== 'root') {
            targetDept = departments.find(d => d.id == targetId);
            if (targetDept) {
                targetName = targetDept.name;
                newParentId = parseInt(targetId);
            }
        }
        
        const sourceName = draggedDept.name;
        
        // 確認對話框
        const confirmMessage = `確定要將「${sourceName}」移動到「${targetName}」下嗎？`;
        Dialog.confirm(confirmMessage, async () => {
            try {
            // 呼叫 API 更新部門
            const response = await fetch(`${ENDPOINTS.departments}/${draggedId}`, {
                method: 'PUT',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    parent_id: newParentId
                })
            });
            
            if (!response.ok) {
                throw new Error('移動部門失敗');
            }
            
            showSuccess(`已將「${sourceName}」移動到「${targetName}」`);
            
            // 重新載入部門列表
            await loadDepartments();
            
            // 展開目標部門以顯示移動結果
            if (targetDept) {
                const targetNode = document.querySelector(`.tree-node[data-id="${targetId}"]`);
                if (targetNode) {
                    const children = targetNode.querySelector('.tree-children');
                    if (children && !children.classList.contains('expanded')) {
                        children.classList.add('expanded');
                        const toggle = targetNode.querySelector('.node-toggle i');
                        if (toggle) {
                            toggle.classList.remove('fa-chevron-right');
                            toggle.classList.add('fa-chevron-down');
                        }
                    }
                }
            }
            
        } catch (error) {
            showError('移動部門失敗：' + error.message);
        }
        }, {
            title: '確認移動部門',
            type: 'warning'
        });
    }
    
    /**
     * 顯示部門詳情
     */
    function showDepartmentDetails(deptId) {
        // 記錄當前選中的部門ID
        selectedDepartmentId = deptId;
        
        const dept = departments.find(d => d.id == deptId);
        if (!dept) return;
        
        // 恢復樹節點的視覺選中狀態
        document.querySelectorAll('.node-content').forEach(c => c.classList.remove('selected'));
        const selectedNode = document.querySelector(`.tree-node[data-id="${deptId}"] .node-content`);
        if (selectedNode) {
            selectedNode.classList.add('selected');
        }
        
        const detailsContent = document.querySelector('.department-details .details-content');
        if (detailsContent) {
            detailsContent.innerHTML = `
                <div class="detail-item">
                    <label>部門名稱：</label>
                    <span>${dept.name}</span>
                </div>
                <div class="detail-item">
                    <label>部門描述：</label>
                    <span>${dept.description || '無'}</span>
                </div>
                <div class="detail-item">
                    <label>成員數量：</label>
                    <span>${dept.user_count || 0} 人</span>
                </div>
                <div class="detail-item">
                    <label>建立時間：</label>
                    <span>${dept.created_at || '未知'}</span>
                </div>
            `;
        }
    }
    
    /**
     * 選擇角色
     */
    function selectRole(roleId) {
        // 記錄當前選中的角色ID
        selectedRoleId = roleId;
        
        // 移除所有角色行的選中狀態
        document.querySelectorAll('#roleTableBody tr').forEach(row => {
            row.classList.remove('selected');
        });
        
        // 為選中的角色行添加選中狀態
        const selectedRow = document.querySelector(`#roleTableBody tr[data-role-id="${roleId}"]`);
        if (selectedRow) {
            selectedRow.classList.add('selected');
        }
        
        // 顯示角色詳情
        showRoleDetails(roleId);
    }
    
    /**
     * 顯示角色詳情
     */
    function showRoleDetails(roleId) {
        const role = allRoles.find(r => r.id == roleId);
        if (!role) return;
        
        const detailsContent = document.querySelector('.role-details .details-content');
        if (detailsContent) {
            detailsContent.innerHTML = `
                <div class="permission-info-content">
                    <div class="role-description">
                        ${role.description || '無描述'}
                    </div>
                    <div class="permission-tags">
                        ${generatePermissionTagsHtml(role)}
                    </div>
                </div>
            `;
        }
    }
    
    /**
     * 生成權限標籤的HTML
     */
    function generatePermissionTagsHtml(role) {
        if (!permissions || permissions.length === 0) {
            return '<span class="text-muted">權限資料載入中...</span>';
        }
        
        const rolePermissions = role.permissions || {};
        
        // 按類別分組權限
        const permissionsByCategory = {};
        permissions.forEach(perm => {
            const category = perm.category || '其他';
            if (!permissionsByCategory[category]) {
                permissionsByCategory[category] = [];
            }
            permissionsByCategory[category].push(perm);
        });
        
        // 生成分類的權限區塊
        const categoryBlocks = Object.keys(permissionsByCategory).map(category => {
            const categoryPermissions = permissionsByCategory[category];
            const permissionTags = categoryPermissions.map(perm => {
                const hasPermission = rolePermissions[perm.code] || false;
                const iconClass = hasPermission ? 'fas fa-check-circle' : 'fas fa-times-circle';
                const tagClass = hasPermission ? 'permission-tag' : 'permission-tag denied';
                
                return `<span class="${tagClass}"><i class="${iconClass}"></i> ${perm.name}</span>`;
            }).join('');
            
            return `
                <div class="permission-category-block">
                    <div class="permission-category-title">${category}</div>
                    <div class="permission-category-tags">
                        ${permissionTags}
                    </div>
                </div>
            `;
        }).join('');
        
        return categoryBlocks || '<span class="text-muted">此角色尚無權限設定</span>';
    }
    
    /**
     * 搜尋部門
     */
    function searchDepartment() {
        const searchInput = document.getElementById('deptSearchInput');
        if (!searchInput) return;
        
        const keyword = searchInput.value.trim().toLowerCase();
        const searchResultCount = document.getElementById('searchResultCount');
        
        if (!keyword) {
            // 清空搜尋，移除所有高亮
            document.querySelectorAll('.tree-node').forEach(node => {
                node.classList.remove('highlight', 'search-hidden');
            });
            if (searchResultCount) {
                searchResultCount.style.display = 'none';
            }
            return;
        }
        
        // 搜尋匹配的部門
        const matchedDepts = departments.filter(dept => 
            dept.name.toLowerCase().includes(keyword) ||
            (dept.code && dept.code.toLowerCase().includes(keyword))
        );
        
        console.log(`搜尋 "${keyword}"，找到 ${matchedDepts.length} 個結果`);
        
        // 更新搜尋結果數量
        if (searchResultCount) {
            searchResultCount.style.display = matchedDepts.length > 0 ? 'inline' : 'none';
            searchResultCount.querySelector('strong').textContent = matchedDepts.length;
        }
        
        // 移除所有高亮
        document.querySelectorAll('.tree-node').forEach(node => {
            node.classList.remove('highlight', 'search-hidden');
        });
        
        if (matchedDepts.length > 0) {
            // 高亮匹配的部門和展開路徑
            matchedDepts.forEach(dept => {
                const node = document.querySelector(`.tree-node[data-id="${dept.id}"]`);
                if (node) {
                    node.classList.add('highlight');
                    // 展開到該節點的路徑
                    expandToNode(dept.id);
                }
            });
            
            // 滾動到第一個匹配項
            const firstMatch = document.querySelector('.tree-node.highlight');
            if (firstMatch) {
                firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }
    
    /**
     * 展開到指定節點的路徑
     */
    function expandToNode(nodeId) {
        const dept = departments.find(d => d.id == nodeId);
        if (!dept) return;
        
        // 找到所有父節點
        const parents = [];
        let current = dept;
        while (current && current.parent_id) {
            const parent = departments.find(d => d.id == current.parent_id);
            if (parent) {
                parents.unshift(parent);
                current = parent;
            } else {
                break;
            }
        }
        
        // 展開所有父節點
        parents.forEach(parent => {
            const parentNode = document.querySelector(`.tree-node[data-id="${parent.id}"]`);
            if (parentNode) {
                const children = parentNode.querySelector('.tree-children');
                const toggle = parentNode.querySelector('.node-toggle i');
                if (children && !children.classList.contains('expanded')) {
                    children.classList.add('expanded');
                    if (toggle) {
                        toggle.classList.remove('fa-chevron-right');
                        toggle.classList.add('fa-chevron-down');
                    }
                }
            }
        });
    }
    
    /**
     * 展開全部
     */
    function expandAll() {
        document.querySelectorAll('.tree-children').forEach(el => {
            el.classList.add('expanded');
        });
        document.querySelectorAll('.node-toggle i').forEach(icon => {
            icon.classList.remove('fa-chevron-right');
            icon.classList.add('fa-chevron-down');
        });
    }
    
    /**
     * 收合全部
     */
    function collapseAll() {
        document.querySelectorAll('.tree-children').forEach(el => {
            el.classList.remove('expanded');
        });
        document.querySelectorAll('.node-toggle i').forEach(icon => {
            icon.classList.remove('fa-chevron-down');
            icon.classList.add('fa-chevron-right');
        });
    }
    
    /**
     * 重新整理樹狀結構
     */
    async function refreshTree() {
        showLoadingState();
        await loadDepartments();
        hideLoadingState();
    }
    
    /**
     * 顯示新增部門模態框
     */
    function showAddDepartmentModal() {
        const modal = document.getElementById('departmentModal');
        if (modal) {
            // 清除表單資料，特別是隱藏的 ID 欄位
            const form = document.getElementById('departmentForm');
            if (form) {
                form.reset();
                document.getElementById('departmentId').value = '';
                document.getElementById('deptCode').value = '';
                document.getElementById('deptName').value = '';
                document.getElementById('parentDepartment').value = '';
                document.getElementById('deptDescription').value = '';
                document.getElementById('deptSort').value = '0';
                document.getElementById('deptActive').checked = true;
            }
            
            // 設定標題為新增
            document.getElementById('departmentModalTitle').textContent = '新增部門';
            
            // 新增模式：確保部門代碼欄位可編輯
            document.getElementById('deptCode').disabled = false;
            
            // 顯示模態框
            modal.classList.add('show');
            loadDepartmentOptions();
        }
    }
    
    /**
     * 顯示新增角色模態框
     */
    async function showAddRoleModal() {
        const modal = document.getElementById('roleModal');
        if (modal) {
            // 清除表單資料
            const form = document.getElementById('roleForm');
            if (form) {
                form.reset();
                document.getElementById('roleId').value = '';
                document.getElementById('roleCode').value = '';
                document.getElementById('roleName').value = '';
                document.getElementById('roleType').value = 'custom';
                // 修正：roleActive 在 HTML 中的實際 ID 是 select 元素，值應該是 "1" 表示啟用
                const roleActiveSelect = document.getElementById('roleActive');
                if (roleActiveSelect) {
                    roleActiveSelect.value = '1';
                }
                // 修正：正確的 ID 是 roleDescription 而不是 roleDesc
                const roleDescription = document.getElementById('roleDescription');
                if (roleDescription) {
                    roleDescription.value = '';
                }
            }
            
            // 設定標題為新增
            document.getElementById('roleModalTitle').textContent = '新增角色';
            
            // 新增模式：確保角色代碼欄位可編輯
            document.getElementById('roleCode').disabled = false;
            
            // 載入權限選項
            await loadPermissionOptions();
            
            // 清除所有權限的勾選（新增角色時預設不勾選任何權限）
            document.querySelectorAll('input[name="permissions"]').forEach(cb => {
                cb.checked = false;
            });
            
            // 顯示模態框
            modal.classList.add('show');
        }
    }
    
    /**
     * 顯示新增用戶模態框
     */
    function showAddUserModal() {
        const modal = document.getElementById('userModal');
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
                
                // 清除所有角色選項
                const roleCheckboxes = form.querySelectorAll('input[name="role_ids"]');
                roleCheckboxes.forEach(cb => cb.checked = false);
            }
            
            // 設定標題為新增
            document.getElementById('userModalTitle').textContent = '新增帳號';
            
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
     * 載入部門選項
     */
    function loadDepartmentOptions(excludeId = null) {
        const select = document.getElementById('parentDepartment');
        if (select) {
            // 如果有排除的 ID，過濾掉該部門及其子部門
            let availableDepts = departments;
            if (excludeId) {
                // 找出所有子部門 ID
                const getAllChildIds = (parentId) => {
                    const childIds = [parentId];
                    const children = departments.filter(d => d.parent_id === parentId);
                    children.forEach(child => {
                        childIds.push(...getAllChildIds(child.id));
                    });
                    return childIds;
                };
                
                const excludeIds = getAllChildIds(excludeId);
                availableDepts = departments.filter(dept => !excludeIds.includes(dept.id));
            }
            
            // 更新選項內容
            select.innerHTML = '<option value="">無（頂層部門）</option>' +
                availableDepts.map(dept => `<option value="${dept.id}">${dept.name}</option>`).join('');
            
            // 如果已經初始化過 SearchableSelect，則重新載入
            if (select.searchableSelectInstance) {
                select.searchableSelectInstance.reload();
            } else if (window.SearchableSelect) {
                // 首次初始化 SearchableSelect
                const searchableOptions = {
                    placeholder: select.dataset.placeholder || '請選擇上級部門...',
                    searchPlaceholder: select.dataset.searchPlaceholder || '搜尋部門名稱...',
                    noResultsText: select.dataset.noResults || '找不到符合的部門',
                    maxHeight: '200px'
                };
                
                const instance = new SearchableSelect(select, searchableOptions);
                select.searchableSelectInstance = instance;
            }
        }
    }
    
    /**
     * 載入權限選項
     */
    function loadPermissionOptions() {
        const container = document.querySelector('.permission-grid');
        if (!container) {
            console.warn('找不到權限容器元素 .permission-grid');
            return;
        }
        
        // 檢查權限列表是否已載入
        if (!permissions || permissions.length === 0) {
            console.warn('權限列表為空，顯示預設訊息');
            container.innerHTML = `
                <div class="text-center text-muted">
                    <p>權限設定載入中或暫無可用權限</p>
                </div>
            `;
            return;
        }
        
        // 按分類分組權限
        const grouped = {};
        permissions.forEach(perm => {
            if (!grouped[perm.category]) {
                grouped[perm.category] = [];
            }
            grouped[perm.category].push(perm);
        });
        
        container.innerHTML = Object.entries(grouped).map(([category, perms]) => `
                <div class="permission-item">
                    <div class="permission-header">
                        <i class="fas fa-shield-alt"></i>
                        ${category}
                    </div>
                    <div class="permission-actions">
                        ${perms.map(perm => `
                            <label>
                                <input type="checkbox" name="permissions" value="${perm.id}">
                                ${perm.name}
                            </label>
                        `).join('')}
                    </div>
                </div>
            `).join('');
    }
    
    /**
     * 載入用戶表單選項
     */
    function loadUserFormOptions() {
        // 載入部門選項
        const deptSelect = document.getElementById('userDepartment');
        if (deptSelect) {
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
        
        // 載入角色選項
        const rolesContainer = document.querySelector('.role-checkboxes');
        if (rolesContainer) {
            rolesContainer.innerHTML = roles.map(role => `
                <label>
                    <input type="checkbox" name="role_ids" value="${role.id}">
                    ${role.name}
                </label>
            `).join('');
        }
    }
    
    /**
     * 儲存部門
     */
    async function saveDepartment() {
        const form = document.getElementById('departmentForm');
        if (!form) return;
        
        const formData = new FormData(form);
        const departmentId = formData.get('id');
        const isEdit = departmentId && departmentId !== '';
        
        // 前端驗證：根據新增/編輯模式檢查必填欄位
        const name = formData.get('name');
        
        // 檢查 name 是否為空或只含空白字元（新增和編輯都需要）
        if (!name || name.trim() === '') {
            showError('部門名稱為必填欄位，請輸入有效的部門名稱');
            return;
        }
        
        // 建立基本資料
        const data = {
            name: name.trim(),  // 去除前後空白
            description: formData.get('description') || null,
            parent_id: formData.get('parent_id') || null,
            sort_order: parseInt(formData.get('sort_order')) || 0,
            is_active: formData.get('is_active') === 'on'
        };
        
        // 新增模式：額外檢查和加入部門代碼
        if (!isEdit) {
            const code = formData.get('code');
            if (!code || code.trim() === '') {
                showError('部門代碼為必填欄位，請輸入有效的部門代碼');
                return;
            }
            data.code = code.trim();  // 只在新增時加入代碼
        }
        
        try {
            const url = isEdit ? `${ENDPOINTS.departments}/${departmentId}` : ENDPOINTS.departments;
            const method = isEdit ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                throw new Error('儲存失敗');
            }
            
            showSuccess(isEdit ? '部門更新成功' : '部門新增成功');
            closeModal('departmentModal');
            await loadDepartments();
            updateStatistics();
            
            // 編輯模式：選中剛編輯的部門
            // 新增模式：保持原有選中狀態（如果有的話）
            if (isEdit) {
                // 選中剛編輯的部門
                showDepartmentDetails(departmentId);
            } else if (selectedDepartmentId) {
                // 新增模式下，如果之前有選中的部門，重新顯示其詳情
                showDepartmentDetails(selectedDepartmentId);
            }
        } catch (error) {
            showError('儲存部門失敗：' + error.message);
        }
    }
    
    /**
     * 儲存角色
     */
    async function saveRole() {
        const form = document.getElementById('roleForm');
        if (!form) return;
        
        const formData = new FormData(form);
        const roleId = formData.get('id');
        const isEdit = roleId && roleId !== '';
        
        // 前端驗證：根據新增/編輯模式檢查必填欄位
        const name = formData.get('name');
        
        // 檢查 name 是否為空或只含空白字元（新增和編輯都需要）
        if (!name || name.trim() === '') {
            showError('角色名稱為必填欄位，請輸入有效的角色名稱');
            return;
        }
        
        // 新增模式：額外檢查角色代碼
        if (!isEdit) {
            const code = formData.get('code');
            if (!code || code.trim() === '') {
                showError('角色代碼為必填欄位，請輸入有效的角色代碼');
                return;
            }
        }
        
        const permissionsData = {};
        
        // 檢查權限列表是否已載入
        if (!permissions || permissions.length === 0) {
            console.warn('權限列表尚未載入，將嘗試不包含權限資料儲存');
        } else {
            // 收集權限設定 - 只收集 name="permissions" 的 checkbox
            form.querySelectorAll('input[name="permissions"]:checked').forEach(cb => {
                // 使用 checkbox 的 value 作為權限 ID
                const permId = cb.value;
                // 從權限列表中找到對應的權限（使用模組內的 permissions 變數）
                const perm = permissions.find(p => p.id === permId || p.code === permId);
                if (perm) {
                    // 使用權限的 code 作為 key
                    permissionsData[perm.code || permId] = true;
                }
            });
        }
        
        // 建立基本資料
        const data = {
            name: name.trim(),  // 去除前後空白
            role_type: formData.get('type'),  // 修正：使用 role_type 對應後端模型
            is_active: formData.get('is_active') === '1',
            description: formData.get('description'),
            permissions: permissionsData
        };
        
        // 新增模式：加入角色代碼
        if (!isEdit) {
            const code = formData.get('code');
            data.code = code.trim();  // 只在新增時加入代碼
        }
        
        try {
            const url = isEdit ? `${ENDPOINTS.roles}/${roleId}` : ENDPOINTS.roles;
            const method = isEdit ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                throw new Error('儲存失敗');
            }
            
            showSuccess(isEdit ? '角色更新成功' : '角色新增成功');
            closeModal('roleModal');
            await loadRoles();
            updateStatistics();
            
            // 如果有選中的角色，重新顯示其詳細資訊
            if (selectedRoleId) {
                // 檢查選中的角色是否還存在（可能被刪除）
                const selectedRole = allRoles.find(r => r.id == selectedRoleId);
                if (selectedRole) {
                    // 重新選擇該角色，這會更新選中狀態和詳細資訊
                    selectRole(selectedRoleId);
                } else {
                    // 如果選中的角色不存在了，清除選中狀態
                    selectedRoleId = null;
                }
            }
        } catch (error) {
            showError('儲存角色失敗：' + error.message);
        }
    }
    
    /**
     * 儲存用戶
     */
    async function saveUser() {
        const form = document.getElementById('userForm');
        if (!form) return;
        
        const formData = new FormData(form);
        const userId = formData.get('id');
        const isEdit = userId && userId !== '';
        const roles = Array.from(form.querySelectorAll('input[name="role_ids"]:checked'))
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
            role_ids: roles,
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
            closeModal('userModal');
            await loadUsers();
            updateStatistics();
        } catch (error) {
            showError('儲存用戶失敗：' + error.message);
        }
    }
    
    /**
     * 編輯部門
     */
    async function editDepartment(id) {
        const dept = departments.find(d => d.id === id);
        if (!dept) return;
        
        // 先載入部門選項（排除自己和子部門，避免循環引用）
        loadDepartmentOptions(id);
        
        // 填充表單
        document.getElementById('departmentId').value = dept.id;
        document.getElementById('deptCode').value = dept.code;
        document.getElementById('deptName').value = dept.name;
        document.getElementById('deptDescription').value = dept.description || '';
        document.getElementById('deptSort').value = dept.sort_order || 0;
        document.getElementById('deptActive').checked = dept.is_active;
        
        // 編輯模式：禁用部門代碼欄位（不可編輯）
        document.getElementById('deptCode').disabled = true;
        
        // 延遲設定父部門選項，確保選項已載入並且 SearchableSelect 初始化完成
        setTimeout(() => {
            const parentSelect = document.getElementById('parentDepartment');
            parentSelect.value = dept.parent_id || '';
            
            // 如果使用了 SearchableSelect，也要更新其顯示
            if (parentSelect.searchableSelectInstance) {
                parentSelect.searchableSelectInstance.setValue(dept.parent_id || '');
            }
        }, 150);
        
        // 修改標題
        document.getElementById('departmentModalTitle').textContent = '編輯部門';
        
        // 顯示模態框
        showModal('departmentModal');
    }
    
    /**
     * 編輯角色
     */
    async function editRole(id) {
        const role = roles.find(r => r.id === id);
        if (!role) return;
        
        // 填充基本資料
        document.getElementById('roleId').value = role.id;
        document.getElementById('roleCode').value = role.code;
        document.getElementById('roleName').value = role.name;
        // 確保使用正確的選項值 ("custom" 或 "system")
        const roleTypeValue = role.role_type || role.type;
        document.getElementById('roleType').value = roleTypeValue === 'system' ? 'system' : 'custom';
        document.getElementById('roleActive').value = role.is_active ? '1' : '0';
        document.getElementById('roleDescription').value = role.description || '';
        
        // 編輯模式：禁用角色代碼欄位（不可編輯）
        document.getElementById('roleCode').disabled = true;
        
        // 先載入權限選項
        await loadPermissionOptions();
        
        // 填充權限設定
        const rolePermissions = role.permissions || {};
        
        // 先清除所有權限的勾選
        document.querySelectorAll('input[name="permissions"]').forEach(cb => {
            cb.checked = false;
        });
        
        // 檢查權限列表是否已載入
        if (!permissions || permissions.length === 0) {
            console.warn('權限列表尚未載入，無法填充權限設定');
        } else {
            // 根據角色權限勾選對應的 checkbox
            for (const [permCode, value] of Object.entries(rolePermissions)) {
                if (value) {
                    // 找到對應的權限（使用模組內的 permissions 變數）
                    const perm = permissions.find(p => p.code === permCode || p.id === permCode);
                    if (perm) {
                        // 找到對應的 checkbox 並勾選
                        const checkbox = document.querySelector(`input[name="permissions"][value="${perm.id}"]`);
                        if (checkbox) {
                            checkbox.checked = true;
                        }
                    }
                }
            }
        }
        
        // 修改標題
        document.getElementById('roleModalTitle').textContent = '編輯角色';
        
        // 顯示模態框
        showModal('roleModal');
    }
    
    /**
     * 編輯用戶
     */
    async function editUser(id) {
        const user = users.find(u => u.user_id === id);
        if (!user) return;
        
        // 先載入表單選項（重要！確保部門和角色選項存在）
        loadUserFormOptions();
        
        // 填充基本資料
        document.getElementById('userId').value = user.user_id;
        document.getElementById('userLoginid').value = user.loginid;
        document.getElementById('userUsername').value = user.username;
        document.getElementById('userEmail').value = user.email;
        document.getElementById('userEmployeeNo').value = user.user_extension?.employee_no || '';
        
        // 編輯模式：禁用使用者帳號欄位（不可編輯）
        document.getElementById('userLoginid').disabled = true;
        
        // 延遲設定部門和角色，確保選項已經載入並渲染
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
            
            // 填充角色
            const userRoleIds = user.roles.map(r => r.id);
            document.querySelectorAll('.role-checkboxes input[type="checkbox"]').forEach(cb => {
                cb.checked = userRoleIds.includes(parseInt(cb.value));
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
        document.getElementById('userModalTitle').textContent = '編輯使用者';
        
        // 顯示模態框
        showModal('userModal');
    }
    
    /**
     * 刪除部門（軟刪除：設為停用狀態）
     */
    async function deleteDepartment(id) {
        const dept = departments.find(d => d.id === id);
        const deptName = dept ? dept.name : '此部門';
        
        Dialog.confirm(`確定要停用部門「${deptName}」嗎？<br><small class="text-muted">停用後可透過編輯功能重新啟用</small>`, async () => {
            try {
                const response = await fetch(`${ENDPOINTS.departments}/${id}`, {
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
                
                showSuccess('部門已停用，可透過編輯功能重新啟用');
                await loadDepartments();
                updateStatistics();
            } catch (error) {
                showError('停用部門失敗：' + error.message);
            }
        }, {
            allowHTML: true
        });
    }
    
    /**
     * 刪除角色（軟刪除：設為停用狀態）
     */
    async function deleteRole(id) {
        const role = roles.find(r => r.id === id);
        
        // 雙重檢查：如果角色已經停用，直接返回不執行任何操作
        if (role && !role.is_active) {
            return;
        }
        
        const roleName = role ? role.name : '此角色';
        
        Dialog.confirm(`確定要停用角色「${roleName}」嗎？<br><small class="text-muted">停用後可透過編輯功能重新啟用</small>`, async () => {
            try {
                const response = await fetch(`${ENDPOINTS.roles}/${id}`, {
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
                
                showSuccess('角色已停用，可透過編輯功能重新啟用');
                await loadRoles();
                updateStatistics();
                
                // 如果刪除的是當前選中的角色，清除選中狀態並清空詳情區塊
                if (selectedRoleId == id) {
                    selectedRoleId = null;
                    const detailsContent = document.querySelector('.role-details .details-content');
                    if (detailsContent) {
                        detailsContent.innerHTML = '<p class="text-muted">請選擇一個角色查看詳情</p>';
                    }
                }
            } catch (error) {
                showError('停用角色失敗：' + error.message);
            }
        }, {
            allowHTML: true
        });
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
                        status: 'disabled'
                    })
                });
                
                if (!response.ok) {
                    throw new Error('停用失敗');
                }
                
                showSuccess('用戶已停用，可透過編輯功能重新啟用');
                await loadUsers();
                updateStatistics();
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
     * 搜尋角色
     */
    function searchRole() {
        const searchInput = document.getElementById('roleSearchInput');
        if (!searchInput) return;
        
        const keyword = searchInput.value.trim().toLowerCase();
        
        // 如果沒有關鍵字，顯示所有角色
        if (!keyword) {
            renderRoleTable();
            return;
        }
        
        // 過濾符合條件的角色
        const filteredRoles = roles.filter(role => 
            (role.name && role.name.toLowerCase().includes(keyword)) ||
            (role.code && role.code.toLowerCase().includes(keyword))
        );
        
        // 渲染過濾後的角色表格
        renderRoleTableWithFiltered(filteredRoles);
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
     * 初始化滾動條淡出淡入效果
     */
    function initScrollFadeEffect() {
        // 同時處理所有具有 scrollable-fade class 的元素（包括 tbody）
        const scrollables = document.querySelectorAll('.scrollable-fade, tbody.scrollable-fade');
        
        scrollables.forEach(element => {
            let scrollTimeout;
            
            // 移除舊的事件監聽器（防止重複綁定）
            if (element._scrollHandler) {
                element.removeEventListener('scroll', element._scrollHandler);
            }
            
            // 建立新的滾動處理函數
            element._scrollHandler = function() {
                // 添加滾動中的樣式
                element.classList.add('scrolling');
                
                // 如果是 tbody，也為其 wrapper 添加樣式（用於陰影效果）
                if (element.tagName === 'TBODY') {
                    const wrapper = element.closest('.role-table-wrapper, .user-table-wrapper');
                    if (wrapper) {
                        wrapper.classList.add('scrolling');
                    }
                }
                
                // 清除之前的計時器
                clearTimeout(scrollTimeout);
                
                // 設定新的計時器，1.5秒後移除滾動樣式
                scrollTimeout = setTimeout(() => {
                    element.classList.remove('scrolling');
                    
                    // 如果是 tbody，也移除 wrapper 的樣式
                    if (element.tagName === 'TBODY') {
                        const wrapper = element.closest('.role-table-wrapper, .user-table-wrapper');
                        if (wrapper) {
                            wrapper.classList.remove('scrolling');
                        }
                    }
                }, 1500);
            };
            
            // 綁定滾動事件
            element.addEventListener('scroll', element._scrollHandler);
        });
    }
    
    // 公開 API
    return {
        init: init,
        saveDepartment: saveDepartment,
        saveRole: saveRole,
        saveUser: saveUser,
        editDepartment: editDepartment,
        editRole: editRole,
        editUser: editUser,
        deleteDepartment: deleteDepartment,
        deleteRole: deleteRole,
        deleteUser: deleteUser,
        searchDepartment: searchDepartment,
        searchRole: searchRole,
        selectRole: selectRole,
        toggleInactiveDepts: toggleInactiveDepts,
        toggleInactiveRoles: toggleInactiveRoles,
        toggleInactiveUsers: toggleInactiveUsers,
        expandAll: expandAll,
        collapseAll: collapseAll,
        refreshTree: refreshTree,
        refresh: loadAllData,
        showModal: showModal,
        closeModal: closeModal
    };
})();

// 確保模組可被全域存取
window.OrganizationModule = OrganizationModule;

// 全域函數（供 HTML onclick 使用）
window.saveDepartment = OrganizationModule.saveDepartment || function() {
    OrganizationModule.init().then(() => {
        const module = window.OrganizationModule;
        if (module && module.saveDepartment) {
            module.saveDepartment();
        }
    });
};

window.saveRole = OrganizationModule.saveRole || function() {
    OrganizationModule.init().then(() => {
        const module = window.OrganizationModule;
        if (module && module.saveRole) {
            module.saveRole();
        }
    });
};

window.saveUser = OrganizationModule.saveUser || function() {
    OrganizationModule.init().then(() => {
        const module = window.OrganizationModule;
        if (module && module.saveUser) {
            module.saveUser();
        }
    });
};

window.closeDepartmentModal = function() {
    const modal = document.getElementById('departmentModal');
    if (modal) {
        modal.classList.remove('show');
        const form = modal.querySelector('form');
        if (form) form.reset();
    }
};

window.closeRoleModal = function() {
    const modal = document.getElementById('roleModal');
    if (modal) {
        modal.classList.remove('show');
        const form = modal.querySelector('form');
        if (form) form.reset();
    }
};

window.closeUserModal = function() {
    const modal = document.getElementById('userModal');
    if (modal) {
        modal.classList.remove('show');
        const form = modal.querySelector('form');
        if (form) form.reset();
    }
};

window.togglePasswordField = function() {
    const strategy = document.getElementById('passwordStrategy').value;
    const passwordGroup = document.getElementById('manualPasswordGroup');
    if (passwordGroup) {
        passwordGroup.style.display = strategy === 'MANUAL' ? 'block' : 'none';
    }
};