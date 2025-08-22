# 系統模式規格書

## 1. 概述
本文件定義組織管理系統的運作模式切換機制，支援從個人使用到企業級部署的彈性配置。

## 2. 系統模式定義

### 2.1 基本模式 (BASIC)
適用於個人或小團隊使用，無需複雜的組織架構。

**特性：**
- 無需建立組織部門
- 使用者可自助註冊
- 所有使用者歸屬於預設部門
- 簡化的權限管理
- 隱藏組織管理選單

**設定值：**
```json
{
  "SYSTEM_MODE": "BASIC",
  "ALLOW_REGISTRATION": true,
  "DEFAULT_DEPARTMENT": "DEFAULT",
  "SHOW_ORG_MENU": false,
  "DEFAULT_USER_ROLE": "USER"
}
```

### 2.2 組織模式 (ORGANIZATION)
適用於企業級部署，需要完整的組織架構管理。

**特性：**
- 完整的部門樹狀結構
- 角色權限管理
- 管理員建立帳號
- 支援多種認證方式
- 完整的組織管理功能

**設定值：**
```json
{
  "SYSTEM_MODE": "ORGANIZATION",
  "ALLOW_REGISTRATION": false,
  "REQUIRE_DEPARTMENT": true,
  "SHOW_ORG_MENU": true,
  "ENABLE_ROLE_MANAGEMENT": true
}
```

## 3. 認證模式

### 3.1 本地認證 (LOCAL)
使用系統內建的帳號密碼認證。

**特性：**
- 密碼儲存在本地資料庫
- 支援密碼重設流程
- 可自訂密碼策略

**設定值：**
```json
{
  "AUTH_MODE": "LOCAL",
  "PASSWORD_MIN_LENGTH": 8,
  "PASSWORD_EXPIRE_DAYS": 90,
  "ENABLE_PASSWORD_RESET": true
}
```

### 3.2 SSO 認證 (SSO)
使用單一登入服務。

**特性：**
- 不儲存密碼
- 自動建立/更新使用者
- 無登出選項（返回 SSO 入口）
- 隱藏密碼相關功能

**設定值：**
```json
{
  "AUTH_MODE": "SSO",
  "SSO_PROVIDER": "OAUTH",
  "AUTO_CREATE_USER": true,
  "HIDE_PASSWORD_FEATURES": true,
  "SSO_CONFIG": {
    "provider": "oauth",
    "client_id": "...",
    "authorization_url": "..."
  }
}
```

### 3.3 混合認證 (HYBRID)
同時支援多種認證方式。

**特性：**
- 可選擇認證方式
- 不同使用者可用不同方式
- 彈性的切換機制

**設定值：**
```json
{
  "AUTH_MODE": "HYBRID",
  "ENABLED_AUTH_METHODS": ["LOCAL", "LDAP", "SSO"],
  "DEFAULT_AUTH_METHOD": "LOCAL",
  "AUTH_METHOD_SELECTOR": true
}
```

## 4. 模式切換邏輯

### 4.1 切換流程
```python
def switch_system_mode(new_mode, options=None):
    """切換系統模式"""
    
    # 1. 驗證權限
    if not current_user.is_system_admin:
        raise PermissionError("只有系統管理員可以切換模式")
    
    # 2. 檢查前置條件
    if new_mode == "BASIC":
        # 檢查是否可以簡化
        check_can_simplify()
    elif new_mode == "ORGANIZATION":
        # 檢查必要設定
        check_org_requirements()
    
    # 3. 執行切換
    try:
        # 更新系統設定
        update_system_settings(new_mode, options)
        
        # 調整資料結構
        migrate_data_for_mode(new_mode)
        
        # 更新 UI 顯示
        update_ui_visibility(new_mode)
        
        # 記錄審計
        audit_log_mode_change(new_mode)
        
        return {"success": True, "message": "模式切換成功"}
        
    except Exception as e:
        rollback_changes()
        return {"success": False, "error": str(e)}
```

