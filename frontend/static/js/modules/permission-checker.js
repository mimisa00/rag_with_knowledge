/**
 * 前端權限檢查模組
 * 用於控制頁面元素的顯示/隱藏和功能啟用/禁用
 */
const PermissionChecker = (function() {
    'use strict';
    
    // 用戶權限緩存
    let userPermissions = [];
    let permissionGroups = [];
    let isLoaded = false;
    
    /**
     * 初始化權限檢查器
     */
    async function init() {
        console.log('初始化權限檢查器...');
        
        try {
            // 載入用戶權限
            await loadUserPermissions();
            
            // 應用權限到頁面元素
            applyPermissions();
            
            // 監聽 DOM 變化，自動應用權限
            observeDOMChanges();
            
            console.log('權限檢查器初始化完成');
        } catch (error) {
            console.error('權限檢查器初始化失敗:', error);
        }
    }
    
    /**
     * 載入當前用戶的權限
     */
    async function loadUserPermissions() {
        try {
            const response = await fetch('/api/user/permissions', {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to load permissions: ${response.status}`);
            }
            
            const data = await response.json();
            userPermissions = data.permissions || [];
            permissionGroups = data.groups || [];
            isLoaded = true;
            
            console.log('已載入權限:', userPermissions.length, '個');
            
        } catch (error) {
            console.error('載入權限失敗:', error);
            // 如果載入失敗，假設用戶沒有任何權限
            userPermissions = [];
            permissionGroups = [];
            isLoaded = true;
        }
    }
    
    /**
     * 檢查用戶是否有指定權限
     * @param {string} permissionCode - 權限代碼 (如 "USER.LOGIN")
     * @returns {boolean}
     */
    function hasPermission(permissionCode) {
        if (!isLoaded) {
            console.warn('權限尚未載入完成');
            return false;
        }
        
        // 檢查是否為管理員（管理員有所有權限）
        const currentUser = getCurrentUser();
        if (currentUser && currentUser.role === 'admin') {
            return true;
        }
        
        // 檢查權限列表
        return userPermissions.includes(permissionCode);
    }
    
    /**
     * 檢查用戶是否有指定權限群組
     * @param {string} groupCode - 權限群組代碼
     * @returns {boolean}
     */
    function hasPermissionGroup(groupCode) {
        if (!isLoaded) {
            console.warn('權限尚未載入完成');
            return false;
        }
        
        // 檢查是否為管理員
        const currentUser = getCurrentUser();
        if (currentUser && currentUser.role === 'admin') {
            return true;
        }
        
        // 檢查權限群組
        return permissionGroups.some(group => group.code === groupCode);
    }
    
    /**
     * 應用權限到頁面元素
     */
    function applyPermissions() {
        // 處理有 data-permission 屬性的元素
        const permissionElements = document.querySelectorAll('[data-permission]');
        permissionElements.forEach(element => {
            const permission = element.getAttribute('data-permission');
            
            if (permission) {
                if (hasPermission(permission)) {
                    // 有權限，顯示元素
                    element.style.display = '';
                    element.removeAttribute('disabled');
                } else {
                    // 無權限，隱藏或禁用元素
                    if (element.tagName === 'BUTTON' || element.tagName === 'INPUT') {
                        element.setAttribute('disabled', 'disabled');
                        element.style.opacity = '0.5';
                        element.title = `需要 ${permission} 權限`;
                    } else {
                        element.style.display = 'none';
                    }
                }
            }
        });
        
        // 處理有 data-permission-group 屬性的元素
        const groupElements = document.querySelectorAll('[data-permission-group]');
        groupElements.forEach(element => {
            const group = element.getAttribute('data-permission-group');
            
            if (group) {
                if (hasPermissionGroup(group)) {
                    element.style.display = '';
                    element.removeAttribute('disabled');
                } else {
                    if (element.tagName === 'BUTTON' || element.tagName === 'INPUT') {
                        element.setAttribute('disabled', 'disabled');
                        element.style.opacity = '0.5';
                        element.title = `需要 ${group} 權限群組`;
                    } else {
                        element.style.display = 'none';
                    }
                }
            }
        });
        
        // 處理有 data-permission-any 屬性的元素（任一權限即可）
        const anyPermissionElements = document.querySelectorAll('[data-permission-any]');
        anyPermissionElements.forEach(element => {
            const permissions = element.getAttribute('data-permission-any').split(',').map(p => p.trim());
            
            const hasAnyPermission = permissions.some(p => hasPermission(p));
            
            if (hasAnyPermission) {
                element.style.display = '';
                element.removeAttribute('disabled');
            } else {
                if (element.tagName === 'BUTTON' || element.tagName === 'INPUT') {
                    element.setAttribute('disabled', 'disabled');
                    element.style.opacity = '0.5';
                    element.title = `需要以下任一權限: ${permissions.join(', ')}`;
                } else {
                    element.style.display = 'none';
                }
            }
        });
        
        // 處理有 data-permission-all 屬性的元素（需要所有權限）
        const allPermissionElements = document.querySelectorAll('[data-permission-all]');
        allPermissionElements.forEach(element => {
            const permissions = element.getAttribute('data-permission-all').split(',').map(p => p.trim());
            
            const hasAllPermissions = permissions.every(p => hasPermission(p));
            
            if (hasAllPermissions) {
                element.style.display = '';
                element.removeAttribute('disabled');
            } else {
                if (element.tagName === 'BUTTON' || element.tagName === 'INPUT') {
                    element.setAttribute('disabled', 'disabled');
                    element.style.opacity = '0.5';
                    element.title = `需要所有權限: ${permissions.join(', ')}`;
                } else {
                    element.style.display = 'none';
                }
            }
        });
    }
    
    /**
     * 監聽 DOM 變化，自動應用權限
     */
    function observeDOMChanges() {
        const observer = new MutationObserver((mutations) => {
            // 檢查是否有新增的需要權限檢查的元素
            let needReapply = false;
            
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) { // Element node
                        if (node.hasAttribute('data-permission') || 
                            node.hasAttribute('data-permission-group') ||
                            node.hasAttribute('data-permission-any') ||
                            node.hasAttribute('data-permission-all') ||
                            node.querySelector('[data-permission], [data-permission-group], [data-permission-any], [data-permission-all]')) {
                            needReapply = true;
                        }
                    }
                });
            });
            
            if (needReapply) {
                applyPermissions();
            }
        });
        
        // 開始監聽
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    /**
     * 取得當前用戶資訊
     */
    function getCurrentUser() {
        // 嘗試從 sessionStorage 或其他地方取得用戶資訊
        const userStr = sessionStorage.getItem('currentUser');
        if (userStr) {
            try {
                return JSON.parse(userStr);
            } catch (e) {
                console.error('解析用戶資訊失敗:', e);
            }
        }
        
        // 如果有全域的 currentUser 變數
        if (window.currentUser) {
            return window.currentUser;
        }
        
        return null;
    }
    
    /**
     * 重新載入權限
     */
    async function reload() {
        isLoaded = false;
        await loadUserPermissions();
        applyPermissions();
    }
    
    /**
     * 檢查 API 調用權限
     * @param {string} apiPath - API 路徑
     * @param {string} method - HTTP 方法
     * @returns {boolean}
     */
    function checkAPIPermission(apiPath, method = 'GET') {
        // 這個功能需要後端提供 API 權限映射
        // 目前先返回 true，之後可以擴展
        return true;
    }
    
    // 公開 API
    return {
        init,
        hasPermission,
        hasPermissionGroup,
        reload,
        applyPermissions,
        checkAPIPermission,
        get permissions() { return [...userPermissions]; },
        get groups() { return [...permissionGroups]; },
        get isLoaded() { return isLoaded; }
    };
})();

// 自動初始化
document.addEventListener('DOMContentLoaded', function() {
    // 檢查是否已登入
    if (document.cookie.includes('access_token')) {
        PermissionChecker.init();
    }
});

// 導出到全域
window.PermissionChecker = PermissionChecker;
window.hasPermission = PermissionChecker.hasPermission;
window.hasPermissionGroup = PermissionChecker.hasPermissionGroup;