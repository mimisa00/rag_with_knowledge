# CSS 重構指南

## 目標
統一整個網站的 CSS 風格，支援主題切換，提升可維護性。

## 重構進度追蹤

### 階段一：建立核心 CSS 架構
- [x] 建立新分支 feature/css-refactoring
- [x] 創建重構文件
- [x] 創建主題變數系統 theme-variables.css
- [x] 創建基礎樣式 base.css
- [x] 創建共享元件 components.css
- [x] 創建工具類別 utilities.css
- [x] 創建佈局系統 layouts.css
- [x] 創建主題管理器 theme-manager.js
- [x] 創建樣式管理器 style-manager.js

### 階段二：頁面重構（按順序）
- [x] login.html 和相關檔案 (2025-01-14 完成)
- [x] register.html 和相關檔案 (2025-01-14 完成)
- [x] dashboard.html 和相關檔案 (2025-01-14 完成)
- [x] dashboard_admin.html 和相關檔案 (2025-01-14 完成)
- [x] admin.html 和相關檔案 (2025-01-14 第二次重構完成)
- [x] admin/knowledge-base.html 和 knowledge-base.css (2025-01-15 第二階段重構完成)
- [x] admin/system-params.html 和相關檔案 (2025-01-14 麵包屑導航更新)
- [x] admin/user-management.html 和相關檔案 (2025-01-14 麵包屑導航更新)

## 設計系統規範

### 顏色系統
```css
/* 主色調 - 統一使用藍紫漸層 */
--primary: #667eea;
--primary-dark: #5a67d8;
--primary-light: #818cf8;
--secondary: #764ba2;
--secondary-dark: #5e3a81;

/* 中性色 */
--text-primary: #2c3e50;
--text-secondary: #555;
--text-muted: #999;
--bg-white: #ffffff;
--bg-light: #f8f9fa;
--bg-section: #f4f4f4;
--border-color: #dee2e6;

/* 狀態色 */
--success: #27ae60;
--danger: #e74c3c;
--warning: #f39c12;
--info: #3498db;
```

### 間距系統
```css
--spacing-xs: 0.25rem;  /* 4px */
--spacing-sm: 0.5rem;   /* 8px */
--spacing-md: 1rem;     /* 16px */
--spacing-lg: 1.5rem;   /* 24px */
--spacing-xl: 2rem;     /* 32px */
--spacing-xxl: 3rem;    /* 48px */
```

### 圓角系統
```css
--radius-sm: 4px;
--radius-md: 6px;
--radius-lg: 8px;
--radius-xl: 12px;
--radius-full: 50%;
```

### 陰影系統
```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md: 0 2px 10px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 25px rgba(0, 0, 0, 0.15);
```

### 動畫系統
```css
--transition-fast: 0.2s ease;
--transition-normal: 0.3s ease;
--transition-slow: 0.5s ease;
```

### Z-index 層級
```css
--z-base: 0;
--z-dropdown: 100;
--z-drawer: 200;
--z-modal: 300;
--z-loader: 400;
--z-notification: 500;
```

## 重構原則

### CSS 重構
1. **移除硬編碼顏色**：全部改用 CSS 變數
2. **統一間距**：使用標準間距變數
3. **整合重複樣式**：提取到共享元件
4. **命名規範**：使用 BEM 或語義化類名

### JavaScript 重構
1. **移除 style.display**：改用類別切換
2. **提取內聯樣式**：移到 CSS 類別
3. **使用 StyleManager**：統一樣式操作

### HTML 重構
1. **移除內聯 style**：全部移到 CSS
2. **使用語義化類名**：如 .btn-primary 而非 style="background: blue"
3. **統一結構**：相似元件使用相同 HTML 結構

## 檔案修改記錄

### 新增檔案
| 檔案路徑 | 狀態 | 說明 |
|---------|------|------|
| docs/css-refactoring-guide.md | ✅ | 重構指南文件 |
| css/themes/theme-variables.css | ✅ | 主題變數定義 |
| css/core/base.css | ✅ | 基礎樣式 |
| css/core/components.css | ✅ | 共享元件 |
| css/core/utilities.css | ✅ | 工具類別 |
| css/core/layouts.css | ✅ | 佈局系統 |
| js/modules/theme-manager.js | ✅ | 主題管理器 |
| js/modules/style-manager.js | ✅ | 樣式管理器 |

