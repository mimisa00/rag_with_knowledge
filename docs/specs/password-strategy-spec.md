# 密碼策略規格書

## 1. 概述
本文件定義非 SSO 環境下的密碼管理策略，包含密碼初始化、生命週期管理、安全規則等。

## 2. 密碼策略類型

### 2.1 啟用連結 (ACTIVATION_LINK)
**最推薦方式**：使用者收到啟用郵件，自行設定密碼。

**流程：**
1. 系統建立使用者（密碼欄位為 NULL）
2. 產生唯一啟用 token
3. 發送啟用郵件
4. 使用者點擊連結設定密碼
5. 啟用帳號並登入

**優點：**
- 最安全（密碼不經手管理員）
- 使用者自主設定
- 確認 Email 有效性

**實作：**
```python
class ActivationLinkStrategy:
    def create_user(self, user_data):
        # 建立使用者
        user = User.create(
            username=user_data['username'],
            email=user_data['email'],
            password_hash=None,
            status='pending_activation'
        )
        
        # 產生啟用 token
        token = secrets.token_urlsafe(32)
        activation = UserActivation.create(
            user_id=user.id,
            token=token,
            expires_at=datetime.now() + timedelta(days=7)
        )
        
        # 發送郵件
        send_activation_email(user.email, token)
        
        return user
```

### 2.2 臨時密碼 (TEMP_PASSWORD)
系統產生臨時密碼，首次登入強制變更。

**流程：**
1. 系統產生隨機密碼
2. 儲存密碼並標記需變更
3. 通知使用者（Email/SMS）
4. 首次登入強制變更密碼

**密碼產生規則：**
```python
def generate_temp_password(length=12):
    """產生符合複雜度的臨時密碼"""
    chars = string.ascii_letters + string.digits + "!@#$%^&*"
    
    # 確保包含各種字元
    password = [
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.digits),
        secrets.choice("!@#$%^&*")
    ]
    
    # 填充剩餘長度
    for _ in range(length - 4):
        password.append(secrets.choice(chars))
    
    # 打亂順序
    secrets.SystemRandom().shuffle(password)
    return ''.join(password)
```

### 2.3 預設模式密碼 (PATTERN)
使用預定義規則產生密碼。

**範例模式：**
- 姓名拼音 + 員工編號：`zhangsan1234`
- 部門代碼 + 生日：`IT19900101`
- 公司簡稱 + 年份：`RAG2025`

**安全警告：**
⚠️ 此方式安全性較低，僅建議用於測試環境

### 2.4 LDAP 認證代理 (LDAP_PASSTHROUGH)
不儲存密碼，透過 LDAP 驗證。

**流程：**
1. 使用者輸入 AD 帳號密碼
2. 系統向 LDAP 伺服器驗證
3. 驗證成功建立本地 session
4. 同步使用者資訊

**實作：**
```python
class LDAPAuthStrategy:
    def authenticate(self, username, password):
        try:
            # LDAP 連線
            conn = ldap.initialize(self.ldap_server)
            user_dn = f"cn={username},{self.base_dn}"
            
            # 嘗試綁定
            conn.simple_bind_s(user_dn, password)
            
            # 成功則同步資訊
            local_user = self.sync_user_info(username)
            return create_session(local_user)
            
        except ldap.INVALID_CREDENTIALS:
            return None
```

### 2.5 管理員設定 (ADMIN_SET)
管理員手動設定密碼。

**使用場景：**
- 緊急帳號建立
- 特殊權限帳號
- 測試帳號

### 2.6 禁止登入 (NO_LOGIN)
僅同步資料，不允許登入。

**使用場景：**
- 資料同步但不開放系統
- 預備帳號
- 暫時停用

## 3. 密碼複雜度規則

