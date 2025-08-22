# 資料匯入規格書

## 1. 概述
本文件定義資料匯入功能的設計規格，包含手動匯入、欄位映射、批次處理等功能。

## 2. 匯入類型

### 2.1 手動檔案匯入
支援 CSV、Excel 檔案上傳匯入。

**支援格式：**
- CSV (.csv)
- Excel 2007+ (.xlsx)
- Excel 97-2003 (.xls)
- Tab 分隔檔 (.tsv)

**檔案限制：**
- 最大檔案大小：10MB
- 最大資料筆數：10,000
- 編碼支援：UTF-8、Big5、GBK

### 2.2 API 同步
從外部 API 取得資料。

**支援協定：**
- REST API (JSON/XML)
- SOAP Web Service
- GraphQL

### 2.3 資料庫直連
直接從外部資料庫查詢。

**支援資料庫：**
- MySQL/MariaDB
- PostgreSQL
- Oracle
- SQL Server
- MongoDB

## 3. 匯入流程設計

### 3.1 匯入精靈流程
```
1. 上傳檔案 → 2. 解析預覽 → 3. 欄位映射 → 4. 資料驗證 → 5. 執行匯入 → 6. 結果報告
```

### 3.2 檔案解析
```python
class FileParser:
    """檔案解析器"""
    
    def parse(self, file_path, file_type=None):
        """解析檔案"""
        if not file_type:
            file_type = self.detect_file_type(file_path)
        
        if file_type == 'csv':
            return self.parse_csv(file_path)
        elif file_type in ['xlsx', 'xls']:
            return self.parse_excel(file_path)
        elif file_type == 'json':
            return self.parse_json(file_path)
        else:
            raise ValueError(f"Unsupported file type: {file_type}")
    
    def parse_csv(self, file_path):
        """解析 CSV 檔案"""
        import pandas as pd
        
        # 自動偵測編碼
        encoding = self.detect_encoding(file_path)
        
        # 讀取 CSV
        df = pd.read_csv(
            file_path,
            encoding=encoding,
            error_bad_lines=False,
            warn_bad_lines=True
        )
        
        return {
            'headers': df.columns.tolist(),
            'data': df.to_dict('records'),
            'row_count': len(df),
            'encoding': encoding
        }
    
    def detect_encoding(self, file_path):
        """偵測檔案編碼"""
        import chardet
        
        with open(file_path, 'rb') as f:
            result = chardet.detect(f.read(10000))
        
        return result['encoding'] or 'utf-8'
```

## 4. 欄位映射機制

### 4.1 智慧欄位建議
```python
class FieldMapper:
    """欄位映射器"""
    
    # 常見欄位別名對應
    FIELD_ALIASES = {
        'username': ['user_id', 'account', 'login', '帳號', '使用者名稱'],
        'name': ['full_name', 'display_name', '姓名', '名稱'],
        'email': ['mail', 'e_mail', 'email_address', '電子郵件'],
        'department': ['dept', 'dept_name', 'organization', '部門'],
        'employee_no': ['emp_no', 'staff_id', 'employee_id', '員工編號'],
        'title': ['position', 'job_title', 'role', '職稱', '職位']
    }
    
    def suggest_mapping(self, source_columns):
        """建議欄位對應"""
        suggestions = {}
        
        for col in source_columns:
            col_lower = col.lower().strip()
            
            # 完全匹配
            for target, aliases in self.FIELD_ALIASES.items():
                if col_lower == target:
                    suggestions[col] = target
                    break
                    
                # 別名匹配
                if col_lower in [a.lower() for a in aliases]:
                    suggestions[col] = target
                    break
            
            # 相似度匹配
            if col not in suggestions:
                match = self.fuzzy_match(col_lower)
                if match:
                    suggestions[col] = match
        
        return suggestions
    
    def fuzzy_match(self, column_name, threshold=0.8):
        """模糊匹配"""
        from difflib import SequenceMatcher
        
        best_match = None
        best_score = 0
        
        for target in self.FIELD_ALIASES.keys():
            score = SequenceMatcher(None, column_name, target).ratio()
            if score > best_score and score >= threshold:
                best_score = score
                best_match = target
        
        return best_match
```

