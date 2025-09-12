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
            
            // 初始化員工模態框模組
            if (window.OrganizationEmployeeModalModule) {
                console.log('初始化員工模態框模組');
                OrganizationEmployeeModalModule.init(this);
            } else {
                console.warn('OrganizationEmployeeModalModule 不存在，模態框功能將無法使用');
            }
            
            // 綁定事件
            bindButtonEvents();
            bindFormEvents();
            
            // 初始化滾動條淡出淡入效果
            if (window.CommonUI && CommonUI.initScrollFadeEffect) {
                CommonUI.initScrollFadeEffect();
            }
            
            // 初始化統一的員工懸浮卡片模組
            if (window.EmployeeHoverCard) {
                console.log('初始化統一員工懸浮卡片元件');
                EmployeeHoverCard.init();
                window.EmployeeHoverCard._initialized = true;
            } else {
                console.warn('EmployeeHoverCard 模組不存在，懸浮卡片功能將無法使用');
            }
            
            // 載入初始數據
            console.log('載入權限群組和用戶數據...');
            await loadPermissionGroups();
            await loadUsers();
            
            // 載入待處理帳號
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
                if (window.OrganizationEmployeeModalModule) {
                    OrganizationEmployeeModalModule.showUserDetailModal(data);
                }
            } catch (error) {
                console.error('Error loading employee detail:', error);
            }
        } else {
            if (window.OrganizationEmployeeModalModule) {
                OrganizationEmployeeModalModule.showUserDetailModal(employee);
            }
        }
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
     * 編輯用戶（委託到模態框模組）
     */
    async function editUser(userId) {
        if (window.OrganizationEmployeeModalModule) {
            // 在編輯用戶前先載入最新的部門資料
            await loadDepartmentOptions('userDepartment');
            
            OrganizationEmployeeModalModule.editUser(userId, allUsers);
        } else {
            showToast('模態框模組未載入', 'error');
        }
    }
    
    /**
     * 編輯用戶權限
     */
    async function editUserPermissions(userId) {
        try {
            if (!window.OrganizationEmployeePermissionsModule) {
                showToast('權限模組未載入', 'error');
                return;
            }
            
            // 載入用戶現有權限
            const existingPermissions = await window.OrganizationEmployeePermissionsModule.loadExistingPermissions('user', userId);
            const permissionIds = existingPermissions.map(p => p.id);
            
            // 顯示權限設定模態框
            await window.OrganizationEmployeePermissionsModule.showPermissionsModal('user', userId, permissionIds);
            
        } catch (error) {
            console.error('編輯用戶權限失敗:', error);
            showToast('載入權限資料失敗', 'error');
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
   
        // 密碼策略切換
    function togglePasswordField() {
        const selectElement = document.getElementById('passwordStrategy');
        const strategy = selectElement.value;
        const passwordGroup = document.getElementById('manualPasswordGroup');
        const sendEmailGroup = document.getElementById('sendActivationEmailGroup');
        const infoDiv = document.getElementById('passwordStrategyInfo');
        
        // 取得密碼欄位
        const passwordField = document.getElementById('userPassword');
        
        // 顯示/隱藏對應的輸入欄位並設定 required 屬性
        if (strategy === 'MANUAL') {
            passwordGroup.style.display = 'block';
            sendEmailGroup.style.display = 'none';
            if (passwordField) passwordField.required = true;
        } else if (strategy === 'ACTIVATION_LINK') {
            passwordGroup.style.display = 'none';
            sendEmailGroup.style.display = 'block';
            if (passwordField) passwordField.required = false;
        } else {
            passwordGroup.style.display = 'none';
            sendEmailGroup.style.display = 'none';
            if (passwordField) passwordField.required = false;
        }
        
        // 顯示策略說明
        let infoHtml = '';
        switch (strategy) {
            case 'ACTIVATION_LINK':
                infoHtml = `
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle"></i>
                        <strong>啟用連結模式：</strong>系統將發送啟用郵件到使用者信箱，使用者點擊連結後自行設定密碼。連結有效期為 7 天。
                    </div>
                `;
                break;
            case 'TEMP_PASSWORD':
                infoHtml = `
                    <div class="alert alert-warning">
                        <i class="fas fa-key"></i>
                        <strong>臨時密碼模式：</strong>系統將自動生成臨時密碼並發送到使用者信箱，使用者首次登入後需要修改密碼。
                    </div>
                `;
                break;
            case 'MANUAL':
                infoHtml = `
                    <div class="alert alert-success">
                        <i class="fas fa-edit"></i>
                        <strong>手動設定模式：</strong>由管理員直接設定初始密碼，使用者可立即使用此密碼登入。
                    </div>
                `;
                break;
        }
        infoDiv.innerHTML = infoHtml;
    };

    // 密碼要求檢查
    function checkPasswordRequirements() {
        const password = document.getElementById('userPassword').value;
        
        // 檢查各項要求
        const requirements = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /\d/.test(password),
            special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
        };
        
        // 更新要求顯示
        Object.keys(requirements).forEach(key => {
            const element = document.getElementById(`req-${key}`);
            if (element) {
                if (requirements[key]) {
                    element.innerHTML = element.innerHTML.replace('✗', '✓');
                    element.classList.add('valid');
                } else {
                    element.innerHTML = element.innerHTML.replace('✓', '✗');
                    element.classList.remove('valid');
                }
            }
        });
    };    


    /**
     * 切換用戶狀態（啟用和停用都顯示確認對話框）
     */
    async function toggleUserStatus(userId, currentStatus) {
        if (currentStatus) {
            // 目前是啟用狀態，點擊為停用 -> 顯示停用確認對話框
            if (window.OrganizationEmployeeModalModule) {
                OrganizationEmployeeModalModule.showEmployeeDeactivateModal(userId, allUsers);
            }
        } else {
            // 目前是停用狀態，點擊為啟用 -> 顯示啟用確認對話框
            showEmployeeActivateModal(userId);
        }
    }
    
    /**
     * 顯示員工啟用確認對話框
     */
    function showEmployeeActivateModal(userId) {
        const user = allUsers.find(u => (u.user_id || u.id) === userId);
        if (!user) {
            showToast('找不到用戶資料', 'error');
            return;
        }

        const modal = document.getElementById('employeeActivateModal');
        const employeeNameSpan = document.getElementById('activateEmployeeName');
        const employeeLoginSpan = document.getElementById('activateEmployeeLogin');
        
        if (!modal || !employeeNameSpan || !employeeLoginSpan) {
            showToast('啟用對話框組件缺失', 'error');
            return;
        }

        // 設定員工資訊
        employeeNameSpan.textContent = user.username || user.loginid;
        employeeLoginSpan.textContent = `${user.loginid}`;
        
        // 記錄要啟用的用戶ID
        modal.dataset.userId = userId;
        
        // 重置表單狀態
        const immediateRadio = document.querySelector('input[name="activateMode"][value="immediate"]');
        const scheduledRadio = document.querySelector('input[name="activateMode"][value="scheduled"]');
        const scheduledGroup = document.getElementById('scheduledActivateGroup');
        const datetimeInput = document.getElementById('activateDateTime');
        
        if (immediateRadio) immediateRadio.checked = true;
        if (scheduledRadio) scheduledRadio.checked = false;
        if (scheduledGroup) scheduledGroup.style.display = 'none';
        if (datetimeInput) datetimeInput.value = '';
        
        // 顯示對話框
        modal.classList.add('show');
        document.body.classList.add('modal-open');
    }
    
    /**
     * 關閉員工啟用確認對話框
     */
    function closeEmployeeActivateModal() {
        const modal = document.getElementById('employeeActivateModal');
        if (modal) {
            modal.classList.remove('show');
            document.body.classList.remove('modal-open');
            delete modal.dataset.userId;
        }
    }
    
    /**
     * 確認員工啟用
     */
    async function confirmEmployeeActivate() {
        const modal = document.getElementById('employeeActivateModal');
        const userId = modal?.dataset.userId;
        
        if (!userId) {
            showToast('無效的用戶ID', 'error');
            return;
        }
        
        const immediateRadio = document.querySelector('input[name="activateMode"][value="immediate"]');
        const scheduledRadio = document.querySelector('input[name="activateMode"][value="scheduled"]');
        const datetimeInput = document.getElementById('activateDateTime');
        
        let activationScheduled = null;
        let isImmediate = true;
        
        if (scheduledRadio?.checked) {
            // 預約啟用模式
            const scheduledTime = datetimeInput?.value;
            if (!scheduledTime) {
                showToast('請選擇預約啟用時間', 'error');
                return;
            }
            
            // 驗證預約時間不能是過去時間
            const scheduleDate = new Date(scheduledTime);
            const now = new Date();
            
            if (scheduleDate <= now) {
                showToast('預約時間不能是過去時間', 'error');
                return;
            }
            
            activationScheduled = scheduleDate;
            isImmediate = false;
        }
        
        try {
            // 執行啟用操作
            await executeUserActivation(parseInt(userId), isImmediate, activationScheduled);
            
            // 關閉對話框
            closeEmployeeActivateModal();
            
        } catch (error) {
            console.error('員工啟用失敗:', error);
            showToast(error.message || '啟用失敗', 'error');
        }
    }
    
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
     * 執行用戶啟用操作
     */
    async function executeUserActivation(userId, isImmediate, activationScheduled = null) {
        try {
            const data = { is_active: isImmediate };
            
            if (!isImmediate && activationScheduled) {
                // 預約啟用：設定 activation_scheduled 時間（修正時區偏移）
                data.activation_scheduled = convertLocalTimeToUTC(activationScheduled);
            } else if (isImmediate) {
                // 立即啟用：清除所有排程欄位
                data.activation_expires = null;
                data.activation_scheduled = null;
            }
            
            const response = await fetch(`/api/organization/users/${userId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '啟用操作失敗');
            }
            
            const result = await response.json();
            
            // 顯示成功訊息
            let message = '';
            if (isImmediate) {
                message = '員工帳號已立即啟用';
            } else {
                const scheduleTime = activationScheduled.toLocaleString('zh-TW');
                message = `員工帳號已排程在 ${scheduleTime} 啟用`;
            }
            
            showToast(message, 'success');
            
            // 更新本地資料
            const updatedData = { 
                is_active: isImmediate // 立即啟用則設為 true，預約啟用則設為 false 直到排程執行
            };
            
            if (activationScheduled) {
                updatedData.activation_scheduled = convertLocalTimeToUTC(activationScheduled);
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
            
            // 重新載入樹狀結構
            if (window.OrganizationEmployeeTreeModule) {
                OrganizationEmployeeTreeModule.refresh();
            }
            
            return result;
            
        } catch (error) {
            console.error('執行用戶啟用失敗:', error);
            throw error;
        }
    }
    
    /**
     * 確認員工停用（委託到模態框模組）
     */
    async function confirmEmployeeDeactivate() {
        if (window.OrganizationEmployeeModalModule) {
            return OrganizationEmployeeModalModule.confirmEmployeeDeactivate();
        } else {
            showToast('模態框模組未載入', 'error');
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
           } else if (!isActive && !activationExpires) {
               message = '員工帳號已立即停用';
           } else if (isActive && activationExpires) {
               const expireTime = activationExpires.toLocaleString('zh-TW');
               message = `員工帳號已排程在 ${expireTime} 停用`;
           }
                
            showToast(message, 'success');
            
            // 更新本地資料陣列中該員工的狀態
            const updatedData = { is_active: isActive };
            if (activationExpires) {
                updatedData.activation_expires = convertLocalTimeToUTC(activationExpires);
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
     * 關閉員工停用確認對話框（委託到模態框模組）
     */
    function closeEmployeeDeactivateModal() {
        if (window.OrganizationEmployeeModalModule) {
            OrganizationEmployeeModalModule.closeEmployeeDeactivateModal();
        }
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
        
        bindAccountStatusEvents();
        // 分頁按鈕已不再需要（使用樹狀結構和卡片代替）
    }
    
    /**
     * 綁定帳號狀態選擇器事件
     */
    function bindAccountStatusEvents() {
        // 綁定狀態選擇變更事件
        const statusRadios = document.querySelectorAll('input[name="account_status_mode"]');
        statusRadios.forEach(radio => {
            radio.addEventListener('change', handleStatusModeChange);
        });
            
        console.log('帳號狀態選擇器事件已綁定');
    }

    /**
     * 處理帳號狀態模式變更
     */
    function handleStatusModeChange() {
        const selectedMode = document.querySelector('input[name="account_status_mode"]:checked')?.value;
        const scheduledGroup = document.getElementById('scheduledStatusGroup');
        const datetimeInput = document.getElementById('scheduledStatusDateTime');
        const hintSpan = document.getElementById('scheduledStatusHint');
        
        if (!scheduledGroup || !datetimeInput || !hintSpan) return;
        
        // 根據選擇的模式顯示/隱藏預約時間設定
        if (selectedMode === 'active_scheduled' || selectedMode === 'inactive_scheduled') {
            scheduledGroup.style.display = 'block';
            datetimeInput.required = true;
            
            // 設定預設時間（當前時間 + 1小時）
            if (!datetimeInput.value) {
                const now = new Date();
                now.setHours(now.getHours() + 1);
                const formattedDateTime = now.getFullYear() + '-' +
                    String(now.getMonth() + 1).padStart(2, '0') + '-' +
                    String(now.getDate()).padStart(2, '0') + 'T' +
                    String(now.getHours()).padStart(2, '0') + ':' +
                    String(now.getMinutes()).padStart(2, '0');
                datetimeInput.value = formattedDateTime;
            }
            
            // 更新提示文字
            if (selectedMode === 'active_scheduled') {
                hintSpan.textContent = '系統將在指定時間自動啟用該員工帳號';
            } else {
                hintSpan.textContent = '系統將在指定時間自動停用該員工帳號';
            }
        } else {
            scheduledGroup.style.display = 'none';
            datetimeInput.required = false;
            datetimeInput.value = '';
            hintSpan.textContent = '系統將在指定時間執行帳號狀態變更';
        }
        
        // 更新隱藏欄位的值以維持相容性
        const hiddenActiveField = document.getElementById('userActive');
        if (hiddenActiveField) {
            const isActiveMode = selectedMode === 'active_immediately' || selectedMode === 'active_scheduled';
            hiddenActiveField.value = isActiveMode ? 'true' : 'false';
        }
    }
    
    /**
     * 初始化帳號狀態選擇器 - 動態生成選項
     */
    function initAccountStatusSelector(isNewAccount = true, currentStatus = true) {
        const container = document.getElementById('statusOptionGroup');
        if (!container) return;
        
        // 清空現有內容
        container.innerHTML = '';
        
        let options = [];
        
        if (isNewAccount) {
            // 新帳號：立即啟用、預約啟用
            options = [
                {
                    value: 'active_immediately',
                    icon: 'fas fa-check text-success',
                    title: '立即啟用',
                    description: '帳號將立即啟用，員工可以登入系統',
                    checked: true
                },
                {
                    value: 'active_scheduled',
                    icon: 'fas fa-clock text-primary', 
                    title: '預約啟用',
                    description: '設定啟用時間，到期後自動啟用帳號',
                    checked: false
                }
            ];
        } else if (currentStatus) {
            // 編輯已啟用帳號：啟用、立即停用、預約停用
            options = [
                {
                    value: 'active_immediately',
                    icon: 'fas fa-check text-success',
                    title: '啟用',
                    description: '帳號將維持啟用狀態',
                    checked: true
                },
                {
                    value: 'inactive_immediately',
                    icon: 'fas fa-ban text-danger',
                    title: '立即停用',
                    description: '帳號將立即停用，員工無法再登入系統',
                    checked: false
                },
                {
                    value: 'inactive_scheduled',
                    icon: 'fas fa-clock text-warning',
                    title: '預約停用',
                    description: '設定停用時間，到期後自動停用帳號',
                    checked: false
                }
            ];
        } else {
            // 編輯已停用帳號：停用、立即啟用、預約啟用
            options = [
                {
                    value: 'inactive_immediately',
                    icon: 'fas fa-ban text-danger',
                    title: '停用',
                    description: '帳號將維持停用狀態',
                    checked: true
                },
                {
                    value: 'active_immediately',
                    icon: 'fas fa-check text-success',
                    title: '立即啟用',
                    description: '帳號將立即啟用，員工可以登入系統',
                    checked: false
                },
                {
                    value: 'active_scheduled',
                    icon: 'fas fa-clock text-primary',
                    title: '預約啟用',
                    description: '設定啟用時間，到期後自動啟用帳號',
                    checked: false
                }
            ];
        }
        
        // 動態生成選項HTML
        options.forEach(option => {
            const optionHTML = `
                <label class="status-option">
                    <input type="radio" name="account_status_mode" value="${option.value}" ${option.checked ? 'checked' : ''}>
                    <span class="status-icon">
                        <i class="${option.icon}"></i>
                    </span>
                    <span class="status-label">
                        <strong>${option.title}</strong>
                        <small>${option.description}</small>
                    </span>
                </label>
            `;
            container.insertAdjacentHTML('beforeend', optionHTML);
        });
        
        // 重新綁定事件
        bindAccountStatusEvents();
        // 觸發初始化邏輯
        handleStatusModeChange();
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
     * 顯示新增用戶 Modal（委託到模態框模組）
     */
    async function showAddUserModal() {
        if (window.OrganizationEmployeeModalModule) {
            // 在顯示模態框前先載入最新的部門資料
            await loadDepartmentOptions('userDepartment');
            OrganizationEmployeeModalModule.showAddUserModal(selectedDepartmentId);
            // 初始化帳號狀態選擇器為新帳號模式
            setTimeout(() => {
                initAccountStatusSelector(true, true);
            }, 100);

        } else {
            showToast('模態框模組未載入', 'error');
        }
    }
    
    /**
     * 專門用於待處理帳號的新增用戶模態框（委託到模態框模組）
     */
    async function showAddUserModalForPending(fromPending = false) {
        if (window.OrganizationEmployeeModalModule) {
            // 在顯示模態框前先載入最新的部門資料
            await loadDepartmentOptions('userDepartment');
            OrganizationEmployeeModalModule.showAddUserModalForPending(fromPending);
            // 初始化帳號狀態選擇器為新帳號模式
            setTimeout(() => {
                initAccountStatusSelector(true, true);
            }, 100);

        } else {
            showToast('模態框模組未載入', 'error');
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
        
        // 5. 密碼驗證（根據密碼策略決定是否必填）
        const passwordStrategy = document.getElementById('passwordStrategy')?.value || 'MANUAL';
        
        if (!isEdit && passwordStrategy !== 'ACTIVATION_LINK') {
            // 只有非啟用連結策略才需要密碼
            if (passwordStrategy === 'MANUAL' && !password) {
                errors.push({ field: 'userPassword', message: '密碼不能為空' });
            } else if (passwordStrategy === 'TEMP_PASSWORD' && !password) {
                errors.push({ field: 'userPassword', message: '請輸入臨時密碼' });
            }
        }
        
        // 如果有輸入密碼才驗證格式（不管什麼策略）
        if (password && password.length > 0) {
            if (password.length < 6) {
                errors.push({ field: 'userPassword', message: '密碼長度至少 6 個字元' });
            } else if (!/[0-9]/.test(password) || !/[a-zA-Z]/.test(password)) {
                errors.push({ field: 'userPassword', message: '密碼必須包含至少一個數字和一個字母' });
            }
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
        
         // 8. 帳號狀態預約時間驗證
         const statusMode = document.querySelector('input[name="account_status_mode"]:checked')?.value;
         if (statusMode === 'active_scheduled' || statusMode === 'inactive_scheduled') {
             const scheduledDateTime = document.getElementById('scheduledStatusDateTime')?.value;
             if (!scheduledDateTime) {
                 errors.push({ field: 'scheduledStatusDateTime', message: '預約模式必須設定時間' });
             } else {
                 const scheduleDate = new Date(scheduledDateTime);
                 const now = new Date();
                 
                 if (scheduleDate <= now) {
                     errors.push({ field: 'scheduledStatusDateTime', message: '預約時間不能是過去時間' });
                 }
                 
                 // 檢查時間是否過於接近（至少需要1分鐘後）
                 const oneMinuteLater = new Date(now.getTime() + 60000);
                 if (scheduleDate <= oneMinuteLater) {
                     errors.push({ field: 'scheduledStatusDateTime', message: '預約時間至少需要1分鐘後' });
                 }
             }
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
     * 清除表單錯誤狀態（委託到模態框模組）
     */
    function clearFormErrors() {
        if (window.OrganizationEmployeeModalModule) {
            OrganizationEmployeeModalModule.clearFormErrors();
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
     * 生成隨機密碼
     */
    function generateRandomPassword() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < 16; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
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
        };
        
        // 處理帳號狀態選擇器
        const statusMode = document.querySelector('input[name="account_status_mode"]:checked')?.value;
        const scheduledDateTime = document.getElementById('scheduledStatusDateTime')?.value;
        
        // 清除所有排程相關欄位，避免舊資料殘留
        userData.activation_scheduled = null;
        userData.activation_expires = null;
        
        console.log('Status processing - Mode:', statusMode, 'Scheduled time:', scheduledDateTime);
        
        switch (statusMode) {
            case 'active_immediately':
                userData.is_active = true;
                break;
            case 'active_scheduled':
                userData.is_active = false; // 先設為停用，等排程時間到再啟用
                if (scheduledDateTime) {
                    userData.activation_scheduled = convertLocalTimeToUTC(new Date(scheduledDateTime));
                    console.log('Setting activation_scheduled:', userData.activation_scheduled);
                }
                break;
            case 'inactive_immediately':
                userData.is_active = false;
                break;
            case 'inactive_scheduled':
                userData.is_active = true; // 先保持啟用，等排程時間到再停用
                if (scheduledDateTime) {
                    userData.activation_expires = convertLocalTimeToUTC(new Date(scheduledDateTime));
                    console.log('Setting activation_expires:', userData.activation_expires);
                }
                break;
            default:
                // 備援：使用隱藏欄位的值
                userData.is_active = formData.get('is_active') === 'on' || formData.get('is_active') === 'true';
        }
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
        
        // 取得密碼策略（直接從 select 元素取值，因為可能是 disabled 狀態）
        const passwordStrategyElement = document.getElementById('passwordStrategy');
        const passwordStrategy = passwordStrategyElement ? passwordStrategyElement.value : 'ACTIVATION_LINK';
        
        console.log('Debug: passwordStrategy =', passwordStrategy); // Debug 日誌
        
        if (!isEdit) {
            // 新增模式
            userData.password_strategy = passwordStrategy;
            
            // 根據密碼策略決定是否發送密碼
            if (passwordStrategy === 'ACTIVATION_LINK') {
                // 啟用連結策略：生成隨機密碼（後端會再次生成，這裡是備用）
                userData.password = generateRandomPassword();
            } else {
                // 其他策略：需要密碼
                userData.password = password;
            }
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
            const result = await CRUD.saveEmployee(userData, isEdit);
            
            // 根據實際操作類型顯示正確的訊息
            const isUpdateOperation = userId && userId !== '';
            let successMessage;
            
            if (isUpdateOperation) {
                successMessage = isEdit ? '員工資料更新成功' : '員工設定完成成功';
                showToast(successMessage, 'success');
            } else {
                // 新增用戶的情況
                successMessage = '員工新增成功';
                
                // 如果是新增用戶且選擇啟用連結策略，顯示額外的郵件發送資訊
                if (result && result.password_strategy === 'ACTIVATION_LINK') {
                    if (result.email_sent) {
                        showToast(successMessage + ' - 啟用郵件已發送', 'success');
                        showToast('啟用郵件已發送到用戶信箱，請提醒用戶查收', 'info');
                    } else {
                        showToast(successMessage + ' - 啟用連結已生成', 'success');
                        showToast('啟用連結郵件將在帳號正式啟用時寄發', 'info');
                    }
                } else {
                    showToast(successMessage, 'success');
                }
            }
            
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
            
            // 先重新載入樹狀結構並等待完成
            if (window.OrganizationEmployeeTreeModule) {
                console.log('編輯員工成功，開始刷新樹狀結構...');
                await window.OrganizationEmployeeTreeModule.refresh();
                console.log('樹狀結構刷新完成，當前選中部門ID:', selectedDepartmentId);
            }
            
            // 樹狀結構刷新完成後再渲染卡片
            if (window.OrganizationEmployeeCardModule && 
                window.OrganizationEmployeeCardModule.loadAndRenderEmployeeCards) {
                
                // 如果當前有選中部門，直接調用 API 載入該部門員工；否則顯示全部員工
                if (selectedDepartmentId) {
                    console.log(`編輯員工成功，重新載入部門 ${selectedDepartmentId} 的員工卡片`);
                    // 直接調用 API 獲取部門員工資料（避免篩選錯誤）
                    try {
                        const departmentEmployees = await CRUD.loadEmployeesByDept(selectedDepartmentId);
                        console.log(`載入部門 ${selectedDepartmentId} 員工成功:`, departmentEmployees.length, '個員工');
                        window.OrganizationEmployeeCardModule.loadAndRenderEmployeeCards(departmentEmployees);
                    } catch (error) {
                        console.error('載入部門員工失敗:', error);
                        // 發生錯誤時顯示全部員工
                        console.log('回退：顯示全部員工卡片:', users.length, '個員工');
                        window.OrganizationEmployeeCardModule.loadAndRenderEmployeeCards(users);
                    }
                } else {
                    console.log('編輯員工成功，重新渲染全部卡片:', users.length, '個員工');
                    window.OrganizationEmployeeCardModule.loadAndRenderEmployeeCards(users);
                }
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
            
            // 記錄更詳細的錯誤信息用於調試
            console.error('錯誤詳情:', {
                status: error.status,
                data: error.data,
                message: error.message,
                userMessage: error.userMessage,
                userData: userData,
                isEdit: isEdit
            });
            
            // 優先使用 CRUD 模組提供的用戶友好錯誤信息
            if (error.userMessage) {
                showToast(error.userMessage, 'error');
                return;
            }
            
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
            
            // 處理其他HTTP錯誤狀態碼
            if (error.status) {
                let errorMessage = '發生錯誤';
                switch (error.status) {
                    case 400:
                        errorMessage = '請求參數錯誤，請檢查輸入資料';
                        break;
                    case 401:
                        errorMessage = '未授權訪問，請重新登入';
                        break;
                    case 403:
                        errorMessage = '權限不足，無法執行此操作';
                        break;
                    case 404:
                        errorMessage = '找不到指定的使用者';
                        break;
                    case 500:
                        errorMessage = '伺服器內部錯誤，請稍後再試';
                        break;
                    default:
                        errorMessage = error.data?.detail || `伺服器錯誤 (${error.status})`;
                }
                showToast(errorMessage, 'error');
                return;
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
    async function updatePendingAccountsBanner() {
        await loadPendingUsers();
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
     * 重新載入並更新待處理帳號清單Modal（委託到模態框模組）
     */
    async function refreshPendingAccountsModal() {
        if (window.OrganizationEmployeeModalModule) {
            await loadPendingUsers();
            return OrganizationEmployeeModalModule.refreshPendingAccountsModal();
        } else {
            console.warn('模態框模組未載入');
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
                } else if (data.status === 'no_primary_role') {
                    // 帳號存在且有完整基本資料，只缺少主要角色，保持新增模式介面但記錄 user_id 以便使用 PUT 更新
                    const userIdField = document.getElementById('userId');
                    if (userIdField && data.user_id) {
                        userIdField.value = data.user_id;  // 記錄 user_id，讓儲存時使用 PUT 方法
                        console.log('記錄缺少主要角色帳號 user_id:', data.user_id);
                    } else if (userIdField && !data.user_id) {
                        // 邊界情況處理：no_primary_role 狀態但缺少 user_id
                        console.warn('⚠️ no_primary_role 狀態帳號缺少 user_id，這可能導致儲存問題');
                        userIdField.value = '';  // 確保清空，但這會導致使用 POST 方法
                        updateAccountStatusDisplay('error', { 
                            message: 'no_primary_role 狀態資料不完整，請聯繫系統管理員' 
                        });
                    }
                    
                    // 自動填充所有已存在資料（維持新增模式介面）
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
        
        // 重置帳號狀態選擇器為新帳號模式
        setTimeout(() => {
            initAccountStatusSelector(true, true);
        }, 50);

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
     * 更新帳號狀態顯示（委託到模態框模組）
     */
    function updateAccountStatusDisplay(status, data) {
        if (window.OrganizationEmployeeModalModule) {
            OrganizationEmployeeModalModule.updateAccountStatusDisplay(status, data);
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
        
        // 6. 初始化帳號狀態選擇器（編輯模式）
        const isCurrentlyActive = userData.is_active !== false && userData.is_active !== 0;
        setTimeout(() => {
            initAccountStatusSelector(false, isCurrentlyActive);
        }, 100);

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
        editUserPermissions,
        setSelectedPermissions,
        editEmployee: editUser,  // 添加別名，讓組織樹模組也能正常呼叫
        resetUserPassword,
        toggleUserStatus,
        updateUserStatistics,  // 保留原有功能
        reinitialize,  // 新增重新初始化方法
        isInitialized: () => isInitialized,  // 暴露初始化狀態
        // 懸浮卡片功能使用統一的 EmployeeHoverCard 模組
        showEmployeeHoverCard: function(deptId) {
            if (window.EmployeeHoverCard) {
                if (!window.EmployeeHoverCard._initialized) {
                    window.EmployeeHoverCard.init();
                    window.EmployeeHoverCard._initialized = true;
                }
                
                // 使用統一的懸浮卡片模組顯示部門員工
                return window.EmployeeHoverCard.show({
                    type: 'department',
                    id: deptId,
                    title: '部門員工'
                });
            }
            console.warn('EmployeeHoverCard 模組未載入');
        },
        showAddUserModal,  // 暴露新增用戶模態框函數
        showAddUserModalForPending,  // 暴露待處理帳號專用的新增用戶模態框函數
        saveEmployee: handleAddUser,  // 暴露儲存員工函數
        closeEmployeeModal: function() {
            if (window.OrganizationEmployeeModalModule) {
                OrganizationEmployeeModalModule.closeEmployeeModal();
            }
        },
        togglePasswordField,
        checkPasswordRequirements,
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
        checkAccountStatus,
        debounceAccountCheck,
        loadPendingAccountSuggestions,
        refreshPendingAccountsModal,  // 新增：暴露待處理帳號清單更新函數
        updatePendingAccountsBanner,  // 暴露待處理帳號橫幅更新函數
        // Badge 相關函數委託到統一懸浮卡片模組
        generateEmployeeBadges: function(roleList, permissionList) {
            if (window.EmployeeHoverCard) {
                return window.EmployeeHoverCard.generateBadges(roleList, permissionList);
            }
            console.warn('EmployeeHoverCard 模組不存在');
            return '';
        },
        bindEmployeeBadgeEvents: function() {
            if (window.EmployeeHoverCard) {
                return window.EmployeeHoverCard.bindBadgeEvents();
            }
            console.warn('EmployeeHoverCard 模組不存在');
        },
        // 模式切換相關
        resetToAddMode,
        // 停用對話框相關函數
        executeUserStatusChange,
        closeEmployeeDeactivateModal,
        confirmEmployeeDeactivate,
        // 啟用對話框相關函數
        showEmployeeActivateModal,
        closeEmployeeActivateModal,
        confirmEmployeeActivate,
        executeUserActivation,
        // 狀態選擇器初始化
        initAccountStatusSelector,  // 暴露狀態選擇器初始化函數
        generateRandomPassword,
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
    if (window.OrganizationEmployeeModalModule && window.OrganizationEmployeeModalModule.closeEmployeeDetailModal) {
        window.OrganizationEmployeeModalModule.closeEmployeeDetailModal();
    } else {
        const modal = document.getElementById('employeeDetailModal');
        if (modal) {
            modal.classList.remove('show');
            document.body.classList.remove('modal-open');
        }
    }
};

window.editEmployeeFromDetail = function() {
    if (window.OrganizationEmployeeModalModule && window.OrganizationEmployeeModalModule.editEmployeeFromDetail) {
        window.OrganizationEmployeeModalModule.editEmployeeFromDetail();
    } else {
        // 從詳情模態框跳轉到編輯模態框
        const detailModal = document.getElementById('employeeDetailModal');
        const empId = detailModal?.dataset.empId;
        
        if (empId && window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.editUser) {
            closeEmployeeDetailModal();
            window.OrganizationEmployeeModule.editUser(parseInt(empId));
        }
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
        case 'no_primary_role':
            return '<span class="badge badge-primary">缺少主要角色</span>';
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

// 員工啟用相關全域函數
window.closeEmployeeActivateModal = function() {
    if (window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.closeEmployeeActivateModal) {
        window.OrganizationEmployeeModule.closeEmployeeActivateModal();
    } else {
        // 直接操作 DOM 作為備援
        const modal = document.getElementById('employeeActivateModal');
        if (modal) {
            modal.classList.remove('show');
            document.body.classList.remove('modal-open');
        }
    }
};

window.confirmEmployeeActivate = function() {
    if (window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.confirmEmployeeActivate) {
        window.OrganizationEmployeeModule.confirmEmployeeActivate();
    } else {
        console.error('OrganizationEmployeeModule.confirmEmployeeActivate 不存在');
    }
};

// 處理預約啟用選項顯示/隱藏
window.toggleActivateScheduleOptions = function() {
    const scheduledRadio = document.querySelector('input[name="activateMode"][value="scheduled"]');
    const scheduledGroup = document.getElementById('scheduledActivateGroup');
    
    if (scheduledRadio && scheduledGroup) {
        if (scheduledRadio.checked) {
            scheduledGroup.style.display = 'block';
            
            // 設定預設的預約時間（當前時間 + 1小時）
            const datetimeInput = document.getElementById('activateDateTime');
            if (datetimeInput && !datetimeInput.value) {
                const now = new Date();
                now.setHours(now.getHours() + 1);
                // 格式化為 datetime-local 格式 YYYY-MM-DDTHH:mm
                const formattedDateTime = now.getFullYear() + '-' +
                    String(now.getMonth() + 1).padStart(2, '0') + '-' +
                    String(now.getDate()).padStart(2, '0') + 'T' +
                    String(now.getHours()).padStart(2, '0') + ':' +
                    String(now.getMinutes()).padStart(2, '0');
                datetimeInput.value = formattedDateTime;
            }
        } else {
            scheduledGroup.style.display = 'none';
        }
    }
};