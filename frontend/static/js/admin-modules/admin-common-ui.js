/**
 * 管理員通用 UI 模組
 * 擴展 CommonUI 模組，加入管理員頁面專屬的 UI 功能
 */
(function() {
    'use strict';

    // 管理員專屬 UI 功能
    const AdminUI = {
        // 顯示上傳檔案 Loading
        showUploadLoading: function() {
            const loadingOverlay = document.getElementById('uploadLoadingOverlay');
            if (loadingOverlay) {
                loadingOverlay.style.display = 'flex';
            }
        },

        // 隱藏上傳檔案 Loading
        hideUploadLoading: function() {
            const loadingOverlay = document.getElementById('uploadLoadingOverlay');
            if (loadingOverlay) {
                loadingOverlay.style.display = 'none';
            }
        },

        // 顯示建立索引 Loading
        showBuildIndexLoading: function() {
            const loadingOverlay = document.getElementById('buildIndexLoadingOverlay');
            if (loadingOverlay) {
                loadingOverlay.style.display = 'flex';
            }
        },

        // 隱藏建立索引 Loading
        hideBuildIndexLoading: function() {
            const loadingOverlay = document.getElementById('buildIndexLoadingOverlay');
            if (loadingOverlay) {
                loadingOverlay.style.display = 'none';
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
        },

        // 檢查推理功能開關
        checkThinkFeature: async function() {
            try {
                const res = await fetch('/api/user/is/enable/think');
                const isEnabled = await res.json();

                if (!isEnabled) {
                    const section = document.getElementById("thinkToggleSection");
                    if (section) section.style.display = "none";
                }
            } catch (error) {
                console.error("讀取推理開關狀態失敗：", error);
            }
        },

        // 初始化函數 - 擴展 CommonUI
        init: function() {
            console.log('Initializing AdminUI extensions...');
            
            // 檢查 CommonUI 是否存在
            if (!window.CommonUI) {
                console.error('CommonUI not found, cannot extend');
                return;
            }
            
            console.log('CommonUI found, extending functions...');
            
            // 添加 checkThinkFeature 到 CommonUI
            if (!window.CommonUI.checkThinkFeature) {
                window.CommonUI.checkThinkFeature = AdminUI.checkThinkFeature;
            }
            
            console.log('AdminUI initialization complete');
        }
    };

    // 導出管理員 UI 功能
    window.AdminUI = AdminUI;
})();