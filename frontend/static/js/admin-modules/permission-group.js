/**
 * 權限群組管理子模組
 * 負責處理群組權限相關的所有功能
 * 作為 permission-management.js 的子模組使用
 */
const PermissionGroupModule = (function() {
    'use strict';
    
    // API 端點
    const API_BASE = '/api/permissions';
    const ENDPOINTS = {
        groups: `${API_BASE}/groups`,
        permissions: `${API_BASE}/matrix`
    };
    
    /**
     * 載入群組數據
     * @param {Object} state - 主模組的狀態物件
     * @returns {Array} 載入的群組陣列
     */
    async function loadGroups(state) {
        try {
            const response = await fetch(ENDPOINTS.groups, {
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
            const loadedGroups = Array.isArray(data) ? data : (data.data || []);
            
            // 回傳載入的數據
            return loadedGroups;
        } catch (error) {
            console.error('載入群組數據失敗:', error);
            // 回傳空陣列作為後備
            return [];
        }
    }
    
    /**
     * 載入權限數據
     * @returns {Array} 載入的權限陣列
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
            let loadedPermissions = [];
            
            // 新的權限矩陣格式：items 陣列
            if (data.items && Array.isArray(data.items)) {
                // 從 permission_matrix 表載入的資料
                data.items.forEach(item => {
                    loadedPermissions.push({
                        id: item.id,  // 使用資料庫 ID
                        code: item.permission_key,
                        name: item.action_name,
                        category: item.module_name,
                        module: item.module_code,
                        action: item.action_code,
                        description: item.description || '',
                        is_active: item.is_active
                    });
                });
            } else if (data.modules) {
                // 舊格式向後相容（configs.permission_matrix）
                data.modules.forEach(module => {
                    module.actions.forEach(action => {
                        loadedPermissions.push({
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
                loadedPermissions = data.data || [];
            }
            
            // 只返回啟用的權限
            return loadedPermissions.filter(p => p.is_active !== false);
        } catch (error) {
            console.error('載入權限數據失敗:', error);
            return [];
        }
    }
    
    /**
     * 載入群組權限數據
     * @param {Number} groupId - 群組ID
     * @returns {Array} 載入的群組權限陣列
     */
    async function loadGroupPermissions(groupId) {
        try {
            const response = await fetch(`${ENDPOINTS.groups}/${groupId}/permissions`, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            // 將 API 返回的權限格式轉換為前端期望的格式
            return data.map(item => ({
                id: item.id,
                code: item.permission_key,
                name: item.action_name,
                category: item.module_name,
                module: item.module_code,
                action: item.action_code,
                description: item.description || '',
                is_active: item.is_active,
                assigned_at: item.assigned_at
            }));
        } catch (error) {
            console.error('載入群組權限失敗:', error);
            return [];
        }
    }
    
    /**
     * 渲染群組表格
     * @param {Array} groups - 群組陣列
     * @param {String} mainModule - 主模組名稱
     */
    function renderGroupTable(groups, mainModule = 'PermissionModule') {
        const tbody = document.getElementById('groupTableBody');
        if (!tbody) return;
        
        if (groups.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center">
                        <div class="empty-state">
                            <i class="fas fa-user-shield"></i>
                            <h3>尚無群組資料</h3>
                            <p>點擊「新增群組」開始建立群組</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        // 使用 DocumentFragment 批次更新 DOM
        const fragment = document.createDocumentFragment();
        const template = document.createElement('template');
        
        // 建立 HTML 字串（移除 inline event handlers）
        const htmlString = groups.map(group => `
            <tr class="${group.is_active === false ? 'inactive-row' : ''}" data-group-id="${group.id}" data-module="${mainModule}">
                <td>${group.code || ''}</td>
                <td>${group.name}</td>
                <td>${group.permission_type == 'custom' ? '自訂' : '系統'}</td>
                <td>
                    <span class="node-count" 
                          data-action="users"
                          data-group-id="${group.id}"
                          title="點擊查看使用者詳情">
                        ${group.user_count || 0}
                    </span>
                </td>
                <td>
                    <span class="node-count" 
                          data-action="departments"
                          data-group-id="${group.id}"
                          title="點擊查看部門分布詳情">
                        ${group.department_count || 0}
                    </span>
                </td>
                <td>
                    <span class="node-count" 
                          data-action="roles"
                          data-group-id="${group.id}"
                          title="點擊查看角色權限詳情">
                        ${group.role_count || 0}
                    </span>
                </td>
                <td>
                    <span class="status-badge ${group.is_active !== false ? 'status-active' : 'status-disabled'}">
                        ${group.is_active !== false ? '啟用' : '停用'}
                    </span>
                </td>
                <td data-action="buttons">
                    <button class="btn-icon" data-action="edit" data-group-id="${group.id}" title="編輯群組">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon" data-action="batch-org" data-group-id="${group.id}" title="批次組織設定">
                        <i class="fas fa-sitemap"></i>
                    </button>
                    ${group.permission_type === 'system' ? 
                        `<button class="btn-icon disabled" title="系統群組無法停用" disabled>
                            <i class="fas fa-trash"></i>
                        </button>` :
                        `<button class="btn-icon ${!group.is_active ? 'disabled' : ''}" ${group.is_active ? `data-action="delete" data-group-id="${group.id}"` : ''} title="${group.is_active ? '停用群組' : '已停用'}">
                            <i class="fas fa-trash"></i>
                        </button>`
                    }
                </td>
            </tr>
        `).join('');
        
        template.innerHTML = htmlString;
        fragment.appendChild(template.content);
        
        // 清空並更新 tbody
        tbody.removeAttribute('data-delegated'); // 移除標記以確保重新綁定
        tbody.innerHTML = '';
        tbody.appendChild(fragment);
        
        // 始終重新設置事件委託
        setupTableEventDelegation(tbody, mainModule);
        tbody.setAttribute('data-delegated', 'true');
    }
    
    /**
     * 渲染過濾後的群組表格
     * @param {Array} filteredGroups - 過濾後的群組陣列
     * @param {String} mainModule - 主模組名稱
     */
    function renderGroupTableWithFiltered(filteredGroups, mainModule = 'PermissionModule') {
        const tbody = document.getElementById('groupTableBody');
        if (!tbody) return;
        
        if (filteredGroups.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center">
                        <div class="empty-state">
                            <i class="fas fa-search"></i>
                            <h3>找不到符合的群組</h3>
                            <p>請嘗試其他搜尋關鍵字</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        // 使用 DocumentFragment 批次更新 DOM
        const fragment = document.createDocumentFragment();
        const template = document.createElement('template');
        
        // 建立 HTML 字串（移除 inline event handlers）
        const htmlString = filteredGroups.map(group => `
            <tr data-group-id="${group.id}" data-module="${mainModule}">
                <td>${group.code || ''}</td>
                <td>${group.name}</td>
                <td>${(group.permission_type) === 'system' ? '系統' : '自訂'}</td>
                <td>
                    <span class="node-count" 
                          data-action="users"
                          data-group-id="${group.id}"
                          title="點擊查看使用者詳情">
                        ${group.user_count || 0}
                    </span>
                </td>
                <td>
                    <span class="node-count" 
                          data-action="departments"
                          data-group-id="${group.id}"
                          title="點擊查看部門分布詳情">
                        ${group.department_count || 0}
                    </span>
                </td>
                <td>
                    <span class="node-count" 
                          data-action="roles"
                          data-group-id="${group.id}"
                          title="點擊查看角色權限詳情">
                        ${group.role_count || 0}
                    </span>
                </td>
                <td>
                    <span class="status-badge ${group.is_active ? 'status-active' : 'status-disabled'}">
                        ${group.is_active ? '啟用' : '停用'}
                    </span>
                </td>
                <td data-action="buttons">
                    <button class="btn-icon" data-action="edit" data-group-id="${group.id}" title="編輯群組">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon" data-action="batch-org" data-group-id="${group.id}" title="批次組織設定">
                        <i class="fas fa-sitemap"></i>
                    </button>
                    ${(group.permission_type) === 'system' ? 
                        `<button class="btn-icon disabled" title="系統群組無法停用" disabled>
                            <i class="fas fa-trash"></i>
                        </button>` :
                        `<button class="btn-icon ${!group.is_active ? 'disabled' : ''}" ${group.is_active ? `data-action="delete" data-group-id="${group.id}"` : ''} title="${group.is_active ? '停用群組' : '已停用'}">
                            <i class="fas fa-trash"></i>
                        </button>`
                    }
                </td>
            </tr>
        `).join('');
        
        template.innerHTML = htmlString;
        fragment.appendChild(template.content);
        
        // 清空並更新 tbody
        tbody.removeAttribute('data-delegated'); // 移除標記以確保重新綁定
        tbody.innerHTML = '';
        tbody.appendChild(fragment);
        
        // 始終重新設置事件委託
        setupTableEventDelegation(tbody, mainModule);
        tbody.setAttribute('data-delegated', 'true');
    }
    
    /**
     * 設置表格事件委託
     * @param {HTMLElement} tbody - 表格 tbody 元素
     * @param {String} mainModule - 主模組名稱
     */
    function setupTableEventDelegation(tbody, mainModule) {
        // 先移除現有的事件監聽器（如果有）
        const oldHandler = tbody._clickHandler;
        if (oldHandler) {
            tbody.removeEventListener('click', oldHandler);
        }
        
        // 建立新的事件處理器
        const clickHandler = function(e) {
            const target = e.target;
            const tr = target.closest('tr');
            
            if (!tr || !tr.dataset.groupId) return;
            
            const groupId = parseInt(tr.dataset.groupId);
            const clickedElement = target.closest('[data-action]');
            const action = clickedElement?.dataset.action;
            
            // 處理特定操作
            if (action) {
                e.stopPropagation();
                const actionGroupId = clickedElement.dataset.groupId || clickedElement.closest('[data-group-id]')?.dataset.groupId;
                
                switch(action) {
                    case 'users':
                        // 只在點擊 span.node-count 時觸發
                        if (clickedElement.classList.contains('node-count')) {
                            if (window[mainModule] && window[mainModule].showGroupUsersHoverCard) {
                                window[mainModule].showGroupUsersHoverCard(parseInt(actionGroupId));
                            }
                        }
                        break;
                    case 'departments':
                        // 只在點擊 span.node-count 時觸發，顯示部門分布
                        if (clickedElement.classList.contains('node-count')) {
                            if (window[mainModule] && window[mainModule].showViewDepartmentModal) {
                                window[mainModule].showViewDepartmentModal(parseInt(actionGroupId), 'departments');
                            }
                        }
                        break;
                    case 'roles':
                        // 只在點擊 span.node-count 時觸發，顯示角色權限詳情
                        if (clickedElement.classList.contains('node-count')) {
                            if (window[mainModule] && window[mainModule].showViewDepartmentModal) {
                                window[mainModule].showViewDepartmentModal(parseInt(actionGroupId), 'roles');
                            }
                        }
                        break;
                    case 'edit':
                        if (window[mainModule] && window[mainModule].editGroup) {
                            window[mainModule].editGroup(parseInt(actionGroupId));
                        }
                        break;
                    case 'batch-org':
                        if (window.PermissionBatchOrgModule && window.PermissionBatchOrgModule.showBatchOrgModal) {
                            window.PermissionBatchOrgModule.showBatchOrgModal(parseInt(actionGroupId));
                        }
                        break;
                    case 'delete':
                        if (window[mainModule] && window[mainModule].deleteGroup) {
                            window[mainModule].deleteGroup(parseInt(actionGroupId));
                        }
                        break;
                    case 'buttons':
                        // 按鈕區域，不觸發行選擇
                        return;
                }
            } else {
                // 點擊行本身（但不是有 action 的元素），選擇群組
                if (window[mainModule] && window[mainModule].selectGroup) {
                    window[mainModule].selectGroup(groupId);
                }
            }
        };
        
        // 儲存處理器參考以便之後移除
        tbody._clickHandler = clickHandler;
        
        // 綁定事件監聽器
        tbody.addEventListener('click', clickHandler, { passive: true });
    }
    
    /**
     * 過濾群組
     * @param {Array} allGroups - 所有群組
     * @param {Boolean} showInactive - 是否顯示停用群組
     * @returns {Array} 過濾後的群組陣列
     */
    function filterGroups(allGroups, showInactive) {
        if (showInactive) {
            return [...allGroups];
        } else {
            return allGroups.filter(group => group.is_active !== false);
        }
    }
    
    /**
     * 更新群組統計數據
     * @param {Array} allGroups - 所有群組陣列
     */
    function updateGroupStatistics(allGroups) {
        const totalGroups = allGroups.length;
        const activeGroups = allGroups.filter(g => g.is_active !== false).length;
        const inactiveGroups = allGroups.filter(g => g.is_active === false).length;
        
        const totalCount = document.querySelector('#totalGroupCount');
        const activeCount = document.querySelector('#activeGroupCount strong');
        const inactiveCount = document.querySelector('#inactiveGroupCount strong');
        
        if (totalCount) totalCount.textContent = totalGroups;
        if (activeCount) activeCount.textContent = activeGroups;
        if (inactiveCount) inactiveCount.textContent = inactiveGroups;
    }
    
    /**
     * 更新統計資訊
     * @param {Array} allGroups - 所有群組
     * @param {Array} permissions - 權限陣列
     */
    function updateStatistics(allGroups, permissions) {
        // 更新狀態列統計
        const groupCount = document.querySelector('#groupCount span');
        if (groupCount) {
            groupCount.textContent = allGroups.length;
        }
        
        const permissionCount = document.querySelector('#permissionCount span');
        if (permissionCount) {
            permissionCount.textContent = permissions.length;
        }
        
        // 計算總用戶數（所有群組的用戶數總和）
        const totalUsers = allGroups.reduce((sum, group) => sum + (group.user_count || 0), 0);
        const userCount = document.querySelector('#userCount span');
        if (userCount) {
            userCount.textContent = totalUsers;
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
     * 顯示群組詳情
     * @param {Number} groupId - 群組ID
     * @param {Array} allGroups - 所有群組
     * @param {Array} permissions - 權限陣列
     */
    async function showGroupDetails(groupId, allGroups, permissions) {
        const group = allGroups.find(g => g.id == groupId);
        if (!group) return;
        
        const detailsContent = document.querySelector('.group-details .details-content');
        if (!detailsContent) return;
        
        // 使用 DocumentFragment 進行批次更新
        const fragment = document.createDocumentFragment();
        const wrapper = document.createElement('div');
        wrapper.className = 'permission-info-content';
        
        // 建立描述區塊
        const descDiv = document.createElement('div');
        descDiv.className = 'group-description';
        descDiv.textContent = group.description || '無描述';
        wrapper.appendChild(descDiv);
        
        // 建立權限標籤容器
        const tagsDiv = document.createElement('div');
        tagsDiv.className = 'permission-tags';
        tagsDiv.id = `permission-tags-${groupId}`;
        tagsDiv.innerHTML = '<span class="text-muted">載入權限中...</span>';
        wrapper.appendChild(tagsDiv);
        
        fragment.appendChild(wrapper);
        
        // 一次性更新 DOM
        detailsContent.innerHTML = '';
        detailsContent.appendChild(fragment);
        
        // 異步載入群組權限並顯示
        try {
            const groupPermissions = await loadGroupPermissions(groupId);
            const tagsContainer = document.getElementById(`permission-tags-${groupId}`);
            if (tagsContainer) {
                tagsContainer.innerHTML = generatePermissionTagsHtml(group, permissions, groupPermissions);
            }
        } catch (error) {
            console.error('載入群組權限失敗:', error);
            const tagsContainer = document.getElementById(`permission-tags-${groupId}`);
            if (tagsContainer) {
                tagsContainer.innerHTML = '<span class="text-muted">無法載入權限資料</span>';
            }
        }
    }
    
    /**
     * 生成權限標籤的HTML
     * @param {Object} group - 群組物件
     * @param {Array} permissions - 所有權限陣列（用於參考）
     * @param {Array} groupPermissions - 群組擁有的權限陣列
     * @returns {String} HTML字串
     */
    function generatePermissionTagsHtml(group, permissions, groupPermissions) {
        // 如果沒有群組權限資料
        if (!groupPermissions || groupPermissions.length === 0) {
            return '<span class="text-muted">此群組尚無權限設定</span>';
        }
        
        // 按類別分組權限
        const permissionsByCategory = {};
        groupPermissions.forEach(perm => {
            const category = perm.category || '其他';
            if (!permissionsByCategory[category]) {
                permissionsByCategory[category] = [];
            }
            permissionsByCategory[category].push({
                name: perm.name,
                code: perm.code,
                description: perm.description
            });
        });
        
        // 生成分類的權限區塊
        const categoryBlocks = Object.keys(permissionsByCategory).map(category => {
            const categoryPermissions = permissionsByCategory[category];
            const permissionTags = categoryPermissions.map(perm => 
                `<span class="permission-tag" title="${perm.description || perm.code}">
                    <i class="fas fa-check-circle"></i> ${perm.name}
                </span>`
            ).join('');
            
            return `
                <div class="permission-category-block">
                    <div class="permission-category-title">${category}</div>
                    <div class="permission-category-tags">
                        ${permissionTags}
                    </div>
                </div>
            `;
        }).join('');
        
        return categoryBlocks;
    }
    
    /**
     * 載入權限選項
     * @param {Array} permissions - 權限陣列
     */
    function loadPermissionOptions(permissions) {
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
                            <label title="${perm.description || perm.code}">
                                <input type="checkbox" name="permissions" value="${perm.id}" data-permission-key="${perm.code}">
                                ${perm.name}
                            </label>
                        `).join('')}
                    </div>
                </div>
            `).join('');
    }
    
    /**
     * 儲存群組
     * @param {Array} groups - 群組陣列
     * @param {Array} permissions - 權限陣列
     * @param {Function} refreshCallback - 重新載入回調函數
     */
    async function saveGroup(groups, permissions, refreshCallback) {
        const form = document.getElementById('groupForm');
        if (!form) return;
        
        const formData = new FormData(form);
        const groupId = formData.get('id');
        const isEdit = groupId && groupId !== '';
        
        // 前端驗證：根據新增/編輯模式檢查必填欄位
        const name = formData.get('name');
        
        // 判斷是否為系統群組編輯（系統群組的某些欄位會被禁用）
        const isSystemGroupEdit = isEdit && groups.find(g => g.id == groupId && (g.permission_type === 'system' || g.type === 'system'));
        
        // 只對非系統群組編輯進行名稱驗證（系統群組編輯時名稱欄位被禁用）
        if (!isSystemGroupEdit) {
            if (!name || name.trim() === '') {
                if (window.Dialog) {
                    Dialog.error('群組名稱為必填欄位，請輸入有效的群組名稱');
                } else {
                    alert('群組名稱為必填欄位，請輸入有效的群組名稱');
                }
                return;
            }
        }
        
        // 新增模式：額外檢查群組代碼
        if (!isEdit) {
            const code = formData.get('code');
            if (!code || code.trim() === '') {
                if (window.Dialog) {
                    Dialog.error('群組代碼為必填欄位，請輸入有效的群組代碼');
                } else {
                    alert('群組代碼為必填欄位，請輸入有效的群組代碼');
                }
                return;
            }
        }
        
        const permissionIds = [];
        
        // 檢查權限列表是否已載入
        if (!permissions || permissions.length === 0) {
            console.warn('權限列表尚未載入，將嘗試不包含權限資料儲存');
        } else {
            // 收集權限 ID - 只收集 name="permissions" 的 checkbox
            form.querySelectorAll('input[name="permissions"]:checked').forEach(cb => {
                // 使用 checkbox 的 value 作為權限 ID（數字）
                const permId = parseInt(cb.value);
                if (!isNaN(permId)) {
                    permissionIds.push(permId);
                }
            });
        }
        
        // 建立基本資料 - 處理禁用欄位的問題
        let groupType = formData.get('type');  // HTML 中的 name 是 "type"
        // 如果 groupType 為 null（因為欄位被禁用），則設定預設值
        if (!groupType) {
            groupType = 'custom';  // 新增時強制為 custom，編輯時從現有群組獲取
            if (isEdit) {
                const group = groups.find(g => g.id == groupId);
                if (group) {
                    groupType = group.permission_type || 'custom';
                }
            }
        }
        
        // 根據編輯模式構建資料對象
        let data;
        
        if (isSystemGroupEdit) {
            // 系統群組編輯：只包含允許編輯的欄位，避免處理禁用欄位
            data = {
                description: formData.get('description') || '',
                permission_ids: permissionIds  // 使用權限 ID 陣列
            };
        } else {
            // 非系統群組編輯或新增：完整資料處理
            data = {
                name: name ? name.trim() : '',  // 安全處理可能為 null 的值
                permission_type: groupType,
                is_active: formData.get('is_active') === '1',
                description: formData.get('description') || '',
                permission_ids: permissionIds  // 使用權限 ID 陣列
            };
            
            // 新增模式：加入群組代碼
            if (!isEdit) {
                const code = formData.get('code');
                data.code = code ? code.trim() : '';  // 安全處理 code
            }
        }
        
        try {
            // 調試資訊：顯示要發送的資料
            console.log('保存群組 - 發送資料:', data);
            console.log('編輯模式:', isEdit, '群組ID:', groupId);
            
            const url = isEdit ? `${ENDPOINTS.groups}/${groupId}` : ENDPOINTS.groups;
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
                const errorData = await response.json().catch(() => ({}));
                console.error('群組儲存失敗:', response.status, errorData);
                
                // 處理詳細的驗證錯誤
                let errorMessage = `儲存失敗 (${response.status})`;
                if (errorData.detail) {
                    errorMessage += `: ${errorData.detail}`;
                }
                if (errorData.errors && errorData.errors.length > 0) {
                    const fieldErrors = errorData.errors.map(err => 
                        `${err.loc.join('.')}: ${err.msg}`
                    ).join(', ');
                    errorMessage += `\n詳細錯誤: ${fieldErrors}`;
                }
                
                throw new Error(errorMessage);
            }
            
            if (window.Dialog) {
                Dialog.success(isEdit ? '群組更新成功' : '群組新增成功');
            } else {
                alert(isEdit ? '群組更新成功' : '群組新增成功');
            }
            
            closeModal('groupModal');
            
            // 執行回調函數以重新載入資料
            if (refreshCallback) {
                await refreshCallback();
            }
            
        } catch (error) {
            if (window.Dialog) {
                Dialog.error('儲存群組失敗：' + error.message);
            } else {
                alert('儲存群組失敗：' + error.message);
            }
        }
    }
    
    /**
     * 刪除群組（軟刪除：設為停用狀態）
     * @param {Number} id - 群組ID
     * @param {Array} groups - 群組陣列
     * @param {Function} refreshCallback - 重新載入回調函數
     */
    async function deleteGroup(id, groups, refreshCallback) {
        const group = groups.find(g => g.id === id);
        
        // 雙重檢查：如果群組已經停用，直接返回不執行任何操作
        if (group && !group.is_active) {
            return;
        }
        
        const groupName = group ? group.name : '此群組';
        
        Dialog.confirm(`確定要停用群組「${groupName}」嗎？<br><small class="text-muted">停用後可透過編輯功能重新啟用</small>`, async () => {
            try {
                const response = await fetch(`${ENDPOINTS.groups}/${id}`, {
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
                
                if (window.Dialog) {
                    Dialog.success('群組已停用，可透過編輯功能重新啟用');
                } else {
                    alert('群組已停用，可透過編輯功能重新啟用');
                }
                
                // 執行回調函數以重新載入資料
                if (refreshCallback) {
                    await refreshCallback();
                }
                
            } catch (error) {
                if (window.Dialog) {
                    Dialog.error('停用群組失敗：' + error.message);
                } else {
                    alert('停用群組失敗：' + error.message);
                }
            }
        }, {
            allowHTML: true
        });
    }
    
    /**
     * 關閉模態框
     * @param {String} modalId - 模態框ID
     */
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
     * 顯示模態框
     * @param {String} modalId - 模態框ID
     */
    function showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
        }
    }
    
    /**
     * 更新單一群組資料（用於批次組織設定後的即時更新）
     * @param {Object} groupData - 群組資料
     * @param {Array} allGroups - 所有群組陣列
     * @returns {Array} 更新後的群組陣列
     */
    function updateSingleGroup(groupData, allGroups) {
        try {
            // 更新 allGroups 陣列中的群組資料
            const groupIndex = allGroups.findIndex(g => g.id == groupData.id);
            if (groupIndex !== -1) {
                allGroups[groupIndex] = { ...allGroups[groupIndex], ...groupData };
            }
            
            // 只更新表格中對應的行，而不是重新渲染整個表格
            updateGroupRowInTable(groupData);
            
            return allGroups;
            
        } catch (error) {
            console.error('更新單一群組資料失敗:', error);
            return allGroups;
        }
    }
    
    /**
     * 更新表格中特定群組的行
     * @param {Object} groupData - 群組資料
     */
    function updateGroupRowInTable(groupData) {
        try {
            const row = document.querySelector(`tr[data-group-id="${groupData.id}"]`);
            if (row) {
                // 找到使用部門列（第5個td，索引為4）
                const deptCell = row.cells[4];
                if (deptCell) {
                    // 更新部門數量顯示，保持原有的點擊事件和樣式
                    const spanElement = deptCell.querySelector('.node-count');
                    if (spanElement) {
                        spanElement.textContent = groupData.department_count || 0;
                    }
                }
                
                // 如果需要，也可以更新其他欄位
                if (groupData.user_count !== undefined) {
                    const userCell = row.cells[3];
                    if (userCell) {
                        const userSpanElement = userCell.querySelector('.node-count');
                        if (userSpanElement) {
                            userSpanElement.textContent = groupData.user_count || 0;
                        }
                    }
                }
            }
        } catch (error) {
            console.error('更新群組表格行失敗:', error);
        }
    }
    
    // 公開 API
    return {
        loadGroups: loadGroups,
        loadPermissions: loadPermissions,
        loadGroupPermissions: loadGroupPermissions,
        renderGroupTable: renderGroupTable,
        renderGroupTableWithFiltered: renderGroupTableWithFiltered,
        filterGroups: filterGroups,
        updateGroupStatistics: updateGroupStatistics,
        updateStatistics: updateStatistics,
        showLoadingState: showLoadingState,
        hideLoadingState: hideLoadingState,
        showGroupDetails: showGroupDetails,
        loadPermissionOptions: loadPermissionOptions,
        saveGroup: saveGroup,
        deleteGroup: deleteGroup,
        closeModal: closeModal,
        showModal: showModal,
        updateSingleGroup: updateSingleGroup,
        updateGroupRowInTable: updateGroupRowInTable
    };
})();

// 確保模組可被全域存取
window.PermissionGroupModule = PermissionGroupModule;
