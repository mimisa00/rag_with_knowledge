/**
 * 組織管理 - 員工拖放功能模組
 * 處理員工節點的拖放操作和角色自動轉換
 */
window.OrganizationEmployeeDragModule = (function() {
    'use strict';

    // 拖放狀態
    let isDragging = false;
    let draggedEmployees = [];  // 支援多選拖放
    let dragSource = null;      // 拖放來源部門
    let dragTarget = null;      // 拖放目標部門
    let multiSelectMode = false; // 多選模式
    let selectedEmployees = new Set(); // 已選中的員工

    // API 端點
    const API_BASE = '/api/organization';

    /**
     * 初始化拖放功能
     */
    function init() {
        console.log('OrganizationEmployeeDragModule 初始化');
        
        // 綁定快捷鍵
        bindKeyboardEvents();
        
        return Promise.resolve();
    }

    /**
     * 為員工節點啟用拖放功能
     */
    function enableDragForEmployeeNodes() {
        const employeeNodes = document.querySelectorAll('.employee-tree-node');
        
        employeeNodes.forEach(node => {
            // 設定拖放屬性
            node.setAttribute('draggable', 'true');
            
            // 移除舊的事件監聽器（避免重複綁定）
            node.removeEventListener('dragstart', handleDragStart);
            node.removeEventListener('dragend', handleDragEnd);
            node.removeEventListener('click', handleEmployeeClick);
            
            // 綁定新的事件監聽器
            node.addEventListener('dragstart', handleDragStart);
            node.addEventListener('dragend', handleDragEnd);
            node.addEventListener('click', handleEmployeeClick);
        });

        console.log(`已為 ${employeeNodes.length} 個員工節點啟用拖放功能`);
    }

    /**
     * 為部門節點啟用放置功能
     */
    function enableDropForDepartmentNodes() {
        const deptNodes = document.querySelectorAll('.tree-node[data-id]');
        
        deptNodes.forEach(node => {
            // 移除舊的事件監聽器
            node.removeEventListener('dragover', handleDragOver);
            node.removeEventListener('dragenter', handleDragEnter);
            node.removeEventListener('dragleave', handleDragLeave);
            node.removeEventListener('drop', handleDrop);
            
            // 綁定新的事件監聽器
            node.addEventListener('dragover', handleDragOver);
            node.addEventListener('dragenter', handleDragEnter);
            node.addEventListener('dragleave', handleDragLeave);
            node.addEventListener('drop', handleDrop);
        });

        console.log(`已為 ${deptNodes.length} 個部門節點啟用放置功能`);
    }

    /**
     * 處理員工點擊事件（支援多選）
     */
    function handleEmployeeClick(event) {
        const empNode = event.currentTarget;
        const empId = parseInt(empNode.dataset.empId);
        
        // 如果按住 Ctrl/Cmd 鍵，進入多選模式
        if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            event.stopPropagation();
            
            multiSelectMode = true;
            
            if (selectedEmployees.has(empId)) {
                // 取消選擇
                selectedEmployees.delete(empId);
                empNode.classList.remove('multi-selected');
            } else {
                // 添加選擇
                selectedEmployees.add(empId);
                empNode.classList.add('multi-selected');
            }
            
            updateMultiSelectIndicator();
        } else if (event.shiftKey && selectedEmployees.size > 0) {
            // Shift 鍵：範圍選擇
            event.preventDefault();
            event.stopPropagation();
            
            // 實作範圍選擇邏輯
            selectEmployeeRange(empId);
            updateMultiSelectIndicator();
        } else {
            // 普通點擊：清除多選狀態
            clearMultiSelection();
        }
    }

    /**
     * 範圍選擇員工
     */
    function selectEmployeeRange(targetEmpId) {
        const allEmpNodes = document.querySelectorAll('.employee-tree-node');
        const empIds = Array.from(allEmpNodes).map(node => parseInt(node.dataset.empId));
        
        if (selectedEmployees.size === 0) {
            selectedEmployees.add(targetEmpId);
            const targetNode = document.querySelector(`[data-emp-id="${targetEmpId}"]`);
            if (targetNode) targetNode.classList.add('multi-selected');
            return;
        }
        
        const lastSelected = Math.max(...selectedEmployees);
        const startIndex = empIds.indexOf(lastSelected);
        const endIndex = empIds.indexOf(targetEmpId);
        
        if (startIndex !== -1 && endIndex !== -1) {
            const minIndex = Math.min(startIndex, endIndex);
            const maxIndex = Math.max(startIndex, endIndex);
            
            for (let i = minIndex; i <= maxIndex; i++) {
                const empId = empIds[i];
                selectedEmployees.add(empId);
                const empNode = document.querySelector(`[data-emp-id="${empId}"]`);
                if (empNode) empNode.classList.add('multi-selected');
            }
        }
        
        multiSelectMode = true;
    }

    /**
     * 更新多選指示器
     */
    function updateMultiSelectIndicator() {
        const count = selectedEmployees.size;
        const indicator = document.getElementById('multiSelectIndicator') || createMultiSelectIndicator();
        
        if (count > 1) {
            indicator.querySelector('.count').textContent = count;
            indicator.style.display = 'block';
        } else {
            indicator.style.display = 'none';
        }
    }

    /**
     * 創建多選指示器
     */
    function createMultiSelectIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'multiSelectIndicator';
        indicator.className = 'multi-select-indicator';
        indicator.innerHTML = `
            <i class="fas fa-check-square"></i>
            <span>已選擇 <span class="count">0</span> 位員工</span>
            <button class="btn-clear" onclick="OrganizationEmployeeDragModule.clearMultiSelection()">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        const container = document.getElementById('employeeTreeContainer');
        if (container) {
            container.parentNode.insertBefore(indicator, container);
        }
        
        return indicator;
    }

    /**
     * 清除多選狀態
     */
    function clearMultiSelection() {
        multiSelectMode = false;
        selectedEmployees.clear();
        
        document.querySelectorAll('.employee-tree-node.multi-selected').forEach(node => {
            node.classList.remove('multi-selected');
        });
        
        updateMultiSelectIndicator();
    }

    /**
     * 處理拖放開始
     */
    function handleDragStart(event) {
        const empNode = event.currentTarget;
        const empId = parseInt(empNode.dataset.empId);
        
        isDragging = true;
        dragSource = findEmployeeDepartment(empNode);
        
        // 確定要拖放的員工
        if (selectedEmployees.has(empId) && selectedEmployees.size > 1) {
            // 多選拖放
            draggedEmployees = Array.from(selectedEmployees);
        } else {
            // 單選拖放
            draggedEmployees = [empId];
            clearMultiSelection(); // 清除之前的多選狀態
        }

        // 設定拖放效果
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', JSON.stringify(draggedEmployees));

        // 創建拖放視覺回饋
        createDragGhost(draggedEmployees);

        // 添加拖放中的樣式
        document.body.classList.add('employee-dragging');
        empNode.classList.add('dragging');

        console.log(`開始拖放 ${draggedEmployees.length} 位員工:`, draggedEmployees);
    }

    /**
     * 處理拖放結束
     */
    function handleDragEnd(event) {
        // 注意：不要立即清空 draggedEmployees，因為 drop 事件可能還在處理中
        // 只清理視覺效果，數據清理將在移動操作完成後進行
        
        // 移除拖放樣式
        document.body.classList.remove('employee-dragging');
        document.querySelectorAll('.dragging').forEach(node => {
            node.classList.remove('dragging');
        });
        document.querySelectorAll('.drag-over').forEach(node => {
            node.classList.remove('drag-over');
        });

        // 移除拖放視覺回饋
        removeDragGhost();
        
        // 延遲清理拖放狀態，給 drop 事件處理留出時間
        setTimeout(() => {
            if (!isDragging) {  // 確保沒有新的拖放操作開始
                cleanupDragState();
            }
        }, 100);
    }
    
    /**
     * 清理拖放狀態
     */
    function cleanupDragState() {
        isDragging = false;
        draggedEmployees = [];
        dragSource = null;
        dragTarget = null;
        
        console.log('🧹 拖放狀態已清理');
    }

    /**
     * 處理拖放經過
     */
    function handleDragOver(event) {
        if (!isDragging) return;
        
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
    }

    /**
     * 處理拖放進入
     */
    function handleDragEnter(event) {
        if (!isDragging) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        const deptNode = event.currentTarget;
        const deptId = parseInt(deptNode.dataset.id);
        
        // 檢查是否為有效的放置目標
        if (isValidDropTarget(deptId)) {
            deptNode.classList.add('drag-over');
            dragTarget = deptId;
        }
    }

    /**
     * 處理拖放離開
     */
    function handleDragLeave(event) {
        if (!isDragging) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        const deptNode = event.currentTarget;
        const deptId = parseInt(deptNode.dataset.id);
        
        // 檢查 relatedTarget 是否仍在當前節點內
        const relatedTarget = event.relatedTarget;
        if (relatedTarget && deptNode.contains(relatedTarget)) {
            return; // 仍在節點內，不視為離開
        }
        
        // 真正離開節點
        deptNode.classList.remove('drag-over');
        if (dragTarget === deptId) {
            dragTarget = null;
        }
    }

    /**
     * 處理放置
     */
    async function handleDrop(event) {
        if (!isDragging || !dragTarget) return;
        
        event.preventDefault();
        event.stopPropagation();
        const targetDeptId = dragTarget;
        
        // 移除視覺效果
        document.querySelectorAll('.drag-over').forEach(node => {
            node.classList.remove('drag-over');
        });

        try {
            console.log('🎯 開始處理拖放:', { draggedEmployees, dragSource, targetDeptId });
            
            // 檢查拖放數據是否有效
            if (!draggedEmployees || draggedEmployees.length === 0) {
                console.error('❌ 無效的拖放數據: 沒有要移動的員工');
                cleanupDragState();
                return;
            }
            
            if (!dragSource || !targetDeptId) {
                console.error('❌ 無效的拖放數據: 缺少來源或目標部門信息');
                cleanupDragState();
                return;
            }
            
            // 顯示確認對話框
            console.log('💬 顯示確認對話框...');
            const shouldProceed = await showMoveConfirmDialog(draggedEmployees, dragSource, targetDeptId);
            console.log('💬 確認對話框結果:', shouldProceed);
            
            if (!shouldProceed) {
                console.log('❌ 用戶取消了移動操作');
                cleanupDragState(); // 取消時也要清理狀態
                return;
            }

            // 執行移動操作
            console.log('🚀 開始執行移動操作...');
            await moveEmployeesToDepartment(draggedEmployees, targetDeptId);
            console.log('✅ 移動操作完成');

        } catch (error) {
            console.error('❌ 員工移動失敗:', error);
            showToast(error.message || '移動員工失敗', 'error');
        } finally {
            // 無論成功或失敗，都要清理拖放狀態
            cleanupDragState();
        }
    }

    /**
     * 檢查是否為有效的放置目標
     */
    function isValidDropTarget(targetDeptId) {
        // 不能移動到相同部門
        if (dragSource && dragSource.id === targetDeptId) {
            return false;
        }

        // 檢查目標部門是否存在且啟用
        const targetNode = document.querySelector(`[data-id="${targetDeptId}"]`);
        return targetNode && !targetNode.classList.contains('inactive');
    }

    /**
     * 找到員工所屬的部門
     */
    function findEmployeeDepartment(empNode) {
        const deptNode = empNode.closest('.tree-node[data-id]');
        if (deptNode) {
            return {
                id: parseInt(deptNode.dataset.id),
                name: deptNode.querySelector('.node-name').textContent.trim()
            };
        }
        return null;
    }

    /**
     * 創建拖放視覺回饋
     */
    function createDragGhost(empIds) {
        const ghost = document.createElement('div');
        ghost.id = 'dragGhost';
        ghost.className = 'drag-ghost';
        
        if (empIds.length === 1) {
            const empNode = document.querySelector(`[data-emp-id="${empIds[0]}"]`);
            const empName = empNode?.querySelector('.role-name')?.textContent || '員工';
            ghost.innerHTML = `
                <div class="ghost-item">
                    <i class="fas fa-user"></i>
                    <span>${empName}</span>
                </div>
            `;
        } else {
            ghost.innerHTML = `
                <div class="ghost-item multi">
                    <i class="fas fa-users"></i>
                    <span>${empIds.length} 位員工</span>
                </div>
            `;
        }
        
        document.body.appendChild(ghost);
    }

    /**
     * 移除拖放視覺回饋
     */
    function removeDragGhost() {
        const ghost = document.getElementById('dragGhost');
        if (ghost) {
            ghost.remove();
        }
    }

    /**
     * 顯示移動確認對話框
     */
    async function showMoveConfirmDialog(empIds, sourceDept, targetDeptId) {
        // 獲取部門資訊
        const targetDeptNode = document.querySelector(`[data-id="${targetDeptId}"]`);
        const targetDeptName = targetDeptNode?.querySelector('.node-name')?.textContent || '未知部門';
        
        // 獲取員工資訊
        const empNames = empIds.map(id => {
            const empNode = document.querySelector(`[data-emp-id="${id}"]`);
            return empNode?.querySelector('.role-name')?.textContent || `員工${id}`;
        });

        // 構建美化的 HTML 訊息
        const htmlMessage = `
            <div class="move-confirm-content">
                <!-- 部門移動資訊 -->
                <div class="move-info">
                    <div class="dept-transfer">
                        <i class="fas fa-exchange-alt text-primary"></i>
                           <span class="dept-name source">${sourceDept.name}</span> 
                        移動到 <span class="dept-name target">${targetDeptName}</span>
                    </div>
                </div>
                
                <!-- 員工列表 -->
                <div class="employee-list">
                    <h4><i class="fas fa-users text-info"></i> 移動員工：</h4>
                    <ul class="emp-list">
                        ${empNames.map(name => `
                            <li><i class="fas fa-user text-secondary"></i> ${name}</li>
                        `).join('')}
                    </ul>
                    ${empIds.length > 1 ? `<div class="emp-count">共 <strong>${empIds.length}</strong> 位員工</div>` : ''}
                </div>
                
                <!-- 注意事項 -->
                <div class="alert alert-warning">
                    <h4><i class="fas fa-exclamation-triangle text-warning"></i> 重要提醒：</h4>
                    <ul class="notice-list">
                        <li><i class="fas fa-times-circle text-danger"></i> 員工原本的主要角色將被移除</li>
                        <li><i class="fas fa-sync-alt text-info"></i> 系統將自動分配新部門的對應角色：</li>
                    </ul>
                    <div class="role-mapping">
                        <div class="mapping-item">
                            <i class="fas fa-user-tie text-success"></i> 
                            <span>主管</span> 
                            <i class="fas fa-arrow-right text-muted"></i> 
                            <span>新部門主管角色（如有）</span>
                        </div>
                        <div class="mapping-item">
                            <i class="fas fa-user text-primary"></i> 
                            <span>員工</span> 
                            <i class="fas fa-arrow-right text-muted"></i> 
                            <span>新部門一般角色（如有）</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        return new Promise((resolve) => {
            if (window.Dialog && window.Dialog.confirm) {
                // 使用現有 Dialog 元件的方式，啟用 HTML 模式
                window.Dialog.confirm(
                    htmlMessage,
                    () => {
                        // 確認回調 
                        resolve(true);
                    },
                    {
                        title: '確認移動員工',
                        confirmText: '確認移動',
                        cancelText: '取消',
                        allowHTML: true, // 啟用 HTML 模式
                        onCancel: () => {
                            // 取消回調
                            resolve(false);
                        }
                    }
                );
            } else {
                // 備援使用原生 confirm（純文字版本）
                const message = empIds.length === 1 
                    ? `確定要將員工「${empNames[0]}」從「${sourceDept.name}」移動到「${targetDeptName}」嗎？`
                    : `確定要將以下 ${empIds.length} 位員工從「${sourceDept.name}」移動到「${targetDeptName}」嗎？\n\n${empNames.join('\n')}`;

                const additionalInfo = '\n\n注意：\n• 員工原本的主要角色將被移除\n• 系統將自動分配新部門的對應角色\n• 主管 → 新部門主管角色（如有）\n• 員工 → 新部門一般角色（如有）';
                
                const result = confirm(message + additionalInfo);
                resolve(result);
            }
        });
    }

    /**
     * 移動員工到新部門
     */
    async function moveEmployeesToDepartment(empIds, targetDeptId) {
        console.log(`📋 開始移動 ${empIds.length} 位員工到部門 ${targetDeptId}`);
        showToast('正在移動員工...', 'info');

        const results = [];
        const errors = [];

        // 批量處理員工移動
        for (const empId of empIds) {
            try {
                console.log(`🔄 處理員工 ${empId}...`);
                const result = await moveOneEmployee(empId, targetDeptId);
                console.log(`✅ 員工 ${empId} 移動成功:`, result);
                results.push(result);
            } catch (error) {
                console.error(`❌ 移動員工 ${empId} 失敗:`, error);
                errors.push({ empId, error: error.message });
            }
        }

        // 顯示結果
        const successCount = results.length;
        const errorCount = errors.length;

        if (successCount > 0) {
            showToast(`成功移動 ${successCount} 位員工`, 'success');
        }

        if (errorCount > 0) {
            const errorMsg = errors.map(e => `員工${e.empId}: ${e.error}`).join('\n');
            showToast(`${errorCount} 位員工移動失敗:\n${errorMsg}`, 'error');
        }

        // 更新介面
        await refreshAfterMove();
        
        // 清除多選狀態
        clearMultiSelection();
    }

    /**
     * 移動單個員工
     */
    async function moveOneEmployee(empId, targetDeptId) {
        console.log(`🔍 移動員工 ${empId} 到部門 ${targetDeptId}`);
        
        // 1. 獲取員工目前資料
        console.log('1️⃣ 獲取員工資料...');
        const employeeData = await getEmployeeData(empId);
        console.log('員工資料:', employeeData);
        
        // 2. 獲取目標部門的角色列表
        console.log('2️⃣ 獲取目標部門角色列表...');
        const targetDeptRoles = await getDepartmentRoles(targetDeptId);
        console.log('目標部門角色:', targetDeptRoles);
        
        // 3. 決定新的主要角色
        console.log('3️⃣ 決定新的主要角色...');
        const newPrimaryRoleId = determineNewPrimaryRole(employeeData, targetDeptRoles);
        console.log('選擇的新主要角色ID:', newPrimaryRoleId);
        
        // 4. 更新員工資料
        const updateData = {
            department_id: targetDeptId,
            primary_role_id: newPrimaryRoleId,
            department_roles: newPrimaryRoleId ? [newPrimaryRoleId] : []
        };
        
        console.log('4️⃣ 準備更新員工資料:', updateData);
        console.log(`發送 PUT 請求到: ${API_BASE}/users/${empId}`);

        const response = await fetch(`${API_BASE}/users/${empId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(updateData)
        });

        console.log(`📡 API 回應狀態: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('❌ API 回應錯誤:', errorData);
            throw new Error(errorData.detail || `HTTP ${response.status}`);
        }

        const result = await response.json();
        console.log('✅ API 回應成功:', result);
        return result;
    }

    /**
     * 獲取員工資料
     */
    async function getEmployeeData(empId) {
        const response = await fetch(`${API_BASE}/users/${empId}`, {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`無法獲取員工 ${empId} 的資料`);
        }

        return await response.json();
    }

    /**
     * 獲取部門角色列表
     */
    async function getDepartmentRoles(deptId) {
        const response = await fetch(`${API_BASE}/departments/${deptId}/roles`, {
            credentials: 'include'
        });

        if (!response.ok) {
            console.warn(`無法獲取部門 ${deptId} 的角色列表，將返回空陣列`);
            return [];
        }

        const data = await response.json();
        return data.data || data || [];
    }

    /**
     * 決定新的主要角色
     */
    function determineNewPrimaryRole(employeeData, targetDeptRoles) {
        if (!targetDeptRoles || targetDeptRoles.length === 0) {
            console.warn('目標部門沒有可用角色');
            return null;
        }

        // 獲取員工目前的主要角色類型
        const currentPrimaryRole = employeeData.department_roles?.find(r => r.is_primary);
        const currentRoleType = currentPrimaryRole?.role_type || 'staff';

        console.log(`員工 ${employeeData.loginid} 目前角色類型: ${currentRoleType}`);

        // 依據需求的邏輯分配新角色
        let targetRole = null;

        if (currentRoleType === 'manager') {
            // 原本是主管角色 -> 優先分配新部門的主管角色
            targetRole = targetDeptRoles
                .filter(role => role.role_type === 'manager' && role.is_active)
                .sort((a, b) => (a.level || 999) - (b.level || 999))[0]; // 選最高層級的主管角色
            
            if (!targetRole) {
                // 沒有主管角色，選一般角色
                targetRole = targetDeptRoles
                    .filter(role => role.role_type === 'staff' && role.is_active)
                    .sort((a, b) => (a.level || 999) - (b.level || 999))[0];
            }
        } else {
            // 原本是員工角色 -> 優先分配新部門的一般角色
            targetRole = targetDeptRoles
                .filter(role => role.role_type === 'staff' && role.is_active)
                .sort((a, b) => (a.level || 999) - (b.level || 999))[0]; // 選最高層級的員工角色
            
            if (!targetRole) {
                // 沒有一般角色，選主管角色
                targetRole = targetDeptRoles
                    .filter(role => role.role_type === 'manager' && role.is_active)
                    .sort((a, b) => (a.level || 999) - (b.level || 999))[0];
            }
        }

        if (!targetRole) {
            // 最後備援：選第一個啟用的角色
            targetRole = targetDeptRoles.find(role => role.is_active);
        }

        console.log(`為員工 ${employeeData.loginid} 選擇新角色:`, targetRole?.name, `(類型: ${targetRole?.role_type})`);
        return targetRole?.id || null;
    }

    /**
     * 移動完成後刷新介面
     */
    async function refreshAfterMove() {
        try {
            // 1. 刷新員工樹狀結構
            if (window.OrganizationEmployeeTreeModule && window.OrganizationEmployeeTreeModule.refresh) {
                await window.OrganizationEmployeeTreeModule.refresh();
            }

            // 2. 重新載入員工數據
            if (window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.loadUsers) {
                await window.OrganizationEmployeeModule.loadUsers();
            }
            
            // 3. 刷新員工卡片（如果有選中部門的話）
            if (window.OrganizationEmployeeCardModule) {
                // 檢查是否有選中的部門
                const selectedDeptElement = document.querySelector('#employeeTreeContainer .node-content.selected');
                if (selectedDeptElement) {
                    const deptId = selectedDeptElement.dataset.deptId;
                    if (window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.loadEmployeesByDept) {
                        await window.OrganizationEmployeeModule.loadEmployeesByDept(parseInt(deptId));
                    }
                }
            }

            // 4. 重新啟用拖放功能
            setTimeout(() => {
                enableDragForEmployeeNodes();
                enableDropForDepartmentNodes();
            }, 500);

        } catch (error) {
            console.error('刷新介面失敗:', error);
        }
    }

    /**
     * 綁定鍵盤事件
     */
    function bindKeyboardEvents() {
        document.addEventListener('keydown', (event) => {
            // ESC 鍵取消多選
            if (event.key === 'Escape') {
                clearMultiSelection();
            }
            
            // Ctrl+A 全選當前部門員工
            if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
                const activeSection = document.querySelector('#employees-section.content-section.active');
                if (activeSection) {
                    event.preventDefault();
                    selectAllEmployeesInCurrentDepartment();
                }
            }
        });
    }

    /**
     * 選擇當前部門的所有員工
     */
    function selectAllEmployeesInCurrentDepartment() {
        const empNodes = document.querySelectorAll('#employeeTreeContainer .employee-tree-node');
        
        empNodes.forEach(node => {
            const empId = parseInt(node.dataset.empId);
            selectedEmployees.add(empId);
            node.classList.add('multi-selected');
        });
        
        multiSelectMode = true;
        updateMultiSelectIndicator();
    }

    /**
     * 顯示提示訊息
     */
    function showToast(message, type = 'info') {
        if (window.Dialog) {
            switch(type) {
                case 'success':
                    window.Dialog.success(message);
                    break;
                case 'error':
                    window.Dialog.error(message);
                    break;
                case 'warning':
                    window.Dialog.warning(message);
                    break;
                case 'info':
                default:
                    window.Dialog.info(message);
                    break;
            }
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }

    // 公開 API
    return {
        init,
        enableDragForEmployeeNodes,
        enableDropForDepartmentNodes,
        clearMultiSelection,
        refreshAfterMove
    };
})();

// 註冊到全域
window.OrganizationEmployeeDragModule = window.OrganizationEmployeeDragModule;