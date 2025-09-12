/**
 * 組織角色管理 Modal 與 Dialog 子模組
 * 處理所有 Modal 視窗和確認對話框相關功能
 */
const __OrganizationRolesModalModule = (function() {
    'use strict';
    
    // API 端點
    const API_BASE = '/api/organization';
    
    // 暫存等待確認的資料
    let pendingRoleUpdateData = null;
    
    // ===== 基本 Modal 關閉功能 =====
    
    /**
     * 關閉部門角色模態框
     */
    function closeDepartmentRoleModal() {
        const modal = document.getElementById('departmentRoleModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }
    
    /**
     * 關閉新增部門角色模態框
     */
    function closeAddDepartmentRoleModal() {
        const modal = document.getElementById('addDepartmentRoleModal');
        if (modal) {
            modal.classList.remove('show');
            const form = document.getElementById('addDepartmentRoleForm');
            if (form) form.reset();
        }
    }
    
    /**
     * 關閉編輯角色模態框
     */
    function closeEditDepartmentRoleModal() {
        const modal = document.getElementById('editDepartmentRoleModal');
        if (modal) {
            modal.classList.remove('show');
            const form = document.getElementById('editDepartmentRoleForm');
            if (form) form.reset();
        }
    }
    
    /**
     * 關閉角色詳情模態框
     */
    function closeRoleDetailsModal() {
        const modal = document.getElementById('roleDetailsModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }
    
    // ===== 新增角色 Modal =====
    
    /**
     * 顯示新增角色模態框
     * @param {number} selectedDeptId - 選中的部門 ID
     * @param {Object} deptTreeData - 部門樹狀資料
     * @param {Function} findDepartmentById - 查找部門的函數
     * @param {Function} switchToSingleMode - 切換到單一模式的函數
     */
    function showAddRoleModal(selectedDeptId, deptTreeData, findDepartmentById, switchToSingleMode) {
        if (!selectedDeptId) {
            Dialog.warning('請先選擇部門');
            return;
        }
        
        let dept = findDepartmentById(selectedDeptId, deptTreeData);
        
        // 如果找不到部門，嘗試轉換類型後再找一次
        if (!dept) {
            const numericId = parseInt(selectedDeptId);
            const stringId = String(selectedDeptId);
            
            dept = findDepartmentById(numericId, deptTreeData) || 
                   findDepartmentById(stringId, deptTreeData);
            
            if (!dept) {
                Dialog.warning('部門資料已變更，請重新選擇部門');
                return;
            }
        }
        
        document.getElementById('addRoleDeptId').value = selectedDeptId;
        document.getElementById('addRoleDeptName').textContent = dept.name;
        
        // 調用切換到單一模式
        if (switchToSingleMode) {
            switchToSingleMode();
        }
        
        // 顯示模態框
        const modal = document.getElementById('addDepartmentRoleModal');
        if (modal) {
            modal.classList.add('show');
            // 初始化滾動條效果
            if (window.CommonUI && window.CommonUI.initScrollFadeEffect) {
                setTimeout(() => CommonUI.initScrollFadeEffect(), 100);
            }
        }
    }
    
    /**
     * 確認新增部門角色
     * @param {boolean} isRoleBatchMode - 是否為批量模式
     * @param {Function} createDepartmentRoles - 建立角色的函數
     * @param {Function} closeAddDepartmentRoleModal - 關閉模態框的函數
     * @param {Function} refreshDeptTree - 重新整理部門樹的函數
     * @param {Function} selectDepartmentForRoles - 選擇部門的函數
     */
    async function confirmAddDepartmentRole(isRoleBatchMode, createDepartmentRoles, refreshDeptTree, selectDepartmentForRoles) {
        const form = document.getElementById('addDepartmentRoleForm');
        if (!form) return;
        
        const deptId = document.getElementById('addRoleDeptId').value;
        
        try {
            if (isRoleBatchMode) {
                // 批量模式處理
                const selectedTemplates = form.querySelectorAll('input[name="template_ids[]"]:checked');
                
                if (selectedTemplates.length === 0) {
                    Dialog.warning('請至少選擇一個角色模板');
                    return;
                }
                
                // 收集所有選中的模板和自訂名稱
                const roleRequests = [];
                selectedTemplates.forEach(checkbox => {
                    const templateId = checkbox.value;
                    const nameInput = form.querySelector(`input[name="role_names[${templateId}]"]`);
                    const customName = nameInput ? nameInput.value.trim() : '';
                    
                    roleRequests.push({
                        template_id: parseInt(templateId),
                        name: customName || null
                    });
                });
                
                // 批量新增
                const result = await createDepartmentRoles(deptId, roleRequests);
                
                // 檢查 created_roles 陣列
                if (result.created_roles && result.created_roles.length > 0) {
                    // 檢查是否有失敗的項目
                    const successCount = result.created_roles.length;
                    const requestCount = roleRequests.length;
                    
                    if (successCount < requestCount) {
                        // 部分成功
                        const failedCount = requestCount - successCount;
                        Dialog.warning(`成功新增 ${successCount} 個角色，${failedCount} 個失敗`);
                    } else {
                        // 全部成功
                        Dialog.success(`成功新增 ${successCount} 個角色`);
                    }
                } else {
                    Dialog.error('新增角色失敗');
                }
                
            } else {
                // 單一模式處理
                const selectedTemplate = form.querySelector('input[name="template_id"]:checked');
                
                if (!selectedTemplate) {
                    Dialog.warning('請選擇角色模板');
                    return;
                }
                
                const templateId = selectedTemplate.value;
                const customName = document.getElementById('customRoleName').value.trim();
                
                const result = await createDepartmentRoles(
                    deptId, 
                    [{
                        template_id: parseInt(templateId),
                        name: customName
                    }]
                );
                
                // 檢查結果
                if (result.created_roles && result.created_roles.length > 0) {
                    Dialog.success('角色新增成功');
                } else {
                    Dialog.error('角色新增失敗');
                }
            }
            
            closeAddDepartmentRoleModal();
            
            // 保存當前部門ID，確保不會丟失
            const currentDeptId = deptId;
            
            // 先重新載入左側部門樹以更新角色資訊
            if (refreshDeptTree) {
                await refreshDeptTree();
            }
            
            // 然後重新選擇部門以確保狀態正確
            if (selectDepartmentForRoles) {
                await selectDepartmentForRoles(currentDeptId);
            }
            
        } catch (error) {
            console.error('新增角色失敗:', error);
            Dialog.error(error.message || '新增角色失敗');
        }
    }
    
    // ===== 角色詳情 Modal =====
    
    /**
     * 顯示角色詳情模態框
     * @param {number} roleId - 角色 ID
     * @param {Function} loadRoleUsers - 載入角色用戶的函數
     */
    async function viewRoleDetails(roleId, loadRoleUsers) {
        try {
            const response = await fetch(`${API_BASE}/department-roles/${roleId}`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('載入角色詳情失敗');
            }
            
            const role = await response.json();
            
            // 渲染詳情內容
            const content = document.getElementById('roleDetailsContent');
            if (content) {
                content.innerHTML = `
                    <div class="role-details-grid">
                        <div class="detail-section">
                            <h4>基本資訊</h4>
                            <div class="detail-row">
                                <label>角色名稱：</label>
                                <span>${role.name}</span>
                            </div>
                            <div class="detail-row">
                                <label>角色代碼：</label>
                                <span class="code">${role.code}</span>
                            </div>
                            <div class="detail-row">
                                <label>角色類型：</label>
                                <span class="badge ${role.role_type === 'manager' ? 'badge-warning' : 'badge-success'}">
                                    ${role.role_type === 'manager' ? '管理角色' : '員工角色'}
                                </span>
                            </div>
                            <div class="detail-row">
                                <label>角色層級：</label>
                                <span>${role.level || 0}</span>
                            </div>
                            ${(role.parent_role_name || role.parent_name || role.parentRoleName) ? `
                            <div class="detail-row">
                                <label>上層角色：</label>
                                <span class="text-info"><i class="fas fa-arrow-up"></i> ${role.parent_role_name || role.parent_name || role.parentRoleName}</span>
                            </div>
                            ` : ''}
                            <div class="detail-row">
                                <label>狀態：</label>
                                <span class="badge ${role.is_active ? 'badge-success' : 'badge-secondary'}">
                                    ${role.is_active ? '啟用' : '停用'}
                                </span>
                            </div>
                        </div>
                        
                        <div class="detail-section">
                            <h4>所屬資訊</h4>
                            <div class="detail-row">
                                <label>所屬部門：</label>
                                <span>${role.department_name || '未知'}</span>
                            </div>
                            <div class="detail-row">
                                <label>來源模板：</label>
                                <span>${role.template_name || '自訂'}</span>
                            </div>
                            <div class="detail-row">
                                <label>使用人數：</label>
                                <span class="badge badge-info">${role.user_count || 0} 人</span>
                            </div>
                            <div class="detail-row">
                                <label>建立時間：</label>
                                <span>${new Date(role.created_at).toLocaleString('zh-TW')}</span>
                            </div>
                            <div class="detail-row">
                                <label>更新時間：</label>
                                <span>${new Date(role.updated_at).toLocaleString('zh-TW')}</span>
                            </div>
                        </div>
                    </div>
                    
                    ${role.user_count > 0 ? `
                        <div class="detail-section full-width">
                            <h4>使用此角色的用戶</h4>
                            <div id="roleUsersList">
                                <div class="loading-spinner">
                                    <div class="spinner"></div>
                                    <p>載入用戶列表中...</p>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                `;
                
                // 如果有用戶，載入用戶列表
                if (role.user_count > 0 && loadRoleUsers) {
                    try {
                        const users = await loadRoleUsers(roleId);
                        // 渲染用戶列表
                        if (window.__OrganizationRolesUsersModule && window.__OrganizationRolesUsersModule.renderRoleUsersList) {
                            window.__OrganizationRolesUsersModule.renderRoleUsersList(users);
                        }
                    } catch (error) {
                        console.error('載入角色用戶失敗:', error);
                        const container = document.getElementById('roleUsersList');
                        if (container) {
                            container.innerHTML = '<p class="text-danger">載入用戶列表失敗，請稍後重試</p>';
                        }
                    }
                }
            }
            
            // 顯示模態框
            const modal = document.getElementById('roleDetailsModal');
            if (modal) {
                modal.classList.add('show');
                // 初始化滾動條效果
                if (window.CommonUI && window.CommonUI.initScrollFadeEffect) {
                    setTimeout(() => CommonUI.initScrollFadeEffect(), 100);
                }
            }
            
        } catch (error) {
            console.error('載入角色詳情失敗:', error);
            Dialog.error('載入角色詳情失敗');
        }
    }
    
    // ===== 編輯角色 Modal 與 Confirm =====
    
    /**
     * 確認編輯部門角色
     * @param {Object} params - 包含所有必要參數的物件
     */
    async function confirmEditDepartmentRole(params) {      
        const {
            departmentChanged,
            movePreviewData,
            crudModule,
            updateDepartmentRole,
            refreshDeptTree,
            selectDepartmentForRoles,
            expandDepartmentByRoleId
        } = params;
        
        const roleId = document.getElementById('editRoleId').value;
        const roleName = document.getElementById('editRoleName').value.trim();
        const roleLevel = parseInt(document.getElementById('editRoleLevel').value) || 0;
        const isActive = document.getElementById('editRoleActive').checked;
        const newDeptId = document.getElementById('editRoleDepartment').value;
        
        if (!roleName) {
            if (window.Dialog) {
                Dialog.warning('請輸入角色名稱');
            } else {
                alert('請輸入角色名稱');
            }
            return;
        }
        
        // 驗證層級範圍（限制在 1-100）
        if (roleLevel < 1 || roleLevel > 100) {
            if (window.Dialog) {
                Dialog.warning('角色層級必須在 1-100 之間');
            } else {
                alert('角色層級必須在 1-100 之間');
            }
            // 重設為有效值
            document.getElementById('editRoleLevel').value = roleLevel < 1 ? 1 : 100;
            return;
        }
        
        try {
            // 如果部門有變更，使用移動 API
            if (departmentChanged) {
                let moveResult;
                if (crudModule) {
                    moveResult = await crudModule.moveDepartmentRole(roleId, {
                        new_department_id: parseInt(newDeptId),
                        include_children: false,  // 編輯時只移動單一角色
                        new_parent_role_id: movePreviewData?.new_parent_role_id || null
                    });
                } else {
                    throw new Error('CRUD 模組未初始化');
                }
                
                // 同時更新其他屬性
                if (roleName !== moveResult.role_name || roleLevel !== moveResult.new_level || isActive !== moveResult.is_active) {
                    await updateDepartmentRole(roleId, {
                        name: roleName,
                        level: roleLevel,
                        is_active: isActive
                    });
                }
                
                // 顯示完整結果（包含警告訊息）
                if (moveResult.warning) {
                    if (window.Dialog) {
                        Dialog.warning(`角色已更新並移動到新部門。\n${moveResult.warning}`);
                    }
                } else {
                    if (window.Dialog) {
                        Dialog.success('角色已成功移動到新部門');
                    }
                }
                
                closeEditDepartmentRoleModal();
                
                // 重新載入左側部門樹
                if (refreshDeptTree) {
                    await refreshDeptTree();
                }
                
                // 導航到新部門並選中該角色
                if (selectDepartmentForRoles) {
                    await selectDepartmentForRoles(parseInt(newDeptId));
                    // 選中該角色
                    setTimeout(() => {
                        if (window.OrganizationRolesModule && window.OrganizationRolesModule.selectRoleAndShowDepartmentRoles) {
                            window.OrganizationRolesModule.selectRoleAndShowDepartmentRoles(roleId, parseInt(newDeptId));
                        }
                    }, 200);
                }
                
            } else {
                // 部門沒有變更，檢查父角色是否變更
                const parentRoleId = document.getElementById('editParentRoleSelect').value || null;
                const originalParentRoleId = document.getElementById('editRoleId').getAttribute('data-original-parent-id');
                
                // 處理空值和字串轉換
                let originalParentId = null;
                if (originalParentRoleId && originalParentRoleId !== 'null' && originalParentRoleId !== '') {
                    originalParentId = originalParentRoleId;
                }
                
                // 標準化比較值
                const currentParentId = (parentRoleId && parentRoleId !== '') ? String(parentRoleId) : null;
                const originalId = originalParentId ? String(originalParentId) : null;
                const hasParentChanged = currentParentId !== originalId;
                
                // Debug logging
                console.log('Parent role comparison:', {
                    currentParentId,
                    originalId,
                    hasParentChanged,
                    parentRoleIdRaw: parentRoleId,
                    originalParentRoleIdRaw: originalParentRoleId
                });
                
                if (hasParentChanged) {
                    // 父角色有變更，需要預覽影響並請用戶確認
                    try {
                        let previewResult;
                        if (crudModule) {
                            previewResult = await crudModule.recalculateChildrenLevels(roleId, true);
                        } else {
                            throw new Error('CRUD 模組未初始化');
                        }
                        const affectedCount = previewResult.count || 0;
                        
                        // 顯示父角色變更確認對話框
                        showParentRoleChangeConfirm(affectedCount, previewResult.affected_roles || [], {
                            roleId,
                            roleName,
                            roleLevel,
                            isActive,
                            parentRoleId: currentParentId ? parseInt(currentParentId) : null
                        });
                        return; // 等待用戶確認
                        
                    } catch (error) {
                        console.error('預覽層級變更影響失敗:', error);
                        if (window.Dialog) {
                            Dialog.error('無法預覽層級變更影響，請稍後再試');
                        }
                        return;
                    }
                }
                
                // 準備更新資料
                const updateData = {
                    name: roleName,
                    level: roleLevel,
                    is_active: isActive,
                    parent_id: currentParentId ? parseInt(currentParentId) : null
                };
                
                console.log('Sending update data:', updateData);
                
                // 直接執行更新
                await updateDepartmentRole(roleId, updateData);
                
                if (window.Dialog) {
                    Dialog.success('角色更新成功');
                }
                
                closeEditDepartmentRoleModal();
                
                // 重新載入左側部門樹以更新角色資訊
                if (refreshDeptTree) {
                    await refreshDeptTree();
                }
                
                // 選中該角色所屬的部門
                if (expandDepartmentByRoleId) {
                    await expandDepartmentByRoleId(roleId);
                }
            }
            
        } catch (error) {
            console.error('更新角色失敗:', error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                roleId: roleId,
                roleName: roleName,
                roleLevel: roleLevel,
                isActive: isActive
            });
            
            if (window.Dialog) {
                Dialog.error(`更新角色失敗: ${error.message || '未知錯誤'}`);
            } else {
                alert(`更新角色失敗: ${error.message || '未知錯誤'}`);
            }
        }
    }
    
    // ===== 刪除角色 Confirm =====
    
    /**
     * 刪除部門角色確認對話框
     * @param {number} roleId - 角色 ID
     * @param {number} userCount - 使用者數量
     * @param {Object} dependencies - 角色依賴關係
     * @param {Object} params - 其他參數
     */
    async function deleteDepartmentRoleConfirm(roleId, userCount, dependencies, params) {
        const {
            departmentRolesCache,
            crudModule,
            refreshDeptTree,
            selectDepartmentForRoles,
            notifyRoleStatsChanged
        } = params;
        
        try {
            // 如果有依賴，直接顯示警告，不允許操作
            if (dependencies.hasAnyDependency) {
                const reasons = [];
                if (dependencies.hasUsers) {
                    reasons.push(`${dependencies.userCount} 位使用者`);
                }
                if (dependencies.hasChildren) {
                    reasons.push(`${dependencies.childrenCount} 個子角色`);
                }
                
                Dialog.warning(`此角色有 ${reasons.join(' 和 ')}，無法停用或刪除。\n\n如需停用角色，請先：\n${dependencies.hasUsers ? '• 移除所有使用此角色的用戶\n' : ''}${dependencies.hasChildren ? '• 重新指派所有子角色的父角色\n' : ''}`);
                return;
            }
            
            // 在確認操作前，先找到角色所屬的部門
            let roleDeptId = null;
            for (const [deptId, roles] of Object.entries(departmentRolesCache)) {
                if (Array.isArray(roles) && roles.some(role => role.id == roleId)) {
                    roleDeptId = parseInt(deptId);
                    break;
                }
            }
            
            // 無依賴：可以刪除
            Dialog.confirm('此角色沒有使用者和子角色，將會永久刪除。\n\n此操作無法復原，確定要刪除嗎？', async () => {
                try {
                    if (crudModule) {
                        await crudModule.deleteDepartmentRole(roleId);
                    } else {
                        throw new Error('CRUD 模組未初始化');
                    }
                    
                    Dialog.success('角色已刪除');
                    
                    // 重新載入左側部門樹以更新角色資訊
                    await refreshDeptTree();
                    
                    // 選中該角色原本所屬的部門
                    if (roleDeptId) {
                        await selectDepartmentForRoles(roleDeptId);
                    }
                    
                    // 通知角色統計數據已更新
                    notifyRoleStatsChanged();
                    
                } catch (error) {
                    console.error('刪除角色失敗:', error);
                    Dialog.error(error.message || '刪除角色失敗');
                }
            });
            
        } catch (error) {
            console.error('檢查角色狀態失敗:', error);
            Dialog.error('無法檢查角色狀態，請稍後再試');
        }
    }
    
    // ===== 父角色變更確認 =====
    
    /**
     * 顯示父角色變更確認對話框
     * @param {number} affectedCount - 受影響的角色數量
     * @param {Array} affectedRoles - 受影響的角色列表
     * @param {Object} updateData - 更新資料
     */
    function showParentRoleChangeConfirm(affectedCount, affectedRoles, updateData) {
        pendingRoleUpdateData = updateData;
        
        // 設定影響數量
        const countElement = document.getElementById('parentChangeAffectedCount');
        if (countElement) {
            countElement.textContent = affectedCount;
        }
        
        // 顯示或隱藏影響角色清單
        const containerElement = document.getElementById('parentChangeAffectedContainer');
        const listElement = document.getElementById('parentChangeAffectedList');
        
        if (affectedCount > 0 && containerElement && listElement) {
            containerElement.style.display = 'block';
            
            // 建立影響角色清單
            const rolesList = affectedRoles.map(role => `
                <div class="affected-role-item">
                    <div class="role-info">
                        <h6>${role.name}</h6>
                        <p class="text-muted">${role.department_path}</p>
                        <span class="level-change">
                            層級: ${role.old_level} → ${role.new_level}
                        </span>
                    </div>
                </div>
            `).join('');
            
            listElement.innerHTML = rolesList;
        } else if (containerElement) {
            containerElement.style.display = 'none';
        }
        
        // 顯示對話框
        const modal = document.getElementById('parentRoleChangeConfirmModal');
        if (modal) {
            modal.classList.add('show');   
            // 初始化滾動條效果
            if (window.CommonUI && window.CommonUI.initScrollFadeEffect) {
                setTimeout(() => CommonUI.initScrollFadeEffect(), 100);
            }
        }
    }
    
    /**
     * 關閉父角色變更確認對話框
     */
    function closeParentRoleChangeConfirmModal() {
        const modal = document.getElementById('parentRoleChangeConfirmModal');
        if (modal) {
            modal.classList.remove('show');
        }        
        pendingRoleUpdateData = null;
    }
    
    /**
     * 確認父角色變更並執行更新
     * @param {Function} updateDepartmentRole - 更新角色的函數
     * @param {Function} refreshDeptTree - 重新整理部門樹的函數
     * @param {Function} expandDepartmentByRoleId - 展開部門的函數
     */
    async function confirmParentRoleChange(updateDepartmentRole, refreshDeptTree, expandDepartmentByRoleId) {
        if (!pendingRoleUpdateData) return;
        
        const { roleId, roleName, roleLevel, isActive, parentRoleId } = pendingRoleUpdateData;
        
        try {
            // 先更新角色基本資訊
            await updateDepartmentRole(roleId, {
                name: roleName,
                level: roleLevel,
                is_active: isActive,
                parent_id: parentRoleId
            });
            
            // 然後執行層級重算
            const recalcResponse = await fetch(`${API_BASE}/department-roles/${roleId}/recalculate-children`, {
                method: 'POST',
                credentials: 'include'
            });
            
            if (!recalcResponse.ok) {
                throw new Error('層級重算失敗');
            }
            
            const recalcResult = await recalcResponse.json();
            
            if (window.Dialog) {
                if (recalcResult.count > 0) {
                    Dialog.success(`角色更新成功，已重新計算 ${recalcResult.count} 個子角色的層級`);
                } else {
                    Dialog.success('角色更新成功');
                }
            }
            
            closeParentRoleChangeConfirmModal();
            closeEditDepartmentRoleModal();
            
            // 重新載入左側部門樹以更新角色資訊
            if (refreshDeptTree) {
                await refreshDeptTree();
            }
            
            // 選中該角色所屬的部門
            if (expandDepartmentByRoleId) {
                await expandDepartmentByRoleId(roleId);
            }
            
        } catch (error) {
            console.error('父角色變更失敗:', error);
            if (window.Dialog) {
                Dialog.error('父角色變更失敗: ' + (error.message || '未知錯誤'));
            } else {
                alert('父角色變更失敗');
            }
        }
    }
    
    // ===== 角色搜尋 Modal =====
    
    /**
     * 開啟角色搜尋模態框
     * @param {string} context - 搜尋上下文
     */
    function openRoleSearchModal(context) {
        const modal = document.getElementById('roleSearchModal');
        const contextField = document.getElementById('searchModalContext');
        const searchInput = document.getElementById('roleSearchInput');
        const selectedRoleField = document.getElementById('selectedRoleId');
        const confirmBtn = document.getElementById('confirmRoleBtn');
        const results = document.getElementById('roleSearchResults');
        
        if (contextField) contextField.value = context;
        if (searchInput) searchInput.value = '';
        if (selectedRoleField) selectedRoleField.value = '';
        if (confirmBtn) confirmBtn.disabled = true;
        
        // 清空搜尋結果
        if (results) {
            results.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search fa-2x text-muted"></i>
                    <p class="text-muted">請輸入關鍵字搜尋角色</p>
                </div>
            `;
        }
        
        if (modal) {
            modal.classList.add('show');
            // 初始化滾動條效果
            if (window.CommonUI && window.CommonUI.initScrollFadeEffect) {
                setTimeout(() => CommonUI.initScrollFadeEffect(), 100);
            }
        }
    }
    
    /**
     * 關閉角色搜尋模態框
     */
    function closeRoleSearchModal() {
        const modal = document.getElementById('roleSearchModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }
    
    /**
     * 確認角色選擇
     */
    function confirmRoleSelection() {
        const selectedRoleField = document.getElementById('selectedRoleId');
        const contextField = document.getElementById('searchModalContext');
        
        if (!selectedRoleField || !contextField) return;
        
        const roleId = selectedRoleField.value;
        const context = contextField.value;
        
        if (!roleId) return;
        
        // 根據上下文設定相應的欄位
        if (context === 'editRole') {
            const selectedItem = document.querySelector(`[data-role-id="${roleId}"]`);
            if (selectedItem) {
                const roleName = selectedItem.querySelector('h5').textContent;
                const deptPath = selectedItem.querySelector('.text-muted').textContent;
                
                const parentIdField = document.getElementById('editParentRoleId');
                const parentDisplayField = document.getElementById('editParentRoleDisplay');
                
                if (parentIdField) parentIdField.value = roleId;
                if (parentDisplayField) parentDisplayField.value = `${deptPath} / ${roleName}`;
            }
        }
        // 未來可以擴展其他上下文（如新增角色）
        
        closeRoleSearchModal();
    }
    
    // ===== 重算確認對話框 =====
    
    /**
     * 顯示重算確認對話框
     */
    async function showRecalculateConfirm() {
        const editRoleIdField = document.getElementById('editRoleId');
        if (!editRoleIdField) return;
        
        const roleId = editRoleIdField.value;
        if (!roleId) return;
        
        try {
            // 預覽影響
            const response = await fetch(`${API_BASE}/department-roles/${roleId}/recalculate-children?preview=true`, {
                method: 'POST',
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('無法獲取預覽資訊');
            }
            
            const result = await response.json();
            
            if (!result.success) {
                if (window.Dialog) {
                    Dialog.error(result.message || '無法獲取預覽資訊');
                }
                return;
            }
            
            // 顯示影響的角色
            const affectedCountField = document.getElementById('affectedRoleCount');
            if (affectedCountField) {
                affectedCountField.textContent = result.count || 0;
            }
            
            const affectedList = document.getElementById('affectedRolesList');
            if (affectedList && result.affected_roles) {
                const html = result.affected_roles.map(role => `
                    <div class="affected-role-item">
                        <strong>${role.name}</strong>
                        <div class="text-muted">${role.department_path}</div>
                        <div class="level-change">層級：${role.old_level} → ${role.new_level}</div>
                    </div>
                `).join('');
                affectedList.innerHTML = html;
            }
            
            // 顯示確認對話框
            const modal = document.getElementById('recalculateConfirmModal');
            if (modal) {
                modal.classList.add('show');
                // 初始化滾動條效果
                if (window.CommonUI && window.CommonUI.initScrollFadeEffect) {
                    setTimeout(() => CommonUI.initScrollFadeEffect(), 100);
                }
            }
            
        } catch (error) {
            console.error('獲取預覽資訊失敗:', error);
            if (window.Dialog) {
                Dialog.error('無法獲取預覽資訊');
            }
        }
    }
    
    /**
     * 關閉重算確認對話框
     */
    function closeRecalculateConfirmModal() {
        const modal = document.getElementById('recalculateConfirmModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }
    
    /**
     * 執行重算子角色層級
     * @param {Function} refreshDeptTree - 重新整理部門樹的函數
     */
    async function executeRecalculate(refreshDeptTree) {
        const editRoleIdField = document.getElementById('editRoleId');
        if (!editRoleIdField) return;
        
        const roleId = editRoleIdField.value;
        if (!roleId) return;
        
        try {
            const response = await fetch(`${API_BASE}/department-roles/${roleId}/recalculate-children?preview=false`, {
                method: 'POST',
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('重算失敗');
            }
            
            const result = await response.json();
            
            if (result.success) {
                if (window.Dialog) {
                    Dialog.success(result.message || '重算子角色層級成功');
                }
                
                closeRecalculateConfirmModal();
                
                // 重新載入角色清單以反映更新
                if (refreshDeptTree) {
                    await refreshDeptTree();
                }
                
            } else {
                throw new Error(result.message || '重算失敗');
            }
            
        } catch (error) {
            console.error('執行重算失敗:', error);
            if (window.Dialog) {
                Dialog.error(error.message || '執行重算失敗');
            }
        }
    }
    
    // ===== 移除用戶角色確認 =====
    
    /**
     * 移除用戶的角色確認對話框
     * @param {number} userId - 用戶 ID
     * @param {number} roleId - 角色 ID
     * @param {Function} removeUserFromRole - 移除用戶角色的函數
     * @param {Function} selectRole - 選擇角色的函數
     */
    async function removeUserFromRoleConfirm(userId, roleId, removeUserFromRole, selectRole) {
        if (!window.Dialog) return;
        
        Dialog.confirm('確定要移除此用戶的角色嗎？', async () => {
            try {
                await removeUserFromRole(roleId, userId);
                
                // 重新載入角色詳情
                await selectRole(roleId);
                Dialog.success('已移除用戶角色');
                
            } catch (error) {
                console.error('移除用戶角色失敗:', error);
                Dialog.error('移除用戶角色失敗');
            }
        });
    }
    
    // ==== 角色權限管理功能 ====
    
    // 現在編輯的角色資料
    let currentEditingRole = null;
    let currentRolePermissions = [];
    
    /**
     * 切換編輯模態框的 Tab
     */
    function switchEditTab(tabName) {
        const tabs = document.querySelectorAll('.role-edit-tabs .tab-nav-item');
        const panes = document.querySelectorAll('.tab-content .tab-pane');
        
        // 更新標籤狀態
        tabs.forEach(tab => {
            if (tab.dataset.tab === tabName) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        
        // 更新內容版面
        panes.forEach(pane => {
            if (pane.dataset.tab === tabName) {
                pane.classList.add('active');
            } else {
                pane.classList.remove('active');
            }
        });
        
        // 如果切換到權限 Tab，載入權限資料
        if (tabName === 'permissions' && currentEditingRole) {
            loadRolePermissions(currentEditingRole.id);
        }
    }
    
    /**
     * 顯示角色權限選擇模態框
     */
    async function showRolePermissionsModal() {
        if (!currentEditingRole) {
            console.error('未找到目前編輯的角色資料');
            return;
        }
        
        // 先載入角色現有權限
        let existingPermissionIds = [];
        try {
            if (window.OrganizationEmployeePermissionsModule) {
                const existingPermissions = await window.OrganizationEmployeePermissionsModule.loadExistingPermissions(
                    'role', 
                    currentEditingRole.id
                );
                existingPermissionIds = existingPermissions.map(p => p.id);
                currentRolePermissions = existingPermissions; // 更新當前權限資料
                console.log('載入角色現有權限:', existingPermissions.length, '個');
            }
        } catch (error) {
            console.error('載入角色權限失敗:', error);
            currentRolePermissions = [];
        }
        
        // 顯示權限設定模態框，傳入現有權限
        if (window.OrganizationEmployeePermissionsModule) {
            await window.OrganizationEmployeePermissionsModule.showPermissionsModal(
                'role', 
                currentEditingRole.id, 
                existingPermissionIds  // 傳入現有權限ID陣列
            );
        }
    }
    
    /**
     * 載入角色權限
     */
    async function loadRolePermissions(roleId) {
        if (!roleId) return;
        
        try {
            if (window.OrganizationEmployeePermissionsModule) {
                const permissions = await window.OrganizationEmployeePermissionsModule.loadExistingPermissions('role', roleId);
                currentRolePermissions = permissions || [];
                updateRolePermissionsDisplay();
            }
        } catch (error) {
            console.error('載入角色權限失敗:', error);
            currentRolePermissions = [];
        }
    }
    
    /**
     * 更新角色權限顯示
     */
    function updateRolePermissionsDisplay() {
        const countEl = document.getElementById('rolePermissionsCount');
        const previewEl = document.getElementById('rolePermissionsPreview');
        
        if (countEl) {
            countEl.textContent = currentRolePermissions.length;
        }
        
        if (previewEl) {
            if (currentRolePermissions.length === 0) {
                previewEl.innerHTML = `
                    <div class="empty-state text-muted">
                        <i class="fas fa-shield-alt"></i>
                        <span>尚未選擇任何權限群組</span>
                    </div>
                `;
            } else {
                let html = '';
                currentRolePermissions.forEach(permission => {
                    html += `
                        <span class="permission-badge">
                            <i class="fas fa-shield-alt"></i>
                            ${permission.name}
                            <span class="permission-code">(${permission.code})</span>
                        </span>
                    `;
                });
                previewEl.innerHTML = html;
            }
        }
    }
    
    /**
     * 清除角色權限
     */
    function clearRolePermissions() {
        if (window.Dialog) {
            window.Dialog.confirm('確定要清除所有權限嗎？', () => {
                currentRolePermissions = [];
                updateRolePermissionsDisplay();
            });
        } else {
            currentRolePermissions = [];
            updateRolePermissionsDisplay();
        }
    }
    
    /**
     * 刷新角色權限（由權限選擇元件呼叫）
     */
    function refreshRolePermissions(roleId) {
        if (currentEditingRole && currentEditingRole.id === roleId) {
            loadRolePermissions(roleId);
        }
    }
    
    /**
     * 設定目前編輯的角色資料
     */
    function setCurrentEditingRole(role) {
        currentEditingRole = role;
        currentRolePermissions = [];
        console.log('設定當前編輯角色:', role);
    }
    
    // 公開 API
    return {
        // 基本 Modal 關閉功能
        closeDepartmentRoleModal,
        closeAddDepartmentRoleModal,
        closeEditDepartmentRoleModal,
        closeRoleDetailsModal,
        
        // 新增角色
        showAddRoleModal,
        confirmAddDepartmentRole,
        
        // 角色詳情
        viewRoleDetails,
        
        // 編輯角色
        confirmEditDepartmentRole,
        
        // 刪除角色
        deleteDepartmentRoleConfirm,
        
        // 父角色變更
        showParentRoleChangeConfirm,
        closeParentRoleChangeConfirmModal,
        confirmParentRoleChange,
        
        // 角色搜尋
        openRoleSearchModal,
        closeRoleSearchModal,
        confirmRoleSelection,
        
        // 重算確認
        showRecalculateConfirm,
        closeRecalculateConfirmModal,
        executeRecalculate,
        
        // 移除用戶角色
        removeUserFromRoleConfirm,
        
        // 權限管理
        switchEditTab,
        showRolePermissionsModal,
        clearRolePermissions,
        refreshRolePermissions,
        setCurrentEditingRole
    };
})();

// 將模組掛載到全域
if (typeof window !== 'undefined') {
    window.__OrganizationRolesModalModule = __OrganizationRolesModalModule;
}