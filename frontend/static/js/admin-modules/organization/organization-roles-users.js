/**
 * 組織角色用戶管理子模組
 * 處理角色與用戶關聯的操作
 */
const OrganizationRolesUsersModule = (function() {
    'use strict';

    // API 端點
    const API_BASE = '/api/organization';

    /**
     * 載入使用角色的用戶
     * @param {number} roleId - 角色ID
     * @returns {Array} 用戶列表
     */
    async function loadRoleUsers(roleId) {
        try {
            const response = await fetch(`${API_BASE}/department-roles/${roleId}/users`, {
                method: 'GET',
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('載入角色用戶失敗:', error);
            throw error;
        }
    }

    /**
     * 顯示角色詳情
     * @param {Object} role - 角色資料
     * @param {Array} users - 用戶列表
     */
    function showRoleDetails(role, users) {
        const detailsPanel = document.getElementById('departmentDetails');
        if (!detailsPanel) return;
        
        detailsPanel.innerHTML = `
            <div class="details-card">
                <h3><i class="fas fa-user-tie"></i> 角色資訊</h3>
                <div class="details-content">
                    <p><strong>角色名稱：</strong>${role.name}</p>
                    <p><strong>角色類型：</strong>${role.role_type === 'manager' ? '管理角色' : '員工角色'}</p>
                    <p><strong>所屬部門：</strong>${role.department_name}</p>
                    <p><strong>角色層級：</strong>${role.level}</p>
                    
                    <h4>指派人員 (${users.length})</h4>
                    <div class="user-list scrollable-fade">
                        ${users.length > 0 ? users.map(u => `
                            <div class="user-item">
                                <i class="fas fa-user-circle"></i>
                                <span>${u.username} (${u.loginid})</span>
                                <button class="btn-remove" onclick="OrganizationRolesModule.removeUserFromRole(${u.user_id}, ${role.id})">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        `).join('') : '<p class="text-muted">尚無人員</p>'}
                    </div>
                    
                    <div class="role-actions">
                        <button class="btn btn-sm btn-primary" onclick="OrganizationRolesModule.assignUsersToRole(${role.id})">
                            <i class="fas fa-plus"></i> 指派人員
                        </button>
                        <button class="btn btn-sm btn-outline" onclick="OrganizationRolesModule.editDepartmentRole(${role.id})">
                            <i class="fas fa-edit"></i> 編輯角色
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 選擇角色（顯示角色詳情）
     * @param {number} roleId - 角色ID
     * @param {Array} departmentRoles - 部門角色列表（從主模組傳入）
     */
    async function selectRoleAndShowDetails(roleId, departmentRoles = []) {
        try {
            const users = await loadRoleUsers(roleId);
            const role = departmentRoles.find(r => r.id === roleId);
            
            if (role) {
                showRoleDetails(role, users);
            }
        } catch (error) {
            console.error('載入角色用戶失敗:', error);
            if (window.Dialog) {
                Dialog.error('載入角色詳情失敗');
            }
        }
    }

    /**
     * 渲染角色用戶列表（用於模態框）
     * @param {Array} users - 用戶列表
     */
    function renderRoleUsersList(users) {
        const container = document.getElementById('roleUsersList');
        
        if (!container) return;
        
        if (users.length === 0) {
            container.innerHTML = '<p class="text-muted">沒有用戶使用此角色</p>';
        } else {
            container.innerHTML = `
                <table class="simple-table">
                    <thead>
                        <tr>
                            <th>帳號</th>
                            <th>姓名</th>
                            <th>Email</th>
                            <th>指派時間</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${users.map(user => `
                            <tr>
                                <td>${user.loginid || ''}</td>
                                <td>${user.username}</td>
                                <td>${user.email}</td>
                                <td>${user.assigned_at ? new Date(user.assigned_at).toLocaleString('zh-TW') : ''}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
    }

    // 公開 API
    return {
        loadRoleUsers,
        showRoleDetails,
        selectRoleAndShowDetails,
        renderRoleUsersList
    };

})();

// 註冊到全域
window.__OrganizationRolesUsersModule = OrganizationRolesUsersModule;