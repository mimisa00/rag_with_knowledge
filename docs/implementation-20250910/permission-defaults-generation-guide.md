# 權限系統預設值生成指南

## 任務目標
為權限管理系統生成完整的預設值資料，包括權限矩陣、URL權限、API權限、前端動作權限、預設群組等基礎配置，並記錄完整的程式碼位置備註。

## 專案環境
- **專案路徑**: `/home/shaun/workspace/gitlab/rag_with_ollama/`
- **資料庫**: MariaDB (rag_db)
- **測試帳號**: testadmin / testadmin
- **環境配置**: `.env`
- **測試指南**: `docs/guidelines/test-guidelines.md`

## 權限系統架構

### 前端檔案結構
```
frontend/static/admin/
├── permission-management.html    # 主頁面
├── permission-management.css     # 主樣式
├── js/
│   ├── permission-matrix.js     # 權限矩陣管理
│   ├── permission-matrix.css    
│   ├── permission-group.js      # 群組權限管理
│   ├── permission-group.css
│   ├── permission-access.js     # 權限存取管理
│   └── permission-access.css
```

### 資料庫表格結構
```sql
-- 權限矩陣
permission_matrix               # 權限定義表

-- 群組權限
permission_groups              # 權限群組
permission_groups_matrix       # 群組與權限矩陣關聯
permission_groups_department_role  # 群組與部門角色關聯
permission_groups_user         # 群組與使用者關聯

-- 權限存取（含程式碼位置備註）
permission_urls               # URL 權限對應 + note 欄位
permission_apis              # API 權限對應 + note 欄位
permission_actions           # 權限動作對應 + note 欄位
permission_cache             # 權限快取
```

## 執行步驟（含驗證）

### 步驟 0: 資料庫表結構驗證（關鍵！）

#### ⚠️ 重要：必須先驗證實際的資料庫表結構
在開始任何操作前，**必須**先檢查資料庫表格的實際結構，避免欄位不匹配問題。

```bash
# 檢查所有權限相關表格結構
docker exec mariadb mysql -u rag_user -prag_password_2024 rag_db -e "
DESCRIBE permission_matrix;
DESCRIBE permission_groups;
DESCRIBE permission_urls;
DESCRIBE permission_apis;
DESCRIBE permission_actions;
DESCRIBE permission_groups_matrix;"
```

#### 實際表結構說明（2025-01-22 驗證）

**permission_matrix 表結構**：
```sql
-- 注意：不是使用單一的 permission_code 和 name
module_code VARCHAR(50)      -- 模組代碼 (如: ORG, PERM, KB)
module_name VARCHAR(100)      -- 模組名稱
action_code VARCHAR(50)       -- 動作代碼 (如: DEPT_CREATE)
action_name VARCHAR(100)      -- 動作名稱
permission_key VARCHAR(100)   -- 權限鍵值 = module_code.action_code
sort_order INT               -- 排序順序（不是 sequence_no）
```

**permission_groups 表結構**：
```sql
-- 注意欄位名稱差異
code VARCHAR(50)             -- 群組代碼（不是 group_code）
name VARCHAR(100)            -- 群組名稱（不是 group_name）
permissions TEXT             -- JSON 格式權限列表
-- 沒有 is_system 欄位
```

**permission_groups_matrix 表結構**：
```sql
permission_group_id BIGINT   -- 注意是 permission_group_id，不是 group_id
permission_matrix_id BIGINT  -- 注意是 permission_matrix_id，不是 permission_id
```

**permission_actions 表結構**：
```sql
-- 注意：沒有 element_selector 欄位
module_key VARCHAR(50)
action_key VARCHAR(50)
permission_code VARCHAR(100)  -- 這裡使用完整的權限代碼
name VARCHAR(100)             -- 必須有 name 欄位
```

### 步驟 1: 使用 Agents 掃描專案