### 4.2 欄位映射設定
```json
{
  "mapping_config": {
    "source_type": "csv",
    "mappings": [
      {
        "source": "員工編號",
        "target": "employee_no",
        "required": true,
        "unique": true
      },
      {
        "source": "姓名",
        "target": "name",
        "required": true,
        "transform": "trim"
      },
      {
        "source": "Email",
        "target": "email",
        "required": true,
        "validator": "email",
        "transform": "lowercase"
      },
      {
        "source": "部門代碼",
        "target": "department_code",
        "required": false,
        "default": "DEFAULT"
      }
    ],
    "options": {
      "skip_empty_rows": true,
      "trim_values": true,
      "date_format": "YYYY-MM-DD"
    }
  }
}
```

## 5. 資料驗證

### 5.1 驗證規則
```python
class DataValidator:
    """資料驗證器"""
    
    def validate_batch(self, data, rules):
        """批次驗證資料"""
        results = []
        
        for row_num, row in enumerate(data, 1):
            errors = []
            warnings = []
            
            for field, field_rules in rules.items():
                value = row.get(field)
                
                # 必填檢查
                if field_rules.get('required') and not value:
                    errors.append(f"{field} 為必填欄位")
                
                # 唯一性檢查
                if field_rules.get('unique'):
                    if self.check_duplicate(field, value):
                        errors.append(f"{field} 值重複：{value}")
                
                # 格式驗證
                if value and field_rules.get('validator'):
                    if not self.validate_format(value, field_rules['validator']):
                        errors.append(f"{field} 格式錯誤：{value}")
                
                # 長度檢查
                if value and field_rules.get('max_length'):
                    if len(str(value)) > field_rules['max_length']:
                        warnings.append(f"{field} 超過最大長度")
            
            results.append({
                'row': row_num,
                'data': row,
                'valid': len(errors) == 0,
                'errors': errors,
                'warnings': warnings
            })
        
        return results
    
    def validate_format(self, value, validator_type):
        """格式驗證"""
        validators = {
            'email': lambda v: '@' in v and '.' in v.split('@')[1],
            'phone': lambda v: re.match(r'^[\d\-\+\(\)]+$', v),
            'date': lambda v: self.validate_date(v),
            'number': lambda v: str(v).isdigit()
        }
        
        validator = validators.get(validator_type)
        return validator(value) if validator else True
```

### 5.2 衝突處理策略
```python
class ConflictResolver:
    """衝突處理器"""
    
    STRATEGIES = {
        'SKIP': '跳過衝突資料',
        'UPDATE': '更新既有資料',
        'CREATE_NEW': '建立新資料',
        'MERGE': '合併資料',
        'ASK': '詢問使用者'
    }
    
    def resolve(self, existing_data, new_data, strategy='UPDATE'):
        """處理資料衝突"""
        
        if strategy == 'SKIP':
            return None
        
        elif strategy == 'UPDATE':
            # 更新既有資料
            for key, value in new_data.items():
                if value is not None:
                    existing_data[key] = value
            return existing_data
        
        elif strategy == 'CREATE_NEW':
            # 建立新資料（例如加上後綴）
            new_data['username'] = f"{new_data['username']}_new"
            return new_data
        
        elif strategy == 'MERGE':
            # 合併資料（保留非空值）
            merged = existing_data.copy()
            for key, value in new_data.items():
                if value and not merged.get(key):
                    merged[key] = value
            return merged
        
        elif strategy == 'ASK':
            # 標記需要人工處理
            return {
                'action_required': 'manual_review',
                'existing': existing_data,
                'new': new_data
            }
```

## 6. 批次處理

