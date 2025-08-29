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
                    let roleText = '';
                    switch (userData.role) {
                        case 'admin':
                            roleText = '系統管理員';
                            break;
                        case 'org_admin':
                            roleText = '組織管理員';
                            break;
                        default:
                            roleText = '一般用戶';
                    }
                    navUserRole.textContent = roleText;
                    navUserRole.style.display = 'inline-block';
                }
                
                // 儲存用戶角色資訊（保持向後相容）
                window.currentUserRole = userData.role;
                
                // 如果是管理員，添加系統管理按鈕
                if (userData.role === 'admin') {
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
            userMenuDrawer.addEventListener('click', function(e) {
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
        
        // 登出按鈕
        const logoutBtn = document.querySelector('button[onclick*="logout"]');
        if (logoutBtn) {
            logoutBtn.onclick = null;
            logoutBtn.addEventListener('click', logout);
        }
        
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
        const confirmed = window.confirm("確定要登出嗎？");
        if (confirmed) {
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
            
            // 如果推理功能被禁用，確保狀態為關閉
            if (!isEnabled) {
                featureStates.thinkResponse = false;
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

// 如果支援ES6模組，則導出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UserMenu;
}