"""
API 依賴項模組

提供 FastAPI 路由的公共依賴項
"""
from typing import Dict, Any, Optional
from fastapi import Depends, Cookie
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.security.auth import auth_manager
from app.core.security.permissions import require_admin, require_user

# HTTP Bearer 認證
security = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    authorization_cookie: Optional[str] = Cookie(None, alias="access_token"),
) -> Dict[str, Any]:
    """FastAPI 依賴：獲取當前用戶"""
    return auth_manager.get_current_user(credentials, authorization_cookie)


def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    authorization_cookie: Optional[str] = Cookie(None, alias="access_token"),
) -> Optional[Dict[str, Any]]:
    """FastAPI 依賴：可選的獲取當前用戶"""
    return auth_manager.get_current_user_optional(credentials, authorization_cookie)


def get_admin_user(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """FastAPI 依賴：要求管理員權限"""
    require_admin(current_user)
    return current_user


def get_authenticated_user(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """FastAPI 依賴：要求已認證用戶"""
    require_user(current_user)
    return current_user