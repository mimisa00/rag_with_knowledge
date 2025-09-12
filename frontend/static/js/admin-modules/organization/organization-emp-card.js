/**
 * 組織管理 - 員工卡片顯示子模組
 * 負責員工卡片網格的顯示與互動
 */
const OrganizationEmployeeCardModule = (function() {
    'use strict';
    
    // 當前顯示的員工列表
    let currentEmployees = [];
    let filteredEmployees = [];
    
    /**
     * 初始化卡片模組
     */
    function init() {
        // 初始化時不需要特別處理
    }
    
    /**
     * 載入並顯示員工卡片（首次載入，包含預設排序）
     */
    function loadAndRenderEmployeeCards(employees) {
        currentEmployees = employees || [];
        filteredEmployees = [...currentEmployees];
        
        // 首次載入時設定預設排序
        if (filteredEmployees.length > 0) {
            filteredEmployees.sort(compareEmployeesByRole);
        }
        
        // 設定排序選單預設值為角色排序
        const sortSelect = document.getElementById('empSortBy');
        if (sortSelect) {
            sortSelect.value = 'role';
        }
        
        // 渲染卡片
        renderEmployeeCards();
    }
    
    /**
     * 渲染員工卡片列表（不改變排序，純粹渲染）
     */
    function renderEmployeeCards() {
        const container = document.getElementById('employeeCardsContainer');
        if (!container) return;
        
        if (filteredEmployees.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users fa-3x text-muted"></i>
                    <p class="text-muted">此部門沒有員工</p>
                </div>
            `;
            return;
        }
        
        let html = '<div class="employee-cards-grid">';
        
        filteredEmployees.forEach(emp => {
            html += buildEmployeeCard(emp);
        });
        
        html += '</div>';
        container.innerHTML = html;
        
        // 綁定卡片事件
        bindCardEvents();
    }
    
    /**
     * 判斷員工帳號狀態（包含排程和啟用狀態）
     */
    function getEmployeeStatus(employee) {
        const now = new Date();
        const isActive = employee.is_active;
        const activationScheduled = employee.user_extension.activation_scheduled ? new Date(employee.user_extension.activation_scheduled) : null;
        const activationExpires = employee.user_extension.activation_expires ? new Date(employee.user_extension.activation_expires) : null;
        
        // 檢查密碼策略和啟用狀態
        const passwordStrategy = employee.user_extension?.password_strategy;
        const activatedAt = employee.user_extension?.activated_at;
        
        // 檢查是否有有效的啟用連結 token（根據資料庫記錄）
        const hasActivationToken = employee.has_activation_token || false;
        console.info("------------------------------");
        console.info(employee);


        // 檢查是否有排程啟用
        if (activationScheduled && activationScheduled > now) {
            return {
                type: 'scheduled-active',
                class: 'scheduled-active',
                title: `排程於 ${formatDateTime(activationScheduled)} 啟用`,
                scheduleTime: activationScheduled,
                scheduleType: 'activation',
                needsActivation: hasActivationToken
            };
        }

        // 檢查是否是等待啟用的帳號（ACTIVATION_LINK 策略且未啟用）
        if (passwordStrategy === 'ACTIVATION_LINK' && !isActive && !activatedAt) {
            return {
                type: 'pending-activation',
                class: 'pending-activation',
                title: '等待啟用 - 需要點擊啟用郵件連結',
                scheduleTime: null,
                scheduleType: 'pending',
                needsActivation: hasActivationToken
            };
        }
        
        // 檢查是否有排程停用
        if (activationExpires && activationExpires > now && isActive) {
            return {
                type: 'scheduled-inactive',
                class: 'scheduled-inactive', 
                title: `排程於 ${formatDateTime(activationExpires)} 停用`,
                scheduleTime: activationExpires,
                scheduleType: 'expiration',
                needsActivation: hasActivationToken
            };
        }
        
        // 一般狀態
        if (isActive) {
            return {
                type: 'active',
                class: 'active',
                title: '啟用中',
                scheduleTime: null,
                scheduleType: null,
                needsActivation: hasActivationToken
            };
        } else {
            return {
                type: 'inactive', 
                class: 'inactive',
                title: '已停用',
                scheduleTime: null,
                scheduleType: null,
                needsActivation: hasActivationToken
            };
        }
    }
    
    /**
     * 格式化日期時間顯示
     */
    function formatDateTime(date) {
        if (!date) return '';
        return date.toLocaleString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    /**
     * 生成排程資訊HTML
     */
    function generateScheduleInfo(status) {
        if (!status.scheduleTime) return '';
        
        const timeText = formatDateTime(status.scheduleTime);
        const actionText = status.scheduleType === 'activation' ? '啟用' : '停用';
        const iconClass = status.scheduleType === 'activation' ? 'fa-clock text-primary' : 'fa-clock text-warning';
        
        return `
            <div class="card-schedule ${status.class}">
                <i class="fas ${iconClass}"></i>
                <span>排程 ${actionText}：</span>
                <span class="schedule-time">${timeText}</span>
            </div>
        `;
    }

    /**
     * 建立單個員工卡片
     */
    function buildEmployeeCard(employee) {
        const displayName = employee.name || employee.username || employee.loginid || '未命名';
        const email = employee.email || '無郵箱';
        const title = employee.user_extension?.title || employee.title || '';//未設定職稱
        const departmentName = employee.department?.name || employee.department_name || employee.dept_name || '未分配部門';
        const userId = employee.user_id || employee.id; // 與樹狀結構保持一致
        
        // 取得帳號狀態資訊（包含排程）
        const statusInfo = getEmployeeStatus(employee);
        const isActive = employee.is_active;
        
        // 處理角色資料，統一格式以便使用 generateEmployeeBadges 函數
        let roleList = [];
        if (employee.department_roles && employee.department_roles.length > 0) {
            roleList = employee.department_roles.map(r => ({
                name: r.name,
                type: r.role_type,
                level: r.level || 0,
                isPrimary: r.is_primary
            }));
        }
        
        // 處理權限群組資料，統一格式（合併個人權限和角色權限）
        let permissionList = [];
        
        // 取得個人權限
        const directPermissions = employee.permission_groups || [];
        
        // 取得角色權限
        const rolePermissions = employee.role_permission_groups || [];
        
        // 合併權限（去重）
        const permissionMap = new Map();
        
        // 添加個人權限
        directPermissions.forEach(p => {
            const permId = typeof p === 'object' ? p.id : p;
            const permName = typeof p === 'object' ? p.name : p;
            const permType = typeof p === 'object' ? p.permission_type : 'default';
            const permLevel = typeof p === 'object' ? (p.level || 0) : 0;
            
            permissionMap.set(permId, {
                name: permName,
                type: permType,
                level: permLevel,
                source: 'personal'
            });
        });
        
        // 添加角色權限（不覆蓋個人權限）
        rolePermissions.forEach(p => {
            const permId = typeof p === 'object' ? p.id : p;
            const permName = typeof p === 'object' ? p.name : p;
            const permType = typeof p === 'object' ? p.permission_type : 'default';
            const permLevel = typeof p === 'object' ? (p.level || 0) : 0;
            
            if (!permissionMap.has(permId)) {
                permissionMap.set(permId, {
                    name: permName,
                    type: permType,
                    level: permLevel,
                    source: 'role'
                });
            }
        });
        
        // 轉換為陣列
        permissionList = Array.from(permissionMap.values());
        
        // 使用統一的 badge 生成函數
        let badgesHtml = '';
        if (window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.generateEmployeeBadges) {
            badgesHtml = window.OrganizationEmployeeModule.generateEmployeeBadges(roleList, permissionList);
        } else {
            // 備援方案：使用簡單的 badge 顯示
            let rolesHtml = '';
            if (roleList.length > 0) {
                const primaryRole = roleList.find(r => r.isPrimary);
                const otherRoles = roleList.filter(r => !r.isPrimary);
                
                if (primaryRole) {
                    rolesHtml += `<span class="badge badge-primary">${primaryRole.name}</span>`;
                }
                otherRoles.forEach(role => {
                    rolesHtml += `<span class="badge badge-secondary">${role.name}</span>`;
                });
            } else {
                rolesHtml = '<span class="badge badge-light">無角色</span>';
            }
            
            let permissionsHtml = '';
            if (permissionList.length > 0) {
                permissionList.slice(0, 2).forEach(perm => {
                    // 判斷權限來源並設定樣式
                    let sourceClass = '';
                    let sourceText = '';
                    if (perm.source === 'role') {
                        sourceClass = 'from-role';
                        sourceText = '部門角色權限';
                    } else if (perm.source === 'direct' || perm.source === 'personal') {
                        sourceClass = 'from-direct';
                        sourceText = '個人指派權限';
                    } else if (perm.source === 'both') {
                        sourceClass = 'from-both';
                        sourceText = '部門角色 + 個人指派';
                    } else {
                        sourceClass = '';
                        sourceText = '權限';
                    }
                    
                    const permType = perm.type || 'default';
                    permissionsHtml += `<span class="employee-permission-badge permission-${permType} ${sourceClass}" title="${perm.name} (${sourceText})">${perm.name}</span>`;
                });
                if (permissionList.length > 2) {
                    permissionsHtml += `<span class="badge badge-light">+${permissionList.length - 2}</span>`;
                }
            }
            
            // 組合備援的 HTML
            let fallbackHtml = '';
            if (rolesHtml) {
                fallbackHtml += `
                    <div class="card-roles">
                        <label>角色:</label>
                        <div class="badges-container">
                            ${rolesHtml}
                        </div>
                    </div>
                `;
            }
            if (permissionsHtml) {
                fallbackHtml += `
                    <div class="card-permissions">
                        <label>權限:</label>
                        <div class="badges-container">
                            ${permissionsHtml}
                        </div>
                    </div>
                `;
            }
            badgesHtml = fallbackHtml;
        }
        
        return `
            <div class="employee-card ${!isActive ? 'inactive' : ''}" data-emp-id="${userId}">
                <div class="card-header">
                    <div class="card-avatar">
                        <i class="fas fa-user-circle fa-2x"></i>
                    </div>
                    <div class="card-status">
                        <span class="status-indicator ${statusInfo.class}" title="${statusInfo.title}"></span>
                    </div>
                </div>
                
                <div class="card-body">
                    <h5 class="card-name">${displayName}</h5>
                    <p class="card-title">${title}</p>
                    <p class="card-department">
                        <i class="fas fa-sitemap"></i> ${departmentName}
                    </p>
                    <p class="card-email">
                        <i class="fas fa-envelope"></i> ${email}
                    </p>
                    
                    ${badgesHtml}
                    
                    ${generateScheduleInfo(statusInfo)}
                    
                    <div class="card-meta">
                        <small class="text-muted">
                            最後登入: ${formatLastLogin(employee.last_login_at)}
                        </small>
                    </div>
                </div>
                
                <div class="card-footer">
                    <button class="btn btn-sm btn-primary" onclick="OrganizationEmployeeCardModule.viewDetails(${userId})">
                        <i class="fas fa-eye"></i> 查看詳情
                    </button>
                    <div class="card-actions">
                        <button class="btn btn-sm btn-outline" onclick="OrganizationEmployeeCardModule.editEmployee(${userId})" title="編輯">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline" onclick="OrganizationEmployeeCardModule.editUserPermissions(${userId})" title="編輯權限">
                            <i class="fas fa-shield-alt"></i>
                        </button>
                        ${statusInfo.needsActivation ? 
                            `<button class="btn btn-sm btn-outline btn-warning" 
                                     onclick="OrganizationEmployeeCardModule.resendActivationEmail(${userId}, '${email}')" 
                                     title="重發啟用密碼郵件">
                                <i class="fas fa-envelope"></i>
                            </button>
                            <button class="btn btn-sm btn-outline ${isActive ? 'btn-danger' : 'btn-success'}" 
                                     onclick="OrganizationEmployeeCardModule.toggleStatus(${userId}, ${isActive})" 
                                     title="${isActive ? '停用' : '啟用'}">
                                <i class="fas fa-${isActive ? 'ban' : 'check'}"></i>
                            </button>
                            ` : 
                            `<button class="btn btn-sm btn-outline ${isActive ? 'btn-danger' : 'btn-success'}" 
                                     onclick="OrganizationEmployeeCardModule.toggleStatus(${userId}, ${isActive})" 
                                     title="${isActive ? '停用' : '啟用'}">
                                <i class="fas fa-${isActive ? 'ban' : 'check'}"></i>
                            </button>`
                        }
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * 格式化最後登入時間
     */
    function formatLastLogin(lastLogin) {
        if (!lastLogin) return '從未登入';
        
        const date = new Date(lastLogin);
        const now = new Date();
        const diff = now - date;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (days === 0) return '今天';
        if (days === 1) return '昨天';
        if (days < 7) return `${days} 天前`;
        if (days < 30) return `${Math.floor(days / 7)} 週前`;
        if (days < 365) return `${Math.floor(days / 30)} 個月前`;
        
        return date.toLocaleDateString('zh-TW');
    }
    
    /**
     * 查看員工詳情
     */
    function viewDetails(empId) {
        if (window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.showEmployeeDetail) {
            window.OrganizationEmployeeModule.showEmployeeDetail(empId);
        }
    }
    
    /**
     * 編輯員工
     */
    function editEmployee(empId) {
        if (window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.editUser) {
            window.OrganizationEmployeeModule.editUser(empId);
        }
    }
    
    /**
     * 編輯員工權限
     */
    function editUserPermissions(empId) {
        if (window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.editUserPermissions) {
            window.OrganizationEmployeeModule.editUserPermissions(empId);
        }
    }
    
    
    /**
     * 切換員工狀態
     */
    function toggleStatus(empId, currentStatus) {
        if (window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.toggleUserStatus) {
            window.OrganizationEmployeeModule.toggleUserStatus(empId, currentStatus);
        }
    }
    
    /**
     * 篩選員工卡片
     */
    function filterCards(criteria) {
        filteredEmployees = currentEmployees.filter(emp => {
            // 按狀態篩選
            if (criteria.status !== undefined) {
                if (criteria.status === 'active' && !emp.is_active) return false;
                if (criteria.status === 'inactive' && emp.is_active) return false;
            }
            
            // 按角色篩選
            if (criteria.roleId) {
                const hasRole = emp.department_roles?.some(r => r.id === criteria.roleId);
                if (!hasRole) return false;
            }
            
            // 按權限群組篩選
            if (criteria.permissionGroupId) {
                const hasPermission = emp.permission_groups?.some(p => {
                    const pId = typeof p === 'object' ? p.id : null;
                    return pId === criteria.permissionGroupId;
                });
                if (!hasPermission) return false;
            }
            
            // 按搜尋詞篩選
            if (criteria.searchTerm) {
                const term = criteria.searchTerm.toLowerCase();
                const name = (emp.name || emp.username || emp.loginid || '').toLowerCase();
                const email = (emp.email || '').toLowerCase();
                const dept = (emp.department_name || '').toLowerCase();
                
                if (!name.includes(term) && !email.includes(term) && !dept.includes(term)) {
                    return false;
                }
            }
            
            return true;
        });
        
        renderEmployeeCards();
    }
    
    /**
     * 統一的員工角色比較函數
     * 排序規則：1.管理角色優先 2.角色等級數字越小越優先 3.同等級按員工編號排序
     */
    function compareEmployeesByRole(empA, empB) {
        const getRoleWeight = (employee) => {
            const roles = employee.department_roles || [];
            if (!roles.length) return { weight: 1000, level: 999, employeeNo: getEmployeeNo(employee) };
            
            // 找出最高優先級的角色
            const topRole = roles.reduce((top, role) => {
                const isManager = role.role_type === 'manager';
                const topIsManager = top.role_type === 'manager';
                
                // 管理角色優先
                if (isManager && !topIsManager) return role;
                if (!isManager && topIsManager) return top;
                
                // 相同類型比較等級（數字越小優先級越高）
                if ((role.level || 999) < (top.level || 999)) return role;
                return top;
            }, roles[0]);
            
            return {
                weight: topRole.role_type === 'manager' ? 0 : 1,
                level: topRole.level || 999,
                employeeNo: getEmployeeNo(employee)
            };
        };
        
        const aWeight = getRoleWeight(empA);
        const bWeight = getRoleWeight(empB);
        
        // 先比較角色類型權重
        if (aWeight.weight !== bWeight.weight) {
            return aWeight.weight - bWeight.weight;
        }
        
        // 再比較角色等級
        if (aWeight.level !== bWeight.level) {
            return aWeight.level - bWeight.level;
        }
        
        // 最後比較員工編號
        return compareEmployeeNumber(aWeight.employeeNo, bWeight.employeeNo);
    }
    
    /**
     * 獲取員工編號
     */
    function getEmployeeNo(employee) {
        return employee.user_extension?.employee_no || 
               employee.employee_no || 
               employee.loginid || 
               employee.username || 
               '';
    }
    
    /**
     * 智能員工編號比較（支援數字/字母混合）
     */
    function compareEmployeeNumber(a, b) {
        if (!a && !b) return 0;
        if (!a) return 1;
        if (!b) return -1;
        
        // 嘗試自然排序（A001, A002, A010）
        const regex = /^([A-Za-z]*)(\d+)(.*)$/;
        const matchA = a.match(regex);
        const matchB = b.match(regex);
        
        if (matchA && matchB) {
            // 先比較字母部分
            if (matchA[1] !== matchB[1]) {
                return matchA[1].localeCompare(matchB[1]);
            }
            // 再比較數字部分
            const numA = parseInt(matchA[2], 10);
            const numB = parseInt(matchB[2], 10);
            if (numA !== numB) {
                return numA - numB;
            }
            // 最後比較後綴
            return matchA[3].localeCompare(matchB[3]);
        }
        
        // 回退到字符串比較
        return a.localeCompare(b);
    }
    
    /**
     * 排序員工卡片
     */
    function sortCards(sortBy) {
        filteredEmployees.sort((a, b) => {
            switch (sortBy) {
                case 'role':
                    return compareEmployeesByRole(a, b);
                    
                case 'name':
                    const nameA = a.name || a.username || a.loginid || '';
                    const nameB = b.name || b.username || b.loginid || '';
                    return nameA.localeCompare(nameB);
                    
                case 'employee_no':
                    return compareEmployeeNumber(getEmployeeNo(a), getEmployeeNo(b));
                                        
                case 'lastLogin':
                    const loginA = new Date(a.last_login_at || 0);
                    const loginB = new Date(b.last_login_at || 0);
                    return loginB - loginA;
                    
                case 'status':
                    return b.is_active - a.is_active;
                    
                default:
                    return 0;
            }
        });
        
        renderEmployeeCards();
    }
    
    /**
     * 綁定卡片事件
     */
    function bindCardEvents() {
        // 為每個卡片添加拖曳功能
        document.querySelectorAll('.employee-card').forEach(card => {
            card.draggable = true;
            
            card.addEventListener('dragstart', (e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('empId', card.dataset.empId);
                card.classList.add('dragging');
            });
            
            card.addEventListener('dragend', (e) => {
                card.classList.remove('dragging');
            });
        });
        
        // 綁定 badge 懸停展開事件
        if (window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.bindEmployeeBadgeEvents) {
            window.OrganizationEmployeeModule.bindEmployeeBadgeEvents();
        }
    }
    
    /**
     * 高亮指定員工卡片並自動捲動
     */
    function highlightEmployee(empId) {
        console.log('highlightEmployee called with empId:', empId);
        
        // 移除現有高亮
        document.querySelectorAll('.employee-card').forEach(card => {
            card.classList.remove('highlight');
        });
        
        // 調試：列出所有卡片的 ID
        const allCards = document.querySelectorAll('.employee-card');
        console.log('Available employee cards:', Array.from(allCards).map(card => card.dataset.empId));
        
        // 高亮目標卡片
        const targetCard = document.querySelector(`.employee-card[data-emp-id="${empId}"]`);
        console.log('Target card found:', !!targetCard);
        
        if (targetCard) {
            targetCard.classList.add('highlight');
            
            // 自動捲動到該卡片（僅滾動容器，不影響整體頁面）
            const container = document.getElementById('employeeCardsContainer');
            if (container) {
                const containerRect = container.getBoundingClientRect();
                const cardRect = targetCard.getBoundingClientRect();
                const scrollTop = container.scrollTop + (cardRect.top - containerRect.top) - (containerRect.height / 2) + (cardRect.height / 2);
                
                container.scrollTo({
                    top: scrollTop,
                    behavior: 'smooth'
                });
            }
            
            // 3秒後移除高亮效果
            setTimeout(() => {
                targetCard.classList.remove('highlight');
            }, 3000);
        } else {
            console.warn('Employee card not found for ID:', empId);
        }
    }

    /**
     * 獲取當前顯示的員工
     */
    function getCurrentEmployees() {
        return filteredEmployees;
    }
    
    /**
     * 更新單個員工卡片狀態
     * @param {number} userId - 員工ID  
     * @param {object} updatedData - 更新的資料
     * @returns {boolean} - 更新是否成功
     */
    function updateSingleEmployeeCard(userId, updatedData) {
        console.log('updateSingleEmployeeCard 被調用:', userId, updatedData);
        
        // 1. 更新本地資料陣列 currentEmployees
        const empIndex = currentEmployees.findIndex(emp => (emp.user_id || emp.id) === userId);
        if (empIndex === -1) {
            console.warn('在 currentEmployees 中找不到用戶ID:', userId);
            return false;
        }
        
        // 2. 套用更新資料
        console.log('更新前員工資料:', currentEmployees[empIndex]);
        Object.assign(currentEmployees[empIndex], updatedData);
        console.log('更新後員工資料:', currentEmployees[empIndex]);
        
        // 3. 同步更新過濾後的陣列 filteredEmployees
        const filteredIndex = filteredEmployees.findIndex(emp => (emp.user_id || emp.id) === userId);
        if (filteredIndex !== -1) {
            Object.assign(filteredEmployees[filteredIndex], updatedData);
            console.log('同步更新 filteredEmployees 成功');
        } else {
            console.warn('在 filteredEmployees 中找不到用戶ID:', userId);
        }
        
        // 4. 重新渲染所有卡片（保持排序和篩選狀態）
        console.log('重新渲染員工卡片...');
        renderEmployeeCards();
        
        console.log('updateSingleEmployeeCard 完成，返回 true');
        return true;
    }
    
    /**
     * 重發啟用郵件
     */
    function resendActivationEmail(userId, email) {
        // 確認操作，使用回調方式
        Dialog.confirm(
            `確定要重新發送啟用郵件到 ${email} 嗎？請注意舊的啟用連結將失效。`,
            async function() {
                try {
                    // 調用組織管理 API
                    const response = await fetch(`/api/organization/users/${userId}/resend-activation`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        credentials: 'include'
                    });
                    
                    const result = await response.json();
                    
                    if (response.ok && result.success) {
                        Dialog.success(result.message || '啟用郵件已重新發送，請提醒用戶檢查信箱');
                        
                        // 刷新員工卡片以更新狀態
                        if (window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.loadEmployees) {
                            setTimeout(() => {
                                window.OrganizationEmployeeModule.loadEmployees();
                            }, 1000);
                        }
                    } else {
                        Dialog.error(result.message || '發送失敗，請稍後再試');
                    }
                } catch (error) {
                    console.error('重發啟用郵件錯誤:', error);
                    Dialog.error('系統錯誤，請稍後再試');
                }
            },
            {
                title: '重新發送啟用郵件',
                confirmText: '發送',
                cancelText: '取消'
            }
        );
    }
    
    // 公開API
    return {
        init,
        renderEmployeeCards,
        loadAndRenderEmployeeCards,
        filterCards,
        sortCards,
        getCurrentEmployees,
        updateSingleEmployeeCard,
        highlightEmployee,
        viewDetails,
        editEmployee,
        editUserPermissions,
        toggleStatus,
        resendActivationEmail
    };
})();

// 確保模組可被存取
window.OrganizationEmployeeCardModule = OrganizationEmployeeCardModule;