### 3.1 預設規則
```python
DEFAULT_PASSWORD_POLICY = {
    "min_length": 8,
    "max_length": 128,
    "require_uppercase": True,
    "require_lowercase": True,
    "require_numbers": True,
    "require_special": False,
    "special_chars": "!@#$%^&*()_+-=[]{}|;:,.<>?",
    "forbidden_patterns": ["password", "123456", "admin"],
    "check_dictionary": True,
    "check_user_info": True  # 不可包含使用者名稱
}
```

### 3.2 密碼強度檢查
```python
class PasswordStrengthChecker:
    def check(self, password, user=None):
        errors = []
        score = 100
        
        # 長度檢查
        if len(password) < self.policy['min_length']:
            errors.append(f"密碼至少需要 {self.policy['min_length']} 個字元")
            score -= 20
        
        # 複雜度檢查
        if self.policy['require_uppercase']:
            if not re.search(r'[A-Z]', password):
                errors.append("需要包含大寫字母")
                score -= 15
        
        if self.policy['require_numbers']:
            if not re.search(r'\d', password):
                errors.append("需要包含數字")
                score -= 15
        
        # 禁用模式檢查
        for pattern in self.policy['forbidden_patterns']:
            if pattern.lower() in password.lower():
                errors.append(f"不可包含 '{pattern}'")
                score -= 25
        
        # 使用者資訊檢查
        if user and self.policy['check_user_info']:
            if user.username.lower() in password.lower():
                errors.append("不可包含使用者名稱")
                score -= 20
        
        return {
            "valid": len(errors) == 0,
            "score": max(0, score),
            "errors": errors,
            "strength": self.get_strength_level(score)
        }
    
    def get_strength_level(self, score):
        if score >= 80: return "強"
        if score >= 60: return "中"
        if score >= 40: return "弱"
        return "極弱"
```

## 4. 密碼生命週期

### 4.1 密碼狀態
```python
class PasswordStatus(Enum):
    NOT_SET = "not_set"              # 從未設定
    VALID = "valid"                   # 有效
    MUST_CHANGE = "must_change"       # 需要變更
    EXPIRED = "expired"               # 已過期
    EXPIRING_SOON = "expiring_soon"   # 即將過期
    LOCKED = "locked"                 # 已鎖定
```

### 4.2 密碼過期處理
```python
class PasswordLifecycleManager:
    def check_password_expiry(self, user):
        if not user.password_set_at:
            return PasswordStatus.NOT_SET
        
        days_used = (datetime.now() - user.password_set_at).days
        policy = self.get_user_policy(user)
        
        if days_used >= policy['expire_days']:
            return PasswordStatus.EXPIRED
        elif days_used >= policy['expire_days'] - 7:
            return PasswordStatus.EXPIRING_SOON
        elif user.force_password_change:
            return PasswordStatus.MUST_CHANGE
        else:
            return PasswordStatus.VALID
    
    def handle_expiry(self, user, status):
        if status == PasswordStatus.EXPIRED:
            # 強制變更密碼
            user.force_password_change = True
            self.send_expiry_notification(user)
            
        elif status == PasswordStatus.EXPIRING_SOON:
            # 提醒變更
            self.send_reminder(user)
```

### 4.3 密碼歷史
```sql
CREATE TABLE password_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    set_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_time (user_id, set_at DESC),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

```python
def check_password_reuse(user_id, new_password_hash, history_count=5):
    """檢查密碼是否重複使用"""
    recent_passwords = PasswordHistory.query.filter_by(
        user_id=user_id
    ).order_by(
        PasswordHistory.set_at.desc()
    ).limit(history_count).all()
    
    for record in recent_passwords:
        if bcrypt.checkpw(new_password, record.password_hash):
            return False, "不可使用最近使用過的密碼"
    
    return True, None
```

## 5. 啟用頁面設計

### 5.1 啟用連結頁面
```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <title>啟用帳號 - RAG系統</title>
    <link rel="stylesheet" href="/css/pages/activation.css">
