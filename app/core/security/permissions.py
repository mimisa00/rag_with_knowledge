"""
權限檢查模組
"""
from typing import Dict, Any
from fastapi import HTTPException, status
from app.utils.logging import get_logger

logger = get_logger(__name__)


def require_admin(user: Dict[str, Any]) -> None:
    """要求管理員權限"""
    if not user or user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="需要管理員權限"
        )


def require_user(user: Dict[str, Any]) -> None:
    """要求用戶權限（已登入即可）"""
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="需要登入"
        )


def require_owner_or_admin(user: Dict[str, Any], resource_user_id: int) -> None:
    """要求資源擁有者或管理員權限"""
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="需要登入"
        )
    
    if user.get("role") == "admin":
        return
    
    if user.get("id") != resource_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只能存取自己的資源"
        )


def check_permission(user: Dict[str, Any], permission: str) -> bool:
    """檢查用戶是否有指定權限"""
    if not user:
        return False
    
    user_role = user.get("role", "")
    
    # 管理員有所有權限
    if user_role == "admin":
        return True
    
    # 根據權限類型檢查
    if permission == "read":
        return user_role in ["admin", "user"]
    elif permission == "write":
        return user_role in ["admin", "user"]
    elif permission == "admin":
        return user_role == "admin"
    
    return False