### 4.2 資料遷移策略

#### 從基本模式到組織模式
```sql
-- 建立預設部門結構
INSERT INTO departments (code, name, path, level)
SELECT 'DEFAULT', '預設部門', '/預設部門', 0
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE code = 'DEFAULT');

-- 將既有使用者關聯到預設部門
UPDATE user_extensions
SET department_id = (SELECT id FROM departments WHERE code = 'DEFAULT')
WHERE department_id IS NULL;

-- 分配預設角色
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE r.code = 'USER'
AND NOT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = u.id
);
```

#### 從組織模式到基本模式
```sql
-- 保留部門資料但隱藏功能
UPDATE system_modes
SET mode_value = 'false'
WHERE mode_key = 'SHOW_ORG_MENU';

-- 啟用自助註冊
UPDATE system_modes
SET mode_value = 'true'
WHERE mode_key = 'ALLOW_REGISTRATION';
```

## 5. UI 顯示控制

### 5.1 選單顯示邏輯
```javascript
// 根據系統模式控制選單顯示
function updateMenuVisibility() {
    const systemMode = getSystemMode();
    const authMode = getAuthMode();
    
    // 組織管理選單
    if (systemMode === 'ORGANIZATION') {
        showMenuItem('organization-menu');
    } else {
        hideMenuItem('organization-menu');
    }
    
    // 註冊連結
    if (systemMode === 'BASIC' || 
        (systemMode === 'ORGANIZATION' && allowRegistration())) {
        showMenuItem('register-link');
    } else {
        hideMenuItem('register-link');
    }
    
    // 密碼變更
    if (authMode === 'LOCAL' || authMode === 'HYBRID') {
        showMenuItem('change-password');
    } else {
        hideMenuItem('change-password');
    }
    
    // 登出選項
    if (authMode !== 'SSO') {
        showMenuItem('logout');
    } else {
        showMenuItem('return-to-sso');
    }
}
```

### 5.2 功能可用性檢查
```javascript
// 功能權限檢查
const SystemModeChecker = {
    canRegister() {
        return systemMode === 'BASIC' || 
               (systemMode === 'ORGANIZATION' && settings.ALLOW_REGISTRATION);
    },
    
    canManageOrganization() {
        return systemMode === 'ORGANIZATION' && 
               currentUser.hasRole('SYSTEM_ADMIN');
    },
    
    canChangePassword() {
        return authMode === 'LOCAL' || 
               (authMode === 'HYBRID' && userAuthSource === 'local');
    },
    
    requiresDepartment() {
        return systemMode === 'ORGANIZATION';
    },
    
    canBatchImport() {
        return systemMode === 'ORGANIZATION' && 
               currentUser.hasPermission('users.import');
    }
};
```

## 6. 設定介面

### 6.1 系統模式設定頁面
```html
<div class="system-mode-settings">
    <h2>系統運作模式</h2>
    
    <div class="mode-selector">
        <div class="mode-option">
            <input type="radio" name="system_mode" value="BASIC" id="mode_basic">
            <label for="mode_basic">
                <h3>基本模式</h3>
                <p>適合個人或小團隊使用</p>
                <ul>
                    <li>簡單快速上手</li>
                    <li>自助註冊</li>
                    <li>無需組織架構</li>
                </ul>
            </label>
        </div>
        
        <div class="mode-option">
            <input type="radio" name="system_mode" value="ORGANIZATION" id="mode_org">
            <label for="mode_org">
                <h3>組織模式</h3>
                <p>適合企業級部署</p>
                <ul>
                    <li>完整組織架構</li>
                    <li>角色權限管理</li>
                    <li>支援 SSO/LDAP</li>
                </ul>
            </label>
        </div>
    </div>
    
    <!-- 組織模式選項 -->
    <div id="org_options" style="display:none;">
        <h3>組織模式設定</h3>
        
        <div class="form-group">
            <label>
                <input type="checkbox" name="allow_registration">
                允許使用者自助註冊
            </label>
        </div>
        
        <div class="form-group">
            <label>認證方式</label>
            <select name="auth_mode">
                <option value="LOCAL">本地認證</option>
                <option value="SSO">SSO 單一登入</option>
                <option value="HYBRID">混合模式</option>
            </select>
        </div>
        
        <div class="form-group">
            <label>
                <input type="checkbox" name="require_approval">
                新使用者需要審核
            </label>
        </div>
    </div>
    
    <div class="mode-warning" id="mode_warning" style="display:none;">
        <i class="fa-solid fa-exclamation-triangle"></i>
        <p>切換模式將影響系統功能，請確認：</p>
        <ul id="warning_list"></ul>
    </div>
    
    <button class="btn btn-primary" onclick="saveSystemMode()">儲存設定</button>
</div>
```

