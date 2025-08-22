# SSO 整合規格書

## 1. 概述
本文件定義單一登入（SSO）整合的設計規格，支援 OAuth 2.0 和 Atlassian Crowd 兩種主要方式。

## 2. SSO 架構設計

### 2.1 抽象層設計
```python
from abc import ABC, abstractmethod

class SSOProvider(ABC):
    """SSO 提供者抽象類別"""
    
    @abstractmethod
    def authenticate(self, credentials):
        """認證使用者"""
        pass
    
    @abstractmethod
    def get_user_info(self, token):
        """取得使用者資訊"""
        pass
    
    @abstractmethod
    def validate_session(self, session_id):
        """驗證會話"""
        pass
    
    @abstractmethod
    def logout(self, session_id):
        """登出"""
        pass
    
    @abstractmethod
    def refresh_token(self, refresh_token):
        """更新 token"""
        pass
```

### 2.2 提供者工廠
```python
class SSOFactory:
    """SSO 提供者工廠"""
    
    _providers = {}
    
    @classmethod
    def register_provider(cls, name, provider_class):
        """註冊提供者"""
        cls._providers[name] = provider_class
    
    @classmethod
    def get_provider(cls, config):
        """根據設定取得提供者"""
        provider_type = config.get('provider_type')
        provider_class = cls._providers.get(provider_type)
        
        if not provider_class:
            raise ValueError(f"Unknown SSO provider: {provider_type}")
        
        return provider_class(config)

# 註冊提供者
SSOFactory.register_provider('oauth', OAuth2Provider)
SSOFactory.register_provider('crowd', CrowdProvider)
SSOFactory.register_provider('saml', SAMLProvider)
```

## 3. OAuth 2.0 實作

### 3.1 OAuth 設定
```json
{
  "oauth_config": {
    "provider": "google",
    "client_id": "your-client-id.apps.googleusercontent.com",
    "client_secret": "your-client-secret",
    "authorization_url": "https://accounts.google.com/o/oauth2/v2/auth",
    "token_url": "https://oauth2.googleapis.com/token",
    "userinfo_url": "https://www.googleapis.com/oauth2/v1/userinfo",
    "redirect_uri": "https://your-domain.com/auth/callback",
    "scope": "openid email profile",
    "response_type": "code",
    "grant_type": "authorization_code"
  }
}
```

### 3.2 OAuth 提供者實作
```python
import requests
from urllib.parse import urlencode

class OAuth2Provider(SSOProvider):
    """OAuth 2.0 提供者"""
    
    def __init__(self, config):
        self.config = config
        self.client_id = config['client_id']
        self.client_secret = config['client_secret']
        self.redirect_uri = config['redirect_uri']
    
    def get_authorization_url(self, state=None):
        """取得授權 URL"""
        params = {
            'client_id': self.client_id,
            'redirect_uri': self.redirect_uri,
            'response_type': self.config['response_type'],
            'scope': self.config['scope'],
            'access_type': 'offline',
            'prompt': 'consent'
        }
        
        if state:
            params['state'] = state
        
        return f"{self.config['authorization_url']}?{urlencode(params)}"
    
    def exchange_code_for_token(self, code):
        """用授權碼換取 token"""
        data = {
            'code': code,
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'redirect_uri': self.redirect_uri,
            'grant_type': 'authorization_code'
        }
        
        response = requests.post(self.config['token_url'], data=data)
        response.raise_for_status()
        
        return response.json()
    
    def get_user_info(self, access_token):
        """取得使用者資訊"""
        headers = {'Authorization': f'Bearer {access_token}'}
        response = requests.get(self.config['userinfo_url'], headers=headers)
        response.raise_for_status()
        
        user_info = response.json()
        
        # 標準化使用者資訊
        return self.normalize_user_info(user_info)
    
    def normalize_user_info(self, raw_info):
        """標準化不同提供者的使用者資訊"""
        # Google
        if self.config['provider'] == 'google':
            return {
                'id': raw_info['id'],
                'email': raw_info['email'],
                'name': raw_info['name'],
                'picture': raw_info.get('picture'),
                'verified': raw_info.get('verified_email', False)
            }
        
        # Azure AD
        elif self.config['provider'] == 'azure':
            return {
                'id': raw_info['id'],
                'email': raw_info['userPrincipalName'],
                'name': raw_info['displayName'],
                'department': raw_info.get('department'),
                'job_title': raw_info.get('jobTitle')
            }
        
        # 通用
        return raw_info
    
    def refresh_token(self, refresh_token):
        """更新 access token"""
        data = {
            'refresh_token': refresh_token,
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'grant_type': 'refresh_token'
        }
        
        response = requests.post(self.config['token_url'], data=data)
        response.raise_for_status()
        
        return response.json()
```

