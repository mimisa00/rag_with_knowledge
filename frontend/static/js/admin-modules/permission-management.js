/**
 * 權限管理主模組
 * 處理部門、群組、帳號的 CRUD 操作
 */
const PermissionModule = (function() {
    'use strict';
    
    // API 端點
    const API_BASE = '/api/permissions';
    const ENDPOINTS = {
        groups: `${API_BASE}/groups`,
        permissions: `${API_BASE}/matrix`
    };
    
    // 數據存儲
    let groups = [];
    let allGroups = [];          // 儲存所有群組（包含停用）
    let permissions = [];
    let showInactiveGroups = false;  // 是否顯示停用群組
    let selectedGroupId = null;      // 當前選中的群組ID
    
    /**
     * 初始化模組
     */
    async function init() {
        console.log('PermissionModule 初始化開始');
        
        // 綁定事件
        bindButtonEvents();
        bindModalEvents();
        bindFormEvents();
        
        // 初始化滾動條淡出淡入效果
        if (window.CommonUI && CommonUI.initScrollFadeEffect) {
            CommonUI.initScrollFadeEffect();
        }
        
        // 載入初始數據
        await loadAllData();
        
        // 監聽區塊切換事件
        window.addEventListener('permSectionChange', async (e) => {
            await loadSectionData(e.detail.section);
            // 重新初始化滾動條效果
            setTimeout(() => {
                if (window.CommonUI && CommonUI.initScrollFadeEffect) {
                    CommonUI.initScrollFadeEffect();
                }
            }, 100);
        });
        
        console.log('PermissionModule 初始化完成');
    }
    
    /**
     * 載入所有數據
     */
    async function loadAllData() {
        try {
            showLoadingState();
            
            await Promise.all([
                loadGroups(),
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
            case 'groups':
                await loadGroups();
                break;
            case 'data-scope':
            case 'delegation':
            case 'audit':
                // 這些功能即將推出，暫時不需要載入資料
                break;
        }
        updateStatistics();
    }
    
    
    /**
     * 載入群組數據
     */
    async function loadGroups() {
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
            allGroups = Array.isArray(data) ? data : (data.data || []);
            
            // 根據顯示設定過濾群組
            filterGroups();
            renderGroupTable();
            updateGroupStatistics();
        } catch (error) {
            console.error('載入群組數據失敗:', error);
            // 使用模擬數據作為後備
            allGroups = [];
            filterGroups();
            renderGroupTable();
            updateGroupStatistics();
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
            permissions = [];
        }
    }
        
    
    /**
     * 渲染群組表格
     */
    function renderGroupTable() {
        const tbody = document.getElementById('groupTableBody');
        if (!tbody) return;
        
        if (groups.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">
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
        
        tbody.innerHTML = groups.map(group => `
            <tr class="${group.is_active === false ? 'inactive-row' : ''}" onclick="PermissionModule.selectGroup(${group.id})" data-group-id="${group.id}">
                <td>${group.code || ''}</td>
                <td>${group.name}</td>
                <td>${group.permission_type == 'custom' ? '自訂' : '系統'}</td>
                <td>${group.user_count || 0}</td>
                <td>
                    <span class="status-badge ${group.is_active !== false ? 'status-active' : 'status-disabled'}">
                        ${group.is_active !== false ? '啟用' : '停用'}
                    </span>
                </td>
                <td onclick="event.stopPropagation()">
                    <button class="btn-icon" onclick="PermissionModule.editGroup(${group.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${group.permission_type === 'system' ? 
                        `<button class="btn-icon disabled" title="系統群組無法停用" disabled>
                            <i class="fas fa-trash"></i>
                        </button>` :
                        `<button class="btn-icon ${!group.is_active ? 'disabled' : ''}" ${group.is_active ? `onclick="PermissionModule.deleteGroup(${group.id})"` : ''} title="${group.is_active ? '停用群組' : '已停用'}">
                            <i class="fas fa-trash"></i>
                        </button>`
                    }
                </td>
            </tr>
        `).join('');
    }
    
    /**
     * 渲染過濾後的群組表格
     */
    function renderGroupTableWithFiltered(filteredGroups) {
        const tbody = document.getElementById('groupTableBody');
        if (!tbody) return;
        
        if (filteredGroups.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">
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
        
        tbody.innerHTML = filteredGroups.map(group => `
            <tr onclick="PermissionModule.selectGroup(${group.id})" data-group-id="${group.id}">
                <td>${group.code || ''}</td>
                <td>${group.name}</td>
                <td>${(group.permission_type) === 'system' ? '系統' : '自訂'}</td>
                <td>${group.user_count || 0}</td>
                <td>
                    <span class="status-badge ${group.is_active ? 'status-active' : 'status-disabled'}">
                        ${group.is_active ? '啟用' : '停用'}
                    </span>
                </td>
                <td onclick="event.stopPropagation()">
                    <button class="btn-icon" onclick="PermissionModule.editGroup(${group.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${(group.permission_type) === 'system' ? 
                        `<button class="btn-icon disabled" title="系統群組無法停用" disabled>
                            <i class="fas fa-trash"></i>
                        </button>` :
                        `<button class="btn-icon ${!group.is_active ? 'disabled' : ''}" ${group.is_active ? `onclick="PermissionModule.deleteGroup(${group.id})"` : ''} title="${group.is_active ? '停用群組' : '已停用'}">
                            <i class="fas fa-trash"></i>
                        </button>`
                    }
                </td>
            </tr>
        `).join('');
    }
        
    /**
     * 過濾群組
     */
    function filterGroups() {
        if (showInactiveGroups) {
            groups = [...allGroups];
        } else {
            groups = allGroups.filter(group => group.is_active !== false);
        }
    }
    
    /**
     * 切換停用群組顯示
     */
    function toggleInactiveGroups() {
        showInactiveGroups = !showInactiveGroups;
        
        // 更新按鈕狀態
        const btn = document.getElementById('toggleInactiveGroupsBtn');
        if (btn) {
            if (showInactiveGroups) {
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
        filterGroups();
        renderGroupTable();
        updateGroupStatistics();
    }
    
    /**
     * 更新群組統計數據
     */
    function updateGroupStatistics() {
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
     */
    function updateStatistics() {
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
     * 搜尋群組
     */
    function searchGroup() {
        const searchInput = document.getElementById('groupSearchInput');
        if (!searchInput) return;
        
        const keyword = searchInput.value.trim().toLowerCase();
        
        // 如果沒有關鍵字，顯示所有群組
        if (!keyword) {
            renderGroupTable();
            return;
        }
        
        // 過濾符合條件的群組
        const filteredGroups = groups.filter(group => 
            (group.name && group.name.toLowerCase().includes(keyword)) ||
            (group.code && group.code.toLowerCase().includes(keyword))
        );
        
        // 渲染過濾後的群組表格
        renderGroupTableWithFiltered(filteredGroups);
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
     * 綁定按鈕事件
     */
    function bindButtonEvents() {
        // 新增按鈕        
        const addGroupBtn = document.getElementById('addGroupBtn');
        if (addGroupBtn) {
            addGroupBtn.addEventListener('click', showAddGroupModal);
        }
        
        // 群組搜尋功能
        const groupSearchInput = document.getElementById('groupSearchInput');
        if (groupSearchInput) {
            groupSearchInput.addEventListener('input', debounce(searchGroup, 300));
            // Enter 鍵觸發搜尋
            groupSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    searchGroup();
                }
            });
        }
    }
    
    /**
     * 綁定模態框事件
     */
    function bindModalEvents() {
        // 關閉按鈕事件
        window.closeGroupModal = () => closeModal('groupModal');
        
        // 儲存按鈕事件
        window.saveGroup = saveGroup;
    }
    
    /**
     * 綁定表單事件
     */
    function bindFormEvents() {
        // 表單提交事件        
        const groupForm = document.getElementById('groupForm');
        if (groupForm) {
            groupForm.addEventListener('submit', (e) => {
                e.preventDefault();
                saveGroup();
            });
        }
        
    }
    
    /**
     * 選擇群組
     */
    function selectGroup(groupId) {
        // 記錄當前選中的群組ID
        selectedGroupId = groupId;
        
        // 移除所有群組行的選中狀態
        document.querySelectorAll('#groupTableBody tr').forEach(row => {
            row.classList.remove('selected');
        });
        
        // 為選中的群組行添加選中狀態
        const selectedRow = document.querySelector(`#groupTableBody tr[data-group-id="${groupId}"]`);
        if (selectedRow) {
            selectedRow.classList.add('selected');
        }
        
        // 顯示群組詳情
        showGroupDetails(groupId);
    }
    
    /**
     * 顯示群組詳情
     */
    function showGroupDetails(groupId) {
        const group = allGroups.find(g => g.id == groupId);
        if (!group) return;
        
        const detailsContent = document.querySelector('.group-details .details-content');
        if (detailsContent) {
            detailsContent.innerHTML = `
                <div class="permission-info-content">
                    <div class="group-description">
                        ${group.description || '無描述'}
                    </div>
                    <div class="permission-tags">
                        ${generatePermissionTagsHtml(group)}
                    </div>
                </div>
            `;
        }
    }
    
    /**
     * 生成權限標籤的HTML
     */
    function generatePermissionTagsHtml(group) {
        if (!permissions || permissions.length === 0) {
            return '<span class="text-muted">權限資料載入中...</span>';
        }
        
        const groupPermissions = group.permissions || {};
        
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
                const hasPermission = groupPermissions[perm.code] || false;
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
        
        return categoryBlocks || '<span class="text-muted">此群組尚無權限設定</span>';
    }
            
    /**
     * 顯示新增群組模態框
     */
    async function showAddGroupModal() {
        const modal = document.getElementById('groupModal');
        if (modal) {
            // 清除表單資料
            const form = document.getElementById('groupForm');
            if (form) {
                form.reset();
                document.getElementById('groupId').value = '';
                document.getElementById('groupCode').value = '';
                document.getElementById('groupName').value = '';
                document.getElementById('groupType').value = 'custom';
                // 修正：groupActive 在 HTML 中的實際 ID 是 select 元素，值應該是 "1" 表示啟用
                const groupActiveSelect = document.getElementById('groupActive');
                if (groupActiveSelect) {
                    groupActiveSelect.value = '1';
                }
                const groupDescription = document.getElementById('groupDescription');
                if (groupDescription) {
                    groupDescription.value = '';
                }
            }
            
            // 設定標題為新增
            document.getElementById('groupModalTitle').textContent = '新增群組';
            
            // 新增模式：確保各欄位可編輯（重置之前編輯模式可能設定的禁用狀態）
            document.getElementById('groupCode').disabled = false;
            document.getElementById('groupName').disabled = false;  // 重置群組名稱欄位狀態
            document.getElementById('groupActive').disabled = false;
            
            // 新增模式：禁用群組類型欄位，強制為自訂群組
            const groupTypeSelect = document.getElementById('groupType');
            groupTypeSelect.disabled = true;
            groupTypeSelect.value = 'custom';
            
            // 添加群組類型說明
            let groupTypeNote = document.getElementById('groupTypeNote');
            if (!groupTypeNote) {
                groupTypeNote = document.createElement('small');
                groupTypeNote.id = 'groupTypeNote';
                groupTypeNote.className = 'text-muted';
                groupTypeNote.style.display = 'block';
                groupTypeNote.style.marginTop = '5px';
                groupTypeSelect.parentNode.appendChild(groupTypeNote);
            }
            groupTypeNote.textContent = '新建群組僅能為自訂類型，系統群組由系統預設建立';
            
            // 清除系統群組說明（如果存在）
            const systemGroupNote = document.getElementById('systemGroupNote');
            if (systemGroupNote) {
                systemGroupNote.remove();
            }
            
            // 載入權限選項
            await loadPermissionOptions();
            
            // 清除所有權限的勾選（新增群組時預設不勾選任何權限）
            document.querySelectorAll('input[name="permissions"]').forEach(cb => {
                cb.checked = false;
            });
            
            // 顯示模態框
            modal.classList.add('show');
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
     * 儲存群組
     */
    async function saveGroup() {
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
                showError('群組名稱為必填欄位，請輸入有效的群組名稱');
                return;
            }
        }
        
        // 新增模式：額外檢查群組代碼
        if (!isEdit) {
            const code = formData.get('code');
            if (!code || code.trim() === '') {
                showError('群組代碼為必填欄位，請輸入有效的群組代碼');
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
                permissions: permissionsData
            };
        } else {
            // 非系統群組編輯或新增：完整資料處理
            data = {
                name: name ? name.trim() : '',  // 安全處理可能為 null 的值
                permission_type: groupType,
                is_active: formData.get('is_active') === '1',
                description: formData.get('description') || '',
                permissions: permissionsData
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
            
            showSuccess(isEdit ? '群組更新成功' : '群組新增成功');
            closeModal('groupModal');
            await loadGroups();
            updateStatistics();
            
            // 如果有選中的群組，重新顯示其詳細資訊
            if (selectedGroupId) {
                // 檢查選中的群組是否還存在（可能被刪除）
                const selectedGroup = allGroups.find(g => g.id == selectedGroupId);
                if (selectedGroup) {
                    // 重新選擇該群組，這會更新選中狀態和詳細資訊
                    selectGroup(selectedGroupId);
                } else {
                    // 如果選中的群組不存在了，清除選中狀態
                    selectedGroupId = null;
                }
            }
        } catch (error) {
            showError('儲存群組失敗：' + error.message);
        }
    }
    
    /**
     * 編輯群組
     */
    async function editGroup(id) {
        const group = groups.find(g => g.id === id);
        if (!group) return;
        
        // 填充基本資料
        document.getElementById('groupId').value = group.id;
        document.getElementById('groupCode').value = group.code;
        document.getElementById('groupName').value = group.name;
        // 確保使用正確的選項值 ("custom" 或 "system")
        const groupTypeValue = group.permission_type;
        document.getElementById('groupType').value = groupTypeValue === 'system' ? 'system' : 'custom';
        document.getElementById('groupActive').value = group.is_active ? '1' : '0';
        document.getElementById('groupDescription').value = group.description || '';
        
        // 編輯模式：禁用群組代碼欄位（不可編輯）
        document.getElementById('groupCode').disabled = true;
        
        // 系統群組限制：禁用名稱、狀態和類型欄位
        const isSystemGroup = groupTypeValue === 'system';
        const groupNameInput = document.getElementById('groupName');
        const groupActiveSelect = document.getElementById('groupActive');
        const groupTypeSelect = document.getElementById('groupType');
        
        groupNameInput.disabled = isSystemGroup;
        groupActiveSelect.disabled = isSystemGroup;
        groupTypeSelect.disabled = isSystemGroup;
        
        // 清除群組類型說明（新增模式的說明）
        const groupTypeNote = document.getElementById('groupTypeNote');
        if (groupTypeNote) {
            groupTypeNote.remove();
        }
        
        // 添加系統群組說明
        let systemGroupNote = document.getElementById('systemGroupNote');
        if (isSystemGroup) {
            if (!systemGroupNote) {
                systemGroupNote = document.createElement('small');
                systemGroupNote.id = 'systemGroupNote';
                systemGroupNote.className = 'text-muted';
                systemGroupNote.style.display = 'block';
                systemGroupNote.style.marginTop = '5px';
                groupActiveSelect.parentNode.appendChild(systemGroupNote);
            }
            systemGroupNote.textContent = '系統群組無法變更名稱、狀態和類型，僅可修改描述和權限';
        } else {
            if (systemGroupNote) {
                systemGroupNote.remove();
            }
            // 自訂群組也不能變更類型
            groupTypeSelect.disabled = true;
            
            // 添加自訂群組類型說明
            let customGroupNote = document.getElementById('customGroupNote');
            if (!customGroupNote) {
                customGroupNote = document.createElement('small');
                customGroupNote.id = 'customGroupNote';
                customGroupNote.className = 'text-muted';
                customGroupNote.style.display = 'block';
                customGroupNote.style.marginTop = '5px';
                groupTypeSelect.parentNode.appendChild(customGroupNote);
            }
            customGroupNote.textContent = '群組類型不可變更，保持系統安全性';
        }
        
        // 先載入權限選項
        await loadPermissionOptions();
        
        // 填充權限設定
        const groupPermissions = group.permissions || {};
        
        // 先清除所有權限的勾選
        document.querySelectorAll('input[name="permissions"]').forEach(cb => {
            cb.checked = false;
        });
        
        // 檢查權限列表是否已載入
        if (!permissions || permissions.length === 0) {
            console.warn('權限列表尚未載入，無法填充權限設定');
        } else {
            // 根據群組權限勾選對應的 checkbox
            for (const [permCode, value] of Object.entries(groupPermissions)) {
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
        document.getElementById('groupModalTitle').textContent = '編輯群組';
        
        // 顯示模態框
        showModal('groupModal');
    }
    
    /**
     * 刪除群組（軟刪除：設為停用狀態）
     */
    async function deleteGroup(id) {
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
                
                showSuccess('群組已停用，可透過編輯功能重新啟用');
                await loadGroups();
                updateStatistics();
                
                // 如果刪除的是當前選中的群組，清除選中狀態並清空詳情區塊
                if (selectedGroupId == id) {
                    selectedGroupId = null;
                    const detailsContent = document.querySelector('.group-details .details-content');
                    if (detailsContent) {
                        detailsContent.innerHTML = '<p class="text-muted">請選擇一個群組查看詳情</p>';
                    }
                }
            } catch (error) {
                showError('停用群組失敗：' + error.message);
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
        
    
    // 公開 API
    return {
        init: init,
        saveGroup: saveGroup,
        editGroup: editGroup,
        deleteGroup: deleteGroup,
        searchGroup: searchGroup,
        selectGroup: selectGroup,
        toggleInactiveGroups: toggleInactiveGroups,
        refresh: loadAllData,
        showModal: showModal,
        closeModal: closeModal
    };
})();

// 確保模組可被全域存取
window.PermissionModule = PermissionModule;

// 全域函數（供 HTML onclick 使用）
window.saveGroup = PermissionModule.saveGroup || function() {
    PermissionModule.init().then(() => {
        const module = window.PermissionModule;
        if (module && module.saveGroup) {
            module.saveGroup();
        }
    });
};

window.closeGroupModal = function() {
    const modal = document.getElementById('groupModal');
    if (modal) {
        modal.classList.remove('show');
        const form = modal.querySelector('form');
        if (form) form.reset();
    }
};
