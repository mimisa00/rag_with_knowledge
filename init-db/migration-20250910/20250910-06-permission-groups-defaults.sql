-- =====================================================
-- 檔案: 20250910-06-permission-groups-defaults.sql
-- 描述: 預設權限群組設定
-- 作者: Claude AI Assistant
-- 日期: 2025-01-22
-- =====================================================

-- =====================================================
-- 預設權限群組
-- 建立系統預設的權限群組
-- =====================================================

-- 插入預設權限群組
INSERT IGNORE INTO permission_groups 
(code, name, description, permission_type, is_active) VALUES
('SUPER_ADMIN', '超級管理員', '系統最高權限群組，擁有所有權限', 'system', TRUE),
('SYSTEM_ADMIN', '系統管理員', '系統管理權限群組，可管理系統設定和使用者', 'system', TRUE),
('ORG_ADMIN', '組織管理員', '組織管理權限群組，可管理組織架構和知識庫', 'custom', TRUE),
('DEPT_MANAGER', '部門主管', '部門管理權限群組，可管理部門內員工和資源', 'custom', TRUE),
('NORMAL_USER', '一般使用者', '基本使用者權限群組，可使用問答系統', 'custom', TRUE),
('GUEST_USER', '訪客使用者', '訪客權限群組，僅能查看公開資訊', 'custom', TRUE);

-- =====================================================
-- 設定超級管理員群組權限（擁有所有權限）
-- =====================================================
SET @super_admin_id = (SELECT id FROM permission_groups WHERE code = 'SUPER_ADMIN');

-- 將所有權限矩陣項目指派給超級管理員
INSERT INTO permission_groups_matrix (permission_group_id, permission_matrix_id, created_at)
SELECT @super_admin_id, id, NOW() 
FROM permission_matrix 
WHERE is_active = TRUE
ON DUPLICATE KEY UPDATE created_at = NOW();

-- =====================================================
-- 設定系統管理員群組權限
-- =====================================================
SET @sys_admin_id = (SELECT id FROM permission_groups WHERE code = 'SYSTEM_ADMIN');

-- 系統管理員權限（排除超級管理員專屬權限）
INSERT INTO permission_groups_matrix (permission_group_id, permission_matrix_id, created_at)
SELECT @sys_admin_id, id, NOW() 
FROM permission_matrix 
WHERE is_active = TRUE
  AND permission_key IN (
    -- 管理員基本權限
    'ADMIN.ACCESS', 'ADMIN.DASHBOARD', 'ADMIN.STATS_VIEW', 'ADMIN.LOG_VIEW',
    -- 帳號管理
    'ACCOUNT.USER_VIEW', 'ACCOUNT.USER_CREATE', 'ACCOUNT.USER_UPDATE', 
    'ACCOUNT.USER_ACTIVATE', 'ACCOUNT.USER_RESET_PASSWORD',
    -- 組織管理（查看）
    'ORG.DEPT_VIEW', 'ORG.ROLE_VIEW', 'ORG.EMP_VIEW',
    -- 權限管理（查看）
    'PERM.MATRIX_VIEW', 'PERM.GROUP_VIEW', 'PERM.URL_VIEW', 'PERM.API_VIEW',
    -- 知識庫管理
    'KB.LIST_VIEW', 'KB.CREATE', 'KB.VIEW', 'KB.UPDATE', 'KB.DELETE',
    'KB.FILE_UPLOAD', 'KB.FILE_VIEW', 'KB.FILE_DELETE',
    'KB.INDEX_CREATE', 'KB.INDEX_VIEW', 'KB.INDEX_DELETE',
    -- 系統參數（查看）
    'SYSTEM.PARAM_VIEW',
    -- 使用者功能
    'USER.LOGIN', 'USER.LOGOUT', 'USER.PROFILE_VIEW', 'USER.PROFILE_UPDATE',
    'USER.PASSWORD_CHANGE', 'USER.QUERY', 'USER.CONVERSATION_VIEW'
  )
ON DUPLICATE KEY UPDATE created_at = NOW();

