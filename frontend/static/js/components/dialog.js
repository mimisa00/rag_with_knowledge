/**
 * 通用 Dialog 元件
 * 提供統一的對話框功能
 */
(function(window) {
    'use strict';
    
    // Dialog 類別
    class Dialog {
        constructor() {
            this.dialogQueue = [];
            this.currentDialog = null;
            this.confirmCallback = null;
            this.cancelCallback = null;
            this.init();
        }
        
        init() {
            // 創建 Dialog 容器
            this.createDialogElements();
            
            // 綁定 ESC 鍵關閉
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.currentDialog) {
                    this.close();
                }
            });
        }
        
        createDialogElements() {
            // 檢查是否已存在
            if (document.getElementById('dialogOverlay')) {
                return;
            }
            
            // 創建 Dialog HTML 結構
            const dialogHTML = `
                <!-- 訊息對話框 -->
                <div id="dialogOverlay" class="dialog-overlay">
                    <div class="dialog-container dialog-sm">
                        <div class="dialog-header">
                            <h3 id="dialogTitle">系統訊息</h3>
                            <button class="dialog-close" onclick="Dialog.close()">
                                <i class="fa-solid fa-times"></i>
                            </button>
                        </div>
                        <div class="dialog-body">
                            <i id="dialogIcon" class="dialog-icon"></i>
                            <div id="dialogMessage" class="dialog-message"></div>
                        </div>
                        <div id="dialogFooter" class="dialog-footer">
                            <button onclick="Dialog.close()" class="btn btn-primary">確定</button>
                        </div>
                    </div>
                </div>
            `;
            
            // 插入到 body
            document.body.insertAdjacentHTML('beforeend', dialogHTML);
            
            // 綁定點擊外部關閉
            document.getElementById('dialogOverlay').addEventListener('click', (e) => {
                if (e.target.id === 'dialogOverlay') {
                    this.close();
                }
            });
        }
        
        /**
         * 顯示訊息對話框
         * @param {string} message - 訊息內容
         * @param {Object} options - 選項
         */
        show(message, options = {}) {
            const defaults = {
                title: '系統訊息',
                type: 'info', // info, success, warning, error
                icon: true,
                closeButton: true
            };
            
            const config = { ...defaults, ...options };
            
            // 設定標題
            document.getElementById('dialogTitle').textContent = config.title;
            
            // 設定訊息
            const messageEl = document.getElementById('dialogMessage');
            messageEl.textContent = message;
            messageEl.className = `dialog-message dialog-${config.type}`;
            
            // 設定圖標
            const iconEl = document.getElementById('dialogIcon');
            if (config.icon) {
                const iconClasses = {
                    'info': 'fa-solid fa-info-circle icon-info',
                    'success': 'fa-solid fa-check-circle icon-success',
                    'warning': 'fa-solid fa-exclamation-triangle icon-warning',
                    'error': 'fa-solid fa-times-circle icon-error'
                };
                iconEl.className = `dialog-icon ${iconClasses[config.type] || iconClasses.info}`;
                iconEl.style.display = 'block';
            } else {
                iconEl.style.display = 'none';
            }
            
            // 設定按鈕
            const footer = document.getElementById('dialogFooter');
            footer.innerHTML = '<button onclick="Dialog.close()" class="btn btn-primary">確定</button>';
            
            // 顯示對話框
            document.getElementById('dialogOverlay').classList.add('show');
            this.currentDialog = 'message';
        }
        
        /**
         * 顯示確認對話框
         * @param {string} message - 確認訊息
         * @param {Function} onConfirm - 確認回調
         * @param {Object} options - 選項
         */
        confirm(message, onConfirm, options = {}) {
            const defaults = {
                title: '確認操作',
                confirmText: '確認',
                cancelText: '取消',
                type: 'warning'
            };
            
            const config = { ...defaults, ...options };
            
            // 設定標題
            document.getElementById('dialogTitle').textContent = config.title;
            
            // 設定訊息
            const messageEl = document.getElementById('dialogMessage');
            messageEl.textContent = message;
            messageEl.className = `dialog-message dialog-${config.type}`;
            
            // 設定圖標
            const iconEl = document.getElementById('dialogIcon');
            iconEl.className = 'dialog-icon fa-solid fa-question-circle icon-warning';
            iconEl.style.display = 'block';
            
            // 設定按鈕
            const footer = document.getElementById('dialogFooter');
            footer.innerHTML = `
                <button onclick="Dialog.cancel()" class="btn btn-secondary">${config.cancelText}</button>
                <button onclick="Dialog.confirmAction()" class="btn btn-primary">${config.confirmText}</button>
            `;
            
            // 保存回調
            this.confirmCallback = onConfirm;
            this.cancelCallback = options.onCancel || null;
            
            // 顯示對話框
            document.getElementById('dialogOverlay').classList.add('show');
            this.currentDialog = 'confirm';
        }
        
        /**
         * 確認動作
         */
        confirmAction() {
            if (this.confirmCallback) {
                this.confirmCallback();
            }
            this.close();
        }
        
        /**
         * 取消動作
         */
        cancel() {
            if (this.cancelCallback) {
                this.cancelCallback();
            }
            this.close();
        }
        
        /**
         * 關閉對話框
         */
        close() {
            document.getElementById('dialogOverlay').classList.remove('show');
            this.currentDialog = null;
            this.confirmCallback = null;
            this.cancelCallback = null;
        }
        
        /**
         * 顯示成功訊息
         */
        success(message, title = '操作成功') {
            this.show(message, { title, type: 'success' });
        }
        
        /**
         * 顯示錯誤訊息
         */
        error(message, title = '操作失敗') {
            this.show(message, { title, type: 'error' });
        }
        
        /**
         * 顯示警告訊息
         */
        warning(message, title = '警告') {
            this.show(message, { title, type: 'warning' });
        }
        
        /**
         * 顯示資訊訊息
         */
        info(message, title = '提示') {
            this.show(message, { title, type: 'info' });
        }
    }
    
    // 創建單例實例
    const dialogInstance = new Dialog();
    
    // 暴露到全域
    window.Dialog = dialogInstance;
    
    // 提供靜態方法方便調用
    window.Dialog.show = dialogInstance.show.bind(dialogInstance);
    window.Dialog.confirm = dialogInstance.confirm.bind(dialogInstance);
    window.Dialog.success = dialogInstance.success.bind(dialogInstance);
    window.Dialog.error = dialogInstance.error.bind(dialogInstance);
    window.Dialog.warning = dialogInstance.warning.bind(dialogInstance);
    window.Dialog.info = dialogInstance.info.bind(dialogInstance);
    window.Dialog.close = dialogInstance.close.bind(dialogInstance);
    window.Dialog.confirmAction = dialogInstance.confirmAction.bind(dialogInstance);
    window.Dialog.cancel = dialogInstance.cancel.bind(dialogInstance);
    window.Dialog.createDialogElements = dialogInstance.createDialogElements.bind(dialogInstance);
    
})(window);