### 3.3 OAuth 流程
```python
class OAuth2Flow:
    """OAuth 2.0 認證流程"""
    
    def __init__(self, provider):
        self.provider = provider
    
    def initiate_auth(self):
        """啟動認證流程"""
        import secrets
        
        # 產生 state 防止 CSRF
        state = secrets.token_urlsafe(32)
        session['oauth_state'] = state
        
        # 取得授權 URL
        auth_url = self.provider.get_authorization_url(state)
        
        return redirect(auth_url)
    
    def handle_callback(self, request):
        """處理回調"""
        # 驗證 state
        state = request.args.get('state')
        if state != session.pop('oauth_state', None):
            raise SecurityError('Invalid state parameter')
        
        # 檢查錯誤
        error = request.args.get('error')
        if error:
            raise AuthenticationError(f'OAuth error: {error}')
        
        # 取得授權碼
        code = request.args.get('code')
        if not code:
            raise AuthenticationError('No authorization code received')
        
        # 換取 token
        token_data = self.provider.exchange_code_for_token(code)
        
        # 取得使用者資訊
        user_info = self.provider.get_user_info(token_data['access_token'])
        
        # 建立或更新本地使用者
        user = self.sync_user(user_info)
        
        # 建立 session
        self.create_session(user, token_data)
        
        return user
    
    def sync_user(self, user_info):
        """同步使用者資訊"""
        user = User.query.filter_by(
            external_id=user_info['id'],
            auth_source='oauth'
        ).first()
        
        if not user:
            # 建立新使用者
            user = User(
                external_id=user_info['id'],
                username=user_info['email'].split('@')[0],
                email=user_info['email'],
                name=user_info['name'],
                auth_source='oauth',
                status='active'
            )
            db.session.add(user)
        else:
            # 更新既有使用者
            user.name = user_info['name']
            user.last_login = datetime.now()
        
        db.session.commit()
        return user
```

## 4. Crowd SSO 實作

### 4.1 Crowd 設定
```json
{
  "crowd_config": {
    "server_url": "https://crowd.company.com",
    "application_name": "rag_system",
    "application_password": "encrypted_password",
    "cookie_domain": ".company.com",
    "session_validation_interval": 60,
    "cache_enabled": true,
    "cache_ttl": 300
  }
}
```

