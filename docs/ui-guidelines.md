### 頁面佈局準則

1. **Dashboard 佈局**
   - 例如：`dashboard.html`, `dashboard_admin.html`
   - 結構：左側抽屜（可收合）+ 主內容區
   - 高度：`calc(100vh - 60px)`

2. **Admin 佈局**
   - 例如：`admin.html` 及 `/admin/*html` 目錄下所有檔案
   - 結構：導航欄 + 麵包屑 + 主內容 + Footer
   - 容器：`.admin-container` 居中對齊
   - **重要**：`<body>` 必須添加 `class="admin-layout"` 以固定高度

3. **Simple 佈局**
   - 例如：`login.html`, `register.html`
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

#### 必須遵循
```javascript
// 顯示/隱藏元素
element.classList.add('d-none');      // 隱藏
element.classList.remove('d-none');   // 顯示

// 使用 CSS 變數時，需參照 `/css/themes/theme-variables.css` 內的定義
color: var(--primary);                // 不用 #667eea
margin: var(--spacing-md);            // 不用 1rem
```

#### 禁止使用
```javascript
element.style.display = 'none';       // 禁止直接操作 style
element.style.backgroundColor = '#667eea';  // 禁止硬編碼顏色
<div style="margin: 10px">           // 禁止內聯樣式
```

## 新功能開發指引

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

## 關鍵規範

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
  - Scrollbar 元件:通用捲軸特效
  - 透過 `/js/modules/{component_name}` 載入
- **共用元件** (`/js/components/`)：可重用的 UI 元件
  - Dialog 元件：通用對話框功能
  - 透過 `/js/components/{component_name}` 載入
- **元件樣式** (`/css/components/`)：元件專屬樣式
  - 透過 `/css/components/{component_name}` 載入
- **管理員模組** (`/js/admin-modules/`)：僅管理員透過 API 存取
  - 需要 cookie 認證
  - 透過 `/api/admin/scripts/{script_name}` 載入

- **公共模組** (`/js/modules/`)：所有用戶可存取

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