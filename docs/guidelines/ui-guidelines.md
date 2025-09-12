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
- **icon**: '統一使用  font awesome'

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

### Modal 完整規範
- **居中顯示**：`.modal-content { margin: 10% auto; }`
- **高度限制**：`.modal-content { max-height: 90vh; overflow: auto; }`
- **響應式調整**：小螢幕（<768px）使用 `margin: 5% auto;`
- **背景遮罩**：`.modal { background-color: rgba(0, 0, 0, 0.5); }`
- **層級管理**：`.modal { z-index: var(--z-modal-backdrop); }`
- **動畫效果**：支援 `fadeIn` 和 `slideUp` 動畫
- **必要元素**：關閉按鈕（.modal-close）、適當的滾動處理

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

### Dialog 元件完整使用規範
- **JavaScript** (`/frontend/static/js/components/dialog.js`)
- **css** (`/frontend/static/css/components/dialog.css`)
  

#### 禁止使用原生對話框
**絕對禁止** 在任何地方使用瀏覽器原生對話框：
```javascript
// ❌ 禁止使用
alert('訊息內容');
confirm('確認嗎？');
prompt('請輸入：');

// ✅ 正確使用
Dialog.error('訊息內容');
Dialog.confirm('確認嗎？', callback);
```

#### 統一訊息通知標準

##### 基本訊息顯示
```javascript
// 成功訊息（綠色圖標）
Dialog.success('操作成功');
Dialog.success('密碼變更成功', '操作成功'); // 自定義標題

// 錯誤訊息（紅色圖標）
Dialog.error('操作失敗');
Dialog.error('密碼變更失敗：密碼長度不足', '操作失敗');

// 警告訊息（黃色圖標）
Dialog.warning('請注意資料格式');
Dialog.warning('此操作不可復原', '注意');

// 資訊訊息（藍色圖標）
Dialog.info('系統維護中');
Dialog.info('您有新的訊息通知', '提示');
```

##### 確認對話框
```javascript
// 基本確認
Dialog.confirm('確認要刪除此項目嗎？', () => {
    // 確認後執行的操作
    deleteItem();
});

// 異步確認（推薦用法）
const confirmed = await Dialog.confirm('確認要執行此操作嗎？');
if (confirmed) {
    await performAction();
}

// 自定義按鈕文字
Dialog.confirm('確認要清空資料庫嗎？', callback, {
    confirmText: '清空',
    cancelText: '保留'
});

// 帶取消回調的確認
Dialog.confirm('確認離開編輯頁面嗎？', 
    () => { window.location.href = '/list'; }, // 確認回調
    {
        onCancel: () => { console.log('使用者選擇繼續編輯'); } // 取消回調
    }
);
```

#### Dialog API 完整說明

##### 基礎方法
- `Dialog.show(message, options)` - 顯示基本訊息
- `Dialog.success(message, title, options)` - 顯示成功訊息
- `Dialog.error(message, title, options)` - 顯示錯誤訊息
- `Dialog.warning(message, title, options)` - 顯示警告訊息
- `Dialog.info(message, title, options)` - 顯示資訊訊息
- `Dialog.confirm(message, onConfirm, options)` - 顯示確認對話框

##### Options 參數
```javascript
{
    title: '自定義標題',        // 覆蓋預設標題
    type: 'success',           // 訊息類型：info, success, warning, error
    confirmText: '確認',       // 確認按鈕文字
    cancelText: '取消',        // 取消按鈕文字
    allowHTML: false,          // 是否允許 HTML（預設 false，保持安全）
    onCancel: callback,        // 取消回調函數
    closeButton: true,         // 是否顯示關閉按鈕
    icon: true                 // 是否顯示圖標
}
```

#### 實作範例

##### 表單驗證錯誤
```javascript
// 驗證失敗
if (!email.includes('@')) {
    Dialog.error('請輸入有效的電子郵件地址', '格式錯誤');
    return;
}
```

##### AJAX 請求處理
```javascript
try {
    const response = await fetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(userData)
    });
    
    if (response.ok) {
        Dialog.success('用戶創建成功');
    } else {
        const error = await response.json();
        Dialog.error(`創建失敗：${error.message}`);
    }
} catch (error) {
    Dialog.error(`網路錯誤：${error.message}`);
}
```

##### 危險操作確認
```javascript
async function deleteUser(userId) {
    const confirmed = await Dialog.confirm(
        '確認要刪除此用戶嗎？此操作不可復原。',
        null,
        {
            confirmText: '刪除',
            cancelText: '保留',
            type: 'error' // 使用錯誤樣式強調危險性
        }
    );
    
    if (confirmed) {
        try {
            await api.deleteUser(userId);
            Dialog.success('用戶已成功刪除');
            refreshUserList();
        } catch (error) {
            Dialog.error(`刪除失敗：${error.message}`);
        }
    }
}
