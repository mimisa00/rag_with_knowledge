/**
 * 知識庫管理頁面初始化
 * 專門處理 knowledge-base.html 頁面的初始化和全域函數綁定
 */
(function() {
    'use strict';

    // 主要初始化函數
    function initKnowledgeBasePage() {
        console.log('初始化知識庫管理頁面...');

        // AdminUI 已經不再需要，因為功能已整合到 KnowledgeBaseModule
        // 保留這個註釋以說明架構變更

        // 初始化知識庫管理模組
        if (window.KnowledgeBaseModule) {
            console.log('初始化知識庫管理模組...');
            window.KnowledgeBaseModule.init();
        } else {
            console.error('KnowledgeBaseModule 未載入');
        }

        // 初始化索引管理模組
        if (window.IndexModule) {
            console.log('初始化索引管理模組...');
            window.IndexModule.init();
        } else {
            console.error('IndexModule 未載入');
        }

        // 綁定全域函數以支援內嵌的 onclick
        bindGlobalFunctions();

        // 獲取並更新用戶資訊
        fetchUserInfo();

        // 顯示載入指示器（頁面載入時）
        const loaderOverlay = document.getElementById('loader-overlay');
        if (loaderOverlay) {
            loaderOverlay.classList.add('show');
            
            // 隱藏載入指示器
            setTimeout(() => {
                loaderOverlay.classList.remove('show');
            }, 500);
        }

        console.log('知識庫管理頁面初始化完成');
    }

    // 綁定全域函數
    function bindGlobalFunctions() {
        // 知識庫管理相關
        if (window.KnowledgeBaseModule) {
            window.validateCurrentKBIndex = () => window.KnowledgeBaseModule.validateCurrentKBIndex();
            window.showCurrentKBIndex = () => window.KnowledgeBaseModule.showCurrentKBIndex();
        }

        // 索引管理相關 - 檔案上傳功能
        if (window.IndexModule) {
            window.selectFiles = () => window.IndexModule.selectFiles();
            window.clearSelectedFiles = () => window.IndexModule.clearSelectedFiles();
            window.startUpload = () => window.IndexModule.startUpload();
            window.closeUploadModal = () => window.IndexModule.closeUploadModal();
            window.toggleSelectAllFiles = () => window.IndexModule.toggleSelectAllFiles();
            
            // 檔案刪除功能
            window.removeSelectedFiles = () => window.IndexModule.removeSelectedFiles();
            window.closeRemoveFileModal = () => window.IndexModule.closeRemoveFileModal();
            window.confirmRemoveFiles = () => window.IndexModule.confirmRemoveFiles();
            window.toggleSelectAllUploadedFiles = () => window.IndexModule.toggleSelectAllUploadedFiles();
            
            // 索引建立功能
            window.closeBuildIndexModal = () => window.IndexModule.closeBuildIndexModal();
            window.confirmBuildIndex = () => window.IndexModule.confirmBuildIndex();
            window.showIndexSummary100 = () => window.IndexModule.showIndexSummary100();
        }

        // 返回管理首頁功能
        window.returnToAdmin = function() {
            window.location.href = '/admin';
        };
    }

    // 獲取用戶資訊
    async function fetchUserInfo() {
        try {
            const response = await fetch('/api/user/current-user');
            if (response.ok) {
                const userData = await response.json();
                
                // 更新頁面上的用戶資訊
                const usernameElement = document.getElementById('username');
                const userRoleElement = document.getElementById('userRole');
                
                if (usernameElement) {
                    usernameElement.textContent = userData.username || '未登入';
                }
                if (userRoleElement) {
                    userRoleElement.textContent = userData.role === 'admin' ? '系統管理員' : '組織管理員';
                }
                
                // 儲存到 localStorage 供其他模組使用
                localStorage.setItem('user_data', JSON.stringify(userData));
            } else {
                console.error('無法獲取用戶資訊');
                const usernameElement = document.getElementById('username');
                const userRoleElement = document.getElementById('userRole');
                
                if (usernameElement) {
                    usernameElement.textContent = '未登入';
                }
                if (userRoleElement) {
                    userRoleElement.textContent = '';
                }
            }
        } catch (error) {
            console.error('獲取用戶資訊失敗:', error);
            const usernameElement = document.getElementById('username');
            const userRoleElement = document.getElementById('userRole');
            
            if (usernameElement) {
                usernameElement.textContent = '載入失敗';
            }
            if (userRoleElement) {
                userRoleElement.textContent = '';
            }
        }
    }

    // 當 DOM 載入完成時初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initKnowledgeBasePage);
    } else {
        // DOM 已經載入完成
        initKnowledgeBasePage();
    }

    // 導出初始化函數供外部呼叫
    window.KnowledgeBasePage = {
        init: initKnowledgeBasePage
    };
})();