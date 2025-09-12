/**
 * 組織管理 - 員工角色選擇子模組
 * 處理員工的部門角色選擇，包含主要角色和其他部門角色
 */
window.OrganizationEmployeeRolesModule = (function () {
    'use strict';

    // API 端點
    const API_BASE = '/api/organization';

    // 狀態管理
    let currentDepartmentId = null;
    let currentDepartmentRoles = [];
    let primaryRoleId = null;
    let primaryRoleName = '';
    let selectedOtherRoles = new Set();
    let allDepartmentsRoles = [];
    let isInitialized = false;

    /**
     * 初始化模組
     */
    function init() {
        if (isInitialized) return;

        console.log('OrganizationEmployeeRolesModule 初始化');
        bindModalEvents();
        isInitialized = true;
    }

    /**
     * 當部門變更時
     */
    async function onDepartmentChange(deptId, isEditMode = false) {
        currentDepartmentId = deptId;
        const primaryRoleSelect = document.getElementById('userPrimaryRole');
        const otherRolesBtn = document.getElementById('setOtherRolesBtn');

        if (!deptId) {
            // 清空主要角色選項
            primaryRoleSelect.innerHTML = '<option value="">請先選擇部門</option>';
            primaryRoleSelect.disabled = true;

            // 禁用其他角色按鈕
            otherRolesBtn.disabled = true;

            // 重置狀態
            resetRolesState();
            return;
        }

        // 編輯模式下不重置狀態，保留以便後續設定
        if (!isEditMode) {
            // 重置主要角色狀態，以便套用預設選擇邏輯
            primaryRoleId = null;
            primaryRoleName = '';
            selectedOtherRoles.clear();
            updateOtherRolesCount();
        }

        // 載入該部門的角色
        await loadDepartmentRoles(deptId);

        // 啟用主要角色選擇
        primaryRoleSelect.disabled = false;
        updatePrimaryRoleOptions(isEditMode);
    }

    /**
     * 載入部門角色
     */
    async function loadDepartmentRoles(deptId) {
        try {
            const response = await fetch(`${API_BASE}/departments/${deptId}/roles`, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                currentDepartmentRoles = await response.json();
                // 只顯示啟用的角色
                currentDepartmentRoles = currentDepartmentRoles.filter(r => r.is_active);
                console.log(`載入部門 ${deptId} 的角色:`, currentDepartmentRoles);
            } else {
                console.error('載入部門角色失敗:', response.status);
                currentDepartmentRoles = [];
            }
        } catch (error) {
            console.error('載入部門角色失敗:', error);
            currentDepartmentRoles = [];
        }
    }

    /**
     * 更新主要角色選項
     */
    function updatePrimaryRoleOptions(isEditMode = false) {
        const select = document.getElementById('userPrimaryRole');
        if (!select) return;

        // 清空現有選項
        select.innerHTML = '<option value="">請選擇主要角色</option>';

        if (currentDepartmentRoles.length === 0) {
            select.innerHTML = '<option value="">此部門暫無角色</option>';

            // 如果已經初始化了 SearchableSelect，更新它
            if (select.searchableSelectInstance) {
                select.searchableSelectInstance.reload();
            }
            return;
        }

        // 按角色類型和層級排序
        const sortedRoles = currentDepartmentRoles.sort((a, b) => {
            // 管理角色優先
            if (a.role_type === 'manager' && b.role_type !== 'manager') return -1;
            if (a.role_type !== 'manager' && b.role_type === 'manager') return 1;
            // 然後按層級排序
            return (b.level || 0) - (a.level || 0);
        });

        sortedRoles.forEach(role => {
            const option = document.createElement('option');
            option.value = role.id;
            option.textContent = role.name;

            // 添加 data 屬性標記角色類型
            option.dataset.roleType = role.role_type;
            option.dataset.level = role.level || 0;

            select.appendChild(option);
        });

        // 自動選擇預設角色（只在新增員工時）
        // 優先選擇非管理職且角色等級最小（數字最大）的角色
        if (!isEditMode && !primaryRoleId && !select.value) {  // 只在新增模式且沒有已選擇角色時
            const nonManagerRoles = sortedRoles.filter(r => r.role_type !== 'manager');
            let defaultRole = null;

            if (nonManagerRoles.length > 0) {
                // 選擇 level 數字最大的角色（等級最低）
                defaultRole = nonManagerRoles.reduce((prev, curr) =>
                    (curr.level || 0) > (prev.level || 0) ? curr : prev
                );
            } else if (sortedRoles.length > 0) {
                // 如果沒有非管理角色，選擇 level 數字最大的管理角色（等級最低）
                defaultRole = sortedRoles.reduce((prev, curr) =>
                    (curr.level || 0) > (prev.level || 0) ? curr : prev
                );
            }

            if (defaultRole) {
                select.value = defaultRole.id;
                primaryRoleId = defaultRole.id;
                primaryRoleName = defaultRole.name;

                // 啟用「設定其他部門角色」按鈕
                const otherRolesBtn = document.getElementById('setOtherRolesBtn');
                if (otherRolesBtn) {
                    otherRolesBtn.disabled = false;
                }

                console.log('自動選擇預設角色:', defaultRole.name, '(Level:', defaultRole.level, ', Type:', defaultRole.role_type, ')');
            }
        }

        // 初始化或重新載入 SearchableSelect
        initPrimaryRoleSearchable();
    }

    /**
     * 初始化主要角色的 SearchableSelect，並自定義渲染
     */
    function initPrimaryRoleSearchable() {
        const select = document.getElementById('userPrimaryRole');
        if (!select) return;

        // 如果已經初始化過，重新載入
        if (select.searchableSelectInstance) {
            select.searchableSelectInstance.reload();
            // 覆蓋 renderOptions 方法以加入圖標
            customizeRoleRender(select.searchableSelectInstance);
            // 再次觸發 updateDisplay 以顯示自動選中角色的圖標
            select.searchableSelectInstance.updateDisplay();
        } else if (window.SearchableSelect) {
            // 創建新的 SearchableSelect 實例
            const instance = new SearchableSelect(select, {
                placeholder: '請選擇主要角色',
                searchPlaceholder: '搜尋角色...',
                noResultsText: '找不到符合的角色',
                maxHeight: '200px'
            });
            select.searchableSelectInstance = instance;

            // 覆蓋 renderOptions 方法以加入圖標
            customizeRoleRender(instance);
            // 再次觸發 updateDisplay 以顯示自動選中角色的圖標
            select.searchableSelectInstance.updateDisplay();
        }
    }

    /**
     * 自定義角色渲染，加入 Font Awesome 圖標
     */
    function customizeRoleRender(instance) {
        const originalRenderOptions = instance.renderOptions.bind(instance);
        const originalUpdateDisplay = instance.updateDisplay.bind(instance);

        // 覆蓋 renderOptions 方法以在下拉選項中加入圖標
        instance.renderOptions = function () {
            originalRenderOptions();

            // 獲取所有選項元素並加入圖標
            const optionElements = instance.optionsContainer.querySelectorAll('.searchable-select-option');
            optionElements.forEach((optionEl, index) => {
                const filteredOption = instance.filteredOptions[index];
                if (filteredOption) {
                    // 從原始 select 找到對應的 option
                    const originalOption = Array.from(instance.originalSelect.options).find(
                        opt => opt.value === filteredOption.value
                    );

                    if (originalOption && originalOption.dataset.roleType) {
                        const roleType = originalOption.dataset.roleType;
                        const iconClass = roleType === 'manager' ? 'fa-user-tie' : 'fa-user';
                        const colorClass = roleType === 'manager' ? 'text-warning' : 'text-primary';

                        // 如果不是選中的選項，加入圖標
                        if (!filteredOption.selected) {
                            optionEl.innerHTML = `<i class="fas ${iconClass} ${colorClass}" style="margin-right: 8px;"></i>${filteredOption.text}`;
                        } else {
                            // 選中的選項已經有 check 圖標，修改為包含角色圖標
                            optionEl.innerHTML = `<i class="fas fa-check" style="margin-right: 8px;"></i><i class="fas ${iconClass} ${colorClass}" style="margin-right: 8px;"></i>${filteredOption.text}`;
                        }
                    }
                }
            });
        };

        // 覆蓋 updateDisplay 方法以在顯示欄位中加入圖標
        instance.updateDisplay = function () {
            originalUpdateDisplay();

            const selectedOption = instance.originalSelect.options[instance.originalSelect.selectedIndex];

            if (selectedOption && selectedOption.value && selectedOption.dataset.roleType) {
                const roleType = selectedOption.dataset.roleType;
                const iconClass = roleType === 'manager' ? 'fa-user-tie' : 'fa-user';
                const colorClass = roleType === 'manager' ? 'text-warning' : 'text-primary';

                // 更新顯示文字，加入圖標
                instance.displayText.innerHTML = `<i class="fas ${iconClass} ${colorClass}" style="margin-right: 8px;"></i>${selectedOption.textContent}`;
                instance.displayText.style.color = 'var(--text-primary)';
            }
        };
    }

    /**
     * 初始化密碼策略選擇器
     */
    function initPasswordStrategySelector() {
        const select = document.getElementById('passwordStrategy');
        if (!select) return;

        // 如果已經初始化過，重新載入
        if (select.searchableSelectInstance) {
            select.searchableSelectInstance.reload();
            // 覆蓋渲染方法以加入圖標
            customizePasswordStrategyRender(select.searchableSelectInstance);
            select.searchableSelectInstance.updateDisplay();
        } else if (window.SearchableSelect) {
            // 創建新的 SearchableSelect 實例
            const instance = new SearchableSelect(select, {
                placeholder: '請選擇密碼策略',
                searchPlaceholder: '搜尋策略...',
                noResultsText: '找不到符合的策略',
                maxHeight: '150px'
            });
            select.searchableSelectInstance = instance;

            // 覆蓋渲染方法以加入圖標
            customizePasswordStrategyRender(instance);
            
            // 檢查原始 select 是否已有值，如果有則更新顯示
            if (select.value) {
                // 延遲一點以確保 DOM 已完全更新
                setTimeout(() => {
                    instance.updateDisplay();
                }, 10);
            } else {
                instance.updateDisplay();
            }
        }
    }

    /**
     * 自定義密碼策略渲染，加入 Font Awesome 圖標
     */
    function customizePasswordStrategyRender(instance) {
        const originalRenderOptions = instance.renderOptions.bind(instance);
        const originalUpdateDisplay = instance.updateDisplay.bind(instance);

        // 覆蓋 renderOptions 方法以在下拉選項中加入圖標
        instance.renderOptions = function () {
            originalRenderOptions();

            // 獲取所有選項元素並加入圖標
            const optionElements = instance.optionsContainer.querySelectorAll('.searchable-select-option');
            optionElements.forEach((optionEl, index) => {
                const filteredOption = instance.filteredOptions[index];
                if (filteredOption && filteredOption.value) {
                    const option = instance.originalSelect.querySelector(`option[value="${filteredOption.value}"]`);
                    if (option && option.dataset.strategyType) {
                        const strategyType = option.dataset.strategyType;
                        let iconClass, colorClass;

                        switch (strategyType) {
                            case 'activation':
                                iconClass = 'fa-envelope';
                                colorClass = 'text-info';
                                break;
                            case 'temp':
                                iconClass = 'fa-key';
                                colorClass = 'text-warning';
                                break;
                            case 'manual':
                                iconClass = 'fa-edit';
                                colorClass = 'text-success';
                                break;
                        }

                        if (iconClass) {
                            // 檢查是否已選中
                            const isSelected = filteredOption.value === instance.originalSelect.value;
                            if (isSelected) {
                                optionEl.innerHTML = `<i class="fas fa-check text-primary" style="margin-right: 8px;"></i><i class="fas ${iconClass} ${colorClass}" style="margin-right: 8px;"></i>${filteredOption.text}`;
                            } else {
                                optionEl.innerHTML = `<i class="fas ${iconClass} ${colorClass}" style="margin-right: 8px;"></i>${filteredOption.text}`;
                            }
                        }
                    }
                }
            });
        };

        // 覆蓋 updateDisplay 方法以在顯示欄位中加入圖標
        instance.updateDisplay = function () {
            originalUpdateDisplay();

            const selectedOption = instance.originalSelect.options[instance.originalSelect.selectedIndex];

            if (selectedOption && selectedOption.value && selectedOption.dataset.strategyType) {
                const strategyType = selectedOption.dataset.strategyType;
                let iconClass, colorClass;

                switch (strategyType) {
                    case 'activation':
                        iconClass = 'fa-envelope';
                        colorClass = 'text-info';
                        break;
                    case 'temp':
                        iconClass = 'fa-key';
                        colorClass = 'text-warning';
                        break;
                    case 'manual':
                        iconClass = 'fa-edit';
                        colorClass = 'text-success';
                        break;
                }

                if (iconClass) {
                    // 更新顯示文字，加入圖標
                    instance.displayText.innerHTML = `<i class="fas ${iconClass} ${colorClass}" style="margin-right: 8px;"></i>${selectedOption.textContent}`;
                    instance.displayText.style.color = 'var(--text-primary)';
                }
            }
        };
    }

    /**
     * 當主要角色變更時
     */
    function onPrimaryRoleChange(roleId) {
        const otherRolesBtn = document.getElementById('setOtherRolesBtn');

        if (!roleId) {
            primaryRoleId = null;
            primaryRoleName = '';
            if (otherRolesBtn) {
                otherRolesBtn.disabled = true;
            }
            selectedOtherRoles.clear();
            updateOtherRolesCount();
            return;
        }

        // 儲存主要角色資訊
        primaryRoleId = roleId;
        const role = currentDepartmentRoles.find(r => r.id == roleId);
        primaryRoleName = role ? role.name : '';

        // 啟用其他角色按鈕
        if (otherRolesBtn) {
            otherRolesBtn.disabled = false;
        }

        // 從已選角色中移除主要角色（避免重複）
        selectedOtherRoles.delete(roleId.toString());
        updateOtherRolesCount();
    }

    /**
     * 顯示角色選擇模態框
     */
    async function showRolesModal() {
        if (!primaryRoleId) {
            if (window.Dialog) {
                window.Dialog.warning('請先選擇主要角色');
            } else {
                alert('請先選擇主要角色');
            }
            return;
        }

        const modal = document.getElementById('employeeRolesModal');
        if (!modal) {
            console.error('找不到員工角色模態框');
            return;
        }

        // 更新主要角色名稱
        const primaryRoleNameEl = document.getElementById('modalPrimaryRoleName');
        if (primaryRoleNameEl) {
            primaryRoleNameEl.textContent = primaryRoleName;
        }

        // 顯示載入中
        const container = document.getElementById('rolesTreeContainer');
        if (container) {
            container.innerHTML = `
                <div class="loading-spinner">
                    <div class="spinner"></div>
                    <p>載入角色資料中...</p>
                </div>
            `;
        }

        // 顯示模態框
        modal.classList.add('show');
        document.body.classList.add('modal-open');

        // 載入所有部門和角色
        await loadAllDepartmentsRoles();

        // 建立樹狀結構
        buildRolesTree();
    }

    /**
     * 載入所有部門和角色（優化版本，使用快取）
     */
    async function loadAllDepartmentsRoles() {
        try {
            // 使用 OrganizationModule 的共享快取機制
            if (window.OrganizationModule && window.OrganizationModule.getDepartmentRolesWithCache) {
                console.log('使用 OrganizationModule 共享快取載入部門角色資料');
                allDepartmentsRoles = await window.OrganizationModule.getDepartmentRolesWithCache();
            } else {
                // 降級處理：如果主模組不可用，使用原來的方式
                console.warn('OrganizationModule 不可用，使用降級載入方式');
                await loadAllDepartmentsRolesLegacy();
            }
        } catch (error) {
            console.error('載入部門角色樹失敗:', error);
            // 嘗試降級處理
            try {
                console.log('嘗試降級載入...');
                await loadAllDepartmentsRolesLegacy();
            } catch (legacyError) {
                console.error('降級載入也失敗:', legacyError);
                allDepartmentsRoles = [];
            }
        }
    }

    /**
     * 舊版載入方式（降級處理）
     */
    async function loadAllDepartmentsRolesLegacy() {
        // 載入部門樹
        const deptResponse = await fetch(`${API_BASE}/departments?tree=true`, {
            credentials: 'include'
        });

        if (deptResponse.ok) {
            allDepartmentsRoles = await deptResponse.json();

            // 為每個部門載入角色
            await loadRolesForDepartments(allDepartmentsRoles);
        } else {
            console.error('部門樹回應錯誤:', deptResponse.status);
            throw new Error(`部門樹載入失敗: ${deptResponse.status}`);
        }
    }

    /**
     * 遞迴載入部門角色
     */
    async function loadRolesForDepartments(departments) {
        for (const dept of departments) {
            if (dept.is_active) {
                try {
                    const response = await fetch(`${API_BASE}/departments/${dept.id}/roles`, {
                        credentials: 'include'
                    });

                    if (response.ok) {
                        dept.roles = await response.json();
                    } else {
                        dept.roles = [];
                    }
                } catch (error) {
                    console.error(`載入部門 ${dept.id} 角色失敗:`, error);
                    dept.roles = [];
                }
            }

            // 遞迴處理子部門
            if (dept.children && dept.children.length > 0) {
                await loadRolesForDepartments(dept.children);
            }
        }
    }

    /**
     * 建立角色樹狀結構
     */
    function buildRolesTree() {
        const container = document.getElementById('rolesTreeContainer');
        if (!container) return;

        let totalRoles = 0;
        let treeHtml = '';

        /**
         * 遞迴建立節點
         */
        function buildNode(dept, level = 0) {
            // 只顯示啟用的部門
            if (!dept.is_active) return '';

            const roles = dept.roles || [];
            // 過濾：只顯示啟用的角色，並排除主要角色
            const activeRoles = roles.filter(r => r.is_active && r.id != primaryRoleId);
            totalRoles += activeRoles.length;

            // 如果部門沒有可選角色且沒有子部門，則不顯示
            const hasChildren = dept.children && dept.children.length > 0;
            if (activeRoles.length === 0 && !hasChildren) {
                return '';
            }

            let html = `
                <div class="tree-node dept-node" data-dept-id="${dept.id}">
                    <div class="node-content" data-level="${level}" 
                         style="padding-left: ${level * 24}px; ${hasChildren || activeRoles.length > 0 ? 'cursor: pointer;' : ''}"
                         ${hasChildren || activeRoles.length > 0 ? `onclick="OrganizationEmployeeRolesModule.toggleNode(${dept.id})"` : ''}>
                        ${hasChildren || activeRoles.length > 0 ? `
                            <span class="node-toggle">
                                <i class="fas fa-chevron-down"></i>
                            </span>
                        ` : '<span class="node-spacer"></span>'}
                        <i class="fas fa-folder text-primary"></i>
                        <span class="node-name">${dept.name}</span>
                    </div>
                    <div class="node-children" id="dept-children-${dept.id}">
            `;

            // 添加角色節點
            activeRoles.forEach(role => {
                const isChecked = selectedOtherRoles.has(role.id.toString());
                const roleIcon = role.role_type === 'manager' ? 'user-tie' : 'user';
                const roleClass = role.role_type === 'manager' ? 'text-warning' : 'text-primary';

                html += `
                    <div class="tree-node role-node">
                        <div class="node-content" data-level="${level + 1}" 
                             onclick="OrganizationEmployeeRolesModule.toggleRoleByRow(${role.id})"
                             style="padding-left: ${(level + 1) * 24}px; cursor: pointer;">
                            <input type="checkbox" class="form-check-input" 
                                   id="role-${role.id}" value="${role.id}" 
                                   ${isChecked ? 'checked' : ''}
                                   onclick="event.stopPropagation()"
                                   onchange="OrganizationEmployeeRolesModule.toggleRoleSelection(${role.id})">
                            <label for="role-${role.id}" class="form-check-label ms-2" 
                                   onclick="event.stopPropagation()">
                                <i class="fas fa-${roleIcon} ${roleClass}"></i>
                                <span>${role.name}</span>
                            </label>
                        </div>
                    </div>
                `;
            });

            // 遞迴處理子部門
            if (hasChildren) {
                dept.children.forEach(child => {
                    html += buildNode(child, level + 1);
                });
            }

            html += '</div></div>';
            return html;
        }

        // 建立整個樹

        allDepartmentsRoles.forEach(dept => {
            treeHtml += buildNode(dept);
        });

        if (!treeHtml) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users-cog fa-3x text-muted"></i>
                    <p class="text-muted mt-3">暫無可選的其他角色</p>
                    <small class="text-muted">所有角色都已被設為主要角色或沒有其他部門角色</small>
                </div>
            `;
        } else {
            container.innerHTML = treeHtml;

            // 預設收合所有節點（除了第一層）
            document.querySelectorAll('#rolesTreeContainer .node-children').forEach(el => {
                // 只收合第二層以下的節點
                const parentNode = el.parentElement;
                if (parentNode) {
                    const level = parentNode.querySelector('.node-content').dataset.level;
                    if (level && parseInt(level) > 0) {
                        el.style.display = 'none';
                        const toggle = parentNode.querySelector('.node-toggle i');
                        if (toggle) {
                            toggle.className = 'fas fa-chevron-right';
                        }
                    }
                }
            });

            // 如果有已選擇的角色，展開到那些節點
            if (selectedOtherRoles.size > 0) {
                selectedOtherRoles.forEach(roleId => {
                    const checkbox = document.getElementById(`role-${roleId}`);
                    if (checkbox) {
                        // 找到該角色的所有父節點並展開
                        let parent = checkbox.closest('.tree-node.role-node');
                        while (parent) {
                            parent = parent.parentElement;
                            if (parent && parent.classList.contains('node-children')) {
                                parent.style.display = 'block';
                                const deptNode = parent.parentElement;
                                if (deptNode && deptNode.classList.contains('dept-node')) {
                                    const toggle = deptNode.querySelector('.node-toggle i');
                                    if (toggle) {
                                        toggle.className = 'fas fa-chevron-down';
                                    }
                                }
                            }
                        }
                    }
                });
            }
        }

        // 更新統計
        const totalCountEl = document.getElementById('totalRolesCount');
        if (totalCountEl) {
            totalCountEl.textContent = totalRoles;
        }
        updateSelectedCount();

        // 初始化滾動條淡出效果
        if (window.CommonUI && window.CommonUI.initScrollFadeEffect) {
            const container = document.getElementById('rolesTreeContainer');
            if (container) {
                container.classList.add('scrollable-fade');
            }
            window.CommonUI.initScrollFadeEffect();
        }
    }

    /**
     * 切換部門節點展開/收合
     */
    function toggleNode(deptId) {
        const children = document.getElementById(`dept-children-${deptId}`);
        if (!children) return;

        // 阻止事件冒泡
        if (event) {
            event.stopPropagation();
        }

        // 找到節點內的圖標
        const nodeContent = event.currentTarget || event.target.closest('.node-content');
        const icon = nodeContent ? nodeContent.querySelector('.node-toggle i') : null;

        if (children.style.display === 'none') {
            children.style.display = 'block';
            if (icon) icon.className = 'fas fa-chevron-down';
        } else {
            children.style.display = 'none';
            if (icon) icon.className = 'fas fa-chevron-right';
        }
    }

    /**
     * 切換角色選擇
     */
    function toggleRoleSelection(roleId) {
        const checkbox = document.getElementById(`role-${roleId}`);
        if (!checkbox) return;

        if (checkbox.checked) {
            selectedOtherRoles.add(roleId.toString());
        } else {
            selectedOtherRoles.delete(roleId.toString());
        }
        updateSelectedCount();
    }

    /**
     * 點擊整行切換角色選擇
     */
    function toggleRoleByRow(roleId) {
        const checkbox = document.getElementById(`role-${roleId}`);
        if (!checkbox) return;

        // 切換checkbox狀態
        checkbox.checked = !checkbox.checked;

        // 更新選中狀態
        if (checkbox.checked) {
            selectedOtherRoles.add(roleId.toString());
        } else {
            selectedOtherRoles.delete(roleId.toString());
        }
        updateSelectedCount();
    }

    /**
     * 搜尋角色
     */
    function searchRoles() {
        const searchTerm = document.getElementById('rolesTreeSearch').value.toLowerCase();

        // 先清除所有高亮
        document.querySelectorAll('#rolesTreeContainer .tree-node').forEach(node => {
            node.classList.remove('search-highlight', 'search-highlight-dept', 'search-highlight-role');
        });

        if (!searchTerm) {
            // 顯示所有節點 (只在角色模態框內)
            document.querySelectorAll('#rolesTreeContainer .tree-node').forEach(node => {
                node.style.display = 'block';
            });

            // 展開所有包含角色的部門
            document.querySelectorAll('#rolesTreeContainer .node-children').forEach(el => {
                el.style.display = 'block';
            });
            document.querySelectorAll('#rolesTreeContainer .node-toggle i').forEach(icon => {
                icon.className = 'fas fa-chevron-down';
            });

            return;
        }

        // 追蹤符合搜尋的部門
        const matchedDepts = new Set();
        const matchedRoles = new Set();

        // 先搜尋所有角色節點
        document.querySelectorAll('#rolesTreeContainer .role-node').forEach(node => {
            const label = node.querySelector('label');
            const roleText = label ? label.textContent.toLowerCase() : '';

            if (roleText.includes(searchTerm)) {
                matchedRoles.add(node);
                node.style.display = 'block';
                node.classList.add('search-highlight-role'); // 角色用黃色高亮

                // 確保父部門也顯示並展開
                let parent = node.parentElement;
                while (parent) {
                    if (parent.classList.contains('node-children')) {
                        parent.style.display = 'block';
                        const deptNode = parent.parentElement;
                        if (deptNode && deptNode.classList.contains('dept-node')) {
                            matchedDepts.add(deptNode);
                            deptNode.style.display = 'block';
                            // 展開該部門
                            const toggle = deptNode.querySelector('.node-toggle i');
                            if (toggle) {
                                toggle.className = 'fas fa-chevron-down';
                            }
                        }
                    }
                    parent = parent.parentElement;
                }
            } else {
                node.style.display = 'none';
            }
        });

        // 再搜尋所有部門節點
        document.querySelectorAll('#rolesTreeContainer .dept-node').forEach(node => {
            const nodeName = node.querySelector('.node-name');
            const deptText = nodeName ? nodeName.textContent.toLowerCase() : '';

            if (deptText.includes(searchTerm)) {
                node.style.display = 'block';
                node.classList.add('search-highlight-dept'); // 部門用藍色高亮
                matchedDepts.add(node);

                // 展開該部門以顯示所有子角色
                const children = node.querySelector('.node-children');
                if (children) {
                    children.style.display = 'block';
                    const toggle = node.querySelector('.node-toggle i');
                    if (toggle) {
                        toggle.className = 'fas fa-chevron-down';
                    }
                    // 顯示該部門的所有角色
                    children.querySelectorAll('.role-node').forEach(roleNode => {
                        roleNode.style.display = 'block';
                    });
                }

                // 確保父部門也顯示
                let parent = node.parentElement;
                while (parent && parent.classList.contains('node-children')) {
                    parent.style.display = 'block';
                    const parentDept = parent.parentElement;
                    if (parentDept && parentDept.classList.contains('dept-node')) {
                        parentDept.style.display = 'block';
                        matchedDepts.add(parentDept);
                        const toggle = parentDept.querySelector('.node-toggle i');
                        if (toggle) {
                            toggle.className = 'fas fa-chevron-down';
                        }
                    }
                    parent = parent.parentElement.parentElement;
                }
            } else if (!matchedDepts.has(node)) {
                // 只隱藏未被匹配角色引用的部門
                node.style.display = 'none';
            }
        });
    }

    /**
     * 展開全部節點
     */
    function expandAll() {
        document.querySelectorAll('#rolesTreeContainer .node-children').forEach(el => {
            el.style.display = 'block';
        });
        document.querySelectorAll('#rolesTreeContainer .node-toggle i').forEach(icon => {
            icon.className = 'fas fa-chevron-down';
        });
    }

    /**
     * 收合全部節點
     */
    function collapseAll() {
        document.querySelectorAll('#rolesTreeContainer .node-children').forEach(el => {
            el.style.display = 'none';
        });
        document.querySelectorAll('#rolesTreeContainer .node-toggle i').forEach(icon => {
            icon.className = 'fas fa-chevron-right';
        });
    }

    /**
     * 清除所有選擇
     */
    function clearSelection() {
        selectedOtherRoles.clear();
        document.querySelectorAll('#rolesTreeContainer input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });
        updateSelectedCount();
    }

    /**
     * 確認角色選擇
     */
    function confirmRolesSelection() {
        updateOtherRolesCount();
        closeRolesModal();
    }

    /**
     * 關閉模態框
     */
    function closeRolesModal() {
        const modal = document.getElementById('employeeRolesModal');
        if (modal) {
            modal.classList.remove('show');
            document.body.classList.remove('modal-open');
        }
    }

    /**
     * 獲取選中的角色資料（供主模組使用）
     */
    function getSelectedRoles() {
        const result = {
            primary_role_id: primaryRoleId ? parseInt(primaryRoleId) : null,
            department_roles: []
        };

        // 只加入其他選中的角色（不包含主要角色，避免重複）
        selectedOtherRoles.forEach(roleId => {
            result.department_roles.push(parseInt(roleId));
        });

        return result;
    }

    /**
     * 設定已選角色（編輯模式使用）
     */
    function setSelectedRoles(userData) {
        if (!userData) return;

        // 保存當前的部門角色資料（重要！編輯模式需要保留）
        const savedDepartmentRoles = currentDepartmentRoles.slice(); // 複製陣列

        // 重置選擇狀態（但不清空角色資料）
        primaryRoleId = null;
        primaryRoleName = '';
        selectedOtherRoles.clear();
        updateOtherRolesCount();

        // 恢復部門角色資料
        currentDepartmentRoles = savedDepartmentRoles;

        // 如果角色資料尚未載入，返回
        if (currentDepartmentRoles.length === 0) {
            console.warn('部門角色尚未載入，無法設定選中角色');
            return;
        }

        // 重新生成選項（確保選項存在），編輯模式不要自動選擇
        updatePrimaryRoleOptions(true);

        // 設定主要角色（覆蓋自動選擇的預設值）
        if (userData.department_roles && Array.isArray(userData.department_roles)) {
            const primaryRole = userData.department_roles.find(r => r.is_primary == 1);
            userData.primary_role_id = primaryRole.id;
           
            const primaryRoleSelect = document.getElementById('userPrimaryRole');
            if (primaryRoleSelect) {
                primaryRoleSelect.value = userData.primary_role_id;

                // 更新 SearchableSelect 顯示
                if (primaryRoleSelect._searchableSelect) {
                    primaryRoleSelect._searchableSelect.updateDisplay();
                } else if (primaryRoleSelect.searchableSelectInstance) {
                    primaryRoleSelect.searchableSelectInstance.reload();
                }

                onPrimaryRoleChange(userData.primary_role_id);
            }
        }

        // 設定其他角色
        if (userData.department_roles && Array.isArray(userData.department_roles)) {
            userData.department_roles.forEach(role => {
                // 處理物件或 ID
                const roleId = typeof role === 'object' ? role.id : role;

                // 排除主要角色
                if (roleId && roleId !== userData.primary_role_id) {
                    selectedOtherRoles.add(roleId.toString());
                }
            });
            updateOtherRolesCount();
        }

        console.log('設定角色完成，主要角色:', userData.primary_role_id, '其他角色:', Array.from(selectedOtherRoles));
    }

    /**
     * 重置角色狀態
     */
    function resetRolesState() {
        primaryRoleId = null;
        primaryRoleName = '';
        selectedOtherRoles.clear();
        currentDepartmentRoles = [];
        updateOtherRolesCount();

        // 重置表單元素
        const primaryRoleSelect = document.getElementById('userPrimaryRole');
        if (primaryRoleSelect) {
            primaryRoleSelect.value = '';
            primaryRoleSelect.disabled = true;
        }

        const otherRolesBtn = document.getElementById('setOtherRolesBtn');
        if (otherRolesBtn) {
            otherRolesBtn.disabled = true;
        }
    }

    /**
     * 更新其他角色數量顯示
     */
    function updateOtherRolesCount() {
        const badge = document.getElementById('otherRolesCount');
        if (!badge) return;

        const count = selectedOtherRoles.size;
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }

    /**
     * 更新已選數量
     */
    function updateSelectedCount() {
        const countEl = document.getElementById('selectedRolesCount');
        if (countEl) {
            countEl.textContent = selectedOtherRoles.size;
        }
    }

    /**
     * 綁定模態框事件
     */
    function bindModalEvents() {
        // ESC 鍵關閉
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('employeeRolesModal');
                if (modal && modal.classList.contains('show')) {
                    closeRolesModal();
                }
            }
        });

        // 移除點擊背景關閉功能 - 模態框不允許點擊背景關閉
        // const modal = document.getElementById('employeeRolesModal');
        // if (modal) {
        //     modal.addEventListener('click', (e) => {
        //         if (e.target === modal) {
        //             closeRolesModal();
        //         }
        //     });
        // }

        // 搜尋框即時搜尋
        const searchInput = document.getElementById('rolesTreeSearch');
        if (searchInput) {
            searchInput.addEventListener('input', debounce(searchRoles, 300));
        }
    }

    /**
     * 防抖動輔助函數
     */
    function debounce(func, delay) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }

    // 公開 API
    return {
        init,
        onDepartmentChange,
        onPrimaryRoleChange,
        initPasswordStrategySelector,
        showRolesModal,
        closeRolesModal,
        confirmRolesSelection,
        getSelectedRoles,
        setSelectedRoles,
        resetRolesState,
        toggleNode,
        toggleRoleSelection,
        toggleRoleByRow,
        expandAll,
        collapseAll,
        clearSelection,
        searchRoles
    };
})();

// 確保模組可被全域存取
if (typeof window.OrganizationEmployeeRolesModule === 'undefined') {
    console.error('OrganizationEmployeeRolesModule 載入失敗');
}
