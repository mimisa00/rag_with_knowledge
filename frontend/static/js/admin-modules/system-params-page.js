/**
 * 系統參數管理頁面初始化腳本
 * 處理獨立頁面的初始化和用戶資訊載入
 */

(function() {
    'use strict';

    /**
     * 載入並顯示用戶資訊
     */
    async function loadUserInfo() {
        try {
            const response = await fetch('/api/user/current-user', {
                credentials: 'include'
            });
            if (!response.ok) {
                throw new Error('Failed to load user info');
            }
            
            const userInfo = await response.json();
            
            // 更新用戶名稱
            const usernameElement = document.getElementById('username');
            if (usernameElement) {
                usernameElement.textContent = userInfo.username || '未知用戶';
            }
            
            // 更新用戶角色標籤
            const userRoleElement = document.getElementById('userRole');
            if (userRoleElement) {
                let roleText = '';
                switch (userInfo.role) {
                    case 'admin':
                        roleText = '系統管理員';
                        break;
                    case 'org_admin':
                        roleText = '組織管理員';
                        break;
                    default:
                        roleText = '一般用戶';
                }
                userRoleElement.textContent = roleText;
                userRoleElement.style.display = 'inline-block';
            }
            
            console.log('用戶資訊載入成功:', userInfo.username);
        } catch (error) {
            console.error('載入用戶資訊失敗:', error);
            // 如果載入失敗，可能需要重新登入
            if (error.message.includes('401') || error.message.includes('403')) {
                alert('您的登入已過期，請重新登入');
                window.location.href = '/login';
            }
        }
    }

    /**
     * 初始化頁面
     */
    async function initPage() {
        console.log('開始初始化系統參數管理頁面...');
        
        // 顯示載入指示器
        const loaderOverlay = document.getElementById('loader-overlay');
        if (loaderOverlay) {
            loaderOverlay.classList.add('show');
        }
        
        try {
            // 載入用戶資訊
            await loadUserInfo();
            
            // 初始化 ParamModule
            if (window.ParamModule) {
                console.log('初始化 ParamModule...');
                window.ParamModule.init();
                console.log('ParamModule 初始化完成');
            } else {
                console.error('ParamModule 未載入');
            }
            
        } catch (error) {
            console.error('頁面初始化失敗:', error);
        } finally {
            // 隱藏載入指示器
            setTimeout(() => {
                if (loaderOverlay) {
                    loaderOverlay.classList.remove('show');
                }
            }, 500);
        }
    }

    // 當 DOM 載入完成後初始化頁面
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPage);
    } else {
        // DOM 已經載入完成
        initPage();
    }

    // 導出初始化函數供外部調用
    window.SystemParamsPage = {
        init: initPage,
        loadUserInfo: loadUserInfo
    };
})();