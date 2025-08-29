-- =====================================================
-- 角色模板管理系統資料表
-- =====================================================

-- 建立資料庫
CREATE DATABASE IF NOT EXISTS rag_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE rag_db;


-- =====================================================
-- 1. 角色模板表 - 定義可重複使用的角色模板
-- =====================================================
CREATE TABLE IF NOT EXISTS role_templates (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL COMMENT '模板代碼',
    name VARCHAR(100) NOT NULL COMMENT '模板名稱',
    description TEXT COMMENT '模板描述',
    role_type VARCHAR(20) NOT NULL COMMENT '角色類型：manager/staff',
    level INT DEFAULT 0 COMMENT '角色層級（1=最高）',
    default_permissions JSON DEFAULT NULL COMMENT '預設權限配置',
    is_system BOOLEAN DEFAULT FALSE COMMENT '是否為系統預設模板',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否啟用',
    sort_order INT DEFAULT 0 COMMENT '排序順序',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    updated_by INT DEFAULT NULL,
    
    UNIQUE KEY uk_code (code),
    INDEX idx_role_type (role_type),
    INDEX idx_is_system (is_system),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='角色模板定義表';

-- =====================================================
-- 2. 部門角色表 - 部門實際使用的角色
-- =====================================================
CREATE TABLE IF NOT EXISTS department_roles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    department_id BIGINT NOT NULL COMMENT '部門ID',
    template_id BIGINT NOT NULL COMMENT '來源模板ID',
    parent_id BIGINT DEFAULT NULL COMMENT '父角色ID，NULL表示頂層角色',
    code VARCHAR(50) NOT NULL COMMENT '角色代碼',
    name VARCHAR(100) NOT NULL COMMENT '角色名稱（格式：部門名稱-角色名稱）',
    role_type VARCHAR(20) NOT NULL COMMENT '角色類型：manager/staff',
    level INT DEFAULT 0 COMMENT '角色層級',
    permissions JSON DEFAULT NULL COMMENT '自訂權限（覆寫模板）',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否啟用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    updated_by INT DEFAULT NULL,
    
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES role_templates(id),
    FOREIGN KEY (parent_id) REFERENCES department_roles(id) ON DELETE SET NULL,
    INDEX idx_parent (parent_id),
    INDEX idx_dept_role (department_id, template_id),
    INDEX idx_role_type (role_type),
    INDEX idx_is_active (is_active),
    UNIQUE KEY uk_dept_role_code (department_id, code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='部門角色表';

-- =====================================================
-- 3. 用戶部門角色關聯表 - 用戶在部門中的角色
-- =====================================================
CREATE TABLE IF NOT EXISTS user_department_roles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL COMMENT '用戶ID',
    department_role_id BIGINT NOT NULL COMMENT '部門角色ID',
    is_primary BOOLEAN DEFAULT FALSE COMMENT '是否為主要角色',
    effective_date DATE DEFAULT NULL COMMENT '生效日期',
    expiry_date DATE DEFAULT NULL COMMENT '失效日期',
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '指派時間',
    assigned_by INT DEFAULT NULL COMMENT '指派者',
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (department_role_id) REFERENCES department_roles(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_role (user_id, department_role_id),
    INDEX idx_effective_date (effective_date),
    INDEX idx_expiry_date (expiry_date),
    UNIQUE KEY uk_user_dept_role (user_id, department_role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='用戶部門角色關聯表';

-- =====================================================
-- 4. 插入預設角色模板
-- =====================================================
INSERT INTO role_templates (code, name, description, role_type, level, is_system, sort_order) VALUES
('MANAGER', '部門主管', '適用於管理職位', 'manager', 1, TRUE, 1),
('STAFF', '部門成員', '適用於一般職位', 'staff', 1, TRUE, 2);

-- =====================================================
-- 5. 角色模板統計視圖
-- =====================================================
CREATE OR REPLACE VIEW v_role_template_stats AS
SELECT 
    rt.id,
    rt.code,
    rt.name,
    rt.role_type,
    rt.is_system,
    COUNT(DISTINCT dr.id) as usage_count,
    COUNT(DISTINCT dr.department_id) as department_count,
    COUNT(DISTINCT udr.user_id) as user_count
FROM role_templates rt
LEFT JOIN department_roles dr ON rt.id = dr.template_id
LEFT JOIN user_department_roles udr ON dr.id = udr.department_role_id
GROUP BY rt.id;

-- =====================================================
-- 6. 部門角色詳情視圖
-- =====================================================
CREATE OR REPLACE VIEW v_department_role_details AS
SELECT 
    dr.id,
    dr.department_id,
    d.name as department_name,
    dr.template_id,
    rt.name as template_name,
    dr.code,
    dr.name as role_name,
    dr.role_type,
    dr.level,
    dr.is_active,
    COUNT(DISTINCT udr.user_id) as user_count
FROM department_roles dr
INNER JOIN departments d ON dr.department_id = d.id
INNER JOIN role_templates rt ON dr.template_id = rt.id
LEFT JOIN user_department_roles udr ON dr.id = udr.department_role_id
GROUP BY dr.id;

-- =====================================================
-- 7. 用戶角色詳情視圖
-- =====================================================
CREATE OR REPLACE VIEW v_user_department_roles AS
SELECT 
    udr.id,
    udr.user_id,
    u.username,
    u.email,
    udr.department_role_id,
    dr.name as role_name,
    dr.role_type,
    dr.level as role_level,
    dr.department_id,
    d.name as department_name,
    udr.is_primary,
    udr.effective_date,
    udr.expiry_date,
    udr.assigned_at,
    udr.assigned_by,
    au.username as assigned_by_name
FROM user_department_roles udr
INNER JOIN users u ON udr.user_id = u.id
INNER JOIN department_roles dr ON udr.department_role_id = dr.id
INNER JOIN departments d ON dr.department_id = d.id
LEFT JOIN users au ON udr.assigned_by = au.id;

-- =====================================================
-- 8. 授權管理員角色相關權限
-- =====================================================
-- 這裡假設已經有權限系統，需要更新管理員的權限以包含角色模板管理
UPDATE permission_groups 
SET permissions = JSON_MERGE_PATCH(permissions, '{"role_templates": ["create", "read", "update", "delete"]}')
WHERE code = 'SYSTEM_ADMIN';