### 4.2 Crowd 提供者實作
```python
import requests
from requests.auth import HTTPBasicAuth

class CrowdProvider(SSOProvider):
    """Atlassian Crowd SSO 提供者"""
    
    def __init__(self, config):
        self.config = config
        self.base_url = config['server_url']
        self.app_name = config['application_name']
        self.app_password = config['application_password']
        self.auth = HTTPBasicAuth(self.app_name, self.app_password)
        self.session_cache = {}
    
    def authenticate(self, username, password):
        """認證使用者"""
        url = f"{self.base_url}/rest/usermanagement/1/authentication"
        
        data = {
            'username': username,
            'password': password
        }
        
        response = requests.post(
            url,
            json=data,
            auth=self.auth,
            params={'username': username}
        )
        
        if response.status_code == 200:
            # 建立 SSO session
            session_token = self.create_sso_session(username)
            return {
                'success': True,
                'user': response.json(),
                'session_token': session_token
            }
        elif response.status_code == 400:
            return {'success': False, 'error': 'Invalid credentials'}
        else:
            response.raise_for_status()
    
    def create_sso_session(self, username):
        """建立 SSO session"""
        url = f"{self.base_url}/rest/usermanagement/1/session"
        
        data = {
            'username': username,
            'remote_address': request.remote_addr,
            'validation_factors': {
                'remote_address': request.remote_addr,
                'user_agent': request.headers.get('User-Agent')
            }
        }
        
        response = requests.post(url, json=data, auth=self.auth)
        response.raise_for_status()
        
        session_data = response.json()
        token = session_data['token']
        
        # 快取 session
        self.session_cache[token] = {
            'username': username,
            'created_at': datetime.now(),
            'data': session_data
        }
        
        return token
    
    def validate_session(self, token):
        """驗證 SSO session"""
        # 檢查快取
        if token in self.session_cache:
            cached = self.session_cache[token]
            age = (datetime.now() - cached['created_at']).seconds
            
            if age < self.config.get('cache_ttl', 300):
                return {'valid': True, 'user': cached['username']}
        
        # 向 Crowd 驗證
        url = f"{self.base_url}/rest/usermanagement/1/session/{token}"
        
        response = requests.get(url, auth=self.auth)
        
        if response.status_code == 200:
            session_data = response.json()
            
            # 更新快取
            self.session_cache[token] = {
                'username': session_data['user']['name'],
                'created_at': datetime.now(),
                'data': session_data
            }
            
            return {
                'valid': True,
                'user': session_data['user']['name']
            }
        
        return {'valid': False}
    
    def get_user_info(self, username):
        """取得使用者詳細資訊"""
        url = f"{self.base_url}/rest/usermanagement/1/user"
        
        response = requests.get(
            url,
            auth=self.auth,
            params={'username': username, 'expand': 'attributes'}
        )
        
        if response.status_code == 200:
            user_data = response.json()
            
            # 取得群組
            groups = self.get_user_groups(username)
            
            return {
                'username': user_data['name'],
                'email': user_data['email'],
                'display_name': user_data['display-name'],
                'active': user_data['active'],
                'groups': groups,
                'attributes': user_data.get('attributes', {})
            }
        
        return None
    
    def get_user_groups(self, username):
        """取得使用者群組"""
        url = f"{self.base_url}/rest/usermanagement/1/user/group/direct"
        
        response = requests.get(
            url,
            auth=self.auth,
            params={'username': username}
        )
        
        if response.status_code == 200:
            groups = response.json()['groups']
            return [g['name'] for g in groups]
        
        return []
    
    def logout(self, token):
        """登出 SSO session"""
        url = f"{self.base_url}/rest/usermanagement/1/session/{token}"
        
        response = requests.delete(url, auth=self.auth)
        
        # 清除快取
        if token in self.session_cache:
            del self.session_cache[token]
        
        return response.status_code == 204
```

### 4.3 Crowd Cookie 處理
```python
class CrowdCookieAuth:
    """Crowd Cookie 認證"""
    
    COOKIE_NAME = 'crowd.token_key'
    
    def __init__(self, crowd_provider):
        self.crowd = crowd_provider
    
    def authenticate_request(self, request):
        """從請求中認證"""
        # 取得 Crowd token
        token = request.cookies.get(self.COOKIE_NAME)
        
        if not token:
            return None
        
        # 驗證 token
        validation = self.crowd.validate_session(token)
        
        if validation['valid']:
            # 取得使用者資訊
            user_info = self.crowd.get_user_info(validation['user'])
            
            # 同步本地使用者
            user = self.sync_user(user_info)
            
            return user
        
        return None
    
    def set_cookie(self, response, token):
        """設定 Crowd cookie"""
        response.set_cookie(
            self.COOKIE_NAME,
            token,
            domain=self.crowd.config.get('cookie_domain'),
            secure=True,
            httponly=True,
            samesite='Lax'
        )
    
    def clear_cookie(self, response):
        """清除 Crowd cookie"""
        response.delete_cookie(
            self.COOKIE_NAME,
            domain=self.crowd.config.get('cookie_domain')
        )
```

## 5. SSO 設定介面

