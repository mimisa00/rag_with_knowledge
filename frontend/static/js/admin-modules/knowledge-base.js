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
    
    // 標記是否從抽屜開始創建
    let isCreatingFromDrawer = false;

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
                const response = await fetch('/api/admin/knowledge-bases', {
                    credentials: 'include'
                });
                if (response.ok) {
                    const data = await response.json();
                    knowledgeBases = data.knowledge_bases;
                    this.updateKnowledgeBaseSelect();
                    
                    // 更新選擇卡片狀態
                    this.updateSelectCardStatus();
                } else {
                    console.error('載入知識庫列表失敗');
                }
            } catch (error) {
                console.error('載入知識庫列表錯誤：', error);
            }
        },
        
        // 更新選擇現有知識庫卡片狀態
        updateSelectCardStatus: function() {
            const selectCard = document.getElementById('selectExistingCard');
            if (!selectCard) return;
            
            if (!knowledgeBases || knowledgeBases.length === 0) {
                selectCard.classList.add('disabled');
                selectCard.onclick = null;
                selectCard.title = '目前沒有知識庫可選擇';
            } else {
                selectCard.classList.remove('disabled');
                selectCard.onclick = () => this.handleSelectExisting();
                selectCard.title = '';
            }
        },
        
        // 處理選擇現有知識庫
        handleSelectExisting: function() {
            if (!knowledgeBases || knowledgeBases.length === 0) {
                Dialog.info('目前沒有知識庫，請先創建新的知識庫');
                return;
            }
            
            // 禁用創建新知識庫卡片
            const createCard = document.querySelector('.quick-card[onclick*="create"]');
            if (createCard) {
                createCard.classList.add('disabled');
                createCard.onclick = null;
                createCard.title = '請先選擇現有知識庫或關閉抽屜';
            }
            
            // 禁用選擇現有知識庫卡片
            const selectCard = document.getElementById('selectExistingCard');
            if (selectCard) {
                selectCard.classList.add('disabled');
                selectCard.onclick = null;
                selectCard.title = '抽屜已開啟';
            }
            
            // 更新提示文字
            const emptyStateMessage = document.getElementById('emptyStateMessage');
            if (emptyStateMessage) {
                emptyStateMessage.textContent = '請從左側選擇知識庫或創建新的知識庫';
            }
            
            // 顯示抽屜的知識庫列表
            if (window.KBDrawerManager) {
                // 確保抽屜管理器已初始化
                if (!window.KBDrawerManager.container) {
                    window.KBDrawerManager.init();
                }
                
                // 載入知識庫列表到抽屜
                window.KBDrawerManager.loadKBList(knowledgeBases);
                
                window.KBDrawerManager.isOpenedBySelectExisting = true;  // 設置標記
                window.KBDrawerManager.showAndOpenDrawer();
                window.KBDrawerManager.showPanel('kbList');
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

            // 更新抽屜列表
            if (window.KBDrawerManager) {
                window.KBDrawerManager.loadKBList(knowledgeBases);
            }
        },

        // 設置知識庫管理模式
        setKBMode: function(mode) {
            currentKBMode = mode;

            // 控制界面元素顯示
            const emptyKBState = document.getElementById('emptyKBState');
            const selectedKBState = document.getElementById('selectedKBState');
            const previewButtons = document.getElementById('kbPreviewButtons');
            const formButtons = document.getElementById('kbFormButtons');
            
            // 控制狀態列顯示
            const statusBar = document.querySelector('.kb-status-bar');
            if (statusBar) {
                if (mode === KB_MODES.CREATE) {
                    statusBar.style.display = 'none';
                } else {
                    statusBar.style.display = 'flex';
                }
            }

            if (currentKBId || mode === KB_MODES.CREATE) {
                if (emptyKBState) {
                    emptyKBState.classList.add('d-none');
                }
                if (selectedKBState) {
                    selectedKBState.classList.remove('d-none');
                }

                // 在新布局中，檔案和索引操作通過 Tab 控制
                if (mode === KB_MODES.CREATE) {
                    // 創建模式：切換到資訊面板
                    if (window.KBDrawerManager) {
                        window.KBDrawerManager.showPanel('kbInfo');
                    }
                } else {
                    // 重新綁定 IndexModule 的事件
                    if (window.IndexModule && window.IndexModule.bindEvents) {
                        setTimeout(() => {
                            window.IndexModule.bindEvents();
                        }, 100);
                    }
                }

                if (previewButtons && formButtons) {
                    if (mode === KB_MODES.PREVIEW) {
                        previewButtons.classList.remove('d-none');
                        formButtons.classList.add('d-none');
                    } else {
                        previewButtons.classList.add('d-none');
                        formButtons.classList.remove('d-none');
                    }
                }
            } else {
                if (emptyKBState) {
                    emptyKBState.classList.remove('d-none');
                }
                if (selectedKBState) {
                    selectedKBState.classList.add('d-none');
                }
            }

            this.updateFormFieldsState(mode);
            this.updateButtonStates();
            
            // 根據模式啟用或禁用檔案相關 Tab
            if (mode === KB_MODES.PREVIEW && currentKBId) {
                // 在預覽模式下，根據知識庫狀態更新 Tab
                // 先嘗試從表單獲取狀態
                const kbStatusField = document.getElementById('kbStatus');
                let kbStatus = kbStatusField ? kbStatusField.value : null;
                
                // 如果表單中沒有，從知識庫列表中獲取
                if (!kbStatus) {
                    const kb = knowledgeBases.find(k => k.id === currentKBId);
                    kbStatus = kb ? kb.status : 'enable';
                }
                
                // 根據狀態更新 Tab
                this.updateTabsBasedOnStatus(kbStatus);
            } else if (mode === KB_MODES.EDIT && currentKBId) {
                // 編輯模式下也要檢查狀態
                const kbStatusField = document.getElementById('kbStatus');
                const kbStatus = kbStatusField ? kbStatusField.value : 'enable';
                this.updateTabsBasedOnStatus(kbStatus);
            } else if (mode === KB_MODES.CREATE) {
                // 創建模式下，預設啟用所有 Tab
                this.enableFileTabs();
            }
            
            // 更新麵包屑（新增模式或沒有選擇知識庫時，清除麵包屑）
            if (mode === KB_MODES.CREATE || !currentKBId) {
                this.updateBreadcrumb(null);
            }
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
            if (editBtn) {
                editBtn.disabled = !hasSelectedKB;
            }
            if (deleteBtn) {
                deleteBtn.disabled = !hasSelectedKB;
            }
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
                    // 更新麵包屑
                    this.updateBreadcrumb(kb.name);
                    
                    // 檢查索引狀態
                    await this.checkIndexStatus(kbId);
                    
                    // 更新狀態列（包含索引狀態）
                    this.updateStatusBar(kb);
                    const fileOperationsSection = document.getElementById('fileOperationsSection');
                    if (fileOperationsSection) {
                        fileOperationsSection.classList.remove('d-none');
                    }
                    // 確保隱藏提示訊息
                    const noKBSelected = document.getElementById('noKBSelected');
                    if (noKBSelected) {
                        noKBSelected.classList.add('d-none');
                    }
                    if (typeof window.IndexModule !== 'undefined') {
                        await window.IndexModule.loadFileList();
                        // 重新綁定事件（因為按鈕現在才顯示）
                        setTimeout(() => {
                            window.IndexModule.bindEvents();
                        }, 100);
                    }
                    
                    // 更新 TAB 狀態（檢查是否有檔案）
                    await this.updateTabStates(kbId);
                } else {
                    Dialog.error('載入知識庫詳情失敗');
                }
            } catch (error) {
                console.error('載入知識庫詳情錯誤：', error);
                Dialog.error('載入知識庫詳情失敗');
            }
        },
        
        // 檢查是否有檔案
        checkFilesExist: async function(kbId) {
            try {
                const formData = new FormData();
                formData.append("kb_id", kbId);
                const res = await fetch('/api/document/list/files', {
                    method: "POST",
                    body: formData
                });
                const data = await res.json();
                return data.files && data.files.length > 0;
            } catch (err) {
                console.error('檢查檔案失敗:', err);
                return false;
            }
        },
        
        // 更新 TAB 狀態
        updateTabStates: async function(kbId) {
            // 首先檢查知識庫狀態 - 如果停用則不修改 TAB 狀態
            const kb = knowledgeBases.find(k => k.id === kbId);
            const isKBDisabled = kb && kb.status === 'disable';
            
            // 如果知識庫停用，保持現有的禁用狀態，不執行後續邏輯
            if (isKBDisabled) {
                return;
            }
            
            const hasFiles = await this.checkFilesExist(kbId);
            const indexTab = document.querySelector('.tab-btn[onclick*="index"]');
            
            if (!indexTab) return;
            
            // 檢查是否已有索引
            const hasIndex = await this.checkHasIndex(kbId);
            
            if (!hasFiles && !hasIndex) {
                // 無檔案且無索引時才停用索引工具 TAB
                indexTab.disabled = true;
                indexTab.classList.add('disabled');
                indexTab.title = '需要先上傳檔案才能建立索引';
                
                // 如果當前在索引工具 TAB，自動切換到檔案管理
                const activeTab = document.querySelector('.tab-btn.active');
                if (activeTab && activeTab.textContent.includes('索引工具')) {
                    if (window.KBTabManager) {
                        window.KBTabManager.switchTab('files');
                    }
                }
            } else {
                // 有檔案或有索引時都啟用
                indexTab.disabled = false;
                indexTab.classList.remove('disabled');
                
                // 根據情況設置不同的提示
                if (!hasFiles && hasIndex) {
                    indexTab.title = '無檔案但有現存索引';
                } else {
                    indexTab.title = '';
                }
            }
            
            // 更新索引相關按鈕的狀態
            this.updateIndexButtons(hasIndex);
        },
        
        // 更新索引相關按鈕的狀態
        updateIndexButtons: function(hasIndex) {
            // 取得索引相關按鈕
            const deleteIndexBtn = document.querySelector('button[onclick*="deleteIndex"]');
            const showSummaryBtn = document.querySelector('button[onclick*="showIndexSummary100"]');
            const clearSummaryBtn = document.querySelector('button[onclick*="innerText"]');
            const fullContentBtn = document.querySelector('button[onclick*="showCurrentKBIndex"]');
            
            // 根據是否有索引來啟用/停用按鈕
            const buttons = [deleteIndexBtn, showSummaryBtn, clearSummaryBtn, fullContentBtn];
            
            buttons.forEach(btn => {
                if (btn) {
                    if (hasIndex) {
                        btn.disabled = false;
                        btn.classList.remove('disabled');
                        btn.style.opacity = '1';
                        btn.style.cursor = 'pointer';
                        btn.title = '';
                    } else {
                        btn.disabled = true;
                        btn.classList.add('disabled');
                        btn.style.opacity = '0.5';
                        btn.style.cursor = 'not-allowed';
                        btn.title = '需要先建立索引';
                    }
                }
            });
        },
        
        // 檢查是否有索引
        checkHasIndex: async function(kbId) {
            try {
                const res = await fetch(`/api/vector/index/validate?kb_id=${kbId}`, { 
                    method: "GET",
                    credentials: 'include'
                });
                
                if (res.ok) {
                    const data = await res.json();
                    // 根據 checkIndexStatus 的邏輯，status === 'ok' 表示有索引
                    return data.status === 'ok';
                }
                return false;
            } catch (err) {
                console.error('檢查索引失敗:', err);
                return false;
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
            
            // 根據知識庫狀態更新 Tab 和按鈕
            this.updateTabsBasedOnStatus(kb.status);
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
        
        // 更新狀態列內容
        // 檢查索引狀態
        checkIndexStatus: async function(kbId) {
            const indexStatusEl = document.getElementById('indexStatus');
            if (!indexStatusEl) return;
            
            try {
                const response = await fetch(`/api/vector/index/validate?kb_id=${kbId}`, {
                    credentials: 'include'
                });
                
                // 檢查 HTTP 狀態碼
                if (!response.ok) {
                    // API 錯誤（404、500 等）
                    console.error(`索引檢查 API 錯誤: HTTP ${response.status}`);
                    indexStatusEl.textContent = '檢查失敗';
                    indexStatusEl.style.color = '#6c757d';
                    return;
                }
                
                // 解析 JSON 回應
                let data;
                try {
                    data = await response.json();
                } catch (jsonError) {
                    // JSON 解析錯誤
                    console.error('索引檢查回應解析失敗:', jsonError);
                    indexStatusEl.textContent = '檢查失敗';
                    indexStatusEl.style.color = '#6c757d';
                    return;
                }
                
                // 根據狀態更新顯示
                const goToQABtn = document.getElementById('goToQABtn');
                if (data.status === 'ok') {
                    // 索引有效
                    const vectorCount = data.vectors || 0;
                    indexStatusEl.textContent = `已建立索引 (${vectorCount} 個向量)`;
                    indexStatusEl.style.color = '#28a745';
                    
                    // 啟用「前往問答」按鈕
                    if (goToQABtn) {
                        goToQABtn.disabled = false;
                        goToQABtn.title = '前往問答頁面使用此知識庫';
                    }
                } else if (data.status === 'invalid') {
                    // 索引無效
                    indexStatusEl.textContent = '未建立索引';
                    indexStatusEl.style.color = '#dc3545';
                    // 可選：在控制台顯示詳細原因
                    if (data.reason) {
                        console.log(`索引無效原因: ${data.reason}`);
                    }
                    
                    // 停用「前往問答」按鈕
                    if (goToQABtn) {
                        goToQABtn.disabled = true;
                        goToQABtn.title = '需要先建立索引';
                    }
                } else {
                    // 未知狀態
                    indexStatusEl.textContent = '狀態未知';
                    indexStatusEl.style.color = '#6c757d';
                    
                    // 停用「前往問答」按鈕
                    if (goToQABtn) {
                        goToQABtn.disabled = true;
                        goToQABtn.title = '需要先建立索引';
                    }
                }
                
            } catch (error) {
                // 網路錯誤或其他異常
                console.error('檢查索引狀態失敗:', error);
                indexStatusEl.textContent = '檢查失敗';
                indexStatusEl.style.color = '#6c757d';
            }
        },

        updateStatusBar: function(kb) {
            const nameEl = document.getElementById('currentKBName');
            const badgeEl = document.getElementById('kbStatusBadge');
            const fileCountEl = document.getElementById('fileCount');
            
            if (nameEl) nameEl.textContent = kb ? kb.name : '載入中...';
            if (badgeEl) {
                badgeEl.textContent = kb?.status === 'enable' ? '啟用' : '停用';
                badgeEl.className = kb?.status === 'enable' ? 'kb-status-badge badge-enable' : 'kb-status-badge badge-disable';
            }
            if (fileCountEl) fileCountEl.textContent = kb?.file_count || '0';
            // 索引狀態已在 checkIndexStatus 中更新
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
                // 無法載入預設提示詞
            }
        },

        enterEditMode: function() {
            if (!currentKBId) {
                Dialog.warning('請先選擇知識庫');
                return;
            }
            this.setKBMode(KB_MODES.EDIT);
            
            // 隱藏抽屜
            if (window.KBDrawerManager) {
                window.KBDrawerManager.hideCompletely();
            }
            
            // 禁用其他 Tab
            this.disableFileTabs();
        },

        enterPreviewMode: function() {
            this.setKBMode(KB_MODES.PREVIEW);
        },

        // 更新麵包屑導航
        // 選擇知識庫
        selectKnowledgeBase: function(kbId) {
            currentKBId = kbId;
            window.currentKBId = kbId;
            this.setKBMode(KB_MODES.PREVIEW);
            
            // 重新啟用創建新知識庫卡片（選擇知識庫後）
            const createCard = document.querySelector('.quick-card[onclick*="create"]');
            if (createCard) {
                createCard.classList.remove('disabled');
                createCard.onclick = () => window.KnowledgeBaseModule.showKBForm('create');
                createCard.title = '';
            }
            
            // 重新啟用選擇現有知識庫卡片
            const selectCard = document.getElementById('selectExistingCard');
            if (selectCard) {
                selectCard.classList.remove('disabled');
                selectCard.onclick = () => window.KnowledgeBaseModule.handleSelectExisting();
                selectCard.title = '';
            }
            
            // 重置抽屜標記（選擇知識庫後）
            if (window.KBDrawerManager) {
                window.KBDrawerManager.isOpenedBySelectExisting = false;
            }
            
            // 修正：使用正確的函數名稱
            this.loadKnowledgeBaseData(kbId);
            
            // 載入檔案列表
            if (window.IndexModule && window.IndexModule.loadFileList) {
                window.IndexModule.loadFileList();
            }
            
            // 取得知識庫來更新麵包屑和檢查狀態
            const kb = knowledgeBases.find(k => k.id === kbId);
            if (kb) {
                this.updateBreadcrumb(kb.name);
                // 移除這裡的 updateStatusBar()，讓 loadKnowledgeBaseData 載入完成後再更新
                
                // 根據知識庫狀態更新 Tab 和按鈕
                this.updateTabsBasedOnStatus(kb.status);
            } else {
                // 如果在列表中找不到，預設啟用所有 Tab
                this.enableFileTabs();
            }
        },
        
        // 更新狀態列
        updateStatusBar: function() {
            if (!currentKBId) return;
            
            const kb = knowledgeBases.find(k => k.id === currentKBId);
            if (!kb) return;
            
            // 更新名稱
            const nameEl = document.getElementById('currentKBName');
            if (nameEl) nameEl.textContent = kb.name;
            
            // 更新狀態
            const badgeEl = document.getElementById('kbStatusBadge');
            if (badgeEl) {
                badgeEl.textContent = kb.status === 'enable' ? '啟用' : '停用';
                badgeEl.className = kb.status === 'enable' ? 'kb-status-badge badge-enable' : 'kb-status-badge badge-disable';
            }
            
            // 更新檔案數量
            this.updateFileCount();
        },
        
        // 更新檔案數量
        updateFileCount: function() {
            const countEl = document.getElementById('fileCount');
            if (!countEl || !currentKBId) return;
            
            // 從檔案列表取得數量
            const fileList = document.getElementById('fileCheckboxList');
            if (fileList) {
                const files = fileList.querySelectorAll('.file-checkbox');
                countEl.textContent = files.length;
            }
        },
        
        // 顯示知識庫表單（新增或編輯）
        showKBForm: async function(mode, fromDrawer = false) {
            
            // 記錄是否從抽屜開始創建
            if (mode === 'create') {
                isCreatingFromDrawer = fromDrawer;
            }
            
            if (mode === 'create') {
                this.clearKnowledgeBaseForm();
                this.setKBMode(KB_MODES.CREATE);
                
                // 載入預設的系統提示詞
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
                    console.error('載入預設提示詞失敗:', error);
                }
                
                // 禁用其他 Tab，只啟用知識庫資訊 Tab
                this.disableFileTabs();
                
                // 更新麵包屑顯示"新建"
                this.updateBreadcrumb('新建');
                
                // 切換到知識庫資訊 Tab
                if (window.KBTabManager) {
                    window.KBTabManager.switchTab('info');
                }
                
                // 創建模式時隱藏抽屜
                if (window.KBDrawerManager) {
                    window.KBDrawerManager.hideCompletely();
                }
            } else if (mode === 'edit') {
                this.setKBMode(KB_MODES.EDIT);
                this.disableFileTabs();  // 禁用其他 Tab
                
                // 編輯模式時隱藏抽屜
                if (window.KBDrawerManager) {
                    window.KBDrawerManager.hideCompletely();
                }
            }
        },
        
        // 禁用檔案和索引 Tab
        disableFileTabs: function() {
            const tabs = document.querySelectorAll('.tab-btn');
            tabs.forEach(tab => {
                // 禁用除了知識庫資訊以外的所有 Tab
                if (!tab.textContent.includes('知識庫資訊')) {
                    tab.disabled = true;
                    tab.classList.add('disabled');
                }
            });
            
            // 為非資訊 Tab 的內容加上模糊遮罩
            const tabPanes = ['filesTab', 'indexTab', 'permissionsTab'];
            tabPanes.forEach(id => {
                const pane = document.getElementById(id);
                if (pane) {
                    pane.classList.add('disabled-overlay');
                }
            });
            
            // 切換到知識庫資訊 Tab
            if (window.KBTabManager) {
                window.KBTabManager.switchTab('info');
            }
        },
        
        // 啟用檔案和索引 Tab
        enableFileTabs: function() {
            const tabs = document.querySelectorAll('.tab-btn');
            tabs.forEach(tab => {
                tab.disabled = false;
                tab.classList.remove('disabled');
            });
            
            // 移除模糊遮罩
            const tabPanes = ['filesTab', 'indexTab', 'permissionsTab'];
            tabPanes.forEach(id => {
                const pane = document.getElementById(id);
                if (pane) {
                    pane.classList.remove('disabled-overlay');
                }
            });
        },
        
        // 根據知識庫狀態更新 Tab 和按鈕的可用性
        updateTabsBasedOnStatus: function(status) {
            const isDisabled = status === 'disable';
            
            // 需要禁用的 Tab（檔案管理、索引工具、權限設定）
            const tabsToDisable = [
                document.querySelector('.tab-btn[onclick*="files"]'),
                document.querySelector('.tab-btn[onclick*="index"]'),
                document.querySelector('.tab-btn[onclick*="permissions"]')
            ];
            
            // 更新 Tab 按鈕狀態
            tabsToDisable.forEach(tab => {
                if (tab) {
                    if (isDisabled) {
                        tab.disabled = true;
                        tab.classList.add('disabled');
                        tab.title = '知識庫已停用，無法使用此功能';
                    } else {
                        tab.disabled = false;
                        tab.classList.remove('disabled');
                        tab.title = '';
                    }
                }
            });
            
            // 更新 Tab 內容區域
            const tabPanes = ['filesTab', 'indexTab', 'permissionsTab'];
            tabPanes.forEach(id => {
                const pane = document.getElementById(id);
                if (pane) {
                    if (isDisabled) {
                        pane.classList.add('disabled-overlay');
                        // 添加停用提示（如果還沒有）
                        if (!pane.querySelector('.disabled-message')) {
                            const message = document.createElement('div');
                            message.className = 'disabled-message';
                            message.innerHTML = `
                                <i class="fas fa-exclamation-triangle"></i>
                                <p>知識庫已停用</p>
                                <small>請先啟用知識庫才能使用此功能</small>
                            `;
                            pane.appendChild(message);
                        }
                    } else {
                        pane.classList.remove('disabled-overlay');
                        // 移除停用提示
                        const message = pane.querySelector('.disabled-message');
                        if (message) {
                            message.remove();
                        }
                    }
                }
            });
            
            // 更新操作按鈕狀態
            const buttonsToDisable = [
                document.getElementById('uploadBtn'),
                document.getElementById('removeFilesBtn'),
                document.getElementById('prepareSelectedBtn'),
                document.querySelector('button[onclick*="showIndexSummary100"]'),
                document.querySelector('button[onclick*="showCurrentKBIndex"]')
            ];
            
            buttonsToDisable.forEach(btn => {
                if (btn) {
                    if (isDisabled) {
                        btn.disabled = true;
                        btn.classList.add('disabled');
                        btn.title = '知識庫已停用';
                    } else {
                        btn.disabled = false;
                        btn.classList.remove('disabled');
                        btn.title = '';
                    }
                }
            });
            
            // 如果當前在被禁用的 Tab 上，切換到知識庫資訊 Tab
            if (isDisabled) {
                const activeTab = document.querySelector('.tab-btn.active');
                if (activeTab && (activeTab.textContent.includes('檔案管理') || 
                                 activeTab.textContent.includes('索引工具') || 
                                 activeTab.textContent.includes('權限設定'))) {
                    if (window.KBTabManager) {
                        window.KBTabManager.switchTab('info');
                    }
                }
            }
        },

        updateBreadcrumb: function(kbName) {
            const kbLink = document.getElementById('breadcrumb-kb-link');
            const kbCurrent = document.getElementById('breadcrumb-kb-current');
            const separator = document.getElementById('breadcrumb-kb-separator');
            const kbNameItem = document.getElementById('breadcrumb-kb-name');
            const kbNameText = document.getElementById('breadcrumb-kb-name-text');
            
            if (kbName) {
                // 有選擇知識庫或新建時：知識庫管理變成連結，顯示知識庫名稱或"新建"
                if (kbLink) kbLink.classList.remove('d-none');
                if (kbCurrent) kbCurrent.classList.add('d-none');
                if (separator) separator.classList.remove('d-none');
                if (kbNameItem) kbNameItem.classList.remove('d-none');
                if (kbNameText) kbNameText.textContent = kbName;
            } else {
                // 未選擇知識庫時：知識庫管理是當前頁面（純文字）
                if (kbLink) kbLink.classList.add('d-none');
                if (kbCurrent) kbCurrent.classList.remove('d-none');
                if (separator) separator.classList.add('d-none');
                if (kbNameItem) kbNameItem.classList.add('d-none');
            }
        },

        // 處理麵包屑點擊（無需確認）
        handleBreadcrumbClick: function() {
            currentKBId = null;
            this.clearKnowledgeBaseForm();
            
            // 顯示空狀態，隱藏選中狀態
            const emptyKBState = document.getElementById('emptyKBState');
            const selectedKBState = document.getElementById('selectedKBState');
            if (emptyKBState) {
                emptyKBState.classList.remove('d-none');
            }
            if (selectedKBState) {
                selectedKBState.classList.add('d-none');
            }
            
            // 完全隱藏抽屜（回到初始狀態）
            if (window.KBDrawerManager) {
                window.KBDrawerManager.isOpenedBySelectExisting = false;  // 重置標記
                window.KBDrawerManager.hideCompletely();
            }
            
            // 清除列表中的選中狀態
            const items = document.querySelectorAll('#kbList li');
            items.forEach(item => item.classList.remove('active'));
            
            // 重新啟用創建新知識庫卡片
            const createCard = document.querySelector('.quick-card[onclick*="create"]');
            if (createCard) {
                createCard.classList.remove('disabled');
                createCard.onclick = () => window.KnowledgeBaseModule.showKBForm('create');
                createCard.title = '';
            }
            
            // 重新啟用選擇現有知識庫卡片
            const selectCard = document.getElementById('selectExistingCard');
            if (selectCard) {
                selectCard.classList.remove('disabled');
                selectCard.onclick = () => window.KnowledgeBaseModule.handleSelectExisting();
                selectCard.title = '';
            }
            
            // 恢復預設提示文字
            const emptyStateMessage = document.getElementById('emptyStateMessage');
            if (emptyStateMessage) {
                emptyStateMessage.textContent = '請選擇知識庫或創建新的知識庫';
            }
            
            // 檢查元素是否存在
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
            this.updateBreadcrumb(null);
        },

        returnToEmptyState: function() {
            // 直接呼叫 handleBreadcrumbClick，無需確認
            this.handleBreadcrumbClick();
        },

        // 取消操作
        cancelKBOperation: function() {
            if (currentKBMode === KB_MODES.CREATE || currentKBMode === KB_MODES.EDIT) {
                Dialog.confirm('確定要取消嗎？未儲存的變更將會遺失。', () => {
                    if (currentKBMode === KB_MODES.CREATE) {
                        // 先保存從抽屜創建的狀態
                        const wasCreatingFromDrawer = isCreatingFromDrawer;
                        
                        currentKBId = null;
                        this.clearKnowledgeBaseForm();
                        this.setKBMode(KB_MODES.PREVIEW);
                        this.enableFileTabs();
                        
                        // 清除麵包屑
                        this.updateBreadcrumb(null);
                        
                        // 隱藏選中狀態區域，顯示空狀態
                        const emptyKBState = document.getElementById('emptyKBState');
                        const selectedKBState = document.getElementById('selectedKBState');
                        if (emptyKBState) {
                            emptyKBState.classList.remove('d-none');
                        }
                        if (selectedKBState) {
                            selectedKBState.classList.add('d-none');
                        }
                        
                        // 如果是從抽屜開始創建，保持抽屜開啟
                        if (wasCreatingFromDrawer) {
                            // 保持抽屜開啟
                            if (window.KBDrawerManager) {
                                // 確保抽屜管理器已初始化
                                if (!window.KBDrawerManager.container) {
                                    window.KBDrawerManager.init();
                                }
                                
                                // 載入知識庫列表
                                window.KBDrawerManager.loadKBList(knowledgeBases);
                                
                                window.KBDrawerManager.isOpenedBySelectExisting = true;  // 設置標記
                                if (!window.KBDrawerManager.isOpen) {
                                    window.KBDrawerManager.showAndOpenDrawer();
                                    // 確保顯示知識庫列表面板
                                    setTimeout(() => {
                                        window.KBDrawerManager.showPanel('kbList');
                                    }, 150);
                                }
                            }
                            
                            // 禁用兩個卡片
                            const createCard = document.querySelector('.quick-card[onclick*="create"]');
                            if (createCard) {
                                createCard.classList.add('disabled');
                                createCard.onclick = null;
                                createCard.title = '請先選擇現有知識庫或關閉抽屜';
                            }
                            
                            const selectCard = document.getElementById('selectExistingCard');
                            if (selectCard) {
                                selectCard.classList.add('disabled');
                                selectCard.onclick = null;
                                selectCard.title = '抽屜已開啟';
                            }
                            
                            // 更新提示文字
                            const emptyStateMessage = document.getElementById('emptyStateMessage');
                            if (emptyStateMessage) {
                                emptyStateMessage.textContent = '請從左側選擇知識庫或創建新的知識庫';
                            }
                        } else {
                            // 如果不是從抽屜開始，則完全隱藏抽屜（回到初始狀態）
                            if (window.KBDrawerManager) {
                                window.KBDrawerManager.hideCompletely();
                            }
                            
                            // 更新選擇卡片狀態（根據是否有知識庫來決定是否啟用）
                            this.updateSelectCardStatus();
                        }
                        
                        // 最後才重置標記
                        isCreatingFromDrawer = false;
                    } else if (currentKBId) {
                        // 從編輯模式取消，恢復到預覽模式
                        this.loadKnowledgeBaseData(currentKBId);
                        
                        // 恢復顯示抽屜
                        if (window.KBDrawerManager) {
                            window.KBDrawerManager.showDrawer();
                        }
                    }
                });
            }
        },

        // 驗證表單資料
        validateKBForm: function(mode) {
            const kbId = document.getElementById('kbId').value.trim();
            const kbName = document.getElementById('kbName').value.trim();

            if (mode === KB_MODES.CREATE) {
                if (!kbId) {
                    Dialog.warning('請填入知識庫 ID');
                    return false;
                }
                if (!/^[a-zA-Z0-9_-]{1,36}$/.test(kbId)) {
                    Dialog.warning('知識庫 ID 只能包含英文、數字、底線和連字符，長度不超過36字元');
                    return false;
                }
            }

            if (!kbName) {
                Dialog.warning('請填入知識庫名稱');
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
                    Dialog.success(message);
                    await this.loadKnowledgeBases();
                    if (currentKBMode === KB_MODES.CREATE) {
                        const newKBId = document.getElementById('kbId').value.trim();
                        currentKBId = newKBId;
                        
                        // 重置從抽屜創建的標記
                        isCreatingFromDrawer = false;
                        
                        // 載入新知識庫資料
                        await this.loadKnowledgeBaseData(newKBId);
                        
                        // 啟用所有 Tab
                        this.enableFileTabs();
                        
                        // 先重新載入知識庫列表
                        await this.loadKnowledgeBases();
                        
                        // 顯示左側抽屜並展開，讓用戶看到新建的知識庫
                        if (window.KBDrawerManager) {
                            
                            // 確保設置 currentKBId 以便列表能正確標記選中狀態
                            window.currentKBId = newKBId;
                            
                            // 確保抽屜管理器已初始化
                            if (!window.KBDrawerManager.container) {
                                window.KBDrawerManager.init();
                            }
                            
                            // 更新抽屜中的列表顯示
                            window.KBDrawerManager.loadKBList(knowledgeBases);
                            
                            // 顯示並打開抽屜，讓內容可見
                            window.KBDrawerManager.showAndOpenDrawer();
                            
                            // 確保顯示知識庫列表面板
                            setTimeout(() => {
                                window.KBDrawerManager.showPanel('kbList');
                            }, 150);
                        } else {
                            console.error('KBDrawerManager not found!');
                        }
                        
                        // 檢查元素是否存在再設置值
                        const emptySelect = document.getElementById('emptyKnowledgeBaseSelect');
                        if (emptySelect) {
                            emptySelect.value = newKBId;
                        }
                    } else {
                        // 編輯模式成功保存
                        await this.loadKnowledgeBaseData(currentKBId);
                        
                        // 獲取最新的知識庫狀態並更新 Tab
                        const updatedStatus = document.getElementById('kbStatus').value;
                        this.updateTabsBasedOnStatus(updatedStatus);
                        
                        // 恢復顯示抽屜
                        if (window.KBDrawerManager) {
                            window.KBDrawerManager.showDrawer();
                        }
                    }
                } else if (response) {
                    // 只有在有 response 時才嘗試解析錯誤
                    try {
                        const error = await response.json();
                        Dialog.error(`操作失敗：${error.detail || '未知錯誤'}`);
                    } catch (e) {
                        Dialog.error(`操作失敗：HTTP ${response.status}`);
                    }
                } else {
                    Dialog.error('操作失敗：無法連接到伺服器');
                }
            } catch (error) {
                console.error('保存知識庫錯誤：', error);
                // 只在真正的異常情況下顯示此訊息
                Dialog.error(`保存知識庫時發生錯誤：${error.message || '未知錯誤'}`);
            }
        },

        // 刪除知識庫
        deleteKnowledgeBase: async function() {
            if (!currentKBId) {
                Dialog.warning('請先選擇知識庫');
                return;
            }

            Dialog.confirm('確定要刪除此知識庫嗎？刪除後將無法復原。', () => {
                // 直接執行完全刪除
                this.performDelete(true);
            });
        },

        // 執行刪除操作
        performDelete: async function(deleteFiles) {
            try {
                const response = await fetch(`/api/knowledge-bases/${currentKBId}?delete_files=${deleteFiles}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });

                if (response.ok) {
                    Dialog.success('知識庫刪除成功');
                    
                    // 清空當前狀態
                    currentKBId = null;
                    const knowledgeBaseSelect = document.getElementById('knowledgeBaseSelect');
                    if (knowledgeBaseSelect) {
                        knowledgeBaseSelect.value = '';
                    }
                    this.clearKnowledgeBaseForm();
                    this.setKBMode(KB_MODES.PREVIEW);
                    
                    // 重新載入知識庫列表
                    await this.loadKnowledgeBases();
                    
                    // 更新左側抽屜列表
                    if (window.KBDrawerManager) {
                        window.KBDrawerManager.loadKBList(knowledgeBases);
                    }
                    
                    // 檢查是否還有知識庫
                    if (knowledgeBases && knowledgeBases.length > 0) {
                        // 如果還有知識庫，打開抽屜讓用戶選擇
                        if (window.KBDrawerManager) {
                            window.KBDrawerManager.showAndOpenDrawer();
                        }
                        
                        // 顯示空狀態
                        this.showEmptyState();
                        
                        // 禁用快速卡片
                        this.disableQuickCards();
                    } else {
                        // 如果沒有知識庫了，返回系統管理中心
                        Dialog.info('所有知識庫已刪除，即將返回系統管理中心');
                        
                        // 延遲返回讓用戶看到訊息
                        setTimeout(() => {
                            window.location.href = '/admin';
                        }, 2000);
                    }
                    
                    // 重置麵包屑
                    this.resetBreadcrumb();
                } else {
                    const error = await response.json();
                    Dialog.error(`刪除失敗：${error.detail}`);
                }
            } catch (error) {
                console.error('刪除知識庫錯誤：', error);
                Dialog.error('刪除知識庫失敗');
            }
        },
        
        // 顯示空狀態頁面
        showEmptyState: function() {
            const emptyKBState = document.getElementById('emptyKBState');
            const selectedKBState = document.getElementById('selectedKBState');
            
            if (emptyKBState) {
                emptyKBState.classList.remove('d-none');
            }
            if (selectedKBState) {
                selectedKBState.classList.add('d-none');
            }
            
            // 重置文件操作區
            const fileOperationsSection = document.getElementById('fileOperationsSection');
            if (fileOperationsSection) {
                fileOperationsSection.classList.add('d-none');
            }
            
            // 更新選擇卡片狀態
            this.updateSelectCardStatus();
        },
        
        // 禁用快速卡片
        disableQuickCards: function() {
            // 禁用創建新知識庫卡片
            const createCard = document.querySelector('.quick-card[onclick*="create"]');
            if (createCard) {
                createCard.classList.add('disabled');
                createCard.onclick = null;
                createCard.title = '請從左側列表選擇知識庫';
            }
            
            // 禁用選擇現有知識庫卡片
            const selectCard = document.getElementById('selectExistingCard');
            if (selectCard) {
                selectCard.classList.add('disabled');
                selectCard.onclick = null;
                selectCard.title = '請從左側列表選擇知識庫';
            }
            
            // 更新提示文字
            const emptyStateMessage = document.getElementById('emptyStateMessage');
            if (emptyStateMessage) {
                emptyStateMessage.textContent = '請從左側列表選擇知識庫';
            }
        },
        
        // 啟用快速卡片
        enableQuickCards: function() {
            // 啟用創建新知識庫卡片
            const createCard = document.querySelector('.quick-card[onclick*="create"]');
            if (createCard) {
                createCard.classList.remove('disabled');
                createCard.onclick = () => window.KnowledgeBaseModule.showKBForm('create');
                createCard.title = '';
            }
            
            // 啟用選擇現有知識庫卡片（如果有知識庫）
            const selectCard = document.getElementById('selectExistingCard');
            if (selectCard) {
                if (knowledgeBases && knowledgeBases.length > 0) {
                    selectCard.classList.remove('disabled');
                    selectCard.onclick = () => window.KnowledgeBaseModule.handleSelectExisting();
                    selectCard.title = '';
                } else {
                    selectCard.classList.add('disabled');
                    selectCard.onclick = null;
                    selectCard.title = '目前沒有知識庫可選擇';
                }
            }
            
            // 恢復預設提示文字
            const emptyStateMessage = document.getElementById('emptyStateMessage');
            if (emptyStateMessage) {
                emptyStateMessage.textContent = '請選擇知識庫或創建新的知識庫';
            }
        },
        
        // 重置麵包屑
        resetBreadcrumb: function() {
            const breadcrumbKbLink = document.getElementById('breadcrumb-kb-link');
            const breadcrumbKbCurrent = document.getElementById('breadcrumb-kb-current');
            const breadcrumbKbSeparator = document.getElementById('breadcrumb-kb-separator');
            const breadcrumbKbName = document.getElementById('breadcrumb-kb-name');
            
            if (breadcrumbKbLink) breadcrumbKbLink.classList.add('d-none');
            if (breadcrumbKbCurrent) breadcrumbKbCurrent.classList.remove('d-none');
            if (breadcrumbKbSeparator) breadcrumbKbSeparator.classList.add('d-none');
            if (breadcrumbKbName) breadcrumbKbName.classList.add('d-none');
        },

        // 更新字數統計
        updateCharCount: function() {
            const textarea = document.getElementById('kbSystemPrompt');
            const counter = document.getElementById('promptCharCount');
            counter.textContent = textarea.value.length;
        },


        // 顯示索引
        showCurrentKBIndex: function() {
            if (!currentKBId) {
                Dialog.warning('請先選擇知識庫');
                return;
            }
            window.open(`/showindex?kb_id=${currentKBId}`, '_blank');
        },


        // 空狀態知識庫選擇變更
        onEmptyKnowledgeBaseSelectionChange: async function() {
            const select = document.getElementById('emptyKnowledgeBaseSelect');
            if (!select) {
                return; // 如果元素不存在，直接返回
            }
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
            // 綁定全域函數
            window.selectKnowledgeBase = (kbId) => this.selectKnowledgeBase(kbId);
            window.showKBForm = (mode) => this.showKBForm(mode);
            // handleSelectExisting 已經是 window.KnowledgeBaseModule 的方法，不需要重新綁定
            // 檢查元素是否存在再綁定事件
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
                // 使用箭頭函數確保 this 指向正確
                deleteBtn.addEventListener('click', () => {
                    this.deleteKnowledgeBase();
                });
            }

            // 綁定麵包屑點擊事件
            const breadcrumbKbLink = document.getElementById('breadcrumb-kb-link');
            if (breadcrumbKbLink) {
                breadcrumbKbLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handleBreadcrumbClick();
                });
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
            const loaderIcon = loadingOverlay ? loadingOverlay.querySelector('.loader') : null;
            const loaderText = loadingOverlay ? loadingOverlay.querySelector('.loading-text') : null;
            
            // 重置到初始狀態，清除之前的成功狀態
            if (loaderIcon) {
                loaderIcon.classList.remove('success');
                loaderIcon.style.transition = '';
                loaderIcon.style.opacity = '';
                loaderIcon.style.animation = '';
                loaderIcon.style.transform = '';
            }
            if (loaderText) {
                loaderText.classList.remove('success');
                loaderText.style.transition = '';
                loaderText.style.opacity = '';
                loaderText.textContent = '檔案內容分析處理中'; // 重置為初始文字
            }
            
            if (loadingOverlay) {
                loadingOverlay.classList.remove('d-none');
                loadingOverlay.style.display = 'flex';
                loadingOverlay.style.opacity = '1'; // 確保初始透明度
            }
            // 禁用上傳對話框控制項
            if (window.AdminUI && window.AdminUI.disableUploadModalControls) {
                window.AdminUI.disableUploadModalControls(true);
            } else {
                // 如果 AdminUI 不存在，直接調用本地方法
                this.disableUploadModalControls(true);
            }
        },

        // 平滑停止上傳 Loading（參考 CommonUI.stopSpinner）
        stopUploadLoading: function() {
            const loadingOverlay = document.getElementById('uploadLoadingOverlay');
            const loaderIcon = loadingOverlay ? loadingOverlay.querySelector('.loader') : null;
            const loaderText = loadingOverlay ? loadingOverlay.querySelector('.loading-text') : null;
            
            if (!loadingOverlay) return;

            // 第一階段：同時淡出圖示和文字
            if (loaderIcon) {
                loaderIcon.style.transition = 'opacity 1s ease';
                loaderIcon.style.opacity = '0';
            }
            if (loaderText) {
                loaderText.style.transition = 'opacity 1s ease';
                loaderText.style.opacity = '0';
            }
            
            // 第二階段：1200ms 後顯示成功狀態（等待 Spinner 和文字完全淡出）
            setTimeout(() => {
                if (loaderIcon) {
                    // 強制 reflow，確保下一步 transition 生效
                    void loaderIcon.offsetWidth;
                    // 設置成功狀態
                    loaderIcon.classList.add('success');
                    loaderIcon.style.transition = 'transform 2s ease-out, opacity 2s ease-in';
                    loaderIcon.style.opacity = '1';
                    loaderIcon.style.animation = 'none';
                }

                if (loaderText) {
                    loaderText.style.transition = 'transform 2s ease-out, opacity 2s ease-in';
                    loaderText.style.opacity = '1';
                    loaderText.textContent = '檔案上傳完成';
                    loaderText.classList.add('success');
                }
            }, 1200);
            
            // 第三階段：4600ms 後開始同步淡出（Loading overlay + Modal）
            setTimeout(() => {
                if (loadingOverlay) {
                    loadingOverlay.style.opacity = '0';
                }
                // 同時開始 Modal 淡出
                if (window.IndexModule && window.IndexModule.closeUploadModalAuto) {
                    window.IndexModule.closeUploadModalAuto(); // false = 使用淡出動畫
                }
            }, 4200);
            
            // 第四階段：9000ms 後完全隱藏並恢復控制項
            setTimeout(() => {
                if (loadingOverlay) {
                    loadingOverlay.style.display = 'none';
                    loadingOverlay.classList.add('d-none');
                    // 重置狀態供下次使用
                    if (loaderIcon) {
                        loaderIcon.classList.remove('success');
                        loaderIcon.style.transition = '';
                        loaderIcon.style.opacity = '';
                        loaderIcon.style.animation = '';
                        loaderIcon.style.transform = '';
                    }
                    if (loaderText) {
                        loaderText.classList.remove('success');
                        loaderText.style.transition = '';
                        loaderText.style.opacity = '';
                    }
                    loadingOverlay.style.opacity = '1';
                }
                
                // 恢復上傳對話框控制項
                if (window.AdminUI && window.AdminUI.disableUploadModalControls) {
                    window.AdminUI.disableUploadModalControls(false);
                } else {
                    // 如果 AdminUI 不存在，直接調用本地方法
                    this.disableUploadModalControls(false);
                }
            }, 6200);
        },

        // 顯示建立索引 Loading
        showBuildIndexLoading: function() {
            const loadingOverlay = document.getElementById('buildIndexLoadingOverlay');
            const loaderIcon = loadingOverlay ? loadingOverlay.querySelector('.loader') : null;
            const loaderText = loadingOverlay ? loadingOverlay.querySelector('.loading-text') : null;
            
            // 重置到初始狀態，清除之前的成功狀態
            if (loaderIcon) {
                loaderIcon.classList.remove('success');
                loaderIcon.style.transition = '';
                loaderIcon.style.opacity = '';
                loaderIcon.style.animation = '';
                loaderIcon.style.transform = '';
            }
            if (loaderText) {
                loaderText.classList.remove('success');
                loaderText.style.transition = '';
                loaderText.style.opacity = '';
                loaderText.textContent = '索引重建處理中'; // 重置為初始文字
            }
            
            if (loadingOverlay) {
                loadingOverlay.classList.remove('d-none');
                loadingOverlay.style.display = 'flex';
                loadingOverlay.style.opacity = '1'; // 確保初始透明度
            }
            // 禁用索引對話框控制項
            if (window.AdminUI && window.AdminUI.disableBuildIndexModalControls) {
                window.AdminUI.disableBuildIndexModalControls(true);
            } else {
                // 如果 AdminUI 不存在，直接調用本地方法
                this.disableBuildIndexModalControls(true);
            }
        },

        // 平滑停止建立索引 Loading（參考 CommonUI.stopSpinner）
        stopBuildIndexLoading: function() {
            const loadingOverlay = document.getElementById('buildIndexLoadingOverlay');
            const loaderIcon = loadingOverlay ? loadingOverlay.querySelector('.loader') : null;
            const loaderText = loadingOverlay ? loadingOverlay.querySelector('.loading-text') : null;
            
            if (!loadingOverlay) return;

            // 第一階段：同時淡出圖示和文字
            if (loaderIcon) {
                loaderIcon.style.transition = 'opacity 1s ease';
                loaderIcon.style.opacity = '0';
            }
            if (loaderText) {
                loaderText.style.transition = 'opacity 1s ease';
                loaderText.style.opacity = '0';
            }
            
            // 第二階段：1200ms 後顯示成功狀態（等待 Spinner 和文字完全淡出）
            setTimeout(() => {
                if (loaderIcon) {
                    // 強制 reflow，確保下一步 transition 生效
                    void loaderIcon.offsetWidth;
                    // 設置成功狀態
                    loaderIcon.classList.add('success');
                    loaderIcon.style.transition = 'transform 2s ease-out, opacity 2s ease-in';
                    loaderIcon.style.opacity = '1';
                    loaderIcon.style.animation = 'none';
                }

                if (loaderText) {
                    loaderText.style.transition = 'transform 2s ease-out, opacity 2s ease-in';
                    loaderText.style.opacity = '1';
                    loaderText.textContent = '索引建立完成';
                    loaderText.classList.add('success');
                }
            }, 1200);
            
            // 第三階段：4600ms 後開始同步淡出（Loading overlay + Modal）
            setTimeout(() => {
                if (loadingOverlay) {
                    loadingOverlay.style.opacity = '0';
                }
                // 同時開始 Modal 淡出
                if (window.IndexModule && window.IndexModule.closeBuildIndexModalAuto) {
                    window.IndexModule.closeBuildIndexModalAuto(); // false = 使用淡出動畫
                }
            }, 4200);
            
            // 第四階段：9000ms 後完全隱藏並恢復控制項
            setTimeout(() => {
                if (loadingOverlay) {
                    loadingOverlay.style.display = 'none';
                    loadingOverlay.classList.add('d-none');
                    // 重置狀態供下次使用
                    if (loaderIcon) {
                        loaderIcon.classList.remove('success');
                        loaderIcon.style.transition = '';
                        loaderIcon.style.opacity = '';
                        loaderIcon.style.animation = '';
                        loaderIcon.style.transform = '';
                    }
                    if (loaderText) {
                        loaderText.classList.remove('success');
                        loaderText.style.transition = '';
                        loaderText.style.opacity = '';
                    }
                    loadingOverlay.style.opacity = '1';
                }
                
                // 恢復索引對話框控制項
                if (window.AdminUI && window.AdminUI.disableBuildIndexModalControls) {
                    window.AdminUI.disableBuildIndexModalControls(false);
                } else {
                    // 如果 AdminUI 不存在，直接調用本地方法
                    this.disableBuildIndexModalControls(false);
                }
            }, 6200);
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

    // ===== 頁面初始化邏輯 (從 knowledge-base-page.js 移植) =====
    
    // 綁定知識庫管理專用的全域函數
    function bindKBGlobalFunctions() {
        // 知識庫管理相關
        window.showCurrentKBIndex = () => KnowledgeBaseModule.showCurrentKBIndex();
        
        // 索引管理相關
        if (window.IndexModule) {
            window.selectFiles = () => window.IndexModule.selectFiles();
            window.clearSelectedFiles = () => window.IndexModule.clearSelectedFiles();
            window.startUpload = () => window.IndexModule.startUpload();
            window.closeUploadModal = () => window.IndexModule.closeUploadModal();
            window.toggleSelectAllFiles = () => window.IndexModule.toggleSelectAllFiles();
            window.removeSelectedFiles = () => window.IndexModule.removeSelectedFiles();
            window.closeRemoveFileModal = () => window.IndexModule.closeRemoveFileModal();
            window.confirmRemoveFiles = () => window.IndexModule.confirmRemoveFiles();
            window.toggleSelectAllUploadedFiles = () => window.IndexModule.toggleSelectAllUploadedFiles();
            window.closeBuildIndexModal = () => window.IndexModule.closeBuildIndexModal();
            window.confirmBuildIndex = () => window.IndexModule.confirmBuildIndex();
            window.showIndexSummary100 = () => window.IndexModule.showIndexSummary100();
            window.deleteIndex = () => window.IndexModule.deleteIndex();
        }
        
        // 返回管理首頁（保留這個，因為是頁面特定的）
        window.returnToAdmin = function() {
            window.location.href = '/admin';
        };
    }

    // 頁面初始化函數
    function initKnowledgeBasePage() {
        
        // 初始化抽屜管理器（必須在 KnowledgeBaseModule 之前）
        if (window.KBDrawerManager) {
            window.KBDrawerManager.init();
        }
        
        // 初始化 Tab 管理器
        if (window.KBTabManager) {
            window.KBTabManager.init();
        }
        
        // 初始化知識庫管理模組
        KnowledgeBaseModule.init();
        
        // 初始化索引管理模組
        if (window.IndexModule) {
            window.IndexModule.init();
        }
        
        // 初始化用戶選單（會載入用戶資訊）
        if (window.UserMenu) {
            window.UserMenu.init();
        }
        
        // 綁定知識庫管理專用的全域函數
        bindKBGlobalFunctions();
        
        // 隱藏載入指示器
        const loaderOverlay = document.getElementById('loader-overlay');
        if (loaderOverlay) {
            setTimeout(() => {
                loaderOverlay.classList.remove('show');
            }, 500);
        }
        
    }

    // 導出初始化函數供外部調用
    window.initKnowledgeBasePage = initKnowledgeBasePage;
})();