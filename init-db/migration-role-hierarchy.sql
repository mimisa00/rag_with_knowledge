-- Migration: 新增角色層級支援
-- Date: 2025-01-26
-- Purpose: 為 department_roles 表新增父角色支援，實現角色層級體系

USE rag_db;

-- 1. 新增 parent_id 欄位到 department_roles 表
ALTER TABLE department_roles 
ADD COLUMN parent_id BIGINT DEFAULT NULL COMMENT '父角色ID，NULL表示頂層角色' AFTER template_id;

-- 2. 新增索引以提升查詢效能
ALTER TABLE department_roles 
ADD INDEX idx_parent (parent_id);

-- 3. 新增外鍵約束（允許 SET NULL 以防止刪除父角色時的問題）
ALTER TABLE department_roles 
ADD FOREIGN KEY (parent_id) REFERENCES department_roles(id) ON DELETE SET NULL;

-- 4. 更新現有資料的層級值（將 0 調整為 1，因為頂層角色應該是 1）
UPDATE department_roles 
SET level = 1 
WHERE level = 0 OR level IS NULL;

-- 5. 為便於測試，可以選擇性地為現有角色建立一些層級關係
-- 這部分可以根據實際需要手動執行

SELECT 'Migration completed: department_roles 表已新增 parent_id 欄位和相關索引' AS status;