#### 1.1 掃描後端 API
```bash
# 使用 .claude/agents/scan-project-router.md
# 掃描 /app/api/routes/ 下所有 Python 檔案
# 產出：完整的 API 端點清單、HTTP 方法、權限需求、程式碼位置
```

#### 1.2 驗證掃描結果 ✅
```bash
# 使用 .claude/agents/validate-permission-data.md
# 驗證類型: agent_output
# 確認掃描結果完整性、路徑正確性、數量合理性
```

#### 1.3 掃描前端頁面結構
```bash
# 使用 .claude/agents/scan-html-structure.md  
# 掃描 /frontend/static/ 下所有 HTML 檔案
# 產出：頁面清單、類型分類、複雜度評級、JavaScript 依賴
```

#### 1.4 驗證掃描結果 ✅
```bash
# 使用 .claude/agents/validate-permission-data.md
# 驗證類型: agent_output
# 確認 HTML 掃描完整性
```

#### 1.5 分析關鍵頁面事件綁定
```bash
# 使用 .claude/agents/analyze-frontend-bindings.md
# ⚡ 此 agent 使用 Opus 模型以確保複雜 JavaScript 程式碼分析的準確性
# 重點分析：
# - /frontend/static/admin/organization.html (1632行)
# - /frontend/static/admin/permission-management.html (1094行)
# - /frontend/static/admin/knowledge-base.html (742行)
# - /frontend/static/admin/system-params.html (685行)
# 產出：前端操作與後端 API 對應關係、事件綁定位置
```

### 步驟 2: 生成 SQL 檔案

在 `/init-db/migration-20250910/` 目錄下創建以下檔案：

#### 檔案清單
1. `20250910-00-clean-permission-tables.sql` - 清除舊資料
2. `20250910-01-alter-tables-add-note.sql` - 新增 note 欄位
3. `20250910-02-permission-matrix-defaults.sql` - 權限矩陣預設值
4. `20250910-03-permission-urls-defaults.sql` - URL 權限對應
5. `20250910-04-permission-apis-defaults.sql` - API 權限對應
6. `20250910-05-permission-actions-defaults.sql` - 前端動作權限
7. `20250910-06-permission-groups-defaults.sql` - 預設權限群組

### 步驟 3: 驗證 SQL 語法 ✅
```bash
# 使用 .claude/agents/validate-permission-data.md
# 驗證類型: sql_syntax
# 確認所有 SQL 檔案語法正確、外鍵關係正確
```

### 步驟 4: 權限代碼規範

#### 模組代碼
- `SYSTEM` - 系統管理模組
- `ORG` - 組織管理模組
- `PERM` - 權限管理模組
- `KB` - 知識庫模組
- `USER` - 使用者功能模組

#### 權限代碼格式
`{MODULE}_{RESOURCE}_{ACTION}`

範例：
- `ORG_DEPT_CREATE` - 組織模組_部門資源_建立動作
- `PERM_MATRIX_EDIT` - 權限模組_矩陣資源_編輯動作
- `KB_FILE_UPLOAD` - 知識庫模組_檔案資源_上傳動作

### 步驟 5: 程式碼位置備註格式

#### permission_urls 備註格式：
```
HTML: /frontend/static/admin/organization.html
Router: /app/api/routes/static.py:24:organization_page()
Init: /frontend/static/js/organization-main.js:15:loadOrganizationModule()
```

#### permission_apis 備註格式：
```
Backend: /app/api/routes/organization.py:45:create_department()
Frontend: /frontend/static/js/organization-dept.js:234:saveDepartment()
Button: #saveDeptBtn
Form: #departmentForm
Validation: checkDeptName()
```

#### permission_actions 備註格式：
```
HTML: /frontend/static/admin/organization.html:156
JS: /frontend/static/js/organization-dept.js:89:initButtons()
Element: #addDeptBtn
Event: click->openAddDialog()
Check: hasPermission("ORG_DEPT_CREATE")
```

### 步驟 6: 資料庫執行

