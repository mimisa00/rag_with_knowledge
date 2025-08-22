# 🤖 AUTO_PILOT - 組織管理系統自主實作控制中心

## 📌 啟動提示
當 Claude 看到這個文件時，請立即：
1. 檢查 `docs/AUTO_PILOT_STATUS.json` 當前狀態
2. 根據狀態決定下一步動作
3. 如果是新開始，提示：「🚀 檢測到組織管理系統待實作，輸入『開始組織管理』啟動自動實作」
4. 如果是進行中，提示當前進度和等待項目

## 🎯 自主執行規則

### 核心原則
1. **自動執行**：讀取狀態後自動判斷並執行
2. **智慧停止**：只在必要時停下請求協助
3. **進度追蹤**：自動更新狀態文件
4. **錯誤恢復**：遇錯自動嘗試修復

### 執行決策樹
```
START
  ├─ 檢查 STATUS
  ├─ IF "NOT_STARTED" → 提示開始
  ├─ IF "IN_PROGRESS" → 從斷點繼續
  ├─ IF "WAITING_USER" → 顯示等待原因
  └─ IF "COMPLETED" → 詢問是否測試
```

## 🛑 停止點定義 (STOP_POINTS)

### SP_001: 資料庫準備確認
- **時機**：建立 migration 檔案後
- **提示**：「📦 資料庫 migration 已準備好，請確認 MariaDB 已啟動，輸入『繼續』執行」
- **檔案**：`init-db/004_organization_tables.sql`

### SP_002: Phase 1 測試點
- **時機**：完成基礎 API
- **提示**：「✅ Phase 1 基礎功能完成！請測試以下 API：
  - GET /api/organization/departments
  - POST /api/organization/roles
  - GET /api/organization/users
  測試無誤後輸入『測試通過』」

### SP_003: 組織管理 UI 測試
- **時機**：完成 organization.html
- **提示**：「🎨 組織管理介面完成！請訪問 /admin/organization.html 測試功能」

### SP_004: 密碼策略確認
- **時機**：實作密碼策略前
- **提示**：「🔐 準備實作密碼策略，請確認：
  1. 是否需要 Email 發送功能？（需要 SMTP 設定）
  2. 是否有 LDAP 伺服器？
  回答後繼續」

### SP_005: SSO 設定資訊
- **時機**：實作 SSO 前
- **提示**：「🔑 準備實作 SSO，請提供：
  1. OAuth client_id/secret（如有）
  2. Crowd 伺服器資訊（如有）
  沒有可輸入『跳過』」

## 📊 執行階段 (PHASES)

### Phase 1: 資料模型基礎 [2-3天]
```
任務清單：
□ 產生 organization-data-model.md
□ 建立 migration SQL
□ 建立 Python models
□ 實作基礎 CRUD API
□ 單元測試
```

### Phase 2: 組織管理介面 [2-3天]
```
任務清單：
□ 建立 organization.html
□ 實作左側選單
□ 部門管理功能
□ 角色管理功能
□ 帳號管理功能
```

### Phase 3: 系統模式 [1-2天]
```
任務清單：
□ 系統參數擴充
□ 模式切換邏輯
□ 權限調整
```

### Phase 4: 密碼策略 [2-3天]
```
任務清單：
□ 啟用連結機制
□ 臨時密碼功能
□ LDAP 代理（如需要）
□ 啟用頁面
```

### Phase 5: 資料匯入 [2-3天]
```
任務清單：
□ CSV 上傳介面
□ 欄位映射工具
□ 批次處理邏輯
□ 衝突處理
```

### Phase 6: SSO 整合 [3-4天]
```
任務清單：
□ OAuth 2.0 實作
□ Crowd SSO 實作
□ 自動切換機制
```

### Phase 7: 自動同步 [4-5天]
```
任務清單：
□ 多端點設定
□ 認證管理
□ 同步引擎
□ 排程執行
```

### Phase 8: 審計監控 [2天]
```
任務清單：
□ 審計日誌表
□ 查詢介面
□ 報表功能
```

