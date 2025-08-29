/**
 * 組織角色管理模組
 * 處理角色模板、部門角色的 CRUD 操作
 */
const OrganizationRolesModule = (function() {
    'use strict';
    
    // API 端點
    const API_BASE = '/api/organization';
    
    // 數據存儲
    let departmentRoles = [];
    let currentDepartmentId = null;
    let currentRoleId = null;
    let deptTreeData = [];
    let selectedDeptId = null;
    let selectedRoleId = null;
    let showInactiveRoles = false;
    let departmentRolesCache = {}; // 緩存部門角色資料
    let isRoleManagementInitialized = false; // 角色管理初始化標記
    
    // 部門變更相關變數
    let originalDepartmentId = null;  // 儲存原始部門ID
    let departmentChanged = false;    // 標記部門是否變更
    let movePreviewData = null;       // 儲存移動預覽資訊
    
    // 角色用戶懸浮卡片相關變數
    let roleUsersHoverBackdrop = null;
    let roleUsersHoverCard = null;
    let currentRoleUsers = [];
    let filteredRoleUsers = [];
    
    // 角色拖曳相關變數
    let draggedRole = null;
    
    // 角色模板相關變數
    let roleTemplates = [];
    let roleTemplateModule = null;
    
    /**
     * 初始化模組
     */
    async function init() {
        console.log('OrganizationRolesModule 初始化開始');
        
        // 初始化角色模板子模組
        if (window.__OrganizationRoleTemplateModule) {
            roleTemplateModule = window.__OrganizationRoleTemplateModule;
            roleTemplates = await roleTemplateModule.init() || [];
        }
        
        // 綁定事件
        bindEvents();
        
        // 綁定角色管理相關事件（確保搜尋功能可用）
        bindRoleManagementEvents();
        
        // 初始化角色用戶懸浮卡片
        initRoleUsersHoverCard();
        
        console.log('OrganizationRolesModule 初始化完成');
    }
    
    /**
     * 綁定事件
     */
    function bindEvents() {
        // 事件綁定由各子模組處理
    }
    
    
    
    
    
    /**
     * 關閉部門角色模態框
     */
    function closeDepartmentRoleModal() {
        const modal = document.getElementById('departmentRoleModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }
    
    /**
     * 關閉新增部門角色模態框
     */
    function closeAddDepartmentRoleModal() {
        const modal = document.getElementById('addDepartmentRoleModal');
        if (modal) {
            modal.classList.remove('show');
            const form = document.getElementById('addDepartmentRoleForm');
            if (form) form.reset();
        }
    }
    
    /**
     * 關閉編輯角色模態框
     */
    function closeEditDepartmentRoleModal() {
        const modal = document.getElementById('editDepartmentRoleModal');
        if (modal) {
            modal.classList.remove('show');
            const form = document.getElementById('editDepartmentRoleForm');
            if (form) form.reset();
        }
    }
    
    /**
     * 關閉角色詳情模態框
     */
    function closeRoleDetailsModal() {
        const modal = document.getElementById('roleDetailsModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }
    
    
    
    
    
    /**
     * 載入部門角色選擇器（用於新增部門時，包裝函數）
     */
    async function loadRoleTemplateSelector(containerId = 'roleTemplateSelector') {
        // 調用角色模板子模組的函數
        if (roleTemplateModule) {
            await roleTemplateModule.loadRoleTemplateSelector(containerId, roleTemplates);
        }
    }
    
    /**
     * 載入部門角色
     */
    async function loadDepartmentRoles(departmentId) {
        try {
            const response = await fetch(`${API_BASE}/departments/${departmentId}/roles`, {
                method: 'GET',
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('載入部門角色失敗');
            }
            
            departmentRoles = await response.json();
            currentDepartmentId = departmentId;
            
            return departmentRoles;
            
        } catch (error) {
            console.error('載入部門角色失敗:', error);
            return [];
        }
    }
    
    /**
     * 建立部門角色（批量）
     */
    async function createDepartmentRoles(departmentId, selectedTemplates) {
        try {
            const response = await fetch(`${API_BASE}/departments/${departmentId}/roles/batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    department_id: departmentId,
                    role_templates: selectedTemplates
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || '建立角色失敗');
            }
            
            const result = await response.json();
            
            // 更新緩存中的角色數據
            if (result.created_roles && Array.isArray(result.created_roles)) {
                if (!departmentRolesCache[departmentId]) {
                    departmentRolesCache[departmentId] = [];
                }
                departmentRolesCache[departmentId].push(...result.created_roles);
                
                // 通知角色統計數據已更新
                notifyRoleStatsChanged();
            }
            
            // 返回完整的結果物件，包含 created_roles 和可能的錯誤資訊
            return result;
            
        } catch (error) {
            console.error('建立部門角色失敗:', error);
            throw error;
        }
    }
    
    /**
     * 渲染部門樹狀結構中的角色
     */
    function renderDepartmentRoles(roles, container) {
        if (!roles || roles.length === 0) return '';
        
        const html = roles.map(role => `
            <div class="role-node" 
                 draggable="true"
                 data-role-id="${role.id}"
                 data-department-id="${role.department_id}">
                <i class="fas ${role.role_type === 'manager' ? 'fa-user-tie text-primary' : 'fa-user text-success'}"></i>
                <span>${role.name}</span>
                <span class="badge badge-info">${role.user_count || 0}人</span>
            </div>
        `).join('');
        
        // 在渲染後綁定事件（透過事件委派）
        setTimeout(() => bindRoleDragEvents(), 0);
        
        return html;
    }
    
    /**
     * 選擇角色（顯示角色詳情）
     */
    async function selectRole(roleId) {
        currentRoleId = roleId;
        
        // 載入角色用戶
        try {
            const response = await fetch(`${API_BASE}/department-roles/${roleId}/users`, {
                method: 'GET',
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('載入角色用戶失敗');
            }
            
            const users = await response.json();
            const role = departmentRoles.find(r => r.id === roleId);
            
            if (role) {
                showRoleDetails(role, users);
            }
            
        } catch (error) {
            console.error('載入角色用戶失敗:', error);
        }
    }
    
    /**
     * 顯示角色詳情
     */
    function showRoleDetails(role, users) {
        const detailsPanel = document.getElementById('departmentDetails');
        if (!detailsPanel) return;
        
        detailsPanel.innerHTML = `
            <div class="details-card">
                <h3><i class="fas fa-user-tie"></i> 角色資訊</h3>
                <div class="details-content">
                    <p><strong>角色名稱：</strong>${role.name}</p>
                    <p><strong>角色類型：</strong>${role.role_type === 'manager' ? '管理角色' : '員工角色'}</p>
                    <p><strong>所屬部門：</strong>${role.department_name}</p>
                    <p><strong>角色層級：</strong>${role.level}</p>
                    
                    <h4>指派人員 (${users.length})</h4>
                    <div class="user-list scrollable-fade">
                        ${users.length > 0 ? users.map(u => `
                            <div class="user-item">
                                <i class="fas fa-user-circle"></i>
                                <span>${u.username} (${u.loginid})</span>
                                <button class="btn-remove" onclick="OrganizationRolesModule.removeUserFromRole(${u.user_id}, ${role.id})">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        `).join('') : '<p class="text-muted">尚無人員</p>'}
                    </div>
                    
                    <div class="role-actions">
                        <button class="btn btn-sm btn-primary" onclick="OrganizationRolesModule.assignUsersToRole(${role.id})">
                            <i class="fas fa-plus"></i> 指派人員
                        </button>
                        <button class="btn btn-sm btn-outline" onclick="OrganizationRolesModule.editDepartmentRole(${role.id})">
                            <i class="fas fa-edit"></i> 編輯角色
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * 移除用戶的角色
     */
    async function removeUserFromRole(userId, roleId) {
        if (!window.Dialog) return;
        
        Dialog.confirm('確定要移除此用戶的角色嗎？', async () => {
            try {
                const response = await fetch(`${API_BASE}/department-roles/${roleId}/users/${userId}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });
                
                if (!response.ok) {
                    throw new Error('移除失敗');
                }
                
                // 重新載入角色詳情
                await selectRole(roleId);
                Dialog.success('已移除用戶角色');
                
            } catch (error) {
                console.error('移除用戶角色失敗:', error);
                Dialog.error('移除用戶角色失敗');
            }
        });
    }
    
    // ===== 角色管理頁面功能 =====
    
    /**
     * 初始化角色管理頁面
     */
    async function initRoleManagement() {
        // 防止重複初始化
        if (isRoleManagementInitialized) {
            console.log('角色管理已初始化，跳過重複初始化');
            return;
        }
        
        try {
            console.log('開始初始化角色管理頁面');
            
            // 載入部門樹資料（內部已包含事件綁定）
            await loadDepartmentTreeForRoles();
            
            // 標記已初始化
            isRoleManagementInitialized = true;
            
            console.log('角色管理頁面初始化完成');
        } catch (error) {
            console.error('角色管理初始化失敗:', error);
            if (window.Dialog) {
                Dialog.error('角色管理初始化失敗');
            }
        }
    }
    
    /**
     * 重置角色管理初始化狀態
     * 當切換到其他區塊時調用
     */
    function resetRoleManagementState() {
        isRoleManagementInitialized = false;
        console.log('角色管理初始化狀態已重置');
    }
    
    /**
     * 載入部門樹供選擇（包含角色）
     */
    async function loadDepartmentTreeForRoles() {
        try {
            const response = await fetch(`${API_BASE}/departments?tree=true`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('載入部門失敗');
            }
            
            deptTreeData = await response.json();
            
            // 載入所有部門的角色
            await loadAllDepartmentRoles(deptTreeData);
            
            // 在角色管理頁面預設展開第一層
            renderDepartmentTree(deptTreeData, null, true);
            
            // 更新統計
            updateTreeStats();
            
            // 重新綁定樹節點事件（延遲執行確保 DOM 已更新）
            setTimeout(() => {
                bindTreeEventListeners();
            }, 50);
            
        } catch (error) {
            console.error('載入部門樹失敗:', error);
            if (window.Dialog) {
                Dialog.error('載入部門資料失敗');
            }
        }
    }
    
    /**
     * 載入所有部門的角色（優化版本：使用批次 API）
     */
    async function loadAllDepartmentRoles(departments) {
        // 收集所有部門 ID
        const collectDeptIds = (depts) => {
            let ids = [];
            for (const dept of depts) {
                ids.push(dept.id);
                if (dept.children && dept.children.length > 0) {
                    ids = ids.concat(collectDeptIds(dept.children));
                }
            }
            return ids;
        };
        
        const allDeptIds = collectDeptIds(departments);
        
        // 如果沒有部門，直接返回
        if (allDeptIds.length === 0) {
            notifyRoleStatsChanged();
            return;
        }
        
        try {
            // 使用批次 API 一次查詢所有部門的角色
            const response = await fetch(`${API_BASE}/departments/roles/batch?department_ids=${allDeptIds.join(',')}`, {
                credentials: 'include'
            });
            
            if (response.ok) {
                const result = await response.json();
                const rolesByDept = result.data || {};
                
                // 將結果存入快取
                for (const deptId of allDeptIds) {
                    departmentRolesCache[deptId] = rolesByDept[deptId] || [];
                }
            } else {
                console.warn('批次載入角色失敗，使用備用方案');
                // 如果批次 API 失敗，回退到舊的逐個載入方式
                await loadAllDepartmentRolesFallback(departments);
            }
        } catch (error) {
            console.error('批次載入部門角色失敗:', error);
            // 發生錯誤時，回退到舊的逐個載入方式
            await loadAllDepartmentRolesFallback(departments);
        }
        
        // 通知角色統計數據已更新
        notifyRoleStatsChanged();
    }
    
    /**
     * 載入所有部門的角色（備用方案：逐個查詢）
     */
    async function loadAllDepartmentRolesFallback(departments) {
        const loadRolesForDept = async (dept) => {
            try {
                const response = await fetch(`${API_BASE}/departments/${dept.id}/roles`, {
                    credentials: 'include'
                });
                
                if (response.ok) {
                    const roles = await response.json();
                    departmentRolesCache[dept.id] = roles;
                }
            } catch (error) {
                console.error(`載入部門 ${dept.id} 的角色失敗:`, error);
                departmentRolesCache[dept.id] = [];
            }
            
            // 遞迴處理子部門
            if (dept.children) {
                for (const child of dept.children) {
                    await loadRolesForDept(child);
                }
            }
        };
        
        // 載入所有部門的角色
        for (const dept of departments) {
            await loadRolesForDept(dept);
        }
    }
    
    /**
     * 渲染部門樹（包裝函數）
     */
    function renderDepartmentTree(departments, container = null, expandFirstLevel = false) {
        OrganizationRoleTreeModule.renderDepartmentTree(
            departments, 
            container, 
            expandFirstLevel, 
            showInactiveRoles, 
            departmentRolesCache, 
            selectedDeptId, 
            selectedRoleId
        );
    }
        
    /**
    
    /**
     * 切換部門節點展開/收合（包裝函數）
     */
    function toggleDeptNode(deptId) {
        OrganizationRoleTreeModule.toggleDeptNode(deptId);
    }
    
    /**
     * 處理部門節點點擊事件（展開/收合 + 選中）
     */
    async function handleDepartmentNodeClick(deptId) {
        const isSameDept = selectedDeptId === deptId;
        
        if (isSameDept) {
            // 同一部門：切換展開/收合
            const selectedNode = document.querySelector(`.node-content[data-dept-id="${deptId}"]`);
            if (selectedNode) {
                const treeNode = selectedNode.closest('.tree-node');
                const children = treeNode.querySelector('.tree-children');
                const toggle = treeNode.querySelector('.node-toggle i');
                
                if (children && toggle) {
                    // 切換展開/收合狀態
                    children.classList.toggle('expanded');
                    if (children.classList.contains('expanded')) {
                        toggle.classList.remove('fa-chevron-right');
                        toggle.classList.add('fa-chevron-down');
                    } else {
                        toggle.classList.remove('fa-chevron-down');
                        toggle.classList.add('fa-chevron-right');
                    }
                }
            }
        } else {
            // 不同部門：執行選中邏輯
            await selectDepartmentForRoles(deptId);
        }
    }
    
    /**
     * 選擇部門查看角色（用戶手動點擊）
     */
    async function selectDepartmentForRoles(deptId) {
        selectedDeptId = deptId;
        selectedRoleId = null; // 清除角色選擇
        
        // 更新選中狀態
        document.querySelectorAll('.node-content').forEach(node => {
            node.classList.remove('selected');
        });
        document.querySelectorAll('.role-tree-node').forEach(node => {
            node.classList.remove('selected');
        });
        
        const selectedNode = document.querySelector(`.node-content[data-dept-id="${deptId}"]`);
        if (selectedNode) {
            selectedNode.classList.add('selected');
            
            // 展開到目標部門的完整路徑
            expandPathToDepartment(deptId);
        }
        
        // 更新部門名稱顯示
        const dept = findDepartmentById(deptId, deptTreeData);
        if (dept) {
            document.getElementById('selectedDeptName').textContent = `${dept.name} 的角色`;
            document.getElementById('addRoleBtn').disabled = false;
        }
        
        // 載入該部門的角色到右側面板
        await loadDepartmentRolesForManagement(deptId);
        
        // 清除右側角色卡片的高亮狀態（因為已切換到新部門）
        setTimeout(() => {
            document.querySelectorAll('#rolesList .role-card').forEach(card => {
                card.classList.remove('highlighted');
            });
        }, 100);
    }
    
    /**
     * 編輯存檔後導航到部門（關閉其他節點，只展開目標路徑）
     */
    async function navigateToDepartmentAfterEdit(deptId) {
        selectedDeptId = deptId;
        selectedRoleId = null; // 清除角色選擇
        
        // 更新選中狀態
        document.querySelectorAll('.node-content').forEach(node => {
            node.classList.remove('selected');
        });
        document.querySelectorAll('.role-tree-node').forEach(node => {
            node.classList.remove('selected');
        });
        
        // 先關閉所有部門（除了目標部門的父級路徑）
        collapseAllExceptPath(deptId);
        
        const selectedNode = document.querySelector(`.node-content[data-dept-id="${deptId}"]`);
        if (selectedNode) {
            selectedNode.classList.add('selected');
            
            // 展開到目標部門的完整路徑
            expandPathToDepartment(deptId);
        }
        
        // 更新部門名稱顯示
        const dept = findDepartmentById(deptId, deptTreeData);
        if (dept) {
            document.getElementById('selectedDeptName').textContent = `${dept.name} 的角色`;
            document.getElementById('addRoleBtn').disabled = false;
        }
        
        // 載入該部門的角色到右側面板
        await loadDepartmentRolesForManagement(deptId);
    }
    
    /**
     * 選擇角色（僅更新選中狀態，不自動顯示詳情）
     */
    function selectRole(roleId) {
        selectedRoleId = roleId;
        
        // 更新選中狀態
        document.querySelectorAll('.role-tree-node').forEach(node => {
            node.classList.remove('selected');
        });
        const selectedNode = document.querySelector(`.role-tree-node[data-role-id="${roleId}"]`);
        if (selectedNode) {
            selectedNode.classList.add('selected');
        }
        
        // 注意：不再自動顯示角色詳情，改由操作按鈕觸發
    }
    
    /**
     * 選擇角色並顯示所屬部門的角色列表
     */
    async function selectRoleAndShowDepartmentRoles(roleId, deptId) {
        // 更新選中的角色
        selectedRoleId = roleId;
        
        // 更新角色選中狀態
        document.querySelectorAll('.role-tree-node').forEach(node => {
            node.classList.remove('selected');
        });
        const selectedRoleNode = document.querySelector(`.role-tree-node[data-role-id="${roleId}"]`);
        if (selectedRoleNode) {
            selectedRoleNode.classList.add('selected');
        }
        
        // 如果當前選中的部門不是該角色所屬的部門，則切換部門選中狀態
        if (selectedDeptId !== deptId) {
            selectedDeptId = deptId;
            
            // 更新部門選中狀態
            document.querySelectorAll('.node-content').forEach(node => {
                node.classList.remove('selected');
            });
            const selectedDeptNode = document.querySelector(`.node-content[data-dept-id="${deptId}"]`);
            if (selectedDeptNode) {
                selectedDeptNode.classList.add('selected');
                
                // 展開到目標部門的完整路徑
                expandPathToDepartment(deptId);
            }
            
            // 更新部門名稱顯示
            const dept = findDepartmentById(deptId, deptTreeData);
            if (dept) {
                document.getElementById('selectedDeptName').textContent = `${dept.name} 的角色`;
                document.getElementById('addRoleBtn').disabled = false;
            }
        }
        
        // 載入並顯示該部門的角色到右側面板
        await loadDepartmentRolesForManagement(deptId);
        
        // 在右側角色卡片中也高亮選中的角色（如果有的話）
        setTimeout(() => {
            const rightPanelRoleCard = document.querySelector(`#rolesList .role-card[data-role-id="${roleId}"]`);
            if (rightPanelRoleCard) {
                // 移除其他卡片的高亮
                document.querySelectorAll('#rolesList .role-card').forEach(card => {
                    card.classList.remove('highlighted');
                });
                // 高亮選中的卡片
                rightPanelRoleCard.classList.add('highlighted');
                // 滾動到該卡片
                rightPanelRoleCard.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });
            }
        }, 100);
    }
    
    /**
     * 切換顯示/隱藏停用角色
     */
    function toggleInactiveRoles() {
        // 更新按鈕狀態
        const toggleBtn = document.getElementById('toggleInactiveRolesBtn');
        if (toggleBtn) {
            showInactiveRoles = !showInactiveRoles;
            const icon = toggleBtn.querySelector('i');
            if (showInactiveRoles) {
                toggleBtn.classList.add('active');
                icon.className = 'fas fa-eye';
                toggleBtn.title = '隱藏停用';
            } else {
                toggleBtn.classList.remove('active');
                icon.className = 'fas fa-eye-slash';
                toggleBtn.title = '顯示停用';
            }
            
        }      
        // 重新渲染部門樹（保持第一層展開）
        renderDepartmentTree(deptTreeData, null, true);
        // 更新統計
        updateTreeStats();
        
        // 重新綁定樹節點事件
        setTimeout(() => {
            bindTreeEventListeners();
        }, 50);
    }
    
    /**
     * 在樹狀結構中查找部門（包裝函數）
     */
    function findDepartmentById(id, departments) {
        return OrganizationRoleTreeModule.findDepartmentById(id, departments);
    }
    
    /**
     * 載入部門角色用於管理
     */
    async function loadDepartmentRolesForManagement(deptId) {
        try {
            const response = await fetch(`${API_BASE}/departments/${deptId}/roles`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('載入角色失敗');
            }
            
            const roles = await response.json();
            
            // 為每個角色獲取詳細信息（包含父角色）
            const detailedRoles = await Promise.all(roles.map(async (role) => {
                try {
                    const detailResponse = await fetch(`${API_BASE}/department-roles/${role.id}`, {
                        credentials: 'include'
                    });
                    if (detailResponse.ok) {
                        return await detailResponse.json();
                    }
                } catch (error) {
                    console.warn(`無法獲取角色 ${role.id} 的詳細信息:`, error);
                }
                return role; // 如果獲取詳情失敗，使用原始數據
            }));
            
            renderRoleCards(detailedRoles);
            OrganizationRoleAnalysisModule.updateRoleStats(detailedRoles);
            
        } catch (error) {
            console.error('載入部門角色失敗:', error);
            document.getElementById('rolesList').innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle fa-3x text-danger"></i>
                    <p class="text-danger">載入角色失敗</p>
                </div>
            `;
        }
    }
    
    /**
     * 渲染角色卡片
     */
    function renderRoleCards(roles) {
        const container = document.getElementById('rolesList');
        if (!container) return;
        
        console.log('Rendering role cards with data:', roles); // 調試用
        
        if (roles.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users-cog fa-3x text-muted"></i>
                    <p class="text-muted">此部門尚無角色</p>
                    <button class="btn btn-primary" onclick="OrganizationRolesModule.showAddRoleModal()">
                        <i class="fas fa-plus"></i> 新增第一個角色
                    </button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = roles.map(role => {
            // 檢查角色依賴關係
            const dependencies =  OrganizationRoleAnalysisModule.checkRoleDependencies(role.id, role.user_count, departmentRolesCache);
            const isDisabled = dependencies.hasAnyDependency;
            const disableReason = OrganizationRoleAnalysisModule.getDisableReason(dependencies);
            
            return `
            <div class="role-card role-${role.role_type}" data-role-id="${role.id}">
                <div class="role-card-header">
                    <div class="role-info">
                        <i class="fas ${role.role_type === 'manager' ? 'fa-user-tie text-primary' : 'fa-user text-success'}"></i>
                        <span class="role-name">${role.name}</span>
                    </div>
                    <span class="badge ${role.is_active ? 'badge-success' : 'badge-secondary'}">
                        ${role.is_active ? '啟用' : '停用'}
                    </span>
                </div>
                <div class="role-card-body">
                    <div class="role-stats">
                        <span><i class="fas fa-users"></i> ${role.user_count || 0} 位使用者</span>
                        <span><i class="fas fa-layer-group"></i> 層級 ${role.level || 0}</span>
                    </div>
                    <div class="role-template">
                        <small class="text-muted">模板：${role.template_name || '自訂'}</small>
                    </div>
                    ${(role.parent_role_name || role.parent_name || role.parentRoleName) ? `
                    <div class="role-parent">
                        <small class="text-info"><i class="fas fa-arrow-up"></i> 上層角色：${role.parent_role_name || role.parent_name || role.parentRoleName}</small>
                    </div>
                    ` : ''}
                </div>
                <div class="role-card-actions">
                    <button class="btn btn-sm btn-outline" onclick="OrganizationRolesModule.viewRoleDetails(${role.id})" title="檢視詳情">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline" onclick="OrganizationRolesModule.editDepartmentRole(${role.id})" title="編輯">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger ${isDisabled ? 'disabled' : ''}" 
                            ${!isDisabled ? `onclick="OrganizationRolesModule.deleteDepartmentRole(${role.id}, ${role.user_count || 0})"` : ''} 
                            title="${disableReason}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            `;
        }).join('');
    }
    
    /**
     * 更新左側樹狀統計區域（包裝函數）
     */
    function updateTreeStats() {
        OrganizationRoleAnalysisModule.updateTreeStats(deptTreeData, departmentRolesCache, showInactiveRoles);
    }
    
    // 新增：追蹤當前模式
    let isRoleBatchMode = false;
    
    /**
     * 顯示新增角色模態框
     */
    function showAddRoleModal() {
        if (!selectedDeptId) {
            Dialog.warning('請先選擇部門');
            return;
        }
        
        let dept = findDepartmentById(selectedDeptId, deptTreeData);
        
        // 如果找不到部門，嘗試轉換類型後再找一次
        if (!dept) {
            const numericId = parseInt(selectedDeptId);
            const stringId = String(selectedDeptId);
            
            dept = findDepartmentById(numericId, deptTreeData) || 
                   findDepartmentById(stringId, deptTreeData);
            
            if (!dept) {
                Dialog.warning('部門資料已變更，請重新選擇部門');
                return;
            }
        }
        
        document.getElementById('addRoleDeptId').value = selectedDeptId;
        document.getElementById('addRoleDeptName').textContent = dept.name;
        
        // 重置為單一模式
        isRoleBatchMode = false;
        switchToSingleMode();
        
        // 顯示模態框
        const modal = document.getElementById('addDepartmentRoleModal');
        if (modal) {
            modal.classList.add('show');
        // 初始化滾動條效果
        if (window.CommonUI && window.CommonUI.initScrollFadeEffect) {
            setTimeout(() => CommonUI.initScrollFadeEffect(), 100);
        }
        }
    }
    
    /**
     * 切換到單一模式
     */
    function switchToSingleMode() {
        isRoleBatchMode = false;
        
        // 更新按鈕樣式
        const singleBtn = document.getElementById('singleModeBtn');
        const batchBtn = document.getElementById('batchModeBtn');
        if (singleBtn) {
            singleBtn.classList.remove('btn-outline-secondary');
            singleBtn.classList.add('btn-outline-primary');
        }
        if (batchBtn) {
            batchBtn.classList.remove('btn-outline-primary');
            batchBtn.classList.add('btn-outline-secondary');
        }
        
        // 更新提示文字
        const hintText = document.getElementById('modeHintText');
        if (hintText) hintText.textContent = '選擇一個角色模板進行精確新增';
        
        // 顯示/隱藏相關元素
        const singleNameGroup = document.getElementById('singleRoleNameGroup');
        const batchHint = document.getElementById('batchRoleNamesHint');
        const confirmBtnText = document.getElementById('confirmBtnText');
        
        if (singleNameGroup) singleNameGroup.classList.remove('d-none');
        if (batchHint) batchHint.classList.add('d-none');
        if (confirmBtnText) confirmBtnText.textContent = '新增';
        
        // 重新載入模板（單選模式）
        loadRoleTemplatesForAdd(false);
    }
    
    /**
     * 切換到批量模式
     */
    function switchToBatchMode() {
        isRoleBatchMode = true;
        
        // 更新按鈕樣式
        const batchBtn = document.getElementById('batchModeBtn');
        const singleBtn = document.getElementById('singleModeBtn');
        if (batchBtn) {
            batchBtn.classList.remove('btn-outline-secondary');
            batchBtn.classList.add('btn-outline-primary');
        }
        if (singleBtn) {
            singleBtn.classList.remove('btn-outline-primary');
            singleBtn.classList.add('btn-outline-secondary');
        }
        
        // 更新提示文字
        const hintText = document.getElementById('modeHintText');
        if (hintText) hintText.textContent = '選擇多個角色模板進行批量新增';
        
        // 顯示/隱藏相關元素
        const singleNameGroup = document.getElementById('singleRoleNameGroup');
        const batchHint = document.getElementById('batchRoleNamesHint');
        const confirmBtnText = document.getElementById('confirmBtnText');
        
        if (singleNameGroup) singleNameGroup.classList.add('d-none');
        if (batchHint) batchHint.classList.remove('d-none');
        if (confirmBtnText) confirmBtnText.textContent = '批量新增';
        
        // 重新載入模板（多選模式）
        loadRoleTemplatesForAdd(true);
    }
    
    /**
     * 確認新增部門角色
     */
    async function confirmAddDepartmentRole() {
        const form = document.getElementById('addDepartmentRoleForm');
        if (!form) return;
        
        const deptId = document.getElementById('addRoleDeptId').value;
        
        try {
            if (isRoleBatchMode) {
                // 批量模式處理
                const selectedTemplates = form.querySelectorAll('input[name="template_ids[]"]:checked');
                
                if (selectedTemplates.length === 0) {
                    Dialog.warning('請至少選擇一個角色模板');
                    return;
                }
                
                // 收集所有選中的模板和自訂名稱
                const roleRequests = [];
                selectedTemplates.forEach(checkbox => {
                    const templateId = checkbox.value;
                    const nameInput = form.querySelector(`input[name="role_names[${templateId}]"]`);
                    const customName = nameInput ? nameInput.value.trim() : '';
                    
                    roleRequests.push({
                        template_id: parseInt(templateId),
                        name: customName || null
                    });
                });
                
                // 批量新增
                const result = await createDepartmentRoles(deptId, roleRequests);
                
                // 檢查 created_roles 陣列
                if (result.created_roles && result.created_roles.length > 0) {
                    // 檢查是否有失敗的項目
                    const successCount = result.created_roles.length;
                    const requestCount = roleRequests.length;
                    
                    if (successCount < requestCount) {
                        // 部分成功
                        const failedCount = requestCount - successCount;
                        Dialog.warning(`成功新增 ${successCount} 個角色，${failedCount} 個失敗`);
                    } else {
                        // 全部成功
                        Dialog.success(`成功新增 ${successCount} 個角色`);
                    }
                } else {
                    Dialog.error('新增角色失敗');
                }
                
            } else {
                // 單一模式處理
                const selectedTemplate = form.querySelector('input[name="template_id"]:checked');
                
                if (!selectedTemplate) {
                    Dialog.warning('請選擇角色模板');
                    return;
                }
                
                const templateId = selectedTemplate.value;
                const customName = document.getElementById('customRoleName').value.trim();
                
                const result = await createDepartmentRoles(
                    deptId, 
                    [{
                        template_id: parseInt(templateId),
                        name: customName
                    }]
                );
                
                // 檢查結果
                if (result.created_roles && result.created_roles.length > 0) {
                    Dialog.success('角色新增成功');
                } else {
                    Dialog.error('角色新增失敗');
                }
            }
            
            closeAddDepartmentRoleModal();
            
            // 保存當前部門ID，確保不會丟失
            const currentDeptId = deptId;
            
            // 先重新載入左側部門樹以更新角色資訊
            if (refreshDeptTree) {
                await refreshDeptTree();
            }
            
            // 然後重新選擇部門以確保狀態正確
            if (selectDepartmentForRoles) {
                await selectDepartmentForRoles(currentDeptId);
            }
            
            // 強制確保 selectedDeptId 被正確設置
            selectedDeptId = currentDeptId;
            
        } catch (error) {
            console.error('新增角色失敗:', error);
            Dialog.error(error.message || '新增角色失敗');
        }
    }
    
    /**
     * 確認編輯部門角色
     */
    async function confirmEditDepartmentRole() {
        const roleId = document.getElementById('editRoleId').value;
        const roleName = document.getElementById('editRoleName').value.trim();
        const roleLevel = parseInt(document.getElementById('editRoleLevel').value) || 0;
        const isActive = document.getElementById('editRoleActive').checked;
        const newDeptId = document.getElementById('editRoleDepartment').value;
        
        if (!roleName) {
            if (window.Dialog) {
                Dialog.warning('請輸入角色名稱');
            } else {
                alert('請輸入角色名稱');
            }
            return;
        }
        
        // 驗證層級範圍（限制在 1-100）
        if (roleLevel < 1 || roleLevel > 100) {
            if (window.Dialog) {
                Dialog.warning('角色層級必須在 1-100 之間');
            } else {
                alert('角色層級必須在 1-100 之間');
            }
            // 重設為有效值
            document.getElementById('editRoleLevel').value = roleLevel < 1 ? 1 : 100;
            return;
        }
        
        try {
            // 如果部門有變更，使用移動 API
            if (departmentChanged) {
                const moveResponse = await fetch(`${API_BASE}/department-roles/${roleId}/move`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        new_department_id: parseInt(newDeptId),
                        include_children: false,  // 編輯時只移動單一角色
                        new_parent_role_id: movePreviewData?.new_parent_role_id || null
                    })
                });
                
                if (!moveResponse.ok) {
                    const error = await moveResponse.json();
                    throw new Error(error.detail || '移動角色失敗');
                }
                
                const moveResult = await moveResponse.json();
                
                // 同時更新其他屬性
                if (roleName !== moveResult.role_name || roleLevel !== moveResult.new_level || isActive !== moveResult.is_active) {
                    await updateDepartmentRole(roleId, {
                        name: roleName,
                        level: roleLevel,
                        is_active: isActive
                    });
                }
                
                // 顯示完整結果（包含警告訊息）
                if (moveResult.warning) {
                    if (window.Dialog) {
                        Dialog.warning(`角色已更新並移動到新部門。\n${moveResult.warning}`);
                    }
                } else {
                    if (window.Dialog) {
                        Dialog.success('角色已成功移動到新部門');
                    }
                }
                
                closeEditDepartmentRoleModal();
                
                // 重新載入左側部門樹
                if (refreshDeptTree) {
                    await refreshDeptTree();
                }
                
                // 導航到新部門並選中該角色
                if (selectDepartmentForRoles) {
                    await selectDepartmentForRoles(parseInt(newDeptId));
                    // 選中該角色
                    setTimeout(() => {
                        selectRoleAndShowDepartmentRoles(roleId, parseInt(newDeptId));
                    }, 200);
                }
                
            } else {
                // 部門沒有變更，檢查父角色是否變更
                const parentRoleId = document.getElementById('editParentRoleSelect').value || null;
                const originalParentRoleId = document.getElementById('editRoleId').getAttribute('data-original-parent-id');
                const originalParentId = originalParentRoleId === 'null' ? null : originalParentRoleId;
                const hasParentChanged = String(parentRoleId) !== String(originalParentId);
                
                if (hasParentChanged) {
                    // 父角色有變更，需要預覽影響並請用戶確認
                    try {
                        const response = await fetch(`${API_BASE}/department-roles/${roleId}/recalculate-children?preview=true`, {
                            method: 'POST',
                            credentials: 'include'
                        });
                        
                        if (!response.ok) {
                            throw new Error('無法預覽層級變更影響');
                        }
                        
                        const previewResult = await response.json();
                        const affectedCount = previewResult.count || 0;
                        
                        // 顯示父角色變更確認對話框
                        showParentRoleChangeConfirm(affectedCount, previewResult.affected_roles || [], {
                            roleId,
                            roleName,
                            roleLevel,
                            isActive,
                            parentRoleId
                        });
                        return; // 等待用戶確認
                        
                    } catch (error) {
                        console.error('預覽層級變更影響失敗:', error);
                        if (window.Dialog) {
                            Dialog.error('無法預覽層級變更影響，請稍後再試');
                        }
                        return;
                    }
                }
                
                // 直接執行更新
                await updateDepartmentRole(roleId, {
                    name: roleName,
                    level: roleLevel,
                    is_active: isActive,
                    parent_id: parentRoleId
                });
                
                if (window.Dialog) {
                    Dialog.success('角色更新成功');
                }
                
                closeEditDepartmentRoleModal();
                
                // 重新載入左側部門樹以更新角色資訊
                if (refreshDeptTree) {
                    await refreshDeptTree();
                }
                
                // 選中該角色所屬的部門
                if (expandDepartmentByRoleId) {
                    await expandDepartmentByRoleId(roleId);
                }
            }
            
        } catch (error) {
            console.error('更新角色失敗:', error);
            if (window.Dialog) {
                Dialog.error(error.message || '更新角色失敗');
            } else {
                alert('更新角色失敗');
            }
        }
    }
        
    /**
     * 刪除部門角色
     */
    async function deleteDepartmentRole(roleId, userCount) {
        try {
            // 檢查角色依賴關係
            const dependencies = OrganizationRoleAnalysisModule.checkRoleDependencies(roleId, userCount, departmentRolesCache);
            
            // 如果有依賴，直接顯示警告，不允許操作
            if (dependencies.hasAnyDependency) {
                const reasons = [];
                if (dependencies.hasUsers) {
                    reasons.push(`${dependencies.userCount} 位使用者`);
                }
                if (dependencies.hasChildren) {
                    reasons.push(`${dependencies.childrenCount} 個子角色`);
                }
                
                Dialog.warning(`此角色有 ${reasons.join(' 和 ')}，無法停用或刪除。\n\n如需停用角色，請先：\n${dependencies.hasUsers ? '• 移除所有使用此角色的用戶\n' : ''}${dependencies.hasChildren ? '• 重新指派所有子角色的父角色\n' : ''}`);
                return;
            }
            
            // 在確認操作前，先找到角色所屬的部門
            let roleDeptId = null;
            for (const [deptId, roles] of Object.entries(departmentRolesCache)) {
                if (Array.isArray(roles) && roles.some(role => role.id == roleId)) {
                    roleDeptId = parseInt(deptId);
                    break;
                }
            }
            
            // 無依賴：可以刪除
            Dialog.confirm('此角色沒有使用者和子角色，將會永久刪除。\n\n此操作無法復原，確定要刪除嗎？', async () => {
                try {
                    const response = await fetch(`${API_BASE}/department-roles/${roleId}`, {
                        method: 'DELETE',
                        credentials: 'include'
                    });
                    
                    if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.detail || '刪除失敗');
                    }
                    
                    Dialog.success('角色已刪除');
                    
                    // 重新載入左側部門樹以更新角色資訊
                    await refreshDeptTree();
                    
                    // 選中該角色原本所屬的部門
                    if (roleDeptId) {
                        await selectDepartmentForRoles(roleDeptId);
                    }
                    
                    // 通知角色統計數據已更新
                    notifyRoleStatsChanged();
                    
                } catch (error) {
                    console.error('刪除角色失敗:', error);
                    Dialog.error(error.message || '刪除角色失敗');
                }
            });
            
        } catch (error) {
            console.error('檢查角色狀態失敗:', error);
            Dialog.error('無法檢查角色狀態，請稍後再試');
        }
    }
    
    /**
     * 重新整理部門樹
     */
    async function refreshDeptTree() {
        // 保存當前展開狀態
        const expandedNodes = [];
        document.querySelectorAll('.tree-children.expanded').forEach(node => {
            const parentNode = node.parentElement;
            if (parentNode && parentNode.dataset.id) {
                expandedNodes.push(parseInt(parentNode.dataset.id));
            }
        });
        
        // 清空緩存
        departmentRolesCache = {};
        await loadDepartmentTreeForRoles();
        
        // 恢復展開狀態
        setTimeout(() => {
            expandedNodes.forEach(deptId => {
                const node = document.querySelector(`.tree-node[data-id="${deptId}"] .tree-children`);
                if (node) {
                    node.classList.add('expanded');
                    const toggle = document.querySelector(`.tree-node[data-id="${deptId}"] .node-toggle i`);
                    if (toggle) {
                        toggle.classList.remove('fa-chevron-right');
                        toggle.classList.add('fa-chevron-down');
                    }
                }
            });
        }, 50);
        
        // 恢復選中狀態
        if (selectedDeptId) {
            // 使用 setTimeout 確保 DOM 更新完成
            setTimeout(() => {
                const selectedNode = document.querySelector(`.node-content[data-dept-id="${selectedDeptId}"]`);
                if (selectedNode) {
                    selectedNode.classList.add('selected');
                }
            }, 50);
        }
        
        // 更新統計
        updateTreeStats();
        
        // 重新綁定拖曳事件
        setTimeout(() => bindRoleDragEvents(), 100);
        
        // 重新綁定樹節點點擊事件
        setTimeout(() => {
            OrganizationRoleTreeModule.bindTreeEventListeners(handleDepartmentNodeClick);
        }, 100);
        
        // 重新綁定按鈕事件
        setTimeout(() => {
            bindRoleManagementEvents();
        }, 100);
        
        // 確保模組在全域可用
        if (!window.OrganizationRolesModule) {
            window.OrganizationRolesModule = OrganizationRolesModule;
        }
    }
    
    /**
     * 檢視角色詳情
     */
    async function viewRoleDetails(roleId) {
        try {
            const response = await fetch(`${API_BASE}/department-roles/${roleId}`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('載入角色詳情失敗');
            }
            
            const role = await response.json();
            
            // 渲染詳情內容
            const content = document.getElementById('roleDetailsContent');
            if (content) {
                content.innerHTML = `
                    <div class="role-details-grid">
                        <div class="detail-section">
                            <h4>基本資訊</h4>
                            <div class="detail-row">
                                <label>角色名稱：</label>
                                <span>${role.name}</span>
                            </div>
                            <div class="detail-row">
                                <label>角色代碼：</label>
                                <span class="code">${role.code}</span>
                            </div>
                            <div class="detail-row">
                                <label>角色類型：</label>
                                <span class="badge ${role.role_type === 'manager' ? 'badge-warning' : 'badge-success'}">
                                    ${role.role_type === 'manager' ? '管理角色' : '員工角色'}
                                </span>
                            </div>
                            <div class="detail-row">
                                <label>角色層級：</label>
                                <span>${role.level || 0}</span>
                            </div>
                            ${(role.parent_role_name || role.parent_name || role.parentRoleName) ? `
                            <div class="detail-row">
                                <label>上層角色：</label>
                                <span class="text-info"><i class="fas fa-arrow-up"></i> ${role.parent_role_name || role.parent_name || role.parentRoleName}</span>
                            </div>
                            ` : ''}
                            <div class="detail-row">
                                <label>狀態：</label>
                                <span class="badge ${role.is_active ? 'badge-success' : 'badge-secondary'}">
                                    ${role.is_active ? '啟用' : '停用'}
                                </span>
                            </div>
                        </div>
                        
                        <div class="detail-section">
                            <h4>所屬資訊</h4>
                            <div class="detail-row">
                                <label>所屬部門：</label>
                                <span>${role.department_name || '未知'}</span>
                            </div>
                            <div class="detail-row">
                                <label>來源模板：</label>
                                <span>${role.template_name || '自訂'}</span>
                            </div>
                            <div class="detail-row">
                                <label>使用人數：</label>
                                <span class="badge badge-info">${role.user_count || 0} 人</span>
                            </div>
                            <div class="detail-row">
                                <label>建立時間：</label>
                                <span>${new Date(role.created_at).toLocaleString('zh-TW')}</span>
                            </div>
                            <div class="detail-row">
                                <label>更新時間：</label>
                                <span>${new Date(role.updated_at).toLocaleString('zh-TW')}</span>
                            </div>
                        </div>
                    </div>
                    
                    ${role.user_count > 0 ? `
                        <div class="detail-section full-width">
                            <h4>使用此角色的用戶</h4>
                            <div id="roleUsersList">
                                <div class="loading-spinner">
                                    <div class="spinner"></div>
                                    <p>載入用戶列表中...</p>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                `;
                
                // 如果有用戶，載入用戶列表
                if (role.user_count > 0) {
                    loadRoleUsers(roleId);
                }
            }
            
            // 顯示模態框
            const modal = document.getElementById('roleDetailsModal');
            if (modal) {
                modal.classList.add('show');
        // 初始化滾動條效果
        if (window.CommonUI && window.CommonUI.initScrollFadeEffect) {
            setTimeout(() => CommonUI.initScrollFadeEffect(), 100);
        }
            }
            
        } catch (error) {
            console.error('載入角色詳情失敗:', error);
            Dialog.error('載入角色詳情失敗');
        }
    }
    
    /**
     * 載入使用角色的用戶
     */
    async function loadRoleUsers(roleId) {
        try {
            const response = await fetch(`${API_BASE}/department-roles/${roleId}/users`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('載入用戶列表失敗');
            }
            
            const users = await response.json();
            const container = document.getElementById('roleUsersList');
            
            if (container) {
                if (users.length === 0) {
                    container.innerHTML = '<p class="text-muted">沒有用戶使用此角色</p>';
                } else {
                    container.innerHTML = `
                        <table class="simple-table">
                            <thead>
                                <tr>
                                    <th>帳號</th>
                                    <th>姓名</th>
                                    <th>Email</th>
                                    <th>指派時間</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${users.map(user => `
                                    <tr>
                                        <td>${user.loginid || ''}</td>
                                        <td>${user.username}</td>
                                        <td>${user.email}</td>
                                        <td>${user.assigned_at ? new Date(user.assigned_at).toLocaleString('zh-TW') : ''}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `;
                }
            }
            
        } catch (error) {
            console.error('載入用戶列表失敗:', error);
            const container = document.getElementById('roleUsersList');
            if (container) {
                container.innerHTML = '<p class="text-danger">載入用戶列表失敗</p>';
            }
        }
    }
    
    /**
     * 編輯部門角色
     */
    async function editDepartmentRole(roleId) {
        try {
            // 先取得角色資訊
            const response = await fetch(`${API_BASE}/department-roles/${roleId}`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('載入角色資訊失敗');
            }
            
            const role = await response.json();
            
            // 填充表單
            document.getElementById('editRoleId').value = role.id;
            document.getElementById('editRoleCode').value = role.code;
            document.getElementById('editRoleName').value = role.name;
            document.getElementById('editRoleType').value = role.role_type === 'manager' ? '管理角色' : '員工角色';
            // 設置層級值，確保在有效範圍內
            let levelValue = role.level || 1;
            if (levelValue > 100) levelValue = 100;
            if (levelValue < 1) levelValue = 1;
            document.getElementById('editRoleLevel').value = levelValue;
            
            // 檢查角色依賴關係，決定是否禁用「啟用此角色」checkbox
            const dependencies = OrganizationRoleAnalysisModule.checkRoleDependencies(role.id, role.user_count, departmentRolesCache);
            const activeCheckbox = document.getElementById('editRoleActive');
            activeCheckbox.checked = role.is_active;
            
            // 如果角色有依賴，不允許停用
            if (dependencies.hasAnyDependency && role.is_active) {
                activeCheckbox.disabled = true;
                
                // 在 checkbox 後面新增說明文字
                const checkboxLabel = activeCheckbox.parentElement;
                const existingHint = checkboxLabel.querySelector('.checkbox-hint');
                if (existingHint) {
                    existingHint.remove();
                }
                
                const reasons = [];
                if (dependencies.hasUsers) {
                    reasons.push(`${dependencies.userCount} 位使用者`);
                }
                if (dependencies.hasChildren) {
                    reasons.push(`${dependencies.childrenCount} 個子角色`);
                }
                
                const hint = document.createElement('small');
                hint.className = 'checkbox-hint text-muted d-block';
                hint.innerHTML = `<i class="fas fa-info-circle"></i> 此角色有 ${reasons.join(' 和 ')}，無法停用`;
                checkboxLabel.appendChild(hint);
            } else {
                activeCheckbox.disabled = false;
                // 移除說明文字
                const checkboxLabel = activeCheckbox.parentElement;
                const existingHint = checkboxLabel.querySelector('.checkbox-hint');
                if (existingHint) {
                    existingHint.remove();
                }
            }
            
            // 載入部門選項並設定當前部門
            await loadDepartmentOptionsForEdit();
            originalDepartmentId = role.department_id;
            departmentChanged = false;
            movePreviewData = null;
            
            const deptSelect = document.getElementById('editRoleDepartment');
            if (deptSelect) {
                deptSelect.value = role.department_id;
                // 如果使用了 SearchableSelect，也要更新其顯示
                if (deptSelect.searchableSelectInstance) {
                    deptSelect.searchableSelectInstance.setValue(role.department_id);
                }
            }
            
            // 重置部門變更狀態並設置還原按鈕為 disabled
            resetDepartmentState();
            const resetBtn = document.getElementById('resetDepartmentBtn');
            if (resetBtn) {
                resetBtn.disabled = true;
            }
            
            // 載入父角色選項並設定選中值
            const parentRoleId = role.parent_id || role.parent_role_id || role.parentRoleId;
            
            // 保存原始父角色ID供後續比較使用
            const originalParentRoleId = parentRoleId || null;
            document.getElementById('editRoleId').setAttribute('data-original-parent-id', originalParentRoleId);
            
            loadParentRoleOptions(role.id); // 排除當前編輯的角色
            
            // 延遲設定選中值，確保 SearchableSelect 初始化完成
            setTimeout(() => {
                const parentSelect = document.getElementById('editParentRoleSelect');
                if (parentSelect) {
                    parentSelect.value = parentRoleId || '';
                    // 如果使用了 SearchableSelect，也要更新其顯示
                    if (parentSelect.searchableSelectInstance) {
                        parentSelect.searchableSelectInstance.setValue(parentRoleId || '');
                    }
                }
            }, 100);
            
            // 顯示模態框
            const modal = document.getElementById('editDepartmentRoleModal');
            if (modal) {
                modal.classList.add('show');
        // 初始化滾動條效果
        if (window.CommonUI && window.CommonUI.initScrollFadeEffect) {
            setTimeout(() => CommonUI.initScrollFadeEffect(), 100);
        }
            }
            
        } catch (error) {
            console.error('載入角色資訊失敗:', error);
            Dialog.error('載入角色資訊失敗');
        }
    }
    
    /**
     * 載入部門選項用於編輯
     */
    async function loadDepartmentOptionsForEdit() {
        try {
            const response = await fetch(`${API_BASE}/departments?tree=false`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('載入部門失敗');
            }
            
            const departments = await response.json();
            const select = document.getElementById('editRoleDepartment');
            
            if (!select) return;
            
            // 先檢查是否已經有 SearchableSelect wrapper，如果有則先移除
            const existingWrapper = select.closest('.searchable-select-wrapper');
            if (existingWrapper) {
                // 將 select 元素移出 wrapper
                existingWrapper.parentNode.insertBefore(select, existingWrapper);
                existingWrapper.remove();
                // 清除可能存在的實例引用
                delete select.searchableSelectInstance;
            }
            
            // 清空現有選項
            select.innerHTML = '';
            
            // 按層級排序部門
            departments.sort((a, b) => {
                const pathA = a.path || a.name;
                const pathB = b.path || b.name;
                return pathA.localeCompare(pathB);
            });
            
            // 加入部門選項（只顯示啟用的部門）
            departments
                .filter(dept => dept.is_active)
                .forEach(dept => {
                    const option = document.createElement('option');
                    option.value = dept.id;
                    option.textContent = dept.path || dept.name;
                    select.appendChild(option);
                });
                
            // 初始化 SearchableSelect（只初始化一次）
            if (window.SearchableSelect && !select.searchableSelectInstance) {
                select.searchableSelectInstance = new SearchableSelect(select);
            }
            
        } catch (error) {
            console.error('載入部門選項失敗:', error);
        }
    }
    
    /**
     * 處理部門變更
     */
    async function onEditRoleDepartmentChange() {
        const newDeptId = document.getElementById('editRoleDepartment').value;
        const roleId = document.getElementById('editRoleId').value;
        
        if (!newDeptId || !roleId) return;
        
        departmentChanged = (parseInt(newDeptId) !== parseInt(originalDepartmentId));
        
        if (departmentChanged) {
            // 顯示警告並啟用還原按鈕
            document.getElementById('deptChangeWarning').style.display = 'block';
            const resetBtn = document.getElementById('resetDepartmentBtn');
            if (resetBtn) {
                resetBtn.disabled = false;
            }
            
            // 禁用父角色選擇
            const parentSelect = document.getElementById('editParentRoleSelect');
            if (parentSelect) {
                // 設置原生 select 的 disabled 屬性
                parentSelect.disabled = true;
                // 如果有 SearchableSelect 實例，也調用其 disable 方法
                if (parentSelect.searchableSelectInstance && typeof parentSelect.searchableSelectInstance.disable === 'function') {
                    parentSelect.searchableSelectInstance.disable();
                }
                
                // 處理 SearchableSelect 的禁用樣式
                const wrapper = parentSelect.closest('.searchable-select-wrapper');
                if (wrapper) {
                    // 找到觸發器按鈕
                    const trigger = wrapper.querySelector('.searchable-select-trigger');
                    if (trigger) {
                        trigger.classList.add('disabled');
                        trigger.setAttribute('disabled', 'disabled');
                        trigger.style.pointerEvents = 'none';
                        trigger.style.opacity = '0.6';
                        trigger.style.backgroundColor = '#f5f5f5';
                    }
                    // 禁用搜索輸入框
                    const searchInput = wrapper.querySelector('.searchable-select-search');
                    if (searchInput) {
                        searchInput.disabled = true;
                    }
                } else {
                    // 如果沒有 wrapper，可能是原生 select，確保它被禁用
                    parentSelect.style.backgroundColor = '#f5f5f5';
                    parentSelect.style.cursor = 'not-allowed';
                    parentSelect.style.opacity = '0.6';
                }
            }
            
            document.getElementById('parentRoleHint').innerHTML = 
                '<span class="text-warning"><i class="fas fa-exclamation-triangle"></i> 部門變更時將自動處理父角色</span>';
            
            // 預覽移動影響
            try {
                const response = await fetch(`${API_BASE}/department-roles/${roleId}/move-preview`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        new_department_id: parseInt(newDeptId),
                        include_children: false  // 編輯時只移動單一角色
                    })
                });
                
                if (response.ok) {
                    movePreviewData = await response.json();
                    
                    // 顯示智能提示
                    if (movePreviewData.warning) {
                        // 更新提示文字
                        const warningEl = document.getElementById('deptChangeWarning');
                        warningEl.innerHTML = `
                            <i class="fas fa-exclamation-triangle"></i> 
                            ${movePreviewData.warning}
                        `;
                        
                        // 如果有新的父角色資訊，顯示在提示中
                        if (movePreviewData.new_parent_role_name) {
                            warningEl.innerHTML += `<br>新的父角色：${movePreviewData.new_parent_role_name}`;
                        }
                    }
                }
            } catch (error) {
                console.error('預覽移動影響失敗:', error);
            }
            
        } else {
            // 恢復原始狀態
            resetDepartmentState();
        }
    }
    
    /**
     * 還原部門選擇
     */
    function resetRoleDepartment() {
        const deptSelect = document.getElementById('editRoleDepartment');
        if (deptSelect) {
            deptSelect.value = originalDepartmentId;
            // 如果使用了 SearchableSelect，也要更新其顯示
            if (deptSelect.searchableSelectInstance) {
                deptSelect.searchableSelectInstance.setValue(originalDepartmentId);
            }
        }
        // 重置狀態並禁用還原按鈕
        resetDepartmentState();
        const resetBtn = document.getElementById('resetDepartmentBtn');
        if (resetBtn) {
            resetBtn.disabled = true;
        }
    }
    
    /**
     * 重置部門變更狀態
     */
    function resetDepartmentState() {
        departmentChanged = false;
        movePreviewData = null;
        
        // 隱藏警告並禁用還原按鈕
        document.getElementById('deptChangeWarning').style.display = 'none';
        const resetBtn = document.getElementById('resetDepartmentBtn');
        if (resetBtn) {
            resetBtn.disabled = true;
        }
        
        // 啟用父角色選擇
        const parentSelect = document.getElementById('editParentRoleSelect');
        if (parentSelect) {
            // 恢復原生 select 的狀態
            parentSelect.disabled = false;
            // 如果有 SearchableSelect 實例，也調用其 enable 方法
            if (parentSelect.searchableSelectInstance && typeof parentSelect.searchableSelectInstance.enable === 'function') {
                parentSelect.searchableSelectInstance.enable();
            }
            
            // 處理 SearchableSelect 的啟用樣式
            const wrapper = parentSelect.closest('.searchable-select-wrapper');
            if (wrapper) {
                // 找到觸發器按鈕
                const trigger = wrapper.querySelector('.searchable-select-trigger');
                if (trigger) {
                    trigger.classList.remove('disabled');
                    trigger.removeAttribute('disabled');
                    trigger.style.pointerEvents = '';
                    trigger.style.opacity = '';
                    trigger.style.backgroundColor = '';
                }
                // 啟用搜索輸入框
                const searchInput = wrapper.querySelector('.searchable-select-search');
                if (searchInput) {
                    searchInput.disabled = false;
                }
            } else {
                // 如果沒有 wrapper，恢復原生 select 的樣式
                parentSelect.style.backgroundColor = '';
                parentSelect.style.cursor = '';
                parentSelect.style.opacity = '';
            }
        }
        
        document.getElementById('parentRoleHint').innerHTML = '留空表示頂層角色';
    }
    
    /**
     * 取得部門角色資訊
     */
    async function getDepartmentRole(roleId) {
        try {
            const response = await fetch(`${API_BASE}/department-roles/${roleId}`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('載入角色失敗');
            }
            
            return await response.json();
            
        } catch (error) {
            console.error('取得角色資訊失敗:', error);
            throw error;
        }
    }
    
    /**
     * 更新部門角色
     */
    async function updateDepartmentRole(roleId, updateData) {
        try {
            const response = await fetch(`${API_BASE}/department-roles/${roleId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(updateData)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || '更新失敗');
            }
            
            const result = await response.json();
            
            // 檢查是否有警告訊息（循環引用自動修正）
            if (result.warning && window.Dialog) {
                Dialog.warning(result.warning);
            }
            
            // 通知角色統計數據已更新
            notifyRoleStatsChanged();
            
            return result;
            
        } catch (error) {
            console.error('更新角色失敗:', error);
            throw error;
        }
    }
    
    /**
     * 搜尋部門和角色（統一模式：保留完整樹結構 + 高亮匹配項）
     */
    function searchDeptAndRoles() {
        const searchInput = document.getElementById('roleSearchInput');
        if (!searchInput) return;
        
        const searchTerm = searchInput.value.trim().toLowerCase();
        const searchResultCountEl = document.getElementById('rolesSearchResultCount');
        
        if (!searchTerm) {
            // 清空搜尋，移除所有高亮
            clearHighlights();
            if (searchResultCountEl) {
                searchResultCountEl.style.display = 'none';
            }
            return;
        }
        
        // 計算匹配數量
        let matchCount = countSearchMatches(deptTreeData, searchTerm);
        
        // 清除舊的高亮
        clearHighlights();
        
        // 添加高亮效果到匹配的節點
        addHighlightsToMatches(searchTerm);
        
        // 展開匹配項目的路徑
        expandPathsToMatches(searchTerm);
        
        // 滾動到第一個匹配項
        scrollToFirstMatch();
        
        // 顯示搜尋結果統計
        if (searchResultCountEl) {
            const countEl = searchResultCountEl.querySelector('strong');
            if (countEl) countEl.textContent = matchCount;
            searchResultCountEl.style.display = 'inline-flex';
        }
    }
    
    
    /**
     * 計算搜尋匹配數量
     */
    function countSearchMatches(departments, searchTerm) {
        let count = 0;
        
        for (const dept of departments) {
            // 檢查部門名稱是否匹配
            if (dept.name.toLowerCase().includes(searchTerm)) {
                count++;
            }
            
            // 檢查部門角色是否匹配
            const roles = departmentRolesCache[dept.id] || [];
            const matchingRoles = roles.filter(role => 
                role.name.toLowerCase().includes(searchTerm)
            );
            count += matchingRoles.length;
            
            // 遞歸檢查子部門
            if (dept.children) {
                count += countSearchMatches(dept.children, searchTerm);
            }
        }
        
        return count;
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
     * 清除所有高亮
     */
    function clearHighlights() {
        const treeContainer = document.getElementById('roleDeptTree');
        if (!treeContainer) return;
        
        // 清除部門節點的高亮
        treeContainer.querySelectorAll('.tree-node').forEach(node => {
            node.classList.remove('highlight');
        });
        
        // 清除角色節點的高亮
        treeContainer.querySelectorAll('.role-tree-node').forEach(node => {
            node.classList.remove('highlight');
        });
    }
    
    /**
     * 為匹配的節點添加高亮效果
     */
    function addHighlightsToMatches(searchTerm) {
        const treeContainer = document.getElementById('roleDeptTree');
        if (!treeContainer || !searchTerm) return;
        
        // 遞迴查找並高亮匹配的部門和角色
        function highlightMatchingNodes(departments, searchTerm) {
            for (const dept of departments) {
                // 檢查部門名稱是否匹配
                if (dept.name.toLowerCase().includes(searchTerm)) {
                    const deptNode = treeContainer.querySelector(`.tree-node .node-content[data-dept-id="${dept.id}"]`);
                    if (deptNode) {
                        deptNode.closest('.tree-node').classList.add('highlight');
                    }
                }
                
                // 檢查部門角色是否匹配
                const roles = departmentRolesCache[dept.id] || [];
                roles.forEach(role => {
                    if (role.name.toLowerCase().includes(searchTerm)) {
                        const roleNode = treeContainer.querySelector(`.role-tree-node[data-role-id="${role.id}"]`);
                        if (roleNode) {
                            roleNode.classList.add('highlight');
                        }
                    }
                });
                
                // 遞迴處理子部門
                if (dept.children) {
                    highlightMatchingNodes(dept.children, searchTerm);
                }
            }
        }
        
        // 開始高亮處理
        highlightMatchingNodes(deptTreeData, searchTerm);
    }
    
    /**
     * 展開匹配項目的路徑
     */
    function expandPathsToMatches(searchTerm) {
        const treeContainer = document.getElementById('roleDeptTree');
        if (!treeContainer || !searchTerm) return;
        
        // 遞迴查找匹配的部門並展開路徑
        function expandToMatchingNodes(departments, searchTerm) {
            for (const dept of departments) {
                let hasMatch = false;
                
                // 檢查部門名稱是否匹配
                if (dept.name.toLowerCase().includes(searchTerm)) {
                    hasMatch = true;
                }
                
                // 檢查部門角色是否匹配
                const roles = departmentRolesCache[dept.id] || [];
                const hasMatchingRole = roles.some(role => 
                    role.name.toLowerCase().includes(searchTerm)
                );
                
                if (hasMatchingRole) {
                    hasMatch = true;
                }
                
                // 如果有匹配，展開到此節點的路徑
                if (hasMatch) {
                    expandPathToDepartment(dept.id);
                }
                
                // 遞迴處理子部門
                if (dept.children) {
                    expandToMatchingNodes(dept.children, searchTerm);
                }
            }
        }
        
        expandToMatchingNodes(deptTreeData, searchTerm);
    }
    
    /**
     * 閉合所有部門，除了指定部門的父級路徑（包裝函數）
     */
    function collapseAllExceptPath(targetDeptId) {
        OrganizationRoleTreeModule.collapseAllExceptPath(targetDeptId, deptTreeData);
    }
    
    /**
     * 展開到指定部門的路徑（包裝函數）
     */
    function expandPathToDepartment(deptId) {
        OrganizationRoleTreeModule.expandPathToDepartment(deptId, deptTreeData);
    }
    
    /**
     * 根據角色 ID 找到所屬部門並導航（編輯存檔後使用）
     */
    async function expandDepartmentByRoleId(roleId) {
        // 遍歷所有部門的角色緩存，找到包含該角色的部門
        for (const [deptId, roles] of Object.entries(departmentRolesCache)) {
            if (Array.isArray(roles) && roles.some(role => role.id == roleId)) {
                // 找到角色所屬部門，使用編輯存檔後導航函數（會關閉其他節點）
                await navigateToDepartmentAfterEdit(parseInt(deptId));
                return parseInt(deptId);
            }
        }
        return null;
    }
    
    /**
     * 滾動到第一個匹配項（包裝函數）
     */
    function scrollToFirstMatch() {
        OrganizationRoleTreeModule.scrollToFirstMatch();
    }
    
    /**
     * 展開所有部門節點（包裝函數）
     */
    function expandAll() {
        OrganizationRoleTreeModule.expandAll();
    }
    
    /**
     * 收合所有部門節點（包裝函數）
     */
    function collapseAll() {
        OrganizationRoleTreeModule.collapseAll();
    }

    /**
     * 綁定樹節點事件（使用事件委託，包裝函數）
     */
    function bindTreeEventListeners() {
        OrganizationRoleTreeModule.bindTreeEventListeners(handleDepartmentNodeClick);
    }
    
    /**
     * 綁定角色管理事件
     */
    function bindRoleManagementEvents() {
        // 新增角色按鈕
        const addRoleBtn = document.getElementById('addRoleBtn');
        if (addRoleBtn) {
            addRoleBtn.onclick = showAddRoleModal;
        }
        
        // 搜尋框事件綁定（避免重複綁定）
        const searchInput = document.getElementById('roleSearchInput');
        if (searchInput && !searchInput.hasAttribute('data-events-bound')) {
            // 即時搜尋（防抖300ms）
            searchInput.addEventListener('input', debounce(searchDeptAndRoles, 300));
            
            // Enter 鍵支援
            searchInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    searchDeptAndRoles();
                }
            });
            
            searchInput.setAttribute('data-events-bound', 'true');
        }
        
        // 角色搜尋模態框內的搜尋框事件
        const roleSearchInput = document.getElementById('roleSearchInput');
        if (roleSearchInput && !roleSearchInput.hasAttribute('data-hierarchy-events-bound')) {
            roleSearchInput.addEventListener('input', debounce(performRoleSearch, 300));
            roleSearchInput.setAttribute('data-hierarchy-events-bound', 'true');
        }
        
        // 綁定全域函數到 window 物件（供 HTML 內的 onclick 使用）
        if (typeof window !== 'undefined') {
            window.openRoleSearchModal = openRoleSearchModal;
            window.closeRoleSearchModal = closeRoleSearchModal;
            window.performRoleSearch = performRoleSearch;
            window.selectSearchRole = selectSearchRole;
            window.confirmRoleSelection = confirmRoleSelection;
            window.showRecalculateConfirm = showRecalculateConfirm;
            window.closeRecalculateConfirmModal = closeRecalculateConfirmModal;
            window.executeRecalculate = executeRecalculate;
            window.closeParentRoleChangeConfirmModal = closeParentRoleChangeConfirmModal;
            window.confirmParentRoleChange = confirmParentRoleChange;
        }
    }
    
    // ===== 統一角色統計服務 =====
    
    /**
     * 確保角色數據已載入到緩存中
     */
    async function ensureRolesLoaded() {
        // 如果緩存為空且樹狀資料為空，載入數據
        if (Object.keys(departmentRolesCache).length === 0 && deptTreeData.length === 0) {
            try {
                await loadDepartmentTreeForRoles();
            } catch (error) {
                console.error('載入角色數據失敗:', error);
                // 如果載入失敗，嘗試只載入基本的部門結構
                try {
                    const response = await fetch(`${API_BASE}/departments?tree=true`, {
                        credentials: 'include'
                    });
                    if (response.ok) {
                        deptTreeData = await response.json();
                    }
                } catch (fallbackError) {
                    console.error('載入部門結構失敗:', fallbackError);
                }
            }
        }
    }
    
    /**
     * 獲取角色統計資料（包裝函數）
     */
    function getRoleStatistics() {
        return OrganizationRoleAnalysisModule.getRoleStatistics(departmentRolesCache);
    }
    
    /**
     * 通知角色統計數據已更新（包裝函數）
     */
    function notifyRoleStatsChanged() {
        OrganizationRoleAnalysisModule.notifyRoleStatsChanged(departmentRolesCache);
    }
    
    // ===== 父角色變更確認功能 =====
    
    let pendingRoleUpdateData = null; // 暫存等待確認的角色更新資料
    
    /**
     * 顯示父角色變更確認對話框
     */
    function showParentRoleChangeConfirm(affectedCount, affectedRoles, updateData) {
        pendingRoleUpdateData = updateData;
        
        // 設定影響數量
        const countElement = document.getElementById('parentChangeAffectedCount');
        if (countElement) {
            countElement.textContent = affectedCount;
        }
        
        // 顯示或隱藏影響角色清單
        const containerElement = document.getElementById('parentChangeAffectedContainer');
        const listElement = document.getElementById('parentChangeAffectedList');
        
        if (affectedCount > 0 && containerElement && listElement) {
            containerElement.style.display = 'block';
            
            // 建立影響角色清單
            const rolesList = affectedRoles.map(role => `
                <div class="affected-role-item">
                    <div class="role-info">
                        <h6>${role.name}</h6>
                        <p class="text-muted">${role.department_path}</p>
                        <span class="level-change">
                            層級: ${role.old_level} → ${role.new_level}
                        </span>
                    </div>
                </div>
            `).join('');
            
            listElement.innerHTML = rolesList;
        } else if (containerElement) {
            containerElement.style.display = 'none';
        }
        
        // 顯示對話框
        const modal = document.getElementById('parentRoleChangeConfirmModal');
        if (modal) {
            modal.classList.add('show');
        // 初始化滾動條效果
        if (window.CommonUI && window.CommonUI.initScrollFadeEffect) {
            setTimeout(() => CommonUI.initScrollFadeEffect(), 100);
        }
        }
    }
    
    /**
     * 關閉父角色變更確認對話框
     */
    function closeParentRoleChangeConfirmModal() {
        const modal = document.getElementById('parentRoleChangeConfirmModal');
        if (modal) {
            modal.classList.remove('show');
        }
        pendingRoleUpdateData = null;
    }
    
    /**
     * 確認父角色變更並執行更新
     */
    async function confirmParentRoleChange() {
        if (!pendingRoleUpdateData) return;
        
        const { roleId, roleName, roleLevel, isActive, parentRoleId } = pendingRoleUpdateData;
        
        try {
            // 先更新角色基本資訊
            await updateDepartmentRole(roleId, {
                name: roleName,
                level: roleLevel,
                is_active: isActive,
                parent_id: parentRoleId
            });
            
            // 然後執行層級重算
            const recalcResponse = await fetch(`${API_BASE}/department-roles/${roleId}/recalculate-children`, {
                method: 'POST',
                credentials: 'include'
            });
            
            if (!recalcResponse.ok) {
                throw new Error('層級重算失敗');
            }
            
            const recalcResult = await recalcResponse.json();
            
            if (window.Dialog) {
                if (recalcResult.count > 0) {
                    Dialog.success(`角色更新成功，已重新計算 ${recalcResult.count} 個子角色的層級`);
                } else {
                    Dialog.success('角色更新成功');
                }
            }
            
            closeParentRoleChangeConfirmModal();
            closeEditDepartmentRoleModal();
            
            // 重新載入左側部門樹以更新角色資訊
            if (refreshDeptTree) {
                await refreshDeptTree();
            }
            
            // 選中該角色所屬的部門
            if (expandDepartmentByRoleId) {
                await expandDepartmentByRoleId(roleId);
            }
            
        } catch (error) {
            console.error('父角色變更失敗:', error);
            if (window.Dialog) {
                Dialog.error('父角色變更失敗: ' + (error.message || '未知錯誤'));
            } else {
                alert('父角色變更失敗');
            }
        }
    }
    
    // ===== 角色層級管理功能 =====
    
    /**
     * 載入父角色選項（使用現有角色資料）
     */
    async function loadParentRoleOptions(excludeId = null) {
        const select = document.getElementById('editParentRoleSelect');
        if (!select) return;
        
        try {
            let safeRoles = [];
            
            if (excludeId) {
                // 使用新的 API 獲取安全的父角色候選項
                const response = await fetch(`/api/organization/department-roles/${excludeId}/safe-parents`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include'
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                safeRoles = await response.json();
                console.log('Safe parent candidates from API:', safeRoles);
                
            } else {
                // 如果沒有 excludeId，從快取中獲取所有啟用的角色
                for (const [deptId, roles] of Object.entries(departmentRolesCache)) {
                    if (!Array.isArray(roles)) continue;
                    
                    // 找到部門資訊
                    const dept = findDepartmentById(parseInt(deptId), deptTreeData);
                    if (!dept) continue;
                    
                    // 構建部門路徑
                    const deptPath = dept.path || dept.name;
                    
                    // 添加該部門的所有角色
                    for (const role of roles) {
                        if (!role.is_active) continue; // 只顯示啟用的角色
                        
                        safeRoles.push({
                            id: role.id,
                            name: role.name,
                            department_path: deptPath,
                            level: role.level
                        });
                    }
                }
                
                // 排序角色（按部門路徑和角色名稱）
                safeRoles.sort((a, b) => {
                    const pathCompare = a.department_path.localeCompare(b.department_path);
                    return pathCompare !== 0 ? pathCompare : a.name.localeCompare(b.name);
                });
            }
            
            // 更新選項內容，加入層級提示
            select.innerHTML = '<option value="">無（頂層角色）</option>' +
                safeRoles.map(role => {
                    const levelInfo = role.level ? ` [層級:${role.level}]` : '';
                    return `<option value="${role.id}">${role.name} - ${role.department_path}${levelInfo}</option>`;
                }).join('');
            
            // 保存當前的禁用狀態
            const wasDisabled = select.disabled;
            
            // 如果已經初始化過 SearchableSelect，則重新載入
            if (select.searchableSelectInstance) {
                select.searchableSelectInstance.reload();
                // 恢復禁用狀態
                if (wasDisabled) {
                    select.searchableSelectInstance.disable();
                }
            } else if (window.SearchableSelect) {
                // 首次初始化 SearchableSelect
                const searchableOptions = {
                    placeholder: select.dataset.placeholder || '選擇父角色（留空表示頂層角色）...',
                    searchPlaceholder: select.dataset.searchPlaceholder || '搜尋角色名稱...',
                    noResultsText: select.dataset.noResults || '找不到符合的角色',
                    maxHeight: '200px'
                };
                
                const instance = new SearchableSelect(select, searchableOptions);
                select.searchableSelectInstance = instance;
                // 如果原本是禁用狀態，保持禁用
                if (wasDisabled) {
                    instance.disable();
                }
            }
        } catch (error) {
            console.error('載入父角色選項失敗:', error);
            // 出錯時至少保持基本選項
            select.innerHTML = '<option value="">無（頂層角色）</option>';
        }
    }
    
    
    /**
     * 開啟角色搜尋模態框
     */
    function openRoleSearchModal(context) {
        const modal = document.getElementById('roleSearchModal');
        const contextField = document.getElementById('searchModalContext');
        const searchInput = document.getElementById('roleSearchInput');
        const selectedRoleField = document.getElementById('selectedRoleId');
        const confirmBtn = document.getElementById('confirmRoleBtn');
        const results = document.getElementById('roleSearchResults');
        
        if (contextField) contextField.value = context;
        if (searchInput) searchInput.value = '';
        if (selectedRoleField) selectedRoleField.value = '';
        if (confirmBtn) confirmBtn.disabled = true;
        
        // 清空搜尋結果
        if (results) {
            results.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search fa-2x text-muted"></i>
                    <p class="text-muted">請輸入關鍵字搜尋角色</p>
                </div>
            `;
        }
        
        if (modal) {
            modal.classList.add('show');
        // 初始化滾動條效果
        if (window.CommonUI && window.CommonUI.initScrollFadeEffect) {
            setTimeout(() => CommonUI.initScrollFadeEffect(), 100);
        }
        }
    }
    
    /**
     * 關閉角色搜尋模態框
     */
    function closeRoleSearchModal() {
        const modal = document.getElementById('roleSearchModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }
    
    /**
     * 執行角色搜尋
     */
    async function performRoleSearch() {
        const searchInput = document.getElementById('roleSearchInput');
        const contextField = document.getElementById('searchModalContext');
        
        if (!searchInput) return;
        
        const keyword = searchInput.value.trim();
        if (keyword.length < 1) {
            return;
        }
        
        const context = contextField ? contextField.value : '';
        let excludeId = null;
        
        // 如果是編輯模式，排除當前角色本身
        if (context === 'editRole') {
            const editRoleIdField = document.getElementById('editRoleId');
            if (editRoleIdField) {
                excludeId = editRoleIdField.value;
            }
        }
        
        try {
            const params = new URLSearchParams({ q: keyword });
            if (excludeId) {
                params.append('exclude_id', excludeId);
            }
            
            const response = await fetch(`${API_BASE}/roles/search?${params}`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('搜尋失敗');
            }
            
            const roles = await response.json();
            displayRoleSearchResults(roles);
            
        } catch (error) {
            console.error('搜尋角色失敗:', error);
            if (window.Dialog) {
                Dialog.error('搜尋角色失敗');
            }
        }
    }
    
    /**
     * 顯示角色搜尋結果
     */
    function displayRoleSearchResults(roles) {
        const container = document.getElementById('roleSearchResults');
        if (!container) return;
        
        if (!roles || roles.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search fa-2x text-muted"></i>
                    <p class="text-muted">找不到符合的角色</p>
                </div>
            `;
            return;
        }
        
        const html = roles.map(role => `
            <div class="role-search-item" data-role-id="${role.id}" onclick="selectSearchRole(${role.id}, '${role.display_name}')">
                <div class="role-info">
                    <h5>${role.name}</h5>
                    <p class="text-muted">${role.department_path}</p>
                    <span class="badge badge-info">層級: ${role.level}</span>
                    <span class="badge badge-secondary">${role.template_name}</span>
                </div>
            </div>
        `).join('');
        
        container.innerHTML = html;
    }
    
    /**
     * 選擇搜尋結果中的角色
     */
    function selectSearchRole(roleId, displayName) {
        // 移除所有選中狀態
        document.querySelectorAll('.role-search-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        // 選中當前項目
        const selectedItem = document.querySelector(`[data-role-id="${roleId}"]`);
        if (selectedItem) {
            selectedItem.classList.add('selected');
        }
        
        const selectedRoleField = document.getElementById('selectedRoleId');
        const confirmBtn = document.getElementById('confirmRoleBtn');
        
        if (selectedRoleField) selectedRoleField.value = roleId;
        if (confirmBtn) confirmBtn.disabled = false;
    }
    
    /**
     * 確認角色選擇
     */
    function confirmRoleSelection() {
        const selectedRoleField = document.getElementById('selectedRoleId');
        const contextField = document.getElementById('searchModalContext');
        
        if (!selectedRoleField || !contextField) return;
        
        const roleId = selectedRoleField.value;
        const context = contextField.value;
        
        if (!roleId) return;
        
        // 根據上下文設定相應的欄位
        if (context === 'editRole') {
            const selectedItem = document.querySelector(`[data-role-id="${roleId}"]`);
            if (selectedItem) {
                const roleName = selectedItem.querySelector('h5').textContent;
                const deptPath = selectedItem.querySelector('.text-muted').textContent;
                
                const parentIdField = document.getElementById('editParentRoleId');
                const parentDisplayField = document.getElementById('editParentRoleDisplay');
                
                if (parentIdField) parentIdField.value = roleId;
                if (parentDisplayField) parentDisplayField.value = `${deptPath} / ${roleName}`;
            }
        }
        // 未來可以擴展其他上下文（如新增角色）
        
        closeRoleSearchModal();
    }
    
    /**
     * 顯示重算確認對話框
     */
    async function showRecalculateConfirm() {
        const editRoleIdField = document.getElementById('editRoleId');
        if (!editRoleIdField) return;
        
        const roleId = editRoleIdField.value;
        if (!roleId) return;
        
        try {
            // 預覽影響
            const response = await fetch(`${API_BASE}/department-roles/${roleId}/recalculate-children?preview=true`, {
                method: 'POST',
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('無法獲取預覽資訊');
            }
            
            const result = await response.json();
            
            if (!result.success) {
                if (window.Dialog) {
                    Dialog.error(result.message || '無法獲取預覽資訊');
                }
                return;
            }
            
            // 顯示影響的角色
            const affectedCountField = document.getElementById('affectedRoleCount');
            if (affectedCountField) {
                affectedCountField.textContent = result.count || 0;
            }
            
            const affectedList = document.getElementById('affectedRolesList');
            if (affectedList && result.affected_roles) {
                const html = result.affected_roles.map(role => `
                    <div class="affected-role-item">
                        <strong>${role.name}</strong>
                        <div class="text-muted">${role.department_path}</div>
                        <div class="level-change">層級：${role.old_level} → ${role.new_level}</div>
                    </div>
                `).join('');
                affectedList.innerHTML = html;
            }
            
            // 顯示確認對話框
            const modal = document.getElementById('recalculateConfirmModal');
            if (modal) {
                modal.classList.add('show');
        // 初始化滾動條效果
        if (window.CommonUI && window.CommonUI.initScrollFadeEffect) {
            setTimeout(() => CommonUI.initScrollFadeEffect(), 100);
        }
            }
            
        } catch (error) {
            console.error('獲取預覽資訊失敗:', error);
            if (window.Dialog) {
                Dialog.error('無法獲取預覽資訊');
            }
        }
    }
    
    /**
     * 關閉重算確認對話框
     */
    function closeRecalculateConfirmModal() {
        const modal = document.getElementById('recalculateConfirmModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }
    
    /**
     * 執行重算子角色層級
     */
    async function executeRecalculate() {
        const editRoleIdField = document.getElementById('editRoleId');
        if (!editRoleIdField) return;
        
        const roleId = editRoleIdField.value;
        if (!roleId) return;
        
        try {
            const response = await fetch(`${API_BASE}/department-roles/${roleId}/recalculate-children?preview=false`, {
                method: 'POST',
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('重算失敗');
            }
            
            const result = await response.json();
            
            if (result.success) {
                if (window.Dialog) {
                    Dialog.success(result.message || '重算子角色層級成功');
                }
                
                closeRecalculateConfirmModal();
                
                // 重新載入角色清單以反映更新
                if (refreshDeptTree) {
                    await refreshDeptTree();
                }
                
            } else {
                throw new Error(result.message || '重算失敗');
            }
            
        } catch (error) {
            console.error('執行重算失敗:', error);
            if (window.Dialog) {
                Dialog.error(error.message || '執行重算失敗');
            }
        }
    }

    /**
     * ========================================
     * 角色用戶懸浮卡片功能
     * ========================================
     */
    
    /**
     * 初始化角色用戶懸浮卡片
     */
    function initRoleUsersHoverCard() {
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
        bindRoleUsersHoverEvents();
    }
    
    /**
     * 綁定角色用戶懸浮卡片事件
     */
    function bindRoleUsersHoverEvents() {
        // 關閉按鈕事件
        const closeBtn = roleUsersHoverCard.querySelector('.employee-hover-card-close');
        closeBtn.addEventListener('click', hideRoleUsersHoverCard);
        
        // 背景點擊關閉
        roleUsersHoverBackdrop.addEventListener('click', (e) => {
            if (e.target === roleUsersHoverBackdrop) {
                hideRoleUsersHoverCard();
            }
        });
        
        // ESC 鍵關閉
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && roleUsersHoverBackdrop.classList.contains('show')) {
                hideRoleUsersHoverCard();
            }
        });
        
        // 搜尋輸入事件
        const searchInput = roleUsersHoverCard.querySelector('.employee-hover-search-input');
        searchInput.addEventListener('input', debounceRoleUsers((e) => {
            filterRoleUsers(e.target.value);
        }, 300));
    }
    
    /**
     * 顯示角色用戶懸浮卡片
     */
    async function showRoleUsersHoverCard(roleId) {
        const role = await getRoleById(roleId);
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
        await loadRoleUsersForHoverCard(roleId);
    }
    
    /**
     * 隱藏角色用戶懸浮卡片
     */
    function hideRoleUsersHoverCard() {
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
     * 載入角色用戶資料（懸浮卡片用）
     */
    async function loadRoleUsersForHoverCard(roleId) {
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
            
            renderRoleUsersHoverList();
            
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
     * 渲染角色用戶懸浮列表
     */
    function renderRoleUsersHoverList() {
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
    function filterRoleUsers(keyword) {
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
        renderRoleUsersHoverList();
    }
    
    /**
     * 根據角色ID獲取角色資料
     */
    async function getRoleById(roleId) {
        // 先從快取中查找
        for (const deptRoles of Object.values(departmentRolesCache)) {
            if (Array.isArray(deptRoles)) {
                const role = deptRoles.find(r => r.id == roleId);
                if (role) return role;
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
     * 防抖動函數（角色用戶懸浮卡片專用）
     */
    function debounceRoleUsers(func, wait) {
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
    
    // ===== 角色模板包裝函數 =====
    
    /**
     * 載入角色模板用於新增（包裝函數）
     */
    async function loadRoleTemplatesForAdd(batchMode = false) {
        if (roleTemplateModule) {
            // 如果模板為空，先載入
            if (!roleTemplates || roleTemplates.length === 0) {
                roleTemplates = await roleTemplateModule.loadRoleTemplates() || [];
            }
            await roleTemplateModule.loadRoleTemplatesForAdd(batchMode, roleTemplates);
        }
    }
    
    /**
     * 顯示角色模板模態框（包裝函數）
     */
    async function showRoleTemplateModal(templateId = null) {
        if (roleTemplateModule) {
            // 如果模板為空，先載入
            if (!roleTemplates || roleTemplates.length === 0) {
                roleTemplates = await roleTemplateModule.loadRoleTemplates() || [];
            }
            roleTemplateModule.showRoleTemplateModal(templateId, roleTemplates);
        }
    }
    
    /**
     * 關閉角色模板模態框（包裝函數）
     */
    function closeRoleTemplateModal() {
        if (roleTemplateModule) {
            roleTemplateModule.closeRoleTemplateModal();
        }
    }
    
    /**
     * 儲存角色模板（包裝函數）
     */
    async function saveRoleTemplate() {
        if (roleTemplateModule) {
            const result = await roleTemplateModule.saveRoleTemplate();
            if (result) {
                roleTemplates = result;
            }
        }
    }
    
    /**
     * 編輯角色模板（包裝函數）
     */
    function editRoleTemplate(templateId) {
        if (roleTemplateModule) {
            roleTemplateModule.editTemplate(templateId, roleTemplates);
        }
    }
    
    /**
     * 刪除角色模板（包裝函數）
     */
    async function deleteRoleTemplate(templateId) {
        if (roleTemplateModule) {
            roleTemplates = await roleTemplateModule.deleteTemplate(templateId, roleTemplates);
        }
    }
    
    /**
     * 載入角色模板（包裝函數）
     */
    async function loadRoleTemplates() {
        if (roleTemplateModule) {
            roleTemplates = await roleTemplateModule.loadRoleTemplates();
        }
        return roleTemplates;
    }
    
    /**
     * 取得角色模板列表（包裝函數）
     */
    function getRoleTemplates() {
        return roleTemplates;
    }
    
    /**
     * 根據 ID 取得角色模板（包裝函數）
     */
    function getRoleTemplateById(templateId) {
        if (roleTemplateModule) {
            return roleTemplateModule.getRoleTemplateById(templateId, roleTemplates);
        }
        return null;
    }

    // 公開 API
    return {
        init,
        // 角色模板相關函數（包裝函數）
        loadRoleTemplateSelector,
        loadRoleTemplatesForAdd,
        showRoleTemplateModal,
        closeRoleTemplateModal,
        saveRoleTemplate,
        editRoleTemplate,
        deleteRoleTemplate,
        loadRoleTemplates,
        getRoleTemplates,
        getRoleTemplateById,
        switchToSingleMode,
        switchToBatchMode,
        loadDepartmentRoles,
        createDepartmentRoles,
        renderDepartmentRoles,
        selectRole,
        selectRoleAndShowDepartmentRoles,
        removeUserFromRole,
        // 角色管理頁面功能
        initRoleManagement,
        resetRoleManagementState,
        handleDepartmentNodeClick,
        selectDepartmentForRoles,
        navigateToDepartmentAfterEdit,
        toggleDeptNode,
        showAddRoleModal,
        deleteDepartmentRole,
        refreshDeptTree,
        viewRoleDetails: viewRoleDetails,
        editDepartmentRole: editDepartmentRole,
        getDepartmentRole: getDepartmentRole,
        updateDepartmentRole: updateDepartmentRole,
        selectRole,
        toggleInactiveRoles,
        searchDeptAndRoles,
        // 展開收合功能
        expandAll,
        collapseAll,
        expandDepartmentByRoleId,
        // 統一角色統計服務
        ensureRolesLoaded,
        getRoleStatistics,
        notifyRoleStatsChanged,
        // 角色層級管理功能
        openRoleSearchModal,
        closeRoleSearchModal,
        performRoleSearch,
        displayRoleSearchResults,
        selectSearchRole,
        confirmRoleSelection,
        showRecalculateConfirm,
        closeRecalculateConfirmModal,
        executeRecalculate,
        // 模態框關閉函數
        closeDepartmentRoleModal,
        closeAddDepartmentRoleModal,
        closeEditDepartmentRoleModal,
        closeRoleDetailsModal,
        // 操作確認函數
        confirmAddDepartmentRole,
        confirmEditDepartmentRole,
        // 父角色變更確認功能
        showParentRoleChangeConfirm,
        closeParentRoleChangeConfirmModal,
        confirmParentRoleChange,
        // 角色用戶懸浮卡片功能
        showRoleUsersHoverCard,
        hideRoleUsersHoverCard,
        // 暴露 selectedDeptId 供外部使用
        get selectedDeptId() { return selectedDeptId; },
        // 角色拖曳功能
        handleRoleDragStart,
        handleRoleDragEnd,
        bindRoleDragEvents,
        
        // 部門變更功能
        onEditRoleDepartmentChange,
        resetRoleDepartment,
        resetDepartmentState,      
    };
    
    // === 角色拖曳功能實現 ===
    
    /**
     * 綁定角色拖曳事件
     */
    function bindRoleDragEvents() {
        // 選擇所有角色節點（包括兩種類型）
        const roleNodes = document.querySelectorAll('.role-node, .role-tree-node');
        
        roleNodes.forEach(roleNode => {
            // 檢查是否已經綁定過拖曳事件（避免重複綁定）
            if (roleNode.getAttribute('data-drag-bound') === 'true') {
                // 如果已經綁定過，跳過
                return;
            }
            
            // 只為有 draggable 屬性的節點添加拖曳事件
            if (roleNode.draggable) {
                roleNode.addEventListener('dragstart', handleRoleDragStart);
                roleNode.addEventListener('dragend', handleRoleDragEnd);
                roleNode.setAttribute('data-drag-bound', 'true');
            }
            
            // 為部門管理區塊中的角色節點添加點擊事件
            if (roleNode.classList.contains('role-node') && roleNode.getAttribute('data-click-bound') !== 'true') {
                roleNode.addEventListener('click', handleRoleClick);
                roleNode.setAttribute('data-click-bound', 'true');
            }
        });
    }
    
    /**
     * 處理角色點擊事件
     */
    function handleRoleClick(event) {
        event.stopPropagation();
        const roleId = parseInt(event.currentTarget.dataset.roleId);
        selectRole(roleId);
    }
    
    /**
     * 角色拖曳開始
     */
    function handleRoleDragStart(event) {
        event.stopPropagation();
        
        // 支援兩種類型的角色節點
        const roleElement = event.target.closest('.role-node, .role-tree-node');
        const roleId = roleElement.dataset.roleId;
        const departmentId = roleElement.dataset.departmentId;
        
        draggedRole = {
            id: parseInt(roleId),
            departmentId: parseInt(departmentId),
            element: roleElement
        };
        
        // 添加拖曳樣式和拖曳狀態類別
        roleElement.classList.add('dragging');
        document.body.classList.add('dragging-active');
        
        // 設定拖曳資料
        event.dataTransfer.setData('text/plain', '');
        event.dataTransfer.effectAllowed = 'move';
        
        // 創建自定義拖曳圖像（可選）
        const dragImage = roleElement.cloneNode(true);
        dragImage.classList.add('drag-ghost');
        dragImage.style.position = 'absolute';
        dragImage.style.top = '-1000px';
        document.body.appendChild(dragImage);
        event.dataTransfer.setDragImage(dragImage, 0, 0);
        
        // 稍後移除臨時元素
        setTimeout(() => {
            if (document.body.contains(dragImage)) {
                document.body.removeChild(dragImage);
            }
        }, 0);
        
        // 為所有部門節點添加放置事件監聽器
        setupDepartmentDropZones();
    }
    
    /**
     * 角色拖曳結束
     */
    function handleRoleDragEnd(event) {
        event.stopPropagation();
        
        // 延遲清理，確保 drop 事件先處理
        setTimeout(() => {
            if (draggedRole && draggedRole.element) {
                draggedRole.element.classList.remove('dragging');
            }
            
            // 移除全域拖曳狀態
            document.body.classList.remove('dragging-active');
            
            // 清理所有拖曳樣式
            cleanupDragStyles();
        }, 100);
    }
    
    /**
     * 設定部門節點為放置區域
     */
    function setupDepartmentDropZones() {
        const deptNodes = document.querySelectorAll('.tree-node[data-id]:not([data-id="root"])');
        
        deptNodes.forEach(node => {
            node.addEventListener('dragover', handleDepartmentDragOver);
            node.addEventListener('drop', handleDepartmentDrop);
            node.addEventListener('dragleave', handleDepartmentDragLeave);
        });
    }
    
    /**
     * 部門節點拖曳經過
     */
    function handleDepartmentDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        
        if (!draggedRole) return;
        
        const deptNode = event.currentTarget;
        const targetDeptId = parseInt(deptNode.dataset.id);
        
        // 檢查是否為有效的放置目標
        if (targetDeptId === draggedRole.departmentId) {
            // 不能拖曳到同一個部門
            deptNode.classList.add('drag-invalid');
            event.dataTransfer.dropEffect = 'none';
        } else {
            // 有效的放置目標
            deptNode.classList.add('role-drop-zone');
            event.dataTransfer.dropEffect = 'move';
        }
    }
    
    /**
     * 離開部門節點
     */
    function handleDepartmentDragLeave(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const deptNode = event.currentTarget;
        deptNode.classList.remove('role-drop-zone', 'drag-invalid');
    }
    
    /**
     * 在部門節點放置角色
     */
    async function handleDepartmentDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        
        if (!draggedRole) return;
        
        const deptNode = event.currentTarget;
        const targetDeptId = parseInt(deptNode.dataset.id);
        
        // 保存拖放資料（避免被清理）
        const roleId = draggedRole.id;
        const sourceDeptId = draggedRole.departmentId;
        
        // 檢查是否為有效的移動
        if (targetDeptId === sourceDeptId) {
            // 清理拖曳樣式
            cleanupDragStyles();
            if (window.Dialog) {
                Dialog.warning('角色已在該部門中');
            }
            return;
        }
        
        // 清理拖曳樣式（但保留必要的資料）
        cleanupDragStyles();
        
        // 顯示移動確認對話框
        await showRoleMoveConfirmDialog(roleId, targetDeptId);
    }
    
    /**
     * 清理所有拖曳樣式
     */
    function cleanupDragStyles() {
        // 清理部門節點樣式和臨時事件監聽器
        const allDeptNodes = document.querySelectorAll('.tree-node');
        allDeptNodes.forEach(node => {
            node.classList.remove('role-drop-zone', 'drag-invalid');
            // 只移除拖放相關的臨時事件監聽器
            node.removeEventListener('dragover', handleDepartmentDragOver);
            node.removeEventListener('drop', handleDepartmentDrop);
            node.removeEventListener('dragleave', handleDepartmentDragLeave);
        });
        
        // 清理角色節點樣式
        const roleNodes = document.querySelectorAll('.role-node, .role-tree-node');
        roleNodes.forEach(node => {
            node.classList.remove('dragging');
        });
        
        // 移除全域拖曳狀態
        document.body.classList.remove('dragging-active');
        
        // 重置拖曳狀態
        draggedRole = null;
    }
    
    /**
     * 顯示角色移動確認對話框（支援批量移動選項）
     */
    async function showRoleMoveConfirmDialog(roleId, targetDeptId) {
        try {
            // 先獲取預覽資訊（單獨移動模式）
            const previewResponse = await fetch(`${API_BASE}/department-roles/${roleId}/move-preview`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    new_department_id: targetDeptId,
                    include_children: false
                })
            });
            
            if (!previewResponse.ok) {
                throw new Error('載入預覽資訊失敗');
            }
            
            const previewData = await previewResponse.json();
            
            // 如果有子角色（根據 has_children 判斷），也獲取批量移動的預覽
            let batchPreviewData = null;
            if (previewData.has_children && previewData.children_count > 0) {
                const batchResponse = await fetch(`${API_BASE}/department-roles/${roleId}/move-preview`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        new_department_id: targetDeptId,
                        include_children: true
                    })
                });
                
                if (batchResponse.ok) {
                    batchPreviewData = await batchResponse.json();
                }
            }
            
            // 建立移動確認對話框內容
            let dialogContent = `
                <div class="role-move-dialog">
                    <div class="move-summary">
                        <div class="move-path">
                            <span class="from-dept">${previewData.source_role.current_department}</span>
                            <i class="fas fa-arrow-right mx-1"></i>
                            <span class="to-dept">${previewData.target_department.name || '目標部門'}</span>
                        </div>
                    </div>`;
            
            // 如果有子角色，顯示移動模式選擇
            if (batchPreviewData && batchPreviewData.child_roles.length > 0) {
                dialogContent += `
                    <div class="move-mode-selection">
                        <h5>選擇移動模式</h5>
                        <div class="move-options">
                            <label class="move-option">
                                <input type="radio" name="moveMode" value="single" checked>
                                <div class="option-content">
                                    <div class="option-title">
                                        <i class="fas fa-user"></i>
                                        僅移動 "${previewData.source_role.name}"
                                    </div>
                                    <small class="text-muted">子角色將留在原部門</small>
                                </div>
                            </label>
                            <label class="move-option">
                                <input type="radio" name="moveMode" value="batch">
                                <div class="option-content">
                                    <div class="option-title">
                                        <i class="fas fa-users"></i>
                                        批量移動（包含 ${batchPreviewData.children_count || batchPreviewData.child_roles.length} 個子角色）
                                    </div>
                                    <small class="text-muted">保持完整的層級結構</small>
                                </div>
                            </label>
                        </div>
                    </div>
                    
                    <!-- 子角色預覽（初始隱藏） -->
                    <div class="children-preview" id="childrenPreview" style="display:none;">
                        <h5>將一併移動的子角色</h5>
                        <div class="children-list scrollable-fade">
                            ${batchPreviewData.child_roles.map(child => `
                                <div class="child-role-item">
                                    <span class="role-name">${child.name}</span>
                                    <span class="level-badge">層級 ${child.current_level} → ${child.new_level}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>`;
            }
            
            // 循環引用風險警告
            if (previewData.circular_risks && previewData.circular_risks.length > 0) {
                dialogContent += `
                    <div class="circular-warning">
                        <div class="alert alert-warning">
                            <i class="fas fa-exclamation-triangle"></i>
                            <strong>檢測到潛在風險：</strong>
                            <ul>
                                ${previewData.circular_risks.map(risk => `
                                    <li>${risk.message}</li>
                                `).join('')}
                            </ul>
                        </div>
                    </div>`;
            }
            
            // 警告信息顯示（優先級最高，放在最前面）
            if (previewData.warning) {
                // 顯示智能推算的警告信息
                dialogContent += `
                    <div class="smart-warning">
                        <div class="alert alert-warning">
                            <i class="fas fa-exclamation-triangle"></i>
                            ${previewData.warning}
                        </div>
                    </div>`;
            } else if (previewData.has_descendants_in_target && previewData.descendants_found && previewData.descendants_found.length > 0) {
                // 如果沒有 warning 但有子孫節點信息（備用）
                const descNames = previewData.descendants_found.slice(0, 3).map(d => d.name).join('、');
                const moreCount = previewData.descendants_found.length > 3 ? ` 等${previewData.descendants_found.length}個角色` : '';
                
                dialogContent += `
                    <div class="descendants-warning">
                        <div class="alert alert-warning">
                            <i class="fas fa-exclamation-triangle"></i>
                            <strong>重要提醒：</strong>
                            <p>目標部門包含此角色的子孫節點（${descNames}${moreCount}）</p>
                            <p>為避免循環引用，系統已智能選擇 <strong>${previewData.new_hierarchy.parent_role || '無（頂層角色）'}</strong> 作為父角色</p>
                        </div>
                    </div>`;
            }
            
            // 新層級資訊
            dialogContent += `
                <div class="hierarchy-preview">
                    <h5>層級結構預覽</h5>
                    <div class="hierarchy-info">
                        <div class="role-hierarchy-item">
                            <strong>${previewData.source_role.name}</strong>
                            <div class="hierarchy-details">
                                <span>當前層級：${previewData.source_role.current_level} → 新層級：${previewData.new_hierarchy.new_level}</span>
                                <br>
                                <span>父角色：<strong style="color: #667eea;">${previewData.new_hierarchy.parent_role || '無（頂層角色）'}</strong></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
            
            // 創建自定義對話框
            const dialogElement = document.createElement('div');
            dialogElement.innerHTML = dialogContent;
            
            // 綁定移動模式切換事件
            const radioButtons = dialogElement.querySelectorAll('input[name="moveMode"]');
            radioButtons.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    const childrenPreview = dialogElement.querySelector('#childrenPreview');
                    if (childrenPreview) {
                        childrenPreview.style.display = e.target.value === 'batch' ? 'block' : 'none';
                    }
                });
            });
            
            // 顯示確認對話框
            if (window.Dialog) {
                Dialog.confirm(
                    dialogElement.innerHTML,
                    () => {
                        // 獲取選擇的移動模式
                        const selectedMode = document.querySelector('input[name="moveMode"]:checked');
                        const includeChildren = selectedMode ? selectedMode.value === 'batch' : false;
                        
                        // 執行移動
                        executeRoleMove(roleId, targetDeptId, includeChildren);
                    },
                    {
                        title: '確認角色移動',
                        confirmText: '確認移動',
                        cancelText: '取消',
                        allowHTML: true,
                        width: '600px'
                    }
                );
                
                // 重新綁定事件（Dialog 創建後）
                setTimeout(() => {
                    const dialogRadios = document.querySelectorAll('.modal input[name="moveMode"]');
                    dialogRadios.forEach(radio => {
                        radio.addEventListener('change', (e) => {
                            const preview = document.querySelector('.modal #childrenPreview');
                            if (preview) {
                                preview.style.display = e.target.value === 'batch' ? 'block' : 'none';
                            }
                        });
                    });
                }, 100);
            }
            
        } catch (error) {
            console.error('顯示移動確認對話框失敗:', error);
            if (window.Dialog) {
                Dialog.error('載入移動資訊失敗，請稍後再試');
            }
        }
    }
    
    /**
     * 執行角色移動（支援批量移動）
     */
    async function executeRoleMove(roleId, targetDeptId, includeChildren = false) {
        try {
            const response = await fetch(`${API_BASE}/department-roles/${roleId}/move`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    new_department_id: targetDeptId,
                    include_children: includeChildren
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                
                // 處理循環引用警告
                if (errorData.detail && errorData.detail.includes('循環引用風險')) {
                    // 詢問是否強制執行
                    if (window.Dialog) {
                        Dialog.confirm(
                            `<div class="alert alert-warning">
                                <i class="fas fa-exclamation-triangle"></i>
                                <strong>警告：</strong>${errorData.detail}
                                <br><br>
                                是否要強制執行移動？這可能會導致角色層級關係混亂。
                            </div>`,
                            async () => {
                                // 強制執行移動
                                const forceResponse = await fetch(`${API_BASE}/department-roles/${roleId}/move`, {
                                    method: 'PUT',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    credentials: 'include',
                                    body: JSON.stringify({
                                        new_department_id: targetDeptId,
                                        include_children: includeChildren,
                                        force: true
                                    })
                                });
                                
                                if (forceResponse.ok) {
                                    const forceResult = await forceResponse.json();
                                    handleMoveSuccess(forceResult);
                                } else {
                                    Dialog.error('強制移動失敗');
                                }
                            },
                            {
                                title: '循環引用警告',
                                confirmText: '強制移動',
                                cancelText: '取消',
                                allowHTML: true
                            }
                        );
                    }
                    return;
                }
                
                throw new Error(errorData.detail || '移動角色失敗');
            }
            
            const result = await response.json();
            
            if (result.success) {
                handleMoveSuccess(result);
            } else {
                throw new Error(result.message || '移動失敗');
            }
            
        } catch (error) {
            console.error('執行角色移動失敗:', error);
            if (window.Dialog) {
                Dialog.error(`移動失敗: ${error.message}`);
            }
        }
    }
    
    /**
     * 處理移動成功
     */
    async function handleMoveSuccess(result) {
        try {
            // 顯示成功訊息
            let successMessage = result.message || '角色移動成功';
            
            if (result.move_mode === '批量移動' && result.children_moved > 0) {
                successMessage = `批量移動成功！共移動 ${result.children_moved + 1} 個角色`;
            } else if (result.affected_roles && result.affected_roles.length > 0) {
                successMessage += `\n共影響了 ${result.affected_roles.length} 個角色`;
            }
            
            // 如果有警告訊息，一併顯示
            if (result.warning) {
                successMessage += `\n\n ${result.warning}`;
            }
            
            if (window.Dialog) {
                // 如果有警告，使用 info 而不是 success
                if (result.warning) {
                    Dialog.info(successMessage);
                } else {
                    Dialog.success(successMessage);
                }
            }
            
            // 保存當前選中的部門ID
            const currentSelectedDeptId = selectedDeptId;
            
            // 清理拖放相關樣式
            cleanupDragStyles();
            
            // 重新載入部門樹
            await refreshDeptTree();
            
            // 恢復選中狀態
            if (currentSelectedDeptId) {
                await selectDepartmentForRoles(currentSelectedDeptId);
            }
            
            // 確保 OrganizationRolesModule 在全域可用
            if (!window.OrganizationRolesModule) {
                window.OrganizationRolesModule = OrganizationRolesModule;
            }
            
            // 如果在部門管理頁面，也更新部門樹（但不切換焦點）
            const currentSection = document.querySelector('.content-section.active');
            if (currentSection && currentSection.id === 'departments-section') {
                if (window.OrganizationModule && window.OrganizationModule.refreshTree) {
                    await window.OrganizationModule.refreshTree();
                }
            }
            
        } catch (error) {
            console.error('處理移動成功時發生錯誤:', error);
        }
    }
    
    
})();

// 註冊到全域
window.OrganizationRolesModule = OrganizationRolesModule;