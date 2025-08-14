/**
 * 管理員主程式
 * 整合所有管理員模組
 */
(function () {
    'use strict';

    // 主要初始化函數
    function initAdminDashboard() {
        // 初始化 AdminUI 擴展
        if (window.AdminUI) {
            console.log('Initializing AdminUI...');
            window.AdminUI.init();
        } else {
            console.error('AdminUI module not loaded');
        }

        // 檢查推理功能
        if (window.CommonUI && window.CommonUI.checkThinkFeature) {
            window.CommonUI.checkThinkFeature();
        }

        // 初始化用戶選單
        if (window.UserMenu) {
            window.UserMenu.init();
        }

        // 初始化 QA 模組
        if (window.QAModule) {
            window.QAModule.init();
        }


        // 綁定全域函數以支援內嵌的 onclick
        bindGlobalFunctions();
    }

    // 綁定全域函數
    function bindGlobalFunctions() {
        // Tab 切換
        window.switchTab = function (tabId) {
            document.querySelectorAll('.tablink').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
            document.querySelector(`[onclick*="${tabId}"]`).classList.add('active');
            document.getElementById(tabId).classList.add('active');

            // 檢查推理功能
            if (window.CommonUI && window.CommonUI.checkThinkFeature) {
                window.CommonUI.checkThinkFeature();
            }

            // 處理 accountTab 特殊邏輯
            if (tabId === 'accountTab') {
                console.log('切換到帳號管理頁面');
                if (window.AccountModule) {
                    window.AccountModule.loadUsers();
                } else {
                    console.error('AccountModule 未載入，無法載入用戶列表');
                }
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

        // 帳號管理相關（已在模組中定義為全域）
        // AccountModule 的函數已經在模組中直接綁定到 window 物件
    }

    // 當 DOM 載入完成時初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAdminDashboard);
    } else {
        // DOM 已經載入完成
        initAdminDashboard();
    }
})();