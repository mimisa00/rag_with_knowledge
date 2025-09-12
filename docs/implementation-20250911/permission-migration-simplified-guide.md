# 權限系統 JSON 欄位移除實作指南（簡化版）

## 概述
完全移除 `permission_groups.permissions` JSON 欄位的依賴，使用已存在的 `permission_groups_matrix` 關聯表資料。

## 測試環境資訊

### 環境配置
- **配置檔案**: `.env`
- **資料庫**: MariaDB (rag_db)
- **資料庫使用者**: rag_user
- **資料庫密碼**: rag_password_2024
- **後端服務埠**: 8080
- **時區**: Asia/Taipei

### 測試帳號
- **使用者名稱**: testadmin
- **密碼**: testadmin
- **權限**: 系統管理員

### 測試指南參考
- **詳細測試流程**: `/docs/guidelines/test-guidelines.md`

## 可用的驗證 Agents

| Agent 名稱 | 用途 | 使用時機 |
|-----------|------|----------|
| verify-permission-binding | 驗證權限綁定是否正確 | 每次修改權限相關程式碼後 |
| validate-permission-data | 驗證權限資料完整性 | 修改前後驗證 |
| code-reviewer | 程式碼審查 | 完成每個模組修改後 |

## 現況說明

### 當前問題
- `permission_groups.permissions` 欄位存儲 JSON 字串格式：`["USER.LOGIN", "USER.LOGOUT", ...]`
- 程式碼期望 Dict 類型，造成類型錯誤
- `permission_groups_matrix` 關聯表資料已完整建立

### 解決方案
- 直接從 `permission_groups_matrix` 關聯表取得權限
- 完全移除對 `permissions` JSON 欄位的依賴
- 不需要資料遷移，因為關聯表資料已存在

## Phase 1: 準備工作

### 1.1 建立工作分支
```bash
# 確認在 feature/permission-binding-base 分支
git checkout feature/permission-binding-base
git pull origin feature/permission-binding-base

# 建立修復分支
git checkout -b fix/remove-json-permissions-field
```

### 1.2 驗證現有資料
```bash
# 確認 permission_groups_matrix 資料已存在
docker exec mariadb mysql -u rag_user -prag_password_2024 rag_db -e "
SELECT 
    pg.code as group_code,
    pg.name as group_name,
    COUNT(pgm.permission_matrix_id) as permission_count
FROM permission_groups pg
LEFT JOIN permission_groups_matrix pgm ON pg.id = pgm.permission_group_id
GROUP BY pg.id
ORDER BY pg.code;"

# 查看具體權限對應
docker exec mariadb mysql -u rag_user -prag_password_2024 rag_db -e "
SELECT 
    pg.code,
    pm.permission_key
FROM permission_groups pg
JOIN permission_groups_matrix pgm ON pg.id = pgm.permission_group_id
JOIN permission_matrix pm ON pgm.permission_matrix_id = pm.id
WHERE pg.code IN ('SUPER_ADMIN', 'NORMAL_USER')
LIMIT 20;"
```

### 1.3 備份（預防性）
```bash
# 備份當前程式碼
git stash
git stash save "backup-before-permission-migration"

# 記錄當前權限狀態
docker exec mariadb mysql -u rag_user -prag_password_2024 rag_db -e "
SELECT id, code, name, permissions FROM permission_groups;" > current-permissions-state.txt
```

## Phase 2: 後端程式碼修改

### 2.1 修改資料模型
**檔案**: `/app/models/organization.py`

```python
# 找到 PermissionGroup 類別（約第70-90行）
class PermissionGroup(BaseModel):
    """權限群組模型"""
    id: Optional[int] = None
    code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    permission_type: str = Field(default="custom", max_length=20)
    # 完全移除 permissions 欄位
    # permissions: Optional[Dict[str, Any]] = None  ← 刪除這行
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[int] = None
    updated_by: Optional[int] = None

# 同樣處理 PermissionGroupCreate 和 PermissionGroupUpdate
class PermissionGroupCreate(BaseModel):
    """建立權限群組請求"""
    code: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    permission_type: str = Field(default="custom", max_length=20)
    # 移除 permissions 欄位
    permission_ids: Optional[List[int]] = None  # 保留這個，用於指定權限
    is_active: bool = True

class PermissionGroupUpdate(BaseModel):
    """更新權限群組請求"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    permission_type: Optional[str] = Field(None, max_length=20)
    # 移除 permissions 欄位
    permission_ids: Optional[List[int]] = None  # 保留這個
    is_active: Optional[bool] = None
```

