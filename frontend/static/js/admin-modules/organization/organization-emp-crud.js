/**
 * 組織管理 - 員工 CRUD 操作模組
 * 處理員工的新增、讀取、更新、刪除等資料操作
 */
window.OrganizationEmployeeCrudModule = (function() {
    'use strict';
    
    // API 端點
    const API_BASE = '/api/organization';
    const ENDPOINTS = {
        users: `${API_BASE}/users`,
        pendingUsers: `${API_BASE}/users/pending`,
        checkUser: `${API_BASE}/users/check`,
        permissionGroups: `/api/permissions/groups`,
    };
    
    /**
     * 將本地時間轉換為 UTC ISO 字串（修正時區偏移）
     * @param {Date} localDate - 本地時間日期對象
     * @returns {string} - UTC ISO 字串
     */
    function convertLocalTimeToUTC(localDate) {
        // 獲取時區偏移量（分鐘）
        const timezoneOffset = localDate.getTimezoneOffset();
        
        // 創建一個新的日期對象，補償時區偏移
        const utcDate = new Date(localDate.getTime() - (timezoneOffset * 60 * 1000));
        
        // 返回 UTC ISO 字串
        return utcDate.toISOString();
    }
    
    /**
     * 載入員工數據
     */
    async function loadUsers(showInactive = false) {
        try {
            const response = await fetch(`${ENDPOINTS.users}?all=true`, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            const allUsers = data.data || data || [];
            const activeUsers = showInactive ? allUsers : allUsers.filter(u => u.is_active);
            
            return {
                allUsers,
                activeUsers
            };
            
        } catch (error) {
            console.error('載入員工數據失敗:', error);
            throw error;
        }
    }
    
    /**
     * 根據部門載入員工
     */
    async function loadEmployeesByDept(deptId) {
        try {
            const response = await fetch(`${ENDPOINTS.users}?department_id=${deptId}`, {
                credentials: 'include'
            });
            
            if (!response.ok) throw new Error('Failed to load employees');
            
            const data = await response.json();
            return data.data || data || [];
            
        } catch (error) {
            console.error('Error loading employees:', error);
            throw error;
        }
    }
    
    /**
     * 載入單一員工詳情
     */
    async function loadEmployeeDetail(empId) {
        try {
            const response = await fetch(`${ENDPOINTS.users}/${empId}`, {
                credentials: 'include'
            });
            
            if (!response.ok) throw new Error('Failed to load employee detail');
            
            const data = await response.json();
            return data;
            
        } catch (error) {
            console.error('Error loading employee detail:', error);
            throw error;
        }
    }
    
    /**
     * 新增或更新員工
     */
    async function saveEmployee(userData, isEdit = false) {
        try {
            const userId = userData.id || userData.user_id;
            let response;
            
            // 有 user_id 表示是更新操作
            if (userId && userId !== '') {
                console.log('使用 PUT 更新用戶，ID:', userId);
                response = await fetch(`${ENDPOINTS.users}/${userId}`, {
                    method: 'PUT',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(userData)
                });
            } else {
                // 真正的新增模式
                console.log('使用 POST 新增用戶');
                response = await fetch(ENDPOINTS.users, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(userData)
                });
            }
            
            if (!response.ok) {
                const errorData = await response.json();
                throw {
                    status: response.status,
                    data: errorData
                };
            }
            
            const result = await response.json();
            return result;
            
        } catch (error) {
            console.error('Error saving employee:', error);
            
            // 如果是網路錯誤，提供更詳細的信息
            if (error instanceof TypeError && error.message.includes('fetch')) {
                console.error('網路連接失敗，可能是伺服器無響應或連線中斷');
                error.userMessage = '網路連接失敗，請檢查網路連線狀態';
            }
            
            // 如果有HTTP狀態碼，記錄詳細信息
            if (error.status) {
                console.error(`HTTP錯誤: ${error.status}`, error.data);
                if (error.data && error.data.detail) {
                    error.userMessage = error.data.detail;
                }
            }
            
            throw error;
        }
    }
    
    /**
     * 刪除員工
     */
    async function deleteEmployee(userId) {
        try {
            const response = await fetch(`${ENDPOINTS.users}/${userId}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete employee');
            }
            
            return true;
            
        } catch (error) {
            console.error('Error deleting employee:', error);
            throw error;
        }
    }
    
    /**
     * 更新用戶狀態（啟用/停用）
     */
    async function updateUserStatus(userId, isActive, activationExpires = null) {
        try {
            const requestBody = { is_active: isActive };
            if (activationExpires) {
                requestBody.activation_expires = convertLocalTimeToUTC(activationExpires);
            }
            
            const response = await fetch(`${ENDPOINTS.users}/${userId}`, {
                method: 'PATCH',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '更新狀態失敗');
            }
            
            const result = await response.json();
            return result;
            
        } catch (error) {
            console.error('Error updating user status:', error);
            throw error;
        }
    }
    
    /**
     * 重設用戶密碼
     */
    async function resetUserPassword(userId) {
        try {
            const response = await fetch(`${ENDPOINTS.users}/${userId}/reset-password`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('重設密碼失敗');
            }
            
            const result = await response.json();
            return result;
            
        } catch (error) {
            console.error('Error resetting password:', error);
            throw error;
        }
    }
    
    /**
     * 載入待處理帳號
     */
    async function loadPendingUsers() {
        try {
            const response = await fetch(ENDPOINTS.pendingUsers, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                console.error('載入待處理帳號失敗:', response.status);
                return [];
            }
            
            const pendingUsers = await response.json();
            return pendingUsers;
            
        } catch (error) {
            console.error('載入待處理帳號時發生錯誤:', error);
            return [];
        }
    }
    
    /**
     * 檢查帳號狀態
     */
    async function checkAccountStatus(loginid) {
        if (!loginid || !loginid.trim()) {
            return null;
        }
        
        try {
            const response = await fetch(`${ENDPOINTS.checkUser}/${encodeURIComponent(loginid)}`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('檢查失敗');
            }
            
            const data = await response.json();
            return data;
            
        } catch (error) {
            console.error('檢查帳號狀態失敗:', error);
            throw error;
        }
    }
    
    /**
     * 載入權限群組數據
     */
    async function loadPermissionGroups() {
        try {
            const response = await fetch(ENDPOINTS.permissionGroups, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return Array.isArray(data) ? data : (data.data || []);
            
        } catch (error) {
            console.error('載入權限群組數據失敗:', error);
            return [];
        }
    }
    
    /**
     * 載入部門選項
     */
    async function loadDepartmentOptions() {
        try {
            const response = await fetch('/api/organization/departments?tree=false', {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('載入部門失敗');
            }
            
            const departments = await response.json();
            return departments;
            
        } catch (error) {
            console.error('Error loading departments:', error);
            throw error;
        }
    }
    
    /**
     * 載入部門員工資料（用於懸浮卡片）
     */
    async function loadDepartmentEmployees(deptId) {
        try {
            const response = await fetch(`${API_BASE}/users?all=true`, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            const allUsers = Array.isArray(data) ? data : (data.data || []);
            
            // 過濾出屬於該部門的員工
            const deptEmployees = allUsers.filter(user => {
                const userDeptId = user.department?.id || 
                                  user.user_extension?.department_id;
                return userDeptId == deptId;
            });
            
            return deptEmployees;
            
        } catch (error) {
            console.error('載入部門員工失敗:', error);
            throw error;
        }
    }
    
    /**
     * 批量載入資料（用於重新初始化）
     */
    async function loadAllDataForReinitialization() {
        try {
            const [deptResponse, userResponse] = await Promise.all([
                fetch('/api/organization/departments?tree=true', { 
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' }
                }),
                fetch(`${ENDPOINTS.users}?all=true`, { 
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' }
                })
            ]);

            if (!deptResponse.ok || !userResponse.ok) {
                throw new Error(`載入失敗: dept=${deptResponse.status}, user=${userResponse.status}`);
            }

            const departments = await deptResponse.json();
            const userData = await userResponse.json();
            
            const allUsers = userData.data || userData || [];
            
            return {
                departments,
                allUsers
            };
            
        } catch (error) {
            console.error('載入部門和員工資料失敗:', error);
            throw error;
        }
    }
    
    // 公開 API
    return {
        // 基本 CRUD 操作
        loadUsers,
        loadEmployeesByDept,
        loadEmployeeDetail,
        saveEmployee,
        deleteEmployee,
        updateUserStatus,
        resetUserPassword,
        
        // 待處理帳號相關
        loadPendingUsers,
        checkAccountStatus,
        
        // 資料載入
        loadPermissionGroups,
        loadDepartmentOptions,
        loadDepartmentEmployees,
        loadAllDataForReinitialization,
        
        // API 端點（供其他模組參考）
        ENDPOINTS
    };
})();

// 確保模組可被存取
if (typeof OrganizationEmployeeCrudModule === 'undefined') {
    var OrganizationEmployeeCrudModule = window.OrganizationEmployeeCrudModule;
}