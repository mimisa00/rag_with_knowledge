# 審計系統規格書

## 1. 概述
本文件定義審計系統的設計規格，包含操作記錄、查詢介面、報表輸出等功能。

## 2. 審計資料模型

### 2.1 審計日誌表
```sql
CREATE TABLE audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    -- 使用者資訊
    user_id VARCHAR(100),
    user_name VARCHAR(100),                    -- 冗餘儲存
    user_role VARCHAR(100),                    -- 操作時的角色
    department_id BIGINT,
    department_name VARCHAR(100),              -- 冗餘儲存
    
    -- 操作資訊
    action_type VARCHAR(50) NOT NULL,          -- CREATE/READ/UPDATE/DELETE/LOGIN/EXPORT
    action_name VARCHAR(255),                  -- 操作描述
    resource_type VARCHAR(50),                 -- USER/DEPARTMENT/ROLE/KNOWLEDGE_BASE
    resource_id VARCHAR(100),
    resource_name VARCHAR(255),                -- 冗餘儲存
    
    -- 變更詳情
    changes_json JSON,                         -- 變更前後對照
    request_data JSON,                         -- 請求資料
    response_data JSON,                        -- 回應資料
    
    -- 環境資訊
    ip_address VARCHAR(45),
    user_agent TEXT,
    session_id VARCHAR(100),
    request_id VARCHAR(100),                   -- 追蹤請求
    
    -- 結果
    status VARCHAR(20),                        -- SUCCESS/FAILED/ERROR
    error_message TEXT,
    duration_ms INT,                           -- 執行時間（毫秒）
    
    -- 時間戳記
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 索引
    INDEX idx_user_time (user_id, created_at DESC),
    INDEX idx_action_type (action_type, created_at DESC),
    INDEX idx_resource (resource_type, resource_id),
    INDEX idx_department (department_id, created_at DESC),
    INDEX idx_status (status, created_at DESC),
    INDEX idx_session (session_id),
    INDEX idx_created_at (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
PARTITION BY RANGE (YEAR(created_at) * 100 + MONTH(created_at)) (
    PARTITION p202501 VALUES LESS THAN (202502),
    PARTITION p202502 VALUES LESS THAN (202503),
    PARTITION p202503 VALUES LESS THAN (202504)
);
```

### 2.2 審計事件類型
```python
class AuditEventType(Enum):
    """審計事件類型"""
    
    # 認證事件
    LOGIN = "LOGIN"
    LOGOUT = "LOGOUT"
    LOGIN_FAILED = "LOGIN_FAILED"
    PASSWORD_CHANGE = "PASSWORD_CHANGE"
    PASSWORD_RESET = "PASSWORD_RESET"
    
    # 資料操作
    CREATE = "CREATE"
    READ = "READ"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    EXPORT = "EXPORT"
    IMPORT = "IMPORT"
    
    # 系統操作
    SYSTEM_CONFIG = "SYSTEM_CONFIG"
    PERMISSION_CHANGE = "PERMISSION_CHANGE"
    SYNC_EXECUTE = "SYNC_EXECUTE"
    BACKUP = "BACKUP"
    RESTORE = "RESTORE"
```

## 3. 審計記錄器

### 3.1 審計裝飾器
```python
from functools import wraps
import time

def audit_log(action_type, resource_type=None):
    """審計日誌裝飾器"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            audit_entry = AuditLog()
            
            try:
                # 記錄請求資訊
                audit_entry.user_id = current_user.id if current_user else None
                audit_entry.user_name = current_user.name if current_user else 'System'
                audit_entry.action_type = action_type
                audit_entry.action_name = func.__doc__ or func.__name__
                audit_entry.resource_type = resource_type
                audit_entry.ip_address = request.remote_addr
                audit_entry.user_agent = request.headers.get('User-Agent')
                audit_entry.session_id = session.get('session_id')
                audit_entry.request_data = {
                    'args': str(args)[:1000],
                    'kwargs': str(kwargs)[:1000]
                }
                
                # 執行函數
                result = func(*args, **kwargs)
                
                # 記錄成功
                audit_entry.status = 'SUCCESS'
                audit_entry.response_data = str(result)[:1000] if result else None
                
                return result
                
            except Exception as e:
                # 記錄失敗
                audit_entry.status = 'FAILED'
                audit_entry.error_message = str(e)
                raise
                
            finally:
                # 計算執行時間
                audit_entry.duration_ms = int((time.time() - start_time) * 1000)
                
                # 儲存審計日誌
                try:
                    db.session.add(audit_entry)
                    db.session.commit()
                except:
                    # 審計失敗不應影響業務
                    pass
        
        return wrapper
    return decorator
```

