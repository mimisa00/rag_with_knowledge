/**
 * 帳號詳情面板模組
 * 顯示選中帳號的詳細資訊並提供操作功能
 */
(function() {
    'use strict';

    const UserDetailsPanel = {
        // 當前顯示的使用者
        currentUser: null,

        // HTML 轉義函數（防 XSS）
        escapeHtml: function(unsafe) {
            if (typeof unsafe !== 'string') return unsafe;
            return unsafe
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        },

        // 統一錯誤處理函數
        showError: function(message) {
            if (window.Dialog) {
                Dialog.error(message);
                console.error(message);
            } 
        },

        // 統一成功訊息函數
        showSuccess: function(message) {
            if (window.Dialog) {
                Dialog.success(message);
            } 
        },

        // 初始化
        init: function() {
            // 初始化面板
            this.resetPanel();
        },

        // 顯示使用者詳情
        showUserDetails: function(user) {
            this.currentUser = user;
            
            const panel = document.getElementById('userDetailsPanel');
            if (!panel) return;
            
            const detailsCard = panel.querySelector('.details-card');
            if (!detailsCard) return;
            
            // 建立詳情內容
            let html = `
                <h3>帳號資訊</h3>
                <div class="details-content">
                    <div class="detail-section">
                        <h4 style="margin: 0 0 15px 0; color: #495057; font-size: 14px; font-weight: 600;">
                            基本資訊
                        </h4>
                        <div class="detail-item">
                            <span class="detail-label">帳號</span>
                            <span class="detail-value">${this.escapeHtml(user.loginid)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">姓名</span>
                            <span class="detail-value">${this.escapeHtml(user.username)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Email</span>
                            <span class="detail-value">${this.escapeHtml(user.email || '未設定')}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">角色</span>
                            <span class="detail-value">
                                <span class="badge ${user.role === 'admin' ? 'badge-warning' : 'badge-info'}" 
                                      style="padding: 2px 8px; border-radius: 4px; font-size: 12px;">
                                    ${user.role === 'admin' ? '系統管理員' : '一般使用者'}
                                </span>
                            </span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">狀態</span>
                            <span class="detail-value">
                                <span style="color: ${user.is_active ? '#27ae60' : '#e74c3c'}; font-weight: 600;">
                                    ${user.is_active ? '啟用' : '停用'}
                                </span>
                            </span>
                        </div>
                    </div>
                    
                    <div class="detail-section" style="margin-top: 20px;">
                        <h4 style="margin: 0 0 15px 0; color: #495057; font-size: 14px; font-weight: 600;">
                            時間資訊
                        </h4>
                        <div class="detail-item">
                            <span class="detail-label">註冊時間</span>
                            <span class="detail-value">
                                ${this.formatDateTime(user.created_at)}
                            </span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">最後登入</span>
                            <span class="detail-value">
                                ${user.last_login ? this.formatDateTime(user.last_login) : '從未登入'}
                            </span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">帳齡</span>
                            <span class="detail-value">
                                ${this.calculateAccountAge(user.created_at)}
                            </span>
                        </div>
                    </div>
                    
                    <!-- 操作按鈕 -->
                    <div class="detail-actions">
                        <button onclick="UserDetailsPanel.editUser()" class="btn btn-primary">
                            <i class="fas fa-edit"></i> 編輯
                        </button>
                        ${user.is_active 
                            ? `<button onclick="UserDetailsPanel.toggleUserStatus(false)" class="btn btn-warning">
                                   <i class="fas fa-ban"></i> 停用
                               </button>`
                            : `<button onclick="UserDetailsPanel.toggleUserStatus(true)" class="btn btn-success">
                                   <i class="fas fa-check"></i> 啟用
                               </button>`
                        }
                        <button onclick="UserDetailsPanel.changePassword()" class="btn btn-info">
                            <i class="fas fa-key"></i> 變更密碼
                        </button>
                    </div>
                </div>
            `;
            
            detailsCard.innerHTML = html;
        },

        // 重置面板
        resetPanel: function() {
            const panel = document.getElementById('userDetailsPanel');
            if (!panel) return;
            
            const detailsCard = panel.querySelector('.details-card');
            if (!detailsCard) return;
            
            detailsCard.innerHTML = `
                <h3>帳號資訊</h3>
                <div class="details-content">
                    <p class="text-muted">請選擇一個帳號查看詳情</p>
                </div>
            `;
            
            this.currentUser = null;
        },

        // 編輯使用者（彈出編輯對話框）
        editUser: function() {
            if (!this.currentUser) return;
            
            this.showEditUserModal();
        },

        // 切換使用者狀態
        toggleUserStatus: async function(activate) {
            if (!this.currentUser) return;
            
            const action = activate ? '啟用' : '停用';
            
            // 使用 Dialog.confirm 替代原生 confirm
            if (window.Dialog) {
                Dialog.confirm(`確定要${action}此帳號嗎？`, async () => {
                    await this.performUserStatusToggle(activate);
                });
                return;
            }
            
            // Fallback to native confirm if Dialog not available
            if (!confirm(`確定要${action}此帳號嗎？`)) return;
            
            await this.performUserStatusToggle(activate);
        },

        // 執行用戶狀態切換
        performUserStatusToggle: async function(activate) {
            const action = activate ? '啟用' : '停用';
            
            if (window.CommonUI) {
                window.CommonUI.showSpinner(`${action}帳號中...`);
            }
            
            try {
                const endpoint = activate 
                    ? `/api/admin/users/${this.currentUser.id}/activate`
                    : `/api/admin/users/${this.currentUser.id}/deactivate`;
                    
                const res = await fetch(endpoint, { method: 'PUT' });
                if (!res.ok) throw new Error(`${action}失敗`);
                
                // 更新本地狀態
                this.currentUser.is_active = activate;
                
                // 重新顯示詳情
                this.showUserDetails(this.currentUser);
                
                // 重新載入列表
                if (window.UserTimelineTree) {
                    UserTimelineTree.loadUsers();
                }
                
                // 顯示成功訊息
                this.showSuccess(`帳號已${action}`);
                
            } catch (error) {
                console.error('操作失敗:', error);
                this.showError(`帳號${action}失敗：${error.message}`);
            } finally {
                if (window.CommonUI) {
                    window.CommonUI.stopSpinner();
                }
            }
        },

        // 變更密碼
        changePassword: function() {
            if (!this.currentUser) return;
            
            // 使用原有的 AccountModule 功能
            if (window.AccountModule && window.AccountModule.openAdminChangePasswordModal) {
                window.AccountModule.openAdminChangePasswordModal(
                    this.currentUser.id, 
                    this.currentUser.username
                );
            } else {
                this.showChangePasswordModal();
            }
        },

        // 顯示變更密碼模態框
        showChangePasswordModal: function() {
            if (!this.currentUser) return;
            
            // 建立模態框 HTML
            const modalHtml = `
                <div id="userChangePasswordModal" class="modal" style="display: block;">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3>變更密碼 - ${this.currentUser.username}</h3>
                            <button class="modal-close" onclick="UserDetailsPanel.closeChangePasswordModal()">
                                <i class="fa-solid fa-times"></i>
                            </button>
                        </div>
                        <div class="modal-body">
                            <div class="form-group">
                                <label for="newUserPassword" class="form-label">新密碼</label>
                                <input type="password" id="newUserPassword" class="form-control" required minlength="6">
                            </div>
                            <div class="form-group">
                                <label for="confirmUserPassword" class="form-label">確認新密碼</label>
                                <input type="password" id="confirmUserPassword" class="form-control" required minlength="6">
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button onclick="UserDetailsPanel.closeChangePasswordModal()" class="btn btn-secondary">取消</button>
                            <button onclick="UserDetailsPanel.submitChangePassword()" class="btn btn-primary">確認變更</button>
                        </div>
                    </div>
                </div>
            `;
            
            // 添加到頁面
            const modalContainer = document.createElement('div');
            modalContainer.innerHTML = modalHtml;
            document.body.appendChild(modalContainer.firstElementChild);
        },

        // 關閉變更密碼模態框
        closeChangePasswordModal: function() {
            const modal = document.getElementById('userChangePasswordModal');
            if (modal) {
                modal.remove();
            }
        },

        // 提交變更密碼
        submitChangePassword: async function() {
            if (!this.currentUser) return;
            
            const newPassword = document.getElementById('newUserPassword').value;
            const confirmPassword = document.getElementById('confirmUserPassword').value;
            
            if (!newPassword || !confirmPassword) {
                Dialog.show('請填寫所有欄位');
                return;
            }
            
            if (newPassword !== confirmPassword) {
                Dialog.show('新密碼與確認密碼不一致');
                return;
            }
            
            if (newPassword.length < 6) {
                Dialog.show('密碼長度至少需要6個字符');
                return;
            }
            
            if (window.CommonUI) {
                window.CommonUI.showSpinner('變更密碼中...');
            }
            
            try {
                const response = await fetch(`/api/admin/users/${this.currentUser.id}/change-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ new_password: newPassword })
                });
                
                if (response.ok) {
                    this.closeChangePasswordModal();
                    if (window.Dialog) {
                        Dialog.success('密碼變更成功');
                    } else {
                        Dialog.success('密碼變更成功');
                    }
                } else {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || '未知錯誤');
                }
            } catch (error) {
                console.error('變更密碼失敗:', error);
                if (window.Dialog) {
                    Dialog.error(`密碼變更失敗：${error.message}`);
                } 
            } finally {
                if (window.CommonUI) {
                    window.CommonUI.stopSpinner();
                }
            }
        },

        // 顯示編輯用戶模態框
        showEditUserModal: function() {
            if (!this.currentUser) return;
            
            // 建立模態框 HTML
            const modalHtml = `
                <div id="userEditModal" class="modal" style="display: block;">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3>編輯帳號 - ${this.escapeHtml(this.currentUser.username)}</h3>
                            <button class="modal-close" onclick="UserDetailsPanel.closeEditUserModal()">
                                <i class="fa-solid fa-times"></i>
                            </button>
                        </div>
                        <div class="modal-body">
                            <div class="form-group">
                                <label for="editUsername" class="form-label">姓名</label>
                                <input type="text" id="editUsername" class="form-control" value="${this.escapeHtml(this.currentUser.username)}" required>
                            </div>
                            <div class="form-group">
                                <label for="editEmail" class="form-label">Email</label>
                                <input type="email" id="editEmail" class="form-control" value="${this.escapeHtml(this.currentUser.email || '')}" required>
                            </div>
                            <div class="form-group">
                                <label for="editIsActive" class="form-label">帳號狀態</label>
                                <select id="editIsActive" class="form-control">
                                    <option value="true" ${this.currentUser.is_active ? 'selected' : ''}>啟用</option>
                                    <option value="false" ${!this.currentUser.is_active ? 'selected' : ''}>停用</option>
                                </select>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button onclick="UserDetailsPanel.closeEditUserModal()" class="btn btn-secondary">取消</button>
                            <button onclick="UserDetailsPanel.submitEditUser()" class="btn btn-primary">確認編輯</button>
                        </div>
                    </div>
                </div>
            `;
            
            // 添加到頁面
            const modalContainer = document.createElement('div');
            modalContainer.innerHTML = modalHtml;
            document.body.appendChild(modalContainer.firstElementChild);
        },

        // 關閉編輯用戶模態框
        closeEditUserModal: function() {
            const modal = document.getElementById('userEditModal');
            if (modal) {
                modal.remove();
            }
        },

        // 提交編輯用戶
        submitEditUser: async function() {
            if (!this.currentUser) return;
            
            const username = document.getElementById('editUsername').value.trim();
            const email = document.getElementById('editEmail').value.trim();
            const isActive = document.getElementById('editIsActive').value === 'true';
            
            if (!username) {
                this.showError('請填寫姓名');
                return;
            }
            
            if (!email) {
                this.showError('請填寫 Email');
                return;
            }
            
            // 檢查是否有變更
            const hasChanges = username !== this.currentUser.username ||
                             email !== (this.currentUser.email || '') ||
                             isActive !== this.currentUser.is_active;
                             
            if (!hasChanges) {
                this.showError('沒有變更內容');
                return;
            }
            
            if (window.CommonUI) {
                window.CommonUI.showSpinner('更新帳號資訊中...');
            }
            
            try {
                const response = await fetch(`/api/admin/users/${this.currentUser.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: username,
                        email: email,
                        is_active: isActive
                    })
                });
                
                if (response.ok) {
                    // 更新本地資料
                    this.currentUser.username = username;
                    this.currentUser.email = email;
                    this.currentUser.is_active = isActive;
                    
                    this.closeEditUserModal();
                    
                    // 重新顯示詳情
                    this.showUserDetails(this.currentUser);
                    
                    // 重新載入列表
                    if (window.UserTimelineTree) {
                        UserTimelineTree.loadUsers();
                    }
                    
                    // 顯示成功訊息
                    this.showSuccess('帳號資訊更新成功');
                } else {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || '未知錯誤');
                }
            } catch (error) {
                console.error('更新帳號失敗:', error);
                this.showError(`更新失敗：${error.message}`);
            } finally {
                if (window.CommonUI) {
                    window.CommonUI.stopSpinner();
                }
            }
        },

        // 格式化日期時間
        formatDateTime: function(dateString) {
            if (!dateString) return '';
            
            const date = new Date(dateString);
            return date.toLocaleString('zh-TW', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        },

        // 計算帳齡
        calculateAccountAge: function(createdAt) {
            if (!createdAt) return '未知';
            
            const created = new Date(createdAt);
            const now = new Date();
            const diffMs = now - created;
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            
            if (diffDays === 0) {
                return '今天';
            } else if (diffDays === 1) {
                return '1 天';
            } else if (diffDays < 30) {
                return `${diffDays} 天`;
            } else if (diffDays < 365) {
                const months = Math.floor(diffDays / 30);
                return `${months} 個月`;
            } else {
                const years = Math.floor(diffDays / 365);
                const months = Math.floor((diffDays % 365) / 30);
                if (months > 0) {
                    return `${years} 年 ${months} 個月`;
                } else {
                    return `${years} 年`;
                }
            }
        }
    };

    // 導出模組
    window.UserDetailsPanel = UserDetailsPanel;
})();