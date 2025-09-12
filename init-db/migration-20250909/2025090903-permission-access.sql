-- ==================================================
-- 權限資源對應管理資料表遷移 
-- 日期: 2025-09-09
-- 功能: 基於實際 API 分析建立正確的權限對應
-- ==================================================

USE rag_db;

-- 1. URL 權限對應表（改進版）
CREATE TABLE IF NOT EXISTS permission_urls (
    id INT PRIMARY KEY AUTO_INCREMENT,
    url_pattern VARCHAR(255) NOT NULL COMMENT 'URL 模式，支援萬用字元 *',
    method VARCHAR(10) DEFAULT 'GET' COMMENT 'HTTP 方法',
    permission_matrix_id BIGINT COMMENT '關聯權限矩陣ID',
    permission_code VARCHAR(100) COMMENT '權限代碼（向後相容）',
    module_key VARCHAR(50) COMMENT '所屬模組',
    description TEXT COMMENT '說明',
    priority INT DEFAULT 100 COMMENT '優先級，數字越小優先級越高',
    is_public BOOLEAN DEFAULT FALSE COMMENT '是否公開存取',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否啟用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    updated_by INT DEFAULT NULL,
    INDEX idx_url_pattern (url_pattern),
    INDEX idx_permission_code (permission_code),
    INDEX idx_priority (priority),
    INDEX idx_is_public (is_public),
    INDEX idx_is_active (is_active),
    FOREIGN KEY (permission_matrix_id) REFERENCES permission_matrix(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='URL 權限對應表';

-- 2. API 權限對應表（改進版）
CREATE TABLE IF NOT EXISTS permission_apis (
    id INT PRIMARY KEY AUTO_INCREMENT,
    api_pattern VARCHAR(255) NOT NULL COMMENT 'API 路徑模式，支援萬用字元 *',
    method VARCHAR(10) NOT NULL COMMENT 'HTTP 方法: GET, POST, PUT, DELETE, PATCH',
    permission_matrix_id BIGINT COMMENT '關聯權限矩陣ID',
    permission_code VARCHAR(100) COMMENT '權限代碼（向後相容）',
    module_key VARCHAR(50) COMMENT '所屬模組',
    description TEXT COMMENT '說明',
    require_auth BOOLEAN DEFAULT TRUE COMMENT '是否需要認證',
    priority INT DEFAULT 100 COMMENT '優先級，數字越小優先級越高',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否啟用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    updated_by INT DEFAULT NULL,
    INDEX idx_api_pattern (api_pattern),
    INDEX idx_method (method),
    INDEX idx_permission_code (permission_code),
    INDEX idx_priority (priority),
    INDEX idx_require_auth (require_auth),
    INDEX idx_is_active (is_active),
    UNIQUE KEY uk_api_method (api_pattern, method),
    FOREIGN KEY (permission_matrix_id) REFERENCES permission_matrix(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='API 權限對應表';

-- 3. 權限動作對應表
CREATE TABLE IF NOT EXISTS permission_actions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    module_key VARCHAR(50) NOT NULL COMMENT '模組代碼',
    action_key VARCHAR(50) NOT NULL COMMENT '動作代碼',
    permission_code VARCHAR(100) NOT NULL COMMENT '權限代碼',
    name VARCHAR(100) NOT NULL COMMENT '動作名稱',
    description TEXT COMMENT '動作說明',
    dependencies JSON COMMENT '依賴的其他權限',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否啟用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    updated_by INT DEFAULT NULL,
    UNIQUE KEY uk_module_action (module_key, action_key),
    INDEX idx_permission_code (permission_code),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='權限動作對應表';

-- 4. 權限快取表（改進版，增加群組追蹤）
CREATE TABLE IF NOT EXISTS permission_cache (
    user_id INT PRIMARY KEY,
    group_ids JSON COMMENT '用戶所屬群組ID列表',
    permissions JSON COMMENT '權限列表快取',
    urls JSON COMMENT '可訪問 URL 列表',
    apis JSON COMMENT '可訪問 API 列表',
    cache_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '快取時間',
    expire_time TIMESTAMP NULL COMMENT '過期時間',
    INDEX idx_expire_time (expire_time),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='權限快取表';

-- ==================================================
-- 初始化預設資料
-- ==================================================

-- 插入預設 URL 權限對應
INSERT INTO permission_urls (url_pattern, method, module_key, description, priority, is_public, permission_matrix_id) VALUES
-- 公開頁面
('/login', 'GET', 'auth', '登入頁面', 1, TRUE, NULL),
('/register', 'GET', 'auth', '註冊頁面', 2, TRUE, NULL),
('/forgot-password', 'GET', 'auth', '忘記密碼頁面', 3, TRUE, NULL),

-- 管理員頁面
('/admin', 'GET', 'system', '管理中心首頁', 10, FALSE, (SELECT id FROM permission_matrix WHERE permission_key = 'system.view')),
('/admin/users', 'GET', 'user', '使用者管理頁面', 11, FALSE, (SELECT id FROM permission_matrix WHERE permission_key = 'user.view')),
('/admin/organization', 'GET', 'organization', '組織管理頁面', 12, FALSE, (SELECT id FROM permission_matrix WHERE permission_key = 'organization.view')),
('/admin/permissions', 'GET', 'permission', '權限管理頁面', 13, FALSE, (SELECT id FROM permission_matrix WHERE permission_key = 'permission.view')),
('/admin/knowledge-base', 'GET', 'knowledge_base', '知識庫管理頁面', 14, FALSE, (SELECT id FROM permission_matrix WHERE permission_key = 'knowledge_base.view')),

-- 一般使用者頁面
('/dashboard', 'GET', 'dashboard', '使用者儀表板', 20, FALSE, NULL),
('/knowledge-base/*', 'GET', 'knowledge_base', '知識庫檢視', 21, FALSE, (SELECT id FROM permission_matrix WHERE permission_key = 'knowledge_base.view')),
('/documents/*', 'GET', 'document', '文件檢視', 22, FALSE, (SELECT id FROM permission_matrix WHERE permission_key = 'document.view'));

-- 插入預設 API 權限對應
INSERT INTO permission_apis (api_pattern, method, module_key, description, require_auth, priority, permission_matrix_id) VALUES
-- 認證相關 API（公開）
('/api/user/login', 'POST', 'auth', '使用者登入', FALSE, 1, NULL),
('/api/user/logout', 'POST', 'auth', '使用者登出', TRUE, 2, NULL),
('/api/user/register', 'POST', 'auth', '使用者註冊', FALSE, 3, NULL),

-- 使用者管理 API
('/api/organization/users', 'GET', 'user', '取得使用者列表', TRUE, 10, (SELECT id FROM permission_matrix WHERE permission_key = 'user.view')),
('/api/organization/users', 'POST', 'user', '新增使用者', TRUE, 11, (SELECT id FROM permission_matrix WHERE permission_key = 'user.create')),
('/api/organization/users/*', 'GET', 'user', '取得單一使用者', TRUE, 12, (SELECT id FROM permission_matrix WHERE permission_key = 'user.view')),
('/api/organization/users/*', 'PUT', 'user', '更新使用者', TRUE, 13, (SELECT id FROM permission_matrix WHERE permission_key = 'user.update')),
('/api/organization/users/*', 'DELETE', 'user', '刪除使用者', TRUE, 14, (SELECT id FROM permission_matrix WHERE permission_key = 'user.delete')),

-- 組織管理 API
('/api/organization/departments', 'GET', 'organization', '取得部門列表', TRUE, 20, (SELECT id FROM permission_matrix WHERE permission_key = 'organization.view')),
('/api/organization/departments', 'POST', 'organization', '新增部門', TRUE, 21, (SELECT id FROM permission_matrix WHERE permission_key = 'organization.create')),
('/api/organization/departments/*', 'PUT', 'organization', '更新部門', TRUE, 22, (SELECT id FROM permission_matrix WHERE permission_key = 'organization.update')),
('/api/organization/departments/*', 'DELETE', 'organization', '刪除部門', TRUE, 23, (SELECT id FROM permission_matrix WHERE permission_key = 'organization.delete')),

-- 權限管理 API
('/api/permissions/matrix', 'GET', 'permission', '取得權限矩陣', TRUE, 30, (SELECT id FROM permission_matrix WHERE permission_key = 'permission.view')),
('/api/permissions/matrix', 'POST', 'permission', '新增權限項目', TRUE, 31, (SELECT id FROM permission_matrix WHERE permission_key = 'permission.create')),
('/api/permissions/matrix/*', 'PUT', 'permission', '更新權限項目', TRUE, 32, (SELECT id FROM permission_matrix WHERE permission_key = 'permission.update')),
('/api/permissions/matrix/*', 'DELETE', 'permission', '刪除權限項目', TRUE, 33, (SELECT id FROM permission_matrix WHERE permission_key = 'permission.delete')),

('/api/permissions/groups', 'GET', 'permission', '取得權限群組', TRUE, 34, (SELECT id FROM permission_matrix WHERE permission_key = 'permission.view')),
('/api/permissions/groups', 'POST', 'permission', '新增權限群組', TRUE, 35, (SELECT id FROM permission_matrix WHERE permission_key = 'permission.create')),
('/api/permissions/groups/*', 'PUT', 'permission', '更新權限群組', TRUE, 36, (SELECT id FROM permission_matrix WHERE permission_key = 'permission.update')),
('/api/permissions/groups/*', 'DELETE', 'permission', '刪除權限群組', TRUE, 37, (SELECT id FROM permission_matrix WHERE permission_key = 'permission.delete')),

-- 知識庫 API
('/api/kb/list', 'GET', 'knowledge_base', '取得知識庫列表', TRUE, 40, (SELECT id FROM permission_matrix WHERE permission_key = 'knowledge_base.view')),
('/api/kb/create', 'POST', 'knowledge_base', '建立知識庫', TRUE, 41, (SELECT id FROM permission_matrix WHERE permission_key = 'knowledge_base.create')),
('/api/kb/*/update', 'PUT', 'knowledge_base', '更新知識庫', TRUE, 42, (SELECT id FROM permission_matrix WHERE permission_key = 'knowledge_base.update')),
('/api/kb/*/delete', 'DELETE', 'knowledge_base', '刪除知識庫', TRUE, 43, (SELECT id FROM permission_matrix WHERE permission_key = 'knowledge_base.delete')),
('/api/kb/*/upload', 'POST', 'knowledge_base', '上傳文件', TRUE, 44, (SELECT id FROM permission_matrix WHERE permission_key = 'knowledge_base.upload')),

-- 文件管理 API
('/api/documents', 'GET', 'document', '取得文件列表', TRUE, 50, (SELECT id FROM permission_matrix WHERE permission_key = 'document.view')),
('/api/documents', 'POST', 'document', '新增文件', TRUE, 51, (SELECT id FROM permission_matrix WHERE permission_key = 'document.create')),
('/api/documents/*', 'GET', 'document', '取得文件內容', TRUE, 52, (SELECT id FROM permission_matrix WHERE permission_key = 'document.view')),
('/api/documents/*', 'PUT', 'document', '更新文件', TRUE, 53, (SELECT id FROM permission_matrix WHERE permission_key = 'document.update')),
('/api/documents/*', 'DELETE', 'document', '刪除文件', TRUE, 54, (SELECT id FROM permission_matrix WHERE permission_key = 'document.delete')),
('/api/documents/*/download', 'GET', 'document', '下載文件', TRUE, 55, (SELECT id FROM permission_matrix WHERE permission_key = 'document.download'));

-- 插入預設權限動作對應
INSERT INTO permission_actions (module_key, action_key, permission_code, name, description, dependencies) VALUES
-- 系統管理動作
('system', 'config', 'system.config', '系統設定', '修改系統設定', '["system.view"]'),
('system', 'backup', 'system.backup', '系統備份', '執行系統備份', '["system.view", "system.config"]'),
('system', 'restore', 'system.restore', '系統還原', '執行系統還原', '["system.view", "system.config", "system.backup"]'),

-- 使用者管理動作
('user', 'import', 'user.import', '批次匯入', '批次匯入使用者', '["user.view", "user.create"]'),
('user', 'export', 'user.export', '批次匯出', '批次匯出使用者資料', '["user.view"]'),
('user', 'batch_update', 'user.batch_update', '批次更新', '批次更新使用者', '["user.view", "user.update"]'),

-- 權限管理動作
('permission', 'batch_assign', 'permission.batch_assign', '批次指派', '批次指派權限', '["permission.view", "permission.assign"]'),
('permission', 'sync', 'permission.sync', '權限同步', '同步權限設定', '["permission.view", "permission.update"]'),

-- 知識庫管理動作
('knowledge_base', 'index', 'knowledge_base.index', '建立索引', '建立或重建知識庫索引', '["knowledge_base.view", "knowledge_base.update"]'),
('knowledge_base', 'batch_upload', 'knowledge_base.batch_upload', '批次上傳', '批次上傳文件', '["knowledge_base.view", "knowledge_base.upload"]'),
('knowledge_base', 'export', 'knowledge_base.export', '匯出知識庫', '匯出知識庫內容', '["knowledge_base.view"]');

-- 建立預存程序：檢查使用者對 URL 的存取權限
DELIMITER $$
CREATE PROCEDURE IF NOT EXISTS check_url_permission(
    IN p_user_id INT,
    IN p_url VARCHAR(255),
    IN p_method VARCHAR(10)
)
BEGIN
    DECLARE has_permission BOOLEAN DEFAULT FALSE;
    
    -- 檢查是否為公開 URL
    SELECT COUNT(*) > 0 INTO has_permission
    FROM permission_urls
    WHERE is_active = TRUE
      AND is_public = TRUE
      AND method = p_method
      AND (p_url LIKE REPLACE(url_pattern, '*', '%') OR p_url = url_pattern)
    ORDER BY priority
    LIMIT 1;
    
    IF has_permission THEN
        SELECT TRUE AS has_permission, 'Public URL' AS reason;
    ELSE
        -- 檢查使用者權限
        SELECT COUNT(*) > 0 INTO has_permission
        FROM permission_urls pu
        JOIN permission_groups_matrix pgm ON pu.permission_matrix_id = pgm.permission_matrix_id
        JOIN user_permission_groups upg ON pgm.permission_group_id = upg.permission_group_id
        WHERE upg.user_id = p_user_id
          AND pu.is_active = TRUE
          AND pu.method = p_method
          AND (p_url LIKE REPLACE(pu.url_pattern, '*', '%') OR p_url = pu.url_pattern)
        ORDER BY pu.priority
        LIMIT 1;
        
        SELECT has_permission, IF(has_permission, 'User has permission', 'Access denied') AS reason;
    END IF;
END$$
DELIMITER ;

-- 建立預存程序：檢查使用者對 API 的存取權限
DELIMITER $$
CREATE PROCEDURE IF NOT EXISTS check_api_permission(
    IN p_user_id INT,
    IN p_api VARCHAR(255),
    IN p_method VARCHAR(10)
)
BEGIN
    DECLARE has_permission BOOLEAN DEFAULT FALSE;
    DECLARE requires_auth BOOLEAN DEFAULT TRUE;
    
    -- 檢查 API 是否需要認證
    SELECT require_auth INTO requires_auth
    FROM permission_apis
    WHERE is_active = TRUE
      AND method = p_method
      AND (p_api LIKE REPLACE(api_pattern, '*', '%') OR p_api = api_pattern)
    ORDER BY priority
    LIMIT 1;
    
    IF NOT requires_auth THEN
        SELECT TRUE AS has_permission, 'No authentication required' AS reason;
    ELSE
        -- 檢查使用者權限
        SELECT COUNT(*) > 0 INTO has_permission
        FROM permission_apis pa
        JOIN permission_groups_matrix pgm ON pa.permission_matrix_id = pgm.permission_matrix_id
        JOIN user_permission_groups upg ON pgm.permission_group_id = upg.permission_group_id
        WHERE upg.user_id = p_user_id
          AND pa.is_active = TRUE
          AND pa.method = p_method
          AND (p_api LIKE REPLACE(pa.api_pattern, '*', '%') OR p_api = pa.api_pattern)
        ORDER BY pa.priority
        LIMIT 1;
        
        SELECT has_permission, IF(has_permission, 'User has permission', 'Access denied') AS reason;
    END IF;
END$$
DELIMITER ;

-- 建立預存程序：清除過期的權限快取
DELIMITER $$
CREATE PROCEDURE IF NOT EXISTS clear_expired_cache()
BEGIN
    DELETE FROM permission_cache
    WHERE expire_time IS NOT NULL AND expire_time < NOW();
END$$
DELIMITER ;

-- 建立事件：定期清除過期快取（每小時執行一次）
CREATE EVENT IF NOT EXISTS clear_permission_cache_event
ON SCHEDULE EVERY 1 HOUR
DO CALL clear_expired_cache();