### 修改檔案
| 檔案路徑 | 狀態 | 修改內容 |
|---------|------|----------|
| login.html | ✅ | 更新 CSS 引用，移除內聯樣式 |
| css/login.css | ✅ | 使用 CSS 變數，移除重複樣式 |
| register.html | ✅ | 更新 CSS 引用，移除內聯樣式 |
| css/register.css | ✅ | 使用 CSS 變數，統一表單樣式 |
| dashboard.html | ✅ | 更新 CSS 引用，修復多個功能和樣式問題 |
| css/dashboard.css | ✅ | 全面重構，使用新的 CSS 架構 |
| js/modules/qa-module.js | ✅ | 改善對話記錄點擊體驗，修改 actualprompt 顯示樣式 |
| js/modules/user-menu-module.js | ✅ | 更新 modal 顯示方式 |
| dashboard_admin.html | ✅ | 完成重構 |
| css/dashboard_admin.css | ✅ | 完成重構，管理員特有樣式 |
| admin.html | ✅ | 更新 CSS 引用，移除內聯樣式 |
| css/admin.css | ✅ | 使用新的 CSS 架構，保留管理介面特有樣式 |

## 測試檢查清單

### login.html 測試點
- [x] 頁面正常載入
- [x] 樣式正確顯示
- [x] 表單功能正常
- [x] 錯誤訊息顯示正常
- [x] 響應式佈局正常

### register.html 測試點
- [x] 頁面正常載入
- [x] 樣式正確顯示
- [x] 表單驗證正常
- [x] 成功/錯誤訊息顯示正常
- [x] 響應式佈局正常

### dashboard.html 測試點
- [x] 頁面正常載入
- [x] Drawer 開合功能正常
- [x] Toggle 開關動畫效果正常
- [x] 下拉選單樣式正確（無雙箭頭）
- [x] 使用者資訊懸停特效正常
- [x] 版面高度自適應正常
- [x] 對話記錄點擊反應正常
- [x] 刪除按鈕樣式正確
- [x] 變更密碼 dialog 風格統一
- [x] qa-content 和 qa-input 間距合理
- [x] 對話列表底部項目完全可見
- [x] textarea 切齊左上右邊界
- [x] 送出按鈕保持原本大小

### dashboard_admin.html 測試點
- [x] 頁面正常載入
- [x] 管理員特有功能（promptDrawer）正常
- [x] 三個按鈕水平排列
- [x] 抽屜容器高度正確
- [x] 滾動條自動隱藏顯示
- [x] actualprompt 背景透明無邊框

### admin.html 測試點（待人工測試）
- [ ] 頁面正常載入
- [ ] 樣式正確顯示（使用 CSS 變數）
- [ ] 功能卡片懸停效果正常
- [ ] 用戶選單抽屜正常開合
- [ ] 響應式佈局正常
- [ ] 導航功能正常

## 中斷恢復指引

如果重構過程中斷，請：
1. 查看本文件的進度追蹤
2. 確認當前分支是 feature/css-refactoring
3. 從最後完成的步驟繼續
4. 參考檔案修改記錄確認已完成的修改

## 注意事項

1. **主題切換**：所有顏色必須使用 CSS 變數
2. **向後相容**：確保不破壞現有功能
3. **逐步測試**：每個頁面完成後立即測試
4. **保持一致**：使用統一的命名和結構

## 常見樣式對應表

### 顯示/隱藏
| 舊寫法 | 新寫法 |
|--------|--------|
| `element.style.display = 'none'` | `element.classList.add('d-none')` |
| `element.style.display = 'block'` | `element.classList.remove('d-none')` |
| `element.style.display = 'flex'` | `element.classList.add('d-flex')` |

### 顏色
| 舊寫法 | 新寫法 |
|--------|--------|
| `color: #667eea` | `color: var(--primary)` |
| `background: #f8f9fa` | `background: var(--bg-light)` |
| `color: #e74c3c` | `color: var(--danger)` |

