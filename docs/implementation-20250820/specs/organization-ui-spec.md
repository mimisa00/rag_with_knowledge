# 組織管理 UI 設計規格書

## 1. 概述
本文件定義組織管理系統的使用者介面設計規格，遵循現有系統的 UI/UX 設計風格。

## 2. 設計原則

### 2.1 遵循既有設計系統
- 使用現有 CSS 變數（`--primary`, `--navbar-height` 等）
- 沿用現有元件（Dialog、按鈕、表單樣式）
- 保持一致的佈局結構（導航欄、麵包屑、底部版權）

### 2.2 頁面結構
```
┌─────────────────────────────────────────┐
│          頂部導航欄 (60px)               │
├─────────────────────────────────────────┤
│          麵包屑導航                      │
├────────┬────────────────────────────────┤
│        │                                │
│  左側  │         主要內容區               │
│  抽屜  │                                │
│        │                                │
├────────┴────────────────────────────────┤
│          底部版權資訊                    │
└─────────────────────────────────────────┘
```

## 3. 主頁面設計

### 3.1 組織管理主頁 (`/admin/organization.html`)

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <title>組織管理 - RAG系統</title>
    <!-- 引入現有 CSS -->
    <link rel="stylesheet" href="../css/pages/admin.css">
    <link rel="stylesheet" href="../css/pages/organization.css">
    <link rel="stylesheet" href="../css/components/dialog.css">
</head>
<body class="admin-layout">
    <!-- 頂部導航 -->
    <nav class="navbar">
        <div class="navbar-brand">
            <a href="/admin.html">RAG 知識管理系統</a>
        </div>
        <div class="navbar-info">
            <span class="user-info">
                <i class="fa-solid fa-user"></i>
                <span id="username">管理員</span>
            </span>
        </div>
    </nav>
    
    <!-- 麵包屑 -->
    <div class="breadcrumb">
        <div class="breadcrumb-items">
            <a href="/admin.html" class="breadcrumb-item">首頁</a>
            <span class="breadcrumb-separator">/</span>
            <span class="breadcrumb-item active">組織管理</span>
        </div>
    </div>
    
    <!-- 主要內容區 -->
    <div class="admin-container">
        <!-- 左側抽屜 -->
        <aside class="sidebar" id="orgSidebar">
            <div class="sidebar-header">
                <h3>組織管理</h3>
                <button class="sidebar-toggle" id="sidebarToggle">
                    <i class="fa-solid fa-chevron-left"></i>
                </button>
            </div>
            <nav class="sidebar-menu">
                <a href="#departments" class="menu-item active" data-section="departments">
                    <i class="fa-solid fa-sitemap"></i>
                    <span>部門管理</span>
                </a>
                <a href="#roles" class="menu-item" data-section="roles">
                    <i class="fa-solid fa-user-shield"></i>
                    <span>角色管理</span>
                </a>
                <a href="#users" class="menu-item" data-section="users">
                    <i class="fa-solid fa-users"></i>
                    <span>帳號管理</span>
                </a>
            </nav>
        </aside>
        
        <!-- 右側主內容 -->
        <main class="main-content">
            <!-- 部門管理區塊 -->
            <section id="departments-section" class="content-section active">
                <!-- 內容將由 JavaScript 動態載入 -->
            </section>
            
            <!-- 角色管理區塊 -->
            <section id="roles-section" class="content-section">
                <!-- 內容將由 JavaScript 動態載入 -->
            </section>
            
            <!-- 帳號管理區塊 -->
            <section id="users-section" class="content-section">
                <!-- 內容將由 JavaScript 動態載入 -->
            </section>
        </main>
    </div>
    
    <!-- 底部版權 -->
    <footer class="footer">
        <p>&copy; 2025 RAG Knowledge Management System. All rights reserved.</p>
    </footer>
</body>
</html>
```

### 3.2 CSS 樣式設計

```css
/* organization.css */

/* 使用既有變數 */
.sidebar {
    width: 250px;
    background: white;
    border-right: 1px solid var(--border-color);
    transition: transform 0.3s ease;
}

.sidebar.collapsed {
    transform: translateX(-200px);
}

.sidebar-header {
    padding: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border-color);
}

.sidebar-menu {
    padding: 0.5rem 0;
}

.menu-item {
    display: flex;
    align-items: center;
    padding: 0.75rem 1rem;
    color: var(--text-color);
    text-decoration: none;
    transition: background-color 0.2s;
}