### 5.1 SSO 設定頁面
```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <title>SSO 設定 - RAG系統</title>
    <link rel="stylesheet" href="/css/pages/sso-settings.css">
</head>
<body class="admin-layout">
    <div class="admin-container">
        <h1>單一登入（SSO）設定</h1>
        
        <!-- SSO 模式選擇 -->
        <div class="sso-mode-selector">
            <h2>選擇 SSO 提供者</h2>
            
            <div class="provider-options">
                <div class="provider-card">
                    <input type="radio" name="sso_provider" value="oauth" id="oauth_provider">
                    <label for="oauth_provider">
                        <i class="fa-brands fa-google"></i>
                        <h3>OAuth 2.0</h3>
                        <p>支援 Google、Azure AD、GitHub 等</p>
                    </label>
                </div>
                
                <div class="provider-card">
                    <input type="radio" name="sso_provider" value="crowd" id="crowd_provider">
                    <label for="crowd_provider">
                        <i class="fa-brands fa-atlassian"></i>
                        <h3>Atlassian Crowd</h3>
                        <p>企業級 SSO 解決方案</p>
                    </label>
                </div>
                
                <div class="provider-card">
                    <input type="radio" name="sso_provider" value="saml" id="saml_provider">
                    <label for="saml_provider">
                        <i class="fa-solid fa-key"></i>
                        <h3>SAML 2.0</h3>
                        <p>標準化企業 SSO（即將推出）</p>
                    </label>
                </div>
            </div>
        </div>
        
        <!-- OAuth 設定 -->
        <div class="provider-settings" id="oauth_settings" style="display:none;">
            <h2>OAuth 2.0 設定</h2>
            
            <form id="oauthForm">
                <div class="form-group">
                    <label>OAuth 提供者</label>
                    <select name="oauth_provider" class="form-control">
                        <option value="google">Google</option>
                        <option value="azure">Azure AD</option>
                        <option value="github">GitHub</option>
                        <option value="custom">自訂</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>Client ID <span class="required">*</span></label>
                    <input type="text" name="client_id" class="form-control" required>
                    <small>從 OAuth 提供者取得的 Client ID</small>
                </div>
                
                <div class="form-group">
                    <label>Client Secret <span class="required">*</span></label>
                    <input type="password" name="client_secret" class="form-control" required>
                    <small>從 OAuth 提供者取得的 Client Secret</small>
                </div>
                
                <div class="form-group">
                    <label>Redirect URI</label>
                    <div class="input-group">
                        <input type="text" class="form-control" 
                               value="https://your-domain.com/auth/callback" readonly>
                        <button type="button" class="btn btn-sm" onclick="copyRedirectUri()">
                            <i class="fa-solid fa-copy"></i> 複製
                        </button>
                    </div>
                    <small>在 OAuth 提供者設定此 Redirect URI</small>
                </div>
                
                <div class="form-group">
                    <label>權限範圍 (Scopes)</label>
                    <input type="text" name="scope" class="form-control" 
                           value="openid email profile" placeholder="openid email profile">
                </div>
                
                <!-- 自訂 OAuth 設定 -->
                <div id="custom_oauth" style="display:none;">
                    <h3>自訂 OAuth 端點</h3>
                    
                    <div class="form-group">
                        <label>Authorization URL</label>
                        <input type="url" name="authorization_url" class="form-control">
                    </div>
                    
                    <div class="form-group">
                        <label>Token URL</label>
                        <input type="url" name="token_url" class="form-control">
                    </div>
                    
                    <div class="form-group">
                        <label>User Info URL</label>
                        <input type="url" name="userinfo_url" class="form-control">
                    </div>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="testOAuth()">
                        測試連線
                    </button>
                    <button type="submit" class="btn btn-primary">
                        儲存設定
                    </button>
                </div>
            </form>
        </div>
        
        <!-- Crowd 設定 -->
        <div class="provider-settings" id="crowd_settings" style="display:none;">
            <h2>Atlassian Crowd 設定</h2>
            
            <form id="crowdForm">
                <div class="form-group">
                    <label>Crowd Server URL <span class="required">*</span></label>
                    <input type="url" name="server_url" class="form-control" 
                           placeholder="https://crowd.company.com" required>
                </div>
                
                <div class="form-group">
                    <label>Application Name <span class="required">*</span></label>
                    <input type="text" name="application_name" class="form-control" required>
                    <small>在 Crowd 中註冊的應用程式名稱</small>
                </div>
                
                <div class="form-group">
                    <label>Application Password <span class="required">*</span></label>
                    <input type="password" name="application_password" class="form-control" required>
                </div>
                
                <div class="form-group">
                    <label>Cookie Domain</label>
                    <input type="text" name="cookie_domain" class="form-control" 
                           placeholder=".company.com">
                    <small>SSO Cookie 的網域範圍</small>
                </div>
                
                <div class="form-group">
                    <label>Session 驗證間隔（秒）</label>
                    <input type="number" name="session_validation_interval" 
                           class="form-control" value="60" min="10" max="3600">
                </div>
                
                <div class="form-group">
                    <label>
                        <input type="checkbox" name="cache_enabled" checked>
                        啟用 Session 快取
                    </label>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="testCrowd()">
                        測試連線
                    </button>
                    <button type="submit" class="btn btn-primary">
                        儲存設定
                    </button>
                </div>
            </form>
        </div>
        
        <!-- SSO 狀態 -->
        <div class="sso-status">
            <h2>SSO 狀態</h2>
            
            <div class="status-grid">
                <div class="status-item">
                    <span class="label">狀態：</span>
                    <span class="value" id="ssoStatus">
                        <i class="fa-solid fa-circle text-success"></i> 已啟用
                    </span>
                </div>
                
                <div class="status-item">
                    <span class="label">提供者：</span>
                    <span class="value" id="ssoProvider">OAuth 2.0 (Google)</span>
                </div>
                
                <div class="status-item">
                    <span class="label">使用者數：</span>
                    <span class="value" id="ssoUsers">234</span>
                </div>
                
                <div class="status-item">
                    <span class="label">最後同步：</span>
                    <span class="value" id="lastSync">2025-01-20 10:30</span>
                </div>
            </div>
            
            <div class="status-actions">
                <button class="btn btn-info" onclick="syncUsers()">
                    <i class="fa-solid fa-sync"></i> 同步使用者
                </button>
                <button class="btn btn-warning" onclick="clearCache()">
                    <i class="fa-solid fa-trash"></i> 清除快取
                </button>
                <button class="btn btn-danger" onclick="disableSSO()">
                    <i class="fa-solid fa-power-off"></i> 停用 SSO
                </button>
            </div>
        </div>
        
        <!-- 測試結果 -->
        <div id="testResult" class="test-result" style="display:none;">
            <h3>測試結果</h3>
            <div class="result-content" id="resultContent">
                <!-- 動態顯示測試結果 -->
            </div>
        </div>
    </div>
    
    <script src="/js/sso-settings.js"></script>
</body>
</html>
```

