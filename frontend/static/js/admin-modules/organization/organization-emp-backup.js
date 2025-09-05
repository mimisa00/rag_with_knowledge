/**
 * 組織管理 - 員工管理主模組
 * 協調各子模組並保留原有的統計功能
 */
window.OrganizationEmployeeModule = (function() {
    'use strict';
    
    // 使用 CRUD 模組的 API 端點
    const CRUD = window.OrganizationEmployeeCrudModule;
    const ENDPOINTS = CRUD.ENDPOINTS;
    
    // 數據存儲
    let permissionGroups = [];
    let users = [];
    let allUsers = [];          // 儲存所有用戶（包含停用）- 保留用於統計
    let showInactiveUsers = false;
    let isInitialized = false;  // 初始化狀態
    let selectedDepartmentId = null; // 當前選中的部門ID
    
    // 待處理帳號相關變數
    let pendingUsers = [];
    let pendingBannerHidden = false;
    let checkTimeout = null;
    
    /**
     * 初始化模組
     */
    async function init() {
        if (isInitialized) {
            console.log('OrganizationEmployeeModule 已經初始化，跳過');
            return;
        }
        
        console.log('OrganizationEmployeeModule 初始化開始');
        
        try {
            // 初始化員工角色選擇模組
            if (window.OrganizationEmployeeRolesModule) {
                console.log('初始化員工角色選擇模組');
                OrganizationEmployeeRolesModule.init();
            } else {
                console.warn('OrganizationEmployeeRolesModule 不存在，部分功能可能無法使用');
            }
            
            // 初始化員工權限選擇模組
            if (window.OrganizationEmployeePermissionsModule) {
                console.log('初始化員工權限選擇模組');
                OrganizationEmployeePermissionsModule.init();
            } else {
                console.warn('OrganizationEmployeePermissionsModule 不存在，部分功能可能無法使用');
            }
            
            // 綁定事件
            bindButtonEvents();
            bindModalEvents();
            bindFormEvents();
            
            // 初始化滾動條淡出淡入效果
            if (window.CommonUI && CommonUI.initScrollFadeEffect) {
                CommonUI.initScrollFadeEffect();
            }
            
            // 初始化員工懸浮卡片模組
            if (window.OrganizationEmployeeHoverCardModule) {
                console.log('初始化員工懸浮卡片模組');
                OrganizationEmployeeHoverCardModule.init(CRUD);
            } else {
                console.warn('OrganizationEmployeeHoverCardModule 不存在，懸浮卡片功能將無法使用');
            }
            
            // 載入初始數據
            console.log('載入權限群組和用戶數據...');
            await loadPermissionGroups();
            await loadUsers();
            
            // 載入待處理帳號
            await loadPendingUsers();
            updatePendingAccountsBanner();
            
            // 初始化子模組（子模組已由 HTML 載入）
            if (window.OrganizationEmployeeTreeModule) {
                console.log('初始化員工樹狀結構模組');
                OrganizationEmployeeTreeModule.init(this);
            } else {
                console.error('OrganizationEmployeeTreeModule 不存在!');
            }
            
            if (window.OrganizationEmployeeCardModule) {
                console.log('初始化員工卡片模組');
                OrganizationEmployeeCardModule.init();
            } else {
                console.error('OrganizationEmployeeCardModule 不存在!');
            }
            
            // 預載入表單選項
            loadUserFormOptions();
            
            // 初始化按鈕狀態
            updateAddEmployeeButtonState();
            
            isInitialized = true;
            console.log('OrganizationEmployeeModule 初始化完成');
            
        } catch (error) {
            console.error('OrganizationEmployeeModule 初始化失敗:', error);
            throw error;
        }
    }
    
    /**
     * 載入權限群組數據
     */
    async function loadPermissionGroups() {
        try {
            permissionGroups = await CRUD.loadPermissionGroups();
        } catch (error) {
            console.error('載入權限群組數據失敗:', error);
            permissionGroups = [];
        }
    }
    
    /**
     * 載入員工數據
     */
    async function loadUsers() {
        try {
            const result = await CRUD.loadUsers(showInactiveUsers);
            allUsers = result.allUsers;
            users = result.activeUsers;
            
            // 更新統計 - 保留原有功能
            updateUserStatistics();
            
            // 注意：不再自動呼叫 refresh，避免重複載入
            // 如果需要更新樹狀結構，應該通過其他方式通知
            console.log('員工資料載入完成，不再自動重新整理樹狀結構');
            
        } catch (error) {
            console.error('載入員工數據失敗:', error);
            showToast('載入員工數據失敗', 'error');
        }
    }
    
    /**
     * 更新用戶統計數據 - 保留原有功能
     */
    function updateUserStatistics() {
        const totalUsers = allUsers.length;
        const activeUsers = allUsers.filter(u => u.is_active === true || u.is_active === 1).length;
        const inactiveUsers = allUsers.filter(u => u.is_active === false || u.is_active === 0).length;
        
        const totalCount = document.querySelector('#totalEmployeeCount');
        const activeCount = document.querySelector('#activeEmployeeCount strong');
        const inactiveCount = document.querySelector('#inactiveEmployeeCount strong');
        
        if (totalCount) totalCount.textContent = totalUsers;
        if (activeCount) activeCount.textContent = activeUsers;
        if (inactiveCount) inactiveCount.textContent = inactiveUsers;
        
        // 更新概覽卡片的統計
        const employeeCount = document.querySelector('#employeeCount span');
        if (employeeCount) {
            employeeCount.textContent = users.length;
        }
    }
    
    /**
     * 更新新增員工按鈕狀態
     */
    function updateAddEmployeeButtonState() {
        const addBtn = document.getElementById('addEmployeeBtn');
        if (!addBtn) return;
        
        if (selectedDepartmentId) {
            addBtn.disabled = false;
            addBtn.title = '新增員工到所選部門';
        } else {
            addBtn.disabled = true;
            addBtn.title = '請先選擇部門';
        }
    }
    
    /**
     * 設定選中的部門
     */
    function setSelectedDepartment(deptId) {
        selectedDepartmentId = deptId;
        updateAddEmployeeButtonState();
    }
    
    /**
     * 清除選中的部門
     */
    function clearSelectedDepartment() {
        selectedDepartmentId = null;
        updateAddEmployeeButtonState();
    }
    
    /**
     * 根據部門載入員工
     */
    async function loadEmployeesByDept(deptId) {
        try {
            const employees = await CRUD.loadEmployeesByDept(deptId);
            
            // 使用卡片模組顯示員工（首次載入）
            if (window.OrganizationEmployeeCardModule) {
                OrganizationEmployeeCardModule.loadAndRenderEmployeeCards(employees);
            }
            
        } catch (error) {
            console.error('Error loading employees:', error);
        }
    }
    
    /**
     * 顯示員工詳情 (使用現有的 modal)
     */
    async function showEmployeeDetail(empId) {
        const employee = allUsers.find(u => (u.user_id || u.id) === empId);
        if (!employee) {
            try {
                const data = await CRUD.loadEmployeeDetail(empId);
                showUserDetailModal(data);
            } catch (error) {
                console.error('Error loading employee detail:', error);
            }
        } else {
            showUserDetailModal(employee);
        }
    }
    
    /**
     * 顯示用戶詳情 Modal（重新設計為專用的詳情顯示）
     */
    function showUserDetailModal(user) {
        // 創建詳情模態框（如果不存在）
        let modal = document.getElementById('employeeDetailModal');
        if (!modal) {
            modal = createEmployeeDetailModal();
        }
        
        // 填充詳情內容
        const modalTitle = modal.querySelector('#employeeDetailTitle');
        if (modalTitle) {
            modalTitle.textContent = user.username || user.name || user.loginid || '員工詳情';
        }
        
        const contentContainer = modal.querySelector('#employeeDetailContent');
        if (contentContainer) {
            contentContainer.innerHTML = generateEmployeeDetailHTML(user);
        }
        
        // 保存員工ID供編輯使用
        modal.dataset.empId = user.id || user.user_id;
        
        // 顯示 modal
        modal.classList.add('show');
        document.body.classList.add('modal-open');
        
        // 重新初始化滾動條淡出淡入效果（因為內容已更新）
        if (window.CommonUI && CommonUI.initScrollFadeEffect) {
            setTimeout(() => CommonUI.initScrollFadeEffect(), 100);
        }
    }

    /**
     * 創建員工詳情模態框
     */
    function createEmployeeDetailModal() {
        const modal = document.createElement('div');
        modal.id = 'employeeDetailModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content modal-lg">
                <div class="modal-header">
                    <h3 id="employeeDetailTitle">員工詳情</h3>
                    <button class="modal-close" onclick="closeEmployeeDetailModal()">
                        <i class="fa-solid fa-times"></i>
                    </button>
                </div>
                <div class="modal-body scrollable-fade">
                    <div id="employeeDetailContent">
                        <!-- 動態載入內容 -->
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="editEmployeeFromDetail()">
                        <i class="fas fa-edit"></i> 編輯員工
                    </button>
                    <button class="btn btn-secondary" onclick="closeEmployeeDetailModal()">關閉</button>
                </div>
            </div>
        `;
        
        // 添加到 body
        document.body.appendChild(modal);
        
        // 綁定關閉事件
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('show');
                document.body.classList.remove('modal-open');
            }
        });
        
        // 初始化滾動條淡出淡入效果
        if (window.CommonUI && CommonUI.initScrollFadeEffect) {
            setTimeout(() => CommonUI.initScrollFadeEffect(), 100);
        }
        
        return modal;
    }

    /**
     * 生成員工詳情 HTML
     */
    function generateEmployeeDetailHTML(user) {
        const displayName = user.username || user.name || user.loginid || '未命名';
        const loginId = user.loginid || user.username || '無';
        const email = user.email || '無';
        const employeeNo = user.user_extension?.employee_no || user.employee_no || '無';
        const title = user.user_extension?.title || user.title || '未設定';
        const departmentName = user.department?.name || user.department_name || '未分配';
        const authType = getAuthTypeDisplay(user.auth_type || 'local');
        const status = user.is_active ? '啟用' : '停用';
        const lastLogin = formatDateTime(user.last_login_at);
        
        // 處理部門角色
        let departmentRolesHtml = '';
        if (user.department_roles && user.department_roles.length > 0) {
            departmentRolesHtml = user.department_roles.map(role => {
                const roleTypeClass = role.role_type === 'manager' ? 'badge-warning' : 'badge-secondary';
                const roleTypeIcon = role.role_type === 'manager' ? 'user-tie' : 'user';
                const isPrimaryText = role.is_primary ? ' (主要)' : '';
                return `
                    <span class="badge ${roleTypeClass}" title="角色層級: ${role.level || 0}">
                        <i class="fas fa-${roleTypeIcon}"></i>
                        ${role.name}${isPrimaryText}
                    </span>
                `;
            }).join(' ');
        } else {
            departmentRolesHtml = '<span class="text-muted">無部門角色</span>';
        }
        
        // 處理系統權限群組
        let permissionGroupsHtml = '';
        if (user.permission_groups && user.permission_groups.length > 0) {
            permissionGroupsHtml = user.permission_groups.map(perm => {
                const permName = typeof perm === 'object' ? perm.name : perm;
                const permLevel = typeof perm === 'object' ? perm.level : 0;
                return `
                    <span class="badge badge-info" title="權限等級: ${permLevel}">
                        <i class="fas fa-shield-alt"></i>
                        ${permName}
                    </span>
                `;
            }).join(' ');
        } else {
            permissionGroupsHtml = '<span class="text-muted">無系統權限</span>';
        }
        
        return `
            <div class="employee-detail-grid">
                <!-- 基本資訊 -->
                <div class="detail-section">
                    <h4 class="detail-section-title">
                        <i class="fas fa-user"></i> 基本資訊
                    </h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>姓名</label>
                            <div class="detail-value">${displayName}</div>
                        </div>
                        <div class="detail-item">
                            <label>帳號</label>
                            <div class="detail-value">${loginId}</div>
                        </div>
                        <div class="detail-item">
                            <label>員工編號</label>
                            <div class="detail-value">${employeeNo}</div>
                        </div>
                        <div class="detail-item">
                            <label>職稱</label>
                            <div class="detail-value">${title}</div>
                        </div>
                        <div class="detail-item">
                            <label>Email</label>
                            <div class="detail-value">
                                ${email !== '無' ? `<a href="mailto:${email}">${email}</a>` : email}
                            </div>
                        </div>
                        <div class="detail-item">
                            <label>認證方式</label>
                            <div class="detail-value">${authType}</div>
                        </div>
                    </div>
                </div>
                
                <!-- 組織資訊 -->
                <div class="detail-section">
                    <h4 class="detail-section-title">
                        <i class="fas fa-sitemap"></i> 組織資訊
                    </h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>主要部門</label>
                            <div class="detail-value">
                                <span class="badge badge-success">
                                    <i class="fas fa-folder"></i>
                                    ${departmentName}
                                </span>
                            </div>
                        </div>
                        <div class="detail-item full-width">
                            <label>部門角色</label>
                            <div class="detail-value badges-container">
                                ${departmentRolesHtml}
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 系統權限 -->
                <div class="detail-section">
                    <h4 class="detail-section-title">
                        <i class="fas fa-key"></i> 系統權限
                    </h4>
                    <div class="detail-grid">
                        <div class="detail-item full-width">
                            <label>權限群組</label>
                            <div class="detail-value badges-container">
                                ${permissionGroupsHtml}
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 帳號狀態 -->
                <div class="detail-section">
                    <h4 class="detail-section-title">
                        <i class="fas fa-info-circle"></i> 帳號狀態
                    </h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>帳號狀態</label>
                            <div class="detail-value">
                                <span class="badge ${user.is_active ? 'badge-success' : 'badge-danger'}">
                                    <i class="fas fa-${user.is_active ? 'check-circle' : 'times-circle'}"></i>
                                    ${status}
                                </span>
                            </div>
                        </div>
                        <div class="detail-item">
                            <label>最後登入</label>
                            <div class="detail-value">${lastLogin}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 獲取認證方式顯示名稱
     */
    function getAuthTypeDisplay(authType) {
        const authMap = {
            'local': '本地認證',
            'ldap': 'LDAP',
            'sso': 'SSO 單一登入',
            'oauth': 'OAuth'
        };
        return authMap[authType] || authType;
    }
    
    
    /**
     * 編輯用戶
     */
    async function editUser(userId) {
        const user = allUsers.find(u => (u.user_id || u.id) === userId);
        if (!user) {
            showToast('找不到該用戶', 'error');
            return;
        }
        console.info("---------------------")
        console.info(user)
        
        // 載入表單選項
        await loadUserFormOptions();
        
        // 填充表單
        document.getElementById('userId').value = user.user_id || user.id;
        document.getElementById('userLoginid').value = user.loginid || user.username || '';
        document.getElementById('userUsername').value = user.username || user.name || '';
        document.getElementById('userEmail').value = user.email || '';
        document.getElementById('userEmployeeNo').value = user.user_extension?.employee_no || '';
        
        // 正確提取部門 ID（參考樹狀結構模組的做法）
        const deptId = user.department?.id || 
                       user.user_extension?.department_id || 
                       user.department_id || '';
        document.getElementById('userDepartment').value = deptId;
        document.getElementById('userTitle').value = user.user_extension?.title || user.title || '';
        document.getElementById('userActive').checked = user.is_active;
        
        // 編輯模式：禁用帳號欄位
        document.getElementById('userLoginid').disabled = true;
        
        // 更新帳號狀態圖示為編輯模式（不顯示返回按鈕）
        updateAccountStatusDisplay('edit_mode', { 
            status: 'edit_mode', 
            exists: true, 
            hasEmployeeInfo: true 
        });
        
        // 設定密碼策略為手動（編輯模式預設不改密碼）
        document.getElementById('passwordStrategy').value = 'MANUAL';
        document.getElementById('manualPasswordGroup').style.display = 'block';
        document.getElementById('userPassword').value = '';
        document.getElementById('userPassword').placeholder = '不修改請留空';
        
        // 設定權限群組（延遲執行確保選項已載入）
        setTimeout(async () => {
            // 更新部門選擇器的顯示
            const deptSelect = document.getElementById('userDepartment');
            if (deptSelect && deptSelect._searchableSelect) {
                deptSelect._searchableSelect.updateDisplay();
            }
            
            if (user.permission_groups) {
                const permissionIds = user.permission_groups.map(p => 
                    typeof p === 'object' ? p.id : p
                ).filter(id => id);
                
                setSelectedPermissions(permissionIds);
            }
            
            // 載入部門角色（如果有部門）
            const actualDeptId = user.department?.id || 
                                user.user_extension?.department_id || 
                                user.department_id;
            if (actualDeptId && window.OrganizationEmployeeRolesModule) {
                await OrganizationEmployeeRolesModule.onDepartmentChange(actualDeptId, true); // 傳遞編輯模式標記
                
                // 設定已有的角色
                if (user.primary_role_id || user.department_roles) {
                    OrganizationEmployeeRolesModule.setSelectedRoles({
                        primary_role_id: user.primary_role_id,
                        department_roles: user.department_roles
                    });
                }
            }
        }, 200);  // 增加延遲確保 searchable-select 已初始化
        
        // 設定標題為編輯
        const modalTitle = document.getElementById('employeeModalTitle');
        if (modalTitle) {
            modalTitle.textContent = '編輯員工';
        }
        
        // 顯示編輯 modal
        const modal = document.getElementById('employeeModal');
        if (modal) {
            modal.classList.add('show');
            document.body.classList.add('modal-open');
        }
    }
    
    /**
     * 重設用戶密碼
     */
    async function resetUserPassword(userId) {
        if (!confirm('確定要重設此用戶的密碼嗎？')) {
            return;
        }
        
        try {
            const result = await CRUD.resetUserPassword(userId);
            showToast(`密碼已重設為: ${result.new_password}`, 'success');
        } catch (error) {
            console.error('Error resetting password:', error);
            showToast('重設密碼失敗', 'error');
        }
    }
    
    /**
     * 切換用戶狀態（啟用時直接啟用，停用時顯示確認對話框）
     */
    async function toggleUserStatus(userId, currentStatus) {
        if (currentStatus) {
            // 目前是啟用狀態，點擊為停用 -> 顯示停用確認對話框
            showEmployeeDeactivateModal(userId);
        } else {
            // 目前是停用狀態，點擊為啟用 -> 直接啟用
            await executeUserStatusChange(userId, true);
        }
    }
    
    /**
     * 顯示員工停用確認對話框
     */
    function showEmployeeDeactivateModal(userId) {
        // 找到員工資料
        const employee = allUsers.find(u => (u.user_id || u.id) === userId);
        if (!employee) {
            showToast('找不到該員工資料', 'error');
            return;
        }
        
        // 填入員工資訊
        document.getElementById('deactivateEmployeeName').textContent = 
            employee.username || employee.name || '未命名';
        document.getElementById('deactivateEmployeeLogin').textContent = 
            employee.loginid || employee.username || '無帳號';
        
        // 設定最小日期時間為當前時間
        const now = new Date();
        const minDateTime = new Date(now.getTime() + 60000); // 最少一分鐘後
        document.getElementById('deactivateDateTime').min = 
            minDateTime.toISOString().slice(0, 16);
        
        // 預設時間設定為明天同一時間
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        document.getElementById('deactivateDateTime').value = 
            tomorrow.toISOString().slice(0, 16);
        
        // 重置表單狀態
        document.querySelector('input[name="deactivateMode"][value="immediate"]').checked = true;
        document.getElementById('scheduledDeactivateGroup').style.display = 'none';
        
        // 綁定模式切換事件
        bindDeactivateModeEvents();
        
        // 儲存當前員工 ID
        document.getElementById('employeeDeactivateModal').dataset.userId = userId;
        
        // 顯示對話框
        document.getElementById('employeeDeactivateModal').classList.add('show');
        document.body.classList.add('modal-open');
    }
    
    /**
     * 綁定停用模式切換事件
     */
    function bindDeactivateModeEvents() {
        const immediateRadio = document.querySelector('input[name="deactivateMode"][value="immediate"]');
        const scheduledRadio = document.querySelector('input[name="deactivateMode"][value="scheduled"]');
        const scheduledGroup = document.getElementById('scheduledDeactivateGroup');
        const confirmBtn = document.getElementById('confirmDeactivateBtn');
        
        immediateRadio.addEventListener('change', function() {
            if (this.checked) {
                scheduledGroup.style.display = 'none';
                confirmBtn.innerHTML = '<i class="fas fa-ban"></i> 確認停用';
            }
        });
        
        scheduledRadio.addEventListener('change', function() {
            if (this.checked) {
                scheduledGroup.style.display = 'block';
                confirmBtn.innerHTML = '<i class="fas fa-clock"></i> 排程停用';
            }
        });
    }
    
    /**
     * 確認員工停用
     */
    async function confirmEmployeeDeactivate() {
        const modal = document.getElementById('employeeDeactivateModal');
        const userId = parseInt(modal.dataset.userId);
        const mode = document.querySelector('input[name="deactivateMode"]:checked').value;
        
        try {
            if (mode === 'immediate') {
                // 立即停用
                await executeUserStatusChange(userId, false, new Date());
            } else {
                // 排程停用
                const scheduledTime = document.getElementById('deactivateDateTime').value;
                if (!scheduledTime) {
                    showToast('請選擇停用時間', 'warning');
                    return;
                }
                
                const scheduledDate = new Date(scheduledTime);
                const now = new Date();
                
                if (scheduledDate <= now) {
                    showToast('停用時間必須為未來時間', 'warning');
                    return;
                }
                
                await executeUserStatusChange(userId, true, scheduledDate); // 延遲停用時暫時保持啟用
            }
            
            // 關閉對話框
            closeEmployeeDeactivateModal();
            
        } catch (error) {
            console.error('停用員工失敗:', error);
            showToast('停用員工失敗', 'error');
        }
    }
    
    /**
     * 執行用戶狀態變更
     */
    async function executeUserStatusChange(userId, isActive, activationExpires = null) {
        try {
            await CRUD.updateUserStatus(userId, isActive, activationExpires);
            
           let message = '';
           if (isActive && !activationExpires) {
               message = '員工帳號已啟用';
           } else if (!isActive) {
               message = '員工帳號已立即停用';
           } else {
               const expireTime = activationExpires.toLocaleString('zh-TW');
               message = `員工帳號已排程在 ${expireTime} 停用`;
           }
                
            showToast(message, 'success');
            
            // 更新本地資料陣列中該員工的狀態
            const updatedData = { is_active: isActive };
            if (activationExpires) {
                updatedData.activation_expires = activationExpires.toISOString();
            }
            
            // 更新 allUsers 陣列
            const allUserIndex = allUsers.findIndex(u => (u.user_id || u.id) === userId);
            if (allUserIndex !== -1) {
                Object.assign(allUsers[allUserIndex], updatedData);
            }
            
            // 更新 users 陣列
            const userIndex = users.findIndex(u => (u.user_id || u.id) === userId);
            if (userIndex !== -1) {
                Object.assign(users[userIndex], updatedData);
            }
            
            // 使用單卡更新功能而非全部重新載入
            if (window.OrganizationEmployeeCardModule && 
                window.OrganizationEmployeeCardModule.updateSingleEmployeeCard) {
                const success = window.OrganizationEmployeeCardModule.updateSingleEmployeeCard(userId, updatedData);
                if (!success) {
                    // 如果單卡更新失敗，才執行完整重載
                    await loadUsers();
                }
            } else {
                // 備援：完整重載
                await loadUsers();
            }
            
            // 重新載入樹狀結構（保持原有邏輯）
            if (window.OrganizationEmployeeTreeModule) {
                OrganizationEmployeeTreeModule.refresh();
            }
        } catch (error) {
            console.error('Error updating user status:', error);
            throw error;
        }
    }
    
    /**
     * 關閉員工停用確認對話框
     */
    function closeEmployeeDeactivateModal() {
        document.getElementById('employeeDeactivateModal').classList.remove('show');
        document.body.classList.remove('modal-open');
    }
    
    /**
     * 載入用戶表單選項
     */
    async function loadUserFormOptions() {
        // 載入部門選項
        await loadDepartmentOptions('userDepartment');
        
        // 載入權限群組選項
        loadPermissionGroupOptions();
    }
    
    /**
     * 處理部門變更事件
     */
    function handleDepartmentChange(event) {
        const deptId = event.target.value;
        if (window.OrganizationEmployeeRolesModule) {
            OrganizationEmployeeRolesModule.onDepartmentChange(deptId);
        }
    }
    
    /**
     * 載入部門選項
     */
    async function loadDepartmentOptions(selectId) {
        try {
            const departments = await CRUD.loadDepartmentOptions();
            const select = document.getElementById(selectId);
            if (select) {
                // 保存當前值
                const currentValue = select.value;
                
                select.innerHTML = '<option value="">請選擇部門</option>';
                
                // 建立部門的完整路徑（如果需要）
                const buildFullPath = (dept) => {
                    if (dept.full_path) return dept.full_path;
                    // 如果有父部門名稱，建立路徑
                    if (dept.parent_name) {
                        return `${dept.parent_name} / ${dept.name}`;
                    }
                    return dept.name;
                };
                
                // 排序部門（按名稱）
                const sortedDepts = departments.sort((a, b) => {
                    const nameA = buildFullPath(a);
                    const nameB = buildFullPath(b);
                    return nameA.localeCompare(nameB, 'zh-TW');
                });
                
                sortedDepts.forEach(dept => {
                    if (dept.is_active !== false) {  // 只顯示啟用的部門
                        const option = document.createElement('option');
                        option.value = dept.id;
                        option.textContent = buildFullPath(dept);
                        select.appendChild(option);
                    }
                });
                
                // 恢復當前值（如果存在）
                if (currentValue) {
                    select.value = currentValue;
                }
                
                // 銷毀舊的 searchable-select 實例（如果存在）
                if (select._searchableSelect) {
                    select._searchableSelect.destroy();
                }
                
                // 初始化新的 searchable-select
                if (window.SearchableSelect) {
                        // 從 HTML data 屬性獲取配置
                        const placeholder = select.getAttribute('data-placeholder') || '請選擇部門...';
                        const searchPlaceholder = select.getAttribute('data-search-placeholder') || '搜尋部門名稱...';
                        const noResults = select.getAttribute('data-no-results') || '找不到符合的部門';
                        
                        select._searchableSelect = new SearchableSelect(select, {
                            placeholder: placeholder,
                            searchPlaceholder: searchPlaceholder,
                            noResultsText: noResults,
                            allowClear: false  // 部門是必填欄位
                        });
                        
                        // 綁定 change 事件（如果是員工部門選擇器）
                        if (selectId === 'userDepartment') {
                            // 移除舊的事件監聽器
                            select.removeEventListener('change', handleDepartmentChange);
                            // 添加新的事件監聽器
                            select.addEventListener('change', handleDepartmentChange);
                        }
                }
            }
        } catch (error) {
            console.error('Error loading departments:', error);
        }
    }
    
    /**
     * 載入權限群組選項（已改用模態框方式，此函數保留以兼容性）
     */
    function loadPermissionGroupOptions() {
        // 新版本使用 OrganizationEmployeePermissionsModule 處理權限選擇
        // 此函數保留以維持向下兼容性，但不再需要執行任何操作
        console.log('權限選擇已改用模態框方式，loadPermissionGroupOptions 不再需要');
    }
    
    /**
     * 設定選中的權限群組（使用新的權限選擇模組）
     */
    function setSelectedPermissions(permissionIds) {
        if (window.OrganizationEmployeePermissionsModule) {
            OrganizationEmployeePermissionsModule.setSelectedPermissions(permissionIds);
        } else {
            // 向下兼容：如果新模組不存在，使用舊方式
            const container = document.querySelector('.permission-group-checkboxes');
            if (!container) return;
            
            // 先清除所有選中
            container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.checked = false;
            });
            
            // 設定選中的項目
            permissionIds.forEach(id => {
                const checkbox = container.querySelector(`input[value="${id}"]`);
                if (checkbox) {
                    checkbox.checked = true;
                }
            });
        }
    }
    
    /**
     * 綁定按鈕事件
     */
    function bindButtonEvents() {
        // 新增員工按鈕
        const addBtn = document.getElementById('addEmployeeBtn');
        if (addBtn) {
            addBtn.addEventListener('click', showAddUserModal);
        }
        
        // 分頁按鈕已不再需要（使用樹狀結構和卡片代替）
    }
    
    /**
     * 綁定 Modal 事件
     */
    function bindModalEvents() {
        // 關閉按鈕事件
        document.querySelectorAll('.modal .close, .modal .btn-close').forEach(btn => {
            btn.addEventListener('click', function() {
                const modal = this.closest('.modal');
                if (modal) {
                    modal.classList.remove('show');
                    document.body.classList.remove('modal-open');
                }
            });
        });
        
        // 移除點擊背景關閉功能 - 所有模態框都不允許點擊背景關閉
        // document.querySelectorAll('.modal').forEach(modal => {
        //     modal.addEventListener('click', function(e) {
        //         if (e.target === this) {
        //             this.classList.remove('show');
        //             document.body.classList.remove('modal-open');
        //         }
        //     });
        // });
    }
    
    /**
     * 綁定表單事件
     */
    function bindFormEvents() {
        // 用戶表單（統一處理新增和編輯）
        const userForm = document.getElementById('userForm');
        if (userForm) {
            userForm.addEventListener('submit', handleAddUser);
        }
    }
    
    /**
     * 顯示新增用戶 Modal
     */
    function showAddUserModal() {
        // 檢查是否已選擇部門
        if (!selectedDepartmentId) {
            showToast('請先選擇部門', 'warning');
            return;
        }
        
        const modal = document.getElementById('employeeModal');
        if (modal) {
            // 清空表單
            const form = document.getElementById('userForm');
            if (form) {
                form.reset();
                // 清空隱藏欄位
                document.getElementById('userId').value = '';
                // 清理表單模式標記（確保是新增模式）
                delete form.dataset.mode;
                
                // 清理帳號狀態顯示（重要！）
                updateAccountStatusDisplay('', '');
                
                // 清理所有錯誤狀態
                clearFormErrors();
                
                // 設定預設值
                const userActive = document.getElementById('userActive');
                if (userActive) {
                    userActive.checked = true;
                }
            }
            
            // 重置角色選擇狀態
            if (window.OrganizationEmployeeRolesModule) {
                OrganizationEmployeeRolesModule.resetRolesState();
            }
            
            // 重置權限選擇狀態
            if (window.OrganizationEmployeePermissionsModule) {
                OrganizationEmployeePermissionsModule.resetPermissions();
            }
            
            // 設定標題為新增
            const modalTitle = document.getElementById('employeeModalTitle');
            if (modalTitle) {
                modalTitle.textContent = '新增員工';
            }
            
            // 新增模式：啟用帳號欄位
            document.getElementById('userLoginid').disabled = false;
            
            // 設定密碼策略為手動（新增模式需要密碼）
            document.getElementById('passwordStrategy').value = 'MANUAL';
            document.getElementById('manualPasswordGroup').style.display = 'block';
            document.getElementById('userPassword').value = '';
            document.getElementById('userPassword').placeholder = '請輸入密碼';
            
            // 載入表單選項
            loadUserFormOptions();
            
            // 預設選中目前選擇的部門並載入角色
            setTimeout(async () => {
                const deptSelect = document.getElementById('userDepartment');
                if (deptSelect) {
                    // 如果有選中的部門，設定預設值
                    if (selectedDepartmentId) {
                        deptSelect.value = selectedDepartmentId;
                        
                        // 如果有 searchable-select 實例，更新顯示
                        if (deptSelect._searchableSelect) {
                            deptSelect._searchableSelect.updateDisplay();
                        }
                        
                        // 觸發部門變更事件，載入部門角色
                        if (window.OrganizationEmployeeRolesModule) {
                            await OrganizationEmployeeRolesModule.onDepartmentChange(selectedDepartmentId);
                        }
                    }
                }
            }, 200);  // 增加延遲確保 searchable-select 已初始化
            
            modal.classList.add('show');
            document.body.classList.add('modal-open');
        }
    }
    
    /**
     * 專門用於待處理帳號的新增用戶模態框（跳過部門選擇檢查）
     */
    function showAddUserModalForPending(fromPending = false) {
        const modal = document.getElementById('employeeModal');
        if (modal) {
            // 清空表單
            const form = document.getElementById('userForm');
            if (form) {
                form.reset();
                // 清空隱藏欄位
                document.getElementById('userId').value = '';
                // 清理表單模式標記（確保是新增模式）
                delete form.dataset.mode;
                
                // 如果是從待處理帳號清單進入，設定標記
                if (fromPending) {
                    form.dataset.fromPending = 'true';
                } else {
                    delete form.dataset.fromPending;
                }
                
                // 清理帳號狀態顯示（會立即被新的檢查覆蓋）
                updateAccountStatusDisplay('', '');
                
                // 清理錯誤狀態
                clearFormErrors();
                
                // 設定預設值
                const userActive = document.getElementById('userActive');
                if (userActive) {
                    userActive.checked = true;
                }
            }
            
            // 重置角色選擇狀態
            if (window.OrganizationEmployeeRolesModule) {
                OrganizationEmployeeRolesModule.resetRolesState();
            }
            
            // 重置權限選擇狀態
            if (window.OrganizationEmployeePermissionsModule) {
                OrganizationEmployeePermissionsModule.resetPermissions();
            }
            
            // 根據來源設定標題
            const modalTitle = document.getElementById('employeeModalTitle');
            if (modalTitle) {
                modalTitle.textContent = fromPending ? '完成待處理帳號設定' : '新增員工';
            }
            
            // 新增模式：啟用帳號欄位
            document.getElementById('userLoginid').disabled = false;
            
            // 設定密碼策略為手動（新增模式需要密碼）
            document.getElementById('passwordStrategy').value = 'MANUAL';
            document.getElementById('manualPasswordGroup').style.display = 'block';
            document.getElementById('userPassword').value = '';
            document.getElementById('userPassword').placeholder = '請輸入密碼';
            
            // 載入表單選項
            loadUserFormOptions();
            
            modal.classList.add('show');
            document.body.classList.add('modal-open');
        }
    }
    
    /**
     * 驗證使用者表單
     */
    function validateUserForm() {
        const errors = [];
        
        // 取得表單欄位
        const loginid = document.getElementById('userLoginid')?.value?.trim() || '';
        const username = document.getElementById('userUsername')?.value?.trim() || '';
        const email = document.getElementById('userEmail')?.value?.trim() || '';
        const employeeNo = document.getElementById('userEmployeeNo')?.value?.trim() || '';
        const password = document.getElementById('userPassword')?.value || '';
        const departmentId = document.getElementById('userDepartment')?.value || '';
        const isEdit = document.getElementById('userId')?.value !== '';
        
        // 1. 登入帳號驗證
        if (!loginid) {
            errors.push({ field: 'userLoginid', message: '登入帳號不能為空' });
        } else if (loginid.length < 3 || loginid.length > 50) {
            errors.push({ field: 'userLoginid', message: '登入帳號長度必須在 3-50 個字元之間' });
        } else if (!/^[a-zA-Z0-9._-]+$/.test(loginid)) {
            errors.push({ field: 'userLoginid', message: '登入帳號只能包含英數字、點號、底線或短橫線' });
        }
        
        // 2. 真實姓名驗證
        if (!username) {
            errors.push({ field: 'userUsername', message: '姓名不能為空' });
        } else if (username.length < 2 || username.length > 100) {
            errors.push({ field: 'userUsername', message: '姓名長度必須在 2-100 個字元之間' });
        }
        
        // 3. Email 驗證
        if (!email) {
            errors.push({ field: 'userEmail', message: '電子信箱不能為空' });
        } else if (email.length > 100) {
            errors.push({ field: 'userEmail', message: '電子信箱長度不能超過 100 個字元' });
        } else {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                errors.push({ field: 'userEmail', message: '請輸入有效的電子信箱格式' });
            }
        }
        
         // 4. 員工編號驗證（選填，但如果有值需要驗證格式）
         if (!employeeNo) {
             errors.push({ field: 'userEmployeeNo', message: '員工編號不能為空' });
         } else if (employeeNo && !/^[A-Z0-9-]+$/.test(employeeNo)) {
             errors.push({ field: 'userEmployeeNo', message: '員工編號只能包含大寫英文、數字或短橫線' });
         }
        
        // 5. 密碼驗證（新增模式必填，編輯模式選填）
        if (!isEdit && !password) {
            errors.push({ field: 'userPassword', message: '密碼不能為空' });
        } else if (password && password.length < 6) {
            errors.push({ field: 'userPassword', message: '密碼長度至少 6 個字元' });
        } else if (password && (!/[0-9]/.test(password) || !/[a-zA-Z]/.test(password))) {
            errors.push({ field: 'userPassword', message: '密碼必須包含至少一個數字和一個字母' });
        }
        
        // 6. 部門驗證
        if (!departmentId) {
            errors.push({ field: 'userDepartment', message: '必須選擇部門' });
        }
        
        // 7. 主要角色驗證
        let primaryRoleId = null;
        if (window.OrganizationEmployeeRolesModule) {
            const rolesData = OrganizationEmployeeRolesModule.getSelectedRoles();
            primaryRoleId = rolesData?.primary_role_id;
        }
        if (!primaryRoleId) {
            errors.push({ field: 'userPrimaryRole', message: '必須選擇主要角色' });
        }
        
        return errors;
    }
    
    /**
     * 顯示表單驗證錯誤
     */
    function displayFormErrors(errors) {
        // 先清除所有錯誤狀態
        clearFormErrors();
        
        errors.forEach(error => {
            const field = document.getElementById(error.field);
            if (field) {
                // 加入錯誤樣式
                field.classList.add('is-invalid');
                
                // 建立或更新錯誤訊息元素
                let errorElement = field.parentNode.querySelector('.invalid-feedback');
                if (!errorElement) {
                    errorElement = document.createElement('div');
                    errorElement.className = 'invalid-feedback';
                    field.parentNode.appendChild(errorElement);
                }
                errorElement.textContent = error.message;
                errorElement.style.display = 'block';
            }
        });
        
        // 滾動到第一個錯誤欄位
        if (errors.length > 0) {
            const firstErrorField = document.getElementById(errors[0].field);
            if (firstErrorField) {
                firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                firstErrorField.focus();
            }
        }
    }
    
    /**
     * 清除表單錯誤狀態
     */
    function clearFormErrors() {
        const form = document.getElementById('userForm');
        if (form) {
            // 移除錯誤樣式
            form.querySelectorAll('.is-invalid').forEach(field => {
                field.classList.remove('is-invalid');
            });
            
            // 隱藏錯誤訊息
            form.querySelectorAll('.invalid-feedback').forEach(errorElement => {
                errorElement.style.display = 'none';
            });
        }
    }
    
    /**
     * 映射後端錯誤欄位名稱到前端表單欄位 ID
     */
    function mapErrorFieldToFormField(errorField) {
        const fieldMap = {
            'loginid': 'userLoginid',
            'username': 'userUsername',
            'email': 'userEmail',
            'password': 'userPassword',
            'department_id': 'userDepartment',
            'primary_role_id': 'userPrimaryRole',
            'employee_no': 'userEmployeeNo',
            'title': 'userTitle'
        };
        
        return fieldMap[errorField] || null;
    }
    
    /**
     * 處理新增/編輯用戶（統一處理函數）
     */
    async function handleAddUser(e) {
        // 支援直接調用和事件調用
        if (e && e.preventDefault) {
            e.preventDefault();
            var formData = new FormData(e.target);
        } else {
            const form = document.getElementById('userForm');
            if (!form) return;
            var formData = new FormData(form);
        }
        
        // 1. 先進行前端驗證
        const validationErrors = validateUserForm();
        if (validationErrors.length > 0) {
            displayFormErrors(validationErrors);
            showToast('請修正表單錯誤後再提交', 'error');
            return;
        }
        
        // 2. 清除之前的錯誤狀態
        clearFormErrors();
        
        // 檢查是否為編輯模式（多重檢查確保準確性）
        const userId = formData.get('id');
        const form = document.getElementById('userForm');
        const formMode = form?.dataset.mode;
        const isEdit = (userId && userId !== '') || (formMode === 'edit');
        
        // 收集表單資料
        const userData = {
            loginid: formData.get('loginid')?.trim(),
            username: formData.get('username')?.trim(),
            email: formData.get('email')?.trim(),
            department_id: parseInt(formData.get('department_id')) || null,
            employee_no: formData.get('employee_no')?.trim() || null,
            title: formData.get('title')?.trim() || null,
            is_active: formData.get('is_active') === 'on'
        };
        
        // 收集部門角色資料
        if (window.OrganizationEmployeeRolesModule) {
            const rolesData = OrganizationEmployeeRolesModule.getSelectedRoles();
            userData.primary_role_id = parseInt(rolesData.primary_role_id) || null;
            userData.department_roles = rolesData.department_roles?.map(id => parseInt(id)).filter(id => id) || [];
        }
        
        // 收集權限群組
        userData.permission_group_ids = [];
        if (window.OrganizationEmployeePermissionsModule) {
            userData.permission_group_ids = OrganizationEmployeePermissionsModule.getSelectedPermissions()?.map(id => parseInt(id)).filter(id => id) || [];
        }
        
        // 密碼處理
        const password = formData.get('password')?.trim();
        if (!isEdit) {
            // 新增模式：密碼必填
            userData.password = password;
            userData.password_strategy = formData.get('password_strategy') || 'MANUAL';
        } else if (password) {
            // 編輯模式：有填密碼才更新
            userData.password = password;
        }
        
        // 加上 user_id 或 id （如果有的話）
        if (userId && userId !== '') {
            userData.id = userId;
            userData.user_id = userId;
        }
        
        try {
            await CRUD.saveEmployee(userData, isEdit);
            // 根據實際操作類型顯示正確的訊息
            const isUpdateOperation = userId && userId !== '';
            const successMessage = isUpdateOperation ? 
                (isEdit ? '員工資料更新成功' : '員工設定完成成功') : 
                '員工新增成功';
            showToast(successMessage, 'success');
            
            // 檢查是否來自待處理帳號清單
            const isFromPending = form && form.dataset.fromPending === 'true';
            
            // 關閉員工 modal
            const modal = document.getElementById('employeeModal');
            modal.classList.remove('show');
            document.body.classList.remove('modal-open');
            
            // 清理表單模式標記
            if (form) {
                delete form.dataset.mode;
                delete form.dataset.fromPending;
            }
            
            // 重新載入數據
            await loadUsers();
            
            // 重新載入樹狀結構
            if (window.OrganizationEmployeeTreeModule) {
                OrganizationEmployeeTreeModule.refresh();
            }
            
            // 如果是從待處理帳號清單進入，重新顯示並更新清單和banner
            if (isFromPending) {
                console.log('來自待處理帳號清單，重新顯示並更新清單和banner');
                
                // 重新顯示待處理帳號 Modal
                const pendingModal = document.getElementById('pendingAccountsModal');
                if (pendingModal && pendingModal.dataset.temporaryHidden === 'true') {
                    pendingModal.classList.remove('modal-fade-out');
                    pendingModal.classList.add('modal-fade-in');
                    delete pendingModal.dataset.temporaryHidden;
                }
                
                await refreshPendingAccountsModal();
            }
            
        } catch (error) {
            console.error('Error adding/updating user:', error);
            
            // 處理驗證錯誤 (422 狀態碼)
            if (error.status === 422 && error.data) {
                const errorData = error.data;
                if (errorData.detail) {
                    // Pydantic 驗證錯誤的詳細處理
                    if (Array.isArray(errorData.detail)) {
                        const validationErrors = errorData.detail.map(err => ({
                            field: mapErrorFieldToFormField(err.loc[err.loc.length - 1]),
                            message: err.msg
                        })).filter(err => err.field); // 只保留能對應到表單欄位的錯誤
                        
                        if (validationErrors.length > 0) {
                            displayFormErrors(validationErrors);
                            showToast('請修正表單錯誤', 'error');
                            return;
                        }
                    } else if (typeof errorData.detail === 'string') {
                        showToast(errorData.detail, 'error');
                        return;
                    }
                }
            }
            
            // 網路錯誤或其他系統錯誤
            if (error.name === 'TypeError' || error.message.includes('fetch')) {
                showToast('網路連線錯誤，請檢查網路狀態', 'error');
            } else {
                const isUpdateOperation = userId && userId !== '';
                const defaultErrorMessage = isUpdateOperation ? 
                    (isEdit ? '更新員工失敗' : '完成員工設定失敗') : 
                    '新增員工失敗';
                showToast(error.message || defaultErrorMessage, 'error');
            }
        }
    }
    
    
    /**
     * 顯示提示訊息
     */
    function showToast(message, type = 'info') {
        if (window.Dialog) {
            switch(type) {
                case 'success':
                    Dialog.success(message);
                    break;
                case 'error':
                    Dialog.error(message);
                    break;
                case 'warning':
                    Dialog.warning(message);
                    break;
                case 'info':
                default:
                    Dialog.info(message);
                    break;
            }
        } else if (window.CommonUI && window.CommonUI.showToast) {
            window.CommonUI.showToast(message, type);
        } else {
            console.warn('Dialog 元件未載入，訊息：', message);
        }
    }
    
    /**
     * 格式化日期時間
     */
    function formatDateTime(dateStr) {
        if (!dateStr) return '從未';
        const date = new Date(dateStr);
        return date.toLocaleString('zh-TW');
    }
    
    /**
     * 重新初始化員工模組（用於區塊切換）
     */
    async function reinitialize() {
        console.log('重新初始化員工管理模組開始');
        
        // 確保模組已初始化
        if (!isInitialized) {
            console.log('模組尚未初始化，先執行 init()');
            await init();
            return;
        }
        
        // 重新初始化子模組（僅初始化事件，不載入資料）
        if (window.OrganizationEmployeeTreeModule) {
            console.log('重新初始化員工樹狀結構模組');
            OrganizationEmployeeTreeModule.initWithoutLoad();
        } else {
            console.error('OrganizationEmployeeTreeModule 不存在!');
        }
        
        if (window.OrganizationEmployeeCardModule) {
            console.log('重新初始化員工卡片模組');
            OrganizationEmployeeCardModule.init();
        } else {
            console.error('OrganizationEmployeeCardModule 不存在!');
        }
        
        // 統一載入所有需要的資料
        console.log('載入部門和員工資料');
        await loadAllDataForReinitialization();
        
        // 重新初始化滾動條淡出淡入效果
        if (window.CommonUI && CommonUI.initScrollFadeEffect) {
            CommonUI.initScrollFadeEffect();
        }
        
        console.log('重新初始化員工管理模組完成');
    }
    
    /**
     * 為重新初始化載入所有資料（部門和員工）
     */
    async function loadAllDataForReinitialization() {
        try {
            const data = await CRUD.loadAllDataForReinitialization();
            
            // 更新內部用戶資料
            allUsers = data.allUsers;
            users = showInactiveUsers ? allUsers : allUsers.filter(u => u.is_active);
            
            console.log(`載入完成: ${data.departments.length} 個部門, ${allUsers.length} 位員工`);

            // 更新統計
            updateUserStatistics();

            // 將資料傳給樹模組渲染
            if (window.OrganizationEmployeeTreeModule) {
                console.log('傳遞資料給樹模組渲染');
                window.OrganizationEmployeeTreeModule.renderWithData(data.departments, allUsers);
            }

        } catch (error) {
            console.error('載入部門和員工資料失敗:', error);
            showToast('載入資料失敗', 'error');
        }
    }

    
    // ===== 待處理帳號管理功能 =====
    
    /**
     * 載入待處理帳號
     */
    async function loadPendingUsers() {
        try {
            pendingUsers = await CRUD.loadPendingUsers();
            console.log('載入待處理帳號:', pendingUsers.length, '個');
        } catch (error) {
            console.error('載入待處理帳號時發生錯誤:', error);
            pendingUsers = [];
        }
    }
    
    /**
     * 更新待處理帳號提醒橫幅
     */
    function updatePendingAccountsBanner() {
        const banner = document.getElementById('pendingAccountsBanner');
        const countEl = document.getElementById('pendingCount');
        
        if (!banner || !countEl) return;
        
        if (pendingUsers.length > 0 && !pendingBannerHidden) {
            countEl.textContent = pendingUsers.length;
            banner.style.display = 'block';
        } else {
            banner.style.display = 'none';
            
            // 如果沒有待處理帳號，重置隱藏狀態讓下次有帳號時能正常顯示
            if (pendingUsers.length === 0) {
                pendingBannerHidden = false;
            }
        }
    }
    
    /**
     * 重新載入並更新待處理帳號清單Modal
     */
    async function refreshPendingAccountsModal() {
        const modal = document.getElementById('pendingAccountsModal');
        const listContainer = document.getElementById('pendingAccountsList');
        
        if (!modal || !listContainer) {
            console.warn('待處理帳號Modal或清單容器不存在');
            return;
        }
        
        try {
            // 重新載入待處理帳號資料
            const response = await fetch('/api/organization/users/pending', {
                credentials: 'include'
            });
            
            if (response.ok) {
                const newPendingUsers = await response.json();
                
                // 更新內部陣列
                pendingUsers = newPendingUsers;
                
                console.log(`更新待處理帳號清單: ${pendingUsers.length} 個待處理帳號`);
                
                // 重新渲染清單
                if (pendingUsers.length === 0) {
                    listContainer.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-check-circle fa-3x text-success"></i>
                            <p class="text-success mt-3">沒有待處理的帳號</p>
                            <small class="text-muted">所有帳號都已完成設定</small>
                        </div>
                    `;
                } else {
                    let html = '';
                    pendingUsers.forEach(user => {
                        const statusBadge = getStatusBadge(user.status);
                        const missingFields = user.missing_fields || [];
                        
                        html += `
                            <div class="pending-account-card" data-loginid="${user.loginid}" data-username="${user.username || ''}" data-email="${user.email || ''}">
                                <div class="account-info">
                                    <div class="account-header">
                                        <h5>${user.loginid}</h5>
                                        ${statusBadge}
                                    </div>
                                    <div class="account-details">
                                        <p><strong>姓名：</strong>${user.username || '未設定'}</p>
                                        <p><strong>Email：</strong>${user.email || '未設定'}</p>
                                        <p><strong>部門：</strong>${user.department_name || '未設定'}</p>
                                        <p><strong>建立時間：</strong>${formatDate(user.created_at)}</p>
                                        ${missingFields.length > 0 ? `<p class="text-warning"><strong>缺少：</strong>${missingFields.join('、')}</p>` : ''}
                                    </div>
                                </div>
                                <div class="account-actions">
                                    <button class="btn btn-primary btn-sm" onclick="completeAccountSetup('${user.loginid}')">
                                        <i class="fas fa-user-plus"></i> 完成設定
                                    </button>
                                </div>
                            </div>
                        `;
                    });
                    
                    listContainer.innerHTML = html;
                }
                
                // 更新 pendingAccountsBanner
                updatePendingAccountsBanner();
                
                // 重新綁定搜尋事件
                setTimeout(bindPendingSearchEvents, 100);
                
                // 如果有搜尋條件，重新套用過濾
                const searchInput = document.getElementById('pendingAccountsSearch');
                if (searchInput && searchInput.value.trim()) {
                    filterPendingAccounts(searchInput.value.trim());
                }
                
            } else {
                console.error('重新載入待處理帳號失敗:', response.status);
                listContainer.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-triangle"></i>
                        更新清單失敗，請稍後再試
                    </div>
                `;
            }
        } catch (error) {
            console.error('重新載入待處理帳號時發生錯誤:', error);
            listContainer.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle"></i>
                    更新清單失敗，請稍後再試
                </div>
            `;
        }
    }
    
    /**
     * 檢查帳號狀態
     */
    async function checkAccountStatus(loginid) {
        if (!loginid || !loginid.trim()) {
            updateAccountStatusDisplay('', '');
            // 清空帳號欄位時也清空自動填充的資料
            clearAutoFilledData();
            return;
        }
        
        try {
            const data = await CRUD.checkAccountStatus(loginid);
            
            if (data) {
                updateAccountStatusDisplay(data.status, data);
                
                // 根據帳號狀態處理表單資料
                if (data.status === 'complete' && data.exists && data.hasEmployeeInfo) {
                    // 帳號存在且有完整資料，需要查詢完整資料後切換到編輯模式
                    console.log('檢測到完整帳號，查詢完整資料並切換到編輯模式');
                    await fetchFullUserDataAndSwitchToEditMode(data.user_id, data);
                } else if (data.status === 'no_extension' || data.status === 'no_department') {
                    // 帳號存在但資料不完整，保持新增模式介面，但記錄 user_id 以便使用 PUT 更新
                    const userIdField = document.getElementById('userId');
                    if (userIdField && data.user_id) {
                        userIdField.value = data.user_id;  // 記錄 user_id，讓儲存時使用 PUT 方法
                        console.log('記錄待處理帳號 user_id:', data.user_id);
                    }
                    
                    // 部分填充資料（維持新增模式介面）
                    clearAutoFilledData();
                    autoFillExistingData(data);
                } else if (data.status === 'not_found') {
                    // 新帳號，確保清空 user_id 和之前的自動填充資料
                    const userIdField = document.getElementById('userId');
                    if (userIdField) {
                        userIdField.value = '';  // 確保清空 user_id，使用 POST 新增
                    }
                    clearAutoFilledData();
                }
            } else {
                updateAccountStatusDisplay('', '');
                clearAutoFilledData();
            }
        } catch (error) {
            console.error('檢查帳號狀態失敗:', error);
            updateAccountStatusDisplay('error', { message: '檢查失敗' });
            // 發生錯誤時也清空自動填充資料
            clearAutoFilledData();
        }
    }
    
    /**
     * 重置到新增模式
     */
    function resetToAddMode() {
        console.log('重置到新增模式');
        
        // 清空帳號欄位並啟用輸入
        const loginIdField = document.getElementById('userLoginid');
        if (loginIdField) {
            loginIdField.value = '';
            loginIdField.disabled = false;
        }
        
        // 清空 userId（確保使用 POST 新增）
        const userIdField = document.getElementById('userId');
        if (userIdField) {
            userIdField.value = '';
        }
        
        // 清理表單模式標記
        const form = document.getElementById('userForm');
        if (form) {
            delete form.dataset.mode;
        }
        
        // 重置標題為新增模式
        const modalTitle = document.getElementById('employeeModalTitle');
        if (modalTitle) {
            modalTitle.textContent = '新增員工';
        }
        
        // 清空其他欄位的自動填充資料
        clearAutoFilledData();
        
        // 重置帳號狀態顯示
        updateAccountStatusDisplay('', '');
        
        // 重置密碼欄位為新增模式
        const passwordStrategy = document.getElementById('passwordStrategy');
        const passwordGroup = document.getElementById('manualPasswordGroup');
        const passwordField = document.getElementById('userPassword');
        
        if (passwordStrategy) passwordStrategy.value = 'MANUAL';
        if (passwordGroup) passwordGroup.style.display = 'block';
        if (passwordField) {
            passwordField.value = '';
            passwordField.placeholder = '請輸入密碼';
        }
        
        // 重置角色選擇狀態
        if (window.OrganizationEmployeeRolesModule) {
            OrganizationEmployeeRolesModule.resetRolesState();
        }
        
        // 重置權限選擇狀態
        if (window.OrganizationEmployeePermissionsModule) {
            OrganizationEmployeePermissionsModule.resetPermissions();
        }
        
        // 隱藏重置按鈕
        const resetBtn = document.getElementById('resetAccountBtn');
        if (resetBtn) {
            resetBtn.style.display = 'none';
        }
        
        // 清理帳號建議
        const accountSuggestions = document.getElementById('accountSuggestions');
        if (accountSuggestions) {
            accountSuggestions.style.display = 'none';
        }
        
        // 聚焦到帳號輸入欄位
        if (loginIdField) {
            setTimeout(() => {
                loginIdField.focus();
            }, 100);
        }
        
        console.log('已重置到新增模式');
    }
    
    /**
     * 更新帳號狀態顯示
     */
    function updateAccountStatusDisplay(status, data) {
        const icon = document.getElementById('accountStatusIcon');
        const hint = document.getElementById('accountStatusHint');
        const resetBtn = document.getElementById('resetAccountBtn');
        
        if (!icon || !hint) return;
        
        const iconEl = icon.querySelector('i');
        
        switch (status) {
            case 'edit_mode':
                // 透過編輯按鈕進入的編輯模式（不顯示返回按鈕）
                iconEl.className = 'fas fa-edit text-primary';
                iconEl.title = '編輯模式';
                hint.innerHTML = '<i class="fas fa-info-circle"></i> 編輯模式';
                hint.className = 'form-text text-primary';
                // 隱藏重置按鈕
                if (resetBtn) resetBtn.style.display = 'none';
                break;
                
            case 'complete':
                // 新增時檢測到已存在帳號（顯示返回按鈕）
                iconEl.className = 'fas fa-edit text-primary';
                iconEl.title = '已切換到編輯模式';
                hint.innerHTML = `
                    <i class="fas fa-info-circle"></i> 此帳號已存在，目前為編輯模式 
                    <button type="button" class="btn btn-sm btn-link text-primary" onclick="resetToAddMode()">
                        <i class="fas fa-undo"></i> 返回新增模式
                    </button>
                `;
                hint.className = 'form-text text-primary';
                // 顯示重置按鈕
                if (resetBtn) resetBtn.style.display = 'inline-block';
                break;
                
            case 'no_extension':
            case 'no_department':
                iconEl.className = 'fas fa-exclamation-circle text-warning';
                iconEl.title = '帳號存在但未完成設定';
                hint.textContent = `此帳號存在但${data.missing_fields ? '缺少：' + data.missing_fields.join('、') : '未完成設定'}`;
                hint.className = 'form-text text-warning';
                // 隱藏重置按鈕（此狀態下仍是新增模式）
                if (resetBtn) resetBtn.style.display = 'none';
                break;
                
            case 'not_found':
                iconEl.className = 'fas fa-plus-circle text-info';
                iconEl.title = '新帳號';
                hint.textContent = '將建立新帳號';
                hint.className = 'form-text text-info';
                // 隱藏重置按鈕
                if (resetBtn) resetBtn.style.display = 'none';
                break;
                
            case 'error':
                iconEl.className = 'fas fa-times-circle text-danger';
                iconEl.title = '檢查失敗';
                hint.textContent = data.message || '檢查失敗';
                hint.className = 'form-text text-danger';
                // 隱藏重置按鈕
                if (resetBtn) resetBtn.style.display = 'none';
                break;
                
            default:
                iconEl.className = 'fas fa-question-circle text-muted';
                iconEl.title = '檢查帳號狀態';
                hint.textContent = '';
                hint.className = 'form-text';
                // 隱藏重置按鈕
                if (resetBtn) resetBtn.style.display = 'none';
        }
    }
    
    /**
     * 查詢完整用戶資料並切換到編輯模式
     */
    async function fetchFullUserDataAndSwitchToEditMode(userId, basicData) {
        try {
            console.log('查詢用戶 ID:', userId, '的完整資料');
            const fullUserData = await CRUD.loadEmployeeDetail(userId);
            console.log('獲得完整用戶資料:', fullUserData);
            
            // 合併基本資料和完整資料（基本資料優先，因為它包含最新的檢查結果）
            const mergedData = {
                ...fullUserData,
                ...basicData,
                // 確保使用完整資料中的角色資訊
                primary_role_id: fullUserData.primary_role_id,
                department_roles: fullUserData.department_roles,
                permission_groups: fullUserData.permission_groups
            };
            
            // 先清空所有表單資料
            clearAllFormData();
            
            // 切換到編輯模式
            switchToEditMode(mergedData);
            // 填充資料（現在包含完整的角色資訊）
            autoFillExistingData(mergedData);
            
        } catch (error) {
            console.error('查詢完整用戶資料失敗:', error);
            // 降級處理：使用基本資料進行切換（但沒有角色資訊）
            
            // 先清空所有表單資料
            clearAllFormData();
            
            switchToEditMode(basicData);
            autoFillExistingData(basicData);
            
            // 顯示警告給使用者
            showToast('無法載入完整角色資料，請檢查角色設定', 'warning');
        }
    }

    /**
     * 切換到編輯模式
     */
    function switchToEditMode(userData) {
        console.log('切換到編輯模式，使用者資料:', userData);
        
        // 1. 設定為編輯模式
        const userIdField = document.getElementById('userId');
        if (userIdField) {
            // 支援多種 ID 欄位格式
            userIdField.value = userData.id || userData.user_id || '';
        }
        
        // 2. 更新模態框標題
        const modalTitle = document.getElementById('employeeModalTitle');
        if (modalTitle) {
            modalTitle.textContent = '編輯員工';
        }
        
        // 3. 禁用帳號欄位（編輯模式不能修改帳號）
        const loginidField = document.getElementById('userLoginid');
        if (loginidField) {
            loginidField.disabled = true;
        }
        
        // 4. 調整密碼欄位為選填
        const passwordStrategy = document.getElementById('passwordStrategy');
        const manualPasswordGroup = document.getElementById('manualPasswordGroup');
        const passwordField = document.getElementById('userPassword');
        
        if (passwordStrategy) {
            passwordStrategy.value = 'MANUAL';
        }
        if (manualPasswordGroup) {
            manualPasswordGroup.style.display = 'block';
        }
        if (passwordField) {
            passwordField.value = '';
            passwordField.placeholder = '不修改請留空';
            passwordField.required = false; // 編輯模式密碼選填
        }
        
        // 5. 標記表單為編輯模式
        const form = document.getElementById('userForm');
        if (form) {
            form.dataset.mode = 'edit';
        }
        
        console.log('已切換到編輯模式');
    }

    /**
     * 自動填充已存在的帳號資料
     */
    function autoFillExistingData(data) {
        const fields = {
            'userUsername': data.username,
            'userEmail': data.email,
            'userEmployeeNo': data.employee_no,
            'userTitle': data.title
        };
        
        Object.entries(fields).forEach(([fieldId, value]) => {
            const field = document.getElementById(fieldId);
            if (field && value !== undefined && value !== null) {
                field.value = value;
                // 標記為自動填充的欄位
                field.dataset.autoFilled = 'true';
                // 移除可能的錯誤狀態
                field.classList.remove('is-invalid');
            }
        });
        
        // 設定部門
        if (data.department_id) {
            const deptField = document.getElementById('userDepartment');
            if (deptField) {
                deptField.value = data.department_id;
                
                // 更新 searchable-select 顯示
                if (deptField._searchableSelect) {
                    deptField._searchableSelect.updateDisplay();
                } else if (deptField.searchableSelectInstance) {
                    deptField.searchableSelectInstance.updateDisplay();
                }
                
                // 標記部門為自動填充
                deptField.dataset.autoFilled = 'true';
                
                // 通知角色模組部門已變更
                if (window.OrganizationEmployeeRolesModule) {
                    OrganizationEmployeeRolesModule.onDepartmentChange(data.department_id);
                }
            }
        }
        
        // 設定帳號狀態（如果有的話）
        if (data.hasOwnProperty('is_active')) {
            const activeField = document.getElementById('userActive');
            if (activeField) {
                activeField.checked = data.is_active;
                activeField.dataset.autoFilled = 'true';
            }
        }
        
        // 延遲載入角色和權限資料（確保部門選擇器已更新）
        setTimeout(async () => {
            // 設定部門角色（如果有的話）
            if (data.primary_role_id || (data.department_roles && data.department_roles.length > 0)) {
                if (window.OrganizationEmployeeRolesModule) {
                    // 先重新載入部門角色選項（確保編輯模式下角色選項已載入）
                    if (data.department_id) {
                        console.log('重新載入部門角色選項，部門ID:', data.department_id);
                        await OrganizationEmployeeRolesModule.onDepartmentChange(data.department_id);
                    }
                    
                    console.log('設定角色資料:', {
                        primary_role_id: data.primary_role_id,
                        department_roles: data.department_roles
                    });
                    
                    // 然後設定選中的角色
                    OrganizationEmployeeRolesModule.setSelectedRoles({
                        primary_role_id: data.primary_role_id,
                        department_roles: data.department_roles
                    });
                }
            } else {
                console.log('未找到角色資料，primary_role_id:', data.primary_role_id, 'department_roles:', data.department_roles);
            }
            
            // 設定權限群組（如果有的話）
            if (data.permission_groups && data.permission_groups.length > 0) {
                const permissionIds = data.permission_groups.map(p => 
                    typeof p === 'object' ? p.id : p
                ).filter(id => id);
                
                console.log('設定權限群組:', permissionIds);
                
                if (window.OrganizationEmployeePermissionsModule) {
                    OrganizationEmployeePermissionsModule.setSelectedPermissions(permissionIds);
                }
            }
        }, 300);
    }
    
    /**
     * 完全清空表單所有資料（用於切換到編輯模式時）
     */
    function clearAllFormData() {
        console.log('清空所有表單資料');
        
        // 清空基本欄位（除了帳號欄位）
        const basicFields = ['userUsername', 'userEmail', 'userEmployeeNo', 'userTitle'];
        basicFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.value = '';
                field.classList.remove('is-invalid');
                delete field.dataset.autoFilled;
            }
        });
        
        // 清空部門選擇（除非有預選的部門）
        const deptField = document.getElementById('userDepartment');
        if (deptField) {
            deptField.value = '';
            if (deptField._searchableSelect) {
                deptField._searchableSelect.updateDisplay();
            }
            delete deptField.dataset.autoFilled;
        }
        
        // 清空帳號狀態
        const activeField = document.getElementById('userActive');
        if (activeField) {
            activeField.checked = true; // 預設為啟用
            delete activeField.dataset.autoFilled;
        }
        
        // 重置角色選擇
        if (window.OrganizationEmployeeRolesModule) {
            OrganizationEmployeeRolesModule.resetRolesState();
        }
        
        // 重置權限選擇
        if (window.OrganizationEmployeePermissionsModule) {
            OrganizationEmployeePermissionsModule.resetPermissions();
        }
        
        // 清除所有錯誤訊息
        clearFormErrors();
        
        console.log('已清空所有表單資料');
    }

    /**
     * 清空自動填充的資料（保留手動輸入的帳號和選擇的部門）
     */
    function clearAutoFilledData() {
        // 清空標記為自動填充的基本欄位
        const autoFilledFields = document.querySelectorAll('[data-auto-filled="true"]');
        autoFilledFields.forEach(field => {
            // 如果是部門欄位，檢查是否有手動選擇的部門
            if (field.id === 'userDepartment' && selectedDepartmentId) {
                // 保留從部門樹選擇的部門，但移除自動填充標記
                delete field.dataset.autoFilled;
                return;
            }
            
            // 清空其他自動填充的欄位
            if (field.type === 'text' || field.type === 'email') {
                field.value = '';
            } else if (field.tagName === 'SELECT') {
                field.value = '';
                // 更新 searchable-select 顯示
                if (field._searchableSelect) {
                    field._searchableSelect.updateDisplay();
                }
            }
            
            // 移除自動填充標記和錯誤狀態
            delete field.dataset.autoFilled;
            field.classList.remove('is-invalid');
        });
        
        // 重置角色選擇（如果沒有保留部門的話）
        if (window.OrganizationEmployeeRolesModule) {
            // 如果清空了部門，重置角色選擇
            const deptField = document.getElementById('userDepartment');
            if (!deptField.value || deptField.value === '') {
                OrganizationEmployeeRolesModule.resetRolesState();
            }
        }
        
        // 重置權限選擇
        if (window.OrganizationEmployeePermissionsModule) {
            OrganizationEmployeePermissionsModule.resetPermissions();
        }
        
        console.log('已清空自動填充的資料');
    }
    
    /**
     * 防抖動帳號檢查
     */
    function debounceAccountCheck(loginid) {
        if (checkTimeout) {
            clearTimeout(checkTimeout);
        }
        checkTimeout = setTimeout(() => checkAccountStatus(loginid), 500);
    }
    
    /**
     * 載入待處理帳號並顯示在新增員工模態框
     */
    async function loadPendingAccountSuggestions() {
        await loadPendingUsers();
        
        if (pendingUsers.length > 0) {
            const suggestions = document.getElementById('accountSuggestions');
            const select = document.getElementById('suggestedAccountSelect');
            
            if (suggestions && select) {
                // 清空現有選項
                select.innerHTML = '<option value="">選擇現有帳號...</option>';
                
                // 新增待處理帳號選項
                pendingUsers.forEach(user => {
                    const option = document.createElement('option');
                    option.value = user.loginid;
                    option.textContent = `${user.loginid} - ${user.username || '未設定姓名'}`;
                    option.dataset.userData = JSON.stringify(user);
                    select.appendChild(option);
                });
                
                suggestions.style.display = 'block';
            }
        }
    }

    // 公開 API
    return {
        init,
        loadUsers,
        loadEmployeesByDept,
        showEmployeeDetail,
        editUser,
        editEmployee: editUser,  // 添加別名，讓組織樹模組也能正常呼叫
        resetUserPassword,
        toggleUserStatus,
        updateUserStatistics,  // 保留原有功能
        reinitialize,  // 新增重新初始化方法
        isInitialized: () => isInitialized,  // 暴露初始化狀態
        // 懸浮卡片功能委託到子模組
        showEmployeeHoverCard: function(deptId) {
            if (window.OrganizationEmployeeHoverCardModule) {
                return OrganizationEmployeeHoverCardModule.showEmployeeHoverCard(deptId);
            }
            console.warn('OrganizationEmployeeHoverCardModule 不存在');
        },
        showAddUserModal,  // 暴露新增用戶模態框函數
        showAddUserModalForPending,  // 暴露待處理帳號專用的新增用戶模態框函數
        saveEmployee: handleAddUser,  // 暴露儲存員工函數
        closeEmployeeModal: function() {
            const modal = document.getElementById('employeeModal');
            if (modal) {
                // 檢查是否是從待處理帳號清單開啟的
                const form = document.getElementById('userForm');
                const isFromPending = form && form.dataset.fromPending === 'true';
                
                // 關閉員工模態框
                modal.classList.remove('show');
                document.body.classList.remove('modal-open');
                
                // 如果是從待處理帳號清單開啟，恢復待處理帳號清單的顯示
                if (isFromPending) {
                    const pendingModal = document.getElementById('pendingAccountsModal');
                    if (pendingModal && pendingModal.dataset.temporaryHidden === 'true') {
                        pendingModal.classList.remove('modal-fade-out');
                        pendingModal.classList.add('modal-fade-in');
                        delete pendingModal.dataset.temporaryHidden;
                    }
                }
            }
        },
        toggleInactiveEmployees: function() {
            showInactiveUsers = !showInactiveUsers;
            loadUsers();
            
            // 更新樹狀結構
            if (window.OrganizationEmployeeTreeModule) {
                OrganizationEmployeeTreeModule.toggleInactive();
            }
        },
        // 部門選擇管理函數
        setSelectedDepartment,
        clearSelectedDepartment,
        updateAddEmployeeButtonState,
        // 待處理帳號相關
        loadPendingUsers,
        checkAccountStatus,
        debounceAccountCheck,
        loadPendingAccountSuggestions,
        refreshPendingAccountsModal,  // 新增：暴露待處理帳號清單更新函數
        updatePendingAccountsBanner,  // 暴露待處理帳號橫幅更新函數
        // Badge 相關函數委託到懸浮卡片子模組
        generateEmployeeBadges: function(roleList, permissionList) {
            if (window.OrganizationEmployeeHoverCardModule) {
                return OrganizationEmployeeHoverCardModule.generateEmployeeBadges(roleList, permissionList);
            }
            console.warn('OrganizationEmployeeHoverCardModule 不存在');
            return '';
        },
        bindEmployeeBadgeEvents: function() {
            if (window.OrganizationEmployeeHoverCardModule) {
                return OrganizationEmployeeHoverCardModule.bindEmployeeBadgeEvents();
            }
            console.warn('OrganizationEmployeeHoverCardModule 不存在');
        },
        // 模式切換相關
        resetToAddMode,
        // 停用對話框相關函數
        closeEmployeeDeactivateModal,
        confirmEmployeeDeactivate
    };
})();

// 確保模組可被存取
if (typeof OrganizationEmployeeModule === 'undefined') {
    var OrganizationEmployeeModule = window.OrganizationEmployeeModule;
}

// 全域函數供 HTML onclick 使用
window.closeEmployeeModal = function() {
    if (window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.closeEmployeeModal) {
        window.OrganizationEmployeeModule.closeEmployeeModal();
    }
};

window.saveEmployee = function() {
    if (window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.saveEmployee) {
        window.OrganizationEmployeeModule.saveEmployee();
    }
};

// 重置到新增模式的全域函數
window.resetToAddMode = function() {
    if (window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.resetToAddMode) {
        window.OrganizationEmployeeModule.resetToAddMode();
    }
};

// 員工詳情相關全域函數
window.closeEmployeeDetailModal = function() {
    const modal = document.getElementById('employeeDetailModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.classList.remove('modal-open');
    }
};

window.editEmployeeFromDetail = function() {
    // 從詳情模態框跳轉到編輯模態框
    const detailModal = document.getElementById('employeeDetailModal');
    const empId = detailModal?.dataset.empId;
    
    if (empId && window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.editUser) {
        closeEmployeeDetailModal();
        window.OrganizationEmployeeModule.editUser(parseInt(empId));
    }
};

// 待處理帳號相關全域函數
window.checkAccountStatus = function(loginid) {
    if (window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.checkAccountStatus) {
        window.OrganizationEmployeeModule.checkAccountStatus(loginid);
    }
};

window.debounceAccountCheck = function(loginid) {
    if (window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.debounceAccountCheck) {
        window.OrganizationEmployeeModule.debounceAccountCheck(loginid);
    }
};

window.fillAccountInfo = function(loginid) {
    if (!loginid) return;
    
    const option = document.querySelector(`#suggestedAccountSelect option[value="${loginid}"]`);
    if (option && option.dataset.userData) {
        const userData = JSON.parse(option.dataset.userData);
        
        // 填充表單
        const fields = {
            'userLoginid': userData.loginid,
            'userUsername': userData.username,
            'userEmail': userData.email,
            'userEmployeeNo': userData.employee_no,
            'userTitle': userData.title
        };
        
        Object.entries(fields).forEach(([fieldId, value]) => {
            const field = document.getElementById(fieldId);
            if (field && value) {
                field.value = value;
            }
        });
        
        // 觸發帳號檢查
        if (window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.checkAccountStatus) {
            window.OrganizationEmployeeModule.checkAccountStatus(userData.loginid);
        }
    }
};

window.showPendingAccountsModal = async function() {
    const modal = document.getElementById('pendingAccountsModal');
    const listContainer = document.getElementById('pendingAccountsList');
    
    if (!modal || !listContainer) return;
    
    // 顯示模態框
    modal.classList.add('show');
    document.body.classList.add('modal-open');
    
    try {
        // 載入最新資料
        const response = await fetch('/api/organization/users/pending', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const pendingUsers = await response.json();
            
            // 渲染清單
            if (pendingUsers.length === 0) {
                listContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-check-circle fa-3x text-success"></i>
                        <p class="text-success mt-3">太棒了！沒有待處理的帳號</p>
                        <small class="text-muted">所有帳號都已完成設定</small>
                    </div>
                `;
            } else {
                let html = '';
                pendingUsers.forEach(user => {
                    const statusBadge = getStatusBadge(user.status);
                    const missingFields = user.missing_fields || [];
                    
                    html += `
                        <div class="pending-account-card" data-loginid="${user.loginid}" data-username="${user.username || ''}" data-email="${user.email || ''}">
                            <div class="account-info">
                                <div class="account-header">
                                    <h5>${user.loginid}</h5>
                                    ${statusBadge}
                                </div>
                                <div class="account-details">
                                    <p><strong>姓名：</strong>${user.username || '未設定'}</p>
                                    <p><strong>Email：</strong>${user.email || '未設定'}</p>
                                    <p><strong>部門：</strong>${user.department_name || '未設定'}</p>
                                    <p><strong>建立時間：</strong>${formatDate(user.created_at)}</p>
                                    ${missingFields.length > 0 ? `<p class="text-warning"><strong>缺少：</strong>${missingFields.join('、')}</p>` : ''}
                                </div>
                            </div>
                            <div class="account-actions">
                                <button class="btn btn-success btn-sm" onclick="completeAccountSetup('${user.loginid}')">
                                    <i class="fas fa-user-plus"></i> 完成設定
                                </button>
                            </div>
                        </div>
                    `;
                });
                
                listContainer.innerHTML = html;
            }
            
            // 綁定搜尋事件
            setTimeout(bindPendingSearchEvents, 100);
        } else {
            listContainer.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle"></i>
                    載入失敗，請稍後再試
                </div>
            `;
        }
    } catch (error) {
        console.error('載入待處理帳號失敗:', error);
        listContainer.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle"></i>
                載入失敗，請稍後再試
            </div>
        `;
    }
};


window.closePendingAccountsModal = function() {
    const modal = document.getElementById('pendingAccountsModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.classList.remove('modal-open');
    }
};

window.hidePendingBanner = function() {
    const banner = document.getElementById('pendingAccountsBanner');
    if (banner) {
        banner.style.display = 'none';
    }
};

window.completeAccountSetup = function(loginid) {
    // 淡出待處理帳號清單，避免層級問題
    const pendingModal = document.getElementById('pendingAccountsModal');
    if (pendingModal) {
        pendingModal.classList.remove('modal-fade-in');
        pendingModal.classList.add('modal-fade-out');
        // 設定標記表示被暫時隱藏
        pendingModal.dataset.temporaryHidden = 'true';
    }
    
    // 使用專門的待處理帳號模態框函數，跳過部門選擇檢查
    if (window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.showAddUserModalForPending) {
        window.OrganizationEmployeeModule.showAddUserModalForPending(true); // 傳遞 fromPending=true
        
        // 等待模態框開啟後填入帳號
        setTimeout(() => {
            const loginidField = document.getElementById('userLoginid');
            if (loginidField) {
                loginidField.value = loginid;
                loginidField.focus();
                // 觸發檢查
                if (window.checkAccountStatus) {
                    window.checkAccountStatus(loginid);
                }
            }
        }, 100);
    }
};

// 輔助函數
function getStatusBadge(status) {
    switch (status) {
        case 'no_extension':
            return '<span class="badge badge-warning">缺少員工資訊</span>';
        case 'no_department':
            return '<span class="badge badge-info">缺少部門</span>';
        case 'complete':
            return '<span class="badge badge-success">已完成</span>';
        default:
            return '<span class="badge badge-secondary">未知狀態</span>';
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '未知';
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-TW') + ' ' + date.toLocaleTimeString('zh-TW');
}

/**
 * 搜尋待處理帳號（全域函數供HTML onclick使用）
 */
window.searchPendingAccounts = function() {
    const searchInput = document.getElementById('pendingAccountsSearch');
    if (searchInput) {
        filterPendingAccounts(searchInput.value.trim());
    }
};

/**
 * 綁定搜尋事件
 */
function bindPendingSearchEvents() {
    const searchInput = document.getElementById('pendingAccountsSearch');
    if (searchInput) {
        // 清除舊的事件監聽器（如果有的話）
        searchInput.removeEventListener('input', searchInputHandler);
        searchInput.removeEventListener('keypress', searchKeypressHandler);
        
        // 重新綁定事件
        searchInput.addEventListener('input', searchInputHandler);
        searchInput.addEventListener('keypress', searchKeypressHandler);
        
        console.log('已綁定待處理帳號搜尋事件');
    }
}

// 搜尋輸入處理函數（使用防抖動）
let searchTimeout;
function searchInputHandler() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        filterPendingAccounts(this.value.trim());
    }, 100);
}

// 搜尋按鍵處理函數
function searchKeypressHandler(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        filterPendingAccounts(this.value.trim());
    }
}

/**
 * 過濾待處理帳號清單（優化版本）
 */
function filterPendingAccounts(searchTerm) {
    const cards = document.querySelectorAll('.pending-account-card');
    const statsContainer = document.querySelector('.search-stats');
    const countEl = document.getElementById('pendingSearchResultCount');
    
    // 使用 requestAnimationFrame 來批次處理 DOM 更新，提升效能
    requestAnimationFrame(() => {
        if (!searchTerm) {
            // 如果沒有搜尋條件，顯示所有卡片
            cards.forEach(card => {
                card.classList.remove('search-hidden');
            });
            
            // 隱藏搜尋統計
            if (statsContainer) {
                statsContainer.style.display = 'none';
            }
            return;
        }
        
        const term = searchTerm.toLowerCase();
        let visibleCount = 0;
        
        // 批次處理所有卡片
        cards.forEach(card => {
            const loginid = (card.dataset.loginid || '').toLowerCase();
            const username = (card.dataset.username || '').toLowerCase();
            const email = (card.dataset.email || '').toLowerCase();
            
            const matches = loginid.includes(term) || 
                           username.includes(term) || 
                           email.includes(term);
            
            if (matches) {
                card.classList.remove('search-hidden');
                visibleCount++;
            } else {
                card.classList.add('search-hidden');
            }
        });
        
        // 更新並顯示搜尋統計
        if (countEl) {
            countEl.textContent = visibleCount;
        }
        if (statsContainer) {
            statsContainer.style.display = 'block';
        }
    });
}

// 原本的 DOMContentLoaded 事件監聽已移除，改由 bindPendingSearchEvents 函數在適當時機綁定事件

// 新增全域函數暴露，確保外部可以呼叫 refreshPendingAccountsModal
window.refreshPendingAccountsModal = async function() {
    if (window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.refreshPendingAccountsModal) {
        return await window.OrganizationEmployeeModule.refreshPendingAccountsModal();
    } else {
        console.error('OrganizationEmployeeModule.refreshPendingAccountsModal 不存在');
    }
};