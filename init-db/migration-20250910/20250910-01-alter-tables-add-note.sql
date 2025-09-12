-- =====================================================
-- 檔案: 20250910-01-alter-tables-add-note.sql
-- 描述: 為權限相關表格新增 note 欄位以儲存程式碼位置備註
-- 作者: Claude AI Assistant
-- 日期: 2025-01-22
-- =====================================================

-- =====================================================
-- 為權限相關表格新增 note 欄位
-- 用於儲存詳細的程式碼位置和備註資訊
-- =====================================================

-- 檢查並新增 permission_matrix 表的 note 欄位
-- 注意：permission_matrix 表已經有 note 欄位，所以使用 IF NOT EXISTS
ALTER TABLE permission_matrix 
ADD COLUMN IF NOT EXISTS note TEXT 
COMMENT '程式碼位置備註' 
AFTER updated_by;

-- 檢查並新增 permission_urls 表的 note 欄位
ALTER TABLE permission_urls 
ADD COLUMN IF NOT EXISTS note TEXT 
COMMENT 'HTML 檔案位置、Router 位置、初始化函數等備註' 
AFTER updated_by;

-- 檢查並新增 permission_apis 表的 note 欄位
ALTER TABLE permission_apis 
ADD COLUMN IF NOT EXISTS note TEXT 
COMMENT '後端檔案位置、前端呼叫位置、表單元素等備註' 
AFTER updated_by;

-- 檢查並新增 permission_actions 表的 note 欄位
ALTER TABLE permission_actions 
ADD COLUMN IF NOT EXISTS note TEXT 
COMMENT 'HTML 位置、JS 函數、元素選擇器、事件綁定等備註' 
AFTER updated_by;

-- =====================================================
-- 驗證欄位是否成功新增
-- =====================================================
SELECT 
    'permission_matrix' AS table_name,
    COUNT(*) AS has_note_column
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'rag_db' 
    AND TABLE_NAME = 'permission_matrix' 
    AND COLUMN_NAME = 'note'
UNION ALL
SELECT 
    'permission_urls' AS table_name,
    COUNT(*) AS has_note_column
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'rag_db' 
    AND TABLE_NAME = 'permission_urls' 
    AND COLUMN_NAME = 'note'
UNION ALL
SELECT 
    'permission_apis' AS table_name,
    COUNT(*) AS has_note_column
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'rag_db' 
    AND TABLE_NAME = 'permission_apis' 
    AND COLUMN_NAME = 'note'
UNION ALL
SELECT 
    'permission_actions' AS table_name,
    COUNT(*) AS has_note_column
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'rag_db' 
    AND TABLE_NAME = 'permission_actions' 
    AND COLUMN_NAME = 'note';

-- =====================================================
-- 完成訊息
-- =====================================================
SELECT 'Note 欄位已新增至權限相關表格' AS message;