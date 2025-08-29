/**
 * 組織管理主模組 - 協調器
 * 負責協調部門、員工、角色三個子模組的運作
 */
const OrganizationModule = (function() {
    'use strict';
    
    // 子模組參考
    let departmentModule = null;
    let employeeModule = null;
    let rolesModule = null;
    let roleTemplateModule = null;
    
    /**
     * 初始化模組
     */
    async function init() {
        // OrganizationModule 初始化開始
        
        // 初始化滾動條淡出淡入效果
        if (window.CommonUI && CommonUI.initScrollFadeEffect) {
            CommonUI.initScrollFadeEffect();
        }
        
        // 取得子模組參考
        departmentModule = window.OrganizationDepartmentModule;
        employeeModule = window.OrganizationEmployeeModule;
        rolesModule = window.OrganizationRolesModule;
        // roleTemplateModule 現在透過 rolesModule 存取
        
        // 初始化子模組
        if (departmentModule) {
            await departmentModule.init();
        }
        if (employeeModule) {
            await employeeModule.init();
        }
        // 角色模板模組現在由 rolesModule 管理
        if (rolesModule) {
            await rolesModule.init();
        }
        
        // 綁定協調器事件
        bindCoordinatorEvents();
        
        // 更新統計
        await updateStatistics();
        
        // OrganizationModule 初始化完成
    }
    
    /**
     * 綁定協調器事件
     */
    function bindCoordinatorEvents() {
        // 監聽區塊切換事件
        window.addEventListener('orgSectionChange', async (e) => {
            const section = e.detail.section;
            
            // 特別處理角色管理區塊
            if (section === 'roles') {
                if (rolesModule) {
                    // 確保角色管理正確初始化
                    await rolesModule.initRoleManagement();
                }
            } else {
                // 切換到其他區塊時，重置角色管理狀態
                if (rolesModule) {
                    rolesModule.resetRoleManagementState();
                }
                // 載入其他區塊資料
                await loadSectionData(section);
            }
            
            // 重新初始化滾動條效果
            setTimeout(() => {
                if (window.CommonUI && CommonUI.initScrollFadeEffect) {
                    CommonUI.initScrollFadeEffect();
                }
            }, 100);
        });
        
        // 監聽角色統計數據更新事件
        window.addEventListener('roleStatsChanged', (e) => {
            const stats = e.detail;
            const roleCount = document.querySelector('#roleCount span');
            if (roleCount && stats) {
                roleCount.textContent = stats.activeRoles || 0;
            }
        });
    }
    
    /**
     * 載入區塊數據
     */
    async function loadSectionData(section) {
        switch(section) {
            case 'role-templates':
                if (rolesModule) {
                    await rolesModule.loadRoleTemplates();
                }
                break;
            case 'departments':
                if (departmentModule) {
                    await departmentModule.loadDepartments();
                }
                break;
            case 'employees':
            case 'users':
                if (employeeModule) {
                    await employeeModule.loadUsers();
                }
                break;
        }
        updateStatistics();
    }
    
    /**
     * 載入所有數據
     */
    async function loadAllData() {
        try {
            showLoadingState();
            
            const promises = [];
            
            if (departmentModule) {
                promises.push(departmentModule.loadDepartments());
            }
            if (employeeModule) {
                promises.push(employeeModule.loadPermissionGroups());
                promises.push(employeeModule.loadUsers());
            }
            
            await Promise.all(promises);
            
            hideLoadingState();
            updateStatistics();
        } catch (error) {
            console.error('載入數據失敗:', error);
            hideLoadingState();
            showError('載入數據失敗，部分功能可能無法正常使用');
        }
    }
    
    /**
     * 更新統計資訊
     */
    async function updateStatistics() {
        // 更新部門統計
        if (departmentModule) {
            departmentModule.updateDepartmentStats();
        }
        
        // 更新角色統計
        updateRoleStatistics();
        
        // 更新用戶統計
        if (employeeModule) {
            employeeModule.updateUserStatistics();
        }
    }
    
    /**
     * 更新角色統計資訊（使用統一的角色統計服務）
     */
    async function updateRoleStatistics() {
        try {
            // 使用 OrganizationRolesModule 的統一統計服務
            if (rolesModule) {
                // 確保角色數據已載入
                await rolesModule.ensureRolesLoaded();
                
                // 獲取統計數據
                const stats = rolesModule.getRoleStatistics();
                
                // 更新角色統計顯示（只顯示啟用的角色）
                const roleCount = document.querySelector('#roleCount span');
                if (roleCount) {
                    roleCount.textContent = stats.activeRoles || 0;
                }
            } else {
                // 如果 OrganizationRolesModule 未載入，使用 fallback
                // OrganizationRolesModule 未載入，使用預設值
                const roleCount = document.querySelector('#roleCount span');
                if (roleCount) {
                    roleCount.textContent = '0';
                }
            }
        } catch (error) {
            console.error('更新角色統計失敗:', error);
            // 如果發生錯誤，設置為 0
            const roleCount = document.querySelector('#roleCount span');
            if (roleCount) {
                roleCount.textContent = '0';
            }
        }
    }
    
    /**
     * 顯示載入狀態
     */
    function showLoadingState() {
        document.querySelectorAll('.loading-spinner').forEach(spinner => {
            spinner.style.display = 'flex';
        });
    }
    
    /**
     * 隱藏載入狀態
     */
    function hideLoadingState() {
        document.querySelectorAll('.loading-spinner').forEach(spinner => {
            spinner.style.display = 'none';
        });
    }
    
    /**
     * 顯示錯誤訊息
     */
    function showError(message) {
        if (window.Dialog) {
            Dialog.error(message);
        } else {
            alert(message);
        }
    }
    
    /**
     * 顯示成功訊息
     */
    function showSuccess(message) {
        if (window.Dialog) {
            Dialog.success(message);
        } else {
            alert(message);
        }
    }
    
    // ========================================
    // 代理函數 - 為了保持向後兼容
    // ========================================
    
    /**
     * 儲存部門（代理）
     */
    function saveDepartment() {
        if (departmentModule && departmentModule.saveDepartment) {
            return departmentModule.saveDepartment();
        }
    }
    
    /**
     * 儲存員工（代理）
     */
    function saveEmployee() {
        if (employeeModule && employeeModule.saveEmployee) {
            return employeeModule.saveEmployee();
        }
    }
    
    /**
     * 編輯部門（代理）
     */
    function editDepartment(id) {
        if (departmentModule && departmentModule.editDepartment) {
            return departmentModule.editDepartment(id);
        }
    }
    
    /**
     * 編輯用戶（代理）
     */
    function editUser(id) {
        if (employeeModule && employeeModule.editUser) {
            return employeeModule.editUser(id);
        }
    }
    
    /**
     * 刪除部門（代理）
     */
    function deleteDepartment(id) {
        if (departmentModule && departmentModule.deleteDepartment) {
            return departmentModule.deleteDepartment(id);
        }
    }
    
    /**
     * 刪除用戶（代理）
     */
    function deleteUser(id) {
        if (employeeModule && employeeModule.deleteUser) {
            return employeeModule.deleteUser(id);
        }
    }
    
    /**
     * 搜尋部門（代理）
     */
    function searchDepartment() {
        if (departmentModule && departmentModule.searchDepartment) {
            return departmentModule.searchDepartment();
        }
    }
    
    /**
     * 切換停用部門顯示（代理）
     */
    function toggleInactiveDepts() {
        if (departmentModule && departmentModule.toggleInactiveDepts) {
            return departmentModule.toggleInactiveDepts();
        }
    }
    
    /**
     * 切換停用員工顯示（代理）
     */
    function toggleInactiveEmployees() {
        if (employeeModule && employeeModule.toggleInactiveEmployees) {
            return employeeModule.toggleInactiveEmployees();
        }
    }
    
    /**
     * 展開全部（代理）
     */
    function expandAll() {
        if (departmentModule && departmentModule.expandAll) {
            return departmentModule.expandAll();
        }
    }
    
    /**
     * 收合全部（代理）
     */
    function collapseAll() {
        if (departmentModule && departmentModule.collapseAll) {
            return departmentModule.collapseAll();
        }
    }
    
    /**
     * 重新整理樹狀結構（代理）
     */
    function refreshTree() {
        if (departmentModule && departmentModule.refreshTree) {
            return departmentModule.refreshTree();
        }
    }
    
    /**
     * 顯示模態框（代理）
     */
    function showModal(modalId) {
        // 根據模態框類型分派給對應的模組
        if (modalId === 'departmentModal' && departmentModule) {
            return departmentModule.showModal(modalId);
        } else if (modalId === 'employeeModal' && employeeModule) {
            return employeeModule.showModal(modalId);
        }
        
        // 通用處理
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
        }
    }
    
    /**
     * 關閉模態框（代理）
     */
    function closeModal(modalId) {
        // 根據模態框類型分派給對應的模組
        if (modalId === 'departmentModal' && departmentModule) {
            return departmentModule.closeModal(modalId);
        } else if (modalId === 'employeeModal' && employeeModule) {
            return employeeModule.closeModal(modalId);
        }
        
        // 通用處理
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
            // 清空表單
            const form = modal.querySelector('form');
            if (form) {
                form.reset();
            }
        }
    }
    
    // 公開 API
    return {
        init: init,
        saveDepartment: saveDepartment,
        saveEmployee: saveEmployee,
        editDepartment: editDepartment,
        editUser: editUser,
        deleteDepartment: deleteDepartment,
        deleteUser: deleteUser,
        searchDepartment: searchDepartment,
        toggleInactiveDepts: toggleInactiveDepts,
        toggleInactiveEmployees: toggleInactiveEmployees,
        expandAll: expandAll,
        collapseAll: collapseAll,
        refreshTree: refreshTree,
        refresh: loadAllData,
        showModal: showModal,
        closeModal: closeModal,
        updateStatistics: updateStatistics
    };
})();

