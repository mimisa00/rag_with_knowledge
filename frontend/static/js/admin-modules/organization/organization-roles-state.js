/**
 * 組織角色狀態管理子模組
 * 處理角色管理相關的狀態變數管理
 */
const OrganizationRolesStateModule = (function() {
    'use strict';

    // 狀態變數
    let departmentRoles = [];
    let currentDepartmentId = null;
    let currentRoleId = null;
    let deptTreeData = [];
    let selectedDeptId = null;
    let selectedRoleId = null;
    let showInactiveRoles = false;
    let departmentRolesCache = {}; // 緩存部門角色資料
    let isRoleManagementInitialized = false; // 角色管理初始化標記
    
    // 部門變更相關變數
    let originalDepartmentId = null;  // 儲存原始部門ID
    let departmentChanged = false;    // 標記部門是否變更
    let movePreviewData = null;       // 儲存移動預覽資訊
    
    // 角色模板相關變數
    let roleTemplates = [];
    
    // 追蹤當前模式
    let isRoleBatchMode = false;

    /**
     * 獲取狀態變數
     */
    function getState() {
        return {
            departmentRoles,
            currentDepartmentId,
            currentRoleId,
            deptTreeData,
            selectedDeptId,
            selectedRoleId,
            showInactiveRoles,
            departmentRolesCache,
            isRoleManagementInitialized,
            originalDepartmentId,
            departmentChanged,
            movePreviewData,
            roleTemplates,
            isRoleBatchMode
        };
    }

    /**
     * 更新狀態變數
     */
    function setState(newState) {
        if (newState.departmentRoles !== undefined) departmentRoles = newState.departmentRoles;
        if (newState.currentDepartmentId !== undefined) currentDepartmentId = newState.currentDepartmentId;
        if (newState.currentRoleId !== undefined) currentRoleId = newState.currentRoleId;
        if (newState.deptTreeData !== undefined) deptTreeData = newState.deptTreeData;
        if (newState.selectedDeptId !== undefined) selectedDeptId = newState.selectedDeptId;
        if (newState.selectedRoleId !== undefined) selectedRoleId = newState.selectedRoleId;
        if (newState.showInactiveRoles !== undefined) showInactiveRoles = newState.showInactiveRoles;
        if (newState.departmentRolesCache !== undefined) departmentRolesCache = newState.departmentRolesCache;
        if (newState.isRoleManagementInitialized !== undefined) isRoleManagementInitialized = newState.isRoleManagementInitialized;
        if (newState.originalDepartmentId !== undefined) originalDepartmentId = newState.originalDepartmentId;
        if (newState.departmentChanged !== undefined) departmentChanged = newState.departmentChanged;
        if (newState.movePreviewData !== undefined) movePreviewData = newState.movePreviewData;
        if (newState.roleTemplates !== undefined) roleTemplates = newState.roleTemplates;
        if (newState.isRoleBatchMode !== undefined) isRoleBatchMode = newState.isRoleBatchMode;
    }

    /**
     * 重置角色管理初始化狀態
     */
    function resetRoleManagementState() {
        isRoleManagementInitialized = false;
        console.log('角色管理初始化狀態已重置');
    }

    /**
     * 重置部門變更狀態
     */
    function resetDepartmentState() {
        departmentChanged = false;
        movePreviewData = null;
    }

    /**
     * 清空緩存
     */
    function clearCache() {
        departmentRolesCache = {};
    }

    // 公開 API
    return {
        getState,
        setState,
        resetRoleManagementState,
        resetDepartmentState,
        clearCache
    };

})();

// 註冊到全域
window.__OrganizationRolesStateModule = OrganizationRolesStateModule;