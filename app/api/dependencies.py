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
    user = auth_manager.get_current_user(credentials, authorization_cookie)
    
    # 更新用戶最後活動時間（用於活動統計）
    if user and user.get("id"):
        from app.dao.user import user_dao
        user_dao.update_activity_time(user["id"])
    
    return user


def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    authorization_cookie: Optional[str] = Cookie(None, alias="access_token"),
) -> Optional[Dict[str, Any]]:
    """FastAPI 依賴：可選的獲取當前用戶"""
    return auth_manager.get_current_user_optional(credentials, authorization_cookie)


def get_admin_user(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """FastAPI 依賴：要求管理員權限（支援 role 或權限群組）"""
    from app.core.security.permissions import check_permission
    from fastapi import HTTPException, status
    
    # 方式1: 檢查 role 是否為 admin
    if current_user and current_user.get("role") == "admin":
        return current_user
    
    # 方式2: 檢查是否有 ADMIN.ACCESS 權限（透過權限群組）
    if current_user and check_permission(current_user, "ADMIN.ACCESS"):
        return current_user
    
    # 都不符合，拒絕存取
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="需要管理員權限"
    )
    return current_user


def get_authenticated_user(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """FastAPI 依賴：要求已認證用戶"""
    require_user(current_user)
    return current_user