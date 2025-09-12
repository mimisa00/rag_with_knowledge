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
     * @param {Object} rolePermissionsCache - 角色權限緩存（從主模組傳入）
     */
    function renderRoleCards(roles, departmentRolesCache = {}, rolePermissionsCache = {}) {
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
            
            // 取得該角色的權限資料並生成 badges HTML
            const permissions = rolePermissionsCache[role.id] || [];
            const permissionBadgesHtml = generateRolePermissionBadges(permissions);
            
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
                        <span class="role-user-count-link" data-role-id="${role.id}" data-role-name="${role.name}" ${(role.user_count || 0) > 0 ? 'onclick="OrganizationRolesModule.showRoleUsers(' + role.id + ', \'' + role.name + '\')"' : ''}>
                            <i class="fas fa-users"></i> ${role.user_count || 0} 位使用者
                        </span>
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
                    ${permissionBadgesHtml}
                </div>
                <div class="role-card-actions">
                    <button class="btn btn-sm btn-outline" onclick="OrganizationRolesModule.viewRoleDetails(${role.id})" title="檢視詳情">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline" onclick="OrganizationRolesModule.editRolePermissions(${role.id})" title="編輯權限">
                        <i class="fas fa-shield-alt"></i>
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
        
        // 渲染完成後綁定權限 badge 展開事件
        bindRolePermissionBadgeEvents();
    }
    
    /**
     * 生成角色權限 badges HTML
     * @param {Array} permissions - 權限資料陣列
     * @returns {string} 權限 badges HTML
     */
    function generateRolePermissionBadges(permissions) {
        if (!permissions || permissions.length === 0) {
            return '';
        }
        
        // 按權限類型排序：admin > manager > user > other
        const sortedPermissions = permissions.sort((a, b) => {
            const typeOrder = { 'admin': 0, 'manager': 1, 'user': 2 };
            const aOrder = typeOrder[a.type] ?? 3;
            const bOrder = typeOrder[b.type] ?? 3;
            if (aOrder !== bOrder) return aOrder - bOrder;
            return a.name.localeCompare(b.name, 'zh-TW');
        });
        
        // 生成權限 badge HTML
        const generatePermissionBadge = (permission) => {
            const badgeClass = `permission-${permission.type}`;
            let icon = 'shield-alt';
            if (permission.type === 'admin') icon = 'user-shield';
            else if (permission.type === 'manager') icon = 'user-tie';
            else if (permission.type === 'user') icon = 'user';
            
            return `<span class="role-permission-badge ${badgeClass}" title="${permission.name}">
                <i class="fas fa-${icon}"></i>${permission.name}
            </span>`;
        };
        
        let html = '<div class="role-permissions-container">';
        
        if (sortedPermissions.length === 1) {
            // 只有一個權限，直接顯示
            html += generatePermissionBadge(sortedPermissions[0]);
        } else {
            // 多個權限，建立可展開的容器
            const primaryPermission = sortedPermissions[0];
            html += `<div class="role-permission-expandable" data-role-permissions>`;
            html += generatePermissionBadge(primaryPermission);
            html += `<span class="role-permission-more">+${sortedPermissions.length - 1}</span>`;
            
            // 隱藏的展開內容
            html += '<div class="role-permission-expanded">';
            sortedPermissions.slice(1).forEach(permission => {
                html += generatePermissionBadge(permission);
            });
            html += '</div></div>';
        }
        
        html += '</div>';
        return html;
    }
    
    /**
     * 綁定角色權限 badge 展開事件
     */
    function bindRolePermissionBadgeEvents() {
        const expandableContainers = document.querySelectorAll('.role-permission-expandable[data-role-permissions]');
        
        expandableContainers.forEach(container => {
            container.addEventListener('mouseenter', function() {
                const expanded = this.querySelector('.role-permission-expanded');
                if (expanded) {
                    expanded.style.display = 'flex';
                }
            });
            
            container.addEventListener('mouseleave', function() {
                const expanded = this.querySelector('.role-permission-expanded');
                if (expanded) {
                    expanded.style.display = 'none';
                }
            });
        });
    }

    // 公開 API
    return {
        renderRoleCards,
        generateRolePermissionBadges,
        bindRolePermissionBadgeEvents
    };

})();

// 註冊到全域
window.__OrganizationRolesCardModule = OrganizationRolesCardModule;