-- =====================================================
-- 設定組織管理員群組權限
-- =====================================================
SET @org_admin_id = (SELECT id FROM permission_groups WHERE code = 'ORG_ADMIN');

INSERT INTO permission_groups_matrix (permission_group_id, permission_matrix_id, created_at)
SELECT @org_admin_id, id, NOW() 
FROM permission_matrix 
WHERE is_active = TRUE
  AND permission_key IN (
    -- 管理員基本權限
    'ADMIN.ACCESS', 'ADMIN.DASHBOARD',
    -- 組織管理（完整權限）
    'ORG.DEPT_VIEW', 'ORG.DEPT_CREATE', 'ORG.DEPT_UPDATE', 'ORG.DEPT_DELETE',
    'ORG.DEPT_MOVE', 'ORG.DEPT_ACTIVATE',
    'ORG.ROLE_VIEW', 'ORG.ROLE_CREATE', 'ORG.ROLE_UPDATE', 'ORG.ROLE_DELETE',
    'ORG.ROLE_ASSIGN', 'ORG.ROLE_TEMPLATE', 'ORG.ROLE_ANALYSIS',
    'ORG.EMP_VIEW', 'ORG.EMP_CREATE', 'ORG.EMP_UPDATE', 'ORG.EMP_DELETE',
    'ORG.EMP_ACTIVATE', 'ORG.EMP_TRANSFER',
    -- 知識庫管理
    'KB.LIST_VIEW', 'KB.CREATE', 'KB.VIEW', 'KB.UPDATE',
    'KB.FILE_UPLOAD', 'KB.FILE_VIEW', 'KB.FILE_DELETE',
    'KB.INDEX_CREATE', 'KB.INDEX_VIEW', 'KB.INDEX_DELETE',
    'KB.PERM_VIEW', 'KB.PERM_UPDATE',
    -- 使用者功能
    'USER.LOGIN', 'USER.LOGOUT', 'USER.PROFILE_VIEW', 'USER.PROFILE_UPDATE',
    'USER.PASSWORD_CHANGE', 'USER.QUERY', 'USER.CONVERSATION_VIEW'
  )
ON DUPLICATE KEY UPDATE created_at = NOW();

-- =====================================================
-- 設定部門主管群組權限
-- =====================================================
SET @dept_manager_id = (SELECT id FROM permission_groups WHERE code = 'DEPT_MANAGER');

INSERT INTO permission_groups_matrix (permission_group_id, permission_matrix_id, created_at)
SELECT @dept_manager_id, id, NOW() 
FROM permission_matrix 
WHERE is_active = TRUE
  AND permission_key IN (
    -- 組織管理（部分權限）
    'ORG.DEPT_VIEW', 'ORG.ROLE_VIEW', 'ORG.EMP_VIEW',
    'ORG.EMP_CREATE', 'ORG.EMP_UPDATE', 'ORG.EMP_ACTIVATE',
    'ORG.ROLE_ASSIGN',
    -- 知識庫使用
    'KB.LIST_VIEW', 'KB.VIEW',
    'KB.FILE_VIEW', 'KB.INDEX_VIEW',
    -- 使用者功能
    'USER.LOGIN', 'USER.LOGOUT', 'USER.PROFILE_VIEW', 'USER.PROFILE_UPDATE',
    'USER.PASSWORD_CHANGE', 'USER.QUERY', 'USER.CONVERSATION_VIEW',
    'USER.CONVERSATION_DELETE'
  )
ON DUPLICATE KEY UPDATE created_at = NOW();

-- =====================================================
-- 設定一般使用者群組權限
-- =====================================================
SET @normal_user_id = (SELECT id FROM permission_groups WHERE code = 'NORMAL_USER');

INSERT INTO permission_groups_matrix (permission_group_id, permission_matrix_id, created_at)
SELECT @normal_user_id, id, NOW() 
FROM permission_matrix 
WHERE is_active = TRUE
  AND permission_key IN (
    -- 基本使用者功能
    'USER.LOGIN', 'USER.LOGOUT', 
    'USER.PROFILE_VIEW', 'USER.PROFILE_UPDATE',
    'USER.PASSWORD_CHANGE', 
    'USER.QUERY',
    'USER.CONVERSATION_VIEW', 'USER.CONVERSATION_DELETE',
    -- 知識庫查看
    'KB.LIST_VIEW', 'KB.VIEW'
  )
