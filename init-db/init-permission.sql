-- 建立資料庫
CREATE DATABASE IF NOT EXISTS rag_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE rag_db;


-- =====================================================
-- 1-6. permission_groups（權限群組表）
-- =====================================================
CREATE TABLE `permission_groups` (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL COMMENT '權限群組代碼',
    name VARCHAR(100) NOT NULL COMMENT '權限群組名稱',
    description TEXT COMMENT '權限群組描述',
    permission_type VARCHAR(20) DEFAULT 'custom' COMMENT '權限群組類型：system/custom',
    permissions JSON DEFAULT NULL COMMENT '權限設定 JSON',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否啟用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    updated_by INT DEFAULT NULL,
    INDEX idx_code (code),
    INDEX idx_type (permission_type),
    UNIQUE KEY uk_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 預設角色
INSERT INTO permission_groups (code, name, description, permission_type, permissions) VALUES
('ORG_ADMIN', '組織管理員', '具有組織編輯權限', 'system', '{"all": true}'),
('KB_MANAGER', '知識庫管理員', '管理知識庫和文件', 'system','{"knowledge_base": ["create", "read", "update", "delete"], "documents": ["all"]}'),
('USER', '一般使用者', '基本使用權限', 'system', '{"knowledge_base": ["read"], "documents": ["read", "upload"]}')
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    description = VALUES(description),
    permissions = VALUES(permissions);

-- =====================================================
-- 1-7. permission_groups_user（使用者權限群組關聯表）
-- =====================================================
CREATE TABLE `permission_groups_user` (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL COMMENT '使用者 ID',
    permission_group_id BIGINT NOT NULL COMMENT '權限群組 ID',
    department_id BIGINT DEFAULT NULL COMMENT '權限群組作用部門（NULL 表示全域）',
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '指派時間',
    assigned_by INT DEFAULT NULL COMMENT '指派者',
    expires_at TIMESTAMP DEFAULT NULL COMMENT '角色過期時間',
    
    INDEX idx_user (user_id),
    INDEX idx_permission_group_id (permission_group_id),
    INDEX idx_department (department_id),
    UNIQUE KEY uk_user_role_dept (user_id, permission_group_id, department_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_group_id) REFERENCES permission_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 為既有管理員分配系統管理員角色
INSERT INTO permission_groups_user (user_id, permission_group_id, assigned_by)
SELECT u.id, r.id, NULL
FROM users u
CROSS JOIN permission_groups r
WHERE u.role = 'admin'
  AND r.code = 'SYSTEM_ADMIN'
  AND NOT EXISTS (
    SELECT 1 FROM permission_groups_user upg 
    WHERE upg.user_id = u.id AND upg.permission_group_id = r.id
);

-- 為既有一般使用者分配預設角色
INSERT INTO permission_groups_user (user_id, permission_group_id, assigned_by)
SELECT u.id, r.id, NULL
FROM users u
CROSS JOIN permission_groups r
WHERE u.role = 'user'
  AND r.code = 'USER'
  AND NOT EXISTS (
    SELECT 1 FROM permission_groups_user upg 
    WHERE upg.user_id = u.id AND upg.permission_group_id = r.id
);