### 6.1 批次匯入處理器
```python
class BatchImporter:
    """批次匯入處理器"""
    
    def __init__(self, batch_size=100):
        self.batch_size = batch_size
        self.progress_callback = None
    
    def import_data(self, data, import_config):
        """執行批次匯入"""
        total = len(data)
        results = {
            'total': total,
            'success': 0,
            'failed': 0,
            'skipped': 0,
            'errors': []
        }
        
        # 分批處理
        for i in range(0, total, self.batch_size):
            batch = data[i:i + self.batch_size]
            
            try:
                batch_result = self.process_batch(batch, import_config)
                results['success'] += batch_result['success']
                results['failed'] += batch_result['failed']
                results['skipped'] += batch_result['skipped']
                
                # 更新進度
                if self.progress_callback:
                    progress = min(i + self.batch_size, total)
                    self.progress_callback(progress, total)
                
            except Exception as e:
                results['errors'].append({
                    'batch': i // self.batch_size + 1,
                    'error': str(e)
                })
        
        return results
    
    def process_batch(self, batch, config):
        """處理單一批次"""
        batch_result = {
            'success': 0,
            'failed': 0,
            'skipped': 0,
            'details': []
        }
        
        with db.session.begin_nested():
            for row in batch:
                try:
                    result = self.process_row(row, config)
                    
                    if result['status'] == 'success':
                        batch_result['success'] += 1
                    elif result['status'] == 'skipped':
                        batch_result['skipped'] += 1
                    else:
                        batch_result['failed'] += 1
                    
                    batch_result['details'].append(result)
                    
                except Exception as e:
                    batch_result['failed'] += 1
                    batch_result['details'].append({
                        'status': 'error',
                        'error': str(e),
                        'data': row
                    })
        
        return batch_result
```

### 6.2 交易管理
```python
class TransactionalImporter:
    """交易式匯入器"""
    
    def import_with_transaction(self, data, rollback_on_error=True):
        """使用交易匯入"""
        
        try:
            with db.session.begin():
                # 執行所有匯入操作
                for item in data:
                    self.import_item(item)
                
                # 提交交易
                db.session.commit()
                return {'success': True, 'count': len(data)}
                
        except Exception as e:
            if rollback_on_error:
                # 回滾所有變更
                db.session.rollback()
                return {'success': False, 'error': str(e)}
            else:
                # 部分提交
                return self.partial_commit(data)
    
    def partial_commit(self, data):
        """部分提交（跳過錯誤）"""
        success_count = 0
        error_items = []
        
        for item in data:
            try:
                with db.session.begin_nested():
                    self.import_item(item)
                    success_count += 1
            except Exception as e:
                error_items.append({
                    'item': item,
                    'error': str(e)
                })
        
        db.session.commit()
        
        return {
            'success': True,
            'partial': True,
            'success_count': success_count,
            'errors': error_items
        }
```

## 7. 匯入設定介面

