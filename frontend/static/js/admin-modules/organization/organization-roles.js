/**
 * 組織角色管理主模組
 * 協調各子模組並提供統一的 API 介面
 */
const OrganizationRolesModule = (function() {
    'use strict';
    
    // API 端點
    const API_BASE = '/api/organization';
    
    // 子模組引用
    let stateModule = null;
    let initModule = null;
    let cardModule = null;
    let hierarchyModule = null;
    let usersModule = null;
    let roleTemplateModule = null;
    let crudModule = null;
    let dragModule = null;
    let modalModule = null;
    let hoverCardModule = null;
    let searchModule = null;
    let departmentModule = null;

    /**
     * 初始化模組
     */
    async function init() {
        console.log('OrganizationRolesModule 主模組初始化開始');
        
        // 初始化狀態管理模組
        if (window.__OrganizationRolesStateModule) {
            stateModule = window.__OrganizationRolesStateModule;
        }
        
        // 初始化子模組管理器
        if (window.__OrganizationRolesInitModule) {
            initModule = window.__OrganizationRolesInitModule;
            const modules = await initModule.initializeModules({ state: stateModule });
            
            // 保存子模組引用
            roleTemplateModule = modules.roleTemplateModule;
            crudModule = modules.crudModule;
            dragModule = modules.dragModule;
            modalModule = modules.modalModule;
            hoverCardModule = modules.hoverCardModule;
            searchModule = modules.searchModule;
            departmentModule = modules.departmentModule;
            cardModule = modules.cardModule;
            hierarchyModule = modules.hierarchyModule;
            usersModule = modules.usersModule;
        }
        
        // 綁定角色管理相關事件
        bindRoleManagementEvents();
        
        console.log('OrganizationRolesModule 主模組初始化完成');
    }

    // ===== 狀態管理包裝函數 =====
    
    /**
     * 獲取選中的部門ID
     */
    function getSelectedDeptId() {
        return stateModule ? stateModule.getState().selectedDeptId : null;
    }

    /**
     * 重置角色管理初始化狀態
     */
    function resetRoleManagementState() {
        if (stateModule) {
            stateModule.resetRoleManagementState();
        }
    }

    // ===== 模態框管理包裝函數 =====
    
    /**
     * 關閉部門角色模態框
     */
    function closeDepartmentRoleModal() {
        if (modalModule) {
            modalModule.closeDepartmentRoleModal();
        }
    }
    
    /**
     * 關閉新增部門角色模態框
     */
    function closeAddDepartmentRoleModal() {
        if (modalModule) {
            modalModule.closeAddDepartmentRoleModal();
        }
    }
    
    /**
     * 關閉編輯角色模態框
     */
    function closeEditDepartmentRoleModal() {
        if (modalModule) {
            modalModule.closeEditDepartmentRoleModal();
        }
    }
    
    /**
     * 關閉角色詳情模態框
     */
    function closeRoleDetailsModal() {
        if (modalModule) {
            modalModule.closeRoleDetailsModal();
        }
    }

    // ===== 角色模板包裝函數 =====
    
    /**
     * 載入部門角色選擇器（用於新增部門時）
     */
    async function loadRoleTemplateSelector(containerId = 'roleTemplateSelector') {
        if (roleTemplateModule) {
            const state = stateModule ? stateModule.getState() : {};
            await roleTemplateModule.loadRoleTemplateSelector(containerId, state.roleTemplates || []);
        }
    }
    
    /**
     * 載入角色模板用於新增
     */
    async function loadRoleTemplatesForAdd(batchMode = false) {
        if (roleTemplateModule) {
            const state = stateModule ? stateModule.getState() : {};
            if (!state.roleTemplates || state.roleTemplates.length === 0) {
                const roleTemplates = await roleTemplateModule.loadRoleTemplates() || [];
                if (stateModule) {
                    stateModule.setState({ roleTemplates });
                }
            }
            await roleTemplateModule.loadRoleTemplatesForAdd(batchMode, state.roleTemplates || []);
        }
    }
    
    /**
     * 顯示角色模板模態框
     */
    async function showRoleTemplateModal(templateId = null) {
        if (roleTemplateModule) {
            const state = stateModule ? stateModule.getState() : {};
            if (!state.roleTemplates || state.roleTemplates.length === 0) {
                const roleTemplates = await roleTemplateModule.loadRoleTemplates() || [];
                if (stateModule) {
                    stateModule.setState({ roleTemplates });
                }
            }
            roleTemplateModule.showRoleTemplateModal(templateId, state.roleTemplates || []);
        }
    }
    
    /**
     * 關閉角色模板模態框
     */
    function closeRoleTemplateModal() {
        if (roleTemplateModule) {
            roleTemplateModule.closeRoleTemplateModal();
        }
    }
    
    /**
     * 儲存角色模板
     */
    async function saveRoleTemplate() {
        if (roleTemplateModule && stateModule) {
            const result = await roleTemplateModule.saveRoleTemplate();
            if (result) {
                stateModule.setState({ roleTemplates: result });
            }
        }
    }
    
    /**
     * 編輯角色模板
     */
    function editRoleTemplate(templateId) {
        if (roleTemplateModule) {
            const state = stateModule ? stateModule.getState() : {};
            roleTemplateModule.editTemplate(templateId, state.roleTemplates || []);
        }
    }
    
    /**
     * 刪除角色模板
     */
    async function deleteRoleTemplate(templateId) {
        if (roleTemplateModule && stateModule) {
            const roleTemplates = await roleTemplateModule.deleteTemplate(templateId, stateModule.getState().roleTemplates || []);
            stateModule.setState({ roleTemplates });
        }
    }
    
    /**
     * 載入角色模板
     */
    async function loadRoleTemplates() {
        if (roleTemplateModule && stateModule) {
            const roleTemplates = await roleTemplateModule.loadRoleTemplates();
            stateModule.setState({ roleTemplates });
            return roleTemplates;
        }
        return [];
    }
    
    /**
     * 取得角色模板列表
     */
    function getRoleTemplates() {
        return stateModule ? stateModule.getState().roleTemplates || [] : [];
    }
    
    /**
     * 根據 ID 取得角色模板
     */
    function getRoleTemplateById(templateId) {
        if (roleTemplateModule) {
            const state = stateModule ? stateModule.getState() : {};
            return roleTemplateModule.getRoleTemplateById(templateId, state.roleTemplates || []);
        }
        return null;
    }

    // ===== 部門角色 CRUD 包裝函數 =====
    
    /**
     * 載入部門角色
     */
    async function loadDepartmentRoles(departmentId) {
        if (departmentModule && crudModule && stateModule) {
            const departmentRoles = await departmentModule.loadDepartmentRoles(departmentId, crudModule);
            stateModule.setState({ 
                departmentRoles, 
                currentDepartmentId: departmentId 
            });
            return departmentRoles;
        }
        return [];
    }
    
    /**
     * 建立部門角色（批量）
     */
    async function createDepartmentRoles(departmentId, selectedTemplates) {
        if (crudModule && stateModule) {
            const state = stateModule.getState();
            const result = await crudModule.createDepartmentRoles(departmentId, selectedTemplates, state.departmentRolesCache || {});
            // 通知角色統計數據已更新
            if (result.created_roles && Array.isArray(result.created_roles)) {
                notifyRoleStatsChanged();
            }
            return result;
        }
        throw new Error('CRUD 模組未初始化');
    }

    // ===== 角色詳情與用戶管理包裝函數 =====
    
    /**
     * 選擇角色（顯示角色詳情）
     */
    async function selectRole(roleId) {
        if (usersModule && stateModule) {
            const state = stateModule.getState();
            stateModule.setState({ currentRoleId: roleId });
            await usersModule.selectRoleAndShowDetails(roleId, state.departmentRoles || []);
        }
    }
    
    /**
     * 移除用戶的角色
     */
    async function removeUserFromRole(userId, roleId) {
        if (modalModule && crudModule) {
            await modalModule.removeUserFromRoleConfirm(userId, roleId, async (roleId, userId) => {
                if (crudModule) {
                    return await crudModule.removeUserFromRole(roleId, userId);
                }
                throw new Error('CRUD 模組未初始化');
            }, selectRole);
        }
    }

    // ===== 角色管理頁面功能 =====
    
    /**
     * 初始化角色管理頁面
     */
    async function initRoleManagement() {
        if (!stateModule) return;
        
        const state = stateModule.getState();
        
        // 防止重複初始化
        if (state.isRoleManagementInitialized) {
            console.log('角色管理已初始化，跳過重複初始化');
            return;
        }
        
        try {
            console.log('開始初始化角色管理頁面');
            // 載入部門樹資料
            await loadDepartmentTreeForRoles();
            // 標記已初始化
            stateModule.setState({ isRoleManagementInitialized: true });
            console.log('角色管理頁面初始化完成');
        } catch (error) {
            console.error('角色管理初始化失敗:', error);
            if (window.Dialog) {
                Dialog.error('角色管理初始化失敗');
            }
        }
    }
    
    /**
     * 載入部門樹供選擇（包含角色）
     */
    async function loadDepartmentTreeForRoles() {
        if (departmentModule && crudModule && stateModule) {
            try {
                const result = await departmentModule.loadDepartmentTreeForRoles(crudModule, notifyRoleStatsChanged);
                stateModule.setState({
                    deptTreeData: result.deptTreeData,
                    departmentRolesCache: result.departmentRolesCache
                });
                
                // 在角色管理頁面預設展開第一層
                renderDepartmentTree(result.deptTreeData, null, true);
                
                // 更新統計
                updateTreeStats();
                
                // 重新綁定樹節點事件
                setTimeout(() => {
                    bindTreeEventListeners();
                }, 50);
                
            } catch (error) {
                console.error('載入部門樹失敗:', error);
                if (window.Dialog) {
                    Dialog.error('載入部門資料失敗');
                }
            }
        }
    }
    
    /**
     * 渲染部門樹
     */
    function renderDepartmentTree(departments, container = null, expandFirstLevel = false) {
        if (window.OrganizationRoleTreeModule && stateModule) {
            const state = stateModule.getState();
            window.OrganizationRoleTreeModule.renderDepartmentTree(
                departments, 
                container, 
                expandFirstLevel, 
                state.showInactiveRoles || false, 
                state.departmentRolesCache || {}, 
                state.selectedDeptId, 
                state.selectedRoleId
            );
        }
    }

    // ===== 部門節點操作包裝函數 =====
    
    /**
     * 切換部門節點展開/收合
     */
    function toggleDeptNode(deptId) {
        if (window.OrganizationRoleTreeModule) {
            window.OrganizationRoleTreeModule.toggleDeptNode(deptId);
        }
    }
    
    /**
     * 處理部門節點點擊事件
     */
    async function handleDepartmentNodeClick(deptId) {
        if (departmentModule && stateModule) {
            const state = stateModule.getState();
            await departmentModule.handleDepartmentNodeClick(deptId, state.selectedDeptId, selectDepartmentForRoles);
        }
    }
    
    /**
     * 選擇部門查看角色
     */
    async function selectDepartmentForRoles(deptId) {
        if (departmentModule && stateModule) {
            const state = stateModule.getState();
            const selectedDeptId = await departmentModule.selectDepartmentForRoles(
                deptId, 
                state.deptTreeData || [], 
                findDepartmentById, 
                expandPathToDepartment, 
                loadDepartmentRolesForManagement
            );
            stateModule.setState({ 
                selectedDeptId, 
                selectedRoleId: null 
            });
        }
    }
    
    /**
     * 編輯存檔後導航到部門
     */
    async function navigateToDepartmentAfterEdit(deptId) {
        if (departmentModule && stateModule) {
            const state = stateModule.getState();
            const selectedDeptId = await departmentModule.navigateToDepartmentAfterEdit(
                deptId, 
                state.deptTreeData || [], 
                findDepartmentById, 
                collapseAllExceptPath, 
                expandPathToDepartment, 
                loadDepartmentRolesForManagement
            );
            stateModule.setState({ 
                selectedDeptId, 
                selectedRoleId: null 
            });
        }
    }

    // ===== 角色選擇操作 =====
    
    /**
     * 選擇角色並顯示所屬部門的角色列表
     */
    async function selectRoleAndShowDepartmentRoles(roleId, deptId) {
        if (!stateModule) return;
        
        const state = stateModule.getState();
        
        // 更新選中的角色
        stateModule.setState({ selectedRoleId: roleId });
        
        // 更新角色選中狀態
        document.querySelectorAll('.role-tree-node').forEach(node => {
            node.classList.remove('selected');
        });
        const selectedRoleNode = document.querySelector(`.role-tree-node[data-role-id="${roleId}"]`);
        if (selectedRoleNode) {
            selectedRoleNode.classList.add('selected');
        }
        
        // 如果當前選中的部門不是該角色所屬的部門，則切換部門選中狀態
        if (state.selectedDeptId !== deptId) {
            stateModule.setState({ selectedDeptId: deptId });
            
            // 更新部門選中狀態
            document.querySelectorAll('.node-content').forEach(node => {
                node.classList.remove('selected');
            });
            const selectedDeptNode = document.querySelector(`.node-content[data-dept-id="${deptId}"]`);
            if (selectedDeptNode) {
                selectedDeptNode.classList.add('selected');
                
                // 展開到目標部門的完整路徑
                expandPathToDepartment(deptId);
            }
            
            // 更新部門名稱顯示
            const dept = findDepartmentById(deptId, state.deptTreeData || []);
            if (dept) {
                document.getElementById('selectedDeptName').textContent = `${dept.name} 的角色`;
                document.getElementById('addRoleBtn').disabled = false;
            }
        }
        
        // 載入並顯示該部門的角色到右側面板
        await loadDepartmentRolesForManagement(deptId);
        
        // 在右側角色卡片中也高亮選中的角色
        setTimeout(() => {
            const rightPanelRoleCard = document.querySelector(`#rolesList .role-card[data-role-id="${roleId}"]`);
            if (rightPanelRoleCard) {
                // 移除其他卡片的高亮
                document.querySelectorAll('#rolesList .role-card').forEach(card => {
                    card.classList.remove('highlighted');
                });
                // 高亮選中的卡片
                rightPanelRoleCard.classList.add('highlighted');
                // 滾動到該卡片
                rightPanelRoleCard.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });
            }
        }, 100);
    }

    // ===== 角色模式切換 =====
    
    /**
     * 切換到單一模式
     */
    function switchToSingleMode() {
        if (stateModule) {
            stateModule.setState({ isRoleBatchMode: false });
        }
        
        // 更新按鈕樣式
        const singleBtn = document.getElementById('singleModeBtn');
        const batchBtn = document.getElementById('batchModeBtn');
        if (singleBtn) {
            singleBtn.classList.remove('btn-outline-secondary');
            singleBtn.classList.add('btn-outline-primary');
        }
        if (batchBtn) {
            batchBtn.classList.remove('btn-outline-primary');
            batchBtn.classList.add('btn-outline-secondary');
        }
        
        // 更新提示文字
        const hintText = document.getElementById('modeHintText');
        if (hintText) hintText.textContent = '選擇一個角色模板進行精確新增';
        
        // 顯示/隱藏相關元素
        const singleNameGroup = document.getElementById('singleRoleNameGroup');
        const batchHint = document.getElementById('batchRoleNamesHint');
        const confirmBtnText = document.getElementById('confirmBtnText');
        
        if (singleNameGroup) singleNameGroup.classList.remove('d-none');
        if (batchHint) batchHint.classList.add('d-none');
        if (confirmBtnText) confirmBtnText.textContent = '新增';
        
        // 重新載入模板（單選模式）
        loadRoleTemplatesForAdd(false);
    }
    
    /**
     * 切換到批量模式
     */
    function switchToBatchMode() {
        if (stateModule) {
            stateModule.setState({ isRoleBatchMode: true });
        }
        
        // 更新按鈕樣式
        const batchBtn = document.getElementById('batchModeBtn');
        const singleBtn = document.getElementById('singleModeBtn');
        if (batchBtn) {
            batchBtn.classList.remove('btn-outline-secondary');
            batchBtn.classList.add('btn-outline-primary');
        }
        if (singleBtn) {
            singleBtn.classList.remove('btn-outline-primary');
            singleBtn.classList.add('btn-outline-secondary');
        }
        
        // 更新提示文字
        const hintText = document.getElementById('modeHintText');
        if (hintText) hintText.textContent = '選擇多個角色模板進行批量新增';
        
        // 顯示/隱藏相關元素
        const singleNameGroup = document.getElementById('singleRoleNameGroup');
        const batchHint = document.getElementById('batchRoleNamesHint');
        const confirmBtnText = document.getElementById('confirmBtnText');
        
        if (singleNameGroup) singleNameGroup.classList.add('d-none');
        if (batchHint) batchHint.classList.remove('d-none');
        if (confirmBtnText) confirmBtnText.textContent = '批量新增';
        
        // 重新載入模板（多選模式）
        loadRoleTemplatesForAdd(true);
    }

    // ===== 角色操作包裝函數 =====
    
    /**
     * 顯示新增角色模態框
     */
    function showAddRoleModal() {
        if (modalModule && stateModule) {
            const state = stateModule.getState();
            modalModule.showAddRoleModal(state.selectedDeptId, state.deptTreeData || [], findDepartmentById, switchToSingleMode);
        }
    }
    
    /**
     * 確認新增部門角色
     */
    async function confirmAddDepartmentRole() {
        if (modalModule && stateModule) {
            const state = stateModule.getState();
            await modalModule.confirmAddDepartmentRole(
                state.isRoleBatchMode || false,
                createDepartmentRoles,
                refreshDeptTree,
                selectDepartmentForRoles
            );
        }
    }
    
    /**
     * 編輯部門角色
     */
    async function editDepartmentRole(roleId) {
        if (!crudModule) {
            throw new Error('CRUD 模組未初始化');
        }

        try {
            // 先取得角色資訊
            const role = await crudModule.getDepartmentRole(roleId);
            
            // 填充表單
            document.getElementById('editRoleId').value = role.id;
            document.getElementById('editRoleCode').value = role.code;
            document.getElementById('editRoleName').value = role.name;
            document.getElementById('editRoleType').value = role.role_type === 'manager' ? '管理角色' : '員工角色';
            
            // 設置層級值
            let levelValue = role.level || 1;
            if (levelValue > 100) levelValue = 100;
            if (levelValue < 1) levelValue = 1;
            document.getElementById('editRoleLevel').value = levelValue;
            
            // 檢查角色依賴關係
            if (stateModule) {
                const state = stateModule.getState();
                const dependencies = window.OrganizationRoleAnalysisModule.checkRoleDependencies(role.id, role.user_count, state.departmentRolesCache || {});
                const activeCheckbox = document.getElementById('editRoleActive');
                activeCheckbox.checked = role.is_active;
                
                // 如果角色有依賴，不允許停用
                if (dependencies.hasAnyDependency && role.is_active) {
                    activeCheckbox.disabled = true;
                    
                    const checkboxLabel = activeCheckbox.parentElement;
                    const existingHint = checkboxLabel.querySelector('.checkbox-hint');
                    if (existingHint) {
                        existingHint.remove();
                    }
                    
                    const reasons = [];
                    if (dependencies.hasUsers) {
                        reasons.push(`${dependencies.userCount} 位使用者`);
                    }
                    if (dependencies.hasChildren) {
                        reasons.push(`${dependencies.childrenCount} 個子角色`);
                    }
                    
                    const hint = document.createElement('small');
                    hint.className = 'checkbox-hint text-muted d-block';
                    hint.innerHTML = `<i class="fas fa-info-circle"></i> 此角色有 ${reasons.join(' 和 ')}，無法停用`;
                    checkboxLabel.appendChild(hint);
                } else {
                    activeCheckbox.disabled = false;
                    const checkboxLabel = activeCheckbox.parentElement;
                    const existingHint = checkboxLabel.querySelector('.checkbox-hint');
                    if (existingHint) {
                        existingHint.remove();
                    }
                }
            }
            
            // 載入部門選項並設定當前部門
            await loadDepartmentOptionsForEdit();
            
            if (stateModule) {
                stateModule.setState({
                    originalDepartmentId: role.department_id,
                    departmentChanged: false,
                    movePreviewData: null
                });
            }
            
            const deptSelect = document.getElementById('editRoleDepartment');
            if (deptSelect) {
                deptSelect.value = role.department_id;
                if (deptSelect.searchableSelectInstance) {
                    deptSelect.searchableSelectInstance.setValue(role.department_id);
                }
            }
            
            // 重置部門變更狀態
            resetDepartmentState();
            const resetBtn = document.getElementById('resetDepartmentBtn');
            if (resetBtn) {
                resetBtn.disabled = true;
            }
            
            // 載入父角色選項
            const parentRoleId = role.parent_id || role.parent_role_id || role.parentRoleId;
            document.getElementById('editRoleId').setAttribute('data-original-parent-id', parentRoleId || '');
            
            if (hierarchyModule && stateModule) {
                const state = stateModule.getState();
                await hierarchyModule.loadParentRoleOptions(
                    role.id, 
                    state.departmentRolesCache || {}, 
                    state.deptTreeData || [], 
                    findDepartmentById
                );
            }
            
            // 設定選中值
            setTimeout(() => {
                const parentSelect = document.getElementById('editParentRoleSelect');
                if (parentSelect) {
                    parentSelect.value = parentRoleId || '';
                    if (parentSelect.searchableSelectInstance) {
                        parentSelect.searchableSelectInstance.setValue(parentRoleId || '');
                    }
                }
            }, 100);
            
            // 顯示模態框
            const modal = document.getElementById('editDepartmentRoleModal');
            if (modal) {
                modal.classList.add('show');
                // 初始化滾動條效果
                if (window.CommonUI && window.CommonUI.initScrollFadeEffect) {
                    setTimeout(() => window.CommonUI.initScrollFadeEffect(), 100);
                }
            }
            
        } catch (error) {
            console.error('載入角色資訊失敗:', error);
            if (window.Dialog) {
                window.Dialog.error('載入角色資訊失敗');
            }
        }
    }
    
    /**
     * 確認編輯部門角色
     */
    async function confirmEditDepartmentRole() {
        if (modalModule && stateModule) {
            const state = stateModule.getState();
            await modalModule.confirmEditDepartmentRole({
                departmentChanged: state.departmentChanged || false,
                movePreviewData: state.movePreviewData,
                crudModule,
                updateDepartmentRole,
                refreshDeptTree,
                selectDepartmentForRoles,
                expandDepartmentByRoleId
            });
        }
    }
    
    /**
     * 刪除部門角色
     */
    async function deleteDepartmentRole(roleId, userCount) {
        if (modalModule && stateModule) {
            const state = stateModule.getState();
            const dependencies = window.OrganizationRoleAnalysisModule.checkRoleDependencies(roleId, userCount, state.departmentRolesCache || {});
            await modalModule.deleteDepartmentRoleConfirm(roleId, userCount, dependencies, {
                departmentRolesCache: state.departmentRolesCache || {},
                crudModule,
                refreshDeptTree,
                selectDepartmentForRoles,
                notifyRoleStatsChanged
            });
        }
    }
    
    /**
     * 檢視角色詳情
     */
    async function viewRoleDetails(roleId) {
        if (modalModule && usersModule) {
            await modalModule.viewRoleDetails(roleId, usersModule.loadRoleUsers);
        }
    }

    // ===== 部門選項與變更處理 =====
    
    /**
     * 載入部門選項用於編輯
     */
    async function loadDepartmentOptionsForEdit() {
        if (departmentModule) {
            await departmentModule.loadDepartmentOptionsForEdit();
        }
    }
    
    /**
     * 處理部門變更
     */
    async function onEditRoleDepartmentChange() {
        if (departmentModule && stateModule) {
            const state = stateModule.getState();
            await departmentModule.onEditRoleDepartmentChange(
                state.originalDepartmentId, 
                (changed) => { stateModule.setState({ departmentChanged: changed }); },
                (previewData) => { stateModule.setState({ movePreviewData: previewData }); }
            );
        }
    }
    
    /**
     * 還原部門選擇
     */
    function resetRoleDepartment() {
        if (departmentModule && stateModule) {
            const state = stateModule.getState();
            departmentModule.resetRoleDepartment(state.originalDepartmentId, resetDepartmentState);
        }
    }
    
    /**
     * 重置部門變更狀態
     */
    function resetDepartmentState() {
        if (stateModule) {
            stateModule.setState({
                departmentChanged: false,
                movePreviewData: null
            });
        }
        
        if (departmentModule) {
            departmentModule.resetDepartmentState();
        }
    }

    // ===== CRUD 操作包裝函數 =====
    
    /**
     * 取得部門角色資訊
     */
    async function getDepartmentRole(roleId) {
        if (crudModule) {
            return await crudModule.getDepartmentRole(roleId);
        }
        throw new Error('CRUD 模組未初始化');
    }
    
    /**
     * 更新部門角色
     */
    async function updateDepartmentRole(roleId, updateData) {
        if (crudModule) {
            const result = await crudModule.updateDepartmentRole(roleId, updateData);
            // 通知角色統計數據已更新
            notifyRoleStatsChanged();
            return result;
        }
        throw new Error('CRUD 模組未初始化');
    }

    // ===== 搜尋功能包裝函數 =====
    
    /**
     * 搜尋部門和角色
     */
    function searchDeptAndRoles() {
        if (searchModule && stateModule) {
            const searchInput = document.getElementById('roleSearchInput');
            if (!searchInput) return;
            
            const searchTerm = searchInput.value.trim().toLowerCase();
            const state = stateModule.getState();
            searchModule.searchDeptAndRoles(
                searchTerm, 
                state.deptTreeData || [], 
                state.departmentRolesCache || {}, 
                findDepartmentById, 
                expandPathToDepartment
            );
        }
    }

    // ===== 樹狀結構操作包裝函數 =====
    
    /**
     * 在樹狀結構中查找部門
     */
    function findDepartmentById(id, departments) {
        if (window.OrganizationRoleTreeModule) {
            return window.OrganizationRoleTreeModule.findDepartmentById(id, departments);
        }
        return null;
    }
    
    /**
     * 展開到指定部門的路徑
     */
    function expandPathToDepartment(deptId) {
        if (window.OrganizationRoleTreeModule && stateModule) {
            const state = stateModule.getState();
            window.OrganizationRoleTreeModule.expandPathToDepartment(deptId, state.deptTreeData || []);
        }
    }
    
    /**
     * 閉合所有部門，除了指定部門的父級路徑
     */
    function collapseAllExceptPath(targetDeptId) {
        if (window.OrganizationRoleTreeModule && stateModule) {
            const state = stateModule.getState();
            window.OrganizationRoleTreeModule.collapseAllExceptPath(targetDeptId, state.deptTreeData || []);
        }
    }
    
    /**
     * 根據角色 ID 找到所屬部門並導航
     */
    async function expandDepartmentByRoleId(roleId) {
        if (departmentModule && stateModule) {
            const state = stateModule.getState();
            return await departmentModule.expandDepartmentByRoleId(
                roleId, 
                state.departmentRolesCache || {}, 
                navigateToDepartmentAfterEdit
            );
        }
        return null;
    }
    
    /**
     * 展開所有部門節點
     */
    function expandAll() {
        if (window.OrganizationRoleTreeModule) {
            window.OrganizationRoleTreeModule.expandAll();
        }
    }
    
    /**
     * 收合所有部門節點
     */
    function collapseAll() {
        if (window.OrganizationRoleTreeModule) {
            window.OrganizationRoleTreeModule.collapseAll();
        }
    }

    // ===== 角色卡片渲染 =====
    
    /**
     * 載入部門角色用於管理
     */
    async function loadDepartmentRolesForManagement(deptId) {
        if (departmentModule && cardModule && stateModule) {
            const state = stateModule.getState();
            await departmentModule.loadDepartmentRolesForManagement(
                deptId, 
                (roles) => cardModule.renderRoleCards(roles, state.departmentRolesCache || {}),
                (roles) => window.OrganizationRoleAnalysisModule.updateRoleStats(roles)
            );
        }
    }
    
    /**
     * 渲染角色卡片
     */
    function renderRoleCards(roles) {
        if (cardModule && stateModule) {
            const state = stateModule.getState();
            cardModule.renderRoleCards(roles, state.departmentRolesCache || {});
        }
    }

    // ===== 停用角色顯示切換 =====
    
    /**
     * 切換顯示/隱藏停用角色
     */
    function toggleInactiveRoles() {
        if (!stateModule) return;
        
        const state = stateModule.getState();
        const showInactiveRoles = !state.showInactiveRoles;
        stateModule.setState({ showInactiveRoles });
        
        // 更新按鈕狀態
        const toggleBtn = document.getElementById('toggleInactiveRolesBtn');
        if (toggleBtn) {
            const icon = toggleBtn.querySelector('i');
            if (showInactiveRoles) {
                toggleBtn.classList.add('active');
                icon.className = 'fas fa-eye';
                toggleBtn.title = '隱藏停用';
            } else {
                toggleBtn.classList.remove('active');
                icon.className = 'fas fa-eye-slash';
                toggleBtn.title = '顯示停用';
            }
        }      
        
        // 重新渲染部門樹
        renderDepartmentTree(state.deptTreeData || [], null, true);
        // 更新統計
        updateTreeStats();
        
        // 重新綁定樹節點事件
        setTimeout(() => {
            bindTreeEventListeners();
        }, 50);
    }

    // ===== 統計功能 =====
    
    /**
     * 更新左側樹狀統計區域
     */
    function updateTreeStats() {
        if (window.OrganizationRoleAnalysisModule && stateModule) {
            const state = stateModule.getState();
            window.OrganizationRoleAnalysisModule.updateTreeStats(
                state.deptTreeData || [], 
                state.departmentRolesCache || {}, 
                state.showInactiveRoles || false
            );
        }
    }
    
    /**
     * 確保角色數據已載入到緩存中
     */
    async function ensureRolesLoaded() {
        if (!stateModule) return;
        
        const state = stateModule.getState();
        
        // 如果緩存為空且樹狀資料為空，載入數據
        if (Object.keys(state.departmentRolesCache || {}).length === 0 && (state.deptTreeData || []).length === 0) {
            try {
                await loadDepartmentTreeForRoles();
            } catch (error) {
                console.error('載入角色數據失敗:', error);
                try {
                    const response = await fetch(`${API_BASE}/departments?tree=true`, {
                        credentials: 'include'
                    });
                    if (response.ok) {
                        const deptTreeData = await response.json();
                        stateModule.setState({ deptTreeData });
                    }
                } catch (fallbackError) {
                    console.error('載入部門結構失敗:', fallbackError);
                }
            }
        }
    }
    
    /**
     * 獲取角色統計資料
     */
    function getRoleStatistics() {
        if (window.OrganizationRoleAnalysisModule && stateModule) {
            const state = stateModule.getState();
            return window.OrganizationRoleAnalysisModule.getRoleStatistics(state.departmentRolesCache || {});
        }
        return null;
    }
    
    /**
     * 通知角色統計數據已更新
     */
    function notifyRoleStatsChanged() {
        if (window.OrganizationRoleAnalysisModule && stateModule) {
            const state = stateModule.getState();
            window.OrganizationRoleAnalysisModule.notifyRoleStatsChanged(state.departmentRolesCache || {});
        }
    }

    // ===== 重新整理功能 =====
    
    /**
     * 重新整理部門樹
     */
    async function refreshDeptTree() {
        if (!stateModule) return;
        
        const state = stateModule.getState();
        
        // 保存當前展開狀態
        const expandedNodes = [];
        document.querySelectorAll('.tree-children.expanded').forEach(node => {
            const parentNode = node.parentElement;
            if (parentNode && parentNode.dataset.id) {
                expandedNodes.push(parseInt(parentNode.dataset.id));
            }
        });
        
        // 清空緩存
        stateModule.setState({ departmentRolesCache: {} });
        await loadDepartmentTreeForRoles();
        
        // 恢復展開狀態
        setTimeout(() => {
            expandedNodes.forEach(deptId => {
                const node = document.querySelector(`.tree-node[data-id="${deptId}"] .tree-children`);
                if (node) {
                    node.classList.add('expanded');
                    const toggle = document.querySelector(`.tree-node[data-id="${deptId}"] .node-toggle i`);
                    if (toggle) {
                        toggle.classList.remove('fa-chevron-right');
                        toggle.classList.add('fa-chevron-down');
                    }
                }
            });
        }, 50);
        
        // 恢復選中狀態
        if (state.selectedDeptId) {
            setTimeout(() => {
                const selectedNode = document.querySelector(`.node-content[data-dept-id="${state.selectedDeptId}"]`);
                if (selectedNode) {
                    selectedNode.classList.add('selected');
                }
            }, 50);
        }
        
        // 更新統計
        updateTreeStats();
        
        // 重新綁定拖曳事件
        if (dragModule) {
            setTimeout(() => bindRoleDragEvents(), 100);
        }
        
        // 重新綁定樹節點點擊事件
        setTimeout(() => {
            if (window.OrganizationRoleTreeModule) {
                window.OrganizationRoleTreeModule.bindTreeEventListeners(handleDepartmentNodeClick);
            }
        }, 100);
        
        // 重新綁定按鈕事件
        setTimeout(() => {
            bindRoleManagementEvents();
        }, 100);
        
        // 確保模組在全域可用
        if (!window.OrganizationRolesModule) {
            window.OrganizationRolesModule = OrganizationRolesModule;
        }
    }

    // ===== 層級管理與搜尋功能 =====
    
    /**
     * 開啟角色搜尋模態框
     */
    function openRoleSearchModal(context) {
        if (modalModule) {
            modalModule.openRoleSearchModal(context);
        }
    }
    
    /**
     * 關閉角色搜尋模態框
     */
    function closeRoleSearchModal() {
        if (modalModule) {
            modalModule.closeRoleSearchModal();
        }
    }
    
    /**
     * 執行角色搜尋
     */
    async function performRoleSearch() {
        if (searchModule) {
            const searchInput = document.getElementById('roleModalSearchInput');
            const contextField = document.getElementById('searchModalContext');
            
            if (!searchInput) return;
            
            const keyword = searchInput.value.trim();
            const context = contextField ? contextField.value : '';
            let excludeId = null;
            
            // 如果是編輯模式，排除當前角色本身
            if (context === 'editRole') {
                const editRoleIdField = document.getElementById('editRoleId');
                if (editRoleIdField) {
                    excludeId = editRoleIdField.value;
                }
            }
            
            await searchModule.performRoleSearch(keyword, context, excludeId);
        }
    }
    
    /**
     * 選擇搜尋結果中的角色
     */
    function selectSearchRole(roleId, displayName) {
        if (searchModule) {
            searchModule.selectSearchRole(roleId, displayName);
        }
    }
    
    /**
     * 確認角色選擇
     */
    function confirmRoleSelection() {
        if (modalModule) {
            modalModule.confirmRoleSelection();
        }
    }
    
    /**
     * 顯示重算確認對話框
     */
    async function showRecalculateConfirm() {
        if (modalModule) {
            await modalModule.showRecalculateConfirm();
        }
    }
    
    /**
     * 關閉重算確認對話框
     */
    function closeRecalculateConfirmModal() {
        if (modalModule) {
            modalModule.closeRecalculateConfirmModal();
        }
    }
    
    /**
     * 執行重算子角色層級
     */
    async function executeRecalculate() {
        if (modalModule) {
            await modalModule.executeRecalculate(refreshDeptTree);
        }
    }
    
    /**
     * 顯示父角色變更確認對話框
     */
    function showParentRoleChangeConfirm(affectedCount, affectedRoles, updateData) {
        if (modalModule) {
            modalModule.showParentRoleChangeConfirm(affectedCount, affectedRoles, updateData);
        }
    }
    
    /**
     * 關閉父角色變更確認對話框
     */
    function closeParentRoleChangeConfirmModal() {
        if (modalModule) {
            modalModule.closeParentRoleChangeConfirmModal();
        }
    }
    
    /**
     * 確認父角色變更並執行更新
     */
    async function confirmParentRoleChange() {
        if (modalModule) {
            await modalModule.confirmParentRoleChange(updateDepartmentRole, refreshDeptTree, expandDepartmentByRoleId);
        }
    }

    // ===== 懸浮卡片功能 =====
    
    /**
     * 顯示角色用戶懸浮卡片
     */
    async function showRoleUsersHoverCard(roleId) {
        if (hoverCardModule && stateModule) {
            const state = stateModule.getState();
            await hoverCardModule.show(roleId, state.departmentRolesCache || {});
        }
    }
    
    /**
     * 隱藏角色用戶懸浮卡片
     */
    function hideRoleUsersHoverCard() {
        if (hoverCardModule) {
            hoverCardModule.hide();
        }
    }

    // ===== 拖曳功能 =====
    
    /**
     * 綁定角色拖曳事件
     */
    function bindRoleDragEvents() {
        if (dragModule) {
            dragModule.bindRoleDragEvents();
        }
    }

    // ===== 事件綁定 =====
    
    /**
     * 綁定樹節點事件（使用事件委託）
     */
    function bindTreeEventListeners() {
        if (initModule) {
            initModule.bindTreeEventListeners(handleDepartmentNodeClick);
        }
    }
    
    /**
     * 綁定角色管理事件
     */
    function bindRoleManagementEvents() {
        if (initModule) {
            initModule.bindRoleManagementEvents({
                showAddRoleModal,
                searchModule,
                searchDeptAndRoles,
                performRoleSearch,
                openRoleSearchModal,
                closeRoleSearchModal,
                selectSearchRole,
                confirmRoleSelection,
                showRecalculateConfirm,
                closeRecalculateConfirmModal,
                executeRecalculate,
                closeParentRoleChangeConfirmModal,
                confirmParentRoleChange
            });
        }
    }

    // ===== 渲染部門樹狀結構中的角色（保留兼容性） =====
    
    /**
     * 渲染部門樹狀結構中的角色
     */
    function renderDepartmentRoles(roles, container) {
        if (!roles || roles.length === 0) return '';
        
        const html = roles.map(role => `
            <div class="role-node" 
                 draggable="true"
                 data-role-id="${role.id}"
                 data-department-id="${role.department_id}">
                <i class="fas ${role.role_type === 'manager' ? 'fa-user-tie text-manager' : 'fa-user text-success'}"></i>
                <span>${role.name}</span>
                <span class="badge badge-info">${role.user_count || 0}人</span>
            </div>
        `).join('');
        
        // 在渲染後綁定事件
        if (dragModule) {
            setTimeout(() => bindRoleDragEvents(), 0);
        }
        
        return html;
    }

    // 公開 API
    return {
        init,
        // 角色模板相關函數
        loadRoleTemplateSelector,
        loadRoleTemplatesForAdd,
        showRoleTemplateModal,
        closeRoleTemplateModal,
        saveRoleTemplate,
        editRoleTemplate,
        deleteRoleTemplate,
        loadRoleTemplates,
        getRoleTemplates,
        getRoleTemplateById,
        switchToSingleMode,
        switchToBatchMode,
        loadDepartmentRoles,
        createDepartmentRoles,
        renderDepartmentRoles,
        selectRole,
        selectRoleAndShowDepartmentRoles,
        removeUserFromRole,
        // 角色管理頁面功能
        initRoleManagement,
        resetRoleManagementState,
        handleDepartmentNodeClick,
        selectDepartmentForRoles,
        navigateToDepartmentAfterEdit,
        toggleDeptNode,
        showAddRoleModal,
        deleteDepartmentRole,
        refreshDeptTree,
        viewRoleDetails: viewRoleDetails,
        editDepartmentRole: editDepartmentRole,
        getDepartmentRole: getDepartmentRole,
        updateDepartmentRole: updateDepartmentRole,
        toggleInactiveRoles,
        searchDeptAndRoles,
        // 展開收合功能
        expandAll,
        collapseAll,
        expandDepartmentByRoleId,
        // 統一角色統計服務
        ensureRolesLoaded,
        getRoleStatistics,
        notifyRoleStatsChanged,
        // 角色層級管理功能
        openRoleSearchModal,
        closeRoleSearchModal,
        performRoleSearch,
        selectSearchRole,
        confirmRoleSelection,
        showRecalculateConfirm,
        closeRecalculateConfirmModal,
        executeRecalculate,
        // 模態框關閉函數
        closeDepartmentRoleModal,
        closeAddDepartmentRoleModal,
        closeEditDepartmentRoleModal,
        closeRoleDetailsModal,
        // 操作確認函數
        confirmAddDepartmentRole,
        confirmEditDepartmentRole,
        // 父角色變更確認功能
        showParentRoleChangeConfirm,
        closeParentRoleChangeConfirmModal,
        confirmParentRoleChange,
        // 角色用戶懸浮卡片功能
        showRoleUsersHoverCard,
        hideRoleUsersHoverCard,
        // 暴露 selectedDeptId 供外部使用
        get selectedDeptId() { 
            return stateModule ? stateModule.getState().selectedDeptId : null; 
        },
        // 部門變更功能
        onEditRoleDepartmentChange,
        resetRoleDepartment,
        resetDepartmentState, 
        bindRoleDragEvents,     
    };

})();

// 註冊到全域
window.OrganizationRolesModule = OrganizationRolesModule;