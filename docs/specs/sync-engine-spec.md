# 同步引擎規格書

## 1. 概述
本文件定義自動同步引擎的設計規格，支援從多個外部資料源同步組織資料。

## 2. 同步架構

### 2.1 核心架構
```python
class SyncEngine:
    """同步引擎核心"""
    
    def __init__(self):
        self.sources = []           # 資料源列表
        self.mappers = []          # 欄位映射器
        self.validators = []       # 資料驗證器
        self.transformers = []     # 資料轉換器
        self.conflict_resolver = None  # 衝突處理器
        self.scheduler = None      # 排程器
```

### 2.2 資料源抽象
```python
from abc import ABC, abstractmethod

class DataSource(ABC):
    """資料源抽象類別"""
    
    @abstractmethod
    def connect(self):
        """建立連線"""
        pass
    
    @abstractmethod
    def fetch_data(self, query=None):
        """擷取資料"""
        pass
    
    @abstractmethod
    def test_connection(self):
        """測試連線"""
        pass
    
    @abstractmethod
    def close(self):
        """關閉連線"""
        pass
```

## 3. 多端點資料源

### 3.1 API 資料源
```python
class APIDataSource(DataSource):
    """API 資料源"""
    
    def __init__(self, config):
        self.config = config
        self.base_url = config['url']
        self.auth_type = config.get('auth_type', 'none')
        self.session = requests.Session()
        self.setup_auth()
    
    def setup_auth(self):
        """設定認證"""
        if self.auth_type == 'basic':
            self.session.auth = (
                self.config['username'],
                self.config['password']
            )
        elif self.auth_type == 'bearer':
            self.session.headers['Authorization'] = f"Bearer {self.config['token']}"
        elif self.auth_type == 'api_key':
            key_location = self.config.get('key_location', 'header')
            key_name = self.config['key_name']
            key_value = self.config['key_value']
            
            if key_location == 'header':
                self.session.headers[key_name] = key_value
            elif key_location == 'query':
                self.session.params = {key_name: key_value}
    
    def fetch_data(self, endpoint=None):
        """從 API 擷取資料"""
        url = f"{self.base_url}/{endpoint}" if endpoint else self.base_url
        
        response = self.session.get(url)
        response.raise_for_status()
        
        data = response.json()
        
        # 處理分頁
        if self.config.get('pagination'):
            data = self.fetch_all_pages(url, data)
        
        return data
    
    def fetch_all_pages(self, url, initial_data):
        """擷取所有分頁資料"""
        all_data = initial_data.get('data', [])
        next_url = initial_data.get('next')
        
        while next_url:
            response = self.session.get(next_url)
            response.raise_for_status()
            
            page_data = response.json()
            all_data.extend(page_data.get('data', []))
            next_url = page_data.get('next')
        
        return all_data
```

### 3.2 資料庫資料源
```python
class DatabaseDataSource(DataSource):
    """資料庫資料源"""
    
    def __init__(self, config):
        self.config = config
        self.db_type = config['type']
        self.connection = None
        self.engine = None
    
    def connect(self):
        """建立資料庫連線"""
        if self.db_type == 'mysql':
            import pymysql
            self.connection = pymysql.connect(
                host=self.config['host'],
                port=self.config.get('port', 3306),
                user=self.config['username'],
                password=self.config['password'],
                database=self.config['database'],
                charset='utf8mb4'
            )
        
        elif self.db_type == 'postgresql':
            import psycopg2
            self.connection = psycopg2.connect(
                host=self.config['host'],
                port=self.config.get('port', 5432),
                user=self.config['username'],
                password=self.config['password'],
                database=self.config['database']
            )
        
        elif self.db_type == 'oracle':
            import cx_Oracle
            dsn = cx_Oracle.makedsn(
                self.config['host'],
                self.config.get('port', 1521),
                service_name=self.config['service_name']
            )
            self.connection = cx_Oracle.connect(
                self.config['username'],
                self.config['password'],
                dsn
            )
        
        elif self.db_type == 'mssql':
            import pymssql
            self.connection = pymssql.connect(
                server=self.config['host'],
                port=self.config.get('port', 1433),
                user=self.config['username'],
                password=self.config['password'],
                database=self.config['database']
            )
    
    def fetch_data(self, query=None):
        """執行查詢並返回資料"""
        if not query:
            query = self.config.get('default_query')
        
        import pandas as pd
        df = pd.read_sql(query, self.connection)
        
        return df.to_dict('records')
```

