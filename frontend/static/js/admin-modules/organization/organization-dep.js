/**
 * 組織管理 - 部門管理模組
 * 處理部門的 CRUD 操作、樹狀結構管理、拖曳排序等功能
 */
const OrganizationDepartmentModule = (function() {
    'use strict';
    
    // API 端點
    const API_BASE = '/api/organization';
    const ENDPOINTS = {
        departments: `${API_BASE}/departments`,
    };
    
    // 數據存儲
    let allDepartments = [];  // 儲存所有部門（包含停用）
    let departments = [];      // 顯示用的部門列表
    let showInactiveDepts = false;  // 是否顯示停用部門
    let selectedDepartmentId = null; // 當前選中的部門ID
    
    /**
     * 初始化模組
     */
    async function init() {
        // OrganizationDepartmentModule 初始化開始
        
        // 綁定事件
        bindButtonEvents();
        bindModalEvents();
        bindFormEvents();
        
        // 初始化滾動條淡出淡入效果
        if (window.CommonUI && CommonUI.initScrollFadeEffect) {
            CommonUI.initScrollFadeEffect();
        }
        
        // 載入初始數據
        await loadDepartments();
        
        // OrganizationDepartmentModule 初始化完成
    }
    
    /**
     * 載入部門數據
     */
    async function loadDepartments() {
        try {
            // 開始載入部門數據...
            const response = await fetch(ENDPOINTS.departments, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            // API 回應
            
            // 處理不同的回應格式
            let rawDepartments = Array.isArray(data) ? data : (data.data || []);
            
            // 確保每個部門都有必要的欄位並標準化數據類型
            allDepartments = rawDepartments.map(dept => ({
                id: Number(dept.id),
                name: dept.name || '未命名部門',
                code: dept.code || '',
                parent_id: dept.parent_id ? Number(dept.parent_id) : null,
                description: dept.description || '',
                user_count: Number(dept.user_count || 0),
                is_active: dept.is_active === true || dept.is_active === 1,
                sort_order: Number(dept.sort_order || 0),
                created_at: dept.created_at,
                updated_at: dept.updated_at
            }));
            
            // 處理後的所有部門數據
            
            // 根據開關過濾部門
            filterDepartments();
        } catch (error) {
            console.error('載入部門數據失敗:', error);
            // 使用模擬數據...
            
            // 使用模擬數據作為後備
            allDepartments = [
                { id: 1, name: '總經理室', code: 'CEO', parent_id: null, description: '公司最高管理層', user_count: 5, is_active: true, sort_order: 1 },
                { id: 2, name: '技術部', code: 'TECH', parent_id: 1, description: '負責技術研發', user_count: 20, is_active: true, sort_order: 2 },
                { id: 3, name: '前端組', code: 'FE', parent_id: 2, description: '前端開發', user_count: 8, is_active: true, sort_order: 1 },
                { id: 4, name: '後端組', code: 'BE', parent_id: 2, description: '後端開發', user_count: 12, is_active: true, sort_order: 2 },
                { id: 5, name: '業務部', code: 'SALES', parent_id: 1, description: '負責業務推廣', user_count: 15, is_active: false, sort_order: 3 },
                { id: 6, name: '人資部', code: 'HR', parent_id: 1, description: '人力資源管理', user_count: 3, is_active: true, sort_order: 4 }
            ];
            filterDepartments();
        }
    }
    
    /**
     * 過濾部門
     */
    function filterDepartments() {
        if (showInactiveDepts) {
            departments = [...allDepartments];
        } else {
            departments = allDepartments.filter(dept => dept.is_active);
        }
        
        // 過濾後的部門數量
        
        // 更新統計
        updateDepartmentStats();
        
        // 重新渲染樹狀結構
        renderDepartmentTree();
        
        // 如果有選中的部門，重新顯示其詳情（保持選中狀態）
        if (selectedDepartmentId) {
            showDepartmentDetails(selectedDepartmentId);
        }
    }
    
    /**
     * 更新部門統計
     */
    function updateDepartmentStats() {
        const activeDepts = allDepartments.filter(d => d.is_active).length;
        const inactiveDepts = allDepartments.filter(d => !d.is_active).length;
        
        const totalCount = document.getElementById('totalDeptCount');
        const activeCount = document.querySelector('#activeDeptCount strong');
        const inactiveCount = document.querySelector('#inactiveDeptCount strong');
        
        if (totalCount) totalCount.textContent = allDepartments.length;
        if (activeCount) activeCount.textContent = activeDepts;
        if (inactiveCount) inactiveCount.textContent = inactiveDepts;
        
        // 更新概覽卡片的統計
        const deptCount = document.querySelector('#departmentCount span');
        if (deptCount) {
            deptCount.textContent = departments.length;
        }
    }
    
    /**
     * 切換顯示停用部門
     */
    function toggleInactiveDepts() {
        // 使用新的眼睛圖標按鈕切換
        const toggleBtn = document.getElementById('toggleInactiveBtn');
        if (toggleBtn) {
            // 切換狀態
            showInactiveDepts = !showInactiveDepts;
            
            // 更新按鈕圖標和樣式
            const icon = toggleBtn.querySelector('i');
            if (showInactiveDepts) {
                toggleBtn.classList.add('active');
                icon.className = 'fas fa-eye';
                toggleBtn.title = '隱藏停用';
            } else {
                toggleBtn.classList.remove('active');
                icon.className = 'fas fa-eye-slash';
                toggleBtn.title = '顯示停用';
            }
        } else {
            // 向後兼容：如果還有舊的 checkbox
            const checkbox = document.getElementById('showInactiveDepts');
            showInactiveDepts = checkbox ? checkbox.checked : false;
        }
        
        filterDepartments();
    }
    
    /**
     * 渲染部門樹狀結構
     */
    function renderDepartmentTree() {
        const container = document.getElementById('departmentTree');
        if (!container) {
            console.error('部門樹狀結構容器不存在');
            return;
        }
        
        // 開始渲染部門樹
        
        if (departments.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-sitemap"></i>
                    <h3>尚無部門資料</h3>
                    <p>點擊「新增部門」開始建立組織架構</p>
                </div>
            `;
            return;
        }
        
        // 構建樹狀結構
        const tree = buildTree(departments);
        // 樹狀結構構建完成
        
        // 如果沒有根節點，顯示平面列表
        if (tree.length === 0) {
            // 沒有根節點，顯示平面列表
            container.innerHTML = `
                <div class="tree-node root-drop-zone" data-id="root" data-level="-1">
                    <div class="node-content" style="border: 2px dashed #ccc; background: #f9f9f9;">
                        <i class="fas fa-layer-group" style="margin-right: 0.5rem;"></i>
                        <span style="color: #999;">拖曳到此處移至頂層</span>
                    </div>
                </div>
                <div class="tree-scrollable-content scrollable-fade">
                    ${renderFlatList(departments)}
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="tree-node root-drop-zone" data-id="root" data-level="-1">
                    <div class="node-content" style="border: 2px dashed #ccc; background: #f9f9f9;">
                        <i class="fas fa-layer-group" style="margin-right: 0.5rem;"></i>
                        <span style="color: #999;">拖曳到此處移至頂層</span>
                    </div>
                </div>
                <div class="tree-scrollable-content scrollable-fade">
                    ${renderTreeNodes(tree)}
                </div>
            `;
        }
        
        // 綁定展開/收合事件
        bindTreeEvents();
        
        // 初始化 scrollbar 淡入淡出效果
        if (window.CommonUI && CommonUI.initScrollFadeEffect) {
            CommonUI.initScrollFadeEffect();
        }
    }
    
    /**
     * 構建樹狀結構
     */
    function buildTree(items, parentId = null) {
        return items
            .filter(item => {
                // 處理 null 值的特殊情況
                if (parentId === null || parentId === undefined) {
                    return item.parent_id === null || item.parent_id === undefined || item.parent_id === 0;
                }
                // 確保數字比較（轉換為數字後比較）
                return Number(item.parent_id) === Number(parentId);
            })
            .map(item => ({
                ...item,
                children: buildTree(items, item.id)
            }));
    }
    
    /**
     * 渲染樹節點
     */
    function renderTreeNodes(nodes, level = 0, expandFirstLevel = true) {
        if (!nodes || nodes.length === 0) return '';
        
        return nodes.map(node => {
            const hasChildren = node.children && node.children.length > 0;
            // 只展開第一層（根節點的直接子節點）
            const shouldExpand = expandFirstLevel && level === 0 && hasChildren;
            
            return `
                <div class="tree-node ${!node.is_active ? 'inactive' : ''}" data-id="${node.id}" data-level="${level}" draggable="true">
                    <div class="node-content" style="padding-left: ${level * 20}px">
                        <span class="drag-handle" title="拖曳以移動部門">
                            <i class="fas fa-grip-vertical"></i>
                        </span>
                        <span class="node-toggle ${hasChildren ? '' : 'invisible'}" data-node-id="${node.id}">
                            <i class="fas fa-chevron-${shouldExpand ? 'down' : 'right'}"></i>
                        </span>
                        <span class="node-icon">
                            <i class="fas fa-${hasChildren ? 'folder' : 'file'}"></i>
                        </span>
                        <span class="node-name">${node.name || '未命名'}${!node.is_active ? ' (停用)' : ''}</span>
                        <span class="node-actions">
                        <button class="btn-icon" onclick="OrganizationDepartmentModule.editDepartment(${node.id})" title="編輯">
                        <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon ${!node.is_active ? 'disabled' : ''}" ${node.is_active ? `onclick="OrganizationDepartmentModule.deleteDepartment(${node.id})"` : ''} title="刪除">
                        <i class="fas fa-trash"></i>
                        </button>
                        </span>
                        <span class="node-count" data-dept-id="${node.id}" title="點擊查看員工詳情">(${node.user_count || 0})</span>
                    </div>
                    ${hasChildren ? `
                        <div class="tree-children${shouldExpand ? ' expanded' : ''}" data-parent-id="${node.id}">
                            ${renderTreeNodes(node.children, level + 1, false)}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }
    
    /**
     * 渲染平面列表（當沒有樹狀結構時使用）
     */
    function renderFlatList(items) {
        return items.map(item => `
            <div class="tree-node" data-id="${item.id}" data-level="0" draggable="true">
                <div class="node-content">
                    <span class="drag-handle" title="拖曳以移動部門">
                        <i class="fas fa-grip-vertical"></i>
                    </span>
                    <span class="node-icon">
                        <i class="fas fa-folder"></i>
                    </span>
                    <span class="node-name">${item.name || '未命名'}</span>
                    <span class="node-count" data-dept-id="${item.id}" title="點擊查看員工詳情">(${item.user_count || 0})</span>
                    <span class="node-actions">
                        <button class="btn-icon" onclick="OrganizationDepartmentModule.editDepartment(${item.id})" title="編輯">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon ${!item.is_active ? 'disabled' : ''}" ${item.is_active ? `onclick="OrganizationDepartmentModule.deleteDepartment(${item.id})"` : ''} title="刪除">
                            <i class="fas fa-trash"></i>
                        </button>
                    </span>
                </div>
            </div>
        `).join('');
    }
    
    /**
     * 顯示載入狀態
     */
    function showLoadingState() {
        document.querySelectorAll('.loading-spinner').forEach(spinner => {
            spinner.style.display = 'flex';
        });
    }
    
    /**
     * 隱藏載入狀態
     */
    function hideLoadingState() {
        document.querySelectorAll('.loading-spinner').forEach(spinner => {
            spinner.style.display = 'none';
        });
    }
    
    /**
     * 顯示錯誤訊息
     */
    function showError(message) {
        if (window.Dialog) {
            Dialog.error(message);
        } else {
            alert(message);
        }
    }
    
    /**
     * 顯示成功訊息
     */
    function showSuccess(message) {
        if (window.Dialog) {
            Dialog.success(message);
        } else {
            alert(message);
        }
    }
    
    /**
     * 綁定按鈕事件
     */
    function bindButtonEvents() {
        // 新增按鈕
        const addDeptBtn = document.getElementById('addDepartmentBtn');
        if (addDeptBtn) {
            addDeptBtn.addEventListener('click', showAddDepartmentModal);
        }
        
        // 部門搜尋功能
        const deptSearchInput = document.getElementById('deptSearchInput');
        if (deptSearchInput) {
            deptSearchInput.addEventListener('input', debounce(searchDepartment, 300));
            // Enter 鍵觸發搜尋
            deptSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    searchDepartment();
                }
            });
        }
    }
    
    /**
     * 綁定模態框事件
     */
    function bindModalEvents() {
        // 關閉按鈕事件
        window.closeDepartmentModal = () => closeModal('departmentModal');
        
        // 儲存按鈕事件
        window.saveDepartment = saveDepartment;
    }
    
    /**
     * 綁定表單事件
     */
    function bindFormEvents() {
        // 表單提交事件
        const deptForm = document.getElementById('departmentForm');
        if (deptForm) {
            deptForm.addEventListener('submit', (e) => {
                e.preventDefault();
                saveDepartment();
            });
        }
    }
    
    /**
     * 切換節點展開/收合狀態
     */
    function toggleNodeExpansion(node) {
        if (!node) return;
        
        const children = node.querySelector('.tree-children');
        const toggle = node.querySelector('.node-toggle i');
        
        if (!children) return; // 沒有子節點，不需要切換
        
        const isExpanded = children.classList.contains('expanded');
        
        if (isExpanded) {
            // 收合
            children.classList.remove('expanded');
            if (toggle) {
                toggle.classList.remove('fa-chevron-down');
                toggle.classList.add('fa-chevron-right');
            }
        } else {
            // 展開
            children.classList.add('expanded');
            if (toggle) {
                toggle.classList.remove('fa-chevron-right');
                toggle.classList.add('fa-chevron-down');
            }
        }
    }

    /**
     * 綁定樹狀結構事件
     */
    function bindTreeEvents() {
        const treeContainer = document.getElementById('departmentTree');
        if (!treeContainer) return;
        
        // 使用事件委託而不是 cloneNode，避免破壞已有的事件綁定
        // 移除之前的事件監聽器（如果有的話）
        if (treeContainer._treeEventListener) {
            treeContainer.removeEventListener('click', treeContainer._treeEventListener);
        }
        
        // 新的事件處理函數
        const treeEventHandler = function(e) {
            // 處理展開/收合箭頭點擊
            const toggleBtn = e.target.closest('.node-toggle');
            if (toggleBtn && !toggleBtn.classList.contains('invisible')) {
                e.preventDefault();
                e.stopPropagation();
                const node = toggleBtn.closest('.tree-node');
                if (node) {
                    toggleNodeExpansion(node);
                }
                return;
            }
            
            // 處理節點內容點擊（優化展開/收合互動邏輯）
            const nodeContent = e.target.closest('.node-content');
            if (nodeContent) {
                // 防止點擊按鈕或展開按鈕時觸發
                if (e.target.closest('.node-actions') || e.target.closest('.node-toggle')) {
                    return;
                }
                
                e.stopPropagation();
                const node = nodeContent.closest('.tree-node');
                const nodeId = node.dataset.id;
                const wasSelected = nodeContent.classList.contains('selected');
                const hasChildren = node.querySelector('.tree-children');
                const isExpanded = hasChildren && hasChildren.classList.contains('expanded');
                
                // 總是更新選中狀態和顯示詳情
                document.querySelectorAll('.node-content').forEach(c => c.classList.remove('selected'));
                nodeContent.classList.add('selected');
                showDepartmentDetails(nodeId);
                
                if (wasSelected) {
                    // 重複點擊已選中的節點：切換展開/收合狀態
                    toggleNodeExpansion(node);
                } else if (hasChildren && !isExpanded) {
                    // 首次點擊未選中且有子節點的未展開節點：只展開不收合
                    const children = node.querySelector('.tree-children');
                    const toggle = node.querySelector('.node-toggle i');
                    if (children && toggle) {
                        children.classList.add('expanded');
                        toggle.classList.remove('fa-chevron-right');
                        toggle.classList.add('fa-chevron-down');
                    }
                }
                // 其他情況（首次點擊已展開節點或無子節點）：只選中，不操作展開狀態
            }
        };
        
        // 綁定事件並保存引用
        treeContainer.addEventListener('click', treeEventHandler);
        treeContainer._treeEventListener = treeEventHandler;
        
        // 綁定人數點擊事件
        document.querySelectorAll('.node-count').forEach(countEl => {
            countEl.addEventListener('click', function(e) {
                e.stopPropagation(); // 防止觸發節點選擇
                e.preventDefault();
                
                const deptId = this.dataset.deptId;
                if (deptId && deptId !== 'undefined') {
                    // 通知員工模組顯示該部門的員工
                    if (window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.showEmployeeHoverCard) {
                        window.OrganizationEmployeeModule.showEmployeeHoverCard(parseInt(deptId));
                    }
                }
            });
        });
        
        // 綁定拖曳事件
        bindDragEvents();
    }
    
    /**
     * 綁定拖曳事件
     */
    function bindDragEvents() {
        let draggedElement = null;
        let draggedDeptId = null;
        
        document.querySelectorAll('.tree-node').forEach(node => {
            // 只允許非根節點被拖曳
            if (node.dataset.id === 'root') {
                node.setAttribute('draggable', 'false');
            }
            
            // 開始拖曳
            node.addEventListener('dragstart', function(e) {
                // 阻止事件冒泡，避免父節點也被拖曳
                e.stopPropagation();
                
                // 檢查是否點擊了操作按鈕（編輯、刪除），如果是則不允許拖曳
                if (e.target.closest('.node-actions') || e.target.closest('.btn-icon')) {
                    e.preventDefault();
                    return;
                }
                
                // 檢查是否為根節點
                if (this.dataset.id === 'root') {
                    e.preventDefault();
                    return;
                }
                
                draggedElement = this;
                draggedDeptId = this.dataset.id;
                this.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', this.innerHTML);
            });
            
            // 拖曳經過
            node.addEventListener('dragover', function(e) {
                if (e.preventDefault) {
                    e.preventDefault();
                }
                e.dataTransfer.dropEffect = 'move';
                
                const targetDeptId = this.dataset.id;
                
                // 清除之前的樣式
                this.classList.remove('drag-over', 'drag-invalid', 'drag-over-top', 'drag-over-bottom');
                
                // 根節點特殊處理
                if (targetDeptId === 'root') {
                    this.classList.add('drag-over');
                    this.dataset.dropPosition = 'inside';
                    return false;
                }
                
                // 不能拖到自己
                if (draggedDeptId === targetDeptId) {
                    this.classList.add('drag-invalid');
                    delete this.dataset.dropPosition;
                    return false;
                }
                
                // 不能拖到子部門
                if (isDescendant(draggedDeptId, targetDeptId)) {
                    this.classList.add('drag-invalid');
                    delete this.dataset.dropPosition;
                    return false;
                }
                
                // 檢查是否為同級節點
                const draggedDept = departments.find(d => d.id == draggedDeptId);
                const targetDept = departments.find(d => d.id == targetDeptId);
                const isSibling = draggedDept && targetDept && 
                                 draggedDept.parent_id === targetDept.parent_id;
                
                // 使用內容區域的邊界來判斷位置（排除縮排影響）
                const content = this.querySelector('.node-content');
                const rect = content ? content.getBoundingClientRect() : this.getBoundingClientRect();
                const y = e.clientY - rect.top;
                const height = rect.height;
                
                // 同級節點之間只允許排序（before/after）
                if (isSibling) {
                    const threshold = 0.5; // 50% 作為分界線
                    if (y < height * threshold) {
                        // 上半部：插入到目標之前
                        this.classList.add('drag-over-top');
                        this.dataset.dropPosition = 'before';
                    } else {
                        // 下半部：插入到目標之後
                        this.classList.add('drag-over-bottom');
                        this.dataset.dropPosition = 'after';
                    }
                } else {
                    // 非同級節點：允許三種位置
                    const threshold = 0.3; // 30% 的區域作為邊界
                    if (y < height * threshold) {
                        // 上部：插入到目標之前（成為兄弟）
                        this.classList.add('drag-over-top');
                        this.dataset.dropPosition = 'before';
                    } else if (y > height * (1 - threshold)) {
                        // 下部：插入到目標之後（成為兄弟）
                        this.classList.add('drag-over-bottom');
                        this.dataset.dropPosition = 'after';
                    } else {
                        // 中間：作為子部門
                        this.classList.add('drag-over');
                        this.dataset.dropPosition = 'inside';
                    }
                }
                
                return false;
            });
            
            // 拖曳進入
            node.addEventListener('dragenter', function(e) {
                // 不處理子元素的進入事件
                if (e.target === this || e.target.closest('.tree-node') === this) {
                    const targetDeptId = this.dataset.id;
                    if (canDropHere(draggedDeptId, targetDeptId)) {
                        this.classList.add('drag-over');
                    } else {
                        this.classList.add('drag-invalid');
                    }
                }
            });
            
            // 拖曳離開
            node.addEventListener('dragleave', function(e) {
                // 確保是離開整個節點，而不是內部元素
                if (e.target === this || !this.contains(e.relatedTarget)) {
                    this.classList.remove('drag-over', 'drag-invalid', 'drag-over-top', 'drag-over-bottom');
                    delete this.dataset.dropPosition;
                }
            });
            
            // 放置
            node.addEventListener('drop', function(e) {
                if (e.stopPropagation) {
                    e.stopPropagation();
                }
                e.preventDefault();
                
                this.classList.remove('drag-over', 'drag-invalid', 'drag-over-top', 'drag-over-bottom');
                
                const targetDeptId = this.dataset.id;
                const dropPosition = this.dataset.dropPosition || 'inside';
                
                // 清除位置數據
                delete this.dataset.dropPosition;
                
                // 檢查是否可以放置
                if (draggedDeptId === targetDeptId) {
                    return false;
                }
                
                if (targetDeptId !== 'root' && isDescendant(draggedDeptId, targetDeptId)) {
                    showError('不能將部門移動到其子部門下');
                    return false;
                }
                
                // 執行部門移動和排序
                moveDepartmentWithSort(draggedDeptId, targetDeptId, dropPosition);
                
                return false;
            });
            
            // 拖曳結束
            node.addEventListener('dragend', function(e) {
                this.classList.remove('dragging');
                // 清理所有拖曳相關的樣式和數據
                document.querySelectorAll('.tree-node').forEach(el => {
                    el.classList.remove('drag-over', 'drag-invalid', 'drag-over-top', 'drag-over-bottom');
                    delete el.dataset.dropPosition;
                });
                draggedElement = null;
                draggedDeptId = null;
            });
        });
    }
    
    /**
     * 檢查是否可以放置部門
     */
    function canDropHere(draggedId, targetId) {
        // 可以放置到頂層
        if (targetId === 'root') {
            return true;
        }
        
        // 不能拖曳到自己
        if (draggedId === targetId) {
            return false;
        }
        
        // 不能拖曳到自己的子部門（避免循環引用）
        if (isDescendant(draggedId, targetId)) {
            return false;
        }
        
        return true;
    }
    
    /**
     * 檢查 targetId 是否為 parentId 的子部門
     */
    function isDescendant(parentId, targetId) {
        const parent = departments.find(d => d.id == parentId);
        if (!parent) return false;
        
        // 遞迴檢查所有子部門
        const checkChildren = (deptId) => {
            const children = departments.filter(d => d.parent_id == deptId);
            for (const child of children) {
                if (child.id == targetId) {
                    return true;
                }
                if (checkChildren(child.id)) {
                    return true;
                }
            }
            return false;
        };
        
        return checkChildren(parentId);
    }
    
    /**
     * 計算新的排序值
     */
    function calculateSortOrder(draggedId, targetId, position) {
        const draggedDept = departments.find(d => d.id == draggedId);
        const targetDept = departments.find(d => d.id == targetId);
        
        if (!draggedDept) return 0;
        
        let newParentId = null;
        let siblings = [];
        
        if (position === 'inside' || targetId === 'root') {
            // 作為子部門或移到頂層
            newParentId = targetId === 'root' ? null : targetId;
            siblings = departments.filter(d => {
                if (newParentId === null) {
                    return d.parent_id === null || d.parent_id === 0;
                }
                return d.parent_id == newParentId;
            }).filter(d => d.id != draggedId); // 排除自己
        } else {
            // 作為兄弟部門（before 或 after）
            newParentId = targetDept ? targetDept.parent_id : null;
            siblings = departments.filter(d => {
                if (newParentId === null) {
                    return d.parent_id === null || d.parent_id === 0;
                }
                return d.parent_id == newParentId;
            }).filter(d => d.id != draggedId); // 排除自己
        }
        
        // 按 sort_order 排序
        siblings.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        
        if (position === 'inside' || targetId === 'root') {
            // 放到最後
            const lastOrder = siblings.length > 0 ? 
                (siblings[siblings.length - 1].sort_order || 0) : 0;
            return lastOrder + 100;
        }
        
        // 找到目標位置
        const targetIndex = siblings.findIndex(d => d.id == targetId);
        if (targetIndex === -1) return 100;
        
        if (position === 'before') {
            // 插入到目標之前
            const prevOrder = targetIndex > 0 ? 
                (siblings[targetIndex - 1].sort_order || 0) : 0;
            const targetOrder = siblings[targetIndex].sort_order || 100;
            return (prevOrder + targetOrder) / 2;
        } else {
            // 插入到目標之後
            const targetOrder = siblings[targetIndex].sort_order || 0;
            const nextOrder = targetIndex < siblings.length - 1 ? 
                (siblings[targetIndex + 1].sort_order || 100) : targetOrder + 100;
            return (targetOrder + nextOrder) / 2;
        }
    }
    
    /**
     * 移動部門並更新排序
     */
    async function moveDepartmentWithSort(draggedId, targetId, position) {
        const draggedDept = departments.find(d => d.id == draggedId);
        
        if (!draggedDept) {
            showError('找不到要移動的部門');
            return;
        }
        
        // 計算新的父部門和排序值
        let newParentId = null;
        let targetName = '頂層';
        
        if (position === 'inside') {
            // 作為子部門
            if (targetId === 'root') {
                newParentId = null;
                targetName = '頂層';
            } else {
                const targetDept = departments.find(d => d.id == targetId);
                if (targetDept) {
                    newParentId = parseInt(targetId);
                    targetName = targetDept.name;
                }
            }
        } else {
            // 作為兄弟部門
            const targetDept = departments.find(d => d.id == targetId);
            if (targetDept) {
                newParentId = targetDept.parent_id;
                if (newParentId) {
                    const parentDept = departments.find(d => d.id == newParentId);
                    targetName = parentDept ? parentDept.name : '頂層';
                } else {
                    targetName = '頂層';
                }
            }
        }
        
        // 計算新的排序值
        const newSortOrder = calculateSortOrder(draggedId, targetId, position);
        
        const sourceName = draggedDept.name;
        const positionText = position === 'before' ? '之前' : 
                           position === 'after' ? '之後' : '下';
        
        // 確認對話框
        const targetDept = departments.find(d => d.id == targetId);
        const confirmMessage = position === 'inside' ? 
            `確定要將「${sourceName}」移動到「${targetName}」下嗎？` :
            `確定要將「${sourceName}」移動到「${targetDept ? targetDept.name : '頂層'}」${positionText}嗎？`;
            
        Dialog.confirm(confirmMessage, async () => {
            try {
            // 呼叫 API 更新部門
            const response = await fetch(`${ENDPOINTS.departments}/${draggedId}`, {
                method: 'PUT',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    parent_id: newParentId,
                    sort_order: Math.round(newSortOrder)
                })
            });
            
            if (!response.ok) {
                throw new Error('移動部門失敗');
            }
            
            showSuccess(`已將「${sourceName}」移動完成`);
            
            // 重新載入部門列表
            await loadDepartments();
            
            // 展開目標部門以顯示移動結果
            if (position === 'inside' && targetId !== 'root') {
                const targetNode = document.querySelector(`.tree-node[data-id="${targetId}"]`);
                if (targetNode) {
                    const children = targetNode.querySelector('.tree-children');
                    if (children && !children.classList.contains('expanded')) {
                        children.classList.add('expanded');
                        const toggle = targetNode.querySelector('.node-toggle i');
                        if (toggle) {
                            toggle.classList.remove('fa-chevron-right');
                            toggle.classList.add('fa-chevron-down');
                        }
                    }
                }
            }
            
        } catch (error) {
            showError('移動部門失敗：' + error.message);
        }
        }, {
            title: '確認移動部門',
            type: 'warning'
        });
    }

    
    /**
     * 顯示部門詳情
     */
    function showDepartmentDetails(deptId) {
        // 記錄當前選中的部門ID
        selectedDepartmentId = deptId;
        
        const dept = departments.find(d => d.id == deptId);
        if (!dept) return;
        
        // 恢復樹節點的視覺選中狀態
        document.querySelectorAll('.node-content').forEach(c => c.classList.remove('selected'));
        const selectedNode = document.querySelector(`.tree-node[data-id="${deptId}"] .node-content`);
        if (selectedNode) {
            selectedNode.classList.add('selected');
        }
        
        const detailsContent = document.querySelector('.department-details .details-content');
        if (detailsContent) {
            detailsContent.innerHTML = `
                <div class="detail-item">
                    <label>部門名稱：</label>
                    <span>${dept.name}</span>
                </div>
                <div class="detail-item">
                    <label>部門描述：</label>
                    <span>${dept.description || '無'}</span>
                </div>
                <div class="detail-item">
                    <label>員工數量：</label>
                    <span>${dept.user_count || 0} 人</span>
                </div>
                <div class="detail-item">
                    <label>建立時間：</label>
                    <span>${dept.created_at || '未知'}</span>
                </div>
            `;
        }
    }
    
    
    /**
     * 搜尋部門
     */
    function searchDepartment() {
        const searchInput = document.getElementById('deptSearchInput');
        if (!searchInput) return;
        
        const keyword = searchInput.value.trim().toLowerCase();
        const searchResultCount = document.getElementById('searchResultCount');
        
        if (!keyword) {
            // 清空搜尋，移除所有高亮
            document.querySelectorAll('.tree-node').forEach(node => {
                node.classList.remove('highlight', 'search-hidden');
            });
            if (searchResultCount) {
                searchResultCount.style.display = 'none';
            }
            return;
        }
        
        // 搜尋匹配的部門
        const matchedDepts = departments.filter(dept => 
            dept.name.toLowerCase().includes(keyword) ||
            (dept.code && dept.code.toLowerCase().includes(keyword))
        );
        
        // 搜尋結果
        
        // 更新搜尋結果數量
        if (searchResultCount) {
            searchResultCount.style.display = matchedDepts.length > 0 ? 'inline' : 'none';
            searchResultCount.querySelector('strong').textContent = matchedDepts.length;
        }
        
        // 移除所有高亮
        document.querySelectorAll('.tree-node').forEach(node => {
            node.classList.remove('highlight', 'search-hidden');
        });
        
        if (matchedDepts.length > 0) {
            // 高亮匹配的部門和展開路徑
            matchedDepts.forEach(dept => {
                const node = document.querySelector(`.tree-node[data-id="${dept.id}"]`);
                if (node) {
                    node.classList.add('highlight');
                    // 展開到該節點的路徑
                    expandToNode(dept.id);
                }
            });
            
            // 滾動到第一個匹配項
            const firstMatch = document.querySelector('.tree-node.highlight');
            if (firstMatch) {
                firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }
    
    /**
     * 展開到指定節點的路徑
     */
    function expandToNode(nodeId) {
        const dept = departments.find(d => d.id == nodeId);
        if (!dept) return;
        
        // 找到所有父節點
        const parents = [];
        let current = dept;
        while (current && current.parent_id) {
            const parent = departments.find(d => d.id == current.parent_id);
            if (parent) {
                parents.unshift(parent);
                current = parent;
            } else {
                break;
            }
        }
        
        // 展開所有父節點
        parents.forEach(parent => {
            const parentNode = document.querySelector(`.tree-node[data-id="${parent.id}"]`);
            if (parentNode) {
                const children = parentNode.querySelector('.tree-children');
                const toggle = parentNode.querySelector('.node-toggle i');
                if (children && !children.classList.contains('expanded')) {
                    children.classList.add('expanded');
                    if (toggle) {
                        toggle.classList.remove('fa-chevron-right');
                        toggle.classList.add('fa-chevron-down');
                    }
                }
            }
        });
    }
    
    /**
     * 展開全部
     */
    function expandAll() {
        document.querySelectorAll('.tree-children').forEach(el => {
            el.classList.add('expanded');
        });
        document.querySelectorAll('.node-toggle i').forEach(icon => {
            icon.classList.remove('fa-chevron-right');
            icon.classList.add('fa-chevron-down');
        });
    }
    
    /**
     * 收合全部
     */
    function collapseAll() {
        document.querySelectorAll('.tree-children').forEach(el => {
            el.classList.remove('expanded');
        });
        document.querySelectorAll('.node-toggle i').forEach(icon => {
            icon.classList.remove('fa-chevron-down');
            icon.classList.add('fa-chevron-right');
        });
    }
    
    /**
     * 重新整理樹狀結構
     */
    async function refreshTree() {
        // 保存當前展開的節點
        const expandedNodes = [];
        document.querySelectorAll('.tree-node.expanded').forEach(node => {
            const id = node.dataset.id;
            if (id) {
                expandedNodes.push(id);
            }
        });
        
        showLoadingState();
        await loadDepartments();
        hideLoadingState();
        
        // 恢復展開狀態
        expandedNodes.forEach(id => {
            const node = document.querySelector(`.tree-node[data-id="${id}"]`);
            if (node && !node.classList.contains('expanded')) {
                const toggle = node.querySelector('.tree-toggle');
                if (toggle) {
                    toggle.click();
                }
            }
        });
        
        // 確保事件綁定正確
        rebindTreeEvents();
    }
    
    /**
     * 重新綁定樹狀結構事件
     */
    function rebindTreeEvents() {
        // 直接呼叫原有的綁定函數
        bindTreeEvents();
        
        // 如果角色模組已載入，也重新綁定角色拖曳事件
        if (window.OrganizationRolesModule && window.OrganizationRolesModule.bindRoleDragEvents) {
            window.OrganizationRolesModule.bindRoleDragEvents();
        }
    }
    
    /**
     * 顯示新增部門模態框
     */
    function showAddDepartmentModal() {
        const modal = document.getElementById('departmentModal');
        if (modal) {
            // 清除表單資料，特別是隱藏的 ID 欄位
            const form = document.getElementById('departmentForm');
            if (form) {
                form.reset();
                document.getElementById('departmentId').value = '';
                document.getElementById('deptCode').value = '';
                document.getElementById('deptName').value = '';
                document.getElementById('parentDepartment').value = '';
                document.getElementById('deptDescription').value = '';
                document.getElementById('deptSort').value = '0';
                document.getElementById('deptActive').checked = true;
            }
            
            // 設定標題為新增
            document.getElementById('departmentModalTitle').textContent = '新增部門';
            
            // 新增模式：確保部門代碼欄位可編輯
            document.getElementById('deptCode').disabled = false;
            
            // 載入部門選項
            loadDepartmentOptions();
            
            // 自動指定上級部門：如果有選中的部門，設為預設的上級部門
            if (selectedDepartmentId) {
                setTimeout(() => {
                    const parentSelect = document.getElementById('parentDepartment');
                    if (parentSelect) {
                        // 檢查選中的部門是否在可選選項中
                        const option = parentSelect.querySelector(`option[value="${selectedDepartmentId}"]`);
                        if (option) {
                            parentSelect.value = selectedDepartmentId;
                            
                            // 如果使用 SearchableSelect，觸發更新
                            if (parentSelect.searchableSelectInstance) {
                                parentSelect.searchableSelectInstance.setValue(selectedDepartmentId);
                            }
                        }
                    }
                }, 100); // 稍微延遲確保 DOM 已更新
            }
            
            // 載入角色模板選擇器
            if (window.OrganizationRolesModule) {
                OrganizationRolesModule.loadRoleTemplateSelector();
            }
            
            // 新增模式：顯示角色模板區塊
            const roleTemplateSection = document.querySelector('.form-group:has(#roleTemplateSelector)');
            if (roleTemplateSection) {
                roleTemplateSection.style.display = 'block';
            }
            
            // 顯示模態框
            modal.classList.add('show');
        }
    }
    

   
    /**
     * 載入部門選項
     */
    function loadDepartmentOptions(excludeId = null) {
        const select = document.getElementById('parentDepartment');
        if (select) {
            // 如果有排除的 ID，過濾掉該部門及其子部門
            let availableDepts = departments;
            if (excludeId) {
                // 找出所有子部門 ID
                const getAllChildIds = (parentId) => {
                    const childIds = [parentId];
                    const children = departments.filter(d => d.parent_id === parentId);
                    children.forEach(child => {
                        childIds.push(...getAllChildIds(child.id));
                    });
                    return childIds;
                };
                
                const excludeIds = getAllChildIds(excludeId);
                availableDepts = departments.filter(dept => !excludeIds.includes(dept.id));
            }
            
            // 更新選項內容
            select.innerHTML = '<option value="">無（頂層部門）</option>' +
                availableDepts.map(dept => `<option value="${dept.id}">${dept.name}</option>`).join('');
            
            // 如果已經初始化過 SearchableSelect，則重新載入
            if (select.searchableSelectInstance) {
                select.searchableSelectInstance.reload();
            } else if (window.SearchableSelect) {
                // 首次初始化 SearchableSelect
                const searchableOptions = {
                    placeholder: select.dataset.placeholder || '請選擇上級部門...',
                    searchPlaceholder: select.dataset.searchPlaceholder || '搜尋部門名稱...',
                    noResultsText: select.dataset.noResults || '找不到符合的部門',
                    maxHeight: '200px'
                };
                
                const instance = new SearchableSelect(select, searchableOptions);
                select.searchableSelectInstance = instance;
            }
        }
    }
       
    /**
     * 儲存部門
     */
    async function saveDepartment() {
        const form = document.getElementById('departmentForm');
        if (!form) return;
        
        const formData = new FormData(form);
        const departmentId = formData.get('id');
        const isEdit = departmentId && departmentId !== '';
        
        // 前端驗證：根據新增/編輯模式檢查必填欄位
        const name = formData.get('name');
        
        // 檢查 name 是否為空或只含空白字元（新增和編輯都需要）
        if (!name || name.trim() === '') {
            showError('部門名稱為必填欄位，請輸入有效的部門名稱');
            return;
        }
        
        // 建立基本資料
        const data = {
            name: name.trim(),  // 去除前後空白
            description: formData.get('description') || null,
            parent_id: formData.get('parent_id') || null,
            sort_order: parseInt(formData.get('sort_order')) || 0,
            is_active: formData.get('is_active') === 'on'
        };
        
        // 新增模式：額外檢查和加入部門代碼
        if (!isEdit) {
            const code = formData.get('code');
            if (!code || code.trim() === '') {
                showError('部門代碼為必填欄位，請輸入有效的部門代碼');
                return;
            }
            data.code = code.trim();  // 只在新增時加入代碼
            
            // 檢查是否至少選中一個角色模板
            const selectedTemplates = form.querySelectorAll('input[name="role_templates[]"]:checked');
            if (selectedTemplates.length === 0) {
                showError('請至少選擇一個角色模板以建立部門角色');
                return;
            }
        }
        
        try {
            const url = isEdit ? `${ENDPOINTS.departments}/${departmentId}` : ENDPOINTS.departments;
            const method = isEdit ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                let errorMessage = '儲存失敗';
                try {
                    const errorData = await response.json();
                    if (errorData.detail) {
                        errorMessage = errorData.detail;
                    }
                } catch {
                    // 如果無法解析錯誤回應，使用預設訊息
                }
                throw new Error(errorMessage);
            }
            
            // 取得回應資料（包含新建部門的 ID）
            const result = await response.json();
            
            // 如果是新增模式且有選中角色模板，建立部門角色
            if (!isEdit && result.department_id) {
                const selectedTemplates = [];
                const templateCheckboxes = form.querySelectorAll('input[name="role_templates[]"]:checked');
                
                templateCheckboxes.forEach(checkbox => {
                    const templateId = checkbox.value;
                    // 修正選擇器：角色名稱輸入框在 checkbox 的父元素內
                    const templateOption = checkbox.closest('.template-option');
                    const roleNameInput = templateOption?.querySelector('.role-name-input');
                    let roleName = roleNameInput?.value?.trim();
                    
                    // 如果沒有自訂名稱，使用部門名稱加模板名稱
                    if (!roleName) {
                        const templateLabel = templateOption?.querySelector('.template-info span')?.textContent || '角色';
                        roleName = `${data.name}-${templateLabel}`;
                    }
                    
                    selectedTemplates.push({
                        template_id: parseInt(templateId),
                        name: roleName
                    });
                });
                
                // 批量建立部門角色
                if (selectedTemplates.length > 0 && window.OrganizationRolesModule) {
                    try {
                        await OrganizationRolesModule.createDepartmentRoles(result.department_id, selectedTemplates);
                        // 成功建立部門角色
                    } catch (error) {
                        console.error('建立部門角色失敗:', error);
                        // 不影響部門建立成功的提示
                    }
                }
            }
            
            showSuccess(isEdit ? '部門更新成功' : '部門新增成功');
            closeModal('departmentModal');
            await loadDepartments();
            updateDepartmentStats();
            
            // 編輯模式：選中剛編輯的部門
            // 新增模式：保持原有選中狀態（如果有的話）
            if (isEdit) {
                // 選中剛編輯的部門
                showDepartmentDetails(departmentId);
            } else if (selectedDepartmentId) {
                // 新增模式下，如果之前有選中的部門，重新顯示其詳情
                showDepartmentDetails(selectedDepartmentId);
            }
            
            // 通知主模組更新統計
            if (window.OrganizationModule) {
                window.OrganizationModule.updateStatistics();
            }
        } catch (error) {
            showError('儲存部門失敗：' + error.message);
        }
    }
    

    /**
     * 編輯部門
     */
    async function editDepartment(id) {
        const dept = departments.find(d => d.id === id);
        if (!dept) return;
        
        // 先載入部門選項（排除自己和子部門，避免循環引用）
        loadDepartmentOptions(id);
        
        // 填充表單
        document.getElementById('departmentId').value = dept.id;
        document.getElementById('deptCode').value = dept.code;
        document.getElementById('deptName').value = dept.name;
        document.getElementById('deptDescription').value = dept.description || '';
        document.getElementById('deptSort').value = dept.sort_order || 0;
        document.getElementById('deptActive').checked = dept.is_active;
        
        // 編輯模式：禁用部門代碼欄位（不可編輯）
        document.getElementById('deptCode').disabled = true;
        
        // 延遲設定父部門選項，確保選項已載入並且 SearchableSelect 初始化完成
        setTimeout(() => {
            const parentSelect = document.getElementById('parentDepartment');
            parentSelect.value = dept.parent_id || '';
            
            // 如果使用了 SearchableSelect，也要更新其顯示
            if (parentSelect.searchableSelectInstance) {
                parentSelect.searchableSelectInstance.setValue(dept.parent_id || '');
            }
        }, 150);
        
        // 修改標題
        document.getElementById('departmentModalTitle').textContent = '編輯部門';
        
        // 編輯模式：隱藏角色模板區塊
        const roleTemplateSection = document.querySelector('.form-group:has(#roleTemplateSelector)');
        if (roleTemplateSection) {
            roleTemplateSection.style.display = 'none';
        }
        
        // 顯示模態框
        showModal('departmentModal');
    }
    
    /**
     * 刪除部門（軟刪除：設為停用狀態）
     */
    async function deleteDepartment(id) {
        const dept = departments.find(d => d.id === id);
        const deptName = dept ? dept.name : '此部門';
        
        Dialog.confirm(`確定要停用部門「${deptName}」嗎？<br><small class="text-muted">停用後可透過編輯功能重新啟用</small>`, async () => {
            try {
                // 構建更新數據，保留當前部門的關鍵資訊避免觸發層級重算
                const updateData = {
                    is_active: false
                };
                
                // 如果找到部門資料，保留關鍵欄位以避免層級結構異常
                if (dept) {
                    updateData.name = dept.name;
                    updateData.parent_id = dept.parent_id;
                    updateData.description = dept.description;
                    updateData.sort_order = dept.sort_order;
                }
                
                const response = await fetch(`${ENDPOINTS.departments}/${id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify(updateData)
                });
                
                if (!response.ok) {
                    throw new Error('停用失敗');
                }
                
                showSuccess('部門已停用，可透過編輯功能重新啟用');
                await loadDepartments();
                updateDepartmentStats();
                
                // 通知主模組更新統計
                if (window.OrganizationModule) {
                    window.OrganizationModule.updateStatistics();
                }
            } catch (error) {
                showError('停用部門失敗：' + error.message);
            }
        }, {
            allowHTML: true
        });
    }
    
    /**
     * 關閉模態框
     */
    function showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
        }
    }
    
    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
            // 清空表單
            const form = modal.querySelector('form');
            if (form) {
                form.reset();
                
                // 重置 SearchableSelect 元件的顯示
                const searchableSelects = form.querySelectorAll('.searchable-select');
                searchableSelects.forEach(select => {
                    if (select.searchableSelectInstance) {
                        select.searchableSelectInstance.updateDisplay();
                    }
                });
            }
        }
    }
    
    /**
     * 防抖函數
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    /**
     * 獲取所有部門資料（供其他模組使用）
     */
    function getDepartments() {
        return departments;
    }
    
    /**
     * 獲取已選中的部門ID（供其他模組使用）
     */
    function getSelectedDepartmentId() {
        return selectedDepartmentId;
    }
    
    // 公開 API
    return {
        init: init,
        loadDepartments: loadDepartments,
        saveDepartment: saveDepartment,
        editDepartment: editDepartment,
        deleteDepartment: deleteDepartment,
        searchDepartment: searchDepartment,
        toggleInactiveDepts: toggleInactiveDepts,
        expandAll: expandAll,
        collapseAll: collapseAll,
        refreshTree: refreshTree,
        showModal: showModal,
        closeModal: closeModal,
        getDepartments: getDepartments,
        getSelectedDepartmentId: getSelectedDepartmentId,
        updateDepartmentStats: updateDepartmentStats
    };
})();

// 確保模組可被全域存取
window.OrganizationDepartmentModule = OrganizationDepartmentModule;