-- =====================================================
-- 第三方 LLM Provider 配置遷移
-- 日期: 2025-10-31
-- 描述: 新增支援 OpenAI, Anthropic 等第三方 LLM API 的配置參數
-- =====================================================

-- Provider 選擇
INSERT INTO configs (`key`, value) VALUES
('llm_provider', 'ollama')  -- 預設使用 ollama，可選: ollama|openai|anthropic|gemini|azure
ON DUPLICATE KEY UPDATE value = VALUES(value);

-- =====================================================
-- OpenAI 配置
-- =====================================================
INSERT INTO configs (`key`, value) VALUES
('openai_api_key', ''),
('openai_api_base', 'https://api.openai.com/v1'),
('openai_model', 'gpt-4-turbo-preview'),
('openai_organization', '')
ON DUPLICATE KEY UPDATE value = VALUES(value);

-- =====================================================
-- Anthropic Claude 配置
-- =====================================================
INSERT INTO configs (`key`, value) VALUES
('anthropic_api_key', ''),
('anthropic_api_base', 'https://api.anthropic.com'),
('anthropic_model', 'claude-3-5-sonnet-20241022'),
('anthropic_api_version', '2023-06-01')
ON DUPLICATE KEY UPDATE value = VALUES(value);

-- =====================================================
-- Google Gemini 配置 (預留)
-- =====================================================
INSERT INTO configs (`key`, value) VALUES
('gemini_api_key', ''),
('gemini_api_base', 'https://generativelanguage.googleapis.com'),
('gemini_model', 'gemini-1.5-pro')
ON DUPLICATE KEY UPDATE value = VALUES(value);

-- =====================================================
-- Azure OpenAI 配置 (預留)
-- =====================================================
INSERT INTO configs (`key`, value) VALUES
('azure_api_key', ''),
('azure_endpoint', ''),
('azure_deployment', ''),
('azure_api_version', '2024-02-15-preview')
ON DUPLICATE KEY UPDATE value = VALUES(value);

-- =====================================================
-- Ollama 配置 (保持向後兼容)
-- =====================================================
INSERT INTO configs (`key`, value) VALUES
('ollama_api_base', 'http://ollama:11434'),
('ollama_model', 'gemma3:4b'),
('ollama_keep_alive', '-1')
ON DUPLICATE KEY UPDATE value = VALUES(value);

-- =====================================================
-- 錯誤處理和重試配置
-- =====================================================
INSERT INTO configs (`key`, value) VALUES
('llm_fallback_enabled', 'false'),  -- 是否啟用備用 provider
('llm_fallback_provider', 'ollama'),  -- 備用 provider
('llm_max_retries', '3'),  -- 最大重試次數
('llm_timeout_seconds', '120'),  -- 請求超時秒數
('llm_rate_limit_rpm', '60'),  -- 每分鐘請求限制
('llm_rate_limit_tpm', '90000')  -- 每分鐘 token 限制
ON DUPLICATE KEY UPDATE value = VALUES(value);

-- =====================================================
-- API 金鑰加密配置
-- =====================================================
INSERT INTO configs (`key`, value) VALUES
('api_key_encrypted', 'false')  -- API 金鑰是否已加密
ON DUPLICATE KEY UPDATE value = VALUES(value);

-- =====================================================
-- 遷移記錄
-- =====================================================
INSERT INTO configs (`key`, value) VALUES
('migration_llm_provider', '2025-10-31')
ON DUPLICATE KEY UPDATE value = VALUES(value);