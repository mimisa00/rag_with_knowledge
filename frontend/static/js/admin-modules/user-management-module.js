/**
 * 帳號管理模組
 * 處理用戶帳號管理功能
 */
(function() {
    'use strict';

    // 帳號管理相關變數
    let allUsers = [];
    let userPageSize = 10;
    let userPage = 1;
    const userPageSizes = [10, 50, 100, 200];

    // 公開 API
    const AccountModule = {
        // 初始化
        init: function() {
            this.bindEvents();
        },

        // 載入用戶列表
        loadUsers: async function() {
            const accountManagerContainer = document.getElementById('accountManagerContainer');
            
            // 檢查容器是否存在，如果不存在則跳過（新架構可能不需要此功能）
            if (!accountManagerContainer) {
                console.warn('accountManagerContainer 不存在，跳過 loadUsers - 可能使用新的頁面架構');
                return;
            }
            
            if (window.CommonUI) {
                window.CommonUI.showSpinner('載入帳號資料...');
            }
            try {
                const res = await fetch('/api/admin/users');
                if (!res.ok) throw new Error('權限不足或伺服器錯誤');
                allUsers = await res.json();
                userPage = 1;
                this.renderUserTable();
            } catch (e) {
                accountManagerContainer.innerHTML = `<div style='color:red;font-weight:bold;'>無權限存取帳號管理功能，僅限管理員</div>`;
            } finally {
                if (window.CommonUI) {
                    window.CommonUI.stopSpinner();
                }
            }
        },

        // 渲染用戶表格
        renderUserTable: function() {
            const accountManagerContainer = document.getElementById('accountManagerContainer');
            
            // 檢查容器是否存在
            if (!accountManagerContainer) {
                console.warn('accountManagerContainer 不存在，跳過 renderUserTable');
                return;
            }
            
            if (!Array.isArray(allUsers) || allUsers.length === 0) {
                accountManagerContainer.innerHTML = '<div>查無帳號資料</div>';
                return;
            }
            
            // 分頁
            const startIdx = (userPage - 1) * userPageSize;
            const endIdx = Math.min(startIdx + userPageSize, allUsers.length);
            const pageUsers = allUsers.slice(startIdx, endIdx);

            let html = `<h3>帳號管理</h3>`;
            html += `<table style="width:100%;border-collapse:collapse;margin-bottom:1em;">
            <thead>
              <tr style="background:#f0f0f0;">
                <th style="padding:8px;border:1px solid #ccc;">ID</th>
                <th style="padding:8px;border:1px solid #ccc;">帳號</th>
                <th style="padding:8px;border:1px solid #ccc;">暱稱</th>
                <th style="padding:8px;border:1px solid #ccc;">角色</th>
                <th style="padding:8px;border:1px solid #ccc;">狀態</th>
                <th style="padding:8px;border:1px solid #ccc;">建立時間</th>
                <th style="padding:8px;border:1px solid #ccc;">操作</th>
              </tr>
            </thead>
            <tbody>`;
            
            for (const user of pageUsers) {
                const isActive = user.is_active;
                html += `<tr>
              <td style='border:1px solid #ccc;padding:8px;'>${user.id}</td>
              <td style='border:1px solid #ccc;padding:8px;'>${user.loginid}</td>
              <td style='border:1px solid #ccc;padding:8px;'>${user.username}</td>
              <td style='border:1px solid #ccc;padding:8px;'>
                <select onchange="AccountModule.changeUserRole(${user.id}, this.value)" style="padding:4px 8px;">
                  <option value="user" ${user.role === 'user' ? 'selected' : ''}>user</option>
                  <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>admin</option>
                </select>
              </td>
              <td style='border:1px solid #ccc;padding:8px;'>
                <span style="color:${isActive ? '#27ae60' : '#e74c3c'};font-weight:bold;">${isActive ? '啟用' : '停用'}</span>
              </td>
              <td style='border:1px solid #ccc;padding:8px;'>${user.created_at ? user.created_at.replace('T', ' ').slice(0, 19) : ''}</td>
              <td style='border:1px solid #ccc;padding:8px;'>
                ${this.renderUserActionButtons(user, isActive)}
              </td>
            </tr>`;
            }
            html += `</tbody></table>`;
            
            // 分頁與顯示筆數
            html += `<div style="display:flex;align-items:center;gap:2em;margin-bottom:1em;width:100%;">
                <div style="display:flex;align-items:center;gap:0.5em;">
                    <span>顯示筆數：</span>
                    <select id="userPageSizeSelect" style="padding:4px 8px;min-width:60px;">
                      ${userPageSizes.map(size => `<option value="${size}" ${userPageSize === size ? 'selected' : ''}>${size}</option>`).join('')}
                    </select>
                </div>
                <div style="display:flex;align-items:center;gap:0.5em;">
                    <span>頁數：</span>
                    <button onclick="AccountModule.gotoUserPage(1)" ${userPage === 1 ? 'disabled' : ''}>首頁</button>
                    <button onclick="AccountModule.gotoUserPage(${userPage - 1})" ${userPage === 1 ? 'disabled' : ''}>上一頁</button>
                    <span>第 ${userPage} / ${Math.ceil(allUsers.length / userPageSize)} 頁</span>
                    <button onclick="AccountModule.gotoUserPage(${userPage + 1})" ${userPage === Math.ceil(allUsers.length / userPageSize) ? 'disabled' : ''}>下一頁</button>
                    <button onclick="AccountModule.gotoUserPage(${Math.ceil(allUsers.length / userPageSize)})" ${userPage === Math.ceil(allUsers.length / userPageSize) ? 'disabled' : ''}>末頁</button>
                </div>
            </div>`;
            
            accountManagerContainer.innerHTML = html;
            
            // 插入管理員變更密碼 modal（如尚未存在）
            if (!document.getElementById('adminChangePasswordModal')) {
                const modalHtml = `
                <div id="adminChangePasswordModal" class="modal">
                  <div class="modal-content">
                    <div class="modal-header">
                      <h3>管理員變更密碼</h3>
                      <i class="fa-solid fa-key"></i>
                    </div>
                    <form id="adminChangePasswordForm" onsubmit="return AccountModule.adminChangePasswordSubmit(event)">
                      <div class="modal-body">
                        <div class="form-group">
                          <label id="adminChangePasswordUsernameLabel"></label>
                        </div>
                        <div class="form-group">
                          <label for="adminNewPassword">新密碼</label>
                          <input type="password" id="adminNewPassword" required minlength="6">
                        </div>
                        <div class="form-group">
                          <label for="adminConfirmNewPassword">確認新密碼</label>
                          <input type="password" id="adminConfirmNewPassword" required minlength="6">
                        </div>
                      </div>
                      <div class="modal-footer">
                        <button type="button" onclick="AccountModule.closeAdminChangePasswordModal()" class="btn-secondary">取消</button>
                        <button type="submit" class="btn-primary">確認變更</button>
                      </div>
                    </form>
                  </div>
                </div>
              `;
                document.body.insertAdjacentHTML('beforeend', modalHtml);
            }
            
            document.getElementById('userPageSizeSelect').onchange = function() {
                userPageSize = parseInt(this.value);
                userPage = 1;
                AccountModule.renderUserTable();
            };
        },

        // 跳轉到指定頁面
        gotoUserPage: function(page) {
            userPage = page;
            this.renderUserTable();
        },

        // 啟用用戶
        activateUser: async function(userId) {
            const confirmed = await Dialog.confirm('確定要啟用此帳號？');
            if (!confirmed) return;
            
            if (window.CommonUI) {
                window.CommonUI.showSpinner('啟用帳號...');
            }
            try {
                const res = await fetch(`/api/admin/users/${userId}/activate`, { method: 'PUT' });
                if (!res.ok) throw new Error('啟用失敗');
                // 更新本地資料
                const idx = allUsers.findIndex(u => u.id === userId);
                if (idx !== -1) allUsers[idx].is_active = true;
                this.renderUserTable();
            } catch (e) {
                Dialog.error('帳號啟用失敗：' + e.message);
            } finally {
                if (window.CommonUI) {
                    window.CommonUI.stopSpinner();
                }
            }
        },

        // 停用用戶
        deactivateUser: async function(userId) {
            // 防止管理員停用自己的帳號（處理類型轉換）
            const currentUserId = window.currentUser ? parseInt(window.currentUser.id) : null;
            const targetUserId = parseInt(userId);
            
            if (currentUserId && targetUserId === currentUserId) {
                Dialog.warning('系統安全限制：無法停用當前登入的管理員帳號，這會導致您失去系統存取權限並被鎖在系統外面。如需停用此帳號，請聯繫其他管理員進行操作。');
                return;
            }
            
            const confirmed = await Dialog.confirm('確定要停用此帳號？');
            if (!confirmed) return;
            
            if (window.CommonUI) {
                window.CommonUI.showSpinner('停用帳號...');
            }
            try {
                const res = await fetch(`/api/admin/users/${userId}/deactivate`, { method: 'PUT' });
                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({}));
                    throw new Error(errorData.detail || '停用失敗');
                }
                // 更新本地資料
                const idx = allUsers.findIndex(u => u.id === userId);
                if (idx !== -1) allUsers[idx].is_active = false;
                this.renderUserTable();
                Dialog.success('帳號已成功停用');
            } catch (e) {
                Dialog.error('帳號停用失敗：' + e.message);
            } finally {
                if (window.CommonUI) {
                    window.CommonUI.stopSpinner();
                }
            }
        },

        // 變更用戶角色
        changeUserRole: async function(userId, newRole) {
            if (window.CommonUI) {
                window.CommonUI.showSpinner('更新角色...');
            }
            try {
                const res = await fetch(`/api/admin/users/${userId}/admin`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ role: newRole })
                });
                if (!res.ok) throw new Error('更新失敗');
                // 更新本地資料
                const idx = allUsers.findIndex(u => u.id === userId);
                if (idx !== -1) allUsers[idx].role = newRole;
                this.renderUserTable();
            } catch (e) {
                Dialog.error('角色更新失敗：' + e.message);
            } finally {
                if (window.CommonUI) {
                    window.CommonUI.stopSpinner();
                }
            }
        },

        // 開啟管理員變更密碼視窗
        openAdminChangePasswordModal: function(userId, username) {
            window._adminChangePasswordUserId = userId;
            document.getElementById('adminChangePasswordUsernameLabel').textContent = `暱稱：${username}`;
            document.getElementById('adminNewPassword').value = '';
            document.getElementById('adminConfirmNewPassword').value = '';
            document.getElementById('adminChangePasswordModal').style.display = 'block';
        },

        // 關閉管理員變更密碼視窗
        closeAdminChangePasswordModal: function() {
            document.getElementById('adminChangePasswordModal').style.display = 'none';
        },

        // 提交管理員變更密碼
        adminChangePasswordSubmit: async function(event) {
            // 阻止表單預設提交行為
            if (event) {
                event.preventDefault();
            }
            
            const userId = window._adminChangePasswordUserId;
            const newPasswordInput = document.getElementById('adminNewPassword');
            const confirmNewPasswordInput = document.getElementById('adminConfirmNewPassword');
            
            // 檢查輸入欄位是否存在
            if (!newPasswordInput || !confirmNewPasswordInput) {
                console.error('密碼輸入欄位不存在');
                return false;
            }
            
            const newPassword = newPasswordInput.value;
            const confirmNewPassword = confirmNewPasswordInput.value;
            
            // 嘗試使用 HTML5 驗證
            const form = document.getElementById('adminChangePasswordForm');
            if (form) {
                if (!form.checkValidity()) {
                    form.reportValidity(); // 顯示瀏覽器原生驗證訊息
                    return false;
                }
            } else {
                // 備用驗證：檢查輸入欄位的 required 和 minlength 屬性
                if (!newPasswordInput.checkValidity()) {
                    newPasswordInput.reportValidity();
                    return false;
                }
                if (!confirmNewPasswordInput.checkValidity()) {
                    confirmNewPasswordInput.reportValidity();
                    return false;
                }
            }
            
            // 邏輯驗證：密碼一致性檢查
            if (newPassword !== confirmNewPassword) {
                if (window.Dialog) {
                    Dialog.error('新密碼與確認密碼不一致！');
                } 
                return false;
            }
            
            if (window.CommonUI) {
                window.CommonUI.showSpinner('變更密碼中...');
            }
            try {
                const response = await fetch(`/api/admin/users/${userId}/change-password`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',  // 包含 cookies 進行認證
                    body: JSON.stringify({ new_password: newPassword })
                });
                if (response.ok) {
                    // 使用 Dialog 顯示成功訊息
                    Dialog.success('密碼變更成功！');
                    this.closeAdminChangePasswordModal();
                } else {
                    const errorData = await response.json();
                    // 使用 Dialog 顯示錯誤訊息
                    Dialog.error(`密碼變更失敗：${errorData.detail || '未知錯誤'}`);
                }
            } catch (error) {
                // 使用 Dialog 顯示錯誤訊息
                Dialog.error(`密碼變更失敗：${error.message}`);
            } finally {
                if (window.CommonUI) {
                    window.CommonUI.stopSpinner();
                }
            }
            
            return false; // 阻止表單提交
        },

        // 渲染使用者操作按鈕
        renderUserActionButtons: function(user, isActive) {
            const currentUserId = window.currentUser ? parseInt(window.currentUser.id) : null;
            const targetUserId = parseInt(user.id);
            const isCurrentUser = currentUserId && targetUserId === currentUserId;
            
            let html = '';
            
            if (isActive) {
                if (isCurrentUser) {
                    // 當前使用者不能停用自己
                    html += `<button disabled class="user-action-btn user-action-btn-disabled" title="不能停用自己的帳號">停用</button>`;
                } else {
                    html += `<button onclick="AccountModule.deactivateUser(${user.id})" class="user-action-btn user-action-btn-deactivate">停用</button>`;
                }
            } else {
                html += `<button onclick="AccountModule.activateUser(${user.id})" class="user-action-btn user-action-btn-activate">啟用</button>`;
            }
            
            html += `<button onclick="AccountModule.openAdminChangePasswordModal(${user.id}, '${user.username}')" class="user-action-btn user-action-btn-password">變更密碼</button>`;
            
            return html;
        },

        // 綁定事件
        bindEvents: function() {
            // 事件綁定已在 admin-modules/admin-router.js 中處理
        }
    };

    // 導出模組
    window.AccountModule = AccountModule;
})();