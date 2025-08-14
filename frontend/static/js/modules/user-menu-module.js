/**
 * 用戶選單模組
 * 包含個人功能抽屜、變更密碼、登出等功能
 */

const UserMenu = (() => {
    
    let isInitialized = false;
    
    /**
     * 初始化用戶選單
     */
    async function init() {
        if (isInitialized) return;
        
        // 載入用戶資訊
        await loadUserInfo();
        
        // 綁定事件
        bindEvents();
        
        isInitialized = true;
    }
    
    /**
     * 載入用戶資訊
     */
    async function loadUserInfo() {
        try {
            const response = await fetch('/api/user/current-user');
            if (response.ok) {
                const userData = await response.json();
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
                
                // 儲存用戶角色資訊
                window.currentUserRole = userData.role;
                
                // 如果是管理員，添加系統管理按鈕
                if (userData.role === 'admin') {
                    addAdminMenuButton();
                }
            }
        } catch (error) {
            console.error('Error loading user info:', error);
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
    
    // 公開API
    return {
        init,
        loadUserInfo,
        openUserMenu,
        closeUserMenu,
        showChangePasswordModal,
        closeChangePasswordModal,
        changePassword,
        logout
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