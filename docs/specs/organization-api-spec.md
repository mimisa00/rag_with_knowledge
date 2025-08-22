# 組織管理 API 規格書

## 1. 概述
本文件定義組織管理系統的 RESTful API 介面規格，包含部門、角色、使用者管理等端點。

## 2. API 基礎規範

### 2.1 基礎路徑
```
/api/organization/
```

### 2.2 認證方式
- JWT Token（Bearer Authentication）
- Cookie Session（管理介面）

### 2.3 回應格式
```json
{
  "success": true,
  "data": {},
  "message": "操作成功",
  "timestamp": "2025-01-20T10:00:00Z"
}
```

### 2.4 錯誤格式
```json
{
  "success": false,
  "error": {
    "code": "ORG_001",
    "message": "部門不存在",
    "details": {}
  },
  "timestamp": "2025-01-20T10:00:00Z"
}
```

## 3. 部門管理 API

### 3.1 取得部門列表
```
GET /api/organization/departments
```

**查詢參數：**
- `parent_id` (optional): 父部門 ID，空值返回根部門
- `include_children` (optional): 是否包含子部門，預設 false
- `active_only` (optional): 只返回啟用部門，預設 true

**回應範例：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "parent_id": null,
      "code": "HQ",
      "name": "總公司",
      "path": "/總公司",
      "level": 0,
      "sort_order": 0,
      "is_active": true,
      "children_count": 3,
      "employee_count": 150,
      "children": []
    }
  ]
}
```

### 3.2 取得部門樹狀結構
```
GET /api/organization/departments/tree
```

**查詢參數：**
- `max_level` (optional): 最大層級深度

**回應範例：**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "總公司",
    "code": "HQ",
    "children": [
      {
        "id": 2,
        "name": "資訊部",
        "code": "IT",
        "children": []
      }
    ]
  }
}
```

### 3.3 取得單一部門
```
GET /api/organization/departments/{id}
```

**路徑參數：**
- `id`: 部門 ID

**回應範例：**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "parent_id": 1,
    "code": "IT",
    "name": "資訊部",
    "path": "/總公司/資訊部",
    "level": 1,
    "sort_order": 10,
    "is_active": true,
    "metadata": {},
    "parent": {
      "id": 1,
      "name": "總公司"
    },
    "children": [],
    "employee_count": 25,
    "created_at": "2025-01-20T10:00:00Z",
    "updated_at": "2025-01-20T10:00:00Z"
  }
}
```

### 3.4 建立部門
```
POST /api/organization/departments
```

**請求內容：**
```json
{
  "parent_id": 1,
  "code": "DEV",
  "name": "開發組",
  "sort_order": 10,
  "is_active": true
}
```

**回應：**
```json
{
  "success": true,
  "data": {
    "id": 3,
    "code": "DEV",
    "name": "開發組"
  },
  "message": "部門建立成功"
}
```

### 3.5 更新部門
```
PUT /api/organization/departments/{id}
```

**路徑參數：**
- `id`: 部門 ID

**請求內容：**
```json
{
  "name": "研發部",
  "sort_order": 20,
  "is_active": true
}
```

### 3.6 刪除部門
```
DELETE /api/organization/departments/{id}
```

**路徑參數：**
- `id`: 部門 ID

**查詢參數：**
- `force` (optional): 強制刪除（包含子部門），預設 false

**回應：**
```json
{
  "success": true,
  "message": "部門刪除成功"
}
```

### 3.7 移動部門
```
POST /api/organization/departments/{id}/move
```

**路徑參數：**
- `id`: 部門 ID

**請求內容：**
```json
{
  "parent_id": 2,
  "sort_order": 30
}
```

## 4. 角色管理 API

### 4.1 取得角色列表
```
GET /api/organization/roles
```

**查詢參數：**
- `type` (optional): 角色類型（system/custom）
- `active_only` (optional): 只返回啟用角色，預設 true

**回應範例：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "SYSTEM_ADMIN",
      "name": "系統管理員",
      "description": "具有系統所有權限",
      "role_type": "system",
      "is_active": true,
      "user_count": 2
    }
  ]
}
```

