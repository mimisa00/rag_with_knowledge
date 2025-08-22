# 組織管理系統測試指南

## 測試環境設置

### 1. 確認服務狀態
```bash
docker compose ps
```
確保 backend、mariadb、ollama 服務都在運行中。

### 2. 測試帳號資訊
- **使用者名稱**: testadmin
- **密碼**: testadmin
- **權限**: 系統管理員

## API 測試流程

### 1. 登入系統
```bash
# 登入並保存 cookie
curl -X POST http://localhost:8080/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"username": "testadmin", "password": "testadmin"}' \
  -c cookies.txt \
  -s | python3 -m json.tool
```

預期回應：
```json
{
    "success": true,
    "message": "登入成功",
    "user": {
        "id": 1,
        "username": "testadmin",
        "email": "testadmin@example.com",
        "role": "admin"
    }
}
```

### 2. 測試組織管理 API

#### 2.1 查詢部門列表
```bash
curl -X GET http://localhost:8080/api/organization/departments \
  -b cookies.txt \
  -s | python3 -m json.tool
```

#### 2.2 新增部門
```bash
curl -X POST http://localhost:8080/api/organization/departments \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "研發部",
    "parent_id": null,
    "description": "負責產品研發"
  }' \
  -s | python3 -m json.tool
```

#### 2.3 查詢角色列表
```bash
curl -X GET http://localhost:8080/api/organization/roles \
  -b cookies.txt \
  -s | python3 -m json.tool
```

#### 2.4 新增角色
```bash
curl -X POST http://localhost:8080/api/organization/roles \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "code": "DEVELOPER",
    "name": "開發人員",
    "type": "業務",
    "description": "負責系統開發",
    "permission_ids": []
  }' \
  -s | python3 -m json.tool
```

#### 2.5 查詢用戶列表
```bash
curl -X GET http://localhost:8080/api/organization/users?page=1&limit=10 \
  -b cookies.txt \
  -s | python3 -m json.tool
```

#### 2.6 新增用戶
```bash
curl -X POST http://localhost:8080/api/organization/users \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "username": "john_doe",
    "password": "password123",
    "email": "john@example.com",
    "full_name": "John Doe",
    "department_id": 1,
    "role_ids": [1],
    "auth_type": "local",
    "status": "active"
  }' \
  -s | python3 -m json.tool
```

### 3. 刪除測試數據

#### 3.1 刪除用戶
```bash
curl -X DELETE http://localhost:8080/api/organization/users/{user_id} \
  -b cookies.txt \
  -s | python3 -m json.tool
```

#### 3.2 刪除角色
```bash
curl -X DELETE http://localhost:8080/api/organization/roles/{role_id} \
  -b cookies.txt \
  -s | python3 -m json.tool
```

#### 3.3 刪除部門
```bash
curl -X DELETE http://localhost:8080/api/organization/departments/{dept_id} \
  -b cookies.txt \
  -s | python3 -m json.tool
```

### 4. 登出系統
```bash
curl -X POST http://localhost:8080/api/user/logout \
  -b cookies.txt \
  -s | python3 -m json.tool
```

## UI 測試流程

### 1. 登入頁面
1. 開啟瀏覽器訪問: http://localhost:8080/login
2. 輸入測試帳號: testadmin / testadmin
3. 點擊登入按鈕

### 2. 進入組織管理頁面
1. 登入後導航至: http://localhost:8080/admin/organization.html
2. 或從管理控制台點擊「組織管理」

### 3. 測試功能
1. **部門管理**
   - 點擊左側「部門管理」
   - 點擊「新增部門」按鈕
   - 填寫部門資訊並儲存
   - 檢查部門樹狀結構是否正確顯示

2. **角色管理**
   - 點擊左側「角色管理」
   - 點擊「新增角色」按鈕
   - 填寫角色資訊並設定權限
   - 儲存後檢查角色列表

3. **帳號管理**
   - 點擊左側「帳號管理」
   - 點擊「新增帳號」按鈕
   - 填寫用戶資訊、分配部門和角色
   - 儲存後檢查用戶列表

### 4. 驗證功能
- 測試編輯功能（點擊編輯圖標）
- 測試刪除功能（點擊刪除圖標）
- 測試搜尋功能（在搜尋框輸入關鍵字）
- 測試分頁功能（切換頁面）
- 測試抽屜開關（點擊左上角按鈕）

## 常見問題排查

### 1. 登入失敗
- 檢查後端服務是否運行: `docker compose ps`
- 檢查資料庫連接: `docker compose logs backend`
- 確認測試帳號存在

### 2. API 回傳 401 未授權
- 確認已正確登入並保存 cookie
- 檢查 session 是否過期
- 重新登入取得新的 session

### 3. 頁面無法載入
- 檢查瀏覽器控制台錯誤
- 確認靜態文件路徑正確
- 清除瀏覽器快取

### 4. 功能無反應
- 檢查瀏覽器控制台是否有 JavaScript 錯誤
- 確認模組已正確載入
- 檢查網路請求是否成功

## 測試檢查清單

- [ ] 服務啟動正常
- [ ] 登入功能正常
- [ ] 部門 CRUD 操作正常
- [ ] 角色 CRUD 操作正常
- [ ] 用戶 CRUD 操作正常
- [ ] 權限分配功能正常
- [ ] 搜尋功能正常
- [ ] 分頁功能正常
- [ ] UI 響應正常
- [ ] 錯誤處理正常

---
*最後更新: 2025-01-21*
*版本: Phase 2 - 組織管理介面實作*