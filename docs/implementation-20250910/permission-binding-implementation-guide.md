# 權限綁定實作指南

## 概述
本指南說明如何使用三個專門的 Agent 來實作權限系統的前後端綁定。系統採用 Git 分支策略，確保每個權限綁定都在獨立環境中進行，驗證失敗可以輕鬆回滾。

## 系統架構

### Agent 協作流程
```mermaid
graph LR
    A[bind-permissions<br/>實作綁定] --> B[verify-permission-binding<br/>驗證綁定]
    B -->|通過| C[合併到主分支]
    B -->|失敗| D[fix-permission-issues<br/>修復問題]
    D -->|修復成功| B
    D -->|無法修復| E[放棄分支]
```

### Agent 模型配置
| Agent | 模型 | 用途 | 執行頻率 |
|-------|------|------|----------|
| bind-permissions | sonnet | 標準化的綁定實作 | 高（每個權限） |
| verify-permission-binding | sonnet | 規則化的驗證檢查 | 高（每次綁定） |
| fix-permission-issues | opus | 複雜問題解決 | 低（失敗時） |

## 環境準備

### 1. 測試環境設定
```bash
# 環境變數配置
export TEST_MODE=true
export PERMISSION_CHECK_ENABLED=true
export TEST_USER=testadmin
export TEST_PASSWORD=testadmin
export DATABASE_USER=rag_user
export DATABASE_PASSWORD=rag_password_2024
export DATABASE_NAME=rag_db

# 確認 Docker 服務運行
docker compose ps

# 確認資料庫連線
docker exec mariadb mysql -u $DATABASE_USER -p$DATABASE_PASSWORD $DATABASE_NAME -e "SELECT 1"
```

### 2. Git 環境準備
```bash
# 確認在正確的分支
git status

# 建立權限綁定基礎分支
git checkout -b feature/permission-binding-base

# 確認分支乾淨
git status --porcelain
```

### 3. 驗證權限資料已載入
```bash
docker exec mariadb mysql -u rag_user -prag_password_2024 rag_db -e "
SELECT COUNT(*) as count, 'permission_matrix' as table_name FROM permission_matrix
UNION ALL
SELECT COUNT(*), 'permission_apis' FROM permission_apis
UNION ALL
SELECT COUNT(*), 'permission_actions' FROM permission_actions
UNION ALL
SELECT COUNT(*), 'permission_urls' FROM permission_urls;"
```

## 執行流程

### 步驟 1：選擇要綁定的權限
```sql
-- 查看所有需要綁定的權限
SELECT 
    pm.permission_key,
    pm.module_code,
    pm.action_code,
    COUNT(DISTINCT pa.id) as api_bindings,
    COUNT(DISTINCT pac.id) as action_bindings,
    COUNT(DISTINCT pu.id) as url_bindings
FROM permission_matrix pm
LEFT JOIN permission_apis pa ON pa.permission_code = pm.permission_key
LEFT JOIN permission_actions pac ON pac.permission_code = pm.permission_key
LEFT JOIN permission_urls pu ON pu.permission_code = pm.permission_key
GROUP BY pm.id
ORDER BY pm.module_code, pm.sort_order;
```

### 步驟 2：執行單一權限綁定
```bash
# 使用 bind-permissions agent
# 輸入：
{
  "permission_code": "USER.LOGIN",
  "mode": "single",
  "dry_run": false
}

# Agent 會：
1. 建立分支 bind/USER_LOGIN
2. 從資料庫讀取綁定資訊
3. 修改對應的檔案
4. 提交變更
5. 返回分支名稱
```

### 步驟 3：驗證綁定
```bash
# 使用 verify-permission-binding agent
# 輸入：
{
  "branch_name": "bind/USER_LOGIN",
  "permission_code": "USER.LOGIN",
  "test_level": "full"
}

# Agent 會：
1. 切換到指定分支
2. 執行語法檢查
3. 執行功能測試
4. 返回驗證結果
```

### 步驟 4：處理驗證結果

#### 4.1 驗證通過
```bash
# 合併到基礎分支
git checkout feature/permission-binding-base
git merge bind/USER_LOGIN
git branch -d bind/USER_LOGIN
```

#### 4.2 驗證失敗
```bash
# 使用 fix-permission-issues agent
# 輸入：
{
  "branch_name": "bind/USER_LOGIN",
  "failure_report": {...},
  "fix_strategy": "auto",
  "max_retries": 3
}

# Agent 會：
1. 分析失敗原因
2. 執行修復策略
3. 重新提交變更
4. 返回修復結果
```

## 權限綁定範例

### 後端 API 綁定範例

#### FastAPI 路由
```python
# 原始程式碼 (/app/api/routes/user.py)
@router.post("/login")
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, request.username, request.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"token": create_token(user)}

# 綁定後
from app.core.permissions import require_permission

@router.post("/login")
@require_permission("USER.LOGIN")  # 新增的權限檢查
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, request.username, request.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"token": create_token(user)}
```

#### 權限檢查裝飾器實作
```python
# /app/core/permissions.py
from functools import wraps
from fastapi import HTTPException, Request

def require_permission(permission_code: str):
    """權限檢查裝飾器"""
    def decorator(func):
        @wraps(func)
        async def wrapper(request: Request, *args, **kwargs):
            # 從 session 或 token 取得使用者權限
            user_permissions = get_user_permissions(request)
            
            if permission_code not in user_permissions:
                raise HTTPException(
                    status_code=403,
                    detail=f"Permission denied: {permission_code} required"
                )
            
            return await func(request, *args, **kwargs)
        return wrapper
    return decorator
```

### 前端權限綁定範例