### 2.2 修改 organization.py 路由
**檔案**: `/app/api/routes/organization.py`

#### 修改 `get_users_permission_groups_batch` 函數（約第39-74行）
```python
def get_users_permission_groups_batch(user_ids: List[int]) -> Dict[int, List[Dict[str, Any]]]:
    """批次取得多個使用者的權限群組"""
    if not user_ids:
        return {}
    
    try:
        from app.dao.base import BaseDAO, db_manager
        dao = BaseDAO(db_manager)
        
        placeholders = ','.join(['%s'] * len(user_ids))
        query = f"""
            SELECT upg.*, pg.code, pg.name, pg.permission_type,
                   d.name as department_name
            FROM permission_groups_user upg
            JOIN permission_groups pg ON upg.permission_group_id = pg.id
            LEFT JOIN departments d ON upg.department_id = d.id
            WHERE upg.user_id IN ({placeholders})
            AND (upg.expires_at IS NULL OR upg.expires_at > NOW())
            ORDER BY upg.user_id, pg.permission_type, pg.name
        """
        
        results = dao.execute_query(query, user_ids)
        
        # 為每個權限群組取得實際權限（從關聯表）
        for result in results:
            perm_query = """
                SELECT pm.permission_key
                FROM permission_groups_matrix pgm
                JOIN permission_matrix pm ON pgm.permission_matrix_id = pm.id
                WHERE pgm.permission_group_id = %s
                AND pm.is_active = 1
            """
            perms = dao.execute_query(perm_query, [result['permission_group_id']])
            result['permission_list'] = [p['permission_key'] for p in perms] if perms else []
        
        # 按使用者ID分組
        groups_by_user = {}
        for result in results:
            user_id = result['user_id']
            if user_id not in groups_by_user:
                groups_by_user[user_id] = []
            groups_by_user[user_id].append(result)
        
        return groups_by_user
        
    except Exception as e:
        logger.error(f"Error getting users permission groups batch: {e}")
        return {}
```

#### 修改 `_build_user_with_permission_groups` 函數（約第1724-1809行）
```python
def _build_user_with_permission_groups(user_id: Any) -> Optional[UserWithPermissionGroups]:
    """建立包含權限群組的使用者資訊"""
    try:
        # 取得使用者基本資訊（包含停用用戶）
        user = user_dao.get_user_by_id(user_id, include_inactive=True)
        if not user:
            return None
        
        # 取得擴充資訊
        extension = user_org_dao.get_user_extension(user_id)
        
        # 取得部門資訊
        department = None
        if extension and extension['department_id']:
            department = department_dao.get_department(extension['department_id'])
        
        # 取得權限群組資訊
        permission_groups_user = user_org_dao.get_permission_groups_user(user_id)
        permission_groups = []
        
        # 從關聯表取得每個群組的實際權限
        from app.dao.base import BaseDAO, db_manager
        dao = BaseDAO(db_manager)
        
        for upg in permission_groups_user:
            # 取得該群組的權限列表
            perm_query = """
                SELECT pm.permission_key
                FROM permission_groups_matrix pgm
                JOIN permission_matrix pm ON pgm.permission_matrix_id = pm.id
                WHERE pgm.permission_group_id = %s
                AND pm.is_active = 1
            """
            perms = dao.execute_query(perm_query, [upg['permission_group_id']])
            permission_list = [p['permission_key'] for p in perms] if perms else []
            
            # 根據權限類型分配層級
            level = 0
            permission_type = upg['permission_type']
            if permission_type == 'admin':
                level = 9
            elif permission_type == 'manager':
                level = 5
            elif permission_type == 'user':
                level = 1
            
            permission_group = {
                'id': upg['permission_group_id'],
                'code': upg['code'],
                'name': upg['name'],
                'permission_type': upg['permission_type'],
                'permissions': permission_list,  # 使用陣列格式
                'level': level
            }
            permission_groups.append(permission_group)
        
        # ... 其餘程式碼保持不變 ...
```

#### 同樣修改 `_build_user_with_permission_groups_with_token` 函數（約第1639-1721行）

### 2.3 修改 DAO 層
**檔案**: `/app/dao/organization.py`

找到 `PermissionGroupDAO` 類別，修改相關方法：

