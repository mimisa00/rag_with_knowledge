-- =====================================================
-- 權限矩陣管理資料表
-- =====================================================

USE rag_db;

-- =====================================================
-- permission_matrix（權限矩陣表）
-- =====================================================
CREATE TABLE IF NOT EXISTS `permission_matrix` (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    module_code VARCHAR(50) NOT NULL COMMENT '模組代碼',
    module_name VARCHAR(100) NOT NULL COMMENT '模組名稱',
    action_code VARCHAR(50) NOT NULL COMMENT '動作代碼',
    action_name VARCHAR(100) NOT NULL COMMENT '動作名稱',
    permission_key VARCHAR(100) NOT NULL COMMENT '權限鍵值 (module_code.action_code)',
    description TEXT COMMENT '權限描述',
    permission_type VARCHAR(20) DEFAULT 'custom' COMMENT '權限類型：system/custom',
    sort_order INT DEFAULT 0 COMMENT '排序順序',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否啟用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    updated_by INT DEFAULT NULL,
    
    INDEX idx_module_code (module_code),
    INDEX idx_action_code (action_code),
    INDEX idx_permission_key (permission_key),
    INDEX idx_type (permission_type),
    INDEX idx_active (is_active),
    UNIQUE KEY uk_permission_key (permission_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 預設權限矩陣資料
-- =====================================================

-- 系統管理模組
INSERT INTO permission_matrix (module_code, module_name, action_code, action_name, permission_key, description, permission_type, sort_order) VALUES
('system', '系統管理', 'view', '檢視', 'system.view', '檢視系統管理功能', 'system', 1),
('system', '系統管理', 'create', '新增', 'system.create', '新增系統設定', 'system', 2),
('system', '系統管理', 'update', '更新', 'system.update', '更新系統設定', 'system', 3),
('system', '系統管理', 'delete', '刪除', 'system.delete', '刪除系統設定', 'system', 4),
('system', '系統管理', 'export', '匯出', 'system.export', '匯出系統資料', 'system', 5);

-- 使用者管理模組
INSERT INTO permission_matrix (module_code, module_name, action_code, action_name, permission_key, description, permission_type, sort_order) VALUES
('user', '使用者管理', 'view', '檢視', 'user.view', '檢視使用者資料', 'system', 10),
('user', '使用者管理', 'create', '新增', 'user.create', '新增使用者', 'system', 11),
('user', '使用者管理', 'update', '更新', 'user.update', '更新使用者資料', 'system', 12),
('user', '使用者管理', 'delete', '刪除', 'user.delete', '刪除使用者', 'system', 13),
('user', '使用者管理', 'reset_password', '重設密碼', 'user.reset_password', '重設使用者密碼', 'system', 14),
('user', '使用者管理', 'assign_role', '指派角色', 'user.assign_role', '指派使用者角色', 'system', 15);

-- 組織管理模組
INSERT INTO permission_matrix (module_code, module_name, action_code, action_name, permission_key, description, permission_type, sort_order) VALUES
('organization', '組織管理', 'view', '檢視', 'organization.view', '檢視組織架構', 'system', 20),
('organization', '組織管理', 'create', '新增', 'organization.create', '新增部門或角色', 'system', 21),
('organization', '組織管理', 'update', '更新', 'organization.update', '更新組織資料', 'system', 22),
('organization', '組織管理', 'delete', '刪除', 'organization.delete', '刪除部門或角色', 'system', 23),
('organization', '組織管理', 'manage_structure', '管理架構', 'organization.manage_structure', '調整組織架構', 'system', 24);

-- 權限管理模組
INSERT INTO permission_matrix (module_code, module_name, action_code, action_name, permission_key, description, permission_type, sort_order) VALUES
('permission', '權限管理', 'view', '檢視', 'permission.view', '檢視權限設定', 'system', 30),
('permission', '權限管理', 'create', '新增', 'permission.create', '新增權限群組', 'system', 31),
('permission', '權限管理', 'update', '更新', 'permission.update', '更新權限設定', 'system', 32),
('permission', '權限管理', 'delete', '刪除', 'permission.delete', '刪除權限群組', 'system', 33),
('permission', '權限管理', 'assign', '指派', 'permission.assign', '指派權限給使用者或群組', 'system', 34);

-- 知識庫管理模組
INSERT INTO permission_matrix (module_code, module_name, action_code, action_name, permission_key, description, permission_type, sort_order) VALUES
('knowledge_base', '知識庫管理', 'view', '檢視', 'knowledge_base.view', '檢視知識庫內容', 'system', 40),
('knowledge_base', '知識庫管理', 'create', '新增', 'knowledge_base.create', '新增知識庫', 'system', 41),
('knowledge_base', '知識庫管理', 'update', '更新', 'knowledge_base.update', '更新知識庫內容', 'system', 42),
('knowledge_base', '知識庫管理', 'delete', '刪除', 'knowledge_base.delete', '刪除知識庫', 'system', 43),
('knowledge_base', '知識庫管理', 'upload', '上傳', 'knowledge_base.upload', '上傳文件到知識庫', 'system', 44),
('knowledge_base', '知識庫管理', 'download', '下載', 'knowledge_base.download', '下載知識庫文件', 'system', 45);

-- 文件管理模組
INSERT INTO permission_matrix (module_code, module_name, action_code, action_name, permission_key, description, permission_type, sort_order) VALUES
('document', '文件管理', 'view', '檢視', 'document.view', '檢視文件', 'system', 50),
('document', '文件管理', 'create', '新增', 'document.create', '新增文件', 'system', 51),
('document', '文件管理', 'update', '更新', 'document.update', '更新文件內容', 'system', 52),
('document', '文件管理', 'delete', '刪除', 'document.delete', '刪除文件', 'system', 53),
('document', '文件管理', 'upload', '上傳', 'document.upload', '上傳文件', 'system', 54),
('document', '文件管理', 'download', '下載', 'document.download', '下載文件', 'system', 55),
('document', '文件管理', 'share', '分享', 'document.share', '分享文件給其他使用者', 'system', 56);

-- 報表管理模組
INSERT INTO permission_matrix (module_code, module_name, action_code, action_name, permission_key, description, permission_type, sort_order) VALUES
('report', '報表管理', 'view', '檢視', 'report.view', '檢視報表', 'system', 60),
('report', '報表管理', 'create', '新增', 'report.create', '新增報表', 'system', 61),
('report', '報表管理', 'export', '匯出', 'report.export', '匯出報表資料', 'system', 62),
('report', '報表管理', 'schedule', '排程', 'report.schedule', '設定報表排程', 'system', 63);

-- 稽核記錄模組
INSERT INTO permission_matrix (module_code, module_name, action_code, action_name, permission_key, description, permission_type, sort_order) VALUES
('audit', '稽核記錄', 'view', '檢視', 'audit.view', '檢視稽核記錄', 'system', 70),
('audit', '稽核記錄', 'export', '匯出', 'audit.export', '匯出稽核記錄', 'system', 71),
('audit', '稽核記錄', 'manage', '管理', 'audit.manage', '管理稽核設定', 'system', 72);

-- 避免重複插入
INSERT INTO permission_matrix (module_code, module_name, action_code, action_name, permission_key, description, permission_type, sort_order) VALUES
('system', '系統管理', 'view', '檢視', 'system.view', '檢視系統管理功能', 'system', 1)
ON DUPLICATE KEY UPDATE 
    module_name = VALUES(module_name),
    action_name = VALUES(action_name),
    description = VALUES(description),
    sort_order = VALUES(sort_order);