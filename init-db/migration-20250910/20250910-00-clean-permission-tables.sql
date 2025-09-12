-- =====================================================
-- 檔案: 20250910-00-clean-permission-tables.sql
-- 描述: 清除權限系統所有舊資料
-- 作者: Claude AI Assistant
-- 日期: 2025-01-22
-- =====================================================

-- 關閉外鍵檢查以避免刪除順序問題
SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================
-- 步驟 1: 清除關聯表資料（按照外鍵依賴順序）
-- =====================================================

-- 清除權限群組與矩陣的關聯
DELETE FROM permission_groups_matrix;

-- 清除權限群組與使用者的關聯
DELETE FROM permission_groups_user;

-- 清除權限群組與部門角色的關聯
DELETE FROM permission_groups_department_role;

-- 清除權限快取
DELETE FROM permission_cache;

-- =====================================================
-- 步驟 2: 清除主要表格資料
-- =====================================================

-- 清除前端動作權限
DELETE FROM permission_actions;

-- 清除 API 權限對應
DELETE FROM permission_apis;

-- 清除 URL 權限對應
DELETE FROM permission_urls;

-- 清除權限群組
DELETE FROM permission_groups;

-- 清除權限矩陣
DELETE FROM permission_matrix;

-- =====================================================
-- 步驟 3: 重置自增 ID
-- =====================================================

-- 重置權限矩陣自增 ID
ALTER TABLE permission_matrix AUTO_INCREMENT = 1;

-- 重置權限群組自增 ID
ALTER TABLE permission_groups AUTO_INCREMENT = 1;

-- 重置 URL 權限自增 ID
ALTER TABLE permission_urls AUTO_INCREMENT = 1;

-- 重置 API 權限自增 ID
ALTER TABLE permission_apis AUTO_INCREMENT = 1;

-- 重置前端動作權限自增 ID
ALTER TABLE permission_actions AUTO_INCREMENT = 1;

-- 重置權限群組矩陣關聯自增 ID
ALTER TABLE permission_groups_matrix AUTO_INCREMENT = 1;

-- 重置權限群組使用者關聯自增 ID
ALTER TABLE permission_groups_user AUTO_INCREMENT = 1;

-- 重置權限群組部門角色關聯自增 ID
ALTER TABLE permission_groups_department_role AUTO_INCREMENT = 1;

-- 重置權限快取自增 ID
ALTER TABLE permission_cache AUTO_INCREMENT = 1;

-- 重新啟用外鍵檢查
SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================
-- 完成訊息
-- =====================================================
SELECT '權限系統資料已清除，準備載入預設值' AS message;