.menu-item:hover {
    background-color: var(--hover-bg);
}

.menu-item.active {
    background-color: var(--primary-light);
    color: var(--primary);
    border-left: 3px solid var(--primary);
}

.menu-item i {
    margin-right: 0.75rem;
    width: 20px;
}

.main-content {
    flex: 1;
    padding: 2rem;
    background: var(--bg-color);
}

.content-section {
    display: none;
}

.content-section.active {
    display: block;
}
```

## 4. 功能模組設計

### 4.1 部門管理介面

```html
<div class="section-header">
    <h2>部門管理</h2>
    <button class="btn btn-primary" id="addDepartmentBtn">
        <i class="fa-solid fa-plus"></i> 新增部門
    </button>
</div>

<div class="section-content">
    <!-- 部門樹狀結構 -->
    <div class="department-tree">
        <div class="tree-container" id="departmentTree">
            <!-- 動態產生的樹狀結構 -->
        </div>
    </div>
    
    <!-- 部門詳情面板 -->
    <div class="department-details" id="departmentDetails">
        <div class="details-card">
            <h3>部門資訊</h3>
            <div class="details-content">
                <!-- 動態載入部門資訊 -->
            </div>
        </div>
    </div>
</div>
```

#### 部門樹狀結構元件
```html
<div class="tree-node" data-dept-id="1">
    <div class="node-content">
        <span class="node-toggle">
            <i class="fa-solid fa-chevron-down"></i>
        </span>
        <span class="node-icon">
            <i class="fa-solid fa-folder"></i>
        </span>
        <span class="node-name">總公司</span>
        <span class="node-count">(150人)</span>
        <div class="node-actions">
            <button class="btn-icon" title="編輯">
                <i class="fa-solid fa-edit"></i>
            </button>
            <button class="btn-icon" title="新增子部門">
                <i class="fa-solid fa-plus"></i>
            </button>
            <button class="btn-icon" title="刪除">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
    </div>
    <div class="tree-children">
        <!-- 子部門節點 -->
    </div>
</div>
```

### 4.2 角色管理介面

```html
<div class="section-header">
    <h2>角色管理</h2>
    <button class="btn btn-primary" id="addRoleBtn">
        <i class="fa-solid fa-plus"></i> 新增角色
    </button>
</div>

<div class="section-content">
    <!-- 角色列表 -->
    <div class="role-list">
        <table class="data-table">
            <thead>
                <tr>
                    <th>角色代碼</th>
                    <th>角色名稱</th>
                    <th>類型</th>
                    <th>使用人數</th>
                    <th>狀態</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody id="roleTableBody">
                <!-- 動態產生 -->
            </tbody>
        </table>
    </div>
    
    <!-- 權限矩陣 -->
    <div class="permission-matrix">
        <h3>權限設定</h3>
        <table class="matrix-table">
            <thead>
                <tr>
                    <th>功能模組</th>
                    <th>檢視</th>
                    <th>新增</th>
                    <th>編輯</th>
                    <th>刪除</th>
                </tr>
            </thead>
            <tbody id="permissionMatrix">
                <!-- 動態產生 -->
            </tbody>
        </table>
    </div>
</div>
```

### 4.3 帳號管理介面

```html
<div class="section-header">
    <h2>帳號管理</h2>
    <div class="header-actions">
        <button class="btn btn-success" id="addUserBtn">
            <i class="fa-solid fa-user-plus"></i> 新增帳號
        </button>
        <button class="btn btn-info" id="importUsersBtn">
            <i class="fa-solid fa-file-import"></i> 批次匯入
        </button>
    </div>
</div>

<div class="section-toolbar">
    <!-- 搜尋區 -->
    <div class="search-box">
        <input type="text" class="form-control" placeholder="搜尋姓名、帳號、Email...">
        <button class="btn btn-search">
            <i class="fa-solid fa-search"></i>
        </button>
    </div>
    
    <!-- 篩選器 -->
    <div class="filters">
        <select class="form-control" id="deptFilter">
            <option value="">所有部門</option>
            <!-- 動態載入 -->
        </select>
        <select class="form-control" id="roleFilter">
            <option value="">所有角色</option>
            <!-- 動態載入 -->
        </select>
        <select class="form-control" id="statusFilter">
            <option value="">所有狀態</option>
            <option value="active">啟用</option>
            <option value="pending">待啟用</option>
            <option value="disabled">停用</option>
        </select>
    </div>