### 3.2 審計服務
```python
class AuditService:
    """審計服務"""
    
    @staticmethod
    def log_action(action_type, resource_type=None, resource_id=None, 
                   details=None, status='SUCCESS'):
        """記錄操作"""
        audit = AuditLog(
            user_id=current_user.id if current_user else None,
            user_name=current_user.name if current_user else 'System',
            action_type=action_type,
            resource_type=resource_type,
            resource_id=resource_id,
            changes_json=details,
            ip_address=request.remote_addr if request else None,
            user_agent=request.headers.get('User-Agent') if request else None,
            status=status,
            created_at=datetime.now()
        )
        
        # 如果有部門資訊
        if current_user and hasattr(current_user, 'department_id'):
            audit.department_id = current_user.department_id
            audit.department_name = current_user.department.name
        
        db.session.add(audit)
        db.session.commit()
        
        return audit
    
    @staticmethod
    def log_data_change(resource_type, resource_id, old_data, new_data):
        """記錄資料變更"""
        changes = AuditService.compare_data(old_data, new_data)
        
        if changes:
            AuditService.log_action(
                action_type='UPDATE',
                resource_type=resource_type,
                resource_id=resource_id,
                details={
                    'changes': changes,
                    'before': old_data,
                    'after': new_data
                }
            )
    
    @staticmethod
    def compare_data(old_data, new_data):
        """比較資料差異"""
        changes = []
        
        for key in new_data:
            if key in old_data:
                if old_data[key] != new_data[key]:
                    changes.append({
                        'field': key,
                        'old': old_data[key],
                        'new': new_data[key]
                    })
            else:
                changes.append({
                    'field': key,
                    'old': None,
                    'new': new_data[key]
                })
        
        return changes
```

## 4. 審計查詢

### 4.1 查詢過濾器
```python
class AuditQueryBuilder:
    """審計查詢建構器"""
    
    def __init__(self):
        self.query = AuditLog.query
    
    def filter_by_user(self, user_id):
        """按使用者過濾"""
        if user_id:
            self.query = self.query.filter_by(user_id=user_id)
        return self
    
    def filter_by_department(self, department_id):
        """按部門過濾"""
        if department_id:
            self.query = self.query.filter_by(department_id=department_id)
        return self
    
    def filter_by_action(self, action_type):
        """按操作類型過濾"""
        if action_type:
            self.query = self.query.filter_by(action_type=action_type)
        return self
    
    def filter_by_resource(self, resource_type, resource_id=None):
        """按資源過濾"""
        if resource_type:
            self.query = self.query.filter_by(resource_type=resource_type)
        if resource_id:
            self.query = self.query.filter_by(resource_id=resource_id)
        return self
    
    def filter_by_date_range(self, start_date, end_date):
        """按日期範圍過濾"""
        if start_date:
            self.query = self.query.filter(AuditLog.created_at >= start_date)
        if end_date:
            self.query = self.query.filter(AuditLog.created_at <= end_date)
        return self
    
    def filter_by_status(self, status):
        """按狀態過濾"""
        if status:
            self.query = self.query.filter_by(status=status)
        return self
    
    def order_by(self, field='created_at', desc=True):
        """排序"""
        column = getattr(AuditLog, field)
        if desc:
            self.query = self.query.order_by(column.desc())
        else:
            self.query = self.query.order_by(column)
        return self
    
    def paginate(self, page=1, per_page=20):
        """分頁"""
        return self.query.paginate(page=page, per_page=per_page)
    
    def get_all(self):
        """取得所有結果"""
        return self.query.all()
```

