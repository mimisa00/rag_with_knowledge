"""
組織管理系統 API 路由
"""
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from app.api.dependencies import get_current_user, get_admin_user
from app.models.organization import (
    Department, DepartmentCreate, DepartmentUpdate, DepartmentResponse,
    Role, RoleCreate, RoleUpdate, RoleResponse,
    UserExtension, UserExtensionUpdate, UserUpdate, UserRoleAssign,
    SystemMode, SystemModeUpdate, UserWithRoles,
    AuditLog
)
from app.dao.organization import (
    department_dao, role_dao, user_org_dao, 
    system_mode_dao, audit_log_dao
)
from app.dao.user import user_dao
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/organization", tags=["Organization"])


# ===== 部門管理 API =====

@router.post("/departments", response_model=Dict[str, Any])
def create_department(
    department: DepartmentCreate,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """建立新部門"""
    try:
        # 額外驗證：檢查必填欄位不能為空字串或只有空白
        if not department.code or not department.code.strip():
            raise HTTPException(status_code=400, detail="部門代碼不能為空")
        
        if not department.name or not department.name.strip():
            raise HTTPException(status_code=400, detail="部門名稱不能為空")
        
        # 清理資料：去除前後空白
        department.code = department.code.strip()
        department.name = department.name.strip()
        
        # 檢查代碼是否已存在
        if department_dao.get_department_by_code(department.code):
            raise HTTPException(status_code=400, detail="部門代碼已存在")
        
        # 建立部門
        dept_model = Department(
            **department.dict(),
            created_by=current_user['id']
        )
        dept_id = department_dao.create_department(dept_model)
        
        if not dept_id:
            raise HTTPException(status_code=400, detail="建立部門失敗")
        
        # 記錄審計日誌
        audit_log_dao.create_audit_log(AuditLog(
            user_id=current_user['id'],
            action="create_department",
            target_type="department",
            target_id=str(dept_id),
            changes=department.dict(),
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent")
        ))
        
        return {"success": True, "department_id": dept_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating department: {e}")
        raise HTTPException(status_code=500, detail="建立部門時發生錯誤")


@router.get("/departments", response_model=List[DepartmentResponse])
def list_departments(
    parent_id: Optional[int] = Query(None),
    is_active: Optional[bool] = Query(None),
    tree: bool = Query(False),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """列出部門"""
    try:
        if tree:
            # 返回樹狀結構
            departments = department_dao.get_department_tree()
        else:
            # 返回平面列表
            departments = department_dao.list_departments(parent_id, is_active)
        
        # 加入使用者數量
        for dept in departments:
            users = user_org_dao.list_users_in_department(dept['id'])
            dept['user_count'] = len(users)
        
        return departments
        
    except Exception as e:
        logger.error(f"Error listing departments: {e}")
        raise HTTPException(status_code=500, detail="取得部門列表時發生錯誤")


@router.get("/departments/{dept_id}", response_model=DepartmentResponse)
def get_department(
    dept_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """取得部門詳情"""
    try:
        department = department_dao.get_department(dept_id)
        if not department:
            raise HTTPException(status_code=404, detail="部門不存在")
        
        # 加入使用者數量
        users = user_org_dao.list_users_in_department(dept_id)
        department['user_count'] = len(users)
        
        # 加入子部門
        department['children'] = department_dao.list_departments(parent_id=dept_id)
        
        return department
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting department: {e}")
        raise HTTPException(status_code=500, detail="取得部門詳情時發生錯誤")


@router.put("/departments/{dept_id}", response_model=Dict[str, Any])
def update_department(
    dept_id: int,
    updates: DepartmentUpdate,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """更新部門"""
    try:
        # 檢查部門是否存在
        department = department_dao.get_department(dept_id)
        if not department:
            raise HTTPException(status_code=404, detail="部門不存在")
        
        # 額外驗證：檢查部門名稱不能為空字串或只有空白
        # 注意：DepartmentUpdate 模型中沒有 code 欄位，部門代碼不可編輯
        if updates.name is not None:
            if not updates.name or not updates.name.strip():
                raise HTTPException(status_code=400, detail="部門名稱不能為空")
            # 清理資料：去除前後空白
            updates.name = updates.name.strip()
        
        # 準備更新資料
        # 特別處理 parent_id，允許其為 None（表示移到頂層）
        update_data = {}
        for k, v in updates.dict().items():
            if k == 'parent_id':  # parent_id 允許為 None
                update_data[k] = v
            elif v is not None:   # 其他欄位過濾 None
                update_data[k] = v
        update_data['updated_by'] = current_user['id']
        
        # 執行更新
        success = department_dao.update_department(dept_id, update_data)
        if not success:
            raise HTTPException(status_code=400, detail="更新部門失敗")
        
        # 記錄審計日誌
        audit_log_dao.create_audit_log(AuditLog(
            user_id=current_user['id'],
            action="update_department",
            target_type="department",
            target_id=str(dept_id),
            changes=update_data,
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent")
        ))
        
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating department: {e}")
        raise HTTPException(status_code=500, detail="更新部門時發生錯誤")


@router.delete("/departments/{dept_id}", response_model=Dict[str, Any])
def delete_department(
    dept_id: int,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """刪除部門"""
    try:
        success = department_dao.delete_department(dept_id)
        if not success:
            raise HTTPException(status_code=400, detail="刪除部門失敗，可能有子部門或使用者")
        
        # 記錄審計日誌
        audit_log_dao.create_audit_log(AuditLog(
            user_id=current_user['id'],
            action="delete_department",
            target_type="department",
            target_id=str(dept_id),
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent")
        ))
        
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting department: {e}")
        raise HTTPException(status_code=500, detail="刪除部門時發生錯誤")


# ===== 權限矩陣 API =====

@router.get("/roles/permissions")
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
                            {"key": "manage_role", "name": "管理角色", "description": "建立、編輯、刪除角色"},
                            {"key": "assign_role", "name": "分配角色", "description": "分配角色給使用者"},
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


# ===== 角色管理 API =====

@router.post("/roles", response_model=Dict[str, Any])
def create_role(
    role: RoleCreate,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """建立新角色"""
    try:
        # 額外驗證：檢查必填欄位不能為空字串或只有空白
        if not role.code or not role.code.strip():
            raise HTTPException(status_code=400, detail="角色代碼不能為空")
        
        if not role.name or not role.name.strip():
            raise HTTPException(status_code=400, detail="角色名稱不能為空")
        
        # 清理資料：去除前後空白
        role.code = role.code.strip()
        role.name = role.name.strip()
        
        # 檢查代碼是否已存在
        if role_dao.get_role_by_code(role.code):
            raise HTTPException(status_code=400, detail="角色代碼已存在")
        
        # 建立角色
        role_model = Role(
            **role.dict(),
            created_by=current_user['id']
        )
        role_id = role_dao.create_role(role_model)
        
        if not role_id:
            raise HTTPException(status_code=400, detail="建立角色失敗")
        
        # 記錄審計日誌
        audit_log_dao.create_audit_log(AuditLog(
            user_id=current_user['id'],
            action="create_role",
            target_type="role",
            target_id=str(role_id),
            changes=role.dict(),
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent")
        ))
        
        return {"success": True, "role_id": role_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating role: {e}")
        raise HTTPException(status_code=500, detail="建立角色時發生錯誤")


@router.get("/roles", response_model=List[RoleResponse])
def list_roles(
    role_type: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """列出角色"""
    try:
        roles = role_dao.list_roles(role_type, is_active)
        
        # 加入使用者數量
        for role in roles:
            users = user_org_dao.list_users_with_role(role['id'])
            role['user_count'] = len(users)
        
        return roles
        
    except Exception as e:
        logger.error(f"Error listing roles: {e}")
        raise HTTPException(status_code=500, detail="取得角色列表時發生錯誤")


@router.get("/roles/{role_id}", response_model=RoleResponse)
def get_role(
    role_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """取得角色詳情"""
    try:
        role = role_dao.get_role(role_id)
        if not role:
            raise HTTPException(status_code=404, detail="角色不存在")
        
        # 加入使用者數量
        users = user_org_dao.list_users_with_role(role_id)
        role['user_count'] = len(users)
        
        return role
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting role: {e}")
        raise HTTPException(status_code=500, detail="取得角色詳情時發生錯誤")


@router.put("/roles/{role_id}", response_model=Dict[str, Any])
def update_role(
    role_id: int,
    updates: RoleUpdate,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """更新角色"""
    try:
        # 檢查角色是否存在
        role = role_dao.get_role(role_id)
        if not role:
            raise HTTPException(status_code=404, detail="角色不存在")
        
        # 額外驗證：如果要更新名稱，檢查不能為空字串或只有空白
        if updates.name is not None:
            if not updates.name or not updates.name.strip():
                raise HTTPException(status_code=400, detail="角色名稱不能為空")
            # 清理資料：去除前後空白
            updates.name = updates.name.strip()
        
        # 檢查是否為系統角色
        if role['role_type'] == 'system':
            # 系統角色只能更新部分欄位，但允許類型轉換
            allowed_updates = ['description', 'permissions', 'role_type']
            update_data = {k: v for k, v in updates.dict().items() 
                          if v is not None and k in allowed_updates}
        else:
            update_data = {k: v for k, v in updates.dict().items() if v is not None}
        
        update_data['updated_by'] = current_user['id']
        
        # 執行更新
        success = role_dao.update_role(role_id, update_data)
        if not success:
            raise HTTPException(status_code=400, detail="更新角色失敗")
        
        # 記錄審計日誌
        audit_log_dao.create_audit_log(AuditLog(
            user_id=current_user['id'],
            action="update_role",
            target_type="role",
            target_id=str(role_id),
            changes=update_data,
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent")
        ))
        
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating role: {e}")
        raise HTTPException(status_code=500, detail="更新角色時發生錯誤")


@router.delete("/roles/{role_id}", response_model=Dict[str, Any])
def delete_role(
    role_id: int,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """刪除角色"""
    try:
        success = role_dao.delete_role(role_id)
        if not success:
            raise HTTPException(status_code=400, detail="刪除角色失敗，可能為系統角色或有使用者使用")
        
        # 記錄審計日誌
        audit_log_dao.create_audit_log(AuditLog(
            user_id=current_user['id'],
            action="delete_role",
            target_type="role",
            target_id=str(role_id),
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent")
        ))
        
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting role: {e}")
        raise HTTPException(status_code=500, detail="刪除角色時發生錯誤")


# ===== 使用者組織管理 API =====

@router.get("/users", response_model=List[UserWithRoles])
def list_organization_users(
    department_id: Optional[int] = Query(None),
    role_id: Optional[int] = Query(None),
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """列出組織使用者"""
    try:
        users = []
        print("====================== DEBUG ===================")
        print(department_id, role_id,flush=True)
        print("====================== DEBUG ===================")
        if department_id:
            # 按部門列出使用者
            dept_users = user_org_dao.list_users_in_department(department_id)
            for user in dept_users:
                user_with_roles = _build_user_with_roles(user['id'])
                if user_with_roles:
                    users.append(user_with_roles)
        
        elif role_id:
            # 按角色列出使用者
            role_users = user_org_dao.list_users_with_role(role_id)
            for user in role_users:
                user_with_roles = _build_user_with_roles(user['id'])
                if user_with_roles:
                    users.append(user_with_roles)
        
        else:
            # 列出所有使用者
            all_users = user_dao.get_all_users()
            for user in all_users:
                user_with_roles = _build_user_with_roles(user['id'])
                if user_with_roles:
                    users.append(user_with_roles)
        
        return users
        
    except Exception as e:
        logger.error(f"Error listing organization users: {e}")
        raise HTTPException(status_code=500, detail="取得使用者列表時發生錯誤")


@router.get("/users/{user_id}", response_model=UserWithRoles)
def get_organization_user(
    user_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """取得使用者組織資訊"""
    try:
        user_with_roles = _build_user_with_roles(user_id)
        if not user_with_roles:
            raise HTTPException(status_code=404, detail="使用者不存在")
        
        return user_with_roles
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting organization user: {e}")
        raise HTTPException(status_code=500, detail="取得使用者資訊時發生錯誤")


@router.put("/users/{user_id}", response_model=Dict[str, Any])
def update_user(
    user_id: int,
    user_update: UserUpdate,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """統一更新使用者資訊（基本資訊、擴充資訊、角色）"""
    try:
        # 檢查使用者是否存在
        user = user_dao.get_user_by_id(user_id, include_inactive=True)
        if not user:
            raise HTTPException(status_code=404, detail="使用者不存在")
        
        # 1. 更新基本資訊
        basic_updates = {}
        if user_update.username is not None:
            basic_updates['username'] = user_update.username
        if user_update.email is not None:
            basic_updates['email'] = user_update.email
        if user_update.is_active is not None:
            basic_updates['is_active'] = user_update.is_active
            
        if basic_updates:
            success = user_dao.update_user(user_id, basic_updates)
            if not success:
                raise HTTPException(status_code=400, detail="更新使用者基本資訊失敗")
        
        # 2. 更新密碼（如果提供）
        if user_update.password:
            from app.core.security.auth import auth_manager
            password_hash = auth_manager.get_password_hash(user_update.password)
            success = user_dao.update_user_password(user_id, password_hash)
            if not success:
                raise HTTPException(status_code=400, detail="更新密碼失敗")
        
        # 3. 更新擴充資訊
        ext_updates = {}
        if user_update.department_id is not None:
            ext_updates['department_id'] = user_update.department_id
        if user_update.employee_no is not None:
            ext_updates['employee_no'] = user_update.employee_no
        if user_update.title is not None:
            ext_updates['title'] = user_update.title
            
        if ext_updates:
            extension = user_org_dao.get_user_extension(user_id)
            if extension:
                success = user_org_dao.update_user_extension(user_id, ext_updates)
            else:
                # 建立新的擴充資訊
                ext_model = UserExtension(
                    user_id=user_id,
                    **ext_updates,
                    created_by=current_user['id']
                )
                success = user_org_dao.create_user_extension(ext_model)
            
            if not success:
                raise HTTPException(status_code=400, detail="更新擴充資訊失敗")
        
        # 4. 更新角色
        if user_update.role_ids is not None:
            # 先獲取現有角色
            existing_roles = user_org_dao.get_user_roles(user_id)
            
            # 刪除所有現有角色
            for role in existing_roles:
                user_org_dao.revoke_user_role(
                    user_id=user_id,
                    role_id=role['role_id'],
                    department_id=role.get('department_id')
                )
            
            # 分配新角色
            from app.models.organization import UserRole
            for role_id in user_update.role_ids:
                user_role = UserRole(
                    user_id=user_id,
                    role_id=role_id,
                    department_id=user_update.department_id,
                    assigned_by=current_user['id']
                )
                user_org_dao.assign_user_role(user_role)
                user_org_dao.assign_user_role(user_role)
        
        # 記錄審計日誌
        changes = {}
        if basic_updates:
            changes.update(basic_updates)
        if ext_updates:
            changes.update(ext_updates)
        if user_update.role_ids is not None:
            changes['role_ids'] = user_update.role_ids
        if user_update.password:
            changes['password'] = '***'  # 不記錄實際密碼
            
        audit_log_dao.create_audit_log(AuditLog(
            user_id=current_user['id'],
            action="update_user",
            target_type="user",
            target_id=str(user_id),
            changes=changes,
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent")
        ))
        
        return {"success": True, "message": "使用者資訊更新成功"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user: {e}")
        raise HTTPException(status_code=500, detail="更新使用者時發生錯誤")


@router.put("/users/{user_id}/extension", response_model=Dict[str, Any])
def update_user_extension(
    user_id: int,
    updates: UserExtensionUpdate,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """更新使用者擴充資訊"""
    try:
        # 檢查使用者是否存在
        user = user_dao.get_user_by_id(user_id, include_inactive=True)
        if not user:
            raise HTTPException(status_code=404, detail="使用者不存在")
        
        # 檢查是否有擴充資訊
        extension = user_org_dao.get_user_extension(user_id)
        
        # 準備更新資料
        update_data = {k: v for k, v in updates.dict().items() if v is not None}
        
        if extension:
            # 更新現有擴充資訊
            success = user_org_dao.update_user_extension(user_id, update_data)
        else:
            # 建立新的擴充資訊
            ext_model = UserExtension(
                user_id=user_id,
                **update_data
            )
            success = user_org_dao.create_user_extension(ext_model)
        
        if not success:
            raise HTTPException(status_code=400, detail="更新使用者資訊失敗")
        
        # 記錄審計日誌
        audit_log_dao.create_audit_log(AuditLog(
            user_id=current_user['id'],
            action="update_user_extension",
            target_type="user",
            target_id=str(user_id),
            changes=update_data,
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent")
        ))
        
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user extension: {e}")
        raise HTTPException(status_code=500, detail="更新使用者資訊時發生錯誤")


@router.post("/users", response_model=Dict[str, Any])
def create_organization_user(
    user_data: Dict[str, Any],
    request: Request,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """管理員創建新使用者"""
    try:
        from app.core.security.auth import auth_manager
        
        # 建立使用者
        loginid = user_data.get('loginid', user_data.get('username'))  # 登入帳號
        username = user_data.get('username', loginid)  # 真實姓名，預設與 loginid 相同
        email = user_data.get('email', f'{loginid}@example.com')  # 提供預設 email
        password_hash = auth_manager.get_password_hash(user_data.get('password', 'temp123456'))
        
        # 創建使用者（預設為 user 角色）
        user_id = user_dao.create_user(
            loginid=loginid,
            username=username,
            email=email,
            password_hash=password_hash,
            role='user'  # 預設角色，後續通過角色分配更新
        )
        if not user_id or user_id == -1:
            raise HTTPException(status_code=400, detail="建立使用者失敗")
        
        # 建立或更新組織資訊（始終建立 user_extensions 記錄）
        from app.models.organization import UserExtension
        
        # 準備擴展資訊
        ext_data = {
            'department_id': user_data.get('department_id'),
            'employee_no': user_data.get('employee_no'),
            'title': user_data.get('title'),
            'auth_source': 'local',  # 預設認證來源
        }
        
        # 檢查是否已有擴展資訊
        existing_ext = user_org_dao.get_user_extension(user_id)
        
        if existing_ext:
            # 更新現有記錄
            ext_data['updated_by'] = current_user['id']
            user_org_dao.update_user_extension(user_id, ext_data)
        else:
            # 建立新記錄
            ext_model = UserExtension(
                user_id=user_id,
                **ext_data,
                created_by=current_user['id']
            )
            user_org_dao.create_user_extension(ext_model)
        
        # 分配角色
        if user_data.get('role_ids'):
            from app.models.organization import UserRole
            for role_id in user_data['role_ids']:
                user_role = UserRole(
                    user_id=user_id,
                    role_id=role_id,
                    department_id=user_data.get('department_id'),
                    assigned_by=current_user['id']
                )
                user_org_dao.assign_user_role(user_role)
        
        # 記錄審計日誌
        audit_log_dao.create_audit_log(AuditLog(
            user_id=current_user['id'],
            entity_type='USER',
            entity_id=user_id,
            action='CREATE',
            changes={'username': user_data['username'], 'action': '建立使用者'},
            ip_address=request.client.host,
            user_agent=request.headers.get('User-Agent', '')
        ))
        
        return {"status": "success", "user_id": user_id}
        
    except Exception as e:
        logger.error(f"建立使用者失敗: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/users/{user_id}", response_model=Dict[str, Any])
def delete_organization_user(
    user_id: int,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """刪除組織使用者"""
    try:
        # 檢查使用者是否存在
        user = user_dao.get_user_by_id(user_id, include_inactive=True)
        if not user:
            raise HTTPException(status_code=404, detail="使用者不存在")
        
        # 檢查是否為自己
        if user_id == current_user['id']:
            raise HTTPException(status_code=400, detail="不能刪除自己的帳號")
        
        # 刪除使用者的角色關聯
        user_org_dao.remove_all_user_roles(user_id)
        
        # 刪除使用者擴充資訊
        user_org_dao.delete_user_extension(user_id)
        
        # 停用使用者（不真正刪除，只標記為停用）
        success = user_dao.deactivate_user(user_id)
        if not success:
            raise HTTPException(status_code=400, detail="刪除使用者失敗")
        
        # 記錄審計日誌
        audit_log_dao.create_audit_log(AuditLog(
            user_id=current_user['id'],
            action="delete_user",
            target_type="user",
            target_id=str(user_id),
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent")
        ))
        
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting user: {e}")
        raise HTTPException(status_code=500, detail="刪除使用者時發生錯誤")


@router.post("/users/roles", response_model=Dict[str, Any])
def assign_user_role(
    assignment: UserRoleAssign,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """分配使用者角色"""
    try:
        # 檢查使用者和角色是否存在
        user = user_dao.get_user_by_id(assignment.user_id, include_inactive=True)
        if not user:
            raise HTTPException(status_code=404, detail="使用者不存在")
        
        role = role_dao.get_role(assignment.role_id)
        if not role:
            raise HTTPException(status_code=404, detail="角色不存在")
        
        # 分配角色
        user_role = UserRole(
            **assignment.dict(),
            assigned_by=current_user['id']
        )
        success = user_org_dao.assign_user_role(user_role)
        
        if not success:
            raise HTTPException(status_code=400, detail="分配角色失敗")
        
        # 記錄審計日誌
        audit_log_dao.create_audit_log(AuditLog(
            user_id=current_user['id'],
            action="assign_role",
            target_type="user",
            target_id=str(assignment.user_id),
            changes={
                "role_id": assignment.role_id,
                "department_id": assignment.department_id
            },
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent")
        ))
        
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error assigning user role: {e}")
        raise HTTPException(status_code=500, detail="分配角色時發生錯誤")


@router.delete("/users/{user_id}/roles/{role_id}", response_model=Dict[str, Any])
def revoke_user_role(
    user_id: int,
    role_id: int,
    request: Request,
    department_id: Optional[int] = Query(None),
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """撤銷使用者角色"""
    try:
        success = user_org_dao.revoke_user_role(user_id, role_id, department_id)
        
        if not success:
            raise HTTPException(status_code=400, detail="撤銷角色失敗")
        
        # 記錄審計日誌
        audit_log_dao.create_audit_log(AuditLog(
            user_id=current_user['id'],
            action="revoke_role",
            target_type="user",
            target_id=str(user_id),
            changes={
                "role_id": role_id,
                "department_id": department_id
            },
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent")
        ))
        
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error revoking user role: {e}")
        raise HTTPException(status_code=500, detail="撤銷角色時發生錯誤")


# ===== 系統模式管理 API =====

@router.get("/system-modes", response_model=List[SystemMode])
def list_system_modes(
    category: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """列出系統模式設定"""
    try:
        modes = system_mode_dao.list_system_modes(category)
        return modes
        
    except Exception as e:
        logger.error(f"Error listing system modes: {e}")
        raise HTTPException(status_code=500, detail="取得系統模式設定時發生錯誤")


@router.get("/system-modes/{mode_key}", response_model=SystemMode)
def get_system_mode(
    mode_key: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """取得系統模式設定"""
    try:
        mode = system_mode_dao.get_system_mode(mode_key)
        if not mode:
            raise HTTPException(status_code=404, detail="系統模式設定不存在")
        
        return mode
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting system mode: {e}")
        raise HTTPException(status_code=500, detail="取得系統模式設定時發生錯誤")


@router.put("/system-modes/{mode_key}", response_model=Dict[str, Any])
def update_system_mode(
    mode_key: str,
    updates: SystemModeUpdate,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """更新系統模式設定"""
    try:
        # 檢查設定是否存在
        mode = system_mode_dao.get_system_mode(mode_key)
        if not mode:
            raise HTTPException(status_code=404, detail="系統模式設定不存在")
        
        # 執行更新
        success = system_mode_dao.update_system_mode(
            mode_key, 
            updates.mode_value,
            current_user['id']
        )
        
        if not success:
            raise HTTPException(status_code=400, detail="更新系統模式設定失敗")
        
        # 記錄審計日誌
        audit_log_dao.create_audit_log(AuditLog(
            user_id=current_user['id'],
            action="update_system_mode",
            target_type="system",
            target_id=mode_key,
            changes={
                "mode_value": updates.mode_value,
                "previous_value": mode['mode_value']
            },
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent")
        ))
        
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating system mode: {e}")
        raise HTTPException(status_code=500, detail="更新系統模式設定時發生錯誤")


# ===== 審計日誌 API =====

@router.get("/audit-logs", response_model=List[AuditLog])
def list_audit_logs(
    user_id: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    target_type: Optional[str] = Query(None),
    limit: int = Query(100, le=1000),
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """列出審計日誌"""
    try:
        logs = audit_log_dao.list_audit_logs(user_id, action, target_type, limit)
        return logs
        
    except Exception as e:
        logger.error(f"Error listing audit logs: {e}")
        raise HTTPException(status_code=500, detail="取得審計日誌時發生錯誤")


# ===== 輔助函數 =====

def _build_user_with_roles(user_id: Any) -> Optional[UserWithRoles]:
    """建立包含角色的使用者資訊"""
    try:
        # 取得使用者基本資訊（包含停用用戶）
        user = user_dao.get_user_by_id(user_id, include_inactive=True)
        if not user:
            return None
        
        # 取得擴充資訊
        extension = user_org_dao.get_user_extension(user_id)
        
        # 取得部門資訊
        department = None
        if extension and extension['department_id']:
            department = department_dao.get_department(extension['department_id'])
        
        # 取得角色資訊
        user_roles = user_org_dao.get_user_roles(user_id)
        roles = []
        for ur in user_roles:
            role = {
                'id': ur['role_id'],
                'code': ur['code'],
                'name': ur['name'],
                'role_type': ur['role_type'],
                'permissions': ur['permissions']
            }
            roles.append(role)
        
        return UserWithRoles(
            user_id=user['id'],
            loginid=user.get('loginid', user['username']),  # 向後相容
            username=user['username'],  # 真實姓名
            email=user.get('email', ''),  # 提供預設值避免 None
            is_active=user['is_active'],
            department=department,
            roles=roles,
            user_extension=extension
        )
        
    except Exception as e:
        logger.error(f"Error building user with roles: {e}")
        return None