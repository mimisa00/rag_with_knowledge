-- =====================================================
-- 角色資料驗證約束
-- 版本：1.0
-- 日期：2025-01-22
-- 說明：防止角色代碼和名稱為空字串
-- =====================================================

USE rag_db;

-- 為 roles 表添加檢查約束，防止空字串
ALTER TABLE roles 
ADD CONSTRAINT chk_role_code_not_empty 
CHECK (CHAR_LENGTH(TRIM(code)) > 0);

ALTER TABLE roles 
ADD CONSTRAINT chk_role_name_not_empty 
CHECK (CHAR_LENGTH(TRIM(name)) > 0);

-- 更新現有的空字串數據（如果有的話）
UPDATE roles 
SET code = CONCAT('ROLE_', id) 
WHERE code = '' OR TRIM(code) = '';

UPDATE roles 
SET name = CONCAT('角色_', id) 
WHERE name = '' OR TRIM(name) = '';

-- 完成訊息
SELECT '角色驗證約束已添加完成' AS status;