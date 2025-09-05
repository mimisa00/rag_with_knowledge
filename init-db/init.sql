-- 建立資料庫
CREATE DATABASE IF NOT EXISTS rag_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE rag_db;

-- =====================================================
-- 1-1. users（使用者表）
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    loginid VARCHAR(50) UNIQUE NOT NULL COMMENT '登入帳號',
    username VARCHAR(50)  NOT NULL COMMENT '使用者姓名',
    email VARCHAR(100) NOT NULL COMMENT '電子郵件',
    password_hash VARCHAR(255) NOT NULL COMMENT '密碼雜湊值',
    role ENUM('admin', 'user') DEFAULT 'user' COMMENT '角色',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否啟用',
    last_login_at TIMESTAMP NULL COMMENT '最後登入時間',
    last_activity_at TIMESTAMP NULL COMMENT '最後活動時間',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_role (role),
    INDEX idx_last_login_at (last_login_at),
    INDEX idx_last_activity_at (last_activity_at)
);

-- =====================================================
-- 1-2. configs（配置表）
-- =====================================================
CREATE TABLE IF NOT EXISTS configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    `key` VARCHAR(100) UNIQUE NOT NULL COMMENT '設定鍵',
    value TEXT COMMENT '設定值',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_key (`key`)
);

-- =====================================================
-- 1-3. conversations（對話記錄表）
-- =====================================================
CREATE TABLE IF NOT EXISTS conversations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conv_id VARCHAR(100) NOT NULL COMMENT '對話 ID',
    user_id VARCHAR(36) COMMENT '使用者 ID',
    question TEXT NOT NULL COMMENT '使用者問題',
    answer TEXT NOT NULL COMMENT 'LLM 回覆',
    sources TEXT NOT NULL COMMENT '引用來源JSON格式，包含檔案名稱和連結',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_conv_id (conv_id),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at),
    INDEX idx_sources ON conversations(sources(100))
);

-- =====================================================
-- 1-4. llm_requests（LLM 請求狀態追蹤表）
-- =====================================================
CREATE TABLE IF NOT EXISTS llm_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT(11) NOT NULL,
    conv_id VARCHAR(100) COMMENT '對話 ID',
    question TEXT COMMENT '使用者問題',
    status ENUM('pending', 'completed', 'failed') DEFAULT 'pending' COMMENT '狀態',
    error_message TEXT COMMENT '錯誤訊息',
    response_time FLOAT COMMENT '回應時間',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- =====================================================
-- 1-5. knowledge_bases（知識庫表）
-- =====================================================
CREATE TABLE IF NOT EXISTS knowledge_bases (
    id VARCHAR(36) PRIMARY KEY,
    status ENUM('enable', 'disable', 'deleted') DEFAULT 'enable' COMMENT '狀態',
    name VARCHAR(255) NOT NULL COMMENT '知識庫名稱',
    system_prompt TEXT COMMENT '系統提示詞',
    chunk_size INT DEFAULT NULL COMMENT '知識庫特定的 chunk_size 設定',
    chunk_overlap INT DEFAULT NULL COMMENT '知識庫特定的 chunk_overlap 設定',
    conversation_history_limit INT DEFAULT 0 COMMENT '對話歷史筆數限制',
    note TEXT COMMENT '備註',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_name (name),
    INDEX idx_created_at (created_at)
);

