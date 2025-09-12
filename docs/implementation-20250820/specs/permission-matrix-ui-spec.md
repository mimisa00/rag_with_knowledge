# 權限矩陣編輯 UI 規格書

## 1. 概述

權限矩陣編輯介面允許系統管理員定義和修改系統的權限結構，包括模組、操作和權限的對應關係。

## 2. 功能需求

### 2.1 權限矩陣檢視
- 以表格形式顯示所有模組和對應的操作
- 支援展開/收合模組檢視詳細操作
- 顯示每個權限的使用統計（有多少角色使用）

### 2.2 權限編輯功能
- 新增模組
- 新增操作到現有模組
- 編輯模組/操作的名稱和描述
- 刪除未使用的模組/操作
- 重新排序模組和操作

### 2.3 權限匯入/匯出
- 匯出權限矩陣為 JSON 格式
- 從 JSON 檔案匯入權限矩陣
- 版本控制和備份機制

## 3. UI 設計

### 3.1 頁面結構

```
權限矩陣管理
├── 頂部工具列
│   ├── 新增模組按鈕
│   ├── 匯入按鈕
│   ├── 匯出按鈕
│   └── 搜尋框
├── 主要內容區
│   └── 權限矩陣表格
│       ├── 模組列表（左側）
│       └── 操作詳情（右側）
└── 底部操作區
    ├── 儲存變更
    └── 重設

```

### 3.2 權限矩陣表格設計

```html
<div class="permission-matrix-container">
    <!-- 工具列 -->
    <div class="matrix-toolbar">
        <button class="btn btn-primary" onclick="addModule()">
            <i class="fas fa-plus"></i> 新增模組
        </button>
        <button class="btn btn-secondary" onclick="importMatrix()">
            <i class="fas fa-upload"></i> 匯入
        </button>
        <button class="btn btn-secondary" onclick="exportMatrix()">
            <i class="fas fa-download"></i> 匯出
        </button>
        <div class="search-box">
            <input type="text" placeholder="搜尋權限...">
            <i class="fas fa-search"></i>
        </div>
    </div>
    
    <!-- 矩陣表格 -->
    <div class="matrix-grid">
        <div class="module-list">
            <!-- 模組項目 -->
            <div class="module-item" data-module="knowledge_base">
                <div class="module-header">
                    <i class="fas fa-chevron-down toggle-icon"></i>
                    <i class="fas fa-book module-icon"></i>
                    <span class="module-name">知識庫管理</span>
                    <span class="module-count">(5 個操作)</span>
                    <div class="module-actions">
                        <button class="btn-icon" onclick="editModule('knowledge_base')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon" onclick="deleteModule('knowledge_base')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="action-list">
                    <div class="action-item">
                        <span class="action-key">create</span>
                        <span class="action-name">建立</span>
                        <span class="action-desc">建立新知識庫</span>
                        <div class="action-actions">
                            <button class="btn-icon" onclick="editAction('knowledge_base', 'create')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-icon" onclick="deleteAction('knowledge_base', 'create')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <!-- 更多操作項目 -->
                </div>
            </div>
            <!-- 更多模組 -->
        </div>
    </div>
</div>
```

### 3.3 模態框設計

#### 新增/編輯模組模態框
```html
<div id="moduleModal" class="modal">
    <div class="modal-content">
        <div class="modal-header">
            <h3>新增模組</h3>
            <button class="modal-close" onclick="closeModuleModal()">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="modal-body">
            <form id="moduleForm">
                <div class="form-group">
                    <label class="form-label">模組鍵值 <span class="required">*</span></label>
                    <input type="text" class="form-control" name="key" pattern="[a-z_]+" required>
                    <small>只能使用小寫英文字母和底線</small>
                </div>
                <div class="form-group">
                    <label class="form-label">模組名稱 <span class="required">*</span></label>
                    <input type="text" class="form-control" name="name" required>
                </div>
                <div class="form-group">
                    <label class="form-label">模組描述</label>
                    <textarea class="form-control" name="description" rows="3"></textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">圖示類別</label>
                    <select class="form-control" name="icon">
                        <option value="fas fa-book">📚 知識庫</option>
                        <option value="fas fa-file">📄 文件</option>
                        <option value="fas fa-users">👥 使用者</option>
                        <option value="fas fa-sitemap">🏢 組織</option>
                        <option value="fas fa-cog">⚙️ 系統</option>
                        <option value="fas fa-comments">💬 對話</option>
                    </select>
                </div>
            </form>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModuleModal()">取消</button>
            <button class="btn btn-primary" onclick="saveModule()">儲存</button>
        </div>
    </div>
</div>
```

#### 新增/編輯操作模態框
```html
<div id="actionModal" class="modal">
    <div class="modal-content">
        <div class="modal-header">
            <h3>新增操作</h3>
            <button class="modal-close" onclick="closeActionModal()">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="modal-body">
            <form id="actionForm">
                <div class="form-group">
                    <label class="form-label">所屬模組</label>
                    <select class="form-control" name="module_key" disabled>
                        <!-- 動態載入 -->
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">操作鍵值 <span class="required">*</span></label>
                    <input type="text" class="form-control" name="key" pattern="[a-z_]+" required>
                    <small>只能使用小寫英文字母和底線</small>
                </div>
                <div class="form-group">
                    <label class="form-label">操作名稱 <span class="required">*</span></label>
                    <input type="text" class="form-control" name="name" required>
                </div>
                <div class="form-group">
                    <label class="form-label">操作描述</label>
                    <textarea class="form-control" name="description" rows="3"></textarea>
                </div>
            </form>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeActionModal()">取消</button>
            <button class="btn btn-primary" onclick="saveAction()">儲存</button>
        </div>
    </div>
</div>
```

