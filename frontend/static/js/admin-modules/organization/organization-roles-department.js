/**
 * 組織角色管理 - 部門管理子模組
 * 處理部門選擇、導航、載入等相關功能
 */
const OrganizationRolesDepartmentModule = (function() {
    'use strict';
    
    // API 端點
    const API_BASE = '/api/organization';
    
    /**
     * 初始化子模組
     */
    function init() {
        console.log('OrganizationRolesDepartmentModule 初始化完成');
        return {
            loadDepartmentTreeForRoles,
            loadAllDepartmentRoles,
            loadAllDepartmentRolesFallback,
            selectDepartmentForRoles,
            navigateToDepartmentAfterEdit,
            handleDepartmentNodeClick,
            expandDepartmentByRoleId,
            loadDepartmentRoles,
            loadDepartmentRolesForManagement,
            loadDepartmentOptionsForEdit,
            onEditRoleDepartmentChange,
            resetRoleDepartment,
            resetDepartmentState
        };
    }
    
    /**
     * 載入部門樹供選擇（包含角色）
     */
    async function loadDepartmentTreeForRoles(crudModule, notifyRoleStatsChanged) {
        try {
            const response = await fetch(`${API_BASE}/departments?tree=true`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('載入部門失敗');
            }
            
            const deptTreeData = await response.json();
            
            // 載入所有部門的角色
            const departmentRolesCache = await loadAllDepartmentRoles(deptTreeData, crudModule);
            
            // 通知角色統計數據已更新
            if (notifyRoleStatsChanged) {
                notifyRoleStatsChanged();
            }
            
            return { deptTreeData, departmentRolesCache };
            
        } catch (error) {
            console.error('載入部門樹失敗:', error);
            if (window.Dialog) {
                Dialog.error('載入部門資料失敗');
            }
            throw error;
        }
    }
    
    /**
     * 載入所有部門的角色（優化版本：使用批次 API）
     */
    async function loadAllDepartmentRoles(departments, crudModule) {
        const departmentRolesCache = {};
        
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
            return departmentRolesCache;
        }
        
        try {
            if (crudModule) {
                const rolesByDept = await crudModule.loadDepartmentRolesBatch(allDeptIds);
                
                // 將結果存入快取
                for (const deptId of allDeptIds) {
                    departmentRolesCache[deptId] = rolesByDept[deptId] || [];
                }
            } else {
                console.warn('CRUD 模組未初始化，使用備用方案');
                await loadAllDepartmentRolesFallback(departments, departmentRolesCache, crudModule);
            }
        } catch (error) {
            console.error('批次載入部門角色失敗:', error);
            // 發生錯誤時，回退到舊的逐個載入方式
            await loadAllDepartmentRolesFallback(departments, departmentRolesCache, crudModule);
        }
        
        return departmentRolesCache;
    }
    
    /**
     * 載入所有部門的角色（備用方案：逐個查詢）
     */
    async function loadAllDepartmentRolesFallback(departments, departmentRolesCache, crudModule) {
        const loadRolesForDept = async (dept) => {
            try {
                if (crudModule) {
                    const roles = await crudModule.loadDepartmentRoles(dept.id);
                    departmentRolesCache[dept.id] = roles;
                } else {
                    departmentRolesCache[dept.id] = [];
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
     * 載入部門角色
     */
    async function loadDepartmentRoles(departmentId, crudModule) {
        if (crudModule) {
            return await crudModule.loadDepartmentRoles(departmentId);
        }
        return [];
    }
    
    /**
     * 處理部門節點點擊事件（展開/收合 + 選中）
     */
    async function handleDepartmentNodeClick(deptId, selectedDeptId, selectDepartmentForRoles) {
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
    async function selectDepartmentForRoles(deptId, deptTreeData, findDepartmentById, expandPathToDepartment, loadDepartmentRolesForManagement) {
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
            const selectedDeptNameEl = document.getElementById('selectedDeptName');
            const addRoleBtnEl = document.getElementById('addRoleBtn');
            
            if (selectedDeptNameEl) {
                selectedDeptNameEl.textContent = `${dept.name} 的角色`;
            }
            if (addRoleBtnEl) {
                addRoleBtnEl.disabled = false;
            }
        }
        
        // 載入該部門的角色到右側面板
        await loadDepartmentRolesForManagement(deptId);
        
        // 清除右側角色卡片的高亮狀態（因為已切換到新部門）
        setTimeout(() => {
            document.querySelectorAll('#rolesList .role-card').forEach(card => {
                card.classList.remove('highlighted');
            });
        }, 100);
        
        return deptId;
    }
    
    /**
     * 編輯存檔後導航到部門（關閉其他節點，只展開目標路徑）
     */
    async function navigateToDepartmentAfterEdit(deptId, deptTreeData, findDepartmentById, collapseAllExceptPath, expandPathToDepartment, loadDepartmentRolesForManagement) {
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
            const selectedDeptNameEl = document.getElementById('selectedDeptName');
            const addRoleBtnEl = document.getElementById('addRoleBtn');
            
            if (selectedDeptNameEl) {
                selectedDeptNameEl.textContent = `${dept.name} 的角色`;
            }
            if (addRoleBtnEl) {
                addRoleBtnEl.disabled = false;
            }
        }
        
        // 載入該部門的角色到右側面板
        await loadDepartmentRolesForManagement(deptId);
        
        return deptId;
    }
    
    /**
     * 載入部門角色用於管理
     */
    async function loadDepartmentRolesForManagement(deptId, renderRoleCards, updateRoleStats) {
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
            
            if (renderRoleCards) {
                renderRoleCards(detailedRoles);
            }
            if (updateRoleStats) {
                updateRoleStats(detailedRoles);
            }
            
            return detailedRoles;
            
        } catch (error) {
            console.error('載入部門角色失敗:', error);
            const rolesListEl = document.getElementById('rolesList');
            if (rolesListEl) {
                rolesListEl.innerHTML = `
                    <div class="error-state">
                        <i class="fas fa-exclamation-triangle fa-3x text-danger"></i>
                        <p class="text-danger">載入角色失敗</p>
                    </div>
                `;
            }
            throw error;
        }
    }
    
    /**
     * 根據角色 ID 找到所屬部門並導航（編輯存檔後使用）
     */
    async function expandDepartmentByRoleId(roleId, departmentRolesCache, navigateToDepartmentAfterEdit) {
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
    async function onEditRoleDepartmentChange(originalDepartmentId, setDepartmentChanged, setMovePreviewData) {
        const newDeptId = document.getElementById('editRoleDepartment').value;
        const roleId = document.getElementById('editRoleId').value;
        
        if (!newDeptId || !roleId) return;
        
        const departmentChanged = (parseInt(newDeptId) !== parseInt(originalDepartmentId));
        setDepartmentChanged(departmentChanged);
        
        if (departmentChanged) {
            // 顯示警告並啟用還原按鈕
            const warningEl = document.getElementById('deptChangeWarning');
            if (warningEl) {
                warningEl.style.display = 'block';
            }
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
            
            const hintEl = document.getElementById('parentRoleHint');
            if (hintEl) {
                hintEl.innerHTML = 
                    '<span class="text-warning"><i class="fas fa-exclamation-triangle"></i> 部門變更時將自動處理父角色</span>';
            }
            
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
                    const movePreviewData = await response.json();
                    setMovePreviewData(movePreviewData);
                    
                    // 顯示智能提示
                    if (movePreviewData.warning && warningEl) {
                        // 更新提示文字
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
    function resetRoleDepartment(originalDepartmentId, resetDepartmentState) {
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
        // 隱藏警告並禁用還原按鈕
        const warningEl = document.getElementById('deptChangeWarning');
        if (warningEl) {
            warningEl.style.display = 'none';
        }
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
        
        const hintEl = document.getElementById('parentRoleHint');
        if (hintEl) {
            hintEl.innerHTML = '留空表示頂層角色';
        }
    }
    
    // 公開 API
    return {
        init
    };
    
})();

// 註冊到全域
window.__OrganizationRolesDepartmentModule = OrganizationRolesDepartmentModule;