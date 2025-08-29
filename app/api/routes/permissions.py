"""
組織管理系統 API 路由
"""
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from app.api.dependencies import get_current_user, get_admin_user
from app.models.organization import (
    Department, DepartmentCreate, DepartmentUpdate, DepartmentResponse,
    PermissionGroup, PermissionGroupCreate, PermissionGroupUpdate, PermissionGroupResponse,
    UserExtension, UserExtensionUpdate, UserUpdate, UserPermissionGroupAssign,
    SystemMode, SystemModeUpdate, UserWithPermissionGroups,
    AuditLog
)
from app.dao.organization import (
    department_dao, permission_group_dao, user_org_dao, 
    system_mode_dao, audit_log_dao
)
from app.dao.user import user_dao
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/permissions", tags=["Permissions"])


# ===== 權限矩陣 API =====

@router.get("/matrix")
def get_permission_matrix(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """取得權限矩陣（從 configs 表讀取）"""
    try:
        from app.dao.base import BaseDAO, db_manager
        import json
        
        # 使用 BaseDAO 執行查詢
        dao = BaseDAO(db_manager)
        query = "SELECT value FROM configs WHERE `key` = 'permission_matrix'"
        result = dao.execute_query(query)
        
        if result and len(result) > 0:
            # 解析 JSON 字串
            permission_data = json.loads(result[0]['value'])
            return permission_data
        else:
            # 如果沒有設定，返回預設值
            return {
                "modules": [
                    {
                        "key": "knowledge_base",
                        "name": "知識庫管理",
                        "description": "管理知識庫的建立、編輯、刪除等操作",
                        "actions": [
                            {"key": "create", "name": "建立", "description": "建立新知識庫"},
                            {"key": "read", "name": "檢視", "description": "檢視知識庫內容"},
                            {"key": "update", "name": "編輯", "description": "編輯知識庫設定"},
                            {"key": "delete", "name": "刪除", "description": "刪除知識庫"},
                            {"key": "index", "name": "建立索引", "description": "建立或重建索引"}
                        ]
                    },
                    {
                        "key": "documents",
                        "name": "文件管理",
                        "description": "管理文件的上傳、編輯、刪除等操作",
                        "actions": [
                            {"key": "upload", "name": "上傳", "description": "上傳新文件"},
                            {"key": "read", "name": "檢視", "description": "檢視文件內容"},
                            {"key": "update", "name": "編輯", "description": "編輯文件內容"},
                            {"key": "delete", "name": "刪除", "description": "刪除文件"},
                            {"key": "download", "name": "下載", "description": "下載文件"}
                        ]
                    },
                    {
                        "key": "users",
                        "name": "使用者管理",
                        "description": "管理使用者帳號和權限",
                        "actions": [
                            {"key": "create", "name": "建立", "description": "建立新使用者"},
                            {"key": "read", "name": "檢視", "description": "檢視使用者資訊"},
                            {"key": "update", "name": "編輯", "description": "編輯使用者資訊"},
                            {"key": "delete", "name": "刪除", "description": "刪除使用者"},
                            {"key": "reset_password", "name": "重設密碼", "description": "重設使用者密碼"}
                        ]
                    },
                    {
                        "key": "organization",
                        "name": "組織管理",
                        "description": "管理部門、角色和組織架構",
                        "actions": [
                            {"key": "manage_dept", "name": "管理部門", "description": "建立、編輯、刪除部門"},
                            {"key": "manage_permission_group", "name": "管理權限群組", "description": "建立、編輯、刪除權限群組"},
                            {"key": "assign_permission_group", "name": "分配權限群組", "description": "分配權限群組給使用者"},
                            {"key": "view_structure", "name": "檢視架構", "description": "檢視組織架構"}
                        ]
                    },
                    {
                        "key": "system",
                        "name": "系統設定",
                        "description": "系統層級的設定和管理",
                        "actions": [
                            {"key": "config", "name": "系統設定", "description": "修改系統設定"},
                            {"key": "audit", "name": "審計日誌", "description": "檢視審計日誌"},
                            {"key": "backup", "name": "備份還原", "description": "執行備份和還原"},
                            {"key": "maintenance", "name": "系統維護", "description": "執行系統維護"}
                        ]
                    },
                    {
                        "key": "chat",
                        "name": "對話管理",
                        "description": "管理 AI 對話相關功能",
                        "actions": [
                            {"key": "use", "name": "使用對話", "description": "使用 AI 對話功能"},
                            {"key": "view_history", "name": "檢視歷史", "description": "檢視對話歷史"},
                            {"key": "export", "name": "匯出對話", "description": "匯出對話記錄"},
                            {"key": "manage_prompt", "name": "管理提示詞", "description": "管理系統提示詞"}
                        ]
                    }
                ]
            }
    except Exception as e:
        logger.error(f"Error getting permission matrix: {e}")
        raise HTTPException(status_code=500, detail="取得權限矩陣時發生錯誤")


# ===== 權限群組管理 API =====
@router.post("/groups", response_model=Dict[str, Any])
async def create_permission_group(
    request: Request,
    permission_group: PermissionGroupCreate,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """建立新權限群組"""
    try:
        # 記錄原始請求資料（在 Pydantic 驗證之後）
        logger.info(f"建立權限群組請求 - 用戶: {current_user.get('username')}")
        logger.info(f"建立權限群組請求資料: {permission_group.dict()}")
        logger.info(f"請求 URL: {request.url}")
        logger.info(f"請求方法: {request.method}")
        
        # 額外驗證：檢查必填欄位不能為空字串或只有空白
        if not permission_group.code or not permission_group.code.strip():
            raise HTTPException(status_code=400, detail="權限群組代碼不能為空")
        
        if not permission_group.name or not permission_group.name.strip():
            raise HTTPException(status_code=400, detail="權限群組名稱不能為空")
        
        # 清理資料：去除前後空白
        permission_group.code = permission_group.code.strip()
        permission_group.name = permission_group.name.strip()
        
        # 安全限制：強制所有新建權限群組為 custom 類型
        permission_group.permission_type = "custom"
        
        # 檢查代碼是否已存在
        if permission_group_dao.get_permission_group_by_code(permission_group.code):
            raise HTTPException(status_code=400, detail="權限群組代碼已存在")
        
        # 建立權限群組
        group_model = PermissionGroup(
            **permission_group.dict(),
            created_by=current_user['id']
        )
        group_id = permission_group_dao.create_permission_group(group_model)
        
        if not group_id:
            raise HTTPException(status_code=400, detail="建立權限群組失敗")
        
        # 記錄審計日誌
        audit_log_dao.create_audit_log(AuditLog(
            user_id=current_user['id'],
            action="create_permission_group",
            target_type="permission_group",
            target_id=str(group_id),
            changes=permission_group.dict(),
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent")
        ))
        
        return {"success": True, "group_id": group_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating permission group: {e}")
        raise HTTPException(status_code=500, detail="建立權限群組時發生錯誤")

@router.get("/groups", response_model=List[PermissionGroupResponse])
def list_permission_groups(
    group_type: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """列出權限群組"""
    try:
        groups = permission_group_dao.list_permission_groups(group_type, is_active)
        
        # 加入使用者數量
        for group in groups:
            users = user_org_dao.list_users_with_permission_group(group['id'])
            group['user_count'] = len(users)
        
        return groups
        
    except Exception as e:
        logger.error(f"Error listing permission groups: {e}")
        raise HTTPException(status_code=500, detail="取得權限群組列表時發生錯誤")


@router.get("/groups/{group_id}", response_model=PermissionGroupResponse)
def get_permission_group(
    group_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """取得權限群組詳情"""
    try:
        group = permission_group_dao.get_permission_group(group_id)
        if not group:
            raise HTTPException(status_code=404, detail="權限群組不存在")
        
        # 加入使用者數量
        users = user_org_dao.list_users_with_permission_group(group_id)
        group['user_count'] = len(users)
        
        return group
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting permission group: {e}")
        raise HTTPException(status_code=500, detail="取得權限群組詳情時發生錯誤")


@router.put("/groups/{group_id}", response_model=Dict[str, Any])
def update_permission_group(
    group_id: int,
    updates: PermissionGroupUpdate,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """更新權限群組"""
    try:
        # 檢查權限群組是否存在
        group = permission_group_dao.get_permission_group(group_id)
        if not group:
            raise HTTPException(status_code=404, detail="權限群組不存在")
        
        # 額外驗證：如果要更新名稱，檢查不能為空字串或只有空白
        if updates.name is not None:
            if not updates.name or not updates.name.strip():
                raise HTTPException(status_code=400, detail="權限群組名稱不能為空")
            # 清理資料：去除前後空白
            updates.name = updates.name.strip()
        
        # 檢查是否為系統權限群組
        if group['permission_type'] == 'system':
            # 系統權限群組只能更新部分欄位，不允許類型轉換
            allowed_updates = ['description', 'permissions']
            update_data = {k: v for k, v in updates.dict().items() 
                          if v is not None and k in allowed_updates}
        else:
            # 自訂權限群組也不允許變更為系統權限群組
            update_data = {k: v for k, v in updates.dict().items() if v is not None}
            if 'permission_type' in update_data:
                update_data['permission_type'] = 'custom'  # 強制保持為 custom
        
        update_data['updated_by'] = current_user['id']
        
        # 執行更新
        success = permission_group_dao.update_permission_group(group_id, update_data)
        if not success:
            raise HTTPException(status_code=400, detail="更新權限群組失敗")
        
        # 記錄審計日誌
        audit_log_dao.create_audit_log(AuditLog(
            user_id=current_user['id'],
            action="update_permission_group",
            target_type="permission_group",
            target_id=str(group_id),
            changes=update_data,
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent")
        ))
        
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating permission group: {e}")
        raise HTTPException(status_code=500, detail="更新權限群組時發生錯誤")


@router.delete("/groups/{group_id}", response_model=Dict[str, Any])
def delete_permission_group(
    group_id: int,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """刪除權限群組"""
    try:
        success = permission_group_dao.delete_permission_group(group_id)
        if not success:
            raise HTTPException(status_code=400, detail="刪除權限群組失敗，可能為系統權限群組或有使用者使用")
        
        # 記錄審計日誌
        audit_log_dao.create_audit_log(AuditLog(
            user_id=current_user['id'],
            action="delete_permission_group",
            target_type="permission_group",
            target_id=str(group_id),
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent")
        ))
        
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting permission group: {e}")
        raise HTTPException(status_code=500, detail="刪除權限群組時發生錯誤")

