-- Migration: Drop permissions column from department_roles table
-- Date: 2025-09-06
-- Reason: Permissions are now handled through permission_groups_department_role junction table

-- Check if the permissions column exists before attempting to drop it
SET @sql = (
    SELECT IF(
        COUNT(*) > 0,
        'ALTER TABLE department_roles DROP COLUMN permissions;',
        'SELECT "permissions column does not exist" as result;'
    )
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'department_roles'
    AND COLUMN_NAME = 'permissions'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verify the column has been dropped
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT 
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'department_roles'
ORDER BY ORDINAL_POSITION;