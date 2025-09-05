/**
 * 管理介面主控制模組
 * 負責管理首頁的初始化和功能控制
 */

const AdminDashboard = (() => {
    
    let currentUser = null;
    let isInitialized = false;
    
    /**
     * 初始化管理介面
     */
    async function init() {
        if (isInitialized) return;
        
        try {
            // 等待 UserMenu 初始化完成並獲取用戶資訊
            if (window.UserMenu && !window.UserMenu.getCurrentUser()) {
                await window.UserMenu.loadUserInfo();
            }
            currentUser = window.UserMenu.getCurrentUser();
            
            // 檢查管理員權限（只在有功能卡片的頁面檢查）
            const functionGrid = document.getElementById('functionGrid');
            if (functionGrid && (!currentUser || currentUser.role !== 'admin')) {
                throw new Error('需要管理員權限');
            }
            
            // 初始化路由（如果存在）
            if (typeof AdminRouter !== 'undefined') {
                AdminRouter.init(currentUser.role);
            }
            
            // 初始化其他模組（for dashboard_admin.html）
            if (window.AdminUI) {
                window.AdminUI.init();
            }
            
            // 初始化 QA 模組
            if (window.QAModule) {
                window.QAModule.init();
            }
            
            // 綁定事件
            bindEvents();
            
            // 隱藏載入指示器
            hideLoader();
            
            isInitialized = true;
            
        } catch (error) {
            console.error('管理介面初始化失敗:', error);
            handleInitError(error);
        }
    }
    
    
    /**
     * 綁定事件處理器
     */
    function bindEvents() {
        // 替換全域的導航函數
        window.navigateToFunction = (functionName) => {
            if (typeof AdminRouter !== 'undefined') {
                AdminRouter.navigateTo(functionName);
            } else {
                console.error('AdminRouter 未載入');
            }
        };
        
        // 返回問答頁面
        window.returnToDashboard = () => {
            window.location.href = '/dashboard';
        };
        
        // 為功能卡片添加鍵盤支援
        const cards = document.querySelectorAll('.function-card:not(.disabled)');
        cards.forEach(card => {
            card.setAttribute('tabindex', '0');
            card.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    const btn = card.querySelector('.btn-enter');
                    if (btn && !btn.disabled) {
                        btn.click();
                    }
                }
            });
        });
        
        // 支援 dashboard_admin.html 的全域函數
        
        // Tab 切換
        window.switchTab = function(tabId) {
            document.querySelectorAll('.tablink').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
            const activeBtn = document.querySelector(`[onclick*="${tabId}"]`);
            if (activeBtn) activeBtn.classList.add('active');
            const activeTab = document.getElementById(tabId);
            if (activeTab) activeTab.classList.add('active');
            
            // 檢查推理功能
            if (window.CommonUI && window.CommonUI.checkThinkFeature) {
                window.CommonUI.checkThinkFeature();
            }
            
            // 處理 accountTab 特殊邏輯
            if (tabId === 'accountTab' && window.AccountModule) {
                window.AccountModule.loadUsers();
            }
        };
        
        // QA 模組相關
        if (window.QAModule) {
            window.toggleDrawer = () => window.QAModule.toggleDrawer();
            window.showDrawerContent = (id) => window.QAModule.showDrawerContent(id);
            window.createNewConversation = () => window.QAModule.createNewConversation();
            window.switchConversation = (id) => window.QAModule.switchConversation(id);
            window.deleteConversation = (id) => window.QAModule.deleteConversation(id);
            window.toggleThinkResponse = () => window.QAModule.toggleThinkResponse();
            window.toggleNounAnalysis = () => window.QAModule.toggleNounAnalysis();
            window.sendQuestion = () => window.QAModule.sendQuestion();
            window.setButtonLoading = (isLoading) => window.QAModule.setButtonLoading(isLoading);
        }
        
        // 用戶選單相關
        if (window.UserMenu) {
            window.openUserMenu = () => window.UserMenu.openUserMenu();
            window.closeUserMenu = () => window.UserMenu.closeUserMenu();
            window.showChangePasswordModal = () => window.UserMenu.showChangePasswordModal();
            window.closeChangePasswordModal = () => window.UserMenu.closeChangePasswordModal();
            window.changePassword = () => window.UserMenu.changePassword();
            window.logout = () => window.UserMenu.logout();
        }
        
        // 參數設定相關
        if (window.ParamModule) {
            window.updateConfig = () => window.ParamModule.updateConfig();
        }
    }
    
    /**
     * 隱藏載入指示器
     */
    function hideLoader() {
        const loader = document.getElementById('loader-overlay');
        if (loader) {
            loader.classList.add('hidden');
            setTimeout(() => {
                loader.style.display = 'none';
            }, 300);
        }
    }
    
    /**
     * 顯示載入指示器
     */
    function showLoader(message = '載入中...') {
        const loader = document.getElementById('loader-overlay');
        if (loader) {
            const loaderText = loader.querySelector('.loader-text');
            if (loaderText) {
                loaderText.textContent = message;
            }
            loader.style.display = 'flex';
            loader.classList.remove('hidden');
        }
    }
    
    /**
     * 處理初始化錯誤
     * @param {Error} error - 錯誤物件
     */
    function handleInitError(error) {
        hideLoader();
        
        if (error.message.includes('權限')) {
            Dialog.error('您沒有權限存取管理介面');
            window.location.href = '/dashboard';
        } else if (error.message.includes('登入')) {
            Dialog.warning('請先登入');
            window.location.href = '/login';
        } else {
            Dialog.error(`系統錯誤: ${error.message}`);
        }
    }
    
    /**
     * 獲取當前用戶
     */
    function getCurrentUser() {
        return currentUser;
    }
    
    /**
     * 刷新頁面
     */
    function refresh() {
        window.location.reload();
    }
    
    // 公開 API
    return {
        init,
        getCurrentUser,
        showLoader,
        hideLoader,
        refresh
    };
})();

// 導出到全域
window.AdminDashboard = AdminDashboard;

// 頁面載入完成後初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        AdminDashboard.init();
    });
} else {
    AdminDashboard.init();
}