/**
 * 權限矩陣管理模組
 * 負責管理系統中所有可用的權限項目定義
 * 供群組權限設定使用
 */
const PermissionMatrixModule = (function() {
    'use strict';
    
    // API 端點
    const API_BASE = '/api/permissions';
    const ENDPOINTS = {
        matrix: `${API_BASE}/matrix`,
        matrixItem: (id) => `${API_BASE}/matrix/${id}`
    };
    
    // 模組狀態
    let state = {
        permissions: [],
        modules: [],
        currentModule: null,
        searchKeyword: '',
        showInactive: false,
        isLoading: false,
        currentCardIndex: 0,  // 當前顯示的卡片索引
        cards: [],           // 卡片元素陣列
        isAnimating: false   // 動畫鎖，防止快速切換
    };
    
    // 滾輪事件相關變數
    let scrollAccumulator = 0;
    let resetTimeout = null;
    let wheelTimeout = null;
    
    /**
     * 初始化模組
     */
    async function init() {
        console.log('初始化權限矩陣管理模組');
        
        // 檢查是否在權限矩陣頁面
        const matrixSection = document.getElementById('matrix-section');
        if (!matrixSection) {
            console.log('找不到 matrix-section 元素，跳過初始化');
            return;
        }
        
        // 檢查是否顯示
        const isActive = matrixSection.classList.contains('active');
        console.log('matrix-section 是否顯示:', isActive);
        
        // 載入權限資料
        await loadPermissions();
        
        // 綁定事件
        bindEvents();
        
        // 渲染初始畫面
        console.log('準備渲染初始畫面...');
        renderPermissions();
        console.log('初始化完成');
    }
    
    /**
     * 載入權限矩陣資料
     */
    async function loadPermissions() {
        console.log('開始載入權限矩陣資料...');
        state.isLoading = true;
        showLoading();
        
        try {
            const response = await fetch(ENDPOINTS.matrix, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('API 回應狀態:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('API 回應資料:', data);
            
            // 處理回應資料
            if (data.items) {
                state.permissions = data.items;
                console.log(`載入了 ${data.items.length} 筆權限資料`);
            } else if (Array.isArray(data)) {
                state.permissions = data;
                console.log(`載入了 ${data.length} 筆權限資料`);
            } else {
                state.permissions = [];
                console.log('沒有權限資料');
            }
            
            // 提取模組列表
            extractModules();
            
            // 更新統計資訊
            updateStatistics();
            
        } catch (error) {
            console.error('載入權限矩陣失敗:', error);
            if (window.Dialog) {
                Dialog.error('載入權限矩陣失敗: ' + error.message);
            }
            state.permissions = [];
            // 即使失敗也要更新 UI
            updateStatistics();
            // 清除載入中的訊息
            const container = document.getElementById('matrixContainer');
            if (container) {
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle fa-3x text-danger"></i>
                        <h3>載入失敗</h3>
                        <p>無法載入權限矩陣資料：${error.message}</p>
                        <button class="btn btn-primary" onclick="PermissionMatrixModule.init()">重試</button>
                    </div>`;
            }
        } finally {
            state.isLoading = false;
            hideLoading();
        }
    }
    
    /**
     * 提取模組列表
     */
    function extractModules() {
        const moduleMap = new Map();
        
        state.permissions.forEach(perm => {
            if (!moduleMap.has(perm.module_code)) {
                moduleMap.set(perm.module_code, {
                    code: perm.module_code,
                    name: perm.module_name,
                    count: 0,
                    activeCount: 0
                });
            }
            
            const module = moduleMap.get(perm.module_code);
            module.count++;
            if (perm.is_active) {
                module.activeCount++;
            }
        });
        
        state.modules = Array.from(moduleMap.values()).sort((a, b) => {
            return a.name.localeCompare(b.name);
        });
    }
    
    /**
     * 綁定事件
     */
    function bindEvents() {
        // 新增按鈕
        const addBtn = document.getElementById('addMatrixBtn');
        if (addBtn) {
            addBtn.onclick = () => showMatrixModal();
        }
        
        // 搜尋功能（即時搜尋）
        const searchInput = document.getElementById('matrixSearchInput');
        if (searchInput) {
            // 即時搜尋
            searchInput.oninput = () => {
                clearTimeout(searchInput.searchTimeout);
                searchInput.searchTimeout = setTimeout(() => {
                    searchMatrix();
                }, 100); // 300ms 防抖
            };
            
            // Enter 鍵立即搜尋
            searchInput.onkeyup = (e) => {
                if (e.key === 'Enter') {
                    clearTimeout(searchInput.searchTimeout);
                    searchMatrix();
                }
            };
        }
        
        // 模組篩選
        const moduleFilter = document.getElementById('moduleFilter');
        if (moduleFilter) {
            moduleFilter.onchange = filterByModule;
        }
        
        // 顯示/隱藏停用項目
        const toggleInactiveBtn = document.getElementById('toggleInactiveMatrixBtn');
        if (toggleInactiveBtn) {
            toggleInactiveBtn.onclick = toggleInactiveMatrix;
        }
    }
    
    /**
     * 渲染權限矩陣卡片堆疊
     */
    function renderPermissions() {
        console.log('開始渲染權限矩陣卡片...');
        const container = document.getElementById('matrixContainer');
        if (!container) {
            console.error('找不到 matrixContainer 元素');
            return;
        }
        
        console.log('當前權限資料數量:', state.permissions.length);
        
        // 過濾資料
        let filteredPermissions = filterPermissions();
        console.log('過濾後的權限數量:', filteredPermissions.length);
        
        // 按模組分組
        const groupedPermissions = groupPermissionsByModule(filteredPermissions);
        const moduleCount = Object.keys(groupedPermissions).length;
        console.log('分組後的模組數量:', moduleCount);
        
        // 清空容器
        container.innerHTML = '';
        state.cards = [];
        state.currentCardIndex = 0;
        
        // 如果沒有資料
        if (moduleCount === 0) {
            container.innerHTML = `
                <div class="matrix-empty-state">
                    <i class="fas fa-inbox"></i>
                    <h3>沒有找到權限項目</h3>
                    <p>請嘗試調整搜尋條件或新增權限項目</p>
                </div>`;
            updateCardIndicator(0, 0);
            return;
        }
        
        // 生成卡片
        let cardIndex = 0;
        for (const [moduleName, permissions] of Object.entries(groupedPermissions)) {
            const card = createPermissionCard(moduleName, permissions, cardIndex);
            container.appendChild(card);
            state.cards.push(card);
            cardIndex++;
        }
        
        // 初始化卡片堆疊
        initCardStack();
        
        // 更新指示器
        updateCardIndicator(1, moduleCount);
        
        console.log('卡片渲染完成');
    }
    
    /**
     * 創建權限卡片
     */
    function createPermissionCard(moduleName, permissions, index) {
        const card = document.createElement('div');
        card.className = 'matrix-card';
        card.dataset.moduleIndex = index;
        card.dataset.moduleName = moduleName;
        
        let moduleCode="";
        if (permissions.length > 0) {
            moduleCode = permissions[0].module_code;
            console.log(moduleCode);  // 輸出 'A123'
        } 
        // 卡片頭部
        let cardHTML = `
            <div class="matrix-card-header">
                <h4>
                    <i class="fas fa-cube"></i>
                    ${moduleName} 
                </h4>
                <div>
                    <span class="badge badge-info">模組代碼 : ${moduleCode}</span>
                    <span class="badge badge-info">${permissions.length} 項權限</span>
                </div>
            </div>
            <div class="matrix-card-content scrollable-fade">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th width="150">動作代碼</th>
                            <th width="150">動作名稱</th>
                            <th width="200">權限鍵值</th>
                            <th>描述</th>
                            <th width="80">類型</th>
                            <th width="80">狀態</th>
                            <th width="120">操作</th>
                        </tr>
                    </thead>
                    <tbody>`;
        
        // 權限項目
        permissions.forEach(perm => {
            const statusClass = perm.is_active ? 'success' : 'danger';
            const statusText = perm.is_active ? '啟用' : '停用';
            const typeClass = perm.permission_type === 'system' ? 'primary' : 'secondary';
            const typeText = perm.permission_type === 'system' ? '系統' : '自訂';
            
            cardHTML += `
                <tr class="${!perm.is_active ? 'inactive-row' : ''}" ${!perm.is_active && !state.showInactive ? 'style="display:none"' : ''}>
                    <td><code>${perm.action_code}</code></td>
                    <td>${perm.action_name}</td>
                    <td><code class="permission-key">${perm.permission_key}</code></td>
                    <td>${perm.description || '-'}</td>
                    <td>
                        <span class="badge badge-${typeClass}">${typeText}</span>
                    </td>
                    <td>
                        <span class="badge badge-${statusClass}">${statusText}</span>
                    </td>
                    <td>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline" onclick="PermissionMatrixModule.editMatrix(${perm.id})" title="編輯">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-outline" onclick="PermissionMatrixModule.toggleMatrixStatus(${perm.id})" title="${perm.is_active ? '停用' : '啟用'}">
                                <i class="fas fa-${perm.is_active ? 'toggle-on' : 'toggle-off'}"></i>
                            </button>
                            ${perm.permission_type !== 'system' ? `
                            <button class="btn btn-sm btn-danger" onclick="PermissionMatrixModule.deleteMatrix(${perm.id})" title="刪除">
                                <i class="fas fa-trash"></i>
                            </button>` : ''}
                        </div>
                    </td>
                </tr>`;
        });
        
        cardHTML += `
                    </tbody>
                </table>
            </div>`;
        
        card.innerHTML = cardHTML;
        return card;
    }
    
    /**
     * 過濾權限資料
     */
    function filterPermissions() {
        let filtered = [...state.permissions];
        
        // 關鍵字搜尋
        if (state.searchKeyword) {
            const keyword = state.searchKeyword.toLowerCase();
            filtered = filtered.filter(perm => 
                perm.module_name.toLowerCase().includes(keyword) ||
                perm.action_name.toLowerCase().includes(keyword) ||
                perm.action_code.toLowerCase().includes(keyword) ||
                perm.permission_key.toLowerCase().includes(keyword) ||
                (perm.description && perm.description.toLowerCase().includes(keyword))
            );
        }
        
        // 模組篩選
        if (state.currentModule) {
            filtered = filtered.filter(perm => perm.module_code === state.currentModule);
        }
        
        // 狀態篩選
        if (!state.showInactive) {
            filtered = filtered.filter(perm => perm.is_active);
        }
        
        return filtered;
    }
    
    /**
     * 按模組分組權限
     */
    function groupPermissionsByModule(permissions) {
        const grouped = {};
        
        permissions.forEach(perm => {
            if (!grouped[perm.module_name]) {
                grouped[perm.module_name] = [];
            }
            grouped[perm.module_name].push(perm);
        });
        
        // 排序每個模組內的權限
        for (const module in grouped) {
            grouped[module].sort((a, b) => a.sort_order - b.sort_order);
        }
        
        return grouped;
    }
    
    /**
     * 搜尋權限矩陣
     */
    function searchMatrix() {
        const input = document.getElementById('matrixSearchInput');
        if (input) {
            const keyword = input.value.trim();
            console.log('搜尋關鍵字:', keyword);
            state.searchKeyword = keyword;
            renderPermissions();
            
            // 更新搜尋狀態顯示
            updateSearchStatus();
        }
    }
    
    /**
     * 清空搜尋
     */
    function clearSearch() {
        const input = document.getElementById('matrixSearchInput');
        if (input) {
            input.value = '';
            state.searchKeyword = '';
            renderPermissions();
            updateSearchStatus();
        }
    }
    
    /**
     * 更新搜尋狀態顯示
     */
    function updateSearchStatus() {
        const input = document.getElementById('matrixSearchInput');
        if (!input) return;
        
        if (state.searchKeyword) {
            input.style.backgroundColor = '#e3f2fd';
            input.title = `正在搜尋: ${state.searchKeyword}`;
        } else {
            input.style.backgroundColor = '';
            input.title = '搜尋模組、動作或權限鍵值...';
        }
    }
    
    /**
     * 初始化卡片堆疊
     */
    function initCardStack() {
        if (state.cards.length === 0) return;
        
        // 設定初始狀態
        state.cards.forEach((card, index) => {
            updateCardState(card, index);
        });
        
        // 綁定事件
        bindCardEvents();
    }
    
    /**
     * 更新卡片狀態
     */
    function updateCardState(card, index) {
        const totalCards = state.cards.length;
        let diff = index - state.currentCardIndex;
        
        // 處理循環邏輯
        if (diff > totalCards / 2) {
            diff = diff - totalCards;
        } else if (diff < -totalCards / 2) {
            diff = diff + totalCards;
        }
        
        // 清除內聯樣式，只使用 CSS 類別控制
        card.style.transform = '';
        
        // 設定新狀態
        if (diff === 0) {
            card.setAttribute('data-card-state', 'active');
        } else if (diff === 1 || (diff === -totalCards + 1 && totalCards > 3)) {
            card.setAttribute('data-card-state', 'next1');
        } else if (diff === 2 || (diff === -totalCards + 2 && totalCards > 3)) {
            card.setAttribute('data-card-state', 'next2');
        } else {
            card.setAttribute('data-card-state', 'hidden');
        }
    }
    
    /**
     * 綁定卡片事件
     */
    function bindCardEvents() {
        const cardStack = document.getElementById('matrixCardStack');
        if (!cardStack) return;
        
        // 移除舊的事件監聽器
        cardStack.removeEventListener('wheel', handleWheelEvent);
        cardStack.removeEventListener('click', handleCardClick);
        document.removeEventListener('keydown', handleKeyboardEvent);
        
        // 滾輪事件
        cardStack.addEventListener('wheel', handleWheelEvent, { passive: false });
        
        // 點擊事件
        cardStack.addEventListener('click', handleCardClick);
        
        // 鍵盤事件
        document.addEventListener('keydown', handleKeyboardEvent);
        
        console.log('卡片事件已綁定');
    }
    
    /**
     * 處理滾輪事件
     */
    function handleWheelEvent(e) {
        // 防止動畫期間重複觸發
        if (state.isAnimating) return;
        
        const activeCard = e.target.closest('.matrix-card[data-card-state="active"]');
        const cardContent = e.target.closest('.matrix-card-content');
        const cardHeader = e.target.closest('.matrix-card-header');
        
        // 情況1: 在卡片頭部滾動 - 直接切換卡片
        if (cardHeader && activeCard) {
            e.preventDefault();
            e.stopPropagation();
            triggerCardSwitch(e.deltaY);
            return;
        }
        
        // 情況2: 在非活動卡片上滾動 - 切換卡片
        if (!activeCard) {
            e.preventDefault();
            e.stopPropagation();
            triggerCardSwitch(e.deltaY);
            return;
        }
        
        // 情況3: 在活動卡片的內容區域滾動
        if (cardContent && activeCard) {
            const content = cardContent;
            const scrollTop = content.scrollTop;
            const scrollHeight = content.scrollHeight;
            const clientHeight = content.clientHeight;
            
            // 檢查是否可以捲動
            const canScroll = scrollHeight > clientHeight;
            
            if (!canScroll) {
                // 內容不需要捲動，直接切換卡片
                e.preventDefault();
                triggerCardSwitch(e.deltaY);
                return;
            }
            
            // 計算是否到達邊界
            const isAtTop = scrollTop <= 0;
            const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1; // 留 1px 容錯
            
            // 智能邊界偵測
            if ((e.deltaY < 0 && isAtTop) || (e.deltaY > 0 && isAtBottom)) {
                // 累積滾動量，超過閾值才切換
                scrollAccumulator += Math.abs(e.deltaY);
                
                // 超過閾值（相當於滾動 3-4 格）
                if (scrollAccumulator > 300) {
                    e.preventDefault();
                    triggerCardSwitch(e.deltaY);
                    scrollAccumulator = 0;
                }
                
                // 重置累積器的計時器
                clearTimeout(resetTimeout);
                resetTimeout = setTimeout(() => {
                    scrollAccumulator = 0;
                }, 200);
            } else {
                // 正常捲動內容，重置累積器
                scrollAccumulator = 0;
            }
            
            return; // 讓內容正常捲動
        }
        
        // 情況4: 在空白區域滾動 - 切換卡片
        e.preventDefault();
        e.stopPropagation();
        triggerCardSwitch(e.deltaY);
    }
    
    /**
     * 觸發卡片切換（含防抖）
     */
    function triggerCardSwitch(deltaY) {
        // 防抖處理
        if (wheelTimeout) {
            clearTimeout(wheelTimeout);
        }
        
        wheelTimeout = setTimeout(() => {
            if (deltaY > 0) {
                nextCard();
            } else if (deltaY < 0) {
                prevCard();
            }
        }, 50);
    }
    
    /**
     * 處理點擊事件
     */
    function handleCardClick(e) {
        // 檢查是否點擊在卡片外部
        const card = e.target.closest('.matrix-card');
        const cardStack = e.currentTarget;
        
        if (!card || card.getAttribute('data-card-state') !== 'active') {
            // 點擊空白處或非活動卡片，切換到下一張
            nextCard();
        }
    }
    
    /**
     * 處理鍵盤事件
     */
    function handleKeyboardEvent(e) {
        // 只在權限矩陣區塊活動時響應
        const matrixSection = document.getElementById('matrix-section');
        if (!matrixSection || !matrixSection.classList.contains('active')) return;
        
        // 檢查是否在輸入框中
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        switch(e.key) {
            case 'ArrowUp':
                e.preventDefault();
                prevCard();
                break;
            case 'ArrowDown':
                e.preventDefault();
                nextCard();
                break;
        }
    }
    
    /**
     * 切換到下一張卡片
     */
    function nextCard() {
        if (state.cards.length <= 1 || state.isAnimating) return;
        
        state.isAnimating = true;
        state.currentCardIndex = (state.currentCardIndex + 1) % state.cards.length;
        
        // 更新所有卡片狀態
        state.cards.forEach((card, index) => {
            updateCardState(card, index);
        });
        
        // 更新指示器
        updateCardIndicator(state.currentCardIndex + 1, state.cards.length);
        
        // 解除動畫鎖
        setTimeout(() => {
            state.isAnimating = false;
        }, 400);
    }
    
    /**
     * 切換到上一張卡片
     */
    function prevCard() {
        if (state.cards.length <= 1 || state.isAnimating) return;
        
        state.isAnimating = true;
        state.currentCardIndex = state.currentCardIndex === 0 ? 
            state.cards.length - 1 : state.currentCardIndex - 1;
        
        // 更新所有卡片狀態
        state.cards.forEach((card, index) => {
            updateCardState(card, index);
        });
        
        // 更新指示器
        updateCardIndicator(state.currentCardIndex + 1, state.cards.length);
        
        // 解除動畫鎖
        setTimeout(() => {
            state.isAnimating = false;
        }, 400);
    }
    
    /**
     * 更新卡片指示器
     */
    function updateCardIndicator(current, total) {
        const indicator = document.getElementById('cardIndicator');
        if (indicator) {
            indicator.textContent = `${current} / ${total}`;
        }
    }
    
    /**
     * 按模組篩選（已廢棄，保留介面相容性）
     */
    function filterByModule() {
        // 此功能已由卡片堆疊取代
        console.log('模組篩選功能已由卡片堆疊取代');
    }
    
    /**
     * 切換顯示停用項目
     */
    function toggleInactiveMatrix() {
        state.showInactive = !state.showInactive;
        
        const btn = document.getElementById('toggleInactiveMatrixBtn');
        if (btn) {
            btn.innerHTML = state.showInactive ? 
                '<i class="fas fa-eye"></i>' : 
                '<i class="fas fa-eye-slash"></i>';
            btn.title = state.showInactive ? '隱藏停用' : '顯示停用';
        }
        
        renderPermissions();
    }
    
    /**
     * 顯示權限矩陣模態框
     */
    function showMatrixModal(matrixId = null) {
        const modal = document.getElementById('matrixModal');
        if (!modal) return;
        
        // 重置表單
        const form = document.getElementById('matrixForm');
        if (form) {
            form.reset();
            // 明確清空 matrixId 欄位，確保新增模式正確
            document.getElementById('matrixId').value = '';
            // 確保所有欄位都是啟用狀態（特別是新增模式）
            form.querySelectorAll('input, select, textarea').forEach(field => {
                field.disabled = false;
            });
        }
        
        // 重置權限鍵值預覽
        const preview = document.getElementById('permissionKeyPreview');
        if (preview) {
            preview.textContent = '請輸入模組代碼和動作代碼';
        }
        
        // 設定標題
        const title = document.getElementById('matrixModalTitle');
        if (title) {
            title.textContent = matrixId ? '編輯權限項目' : '新增權限項目';
        }
        
        // 如果是編輯模式，載入資料
        if (matrixId) {
            const matrix = state.permissions.find(p => p.id === matrixId);
            if (matrix) {
                loadMatrixToForm(matrix);
            }
        }
        
        // 顯示模態框
        modal.classList.add('show');
    }
    
    /**
     * 載入權限資料到表單
     */
    function loadMatrixToForm(matrix) {
        document.getElementById('matrixId').value = matrix.id || '';
        document.getElementById('matrixModuleCode').value = matrix.module_code || '';
        document.getElementById('matrixModuleName').value = matrix.module_name || '';
        document.getElementById('matrixActionCode').value = matrix.action_code || '';
        document.getElementById('matrixActionName').value = matrix.action_name || '';
        document.getElementById('matrixDescription').value = matrix.description || '';
        document.getElementById('matrixType').value = matrix.permission_type || 'custom';
        document.getElementById('matrixActive').value = matrix.is_active ? '1' : '0';
        document.getElementById('matrixSortOrder').value = matrix.sort_order || 0;
        
        // 更新權限鍵值預覽
        updatePermissionKeyPreview();
        
        // 系統權限不能修改某些欄位
        if (matrix.permission_type === 'system') {
            document.getElementById('matrixModuleCode').disabled = true;
            document.getElementById('matrixModuleName').disabled = true;
            document.getElementById('matrixActionCode').disabled = true;
            document.getElementById('matrixActionName').disabled = true;
            document.getElementById('matrixType').disabled = true;
        }
    }
    
    /**
     * 更新權限鍵值預覽
     */
    function updatePermissionKeyPreview() {
        const moduleCode = document.getElementById('matrixModuleCode').value;
        const actionCode = document.getElementById('matrixActionCode').value;
        const preview = document.getElementById('permissionKeyPreview');
        
        if (preview) {
            if (moduleCode && actionCode) {
                preview.textContent = `${moduleCode}.${actionCode}`;
            } else {
                preview.textContent = '請輸入模組代碼和動作代碼';
            }
        }
    }
    
    /**
     * 關閉模態框
     */
    function closeMatrixModal() {
        const modal = document.getElementById('matrixModal');
        if (modal) {
            modal.classList.remove('show');
            
            // 重置表單並清除所有禁用狀態
            const form = document.getElementById('matrixForm');
            if (form) {
                form.reset();
                // 明確清空 matrixId 欄位，避免影響下次新增
                document.getElementById('matrixId').value = '';
                // 確保所有欄位都恢復到啟用狀態
                form.querySelectorAll('input, select, textarea').forEach(field => {
                    field.disabled = false;
                });
                
                // 重置權限鍵值預覽
                const preview = document.getElementById('permissionKeyPreview');
                if (preview) {
                    preview.textContent = '請輸入模組代碼和動作代碼';
                }
            }
        }
    }
    
    /**
     * 儲存權限矩陣
     */
    async function saveMatrix() {
        const form = document.getElementById('matrixForm');
        if (!form) return;
        
        // 表單驗證
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        
        // 收集資料
        const matrixId = document.getElementById('matrixId').value;
        const formData = {
            module_code: document.getElementById('matrixModuleCode').value,
            module_name: document.getElementById('matrixModuleName').value,
            action_code: document.getElementById('matrixActionCode').value,
            action_name: document.getElementById('matrixActionName').value,
            description: document.getElementById('matrixDescription').value,
            permission_type: document.getElementById('matrixType').value,
            is_active: document.getElementById('matrixActive').value === '1',
            sort_order: parseInt(document.getElementById('matrixSortOrder').value) || 0
        };
        
        // 生成權限鍵值
        formData.permission_key = `${formData.module_code}.${formData.action_code}`;
        
        try {
            showLoading();
            
            const url = matrixId ? ENDPOINTS.matrixItem(matrixId) : ENDPOINTS.matrix;
            const method = matrixId ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || `HTTP error! status: ${response.status}`);
            }
            
            // 成功提示
            if (window.Dialog) {
                Dialog.success(matrixId ? '權限項目已更新' : '權限項目已新增');
            }
            
            // 關閉模態框
            closeMatrixModal();
            
            // 增加短暫延遲後重新載入資料，確保資料庫事務完成
            setTimeout(async () => {
                try {
                    await loadPermissions();
                    renderPermissions();
                    console.log('權限矩陣資料已重新載入');
                } catch (error) {
                    console.error('重新載入權限矩陣失敗:', error);
                }
            }, 300);
            
        } catch (error) {
            console.error('儲存權限矩陣失敗:', error);
            if (window.Dialog) {
                Dialog.error('儲存失敗: ' + error.message);
            }
        } finally {
            hideLoading();
        }
    }
    
    /**
     * 編輯權限矩陣
     */
    function editMatrix(matrixId) {
        showMatrixModal(matrixId);
    }
    
    /**
     * 切換權限狀態
     */
    async function toggleMatrixStatus(matrixId) {
        const matrix = state.permissions.find(p => p.id === matrixId);
        if (!matrix) return;
        
        const newStatus = !matrix.is_active;
        const action = newStatus ? '啟用' : '停用';
        
        if (!await confirmAction(`確定要${action}此權限項目嗎？`)) {
            return;
        }
        
        try {
            showLoading();
            
            const response = await fetch(ENDPOINTS.matrixItem(matrixId), {
                method: 'PATCH',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ is_active: newStatus })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || `HTTP error! status: ${response.status}`);
            }
            
            // 成功提示
            if (window.Dialog) {
                Dialog.success(`權限項目已${action}`);
            }
            
            // 更新本地狀態
            matrix.is_active = newStatus;
            
            // 立即更新該行的 UI 元素而不重新渲染整個列表
            updateMatrixRowUI(matrixId, newStatus);
            
            // 更新統計資訊
            updateStatistics();
            
        } catch (error) {
            console.error('切換權限狀態失敗:', error);
            if (window.Dialog) {
                Dialog.error('操作失敗: ' + error.message);
            }
        } finally {
            hideLoading();
        }
    }
    
    /**
     * 更新單個權限項目行的 UI
     */
    function updateMatrixRowUI(matrixId, isActive) {
        console.log('更新權限項目 UI:', matrixId, '狀態:', isActive);
        
        // 查找對應的表格行
        const rows = document.querySelectorAll('tbody tr');
        
        rows.forEach(row => {
            const toggleBtn = row.querySelector(`button[onclick*="toggleMatrixStatus(${matrixId})"]`);
            if (toggleBtn) {
                console.log('找到對應的行，正在更新...');
                
                // 1. 更新切換按鈕的圖標和標題
                const icon = toggleBtn.querySelector('i');
                if (icon) {
                    icon.className = `fas fa-${isActive ? 'toggle-on' : 'toggle-off'}`;
                }
                toggleBtn.title = isActive ? '停用' : '啟用';
                
                // 2. 更新狀態標籤（在狀態列中的最後一個 badge）
                const statusCell = row.querySelector('td:nth-last-child(2)'); // 狀態欄位是倒數第二個
                if (statusCell) {
                    const statusBadge = statusCell.querySelector('.badge');
                    if (statusBadge) {
                        statusBadge.className = `badge badge-${isActive ? 'success' : 'danger'}`;
                        statusBadge.textContent = isActive ? '啟用' : '停用';
                    }
                }
                
                // 3. 更新整行的 CSS class
                if (isActive) {
                    row.classList.remove('inactive-row');
                    row.style.display = ''; // 確保顯示
                } else {
                    row.classList.add('inactive-row');
                    // 如果設定不顯示停用項目，則隱藏該行
                    if (!state.showInactive) {
                        row.style.display = 'none';
                    }
                }
                
                console.log('行狀態已更新:', isActive ? '啟用' : '停用');
            }
        });
    }
    
    /**
     * 刪除權限矩陣
     */
    async function deleteMatrix(matrixId) {
        const matrix = state.permissions.find(p => p.id === matrixId);
        if (!matrix) return;
        
        // 系統權限不能刪除
        if (matrix.permission_type === 'system') {
            if (window.Dialog) {
                Dialog.warning('系統權限不能刪除');
            }
            return;
        }
        
        if (!await confirmAction(`確定要刪除權限項目「${matrix.permission_key}」嗎？`)) {
            return;
        }
        
        try {
            showLoading();
            
            const response = await fetch(ENDPOINTS.matrixItem(matrixId), {
                method: 'DELETE',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // 成功提示
            if (window.Dialog) {
                Dialog.success('權限項目已刪除');
            }
            
            // 從本地狀態移除
            const index = state.permissions.findIndex(p => p.id === matrixId);
            if (index > -1) {
                state.permissions.splice(index, 1);
            }
            
            // 重新提取模組列表
            extractModules();
            
            // 重新渲染
            renderPermissions();
            updateStatistics();
            
        } catch (error) {
            console.error('刪除權限矩陣失敗:', error);
            if (window.Dialog) {
                Dialog.error('刪除失敗: ' + error.message);
            }
        } finally {
            hideLoading();
        }
    }
    
    /**
     * 更新統計資訊
     */
    function updateStatistics() {
        // 總數
        const totalCount = state.permissions.length;
        const totalElem = document.getElementById('totalMatrixCount');
        if (totalElem) {
            const strongElem = totalElem.querySelector('strong');
            if (strongElem) {
                strongElem.textContent = totalCount;
            }
        }
        
        // 啟用數
        const activeCount = state.permissions.filter(p => p.is_active).length;
        const activeElem = document.getElementById('activeMatrixCount');
        if (activeElem) {
            const strongElem = activeElem.querySelector('strong');
            if (strongElem) {
                strongElem.textContent = activeCount;
            }
        }
        
        // 停用數
        const inactiveCount = totalCount - activeCount;
        const inactiveElem = document.getElementById('inactiveMatrixCount');
        if (inactiveElem) {
            const strongElem = inactiveElem.querySelector('strong');
            if (strongElem) {
                strongElem.textContent = inactiveCount;
            }
        }
        
        // 模組數
        const moduleCount = state.modules.length;
        const moduleElem = document.getElementById('moduleCount');
        if (moduleElem) {
            const spanElem = moduleElem.querySelector('span');
            if (spanElem) {
                spanElem.textContent = moduleCount;
            }
        }
        
        // 更新模組篩選器
        updateModuleFilter();
    }
    
    /**
     * 更新模組篩選器
     */
    function updateModuleFilter() {
        const select = document.getElementById('moduleFilter');
        if (!select) return;
        
        const currentValue = select.value;
        
        let html = '<option value="">所有模組</option>';
        state.modules.forEach(module => {
            html += `<option value="${module.code}">${module.name} (${module.count})</option>`;
        });
        
        select.innerHTML = html;
        select.value = currentValue;
    }
    
    /**
     * 確認操作
     */
    async function confirmAction(message) {
        if (window.Dialog && Dialog.confirm) {
            // 將回調式的 Dialog.confirm 包裝成 Promise
            return new Promise((resolve) => {
                Dialog.confirm(message, 
                    () => resolve(true),  // 確認時返回 true
                    { onCancel: () => resolve(false) }  // 取消時返回 false
                );
            });
        } else {
            // 使用原生 confirm
            return confirm(message);
        }
    }
    
    /**
     * 顯示載入中
     */
    function showLoading() {
        const loader = document.getElementById('loader-overlay');
        if (loader) {
            loader.classList.remove('d-none');
        }
    }
    
    /**
     * 隱藏載入中
     */
    function hideLoading() {
        const loader = document.getElementById('loader-overlay');
        if (loader) {
            loader.classList.add('d-none');
        }
    }
    
    // 公開 API
    return {
        init,
        loadPermissions,
        searchMatrix,
        clearSearch,
        filterByModule,
        toggleInactiveMatrix,
        showMatrixModal,
        closeMatrixModal,
        saveMatrix,
        editMatrix,
        toggleMatrixStatus,
        deleteMatrix,
        updatePermissionKeyPreview,
        nextCard,
        prevCard
    };
})();

// 註冊到全域
window.PermissionMatrixModule = PermissionMatrixModule;

// 模組不自動初始化，由 PermissionModule 或 PermDrawerManager 控制初始化時機
console.log('PermissionMatrixModule 已註冊到 window');