### 4.2 審計統計
```python
class AuditStatistics:
    """審計統計"""
    
    @staticmethod
    def get_action_statistics(start_date=None, end_date=None):
        """操作統計"""
        query = db.session.query(
            AuditLog.action_type,
            func.count(AuditLog.id).label('count')
        )
        
        if start_date:
            query = query.filter(AuditLog.created_at >= start_date)
        if end_date:
            query = query.filter(AuditLog.created_at <= end_date)
        
        return query.group_by(AuditLog.action_type).all()
    
    @staticmethod
    def get_user_activity(user_id, days=30):
        """使用者活動統計"""
        start_date = datetime.now() - timedelta(days=days)
        
        return db.session.query(
            func.date(AuditLog.created_at).label('date'),
            func.count(AuditLog.id).label('actions')
        ).filter(
            AuditLog.user_id == user_id,
            AuditLog.created_at >= start_date
        ).group_by(
            func.date(AuditLog.created_at)
        ).all()
    
    @staticmethod
    def get_failed_operations(limit=100):
        """失敗操作"""
        return AuditLog.query.filter_by(
            status='FAILED'
        ).order_by(
            AuditLog.created_at.desc()
        ).limit(limit).all()
```

## 5. 審計介面

### 5.1 審計查詢頁面
```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <title>審計日誌 - RAG系統</title>
    <link rel="stylesheet" href="/css/pages/audit.css">
</head>
<body class="admin-layout">
    <div class="admin-container">
        <h1>審計日誌查詢</h1>
        
        <!-- 查詢條件 -->
        <div class="audit-filters">
            <div class="filter-row">
                <div class="filter-group">
                    <label>日期範圍</label>
                    <input type="date" id="startDate" class="form-control">
                    <span>至</span>
                    <input type="date" id="endDate" class="form-control">
                </div>
                
                <div class="filter-group">
                    <label>使用者</label>
                    <input type="text" id="userSearch" class="form-control" 
                           placeholder="搜尋使用者...">
                </div>
                
                <div class="filter-group">
                    <label>操作類型</label>
                    <select id="actionType" class="form-control">
                        <option value="">全部</option>
                        <option value="LOGIN">登入</option>
                        <option value="CREATE">建立</option>
                        <option value="UPDATE">更新</option>
                        <option value="DELETE">刪除</option>
                        <option value="EXPORT">匯出</option>
                    </select>
                </div>
                
                <div class="filter-group">
                    <label>資源類型</label>
                    <select id="resourceType" class="form-control">
                        <option value="">全部</option>
                        <option value="USER">使用者</option>
                        <option value="DEPARTMENT">部門</option>
                        <option value="ROLE">角色</option>
                        <option value="KNOWLEDGE_BASE">知識庫</option>
                    </select>
                </div>
            </div>
            
            <div class="filter-actions">
                <button class="btn btn-primary" onclick="searchAuditLogs()">
                    <i class="fa-solid fa-search"></i> 查詢
                </button>
                <button class="btn btn-secondary" onclick="resetFilters()">
                    <i class="fa-solid fa-redo"></i> 重設
                </button>
                <button class="btn btn-success" onclick="exportAuditLogs()">
                    <i class="fa-solid fa-download"></i> 匯出
                </button>
            </div>
        </div>
        
        <!-- 審計日誌列表 -->
        <div class="audit-logs">
            <table class="audit-table">
                <thead>
                    <tr>
                        <th>時間</th>
                        <th>使用者</th>
                        <th>部門</th>
                        <th>操作</th>
                        <th>資源</th>
                        <th>IP位址</th>
                        <th>狀態</th>
                        <th>詳情</th>
                    </tr>
                </thead>
                <tbody id="auditTableBody">
                    <!-- 動態載入 -->
                </tbody>
            </table>
            
            <!-- 分頁 -->
            <div class="pagination">
                <button class="btn btn-sm" id="prevPage">上一頁</button>
                <span class="page-info">
                    第 <span id="currentPage">1</span> 頁，
                    共 <span id="totalPages">1</span> 頁
                </span>
                <button class="btn btn-sm" id="nextPage">下一頁</button>
            </div>
        </div>
    </div>
    
    <!-- 詳情模態框 -->
    <div id="auditDetailModal" class="modal">
        <div class="modal-content modal-lg">
            <div class="modal-header">
                <h3>審計日誌詳情</h3>
                <button class="modal-close" onclick="closeDetailModal()">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="detail-grid">
                    <div class="detail-item">
                        <label>操作時間：</label>
                        <span id="detailTime"></span>
                    </div>
                    <div class="detail-item">
                        <label>使用者：</label>
                        <span id="detailUser"></span>
                    </div>
                    <div class="detail-item">
                        <label>操作類型：</label>
                        <span id="detailAction"></span>
                    </div>
                    <div class="detail-item">
                        <label>資源：</label>
                        <span id="detailResource"></span>
                    </div>
                    <div class="detail-item">
                        <label>IP位址：</label>
                        <span id="detailIP"></span>
                    </div>
                    <div class="detail-item">
                        <label>執行時間：</label>
                        <span id="detailDuration"></span>
                    </div>
                </div>
                
                <!-- 變更詳情 -->
                <div class="changes-section" id="changesSection">
                    <h4>變更內容</h4>
                    <table class="changes-table">
                        <thead>
                            <tr>
                                <th>欄位</th>
                                <th>原值</th>
                                <th>新值</th>
                            </tr>
                        </thead>
                        <tbody id="changesTableBody">
                            <!-- 動態載入 -->
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeDetailModal()">
                    關閉
                </button>
            </div>
        </div>
    </div>
    
    <script src="/js/audit.js"></script>
</body>
</html>
```

