/**
 * 組織角色拖曳功能子模組
 * 處理角色的拖放移動操作
 */
const OrganizationRolesDragModule = (function() {
    'use strict';
    
    // API 端點
    const API_BASE = '/api/organization';
    
    // 角色拖曳相關變數
    let draggedRole = null;
    
    /**
     * 初始化模組
     */
    function init() {
        console.log('OrganizationRolesDragModule 初始化');
        return {
            bindRoleDragEvents,
            handleRoleDragStart,
            handleRoleDragEnd,
            setupDepartmentDropZones,
            cleanupDragStyles
        };
    }
    
    /**
     * 綁定角色拖曳事件
     */
    function bindRoleDragEvents() {
        // 選擇所有角色節點（包括兩種類型）
        const roleNodes = document.querySelectorAll('.role-node, .role-tree-node');
        
        roleNodes.forEach(roleNode => {
            // 檢查是否已經綁定過拖曳事件（避免重複綁定）
            if (roleNode.getAttribute('data-drag-bound') === 'true') {
                // 如果已經綁定過，跳過
                return;
            }
            
            // 只為有 draggable 屬性的節點添加拖曳事件
            if (roleNode.draggable) {
                roleNode.addEventListener('dragstart', handleRoleDragStart);
                roleNode.addEventListener('dragend', handleRoleDragEnd);
                roleNode.setAttribute('data-drag-bound', 'true');
            }
            
            // 為部門管理區塊中的角色節點添加點擊事件
            if (roleNode.classList.contains('role-node') && roleNode.getAttribute('data-click-bound') !== 'true') {
                roleNode.addEventListener('click', handleRoleClick);
                roleNode.setAttribute('data-click-bound', 'true');
            }
        });
    }
    
    /**
     * 處理角色點擊事件
     */
    function handleRoleClick(event) {
        event.stopPropagation();
        const roleId = parseInt(event.currentTarget.dataset.roleId);
        // 呼叫主模組的 selectRole 函數
        if (window.OrganizationRolesModule && window.OrganizationRolesModule.selectRole) {
            window.OrganizationRolesModule.selectRole(roleId);
        }
    }
    
    /**
     * 角色拖曳開始
     */
    function handleRoleDragStart(event) {
        event.stopPropagation();
        
        // 支援兩種類型的角色節點
        const roleElement = event.target.closest('.role-node, .role-tree-node');
        const roleId = roleElement.dataset.roleId;
        const departmentId = roleElement.dataset.departmentId;
        
        draggedRole = {
            id: parseInt(roleId),
            departmentId: parseInt(departmentId),
            element: roleElement
        };
        
        // 添加拖曳樣式和拖曳狀態類別
        roleElement.classList.add('dragging');
        document.body.classList.add('dragging-active');
        
        // 設定拖曳資料
        event.dataTransfer.setData('text/plain', '');
        event.dataTransfer.effectAllowed = 'move';
        
        // 創建自定義拖曳圖像（可選）
        const dragImage = roleElement.cloneNode(true);
        dragImage.classList.add('drag-ghost');
        dragImage.style.position = 'absolute';
        dragImage.style.top = '-1000px';
        document.body.appendChild(dragImage);
        event.dataTransfer.setDragImage(dragImage, 0, 0);
        
        // 稍後移除臨時元素
        setTimeout(() => {
            if (document.body.contains(dragImage)) {
                document.body.removeChild(dragImage);
            }
        }, 0);
        
        // 為所有部門節點添加放置事件監聽器
        setupDepartmentDropZones();
    }
    
    /**
     * 角色拖曳結束
     */
    function handleRoleDragEnd(event) {
        event.stopPropagation();
        
        // 延遲清理，確保 drop 事件先處理
        setTimeout(() => {
            if (draggedRole && draggedRole.element) {
                draggedRole.element.classList.remove('dragging');
            }
            
            // 移除全域拖曳狀態
            document.body.classList.remove('dragging-active');
            
            // 清理所有拖曳樣式
            cleanupDragStyles();
        }, 100);
    }
    
    /**
     * 設定部門節點為放置區域
     */
    function setupDepartmentDropZones() {
        const deptNodes = document.querySelectorAll('.tree-node[data-id]:not([data-id="root"])');
        
        deptNodes.forEach(node => {
            node.addEventListener('dragover', handleDepartmentDragOver);
            node.addEventListener('drop', handleDepartmentDrop);
            node.addEventListener('dragleave', handleDepartmentDragLeave);
        });
    }
    
    /**
     * 部門節點拖曳經過
     */
    function handleDepartmentDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        
        if (!draggedRole) return;
        
        const deptNode = event.currentTarget;
        const targetDeptId = parseInt(deptNode.dataset.id);
        
        // 檢查是否為有效的放置目標
        if (targetDeptId === draggedRole.departmentId) {
            // 不能拖曳到同一個部門
            deptNode.classList.add('drag-invalid');
            event.dataTransfer.dropEffect = 'none';
        } else {
            // 有效的放置目標
            deptNode.classList.add('role-drop-zone');
            event.dataTransfer.dropEffect = 'move';
        }
    }
    
    /**
     * 離開部門節點
     */
    function handleDepartmentDragLeave(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const deptNode = event.currentTarget;
        deptNode.classList.remove('role-drop-zone', 'drag-invalid');
    }
    
    /**
     * 在部門節點放置角色
     */
    async function handleDepartmentDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        
        if (!draggedRole) return;
        
        const deptNode = event.currentTarget;
        const targetDeptId = parseInt(deptNode.dataset.id);
        
        // 保存拖放資料（避免被清理）
        const roleId = draggedRole.id;
        const sourceDeptId = draggedRole.departmentId;
        
        // 檢查是否為有效的移動
        if (targetDeptId === sourceDeptId) {
            // 清理拖曳樣式
            cleanupDragStyles();
            if (window.Dialog) {
                Dialog.warning('角色已在該部門中');
            }
            return;
        }
        
        // 清理拖曳樣式（但保留必要的資料）
        cleanupDragStyles();
        
        // 顯示移動確認對話框
        await showRoleMoveConfirmDialog(roleId, targetDeptId);
    }
    
    /**
     * 清理所有拖曳樣式
     */
    function cleanupDragStyles() {
        // 清理部門節點樣式和臨時事件監聽器
        const allDeptNodes = document.querySelectorAll('.tree-node');
        allDeptNodes.forEach(node => {
            node.classList.remove('role-drop-zone', 'drag-invalid');
            // 只移除拖放相關的臨時事件監聽器
            node.removeEventListener('dragover', handleDepartmentDragOver);
            node.removeEventListener('drop', handleDepartmentDrop);
            node.removeEventListener('dragleave', handleDepartmentDragLeave);
        });
        
        // 清理角色節點樣式
        const roleNodes = document.querySelectorAll('.role-node, .role-tree-node');
        roleNodes.forEach(node => {
            node.classList.remove('dragging');
        });
        
        // 移除全域拖曳狀態
        document.body.classList.remove('dragging-active');
        
        // 重置拖曳狀態
        draggedRole = null;
    }
    
    /**
     * 顯示角色移動確認對話框（支援批量移動選項）
     * 需要從主模組傳入參數
     */
    async function showRoleMoveConfirmDialog(roleId, targetDeptId) {
        try {
            // 先獲取預覽資訊（單獨移動模式）
            const previewResponse = await fetch(`${API_BASE}/department-roles/${roleId}/move-preview`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    new_department_id: targetDeptId,
                    include_children: false
                })
            });
            
            if (!previewResponse.ok) {
                throw new Error('載入預覽資訊失敗');
            }
            
            const previewData = await previewResponse.json();
            
            // 如果有子角色（根據 has_children 判斷），也獲取批量移動的預覽
            let batchPreviewData = null;
            if (previewData.has_children && previewData.children_count > 0) {
                const batchResponse = await fetch(`${API_BASE}/department-roles/${roleId}/move-preview`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        new_department_id: targetDeptId,
                        include_children: true
                    })
                });
                
                if (batchResponse.ok) {
                    batchPreviewData = await batchResponse.json();
                }
            }
            
            // 建立移動確認對話框內容
            let dialogContent = `
                <div class="role-move-dialog">
                    <div class="move-summary">
                        <div class="move-path">
                            <span class="from-dept">${previewData.source_role.current_department}</span>
                            <i class="fas fa-arrow-right mx-1"></i>
                            <span class="to-dept">${previewData.target_department.name || '目標部門'}</span>
                        </div>
                    </div>`;
            
            // 如果有子角色，顯示移動模式選擇
            if (batchPreviewData && batchPreviewData.child_roles.length > 0) {
                dialogContent += `
                    <div class="move-mode-selection">
                        <h5>選擇移動模式</h5>
                        <div class="move-options">
                            <label class="move-option">
                                <input type="radio" name="moveMode" value="single" checked>
                                <div class="option-content">
                                    <div class="option-title">
                                        <i class="fas fa-user"></i>
                                        僅移動 "${previewData.source_role.name}"
                                    </div>
                                    <small class="text-muted">子角色將留在原部門</small>
                                </div>
                            </label>
                            <label class="move-option">
                                <input type="radio" name="moveMode" value="batch">
                                <div class="option-content">
                                    <div class="option-title">
                                        <i class="fas fa-users"></i>
                                        批量移動（包含 ${batchPreviewData.children_count || batchPreviewData.child_roles.length} 個子角色）
                                    </div>
                                    <small class="text-muted">保持完整的層級結構</small>
                                </div>
                            </label>
                        </div>
                    </div>
                    
                    <!-- 子角色預覽（初始隱藏） -->
                    <div class="children-preview" id="childrenPreview" style="display:none;">
                        <h5>將一併移動的子角色</h5>
                        <div class="children-list scrollable-fade">
                            ${batchPreviewData.child_roles.map(child => `
                                <div class="child-role-item">
                                    <span class="role-name">${child.name}</span>
                                    <span class="level-badge">層級 ${child.current_level} → ${child.new_level}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>`;
            }
            
            // 循環引用風險警告
            if (previewData.circular_risks && previewData.circular_risks.length > 0) {
                dialogContent += `
                    <div class="circular-warning">
                        <div class="alert alert-warning">
                            <i class="fas fa-exclamation-triangle"></i>
                            <strong>檢測到潛在風險：</strong>
                            <ul>
                                ${previewData.circular_risks.map(risk => `
                                    <li>${risk.message}</li>
                                `).join('')}
                            </ul>
                        </div>
                    </div>`;
            }
            
            // 警告信息顯示（優先級最高，放在最前面）
            if (previewData.warning) {
                // 顯示智能推算的警告信息
                dialogContent += `
                    <div class="smart-warning">
                        <div class="alert alert-warning">
                            <i class="fas fa-exclamation-triangle"></i>
                            ${previewData.warning}
                        </div>
                    </div>`;
            } else if (previewData.has_descendants_in_target && previewData.descendants_found && previewData.descendants_found.length > 0) {
                // 如果沒有 warning 但有子孫節點信息（備用）
                const descNames = previewData.descendants_found.slice(0, 3).map(d => d.name).join('、');
                const moreCount = previewData.descendants_found.length > 3 ? ` 等${previewData.descendants_found.length}個角色` : '';
                
                dialogContent += `
                    <div class="descendants-warning">
                        <div class="alert alert-warning">
                            <i class="fas fa-exclamation-triangle"></i>
                            <strong>重要提醒：</strong>
                            <p>目標部門包含此角色的子孫節點（${descNames}${moreCount}）</p>
                            <p>為避免循環引用，系統已智能選擇 <strong>${previewData.new_hierarchy.parent_role || '無（頂層角色）'}</strong> 作為父角色</p>
                        </div>
                    </div>`;
            }
            
            // 新層級資訊
            dialogContent += `
                <div class="hierarchy-preview">
                    <h5>層級結構預覽</h5>
                    <div class="hierarchy-info">
                        <div class="role-hierarchy-item">
                            <strong>${previewData.source_role.name}</strong>
                            <div class="hierarchy-details">
                                <span>當前層級：${previewData.source_role.current_level} → 新層級：${previewData.new_hierarchy.new_level}</span>
                                <br>
                                <span>父角色：<strong style="color: #667eea;">${previewData.new_hierarchy.parent_role || '無（頂層角色）'}</strong></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
            
            // 創建自定義對話框
            const dialogElement = document.createElement('div');
            dialogElement.innerHTML = dialogContent;
            
            // 綁定移動模式切換事件
            const radioButtons = dialogElement.querySelectorAll('input[name="moveMode"]');
            radioButtons.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    const childrenPreview = dialogElement.querySelector('#childrenPreview');
                    if (childrenPreview) {
                        childrenPreview.style.display = e.target.value === 'batch' ? 'block' : 'none';
                    }
                });
            });
            
            // 顯示確認對話框
            if (window.Dialog) {
                Dialog.confirm(
                    dialogElement.innerHTML,
                    () => {
                        // 獲取選擇的移動模式
                        const selectedMode = document.querySelector('input[name="moveMode"]:checked');
                        const includeChildren = selectedMode ? selectedMode.value === 'batch' : false;
                        
                        // 執行移動
                        executeRoleMove(roleId, targetDeptId, includeChildren);
                    },
                    {
                        title: '確認角色移動',
                        confirmText: '確認移動',
                        cancelText: '取消',
                        allowHTML: true,
                        width: '600px'
                    }
                );
                
                // 重新綁定事件（Dialog 創建後）
                setTimeout(() => {
                    const dialogRadios = document.querySelectorAll('.modal input[name="moveMode"]');
                    dialogRadios.forEach(radio => {
                        radio.addEventListener('change', (e) => {
                            const preview = document.querySelector('.modal #childrenPreview');
                            if (preview) {
                                preview.style.display = e.target.value === 'batch' ? 'block' : 'none';
                            }
                        });
                    });
                }, 100);
            }
            
        } catch (error) {
            console.error('顯示移動確認對話框失敗:', error);
            if (window.Dialog) {
                Dialog.error('載入移動資訊失敗，請稍後再試');
            }
        }
    }
    
    /**
     * 執行角色移動（支援批量移動）
     */
    async function executeRoleMove(roleId, targetDeptId, includeChildren = false) {
        try {
            const response = await fetch(`${API_BASE}/department-roles/${roleId}/move`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    new_department_id: targetDeptId,
                    include_children: includeChildren
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                
                // 處理循環引用警告
                if (errorData.detail && errorData.detail.includes('循環引用風險')) {
                    // 詢問是否強制執行
                    if (window.Dialog) {
                        Dialog.confirm(
                            `<div class="alert alert-warning">
                                <i class="fas fa-exclamation-triangle"></i>
                                <strong>警告：</strong>${errorData.detail}
                                <br><br>
                                是否要強制執行移動？這可能會導致角色層級關係混亂。
                            </div>`,
                            async () => {
                                // 強制執行移動
                                const forceResponse = await fetch(`${API_BASE}/department-roles/${roleId}/move`, {
                                    method: 'PUT',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    credentials: 'include',
                                    body: JSON.stringify({
                                        new_department_id: targetDeptId,
                                        include_children: includeChildren,
                                        force: true
                                    })
                                });
                                
                                if (forceResponse.ok) {
                                    const forceResult = await forceResponse.json();
                                    handleMoveSuccess(forceResult);
                                } else {
                                    Dialog.error('強制移動失敗');
                                }
                            },
                            {
                                title: '循環引用警告',
                                confirmText: '強制移動',
                                cancelText: '取消',
                                allowHTML: true
                            }
                        );
                    }
                    return;
                }
                
                throw new Error(errorData.detail || '移動角色失敗');
            }
            
            const result = await response.json();
            
            if (result.success) {
                handleMoveSuccess(result);
            } else {
                throw new Error(result.message || '移動失敗');
            }
            
        } catch (error) {
            console.error('執行角色移動失敗:', error);
            if (window.Dialog) {
                Dialog.error(`移動失敗: ${error.message}`);
            }
        }
    }
    
    /**
     * 處理移動成功
     */
    async function handleMoveSuccess(result) {
        try {
            // 顯示成功訊息
            let successMessage = result.message || '角色移動成功';
            
            if (result.move_mode === '批量移動' && result.children_moved > 0) {
                successMessage = `批量移動成功！共移動 ${result.children_moved + 1} 個角色`;
            } else if (result.affected_roles && result.affected_roles.length > 0) {
                successMessage += `\n共影響了 ${result.affected_roles.length} 個角色`;
            }
            
            // 如果有警告訊息，一併顯示
            if (result.warning) {
                successMessage += `\n\n ${result.warning}`;
            }
            
            if (window.Dialog) {
                // 如果有警告，使用 info 而不是 success
                if (result.warning) {
                    Dialog.info(successMessage);
                } else {
                    Dialog.success(successMessage);
                }
            }
            
            // 呼叫主模組的重新整理函數
            if (window.OrganizationRolesModule && window.OrganizationRolesModule.refreshDeptTree) {
                await window.OrganizationRolesModule.refreshDeptTree();
                
                // 選中目標部門
                if (result.new_department_id && window.OrganizationRolesModule.selectDepartmentForRoles) {
                    await window.OrganizationRolesModule.selectDepartmentForRoles(result.new_department_id);
                }
            }
            
        } catch (error) {
            console.error('處理移動成功響應失敗:', error);
        }
    }
    
    // 公開 API
    return {
        init,
        bindRoleDragEvents,
        handleRoleDragStart,
        handleRoleDragEnd,
        setupDepartmentDropZones,
        cleanupDragStyles
    };
    
})();

// 將模組註冊到全域
window.__OrganizationRolesDragModule = OrganizationRolesDragModule;