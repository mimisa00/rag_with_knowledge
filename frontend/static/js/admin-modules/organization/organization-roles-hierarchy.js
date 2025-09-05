/**
 * 組織角色層級管理子模組
 * 處理角色父子關係、層級管理功能
 */
const OrganizationRolesHierarchyModule = (function() {
    'use strict';

    /**
     * 載入父角色選項（使用現有角色資料）
     * @param {number} excludeId - 要排除的角色ID
     * @param {Object} departmentRolesCache - 部門角色緩存（從主模組傳入）
     * @param {Array} deptTreeData - 部門樹資料（從主模組傳入）
     * @param {Function} findDepartmentById - 查找部門函數（從主模組傳入）
     */
    async function loadParentRoleOptions(excludeId = null, departmentRolesCache = {}, deptTreeData = [], findDepartmentById = null) {
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
                    const dept = findDepartmentById ? findDepartmentById(parseInt(deptId), deptTreeData) : null;
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

    // 公開 API
    return {
        loadParentRoleOptions
    };

})();

// 註冊到全域
window.__OrganizationRolesHierarchyModule = OrganizationRolesHierarchyModule;