## 4. 欄位映射引擎

### 4.1 映射設定
```json
{
  "field_mappings": [
    {
      "source": "emp_id",
      "target": "employee_no",
      "required": true,
      "unique": true
    },
    {
      "source": "full_name",
      "target": "name",
      "transform": "trim"
    },
    {
      "source": "dept_code",
      "target": "department_id",
      "transform": "lookup_department"
    },
    {
      "source": null,
      "target": "status",
      "default": "active"
    }
  ],
  "computed_fields": [
    {
      "target": "path",
      "calculator": "build_department_path"
    },
    {
      "target": "level",
      "calculator": "calculate_level"
    }
  ]
}
```

### 4.2 映射處理器
```python
class FieldMapper:
    """欄位映射處理器"""
    
    def __init__(self, mapping_config):
        self.mappings = mapping_config['field_mappings']
        self.computed = mapping_config.get('computed_fields', [])
        self.transformers = self.load_transformers()
    
    def map_record(self, source_record):
        """映射單筆資料"""
        target_record = {}
        
        # 直接映射
        for mapping in self.mappings:
            source_field = mapping.get('source')
            target_field = mapping['target']
            
            if source_field:
                value = source_record.get(source_field)
                
                # 套用轉換
                if mapping.get('transform'):
                    value = self.apply_transform(
                        value, 
                        mapping['transform']
                    )
                
                target_record[target_field] = value
            
            elif mapping.get('default'):
                target_record[target_field] = mapping['default']
        
        # 計算欄位
        for computed in self.computed:
            target_field = computed['target']
            calculator = computed['calculator']
            
            value = self.calculate_field(
                target_record,
                calculator
            )
            
            target_record[target_field] = value
        
        return target_record
    
    def apply_transform(self, value, transform_name):
        """套用資料轉換"""
        transformers = {
            'trim': lambda v: v.strip() if v else v,
            'uppercase': lambda v: v.upper() if v else v,
            'lowercase': lambda v: v.lower() if v else v,
            'lookup_department': self.lookup_department,
            'parse_date': self.parse_date,
            'clean_phone': self.clean_phone_number
        }
        
        transformer = transformers.get(transform_name)
        return transformer(value) if transformer else value
    
    def lookup_department(self, dept_code):
        """查找部門 ID"""
        dept = Department.query.filter_by(code=dept_code).first()
        return dept.id if dept else None
```

## 5. 資料驗證和清理

### 5.1 驗證器
```python
class DataValidator:
    """資料驗證器"""
    
    def __init__(self, validation_rules):
        self.rules = validation_rules
    
    def validate_batch(self, records):
        """批次驗證"""
        results = []
        
        for record in records:
            validation = self.validate_record(record)
            results.append(validation)
        
        return results
    
    def validate_record(self, record):
        """驗證單筆資料"""
        errors = []
        warnings = []
        
        for field, rules in self.rules.items():
            value = record.get(field)
            
            # 必填檢查
            if rules.get('required') and not value:
                errors.append(f"{field} is required")
            
            # 資料型別檢查
            if value and rules.get('type'):
                if not self.check_type(value, rules['type']):
                    errors.append(f"{field} must be {rules['type']}")
            
            # 長度檢查
            if value and rules.get('max_length'):
                if len(str(value)) > rules['max_length']:
                    warnings.append(f"{field} exceeds max length")
            
            # 自訂驗證
            if value and rules.get('validator'):
                if not rules['validator'](value):
                    errors.append(f"{field} validation failed")
        
        return {
            'record': record,
            'valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings
        }
```

### 5.2 資料清理器
```python
class DataCleaner:
    """資料清理器"""
    
    def clean_batch(self, records):
        """批次清理資料"""
        cleaned = []
        
        for record in records:
            cleaned_record = self.clean_record(record)
            if cleaned_record:
                cleaned.append(cleaned_record)
        
        return cleaned
    
    def clean_record(self, record):
        """清理單筆資料"""
        cleaned = {}
        
        for key, value in record.items():
            # 移除空白
            if isinstance(value, str):
                value = value.strip()
            
            # 移除 None 和空字串
            if value not in [None, '', 'NULL', 'null']:
                cleaned[key] = value
        
        return cleaned if cleaned else None
```

## 6. 衝突處理