### 4.2 取得單一角色
```
GET /api/organization/roles/{id}
```

**路徑參數：**
- `id`: 角色 ID

**回應範例：**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "code": "SYSTEM_ADMIN",
    "name": "系統管理員",
    "description": "具有系統所有權限",
    "role_type": "system",
    "permissions": {
      "all": true
    },
    "is_active": true,
    "user_count": 2,
    "created_at": "2025-01-20T10:00:00Z"
  }
}
```

### 4.3 建立角色
```
POST /api/organization/roles
```

**請求內容：**
```json
{
  "code": "DEPT_MANAGER",
  "name": "部門主管",
  "description": "部門管理權限",
  "permissions": {
    "knowledge_base": ["create", "read", "update"],
    "users": ["read", "update"]
  }
}
```

### 4.4 更新角色
```
PUT /api/organization/roles/{id}
```

**路徑參數：**
- `id`: 角色 ID

**請求內容：**
```json
{
  "name": "部門經理",
  "description": "部門管理權限",
  "permissions": {
    "knowledge_base": ["all"],
    "users": ["read", "update"]
  }
}
```

### 4.5 刪除角色
```
DELETE /api/organization/roles/{id}
```

**路徑參數：**
- `id`: 角色 ID

**回應：**
```json
{
  "success": true,
  "message": "角色刪除成功"
}
```

### 4.6 取得權限矩陣
```
GET /api/organization/roles/permissions
```

**回應範例：**
```json
{
  "success": true,
  "data": {
    "modules": [
      {
        "key": "knowledge_base",
        "name": "知識庫管理",
        "actions": ["create", "read", "update", "delete"]
      },
      {
        "key": "users",
        "name": "使用者管理",
        "actions": ["create", "read", "update", "delete"]
      }
    ],
    "roles": [
      {
        "id": 1,
        "name": "系統管理員",
        "permissions": {
          "knowledge_base": ["all"],
          "users": ["all"]
        }
      }
    ]
  }
}
```

## 5. 使用者管理 API

### 5.1 取得使用者列表
```
GET /api/organization/users
```

**查詢參數：**
- `department_id` (optional): 部門 ID
- `role_id` (optional): 角色 ID
- `auth_source` (optional): 認證來源
- `status` (optional): 狀態（active/pending/disabled）
- `search` (optional): 搜尋關鍵字
- `page` (optional): 頁碼，預設 1
- `limit` (optional): 每頁筆數，預設 20

**回應範例：**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "user001",
        "username": "john.doe",
        "name": "John Doe",
        "email": "john@example.com",
        "department": {
          "id": 2,
          "name": "資訊部"
        },
        "roles": [
          {
            "id": 2,
            "name": "知識庫管理員"
          }
        ],
        "auth_source": "local",
        "status": "active",
        "last_login": "2025-01-20T10:00:00Z"
      }
    ],
    "total": 100,
    "page": 1,
    "pages": 5
  }
}
```

### 5.2 取得單一使用者
```
GET /api/organization/users/{id}
```

**路徑參數：**
- `id`: 使用者 ID

**回應範例：**
```json
{
  "success": true,
  "data": {
    "id": "user001",
    "username": "john.doe",
    "name": "John Doe",
    "email": "john@example.com",
    "employee_no": "E12345",
    "title": "資深工程師",
    "department": {
      "id": 2,
      "name": "資訊部",
      "path": "/總公司/資訊部"
    },
    "manager": {
      "id": "user002",
      "name": "Jane Smith"
    },
    "roles": [
      {
        "id": 2,
        "name": "知識庫管理員",
        "department_id": null
      }
    ],
    "auth_source": "local",
    "status": "active",
    "created_at": "2025-01-01T10:00:00Z",
    "last_login": "2025-01-20T10:00:00Z"
  }
}
```

