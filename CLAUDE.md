# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🔄 當前工作狀態
**最後更新**: 2025-01-21 22:30
- **當前分支**: `feature/organization-phase1-complete`
- **最近完成**: Phase 2 - 組織管理介面
  - ✅ Phase 1: 資料模型實作完成
  - ✅ Phase 2: UI 介面與所有 CRUD 功能
  - ✅ 修正所有表單欄位對應問題
  - ✅ 實作完整編輯功能
- **下一步**: Phase 3 - 系統模式設定
- **實作記錄**: 
  - [Phase 1 完成報告](docs/implementation/phase1-complete.md)
  - [Phase 2 測試報告](test_organization_phase2.html)
- **自動執行**: [AUTO_PILOT](docs/AUTO_PILOT.md)

## 🚀 快速開始

### Docker 環境（建議使用）
```bash
# 啟動所有服務
./startup.sh

# 重啟後端（快速測試）
docker restart backend

# 查看日誌
docker compose logs -f

# 停止所有服務
docker compose down
```

### 環境設置
- 複製 `env.example` 到 `.env` 並調整設定值
- 確保 Ollama 在 11434 端口運行
- 必要目錄：`documents/`、`faiss_data/`、`logs/`、`models/`

## 📋 專案概述

**RAG 系統**：使用 Ollama 作為 LLM 後端的檢索增強生成系統

### 核心特點
- **多知識庫架構**：每個知識庫有獨立的 FAISS 索引
- **模組化設計**：API 路由、業務邏輯、資料層清晰分離
- **串流回應**：支援即時的 LLM 生成回應
- **安全隔離**：管理員模組需透過 API 存取

### 技術棧
- **後端**：FastAPI + Python 3.8+
- **LLM**：Ollama（預設 gemma3）
- **向量資料庫**：FAISS
- **資料庫**：MariaDB 10.11
- **文檔處理**：Docling（PDF → Markdown）

## 🎨 UI 設計系統

### 頁面佈局模式

1. **Dashboard 佈局**
   - 用於：`dashboard.html`, `dashboard_admin.html`
   - 結構：左側抽屜（可收合）+ 主內容區
   - 高度：`calc(100vh - 60px)`

2. **Admin 佈局**
   - 適用於：`admin.html` 及 `/admin/*html` 目錄下所有檔案
   - 結構：導航欄 + 麵包屑 + 主內容 + Footer
   - 容器：`.admin-container` 居中對齊
   - **重要**：`<body>` 必須添加 `class="admin-layout"` 以固定高度

3. **Simple 佈局**
   - 用於：`login.html`, `register.html`
   - 結構：單純表單居中顯示

### 核心 UI 規範

#### 導航系統
- **頂部導航**：高度 60px，白色背景
  - 結構：`.navbar` + `.navbar-brand` + `.navbar-info`
- **麵包屑**：導航下方，靠右對齊
  - 結構：`.breadcrumb` > `.breadcrumb-items` > `.breadcrumb-item`
- **使用者資訊**：圓角按鈕（20px），hover 上移效果

#### 設計令牌（Design Tokens）
```css
--primary: #667eea;          /* 品牌主色 */
--primary-dark: #5a67d8;     /* 深主色 */
--secondary: #764ba2;        /* 次要色 */
--navbar-height: 60px;       /* 導航高度 */
--spacing-md: 1rem;          /* 標準間距 */
```

#### 元件使用規範
- **按鈕**：
  - 基礎類別：`.btn` + 顏色類別
  - 顏色類別：`.btn-primary`（主要）、`.btn-danger`（刪除）、`.btn-secondary`（取消）、`.btn-success`（新增）、`.btn-info`（資訊）、`.btn-warning`（警告）
  - 尺寸輔助：`.w-100`（全寬）、`.flex-1`（彈性寬度）
  - 間距：`.me-2`、`.me-3`（右邊距）
- **模態框**：`.modal` + `.modal-content`，使用 `.show` 顯示
- **表單**：`.form-control`（輸入框）、`.form-label`（標籤）

### CSS/JS 編碼規則