// 確保模組可被全域存取
window.OrganizationModule = OrganizationModule;

// ========================================
// 全域函數（供 HTML onclick 使用）- 保持向後兼容
// ========================================

window.saveDepartment = function() {
    if (window.OrganizationDepartmentModule && window.OrganizationDepartmentModule.saveDepartment) {
        return window.OrganizationDepartmentModule.saveDepartment();
    }
    // Fallback
    if (window.OrganizationModule && window.OrganizationModule.saveDepartment) {
        return window.OrganizationModule.saveDepartment();
    }
};

window.saveEmployee = function() {
    if (window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.saveEmployee) {
        return window.OrganizationEmployeeModule.saveEmployee();
    }
    // Fallback
    if (window.OrganizationModule && window.OrganizationModule.saveEmployee) {
        return window.OrganizationModule.saveEmployee();
    }
};

window.closeDepartmentModal = function() {
    if (window.OrganizationDepartmentModule && window.OrganizationDepartmentModule.closeModal) {
        return window.OrganizationDepartmentModule.closeModal('departmentModal');
    }
    // Fallback: 直接處理
    const modal = document.getElementById('departmentModal');
    if (modal) {
        modal.classList.remove('show');
        const form = modal.querySelector('form');
        if (form) form.reset();
    }
};

window.closeEmployeeModal = function() {
    if (window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.closeModal) {
        return window.OrganizationEmployeeModule.closeModal('employeeModal');
    }
    // Fallback: 直接處理
    const modal = document.getElementById('employeeModal');
    if (modal) {
        modal.classList.remove('show');
        const form = modal.querySelector('form');
        if (form) form.reset();
    }
};

window.togglePasswordField = function() {
    const strategy = document.getElementById('passwordStrategy').value;
    const passwordGroup = document.getElementById('manualPasswordGroup');
    if (passwordGroup) {
        passwordGroup.style.display = strategy === 'MANUAL' ? 'block' : 'none';
    }
};