### 7.1 檔案上傳介面
```html
<div class="import-wizard">
    <div class="wizard-header">
        <h2>資料匯入精靈</h2>
    </div>
    
    <!-- Step 1: 檔案上傳 -->
    <div class="wizard-step" data-step="upload">
        <h3>步驟 1：選擇匯入檔案</h3>
        
        <div class="upload-zone" id="dropZone">
            <i class="fa-solid fa-cloud-upload-alt fa-3x"></i>
            <p>拖曳檔案到此處或點擊選擇</p>
            <input type="file" id="fileInput" 
                   accept=".csv,.xlsx,.xls" hidden>
            <button class="btn btn-primary" onclick="selectFile()">
                選擇檔案
            </button>
        </div>
        
        <div class="file-info" id="fileInfo" style="display:none;">
            <h4>檔案資訊</h4>
            <dl>
                <dt>檔案名稱：</dt>
                <dd id="fileName"></dd>
                <dt>檔案大小：</dt>
                <dd id="fileSize"></dd>
                <dt>檔案類型：</dt>
                <dd id="fileType"></dd>
            </dl>
        </div>
        
        <div class="import-options">
            <h4>匯入選項</h4>
            <div class="form-group">
                <label>匯入類型</label>
                <select class="form-control" id="importType">
                    <option value="users">使用者資料</option>
                    <option value="departments">部門資料</option>
                </select>
            </div>
            
            <div class="form-group">
                <label>
                    <input type="checkbox" id="hasHeader" checked>
                    第一列為標題列
                </label>
            </div>
        </div>
    </div>
    
    <!-- Step 2: 欄位映射 -->
    <div class="wizard-step" data-step="mapping" style="display:none;">
        <h3>步驟 2：欄位對應</h3>
        
        <div class="mapping-intro">
            <p>請將來源欄位對應到系統欄位</p>
            <button class="btn btn-sm btn-info" onclick="autoMap()">
                <i class="fa-solid fa-magic"></i> 自動對應
            </button>
        </div>
        
        <table class="mapping-table">
            <thead>
                <tr>
                    <th>來源欄位</th>
                    <th>範例資料</th>
                    <th>→</th>
                    <th>系統欄位</th>
                    <th>必填</th>
                </tr>
            </thead>
            <tbody id="mappingTableBody">
                <!-- 動態產生 -->
            </tbody>
        </table>
        
        <div class="unmapped-warning" id="unmappedWarning" style="display:none;">
            <i class="fa-solid fa-exclamation-triangle"></i>
            <span>有必填欄位尚未對應</span>
        </div>
    </div>
    
    <!-- Step 3: 資料預覽 -->
    <div class="wizard-step" data-step="preview" style="display:none;">
        <h3>步驟 3：資料預覽與驗證</h3>
        
        <div class="validation-summary">
            <div class="summary-item valid">
                <i class="fa-solid fa-check-circle"></i>
                <span>有效資料：<strong id="validCount">0</strong></span>
            </div>
            <div class="summary-item warning">
                <i class="fa-solid fa-exclamation-triangle"></i>
                <span>警告：<strong id="warningCount">0</strong></span>
            </div>
            <div class="summary-item error">
                <i class="fa-solid fa-times-circle"></i>
                <span>錯誤：<strong id="errorCount">0</strong></span>
            </div>
        </div>
        
        <div class="preview-table-container">
            <table class="preview-table">
                <thead id="previewTableHead">
                    <!-- 動態產生 -->
                </thead>
                <tbody id="previewTableBody">
                    <!-- 動態產生 -->
                </tbody>
            </table>
        </div>
        
        <div class="conflict-settings">
            <h4>衝突處理策略</h4>
            <select class="form-control" id="conflictStrategy">
                <option value="UPDATE">更新既有資料</option>
                <option value="SKIP">跳過重複資料</option>
                <option value="CREATE_NEW">建立新資料</option>
                <option value="ASK">逐筆詢問</option>
            </select>
        </div>
    </div>
    
    <!-- Step 4: 執行匯入 -->
    <div class="wizard-step" data-step="import" style="display:none;">
        <h3>步驟 4：執行匯入</h3>
        
        <div class="import-settings">
            <h4>匯入設定確認</h4>
            <dl>
                <dt>總筆數：</dt>
                <dd id="totalRows">0</dd>
                <dt>有效資料：</dt>
                <dd id="validRows">0</dd>
                <dt>衝突策略：</dt>
                <dd id="conflictMode">更新</dd>
                <dt>密碼策略：</dt>
                <dd id="passwordMode">啟用連結</dd>
            </dl>
            
            <div class="form-group">
                <label>
                    <input type="checkbox" id="sendNotification" checked>
                    發送通知給新使用者
                </label>
            </div>
            
            <div class="form-group">
                <label>
                    <input type="checkbox" id="dryRun">
                    測試模式（不實際匯入）
                </label>
            </div>
        </div>
        
        <button class="btn btn-success btn-lg" onclick="startImport()">
            <i class="fa-solid fa-upload"></i> 開始匯入
        </button>
    </div>
    
    <!-- Step 5: 結果 -->
    <div class="wizard-step" data-step="result" style="display:none;">
        <h3>匯入完成</h3>
        
        <div class="import-progress" id="importProgress">
            <div class="progress-bar">
                <div class="progress-fill" id="progressBar"></div>
            </div>
            <p class="progress-text">
                處理中：<span id="currentRow">0</span> / <span id="totalRow">0</span>
            </p>
        </div>
        
        <div class="import-result" id="importResult">
            <h4>匯入結果</h4>
            <div class="result-stats">
                <div class="stat-item success">
                    <i class="fa-solid fa-check"></i>
                    <div>
                        <strong id="successCount">0</strong>
                        <span>成功</span>
                    </div>
                </div>
                <div class="stat-item skip">
                    <i class="fa-solid fa-forward"></i>
                    <div>
                        <strong id="skipCount">0</strong>
                        <span>跳過</span>
                    </div>
                </div>
                <div class="stat-item error">
                    <i class="fa-solid fa-times"></i>
                    <div>
                        <strong id="failCount">0</strong>
                        <span>失敗</span>
                    </div>
                </div>
            </div>
            
            <div class="error-list" id="errorList" style="display:none;">
                <h4>錯誤詳情</h4>
                <table class="error-table">
                    <thead>
                        <tr>
                            <th>列號</th>
                            <th>資料</th>
                            <th>錯誤原因</th>
                        </tr>
                    </thead>
                    <tbody id="errorTableBody">
                        <!-- 動態產生 -->
                    </tbody>
                </table>
            </div>
            
            <div class="result-actions">
                <button class="btn btn-primary" onclick="downloadReport()">
                    <i class="fa-solid fa-download"></i> 下載報告
                </button>
                <button class="btn btn-secondary" onclick="newImport()">
                    <i class="fa-solid fa-redo"></i> 新增匯入
                </button>
            </div>
        </div>
    </div>
    
    <!-- 精靈控制按鈕 -->
    <div class="wizard-footer">
        <button class="btn btn-secondary" id="btnPrev" onclick="prevStep()">
            上一步
        </button>
        <button class="btn btn-primary" id="btnNext" onclick="nextStep()">
            下一步
        </button>
    </div>
</div>
```