#### ✅ 必須遵循
```javascript
// 顯示/隱藏元素
element.classList.add('d-none');      // 隱藏
element.classList.remove('d-none');   // 顯示

// 使用 CSS 變數
color: var(--primary);                // 不用 #667eea
margin: var(--spacing-md);            // 不用 1rem
```

#### ❌ 禁止使用
```javascript
element.style.display = 'none';       // 禁止直接操作 style
element.style.backgroundColor = '#667eea';  // 禁止硬編碼顏色
<div style="margin: 10px">           // 禁止內聯樣式
```

## 📝 新功能開發指引

### 新增管理頁面
**參考範例**：`admin/knowledge-base.html`
1. 複製導航結構（含麵包屑）
2. 使用 `.admin-container` 包裹內容
3. 引入 CSS：
   ```html
   <link rel="stylesheet" href="../css/pages/admin.css">
   <link rel="stylesheet" href="../css/pages/[頁面名稱].css">
   ```
4. 在 `app/config/paths.py` 註冊新路由

### 新增模態框
**參考範例**：標準模態框結構
```html
<div id="myModal" class="modal">
  <div class="modal-content">
    <div class="modal-header">
      <h3>標題</h3>
      <button class="modal-close" onclick="closeModal()">
        <i class="fa-solid fa-times"></i>
      </button>
    </div>
    <div class="modal-body">
      <!-- 內容 -->
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary">取消</button>
      <button class="btn btn-primary">確認</button>
    </div>
  </div>
</div>
```

### 變更密碼 Modal 標準結構
- 必須包含關閉按鈕 `modal-close`
- 輸入框使用 `form-control` class
- 標籤使用 `form-label` class
- 按鈕使用標準 `btn btn-primary` 和 `btn btn-secondary`

### 新增表單頁面
**參考範例**：`login.html`
- 使用 `.form-control` 樣式化輸入框
- 使用 `.btn-primary` 作為提交按鈕
- 表單驗證使用 `.is-valid` / `.is-invalid`

## ⚠️ 關鍵規範

### 安全規則
- **禁止** commit 密碼、token、.env 檔案
- **必須** 使用 JWT 進行身份驗證
- **必須** 對管理員功能進行權限檢查

### 專案特定約定
- 管理員模組在 `/js/admin-modules/`（需 API 存取）
- 新頁面需在 `app/config/paths.py` 的 `get_html_paths()` 註冊
- 檔案上傳限制 10MB，支援 PDF、DOC、DOCX、TXT、MD

### 前端模組架構
- **公共模組** (`/js/modules/`)：所有用戶可存取
- **共用元件** (`/js/components/`)：可重用的 UI 元件
  - Dialog 元件：通用對話框功能
  - 透過 `/js/components/{component_name}` 載入
- **元件樣式** (`/css/components/`)：元件專屬樣式
  - 透過 `/css/components/{component_name}` 載入
- **管理員模組** (`/js/admin-modules/`)：僅管理員透過 API 存取
  - 需要 cookie 認證
  - 透過 `/api/admin/scripts/{script_name}` 載入

### Dialog 元件使用
```javascript
// 顯示訊息
Dialog.show('訊息內容');
Dialog.success('操作成功');
Dialog.error('操作失敗');
Dialog.warning('警告訊息');
Dialog.info('提示訊息');

// 確認對話框
Dialog.confirm('確認要刪除嗎？', () => {
    // 確認後的操作
});
```

## 📚 詳細文件

- **CSS 重構進度與細節**: [docs/css-refactoring-guide.md](docs/css-refactoring-guide.md)
- **API 設計**: 參見 `/app/api/routes/` 目錄
- **資料庫結構**: 參見 `/init-db/` SQL 檔案
- **Docker 設定**: 參見 `docker-compose.yml`

## 🛠️ 測試與調試

```bash
# 測試資料庫連接
docker compose exec backend python test_db_connection.py

# 查看後端日誌
docker compose logs -f backend

# 重建後端容器
docker compose build backend
```

---
*注意：本文件為 Claude Code 的專案指引，保持精簡以減少上下文負擔。詳細資訊請參考對應的專門文件。*