### 間距
| 舊寫法 | 新寫法 |
|--------|--------|
| `margin: 10px` | `margin: var(--spacing-sm)` |
| `padding: 1rem` | `padding: var(--spacing-md)` |
| `gap: 2rem` | `gap: var(--spacing-xl)` |

## Dashboard.html 修復記錄

### 初始問題清單（已全部修復）
1. ✅ **showDrawerContent 功能異常** - drawer 不會正確開合
2. ✅ **開關動畫特效消失** - 名詞分析和推理的 toggle 開關缺少過渡效果
3. ✅ **選單雙箭頭** - 知識庫下拉選單顯示兩個向下箭頭
4. ✅ **使用者資訊懸停特效消失** - 頂端導航欄的 user-info 元素
5. ✅ **版面高度問題** - answer 區域內容增加時，qa-input 區塊會被擠出畫面

### 額外修復問題（2025-01-14）
6. ✅ **對話記錄點擊體驗** - 改為整個列表項目可點擊，刪除按鈕防止事件冒泡
7. ✅ **刪除按鈕樣式** - 修復 icon 外框問題，添加固定寬高和 flex 佈局
8. ✅ **變更密碼 dialog** - 使用新的 modal 樣式系統，添加 form-control class
9. ✅ **qa-content 間距** - 調整 max-height 從 200px 改為 140px，拉近與 qa-input 的距離
10. ✅ **名詞分析和推理區塊顯示問題** - 修復內容排版問題（詳見下方）

### 具體修復方案

#### 1. 修復 drawer 開合問題
在 `dashboard.css` 中添加：
```css
/* drawer-open 狀態 */
#drawerContainer.drawer-open {
    width: 300px; /* 保持展開寬度 */
}

#drawerContainer.drawer-open #drawerContent {
    opacity: 1;
    pointer-events: auto;
}

/* 修正 drawer-closed 行為 */
#drawerContainer.drawer-closed #drawerToggleButtons {
    width: 50px;
}
```

#### 2. 恢復開關動畫特效
在 `dashboard.css` 中添加：
```css
/* Toggle 開關動畫 */
.fa-toggle-on,
.fa-toggle-off {
    transition: all var(--transition-fast);
    cursor: pointer;
}

.fa-toggle-on:hover,
.fa-toggle-off:hover {
    transform: scale(1.1);
}

/* 開關時的旋轉效果 */
.fa-toggle-off {
    transform: rotate(0deg);
}

.fa-toggle-on {
    transform: rotate(360deg);
}
```

#### 3. 修復選單雙箭頭
在 `components.css` 的 `select.form-control` 中添加：
```css
select.form-control {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    /* 保留其他樣式 */
}
```

#### 4. 恢復使用者資訊懸停特效
確認 `dashboard.css` 或 `components.css` 中有：
```css
.user-info {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: var(--bg-light);
    border-radius: 20px;
    cursor: pointer;
    transition: all var(--transition-normal);
}

.user-info:hover {
    background: var(--bg-hover);
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
}
```

#### 5. 修復版面高度問題
在 `dashboard.css` 中修改：
```css
.dashboard-layout {
    display: flex;
    gap: var(--spacing-xs);
    height: calc(100vh - var(--navbar-height));
    overflow: hidden;
}

.dashboard-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
    height: 100%;
}

.qa-layout {
    flex: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
}

.qa-content {
    flex: 1;
    padding: var(--spacing-md);
    background: var(--bg-section);
    border: 1px solid var(--border-color);
    overflow-y: auto;
    margin: var(--spacing-xs);
    min-height: 0;
    max-height: calc(100% - 200px); /* 確保不會無限增長 */
}

.qa-input {
    flex-shrink: 0;
    padding: var(--spacing-md);
    min-height: 120px; /* 確保輸入區域不會消失 */
}
```

#### 6. 修復名詞分析和推理區塊顯示問題（2025-01-14）

**問題描述**：
- 開啟名詞分析或推理功能後，區塊內容會向右無限延伸而不換行
- 關閉狀態時文字垂直排列且顯示不清楚
- 內容超出時沒有正確的滾動條

