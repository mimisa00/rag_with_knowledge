/**
 * 組織角色樹狀結構子模組
 * 處理角色樹狀結構的渲染、展開/收合、選擇等功能
 */
const OrganizationRoleTreeModule = (function() {
    'use strict';
    
    /**
     * 渲染部門樹
     * @param {Array} departments - 部門資料
     * @param {HTMLElement} container - 容器元素
     * @param {boolean} expandFirstLevel - 是否展開第一層
     * @param {boolean} showInactiveRoles - 是否顯示停用角色
     * @param {Object} departmentRolesCache - 部門角色緩存
     * @param {number} selectedDeptId - 選中的部門ID
     * @param {number} selectedRoleId - 選中的角色ID
     */
    function renderDepartmentTree(departments, container = null, expandFirstLevel = false, showInactiveRoles = false, departmentRolesCache = {}, selectedDeptId = null, selectedRoleId = null) {
        const targetContainer = container || document.getElementById('roleDeptTree');
        if (!targetContainer) return;
        
        if (departments.length === 0) {
            targetContainer.innerHTML = '<p class="text-muted">暫無部門資料</p>';
            return;
        }
        
        targetContainer.innerHTML = renderDeptTreeNodes(departments, expandFirstLevel, showInactiveRoles, departmentRolesCache, selectedDeptId, selectedRoleId);
    }
    
    /**
     * 遞迴渲染部門節點（包含角色）
     * @param {Array} departments - 部門資料
     * @param {boolean} isFirstLevel - 是否為第一層
     * @param {boolean} showInactiveRoles - 是否顯示停用角色
     * @param {Object} departmentRolesCache - 部門角色緩存
     * @param {number} selectedDeptId - 選中的部門ID
     * @param {number} selectedRoleId - 選中的角色ID
     */
    function renderDeptTreeNodes(departments, isFirstLevel = false, showInactiveRoles = false, departmentRolesCache = {}, selectedDeptId = null, selectedRoleId = null) {
        return departments.map(dept => {
            const roles = departmentRolesCache[dept.id] || [];
            const hasChildren = (dept.children && dept.children.length > 0) || roles.length > 0;
            
            // 過濾角色（根據是否顯示停用）
            const visibleRoles = showInactiveRoles ? roles : roles.filter(r => r.is_active);
            
            // 第一層預設展開
            const isExpanded = isFirstLevel;
            const chevronClass = isExpanded ? 'fa-chevron-down' : 'fa-chevron-right';
            const childrenClass = isExpanded ? 'tree-children expanded' : 'tree-children';
            
            return `
                <div class="tree-node ${dept.is_active ? '' : 'inactive'}" data-id="${dept.id}">
                    <div class="node-content ${selectedDeptId === dept.id ? 'selected' : ''}" 
                         data-dept-id="${dept.id}">
                        ${hasChildren ? 
                            `<span class="node-toggle">
                                <i class="fas ${chevronClass}"></i>
                            </span>` : 
                            '<span class="node-toggle invisible"></span>'
                        }
                        <span class="node-icon">
                            <i class="fas fa-folder"></i>
                        </span>
                        <span class="node-name">${dept.name}</span>
                    </div>
                    ${hasChildren ? 
                        `<div class="${childrenClass}">
                            ${renderRoleNodes(visibleRoles, departmentRolesCache, selectedRoleId)}
                            ${dept.children && dept.children.length > 0 ? renderDeptTreeNodes(dept.children, false, showInactiveRoles, departmentRolesCache, selectedDeptId, selectedRoleId) : ''}
                        </div>` : ''
                    }
                </div>
            `;
        }).join('');
    }
    
    /**
     * 渲染角色節點
     * @param {Array} roles - 角色資料
     * @param {Object} departmentRolesCache - 部門角色緩存
     * @param {number} selectedRoleId - 選中的角色ID
     */
    function renderRoleNodes(roles, departmentRolesCache = {}, selectedRoleId = null) {
        if (!roles || roles.length === 0) return '';
        
        const html = roles.map(role => {
            // 檢查角色依賴關係
            const dependencies = window.OrganizationRoleAnalysisModule ? 
                window.OrganizationRoleAnalysisModule.checkRoleDependencies(role.id, role.user_count, departmentRolesCache) : 
                { hasAnyDependency: false };
            const isDisabled = dependencies.hasAnyDependency;
            const disableReason = window.OrganizationRoleAnalysisModule ? 
                window.OrganizationRoleAnalysisModule.getDisableReason(dependencies) : '';
            
            return `
            <div class="role-tree-node ${role.is_active ? '' : 'inactive'} ${selectedRoleId === role.id ? 'selected' : ''}" 
                 draggable="true"
                 data-role-id="${role.id}" data-department-id="${role.department_id}"
                 onclick="OrganizationRolesModule.selectRoleAndShowDepartmentRoles(${role.id}, ${role.department_id})">
                <i class="fas ${role.role_type === 'manager' ? 'fa-user-tie' : 'fa-user'}"></i>
                <span class="role-name">${role.name}</span>
                <span class="node-actions">
                    <button class="btn-icon" onclick="event.stopPropagation(); OrganizationRolesModule.viewRoleDetails(${role.id})" title="檢視詳情">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon" onclick="event.stopPropagation(); OrganizationRolesModule.editDepartmentRole(${role.id})" title="編輯">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon ${isDisabled ? 'disabled' : ''}" 
                            ${!isDisabled ? `onclick="event.stopPropagation(); OrganizationRolesModule.deleteDepartmentRole(${role.id}, ${role.user_count || 0})"` : ''} 
                            title="${disableReason}">
                        <i class="fas fa-trash"></i>
                    </button>
                </span>
                <span class="role-count node-count" data-role-id="${role.id}" onclick="event.stopPropagation(); OrganizationRolesModule.showRoleUsersHoverCard(${role.id})" title="點擊查看使用此角色的用戶">(${role.user_count || 0}人)</span>
                ${!role.is_active ? '<span class="badge badge-secondary">停用</span>' : ''}
            </div>
            `;
        }).join('');
        
        // 在渲染後綁定拖曳事件（延遲執行以確保 DOM 更新）
        setTimeout(() => {
            if (window.OrganizationRolesModule && window.OrganizationRolesModule.bindRoleDragEvents) {
                window.OrganizationRolesModule.bindRoleDragEvents();
            }
        }, 0);
        
        return html;
    }
    
    /**
     * 切換部門節點展開/收合
     * @param {number} deptId - 部門ID
     */
    function toggleDeptNode(deptId) {
        // 確保 deptId 是字串型態來查找（HTML 屬性都是字串）
        const node = document.querySelector(`.tree-node[data-id="${deptId}"]`);
        if (!node) {
            console.warn(`找不到部門節點: ${deptId}`);
            return;
        }
        
        const children = node.querySelector('.tree-children');
        const toggleBtn = node.querySelector('.node-toggle');
        const icon = toggleBtn ? toggleBtn.querySelector('i') : null;
        
        if (children) {
            children.classList.toggle('expanded');
            if (icon) {
                if (children.classList.contains('expanded')) {
                    icon.classList.remove('fa-chevron-right');
                    icon.classList.add('fa-chevron-down');
                } else {
                    icon.classList.remove('fa-chevron-down');
                    icon.classList.add('fa-chevron-right');
                }
            }
        }
    }
    
    /**
     * 在樹狀結構中查找部門
     * @param {number} id - 部門ID
     * @param {Array} departments - 部門資料陣列
     * @returns {Object|null} 找到的部門或 null
     */
    function findDepartmentById(id, departments) {
        for (const dept of departments) {
            if (dept.id === id) return dept;
            if (dept.children) {
                const found = findDepartmentById(id, dept.children);
                if (found) return found;
            }
        }
        return null;
    }
    
    /**
     * 展開到指定部門的路徑
     * @param {number} deptId - 部門ID
     * @param {Array} deptTreeData - 部門樹狀資料
     */
    function expandPathToDepartment(deptId, deptTreeData) {
        // 找到該部門的所有父節點
        const parents = [];
        let current = findDepartmentById(deptId, deptTreeData);
        
        while (current && current.parent_id) {
            const parent = findDepartmentById(current.parent_id, deptTreeData);
            if (parent) {
                parents.unshift(parent);
                current = parent;
            } else {
                break;
            }
        }
        
        // 展開所有父節點
        parents.forEach(parent => {
            const parentElement = document.querySelector(`.tree-node .node-content[data-dept-id="${parent.id}"]`);
            if (parentElement) {
                const treeNode = parentElement.closest('.tree-node');
                const children = treeNode.querySelector('.tree-children');
                const toggle = treeNode.querySelector('.node-toggle i');
                
                if (children && !children.classList.contains('expanded')) {
                    children.classList.add('expanded');
                    if (toggle) {
                        toggle.classList.remove('fa-chevron-right');
                        toggle.classList.add('fa-chevron-down');
                    }
                }
            }
        });
        
        // 展開目標部門本身（如果有子項）
        const targetElement = document.querySelector(`.tree-node .node-content[data-dept-id="${deptId}"]`);
        if (targetElement) {
            const treeNode = targetElement.closest('.tree-node');
            const children = treeNode.querySelector('.tree-children');
            const toggle = treeNode.querySelector('.node-toggle i');
            
            if (children && !children.classList.contains('expanded')) {
                children.classList.add('expanded');
                if (toggle) {
                    toggle.classList.remove('fa-chevron-right');
                    toggle.classList.add('fa-chevron-down');
                }
            }
        }
    }
    
    /**
     * 閉合所有部門，除了指定部門的父級路徑
     * @param {number} targetDeptId - 目標部門ID
     * @param {Array} deptTreeData - 部門樹狀資料
     */
    function collapseAllExceptPath(targetDeptId, deptTreeData) {
        // 找到目標部門的所有父級部門 ID
        const pathIds = [];
        let current = findDepartmentById(targetDeptId, deptTreeData);
        
        // 收集目標部門及其所有父級部門的 ID
        while (current) {
            pathIds.push(current.id);
            if (current.parent_id) {
                current = findDepartmentById(current.parent_id, deptTreeData);
            } else {
                break;
            }
        }
        
        // 閉合所有不在路徑中的部門
        const treeContainer = document.getElementById('roleDeptTree');
        if (treeContainer) {
            const allExpandedChildren = treeContainer.querySelectorAll('.tree-children.expanded');
            allExpandedChildren.forEach(children => {
                const treeNode = children.closest('.tree-node');
                const nodeContent = treeNode.querySelector('.node-content[data-dept-id]');
                if (nodeContent) {
                    const deptId = parseInt(nodeContent.getAttribute('data-dept-id'));
                    // 如果這個部門不在目標路徑中，則閉合它
                    if (!pathIds.includes(deptId)) {
                        children.classList.remove('expanded');
                        const toggle = treeNode.querySelector('.node-toggle i');
                        if (toggle) {
                            toggle.classList.remove('fa-chevron-down');
                            toggle.classList.add('fa-chevron-right');
                        }
                    }
                }
            });
        }
    }
    
    /**
     * 展開所有部門節點
     */
    function expandAll() {
        const treeContainer = document.getElementById('roleDeptTree');
        if (!treeContainer) return;
        
        // 找到所有未展開的節點
        const collapsedNodes = treeContainer.querySelectorAll('.tree-children:not(.expanded)');
        const toggleIcons = treeContainer.querySelectorAll('.node-toggle i.fa-chevron-right');
        
        // 展開所有節點
        collapsedNodes.forEach(node => {
            node.classList.add('expanded');
        });
        
        // 更新所有箭頭圖示
        toggleIcons.forEach(icon => {
            icon.classList.remove('fa-chevron-right');
            icon.classList.add('fa-chevron-down');
        });
    }
    
    /**
     * 收合所有部門節點
     */
    function collapseAll() {
        const treeContainer = document.getElementById('roleDeptTree');
        if (!treeContainer) return;
        
        // 找到所有已展開的節點
        const expandedNodes = treeContainer.querySelectorAll('.tree-children.expanded');
        const toggleIcons = treeContainer.querySelectorAll('.node-toggle i.fa-chevron-down');
        
        // 收合所有節點
        expandedNodes.forEach(node => {
            node.classList.remove('expanded');
        });
        
        // 更新所有箭頭圖示
        toggleIcons.forEach(icon => {
            icon.classList.remove('fa-chevron-down');
            icon.classList.add('fa-chevron-right');
        });
    }
    
    /**
     * 綁定樹節點事件（使用事件委託）
     * @param {Function} handleDepartmentNodeClick - 處理部門節點點擊的回調函數
     */
    function bindTreeEventListeners(handleDepartmentNodeClick) {
        const treeContainer = document.getElementById('roleDeptTree');
        if (!treeContainer) return;
        
        // 使用事件委託而不是 cloneNode，避免破壞已有的事件綁定
        // 移除之前的事件監聽器（如果有的話）
        if (treeContainer._treeEventListener) {
            treeContainer.removeEventListener('click', treeContainer._treeEventListener);
        }
        
        // 新的事件處理函數
        const treeEventHandler = function(e) {
            handleTreeClick(e, handleDepartmentNodeClick);
        };
        
        // 綁定事件並保存引用
        treeContainer.addEventListener('click', treeEventHandler);
        treeContainer._treeEventListener = treeEventHandler;
    }
    
    /**
     * 處理樹節點點擊事件
     * @param {Event} e - 事件對象
     * @param {Function} handleDepartmentNodeClick - 處理部門節點點擊的回調函數
     */
    function handleTreeClick(e, handleDepartmentNodeClick) {
        // 檢查點擊的目標
        const target = e.target;
        
        // 如果點擊的是箭頭或箭頭內的圖標
        if (target.classList.contains('node-toggle') || 
            target.closest('.node-toggle')) {
            // 但要確保真的是點擊在箭頭元素範圍內
            const toggleBtn = target.classList.contains('node-toggle') ? 
                             target : target.closest('.node-toggle');
            
            if (toggleBtn && !toggleBtn.classList.contains('invisible')) {
                e.preventDefault();
                e.stopPropagation();
                const node = toggleBtn.closest('.tree-node');
                if (node) {
                    const deptId = node.dataset.id;
                    toggleDeptNode(deptId);
                }
                return; // 結束處理
            }
        }
        
        // 如果不是點擊箭頭，則處理節點選擇
        // 重要：加入檢查確保不是點擊在箭頭區域
        const nodeContent = e.target.closest('.node-content');
        if (nodeContent && !e.target.closest('.node-toggle')) {
            e.preventDefault();
            const node = nodeContent.closest('.tree-node');
            if (node) {
                const deptId = parseInt(node.dataset.id);
                // 調用回調函數處理點擊
                if (handleDepartmentNodeClick) {
                    handleDepartmentNodeClick(deptId);
                }
            }
        }
    }
    
    /**
     * 滾動到第一個匹配項
     */
    function scrollToFirstMatch() {
        const treeContainer = document.getElementById('roleDeptTree');
        if (!treeContainer) return;
        
        const firstHighlight = treeContainer.querySelector('.tree-node.highlight, .role-tree-node.highlight');
        if (firstHighlight) {
            firstHighlight.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
            });
        }
    }
    
    // 公開的 API
    return {
        renderDepartmentTree,
        toggleDeptNode,
        findDepartmentById,
        expandPathToDepartment,
        collapseAllExceptPath,
        expandAll,
        collapseAll,
        bindTreeEventListeners,
        scrollToFirstMatch
    };
})();

// 確保模組在全域可用
if (typeof window !== 'undefined') {
    window.OrganizationRoleTreeModule = OrganizationRoleTreeModule;
}