ON DUPLICATE KEY UPDATE created_at = NOW();

-- =====================================================
-- 設定訪客使用者群組權限
-- =====================================================
SET @guest_user_id = (SELECT id FROM permission_groups WHERE code = 'GUEST_USER');

INSERT INTO permission_groups_matrix (permission_group_id, permission_matrix_id, created_at)
SELECT @guest_user_id, id, NOW() 
FROM permission_matrix 
WHERE is_active = TRUE
  AND permission_key IN (
    -- 最基本權限
    'USER.LOGIN',
    'USER.PROFILE_VIEW'
  )
ON DUPLICATE KEY UPDATE created_at = NOW();

-- =====================================================
-- 更新群組的 permissions 欄位（JSON 格式）
-- =====================================================

-- 更新超級管理員的 permissions 欄位
UPDATE permission_groups pg
SET pg.permissions = (
    SELECT JSON_ARRAYAGG(pm.permission_key)
    FROM permission_groups_matrix pgm
    JOIN permission_matrix pm ON pgm.permission_matrix_id = pm.id
    WHERE pgm.permission_group_id = pg.id
)
WHERE pg.code = 'SUPER_ADMIN';

-- 更新系統管理員的 permissions 欄位
UPDATE permission_groups pg
SET pg.permissions = (
    SELECT JSON_ARRAYAGG(pm.permission_key)
    FROM permission_groups_matrix pgm
    JOIN permission_matrix pm ON pgm.permission_matrix_id = pm.id
    WHERE pgm.permission_group_id = pg.id
)
WHERE pg.code = 'SYSTEM_ADMIN';

-- 更新組織管理員的 permissions 欄位
UPDATE permission_groups pg
SET pg.permissions = (
    SELECT JSON_ARRAYAGG(pm.permission_key)
    FROM permission_groups_matrix pgm
    JOIN permission_matrix pm ON pgm.permission_matrix_id = pm.id
    WHERE pgm.permission_group_id = pg.id
)
WHERE pg.code = 'ORG_ADMIN';

-- 更新部門主管的 permissions 欄位
UPDATE permission_groups pg
SET pg.permissions = (
    SELECT JSON_ARRAYAGG(pm.permission_key)
    FROM permission_groups_matrix pgm
    JOIN permission_matrix pm ON pgm.permission_matrix_id = pm.id
    WHERE pgm.permission_group_id = pg.id
)
WHERE pg.code = 'DEPT_MANAGER';

-- 更新一般使用者的 permissions 欄位
UPDATE permission_groups pg
SET pg.permissions = (
    SELECT JSON_ARRAYAGG(pm.permission_key)
    FROM permission_groups_matrix pgm
    JOIN permission_matrix pm ON pgm.permission_matrix_id = pm.id
    WHERE pgm.permission_group_id = pg.id
)
WHERE pg.code = 'NORMAL_USER';

-- 更新訪客使用者的 permissions 欄位
UPDATE permission_groups pg
SET pg.permissions = (
    SELECT JSON_ARRAYAGG(pm.permission_key)
    FROM permission_groups_matrix pgm
    JOIN permission_matrix pm ON pgm.permission_matrix_id = pm.id
    WHERE pgm.permission_group_id = pg.id
)
WHERE pg.code = 'GUEST_USER';

-- =====================================================
-- 完成訊息
-- =====================================================
SELECT 
    pg.code,
    pg.name,
    COUNT(pgm.id) as permission_count,
    pg.is_active
FROM permission_groups pg
LEFT JOIN permission_groups_matrix pgm ON pg.id = pgm.permission_group_id
GROUP BY pg.id, pg.code, pg.name, pg.is_active
ORDER BY pg.id;

SELECT '預設權限群組已建立完成' AS message;