-- =====================================================
-- 1-6. index_jobs（索引任務狀態表）
-- =====================================================
CREATE TABLE IF NOT EXISTS index_jobs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    kb_id VARCHAR(36) NOT NULL,
    job_type ENUM('build', 'rebuild', 'delete') NOT NULL COMMENT '任務類型',
    status ENUM('pending', 'running', 'completed', 'failed') DEFAULT 'pending' COMMENT '狀態',
    progress INT DEFAULT 0 COMMENT '進度',
    total_files INT DEFAULT 0 COMMENT '總檔案數',
    processed_files INT DEFAULT 0 COMMENT '已處理檔案數',
    error_message TEXT COMMENT '錯誤訊息',
    chunk_size INT DEFAULT NULL COMMENT '建立索引時使用的 chunk_size 設定',
    chunk_overlap INT DEFAULT NULL COMMENT '建立索引時使用的 chunk_overlap 設定',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (kb_id) REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    INDEX idx_kb_id (kb_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- =====================================================
-- 1-7. configs (預設配置
-- =====================================================
INSERT INTO configs (`key`, value) VALUES
('docling_image_export_mode', 'placeholder'),
('embedding_model', 'intfloat/multilingual-e5-large'),
('chunk_size', '512'),
('chunk_overlap', '64'),
('idx_result_count', '20'),
('rerank_top_k_final', '16'),
('llm_model', 'gemma3:4b'),
('is_enable_think', 'False'),
('llm_req_limit_total', '3'),
('llm_req_limit_user', '1'),
('num_ctx', '6144'),
('repeat_last_n', '64'),
('repeat_penalty', '1.1'),
('temperature', '0.5'),
('seed', '0'),
('stop', '[<|endoftext|>]'),
('num_predict', '1024'),
('top_k', '10'),
('top_p', '0.9'),
('min_p', '0.0'),
('system_prompt', '### 任務\n- 你是一名專業的 {✏️請填寫} 人員，使用者將對你提問跟公司內部有關的問題，提問的內容放在 <question></question>  tags 裡面，你只能根據 <context></context> 標籤內的內容回應資訊，不可以自行修改內容，如有任何修改，務必清楚標示出所做的變更。\n\n### 指南\n- 如果不知道答案，需明確跟使用者說明\n- 以使用者提問的語言回覆\n- 若上下文內容難以閱讀或品質不佳，告知使用者並盡力提供最佳解答\n- 回答時請勿使用 XML 標籤\n- 引用內容時，請確保簡明扼要且與提供的資訊直接相關\n- 請用表格方式呈現結果\n- 若 <context></context> 內含有 markdown 格式的表格標記，需重新整理成合適結構後再回覆\n\n\n### 引用範例\n如果使用者詢問的內容，資訊來源有附帶檔案名稱時，回覆時需於內文直接引用，如：根據 ${filename}.${ext} 內容第幾條文所述...。\n\n### 輸出格式\n- 回答開頭必須以「您好，根據目前的資訊...」作為格式\n- 如果 <question></question> 內容描述的不夠精確，於回覆結尾提醒使用者：「請注意輸入的問題內容，名詞錯別字越少、描述的越完整才能得到越正確的答案，或是啟用名詞分析功能以得到更佳品質的回覆。」\n- 回答結尾依照 <question></question> 內的問題，再延申幾個問題供使用者參考\n\nInformation Context:\n<context>\n{context}\n</context>\n\nUser Question:\n<question>\n{question}\n</question>\n\n分詞的關鍵字 :\n{keyword}'),
('noun_analysis_prompt', '### 任務:\n- 你是一名最優秀的專業中文、英文文字分析人員擅長將文字裡面的名詞取出來，你根據 <question></question> 這段標籤的內容將名詞提取出來，然後透過這些名詞再產生幾個相同語義的名詞，你不分析數字。\n\n### Guidelines:\n- 如果沒有相同語義的名詞，不要自己創造新的名詞，不要任何說明，保持簡潔的回覆\n- <question></question> 標籤內容的文字有可能打錯字，找出最有可能的名詞進行修正後回覆\n\n### 範例問題 1:\n- 人的一生會經過哪幾個階段?\n\n### 範例輸出 1:\n-  人 : 人物 個體 人類 人士 人們 民眾\n- 一生 : 生命 人生 一輩子 終身 生涯\n- 階段 : 時期 階層 階次 階程 段落 歷程\n\n### 範例問題 2:\n- 1000減掉100等於多少?\n\n### 範例輸出 2:\n- 減掉 : 扣除 減去 刪除 去除 省掉 排除 移除\n\n<question>\n  {question}\n</question>'),
('permission_matrix', '{"modules":[{"key":"knowledge_base","name":"知識庫管理","description":"管理知識庫的建立、編輯、刪除等操作","actions":[{"key":"create","name":"建立","description":"建立新知識庫"},{"key":"read","name":"檢視","description":"檢視知識庫內容"},{"key":"update","name":"編輯","description":"編輯知識庫設定"},{"key":"delete","name":"刪除","description":"刪除知識庫"},{"key":"index","name":"建立索引","description":"建立或重建索引"}]},{"key":"documents","name":"文件管理","description":"管理文件的上傳、編輯、刪除等操作","actions":[{"key":"upload","name":"上傳","description":"上傳新文件"},{"key":"read","name":"檢視","description":"檢視文件內容"},{"key":"update","name":"編輯","description":"編輯文件內容"},{"key":"delete","name":"刪除","description":"刪除文件"},{"key":"download","name":"下載","description":"下載文件"}]},{"key":"users","name":"使用者管理","description":"管理使用者帳號和權限","actions":[{"key":"create","name":"建立","description":"建立新使用者"},{"key":"read","name":"檢視","description":"檢視使用者資訊"},{"key":"update","name":"編輯","description":"編輯使用者資訊"},{"key":"delete","name":"刪除","description":"刪除使用者"},{"key":"reset_password","name":"重設密碼","description":"重設使用者密碼"}]},{"key":"organization","name":"組織管理","description":"管理部門、角色和組織架構","actions":[{"key":"manage_dept","name":"管理部門","description":"建立、編輯、刪除部門"},{"key":"manage_role","name":"管理角色","description":"建立、編輯、刪除角色"},{"key":"assign_role","name":"分配角色","description":"分配角色給使用者"},{"key":"view_structure","name":"檢視架構","description":"檢視組織架構"}]},{"key":"system","name":"系統設定","description":"系統層級的設定和管理","actions":[{"key":"config","name":"系統設定","description":"修改系統設定"},{"key":"audit","name":"審計日誌","description":"檢視審計日誌"},{"key":"backup","name":"備份還原","description":"執行備份和還原"},{"key":"maintenance","name":"系統維護","description":"執行系統維護"}]},{"key":"chat","name":"對話管理","description":"管理 AI 對話相關功能","actions":[{"key":"use","name":"使用對話","description":"使用 AI 對話功能"},{"key":"view_history","name":"檢視歷史","description":"檢視對話歷史"},{"key":"export","name":"匯出對話","description":"匯出對話記錄"},{"key":"manage_prompt","name":"管理提示詞","description":"管理系統提示詞"}]}]}'),
('token_idle_timeout', '3600'),
('token_max_lifetime', '28800'),
('token_refresh_threshold', '300')
ON DUPLICATE KEY UPDATE 
    value = VALUES(value),
    updated_at = CURRENT_TIMESTAMP; 

