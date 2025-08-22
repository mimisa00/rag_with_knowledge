/**
 * 引導提示模組
 * 處理新手引導、提示顯示和使用指引
 */
(function() {
    'use strict';
    
    const GuideModule = {
        // 初始化
        init: function() {
            this.checkFirstTimeUser();
            this.bindEvents();
        },
        
        // 檢查是否為首次使用
        checkFirstTimeUser: function() {
            // 分別檢查不同功能的首次使用狀態
            const hasSeenIndexExplain = localStorage.getItem('kb_index_explain_seen');
            const hasSeenUploadGuide = localStorage.getItem('kb_upload_guide_seen');
            
            // 判斷是否為整體首次使用（用於上傳引導）
            this.isFirstTime = !hasSeenUploadGuide;
            
            // 檢查索引說明是否為首次查看
            const indexExplainContent = document.getElementById('indexExplainContent');
            const indexExplainIcon = document.getElementById('indexExplainIcon');
            
            if (!hasSeenIndexExplain) {
                // 如果是第一次使用，且在索引工具 TAB，自動展開索引說明
                if (indexExplainContent && indexExplainIcon) {
                    // 展開說明，箭頭朝下（不加 rotated）
                    indexExplainContent.classList.remove('d-none');
                    indexExplainIcon.classList.remove('rotated');
                    // 標記已看過
                    localStorage.setItem('kb_index_explain_seen', 'true');
                }
            } else {
                // 非首次使用，確保預設收合狀態，箭頭朝上
                if (indexExplainContent && indexExplainIcon) {
                    indexExplainContent.classList.add('d-none');
                    indexExplainIcon.classList.add('rotated');
                }
            }
        },
        
        // 標記已看過引導
        markGuideSeen: function() {
            localStorage.setItem('kb_upload_guide_seen', 'true');
            this.isFirstTime = false;
        },
        
        // 顯示創建成功引導
        showCreateSuccessGuide: function() {
            const guide = document.getElementById('createSuccessGuide');
            if (guide) {
                guide.classList.remove('d-none');
                // 10秒後自動隱藏
                setTimeout(() => {
                    this.hideGuide('createSuccessGuide');
                }, 10000);
            }
        },
        
        // 顯示上傳成功引導
        showUploadSuccessGuide: function(isFirstUpload) {
            // 只在第一次上傳或新手模式時顯示
            if (!isFirstUpload && !this.isFirstTime) {
                return;
            }
            
            const guide = document.getElementById('uploadSuccessGuide');
            if (guide) {
                guide.classList.remove('d-none');
                // 標記已看過引導
                this.markGuideSeen();
                // 15秒後自動隱藏
                setTimeout(() => {
                    this.hideGuide('uploadSuccessGuide');
                }, 15000);
            }
        },
        
        // 隱藏引導
        hideGuide: function(guideId) {
            const guide = document.getElementById(guideId);
            if (guide) {
                // 添加淡出動畫
                guide.style.animation = 'fadeOut 0.5s ease-in-out';
                setTimeout(() => {
                    guide.classList.add('d-none');
                    guide.style.animation = '';
                }, 500);
            }
        },
        
        // 前往上傳檔案
        goToUploadFiles: function() {
            this.hideGuide('createSuccessGuide');
            // 切換到檔案管理 TAB
            if (window.KBTabManager) {
                window.KBTabManager.switchTab('files');
            }
            // 自動打開上傳模態框
            setTimeout(() => {
                const uploadBtn = document.getElementById('uploadBtn');
                if (uploadBtn) {
                    uploadBtn.click();
                }
            }, 300);
        },
        
        // 前往建立索引
        goToBuildIndex: function() {
            this.hideGuide('uploadSuccessGuide');
            // 切換到索引工具 TAB
            if (window.KBTabManager) {
                window.KBTabManager.switchTab('index');
            }
            // 如果是第一次，展開參數說明
            if (this.isFirstTime) {
                setTimeout(() => {
                    const indexExplainContent = document.getElementById('indexExplainContent');
                    const indexExplainIcon = document.getElementById('indexExplainIcon');
                    if (indexExplainContent && indexExplainContent.classList.contains('d-none')) {
                        indexExplainContent.classList.remove('d-none');
                        indexExplainIcon.classList.add('rotated');
                    }
                }, 300);
            }
        },
        
        // 切換索引說明展開/收合
        toggleIndexExplain: function() {
            const content = document.getElementById('indexExplainContent');
            const icon = document.getElementById('indexExplainIcon');
            
            if (content && icon) {
                if (content.classList.contains('d-none')) {
                    // 展開內容，箭頭朝下（移除 rotated）
                    content.classList.remove('d-none');
                    icon.classList.remove('rotated');
                } else {
                    // 收合內容，箭頭朝上（加 rotated）
                    content.classList.add('d-none');
                    icon.classList.add('rotated');
                }
            }
        },
        
        // 綁定事件
        bindEvents: function() {
            // 暫時不需要額外的事件綁定
        },
        
        // 檢查是否為知識庫的第一個檔案
        checkIsFirstFile: async function(kbId) {
            try {
                const response = await fetch(`/api/documents/${kbId}`, {
                    credentials: 'include'
                });
                if (response.ok) {
                    const data = await response.json();
                    // 如果檔案數量為1，表示是第一個檔案
                    return data.documents && data.documents.length === 1;
                }
            } catch (error) {
                console.error('檢查檔案數量失敗:', error);
            }
            return false;
        }
    };
    
    // 公開 API
    window.GuideModule = GuideModule;
})();