## 4. API 端點

### 4.1 取得權限矩陣
```
GET /api/organization/roles/permissions
```

### 4.2 更新權限矩陣
```
PUT /api/organization/roles/permissions
```

**請求內容：**
```json
{
    "modules": [
        {
            "key": "knowledge_base",
            "name": "知識庫管理",
            "description": "管理知識庫的建立、編輯、刪除等操作",
            "actions": [
                {
                    "key": "create",
                    "name": "建立",
                    "description": "建立新知識庫"
                }
            ]
        }
    ]
}
```

### 4.3 匯出權限矩陣
```
GET /api/organization/roles/permissions/export
```

### 4.4 匯入權限矩陣
```
POST /api/organization/roles/permissions/import
```

## 5. JavaScript 模組設計

```javascript
const PermissionMatrixModule = (function() {
    'use strict';
    
    let matrixData = {
        modules: []
    };
    
    // 載入權限矩陣
    async function loadMatrix() {
        const response = await fetch('/api/organization/roles/permissions');
        matrixData = await response.json();
        renderMatrix();
    }
    
    // 渲染矩陣
    function renderMatrix() {
        const container = document.getElementById('matrixContainer');
        container.innerHTML = matrixData.modules.map(module => 
            renderModule(module)
        ).join('');
    }
    
    // 新增模組
    function addModule() {
        // 顯示新增模組模態框
    }
    
    // 新增操作
    function addAction(moduleKey) {
        // 顯示新增操作模態框
    }
    
    // 儲存變更
    async function saveChanges() {
        const response = await fetch('/api/organization/roles/permissions', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(matrixData)
        });
        
        if (response.ok) {
            Dialog.success('權限矩陣已更新');
        }
    }
    
    // 匯出矩陣
    function exportMatrix() {
        const dataStr = JSON.stringify(matrixData, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = 'permission-matrix.json';
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    }
    
    // 匯入矩陣
    function importMatrix() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            const text = await file.text();
            try {
                matrixData = JSON.parse(text);
                renderMatrix();
                Dialog.success('權限矩陣已匯入');
            } catch (error) {
                Dialog.error('匯入失敗：JSON 格式錯誤');
            }
        };
        input.click();
    }
    
    return {
        init: loadMatrix,
        addModule: addModule,
        addAction: addAction,
        saveChanges: saveChanges,
        exportMatrix: exportMatrix,
        importMatrix: importMatrix
    };
})();
```

## 6. CSS 樣式

```css
/* 權限矩陣容器 */
.permission-matrix-container {
    background: white;
    border-radius: 8px;
    padding: 20px;
}

/* 工具列 */
.matrix-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 2px solid var(--border-color);
}

/* 模組項目 */
.module-item {
    border: 1px solid var(--border-color);
    border-radius: 8px;
    margin-bottom: 10px;
    overflow: hidden;
}

.module-header {
    display: flex;
    align-items: center;
    padding: 15px;
    background: var(--bg-light);
    cursor: pointer;
    transition: background 0.2s;
}

.module-header:hover {
    background: var(--bg-hover);
}

.module-header .toggle-icon {
    margin-right: 10px;
    transition: transform 0.2s;
}

.module-header.collapsed .toggle-icon {
    transform: rotate(-90deg);
}

/* 操作列表 */
.action-list {
    padding: 10px 15px;
    background: white;
}

.action-item {
    display: flex;
    align-items: center;
    padding: 10px;
    border-radius: 4px;
    margin-bottom: 5px;
    transition: background 0.2s;
}

.action-item:hover {
    background: var(--bg-hover);
}

.action-key {
    font-family: monospace;
    font-size: 0.9em;
    color: var(--text-muted);
    min-width: 120px;
}

.action-name {
    font-weight: 500;
    margin: 0 15px;
    min-width: 100px;
}

.action-desc {
    flex: 1;
    color: var(--text-secondary);
}

.action-actions {
    display: none;
}

.action-item:hover .action-actions {
    display: flex;
    gap: 5px;
}
```

## 7. 安全考量

1. **權限檢查**：只有系統管理員可以編輯權限矩陣
2. **版本控制**：每次修改都記錄到審計日誌
3. **備份機制**：修改前自動備份當前設定
4. **驗證規則**：
   - 模組和操作的 key 只能使用小寫英文和底線
   - 不能刪除正在使用的權限
   - 不能修改系統預設權限

## 8. 實作階段

### Phase 1：基礎功能（已完成）
- ✅ 權限矩陣資料結構設計
- ✅ API 端點實作
- ✅ 儲存到 configs 表

### Phase 2：檢視功能
- 權限矩陣顯示介面
- 展開/收合功能
- 搜尋功能

### Phase 3：編輯功能
- 新增/編輯/刪除模組
- 新增/編輯/刪除操作
- 拖放排序

### Phase 4：進階功能
- 匯入/匯出功能
- 版本控制
- 審計日誌整合

---
*最後更新：2025-01-21*
*狀態：規格制定完成，待實作*