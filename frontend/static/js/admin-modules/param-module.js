/**
 * 參數設定模組
 * 處理系統參數配置
 */
(function() {
    'use strict';

    // 公開 API
    const ParamModule = {
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
            } catch (error) {
                console.error('載入參數錯誤：', error);
                // 不在頁面載入時顯示 alert，只記錄錯誤
                // alert('載入參數失敗');
            }
        },

        // 更新參數設定
        updateConfig: async function() {
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
                    console.log("參數已儲存");
                } else {
                    throw new Error('參數更新失敗');
                }
            } catch (err) {
                alert("發生錯誤：" + err.message);
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
        }
    };

    // 導出模組
    window.ParamModule = ParamModule;
})();