</head>
<body>
    <div class="activation-container">
        <div class="activation-card">
            <h1>歡迎使用 RAG 知識管理系統</h1>
            
            <div class="user-info">
                <p>您的帳號資訊：</p>
                <dl>
                    <dt>姓名：</dt>
                    <dd id="userName">載入中...</dd>
                    <dt>帳號：</dt>
                    <dd id="username">載入中...</dd>
                    <dt>部門：</dt>
                    <dd id="department">載入中...</dd>
                </dl>
            </div>
            
            <form id="activationForm">
                <div class="form-group">
                    <label>設定您的密碼</label>
                    <input type="password" id="password" class="form-control" required>
                    <div class="password-strength">
                        <div class="strength-bar">
                            <div class="strength-fill" id="strengthBar"></div>
                        </div>
                        <span class="strength-text" id="strengthText">請輸入密碼</span>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>確認密碼</label>
                    <input type="password" id="confirmPassword" class="form-control" required>
                    <span class="error-text" id="confirmError"></span>
                </div>
                
                <div class="password-requirements">
                    <h4>密碼要求：</h4>
                    <ul id="requirementsList">
                        <li data-requirement="length">
                            <i class="fa-solid fa-circle"></i>
                            至少 8 個字元
                        </li>
                        <li data-requirement="uppercase">
                            <i class="fa-solid fa-circle"></i>
                            包含大寫字母
                        </li>
                        <li data-requirement="lowercase">
                            <i class="fa-solid fa-circle"></i>
                            包含小寫字母
                        </li>
                        <li data-requirement="number">
                            <i class="fa-solid fa-circle"></i>
                            包含數字
                        </li>
                    </ul>
                </div>
                
                <button type="submit" class="btn btn-primary btn-block" disabled>
                    啟用帳號
                </button>
            </form>
            
            <div class="activation-footer">
                <p>連結將在 <span id="expireTime">7</span> 天後失效</p>
                <p>如有問題請聯繫系統管理員</p>
            </div>
        </div>
    </div>
    
    <script src="/js/activation.js"></script>
</body>
</html>
```

### 5.2 密碼變更頁面
```html
<div id="changePasswordModal" class="modal">
    <div class="modal-content">
        <div class="modal-header">
            <h3>變更密碼</h3>
            <button class="modal-close" onclick="closePasswordModal()">
                <i class="fa-solid fa-times"></i>
            </button>
        </div>
        <div class="modal-body">
            <form id="changePasswordForm">
                <div class="form-group">
                    <label>目前密碼</label>
                    <input type="password" name="current_password" class="form-control" required>
                </div>
                
                <div class="form-group">
                    <label>新密碼</label>
                    <input type="password" name="new_password" class="form-control" required>
                    <div class="password-meter">
                        <!-- 密碼強度指示器 -->
                    </div>
                </div>
                
                <div class="form-group">
                    <label>確認新密碼</label>
                    <input type="password" name="confirm_password" class="form-control" required>
                </div>
                
                <div class="alert alert-info">
                    <i class="fa-solid fa-info-circle"></i>
                    密碼將在 90 天後過期
                </div>
            </form>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closePasswordModal()">取消</button>
            <button class="btn btn-primary" onclick="changePassword()">變更密碼</button>
        </div>
    </div>
</div>
```

## 6. 批次使用者密碼處理

### 6.1 批次匯入設定
```python
class BatchPasswordStrategy:
    """批次匯入時的密碼策略"""
    
    def process_batch_users(self, users, strategy_config):
        results = []
        
        for user_data in users:
            try:
                # 根據策略處理
                if strategy_config['type'] == 'UNIFORM':
                    # 統一策略
                    result = self.apply_uniform_strategy(
                        user_data, 
                        strategy_config['strategy']
                    )
                    
                elif strategy_config['type'] == 'BY_DEPARTMENT':
                    # 部門差異化
                    dept_strategy = strategy_config['dept_strategies'].get(
                        user_data['department'],
                        strategy_config['default']
                    )
                    result = self.apply_strategy(user_data, dept_strategy)
                    
                elif strategy_config['type'] == 'FROM_FILE':
                    # 從檔案讀取
                    if 'password' in user_data:
                        result = self.set_password_from_file(user_data)
                    else:
                        result = self.apply_default_strategy(user_data)
                
                results.append(result)
                
            except Exception as e:
                results.append({
                    'user': user_data['username'],
                    'success': False,
                    'error': str(e)
                })
        
        return results