</div>

<div class="section-content">
    <!-- 使用者列表 -->
    <div class="user-list">
        <table class="data-table">
            <thead>
                <tr>
                    <th><input type="checkbox" id="selectAll"></th>
                    <th>帳號</th>
                    <th>姓名</th>
                    <th>Email</th>
                    <th>部門</th>
                    <th>角色</th>
                    <th>認證方式</th>
                    <th>狀態</th>
                    <th>最後登入</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody id="userTableBody">
                <!-- 動態產生 -->
            </tbody>
        </table>
    </div>
    
    <!-- 分頁 -->
    <div class="pagination">
        <button class="btn btn-sm" id="prevPage">上一頁</button>
        <span class="page-info">第 1 頁，共 10 頁</span>
        <button class="btn btn-sm" id="nextPage">下一頁</button>
    </div>
</div>
```

## 5. 模態框設計

### 5.1 新增/編輯部門模態框

```html
<div id="departmentModal" class="modal">
    <div class="modal-content">
        <div class="modal-header">
            <h3>新增部門</h3>
            <button class="modal-close" onclick="closeDepartmentModal()">
                <i class="fa-solid fa-times"></i>
            </button>
        </div>
        <div class="modal-body">
            <form id="departmentForm">
                <div class="form-group">
                    <label class="form-label">部門代碼 <span class="required">*</span></label>
                    <input type="text" class="form-control" name="code" required>
                </div>
                <div class="form-group">
                    <label class="form-label">部門名稱 <span class="required">*</span></label>
                    <input type="text" class="form-control" name="name" required>
                </div>
                <div class="form-group">
                    <label class="form-label">上級部門</label>
                    <select class="form-control" name="parent_id">
                        <option value="">無（根部門）</option>
                        <!-- 動態載入 -->
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">排序順序</label>
                    <input type="number" class="form-control" name="sort_order" value="0">
                </div>
                <div class="form-group">
                    <label class="form-label">
                        <input type="checkbox" name="is_active" checked>
                        啟用此部門
                    </label>
                </div>
            </form>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeDepartmentModal()">取消</button>
            <button class="btn btn-primary" onclick="saveDepartment()">儲存</button>
        </div>
    </div>
</div>
```

### 5.2 新增/編輯角色模態框

```html
<div id="roleModal" class="modal">
    <div class="modal-content modal-lg">
        <div class="modal-header">
            <h3>新增角色</h3>
            <button class="modal-close" onclick="closeRoleModal()">
                <i class="fa-solid fa-times"></i>
            </button>
        </div>
        <div class="modal-body">
            <form id="roleForm">
                <div class="form-row">
                    <div class="form-group col-6">
                        <label class="form-label">角色代碼 <span class="required">*</span></label>
                        <input type="text" class="form-control" name="code" required>
                    </div>
                    <div class="form-group col-6">
                        <label class="form-label">角色名稱 <span class="required">*</span></label>
                        <input type="text" class="form-control" name="name" required>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">角色描述</label>
                    <textarea class="form-control" name="description" rows="3"></textarea>
                </div>
                
                <!-- 權限設定 -->
                <div class="form-group">
                    <label class="form-label">權限設定</label>
                    <div class="permission-grid">
                        <div class="permission-item">
                            <div class="permission-header">
                                <i class="fa-solid fa-book"></i>
                                知識庫管理
                            </div>
                            <div class="permission-actions">
                                <label><input type="checkbox" name="kb_create"> 建立</label>
                                <label><input type="checkbox" name="kb_read"> 檢視</label>
                                <label><input type="checkbox" name="kb_update"> 編輯</label>
                                <label><input type="checkbox" name="kb_delete"> 刪除</label>
                            </div>
                        </div>
                        <!-- 更多權限項目 -->
                    </div>
                </div>
            </form>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeRoleModal()">取消</button>
            <button class="btn btn-primary" onclick="saveRole()">儲存</button>
        </div>
    </div>