```python
def get_permission_group(self, permission_group_id: int) -> Optional[Dict[str, Any]]:
    """取得權限群組"""
    try:
        query = """
            SELECT * FROM permission_groups WHERE id = %s
        """
        results = self.execute_query(query, (permission_group_id,))
        
        if results:
            group = results[0]
            # 不再處理 permissions JSON 欄位
            # 改為從關聯表取得權限
            perm_query = """
                SELECT pm.permission_key
                FROM permission_groups_matrix pgm
                JOIN permission_matrix pm ON pgm.permission_matrix_id = pm.id
                WHERE pgm.permission_group_id = %s
                AND pm.is_active = 1
            """
            perms = self.execute_query(perm_query, [permission_group_id])
            group['permission_list'] = [p['permission_key'] for p in perms] if perms else []
            return group
        return None
        
    except Exception as e:
        logger.error(f"取得權限群組失敗: {e}")
        return None

def list_permission_groups(self, is_active: Optional[bool] = None) -> List[Dict[str, Any]]:
    """列出權限群組"""
    try:
        query = "SELECT * FROM permission_groups WHERE 1=1"
        params = []
        
        if is_active is not None:
            query += " AND is_active = %s"
            params.append(is_active)
        
        query += " ORDER BY permission_type, name"
        
        groups = self.execute_query(query, tuple(params) if params else None)
        
        # 為每個群組取得權限列表
        for group in groups:
            perm_query = """
                SELECT pm.permission_key
                FROM permission_groups_matrix pgm
                JOIN permission_matrix pm ON pgm.permission_matrix_id = pm.id
                WHERE pgm.permission_group_id = %s
                AND pm.is_active = 1
            """
            perms = self.execute_query(perm_query, [group['id']])
            group['permission_list'] = [p['permission_key'] for p in perms] if perms else []
        
        return groups
        
    except Exception as e:
        logger.error(f"列出權限群組失敗: {e}")
        return []
```

### 2.4 修改權限檢查
**檔案**: `/app/core/security/permissions.py`

移除 JSON 解析邏輯：
```python
def get_user_permissions(user_id: int) -> List[str]:
    """取得使用者所有權限"""
    try:
        # 從權限群組取得權限（新方式）
        query = """
            SELECT DISTINCT pm.permission_key
            FROM permission_groups_user pgu
            JOIN permission_groups_matrix pgm ON pgu.permission_group_id = pgm.permission_group_id
            JOIN permission_matrix pm ON pgm.permission_matrix_id = pm.id
            WHERE pgu.user_id = %s
            AND (pgu.expires_at IS NULL OR pgu.expires_at > NOW())
            AND pm.is_active = 1
        """
        
        from app.dao.base import BaseDAO, db_manager
        dao = BaseDAO(db_manager)
        results = dao.execute_query(query, [user_id])
        
        return [r['permission_key'] for r in results] if results else []
        
    except Exception as e:
        logger.error(f"Error getting user permissions: {e}")
        return []
```

## Phase 3: 前端程式碼修改

### 3.1 修改權限顯示邏輯
**檔案**: `/frontend/static/js/admin-modules/organization/organization-emp-modal.js`

```javascript
// 修改第368行附近
if (user.permission_groups) {
    // 權限現在直接是陣列格式
    const permissionIds = user.permission_groups.map(p => {
        // 如果是物件，取 id
        if (typeof p === 'object' && p.id) {
            return p.id;
        }
        return null;
    }).filter(id => id);
    
    // ... 其他程式碼
}

// 修改第590行附近
function getUserAllPermissions(user) {
    const directPermissions = user.permission_groups || [];
    const rolePermissions = user.role_permission_groups || [];
    
    const allPermissions = new Set();
    
    // 處理直接權限
    directPermissions.forEach(group => {
        // permissions 現在直接是陣列
        if (Array.isArray(group.permissions)) {
            group.permissions.forEach(p => allPermissions.add(p));
        }
    });
    
    // 處理角色權限
    rolePermissions.forEach(group => {
        if (Array.isArray(group.permissions)) {
            group.permissions.forEach(p => allPermissions.add(p));
        }
    });
    
    return Array.from(allPermissions);
}
```

### 3.2 修改權限卡片顯示
**檔案**: `/frontend/static/js/admin-modules/organization/organization-emp-card.js`

```javascript
// 修改第210行附近
const directPermissions = employee.permission_groups || [];
const rolePermissions = employee.role_permission_groups || [];

// 合併權限（去重）
const allPermissions = new Set();

directPermissions.forEach(group => {
    // permissions 現在保證是陣列
    if (Array.isArray(group.permissions)) {
        group.permissions.forEach(p => allPermissions.add(p));
    }
});

rolePermissions.forEach(group => {
    if (Array.isArray(group.permissions)) {
        group.permissions.forEach(p => allPermissions.add(p));
    }
});
```

## Phase 4: 測試驗證

### 4.1 重啟服務
```bash
# 重啟後端服務以載入修改
docker restart backend

# 查看啟動日誌
docker compose logs -f backend
```

