/**
 * 組織管理 - 員工個人權限選擇子模組
 * 處理員工的個人權限群組選擇
 */
window.OrganizationEmployeePermissionsModule = (function() {
    'use strict';
    
    // API 端點
    const API_BASE = '/api/permissions';
    
    // 狀態管理
    let permissionGroups = [];
    let selectedPermissions = new Set();
    let isInitialized = false;
    
    /**
     * 初始化模組
     */
    function init() {
        if (isInitialized) return;
        
        console.log('OrganizationEmployeePermissionsModule 初始化');
        bindModalEvents();
        isInitialized = true;
    }
    
    /**
     * 顯示權限選擇模態框
     */
    async function showPermissionsModal() {
        const modal = document.getElementById('personalPermissionsModal');
        if (!modal) {
            console.error('找不到個人權限模態框');
            return;
        }
        
        // 顯示載入中
        const container = document.getElementById('permissionsListContainer');
        if (container) {
            container.innerHTML = `
                <div class="loading-spinner">
                    <div class="spinner"></div>
                    <p>載入權限群組中...</p>
                </div>
            `;
        }
        
        // 顯示模態框
        modal.classList.add('show');
        document.body.classList.add('modal-open');
        
        // 載入權限群組資料
        await loadPermissionGroups();
        
        // 建立權限選擇列表
        buildPermissionsList();
    }
    
    /**
     * 載入權限群組資料
     */
    async function loadPermissionGroups() {
        try {
            const response = await fetch(`${API_BASE}/groups`, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                // 處理不同的回應格式
                permissionGroups = Array.isArray(data) ? data : (data.data || []);
                // 只顯示啟用的權限群組
                permissionGroups = permissionGroups.filter(p => p.is_active !== false);
                console.log('載入權限群組:', permissionGroups);
            } else {
                console.error('載入權限群組失敗:', response.status);
                permissionGroups = [];
            }
        } catch (error) {
            console.error('載入權限群組失敗:', error);
            // 使用模擬數據作為後備
            permissionGroups = [
                { id: 1, code: 'ADMIN', name: '系統管理員', type: '系統', description: '擁有所有權限', is_active: true },
                { id: 2, code: 'MANAGER', name: '部門主管', type: '業務', description: '管理部門成員', is_active: true },
                { id: 3, code: 'USER', name: '一般員工', type: '業務', description: '基本權限', is_active: true }
            ];
        }
    }
    
    /**
     * 建立權限選擇列表
     */
    function buildPermissionsList() {
        const container = document.getElementById('permissionsListContainer');
        if (!container) return;
        
        let totalCount = permissionGroups.length;
        let html = '';
        
        if (permissionGroups.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-shield-alt fa-3x text-muted"></i>
                    <p class="text-muted mt-3">暫無可選的權限群組</p>
                    <small class="text-muted">請聯絡系統管理員設定權限群組</small>
                </div>
            `;
            return;
        }
        
        // 按類型和名稱排序
        const sortedPermissions = permissionGroups.sort((a, b) => {
            // 系統權限優先
            if (a.type === '系統' && b.type !== '系統') return -1;
            if (a.type !== '系統' && b.type === '系統') return 1;
            // 然後按名稱排序
            return a.name.localeCompare(b.name, 'zh-TW');
        });
        
        // 按類型分組
        const groupedPermissions = {};
        sortedPermissions.forEach(permission => {
            const type = permission.type || '其他';
            if (!groupedPermissions[type]) {
                groupedPermissions[type] = [];
            }
            groupedPermissions[type].push(permission);
        });
        
        // 渲染分組
        Object.entries(groupedPermissions).forEach(([type, permissions]) => {
            html += `
                <div class="permission-group">
                    <div class="permission-group-header">
                        <h5 class="permission-group-title">
                            <i class="fas ${type === '系統' ? 'fa-cog' : 'fa-users'}"></i>
                            ${type}權限
                        </h5>
                    </div>
                    <div class="permission-group-items">
            `;
            
            permissions.forEach(permission => {
                const isChecked = selectedPermissions.has(permission.id.toString());
                html += `
                    <div class="permission-item">
                        <div class="permission-content" onclick="OrganizationEmployeePermissionsModule.togglePermissionByRow(${permission.id})">
                            <input type="checkbox" class="form-check-input" 
                                   id="permission-${permission.id}" 
                                   value="${permission.id}" 
                                   ${isChecked ? 'checked' : ''}
                                   onclick="event.stopPropagation()"
                                   onchange="OrganizationEmployeePermissionsModule.togglePermissionSelection(${permission.id})">
                            <label for="permission-${permission.id}" class="permission-label" onclick="event.stopPropagation()">
                                <div class="permission-info">
                                    <div class="permission-name">
                                        <i class="fas fa-shield-alt text-primary"></i>
                                        <span class="name">${permission.name}</span>
                                        <span class="code text-muted">(${permission.code})</span>
                                    </div>
                                    <div class="permission-description text-muted">
                                        ${permission.description || '無描述'}
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
        // 更新統計
        updateStatistics(totalCount);
        
        // 初始化滾動條淡出效果
        if (window.CommonUI && window.CommonUI.initScrollFadeEffect) {
            container.classList.add('scrollable-fade');
            window.CommonUI.initScrollFadeEffect();
        }
    }
    
    /**
     * 切換權限選擇
     */
    function togglePermissionSelection(permissionId) {
        const checkbox = document.getElementById(`permission-${permissionId}`);
        if (!checkbox) return;
        
        if (checkbox.checked) {
            selectedPermissions.add(permissionId.toString());
        } else {
            selectedPermissions.delete(permissionId.toString());
        }
        updateSelectedCount();
    }
    
    /**
     * 點擊整行切換權限選擇
     */
    function togglePermissionByRow(permissionId) {
        const checkbox = document.getElementById(`permission-${permissionId}`);
        if (!checkbox) return;
        
        // 切換checkbox狀態
        checkbox.checked = !checkbox.checked;
        
        // 更新選中狀態
        if (checkbox.checked) {
            selectedPermissions.add(permissionId.toString());
        } else {
            selectedPermissions.delete(permissionId.toString());
        }
        updateSelectedCount();
    }
    
    /**
     * 搜尋權限
     */
    function searchPermissions() {
        const searchTerm = document.getElementById('permissionsSearch').value.toLowerCase();
        
        // 先清除所有高亮
        document.querySelectorAll('#permissionsListContainer .permission-item').forEach(item => {
            item.classList.remove('search-highlight');
        });
        
        if (!searchTerm) {
            // 顯示所有權限項目
            document.querySelectorAll('#permissionsListContainer .permission-item').forEach(item => {
                item.style.display = 'block';
            });
            
            // 顯示所有分組標題
            document.querySelectorAll('#permissionsListContainer .permission-group').forEach(group => {
                group.style.display = 'block';
            });
            
            return;
        }
        
        // 搜尋匹配項目
        let hasVisibleItems = false;
        
        document.querySelectorAll('#permissionsListContainer .permission-group').forEach(group => {
            let groupHasVisible = false;
            
            group.querySelectorAll('.permission-item').forEach(item => {
                const nameEl = item.querySelector('.permission-name .name');
                const codeEl = item.querySelector('.permission-name .code');
                const descEl = item.querySelector('.permission-description');
                
                const nameText = nameEl ? nameEl.textContent.toLowerCase() : '';
                const codeText = codeEl ? codeEl.textContent.toLowerCase() : '';
                const descText = descEl ? descEl.textContent.toLowerCase() : '';
                
                if (nameText.includes(searchTerm) || 
                    codeText.includes(searchTerm) || 
                    descText.includes(searchTerm)) {
                    item.style.display = 'block';
                    item.classList.add('search-highlight');
                    groupHasVisible = true;
                    hasVisibleItems = true;
                } else {
                    item.style.display = 'none';
                }
            });
            
            // 顯示或隱藏分組
            group.style.display = groupHasVisible ? 'block' : 'none';
        });
        
        // 如果沒有找到結果，顯示提示
        if (!hasVisibleItems) {
            const container = document.getElementById('permissionsListContainer');
            const emptyHint = container.querySelector('.search-no-results');
            if (!emptyHint) {
                container.insertAdjacentHTML('beforeend', `
                    <div class="search-no-results empty-state">
                        <i class="fas fa-search fa-2x text-muted"></i>
                        <p class="text-muted mt-3">找不到符合條件的權限群組</p>
                        <small class="text-muted">請嘗試其他關鍵字</small>
                    </div>
                `);
            }
        } else {
            // 移除無結果提示
            const emptyHint = document.querySelector('.search-no-results');
            if (emptyHint) {
                emptyHint.remove();
            }
        }
    }
    
    /**
     * 全選權限
     */
    function selectAll() {
        selectedPermissions.clear();
        
        // 獲取所有可見的權限
        document.querySelectorAll('#permissionsListContainer .permission-item:not([style*="display: none"]) input[type="checkbox"]').forEach(cb => {
            cb.checked = true;
            selectedPermissions.add(cb.value);
        });
        
        updateSelectedCount();
    }
    
    /**
     * 清除所有選擇
     */
    function clearSelection() {
        selectedPermissions.clear();
        document.querySelectorAll('#permissionsListContainer input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });
        updateSelectedCount();
    }
    
    /**
     * 確認權限選擇
     */
    function confirmPermissionsSelection() {
        updatePermissionsCount();
        closePermissionsModal();
    }
    
    /**
     * 關閉模態框
     */
    function closePermissionsModal() {
        const modal = document.getElementById('personalPermissionsModal');
        if (modal) {
            modal.classList.remove('show');
            document.body.classList.remove('modal-open');
        }
        
        // 清除搜尋
        const searchInput = document.getElementById('permissionsSearch');
        if (searchInput) {
            searchInput.value = '';
            searchPermissions(); // 重置顯示
        }
    }
    
    /**
     * 獲取選中的權限 ID（供主模組使用）
     */
    function getSelectedPermissions() {
        return Array.from(selectedPermissions).map(id => parseInt(id));
    }
    
    /**
     * 設定已選權限（編輯模式使用）
     */
    function setSelectedPermissions(permissionIds) {
        selectedPermissions.clear();
        
        if (permissionIds && Array.isArray(permissionIds)) {
            permissionIds.forEach(id => {
                selectedPermissions.add(id.toString());
            });
        }
        
        updatePermissionsCount();
    }
    
    /**
     * 重置權限選擇狀態
     */
    function resetPermissions() {
        selectedPermissions.clear();
        updatePermissionsCount();
    }
    
    /**
     * 更新權限數量顯示
     */
    function updatePermissionsCount() {
        const badge = document.getElementById('personalPermissionsCount');
        if (!badge) return;
        
        const count = selectedPermissions.size;
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }
    
    /**
     * 更新已選數量統計
     */
    function updateSelectedCount() {
        const countEl = document.getElementById('selectedPermissionsCount');
        if (countEl) {
            countEl.textContent = selectedPermissions.size;
        }
    }
    
    /**
     * 更新統計資訊
     */
    function updateStatistics(total) {
        const totalCountEl = document.getElementById('totalPermissionsCount');
        if (totalCountEl) {
            totalCountEl.textContent = total;
        }
        updateSelectedCount();
    }
    
    /**
     * 綁定模態框事件
     */
    function bindModalEvents() {
        // ESC 鍵關閉
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('personalPermissionsModal');
                if (modal && modal.classList.contains('show')) {
                    closePermissionsModal();
                }
            }
        });
        
        // 移除點擊背景關閉功能 - 模態框不允許點擊背景關閉
        // const modal = document.getElementById('personalPermissionsModal');
        // if (modal) {
        //     modal.addEventListener('click', (e) => {
        //         if (e.target === modal) {
        //             closePermissionsModal();
        //         }
        //     });
        // }
        
        // 搜尋框即時搜尋
        const searchInput = document.getElementById('permissionsSearch');
        if (searchInput) {
            searchInput.addEventListener('input', debounce(searchPermissions, 300));
        }
    }
    
    /**
     * 防抖動輔助函數
     */
    function debounce(func, delay) {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }
    
    // 公開 API
    return {
        init,
        showPermissionsModal,
        closePermissionsModal,
        confirmPermissionsSelection,
        getSelectedPermissions,
        setSelectedPermissions,
        resetPermissions,
        togglePermissionSelection,
        togglePermissionByRow,
        searchPermissions,
        selectAll,
        clearSelection
    };
})();

// 確保模組可被全域存取
if (typeof window.OrganizationEmployeePermissionsModule === 'undefined') {
    console.error('OrganizationEmployeePermissionsModule 載入失敗');
}