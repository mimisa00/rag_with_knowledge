/**
 * 組織角色 CRUD 子模組
 * 處理角色的建立、讀取、更新、刪除操作
 */
const OrganizationRolesCrudModule = (function() {
    'use strict';
    
    // API 端點
    const API_BASE = '/api/organization';
    
    /**
     * 載入部門角色
     * @param {number} departmentId - 部門 ID
     * @returns {Promise<Array>} 角色列表
     */
    async function loadDepartmentRoles(departmentId) {
        try {
            const response = await fetch(`${API_BASE}/departments/${departmentId}/roles`, {
                method: 'GET',
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('載入部門角色失敗');
            }
            
            return await response.json();
            
        } catch (error) {
            console.error('載入部門角色失敗:', error);
            return [];
        }
    }
    
    /**
     * 建立部門角色（批量）
     * @param {number} departmentId - 部門 ID
     * @param {Array} selectedTemplates - 選中的模板
     * @param {Object} departmentRolesCache - 角色快取（主模組提供）
     * @returns {Promise<Object>} 建立結果
     */
    async function createDepartmentRoles(departmentId, selectedTemplates, departmentRolesCache) {
        try {
            const response = await fetch(`${API_BASE}/departments/${departmentId}/roles/batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    department_id: departmentId,
                    role_templates: selectedTemplates
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || '建立角色失敗');
            }
            
            const result = await response.json();
            
            // 更新緩存中的角色數據
            if (result.created_roles && Array.isArray(result.created_roles)) {
                if (!departmentRolesCache[departmentId]) {
                    departmentRolesCache[departmentId] = [];
                }
                departmentRolesCache[departmentId].push(...result.created_roles);
            }
            
            // 返回完整的結果物件
            return result;
            
        } catch (error) {
            console.error('建立部門角色失敗:', error);
            throw error;
        }
    }
    
    /**
     * 取得部門角色資訊
     * @param {number} roleId - 角色 ID
     * @returns {Promise<Object>} 角色資訊
     */
    async function getDepartmentRole(roleId) {
        try {
            const response = await fetch(`${API_BASE}/department-roles/${roleId}`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('載入角色失敗');
            }
            
            return await response.json();
            
        } catch (error) {
            console.error('取得角色資訊失敗:', error);
            throw error;
        }
    }
    
    /**
     * 更新部門角色
     * @param {number} roleId - 角色 ID
     * @param {Object} updateData - 更新資料
     * @returns {Promise<Object>} 更新結果
     */
    async function updateDepartmentRole(roleId, updateData) {
        try {
            const response = await fetch(`${API_BASE}/department-roles/${roleId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(updateData)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || '更新失敗');
            }
            
            const result = await response.json();
            
            // 檢查是否有警告訊息（循環引用自動修正）
            if (result.warning && window.Dialog) {
                Dialog.warning(result.warning);
            }
            
            return result;
            
        } catch (error) {
            console.error('更新角色失敗:', error);
            throw error;
        }
    }
    
    /**
     * 刪除部門角色
     * @param {number} roleId - 角色 ID
     * @returns {Promise<void>}
     */
    async function deleteDepartmentRole(roleId) {
        try {
            const response = await fetch(`${API_BASE}/department-roles/${roleId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || '刪除失敗');
            }
            
        } catch (error) {
            console.error('刪除角色失敗:', error);
            throw error;
        }
    }
    
    /**
     * 移動角色到新部門
     * @param {number} roleId - 角色 ID
     * @param {Object} moveData - 移動資料
     * @returns {Promise<Object>} 移動結果
     */
    async function moveDepartmentRole(roleId, moveData) {
        try {
            const response = await fetch(`${API_BASE}/department-roles/${roleId}/move`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(moveData)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || '移動角色失敗');
            }
            
            return await response.json();
            
        } catch (error) {
            console.error('移動角色失敗:', error);
            throw error;
        }
    }
    
    /**
     * 預覽移動影響
     * @param {number} roleId - 角色 ID
     * @param {Object} previewData - 預覽資料
     * @returns {Promise<Object>} 預覽結果
     */
    async function previewRoleMove(roleId, previewData) {
        try {
            const response = await fetch(`${API_BASE}/department-roles/${roleId}/move-preview`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(previewData)
            });
            
            if (!response.ok) {
                throw new Error('預覽移動影響失敗');
            }
            
            return await response.json();
            
        } catch (error) {
            console.error('預覽移動影響失敗:', error);
            throw error;
        }
    }
    
    /**
     * 重新計算子角色層級
     * @param {number} roleId - 角色 ID
     * @param {boolean} preview - 是否只預覽
     * @returns {Promise<Object>} 結果
     */
    async function recalculateChildrenLevels(roleId, preview = true) {
        try {
            const response = await fetch(`${API_BASE}/department-roles/${roleId}/recalculate-children?preview=${preview}`, {
                method: 'POST',
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(preview ? '無法預覽層級變更影響' : '重算失敗');
            }
            
            return await response.json();
            
        } catch (error) {
            console.error('重新計算子角色層級失敗:', error);
            throw error;
        }
    }
    
    /**
     * 載入角色的用戶
     * @param {number} roleId - 角色 ID
     * @returns {Promise<Array>} 用戶列表
     */
    async function loadRoleUsers(roleId) {
        try {
            const response = await fetch(`${API_BASE}/department-roles/${roleId}/users`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('載入用戶列表失敗');
            }
            
            return await response.json();
            
        } catch (error) {
            console.error('載入用戶列表失敗:', error);
            throw error;
        }
    }
    
    /**
     * 移除用戶的角色
     * @param {number} roleId - 角色 ID
     * @param {number} userId - 用戶 ID
     * @returns {Promise<void>}
     */
    async function removeUserFromRole(roleId, userId) {
        try {
            const response = await fetch(`${API_BASE}/department-roles/${roleId}/users/${userId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('移除失敗');
            }
            
        } catch (error) {
            console.error('移除用戶角色失敗:', error);
            throw error;
        }
    }
    
    /**
     * 載入所有部門的角色（批次 API）
     * @param {Array} departmentIds - 部門 ID 列表
     * @returns {Promise<Object>} 角色資料
     */
    async function loadDepartmentRolesBatch(departmentIds) {
        if (!departmentIds || departmentIds.length === 0) {
            return {};
        }
        
        try {
            const response = await fetch(`${API_BASE}/departments/roles/batch?department_ids=${departmentIds.join(',')}`, {
                credentials: 'include'
            });
            
            if (response.ok) {
                const result = await response.json();
                return result.data || {};
            }
            
            throw new Error('批次載入角色失敗');
            
        } catch (error) {
            console.error('批次載入部門角色失敗:', error);
            throw error;
        }
    }
    
    /**
     * 搜尋角色
     * @param {string} keyword - 搜尋關鍵字
     * @param {number} excludeId - 排除的角色 ID
     * @returns {Promise<Array>} 搜尋結果
     */
    async function searchRoles(keyword, excludeId = null) {
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
            
            return await response.json();
            
        } catch (error) {
            console.error('搜尋角色失敗:', error);
            throw error;
        }
    }
    
    /**
     * 取得安全的父角色候選項
     * @param {number} roleId - 當前角色 ID
     * @returns {Promise<Array>} 安全的父角色列表
     */
    async function getSafeParentCandidates(roleId) {
        try {
            const response = await fetch(`${API_BASE}/department-roles/${roleId}/safe-parents`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
            
        } catch (error) {
            console.error('取得安全父角色候選項失敗:', error);
            throw error;
        }
    }
    
    // 公開方法
    return {
        // 基本 CRUD
        loadDepartmentRoles,
        createDepartmentRoles,
        getDepartmentRole,
        updateDepartmentRole,
        deleteDepartmentRole,
        
        // 角色移動與層級
        moveDepartmentRole,
        previewRoleMove,
        recalculateChildrenLevels,
        
        // 用戶相關
        loadRoleUsers,
        removeUserFromRole,
        
        // 批次與搜尋
        loadDepartmentRolesBatch,
        searchRoles,
        getSafeParentCandidates
    };
})();

// 註冊為全域模組（如果需要）
if (typeof window !== 'undefined') {
    window.__OrganizationRolesCrudModule = OrganizationRolesCrudModule;
}