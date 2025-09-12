-- ========================================
-- 密碼策略功能資料庫遷移腳本
-- 創建日期: 2025-01-05
-- 功能: 新增使用者啟用 token 機制和密碼策略支援
-- ========================================

USE rag_db;

-- 1. 建立用戶啟用 token 表
CREATE TABLE IF NOT EXISTS user_activation_tokens (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL COMMENT '使用者 ID',
    token VARCHAR(255) UNIQUE NOT NULL COMMENT '啟用 token',
    token_type ENUM('activation', 'password_reset', 'temp_password') DEFAULT 'activation' COMMENT 'Token 類型',
    expires_at DATETIME NOT NULL COMMENT '過期時間',
    used BOOLEAN DEFAULT FALSE COMMENT '是否已使用',
    used_at DATETIME NULL COMMENT '使用時間',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '建立時間',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新時間',
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token (token),
    INDEX idx_user_id (user_id),
    INDEX idx_expires (expires_at),
    INDEX idx_token_type (token_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='使用者啟用 token 表';

-- 2. 擴充 users 表 - 新增密碼相關欄位
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE COMMENT '是否必須變更密碼',
ADD COLUMN IF NOT EXISTS password_set_at DATETIME NULL COMMENT '密碼設定時間',
ADD COLUMN IF NOT EXISTS last_password_change DATETIME NULL COMMENT '最後變更密碼時間';

-- 3. 擴充 user_extensions 表 - 新增啟用相關欄位
ALTER TABLE user_extensions 
ADD COLUMN IF NOT EXISTS activation_email_sent_at DATETIME NULL COMMENT '啟用郵件發送時間',
ADD COLUMN IF NOT EXISTS activation_email_count INT DEFAULT 0 COMMENT '啟用郵件發送次數',
ADD COLUMN IF NOT EXISTS activated_at DATETIME NULL COMMENT '帳號啟用時間';

-- 4. 為現有用戶設定預設值
UPDATE users 
SET password_set_at = created_at, 
    last_password_change = created_at 
WHERE password_set_at IS NULL AND password IS NOT NULL;

UPDATE user_extensions 
SET activated_at = created_at 
WHERE activated_at IS NULL AND EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = user_extensions.user_id 
    AND users.is_active = TRUE
);

-- 5. 建立清理過期 token 的預存程序（可選）
DELIMITER $$
CREATE PROCEDURE IF NOT EXISTS CleanExpiredTokens()
BEGIN
    DELETE FROM user_activation_tokens 
    WHERE expires_at < NOW() AND used = FALSE;
    
    SELECT ROW_COUNT() as deleted_count;
END$$
DELIMITER ;

-- 6. 建立觸發器自動更新 password_set_at（當密碼變更時）
DELIMITER $$
CREATE TRIGGER IF NOT EXISTS update_password_set_time 
BEFORE UPDATE ON users
FOR EACH ROW
BEGIN
    IF OLD.password != NEW.password THEN
        SET NEW.password_set_at = NOW();
        SET NEW.last_password_change = NOW();
    END IF;
END$$
DELIMITER ;

-- 7. 插入預設密碼策略（如果 password_policies 表存在）
INSERT IGNORE INTO password_policies (
    policy_name,
    min_length,
    require_uppercase,
    require_lowercase,
    require_numbers,
    require_special_chars,
    max_age_days,
    history_count,
    lockout_attempts,
    is_active,
    created_at
) VALUES (
    'default_policy',
    8,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    90,
    5,
    5,
    TRUE,
    NOW()
);

-- 8. 建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_users_password_set_at ON users(password_set_at);
CREATE INDEX IF NOT EXISTS idx_users_must_change_password ON users(must_change_password);
CREATE INDEX IF NOT EXISTS idx_user_extensions_activation_sent ON user_extensions(activation_email_sent_at);
CREATE INDEX IF NOT EXISTS idx_user_extensions_activated ON user_extensions(activated_at);

-- 9. 確認資料完整性
-- 檢查是否有用戶缺少 user_extensions 記錄
INSERT IGNORE INTO user_extensions (user_id, created_at)
SELECT id, created_at 
FROM users 
WHERE id NOT IN (SELECT user_id FROM user_extensions);

-- 10. 資料驗證查詢（可手動執行檢查）
-- SELECT COUNT(*) as total_users FROM users;
-- SELECT COUNT(*) as users_with_extensions FROM user_extensions;
-- SELECT COUNT(*) as active_tokens FROM user_activation_tokens WHERE used = FALSE AND expires_at > NOW();

COMMIT;