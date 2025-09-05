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
    
    // 共享資料快取
    let departmentRolesCache = {
        data: null,
        timestamp: null,
        expireTime: 5 * 60 * 1000 // 5分鐘快取時間
    };
    
    /**
     * 初始化模組
     */
    async function init() {
        console.log('OrganizationModule 初始化開始');
        
        // 初始化滾動條淡出淡入效果
        if (window.CommonUI && CommonUI.initScrollFadeEffect) {
            CommonUI.initScrollFadeEffect();
        }
        
        // 取得子模組參考
        departmentModule = window.OrganizationDepartmentModule;
        employeeModule = window.OrganizationEmployeeModule;
        rolesModule = window.OrganizationRolesModule;
        
        console.log('子模組狀態:', {
            department: !!departmentModule,
            employee: !!employeeModule,
            roles: !!rolesModule
        });
        
        // 初始化子模組
        if (departmentModule) {
            console.log('初始化部門模組...');
            await departmentModule.init();
        }
        
        if (employeeModule) {
            try {
                console.log('正在初始化員工管理模組...');
                await employeeModule.init();
                console.log('員工管理模組初始化完成');
            } catch (error) {
                console.error('員工管理模組初始化失敗:', error);
            }
        } else {
            console.error('OrganizationEmployeeModule 不存在!');
        }
        
        // 角色模板模組現在由 rolesModule 管理
        if (rolesModule) {
            console.log('初始化角色模組...');
            await rolesModule.init();
        }
        
        // 綁定協調器事件
        bindCoordinatorEvents();
        
        // 更新統計
        await updateStatistics();
        
        console.log('OrganizationModule 初始化完成');
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
                console.log('切換到員工管理區塊');
                if (employeeModule) {
                    // 檢查模組是否已初始化
                    if (employeeModule.isInitialized && !employeeModule.isInitialized()) {
                        console.log('員工模組未初始化，正在初始化...');
                        await employeeModule.init();
                    }
                    
                    // 使用重新初始化方法
                    if (employeeModule.reinitialize) {
                        console.log('調用 employeeModule.reinitialize()');
                        await employeeModule.reinitialize();
                    } else {
                        console.log('調用 employeeModule.loadUsers()');
                        await employeeModule.loadUsers();
                    }
                } else {
                    console.error('employeeModule 不存在!');
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
            
            // 清除快取，強制重新載入資料
            clearCache();
            console.log('已清除部門角色快取，將重新載入資料');
            
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
    async function saveDepartment() {
        if (departmentModule && departmentModule.saveDepartment) {
            try {
                const result = await departmentModule.saveDepartment();
                // 如果成功儲存，清除快取
                if (result !== false) {
                    clearCache();
                    console.log('部門儲存成功，已清除快取');
                }
                return result;
            } catch (error) {
                console.error('儲存部門失敗:', error);
                throw error;
            }
        }
    }
    
    /**
     * 儲存員工（代理）
     */
    async function saveEmployee() {
        if (employeeModule && employeeModule.saveEmployee) {
            try {
                const result = await employeeModule.saveEmployee();
                // 如果成功儲存，清除快取（因為可能涉及角色異動）
                if (result !== false) {
                    clearCache();
                    console.log('員工儲存成功，已清除快取');
                }
                return result;
            } catch (error) {
                console.error('儲存員工失敗:', error);
                throw error;
            }
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
    
    /**
     * 快取相關方法
     */
    
    /**
     * 檢查快取是否有效
     */
    function isCacheValid() {
        return departmentRolesCache.data && 
               departmentRolesCache.timestamp && 
               (Date.now() - departmentRolesCache.timestamp) < departmentRolesCache.expireTime;
    }
    
    /**
     * 清除快取
     */
    function clearCache() {
        departmentRolesCache.data = null;
        departmentRolesCache.timestamp = null;
    }
    
    /**
     * 取得部門角色資料（帶快取）
     */
    async function getDepartmentRolesWithCache(forceRefresh = false) {
        // 如果強制更新或快取失效，重新載入資料
        if (forceRefresh || !isCacheValid()) {
            console.log('快取失效或強制刷新，重新載入部門角色資料...');
            try {
                // 先載入部門樹
                const deptResponse = await fetch('/api/organization/departments?tree=true', {
                    credentials: 'include'
                });
                
                if (!deptResponse.ok) {
                    throw new Error(`部門樹載入失敗: ${deptResponse.status}`);
                }
                
                const departments = await deptResponse.json();
                
                // 收集所有有效的部門ID
                const collectDeptIds = (depts) => {
                    let ids = [];
                    depts.forEach(dept => {
                        if (dept.is_active) {
                            ids.push(dept.id);
                            if (dept.children && dept.children.length > 0) {
                                ids = ids.concat(collectDeptIds(dept.children));
                            }
                        }
                    });
                    return ids;
                };
                
                const deptIds = collectDeptIds(departments);
                console.log('需要載入角色的部門ID:', deptIds);
                
                // 使用批次API載入所有部門的角色
                let rolesData = {};
                if (deptIds.length > 0) {
                    const rolesResponse = await fetch(`/api/organization/departments/roles/batch?department_ids=${deptIds.join(',')}`, {
                        credentials: 'include'
                    });
                    
                    if (rolesResponse.ok) {
                        const result = await rolesResponse.json();
                        rolesData = result.data || {};
                    } else {
                        console.warn('批次載入角色失敗，將使用空資料');
                    }
                }
                
                // 將角色資料附加到對應的部門
                const attachRolesToDepartments = (depts) => {
                    depts.forEach(dept => {
                        if (dept.is_active) {
                            dept.roles = rolesData[dept.id] || [];
                        }
                        
                        if (dept.children && dept.children.length > 0) {
                            attachRolesToDepartments(dept.children);
                        }
                    });
                };
                
                attachRolesToDepartments(departments);
                
                // 更新快取
                departmentRolesCache.data = departments;
                departmentRolesCache.timestamp = Date.now();
                
                console.log('部門角色資料快取已更新:', departments);
            } catch (error) {
                console.error('載入部門角色資料失敗:', error);
                // 如果載入失敗且沒有快取資料，返回空陣列
                if (!departmentRolesCache.data) {
                    return [];
                }
            }
        } else {
            console.log('使用快取的部門角色資料');
        }
        
        return departmentRolesCache.data || [];
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
        // 快取相關方法
        getDepartmentRolesWithCache: getDepartmentRolesWithCache,
        clearCache: clearCache,
        closeModal: closeModal,
        updateStatistics: updateStatistics
    };
})();

// 確保模組可被全域存取
window.OrganizationModule = OrganizationModule;

// ========================================
// 全域函數（供 HTML onclick 使用）- 保持向後兼容
// ========================================

window.saveDepartment = async function() {
    if (window.OrganizationDepartmentModule && window.OrganizationDepartmentModule.saveDepartment) {
        const result = await window.OrganizationDepartmentModule.saveDepartment();
        // 清除快取
        if (result !== false && window.OrganizationModule && window.OrganizationModule.clearCache) {
            window.OrganizationModule.clearCache();
        }
        return result;
    }
    // Fallback
    if (window.OrganizationModule && window.OrganizationModule.saveDepartment) {
        return await window.OrganizationModule.saveDepartment();
    }
};

window.saveEmployee = async function() {
    if (window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.saveEmployee) {
        const result = await window.OrganizationEmployeeModule.saveEmployee();
        // 清除快取
        if (result !== false && window.OrganizationModule && window.OrganizationModule.clearCache) {
            window.OrganizationModule.clearCache();
        }
        return result;
    }
    // Fallback
    if (window.OrganizationModule && window.OrganizationModule.saveEmployee) {
        return await window.OrganizationModule.saveEmployee();
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