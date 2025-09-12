/**
 * 參數設定模組
 * 處理系統參數配置
 */
(function() {
    'use strict';

    // 公開 API
    const ParamModule = {
        // 狀態追蹤
        initialFormState: null,
        hasUnsavedChanges: false,
        
        // 初始化
        init: function() {
            this.bindEvents();
            this.loadConfig();
        },

        // 載入參數配置
        loadConfig: async function() {
            try {
                const res = await fetch("/api/config/get");
                if (!res.ok) {
                    console.error("載入參數失敗，狀態碼：", res.status);
                    // 只在明確的錯誤情況下顯示 alert，避免頁面載入時的暫時性錯誤
                    if (res.status !== 0) {  // status 0 通常是網路中斷或 CORS 問題
                        alert("載入參數失敗");
                    }
                    return;
                }
                const config = await res.json();

                // 把每個欄位的值設成後端傳來的值
                for (const [key, value] of Object.entries(config)) {
                    const input = document.querySelector(`[name="${key}"]`);
                    if (input) input.value = value;
                }
                
                // 記錄初始表單狀態
                this.captureInitialFormState();
                this.hasUnsavedChanges = false;
            } catch (error) {
                console.error('載入參數錯誤：', error);
                // 不在頁面載入時顯示 alert，只記錄錯誤
                // alert('載入參數失敗');
            }
        },

        // 獲取當前表單狀態
        getCurrentFormState: function() {
            const form = document.getElementById("paramForm");
            if (!form) return {};
            
            const formData = new FormData(form);
            const state = {};
            for (const [key, value] of formData.entries()) {
                state[key] = value;
            }
            return state;
        },

        // 記錄初始表單狀態
        captureInitialFormState: function() {
            this.initialFormState = this.getCurrentFormState();
        },

        // 檢查是否有變更
        checkForChanges: function() {
            if (!this.initialFormState) {
                return false;
            }
            
            const currentState = this.getCurrentFormState();
            const currentStateStr = JSON.stringify(currentState);
            const initialStateStr = JSON.stringify(this.initialFormState);
            
            const hasChanges = currentStateStr !== initialStateStr;
            this.hasUnsavedChanges = hasChanges;
            return hasChanges;
        },

        // 重設變更追蹤狀態
        resetChangeTracking: function() {
            this.captureInitialFormState();
            this.hasUnsavedChanges = false;
        },

        // 更新參數設定
        updateConfig: function() {
            // 顯示確認對話框
            if (window.Dialog) {
                window.Dialog.confirm(
                    '確定要儲存當前的系統參數設定嗎？',
                    () => this.performUpdate(),
                    {
                        title: '確認儲存',
                        confirmText: '儲存',
                        cancelText: '取消'
                    }
                );
            } else {
                // 備用方案：使用瀏覽器原生確認對話框
                if (confirm('確定要儲存當前的系統參數設定嗎？')) {
                    this.performUpdate();
                }
            }
        },

        // 執行實際的參數更新
        performUpdate: async function() {
            if (window.CommonUI) {
                window.CommonUI.showSpinner('儲存參數中...');
            }
            try {
                const form = document.getElementById("paramForm");
                const formData = Object.fromEntries(new FormData(form).entries());
                const res = await fetch("/api/config/update", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(formData)
                });
                if (res.ok) {
                    // 參數已儲存，重設變更追蹤狀態
                    this.resetChangeTracking();
                    
                    if (window.Dialog) {
                        window.Dialog.success('系統參數已成功儲存！');
                    }
                } else {
                    throw new Error('參數更新失敗');
                }
            } catch (err) {
                if (window.Dialog) {
                    window.Dialog.error("儲存失敗：" + err.message);
                } else {
                    alert("發生錯誤：" + err.message);
                }
            } finally {
                if (window.CommonUI) {
                    window.CommonUI.stopSpinner();
                }
            }
        },

        // 測試郵件發送功能
        sendTestEmail: async function() {
            const testEmailInput = document.getElementById("test_email_recipient");
            const testEmailAddress = testEmailInput?.value?.trim();

            if (!testEmailAddress) {
                if (window.Dialog) {
                    window.Dialog.warning('請輸入測試郵件地址');
                } else {
                    alert('請輸入測試郵件地址');
                }
                return;
            }

            // 驗證郵件格式
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(testEmailAddress)) {
                if (window.Dialog) {
                    window.Dialog.warning('請輸入有效的郵件地址');
                } else {
                    alert('請輸入有效的郵件地址');
                }
                return;
            }

            try {
                if (window.CommonUI) {
                    window.CommonUI.showSpinner();
                }

                // 先保存當前設定（確保使用最新的 SMTP 設定）
                const currentForm = this.getCurrentFormState();
                await fetch("/api/config/update", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(currentForm)
                });

                // 發送測試郵件
                const response = await fetch("/api/config/test-email", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: testEmailAddress })
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    if (window.Dialog) {
                        window.Dialog.success(`測試郵件已發送至 ${testEmailAddress}，請檢查收件匣`);
                    } else {
                        alert(`測試郵件已發送至 ${testEmailAddress}，請檢查收件匣`);
                    }
                    // 清空輸入框
                    testEmailInput.value = '';
                } else {
                    throw new Error(result.message || '測試郵件發送失敗');
                }

            } catch (error) {
                console.error('測試郵件發送錯誤：', error);
                if (window.Dialog) {
                    window.Dialog.error('測試郵件發送失敗：' + error.message);
                } else {
                    alert('測試郵件發送失敗：' + error.message);
                }
            } finally {
                if (window.CommonUI) {
                    window.CommonUI.stopSpinner();
                }
            }
        },

        // 綁定事件
        bindEvents: function() {
            const updateConfigBtn = document.getElementById("updateConfigBtn");
            if (updateConfigBtn) {
                updateConfigBtn.addEventListener("click", () => this.updateConfig());
            }

            // 綁定測試郵件發送按鈕
            const sendTestEmailBtn = document.getElementById("sendTestEmailBtn");
            if (sendTestEmailBtn) {
                sendTestEmailBtn.addEventListener("click", () => this.sendTestEmail());
            }

            // Tab 切換時自動更新參數（僅在 dashboard_admin.html 中使用）
            // 獨立頁面不需要 tab 切換功能
            const tabButtons = document.querySelectorAll(".tab-button");
            if (tabButtons.length > 0) {
                tabButtons.forEach(button => {
                    button.addEventListener("click", () => {
                        const targetTabId = button.getAttribute("data-tab");
                        // 顯示目標 tab
                        document.querySelectorAll(".tab-content").forEach(tab => {
                            tab.style.display = (tab.id === targetTabId) ? "block" : "none";
                        });

                        // 如果是切到 paramTab，就重新載入參數（不是更新）
                        if (targetTabId === "paramTab") {
                            this.loadConfig();
                        }
                    });
                });
            }
            
            // 綁定表單變更監聽器
            this.bindFormChangeListeners();
            
            // 綁定離開頁面攔截
            this.bindPageLeaveInterception();
        },

        // 綁定表單變更監聽器
        bindFormChangeListeners: function() {
            const form = document.getElementById("paramForm");
            if (!form) return;

            // 監聽所有輸入元素的變更
            const inputs = form.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                // 使用 input 事件來即時檢測變更
                input.addEventListener('input', () => {
                    this.checkForChanges();
                });
                
                // 對於 select 元素，也監聽 change 事件
                if (input.tagName === 'SELECT') {
                    input.addEventListener('change', () => {
                        this.checkForChanges();
                    });
                }
            });
        },

        // 綁定離開頁面攔截
        bindPageLeaveInterception: function() {
            // 攔截瀏覽器 beforeunload 事件
            window.addEventListener('beforeunload', (e) => {
                if (this.hasUnsavedChanges) {
                    // 標準的瀏覽器提醒
                    e.preventDefault();
                    e.returnValue = '您有未保存的變更，確定要離開此頁面嗎？';
                    return e.returnValue;
                }
            });

            // 攔截麵包屑連結點擊
            const breadcrumbLinks = document.querySelectorAll('.breadcrumb-link');
            breadcrumbLinks.forEach(link => {
                link.addEventListener('click', (e) => {
                    if (this.hasUnsavedChanges) {
                        e.preventDefault();
                        const href = link.getAttribute('href');
                        this.showUnsavedChangesDialog(() => {
                            // 用戶確認離開
                            window.location.href = href;
                        });
                    }
                });
            });
        },

        // 顯示未保存變更提醒對話框
        showUnsavedChangesDialog: function(onConfirm) {
            if (window.Dialog) {
                window.Dialog.confirm(
                    '您有未保存的變更，確定要離開此頁面嗎？離開後將會失去所有未保存的變更。',
                    onConfirm,
                    {
                        title: '確認離開',
                        confirmText: '離開',
                        cancelText: '取消'
                    }
                );
            } else {
                // 備用方案：使用瀏覽器原生確認對話框
                if (confirm('您有未保存的變更，確定要離開此頁面嗎？')) {
                    onConfirm();
                }
            }
        }
    };

    // 導出模組
    window.ParamModule = ParamModule;
})();