#### HTML 按鈕
```html
<!-- 原始程式碼 -->
<button id="addDeptBtn" class="btn btn-primary" onclick="openAddDeptDialog()">
    <i class="fas fa-plus"></i> 新增部門
</button>

<!-- 綁定後 -->
<button id="addDeptBtn" 
        class="btn btn-primary" 
        onclick="openAddDeptDialog()"
        data-permission="ORG.DEPT_CREATE"
        style="display: none;">
    <i class="fas fa-plus"></i> 新增部門
</button>
```

#### JavaScript 權限檢查
```javascript
// /frontend/static/js/permissions.js
class PermissionManager {
    constructor() {
        this.permissions = [];
        this.loadUserPermissions();
    }
    
    async loadUserPermissions() {
        try {
            const response = await fetch('/api/user/permissions');
            const data = await response.json();
            this.permissions = data.permissions;
            this.updateUI();
        } catch (error) {
            console.error('Failed to load permissions:', error);
        }
    }
    
    hasPermission(permissionCode) {
        return this.permissions.includes(permissionCode);
    }
    
    updateUI() {
        // 顯示/隱藏有權限的元素
        document.querySelectorAll('[data-permission]').forEach(element => {
            const permission = element.getAttribute('data-permission');
            if (this.hasPermission(permission)) {
                element.style.display = '';
            } else {
                element.style.display = 'none';
            }
        });
    }
}

// 頁面載入時初始化
document.addEventListener('DOMContentLoaded', () => {
    window.permissionManager = new PermissionManager();
});
```

## 批次處理流程

### 按模組批次綁定
```bash
# 1. 選擇一個模組（如 USER）
MODULE="USER"

# 2. 取得該模組的所有權限
docker exec mariadb mysql -u rag_user -prag_password_2024 rag_db -e "
SELECT permission_key 
FROM permission_matrix 
WHERE module_code = '$MODULE'
ORDER BY sort_order;"

# 3. 逐個處理
for permission in $(permissions_list); do
    echo "Processing $permission"
    # 呼叫 bind-permissions agent
    # 呼叫 verify-permission-binding agent
    # 如果失敗，呼叫 fix-permission-issues agent
done
```

## 測試驗證

### 1. 單元測試範例
```python
# tests/test_permissions.py
import pytest
from fastapi.testclient import TestClient

class TestPermissions:
    def test_api_requires_permission(self):
        """測試 API 是否正確要求權限"""
        client = TestClient(app)
        
        # 無權限應返回 403
        response = client.post("/api/organization/departments")
        assert response.status_code == 403
        
        # 有權限應正常執行
        headers = {"Authorization": "Bearer valid_token_with_permission"}
        response = client.post("/api/organization/departments", headers=headers)
        assert response.status_code in [200, 201]
```

### 2. 整合測試
```bash
# 執行所有權限測試
docker exec backend pytest tests/permissions/ -v

# 執行特定模組測試
docker exec backend pytest tests/permissions/test_user_permissions.py -v
```

## 問題處理

### 常見問題及解決方案

| 問題類型 | 症狀 | 解決方案 |
|---------|------|----------|
| Import 錯誤 | ImportError: cannot import name 'require_permission' | 確保 permissions.py 檔案存在並正確 import |
| 權限代碼錯誤 | Permission 'USER_LOGIN' not found | 檢查是否使用正確格式 'USER.LOGIN' |
| 裝飾器順序 | 權限檢查未執行 | 確保 @require_permission 在 @router 之後 |
| 前端權限未生效 | 按鈕仍然顯示 | 檢查 PermissionManager 是否正確初始化 |

### 回滾流程
```bash
# 如果需要完全回滾
git checkout feature/permission-binding-base
git branch -D bind/PERMISSION_CODE

# 如果已合併需要還原
git revert HEAD
```

## 監控與報告

### 進度追蹤
```sql
-- 查看綁定進度
CREATE VIEW permission_binding_status AS
SELECT 
    pm.module_code,
    pm.permission_key,
    CASE 
        WHEN EXISTS(SELECT 1 FROM permission_binding_log WHERE permission_code = pm.permission_key AND status = 'completed')
        THEN 'Completed'
        WHEN EXISTS(SELECT 1 FROM permission_binding_log WHERE permission_code = pm.permission_key AND status = 'failed')
        THEN 'Failed'
        ELSE 'Pending'
    END as binding_status
FROM permission_matrix pm
ORDER BY pm.module_code, pm.sort_order;
```

### 生成報告
```bash
# 生成綁定報告
docker exec mariadb mysql -u rag_user -prag_password_2024 rag_db -e "
SELECT 
    module_code,
    COUNT(*) as total,
    SUM(CASE WHEN binding_status = 'Completed' THEN 1 ELSE 0 END) as completed,
    SUM(CASE WHEN binding_status = 'Failed' THEN 1 ELSE 0 END) as failed,
    SUM(CASE WHEN binding_status = 'Pending' THEN 1 ELSE 0 END) as pending
FROM permission_binding_status
GROUP BY module_code;"
```

## 最佳實踐

1. **逐步實施**：先從簡單的權限開始，累積經驗
2. **充分測試**：每個綁定都要經過完整測試
3. **詳細記錄**：保留所有變更記錄便於追蹤
4. **定期備份**：在批次處理前備份資料庫和程式碼
5. **監控效能**：注意權限檢查對系統效能的影響

## 相關文件

- [權限系統預設值生成指南](permission-defaults-generation-guide.md)
- [測試指南](guidelines/test-guidelines.md)
- Agent 文件：
  - [bind-permissions](.claude/agents/bind-permissions.md)
  - [verify-permission-binding](.claude/agents/verify-permission-binding.md)
  - [fix-permission-issues](.claude/agents/fix-permission-issues.md)

---
*創建日期: 2025-01-22*
*最後更新: 2025-01-22*
*專案: RAG with Ollama - 權限管理系統*