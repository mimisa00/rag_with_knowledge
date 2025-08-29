/**
 * 知識庫抽屜管理器
 * 處理抽屜的展開/收合及面板切換
 */
(function() {
    'use strict';

    class KBDrawerManager {
        constructor() {
            this.container = null;
            this.panels = {};
            this.isOpen = false;
            this.isVisible = false;
            this.isOpenedBySelectExisting = false;  // 標記是否通過「選擇現有知識庫」打開
        }

        // 初始化
        init() {
            this.container = document.getElementById('kbDrawerContainer');
            if (!this.container) return;

            // 獲取所有面板
            this.panels = {
                kbList: document.getElementById('kbListPanel'),
                kbInfo: document.getElementById('kbInfoPanel'),
                kbSettings: document.getElementById('kbSettingsPanel')
            };

            // 初始完全隱藏抽屜
            this.hideCompletely();

            // 綁定搜尋功能
            this.bindSearchEvents();
        }
        
        // 完全隱藏抽屜（不佔空間）
        hideCompletely() {
            if (this.container) {
                this.container.style.display = 'none';
                this.isVisible = false;
                this.isOpen = false;
                
                // 重置標記
                this.isOpenedBySelectExisting = false;
                
                // 重新啟用創建新知識庫卡片
                const createCard = document.querySelector('.quick-card[onclick*="create"]');
                if (createCard) {
                    createCard.classList.remove('disabled');
                    createCard.onclick = () => window.KnowledgeBaseModule.showKBForm('create');
                    createCard.title = '';
                }
                
                // 重新啟用選擇現有知識庫卡片（僅在有知識庫時）
                const selectCard = document.getElementById('selectExistingCard');
                if (selectCard && window.KnowledgeBaseModule) {
                    // 調用模組的更新函數來正確設置卡片狀態
                    window.KnowledgeBaseModule.updateSelectCardStatus();
                }
                
                // 恢復預設提示文字
                const emptyStateMessage = document.getElementById('emptyStateMessage');
                if (emptyStateMessage) {
                    emptyStateMessage.textContent = '請選擇知識庫或創建新的知識庫';
                }
            }
        }
        
        // 顯示抽屜（收合狀態）
        showDrawer() {
            if (this.container) {
                this.container.style.display = 'flex';  // 明確設置為 flex
                this.container.classList.remove('drawer-open');
                this.container.classList.add('drawer-closed');
                this.isVisible = true;
                this.isOpen = false;
            }
        }
        
        // 顯示並打開抽屜
        showAndOpenDrawer() {
            this.showDrawer();
            setTimeout(() => {
                this.openDrawer();
            }, 100);
        }

        // 切換抽屜狀態
        toggleDrawer() {
            // 如果完全隱藏，先顯示
            if (!this.isVisible) {
                this.showDrawer();
                return;
            }
            
            if (this.isOpen) {
                this.closeDrawer();
            } else {
                this.openDrawer();
            }
        }

        // 打開抽屜
        openDrawer() {
            if (!this.container) return;
            
            this.container.classList.remove('drawer-closed');
            this.container.classList.add('drawer-open');
            this.isOpen = true;
            
            // 儲存狀態
            localStorage.setItem('kbDrawerOpen', 'true');
        }

        // 關閉抽屜
        closeDrawer() {
            if (!this.container) return;
            
            this.container.classList.remove('drawer-open');
            this.container.classList.add('drawer-closed');
            this.isOpen = false;
            
            // 只有在不是通過「選擇現有知識庫」打開的情況下，才重新啟用卡片
            if (!this.isOpenedBySelectExisting) {
                // 如果還在空狀態頁面，重新啟用兩個卡片
                const emptyKBState = document.getElementById('emptyKBState');
                if (emptyKBState && !emptyKBState.classList.contains('d-none')) {
                    const createCard = document.querySelector('.quick-card[onclick*="create"]');
                    if (createCard) {
                        createCard.classList.remove('disabled');
                        createCard.onclick = () => window.KnowledgeBaseModule.showKBForm('create');
                        createCard.title = '';
                    }
                    
                    const selectCard = document.getElementById('selectExistingCard');
                    if (selectCard && window.KnowledgeBaseModule) {
                        // 調用模組的更新函數來正確設置卡片狀態
                        window.KnowledgeBaseModule.updateSelectCardStatus();
                    }
                    
                    // 恢復預設提示文字
                    const emptyStateMessage = document.getElementById('emptyStateMessage');
                    if (emptyStateMessage) {
                        emptyStateMessage.textContent = '請選擇知識庫或創建新的知識庫';
                    }
                }
            }
            
            // 儲存狀態
            localStorage.setItem('kbDrawerOpen', 'false');
        }

        // 顯示指定面板
        showPanel(panelId) {
            // 隱藏所有面板
            Object.values(this.panels).forEach(panel => {
                if (panel) {
                    panel.classList.remove('active');
                }
            });

            // 顯示選中的面板
            const targetPanel = this.panels[panelId];
            if (targetPanel) {
                targetPanel.classList.add('active');
            }

            // 如果抽屜是關閉的，自動打開
            if (!this.isOpen) {
                this.openDrawer();
            }
        }

        // 載入知識庫列表
        loadKBList(knowledgeBases) {
            const listEl = document.getElementById('kbList');
            
            if (!listEl) {
                console.error('kbList element not found!');
                return;
            }

            listEl.innerHTML = '';
            
            if (!knowledgeBases || knowledgeBases.length === 0) {
                listEl.innerHTML = '<li class="text-center text-muted">暫無知識庫</li>';
                return;
            }
            
            knowledgeBases.forEach(kb => {
                if (kb.status === 'deleted') return;
                
                const li = document.createElement('li');
                li.dataset.kbId = kb.id;
                li.dataset.kbName = kb.name.toLowerCase();
                
                // 檢查是否為當前選中的知識庫
                if (window.currentKBId === kb.id) {
                    li.classList.add('active');
                }
                
                li.innerHTML = `
                    <div class="kb-item-content">
                        <i class="fas fa-database kb-item-icon"></i>
                        <span class="kb-item-name" title="${kb.name}">${kb.name}</span>
                    </div>
                    <span class="kb-status-badge ${kb.status === 'enable' ? 'badge-enable' : 'badge-disable'}">
                        ${kb.status === 'enable' ? '啟用' : '停用'}
                    </span>
                `;
                
                li.addEventListener('click', () => this.selectKB(kb.id));
                listEl.appendChild(li);
            });
        }

        // 選擇知識庫
        selectKB(kbId) {
            const selectedItem = document.querySelector(`#kbList li[data-kb-id="${kbId}"]`);
            const kbName = selectedItem ? selectedItem.querySelector('span').textContent : '此知識庫';
            
            const doSelect = () => {
                // 移除所有 active 類
                const items = document.querySelectorAll('#kbList li');
                items.forEach(item => item.classList.remove('active'));
                
                // 添加 active 到選中項
                if (selectedItem) {
                    selectedItem.classList.add('active');
                }
                
                // 調用知識庫模組的選擇功能
                if (window.selectKnowledgeBase) {
                    window.selectKnowledgeBase(kbId);
                }
                
                // 切換到知識庫資訊 Tab，但不收合抽屜
                if (window.KBTabManager) {
                    window.KBTabManager.switchTab('info', true);  // true = skipCloseDrawer
                }
            };
            
            // 檢查是否在編輯模式
            const isEditing = window.currentKBMode === 'EDIT';
            
            // 只有在編輯模式下才需要確認
            if (isEditing) {
                Dialog.confirm(`您正在編輯知識庫，確定要切換到「${kbName}」嗎？未儲存的變更將會遺失。`, doSelect);
            } else {
                // 直接選擇
                doSelect();
            }
        }

        // 綁定搜尋事件
        bindSearchEvents() {
            const searchInput = document.getElementById('kbSearchInput');
            if (!searchInput) return;

            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                const items = document.querySelectorAll('#kbList li');
                
                items.forEach(item => {
                    const name = item.dataset.kbName;
                    if (name && name.includes(searchTerm)) {
                        item.style.display = '';
                    } else {
                        item.style.display = 'none';
                    }
                });
            });
        }
    }

    // Tab 管理器
    class KBTabManager {
        constructor() {
            this.tabs = {};
            this.panes = {};
        }

        // 初始化
        init() {
            // 獲取所有 tab 按鈕和內容
            this.tabs = {
                info: document.querySelector('.tab-btn[onclick*="info"]'),
                files: document.querySelector('.tab-btn[onclick*="files"]'),
                index: document.querySelector('.tab-btn[onclick*="index"]'),
                permissions: document.querySelector('.tab-btn[onclick*="permissions"]')
            };

            this.panes = {
                info: document.getElementById('infoTab'),
                files: document.getElementById('filesTab'),
                index: document.getElementById('indexTab'),
                permissions: document.getElementById('permissionsTab')
            };
        }

        // 切換 Tab
        switchTab(tabId, skipCloseDrawer = false) {
            // 自動收合抽屜（除非指定跳過）
            if (!skipCloseDrawer && window.KBDrawerManager && window.KBDrawerManager.isOpen) {
                window.KBDrawerManager.closeDrawer();
            }
            
            // 如果切換到索引工具 TAB，清除摘要內容並顯示索引參數
            if (tabId === 'index') {
                const indexSummary = document.getElementById('indexSummary');
                if (indexSummary) {
                    indexSummary.innerText = '';
                }
                
                // 顯示索引參數資訊
                const currentKBId = window.KnowledgeBaseModule ? window.KnowledgeBaseModule.getCurrentKBId() : null;
                if (currentKBId && window.IndexModule && window.IndexModule.showIndexParamsInfo) {
                    window.IndexModule.showIndexParamsInfo(currentKBId);
                }
                
                // 延遲隱藏成功提示（如果有顯示的話）
                // 但如果是剛建立完索引，則不啟動計時器
                if (window.IndexModule && window.IndexModule.hideIndexSuccessTips) {
                    // 檢查是否剛完成索引建立
                    if (!window.justCompletedIndexing) {
                        // 清除之前的計時器（如果有）
                        if (window.hideSuccessTipsTimer) {
                            clearTimeout(window.hideSuccessTipsTimer);
                        }
                        // 設置新的計時器，10 秒後隱藏
                        window.hideSuccessTipsTimer = setTimeout(() => {
                            window.IndexModule.hideIndexSuccessTips();
                        }, 10000); // 10秒後自動隱藏
                    }
                    // 如果是剛建立完索引，不做任何事，保持卡片顯示
                }
            } else {
                // 切換到其他 TAB 時，清除剛完成索引的標記
                if (window.justCompletedIndexing) {
                    window.justCompletedIndexing = false;
                }
            }
            
            // 更新按鈕狀態
            Object.entries(this.tabs).forEach(([id, btn]) => {
                if (btn) {
                    if (id === tabId) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                }
            });

            // 更新內容顯示
            Object.entries(this.panes).forEach(([id, pane]) => {
                if (pane) {
                    if (id === tabId) {
                        pane.classList.add('active');
                    } else {
                        pane.classList.remove('active');
                    }
                }
            });
        }
    }

    // 創建全域實例
    window.KBDrawerManager = new KBDrawerManager();
    window.KBTabManager = new KBTabManager();

    // 不需要重複定義，這些函數在 KnowledgeBaseModule 中已經定義
})();