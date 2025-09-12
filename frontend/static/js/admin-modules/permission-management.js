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
    let previousSelectedRow = null;  // 快取之前選中的行元素
    
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
        
        // 檢查當前顯示的區塊
        const activeSection = document.querySelector('.content-section.active');
        console.log('當前顯示的區塊:', activeSection ? activeSection.id : 'none');
        
        if (activeSection && activeSection.id === 'matrix-section') {
            // 如果當前顯示的是權限矩陣區塊，初始化權限矩陣模組
            console.log('準備初始化權限矩陣模組...');
            if (window.PermissionMatrixModule) {
                await PermissionMatrixModule.init();
            } else {
                console.error('PermissionMatrixModule 未載入');
            }
        } else if (activeSection && activeSection.id === 'groups-section') {
            // 載入群組數據
            await loadAllData();
        } else if (activeSection && activeSection.id === 'access-section') {
            // 如果當前顯示的是權限存取區塊，初始化權限存取模組
            console.log('準備初始化權限存取模組...');
            if (window.PermissionAccessModule) {
                await PermissionAccessModule.init();
            } else {
                console.error('PermissionAccessModule 未載入');
            }
        }
        
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
        
        // 初始化員工懸浮卡片模組
        if (window.EmployeeHoverCard) {
            console.log('初始化通用員工懸浮卡片元件');
            EmployeeHoverCard.init();
        } else {
            console.warn('員工懸浮卡片元件不存在，懸浮卡片功能將無法使用');
        }
        
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
            case 'matrix':
                // 權限矩陣管理 - 由 PermissionMatrixModule 處理
                if (window.PermissionMatrixModule) {
                    await PermissionMatrixModule.init();
                }
                break;
            case 'groups':
                // 載入完整資料（群組和權限）以確保資料同步
                await loadAllData();
                break;
            case 'access':
                // 權限存取管理 - 由 PermissionAccessModule 處理
                if (window.PermissionAccessModule) {
                    await PermissionAccessModule.init();
                } else {
                    console.error('PermissionAccessModule 未載入');
                }
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
            // 使用子模組的載入功能
            if (window.PermissionGroupModule) {
                allGroups = await PermissionGroupModule.loadGroups();
            }             
            // 根據顯示設定過濾群組
            filterGroups();
            renderGroupTable();
            updateGroupStatistics();
        } catch (error) {
            console.error('載入群組數據失敗:', error);
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
            // 使用子模組的載入功能
            if (window.PermissionGroupModule) {
                permissions = await PermissionGroupModule.loadPermissions();
            } 
        } catch (error) {
            console.error('載入權限數據失敗:', error);
            permissions = [];
        }
    }
        
    
    /**
     * 渲染群組表格
     */
    function renderGroupTable() {
        // 使用子模組的渲染功能
        if (window.PermissionGroupModule) {
            PermissionGroupModule.renderGroupTable(groups, 'PermissionModule');
        }
    }
    
    /**
     * 渲染過濾後的群組表格
     */
    function renderGroupTableWithFiltered(filteredGroups) {
        // 使用子模組的渲染功能
        if (window.PermissionGroupModule) {
            PermissionGroupModule.renderGroupTableWithFiltered(filteredGroups, 'PermissionModule');
        }
    }
        
    /**
     * 過濾群組
     */
    function filterGroups() {
        // 使用子模組的過濾功能
        if (window.PermissionGroupModule) {
            groups = PermissionGroupModule.filterGroups(allGroups, showInactiveGroups);
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
        // 使用子模組的統計功能
        if (window.PermissionGroupModule) {
            PermissionGroupModule.updateGroupStatistics(allGroups);
        }
    }
        
    /**
     * 更新統計資訊
     */
    function updateStatistics() {
        // 使用子模組的統計功能
        if (window.PermissionGroupModule) {
            PermissionGroupModule.updateStatistics(allGroups, permissions);
        }
    }
    
        
    /**
     * 顯示載入狀態
     */
    function showLoadingState() {
        if (window.PermissionGroupModule) {
            PermissionGroupModule.showLoadingState();
        }
    }
    
    /**
     * 隱藏載入狀態
     */
    function hideLoadingState() {
        if (window.PermissionGroupModule) {
            PermissionGroupModule.hideLoadingState();
        }
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
     * @param {Number} groupId - 群組ID
     * @param {Boolean} forceRefresh - 是否強制刷新（即使是相同的群組）
     */
    function selectGroup(groupId, forceRefresh = false) {
        // 避免重複選擇同一個群組（除非強制刷新）
        if (!forceRefresh && selectedGroupId === groupId) return;
        
        // 記錄當前選中的群組ID
        selectedGroupId = groupId;
        
        // 使用 requestAnimationFrame 批次處理 DOM 更新
        requestAnimationFrame(() => {
            // 優化：使用快取的元素參考
            if (previousSelectedRow) {
                previousSelectedRow.classList.remove('selected');
            }
            
            // 為選中的群組行添加選中狀態
            const tbody = document.getElementById('groupTableBody');
            if (tbody) {
                const selectedRow = tbody.querySelector(`tr[data-group-id="${groupId}"]`);
                if (selectedRow) {
                    selectedRow.classList.add('selected');
                    previousSelectedRow = selectedRow; // 快取當前選中的行
                }
            }
            
            // 使用 requestIdleCallback 處理非關鍵的詳情顯示
            if ('requestIdleCallback' in window) {
                requestIdleCallback(() => {
                    showGroupDetails(groupId);
                }, { timeout: 50 });
            } else {
                // 降級到 setTimeout
                setTimeout(() => {
                    showGroupDetails(groupId);
                }, 0);
            }
        });
    }
    
    /**
     * 顯示群組詳情
     */
    function showGroupDetails(groupId) {
        // 使用子模組的顯示詳情功能
        if (window.PermissionGroupModule) {
            PermissionGroupModule.showGroupDetails(groupId, allGroups, permissions);
        }
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
        // 使用子模組的載入選項功能
        if (window.PermissionGroupModule) {
            PermissionGroupModule.loadPermissionOptions(permissions);
        }
    }
            
    /**
     * 儲存群組
     */
    async function saveGroup() {
        // 使用子模組的儲存功能
        if (window.PermissionGroupModule) {
            await PermissionGroupModule.saveGroup(groups, permissions, async () => {
                // 重新載入群組和權限資料以確保同步
                await Promise.all([
                    loadGroups(),
                    loadPermissions()
                ]);
                updateStatistics();
                
                // 如果有選中的群組，重新顯示其詳細資訊
                if (selectedGroupId) {
                    // 檢查選中的群組是否還存在（可能被刪除）
                    const selectedGroup = allGroups.find(g => g.id == selectedGroupId);
                    if (selectedGroup) {
                        // 重新選擇該群組，強制刷新以更新權限資訊
                        selectGroup(selectedGroupId, true);
                    } else {
                        // 如果選中的群組不存在了，清除選中狀態
                        selectedGroupId = null;
                    }
                }
            });
            return;
        }
    }
    
    /**
     * 編輯群組
     */
    async function editGroup(id) {
        const group = groups.find(g => g.id === id);
        if (!group) return;
        
        // 記錄正在編輯的群組為選中狀態
        selectedGroupId = id;
        
        // 確保權限資料是最新的
        if (!permissions || permissions.length === 0) {
            await loadPermissions();
        }
        
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
        
        // 先清除所有權限的勾選
        document.querySelectorAll('input[name="permissions"]').forEach(cb => {
            cb.checked = false;
        });
        
        // 從 API 載入群組的權限 ID
        try {
            const permResponse = await fetch(`/api/permissions/groups/${id}/permissions`, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (permResponse.ok) {
                const groupPermissions = await permResponse.json();
                // 勾選對應的權限
                groupPermissions.forEach(perm => {
                    const checkbox = document.querySelector(`input[name="permissions"][value="${perm.id}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                });
            }
        } catch (error) {
            console.warn('載入群組權限失敗，使用預設設定:', error);
            
            // 向後相容：如果有 permission_ids 欄位
            if (group.permission_ids && Array.isArray(group.permission_ids)) {
                group.permission_ids.forEach(permId => {
                    const checkbox = document.querySelector(`input[name="permissions"][value="${permId}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                });
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
        // 使用子模組的刪除功能
        if (window.PermissionGroupModule) {
            await PermissionGroupModule.deleteGroup(id, groups, async () => {
                // 重新載入群組和權限資料以確保同步
                await Promise.all([
                    loadGroups(),
                    loadPermissions()
                ]);
                updateStatistics();
                
                // 如果刪除的是當前選中的群組，清除選中狀態並清空詳情區塊
                if (selectedGroupId == id) {
                    selectedGroupId = null;
                    const detailsContent = document.querySelector('.group-details .details-content');
                    if (detailsContent) {
                        detailsContent.innerHTML = '<p class="text-muted">請選擇一個群組查看詳情</p>';
                    }
                }
            });
            return;
        }
        
        // 原本的備用實現
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
                // 重新載入群組和權限資料以確保同步
                await Promise.all([
                    loadGroups(),
                    loadPermissions()
                ]);
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
     * 顯示模態框
     */
    function showModal(modalId) {
        if (window.PermissionGroupModule) {
            PermissionGroupModule.showModal(modalId);
        } else {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.classList.add('show');
            }
        }
    }
    
    /**
     * 關閉模態框
     */
    function closeModal(modalId) {
        if (window.PermissionGroupModule) {
            PermissionGroupModule.closeModal(modalId);
        } 
    }
    
    /**
     * 顯示群組使用者懸浮卡片
     */
    function showGroupUsersHoverCard(groupId) {
        if (window.EmployeeHoverCard) {
            EmployeeHoverCard.show({ 
                type: 'permission', 
                id: groupId 
            });
        } else {
            console.warn('EmployeeHoverCard 模組未載入');
        }
    }

    // ======= 查看部門詳情相關功能 =======
    
    // 部門詳情模態框狀態
    let viewDeptCurrentGroupId = null;
    let viewDeptCurrentViewMode = 'departments'; // 'departments' 或 'roles'
    let viewDeptOrgTreeData = [];
    let viewDeptFilteredTreeData = [];
    let viewDeptNodeExpandedStates = new Map();
    
    /**
     * 顯示查看部門詳情模態框
     * @param {number} groupId - 群組ID
     * @param {string} viewMode - 查看模式 ('departments' 或 'roles')
     */
    async function showViewDepartmentModal(groupId, viewMode = 'departments') {
        try {
            // 重置狀態
            viewDeptCurrentGroupId = groupId;
            viewDeptCurrentViewMode = viewMode;
            viewDeptOrgTreeData = [];
            viewDeptFilteredTreeData = [];
            viewDeptNodeExpandedStates.clear();
            
            // 獲取群組資訊
            const group = allGroups.find(g => g.id == groupId);
            if (!group) {
                showError('找不到指定的權限群組');
                return;
            }
            
            // 根據模式更新模態框標題
            const modalTitle = document.getElementById('viewDepartmentModalTitle');
            if (modalTitle) {
                if (viewMode === 'roles') {
                    modalTitle.textContent = '角色權限詳情';
                } else {
                    modalTitle.textContent = '部門分布詳情';
                }
            }
            
            // 更新群組名稱
            document.getElementById('viewDeptGroupName').textContent = group.name;
            
            // 顯示模態框
            const modal = document.getElementById('viewDepartmentModal');
            if (modal) {
                modal.classList.add('show');
            }
            
            // 載入組織樹資料（只顯示有權限的角色）
            await loadViewDeptTreeData();
            
        } catch (error) {
            console.error('顯示部門詳情模態框失敗:', error);
            showError('載入部門資料失敗：' + error.message);
        }
    }
    
    /**
     * 關閉查看部門詳情模態框
     */
    function closeViewDepartmentModal() {
        const modal = document.getElementById('viewDepartmentModal');
        if (modal) {
            modal.classList.remove('show');
        }
        
        // 重置狀態
        viewDeptCurrentGroupId = null;
        viewDeptCurrentViewMode = 'departments';
        viewDeptOrgTreeData = [];
        viewDeptFilteredTreeData = [];
        viewDeptNodeExpandedStates.clear();
        
        // 清除搜尋欄位
        const searchInput = document.getElementById('viewDeptTreeSearch');
        if (searchInput) {
            searchInput.value = '';
        }
    }
    
    /**
     * 載入查看部門樹資料（只顯示已授權的角色）
     */
    async function loadViewDeptTreeData() {
        try {
            showViewDeptLoadingState();
            
            // 載入部門角色樹和已授權的角色
            const [treeResponse, authorizedResponse] = await Promise.all([
                fetch(`/api/organization/departments?tree=true&include_roles=true`, {
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' }
                }),
                fetch(`/api/permissions/groups/${viewDeptCurrentGroupId}/department-roles`, {
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' }
                }).catch(() => ({ json: async () => [] }))
            ]);
            
            if (!treeResponse.ok) {
                throw new Error(`載入組織樹失敗: ${treeResponse.status}`);
            }
            
            const allTreeData = await treeResponse.json();
            const allOrgTreeData = Array.isArray(allTreeData) ? allTreeData : (allTreeData.data || []);
            
            // 獲取已授權的角色ID集合
            let authorizedRoleIds = new Set();
            if (authorizedResponse.ok || authorizedResponse.json) {
                const authorizedData = await authorizedResponse.json();
                if (Array.isArray(authorizedData)) {
                    authorizedData.forEach(role => {
                        authorizedRoleIds.add(parseInt(role.id)); // 確保轉為數字
                    });
                }
            }
            
            // 過濾樹結構，只保留有授權角色的部門和角色
            viewDeptOrgTreeData = filterTreeToAuthorizedOnly(allOrgTreeData, authorizedRoleIds);
            
            console.log('查看部門詳情 - 已授權角色數:', authorizedRoleIds.size);
            
            // 渲染組織樹（預設全展開）
            renderViewDeptTree();
            updateViewDeptStatistics(authorizedRoleIds.size);
            
        } catch (error) {
            console.error('載入查看部門樹資料失敗:', error);
            showError('載入部門資料失敗：' + error.message);
        } finally {
            hideViewDeptLoadingState();
        }
    }
    
    /**
     * 標記樹結構中的授權狀態（不過濾節點，保持完整結構）
     */
    function filterTreeToAuthorizedOnly(nodes, authorizedRoleIds) {
        return nodes.map(node => {
            const markedNode = { ...node };
            let hasDirectAuthorizedRoles = false;
            
            // 標記角色授權狀態
            if (node.roles && Array.isArray(node.roles)) {
                markedNode.roles = node.roles.map(role => {
                    const roleIdNum = parseInt(role.id);
                    const isAuthorized = authorizedRoleIds.has(roleIdNum);
                    const isActiveCheck = role.is_active === true || 
                                         role.is_active === 1 || 
                                         role.is_active === '1' || 
                                         role.is_active == null;
                    
                    const markedRole = { ...role };
                    if (isAuthorized && isActiveCheck) {
                        markedRole._isAuthorized = true;
                        hasDirectAuthorizedRoles = true;
                    }
                    return markedRole;
                });
                
                // 對角色進行排序：管理角色優先 > 等級優先 > 名稱排序
                markedNode.roles.sort((a, b) => {
                    // 1. 管理角色優先
                    if (a.role_type === 'manager' && b.role_type !== 'manager') return -1;
                    if (a.role_type !== 'manager' && b.role_type === 'manager') return 1;
                    
                    // 2. 等級優先（數字越小越高）
                    const levelA = a.level != null ? a.level : 999;
                    const levelB = b.level != null ? b.level : 999;
                    if (levelA !== levelB) return levelA - levelB;
                    
                    // 3. 名稱排序
                    return (a.name || '').localeCompare(b.name || '', 'zh-TW');
                });
            }
            
            // 標記部門是否有直接的授權角色
            markedNode._hasAuthorizedRoles = hasDirectAuthorizedRoles;
            
            // 遞歸處理子部門
            if (node.children && Array.isArray(node.children)) {
                markedNode.children = filterTreeToAuthorizedOnly(node.children, authorizedRoleIds);
            }
            
            // 預設展開所有有授權內容的節點
            if (hasDirectAuthorizedRoles) {
                const nodeKey = `dept_${node.id}`;
                viewDeptNodeExpandedStates.set(nodeKey, true);
            }
            
            return markedNode;
        });
    }
    
    /**
     * 渲染查看部門樹（唯讀模式）
     */
    function renderViewDeptTree() {
        const container = document.getElementById('viewDeptTreeContainer');
        if (!container) return;
        
        // 決定使用哪個資料源
        const dataToRender = viewDeptFilteredTreeData.length > 0 ? viewDeptFilteredTreeData : viewDeptOrgTreeData;
        
        // 檢查是否有授權角色（因為現在不過濾節點，需要深度檢查）
        function hasAnyAuthorizedRoles(nodes) {
            for (const node of nodes) {
                if (node.roles && Array.isArray(node.roles)) {
                    for (const role of node.roles) {
                        if (role._isAuthorized) {
                            return true;
                        }
                    }
                }
                if (node.children && hasAnyAuthorizedRoles(node.children)) {
                    return true;
                }
            }
            return false;
        }
        
        if (dataToRender.length === 0 || !hasAnyAuthorizedRoles(dataToRender)) {
            const searchInput = document.getElementById('viewDeptTreeSearch');
            const isSearching = searchInput && searchInput.value.trim();
            
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-${isSearching ? 'search' : 'shield-alt'}"></i>
                    <h3>${isSearching ? '無符合的搜尋結果' : '尚無授權的部門角色'}</h3>
                    <p>${isSearching ? '請嘗試其他關鍵字' : '此群組尚未設定任何部門角色權限'}</p>
                </div>
            `;
            return;
        }
        
        // 建立樹狀結構 HTML（唯讀模式）
        const treeHTML = buildViewDeptTreeHTML(dataToRender, 0);
        container.innerHTML = `<div class="org-tree">${treeHTML}</div>`;
        
        // 綁定事件
        bindViewDeptTreeEvents();
    }
    
    /**
     * 建立查看部門樹 HTML（唯讀模式，支援半透明效果和已設定 badge）
     */
    function buildViewDeptTreeHTML(nodes, level = 0) {
        return nodes.map(node => {
            const hasChildren = node.children && node.children.length > 0;
            const hasRoles = node.roles && node.roles.length > 0;
            
            // 檢查節點是否應該展開（預設展開）
            const nodeKey = `dept_${node.id}`;
            const isNodeExpanded = viewDeptNodeExpandedStates.get(nodeKey) !== false;
            
            // 根據查看模式決定部門的顯示效果
            let deptOpacity = '';
            if (viewDeptCurrentViewMode === 'departments') {
                // 部門模式：沒有授權角色的部門設為半透明
                deptOpacity = node._hasAuthorizedRoles ? '' : 'opacity: 0.3;';
            } else if (viewDeptCurrentViewMode === 'roles') {
                // 角色模式：所有部門都半透明（只作為結構顯示）
                deptOpacity = 'opacity: 0.5;';
            }
            
            let html = `
                <div class="tree-node dept-node" data-dept-id="${node.id}">
                    <div class="node-content" data-level="${level}" 
                         style="padding-left: ${level * 24}px; ${deptOpacity} ${hasChildren || hasRoles ? 'cursor: pointer;' : ''}"
                         ${hasChildren || hasRoles ? `onclick="PermissionModule.toggleViewDeptNode(this)"` : ''}>
                        ${hasChildren || hasRoles ? `
                            <span class="node-toggle">
                                <i class="fas fa-chevron-${isNodeExpanded ? 'down' : 'right'}"></i>
                            </span>
                        ` : '<span class="node-spacer" style="width: 16px; display: inline-block;"></span>'}
                        <i class="fas fa-folder text-primary"></i>
                        <span class="node-name">${node.name}</span>
                        ${node.code ? `<span class="node-badge">${node.code}</span>` : ''}
                    </div>
                    <div class="node-children" id="view-dept-children-${node.id}" ${!isNodeExpanded ? 'style="display: none;"' : ''}>
            `;

            // 添加角色節點（區分已授權和未授權）
            if (hasRoles) {
                node.roles.forEach(role => {
                    const roleIcon = role.role_type === 'manager' ? 'user-tie' : 'user';
                    const roleClass = role.role_type === 'manager' ? 'text-warning' : 'text-primary';
                    const isAuthorized = role._isAuthorized;
                    
                    // 根據查看模式決定角色的顯示效果
                    let roleOpacity = '';
                    let authorizationBadge = '';
                    
                    if (viewDeptCurrentViewMode === 'departments') {
                        // 部門模式：所有角色都半透明（作為輔助資訊），不顯示 badge
                        roleOpacity = 'opacity: 0.5;';
                        authorizationBadge = '';
                    } else if (viewDeptCurrentViewMode === 'roles') {
                        // 角色模式：只有授權角色顯示正常，未授權角色半透明
                        roleOpacity = isAuthorized ? '' : 'opacity: 0.2;';
                        authorizationBadge = isAuthorized ? 
                            '<span class="badge badge-success ms-1" style="background-color: #28a745; color: white; font-size: 0.75em; padding: 2px 6px; border-radius: 10px;">已授權</span>' : '';
                    }

                    html += `
                        <div class="tree-node role-node ${isAuthorized ? 'authorized-role' : 'unauthorized-role'}" data-role-id="${role.id}">
                            <div class="node-content" data-level="${level + 1}" 
                                 style="padding-left: ${(level + 1) * 24}px; ${roleOpacity}">
                                <span class="node-spacer" style="width: 16px; display: inline-block;"></span>
                                ${isAuthorized ? '<i class="fas fa-shield-alt text-success" title="已授權"></i>' : '<i class="fas fa-shield text-muted" title="未授權"></i>'}
                                <i class="fas fa-${roleIcon} ${roleClass}"></i>
                                <span class="role-name">${role.name}</span>
                                ${role.code ? `<span class="node-badge">${role.code}</span>` : ''}
                                ${authorizationBadge}
                            </div>
                        </div>
                    `;
                });
            }

            // 遞歸處理子部門
            if (hasChildren) {
                html += buildViewDeptTreeHTML(node.children, level + 1);
            }

            html += '</div></div>';
            return html;
        }).join('');
    }
    
    /**
     * 切換查看部門樹節點展開/收合
     */
    function toggleViewDeptNode(nodeContentElement) {
        const deptNode = nodeContentElement.closest('.tree-node.dept-node');
        if (!deptNode) return;
        
        const deptId = deptNode.getAttribute('data-dept-id');
        const nodeKey = `dept_${deptId}`;
        
        // 切換展開狀態
        const isCurrentlyExpanded = viewDeptNodeExpandedStates.get(nodeKey) !== false;
        viewDeptNodeExpandedStates.set(nodeKey, !isCurrentlyExpanded);
        
        // 找到子節點容器和切換圖示
        const childrenContainer = deptNode.querySelector('.node-children');
        const toggleIcon = nodeContentElement.querySelector('.node-toggle i');
        
        if (childrenContainer && toggleIcon) {
            if (isCurrentlyExpanded) {
                // 收合
                childrenContainer.style.display = 'none';
                toggleIcon.className = 'fas fa-chevron-right';
            } else {
                // 展開
                childrenContainer.style.display = 'block';
                toggleIcon.className = 'fas fa-chevron-down';
            }
        }
    }
    
    /**
     * 展開全部查看部門節點
     */
    function expandAllViewDept() {
        function setAllExpanded(nodes) {
            nodes.forEach(node => {
                const nodeKey = `dept_${node.id}`;
                viewDeptNodeExpandedStates.set(nodeKey, true);
                
                // 直接操作 DOM
                const childrenContainer = document.getElementById(`view-dept-children-${node.id}`);
                const deptNode = document.querySelector(`[data-dept-id="${node.id}"]`);
                if (childrenContainer && deptNode) {
                    childrenContainer.style.display = 'block';
                    const toggleIcon = deptNode.querySelector('.node-toggle i');
                    if (toggleIcon) {
                        toggleIcon.className = 'fas fa-chevron-down';
                    }
                }
                
                if (node.children) {
                    setAllExpanded(node.children);
                }
            });
        }
        setAllExpanded(viewDeptOrgTreeData);
    }
    
    /**
     * 收合全部查看部門節點
     */
    function collapseAllViewDept() {
        function setAllCollapsed(nodes) {
            nodes.forEach(node => {
                const nodeKey = `dept_${node.id}`;
                viewDeptNodeExpandedStates.set(nodeKey, false);
                
                // 直接操作 DOM
                const childrenContainer = document.getElementById(`view-dept-children-${node.id}`);
                const deptNode = document.querySelector(`[data-dept-id="${node.id}"]`);
                if (childrenContainer && deptNode) {
                    childrenContainer.style.display = 'none';
                    const toggleIcon = deptNode.querySelector('.node-toggle i');
                    if (toggleIcon) {
                        toggleIcon.className = 'fas fa-chevron-right';
                    }
                }
                
                if (node.children) {
                    setAllCollapsed(node.children);
                }
            });
        }
        setAllCollapsed(viewDeptOrgTreeData);
    }
    
    /**
     * 搜尋查看部門樹
     */
    function searchViewDeptTree() {
        const searchInput = document.getElementById('viewDeptTreeSearch');
        if (!searchInput) return;
        
        const keyword = searchInput.value.trim().toLowerCase();
        
        // 如果沒有關鍵字，顯示全部
        if (!keyword) {
            viewDeptFilteredTreeData = [];
            renderViewDeptTree();
            return;
        }
        
        // 搜尋並過濾節點
        viewDeptFilteredTreeData = filterViewDeptTreeByKeyword(viewDeptOrgTreeData, keyword);
        renderViewDeptTree();
    }
    
    /**
     * 根據關鍵字過濾查看部門樹
     */
    function filterViewDeptTreeByKeyword(nodes, keyword) {
        const filteredNodes = [];
        
        nodes.forEach(node => {
            let nodeMatches = false;
            let filteredNode = { ...node };
            
            // 檢查部門名稱是否符合
            if (node.name && node.name.toLowerCase().includes(keyword)) {
                nodeMatches = true;
            }
            
            // 檢查部門代碼是否符合
            if (node.code && node.code.toLowerCase().includes(keyword)) {
                nodeMatches = true;
            }
            
            // 過濾角色
            let matchedRoles = [];
            if (node.roles) {
                matchedRoles = node.roles.filter(role => 
                    (role.name && role.name.toLowerCase().includes(keyword)) ||
                    (role.code && role.code.toLowerCase().includes(keyword))
                );
                if (matchedRoles.length > 0) {
                    nodeMatches = true;
                    filteredNode.roles = matchedRoles;
                }
            }
            
            // 遞歸處理子節點
            let filteredChildren = [];
            if (node.children) {
                filteredChildren = filterViewDeptTreeByKeyword(node.children, keyword);
                if (filteredChildren.length > 0) {
                    nodeMatches = true;
                    filteredNode.children = filteredChildren;
                }
            }
            
            // 如果節點符合條件，加入結果
            if (nodeMatches) {
                // 搜尋時自動展開符合的節點
                const nodeKey = `dept_${node.id}`;
                viewDeptNodeExpandedStates.set(nodeKey, true);
                filteredNodes.push(filteredNode);
            }
        });
        
        return filteredNodes;
    }
    
    /**
     * 綁定查看部門樹事件
     */
    function bindViewDeptTreeEvents() {
        const searchInput = document.getElementById('viewDeptTreeSearch');
        if (searchInput) {
            // 移除之前的事件監聽器
            searchInput.removeEventListener('input', handleViewDeptSearchInput);
            searchInput.removeEventListener('keyup', handleViewDeptSearchKeyup);
            
            // 綁定新的事件監聽器
            searchInput.addEventListener('input', handleViewDeptSearchInput);
            searchInput.addEventListener('keyup', handleViewDeptSearchKeyup);
        }
    }
    
    /**
     * 處理查看部門搜尋輸入
     */
    function handleViewDeptSearchInput(event) {
        clearTimeout(window.viewDeptSearchTimeout);
        window.viewDeptSearchTimeout = setTimeout(() => {
            searchViewDeptTree();
        }, 300);
    }
    
    /**
     * 處理查看部門搜尋按鍵事件
     */
    function handleViewDeptSearchKeyup(event) {
        if (event.key === 'Enter') {
            clearTimeout(window.viewDeptSearchTimeout);
            searchViewDeptTree();
        } else if (event.key === 'Escape') {
            event.target.value = '';
            clearTimeout(window.viewDeptSearchTimeout);
            searchViewDeptTree();
        }
    }
    
    /**
     * 更新查看部門統計資訊
     */
    function updateViewDeptStatistics(authorizedCount) {
        // 計算分佈的部門數
        let deptCount = 0;
        function countDepts(nodes) {
            nodes.forEach(node => {
                if (node.roles && node.roles.length > 0) {
                    deptCount++;
                }
                if (node.children) {
                    countDepts(node.children);
                }
            });
        }
        countDepts(viewDeptOrgTreeData);
        
        // 更新顯示
        const authorizedCountElement = document.getElementById('authorizedViewDeptRolesCount');
        const deptCountElement = document.getElementById('authorizedViewDeptCount');
        
        if (authorizedCountElement) authorizedCountElement.textContent = authorizedCount;
        if (deptCountElement) deptCountElement.textContent = deptCount;
    }
    
    /**
     * 顯示查看部門載入狀態
     */
    function showViewDeptLoadingState() {
        const container = document.getElementById('viewDeptTreeContainer');
        if (container) {
            container.innerHTML = `
                <div class="loading-spinner">
                    <div class="spinner"></div>
                    <p>載入部門資料中...</p>
                </div>
            `;
        }
    }
    
    /**
     * 隱藏查看部門載入狀態
     */
    function hideViewDeptLoadingState() {
        // 載入狀態會在渲染樹時被覆蓋
    }
    
    /**
     * 更新單一群組資料（用於批次組織設定後的即時更新）
     */
    async function updateSingleGroup(groupData) {
        try {
            // 使用子模組的更新功能
            if (window.PermissionGroupModule) {
                allGroups = PermissionGroupModule.updateSingleGroup(groupData, allGroups);
            }             
            // 重新過濾群組
            filterGroups();
            
            // 更新統計資料
            updateGroupStatistics();
            updateStatistics();
            
        } catch (error) {
            console.error('更新單一群組資料失敗:', error);
        }
    }
    
    /**
     * 更新表格中特定群組的行
     */
    function updateGroupRowInTable(groupData) {
        // 使用子模組的更新功能
        if (window.PermissionGroupModule) {
            PermissionGroupModule.updateGroupRowInTable(groupData);
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
        closeModal: closeModal,
        showGroupUsersHoverCard: showGroupUsersHoverCard,
        // 查看部門詳情相關功能
        showViewDepartmentModal: showViewDepartmentModal,
        closeViewDepartmentModal: closeViewDepartmentModal,
        toggleViewDeptNode: toggleViewDeptNode,
        expandAllViewDept: expandAllViewDept,
        collapseAllViewDept: collapseAllViewDept,
        searchViewDeptTree: searchViewDeptTree,
        // 單一群組更新功能
        updateSingleGroup: updateSingleGroup,
        updateGroupRowInTable: updateGroupRowInTable,
        // 暴露資料供其他模組使用
        allGroups: allGroups
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
