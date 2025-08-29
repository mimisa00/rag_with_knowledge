# 組織資料模型規格書

## 1. 概述
本文件定義組織管理系統的資料模型，包含部門、角色、使用者等核心實體的資料結構設計。

## 2. 資料表設計

### 2.1 departments（部門表）

```sql
CREATE TABLE departments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    parent_id BIGINT DEFAULT NULL,                -- 父部門 ID，NULL 表示根部門
    external_id VARCHAR(100) DEFAULT NULL,        -- 外部系統部門 ID
    code VARCHAR(50) NOT NULL,                    -- 部門代碼
    name VARCHAR(100) NOT NULL,                   -- 部門名稱
    path VARCHAR(500) DEFAULT NULL,               -- 部門路徑，如 /總公司/資訊部/開發組
    level INT DEFAULT 0,                          -- 層級深度，根部門為 0
    sort_order INT DEFAULT 0,                     -- 同層排序
    is_active BOOLEAN DEFAULT TRUE,               -- 是否啟用
    sync_source VARCHAR(50) DEFAULT NULL,         -- 同步來源（hr_system/manual）
    metadata JSON DEFAULT NULL,                   -- 額外資料
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(100) DEFAULT NULL,
    updated_by VARCHAR(100) DEFAULT NULL,
    
    INDEX idx_parent (parent_id),
    INDEX idx_code (code),
    INDEX idx_path (path),
    INDEX idx_external (external_id),
    UNIQUE KEY uk_code (code),
    FOREIGN KEY (parent_id) REFERENCES departments(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2.2 permission_groups

```sql
CREATE TABLE permission_groups (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL,                    -- 權限群組代碼
    name VARCHAR(100) NOT NULL,                   -- 權限群組名稱
    description TEXT,                             -- 角色權限群組描述描述
    permission_type VARCHAR(20) DEFAULT 'custom', -- 權限群組類型：system/custom
    permissions JSON DEFAULT NULL,                -- 權限設定 JSON
    is_active BOOLEAN DEFAULT TRUE,               -- 是否啟用
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(100) DEFAULT NULL,
    updated_by VARCHAR(100) DEFAULT NULL,
    
    INDEX idx_code (code),
    INDEX idx_type (permission_type),
    UNIQUE KEY uk_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2.3 user_extensions（使用者擴充表）

```sql
-- 擴充既有的 users 表，不破壞現有結構
CREATE TABLE user_extensions (
    user_id VARCHAR(100) PRIMARY KEY,             -- 關聯到 users.id
    department_id BIGINT DEFAULT NULL,            -- 所屬部門
    external_id VARCHAR(100) DEFAULT NULL,        -- 外部系統使用者 ID
    employee_no VARCHAR(50) DEFAULT NULL,         -- 員工編號
    title VARCHAR(100) DEFAULT NULL,              -- 職稱
    manager_id VARCHAR(100) DEFAULT NULL,         -- 直屬主管
    auth_source VARCHAR(20) DEFAULT 'local',      -- 認證來源：local/ldap/sso/synced
    password_strategy VARCHAR(20) DEFAULT NULL,   -- 密碼策略
    activation_token VARCHAR(255) DEFAULT NULL,   -- 啟用 token
    activation_expires TIMESTAMP DEFAULT NULL,    -- 啟用期限
    last_sync_at TIMESTAMP DEFAULT NULL,          -- 最後同步時間
    metadata JSON DEFAULT NULL,                   -- 額外資料
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_department (department_id),
    INDEX idx_external (external_id),
    INDEX idx_employee_no (employee_no),
    INDEX idx_manager (manager_id),
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2.4 user_permission_groups（使用者權限群組關聯表）

```sql
CREATE TABLE user_permission_groups (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,                -- 使用者 ID
    role_id BIGINT NOT NULL,                      -- 權限群組 ID
    department_id BIGINT DEFAULT NULL,            -- 權限群組作用部門（NULL 表示全域）
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by VARCHAR(100) DEFAULT NULL,
    expires_at TIMESTAMP DEFAULT NULL,            -- 角色過期時間
    
    INDEX idx_user (user_id),
    INDEX idx_role (role_id),
    INDEX idx_department (department_id),
    UNIQUE KEY uk_user_role_dept (user_id, role_id, department_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2.5 system_modes（系統模式設定表）

```sql
CREATE TABLE system_modes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mode_key VARCHAR(50) NOT NULL,                -- 設定鍵
    mode_value VARCHAR(255) NOT NULL,             -- 設定值
    category VARCHAR(50) DEFAULT 'general',       -- 分類
    description TEXT,                             -- 說明
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(100) DEFAULT NULL,
    
    UNIQUE KEY uk_key (mode_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2.6 password_policies（密碼策略表）

```sql
CREATE TABLE password_policies (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    policy_name VARCHAR(50) NOT NULL,             -- 策略名稱
    policy_type VARCHAR(20) NOT NULL,             -- 策略類型
    apply_to VARCHAR(20) DEFAULT 'all',           -- 適用對象：all/department/role
    target_id VARCHAR(100) DEFAULT NULL,          -- 目標 ID（部門或角色）
    min_length INT DEFAULT 8,                     -- 最小長度
    require_uppercase BOOLEAN DEFAULT TRUE,       -- 需要大寫
    require_lowercase BOOLEAN DEFAULT TRUE,       -- 需要小寫
    require_numbers BOOLEAN DEFAULT TRUE,         -- 需要數字
    require_special BOOLEAN DEFAULT FALSE,        -- 需要特殊字元
    expire_days INT DEFAULT 90,                   -- 過期天數
    force_change_first BOOLEAN DEFAULT TRUE,      -- 首次登入強制變更
    config JSON DEFAULT NULL,                     -- 其他設定
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_type (policy_type),
    INDEX idx_target (target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## 3. 預設資料

### 3.1 預設角色

```sql
-- 系統預設角色
INSERT INTO permission_groups (code, name, description, permission_type, permissions) VALUES
('SYSTEM_ADMIN', '系統管理員', '具有系統所有權限', 'system', 
 '{"all": true}'),
('KB_MANAGER', '知識庫管理員', '管理知識庫和文件', 'system',
 '{"knowledge_base": ["create", "read", "update", "delete"], "documents": ["all"]}'),
('USER', '一般使用者', '基本使用權限', 'system',
 '{"knowledge_base": ["read"], "documents": ["read", "upload"]}');
```

### 3.2 預設系統模式

```sql
-- 系統模式預設值
INSERT INTO system_modes (mode_key, mode_value, category, description) VALUES
('SYSTEM_MODE', 'BASIC', 'core', '系統運作模式：BASIC/ORGANIZATION'),
('AUTH_MODE', 'LOCAL', 'auth', '認證模式：LOCAL/SSO/HYBRID'),
('ALLOW_REGISTRATION', 'true', 'auth', '是否允許自助註冊'),
('PASSWORD_STRATEGY', 'ACTIVATION_LINK', 'auth', '密碼策略：ACTIVATION_LINK/TEMP_PASSWORD/LDAP'),
('SYNC_ENABLED', 'false', 'sync', '是否啟用自動同步');
```

### 3.3 預設部門（基本模式）

```sql
-- 基本模式的預設部門
INSERT INTO departments (code, name, path, level, sort_order, sync_source) VALUES
('DEFAULT', '預設部門', '/預設部門', 0, 0, 'manual');
```

## 4. 資料關聯說明

### 4.1 部門樹狀結構
- 使用 `parent_id` 建立父子關係
- `path` 欄位儲存完整路徑，便於查詢
- `level` 記錄層級深度，便於排序和顯示

### 4.2 使用者-角色-部門關係
- 使用者可以擁有多個角色
- 角色可以限定在特定部門
- 透過 `user_roles` 表管理多對多關係

### 4.3 認證來源管理
- `user_extensions.auth_source` 決定認證方式
- 支援本地、LDAP、SSO、同步等多種來源
- 不同來源可以有不同的密碼策略

## 5. 索引策略

### 5.1 查詢優化索引
- 部門：`parent_id`、`code`、`path` 索引支援樹狀查詢
- 使用者：`department_id`、`external_id` 索引支援快速查找
- 角色：`user_id`、`role_id` 複合索引優化權限查詢

### 5.2 唯一性約束
- 部門代碼全域唯一
- 角色代碼全域唯一
- 使用者-角色-部門組合唯一

## 6. 資料遷移策略

### 6.1 既有使用者處理
```sql
-- 為既有使用者建立擴充資料
INSERT INTO user_extensions (user_id, department_id, auth_source)
SELECT id, 
       (SELECT id FROM departments WHERE code = 'DEFAULT'),
       'local'
FROM users
WHERE NOT EXISTS (
    SELECT 1 FROM user_extensions WHERE user_id = users.id
);

-- 為既有使用者分配預設角色
INSERT INTO user_permission_groups (user_id, permission_group_id, assigned_by)
SELECT u.id, r.id, NULL
FROM users u
CROSS JOIN permission_groups r
WHERE u.role = 'admin'
  AND r.code = 'SYSTEM_ADMIN'
  AND NOT EXISTS (
    SELECT 1 FROM user_permission_groups upg 
    WHERE upg.user_id = u.id AND upg.permission_group_id = r.id
);

INSERT INTO user_permission_groups (user_id, permission_group_id, assigned_by)
SELECT u.id, r.id, NULL
FROM users u
CROSS JOIN permission_groups r
WHERE u.role = 'user'
  AND r.code = 'USER'
  AND NOT EXISTS (
    SELECT 1 FROM user_permission_groups upg 
    WHERE upg.user_id = u.id AND upg.permission_group_id = r.id
);
```

### 6.2 向後相容保證
- 不修改既有 `users` 表結構
- 使用擴充表方式新增欄位
- 預設值確保既有功能正常運作

## 7. 安全考量

### 7.1 權限控制
- 部門刪除需檢查是否有子部門或使用者
- 角色刪除需檢查是否有使用者使用
- 使用 ON DELETE RESTRICT 防止誤刪

### 7.2 資料隱私
- 密碼相關欄位不儲存明文
- activation_token 需加密儲存
- 敏感資料使用 JSON 欄位便於加密

## 8. 效能考量

### 8.1 查詢優化
- 部門路徑使用冗餘欄位避免遞迴查詢
- 適當的索引減少全表掃描
- JSON 欄位用於非查詢的擴充資料

### 8.2 擴展性設計
- 使用 BIGINT 作為主鍵支援大量資料
- JSON 欄位提供彈性擴充
- 分表設計避免單表過大

## 9. 實作檢查清單

- [ ] 建立 migration SQL 檔案
- [ ] 執行資料庫遷移
- [ ] 插入預設資料
- [ ] 建立 Python models
- [ ] 實作 CRUD API
- [ ] 單元測試
- [ ] 整合測試

---
*文件版本：1.0*
*最後更新：2025-01-20*