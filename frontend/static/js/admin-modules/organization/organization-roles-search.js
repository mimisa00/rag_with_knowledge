/**
 * 組織角色搜尋模組
 * 處理角色和部門的搜尋功能
 */
const __OrganizationRolesSearchModule = (function() {
    'use strict';
    
    // API 端點
    const API_BASE = '/api/organization';
    
    /**
     * 搜尋部門和角色（統一模式：保留完整樹結構 + 高亮匹配項）
     * @param {string} searchTerm - 搜尋關鍵字
     * @param {Array} deptTreeData - 部門樹資料
     * @param {Object} departmentRolesCache - 部門角色快取
     * @param {Function} findDepartmentById - 查找部門函數
     * @param {Function} expandPathToDepartment - 展開路徑函數
     */
    function searchDeptAndRoles(searchTerm, deptTreeData, departmentRolesCache, findDepartmentById, expandPathToDepartment) {
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
        let matchCount = countSearchMatches(deptTreeData, searchTerm, departmentRolesCache);
        
        // 清除舊的高亮
        clearHighlights();
        
        // 添加高亮效果到匹配的節點
        addHighlightsToMatches(searchTerm, deptTreeData, departmentRolesCache);
        
        // 展開匹配項目的路徑
        expandPathsToMatches(searchTerm, deptTreeData, departmentRolesCache, expandPathToDepartment);
        
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
    function countSearchMatches(departments, searchTerm, departmentRolesCache) {
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
                count += countSearchMatches(dept.children, searchTerm, departmentRolesCache);
            }
        }
        
        return count;
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
    function addHighlightsToMatches(searchTerm, deptTreeData, departmentRolesCache) {
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
                        // 左側樹狀結構中的角色節點高亮
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
    function expandPathsToMatches(searchTerm, deptTreeData, departmentRolesCache, expandPathToDepartment) {
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
                if (hasMatch && expandPathToDepartment) {
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
     * 滾動到第一個匹配項
     */
    function scrollToFirstMatch() {
        const firstHighlight = document.querySelector('#roleDeptTree .tree-node.highlight, #roleDeptTree .role-tree-node.highlight');
        if (firstHighlight) {
            firstHighlight.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
            });
        }
    }
    
    /**
     * 執行角色搜尋（模態框）
     * @param {string} keyword - 搜尋關鍵字
     * @param {string} context - 搜尋上下文
     * @param {string} excludeId - 排除的角色ID
     */
    async function performRoleSearch(keyword, context, excludeId) {
        if (keyword.length < 1) {
            return;
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
    
    // 公開 API
    return {
        searchDeptAndRoles,
        performRoleSearch,
        displayRoleSearchResults,
        selectSearchRole,
        debounce,
        clearHighlights,
        scrollToFirstMatch
    };
})();

// 註冊到全域
window.__OrganizationRolesSearchModule = __OrganizationRolesSearchModule;