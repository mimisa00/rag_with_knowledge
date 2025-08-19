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
                ${isActive
                    ? `<button onclick="AccountModule.deactivateUser(${user.id})" style="background:#e74c3c;color:white;padding:4px 10px;border-radius:4px;">停用</button>`
                    : `<button onclick="AccountModule.activateUser(${user.id})" style="background:#27ae60;color:white;padding:4px 10px;border-radius:4px;">啟用</button>`}
                <button onclick="AccountModule.openAdminChangePasswordModal(${user.id}, '${user.username}')" style="background:#3498db;color:white;padding:4px 10px;border-radius:4px;">變更密碼</button>
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
                      <button onclick="AccountModule.closeAdminChangePasswordModal()" class="btn-secondary">取消</button>
                      <button onclick="AccountModule.adminChangePasswordSubmit()" class="btn-primary">確認變更</button>
                    </div>
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
            if (!confirm('確定要啟用此帳號？')) return;
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
                alert('帳號啟用失敗：' + e.message);
            } finally {
                if (window.CommonUI) {
                    window.CommonUI.stopSpinner();
                }
            }
        },

        // 停用用戶
        deactivateUser: async function(userId) {
            if (!confirm('確定要停用此帳號？')) return;
            if (window.CommonUI) {
                window.CommonUI.showSpinner('停用帳號...');
            }
            try {
                const res = await fetch(`/api/admin/users/${userId}/deactivate`, { method: 'PUT' });
                if (!res.ok) throw new Error('停用失敗');
                // 更新本地資料
                const idx = allUsers.findIndex(u => u.id === userId);
                if (idx !== -1) allUsers[idx].is_active = false;
                this.renderUserTable();
            } catch (e) {
                alert('帳號停用失敗：' + e.message);
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
                alert('角色更新失敗：' + e.message);
            } finally {
                if (window.CommonUI) {
                    window.CommonUI.stopSpinner();
                }
            }
        },

        // 開啟管理員變更密碼視窗
        openAdminChangePasswordModal: function(userId, username) {
            window._adminChangePasswordUserId = userId;
            document.getElementById('adminChangePasswordUsernameLabel').textContent = `帳號：${username}`;
            document.getElementById('adminNewPassword').value = '';
            document.getElementById('adminConfirmNewPassword').value = '';
            document.getElementById('adminChangePasswordModal').style.display = 'block';
        },

        // 關閉管理員變更密碼視窗
        closeAdminChangePasswordModal: function() {
            document.getElementById('adminChangePasswordModal').style.display = 'none';
        },

        // 提交管理員變更密碼
        adminChangePasswordSubmit: async function() {
            const userId = window._adminChangePasswordUserId;
            const newPassword = document.getElementById('adminNewPassword').value;
            const confirmNewPassword = document.getElementById('adminConfirmNewPassword').value;
            
            if (!newPassword || !confirmNewPassword) {
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
            
            if (window.CommonUI) {
                window.CommonUI.showSpinner('變更密碼中...');
            }
            try {
                const response = await fetch(`/api/admin/users/${userId}/change-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ new_password: newPassword })
                });
                if (response.ok) {
                    alert('密碼變更成功！');
                    this.closeAdminChangePasswordModal();
                } else {
                    const errorData = await response.json();
                    alert(`密碼變更失敗：${errorData.detail || '未知錯誤'}`);
                }
            } catch (error) {
                alert(`密碼變更失敗：${error.message}`);
            } finally {
                if (window.CommonUI) {
                    window.CommonUI.stopSpinner();
                }
            }
        },

        // 綁定事件
        bindEvents: function() {
            // 事件綁定已在 admin-modules/admin-router.js 中處理
        }
    };

    // 導出模組
    window.AccountModule = AccountModule;
})();