### 5.2 審計儀表板
```html
<div class="audit-dashboard">
    <h2>審計統計儀表板</h2>
    
    <!-- 統計卡片 -->
    <div class="stats-grid">
        <div class="stat-card">
            <i class="fa-solid fa-user-clock"></i>
            <div class="stat-content">
                <h3>今日活躍使用者</h3>
                <span class="stat-value">156</span>
            </div>
        </div>
        
        <div class="stat-card">
            <i class="fa-solid fa-chart-line"></i>
            <div class="stat-content">
                <h3>今日操作次數</h3>
                <span class="stat-value">3,245</span>
            </div>
        </div>
        
        <div class="stat-card">
            <i class="fa-solid fa-exclamation-triangle"></i>
            <div class="stat-content">
                <h3>失敗操作</h3>
                <span class="stat-value text-danger">12</span>
            </div>
        </div>
        
        <div class="stat-card">
            <i class="fa-solid fa-shield-alt"></i>
            <div class="stat-content">
                <h3>安全事件</h3>
                <span class="stat-value text-warning">3</span>
            </div>
        </div>
    </div>
    
    <!-- 操作趨勢圖 -->
    <div class="chart-section">
        <h3>操作趨勢（最近7天）</h3>
        <canvas id="activityChart"></canvas>
    </div>
    
    <!-- 熱門操作 -->
    <div class="top-actions">
        <h3>熱門操作</h3>
        <table class="simple-table">
            <thead>
                <tr>
                    <th>操作類型</th>
                    <th>次數</th>
                    <th>百分比</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>檢視知識庫</td>
                    <td>1,234</td>
                    <td>38%</td>
                </tr>
                <tr>
                    <td>搜尋文件</td>
                    <td>892</td>
                    <td>27%</td>
                </tr>
                <tr>
                    <td>上傳文件</td>
                    <td>456</td>
                    <td>14%</td>
                </tr>
            </tbody>
        </table>
    </div>
    
    <!-- 異常活動 -->
    <div class="anomaly-section">
        <h3>異常活動警示</h3>
        <div class="alert-list">
            <div class="alert-item alert-warning">
                <i class="fa-solid fa-exclamation-triangle"></i>
                <div class="alert-content">
                    <strong>多次登入失敗</strong>
                    <p>使用者 john.doe 在 10 分鐘內登入失敗 5 次</p>
                    <small>2025-01-20 14:30</small>
                </div>
            </div>
            
            <div class="alert-item alert-danger">
                <i class="fa-solid fa-ban"></i>
                <div class="alert-content">
                    <strong>未授權存取嘗試</strong>
                    <p>IP 192.168.1.100 嘗試存取管理功能</p>
                    <small>2025-01-20 13:45</small>
                </div>
            </div>
        </div>
    </div>
</div>
```