## 8. 匯入範本

### 8.1 範本定義
```python
IMPORT_TEMPLATES = {
    'users': {
        'name': '使用者匯入範本',
        'columns': [
            {'name': 'username', 'label': '帳號', 'required': True},
            {'name': 'name', 'label': '姓名', 'required': True},
            {'name': 'email', 'label': 'Email', 'required': True},
            {'name': 'employee_no', 'label': '員工編號', 'required': False},
            {'name': 'department', 'label': '部門', 'required': True},
            {'name': 'title', 'label': '職稱', 'required': False},
            {'name': 'manager', 'label': '直屬主管', 'required': False}
        ],
        'sample_data': [
            {
                'username': 'john.doe',
                'name': 'John Doe',
                'email': 'john@example.com',
                'employee_no': 'E001',
                'department': 'IT',
                'title': '工程師',
                'manager': 'jane.smith'
            }
        ]
    },
    'departments': {
        'name': '部門匯入範本',
        'columns': [
            {'name': 'code', 'label': '部門代碼', 'required': True},
            {'name': 'name', 'label': '部門名稱', 'required': True},
            {'name': 'parent_code', 'label': '上級部門代碼', 'required': False},
            {'name': 'sort_order', 'label': '排序', 'required': False}
        ]
    }
}
```

### 8.2 範本下載
```python
def generate_template(template_type='users'):
    """產生匯入範本"""
    import pandas as pd
    from io import BytesIO
    
    template = IMPORT_TEMPLATES.get(template_type)
    if not template:
        raise ValueError(f"Unknown template type: {template_type}")
    
    # 建立 DataFrame
    columns = [col['label'] for col in template['columns']]
    df = pd.DataFrame(columns=columns)
    
    # 加入範例資料
    if template.get('sample_data'):
        sample_rows = []
        for sample in template['sample_data']:
            row = []
            for col in template['columns']:
                row.append(sample.get(col['name'], ''))
            sample_rows.append(row)
        df = pd.DataFrame(sample_rows, columns=columns)
    
    # 輸出 Excel
    output = BytesIO()
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        df.to_excel(writer, sheet_name='Data', index=False)
        
        # 加入說明工作表
        instructions = pd.DataFrame({
            '欄位說明': [col['label'] for col in template['columns']],
            '系統欄位': [col['name'] for col in template['columns']],
            '必填': ['是' if col['required'] else '否' 
                    for col in template['columns']]
        })
        instructions.to_excel(writer, sheet_name='說明', index=False)
    
    output.seek(0)
    return output
```

## 9. API 端點

### 9.1 上傳檔案
```
POST /api/organization/import/upload
```

### 9.2 取得欄位映射建議
```
POST /api/organization/import/suggest-mapping
```

### 9.3 驗證資料
```
POST /api/organization/import/validate
```

### 9.4 執行匯入
```
POST /api/organization/import/execute
```

### 9.5 取得匯入進度
```
GET /api/organization/import/progress/{session_id}
```

### 9.6 下載範本
```
GET /api/organization/import/template/{type}
```

## 10. 實作檢查清單

- [ ] 建立檔案上傳 API
- [ ] 實作檔案解析器
- [ ] 實作欄位映射建議
- [ ] 實作資料驗證器
- [ ] 實作衝突處理器
- [ ] 實作批次匯入器
- [ ] 建立匯入精靈 UI
- [ ] 實作進度追蹤
- [ ] 實作範本產生
- [ ] 實作結果報告
- [ ] 錯誤處理機制
- [ ] 交易管理
- [ ] 效能優化
- [ ] 整合測試

---
*文件版本：1.0*
*最後更新：2025-01-20*