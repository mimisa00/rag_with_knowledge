-- 建立資料庫
CREATE DATABASE IF NOT EXISTS rag_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE rag_db;

-- =====================================================
-- 2-1. departments（部門表）
-- =====================================================
CREATE TABLE IF NOT EXISTS departments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    parent_id BIGINT DEFAULT NULL COMMENT '父部門 ID，NULL 表示根部門',
    external_id VARCHAR(100) DEFAULT NULL COMMENT '外部系統部門 ID',
    code VARCHAR(50) NOT NULL COMMENT '部門代碼',
    name VARCHAR(100) NOT NULL COMMENT '部門名稱',
    description TEXT COMMENT '部門描述',
    path VARCHAR(500) DEFAULT NULL COMMENT '部門路徑，如 /總公司/資訊部/開發組',
    level INT DEFAULT 0 COMMENT '層級深度，根部門為 0',
    sort_order INT DEFAULT 0 COMMENT '同層排序',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否啟用',
    sync_source VARCHAR(50) DEFAULT NULL COMMENT '同步來源（hr_system/manual）',
    metadata JSON DEFAULT NULL COMMENT '額外資料',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    updated_by INT DEFAULT NULL,
    
    INDEX idx_parent (parent_id),
    INDEX idx_code (code),
    INDEX idx_path (path),
    INDEX idx_external (external_id),
    UNIQUE KEY uk_code (code),
    FOREIGN KEY (parent_id) REFERENCES departments(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 2-2. roles（角色表）
-- =====================================================
CREATE TABLE IF NOT EXISTS roles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL COMMENT '角色代碼',
    name VARCHAR(100) NOT NULL COMMENT '角色名稱',
    description TEXT COMMENT '角色描述',
    role_type VARCHAR(20) DEFAULT 'custom' COMMENT '角色類型：system/custom',
    permissions JSON DEFAULT NULL COMMENT '權限設定 JSON',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否啟用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    updated_by INT DEFAULT NULL,
    
    INDEX idx_code (code),
    INDEX idx_type (role_type),
    UNIQUE KEY uk_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 2-3. user_extensions（使用者擴充表）
-- =====================================================
CREATE TABLE IF NOT EXISTS user_extensions (
    user_id INT PRIMARY KEY,                      -- 關聯到 users.id
    department_id BIGINT DEFAULT NULL COMMENT '所屬部門',
    external_id VARCHAR(100) DEFAULT NULL COMMENT '外部系統使用者 ID',
    employee_no VARCHAR(50) DEFAULT NULL COMMENT '員工編號',
    title VARCHAR(100) DEFAULT NULL COMMENT '職稱',
    manager_id INT DEFAULT NULL COMMENT '直屬主管',
    auth_source VARCHAR(20) DEFAULT 'local' COMMENT '認證來源：local/ldap/sso/synced',
    password_strategy VARCHAR(20) DEFAULT NULL COMMENT '密碼策略',
    activation_token VARCHAR(255) DEFAULT NULL COMMENT '啟用 token',
    activation_expires TIMESTAMP DEFAULT NULL COMMENT '啟用期限',
    last_sync_at TIMESTAMP DEFAULT NULL COMMENT '最後同步時間',
    metadata JSON DEFAULT NULL COMMENT '額外資料',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_department (department_id),
    INDEX idx_external (external_id),
    INDEX idx_employee_no (employee_no),
    INDEX idx_manager (manager_id),
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 2-4. user_roles（使用者角色關聯表）
-- =====================================================
CREATE TABLE IF NOT EXISTS user_roles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL COMMENT '使用者 ID',
    role_id BIGINT NOT NULL COMMENT '角色 ID',
    department_id BIGINT DEFAULT NULL COMMENT '角色作用部門（NULL 表示全域）',
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '指派時間',
    assigned_by INT DEFAULT NULL COMMENT '指派者',
    expires_at TIMESTAMP DEFAULT NULL COMMENT '角色過期時間',
    
    INDEX idx_user (user_id),
    INDEX idx_role (role_id),
    INDEX idx_department (department_id),
    UNIQUE KEY uk_user_role_dept (user_id, role_id, department_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE roles 
ADD CONSTRAINT chk_role_code_not_empty 
CHECK (CHAR_LENGTH(TRIM(code)) > 0);

ALTER TABLE roles 
ADD CONSTRAINT chk_role_name_not_empty 
CHECK (CHAR_LENGTH(TRIM(name)) > 0);

-- =====================================================
-- 2-5. system_modes（系統模式設定表）
-- =====================================================
CREATE TABLE IF NOT EXISTS system_modes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mode_key VARCHAR(50) NOT NULL COMMENT '設定鍵',
    mode_value VARCHAR(255) NOT NULL COMMENT '設定值',
    category VARCHAR(50) DEFAULT 'general' COMMENT '分類',
    description TEXT COMMENT '說明',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by INT DEFAULT NULL,
    
    UNIQUE KEY uk_key (mode_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 2-6. password_policies（密碼策略表）
-- =====================================================
CREATE TABLE IF NOT EXISTS password_policies (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    policy_name VARCHAR(50) NOT NULL COMMENT '策略名稱',
    policy_type VARCHAR(20) NOT NULL COMMENT '策略類型',
    apply_to VARCHAR(20) DEFAULT 'all' COMMENT '適用對象：all/department/role',
    target_id VARCHAR(100) DEFAULT NULL COMMENT '目標 ID（部門或角色）',
    min_length INT DEFAULT 8 COMMENT '最小長度',
    require_uppercase BOOLEAN DEFAULT TRUE COMMENT '需要大寫',
    require_lowercase BOOLEAN DEFAULT TRUE COMMENT '需要小寫',
    require_numbers BOOLEAN DEFAULT TRUE COMMENT '需要數字',
    require_special BOOLEAN DEFAULT FALSE COMMENT '需要特殊字元',
    expire_days INT DEFAULT 90 COMMENT '過期天數',
    force_change_first BOOLEAN DEFAULT TRUE COMMENT '首次登入強制變更',
    config JSON DEFAULT NULL COMMENT '其他設定',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否啟用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '建立時間',
    
    INDEX idx_type (policy_type),
    INDEX idx_target (target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 2-7. 插入預設資料
-- =====================================================

-- 預設角色
INSERT INTO roles (code, name, description, role_type, permissions) VALUES
('SYSTEM_ADMIN', '系統管理員', '具有系統所有權限', 'system', 
 '{"all": true}'),
('KB_MANAGER', '知識庫管理員', '管理知識庫和文件', 'system',
 '{"knowledge_base": ["create", "read", "update", "delete"], "documents": ["all"]}'),
('USER', '一般使用者', '基本使用權限', 'system',
 '{"knowledge_base": ["read"], "documents": ["read", "upload"]}')
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    description = VALUES(description),
    permissions = VALUES(permissions);

-- 系統模式預設值
INSERT INTO system_modes (mode_key, mode_value, category, description) VALUES
('SYSTEM_MODE', 'BASIC', 'core', '系統運作模式：BASIC/ORGANIZATION'),
('AUTH_MODE', 'LOCAL', 'auth', '認證模式：LOCAL/SSO/HYBRID'),
('ALLOW_REGISTRATION', 'true', 'auth', '是否允許自助註冊'),
('PASSWORD_STRATEGY', 'ACTIVATION_LINK', 'auth', '密碼策略：ACTIVATION_LINK/TEMP_PASSWORD/LDAP'),
('SYNC_ENABLED', 'false', 'sync', '是否啟用自動同步')
ON DUPLICATE KEY UPDATE 
    mode_value = VALUES(mode_value),
    description = VALUES(description);

-- 基本模式的預設部門
INSERT INTO departments (code, name, path, level, sort_order, sync_source) VALUES
('DEFAULT', '預設部門', '/預設部門', 0, 0, 'manual')
ON DUPLICATE KEY UPDATE 
    name = VALUES(name);

-- =====================================================
-- 2-8. 資料遷移：處理既有使用者
-- =====================================================

-- 為既有使用者建立擴充資料
INSERT INTO user_extensions (user_id, department_id, auth_source)
SELECT u.id, 
       (SELECT id FROM departments WHERE code = 'DEFAULT' LIMIT 1),
       'local'
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM user_extensions WHERE user_id = u.id
);

-- 為既有管理員分配系統管理員角色
INSERT INTO user_roles (user_id, role_id, assigned_by)
SELECT u.id, r.id, NULL
FROM users u
CROSS JOIN roles r
WHERE u.role = 'admin'
  AND r.code = 'SYSTEM_ADMIN'
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = u.id AND ur.role_id = r.id
);

-- 為既有一般使用者分配預設角色
INSERT INTO user_roles (user_id, role_id, assigned_by)
SELECT u.id, r.id, NULL
FROM users u
CROSS JOIN roles r
WHERE u.role = 'user'
  AND r.code = 'USER'
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = u.id AND ur.role_id = r.id
);

-- =====================================================
-- 2-9. 建立審計相關表（為 Phase 8 預備）
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,                                  -- 操作使用者
    action VARCHAR(50) NOT NULL,                  -- 動作類型
    target_type VARCHAR(50),                      -- 目標類型（user/role/department）
    target_id VARCHAR(100),                       -- 目標 ID
    changes JSON DEFAULT NULL,                    -- 變更內容
    ip_address VARCHAR(45),                       -- IP 地址
    user_agent TEXT,                              -- User Agent
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user (user_id),
    INDEX idx_action (action),
    INDEX idx_target (target_type, target_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 完成訊息
-- =====================================================
SELECT '組織管理系統資料表建立完成' AS status;