/**
 * 組織角色卡片渲染子模組
 * 處理角色卡片的 UI 渲染功能
 */
const OrganizationRolesCardModule = (function() {
    'use strict';

    /**
     * 渲染角色卡片
     * @param {Array} roles - 角色資料
     * @param {Object} departmentRolesCache - 部門角色緩存（從主模組傳入）
     */
    function renderRoleCards(roles, departmentRolesCache = {}) {
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
            const dependencies = OrganizationRoleAnalysisModule.checkRoleDependencies(role.id, role.user_count, departmentRolesCache);
            const isDisabled = dependencies.hasAnyDependency;
            const disableReason = OrganizationRoleAnalysisModule.getDisableReason(dependencies);
            
            return `
            <div class="role-card role-${role.role_type}" data-role-id="${role.id}">
                <div class="role-card-header">
                    <div class="role-info">
                        <i class="fas ${role.role_type === 'manager' ? 'fa-user-tie text-manager' : 'fa-user text-success'}"></i>
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

    // 公開 API
    return {
        renderRoleCards
    };

})();

// 註冊到全域
window.__OrganizationRolesCardModule = OrganizationRolesCardModule;