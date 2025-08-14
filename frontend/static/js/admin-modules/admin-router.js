/**
 * 管理介面路由模組
 * 處理管理介面的頁面導航和路由控制
 */

const AdminRouter = (() => {
    
    // 路由配置
    const routes = {
        'knowledge-base': {
            title: '知識庫管理',
            url: '/admin/knowledge-base.html',
            module: 'knowledge-base-module.js',
            roles: ['admin', 'org_admin']
        },
        'index': {
            title: '索引管理',
            url: '/admin/index-management.html',
            module: 'index-module.js',
            roles: ['admin', 'org_admin']
        },
        'system-params': {
            title: '系統參數',
            url: '/admin/system-params.html',
            module: 'param-module.js',
            roles: ['admin']
        },
        'user-management': {
            title: '帳號管理',
            url: '/admin/user-management.html',
            module: 'account-module.js',
            roles: ['admin']
        }
    };
    
    /**
     * 檢查用戶是否有權限存取特定功能
     * @param {string} functionName - 功能名稱
     * @param {string} userRole - 用戶角色
     * @returns {boolean} 是否有權限
     */
    function hasPermission(functionName, userRole) {
        const route = routes[functionName];
        if (!route) return false;
        return route.roles.includes(userRole);
    }
    
    /**
     * 導航到指定功能頁面
     * @param {string} functionName - 功能名稱
     */
    async function navigateTo(functionName) {
        const route = routes[functionName];
        if (!route) {
            console.error(`未知的功能: ${functionName}`);
            return;
        }
        
        // 檢查權限
        const userRole = window.currentUserRole || 'user';
        if (!hasPermission(functionName, userRole)) {
            alert('您沒有權限存取此功能');
            return;
        }
        
        // 顯示載入指示器
        if (typeof CommonUI !== 'undefined' && CommonUI.showSpinner) {
            CommonUI.showSpinner('正在載入功能頁面...');
        }
        
        try {
            // 如果是知識庫管理，導向新的獨立頁面
            if (functionName === 'knowledge-base') {
                window.location.href = '/admin/knowledge-base';
                return;
            }
            
            // 如果是索引管理，導向知識庫管理頁面（因為已整合）
            if (functionName === 'index') {
                window.location.href = '/admin/knowledge-base';
                return;
            }
            
            // 如果是系統參數，導向新的獨立頁面
            if (functionName === 'system-params') {
                window.location.href = '/admin/system-params';
                return;
            }
            
            // 如果是帳號管理，導向新的獨立頁面
            if (functionName === 'user-management') {
                window.location.href = '/admin/user-management';
                return;
            }
            
            // 未來功能：導向獨立頁面
            // window.location.href = route.url;
            
        } catch (error) {
            console.error(`導航失敗: ${error.message}`);
            alert(`無法載入功能頁面: ${error.message}`);
        } finally {
            // 隱藏載入指示器
            if (typeof CommonUI !== 'undefined' && CommonUI.hideSpinner) {
                CommonUI.hideSpinner();
            }
        }
    }
    
    /**
     * 初始化路由
     * @param {string} userRole - 用戶角色
     */
    function init(userRole = 'user') {
        // 儲存用戶角色
        window.currentUserRole = userRole;
        
        // 根據角色過濾可見的功能卡片
        const functionCards = document.querySelectorAll('.function-card');
        functionCards.forEach(card => {
            const functionName = card.dataset.function;
            const allowedRoles = card.dataset.roles ? card.dataset.roles.split(',') : [];
            
            if (!allowedRoles.includes(userRole)) {
                card.classList.add('hidden');
            }
        });
        
        console.log('管理路由初始化完成');
    }
    
    /**
     * 獲取所有路由
     */
    function getRoutes() {
        return routes;
    }
    
    /**
     * 檢查路由是否存在
     * @param {string} functionName - 功能名稱
     * @returns {boolean} 是否存在
     */
    function routeExists(functionName) {
        return !!routes[functionName];
    }
    
    // 公開 API
    return {
        init,
        navigateTo,
        hasPermission,
        getRoutes,
        routeExists
    };
})();

// 導出到全域
window.AdminRouter = AdminRouter;