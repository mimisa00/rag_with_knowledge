/**
 * 組織管理 - 員工模態框管理模組
 * 負責所有員工相關的模態框顯示、管理和互動功能
 */
window.OrganizationEmployeeModalModule = (function() {
    'use strict';
    
    // 模組內部狀態
    let mainModule = null;
    let checkTimeout = null;
    
    /**
     * 將本地時間轉換為 UTC ISO 字串（修正時區偏移）
     * @param {Date} localDate - 本地時間日期對象
     * @returns {string} - UTC ISO 字串
     */
    function convertLocalTimeToUTC(localDate) {
        // 獲取時區偏移量（分鐘）
        const timezoneOffset = localDate.getTimezoneOffset();
        
        // 創建一個新的日期對象，補償時區偏移
        const utcDate = new Date(localDate.getTime() - (timezoneOffset * 60 * 1000));
        
        // 返回 UTC ISO 字串
        return utcDate.toISOString();
    }
    
    /**
     * 初始化模組
     * @param {Object} employeeModule - 主模組參考
     */
    function init(employeeModule) {
        mainModule = employeeModule;
        bindModalEvents();
        console.log('OrganizationEmployeeModalModule 初始化完成');
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
    }
    
    /**
     * 顯示新增用戶 Modal
     */
    function showAddUserModal(selectedDepartmentId) {
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
            
            // 密碼策略將在表單選項載入後設定
            document.getElementById('userPassword').value = mainModule.generateRandomPassword();
            document.getElementById('userPassword').placeholder = '請輸入密碼';
            
            // 載入表單選項
            if (mainModule && mainModule.loadUserFormOptions) {
                mainModule.loadUserFormOptions();
            }
            fetchAndDisplayActivationExpiry();
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
                
                // 設定密碼策略預設值為啟用連結並禁用編輯（在 SearchableSelect 初始化後）
                const passwordStrategySelect = document.getElementById('passwordStrategy');
                if (passwordStrategySelect) {
                    passwordStrategySelect.value = 'ACTIVATION_LINK';
                    passwordStrategySelect.disabled = true;
                    
                    // 更新 SearchableSelect 顯示
                    if (passwordStrategySelect.searchableSelectInstance) {
                        passwordStrategySelect.searchableSelectInstance.updateDisplay();
                    }
                    
                    // 更新密碼欄位提示文字
                    const passwordField = document.getElementById('userPassword');
                    if (passwordField && passwordStrategySelect.value === 'ACTIVATION_LINK') {
                        passwordField.placeholder = '（將自動生成，無需填寫）';
                        passwordField.value = mainModule.generateRandomPassword(); // 清空欄位
                    }
                    
                    // 觸發密碼策略切換
                    if (window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.togglePasswordField) {
                        window.OrganizationEmployeeModule.togglePasswordField();
                    }
                    
                    // 顯示啟用連結有效期限提示
                    fetchAndDisplayActivationExpiry();
                }
                
                // 初始化帳號狀態選擇器（新增模式）
                if (window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.initAccountStatusSelector) {
                    window.OrganizationEmployeeModule.initAccountStatusSelector(true, true);
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
            
            // 密碼策略將在表單選項載入後設定
            document.getElementById('userPassword').value = '';
            document.getElementById('userPassword').placeholder = '請輸入密碼';
            
            // 載入表單選項
            if (mainModule && mainModule.loadUserFormOptions) {
                mainModule.loadUserFormOptions();
            }
            
            // 延遲設定密碼策略和初始化狀態選擇器 - 確保表單已就緒
            setTimeout(() => {
                // 設定密碼策略預設值為啟用連結並禁用編輯（在 SearchableSelect 初始化後）
                const passwordStrategySelect = document.getElementById('passwordStrategy');
                if (passwordStrategySelect) {
                    passwordStrategySelect.value = 'ACTIVATION_LINK';
                    passwordStrategySelect.disabled = true;
                    
                    // 更新 SearchableSelect 顯示
                    if (passwordStrategySelect.searchableSelectInstance) {
                        passwordStrategySelect.searchableSelectInstance.updateDisplay();
                    }
                    
                    // 更新密碼欄位提示文字
                    const passwordField = document.getElementById('userPassword');
                    if (passwordField && passwordStrategySelect.value === 'ACTIVATION_LINK') {
                        passwordField.placeholder = '（將自動生成，無需填寫）';
                        passwordField.value = ''; // 清空欄位
                    }
                    
                    // 觸發密碼策略切換
                    if (window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.togglePasswordField) {
                        window.OrganizationEmployeeModule.togglePasswordField();
                    }
                }
                
                // 初始化帳號狀態選擇器（新增模式）
                if (window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.initAccountStatusSelector) {
                    window.OrganizationEmployeeModule.initAccountStatusSelector(true, true);
                }
            }, 200);  // 增加延遲確保 searchable-select 已初始化
            
            modal.classList.add('show');
            document.body.classList.add('modal-open');
        }
    }
    
    /**
     * 編輯用戶
     */
    async function editUser(userId, allUsers) {
        const user = allUsers.find(u => (u.user_id || u.id) === userId);
        if (!user) {
            showToast('找不到該用戶', 'error');
            return;
        }
        console.info("---------------------")
        console.info(user)
        
        // 載入表單選項
        if (mainModule && mainModule.loadUserFormOptions) {
            await mainModule.loadUserFormOptions();
        }
        
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
        
        // 根據員工狀態處理密碼設定顯示
        const passwordFieldset = Array.from(document.querySelectorAll('#userForm fieldset')).find(fs => 
            fs.querySelector('legend')?.textContent?.trim() === '密碼設定');

        if (user.is_active) {
            // 啟用狀態：隱藏整個密碼設定區塊
            if (passwordFieldset) {
                passwordFieldset.style.display = 'none';
            }
        } else {
            // 停用狀態：顯示密碼設定但固定為啟用連結模式
            if (passwordFieldset) {
                passwordFieldset.style.display = 'block';
            }
            
            const passwordStrategySelect = document.getElementById('passwordStrategy');
            const manualPasswordGroup = document.getElementById('manualPasswordGroup');
            
            if (passwordStrategySelect) {
                passwordStrategySelect.value = 'ACTIVATION_LINK';
                passwordStrategySelect.disabled = true;
                
                // 更新 SearchableSelect 顯示（如果已初始化）
                if (passwordStrategySelect.searchableSelectInstance) {
                    passwordStrategySelect.searchableSelectInstance.updateDisplay();
                }
            }
            
            if (manualPasswordGroup) {
                manualPasswordGroup.style.display = 'none';
            }
            
            // 手動設定密碼策略資訊顯示（避免調用 togglePasswordField 造成錯誤）
            const passwordStrategyInfo = document.getElementById('passwordStrategyInfo');
            if (passwordStrategyInfo) {
                passwordStrategyInfo.innerHTML = `
                    <div class="alert alert-info">
                        <i class="fas fa-envelope"></i>
                        <span>系統將自動發送啟用連結至用戶郵箱</span>
                    </div>
                `;
            }
        }
        
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
                
                if (mainModule && mainModule.setSelectedPermissions) {
                    mainModule.setSelectedPermissions(permissionIds);
                }
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
            
            // 初始化帳號狀態選擇器（編輯模式）
            if (window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.initAccountStatusSelector) {
                const isCurrentlyActive = user.is_active !== false && user.is_active !== 0;
                window.OrganizationEmployeeModule.initAccountStatusSelector(false, isCurrentlyActive);
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
        
        // 保存完整用戶資料供編輯使用
        modal.dataset.userData = JSON.stringify(user);
        
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
                    <button class="modal-close" id="employeeDetailCloseBtn">
                        <i class="fa-solid fa-times"></i>
                    </button>
                </div>
                <div class="modal-body scrollable-fade">
                    <div id="employeeDetailContent">
                        <!-- 動態載入內容 -->
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" id="employeeDetailEditBtn">
                        <i class="fas fa-edit"></i> 編輯員工
                    </button>
                    <button class="btn btn-secondary" id="employeeDetailCloseBtn2">關閉</button>
                </div>
            </div>
        `;
        
        // 添加到 body
        document.body.appendChild(modal);
        
        // 綁定事件處理器
        const closeBtn = modal.querySelector('#employeeDetailCloseBtn');
        const closeBtn2 = modal.querySelector('#employeeDetailCloseBtn2');
        const editBtn = modal.querySelector('#employeeDetailEditBtn');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                closeEmployeeDetailModal();
            });
        }
        
        if (closeBtn2) {
            closeBtn2.addEventListener('click', function() {
                closeEmployeeDetailModal();
            });
        }
        
        if (editBtn) {
            editBtn.addEventListener('click', function() {
                editEmployeeFromDetail();
            });
        }
        
        // 不要綁定點擊外部關閉的事件
        // modal.addEventListener('click', function(e) {
        //     if (e.target === this) {
        //         this.classList.remove('show');
        //         document.body.classList.remove('modal-open');
        //     }
        // });
        
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
        const lastLogin = formatDateTime(user.last_login_at);
        
        // 判斷帳號狀態（包含排程）
        const now = new Date();
        const isActive = user.is_active;
        const activationScheduled = user.user_extension.activation_scheduled ? new Date(user.user_extension.activation_scheduled) : null;
        const activationExpires = user.user_extension.activation_expires ? new Date(user.user_extension.activation_expires) : null;
        
        let statusInfo = {
            text: isActive ? '啟用' : '停用',
            class: isActive ? 'badge-success' : 'badge-danger',
            icon: isActive ? 'check-circle' : 'times-circle',
            hasSchedule: false,
            scheduleText: '',
            scheduleClass: ''
        };
        
        // 檢查排程狀態
        if (activationScheduled && activationScheduled > now) {
            statusInfo.text = '停用中（排程啟用）';
            statusInfo.class = 'badge-warning';
            statusInfo.icon = 'clock';
            statusInfo.hasSchedule = true;
            statusInfo.scheduleText = `將於 ${formatDateTime(activationScheduled)} 自動啟用`;
            statusInfo.scheduleClass = 'text-primary';
        } else if (activationExpires && activationExpires > now && isActive) {
            statusInfo.text = '啟用中（排程停用）';
            statusInfo.class = 'badge-info';
            statusInfo.icon = 'clock';
            statusInfo.hasSchedule = true;
            statusInfo.scheduleText = `將於 ${formatDateTime(activationExpires)} 自動停用`;
            statusInfo.scheduleClass = 'text-warning';
        }
        
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
        
        // 處理系統權限群組（合併個人權限和角色權限）
        let permissionGroupsHtml = '';
        
        // 取得個人權限
        const directPermissions = user.permission_groups || [];
        
        // 取得角色權限
        const rolePermissions = user.role_permission_groups || [];
        
        // 合併權限（去重）
        const allPermissions = [];
        const permissionMap = new Map();
        
        // 添加個人權限
        directPermissions.forEach(perm => {
            const permId = typeof perm === 'object' ? perm.id : perm;
            const permName = typeof perm === 'object' ? perm.name : perm;
            const permLevel = typeof perm === 'object' ? perm.level : 0;
            const permType = typeof perm === 'object' ? perm.permission_type : 'user';
            
            permissionMap.set(permId, {
                id: permId,
                name: permName,
                level: permLevel,
                type: permType,
                source: 'personal'
            });
        });
        
        // 添加角色權限（不覆蓋個人權限）
        rolePermissions.forEach(perm => {
            const permId = typeof perm === 'object' ? perm.id : perm;
            const permName = typeof perm === 'object' ? perm.name : perm;
            const permLevel = typeof perm === 'object' ? perm.level : 0;
            const permType = typeof perm === 'object' ? perm.permission_type : 'user';
            
            if (!permissionMap.has(permId)) {
                permissionMap.set(permId, {
                    id: permId,
                    name: permName,
                    level: permLevel,
                    type: permType,
                    source: 'role'
                });
            }
        });
        
        // 轉換為陣列並排序
        const mergedPermissions = Array.from(permissionMap.values()).sort((a, b) => {
            // 按權限類型排序：admin > manager > user > other
            const typeOrder = { 'admin': 0, 'manager': 1, 'user': 2 };
            const aOrder = typeOrder[a.type] ?? 3;
            const bOrder = typeOrder[b.type] ?? 3;
            if (aOrder !== bOrder) return aOrder - bOrder;
            return a.name.localeCompare(b.name, 'zh-TW');
        });
        
        if (mergedPermissions.length > 0) {
            permissionGroupsHtml = mergedPermissions.map(perm => {
                const sourceIcon = perm.source === 'personal' ? 'user' : 'users-cog';
                const sourceText = perm.source === 'personal' ? '個人權限' : '角色權限';
                const badgeClass = perm.source === 'personal' ? 'badge-info' : 'badge-secondary';
                
                return `
                    <span class="badge ${badgeClass}" title="${sourceText} - 權限等級: ${perm.level}">
                        <i class="fas fa-${sourceIcon}"></i>
                        ${perm.name}
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
                                <span class="badge ${statusInfo.class}">
                                    <i class="fas fa-${statusInfo.icon}"></i>
                                    ${statusInfo.text}
                                </span>
                            </div>
                        </div>
                        ${statusInfo.hasSchedule ? `
                        <div class="detail-item">
                            <label>排程資訊</label>
                            <div class="detail-value">
                                <span class="${statusInfo.scheduleClass}">
                                    <i class="fas fa-clock"></i>
                                    ${statusInfo.scheduleText}
                                </span>
                            </div>
                        </div>
                        ` : ''}
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
     * 顯示員工停用確認對話框
     */
    function showEmployeeDeactivateModal(userId, allUsers) {
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
                if (mainModule && mainModule.executeUserStatusChange) {
                    await mainModule.executeUserStatusChange(userId, false, null);
                }
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
                
                if (mainModule && mainModule.executeUserStatusChange) {
                    await mainModule.executeUserStatusChange(userId, true, scheduledDate); // 排程停用：保持啟用狀態並設定過期時間
                }
            }
            
            // 關閉對話框
            closeEmployeeDeactivateModal();
            
        } catch (error) {
            console.error('停用員工失敗:', error);
            showToast('停用員工失敗', 'error');
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
                
                console.log(`更新待處理帳號清單: ${newPendingUsers.length} 個待處理帳號`);
                
                // 重新渲染清單
                if (newPendingUsers.length === 0) {
                    listContainer.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-check-circle fa-3x text-success"></i>
                            <p class="text-success mt-3">沒有待處理的帳號</p>
                            <small class="text-muted">所有帳號都已完成設定</small>
                        </div>
                    `;
                } else {
                    let html = '';
                    newPendingUsers.forEach(user => {
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
                mainModule.updatePendingAccountsBanner();
                
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
                
            case 'no_primary_role':    
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
     * 關閉員工 Modal
     */
    function closeEmployeeModal() {
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
    }
    
    /**
     * 關閉員工詳情 Modal
     */
    function closeEmployeeDetailModal() {
        const modal = document.getElementById('employeeDetailModal');
        if (modal) {
            modal.classList.remove('show');
            document.body.classList.remove('modal-open');
        }
    }
    
    /**
     * 從詳情模態框跳轉到編輯模態框
     */
    function editEmployeeFromDetail() {
        const detailModal = document.getElementById('employeeDetailModal');
        const userData = detailModal?.dataset.userData;
        const empId = detailModal?.dataset.empId;
        
        if (userData) {
            try {
                // 解析保存的完整用戶資料
                const user = JSON.parse(userData);
                
                // 關閉詳情模態框
                closeEmployeeDetailModal();
                
                // 使用完整的用戶資料呼叫 editUser
                setTimeout(() => {
                    // 傳遞用戶資料作為單一元素的陣列
                    editUser(user.id || user.user_id, [user]);
                }, 100);
            } catch (error) {
                console.error('解析用戶資料失敗:', error);
                
                // 降級處理：如果解析失敗，使用主模組的方法
                if (empId && mainModule && mainModule.editUser) {
                    closeEmployeeDetailModal();
                    setTimeout(() => {
                        mainModule.editUser(parseInt(empId));
                    }, 100);
                }
            }
        } else if (empId && mainModule && mainModule.editUser) {
            // 降級處理：如果沒有保存的資料，使用主模組的方法
            console.warn('沒有保存的用戶資料，使用主模組方法');
            closeEmployeeDetailModal();
            setTimeout(() => {
                mainModule.editUser(parseInt(empId));
            }, 100);
        } else {
            console.error('無法開啟編輯模態框：沒有可用的用戶資料');
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
    
    // 輔助函數
    function getAuthTypeDisplay(authType) {
        const authMap = {
            'local': '本地認證',
            'ldap': 'LDAP',
            'sso': 'SSO 單一登入',
            'oauth': 'OAuth'
        };
        return authMap[authType] || authType;
    }
    
    function formatDateTime(dateStr) {
        if (!dateStr) return '從未';
        const date = new Date(dateStr);
        return date.toLocaleString('zh-TW');
    }
    
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
    
    // 獲取並顯示啟用連結有效期限
    async function fetchAndDisplayActivationExpiry() {
        try {
            const response = await fetch('/api/config/activation-expire-hours', {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                const hours = data.hours || 168; // 預設 168 小時
                const days = data.days || Math.floor(hours / 24);
                const passwordStrategyInfo = document.getElementById('passwordStrategyInfo');
                if (passwordStrategyInfo) {
                    passwordStrategyInfo.innerHTML = `
                        <div class="alert alert-info mb-0">
                            <i class="fas fa-info-circle"></i>
                            啟用連結有效期限為 <strong>${days} 天</strong>（${hours} 小時）
                        </div>
                         <small>連結將寄送至員工信箱，如果要重送郵件，請點擊員工資訊卡片  <i class="fas fa-envelope"></i> 圖示</small>
                    `;
                }
            } else {
                console.warn('無法獲取啟用連結有效期限設定');
            }
        } catch (error) {
            console.error('獲取啟用連結有效期限時發生錯誤:', error);
        }
    }
    
    // 公開 API
    return {
        init,
        bindModalEvents,
        showAddUserModal,
        showAddUserModalForPending,
        editUser,
        showUserDetailModal,
        showEmployeeDeactivateModal,
        confirmEmployeeDeactivate,
        closeEmployeeDeactivateModal,
        closeEmployeeModal,
        closeEmployeeDetailModal,
        editEmployeeFromDetail,
        refreshPendingAccountsModal,
        updateAccountStatusDisplay,
        clearFormErrors,
        fetchAndDisplayActivationExpiry
    };
})();

// 確保模組可被存取
if (typeof OrganizationEmployeeModalModule === 'undefined') {
    var OrganizationEmployeeModalModule = window.OrganizationEmployeeModalModule;
}