#### 執行前備份（建議）
```bash
# 備份現有權限資料
docker exec mariadb mysqldump -u rag_user -prag_password_2024 rag_db \
    permission_matrix permission_urls permission_apis permission_actions \
    permission_groups permission_groups_matrix permission_groups_user \
    permission_groups_department_role permission_cache \
    > backup-permissions-$(date +%Y%m%d-%H%M%S).sql
```

#### 執行方法（推薦）
```bash
# 合併所有 SQL 檔案並執行
cat init-db/migration-20250910/*.sql | docker exec -i mariadb mysql -u rag_user -prag_password_2024 rag_db
```

### 步驟 7: 驗證執行結果 ✅
```bash
# 使用 .claude/agents/validate-permission-data.md
# 驗證類型: database_result
# 確認：
# - 資料完整性
# - 關聯正確性
# - note 欄位填充率
# - 關鍵權限存在性
```

## 驗證檢查點

### 檢查點 1：Agent 執行後立即驗證
- [ ] Agent 有回傳結果
- [ ] 結果包含預期的章節
- [ ] 數量 >= 最小預期值
- [ ] 使用 validate-permission-data agent 驗證

### 檢查點 2：資料轉換驗證
- [ ] 成功解析出權限代碼
- [ ] 路徑可以對應到實際檔案
- [ ] 前後端對應關係合理
- [ ] 使用 validate-permission-data agent 驗證

### 檢查點 3：SQL 生成驗證
- [ ] SQL 語法正確
- [ ] 外鍵關係正確
- [ ] note 欄位包含有效資訊
- [ ] 使用 validate-permission-data agent 驗證

### 檢查點 4：執行後驗證
- [ ] 資料插入成功
- [ ] 無孤立記錄
- [ ] 關鍵權限都存在
- [ ] 使用 validate-permission-data agent 驗證

## 錯誤處理與回復

### 常見錯誤及解決方案

#### 1. 表結構不匹配錯誤（最常見）
**症狀**：SQL 執行後資料表仍為空，沒有錯誤訊息但資料未插入

**原因**：生成的 SQL 使用了錯誤的欄位名稱

**解決方案**：
1. 執行步驟 0 檢查實際表結構
2. 根據實際欄位調整 SQL：
   - permission_matrix: 拆分權限代碼為 module_code + action_code
   - permission_groups: 使用 code 而非 group_name
   - permission_groups_matrix: 使用 permission_group_id 而非 group_id

#### 2. 權限代碼格式錯誤
**症狀**：permission_key 欄位值不正確

**正確格式**：
```sql
-- 錯誤：直接使用 ORG_DEPT_CREATE
-- 正確：拆分並組合
module_code = 'ORG'
action_code = 'DEPT_CREATE'  
permission_key = 'ORG.DEPT_CREATE'  -- 使用點號連接
```

#### 3. 關聯表格外鍵錯誤
**症狀**：插入 permission_groups_matrix 時失敗

**解決方案**：確保先插入主表資料，再插入關聯表

### Agent 失敗處理
如果掃描 Agent 失敗，使用備用方案：

```bash
# 備用方案 1: 直接使用 grep 掃描 API
grep -r "@router\." /app/api/routes/ --include="*.py" | \
    awk -F: '{print $1 ":" $2}' | \
    sed 's/@router\.\(get\|post\|put\|delete\|patch\)("\([^"]*\)".*/\1 \2/' 

# 備用方案 2: 掃描 HTML 中的 fetch 呼叫
grep -r "fetch(" /frontend/static/ --include="*.html" --include="*.js" | \
    grep -oP 'fetch\(["\x27](/api/[^"\x27]*)["\x27]' | \
    sort -u
```

### 最小權限集（緊急備用）
如果整個流程失敗，至少執行：