### 6.1 衝突偵測
```python
class ConflictDetector:
    """衝突偵測器"""
    
    def detect_conflicts(self, new_records, existing_records):
        """偵測資料衝突"""
        conflicts = []
        
        # 建立查找索引
        existing_index = {
            self.get_key(r): r for r in existing_records
        }
        
        for new_record in new_records:
            key = self.get_key(new_record)
            
            if key in existing_index:
                existing = existing_index[key]
                
                # 檢查是否有差異
                if self.has_differences(new_record, existing):
                    conflicts.append({
                        'key': key,
                        'new': new_record,
                        'existing': existing,
                        'differences': self.get_differences(new_record, existing)
                    })
        
        return conflicts
    
    def get_key(self, record):
        """取得資料鍵值"""
        # 可設定的鍵值欄位
        key_fields = ['employee_no', 'external_id', 'email']
        
        for field in key_fields:
            if field in record and record[field]:
                return record[field]
        
        return None
    
    def has_differences(self, record1, record2):
        """檢查是否有差異"""
        for key in record1:
            if key in record2:
                if record1[key] != record2[key]:
                    return True
        return False
```

### 6.2 衝突解決策略
```python
class ConflictResolver:
    """衝突解決器"""
    
    STRATEGIES = {
        'SKIP': '跳過新資料',
        'OVERWRITE': '覆蓋舊資料',
        'MERGE': '合併資料',
        'NEWER': '使用較新的',
        'MANUAL': '人工處理'
    }
    
    def resolve(self, conflict, strategy='MERGE'):
        """解決衝突"""
        new_data = conflict['new']
        existing_data = conflict['existing']
        
        if strategy == 'SKIP':
            return None
        
        elif strategy == 'OVERWRITE':
            return new_data
        
        elif strategy == 'MERGE':
            merged = existing_data.copy()
            for key, value in new_data.items():
                if value and not merged.get(key):
                    merged[key] = value
            return merged
        
        elif strategy == 'NEWER':
            # 比較時間戳記
            if self.is_newer(new_data, existing_data):
                return new_data
            return existing_data
        
        elif strategy == 'MANUAL':
            # 標記需要人工審核
            return {
                'action': 'MANUAL_REVIEW',
                'conflict': conflict
            }
```

## 7. 排程執行

### 7.1 排程器
```python
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

class SyncScheduler:
    """同步排程器"""
    
    def __init__(self):
        self.scheduler = BackgroundScheduler()
        self.jobs = {}
    
    def add_sync_job(self, job_id, sync_config):
        """新增同步任務"""
        schedule = sync_config.get('schedule')
        
        if schedule['type'] == 'cron':
            trigger = CronTrigger.from_crontab(schedule['expression'])
        elif schedule['type'] == 'interval':
            trigger = IntervalTrigger(
                seconds=schedule.get('seconds', 0),
                minutes=schedule.get('minutes', 0),
                hours=schedule.get('hours', 0)
            )
        else:
            trigger = DateTrigger(run_date=schedule['run_date'])
        
        job = self.scheduler.add_job(
            func=self.execute_sync,
            trigger=trigger,
            args=[sync_config],
            id=job_id,
            replace_existing=True
        )
        
        self.jobs[job_id] = job
        return job
    
    def execute_sync(self, sync_config):
        """執行同步"""
        try:
            # 記錄開始
            sync_log = SyncLog.start(sync_config['name'])
            
            # 執行同步
            engine = SyncEngine(sync_config)
            result = engine.sync()
            
            # 記錄結果
            sync_log.complete(result)
            
        except Exception as e:
            # 記錄錯誤
            sync_log.fail(str(e))
            
            # 發送通知
            self.send_error_notification(sync_config, e)
    
    def start(self):
        """啟動排程器"""
        self.scheduler.start()
    
    def stop(self):
        """停止排程器"""
        self.scheduler.shutdown()
```

