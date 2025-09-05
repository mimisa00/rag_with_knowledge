/**
 * 組織角色初始化與事件綁定子模組
 * 處理模組初始化和事件綁定邏輯
 */
const OrganizationRolesInitModule = (function() {
    'use strict';

    /**
     * 初始化所有子模組
     * @param {Object} context - 上下文對象，包含必要的引用
     */
    async function initializeModules(context) {
        console.log('OrganizationRolesModule 初始化開始');
        
        const modules = {};
        
        // 初始化狀態管理子模組
        modules.stateModule = window.__OrganizationRolesStateModule;
        
        // 初始化角色模板子模組
        if (window.__OrganizationRoleTemplateModule) {
            modules.roleTemplateModule = window.__OrganizationRoleTemplateModule;
            const roleTemplates = await modules.roleTemplateModule.init() || [];
            context.state.setState({ roleTemplates });
        }
        
        // 初始化 CRUD 子模組
        if (window.__OrganizationRolesCrudModule) {
            modules.crudModule = window.__OrganizationRolesCrudModule;
        }
        
        // 初始化 DRAG 子模組
        if (window.__OrganizationRolesDragModule) {
            modules.dragModule = window.__OrganizationRolesDragModule.init();
        }
        
        // 初始化 Modal 子模組
        if (window.__OrganizationRolesModalModule) {
            modules.modalModule = window.__OrganizationRolesModalModule;
        }
        
        // 初始化懸浮卡片子模組
        if (window.__OrganizationRolesHoverCardModule) {
            modules.hoverCardModule = window.__OrganizationRolesHoverCardModule;
            modules.hoverCardModule.init();
        }
        
        // 初始化搜尋子模組
        if (window.__OrganizationRolesSearchModule) {
            modules.searchModule = window.__OrganizationRolesSearchModule;
        }
        
        // 初始化部門管理子模組
        if (window.__OrganizationRolesDepartmentModule) {
            modules.departmentModule = window.__OrganizationRolesDepartmentModule.init();
        }
        
        // 初始化卡片渲染子模組
        if (window.__OrganizationRolesCardModule) {
            modules.cardModule = window.__OrganizationRolesCardModule;
        }
        
        // 初始化層級管理子模組
        if (window.__OrganizationRolesHierarchyModule) {
            modules.hierarchyModule = window.__OrganizationRolesHierarchyModule;
        }
        
        // 初始化用戶管理子模組
        if (window.__OrganizationRolesUsersModule) {
            modules.usersModule = window.__OrganizationRolesUsersModule;
        }
        
        console.log('OrganizationRolesModule 初始化完成');
        
        return modules;
    }

    /**
     * 綁定角色管理事件
     * @param {Object} context - 上下文對象，包含必要的函數引用
     */
    function bindRoleManagementEvents(context) {
        // 新增角色按鈕
        const addRoleBtn = document.getElementById('addRoleBtn');
        if (addRoleBtn) {
            addRoleBtn.onclick = context.showAddRoleModal;
        }
        
        // 搜尋框事件綁定（避免重複綁定）
        const searchInput = document.getElementById('roleSearchInput');
        if (searchInput && !searchInput.hasAttribute('data-events-bound')) {
            // 即時搜尋（防抖300ms）
            const debouncedSearch = context.searchModule ? 
                context.searchModule.debounce(context.searchDeptAndRoles, 300) : 
                context.searchDeptAndRoles;
            searchInput.addEventListener('input', debouncedSearch);
            
            // Enter 鍵支援
            searchInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    context.searchDeptAndRoles();
                }
            });
            
            searchInput.setAttribute('data-events-bound', 'true');
        }
        
        // 角色搜尋模態框內的搜尋框事件
        const roleModalSearchInput = document.getElementById('roleModalSearchInput');
        if (roleModalSearchInput && !roleModalSearchInput.hasAttribute('data-hierarchy-events-bound')) {
            const debouncedModalSearch = context.searchModule ? 
                context.searchModule.debounce(context.performRoleSearch, 300) : 
                context.performRoleSearch;
            roleModalSearchInput.addEventListener('input', debouncedModalSearch);
            roleModalSearchInput.setAttribute('data-hierarchy-events-bound', 'true');
        }
        
        // 綁定全域函數到 window 物件（供 HTML 內的 onclick 使用）
        if (typeof window !== 'undefined') {
            window.openRoleSearchModal = context.openRoleSearchModal;
            window.closeRoleSearchModal = context.closeRoleSearchModal;
            window.performRoleSearch = context.performRoleSearch;
            window.selectSearchRole = context.selectSearchRole;
            window.confirmRoleSelection = context.confirmRoleSelection;
            window.showRecalculateConfirm = context.showRecalculateConfirm;
            window.closeRecalculateConfirmModal = context.closeRecalculateConfirmModal;
            window.executeRecalculate = context.executeRecalculate;
            window.closeParentRoleChangeConfirmModal = context.closeParentRoleChangeConfirmModal;
            window.confirmParentRoleChange = context.confirmParentRoleChange;
        }
    }

    /**
     * 綁定樹節點事件（使用事件委託）
     * @param {Function} handleDepartmentNodeClick - 部門節點點擊處理函數
     */
    function bindTreeEventListeners(handleDepartmentNodeClick) {
        if (window.OrganizationRoleTreeModule) {
            window.OrganizationRoleTreeModule.bindTreeEventListeners(handleDepartmentNodeClick);
        }
    }

    // 公開 API
    return {
        initializeModules,
        bindRoleManagementEvents,
        bindTreeEventListeners
    };

})();

// 註冊到全域
window.__OrganizationRolesInitModule = OrganizationRolesInitModule;