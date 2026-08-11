/**
 * 用戶選單模組
 * 包含個人功能抽屜、變更密碼、登出等功能
 */

const UserMenu = (() => {

    let isInitialized = false;
    let currentUser = null;  // 儲存完整的用戶資訊
    let featureStates = {
        nounAnalysis: false,
        thinkResponse: false,
        thinkEnabled: true  // 系統是否允許推理
    };

    /**
     * 初始化用戶選單
     */
    async function init() {
        if (isInitialized) return;

        // 載入用戶資訊
        await loadUserInfo();

        // 綁定事件
        bindEvents();

        // 添加功能開關
        addFeatureToggles();

        // 檢查推理功能可用性
        await checkThinkAvailability();

        isInitialized = true;
    }

    /**
     * 根據優先順序獲取角色顯示文字
     * 優先順序：職稱 > 主要角色名稱 > 系統管理者 > 一般使用者
     * @param {Object} userData - 用戶資料
     * @returns {string} 角色顯示文字
     */
    function getRoleDisplayText(userData) {
        // 1. 職稱（最高優先）
        if (userData.title && userData.title.trim()) {
            return userData.title.trim();
        }

        // 2. 主要角色名稱
        if (userData.primary_role_name && userData.primary_role_name.trim()) {
            return userData.primary_role_name.trim();
        }

        // 3. 系統管理者（基於 role 欄位）
        if (userData.role === 'admin') {
            return '系統管理者';
        }

        // 4. 組織管理員
        if (userData.role === 'org_admin') {
            return '組織管理員';
        }

        // 5. 一般使用者（預設）
        return '一般使用者';
    }

    /**
     * 載入用戶資訊
     * @returns {Promise<Object>} 返回用戶資料物件
     */
    async function loadUserInfo() {
        try {
            const response = await fetch('/api/user/current-user');
            if (response.ok) {
                const userData = await response.json();

                // 儲存完整的用戶資訊
                currentUser = userData;

                const username = userData.username;
                const initial = username.charAt(0).toUpperCase();

                const userInitial = document.getElementById('userInitial');
                const userMenuUsername = document.getElementById('userMenuUsername');

                if (userInitial) userInitial.textContent = initial;
                if (userMenuUsername) userMenuUsername.textContent = username;

                // 更新頂部導航欄的用戶資訊（如果存在）
                const navUsername = document.getElementById('username');
                const navUserRole = document.getElementById('userRole');

                if (navUsername) {
                    navUsername.textContent = username;
                }

                if (navUserRole) {
                    // 實作優先順序顯示邏輯：職稱 > 主要角色名稱 > 系統管理者 > 一般使用者
                    let roleText = getRoleDisplayText(userData);
                    navUserRole.textContent = roleText;
                    navUserRole.style.display = 'inline-block';
                }

                // 儲存用戶角色資訊（保持向後相容）
                window.currentUserRole = userData.role;

                // 檢查是否應該顯示系統管理按鈕（透過 role 或權限群組）
                const shouldShowAdmin = await checkAdminAccess(userData);
                if (shouldShowAdmin) {
                    addAdminMenuButton();
                }

                return userData;
            }
            return null;
        } catch (error) {
            console.error('Error loading user info:', error);
            return null;
        }
    }

    /**
     * 檢查用戶是否有管理員權限
     * @param {Object} userData - 用戶資料
     * @returns {Promise<boolean>} 是否有管理員權限
     */
    async function checkAdminAccess(userData) {
        // 方式1: 檢查 role 是否為 admin（向後相容）
        if (userData && userData.role === 'admin') {
            return true;
        }

        // 方式2: 檢查是否有 ADMIN.ACCESS 權限（透過權限群組）
        // 優先使用已載入的 PermissionChecker
        if (window.hasPermission && window.hasPermission('ADMIN.ACCESS')) {
            return true;
        }

        // 方式3: 如果 PermissionChecker 尚未載入，直接呼叫 API 檢查
        try {
            const response = await fetch('/api/user/permissions');
            if (response.ok) {
                const data = await response.json();
                if (data.permissions && data.permissions.includes('ADMIN.ACCESS')) {
                    return true;
                }
            }
        } catch (error) {
            console.error('Error checking admin access:', error);
        }

        return false;
    }

    /**
     * 添加管理員選單按鈕
     */
    function addAdminMenuButton() {
        const menuContent = document.querySelector('.user-menu-content');
        if (!menuContent) return;

        // 檢查是否已經存在管理按鈕
        if (document.querySelector('.admin-menu-item')) return;

        // 找到第一個 hr 元素
        const firstHr = menuContent.querySelector('hr');

        // 創建系統管理按鈕
        const adminButton = document.createElement('button');
        adminButton.className = 'menu-item admin-menu-item';
        adminButton.onclick = () => navigateToAdmin();
        adminButton.innerHTML = `
            <i class="fa-solid fa-cogs"></i>
            <span>系統管理</span>
        `;

        // 在第一個 hr 之前插入按鈕
        if (firstHr) {
            menuContent.insertBefore(adminButton, firstHr);
        } else {
            // 如果沒有 hr，則添加到變更密碼按鈕之後
            const changePasswordBtn = menuContent.querySelector('button[onclick*="showChangePasswordModal"]');
            if (changePasswordBtn) {
                changePasswordBtn.parentNode.insertBefore(adminButton, changePasswordBtn.nextSibling);
            }
        }
    }

    /**
     * 導航到管理介面
     */
    function navigateToAdmin() {
        window.location.href = '/admin';
    }

    /**
     * 綁定事件處理器
     */
    function bindEvents() {
        // 用戶選單按鈕 - 已經在 HTML 中使用 onclick 屬性，不需要再綁定
        // const userMenuBtn = document.getElementById('userMenuBtn');
        // if (userMenuBtn) {
        //     userMenuBtn.addEventListener('click', openUserMenu);
        // }

        // 用戶選單抽屜
        const userMenuDrawer = document.getElementById('userMenuDrawer');
        if (userMenuDrawer) {
            // 點擊抽屜外部關閉
            userMenuDrawer.addEventListener('click', function (e) {
                if (e.target === userMenuDrawer) {
                    closeUserMenu();
                }
            });

            // 滑鼠離開關閉
            userMenuDrawer.addEventListener('mouseleave', closeUserMenu);
        }

        // 變更密碼按鈕
        const changePasswordBtn = document.querySelector('button[onclick*="showChangePasswordModal"]');
        if (changePasswordBtn) {
            changePasswordBtn.onclick = null;
            changePasswordBtn.addEventListener('click', showChangePasswordModal);
        }

        // 登出按鈕 - 不重新綁定，讓 HTML onclick 直接工作
        // const logoutBtn = document.querySelector('button[onclick*="logout"]');
        // if (logoutBtn) {
        //     logoutBtn.onclick = null;
        //     logoutBtn.addEventListener('click', logout);
        // }

        // 變更密碼Modal按鈕
        const confirmChangeBtn = document.querySelector('button[onclick*="changePassword"]');
        if (confirmChangeBtn) {
            confirmChangeBtn.onclick = null;
            confirmChangeBtn.addEventListener('click', changePassword);
        }

        const cancelChangeBtn = document.querySelector('button[onclick*="closeChangePasswordModal"]');
        if (cancelChangeBtn) {
            cancelChangeBtn.onclick = null;
            cancelChangeBtn.addEventListener('click', closeChangePasswordModal);
        }
    }

    /**
     * 開啟用戶選單
     */
    function openUserMenu() {
        const drawer = document.getElementById('userMenuDrawer');
        if (drawer) {
            drawer.classList.add('open');
        }
    }

    /**
     * 關閉用戶選單
     */
    function closeUserMenu() {
        const drawer = document.getElementById('userMenuDrawer');
        if (drawer) {
            drawer.classList.remove('open');
        }
    }

    /**
     * 顯示變更密碼模態框
     */
    function showChangePasswordModal() {
        const modal = document.getElementById('changePasswordModal');
        if (modal) {
            modal.classList.add('show');
            // 清空表單
            clearPasswordForm();
        }
    }

    /**
     * 關閉變更密碼模態框
     */
    function closeChangePasswordModal() {
        const modal = document.getElementById('changePasswordModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    /**
     * 清空密碼表單
     */
    function clearPasswordForm() {
        const fields = ['oldPassword', 'newPassword', 'confirmNewPassword'];
        fields.forEach(id => {
            const field = document.getElementById(id);
            if (field) field.value = '';
        });
    }

    /**
     * 變更密碼
     */
    async function changePassword() {
        const oldPassword = document.getElementById('oldPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmNewPassword = document.getElementById('confirmNewPassword').value;

        // 驗證輸入
        if (!oldPassword || !newPassword || !confirmNewPassword) {
            alert('請填寫所有欄位！');
            return;
        }

        if (newPassword !== confirmNewPassword) {
            alert('新密碼與確認密碼不一致！');
            return;
        }

        if (newPassword.length < 6) {
            alert('新密碼長度至少需要6個字符！');
            return;
        }

        try {
            const response = await fetch('/api/user/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    old_password: oldPassword,
                    new_password: newPassword
                })
            });

            if (response.ok) {
                alert('密碼變更成功！');
                closeChangePasswordModal();
            } else {
                const errorData = await response.json();
                alert(`密碼變更失敗：${errorData.detail || '未知錯誤'}`);
            }
        } catch (error) {
            alert(`密碼變更失敗：${error.message}`);
        }
    }

    /**
     * 登出
     */
    function logout() {
        console.log('logout 函數被呼叫');
        console.log('Dialog 類型:', typeof window.Dialog);

        // 檢查 Dialog 是否可用
        if (typeof window.Dialog === 'undefined') {
            console.error('Dialog 元件尚未載入，使用原生確認對話框');
            // 回到原生確認對話框作為後備方案
            const confirmed = window.confirm("確定要登出嗎？");
            if (!confirmed) {
                console.log('用戶取消登出');
                return;
            }
        } else {
            console.log('使用 Dialog.confirm');
            // 使用通用 Dialog
            Dialog.confirm("確定要登出嗎？", () => {
                console.log('用戶確認登出');
                performLogout();
            }, {
                title: '確認登出',
                confirmText: '登出',
                cancelText: '取消'
            });
            return;
        }

        // 執行登出邏輯
        console.log('執行登出邏輯');
        performLogout();
    }

    /**
     * 執行登出邏輯
     */
    function performLogout() {
        // 清除本地存儲的用戶信息
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_info');
        sessionStorage.clear();

        fetch('/api/user/logout', {
            method: 'GET',
            credentials: 'same-origin'
        }).then(response => {
            if (response.redirected) {
                // 使用 replace 而不是 href，避免返回按鈕問題
                window.location.replace(response.url);
            }
        });
    }

    /**
     * 添加功能開關到選單
     */
    function addFeatureToggles() {
        const menuContent = document.querySelector('.user-menu-content');
        if (!menuContent) return;

        // 找到變更密碼按鈕
        const changePasswordBtn = menuContent.querySelector('button[onclick*="showChangePasswordModal"], button[onclick*="UserMenu.showChangePasswordModal"]');
        if (!changePasswordBtn) return;

        // 創建功能開關容器
        const toggleContainer = document.createElement('div');
        toggleContainer.className = 'feature-toggles-container';
        toggleContainer.innerHTML = `
            <div class="menu-item feature-toggle" id="nounAnalysisToggle">
                <i class="fa-solid fa-brain"></i>
                <span>名詞分析</span>
                <i class="toggle-icon fa-solid fa-toggle-off"></i>
            </div>
            <div class="menu-item feature-toggle" id="thinkToggleMenuItem">
                <i class="fa-solid fa-lightbulb"></i>
                <span>推理功能</span>
                <i class="toggle-icon fa-solid fa-toggle-off"></i>
            </div>
        `;

        // 插入到變更密碼按鈕之後
        changePasswordBtn.parentNode.insertBefore(toggleContainer, changePasswordBtn.nextSibling);

        // 綁定點擊事件
        const nounToggle = document.getElementById('nounAnalysisToggle');
        const thinkToggle = document.getElementById('thinkToggleMenuItem');

        if (nounToggle) {
            nounToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleNounAnalysis();
            });
        }

        if (thinkToggle) {
            thinkToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleThinkResponse();
            });
        }
    }

    /**
     * 切換名詞分析功能
     */
    function toggleNounAnalysis() {
        featureStates.nounAnalysis = !featureStates.nounAnalysis;
        updateToggleUI('nounAnalysisToggle', featureStates.nounAnalysis);

        // 通知 QAModule 更新狀態
        if (window.QAModule && window.QAModule.toggleNounAnalysis) {
            window.QAModule.toggleNounAnalysis();
        }
    }

    /**
     * 切換推理功能
     */
    function toggleThinkResponse() {
        if (!featureStates.thinkEnabled) return;

        featureStates.thinkResponse = !featureStates.thinkResponse;
        updateToggleUI('thinkToggleMenuItem', featureStates.thinkResponse);

        // 通知 QAModule 更新狀態
        if (window.QAModule && window.QAModule.toggleThinkResponse) {
            window.QAModule.toggleThinkResponse();
        }
    }

    /**
     * 更新開關 UI
     */
    function updateToggleUI(toggleId, isEnabled) {
        const toggle = document.getElementById(toggleId);
        if (!toggle) return;

        const icon = toggle.querySelector('.toggle-icon');
        if (icon) {
            if (isEnabled) {
                icon.classList.remove('fa-toggle-off');
                icon.classList.add('fa-toggle-on');
            } else {
                icon.classList.remove('fa-toggle-on');
                icon.classList.add('fa-toggle-off');
            }
        }
    }

    /**
     * 檢查推理功能可用性
     */
    async function checkThinkAvailability() {
        try {
            const res = await fetch('/api/user/is/enable/think');
            const isEnabled = await res.json();
            featureStates.thinkEnabled = isEnabled;

            // 更新 UI 顯示
            const thinkToggle = document.getElementById('thinkToggleMenuItem');
            if (thinkToggle) {
                thinkToggle.style.display = isEnabled ? 'flex' : 'none';
            }

            featureStates.thinkResponse = isEnabled;

            // 同步 toggle 圖示到初始狀態
            updateToggleUI('thinkToggleMenuItem', featureStates.thinkResponse);

            // 同步 QAModule 的 enableThink 變數與 UI
            if (window.QAModule && window.QAModule.syncWithUserMenu) {
                window.QAModule.syncWithUserMenu();
            }
        } catch (error) {
            console.error('檢查推理功能狀態失敗:', error);
        }
    }

    /**
     * 獲取當前用戶資訊
     * @returns {Object|null} 返回當前用戶資料或 null
     */
    function getCurrentUser() {
        return currentUser;
    }

    /**
     * 獲取功能狀態
     * @returns {Object} 返回功能狀態物件
     */
    function getFeatureStates() {
        return featureStates;
    }

    // 公開API
    return {
        init,
        loadUserInfo,
        getCurrentUser,
        getFeatureStates,
        openUserMenu,
        closeUserMenu,
        showChangePasswordModal,
        closeChangePasswordModal,
        changePassword,
        logout,
        checkThinkAvailability,
        toggleNounAnalysis,
        toggleThinkResponse
    };
})();

// 導出到全域
window.UserMenu = UserMenu;

// 將常用方法直接綁定到全域，方便 HTML onclick 事件調用
window.openUserMenu = UserMenu.openUserMenu;
window.closeUserMenu = UserMenu.closeUserMenu;
window.showChangePasswordModal = UserMenu.showChangePasswordModal;
window.closeChangePasswordModal = UserMenu.closeChangePasswordModal;
window.changePassword = UserMenu.changePassword;
window.logout = UserMenu.logout;

// 確保 logout 函數立即可用
console.log('UserMenu logout 函數已綁定到全域:', typeof window.logout);
console.log('Dialog 物件狀態:', typeof window.Dialog);

// 測試函數
window.testLogout = function () {
    console.log('測試 logout 函數...');
    if (typeof window.logout === 'function') {
        console.log('呼叫 logout()');
        window.logout();
    } else {
        console.error('logout 函數不存在');
    }
};

// 如果支援ES6模組，則導出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UserMenu;
}