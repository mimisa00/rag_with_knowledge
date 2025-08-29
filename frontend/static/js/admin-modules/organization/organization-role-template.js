/**
 * 組織角色模板管理子模組
 * 處理角色模板的 CRUD 操作
 * 注意：此為子模組，不直接暴露到全域，須透過 OrganizationRolesModule 呼叫
 */
const OrganizationRoleTemplateModule = (function() {
    'use strict';
    
    // API 端點
    const API_BASE = '/api/organization';
    
    /**
     * 初始化模組
     * @param {Array} initialTemplates - 初始模板資料
     * @returns {Array} 返回載入的模板
     */
    async function init(initialTemplates = []) {
        console.log('OrganizationRoleTemplateModule 初始化開始');
        
        // 綁定事件
        bindEvents();
        
        // 載入角色模板
        const templates = await loadRoleTemplates();
        
        console.log('OrganizationRoleTemplateModule 初始化完成');
        return templates;
    }
    
    /**
     * 綁定事件
     */
    function bindEvents() {
        // 新增角色模板按鈕
        const addTemplateBtn = document.getElementById('addTemplateBtn');
        if (addTemplateBtn) {
            addTemplateBtn.onclick = () => showRoleTemplateModal();
        }
    }
    
    /**
     * 載入角色模板
     * @returns {Array} 返回載入的模板
     */
    async function loadRoleTemplates() {
        try {
            const response = await fetch(`${API_BASE}/role-templates`, {
                method: 'GET',
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('載入角色模板失敗');
            }
            
            const roleTemplates = await response.json();
            renderTemplateGrid(roleTemplates);
            return roleTemplates;
            
        } catch (error) {
            console.error('載入角色模板失敗:', error);
            if (window.Dialog) {
                Dialog.error('載入角色模板失敗');
            }
            return [];
        }
    }
    
    /**
     * 渲染角色模板網格
     * @param {Array} roleTemplates - 角色模板資料
     */
    function renderTemplateGrid(roleTemplates = []) {
        const grid = document.getElementById('templateGrid');
        if (!grid) return;
        
        // 確保 roleTemplates 是陣列
        if (!Array.isArray(roleTemplates)) {
            console.warn('renderTemplateGrid: roleTemplates 不是陣列', roleTemplates);
            roleTemplates = [];
        }
        
        if (roleTemplates.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-cog fa-3x text-muted"></i>
                    <p>尚無角色模板</p>
                    <button class="btn btn-primary" onclick="OrganizationRolesModule.showRoleTemplateModal()">
                        <i class="fas fa-plus"></i> 建立第一個模板
                    </button>
                </div>
            `;
            return;
        }
        
        grid.innerHTML = roleTemplates.map(template => `
            <div class="template-card ${template.is_system ? 'system-template' : ''}" data-template-id="${template.id}">
                <div class="template-icon">
                    <i class="fas ${template.role_type === 'manager' ? 'fa-user-tie' : 'fa-user'}"></i>
                </div>
                <h4>${template.name}</h4>
                ${template.is_system ? '<span class="badge badge-primary">系統預設</span>' : ''}
                <p>${template.description || '無描述'}</p>
                <div class="template-stats">
                    <span><i class="fas fa-sitemap"></i> ${template.department_count || 0} 個部門使用</span>
                    <span><i class="fas fa-users"></i> ${template.user_count || 0} 位用戶</span>
                </div>
                <div class="template-actions">
                    <button class="btn btn-sm btn-outline" onclick="OrganizationRolesModule.editRoleTemplate(${template.id})">
                        <i class="fas fa-edit"></i> 編輯
                    </button>
                    <button class="btn btn-sm btn-danger" 
                            onclick="OrganizationRolesModule.deleteRoleTemplate(${template.id})"
                            ${template.is_system || (template.department_count > 0) || (template.user_count > 0) ? 'disabled' : ''}
                            title="${template.is_system ? '系統預設模板無法刪除' : 
                                    (template.department_count > 0 || template.user_count > 0) ? 
                                    '已有部門或使用者使用此模板，無法刪除' : '刪除模板'}">
                        <i class="fas fa-trash"></i> 刪除
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    /**
     * 顯示角色模板模態框
     * @param {number|null} templateId - 模板 ID（編輯時使用）
     * @param {Array} roleTemplates - 角色模板資料
     */
    function showRoleTemplateModal(templateId = null, roleTemplates = []) {
        const modal = document.getElementById('roleTemplateModal');
        if (!modal) return;
        
        const form = document.getElementById('roleTemplateForm');
        const title = document.getElementById('roleTemplateModalTitle');
        
        if (templateId) {
            title.textContent = '編輯角色模板';
            const template = roleTemplates.find(t => t.id === templateId);
            if (template) {
                form.templateId.value = template.id;
                form.code.value = template.code;
                form.name.value = template.name;
                form.role_type.value = template.role_type;
                form.level.value = template.level;
                form.description.value = template.description || '';
                form.sort_order.value = template.sort_order;
                form.is_active.checked = template.is_active;
                
                // 系統模板不可編輯代碼
                form.code.disabled = template.is_system;
            }
        } else {
            title.textContent = '新增角色模板';
            form.reset();
            form.templateId.value = '';
            form.code.disabled = false;
        }
        
        modal.classList.add('show');
        // 初始化滾動條效果
        if (window.CommonUI && window.CommonUI.initScrollFadeEffect) {
            setTimeout(() => CommonUI.initScrollFadeEffect(), 100);
        }
    }
    
    /**
     * 關閉角色模板模態框
     */
    function closeRoleTemplateModal() {
        const modal = document.getElementById('roleTemplateModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }
    
    /**
     * 儲存角色模板
     * @returns {Array} 返回更新後的模板列表
     */
    async function saveRoleTemplate() {
        const form = document.getElementById('roleTemplateForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return [];
        }
        
        const templateId = form.templateId.value;
        const isEdit = !!templateId;
        
        const data = {
            code: form.code.value,
            name: form.name.value,
            role_type: form.role_type.value,
            level: parseInt(form.level.value),
            description: form.description.value,
            sort_order: parseInt(form.sort_order.value),
            is_active: form.is_active.checked
        };
        
        try {
            const url = isEdit 
                ? `${API_BASE}/role-templates/${templateId}`
                : `${API_BASE}/role-templates`;
            
            const response = await fetch(url, {
                method: isEdit ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || '儲存失敗');
            }
            
            closeRoleTemplateModal();
            const templates = await loadRoleTemplates();
            
            if (window.Dialog) {
                Dialog.success(isEdit ? '角色模板已更新' : '角色模板已建立');
            }
            
            return templates;
            
        } catch (error) {
            console.error('儲存角色模板失敗:', error);
            if (window.Dialog) {
                Dialog.error(error.message || '儲存角色模板失敗');
            }
            return [];
        }
    }
    
    /**
     * 編輯模板
     * @param {number} templateId - 模板 ID
     * @param {Array} roleTemplates - 角色模板資料
     */
    function editTemplate(templateId, roleTemplates = []) {
        showRoleTemplateModal(templateId, roleTemplates);
    }
    
    /**
     * 查看模板
     * @param {number} templateId - 模板 ID
     * @param {Array} roleTemplates - 角色模板資料
     */
    function viewTemplate(templateId, roleTemplates = []) {
        const template = roleTemplates.find(t => t.id === templateId);
        if (!template) return;
        
        if (window.Dialog) {
            Dialog.info(`
                <h4>${template.name}</h4>
                <p><strong>代碼：</strong>${template.code}</p>
                <p><strong>類型：</strong>${template.role_type === 'manager' ? '管理角色' : '員工角色'}</p>
                <p><strong>層級：</strong>${template.level}</p>
                <p><strong>描述：</strong>${template.description || '無'}</p>
                <p><strong>使用統計：</strong></p>
                <ul>
                    <li>${template.department_count || 0} 個部門使用</li>
                    <li>${template.user_count || 0} 位用戶</li>
                </ul>
            `, '角色模板詳情', { allowHTML: true });
        }
    }
    
    /**
     * 刪除模板
     * @param {number} templateId - 模板 ID
     * @param {Array} roleTemplates - 角色模板資料
     * @returns {Promise<Array>} 返回更新後的模板列表
     */
    async function deleteTemplate(templateId, roleTemplates = []) {
        if (!window.Dialog) return roleTemplates;
        
        const template = roleTemplates.find(t => t.id === templateId);
        if (!template) return roleTemplates;
        
        // 檢查是否可以刪除
        if (template.is_system) {
            Dialog.warning('系統預設模板無法刪除');
            return roleTemplates;
        }
        
        if ((template.department_count > 0) || (template.user_count > 0)) {
            Dialog.warning(`此模板已被 ${template.department_count || 0} 個部門或 ${template.user_count || 0} 位使用者使用，無法刪除`);
            return roleTemplates;
        }
        
        return new Promise((resolve) => {
            Dialog.confirm('確定要刪除此角色模板嗎？', async () => {
                try {
                    const response = await fetch(`${API_BASE}/role-templates/${templateId}`, {
                        method: 'DELETE',
                        credentials: 'include'
                    });
                    
                    if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.detail || '刪除失敗');
                    }
                    
                    const templates = await loadRoleTemplates();
                    Dialog.success('角色模板已刪除');
                    resolve(templates);
                    
                } catch (error) {
                    console.error('刪除角色模板失敗:', error);
                    Dialog.error(error.message || '刪除角色模板失敗');
                    resolve(roleTemplates);
                }
            }, () => {
                // 用戶取消
                resolve(roleTemplates);
            });
        });
    }
    
    /**
     * 載入角色模板選擇器（用於新增部門時）
     * @param {string} containerId - 容器 ID
     * @param {Array} roleTemplates - 角色模板資料
     */
    async function loadRoleTemplateSelector(containerId = 'roleTemplateSelector', roleTemplates = []) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        // 如果沒有傳入模板，則載入
        if (roleTemplates.length === 0) {
            roleTemplates = await loadRoleTemplates();
        }
        
        container.innerHTML = roleTemplates
            .filter(t => t.is_active)
            .map(template => `
                <label class="template-option">
                    <input type="checkbox" name="role_templates[]" value="${template.id}">
                    <div class="template-info">
                        <i class="fas ${template.role_type === 'manager' ? 'fa-user-tie' : 'fa-user'}"></i>
                        <span>${template.name}</span>
                        <input type="text" class="role-name-input" 
                               name="role_names[${template.id}]"
                               placeholder="角色名稱（選填）">
                    </div>
                </label>
            `).join('');
    }
    
    /**
     * 取得角色模板列表（供其他模組使用）
     * @param {Array} roleTemplates - 角色模板資料
     */
    function getRoleTemplates(roleTemplates = []) {
        return roleTemplates;
    }
    
    /**
     * 根據 ID 取得角色模板（供其他模組使用）
     * @param {number} templateId - 模板 ID
     * @param {Array} roleTemplates - 角色模板資料
     */
    function getRoleTemplateById(templateId, roleTemplates = []) {
        return roleTemplates.find(t => t.id === templateId);
    }
    
    /**
     * 重新載入角色模板（供其他模組調用）
     */
    async function reloadTemplates() {
        const templates = await loadRoleTemplates();
        return templates;
    }
    
    /**
     * 載入角色模板用於新增
     * @param {boolean} batchMode - 是否為批量模式
     * @param {Array} roleTemplates - 角色模板資料
     */
    async function loadRoleTemplatesForAdd(batchMode = false, roleTemplates = []) {
        const container = document.getElementById('roleTemplatesForAdd');
        if (!container) return;
        
        // 如果沒有傳入模板，則載入
        if (roleTemplates.length === 0) {
            roleTemplates = await loadRoleTemplates();
        }
        
        // 根據模式渲染不同的選擇器
        if (batchMode) {
            // 批量模式：多選框
            container.innerHTML = roleTemplates
                .filter(t => t.is_active)
                .map(template => `
                    <label class="template-checkbox-option">
                        <input type="checkbox" name="template_ids[]" value="${template.id}">
                        <div class="template-info">
                            <i class="fas ${template.role_type === 'manager' ? 'fa-user-tie' : 'fa-user'}"></i>
                            <span>${template.name}</span>
                            <input type="text" class="role-name-input" 
                                   name="role_names[${template.id}]"
                                   placeholder="自訂名稱（選填）"
                                   style="display: none;">
                            <small class="text-muted">${template.description || ''}</small>
                        </div>
                    </label>
                `).join('');
            
            // 綁定checkbox變化事件，顯示/隱藏名稱輸入框
            container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                checkbox.addEventListener('change', function() {
                    const nameInput = this.parentElement.querySelector('.role-name-input');
                    if (nameInput) {
                        nameInput.style.display = this.checked ? 'block' : 'none';
                        if (!this.checked) nameInput.value = '';
                    }
                });
            });
        } else {
            // 單一模式：單選框
            container.innerHTML = roleTemplates
                .filter(t => t.is_active)
                .map(template => `
                    <label class="template-radio-option">
                        <input type="radio" name="template_id" value="${template.id}" required>
                        <div class="template-info">
                            <i class="fas ${template.role_type === 'manager' ? 'fa-user-tie' : 'fa-user'}"></i>
                            <span>${template.name}</span>
                            <small class="text-muted">${template.description || ''}</small>
                        </div>
                    </label>
                `).join('');
        }
    }


    // 公開 API
    return {
        init,
        loadRoleTemplates,
        loadRoleTemplateSelector,
        showRoleTemplateModal,
        closeRoleTemplateModal,
        saveRoleTemplate,
        editTemplate,
        viewTemplate,
        deleteTemplate,
        getRoleTemplates,
        getRoleTemplateById,
        reloadTemplates,
        loadRoleTemplatesForAdd,
    };
})();

// 此模組不再直接暴露到全域，須透過 OrganizationRolesModule 呼叫
if (typeof window !== 'undefined') {
    // 只在內部使用，不公開暴露
    window.__OrganizationRoleTemplateModule = OrganizationRoleTemplateModule;
}