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

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """驗證密碼"""
        return pwd_context.verify(plain_password, hashed_password)

    def get_password_hash(self, password: str) -> str:
        """生成密碼雜湊"""
        return pwd_context.hash(password)

    def create_access_token(self, data: Dict[str, Any]) -> str:
        """創建 JWT access token"""
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(minutes=self.access_token_expire_minutes)
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        return encoded_jwt

    def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        """驗證 JWT token"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
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
        return user

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


# 全域認證管理器實例
auth_manager = AuthManager()