```

### 6.2 通知模板
```python
EMAIL_TEMPLATES = {
    "activation": {
        "subject": "啟用您的 RAG 系統帳號",
        "body": """
        <h2>歡迎加入 RAG 知識管理系統</h2>
        
        <p>親愛的 {name}：</p>
        
        <p>您的帳號已建立成功，請點擊下方連結設定密碼並啟用帳號：</p>
        
        <div style="margin: 20px 0;">
            <a href="{activation_link}" 
               style="background: #667eea; color: white; padding: 10px 20px; 
                      text-decoration: none; border-radius: 5px;">
                啟用帳號
            </a>
        </div>
        
        <p>或複製以下連結到瀏覽器：</p>
        <p style="background: #f5f5f5; padding: 10px; word-break: break-all;">
            {activation_link}
        </p>
        
        <p><strong>帳號資訊：</strong></p>
        <ul>
            <li>使用者名稱：{username}</li>
            <li>部門：{department}</li>
            <li>角色：{roles}</li>
        </ul>
        
        <p style="color: #666;">
            此連結將在 7 天後失效。如有問題請聯繫系統管理員。
        </p>
        """
    },
    
    "temp_password": {
        "subject": "您的臨時密碼",
        "body": """
        <p>親愛的 {name}：</p>
        
        <p>您的臨時密碼已產生：</p>
        
        <div style="background: #fffbf0; border: 1px solid #f0ad4e; 
                    padding: 15px; margin: 20px 0;">
            <strong>臨時密碼：</strong> 
            <code style="font-size: 16px; font-family: monospace;">
                {temp_password}
            </code>
        </div>
        
        <p style="color: #d9534f;">
            <strong>重要：</strong>首次登入時您必須變更此密碼。
        </p>
        
        <p>登入連結：<a href="{login_url}">{login_url}</a></p>
        """
    },
    
    "password_expiry": {
        "subject": "密碼即將過期提醒",
        "body": """
        <p>親愛的 {name}：</p>
        
        <p>您的密碼將在 <strong>{days_remaining} 天</strong>後過期。</p>
        
        <p>請儘快登入系統變更密碼，避免帳號被鎖定。</p>
        
        <p>
            <a href="{change_password_url}" 
               style="background: #5cb85c; color: white; padding: 10px 20px; 
                      text-decoration: none; border-radius: 5px;">
                立即變更密碼
            </a>
        </p>
        """
    }
}
```

## 7. 安全措施

### 7.1 密碼儲存
```python
import bcrypt

class PasswordHasher:
    def hash_password(self, password):
        """使用 bcrypt 加密密碼"""
        salt = bcrypt.gensalt(rounds=12)
        return bcrypt.hashpw(password.encode('utf-8'), salt)
    
    def verify_password(self, password, hashed):
        """驗證密碼"""
        return bcrypt.checkpw(
            password.encode('utf-8'), 
            hashed.encode('utf-8')
        )
```

### 7.2 登入失敗處理
```python
class LoginAttemptManager:
    MAX_ATTEMPTS = 5
    LOCKOUT_DURATION = 30  # 分鐘
    
    def record_attempt(self, username, success):
        if success:
            # 清除失敗記錄
            LoginAttempt.query.filter_by(
                username=username
            ).delete()
        else:
            # 記錄失敗
            attempt = LoginAttempt(
                username=username,
                ip_address=request.remote_addr,
                attempted_at=datetime.now()
            )
            db.session.add(attempt)
            
            # 檢查是否需要鎖定
            recent_failures = self.get_recent_failures(username)
            if len(recent_failures) >= self.MAX_ATTEMPTS:
                self.lock_account(username)
    
    def is_locked(self, username):
        lock = AccountLock.query.filter_by(
            username=username,
            active=True
        ).first()
        
        if lock:
            if datetime.now() > lock.expires_at:
                lock.active = False
                db.session.commit()
                return False
            return True
        return False