```sql
-- 儲存在 /init-db/migration-20250910/20250910-99-fallback-minimum.sql
-- 注意：必須拆分權限代碼為 module_code 和 action_code
INSERT IGNORE INTO permission_matrix 
(module_code, module_name, action_code, action_name, permission_key, description, sort_order) VALUES
('USER', '使用者', 'LOGIN', '登入', 'USER.LOGIN', '基本登入權限', 1),
('USER', '使用者', 'QUERY', '查詢', 'USER.QUERY', 'AI 問答功能', 2),
('ADMIN', '管理員', 'ACCESS', '存取', 'ADMIN.ACCESS', '進入管理介面', 3);

INSERT IGNORE INTO permission_urls (url_pattern, method, permission_code, module_key, is_public, note) VALUES
('/login', 'GET', NULL, 'auth', TRUE, 'Fallback: 登入頁面'),
('/dashboard', 'GET', 'USER_QUERY', 'user', FALSE, 'Fallback: 用戶主頁');

INSERT IGNORE INTO permission_apis (api_pattern, method, permission_code, module_key, require_auth, note) VALUES
('/api/user/login', 'POST', NULL, 'auth', FALSE, 'Fallback: 登入 API'),
('/api/query', 'POST', 'USER_QUERY', 'user', TRUE, 'Fallback: 問答 API');
```

### 資料庫回復
```bash
# 從備份恢復
docker exec -i mariadb mysql -u rag_user -prag_password_2024 rag_db < backup-permissions-*.sql
```

## 權限快取實作建議

### 前端權限快取
```javascript
// 權限快取類別
class PermissionCache {
    constructor() {
        this.permissions = null;
        this.urls = null;
        this.apis = null;
        this.actions = null;
        this.lastUpdate = null;
    }
    
    // 登入或切換頁面時一次性載入所有權限
    async loadPermissions() {
        const response = await fetch('/api/permissions/user-permissions');
        const data = await response.json();
        
        this.permissions = data.permissions;  // 權限矩陣
        this.urls = data.urls;                // 可訪問的 URLs
        this.apis = data.apis;                // 可呼叫的 APIs  
        this.actions = data.actions;          // 可執行的動作
        this.lastUpdate = Date.now();
        
        // 存入 sessionStorage
        sessionStorage.setItem('permissionCache', JSON.stringify(data));
    }
    
    hasPermission(permissionCode) {
        return this.permissions?.includes(permissionCode) || false;
    }
    
    canPerformAction(moduleKey, actionKey) {
        return this.actions?.some(a => a.module === moduleKey && a.action === actionKey) || false;
    }
}
```

## SQL 檔案範例

### 1. 清除舊資料
```sql
-- 20250910-00-clean-permission-tables.sql
-- 按照外鍵依賴順序刪除
DELETE FROM permission_groups_matrix;
DELETE FROM permission_groups_user;
DELETE FROM permission_groups_department_role;
DELETE FROM permission_cache;
DELETE FROM permission_actions;
DELETE FROM permission_apis;
DELETE FROM permission_urls;
DELETE FROM permission_groups;
DELETE FROM permission_matrix;

-- 重置自增 ID
ALTER TABLE permission_matrix AUTO_INCREMENT = 1;
```

### 2. 權限矩陣範例（注意欄位對應）
```sql
-- 20250910-02-permission-matrix-defaults.sql
-- ⚠️ 重要：必須拆分權限代碼為 module_code 和 action_code
INSERT IGNORE INTO permission_matrix 
(module_code, module_name, action_code, action_name, permission_key, description, sort_order, note) VALUES
-- 組織管理權限
('ORG', '組織管理', 'DEPT_CREATE', '建立部門', 'ORG.DEPT_CREATE', '建立新部門', 43, NULL),
('ORG', '組織管理', 'DEPT_UPDATE', '編輯部門', 'ORG.DEPT_UPDATE', '編輯部門資訊', 44, NULL),
('ORG', '組織管理', 'DEPT_DELETE', '刪除部門', 'ORG.DEPT_DELETE', '刪除部門', 45, NULL),
-- 權限管理
('PERM', '權限管理', 'GROUP_CREATE', '建立群組', 'PERM.GROUP_CREATE', '建立權限群組', 77, NULL),
('PERM', '權限管理', 'GROUP_UPDATE', '編輯群組', 'PERM.GROUP_UPDATE', '編輯權限群組', 78, NULL);
```

