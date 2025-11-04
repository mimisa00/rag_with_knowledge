/**
 * LLM Provider UI 管理模組
 * 處理 LLM Provider 選擇和配置的 UI 邏輯
 */

const LLMProviderUI = (function () {
    'use strict';

    // 私有變數
    let currentProvider = 'ollama';

    /**
     * 初始化模組
     */
    function init() {
        console.log('初始化 LLM Provider UI 模組');
        // 不在這裡切換 provider，等待 ParamModule.loadConfig() 載入參數後再切換
    }

    /**
     * 切換 Provider 顯示
     * @param {string} provider - Provider 名稱
     */
    function switchProvider(provider) {
        console.log('切換到 Provider:', provider);
        currentProvider = provider;

        // 隱藏所有 provider 配置卡片
        const allProviderCards = document.querySelectorAll('.provider-config');
        allProviderCards.forEach(card => {
            card.style.display = 'none';
        });

        // 顯示選中的 provider 配置卡片
        const selectedCards = document.querySelectorAll(`.provider-config[data-provider="${provider}"]`);
        selectedCards.forEach(card => {
            card.style.display = '';
        });

        // 處理 Ollama 專屬參數卡片
        const ollamaOnlyCards = document.querySelectorAll('.ollama-only-config');
        ollamaOnlyCards.forEach(card => {
            // 只有選擇 Ollama 時才顯示這些卡片
            card.style.display = (provider === 'ollama') ? '' : 'none';
        });

        // 處理 Vertex AI 特殊邏輯
        if (provider === 'vertex_ai' && window.VertexAIManager) {
            // 切換到 Vertex AI 時自動檢查憑證狀態
            window.VertexAIManager.onProviderSwitch();
        }

        // 更新分類 badge 計數
        updateCategoryBadge();
    }

    /**
     * 更新分類 badge 計數
     */
    function updateCategoryBadge() {
        const llmCategory = document.querySelector('[data-category="llm"]');
        if (llmCategory) {
            const badge = llmCategory.querySelector('.category-badge');
            if (badge) {
                // 根據當前 provider 計算顯示的參數數量
                const visibleCards = document.querySelectorAll('#llmCategory .param-card:not([style*="display: none"])');
                badge.textContent = visibleCards.length;
            }
        }
    }

    /**
     * 測試 LLM Provider 連線
     */
    async function testConnection() {
        const provider = document.getElementById('llm_provider').value;
        console.log('測試 Provider 連線:', provider);

        // 顯示載入中
        CommonUI.showSpinner('測試連線中...');

        try {
            // 根據 provider 收集必要的配置
            const config = {};

            if (provider === 'ollama') {
                // Ollama 不需要額外配置，使用預設值
                config.model = document.getElementById('llm_model_select').value;
            } else if (provider === 'openai') {
                config.api_key = document.getElementById('openai_api_key').value;
                config.api_base = document.getElementById('openai_api_base').value;
                config.model = document.getElementById('openai_model').value;
                config.organization = document.getElementById('openai_organization').value;

                if (!config.api_key) {
                    throw new Error('請輸入 OpenAI API Key');
                }
            } else if (provider === 'anthropic') {
                config.api_key = document.getElementById('anthropic_api_key').value;
                config.api_base = document.getElementById('anthropic_api_base').value;
                config.model = document.getElementById('anthropic_model').value;
                config.api_version = document.getElementById('anthropic_api_version').value;

                if (!config.api_key) {
                    throw new Error('請輸入 Anthropic API Key');
                }
            } else if (provider === 'vertex_ai') {
                config.project_id = document.getElementById('vertex_ai_project_id').value;
                config.location_id = document.getElementById('vertex_ai_location_id').value;
                config.model = document.getElementById('vertex_ai_model_id').value;
                config.anthropic_version = document.getElementById('vertex_ai_anthropic_version').value;

                if (!config.project_id) {
                    throw new Error('請輸入 GCP Project ID');
                }
            }

            // 呼叫後端測試 API
            const response = await fetch('/api/llm/test-connection', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    provider: provider,
                    config: config
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            CommonUI.hideSpinner();

            if (result.success) {
                Dialog.success(result.message || `已成功連接到 ${provider}`, '連線成功');
            } else {
                Dialog.error(result.error || result.message || '無法連接到 LLM Provider', '連線失敗');
            }

        } catch (error) {
            CommonUI.hideSpinner();
            console.error('測試連線失敗:', error);
            Dialog.error(error.message || '測試連線時發生錯誤', '測試失敗');
        }
    }

    /**
     * 載入可用的模型列表
     * @param {string} provider - Provider 名稱
     */
    async function loadModels(provider) {
        console.log('載入模型列表:', provider);

        try {
            const response = await fetch(`/api/llm/models?provider=${provider}`, {
                method: 'GET',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('無法載入模型列表');
            }

            const models = await response.json();
            updateModelSelect(provider, models);

        } catch (error) {
            console.error('載入模型失敗:', error);
        }
    }

    /**
     * 更新模型選擇下拉選單
     * @param {string} provider - Provider 名稱
     * @param {Array} models - 模型列表
     */
    function updateModelSelect(provider, models) {
        let selectId;

        if (provider === 'ollama') {
            selectId = 'llm_model_select';
        } else if (provider === 'openai') {
            selectId = 'openai_model';
        } else if (provider === 'anthropic') {
            selectId = 'anthropic_model';
        }

        const select = document.getElementById(selectId);
        if (!select || !models || models.length === 0) {
            return;
        }

        // 保存當前選中的值
        const currentValue = select.value;

        // 清空並重新填充選項
        select.innerHTML = '';
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            select.appendChild(option);
        });

        // 恢復之前的選擇（如果還存在）
        if (models.includes(currentValue)) {
            select.value = currentValue;
        }
    }

    /**
     * 顯示/隱藏 API Key
     * @param {string} fieldId - 輸入欄位 ID
     */
    function toggleApiKeyVisibility(fieldId) {
        const field = document.getElementById(fieldId);
        if (!field) return;

        if (field.type === 'password') {
            field.type = 'text';
        } else {
            field.type = 'password';
        }
    }

    // 公開 API
    return {
        init: init,
        switchProvider: switchProvider,
        testConnection: testConnection,
        loadModels: loadModels,
        toggleApiKeyVisibility: toggleApiKeyVisibility
    };
})();

// 確保模組可全域存取
window.LLMProviderUI = LLMProviderUI;