**問題根源分析**：
1. HTML 使用 `class="flex-1"`（等於 `flex: 1 1 0%`）
2. CSS 覆蓋設定衝突：
   - 初始嘗試使用 `flex: 1 1 auto`，`auto` 導致容器嘗試容納所有內容的原始寬度
   - 缺少 `display: block` 明確設定，導致內容排版異常
3. 父容器 `d-flex` 影響子元素的排列方式

**最終解決方案**：
```css
#nounAnalysis,
#thinkResponse {
    /* 明確設定為塊級元素，確保內容垂直排列 */
    display: block !important;
    
    /* Flex 設定 - 關鍵修正：使用 0% 而非 auto */
    flex: 1 1 0% !important;    /* 與 flex-1 class 一致，基礎寬度為 0 */
    min-width: 0;               /* 關鍵：允許 flex 項目縮小到比內容更小 */
    
    /* 高度控制 */
    max-height: 100px;
    min-height: 30px;
    
    /* 溢出處理 */
    overflow-y: auto;           /* 垂直滾動 */
    overflow-x: hidden;         /* 防止水平滾動 */
    scrollbar-width: none;      /* Firefox 隱藏滾動條 */
    
    /* 文字換行 */
    word-wrap: break-word;
    overflow-wrap: break-word;
    white-space: normal;        /* 確保正常換行 */
    
    /* 樣式 */
    padding: 0.5em;
    background: #f4f4f4;
    border-radius: 8px;
    box-sizing: border-box;
    color: var(--text-primary);
    line-height: 1.5;
}
```

**關鍵修復點**：
- `display: block !important` - 確保內容垂直排列
- `flex: 1 1 0%` 而非 `auto` - 基礎寬度為 0，完全依賴 flex-grow
- `min-width: 0` - 允許元素縮小，防止內容撐開容器

## Dashboard_admin.html 重構記錄（2025-01-14 完成）

### 主要修改內容
1. **抽屜系統優化**
   - 修復 drawerContainer 高度問題：使用固定高度 `calc(100vh - var(--navbar-height, 60px))`
   - 調整 drawerContent 的 max-height 為更合理的值
   - 修復 memoryDrawer 和 promptDrawer 混淆問題
   
2. **滾動條改進**
   - 實現自動隱藏滾動條（hover 時顯示）
   - 對話列表和 actualprompt 都使用相同風格
   
3. **按鈕排列調整**
   - drawerToggleButtons 改為水平排列
   - 管理員版本容器寬度調整為 120px 以容納三個按鈕
   
4. **樣式優化**
   - actualprompt 移除邊框，使用透明背景
   - answer 區域移除邊框
   - textarea 切齊左上右邊界
   - 送出按鈕保持原本大小並左對齊

## 下一步執行計畫

### 重構順序（按優先級）
1. ✅ ~~dashboard.html 修復與重構~~ (2025-01-14 完成)
2. ✅ ~~dashboard_admin.html 修復與重構~~ (2025-01-14 完成)
3. ✅ ~~admin.html - 新版管理介面~~ (2025-01-14 完成)
4. ✅ ~~admin/knowledge-base.html - 知識庫管理頁~~ (2025-01-15 CSS 進行中)
5. admin/system-params.html - 系統參數頁（下一個目標）
6. admin/user-management.html - 使用者管理頁

### 注意事項（給 compact 後的自己）
1. 當前分支：`feature/css-refactoring`
2. 已建立完整的 CSS 架構在 `/css/core/` 和 `/css/themes/`
3. dashboard.html, dashboard_admin.html, admin.html 已完成並測試通過，可作為參考範例
4. 每個頁面重構後都需要使用者手動測試
5. 重構時記得更新此文件的進度
6. 測試時使用 `docker restart backend` 重啟服務

## admin.html 重構記錄（2025-01-14 部分完成）

### 第一階段修改（已完成）
1. **CSS 架構整合**
   - 引入新的 CSS 架構（theme-variables.css, base.css, components.css, utilities.css, layouts.css）
   - 使用 CSS 變數替換所有硬編碼顏色
   - 保留 admin 特有樣式（功能卡片、管理導航欄）

2. **樣式優化**
   - 統一使用變數系統（顏色、間距、圓角、陰影、動畫）
   - 移除重複的元件樣式
   - 改善響應式設計