### 3. 權限群組範例（注意欄位名稱）
```sql
-- 20250910-06-permission-groups-defaults.sql
-- ⚠️ 注意：使用 code 和 name，而非 group_name
INSERT IGNORE INTO permission_groups (code, name, description, permissions, is_active) VALUES
('SUPER_ADMIN', '超級管理員', '系統最高權限群組', '[]', TRUE),
('SYSTEM_ADMIN', '系統管理員', '系統管理權限群組', '[]', TRUE),
('NORMAL_USER', '一般使用者', '基本使用者權限群組', '[]', TRUE);

-- 權限群組關聯（注意欄位名稱）
SET @super_admin_id = (SELECT id FROM permission_groups WHERE code = 'SUPER_ADMIN');
INSERT INTO permission_groups_matrix (permission_group_id, permission_matrix_id, created_at)
SELECT @super_admin_id, id, NOW() FROM permission_matrix;
```

### 4. API 權限範例（含備註）
```sql
-- 20250910-04-permission-apis-defaults.sql
INSERT IGNORE INTO permission_apis 
(api_pattern, method, permission_code, module_key, description, require_auth, priority, note) VALUES
('/api/organization/departments', 'POST', 'ORG_DEPT_CREATE', 'org', '新增部門', TRUE, 11,
'Backend: /app/api/routes/organization.py:45:create_department()
Frontend: /frontend/static/js/organization-dept.js:234:saveDepartment()
Button: #saveDeptBtn
Form: #departmentForm
Validation: checkDeptName()');
```

## 預期產出

1. **SQL 檔案** (7個)
   - 包含完整的預設值 INSERT 語句
   - 詳細的程式碼位置備註
   - 可直接執行的遷移腳本

2. **驗證報告**
   - 每個階段的驗證結果
   - 由 validate-permission-data agent 生成
   - 包含成功/失敗狀態和建議

3. **執行日誌**
   - 記錄每個步驟的執行結果
   - 統計生成的預設值數量
   - 標記需要人工確認的項目

## 可用的 Agents

### 掃描 Agents
- `.claude/agents/scan-project-router.md` - 掃描後端 API (Sonnet)
- `.claude/agents/scan-html-structure.md` - 掃描前端頁面 (Sonnet)
- `.claude/agents/analyze-frontend-bindings.md` - 分析事件綁定 (Opus) ⚡

### 驗證 Agent
- `.claude/agents/validate-permission-data.md` - 驗證資料正確性 (Sonnet) ✅

### 模型選擇說明
⚡ **analyze-frontend-bindings** 使用 **Opus** 模型的原因：
- 需要深度理解複雡的 JavaScript 程式碼邏輯
- 分析跨檔案的事件綁定和 API 呼叫關係
- 處理大型 HTML 檔案 (organization.html 1632行)
- 確保 permission_actions 的程式碼位置備註準確性

其他 agents 使用 **Sonnet** 模型已足夠，可控制成本。

## 開始執行

在新對話中，請直接說：
"請根據 docs/permission-defaults-generation-guide.md 執行權限系統預設值生成任務"

## 注意事項

1. **驗證優先**：每個步驟都使用 validate-permission-data agent 驗證
2. **備份必要**：執行清除前必須備份
3. **Token 節省**：驗證工作交給專門的 agent 處理
4. **錯誤處理**：每個階段都有備用方案
5. **最小權限**：確保系統至少能基本運作
6. **模型效率**：在關鍵複雜任務使用 Opus，其他使用 Sonnet 控制成本

---
*創建日期: 2025-01-22*
*最後更新: 2025-01-22*
*專案: RAG with Ollama - 權限管理系統*