## 6. 使用者同步

### 6.1 同步管理器
```python
class SSOUserSyncManager:
    """SSO 使用者同步管理器"""
    
    def __init__(self, sso_provider):
        self.provider = sso_provider
    
    def sync_user(self, sso_user_info):
        """同步單一使用者"""
        # 查找既有使用者
        user = User.query.filter_by(
            external_id=sso_user_info.get('id'),
            auth_source=self.provider.name
        ).first()
        
        if not user:
            # 建立新使用者
            user = self.create_user(sso_user_info)
        else:
            # 更新使用者資訊
            user = self.update_user(user, sso_user_info)
        
        # 同步群組/角色
        self.sync_groups(user, sso_user_info.get('groups', []))
        
        # 同步部門
        self.sync_department(user, sso_user_info.get('department'))
        
        db.session.commit()
        return user
    
    def create_user(self, sso_info):
        """建立使用者"""
        user = User(
            external_id=sso_info['id'],
            username=sso_info.get('username', sso_info['email'].split('@')[0]),
            email=sso_info['email'],
            name=sso_info.get('name', sso_info['email']),
            auth_source=self.provider.name,
            status='active'
        )
        
        # 建立擴充資訊
        user_ext = UserExtension(
            user=user,
            auth_source=self.provider.name,
            last_sync_at=datetime.now()
        )
        
        db.session.add(user)
        db.session.add(user_ext)
        
        return user
    
    def sync_groups(self, user, sso_groups):
        """同步群組到角色"""
        # 群組到角色的映射
        group_role_mapping = {
            'administrators': 'SYSTEM_ADMIN',
            'managers': 'KB_MANAGER',
            'users': 'USER'
        }
        
        # 清除既有角色
        UserRole.query.filter_by(user_id=user.id).delete()
        
        # 分配新角色
        for group in sso_groups:
            role_code = group_role_mapping.get(group.lower())
            if role_code:
                role = Role.query.filter_by(code=role_code).first()
                if role:
                    user_role = UserRole(
                        user_id=user.id,
                        role_id=role.id
                    )
                    db.session.add(user_role)
```

## 7. API 端點

### 7.1 SSO 設定
```
GET /api/sso/config
PUT /api/sso/config
POST /api/sso/test
```

### 7.2 SSO 認證
```
GET /api/sso/login
GET /api/sso/callback
POST /api/sso/logout
```

### 7.3 使用者同步
```
POST /api/sso/sync-users
GET /api/sso/sync-status
```

## 8. 實作檢查清單

- [ ] 建立 SSO 抽象層
- [ ] 實作 OAuth 2.0 提供者
- [ ] 實作 Crowd 提供者
- [ ] 建立 SSO 設定介面
- [ ] 實作認證流程
- [ ] 實作使用者同步
- [ ] 實作 session 管理
- [ ] 實作 token 更新機制
- [ ] 建立測試工具
- [ ] 錯誤處理
- [ ] 安全性檢查
- [ ] 整合測試

---
*文件版本：1.0*
*最後更新：2025-01-20*