### 4.2 基本功能測試
```bash
# 1. 登入測試
curl -X POST http://localhost:8080/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"username": "testadmin", "password": "testadmin"}' \
  -c cookies.txt

# 2. 取得使用者列表（包含權限）
curl -X GET http://localhost:8080/api/organization/users \
  -b cookies.txt | python3 -m json.tool

# 3. 確認權限資料結構正確
# 應該看到 permission_groups 中的 permissions 是陣列格式
```

### 4.3 前端測試
1. 開啟瀏覽器訪問 `http://localhost:8080/login`
2. 使用 testadmin/testadmin 登入
3. 訪問 `http://localhost:8080/admin/organization.html`
4. 確認頁面正常載入，無錯誤
5. 檢查瀏覽器控制台無錯誤訊息

### 4.4 驗證權限功能
```bash
# 驗證權限資料正確性
docker exec backend python -c "
from app.dao.organization import user_org_dao
from app.dao.base import BaseDAO, db_manager

# 取得使用者權限群組
groups = user_org_dao.get_permission_groups_user(1)
print('User permission groups:')
for g in groups:
    print(f\"  - {g['code']}: {g['name']}\")

# 取得權限列表
dao = BaseDAO(db_manager)
for g in groups:
    query = '''
        SELECT pm.permission_key
        FROM permission_groups_matrix pgm
        JOIN permission_matrix pm ON pgm.permission_matrix_id = pm.id
        WHERE pgm.permission_group_id = %s
    '''
    perms = dao.execute_query(query, [g['permission_group_id']])
    print(f\"\\nPermissions for {g['code']}:\")
    for p in perms[:5]:  # 只顯示前5個
        print(f\"    - {p['permission_key']}\")
"
```

### 4.5 使用 Agent 驗證
```bash
# 使用 validate-permission-data agent
# 輸入: {"mode": "full_check", "table": "permission_groups_matrix"}

# 使用 verify-permission-binding agent  
# 輸入: {"mode": "runtime_check", "user_id": 1}

# 使用 code-reviewer agent
# 輸入: {"files": ["organization.py", "organization-emp-modal.js"]}
```

## Phase 5: 提交與部署

### 5.1 檢查變更
```bash
# 查看所有變更
git status
git diff

# 確認修改的檔案
git diff --name-only
```

### 5.2 提交變更
```bash
# 加入變更
git add -A

# 提交
git commit -m "fix: 移除 permission_groups.permissions JSON 欄位依賴

- 完全移除對 permissions JSON 欄位的使用
- 改為從 permission_groups_matrix 關聯表取得權限
- 修正前端處理權限資料的邏輯
- 解決組織管理頁面的 JSON 解析錯誤"

# 推送
git push origin fix/remove-json-permissions-field
```

### 5.3 監控
```bash
# 監控錯誤日誌
docker compose logs -f backend | grep -E "ERROR|permission"

# 檢查是否有新的錯誤
docker exec mariadb mysql -u rag_user -prag_password_2024 rag_db -e "
SELECT COUNT(*) as error_count FROM audit_logs 
WHERE action LIKE '%error%' 
AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR);"
```

## 回滾計畫

如果發現問題需要回滾：

```bash
# 1. 切換回原分支
git checkout feature/permission-binding-base

# 2. 重啟服務
docker restart backend

# 3. 確認服務正常
docker compose ps
```

## 成功標準檢查清單

- [ ] `/admin/organization.html` 頁面正常載入
- [ ] 無 "Input should be a valid dictionary" 錯誤
- [ ] 使用者權限列表正確顯示
- [ ] 權限分配功能正常運作
- [ ] 所有 API 測試通過
- [ ] 瀏覽器控制台無錯誤

## 預估時間

| 任務 | 預估時間 | 備註 |
|-----|---------|------|
| 準備工作 | 15分鐘 | 建立分支、驗證資料 |
| 後端修改 | 1-2小時 | 主要是 organization.py |
| 前端修改 | 30分鐘 | 調整權限處理邏輯 |
| 測試驗證 | 30分鐘 | 功能測試 |
| **總計** | **2-3小時** | |

## 注意事項

1. **不需要資料遷移**：`permission_groups_matrix` 資料已存在
2. **向後相容**：確保 permissions 欄位以陣列格式返回
3. **快取問題**：可能需要清除瀏覽器快取
4. **效能考量**：關聯查詢可能增加，但影響應該很小

---
*創建日期: 2025-09-11*
*作者: Claude Code Assistant*
*版本: 1.0 (簡化版)*