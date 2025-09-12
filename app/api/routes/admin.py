"""
管理員相關 API 路由
"""

from fastapi import APIRouter, HTTPException, Body, Depends
from typing import Dict, Any

from app.models.request import AdminPasswordChangeRequest, AdminUserUpdateRequest, AdminUserEditRequest
from app.dao.user import user_dao
from app.core.security.auth import auth_manager
from app.api.dependencies import get_admin_user
from app.utils.logging import get_logger
from app.core.security.permissions import permission_required

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
    # 防止管理員停用自己的帳號
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="不能停用自己的帳號")
    
    # 嘗試停用用戶
    result = user_dao.deactivate_user(user_id)
    
    if not result["success"]:
        error_message = result.get("error", "停用失敗")
        
        # 根據不同錯誤類型回傳適當的 HTTP 狀態碼
        if error_message == "用戶不存在":
            raise HTTPException(status_code=404, detail=error_message)
        elif error_message == "用戶已經是停用狀態":
            raise HTTPException(status_code=400, detail=error_message)
        else:
            # 系統錯誤
            logger.error(f"停用用戶 {user_id} 失敗: {error_message}")
            raise HTTPException(status_code=500, detail=f"停用失敗: {error_message}")

    logger.info(f"管理員 {current_user['id']} 成功停用用戶 {user_id}")
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
    # 檢查用戶是否存在（包括停用的用戶）
    user = user_dao.get_user_by_id(user_id, include_inactive=True)
    if not user:
        raise HTTPException(status_code=404, detail="用戶不存在")

    # 生成新密碼雜湊
    new_password_hash = auth_manager.get_password_hash(password_data.new_password)

    # 更新資料庫
    success = user_dao.update_user_password(user_id, new_password_hash)
    if not success:
        raise HTTPException(status_code=500, detail="密碼更新失敗")

    return {"message": "密碼變更成功"}


@router.put("/admin/users/{user_id}")
def api_admin_edit_user(
    user_id: int,
    user_data: AdminUserEditRequest = Body(...),
    current_user: Dict[str, Any] = Depends(get_admin_user),
):
    """管理員編輯用戶資訊"""
    # 檢查用戶是否存在
    user = user_dao.get_user_by_id(user_id, include_inactive=True)
    if not user:
        raise HTTPException(status_code=404, detail="用戶不存在")
    
    # 防止管理員停用自己的帳號
    if user_data.is_active is False and user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="不能停用自己的帳號")
    
    # 準備更新資料
    updates = {}
    if user_data.username is not None:
        updates["username"] = user_data.username
    if user_data.email is not None:
        updates["email"] = user_data.email
    if user_data.is_active is not None:
        updates["is_active"] = user_data.is_active
    
    # 如果沒有要更新的內容
    if not updates:
        return {"message": "沒有變更"}
    
    # 更新用戶資料
    success = user_dao.update_user(user_id, updates)
    if not success:
        raise HTTPException(status_code=500, detail="更新用戶資訊失敗")
    
    return {"message": "用戶資訊更新成功"}


@router.get("/admin/login-stats")
@permission_required("ADMIN.STATS_VIEW")
def api_get_login_stats(current_user: Dict[str, Any] = Depends(get_admin_user)):
    """獲取登入統計資料（管理員功能）"""
    try:
        stats = user_dao.get_login_statistics()
        return stats
    except Exception as e:
        logger.error(f"獲取登入統計失敗: {e}")
        raise HTTPException(status_code=500, detail="獲取統計資料失敗")


@router.get("/admin/anomaly-monitor")
@permission_required("ADMIN.LOG_VIEW")
def api_get_security_anomalies(current_user: Dict[str, Any] = Depends(get_admin_user)):
    """獲取安全異常監控資料（管理員功能）"""
    try:
        anomalies = user_dao.get_security_anomalies()
        return anomalies
    except Exception as e:
        logger.error(f"獲取安全異常監控資料失敗: {e}")
        raise HTTPException(status_code=500, detail="獲取異常監控資料失敗")