### 5.3 建立使用者
```
POST /api/organization/users
```

**請求內容：**
```json
{
  "username": "jane.smith",
  "name": "Jane Smith",
  "email": "jane@example.com",
  "department_id": 2,
  "employee_no": "E12346",
  "title": "專案經理",
  "roles": [2, 3],
  "password_strategy": "ACTIVATION_LINK"
}
```

**回應：**
```json
{
  "success": true,
  "data": {
    "id": "user003",
    "username": "jane.smith",
    "activation_sent": true
  },
  "message": "使用者建立成功，啟用郵件已發送"
}
```

### 5.4 更新使用者
```
PUT /api/organization/users/{id}
```

**路徑參數：**
- `id`: 使用者 ID

**請求內容：**
```json
{
  "name": "Jane Smith-Johnson",
  "department_id": 3,
  "title": "資深專案經理",
  "roles": [2, 3, 4]
}
```

### 5.5 停用/啟用使用者
```
POST /api/organization/users/{id}/toggle-status
```

**路徑參數：**
- `id`: 使用者 ID

**請求內容：**
```json
{
  "status": "disabled",
  "reason": "離職"
}
```

### 5.6 重設密碼
```
POST /api/organization/users/{id}/reset-password
```

**路徑參數：**
- `id`: 使用者 ID

**請求內容：**
```json
{
  "strategy": "ACTIVATION_LINK"
}
```

### 5.7 指派角色
```
POST /api/organization/users/{id}/assign-roles
```

**路徑參數：**
- `id`: 使用者 ID

**請求內容：**
```json
{
  "roles": [
    {
      "role_id": 2,
      "department_id": null
    },
    {
      "role_id": 3,
      "department_id": 2
    }
  ]
}
```

### 5.8 批次操作
```
POST /api/organization/users/batch
```

**請求內容：**
```json
{
  "action": "assign_department",
  "user_ids": ["user001", "user002", "user003"],
  "data": {
    "department_id": 3
  }
}
```

## 6. 系統模式 API

### 6.1 取得系統模式
```
GET /api/organization/system-modes
```

**回應範例：**
```json
{
  "success": true,
  "data": {
    "SYSTEM_MODE": "ORGANIZATION",
    "AUTH_MODE": "HYBRID",
    "ALLOW_REGISTRATION": false,
    "PASSWORD_STRATEGY": "ACTIVATION_LINK",
    "SYNC_ENABLED": true
  }
}
```

### 6.2 更新系統模式
```
PUT /api/organization/system-modes
```

**請求內容：**
```json
{
  "SYSTEM_MODE": "ORGANIZATION",
  "AUTH_MODE": "SSO",
  "ALLOW_REGISTRATION": false
}
```

## 7. 密碼策略 API

### 7.1 取得密碼策略
```
GET /api/organization/password-policies
```

