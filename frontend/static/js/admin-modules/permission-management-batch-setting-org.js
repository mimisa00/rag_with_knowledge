/**
 * 權限管理批次組織設定模組
 * 處理權限群組的批次組織角色指派功能
 */
const PermissionBatchOrgModule = (function() {
    'use strict';
    
    // API 端點
    const API_BASE = '/api/permissions';
    const ORG_API_BASE = '/api/organization';
    const ENDPOINTS = {
        groups: `${API_BASE}/groups`,
        batchAssign: `${API_BASE}/groups`,
        departmentRolesTree: `${ORG_API_BASE}/department-roles-tree`,
        departments: `${ORG_API_BASE}/departments`
    };
    
    // 模組狀態
    let currentGroupId = null;
    let currentGroupName = '';
    let orgTreeData = [];
    let selectedRoles = new Set(); // 選中的角色ID集合
    let existingRoles = new Set(); // 已設定權限的角色ID集合
    let nodeExpandedStates = new Map(); // 每個節點的展開狀態
    let filteredOrgTreeData = []; // 搜尋過濾後的樹資料
    
    /**
     * 顯示批次組織設定模態框
     */
    async function showBatchOrgModal(groupId) {
        try {
            // 重置狀態
            currentGroupId = groupId;
            selectedRoles.clear();
            existingRoles.clear();
            
            // 從 PermissionModule 獲取群組資訊
            const group = await getGroupInfo(groupId);
            if (!group) {
                showError('找不到指定的權限群組');
                return;
            }
            
            currentGroupName = group.name;
            
            // 更新模態框標題和群組名稱
            document.getElementById('batchOrgGroupName').textContent = currentGroupName;
            
            // 顯示模態框
            const modal = document.getElementById('batchOrgModal');
            if (modal) {
                modal.classList.add('show');
            }
            
            // 載入組織樹資料
            await loadOrgTreeData();
            
        } catch (error) {
            console.error('顯示批次組織設定模態框失敗:', error);
            showError('載入組織資料失敗：' + error.message);
        }
    }
    
    /**
     * 關閉批次組織設定模態框
     */
    function closeBatchOrgModal() {
        const modal = document.getElementById('batchOrgModal');
        if (modal) {
            modal.classList.remove('show');
        }
        
        // 重置狀態
        currentGroupId = null;
        currentGroupName = '';
        selectedRoles.clear();
        existingRoles.clear();
        orgTreeData = [];
        filteredOrgTreeData = [];
        nodeExpandedStates.clear();
        
        // 清除搜尋欄位
        const searchInput = document.getElementById('batchOrgTreeSearch');
        if (searchInput) {
            searchInput.value = '';
        }
    }
    
    /**
     * 獲取群組資訊
     */
    async function getGroupInfo(groupId) {
        try {
            // 先嘗試從 PermissionModule 的 allGroups 獲取
            if (window.PermissionModule && window.PermissionModule.allGroups) {
                const group = window.PermissionModule.allGroups.find(g => g.id == groupId);
                if (group) return group;
            }
            
            // 如果無法從主模組獲取，直接調用 API
            const response = await fetch(`${ENDPOINTS.groups}/${groupId}`, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('獲取群組資訊失敗:', error);
            return null;
        }
    }
    
    /**
     * 載入組織樹資料
     */
    async function loadOrgTreeData() {
        try {
            showLoadingState();
            
            // 載入部門角色樹和現有權限設定
            const [treeResponse, existingResponse] = await Promise.all([
                fetch(`${ENDPOINTS.departments}?tree=true&include_roles=true`, {
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' }
                }),
                fetch(`${ENDPOINTS.groups}/${currentGroupId}/department-roles`, {
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' }
                }).catch(() => ({ json: async () => [] })) // 如果 API 不存在，返回空陣列
            ]);
            
            if (!treeResponse.ok) {
                throw new Error(`載入組織樹失敗: ${treeResponse.status}`);
            }
            
            const treeData = await treeResponse.json();
            orgTreeData = Array.isArray(treeData) ? treeData : (treeData.data || []);
            
            // 檢查是否有角色資料
            let totalRolesCount = 0;
            function countRolesInTree(nodes) {
                nodes.forEach(node => {
                    if (node.roles && Array.isArray(node.roles)) {
                        totalRolesCount += node.roles.length;
                    }
                    if (node.children) {
                        countRolesInTree(node.children);
                    }
                });
            }
            countRolesInTree(orgTreeData);
            console.log('批次組織設定 - 載入了', totalRolesCount, '個角色');
            
            // 載入已存在的權限設定（如果 API 可用）
            if (existingResponse.ok || existingResponse.json) {
                const existingData = await existingResponse.json();
                if (Array.isArray(existingData)) {
                    existingData.forEach(role => {
                        existingRoles.add(role.id);
                        selectedRoles.add(role.id); // 自動勾選已存在權限的角色
                    });
                    console.log('已存在權限的角色數量:', existingData.length);
                }
            }
            
            // 渲染組織樹
            renderOrgTree();
            updateStatistics();
            
        } catch (error) {
            console.error('載入組織樹資料失敗:', error);
            showError('載入組織資料失敗：' + error.message);
        } finally {
            hideLoadingState();
        }
    }
    
    /**
     * 渲染組織樹
     */
    function renderOrgTree() {
        const container = document.getElementById('batchOrgTreeContainer');
        if (!container) return;
        
        // 決定使用哪個資料源：過濾後的或原始的
        const dataToRender = filteredOrgTreeData.length > 0 ? filteredOrgTreeData : orgTreeData;
        
        if (dataToRender.length === 0) {
            const searchInput = document.getElementById('batchOrgTreeSearch');
            const isSearching = searchInput && searchInput.value.trim();
            
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-${isSearching ? 'search' : 'sitemap'}"></i>
                    <h3>${isSearching ? '無符合的搜尋結果' : '尚無組織資料'}</h3>
                    <p>${isSearching ? '請嘗試其他關鍵字' : '請先建立部門和角色'}</p>
                </div>
            `;
            return;
        }
        
        // 建立樹狀結構 HTML
        const treeHTML = buildTreeHTML(dataToRender, 0);
        console.log('生成的樹狀結構 HTML 長度:', treeHTML.length);
        container.innerHTML = `<div class="org-tree">${treeHTML}</div>`;
        
        // 檢查渲染結果
        const renderedRoleNodes = container.querySelectorAll('.role-node');
        const renderedDeptNodes = container.querySelectorAll('.dept-node');
        console.log(`渲染完成 - 部門節點: ${renderedDeptNodes.length}, 角色節點: ${renderedRoleNodes.length}`);
        
        // 列出所有角色節點
        renderedRoleNodes.forEach((node, index) => {
            const roleId = node.getAttribute('data-role-id');
            const roleName = node.querySelector('.role-name')?.textContent || '未知';
            const checkbox = node.querySelector('input[type="checkbox"]');
            console.log(`角色節點 ${index + 1}: ${roleName} (ID: ${roleId}), checkbox存在: ${!!checkbox}`);
        });
        
        // 綁定事件
        bindTreeEvents();
        
        // 預設收合第二層以下節點 (採用員工樹模式)
        collapseSecondLevelNodes();
    }
    
    /**
     * 預設收合第二層以下節點 (仿照員工樹)
     */
    function collapseSecondLevelNodes() {
        setTimeout(() => {
            // 只收合 level > 0 的部門節點，但保持第一層部門展開以顯示角色
            document.querySelectorAll('.org-tree .dept-node').forEach(deptNode => {
                const nodeContent = deptNode.querySelector('.node-content');
                const level = parseInt(nodeContent?.getAttribute('data-level') || '0');
                
                // 只收合第二層以下的部門（level > 0），保持第一層展開
                if (level > 0) {
                    const childrenContainer = deptNode.querySelector('.node-children');
                    const toggle = deptNode.querySelector('.node-toggle i');
                    
                    if (childrenContainer) {
                        childrenContainer.style.display = 'none';
                    }
                    if (toggle) {
                        toggle.className = 'fas fa-chevron-right';
                    }
                    
                    // 更新狀態
                    const deptId = deptNode.getAttribute('data-dept-id');
                    if (deptId) {
                        nodeExpandedStates.set(`dept_${deptId}`, false);
                    }
                }
            });
        }, 100); // 短暫延遲確保 DOM 已渲染
    }
    
    /**
     * 建立樹狀結構 HTML (採用員工樹結構)
     */
    function buildTreeHTML(nodes, level = 0) {
        return nodes.map(node => {
            const hasChildren = node.children && node.children.length > 0;
            const hasRoles = node.roles && node.roles.length > 0;
            
            // 檢查節點是否應該展開
            const nodeKey = `dept_${node.id}`;
            const isNodeExpanded = nodeExpandedStates.get(nodeKey) !== false; // 預設展開
            
            // 只顯示啟用的角色（處理不同的 is_active 格式）
            const activeRoles = hasRoles ? node.roles.filter(r => 
                r.is_active === true || r.is_active === 1 || r.is_active === '1' || r.is_active == null
            ) : [];
            
            // 如果部門沒有可選角色且沒有子部門，則不顯示
            if (activeRoles.length === 0 && !hasChildren) {
                return '';
            }

            let html = `
                <div class="tree-node dept-node" data-dept-id="${node.id}">
                    <div class="node-content" data-level="${level}" 
                         style="padding-left: ${level * 24}px; ${hasChildren || activeRoles.length > 0 ? 'cursor: pointer;' : ''}"
                         ${hasChildren || activeRoles.length > 0 ? `onclick="PermissionBatchOrgModule.toggleNode(this)"` : ''}>
                        ${hasChildren || activeRoles.length > 0 ? `
                            <span class="node-toggle">
                                <i class="fas fa-chevron-${isNodeExpanded ? 'down' : 'right'}"></i>
                            </span>
                        ` : '<span class="node-spacer" style="width: 16px; display: inline-block;"></span>'}
                        <i class="fas fa-folder text-primary"></i>
                        <span class="node-name">${node.name}</span>
                        ${node.code ? `<span class="node-badge">${node.code}</span>` : ''}
                    </div>
                    <div class="node-children" id="dept-children-${node.id}" ${!isNodeExpanded ? 'style="display: none;"' : ''}>
            `;

            // 添加角色節點
            if (activeRoles.length > 0) {
                console.log(`正在為部門 ${node.name} 渲染 ${activeRoles.length} 個角色`);
                
                // 對角色進行排序：管理角色優先 > 等級優先 > 名稱排序
                activeRoles.sort((a, b) => {
                    // 1. 管理角色優先
                    if (a.role_type === 'manager' && b.role_type !== 'manager') return -1;
                    if (a.role_type !== 'manager' && b.role_type === 'manager') return 1;
                    
                    // 2. 等級優先（數字越小越高）
                    const levelA = a.level != null ? a.level : 999;
                    const levelB = b.level != null ? b.level : 999;
                    if (levelA !== levelB) return levelA - levelB;
                    
                    // 3. 名稱排序
                    return (a.name || '').localeCompare(b.name || '', 'zh-TW');
                });
                
                activeRoles.forEach(role => {
                    const isSelected = selectedRoles.has(role.id);
                    const isExisting = existingRoles.has(role.id);
                    const roleIcon = role.role_type === 'manager' ? 'user-tie' : 'user';
                    const roleClass = role.role_type === 'manager' ? 'text-warning' : 'text-primary';

                    const roleHTML = `
                        <div class="tree-node role-node" data-role-id="${role.id}">
                            <div class="node-content" data-level="${level + 1}" 
                                 onclick="PermissionBatchOrgModule.toggleRoleByRow(${role.id})"
                                 style="padding-left: ${(level + 1) * 24}px; cursor: pointer;">
                                <input type="checkbox" class="form-check-input" 
                                       id="role-${role.id}" value="${role.id}" 
                                       ${isSelected || isExisting ? 'checked' : ''}
                                       onclick="event.stopPropagation()"
                                       onchange="PermissionBatchOrgModule.onRoleSelectionChange(this)">
                                <label for="role-${role.id}" class="form-check-label ms-2" 
                                       onclick="event.stopPropagation()">
                                    <i class="fas fa-${roleIcon} ${roleClass}"></i>
                                    <span class="role-name">${role.name}</span>
                                    ${role.code ? `<span class="node-badge">${role.code}</span>` : ''}
                                </label>
                            </div>
                        </div>
                    `;
                    console.log(`角色 ${role.name} HTML:`, roleHTML.substring(0, 100) + '...');
                    html += roleHTML;
                });
            } else {
                console.log(`部門 ${node.name} 沒有角色需要顯示`);
            }

            // 遞歸處理子部門
            if (hasChildren) {
                html += buildTreeHTML(node.children, level + 1);
            }

            html += '</div></div>';
            return html;
        }).join('');
    }
    
    /**
     * 綁定樹狀結構事件
     */
    function bindTreeEvents() {
        // 綁定搜尋輸入框事件
        const searchInput = document.getElementById('batchOrgTreeSearch');
        if (searchInput) {
            // 移除之前的事件監聽器
            searchInput.removeEventListener('input', handleSearchInput);
            searchInput.removeEventListener('keyup', handleSearchKeyup);
            
            // 綁定新的事件監聽器
            searchInput.addEventListener('input', handleSearchInput);
            searchInput.addEventListener('keyup', handleSearchKeyup);
        }
    }
    
    /**
     * 處理搜尋輸入
     */
    function handleSearchInput(event) {
        // 防抖處理，避免頻繁搜尋
        clearTimeout(window.searchTimeout);
        window.searchTimeout = setTimeout(() => {
            searchOrgTree();
        }, 300);
    }
    
    /**
     * 處理搜尋按鍵事件
     */
    function handleSearchKeyup(event) {
        if (event.key === 'Enter') {
            clearTimeout(window.searchTimeout);
            searchOrgTree();
        } else if (event.key === 'Escape') {
            event.target.value = '';
            clearTimeout(window.searchTimeout);
            searchOrgTree();
        }
    }
    
    /**
     * 切換節點展開/收合 (採用員工樹模式)
     */
    function toggleNode(nodeContentElement) {
        // 找到對應的部門 ID
        const deptNode = nodeContentElement.closest('.tree-node.dept-node');
        if (!deptNode) return;
        
        const deptId = deptNode.getAttribute('data-dept-id');
        const nodeKey = `dept_${deptId}`;
        
        // 切換展開狀態
        const isCurrentlyExpanded = nodeExpandedStates.get(nodeKey) !== false;
        nodeExpandedStates.set(nodeKey, !isCurrentlyExpanded);
        
        // 找到子節點容器和切換圖示
        const childrenContainer = deptNode.querySelector('.node-children');
        const toggleIcon = nodeContentElement.querySelector('.node-toggle i');
        
        if (childrenContainer && toggleIcon) {
            if (isCurrentlyExpanded) {
                // 收合
                childrenContainer.style.display = 'none';
                toggleIcon.className = 'fas fa-chevron-right';
            } else {
                // 展開
                childrenContainer.style.display = 'block';
                toggleIcon.className = 'fas fa-chevron-down';
            }
        }
    }
    
    /**
     * 點擊角色整行切換選擇 (仿照員工樹)
     */
    function toggleRoleByRow(roleId) {
        const checkbox = document.getElementById(`role-${roleId}`);
        if (checkbox) {
            checkbox.checked = !checkbox.checked;
            // 觸發變更事件
            onRoleSelectionChange(checkbox);
        }
    }
    
    /**
     * 角色選擇變更處理
     */
    function onRoleSelectionChange(checkbox) {
        const roleId = parseInt(checkbox.value);
        
        if (checkbox.checked) {
            selectedRoles.add(roleId);
        } else {
            selectedRoles.delete(roleId);
        }
        
        updateStatistics();
    }
    
    /**
     * 更新統計資訊
     */
    function updateStatistics() {
        // 計算總可選角色數
        let totalRoles = 0;
        function countRoles(nodes) {
            nodes.forEach(node => {
                if (node.roles) {
                    totalRoles += node.roles.length;
                }
                if (node.children) {
                    countRoles(node.children);
                }
            });
        }
        countRoles(orgTreeData);
        
        // 更新顯示
        const totalCount = document.getElementById('totalOrgRolesCount');
        const selectedCount = document.getElementById('selectedOrgRolesCount');
        const existingCount = document.getElementById('existingOrgRolesCount');
        
        if (totalCount) totalCount.textContent = totalRoles;
        if (selectedCount) selectedCount.textContent = selectedRoles.size;
        if (existingCount) existingCount.textContent = existingRoles.size;
    }
    
    /**
     * 展開全部 (採用員工樹模式)
     */
    function expandAll() {
        // 設定所有節點為展開狀態
        function setAllExpanded(nodes) {
            nodes.forEach(node => {
                const nodeKey = `dept_${node.id}`;
                nodeExpandedStates.set(nodeKey, true);
                
                // 直接操作 DOM
                const childrenContainer = document.getElementById(`dept-children-${node.id}`);
                const deptNode = document.querySelector(`[data-dept-id="${node.id}"]`);
                if (childrenContainer && deptNode) {
                    childrenContainer.style.display = 'block';
                    const toggleIcon = deptNode.querySelector('.node-toggle i');
                    if (toggleIcon) {
                        toggleIcon.className = 'fas fa-chevron-down';
                    }
                }
                
                if (node.children) {
                    setAllExpanded(node.children);
                }
            });
        }
        setAllExpanded(orgTreeData);
    }
    
    /**
     * 收合全部 (採用員工樹模式)
     */
    function collapseAll() {
        // 設定所有節點為收合狀態
        function setAllCollapsed(nodes) {
            nodes.forEach(node => {
                const nodeKey = `dept_${node.id}`;
                nodeExpandedStates.set(nodeKey, false);
                
                // 直接操作 DOM
                const childrenContainer = document.getElementById(`dept-children-${node.id}`);
                const deptNode = document.querySelector(`[data-dept-id="${node.id}"]`);
                if (childrenContainer && deptNode) {
                    childrenContainer.style.display = 'none';
                    const toggleIcon = deptNode.querySelector('.node-toggle i');
                    if (toggleIcon) {
                        toggleIcon.className = 'fas fa-chevron-right';
                    }
                }
                
                if (node.children) {
                    setAllCollapsed(node.children);
                }
            });
        }
        setAllCollapsed(orgTreeData);
    }
    
    /**
     * 清除選擇
     */
    function clearSelection() {
        selectedRoles.clear();
        updateStatistics();
        
        // 取消所有角色 checkbox 的勾選
        document.querySelectorAll('.role-node input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = false;
        });
    }
    
    /**
     * 全選
     */
    function selectAll() {
        // 清除現有選擇
        selectedRoles.clear();
        
        // 獲取所有可見的角色 checkbox 並選中
        document.querySelectorAll('.role-node input[type="checkbox"]').forEach(checkbox => {
            const roleId = parseInt(checkbox.value);
            selectedRoles.add(roleId);
            checkbox.checked = true;
        });
        
        updateStatistics();
    }
    
    /**
     * 搜尋組織樹
     */
    function searchOrgTree() {
        const searchInput = document.getElementById('batchOrgTreeSearch');
        if (!searchInput) return;
        
        const keyword = searchInput.value.trim().toLowerCase();
        
        // 如果沒有關鍵字，顯示全部
        if (!keyword) {
            filteredOrgTreeData = [];
            renderOrgTree();
            return;
        }
        
        // 搜尋並過濾節點
        filteredOrgTreeData = filterTreeByKeyword(orgTreeData, keyword);
        renderOrgTree();
    }
    
    /**
     * 根據關鍵字過濾樹狀結構
     */
    function filterTreeByKeyword(nodes, keyword) {
        const filteredNodes = [];
        
        nodes.forEach(node => {
            let nodeMatches = false;
            let filteredNode = { ...node };
            
            // 檢查部門名稱是否符合
            if (node.name && node.name.toLowerCase().includes(keyword)) {
                nodeMatches = true;
            }
            
            // 檢查部門代碼是否符合
            if (node.code && node.code.toLowerCase().includes(keyword)) {
                nodeMatches = true;
            }
            
            // 過濾角色
            let matchedRoles = [];
            if (node.roles) {
                matchedRoles = node.roles.filter(role => 
                    (role.name && role.name.toLowerCase().includes(keyword)) ||
                    (role.code && role.code.toLowerCase().includes(keyword))
                );
                if (matchedRoles.length > 0) {
                    nodeMatches = true;
                    filteredNode.roles = matchedRoles;
                }
            }
            
            // 遞歸處理子節點
            let filteredChildren = [];
            if (node.children) {
                filteredChildren = filterTreeByKeyword(node.children, keyword);
                if (filteredChildren.length > 0) {
                    nodeMatches = true;
                    filteredNode.children = filteredChildren;
                }
            }
            
            // 如果節點符合條件，加入結果
            if (nodeMatches) {
                // 搜尋時自動展開符合的節點
                const nodeKey = `dept_${node.id}`;
                nodeExpandedStates.set(nodeKey, true);
                filteredNodes.push(filteredNode);
            }
        });
        
        return filteredNodes;
    }
    
    /**
     * 確認批次組織設定
     */
    async function confirmBatchOrgSettings() {
        const selectedRoleIds = Array.from(selectedRoles);
        
        // 根據是否有選中角色來決定確認訊息
        let confirmMessage;
        if (selectedRoleIds.length === 0) {
            confirmMessage = `確定要清除權限群組「${currentGroupName}」對所有角色的權限嗎？\n此操作會移除該群組對所有角色的權限設定。`;
        } else {
            confirmMessage = `確定要同步權限群組「${currentGroupName}」的角色設定嗎？\n選中的角色將獲得權限，未選中的將移除權限。共 ${selectedRoleIds.length} 個角色被選中。`;
        }
        
        if (window.Dialog && Dialog.confirm) {
            Dialog.confirm(confirmMessage, async () => {
                await executeBatchAssignment(selectedRoleIds);
            });
        } else {
            if (confirm(confirmMessage)) {
                await executeBatchAssignment(selectedRoleIds);
            }
        }
    }
    
    /**
     * 執行批次指派（同步模式）
     */
    async function executeBatchAssignment(roleIds) {
        try {
            // 1. 先獲取所有現有的角色權限
            const existingResponse = await fetch(`${ENDPOINTS.groups}/${currentGroupId}/department-roles`, {
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
            });
            
            let existingRoleIds = [];
            if (existingResponse.ok) {
                const existingData = await existingResponse.json();
                existingRoleIds = existingData.map(role => role.id);
            }
            
            // 2. 計算需要移除和新增的角色
            const toRemove = existingRoleIds.filter(id => !roleIds.includes(id));
            const toAdd = roleIds.filter(id => !existingRoleIds.includes(id));
            
            // 3. 先移除不需要的角色
            if (toRemove.length > 0) {
                const removeResponse = await fetch(`${ENDPOINTS.groups}/${currentGroupId}/batch-assign`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        department_role_ids: toRemove,
                        action: 'remove'
                    })
                });
                
                if (!removeResponse.ok) {
                    const errorData = await removeResponse.json().catch(() => ({}));
                    throw new Error(`移除權限失敗: ${errorData.detail || removeResponse.status}`);
                }
            }
            
            // 4. 再新增需要的角色
            if (toAdd.length > 0) {
                const addResponse = await fetch(`${ENDPOINTS.groups}/${currentGroupId}/batch-assign`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        department_role_ids: toAdd,
                        action: 'assign'
                    })
                });
                
                if (!addResponse.ok) {
                    const errorData = await addResponse.json().catch(() => ({}));
                    throw new Error(`新增權限失敗: ${errorData.detail || addResponse.status}`);
                }
            }
            
            showSuccess(`成功同步權限群組設定，共 ${roleIds.length} 個角色`);
            
            // 更新主頁面群組列表中的使用部門數字
            await updateGroupDepartmentCount();
            
            closeBatchOrgModal();
            
        } catch (error) {
            console.error('批次指派失敗:', error);
            showError('批次指派失敗：' + error.message);
        }
    }
    
    /**
     * 顯示載入狀態
     */
    function showLoadingState() {
        const container = document.getElementById('batchOrgTreeContainer');
        if (container) {
            container.innerHTML = `
                <div class="loading-spinner">
                    <div class="spinner"></div>
                    <p>載入組織資料中...</p>
                </div>
            `;
        }
    }
    
    /**
     * 隱藏載入狀態
     */
    function hideLoadingState() {
        // 載入狀態會在渲染樹時被覆蓋
    }
    
    /**
     * 顯示錯誤訊息
     */
    function showError(message) {
        if (window.Dialog && Dialog.error) {
            Dialog.error(message);
        } else {
            alert('錯誤：' + message);
        }
    }
    
    /**
     * 顯示成功訊息
     */
    function showSuccess(message) {
        if (window.Dialog && Dialog.success) {
            Dialog.success(message);
        } else {
            alert('成功：' + message);
        }
    }
    
    /**
     * 更新主頁面群組列表中的使用部門數字
     */
    async function updateGroupDepartmentCount() {
        try {
            if (!currentGroupId) return;
            
            // 調用單一群組API取得最新的統計資料
            const response = await fetch(`${ENDPOINTS.groups}/${currentGroupId}`, {
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                const groupData = await response.json();
                
                // 通知主模組更新該群組的資料
                if (window.PermissionModule && typeof window.PermissionModule.updateSingleGroup === 'function') {
                    await window.PermissionModule.updateSingleGroup(groupData);
                    console.log('已更新群組', groupData.name, '的使用部門數量:', groupData.department_count);
                }
            } else {
                console.warn('無法獲取群組最新資料:', response.status);
            }
        } catch (error) {
            console.error('更新群組部門統計失敗:', error);
        }
    }
    
    // 公開 API
    return {
        showBatchOrgModal: showBatchOrgModal,
        closeBatchOrgModal: closeBatchOrgModal,
        toggleNode: toggleNode,
        toggleRoleByRow: toggleRoleByRow,
        onRoleSelectionChange: onRoleSelectionChange,
        expandAll: expandAll,
        collapseAll: collapseAll,
        clearSelection: clearSelection,
        selectAll: selectAll,
        searchOrgTree: searchOrgTree,
        confirmBatchOrgSettings: confirmBatchOrgSettings
    };
})();

// 確保模組可被全域存取
window.PermissionBatchOrgModule = PermissionBatchOrgModule;