</div>
```

### 5.3 新增/編輯使用者模態框

```html
<div id="employeeModal" class="modal">
    <div class="modal-content modal-lg">
        <div class="modal-header">
            <h3>新增使用者</h3>
            <button class="modal-close" onclick="closeEmployeeModal()">
                <i class="fa-solid fa-times"></i>
            </button>
        </div>
        <div class="modal-body">
            <form id="userForm">
                <!-- 基本資訊 -->
                <fieldset>
                    <legend>基本資訊</legend>
                    <div class="form-row">
                        <div class="form-group col-6">
                            <label class="form-label">帳號 <span class="required">*</span></label>
                            <input type="text" class="form-control" name="username" required>
                        </div>
                        <div class="form-group col-6">
                            <label class="form-label">姓名 <span class="required">*</span></label>
                            <input type="text" class="form-control" name="name" required>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group col-6">
                            <label class="form-label">Email <span class="required">*</span></label>
                            <input type="email" class="form-control" name="email" required>
                        </div>
                        <div class="form-group col-6">
                            <label class="form-label">員工編號</label>
                            <input type="text" class="form-control" name="employee_no">
                        </div>
                    </div>
                </fieldset>
                
                <!-- 組織資訊 -->
                <fieldset>
                    <legend>組織資訊</legend>
                    <div class="form-row">
                        <div class="form-group col-6">
                            <label class="form-label">部門 <span class="required">*</span></label>
                            <select class="form-control" name="department_id" required>
                                <option value="">請選擇部門</option>
                                <!-- 動態載入 -->
                            </select>
                        </div>
                        <div class="form-group col-6">
                            <label class="form-label">職稱</label>
                            <input type="text" class="form-control" name="title">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">角色</label>
                        <div class="role-checkboxes">
                            <!-- 動態載入角色選項 -->
                        </div>
                    </div>
                </fieldset>
                
                <!-- 密碼策略 -->
                <fieldset>
                    <legend>密碼設定</legend>
                    <div class="form-group">
                        <label class="form-label">密碼策略</label>
                        <select class="form-control" name="password_strategy">
                            <option value="ACTIVATION_LINK">傳送啟用連結</option>
                            <option value="TEMP_PASSWORD">產生臨時密碼</option>
                            <option value="MANUAL">手動設定密碼</option>
                        </select>
                    </div>
                    <div class="form-group" id="manualPasswordGroup" style="display:none;">
                        <label class="form-label">密碼</label>
                        <input type="password" class="form-control" name="password">
                    </div>
                </fieldset>
            </form>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeUserModal()">取消</button>
            <button class="btn btn-primary" onclick="saveUser()">儲存</button>
        </div>
    </div>