**回應範例：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "policy_name": "預設策略",
      "policy_type": "default",
      "min_length": 8,
      "require_uppercase": true,
      "require_lowercase": true,
      "require_numbers": true,
      "require_special": false,
      "expire_days": 90,
      "is_active": true
    }
  ]
}
```

### 7.2 建立密碼策略
```
POST /api/organization/password-policies
```

**請求內容：**
```json
{
  "policy_name": "嚴格策略",
  "policy_type": "strict",
  "apply_to": "department",
  "target_id": "2",
  "min_length": 12,
  "require_uppercase": true,
  "require_lowercase": true,
  "require_numbers": true,
  "require_special": true,
  "expire_days": 60
}
```

## 8. 資料匯入 API

### 8.1 上傳匯入檔案
```
POST /api/organization/import/upload
```

**請求格式：** multipart/form-data
- `file`: CSV 或 Excel 檔案
- `type`: 匯入類型（departments/users）

**回應範例：**
```json
{
  "success": true,
  "data": {
    "session_id": "import_20250120_001",
    "filename": "users.csv",
    "rows": 100,
    "columns": ["username", "name", "email", "department"],
    "preview": [
      {
        "username": "john.doe",
        "name": "John Doe",
        "email": "john@example.com",
        "department": "IT"
      }
    ]
  }
}
```

### 8.2 欄位映射
```
POST /api/organization/import/mapping
```

**請求內容：**
```json
{
  "session_id": "import_20250120_001",
  "mapping": {
    "username": "user_id",
    "name": "display_name",
    "email": "email",
    "department": "dept_code"
  }
}
```

### 8.3 執行匯入
```
POST /api/organization/import/execute
```

**請求內容：**
```json
{
  "session_id": "import_20250120_001",
  "options": {
    "update_existing": true,
    "create_departments": true,
    "password_strategy": "ACTIVATION_LINK",
    "send_notifications": true
  }
}
```

**回應範例：**
```json
{
  "success": true,
  "data": {
    "total": 100,
    "created": 85,
    "updated": 10,
    "skipped": 5,
    "errors": [
      {
        "row": 45,
        "error": "Email 格式錯誤"
      }
    ]
  }
}
```

## 9. 統計 API

### 9.1 組織統計
```
GET /api/organization/statistics
```

**回應範例：**
```json
{
  "success": true,
  "data": {
    "departments": {
      "total": 15,
      "active": 14
    },
    "users": {
      "total": 523,
      "active": 500,
      "pending": 20,
      "disabled": 3
    },
    "roles": {
      "total": 8,
      "system": 3,
      "custom": 5
    },
    "auth_sources": {
      "local": 300,
      "ldap": 150,
      "sso": 73
    }
  }
}
```

### 9.2 部門統計
```
GET /api/organization/departments/{id}/statistics
```

**路徑參數：**
- `id`: 部門 ID

**回應範例：**
```json
{
  "success": true,
  "data": {
    "employee_count": 25,
    "sub_departments": 3,
    "roles_distribution": {
      "SYSTEM_ADMIN": 1,
      "KB_MANAGER": 3,
      "USER": 21
    }
  }
}
```

## 10. 錯誤代碼

### 10.1 部門相關錯誤
- `ORG_001`: 部門不存在
- `ORG_002`: 部門代碼重複
- `ORG_003`: 無法刪除（有子部門）
- `ORG_004`: 無法刪除（有使用者）
- `ORG_005`: 循環參照錯誤

### 10.2 角色相關錯誤
- `ROLE_001`: 角色不存在
- `ROLE_002`: 角色代碼重複
- `ROLE_003`: 無法刪除系統角色
- `ROLE_004`: 無法刪除（有使用者使用）

### 10.3 使用者相關錯誤
- `USER_001`: 使用者不存在
- `USER_002`: 使用者名稱重複
- `USER_003`: Email 重複
- `USER_004`: 部門不存在
- `USER_005`: 角色不存在

### 10.4 匯入相關錯誤
- `IMP_001`: 檔案格式錯誤
- `IMP_002`: 必要欄位缺失
- `IMP_003`: 資料驗證失敗
- `IMP_004`: 匯入工作階段過期

## 11. 權限需求

### 11.1 系統管理員權限
- 所有 API 完整存取權限

### 11.2 部門主管權限
- 檢視組織結構
- 管理所屬部門使用者
- 指派部門內角色

### 11.3 一般使用者權限
- 檢視組織結構
- 檢視個人資訊
- 更新個人資料（部分）

## 12. 實作檢查清單

- [ ] 實作部門 CRUD API
- [ ] 實作部門樹狀結構 API
- [ ] 實作角色 CRUD API
- [ ] 實作權限矩陣 API
- [ ] 實作使用者 CRUD API
- [ ] 實作批次操作 API
- [ ] 實作系統模式 API
- [ ] 實作密碼策略 API
- [ ] 實作資料匯入 API
- [ ] 實作統計 API
- [ ] 權限檢查中介軟體
- [ ] API 文件自動產生
- [ ] 單元測試
- [ ] 整合測試

---
*文件版本：1.0*
*最後更新：2025-01-20*