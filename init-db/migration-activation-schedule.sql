-- 員工預約啟用功能資料庫遷移
-- 新增 activation_scheduled 欄位到 user_extensions 表

USE rag_db;

-- =====================================================
-- 新增預約啟用欄位
-- =====================================================
ALTER TABLE user_extensions 
ADD COLUMN activation_scheduled TIMESTAMP DEFAULT NULL COMMENT '預約啟用時間' 
AFTER activation_expires;

-- 為新欄位建立索引以提升查詢效能
CREATE INDEX idx_activation_scheduled ON user_extensions(activation_scheduled);
CREATE INDEX idx_activation_expires ON user_extensions(activation_expires);

-- =====================================================
-- 檢查結果
-- =====================================================
SELECT 
    'activation_scheduled 欄位新增完成' AS status,
    COUNT(*) AS affected_rows
FROM user_extensions;

-- 顯示更新後的表結構
DESCRIBE user_extensions;