3. **HTML 清理**
   - 移除內聯 style 屬性（改用 .hidden class）
   - 保持語義化的類名結構

### 第二階段修改（2025-01-14 - 重複樣式清理）

#### 重複定義清理成果
- **檔案大小**：從 365 行減少到 291 行（減少 74 行，約 20%）
- **移除的重複定義**：
  - `.admin-navbar` 基礎結構（與 layouts.css:170-179 重複）
  - `.admin-main` 和 `.admin-container`（與 layouts.css:181-194 重複）
  - `.admin-footer`（與 layouts.css:196-201 重複）
  - `.function-grid`（與 layouts.css:275-280 重複）
  - `.function-card` 基礎樣式（與 layouts.css:282-298 重複）
  - `.navbar-brand` 和相關樣式（與 components.css:505-513 重複）
  - 模態框和載入器樣式（與 components.css 重複）

#### 主題系統設計決策
1. **移除硬編碼漸層背景**
   - 原本：`body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }`
   - 改為：使用主題系統變數，支援主題切換
   
2. **管理頁面標識方式**
   - 不使用固定配色區分
   - 改用頂部 3px 主題色邊框作為管理頁面標識
   - 保持與整體主題系統的一致性

3. **顏色變數補充**
   - 添加缺失的 `--gray-500`、`--gray-600`、`--gray-700` 變數
   - 為淺色和深色主題都提供對應值

#### 保留的覆蓋樣式原則
只保留真正需要的特定樣式：
- 管理頁面的識別性元素（如頂部色條）
- 特定功能的視覺強調（如歡迎區塊漸層）
- 不同於一般頁面的互動效果

### 待完成事項（compact 後繼續）
- [ ] 進一步優化響應式設計
- [ ] 測試主題切換功能
- [ ] 確認所有功能正常運作
- [ ] 處理其他管理子頁面的樣式統一

---

## 重複樣式清理原則（重要）

### 必須移除的重複定義
1. **layouts.css 已定義的佈局類**
   - `.admin-navbar`、`.admin-main`、`.admin-container`、`.admin-footer`
   - `.function-grid`、`.function-card`
   - 各種佈局容器和網格系統

2. **components.css 已定義的元件類**
   - `.navbar`、`.navbar-brand`、`.navbar-nav`
   - `.modal`、`.modal-content`、`.modal-header` 等
   - `.loader`、`.loader-overlay`
   - `.btn` 系列按鈕樣式

3. **base.css 已定義的基礎樣式**
   - `body`、`h1-h6`、`p` 等基礎元素
   - 表格、列表、連結的預設樣式

### 判斷是否需要覆蓋的原則
1. **需要覆蓋的情況**：
   - 頁面有特殊的視覺需求（如管理頁面標識）
   - 需要不同於預設的配色或尺寸
   - 特定的互動效果或動畫

2. **不應覆蓋的情況**：
   - 只是重複定義相同的樣式
   - 可以通過組合 utility classes 達成
   - 破壞主題系統一致性的硬編碼顏色

### 清理步驟
1. 識別重複定義（對比 core CSS 檔案）
2. 判斷是否真的需要覆蓋
3. 移除不必要的重複
4. 保留並優化必要的覆蓋
5. 測試功能是否正常

---

## knowledge-base.html 第三階段修改（2025-01-15 - 完成）

### 已完成項目
1. [x] 版面高度固定（添加 admin-layout class）
2. [x] 添加 Footer 公司標識
3. [x] 統一變更密碼 Modal 樣式
4. [x] 按鈕風格統一（改用標準 btn 類別）
5. [x] alert 改用 Dialog 呈現（覆蓋原生 alert）
6. [x] 統一現有 Dialog 樣式（添加關閉按鈕）
7. [x] Dialog/Modal 完全視覺統一

### 主要改動
- **版面高度**：body 添加 `admin-layout` class
- **Footer**：添加與 admin.html 相同的公司標識
- **Modal 統一**：
  - 所有 Modal 都有關閉按鈕
  - 變更密碼使用 form-control 和 form-label
  - 移除藍色 header，統一使用灰色背景
