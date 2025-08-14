"""
管理員相關 API 路由
"""

from fastapi import APIRouter, HTTPException, Body, Depends
from typing import Dict, Any

from app.models.request import AdminPasswordChangeRequest, AdminUserUpdateRequest
from app.dao.user import user_dao
from app.core.security.auth import auth_manager
from app.api.dependencies import get_admin_user
from app.utils.logging import get_logger

logger = get_logger(__name__)
router = APIRouter()


@router.get("/admin/users")
def api_get_all_users(current_user: Dict[str, Any] = Depends(get_admin_user)):
    """獲取所有用戶（管理員功能）"""
    try:
        users = user_dao.get_all_users()
        return users
    except Exception as e:
        logger.error(f"獲取用戶列表失敗: {e}")
        return []


@router.put("/admin/users/{user_id}/admin")
def api_update_user_admin_status(
    user_id: int,
    admin_data: AdminUserUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_admin_user),
):
    """更新用戶管理員狀態（管理員功能）"""
    success = user_dao.update_user_role(user_id, admin_data.role)
    if not success:
        raise HTTPException(status_code=500, detail="更新失敗")

    return {"message": "更新成功"}


@router.put("/admin/users/{user_id}/deactivate")
def deactivate_user(
    user_id: int, current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """停用用戶（管理員功能）"""
    success = user_dao.deactivate_user(user_id)
    if not success:
        raise HTTPException(status_code=500, detail="停用失敗")

    return {"message": "用戶已停用"}


@router.put("/admin/users/{user_id}/activate")
def activate_user(user_id: int, current_user: Dict[str, Any] = Depends(get_admin_user)):
    """啟用用戶（管理員功能）"""
    success = user_dao.activate_user(user_id)
    if not success:
        raise HTTPException(status_code=500, detail="啟用失敗")

    return {"message": "用戶已啟用"}


@router.post("/admin/users/{user_id}/change-password")
def api_admin_change_password(
    user_id: int,
    password_data: AdminPasswordChangeRequest = Body(...),
    current_user: Dict[str, Any] = Depends(get_admin_user),
):
    """管理員變更任意用戶密碼"""
    # 檢查用戶是否存在
    user = user_dao.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用戶不存在")

    # 生成新密碼雜湊
    new_password_hash = auth_manager.get_password_hash(password_data.new_password)

    # 更新資料庫
    success = user_dao.update_user_password(user_id, new_password_hash)
    if not success:
        raise HTTPException(status_code=500, detail="密碼更新失敗")

    return {"message": "密碼變更成功"}
