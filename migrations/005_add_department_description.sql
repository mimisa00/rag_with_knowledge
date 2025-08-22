-- =====================================================
-- 新增部門描述欄位
-- 版本：1.0
-- 日期：2025-01-21
-- =====================================================

USE rag_db;

-- 新增 description 欄位到 departments 表
ALTER TABLE departments 
ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL COMMENT '部門描述' 
AFTER name;

-- 更新現有部門的描述（如果有存在 metadata 中的描述）
UPDATE departments 
SET description = JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.description'))
WHERE metadata IS NOT NULL 
  AND JSON_EXTRACT(metadata, '$.description') IS NOT NULL;

-- 清理 metadata 中的 description
UPDATE departments 
SET metadata = JSON_REMOVE(metadata, '$.description')
WHERE metadata IS NOT NULL 
  AND JSON_EXTRACT(metadata, '$.description') IS NOT NULL;

-- 顯示更新結果
SELECT 
    id,
    code,
    name,
    description,
    metadata
FROM departments
WHERE description IS NOT NULL
   OR metadata IS NOT NULL;