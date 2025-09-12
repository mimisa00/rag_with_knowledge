-- =====================================================
-- 權限群組與權限矩陣關聯表
-- =====================================================

USE rag_db;

-- =====================================================
-- permission_groups_matrix（權限群組與權限矩陣關聯表）
-- =====================================================
CREATE TABLE IF NOT EXISTS `permission_groups_matrix` (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    permission_group_id BIGINT NOT NULL COMMENT '權限群組 ID',
    permission_matrix_id BIGINT NOT NULL COMMENT '權限矩陣 ID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INT DEFAULT NULL,
    
    INDEX idx_permission_group (permission_group_id),
    INDEX idx_permission_matrix (permission_matrix_id),
    UNIQUE KEY uk_group_permission (permission_group_id, permission_matrix_id),
    FOREIGN KEY (permission_group_id) REFERENCES permission_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_matrix_id) REFERENCES permission_matrix(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='權限群組與權限矩陣關聯表';

-- =====================================================
-- 資料遷移：將現有 permissions JSON 資料遷移到關聯表
-- =====================================================

-- 為系統管理員群組設定所有權限
INSERT IGNORE INTO permission_groups_matrix (permission_group_id, permission_matrix_id)
SELECT pg.id, pm.id
FROM permission_groups pg
CROSS JOIN permission_matrix pm
WHERE pg.code = 'ORG_ADMIN'
  AND pm.is_active = 1;

-- 為知識庫管理員設定知識庫和文件相關權限
INSERT IGNORE INTO permission_groups_matrix (permission_group_id, permission_matrix_id)
SELECT pg.id, pm.id
FROM permission_groups pg
CROSS JOIN permission_matrix pm
WHERE pg.code = 'KB_MANAGER'
  AND pm.module_code IN ('knowledge_base', 'document')
  AND pm.is_active = 1;

-- 為一般使用者設定基本權限
INSERT IGNORE INTO permission_groups_matrix (permission_group_id, permission_matrix_id)
SELECT pg.id, pm.id
FROM permission_groups pg
CROSS JOIN permission_matrix pm
WHERE pg.code = 'USER'
  AND ((pm.module_code = 'knowledge_base' AND pm.action_code = 'view')
    OR (pm.module_code = 'document' AND pm.action_code IN ('view', 'upload')))
  AND pm.is_active = 1;

-- =====================================================
-- 移除 permissions JSON 欄位（不再使用）
-- =====================================================
ALTER TABLE permission_groups DROP COLUMN IF EXISTS permissions;