### 7.2 同步任務設定
```json
{
  "sync_jobs": [
    {
      "id": "sync_departments",
      "name": "部門資料同步",
      "source": {
        "type": "api",
        "config": {
          "url": "https://hr.company.com/api/departments",
          "auth_type": "bearer",
          "token": "..."
        }
      },
      "schedule": {
        "type": "cron",
        "expression": "0 2 * * *"
      },
      "mapping": "department_mapping.json",
      "conflict_strategy": "MERGE"
    },
    {
      "id": "sync_users",
      "name": "使用者資料同步",
      "source": {
        "type": "database",
        "config": {
          "type": "mysql",
          "host": "hr-db.company.com",
          "database": "hr_system",
          "username": "sync_user",
          "password": "...",
          "query": "SELECT * FROM employees WHERE modified_date > :last_sync"
        }
      },
      "schedule": {
        "type": "interval",
        "hours": 6
      },
      "mapping": "user_mapping.json",
      "conflict_strategy": "NEWER"
    }
  ]
}
```

## 8. 同步監控

### 8.1 同步日誌
```python
class SyncLog:
    """同步日誌"""
    
    @classmethod
    def start(cls, job_name):
        """開始同步"""
        log = cls(
            job_name=job_name,
            status='RUNNING',
            started_at=datetime.now()
        )
        db.session.add(log)
        db.session.commit()
        return log
    
    def update_progress(self, current, total):
        """更新進度"""
        self.progress = f"{current}/{total}"
        self.progress_percent = (current / total * 100) if total > 0 else 0
        db.session.commit()
    
    def complete(self, result):
        """完成同步"""
        self.status = 'COMPLETED'
        self.completed_at = datetime.now()
        self.duration = (self.completed_at - self.started_at).seconds
        self.result = {
            'total': result['total'],
            'created': result['created'],
            'updated': result['updated'],
            'skipped': result['skipped'],
            'failed': result['failed']
        }
        db.session.commit()
    
    def fail(self, error):
        """同步失敗"""
        self.status = 'FAILED'
        self.completed_at = datetime.now()
        self.error = error
        db.session.commit()
```

### 8.2 監控儀表板
```html
<div class="sync-dashboard">
    <h2>同步監控儀表板</h2>
    
    <!-- 同步狀態總覽 -->
    <div class="sync-overview">
        <div class="stat-card">
            <i class="fa-solid fa-sync"></i>
            <div class="stat-content">
                <h3>執行中</h3>
                <span class="stat-value">2</span>
            </div>
        </div>
        
        <div class="stat-card">
            <i class="fa-solid fa-check-circle"></i>
            <div class="stat-content">
                <h3>成功</h3>
                <span class="stat-value">145</span>
            </div>
        </div>
        
        <div class="stat-card">
            <i class="fa-solid fa-times-circle"></i>
            <div class="stat-content">
                <h3>失敗</h3>
                <span class="stat-value">3</span>
            </div>
        </div>
    </div>
    
    <!-- 同步任務列表 -->
    <div class="sync-jobs">
        <h3>同步任務</h3>
        <table class="sync-table">
            <thead>
                <tr>
                    <th>任務名稱</th>
                    <th>資料源</th>
                    <th>排程</th>
                    <th>上次執行</th>
                    <th>狀態</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>部門同步</td>
                    <td>HR API</td>
                    <td>每天 02:00</td>
                    <td>2025-01-20 02:00</td>
                    <td><span class="badge badge-success">成功</span></td>
                    <td>
                        <button class="btn btn-sm" onclick="runSync('dept')">
                            立即執行
                        </button>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
    
    <!-- 同步歷史 -->
    <div class="sync-history">
        <h3>執行歷史</h3>
        <div class="history-timeline">
            <!-- 動態載入 -->
        </div>
    </div>
</div>
```

## 9. API 端點

### 9.1 同步設定
```
GET /api/sync/configs
POST /api/sync/configs
PUT /api/sync/configs/{id}
DELETE /api/sync/configs/{id}
```

### 9.2 同步執行
```
POST /api/sync/execute/{job_id}
GET /api/sync/status/{job_id}
POST /api/sync/stop/{job_id}
```

### 9.3 同步監控
```
GET /api/sync/logs
GET /api/sync/logs/{id}
GET /api/sync/statistics
```

## 10. 實作檢查清單

- [ ] 建立同步引擎核心
- [ ] 實作 API 資料源
- [ ] 實作資料庫資料源
- [ ] 實作欄位映射引擎
- [ ] 實作資料驗證器
- [ ] 實作衝突處理器
- [ ] 實作排程執行器
- [ ] 建立同步設定介面
- [ ] 實作監控儀表板
- [ ] 實作同步日誌
- [ ] 錯誤處理和重試機制
- [ ] 效能優化
- [ ] 整合測試

---
*文件版本：1.0*
*最後更新：2025-01-20*