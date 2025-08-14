/**
 * 知識庫管理模組
 * 處理知識庫的建立、編輯、刪除及相關檔案操作
 */
(function() {
    'use strict';

    // 知識庫管理相關變數
    let currentKBId = null;
    let knowledgeBases = [];
    let selectedQAKBId = null;

    // 知識庫管理模式
    const KB_MODES = {
        PREVIEW: 'preview',     // 預覽模式 - 所有欄位唯讀
        CREATE: 'create',       // 新增模式 - 所有欄位可編輯
        EDIT: 'edit'           // 編輯模式 - ID不可編輯，其他可編輯
    };
    let currentKBMode = KB_MODES.PREVIEW;

    // 公開 API
    const KnowledgeBaseModule = {
        // 初始化
        init: function() {
            this.loadKnowledgeBases();
            this.bindEvents();
            this.setKBMode(KB_MODES.PREVIEW);
            this.initializeResizer();
        },

        // 載入知識庫列表
        loadKnowledgeBases: async function() {
            try {
                const response = await fetch('/api/knowledge-bases', {
                    credentials: 'include'
                });
                if (response.ok) {
                    const data = await response.json();
                    knowledgeBases = data.knowledge_bases;
                    this.updateKnowledgeBaseSelect();
                } else {
                    console.error('載入知識庫列表失敗');
                }
            } catch (error) {
                console.error('載入知識庫列表錯誤：', error);
            }
        },

        // 更新知識庫選擇下拉選單
        updateKnowledgeBaseSelect: function() {
            const select = document.getElementById('knowledgeBaseSelect');
            if (select) {
                select.innerHTML = '<option value="">請選擇知識庫</option>';
                knowledgeBases.forEach(kb => {
                    if (kb.status !== 'deleted') {
                        const option = document.createElement('option');
                        option.value = kb.id;
                        option.textContent = `${kb.name} (${kb.status === 'enable' ? '啟用' : '停用'})`;
                        select.appendChild(option);
                    }
                });
            }

            // 更新空狀態的select
            const emptySelect = document.getElementById('emptyKnowledgeBaseSelect');
            if (emptySelect) {
                emptySelect.innerHTML = '<option value="">請選擇知識庫</option>';
                knowledgeBases.forEach(kb => {
                    if (kb.status !== 'deleted') {
                        const option = document.createElement('option');
                        option.value = kb.id;
                        option.textContent = `${kb.name} (${kb.status === 'enable' ? '啟用' : '停用'})`;
                        emptySelect.appendChild(option);
                    }
                });
            }
        },

        // 設置知識庫管理模式
        setKBMode: function(mode) {
            currentKBMode = mode;

            // 更新標題
            const title = document.getElementById('kbManagementTitle');
            switch (mode) {
                case KB_MODES.CREATE:
                    title.textContent = '新增知識庫管理';
                    break;
                case KB_MODES.EDIT:
                    title.textContent = '知識庫管理';
                    break;
                case KB_MODES.PREVIEW:
                default:
                    title.textContent = '知識庫管理';
                    break;
            }

            // 控制界面元素顯示
            const emptyKBState = document.getElementById('emptyKBState');
            const selectedKBState = document.getElementById('selectedKBState');
            const indexSummarySection = document.getElementById('indexSummarySection');
            const fileOperationsSection = document.getElementById('fileOperationsSection');
            const previewButtons = document.getElementById('kbPreviewButtons');
            const formButtons = document.getElementById('kbFormButtons');
            const noKBSelected = document.getElementById('noKBSelected');

            if (currentKBId || mode === KB_MODES.CREATE) {
                emptyKBState.style.display = 'none';
                selectedKBState.style.display = 'flex';

                if (mode === KB_MODES.CREATE) {
                    // 新建模式：隱藏檔案操作和索引工具，顯示提示訊息
                    if (fileOperationsSection) {
                        fileOperationsSection.style.display = 'none';
                    }
                    if (indexSummarySection) {
                        indexSummarySection.style.display = 'none';
                    }
                    if (noKBSelected) {
                        noKBSelected.style.display = 'block';
                    }
                } else {
                    // 預覽或編輯模式：顯示檔案操作和索引工具，隱藏提示訊息
                    if (fileOperationsSection) {
                        fileOperationsSection.style.display = 'block';
                    }
                    if (indexSummarySection) {
                        indexSummarySection.style.display = 'block';
                    }
                    if (noKBSelected) {
                        noKBSelected.style.display = 'none';
                    }
                    // 重新綁定 IndexModule 的事件（因為按鈕現在才顯示）
                    if (window.IndexModule && window.IndexModule.bindEvents) {
                        setTimeout(() => {
                            window.IndexModule.bindEvents();
                        }, 100);
                    }
                }

                if (mode === KB_MODES.PREVIEW) {
                    previewButtons.style.display = 'block';
                    formButtons.style.display = 'none';
                } else {
                    previewButtons.style.display = 'none';
                    formButtons.style.display = 'block';
                }
            } else {
                emptyKBState.style.display = 'block';
                selectedKBState.style.display = 'none';
                indexSummarySection.style.display = 'none';
            }

            this.updateFormFieldsState(mode);
            this.updateButtonStates();
        },

        // 更新表單欄位狀態
        updateFormFieldsState: function(mode) {
            const kbIdField = document.getElementById('kbId');
            const kbNameField = document.getElementById('kbName');
            const kbStatusField = document.getElementById('kbStatus');
            const kbNoteField = document.getElementById('kbNote');
            const kbPromptField = document.getElementById('kbSystemPrompt');

            switch (mode) {
                case KB_MODES.CREATE:
                    kbIdField.readOnly = false;
                    kbNameField.readOnly = false;
                    kbStatusField.disabled = false;
                    kbNoteField.readOnly = false;
                    kbPromptField.readOnly = false;
                    break;
                case KB_MODES.EDIT:
                    kbIdField.readOnly = true;
                    kbNameField.readOnly = false;
                    kbStatusField.disabled = false;
                    kbNoteField.readOnly = false;
                    kbPromptField.readOnly = false;
                    break;
                case KB_MODES.PREVIEW:
                default:
                    kbIdField.readOnly = true;
                    kbNameField.readOnly = true;
                    kbStatusField.disabled = true;
                    kbNoteField.readOnly = true;
                    kbPromptField.readOnly = true;
                    break;
            }
        },

        // 更新按鈕狀態
        updateButtonStates: function() {
            const editBtn = document.getElementById('editKBModeBtn');
            const deleteBtn = document.getElementById('deleteKBBtn');
            const hasSelectedKB = currentKBId != null;
            editBtn.disabled = !hasSelectedKB;
            deleteBtn.disabled = !hasSelectedKB;
        },

        // 載入知識庫資料
        loadKnowledgeBaseData: async function(kbId) {
            try {
                const response = await fetch(`/api/knowledge-bases/${kbId}`, {
                    credentials: 'include'
                });
                if (response.ok) {
                    const data = await response.json();
                    const kb = data.knowledge_base;
                    currentKBId = kbId;
                    this.fillKnowledgeBaseForm(kb);
                    this.setKBMode(KB_MODES.PREVIEW);
                    document.getElementById('fileOperationsSection').style.display = 'block';
                    // 確保隱藏提示訊息
                    const noKBSelected = document.getElementById('noKBSelected');
                    if (noKBSelected) {
                        noKBSelected.style.display = 'none';
                    }
                    if (typeof window.IndexModule !== 'undefined') {
                        await window.IndexModule.loadFileList();
                        // 重新綁定事件（因為按鈕現在才顯示）
                        setTimeout(() => {
                            window.IndexModule.bindEvents();
                        }, 100);
                    }
                } else {
                    alert('載入知識庫詳情失敗');
                }
            } catch (error) {
                console.error('載入知識庫詳情錯誤：', error);
                alert('載入知識庫詳情失敗');
            }
        },

        // 填入知識庫表單資料
        fillKnowledgeBaseForm: function(kb) {
            document.getElementById('kbId').value = kb.id || '';
            const kbNameField = document.getElementById('kbName');
            if (kbNameField.tagName === 'SELECT') {
                kbNameField.value = kb.id || '';
            } else {
                kbNameField.value = kb.name || '';
            }
            document.getElementById('kbStatus').value = kb.status || 'enable';
            document.getElementById('kbNote').value = kb.note || '';
            document.getElementById('kbSystemPrompt').value = kb.system_prompt || '';
            this.updateCharCount();
        },

        // 清空知識庫表單
        clearKnowledgeBaseForm: function() {
            document.getElementById('kbId').value = '';
            const kbNameField = document.getElementById('kbName');
            if (kbNameField) {
                if (kbNameField.tagName === 'SELECT') {
                    kbNameField.value = '';
                } else {
                    kbNameField.value = '';
                }
            }
            document.getElementById('kbStatus').value = 'enable';
            document.getElementById('kbNote').value = '';
            document.getElementById('kbSystemPrompt').value = '';
            this.updateCharCount();
        },

        // 模式控制函數
        enterCreateMode: async function() {
            this.clearKnowledgeBaseForm();
            currentKBId = null;
            this.setKBMode(KB_MODES.CREATE);
            
            // 嘗試從資料庫載入預設的 system_prompt
            try {
                const response = await fetch('/api/config/system-prompt', {
                    credentials: 'include'
                });
                if (response.ok) {
                    const data = await response.json();
                    if (data.system_prompt) {
                        document.getElementById('kbSystemPrompt').value = data.system_prompt;
                        this.updateCharCount();
                    }
                }
            } catch (error) {
                console.log('無法載入預設提示詞:', error);
            }
        },

        enterEditMode: function() {
            if (!currentKBId) {
                alert('請先選擇知識庫');
                return;
            }
            this.setKBMode(KB_MODES.EDIT);
        },

        enterPreviewMode: function() {
            this.setKBMode(KB_MODES.PREVIEW);
        },

        returnToEmptyState: function() {
            if (confirm('返回到知識庫主畫面？')) {
                currentKBId = null;
                this.clearKnowledgeBaseForm();
                const emptySelect = document.getElementById('emptyKnowledgeBaseSelect');
                if (emptySelect) {
                    emptySelect.value = '';
                }
                const qaSelect = document.getElementById('qaKnowledgeBaseSelect');
                if (qaSelect) {
                    qaSelect.value = '';
                    if (typeof onQAKnowledgeBaseChange === 'function') {
                        onQAKnowledgeBaseChange();
                    }
                }
                this.setKBMode(KB_MODES.PREVIEW);
            }
        },

        // 取消操作
        cancelKBOperation: function() {
            if (currentKBMode === KB_MODES.CREATE || currentKBMode === KB_MODES.EDIT) {
                if (confirm('確定要取消嗎？未儲存的變更將會遺失。')) {
                    if (currentKBMode === KB_MODES.CREATE) {
                        currentKBId = null;
                        this.clearKnowledgeBaseForm();
                        this.setKBMode(KB_MODES.PREVIEW);
                    } else if (currentKBId) {
                        this.loadKnowledgeBaseData(currentKBId);
                    }
                }
            }
        },

        // 驗證表單資料
        validateKBForm: function(mode) {
            const kbId = document.getElementById('kbId').value.trim();
            const kbName = document.getElementById('kbName').value.trim();

            if (mode === KB_MODES.CREATE) {
                if (!kbId) {
                    alert('請填入知識庫 ID');
                    return false;
                }
                if (!/^[a-zA-Z0-9_-]{1,36}$/.test(kbId)) {
                    alert('知識庫 ID 只能包含英文、數字、底線和連字符，長度不超過36字元');
                    return false;
                }
            }

            if (!kbName) {
                alert('請填入知識庫名稱');
                return false;
            }

            return true;
        },

        // 保存知識庫
        saveKnowledgeBase: async function() {
            if (!this.validateKBForm(currentKBMode)) {
                return;
            }

            try {
                let response;
                if (currentKBMode === KB_MODES.CREATE) {
                    // 創建時只發送後端需要的欄位（不包含 status）
                    const createData = {
                        id: document.getElementById('kbId').value.trim(),
                        name: document.getElementById('kbName').value.trim(),
                        note: document.getElementById('kbNote').value.trim(),
                        system_prompt: document.getElementById('kbSystemPrompt').value
                    };
                    response = await fetch('/api/knowledge-bases', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify(createData)
                    });
                } else if (currentKBMode === KB_MODES.EDIT && currentKBId) {
                    // 編輯時發送更新需要的欄位
                    const updateData = {
                        name: document.getElementById('kbName').value.trim(),
                        status: document.getElementById('kbStatus').value,
                        note: document.getElementById('kbNote').value.trim(),
                        system_prompt: document.getElementById('kbSystemPrompt').value
                    };
                    response = await fetch(`/api/knowledge-bases/${currentKBId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify(updateData)
                    });
                }

                if (response && response.ok) {
                    const message = currentKBMode === KB_MODES.CREATE ? '知識庫創建成功' : '知識庫更新成功';
                    alert(message);
                    await this.loadKnowledgeBases();
                    if (currentKBMode === KB_MODES.CREATE) {
                        const newKBId = document.getElementById('kbId').value.trim();
                        currentKBId = newKBId;
                        document.getElementById('emptyKnowledgeBaseSelect').value = newKBId;
                        await this.loadKnowledgeBaseData(newKBId);
                    } else {
                        await this.loadKnowledgeBaseData(currentKBId);
                    }
                } else {
                    const error = await response.json();
                    alert(`操作失敗：${error.detail}`);
                }
            } catch (error) {
                console.error('保存知識庫錯誤：', error);
                alert('保存知識庫失敗');
            }
        },

        // 刪除知識庫
        deleteKnowledgeBase: async function() {
            if (!currentKBId) {
                alert('請先選擇知識庫');
                return;
            }

            const confirmDelete = confirm('確定要刪除此知識庫嗎？');
            if (!confirmDelete) return;

            const deleteFiles = confirm('是否一併刪除相關文件與索引資料？\n（選擇「取消」僅進行邏輯刪除，選擇「確定」將完全刪除所有相關檔案）');

            try {
                const response = await fetch(`/api/knowledge-bases/${currentKBId}?delete_files=${deleteFiles}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });

                if (response.ok) {
                    alert(`知識庫刪除成功${deleteFiles ? '（包含檔案）' : '（僅邏輯刪除）'}`);
                    currentKBId = null;
                    document.getElementById('knowledgeBaseSelect').value = '';
                    this.clearKnowledgeBaseForm();
                    this.setKBMode(KB_MODES.PREVIEW);
                    document.getElementById('fileOperationsSection').style.display = 'none';
                    await this.loadKnowledgeBases();
                } else {
                    const error = await response.json();
                    alert(`刪除失敗：${error.detail}`);
                }
            } catch (error) {
                console.error('刪除知識庫錯誤：', error);
                alert('刪除知識庫失敗');
            }
        },

        // 更新字數統計
        updateCharCount: function() {
            const textarea = document.getElementById('kbSystemPrompt');
            const counter = document.getElementById('promptCharCount');
            counter.textContent = textarea.value.length;
        },

        // 驗證索引
        validateCurrentKBIndex: function() {
            if (!currentKBId) {
                alert('請先選擇知識庫');
                return;
            }
            window.open(`/api/vector/index/validate?kb_id=${currentKBId}`, '_blank');
        },

        // 顯示索引
        showCurrentKBIndex: function() {
            if (!currentKBId) {
                alert('請先選擇知識庫');
                return;
            }
            window.open(`/showindex?kb_id=${currentKBId}`, '_blank');
        },


        // 空狀態知識庫選擇變更
        onEmptyKnowledgeBaseSelectionChange: async function() {
            const select = document.getElementById('emptyKnowledgeBaseSelect');
            const kbId = select.value;

            if (!kbId) {
                currentKBId = null;
                this.setKBMode(KB_MODES.PREVIEW);
                return;
            }

            await this.loadKnowledgeBaseData(kbId);
        },

        // 初始化可調整大小的分隔條
        initializeResizer: function() {
            const resizer = document.getElementById('resizer');
            const fileUploadPanel = document.getElementById('fileUploadPanel');
            const indexToolsPanel = document.getElementById('indexToolsPanel');
            const container = document.getElementById('resizableContainer');
            
            if (!resizer || !fileUploadPanel || !indexToolsPanel || !container) return;
            
            let isResizing = false;
            let startX = 0;
            let startFileWidth = 0;
            let startIndexWidth = 0;

            resizer.addEventListener('mouseenter', function() {
                this.style.backgroundColor = '#bbb';
            });
            
            resizer.addEventListener('mouseleave', function() {
                if (!isResizing) {
                    this.style.backgroundColor = '#ddd';
                }
            });

            resizer.addEventListener('mousedown', function(e) {
                isResizing = true;
                startX = e.clientX;
                
                const containerRect = container.getBoundingClientRect();
                const fileRect = fileUploadPanel.getBoundingClientRect();
                const indexRect = indexToolsPanel.getBoundingClientRect();
                
                startFileWidth = fileRect.width;
                startIndexWidth = indexRect.width;
                
                resizer.style.backgroundColor = '#999';
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';
                
                e.preventDefault();
            });

            document.addEventListener('mousemove', function(e) {
                if (!isResizing) return;
                
                const deltaX = e.clientX - startX;
                const containerRect = container.getBoundingClientRect();
                const totalWidth = containerRect.width - 6;
                
                let newFileWidth = startFileWidth + deltaX;
                let newIndexWidth = startIndexWidth - deltaX;
                
                const minFileWidth = 300;
                const minIndexWidth = 250;
                
                if (newFileWidth < minFileWidth) {
                    newFileWidth = minFileWidth;
                    newIndexWidth = totalWidth - newFileWidth;
                } else if (newIndexWidth < minIndexWidth) {
                    newIndexWidth = minIndexWidth;
                    newFileWidth = totalWidth - newIndexWidth;
                }
                
                const fileFlexRatio = newFileWidth / totalWidth;
                const indexFlexRatio = newIndexWidth / totalWidth;
                
                fileUploadPanel.style.flex = fileFlexRatio;
                indexToolsPanel.style.flex = indexFlexRatio;
                
                e.preventDefault();
            });

            document.addEventListener('mouseup', function() {
                if (isResizing) {
                    isResizing = false;
                    resizer.style.backgroundColor = '#ddd';
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                }
            });
        },

        // 綁定事件
        bindEvents: function() {
            const emptySelect = document.getElementById('emptyKnowledgeBaseSelect');
            if (emptySelect) {
                emptySelect.addEventListener('change', () => this.onEmptyKnowledgeBaseSelectionChange());
            }

            const emptyCreateBtn = document.getElementById('emptyCreateKBBtn');
            if (emptyCreateBtn) {
                emptyCreateBtn.addEventListener('click', () => this.enterCreateMode());
            }

            const editBtn = document.getElementById('editKBModeBtn');
            if (editBtn) {
                editBtn.addEventListener('click', () => this.enterEditMode());
            }

            const deleteBtn = document.getElementById('deleteKBBtn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => this.deleteKnowledgeBase());
            }

            const returnBtn = document.getElementById('returnToEmptyBtn');
            if (returnBtn) {
                returnBtn.addEventListener('click', () => this.returnToEmptyState());
            }

            const saveBtn = document.getElementById('saveKBBtn');
            if (saveBtn) {
                saveBtn.addEventListener('click', () => this.saveKnowledgeBase());
            }

            const cancelBtn = document.getElementById('cancelKBBtn');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => this.cancelKBOperation());
            }

            const promptTextarea = document.getElementById('kbSystemPrompt');
            if (promptTextarea) {
                promptTextarea.addEventListener('input', () => this.updateCharCount());
            }

            const qaSelect = document.getElementById('qaKnowledgeBaseSelect');
            if (qaSelect) {
                qaSelect.addEventListener('change', () => this.onQAKnowledgeBaseChange());
            }
        },

        // 獲取當前知識庫ID
        getCurrentKBId: function() {
            return currentKBId;
        },

        // 設置當前知識庫ID
        setCurrentKBId: function(kbId) {
            currentKBId = kbId;
        },

        // 顯示上傳 Loading
        showUploadLoading: function() {
            const loadingOverlay = document.getElementById('uploadLoadingOverlay');
            if (loadingOverlay) {
                loadingOverlay.style.display = 'flex';
            }
            // 禁用上傳對話框控制項
            if (window.AdminUI && window.AdminUI.disableUploadModalControls) {
                window.AdminUI.disableUploadModalControls(true);
            } else {
                // 如果 AdminUI 不存在，直接調用本地方法
                this.disableUploadModalControls(true);
            }
        },

        // 隱藏上傳 Loading
        hideUploadLoading: function() {
            const loadingOverlay = document.getElementById('uploadLoadingOverlay');
            if (loadingOverlay) {
                loadingOverlay.style.display = 'none';
            }
            // 恢復上傳對話框控制項
            if (window.AdminUI && window.AdminUI.disableUploadModalControls) {
                window.AdminUI.disableUploadModalControls(false);
            } else {
                // 如果 AdminUI 不存在，直接調用本地方法
                this.disableUploadModalControls(false);
            }
        },

        // 顯示建立索引 Loading
        showBuildIndexLoading: function() {
            const loadingOverlay = document.getElementById('buildIndexLoadingOverlay');
            if (loadingOverlay) {
                loadingOverlay.style.display = 'flex';
            }
            // 禁用索引對話框控制項
            if (window.AdminUI && window.AdminUI.disableBuildIndexModalControls) {
                window.AdminUI.disableBuildIndexModalControls(true);
            } else {
                // 如果 AdminUI 不存在，直接調用本地方法
                this.disableBuildIndexModalControls(true);
            }
        },

        // 隱藏建立索引 Loading
        hideBuildIndexLoading: function() {
            const loadingOverlay = document.getElementById('buildIndexLoadingOverlay');
            if (loadingOverlay) {
                loadingOverlay.style.display = 'none';
            }
            // 恢復索引對話框控制項
            if (window.AdminUI && window.AdminUI.disableBuildIndexModalControls) {
                window.AdminUI.disableBuildIndexModalControls(false);
            } else {
                // 如果 AdminUI 不存在，直接調用本地方法
                this.disableBuildIndexModalControls(false);
            }
        },

        // 禁用/啟用上傳對話框控制項
        disableUploadModalControls: function(disabled) {
            const uploadModal = document.getElementById('uploadFileModal');
            if (!uploadModal) return;

            const controls = uploadModal.querySelectorAll('button, input[type="checkbox"], input[type="file"]');
            controls.forEach(control => {
                control.disabled = disabled;
                if (disabled) {
                    control.style.opacity = '0.5';
                    control.style.cursor = 'not-allowed';
                } else {
                    control.style.opacity = '';
                    control.style.cursor = '';
                }
            });

            // 特別處理全選checkbox
            const selectAllCheckbox = document.getElementById('selectAllFilesCheckbox');
            if (selectAllCheckbox) {
                selectAllCheckbox.disabled = disabled;
                if (disabled) {
                    selectAllCheckbox.style.opacity = '0.5';
                    selectAllCheckbox.style.cursor = 'not-allowed';
                } else {
                    selectAllCheckbox.style.opacity = '';
                    selectAllCheckbox.style.cursor = 'pointer';
                }
            }
        },

        // 禁用/啟用建立索引對話框控制項
        disableBuildIndexModalControls: function(disabled) {
            const buildIndexModal = document.getElementById('buildIndexModal');
            if (!buildIndexModal) return;

            const controls = buildIndexModal.querySelectorAll('button');
            controls.forEach(control => {
                control.disabled = disabled;
                if (disabled) {
                    control.style.opacity = '0.5';
                    control.style.cursor = 'not-allowed';
                } else {
                    control.style.opacity = '';
                    control.style.cursor = '';
                }
            });
        }
    };

    // 導出模組
    window.KnowledgeBaseModule = KnowledgeBaseModule;
})();