## 6. 報表輸出

### 6.1 報表產生器
```python
class AuditReportGenerator:
    """審計報表產生器"""
    
    def generate_excel_report(self, filters, output_file):
        """產生 Excel 報表"""
        import pandas as pd
        from openpyxl import Workbook
        
        # 查詢資料
        query_builder = AuditQueryBuilder()
        
        if filters.get('start_date'):
            query_builder.filter_by_date_range(
                filters['start_date'],
                filters.get('end_date')
            )
        
        if filters.get('user_id'):
            query_builder.filter_by_user(filters['user_id'])
        
        logs = query_builder.get_all()
        
        # 轉換為 DataFrame
        data = []
        for log in logs:
            data.append({
                '時間': log.created_at,
                '使用者': log.user_name,
                '部門': log.department_name,
                '操作類型': log.action_type,
                '資源類型': log.resource_type,
                '資源名稱': log.resource_name,
                'IP位址': log.ip_address,
                '狀態': log.status,
                '錯誤訊息': log.error_message
            })
        
        df = pd.DataFrame(data)
        
        # 寫入 Excel
        with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='審計日誌', index=False)
            
            # 加入統計工作表
            stats_df = self.generate_statistics(logs)
            stats_df.to_excel(writer, sheet_name='統計', index=False)
        
        return output_file
    
    def generate_pdf_report(self, filters):
        """產生 PDF 報表"""
        from reportlab.lib.pagesizes import A4
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle
        
        # 實作 PDF 報表產生
        pass
```

## 7. 審計維護

### 7.1 日誌清理
```python
class AuditMaintenance:
    """審計維護"""
    
    @staticmethod
    def archive_old_logs(days=90):
        """歸檔舊日誌"""
        cutoff_date = datetime.now() - timedelta(days=days)
        
        # 查詢需要歸檔的日誌
        old_logs = AuditLog.query.filter(
            AuditLog.created_at < cutoff_date
        ).all()
        
        # 歸檔到歷史表
        for log in old_logs:
            archived = ArchivedAuditLog()
            for key, value in log.__dict__.items():
                if not key.startswith('_'):
                    setattr(archived, key, value)
            db.session.add(archived)
        
        # 刪除原始日誌
        AuditLog.query.filter(
            AuditLog.created_at < cutoff_date
        ).delete()
        
        db.session.commit()
        
        return len(old_logs)
    
    @staticmethod
    def create_partition(year, month):
        """建立分區"""
        partition_name = f"p{year}{month:02d}"
        next_month = month + 1 if month < 12 else 1
        next_year = year if month < 12 else year + 1
        
        sql = f"""
        ALTER TABLE audit_logs 
        ADD PARTITION (
            PARTITION {partition_name} 
            VALUES LESS THAN ({next_year * 100 + next_month})
        )
        """
        
        db.session.execute(sql)
        db.session.commit()
```

## 8. API 端點

### 8.1 審計查詢
```
GET /api/audit/logs
GET /api/audit/logs/{id}
GET /api/audit/statistics
GET /api/audit/user-activity/{user_id}
```

### 8.2 審計報表
```
POST /api/audit/export/excel
POST /api/audit/export/pdf
GET /api/audit/report/summary
```

## 9. 實作檢查清單

- [ ] 建立審計日誌表
- [ ] 實作審計裝飾器
- [ ] 實作審計服務
- [ ] 建立查詢介面
- [ ] 實作統計功能
- [ ] 建立審計儀表板
- [ ] 實作報表輸出
- [ ] 實作日誌歸檔
- [ ] 實作分區管理
- [ ] 異常偵測機制
- [ ] 效能優化
- [ ] 安全性檢查

---
*文件版本：1.0*
*最後更新：2025-01-20*