## 🔄 狀態定義

### 任務狀態
- `NOT_STARTED` - 尚未開始
- `IN_PROGRESS` - 執行中
- `WAITING_USER` - 等待使用者
- `TESTING` - 測試中
- `COMPLETED` - 已完成
- `FAILED` - 失敗（含錯誤訊息）
- `SKIPPED` - 跳過

### 全域狀態
- `ACTIVE` - 自動執行中
- `PAUSED` - 暫停（等待輸入）
- `ERROR` - 錯誤狀態
- `FINISHED` - 全部完成

## 💡 智慧決策規則

### 自動決定事項
1. **檔案命名**：遵循專案慣例
2. **程式碼風格**：複製既有風格
3. **UI 元件**：使用既有元件（Dialog、按鈕等）
4. **錯誤處理**：標準 try-catch 模式
5. **API 路徑**：遵循 RESTful 規範
6. **資料庫名稱**：使用 `rag_db`（不是 `db`）

### 必須詢問事項
1. **外部連線**：LDAP、SMTP、SSO 等
2. **業務邏輯**：權限規則、審批流程
3. **資料處理**：衝突策略、預設值
4. **測試確認**：功能是否正常

## 🚀 快速指令

使用者可用指令：
- `開始組織管理` - 從頭開始執行
- `繼續` - 從斷點繼續
- `測試通過` - 確認測試並繼續
- `跳過` - 跳過當前任務
- `狀態` - 查看當前進度
- `重試` - 重試失敗任務

## 📝 執行日誌格式

```markdown
[時間] [階段] [狀態] 訊息
2025-01-20 10:00 Phase_1 START 開始建立資料模型
2025-01-20 10:05 Phase_1 CREATED organization-data-model.md
2025-01-20 10:10 Phase_1 WAITING 等待資料庫確認
2025-01-20 15:00 Phase_1 COMPLETED 基礎 API 實作完成
2025-01-21 09:00 Phase_2 START 開始實作組織管理介面
2025-01-21 10:30 Phase_2 CREATED organization.html/css/js
2025-01-21 14:00 Phase_2 REFACTOR 改為 Drawer 架構（350px）
2025-01-21 16:00 Phase_2 CREATED 權限矩陣 API
2025-01-21 18:00 Phase_2 ISSUE 新增部門/帳號失敗
2025-01-21 20:00 Phase_2 PAUSED 等待新對話繼續
```

## ⚠️ 錯誤處理

### 常見錯誤處理
1. **檔案已存在**：詢問是否覆蓋
2. **API 路徑衝突**：自動調整路徑
3. **資料庫連線失敗**：提示檢查 Docker
4. **依賴缺失**：自動安裝或提示

### 錯誤恢復策略
```python
try:
    執行任務
except 已知錯誤:
    自動修復
except 未知錯誤:
    記錄錯誤
    詢問使用者
```

## 🎯 成功標準

每個 Phase 完成標準：
1. **程式碼完成**：所有檔案建立
2. **測試通過**：基本功能正常
3. **文件更新**：規格文件對應
4. **整合成功**：與現有系統整合

## 📌 重要提醒

1. **保持向後相容**：不破壞現有功能
2. **遵循設計規範**：使用既定 UI/UX
3. **安全第一**：密碼加密、權限檢查
4. **完整測試**：每個階段都要測試

---

## 🤖 自動啟動程式

```python
def auto_pilot_start():
    """Claude 讀取此文件時自動執行"""
    
    # 1. 讀取狀態
    status = load_status()
    
    # 2. 顯示提示
    if status.phase == "NOT_STARTED":
        print("🚀 檢測到組織管理系統待實作")
        print("輸入『開始組織管理』啟動自動實作")
    elif status.phase == "IN_PROGRESS":
        print(f"📍 當前進度：{status.current_task}")
        print(f"💭 等待：{status.waiting_for}")
    else:
        print("✅ 組織管理系統已完成")
    
    # 3. 等待指令
    wait_for_user_command()
```

---
*此文件是 Claude 的自主執行指南，會根據執行進度自動更新*