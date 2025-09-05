"""
認證核心邏輯模組
"""
import os
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from passlib.context import CryptContext
from fastapi import HTTPException, status, Depends, Cookie
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError, ExpiredSignatureError

from app.dao.user import user_dao
from app.utils.logging import get_logger

logger = get_logger(__name__)

# 密碼加密上下文
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT 設定
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-this")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("SESSION_TIMEOUT", "3600")) // 60

# HTTP Bearer 認證
security = HTTPBearer(auto_error=False)


class AuthManager:
    """認證管理器"""
    
    def __init__(self):
        self.secret_key = JWT_SECRET_KEY
        self.algorithm = JWT_ALGORITHM
        self.access_token_expire_minutes = ACCESS_TOKEN_EXPIRE_MINUTES
    
    def get_token_settings(self) -> Dict[str, int]:
        """從配置讀取 token 相關設定"""
        try:
            from app.config.settings import app_config
            return {
                'idle_timeout': int(app_config.get('token_idle_timeout', '3600')),
                'max_lifetime': int(app_config.get('token_max_lifetime', '28800')),
                'refresh_threshold': int(app_config.get('token_refresh_threshold', '300'))
            }
        except Exception as e:
            logger.error(f"讀取 token 設定失敗: {e}")
            return {
                'idle_timeout': 3600,
                'max_lifetime': 28800, 
                'refresh_threshold': 300
            }

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """驗證密碼"""
        return pwd_context.verify(plain_password, hashed_password)

    def get_password_hash(self, password: str) -> str:
        """生成密碼雜湊"""
        return pwd_context.hash(password)

    def create_access_token(self, data: Dict[str, Any]) -> str:
        """創建 JWT access token"""
        settings = self.get_token_settings()
        to_encode = data.copy()
        now = datetime.now()
        
        to_encode.update({
            "exp": now + timedelta(seconds=settings['max_lifetime']),
            "iat": now.timestamp(),
            "last_activity": now.timestamp()
        })
        
        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        return encoded_jwt

    def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        """驗證 JWT token"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            settings = self.get_token_settings()
            
            # 檢查閒置時間
            last_activity = payload.get("last_activity")
            if last_activity:
                idle_time = datetime.now().timestamp() - last_activity
                if idle_time > settings['idle_timeout']:
                    logger.warning(f"Token 閒置超時: {idle_time}秒")
                    return None
            
            # 檢查最大生命週期
            iat = payload.get("iat")
            if iat:
                lifetime = datetime.now().timestamp() - iat
                if lifetime > settings['max_lifetime']:
                    logger.warning(f"Token 超過最大生命週期: {lifetime}秒")
                    return None
            
            return payload
        except ExpiredSignatureError:
            logger.warning("Token 已過期")
            return None
        except JWTError as e:
            logger.error(f"JWT 驗證錯誤: {e}")
            return None

    def authenticate_user(self, loginid: str, password: str) -> Optional[Dict[str, Any]]:
        """驗證用戶"""
        user = user_dao.get_user_by_loginid(loginid)
        if not user:
            return None
        if not self.verify_password(password, user["password_hash"]):
            return None
        
        # 檢查帳號是否已過期（排程停用功能）
        if not self._check_account_expiration(user["id"]):
            return None
            
        return user
    
    def _check_account_expiration(self, user_id: int) -> bool:
        """檢查帳號是否已過期"""
        try:
            from datetime import timezone
            from app.dao.organization import OrganizationDAO
            
            user_org_dao = OrganizationDAO()
            current_time = datetime.now(timezone.utc)
            
            # 查詢用戶擴充資訊
            extension = user_org_dao.get_user_extension(user_id)
            if not extension:
                return True  # 沒有擴充資訊，視為正常
            
            # 檢查是否有過期時間設定
            activation_expires = extension.get('activation_expires')
            if activation_expires and activation_expires <= current_time:
                logger.warning(f"使用者帳號已過期 - 用戶ID: {user_id}, 過期時間: {activation_expires}")
                
                # 自動停用已過期的帳號
                from app.dao.user import UserDAO
                user_dao_instance = UserDAO()
                user_dao_instance.update_user_status(user_id, False)
                
                # 清除過期時間標記
                user_org_dao.update_user_extension(user_id, {'activation_expires': None})
                
                logger.info(f"已自動停用過期帳號 - 用戶ID: {user_id}")
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"檢查帳號過期狀態時發生錯誤 - 用戶ID: {user_id}, 錯誤: {e}")
            # 發生錯誤時允許登入，避免系統故障影響正常用戶
            return True

    def _extract_token(
        self,
        credentials: Optional[HTTPAuthorizationCredentials],
        authorization_cookie: Optional[str],
    ) -> Optional[str]:
        """從 header 或 cookie 擷取 token"""
        if credentials and credentials.credentials:
            return credentials.credentials
        elif authorization_cookie:
            return authorization_cookie.strip()
        return None

    def get_current_user(
        self,
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
        authorization_cookie: Optional[str] = Cookie(None),
    ) -> Dict[str, Any]:
        """獲取當前用戶 (支援 header + cookie)"""
        token = self._extract_token(credentials, authorization_cookie)

        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="未提供認證憑證",
                headers={"WWW-Authenticate": "Bearer"},
            )

        payload = self.verify_token(token)
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="無效的認證憑證",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="無效的認證憑證",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user = user_dao.get_user_by_id(user_id)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用戶不存在",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return user

    def get_current_user_optional(
        self,
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
        authorization_cookie: Optional[str] = Cookie(None, alias="access_token"),
    ) -> Optional[Dict[str, Any]]:
        """可選的獲取當前用戶（用於不需要強制登入的端點）"""
        token = self._extract_token(credentials, authorization_cookie)

        if not token:
            return None

        payload = self.verify_token(token)
        if payload is None:
            return None

        user_id = payload.get("sub")
        if user_id is None:
            return None

        user = user_dao.get_user_by_id(user_id)
        if user is None:
            return None

        return user

    def should_refresh_token(self, token: str) -> bool:
        """檢查是否需要刷新 token（基於活動時間檢查）"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            settings = self.get_token_settings()
            
            # 檢查是否接近閒置超時
            last_activity = payload.get("last_activity")
            if last_activity:
                current_time = datetime.now().timestamp()
                idle_time = current_time - last_activity
                
                # 當接近閒置超時時觸發刷新（idle_timeout - refresh_threshold）
                refresh_trigger_time = settings['idle_timeout'] - settings['refresh_threshold']
                if idle_time >= refresh_trigger_time:
                    logger.debug(f"Token 接近閒置超時，觸發刷新: idle_time={idle_time}s, trigger={refresh_trigger_time}s")
                    return True
                    
            return False
        except Exception as e:
            logger.debug(f"檢查 token 刷新條件失敗: {e}")
            return False
    
    def refresh_access_token(self, old_token: str) -> Optional[str]:
        """刷新 access token，保留原始 iat，更新 last_activity 和 exp"""
        try:
            payload = jwt.decode(old_token, self.secret_key, algorithms=[self.algorithm])
            settings = self.get_token_settings()
            now = datetime.now()
            
            # 檢查 token 的最大生命週期
            iat = payload.get("iat")
            if iat:
                lifetime = now.timestamp() - iat
                if lifetime > settings['max_lifetime']:
                    logger.warning(f"Token 已超過最大生命週期，無法刷新: {lifetime}秒")
                    return None
            
            # 保留原始 iat 和其他用戶資訊，僅更新活動時間
            payload["last_activity"] = now.timestamp()
            # exp 保持與原始創建時的邏輯一致：基於創建時間 + max_lifetime
            if iat:
                payload["exp"] = iat + settings['max_lifetime']
            
            new_token = jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
            logger.debug(f"Token 刷新成功，用戶: {payload.get('sub')}")
            return new_token
        except Exception as e:
            logger.error(f"刷新 token 失敗: {e}")
            return None


# 全域認證管理器實例
auth_manager = AuthManager()