```

## 8. API 端點

### 8.1 啟用帳號
```
POST /api/auth/activate
```

**請求：**
```json
{
  "token": "activation_token_here",
  "password": "NewPassword123!"
}
```

### 8.2 變更密碼
```
POST /api/auth/change-password
```

**請求：**
```json
{
  "current_password": "OldPassword",
  "new_password": "NewPassword123!"
}
```

### 8.3 重設密碼
```
POST /api/auth/reset-password
```

**請求：**
```json
{
  "email": "user@example.com"
}
```

### 8.4 檢查密碼強度
```
POST /api/auth/check-password-strength
```

**請求：**
```json
{
  "password": "TestPassword123"
}
```

**回應：**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "score": 85,
    "strength": "強",
    "suggestions": []
  }
}
```

## 9. 設定介面

```html
<div class="password-policy-settings">
    <h2>密碼策略設定</h2>
    
    <div class="policy-section">
        <h3>新使用者密碼處理</h3>
        <select name="default_strategy" class="form-control">
            <option value="ACTIVATION_LINK">傳送啟用連結（推薦）</option>
            <option value="TEMP_PASSWORD">產生臨時密碼</option>
            <option value="PATTERN">預設模式</option>
            <option value="LDAP">LDAP 認證</option>
            <option value="NO_LOGIN">禁止登入</option>
        </select>
    </div>
    
    <div class="policy-section">
        <h3>密碼複雜度要求</h3>
        <div class="form-group">
            <label>最小長度</label>
            <input type="number" name="min_length" value="8" min="6" max="32">
        </div>
        
        <div class="form-group">
            <label>
                <input type="checkbox" name="require_uppercase" checked>
                需要大寫字母
            </label>
        </div>
        
        <div class="form-group">
            <label>
                <input type="checkbox" name="require_lowercase" checked>
                需要小寫字母
            </label>
        </div>
        
        <div class="form-group">
            <label>
                <input type="checkbox" name="require_numbers" checked>
                需要數字
            </label>
        </div>
        
        <div class="form-group">
            <label>
                <input type="checkbox" name="require_special">
                需要特殊字元
            </label>
        </div>
    </div>
    
    <div class="policy-section">
        <h3>密碼過期設定</h3>
        <div class="form-group">
            <label>密碼有效期（天）</label>
            <input type="number" name="expire_days" value="90" min="0">
            <small>設為 0 表示永不過期</small>
        </div>
        
        <div class="form-group">
            <label>過期前提醒（天）</label>
            <input type="number" name="remind_days" value="7" min="1">
        </div>
        
        <div class="form-group">
            <label>密碼歷史記錄</label>
            <input type="number" name="history_count" value="5" min="0">
            <small>防止重複使用最近的密碼</small>
        </div>
    </div>
    
    <button class="btn btn-primary" onclick="savePasswordPolicy()">
        儲存設定
    </button>
</div>
```

## 10. 實作檢查清單

- [ ] 建立密碼策略資料表
- [ ] 實作啟用連結機制
- [ ] 實作臨時密碼產生
- [ ] 實作 LDAP 認證代理
- [ ] 建立啟用頁面
- [ ] 實作密碼強度檢查
- [ ] 實作密碼過期處理
- [ ] 實作密碼歷史記錄
- [ ] 建立 Email 通知系統
- [ ] 實作登入失敗鎖定
- [ ] 實作批次處理邏輯
- [ ] 建立設定介面
- [ ] 安全性測試
- [ ] 整合測試

---
*文件版本：1.0*
*最後更新：2025-01-20*