</div>
```

## 6. 批次匯入介面

### 6.1 匯入精靈

```html
<div id="importWizard" class="modal">
    <div class="modal-content modal-xl">
        <div class="modal-header">
            <h3>批次匯入使用者</h3>
            <button class="modal-close" onclick="closeImportWizard()">
                <i class="fa-solid fa-times"></i>
            </button>
        </div>
        <div class="modal-body">
            <!-- 步驟指示器 -->
            <div class="wizard-steps">
                <div class="step active" data-step="1">
                    <span class="step-number">1</span>
                    <span class="step-label">上傳檔案</span>
                </div>
                <div class="step" data-step="2">
                    <span class="step-number">2</span>
                    <span class="step-label">欄位對應</span>
                </div>
                <div class="step" data-step="3">
                    <span class="step-number">3</span>
                    <span class="step-label">預覽確認</span>
                </div>
                <div class="step" data-step="4">
                    <span class="step-number">4</span>
                    <span class="step-label">執行匯入</span>
                </div>
            </div>
            
            <!-- 步驟內容 -->
            <div class="wizard-content">
                <!-- Step 1: 上傳檔案 -->
                <div class="step-content active" data-step="1">
                    <div class="upload-area">
                        <i class="fa-solid fa-cloud-upload-alt"></i>
                        <p>拖曳檔案到此處或點擊選擇檔案</p>
                        <input type="file" id="importFile" accept=".csv,.xlsx,.xls" hidden>
                        <button class="btn btn-primary" onclick="selectFile()">選擇檔案</button>
                    </div>
                    <div class="file-info" style="display:none;">
                        <p>已選擇：<span id="fileName"></span></p>
                        <p>檔案大小：<span id="fileSize"></span></p>
                        <p>資料筆數：<span id="rowCount"></span></p>
                    </div>
                </div>
                
                <!-- Step 2: 欄位對應 -->
                <div class="step-content" data-step="2">
                    <table class="mapping-table">
                        <thead>
                            <tr>
                                <th>來源欄位</th>
                                <th>範例資料</th>
                                <th>對應到</th>
                            </tr>
                        </thead>
                        <tbody id="mappingTableBody">
                            <!-- 動態產生 -->
                        </tbody>
                    </table>
                </div>
                
                <!-- Step 3: 預覽確認 -->
                <div class="step-content" data-step="3">
                    <div class="preview-summary">
                        <p>將匯入 <strong id="importCount">0</strong> 筆資料</p>
                        <p>密碼策略：<strong id="passwordStrategy">傳送啟用連結</strong></p>
                    </div>
                    <table class="preview-table">
                        <thead id="previewHeader">
                            <!-- 動態產生 -->
                        </thead>
                        <tbody id="previewBody">
                            <!-- 動態產生前10筆 -->
                        </tbody>
                    </table>
                </div>
                
                <!-- Step 4: 執行結果 -->
                <div class="step-content" data-step="4">
                    <div class="import-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" id="progressBar"></div>
                        </div>
                        <p class="progress-text">
                            <span id="currentProgress">0</span> / <span id="totalProgress">0</span>
                        </p>
                    </div>
                    <div class="import-result" style="display:none;">
                        <div class="result-summary">
                            <div class="result-item success">
                                <i class="fa-solid fa-check-circle"></i>
                                <span>成功：<strong id="successCount">0</strong></span>
                            </div>
                            <div class="result-item warning">
                                <i class="fa-solid fa-exclamation-triangle"></i>
                                <span>略過：<strong id="skipCount">0</strong></span>
                            </div>
                            <div class="result-item error">
                                <i class="fa-solid fa-times-circle"></i>
                                <span>失敗：<strong id="errorCount">0</strong></span>
                            </div>
                        </div>
                        <div class="error-details" id="errorDetails" style="display:none;">
                            <!-- 錯誤詳情 -->
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" id="wizardPrev" onclick="prevStep()" disabled>上一步</button>
            <button class="btn btn-primary" id="wizardNext" onclick="nextStep()">下一步</button>
            <button class="btn btn-success" id="wizardExecute" onclick="executeImport()" style="display:none;">開始匯入</button>
        </div>
    </div>
</div>
```

## 7. 響應式設計

### 7.1 行動裝置適配
```css
@media (max-width: 768px) {
    .sidebar {
        position: fixed;
        z-index: 1000;
        height: 100%;
        transform: translateX(-100%);
    }
    
    .sidebar.open {
        transform: translateX(0);
    }
    
    .main-content {
        margin-left: 0;
        padding: 1rem;
    }
    
    .data-table {
        font-size: 0.875rem;
    }
    
    .modal-content {
        width: 95%;
        margin: 2.5%;
    }
}
```

## 8. 互動效果

### 8.1 載入動畫
```html
<div class="loading-spinner">
    <div class="spinner"></div>
    <p>載入中...</p>
</div>
```

### 8.2 空白狀態
```html
<div class="empty-state">
    <i class="fa-solid fa-folder-open"></i>
    <h3>尚無部門資料</h3>
    <p>點擊「新增部門」按鈕建立第一個部門</p>
    <button class="btn btn-primary">新增部門</button>
</div>
```

### 8.3 確認對話框
使用現有 Dialog 元件：
```javascript
Dialog.confirm('確定要刪除此部門嗎？刪除後無法復原。', () => {
    // 執行刪除
});
```

## 9. 狀態指示器

### 9.1 使用者狀態標籤
```html
<span class="status-badge status-active">啟用</span>
<span class="status-badge status-pending">待啟用</span>
<span class="status-badge status-disabled">停用</span>
```

### 9.2 認證來源標籤
```html
<span class="auth-badge auth-local">本地</span>
<span class="auth-badge auth-ldap">LDAP</span>
<span class="auth-badge auth-sso">SSO</span>
```

## 10. 實作檢查清單

- [ ] 建立 organization.html 主頁面
- [ ] 建立 organization.css 樣式檔
- [ ] 實作左側選單切換
- [ ] 實作部門樹狀結構元件
- [ ] 實作角色管理介面
- [ ] 實作使用者列表和搜尋
- [ ] 實作所有模態框
- [ ] 實作批次匯入精靈
- [ ] 實作分頁元件
- [ ] 實作載入和空白狀態
- [ ] 響應式設計測試
- [ ] 瀏覽器相容性測試

---
*文件版本：1.0*
*最後更新：2025-01-20*