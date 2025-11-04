/**
 * Vertex AI Manager Module
 * 管理 Vertex AI 相關的 UI 功能和狀態檢查
 */

const VertexAIManager = (function() {
    'use strict';

    // 私有變數
    let keyStatus = 'unknown';
    let lastCheckTime = null;
    let setupGuideVisible = true;  // 預設展開設定指南

    /**
     * 初始化模組
     */
    function init() {
        console.log('VertexAIManager initialized');

        // 綁定事件（如果需要）
        bindEvents();
    }

    /**
     * 綁定事件處理器
     */
    function bindEvents() {
        // 可以在這裡綁定額外的事件
    }

    /**
     * 切換設定指南的顯示/隱藏
     */
    function toggleSetupGuide() {
        const guideElement = document.getElementById('vertexAISetupGuide');
        const toggleIcon = document.getElementById('vertexAISetupGuideToggle');

        if (!guideElement) return;

        setupGuideVisible = !setupGuideVisible;

        if (setupGuideVisible) {
            guideElement.style.display = 'block';
            if (toggleIcon) {
                toggleIcon.className = 'fas fa-chevron-up';
            }
        } else {
            guideElement.style.display = 'none';
            if (toggleIcon) {
                toggleIcon.className = 'fas fa-chevron-down';
            }
        }
    }

    /**
     * 檢查憑證狀態
     */
    async function checkKeyStatus() {
        const statusBadge = document.getElementById('vertexAIKeyStatus');
        const statusText = document.getElementById('keyStatusText');

        // 顯示載入狀態
        if (statusBadge) {
            statusBadge.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 檢查中...';
            statusBadge.className = 'badge badge-info ml-2';
        }
        if (statusText) {
            statusText.textContent = '正在檢查憑證狀態...';
        }

        try {
            const response = await fetch('/api/llm/vertex-ai/key-status', {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // 更新狀態
            keyStatus = data.status;
            lastCheckTime = new Date();

            // 更新 UI
            updateKeyStatusUI(data);

            // 如果需要設定，自動展開指南
            if (data.setup_required) {
                if (!setupGuideVisible) {
                    toggleSetupGuide();
                }
            }

            return data;

        } catch (error) {
            console.error('檢查憑證狀態失敗:', error);

            if (statusBadge) {
                statusBadge.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 檢查失敗';
                statusBadge.className = 'badge badge-danger ml-2';
            }
            if (statusText) {
                statusText.textContent = '無法檢查憑證狀態';
                statusText.className = 'text-danger';
            }

            Dialog.show('錯誤', '無法檢查憑證狀態: ' + error.message, 'error');
        }
    }

    /**
     * 更新憑證狀態 UI
     */
    function updateKeyStatusUI(data) {
        const statusBadge = document.getElementById('vertexAIKeyStatus');
        const statusText = document.getElementById('keyStatusText');

        if (data.status === 'valid') {
            if (statusBadge) {
                statusBadge.innerHTML = '<i class="fas fa-check-circle"></i> 有效';
                statusBadge.className = 'badge badge-success ml-2';
            }
            if (statusText) {
                statusText.textContent = data.message || '憑證有效';
                statusText.className = 'text-success';
            }
        } else if (data.status === 'invalid') {
            if (statusBadge) {
                statusBadge.innerHTML = '<i class="fas fa-times-circle"></i> 無效';
                statusBadge.className = 'badge badge-danger ml-2';
            }
            if (statusText) {
                statusText.textContent = data.message || '憑證無效或未設定';
                statusText.className = 'text-danger';
            }
        } else {
            if (statusBadge) {
                statusBadge.innerHTML = '<i class="fas fa-question-circle"></i> 未知';
                statusBadge.className = 'badge badge-warning ml-2';
            }
            if (statusText) {
                statusText.textContent = data.message || '憑證狀態未知';
                statusText.className = 'text-warning';
            }
        }

        // 顯示詳細資訊（如果需要）
        // 註：message 已經包含了 Project ID，不需要重複顯示
        if (data.key_info && data.key_info.client_email && statusText && data.status === 'valid') {
            // 只顯示 service account email 作為補充資訊
            statusText.title = `Service Account: ${data.key_info.client_email}`;
        }
    }

    /**
     * 顯示更新憑證指南
     */
    function showUpdateKeyGuide() {
        // 建立 Modal 內容
        const modalContent = `
            <div class="update-key-guide">
                <h5>更新 Service Account Key</h5>

                <div class="alert alert-info">
                    <p>如果您的憑證已過期或需要更新，請按照以下步驟操作：</p>
                </div>

                <ol>
                    <li>
                        <strong>列出現有的 Keys（可選）：</strong>
                        <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 12px;">gcloud iam service-accounts keys list \\
    --iam-account=rag-vertex-ai@\${PROJECT_ID}.iam.gserviceaccount.com</pre>
                    </li>

                    <li>
                        <strong>建立新的 Key：</strong>
                        <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 12px;">gcloud iam service-accounts keys create ./credentials/vertex-ai-key.json \\
    --iam-account=rag-vertex-ai@\${PROJECT_ID}.iam.gserviceaccount.com</pre>
                    </li>

                    <li>
                        <strong>設定檔案權限：</strong>
                        <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 12px;">chmod 644 ./credentials/vertex-ai-key.json</pre>
                    </li>

                    <li>
                        <strong>重啟後端服務：</strong>
                        <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 12px;">docker compose restart backend</pre>
                    </li>

                    <li>
                        <strong>刪除舊的 Key（可選但建議）：</strong>
                        <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 12px;">gcloud iam service-accounts keys delete KEY_ID \\
    --iam-account=rag-vertex-ai@\${PROJECT_ID}.iam.gserviceaccount.com</pre>
                    </li>
                </ol>

                <div class="alert alert-warning">
                    <strong>安全提醒：</strong>
                    <ul>
                        <li>不要在版本控制中提交 key 檔案</li>
                        <li>定期更新 key（建議每 90 天）</li>
                        <li>使用最小權限原則</li>
                    </ul>
                </div>
            </div>
        `;

        // 使用 Dialog 顯示
        if (window.Dialog && window.Dialog.show) {
            window.Dialog.show('更新 Vertex AI 憑證', modalContent, 'info');
        } else {
            // 如果 Dialog 不可用，使用 alert
            alert('請參考系統參數頁面的 Vertex AI 設定指南更新憑證');
        }
    }

    /**
     * 驗證 Vertex AI 設定
     */
    async function validateSetup() {
        try {
            const response = await fetch('/api/llm/vertex-ai/validate-setup', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.valid) {
                Dialog.show('成功', 'Vertex AI 設定驗證成功！', 'success');
            } else {
                Dialog.show('驗證失敗', data.message || '設定驗證失敗', 'error');
            }

            return data;

        } catch (error) {
            console.error('驗證設定失敗:', error);
            Dialog.show('錯誤', '無法驗證設定: ' + error.message, 'error');
            return { valid: false, error: error.message };
        }
    }

    /**
     * 當 Provider 切換到 Vertex AI 時調用
     */
    function onProviderSwitch() {
        console.log('Switched to Vertex AI provider');

        // 自動檢查憑證狀態
        checkKeyStatus();

        // 如果是第一次使用，可能需要顯示指南
        const firstTime = localStorage.getItem('vertex_ai_first_time') !== 'false';
        if (firstTime) {
            // 可以選擇自動展開指南
            // toggleSetupGuide();
            localStorage.setItem('vertex_ai_first_time', 'false');
        }
    }

    /**
     * 收集 Vertex AI 配置資料
     */
    function collectConfig() {
        return {
            project_id: document.getElementById('vertex_ai_project_id')?.value || '',
            location_id: document.getElementById('vertex_ai_location_id')?.value || 'us-central1',
            model: document.getElementById('vertex_ai_model_id')?.value || 'claude-4-5-haiku@20251001',
            anthropic_version: document.getElementById('vertex_ai_anthropic_version')?.value || 'vertex-2023-10-16'
        };
    }

    // 公開 API
    return {
        init: init,
        toggleSetupGuide: toggleSetupGuide,
        checkKeyStatus: checkKeyStatus,
        showUpdateKeyGuide: showUpdateKeyGuide,
        validateSetup: validateSetup,
        onProviderSwitch: onProviderSwitch,
        collectConfig: collectConfig,

        // 狀態獲取器
        getKeyStatus: () => keyStatus,
        getLastCheckTime: () => lastCheckTime
    };

})();

// 確保在 DOM 載入後初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', VertexAIManager.init);
} else {
    VertexAIManager.init();
}

// 導出到全域（供 HTML onclick 使用）
window.VertexAIManager = VertexAIManager;