## 7. 模式切換影響

### 7.1 功能影響對照表

| 功能 | 基本模式 | 組織模式 |
|------|---------|----------|
| 自助註冊 | ✓ | 可選 |
| 組織管理 | ✗ | ✓ |
| 部門結構 | ✗ | ✓ |
| 角色管理 | 簡化 | 完整 |
| 批次匯入 | ✗ | ✓ |
| SSO 整合 | ✗ | ✓ |
| 資料同步 | ✗ | ✓ |
| 審計日誌 | 基本 | 完整 |

### 7.2 資料影響
- **保留資料**：切換模式不會刪除既有資料
- **功能隱藏**：某些功能會被隱藏但資料保留
- **預設值**：自動設定合理的預設值

## 8. API 端點

### 8.1 取得當前模式
```
GET /api/organization/system-modes/current
```

**回應：**
```json
{
  "success": true,
  "data": {
    "system_mode": "ORGANIZATION",
    "auth_mode": "HYBRID",
    "features": {
      "registration": false,
      "organization": true,
      "sso": true,
      "ldap": true
    }
  }
}
```

### 8.2 切換系統模式
```
POST /api/organization/system-modes/switch
```

**請求：**
```json
{
  "new_mode": "ORGANIZATION",
  "options": {
    "migrate_data": true,
    "keep_settings": true
  }
}
```

### 8.3 檢查切換可行性
```
POST /api/organization/system-modes/check-switch
```

**請求：**
```json
{
  "target_mode": "BASIC"
}
```

**回應：**
```json
{
  "success": true,
  "data": {
    "can_switch": true,
    "warnings": [
      "組織管理功能將被隱藏",
      "SSO 設定將被停用"
    ],
    "required_actions": []
  }
}
```

## 9. 設定檔結構

### 9.1 系統設定檔
```python
# config/system_modes.py

SYSTEM_MODES = {
    "BASIC": {
        "name": "基本模式",
        "features": {
            "registration": True,
            "organization": False,
            "departments": False,
            "roles": "simplified",
            "batch_import": False,
            "sso": False,
            "sync": False
        },
        "defaults": {
            "department": "DEFAULT",
            "role": "USER",
            "password_strategy": "LOCAL"
        }
    },
    "ORGANIZATION": {
        "name": "組織模式",
        "features": {
            "registration": False,
            "organization": True,
            "departments": True,
            "roles": "full",
            "batch_import": True,
            "sso": True,
            "sync": True
        },
        "defaults": {
            "require_department": True,
            "password_strategy": "ACTIVATION_LINK"
        }
    }
}
```

## 10. 實作檢查清單

- [ ] 建立系統模式資料表
- [ ] 實作模式切換 API
- [ ] 實作資料遷移邏輯
- [ ] 建立設定介面
- [ ] 實作 UI 顯示控制
- [ ] 實作功能權限檢查
- [ ] 測試模式切換
- [ ] 測試資料遷移
- [ ] 編寫切換指南
- [ ] 整合測試

---
*文件版本：1.0*
*最後更新：2025-01-20*