- **按鈕系統**：
  - 移除所有 btn-kb-* 自定義類別
  - 改用標準 btn btn-primary/secondary/success/danger/info/warning
  - 統一 hover 特效
- **Dialog 系統完整實施**：
  - 新增獨立的 dialog.css 和 dialog.js 元件
  - 實現完整的 Dialog API (show, success, error, warning, info, confirm)
  - 背景模糊效果 (backdrop-filter: blur(5px))
  - 關閉按鈕無邊框，大小與 Modal 一致
  - 標題使用瀏覽器預設 h3 大小

---

## admin.html 第三階段修改（2025-01-14 - 導航系統優化）

### 麵包屑導航實施
1. **新增通用麵包屑導航元件**
   - 在 `layouts.css` 添加完整的麵包屑樣式系統
   - 支援多層級導航結構
   - 麵包屑統一靠右對齊 (`justify-content: flex-end`)

2. **移除返回按鈕**
   - 從所有管理頁面移除突兀的返回按鈕
   - 統一使用麵包屑導航替代
   - 導航欄更簡潔，只保留品牌和使用者資訊

3. **頁面高度優化**
   - `admin-layout` 設定為 100vh 固定高度
   - 主內容區域可滾動 (`overflow-y: auto`)
   - Footer 固定在底部不隨滾動
   - 調整各元素間距，確保內容適配視窗

### 已更新頁面
- ✅ admin.html - 新增麵包屑：首頁 > 系統管理中心
- ✅ knowledge-base.html - 新增麵包屑：首頁 > 系統管理中心 > 知識庫管理
- ✅ system-params.html - 新增麵包屑：首頁 > 系統管理中心 > 系統參數管理
- ✅ user-management.html - 新增麵包屑：首頁 > 系統管理中心 > 帳號管理

### 導航欄問題修復
1. **水平排列修復**
   - 在 `layouts.css` 添加 `.navbar-info` 完整定義
   - 設定 `display: flex` 和 `align-items: center`
   - 從 `admin.css` 移除不完整的定義

### 關鍵設計決策
- 採用麵包屑導航而非按鈕，提供更清晰的層級關係
- 麵包屑可重複使用於未來其他需要多層導航的頁面
- 統一靠右對齊，保持視覺一致性

---

## knowledge-base.html 重構記錄（2025-01-15 完成）

### 第一階段修改（CSS 檔案重構）
1. **CSS 重構成果**
   - 檔案大小：從 409 行減少到 241 行（減少 168 行，約 41%）
   - 移除所有重複定義（基礎樣式、表單元素、按鈕、模態框等）
   - 全面改用 CSS 變數系統
   - 保留知識庫特有樣式（分割條、檔案列表、索引摘要、載入覆蓋層）

### 第二階段修改（移除內聯樣式）
1. **HTML 重構成果**
   - **內聯樣式數量**：從 103 個減少到 0 個（100% 移除）
   - 新增 70+ 個語義化 CSS 類別
   - 統一使用工具類別（d-none、mb-sm、flex-1 等）

2. **新增的主要 CSS 類別**
   - **空狀態類別**：kb-empty-state、kb-empty-icon、kb-empty-title 等
   - **佈局類別**：kb-selected-layout、kb-management-panel、kb-file-panel 等
   - **按鈕類別**：btn-kb-primary、btn-kb-danger、btn-kb-info 等
   - **表單類別**：kb-label、kb-input、kb-select、kb-textarea 等
   - **模態框類別**：modal-content-md、modal-header-blue、modal-file-list 等

3. **優化重點**
   - 使用 CSS 變數替代所有硬編碼顏色
   - 統一使用間距和圓角變數
   - 保持與其他已重構頁面的一致性
   - 改善響應式設計

### 測試檢查清單
- [ ] 頁面正常載入
- [ ] 知識庫建立、編輯、刪除功能正常
- [ ] 檔案上傳功能正常
- [ ] 索引建立功能正常
- [ ] 模態框顯示正常
- [ ] 響應式佈局正常
- [ ] 分割條拖動功能正常

---

最後更新時間：2025-01-15
當前狀態：knowledge-base.html CSS 重構完成，待測試驗證