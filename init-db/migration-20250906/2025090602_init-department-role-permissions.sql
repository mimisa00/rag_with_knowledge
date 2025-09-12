-- =====================================================
-- 部門角色權限關聯表
-- =====================================================

ALTER TABLE `department_roles`
	DROP COLUMN `permissions`;

-- 建立部門角色與權限群組的關聯表
CREATE TABLE IF NOT EXISTS permission_groups_department_role (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    department_role_id BIGINT NOT NULL COMMENT '部門角色ID',
    permission_group_id BIGINT NOT NULL COMMENT '權限群組ID',
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '指派時間',
    assigned_by INT DEFAULT NULL COMMENT '指派者',
    
    -- 外鍵約束
    FOREIGN KEY (department_role_id) REFERENCES department_roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_group_id) REFERENCES permission_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- 索引
    INDEX idx_department_role (department_role_id),
    INDEX idx_permission_group (permission_group_id),
    INDEX idx_assigned_at (assigned_at),
    
    -- 唯一約束：同一角色不能重複指派相同權限群組
    UNIQUE KEY uk_role_permission (department_role_id, permission_group_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='部門角色權限群組關聯表';

-- =====================================================
-- 初始化部門角色的權限
-- 根據角色類型自動指派基本權限
-- =====================================================

-- 為管理角色指派管理權限
INSERT IGNORE INTO permission_groups_department_role (department_role_id, permission_group_id, assigned_by)
SELECT 
    dr.id,
    pg.id,
    1 -- 系統自動指派
FROM department_roles dr
CROSS JOIN permission_groups pg
WHERE dr.role_type = 'manager'
  AND pg.code IN ('MANAGER', 'USER') -- 管理角色擁有管理權限和基本權限
  AND pg.is_active = true;

-- 為一般員工角色指派基本權限  
INSERT IGNORE INTO permission_groups_department_role (department_role_id, permission_group_id, assigned_by)
SELECT 
    dr.id,
    pg.id,
    1 -- 系統自動指派
FROM department_roles dr
CROSS JOIN permission_groups pg
WHERE dr.role_type = 'staff'
  AND pg.code = 'USER' -- 一般角色只有基本權限
  AND pg.is_active = true;

-- =====================================================
-- 創建索引以優化權限查詢效能
-- =====================================================

-- 優化權限查詢的複合索引
CREATE INDEX IF NOT EXISTS idx_user_role_permission 
ON user_department_roles(user_id, department_role_id);

CREATE INDEX IF NOT EXISTS idx_role_permission_lookup
ON permission_groups_department_role(department_role_id, permission_group_id);