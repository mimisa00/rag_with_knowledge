"""
組織管理系統 API 路由
"""
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from app.api.dependencies import get_admin_user
from app.models.organization import (
    Department, DepartmentCreate, DepartmentUpdate, DepartmentResponse,
    PermissionGroup, PermissionGroupCreate, PermissionGroupUpdate, PermissionGroupResponse,
    UserExtension, UserExtensionUpdate, UserCreate, UserUpdate, UserStatusUpdate, UserPermissionGroupAssign,
    SystemMode, SystemModeUpdate, UserWithPermissionGroups,
    AuditLog
)
from app.models.role_template import (
    RoleTemplate, RoleTemplateCreate, RoleTemplateUpdate, RoleTemplateResponse,
    DepartmentRole, DepartmentRoleCreate, DepartmentRoleUpdate, DepartmentRoleResponse,
    UserDepartmentRole, UserDepartmentRoleAssign, DepartmentRolesBatchCreate,
    RoleAssignmentSuggestionCreate
)
from app.dao.organization import (
    department_dao, permission_group_dao, user_org_dao, 
    system_mode_dao, audit_log_dao
)
from app.dao.role_template import (
    role_template_dao, department_role_dao, user_department_role_dao,
    role_relationship_analysis_dao
)
from app.dao.user import user_dao
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/organization", tags=["Organization"])


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
    current_user: Dict[str, Any] = Depends(get_admin_user)
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
    current_user: Dict[str, Any] = Depends(get_admin_user)
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


# ===== 使用者組織管理 API =====

@router.get("/users", response_model=List[UserWithPermissionGroups])
def list_organization_users(
    department_id: Optional[int] = Query(None),
    role_id: Optional[int] = Query(None),
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """列出組織使用者"""
    try:
        users = []
        if department_id:
            # 按部門列出使用者
            dept_users = user_org_dao.list_users_in_department(department_id)
            for user in dept_users:
                user_with_permission_groups = _build_user_with_permission_groups(user['id'])
                if user_with_permission_groups:
                    users.append(user_with_permission_groups)
        
        elif role_id:
            # 按角色列出使用者
            role_users = user_org_dao.list_users_with_permission_group(role_id)
            for user in role_users:
                user_with_permission_groups = _build_user_with_permission_groups(user['id'])
                if user_with_permission_groups:
                    users.append(user_with_permission_groups)
        
        else:
            # 列出所有使用者
            all_users = user_dao.get_all_users()
            for user in all_users:
                user_with_permission_groups = _build_user_with_permission_groups(user['id'])
                if user_with_permission_groups:
                    users.append(user_with_permission_groups)
        
        return users
        
    except Exception as e:
        logger.error(f"Error listing organization users: {e}")
        raise HTTPException(status_code=500, detail="取得使用者列表時發生錯誤")


# ===== 待處理帳號管理 API =====

@router.get("/users/pending", response_model=List[Dict[str, Any]])
def list_pending_users(
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """取得待完成設定的帳號清單"""
    try:
        pending_users = user_org_dao.get_pending_users()
        return pending_users
        
    except Exception as e:
        logger.error(f"Error listing pending users: {e}")
        raise HTTPException(status_code=500, detail="取得待處理帳號時發生錯誤")


@router.get("/users/check/{loginid}", response_model=Dict[str, Any])
def check_user_account_status(
    loginid: str,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """檢查特定帳號狀態"""
    try:
        status_info = user_org_dao.check_user_completeness(loginid)
        return status_info
        
    except Exception as e:
        logger.error(f"Error checking user account status: {e}")
        raise HTTPException(status_code=500, detail="檢查帳號狀態時發生錯誤")


@router.get("/users/{user_id}", response_model=UserWithPermissionGroups)
def get_organization_user(
    user_id: int,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """取得使用者組織資訊"""
    try:
        user_with_permission_groups = _build_user_with_permission_groups(user_id)
        if not user_with_permission_groups:
            raise HTTPException(status_code=404, detail="使用者不存在")
        
        return user_with_permission_groups
        
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
        logger.info(f"開始更新使用者資訊: user_id={user_id}, admin={current_user.get('loginid')}")
        logger.debug(f"更新數據: {user_update.model_dump()}")
        
        # 檢查使用者是否存在
        user = user_dao.get_user_by_id(user_id, include_inactive=True)
        if not user:
            logger.warning(f"嘗試更新不存在的使用者: user_id={user_id}")
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
            logger.debug(f"更新基本資訊: user_id={user_id}, updates={basic_updates}")
            success = user_dao.update_user(user_id, basic_updates)
            if not success:
                logger.error(f"更新使用者基本資訊失敗: user_id={user_id}, updates={basic_updates}")
                raise HTTPException(status_code=400, detail="更新使用者基本資訊失敗")
        
        # 2. 更新密碼（如果提供）
        if user_update.password:
            logger.debug(f"更新密碼: user_id={user_id}")
            from app.core.security.auth import auth_manager
            password_hash = auth_manager.get_password_hash(user_update.password)
            success = user_dao.update_user_password(user_id, password_hash)
            if not success:
                logger.error(f"更新密碼失敗: user_id={user_id}")
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
            logger.debug(f"更新擴充資訊: user_id={user_id}, ext_updates={ext_updates}")
            extension = user_org_dao.get_user_extension(user_id)
            if extension:
                success = user_org_dao.update_user_extension(user_id, ext_updates)
            else:
                # 建立新的擴充資訊
                logger.debug(f"建立新擴充資訊: user_id={user_id}")
                ext_model = UserExtension(
                    user_id=user_id,
                    **ext_updates,
                    created_by=current_user['id']
                )
                success = user_org_dao.create_user_extension(ext_model)
            
            if not success:
                logger.error(f"更新擴充資訊失敗: user_id={user_id}, ext_updates={ext_updates}")
                raise HTTPException(status_code=400, detail="更新擴充資訊失敗")
        
        # 4. 更新部門角色
        if (user_update.primary_role_id is not None or user_update.department_roles is not None):
            logger.debug(f"更新部門角色: user_id={user_id}, primary_role_id={user_update.primary_role_id}, department_roles={user_update.department_roles}")
            from app.dao.role_template import user_department_role_dao
            from app.models.role_template import UserDepartmentRoleBase
            
            # 先取得現有的部門角色
            existing_roles = user_department_role_dao.get_user_roles(user_id)
            logger.debug(f"現有角色: user_id={user_id}, existing_roles={[r.get('department_role_id') for r in existing_roles]}")
            
            # 刪除所有現有的部門角色
            for existing_role in existing_roles:
                success = user_department_role_dao.remove_user_from_role(user_id, existing_role['department_role_id'])
                if not success:
                    logger.warning(f"刪除現有角色失敗: user_id={user_id}, role_id={existing_role['department_role_id']}")
            
            # 建立主要角色關聯
            if user_update.primary_role_id:
                logger.debug(f"指派主要角色: user_id={user_id}, primary_role_id={user_update.primary_role_id}")
                primary_role = UserDepartmentRoleBase(
                    user_id=user_id,
                    department_role_id=user_update.primary_role_id,
                    is_primary=True
                )
                role_id = user_department_role_dao.assign_user_role(primary_role, current_user['id'])
                if not role_id:
                    logger.error(f"指派主要角色失敗: user_id={user_id}, primary_role_id={user_update.primary_role_id}")
                    raise HTTPException(status_code=400, detail="指派主要角色失敗")
            
            # 建立其他部門角色關聯
            if user_update.department_roles:
                for role_id in user_update.department_roles:
                    # 避免重複指派主要角色
                    if role_id != user_update.primary_role_id:
                        other_role = UserDepartmentRoleBase(
                            user_id=user_id,
                            department_role_id=role_id,
                            is_primary=False
                        )
                        assigned_role_id = user_department_role_dao.assign_user_role(other_role, current_user['id'])
                        if not assigned_role_id:
                            raise HTTPException(status_code=400, detail=f"指派角色 {role_id} 失敗")
        
        # 5. 更新權限群組
        if user_update.permission_group_ids is not None:
            # 先獲取現有權限群組
            existing_permission_groups = user_org_dao.get_user_permission_groups(user_id)
            
            # 刪除所有現有權限群組
            for permission_group in existing_permission_groups:
                user_org_dao.revoke_user_permission_group(
                    user_id=user_id,
                    permission_group_id=permission_group['permission_group_id'],
                    department_id=permission_group.get('department_id')
                )
            
            # 分配新權限群組
            from app.models.organization import UserPermissionGroup
            for permission_group_id in user_update.permission_group_ids:
                user_permission_group = UserPermissionGroup(
                    user_id=user_id,
                    permission_group_id=permission_group_id,
                    department_id=user_update.department_id,
                    assigned_by=current_user['id']
                )
                user_org_dao.assign_user_permission_group(user_permission_group)
        
        # 記錄審計日誌
        changes = {}
        if basic_updates:
            changes.update(basic_updates)
        if ext_updates:
            changes.update(ext_updates)
        if user_update.permission_group_ids is not None:
            changes['permission_group_ids'] = user_update.permission_group_ids
        if user_update.primary_role_id is not None:
            changes['primary_role_id'] = user_update.primary_role_id
        if user_update.department_roles is not None:
            changes['department_roles'] = user_update.department_roles
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
        
        logger.info(f"使用者資訊更新成功: user_id={user_id}, changes={list(changes.keys())}")
        return {"success": True, "message": "使用者資訊更新成功"}
        
    except HTTPException as he:
        logger.error(f"HTTP錯誤更新使用者資訊 (user_id={user_id}): {he.detail}")
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
    user_data: UserCreate,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """管理員創建新使用者"""
    try:
        from app.core.security.auth import auth_manager
        
        # 1. 驗證 loginid 唯一性
        existing_user = user_dao.get_user_by_loginid(user_data.loginid)
        if existing_user:
            raise HTTPException(status_code=400, detail=f"登入帳號 '{user_data.loginid}' 已存在")
        
        # 2. 驗證 email 唯一性 
        existing_email = user_dao.get_user_by_email(user_data.email)
        if existing_email:
            raise HTTPException(status_code=400, detail=f"電子信箱 '{user_data.email}' 已被使用")
        
        # 3. 驗證員工編號唯一性（如果有提供）
        if user_data.employee_no:
            existing_emp = user_org_dao.get_user_by_employee_no(user_data.employee_no.strip())
            if existing_emp:
                raise HTTPException(status_code=400, detail=f"員工編號 '{user_data.employee_no}' 已存在")
        
        # 4. 驗證部門是否存在且啟用
        department = department_dao.get_department(user_data.department_id)
        if not department:
            raise HTTPException(status_code=400, detail=f"部門ID {user_data.department_id} 不存在")
        if not department.get('is_active', True):
            raise HTTPException(status_code=400, detail=f"部門 '{department['name']}' 已停用，無法分配員工")
        
        # 5. 驗證主要角色是否存在且屬於指定部門
        from app.dao.role_template import department_role_dao
        primary_role = department_role_dao.get_department_role(user_data.primary_role_id)
        if not primary_role:
            raise HTTPException(status_code=400, detail=f"角色ID {user_data.primary_role_id} 不存在")
        if primary_role.get('department_id') != user_data.department_id:
            raise HTTPException(status_code=400, detail="主要角色必須屬於所選部門")
        if not primary_role.get('is_active', True):
            raise HTTPException(status_code=400, detail=f"角色 '{primary_role['name']}' 已停用")
        
        # 6. 建立使用者（使用驗證過的資料）
        password_hash = auth_manager.get_password_hash(user_data.password)
        
        user_id = user_dao.create_user(
            loginid=user_data.loginid,
            username=user_data.username,
            email=str(user_data.email),  # EmailStr 轉字串
            password_hash=password_hash,
            role='user',  # 預設系統角色
            is_active=user_data.is_active
        )
        
        if not user_id or user_id == -1:
            raise HTTPException(status_code=500, detail="建立使用者失敗，請稍後再試")
        
        # 7. 建立使用者擴充資訊
        ext_model = UserExtension(
            user_id=user_id,
            department_id=user_data.department_id,
            employee_no=user_data.employee_no,
            title=user_data.title,
            auth_source='local',
            password_strategy=user_data.password_strategy,
            created_by=current_user['id']
        )
        
        ext_success = user_org_dao.create_user_extension(ext_model)
        if not ext_success:
            # 回滾使用者建立
            user_dao.delete_user(user_id)
            raise HTTPException(status_code=500, detail="建立使用者擴充資訊失敗")
        
        # 8. 分配主要角色
        from app.models.role_template import UserDepartmentRoleBase
        primary_role_assignment = UserDepartmentRoleBase(
            user_id=user_id,
            department_role_id=user_data.primary_role_id,
            is_primary=True
        )
        
        from app.dao.role_template import user_department_role_dao
        role_success = user_department_role_dao.assign_user_role(primary_role_assignment, current_user['id'])
        if not role_success:
            # 回滾之前的建立
            user_org_dao.delete_user_extension(user_id)
            user_dao.delete_user(user_id)
            raise HTTPException(status_code=500, detail="分配主要角色失敗")
        
        # 9. 分配其他部門角色（如果有）
        if user_data.department_roles:
            for role_id in user_data.department_roles:
                if role_id != user_data.primary_role_id:  # 避免重複分配主要角色
                    # 驗證角色存在性
                    role = department_role_dao.get_department_role(role_id)
                    if role and role.get('is_active', True):
                        other_role_assignment = UserDepartmentRoleBase(
                            user_id=user_id,
                            department_role_id=role_id,
                            is_primary=False
                        )
                        user_department_role_dao.assign_user_role(other_role_assignment, current_user['id'])
                    else:
                        logger.warning(f"跳過無效或停用的角色ID: {role_id}")
        
        # 10. 分配權限群組（如果有）
        if user_data.permission_groups:
            from app.models.organization import UserPermissionGroup
            for permission_group_id in user_data.permission_groups:
                # 驗證權限群組存在性
                perm_group = permission_group_dao.get_permission_group(permission_group_id)
                if perm_group and perm_group.get('is_active', True):
                    user_permission_group = UserPermissionGroup(
                        user_id=user_id,
                        permission_group_id=permission_group_id,
                        department_id=user_data.department_id,
                        assigned_by=current_user['id']
                    )
                    user_org_dao.assign_user_permission_group(user_permission_group)
                else:
                    logger.warning(f"跳過無效或停用的權限群組ID: {permission_group_id}")
        
        # 11. 記錄審計日誌
        audit_log_dao.create_audit_log(AuditLog(
            user_id=current_user['id'],
            action="create_user",
            target_type="user",
            target_id=str(user_id),
            changes={
                "loginid": user_data.loginid,
                "username": user_data.username,
                "email": str(user_data.email),
                "department_id": user_data.department_id,
                "primary_role_id": user_data.primary_role_id,
                "employee_no": user_data.employee_no,
                "title": user_data.title
            },
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent")
        ))
        
        return {
            "success": True, 
            "user_id": user_id,
            "message": f"使用者 '{user_data.username}' 建立成功"
        }
        
    except HTTPException:
        # 已經是 HTTP 錯誤，直接拋出
        raise
    except ValueError as ve:
        # Pydantic 驗證錯誤
        logger.error(f"使用者資料驗證失敗: {str(ve)}")
        raise HTTPException(status_code=422, detail=f"資料驗證失敗：{str(ve)}")
    except Exception as e:
        logger.error(f"建立使用者時發生未預期錯誤: {str(e)}")
        raise HTTPException(status_code=500, detail="建立使用者時發生錯誤，請稍後再試")


@router.patch("/users/{user_id}", response_model=Dict[str, Any])
def patch_user_status(
    user_id: int,
    status_update: UserStatusUpdate,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """更新使用者狀態（停用/啟用，支援延遲停用和預約啟用）"""
    try:
        # 檢查使用者是否存在
        user = user_dao.get_user_by_id(user_id, include_inactive=True)
        if not user:
            raise HTTPException(status_code=404, detail="使用者不存在")
        
        # 檢查是否為自己
        if user_id == current_user['id']:
            raise HTTPException(status_code=400, detail="不能停用自己的帳號")
        
        update_data = {}
        extension_update_data = {}
        
        # 處理基本狀態更新
        if status_update.is_active is not None:
            update_data['is_active'] = status_update.is_active
        
        # 處理延遲停用邏輯
        if status_update.activation_expires is not None:
            from datetime import datetime, timezone
            current_time = datetime.now(timezone.utc)
            
            # 確保 activation_expires 有時區資訊
            if status_update.activation_expires.tzinfo is None:
                # 假設輸入為 UTC 時間
                activation_expires_utc = status_update.activation_expires.replace(tzinfo=timezone.utc)
            else:
                activation_expires_utc = status_update.activation_expires.astimezone(timezone.utc)
            
            if activation_expires_utc <= current_time:
                # 立即停用：設定 activation_expires 為當前時間，is_active 為 False
                extension_update_data['activation_expires'] = current_time
                update_data['is_active'] = False
            else:
                # 延遲停用：設定未來的過期時間，保持 is_active 為 True（除非明確設定）
                extension_update_data['activation_expires'] = activation_expires_utc
                if 'is_active' not in update_data:
                    update_data['is_active'] = True  # 延遲停用時暫時保持啟用
        
        # 處理預約啟用邏輯
        if status_update.activation_scheduled is not None:
            from datetime import datetime, timezone
            if 'current_time' not in locals():
                current_time = datetime.now(timezone.utc)
            
            # 確保 activation_scheduled 有時區資訊
            if status_update.activation_scheduled.tzinfo is None:
                # 假設輸入為 UTC 時間
                activation_scheduled_utc = status_update.activation_scheduled.replace(tzinfo=timezone.utc)
            else:
                activation_scheduled_utc = status_update.activation_scheduled.astimezone(timezone.utc)
            
            if activation_scheduled_utc <= current_time:
                # 立即啟用：清除 activation_scheduled，is_active 為 True
                extension_update_data['activation_scheduled'] = None
                update_data['is_active'] = True
            else:
                # 預約啟用：設定未來的啟用時間，保持 is_active 為 False（除非明確設定）
                extension_update_data['activation_scheduled'] = activation_scheduled_utc
                if 'is_active' not in update_data:
                    update_data['is_active'] = False  # 預約啟用時暫時保持停用
        
        # 更新基本使用者資料
        if update_data:
            success = user_dao.update_user(user_id, update_data)
            if not success:
                raise HTTPException(status_code=400, detail="更新使用者狀態失敗")
        
        # 更新擴充資訊（如果有 activation_expires 或 activation_scheduled）
        if extension_update_data:
            # 檢查是否有擴充資訊
            extension = user_org_dao.get_user_extension(user_id)
            if extension:
                success = user_org_dao.update_user_extension(user_id, extension_update_data)
            else:
                # 建立新的擴充資訊
                ext_model = UserExtension(
                    user_id=user_id,
                    **extension_update_data
                )
                success = user_org_dao.create_user_extension(ext_model)
            
            if not success:
                raise HTTPException(status_code=400, detail="更新帳號排程設定失敗")
        
        # 記錄審計日誌
        changes = {**update_data, **extension_update_data}
        audit_log_dao.create_audit_log(AuditLog(
            user_id=current_user['id'],
            action="update_user_status",
            target_type="user",
            target_id=str(user_id),
            changes=changes,
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent")
        ))
        
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user status: {e}")
        raise HTTPException(status_code=500, detail="更新使用者狀態時發生錯誤")


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


@router.post("/users/permission-groups", response_model=Dict[str, Any])
def assign_user_permission_group(
    assignment: UserPermissionGroupAssign,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """分配使用者權限群組"""
    try:
        # 檢查使用者和權限群組是否存在
        user = user_dao.get_user_by_id(assignment.user_id, include_inactive=True)
        if not user:
            raise HTTPException(status_code=404, detail="使用者不存在")
        
        permission_group = permission_group_dao.get_permission_group(assignment.permission_group_id)
        if not permission_group:
            raise HTTPException(status_code=404, detail="權限群組不存在")
        
        # 分配權限群組
        user_permission_group = UserPermissionGroup(
            **assignment.dict(),
            assigned_by=current_user['id']
        )
        success = user_org_dao.assign_user_permission_group(user_permission_group)
        
        if not success:
            raise HTTPException(status_code=400, detail="分配權限群組失敗")
        
        # 記錄審計日誌
        audit_log_dao.create_audit_log(AuditLog(
            user_id=current_user['id'],
            action="assign_permission_group",
            target_type="user",
            target_id=str(assignment.user_id),
            changes={
                "permission_group_id": assignment.permission_group_id,
                "department_id": assignment.department_id
            },
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent")
        ))
        
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error assigning user permission group: {e}")
        raise HTTPException(status_code=500, detail="分配權限群組時發生錯誤")


@router.delete("/users/{user_id}/permission-groups/{permission_group_id}", response_model=Dict[str, Any])
def revoke_user_permission_group(
    user_id: int,
    permission_group_id: int,
    request: Request,
    department_id: Optional[int] = Query(None),
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """撤銷使用者權限群組"""
    try:
        success = user_org_dao.revoke_user_permission_group(user_id, permission_group_id, department_id)
        
        if not success:
            raise HTTPException(status_code=400, detail="撤銷權限群組失敗")
        
        # 記錄審計日誌
        audit_log_dao.create_audit_log(AuditLog(
            user_id=current_user['id'],
            action="revoke_permission_group",
            target_type="user",
            target_id=str(user_id),
            changes={
                "permission_group_id": permission_group_id,
                "department_id": department_id
            },
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent")
        ))
        
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error revoking user permission group: {e}")
        raise HTTPException(status_code=500, detail="撤銷權限群組時發生錯誤")


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
    current_user: Dict[str, Any] = Depends(get_admin_user)
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

def _build_user_with_permission_groups(user_id: Any) -> Optional[UserWithPermissionGroups]:
    """建立包含權限群組的使用者資訊"""
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
        
        # 取得權限群組資訊
        user_permission_groups = user_org_dao.get_user_permission_groups(user_id)
        permission_groups = []
        for upg in user_permission_groups:
            # 根據權限類型分配層級，管理員權限最高
            level = 0
            permission_type = upg['permission_type']
            if permission_type == 'admin':
                level = 9  # 管理員最高層級
            elif permission_type == 'manager':
                level = 5  # 經理權限中級
            elif permission_type == 'user':
                level = 1  # 一般使用者權限
            else:
                level = 0  # 預設層級
                
            permission_group = {
                'id': upg['permission_group_id'],
                'code': upg['code'],
                'name': upg['name'],
                'permission_type': upg['permission_type'],
                'permissions': upg['permissions'],
                'level': level  # 新增層級資訊
            }
            permission_groups.append(permission_group)
        
        # 取得部門角色資訊
        department_roles = []
        try:
            from app.dao.role_template import user_department_role_dao
            user_roles = user_department_role_dao.get_user_roles(user_id)
            for role in user_roles:
                department_role = {
                    'id': role.get('department_role_id'),
                    'code': role.get('template_name'),  # 使用模板名稱作為 code
                    'name': role.get('role_name'),
                    'role_type': role.get('role_type'),
                    'level': role.get('role_level', 0),  # 修正為 role_level
                    'department_id': role.get('department_id'),
                    'department_name': role.get('department_name'),
                    'is_primary': role.get('is_primary', False)
                }
                department_roles.append(department_role)
        except Exception as e:
            logger.warning(f"Failed to get department roles for user {user_id}: {e}")
        
        # 創建用戶資料物件，包含部門角色資訊
        user_data = UserWithPermissionGroups(
            user_id=user['id'],
            loginid=user.get('loginid', user['username']),  # 向後相容
            username=user['username'],  # 真實姓名
            email=user.get('email', ''),  # 提供預設值避免 None
            is_active=user['is_active'],
            department=department,
            permission_groups=permission_groups,
            user_extension=extension,
            department_roles=department_roles,  # 直接設定到模型屬性
            last_login_at=user.get('last_login_at'),  # 最後登入時間
            last_activity_at=user.get('last_activity_at')  # 最後活動時間
        )
        
        return user_data
        
    except Exception as e:
        logger.error(f"Error building user with permission groups: {e}")
        return None


# ===== 角色模板管理 API =====

@router.post("/role-templates", response_model=Dict[str, Any])
def create_role_template(
    template: RoleTemplateCreate,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """建立角色模板"""
    try:
        # 檢查代碼是否已存在
        existing = role_template_dao.execute_query(
            "SELECT id FROM role_templates WHERE code = %s",
            (template.code,)
        )
        if existing:
            raise HTTPException(status_code=400, detail="模板代碼已存在")
        
        template_id = role_template_dao.create_role_template(template, current_user['id'])
        
        if not template_id:
            raise HTTPException(status_code=400, detail="建立角色模板失敗")
        
        # 記錄審計日誌
        audit_log_dao.create_audit_log(AuditLog(
            user_id=current_user['id'],
            action="create_role_template",
            target_type="role_template",
            target_id=str(template_id),
            changes=template.dict(),
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent")
        ))
        
        return {"success": True, "template_id": template_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating role template: {e}")
        raise HTTPException(status_code=500, detail="建立角色模板時發生錯誤")


@router.get("/role-templates", response_model=List[RoleTemplateResponse])
def list_role_templates(
    is_active: Optional[bool] = Query(None),
    is_system: Optional[bool] = Query(None),
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """列出角色模板"""
    try:
        templates = role_template_dao.list_role_templates(is_active, is_system)
        return templates
        
    except Exception as e:
        logger.error(f"Error listing role templates: {e}")
        raise HTTPException(status_code=500, detail="取得角色模板列表時發生錯誤")


@router.get("/role-templates/{template_id}", response_model=RoleTemplateResponse)
def get_role_template(
    template_id: int,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """取得角色模板詳情"""
    try:
        template = role_template_dao.get_role_template(template_id)
        if not template:
            raise HTTPException(status_code=404, detail="角色模板不存在")
        return template
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting role template: {e}")
        raise HTTPException(status_code=500, detail="取得角色模板時發生錯誤")


@router.put("/role-templates/{template_id}", response_model=Dict[str, Any])
def update_role_template(
    template_id: int,
    update_data: RoleTemplateUpdate,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """更新角色模板"""
    try:
        success = role_template_dao.update_role_template(
            template_id, update_data, current_user['id']
        )
        
        if not success:
            raise HTTPException(status_code=400, detail="更新角色模板失敗（可能是系統模板）")
        
        # 記錄審計日誌
        audit_log_dao.create_audit_log(AuditLog(
            user_id=current_user['id'],
            action="update_role_template",
            target_type="role_template",
            target_id=str(template_id),
            changes=update_data.dict(exclude_unset=True),
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent")
        ))
        
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating role template: {e}")
        raise HTTPException(status_code=500, detail="更新角色模板時發生錯誤")


@router.delete("/role-templates/{template_id}", response_model=Dict[str, Any])
def delete_role_template(
    template_id: int,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """刪除角色模板"""
    try:
        success = role_template_dao.delete_role_template(template_id)
        
        if not success:
            raise HTTPException(
                status_code=400, 
                detail="刪除角色模板失敗（可能是系統模板或正在使用中）"
            )
        
        # 記錄審計日誌
        audit_log_dao.create_audit_log(AuditLog(
            user_id=current_user['id'],
            action="delete_role_template",
            target_type="role_template",
            target_id=str(template_id),
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent")
        ))
        
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting role template: {e}")
        raise HTTPException(status_code=500, detail="刪除角色模板時發生錯誤")


# ===== 部門角色管理 API =====

@router.post("/departments/{department_id}/roles", response_model=Dict[str, Any])
def create_department_role(
    department_id: int,
    role: DepartmentRoleCreate,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """為部門建立角色"""
    try:
        # 檢查部門是否存在
        dept = department_dao.get_department(department_id)
        if not dept:
            raise HTTPException(status_code=404, detail="部門不存在")
        
        # 檢查模板是否存在
        template = role_template_dao.get_role_template(role.template_id)
        if not template:
            raise HTTPException(status_code=404, detail="角色模板不存在")
        
        role_id = department_role_dao.create_department_role(
            department_id, role, current_user['id']
        )
        
        if not role_id:
            raise HTTPException(status_code=400, detail="建立部門角色失敗")
        
        # 記錄審計日誌
        audit_log_dao.create_audit_log(AuditLog(
            user_id=current_user['id'],
            action="create_department_role",
            target_type="department_role",
            target_id=str(role_id),
            changes={
                "department_id": department_id,
                "template_id": role.template_id,
                "name": role.name
            },
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent")
        ))
        
        return {"success": True, "role_id": role_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating department role: {e}")
        raise HTTPException(status_code=500, detail="建立部門角色時發生錯誤")


@router.post("/departments/{department_id}/roles/batch", response_model=Dict[str, Any])
def create_department_roles_batch(
    department_id: int,
    batch_data: DepartmentRolesBatchCreate,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """批量建立部門角色（新增部門時使用）"""
    try:
        # 檢查部門是否存在
        dept = department_dao.get_department(department_id)
        if not dept:
            raise HTTPException(status_code=404, detail="部門不存在")
        
        created_roles = []
        for template_data in batch_data.role_templates:
            role_create = DepartmentRoleCreate(
                template_id=template_data['template_id'],
                name=template_data.get('name')
            )
            role_id = department_role_dao.create_department_role(
                department_id, role_create, current_user['id']
            )
            if role_id:
                created_roles.append(role_id)
        
        # 記錄審計日誌
        audit_log_dao.create_audit_log(AuditLog(
            user_id=current_user['id'],
            action="create_department_roles_batch",
            target_type="department",
            target_id=str(department_id),
            changes={
                "created_roles": created_roles,
                "templates": batch_data.role_templates
            },
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent")
        ))
        
        return {"success": True, "created_roles": created_roles}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating department roles batch: {e}")
        raise HTTPException(status_code=500, detail="批量建立部門角色時發生錯誤")


@router.get("/department-roles", response_model=List[DepartmentRoleResponse])
def list_all_department_roles(
    department_id: Optional[int] = Query(None, description="部門ID，不指定則返回所有部門角色"),
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """查詢部門角色列表（可選過濾部門）"""
    try:
        if department_id:
            roles = department_role_dao.get_department_roles(department_id)
        else:
            # 獲取所有部門角色
            all_roles_query = """
                SELECT 
                    dr.*,
                    d.name as department_name,
                    d.path as department_path,
                    rt.name as template_name,
                    rt.role_type,
                    COALESCE(uc.user_count, 0) as user_count
                FROM department_roles dr
                INNER JOIN departments d ON dr.department_id = d.id
                INNER JOIN role_templates rt ON dr.template_id = rt.id
                LEFT JOIN (
                    SELECT role_id, COUNT(*) as user_count
                    FROM user_department_roles
                    GROUP BY role_id
                ) uc ON dr.id = uc.role_id
                ORDER BY d.path, dr.level, dr.name
            """
            roles = department_role_dao.execute_query(all_roles_query)
        
        return roles
        
    except Exception as e:
        logger.error(f"Error listing department roles: {e}")
        raise HTTPException(status_code=500, detail="查詢部門角色列表時發生錯誤")


@router.get("/departments/{department_id}/roles", response_model=List[DepartmentRoleResponse])
def list_department_roles(
    department_id: int,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """取得部門的所有角色"""
    try:
        roles = department_role_dao.get_department_roles(department_id)
        return roles
        
    except Exception as e:
        logger.error(f"Error listing department roles: {e}")
        raise HTTPException(status_code=500, detail="取得部門角色列表時發生錯誤")


@router.get("/departments/roles/batch", response_model=Dict[str, Dict[int, List[DepartmentRoleResponse]]])
def get_all_department_roles_batch(
    department_ids: Optional[str] = Query(None, description="部門ID列表，逗號分隔，例如: 1,2,3"),
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """批次取得多個部門的所有角色（優化版本）"""
    try:
        # 解析部門ID列表
        dept_ids = None
        if department_ids:
            dept_ids = [int(id.strip()) for id in department_ids.split(',') if id.strip()]
        
        # 批次查詢所有角色
        roles_by_dept = department_role_dao.get_all_department_roles_batch(dept_ids)
        
        return {"data": roles_by_dept}
        
    except ValueError:
        raise HTTPException(status_code=400, detail="部門ID格式錯誤")
    except Exception as e:
        logger.error(f"Error getting department roles batch: {e}")
        raise HTTPException(status_code=500, detail="批次取得部門角色時發生錯誤")


@router.get("/department-roles/{role_id}", response_model=Dict[str, Any])
def get_department_role(
    role_id: int,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """取得單個部門角色詳情"""
    try:
        role = department_role_dao.get_department_role(role_id)
        
        if not role:
            raise HTTPException(status_code=404, detail="找不到指定的角色")
        
        return role
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting department role: {e}")
        raise HTTPException(status_code=500, detail="取得部門角色詳情時發生錯誤")


@router.put("/department-roles/{role_id}", response_model=Dict[str, Any])
def update_department_role(
    role_id: int,
    update_data: DepartmentRoleUpdate,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """更新部門角色"""
    try:
        result = department_role_dao.update_department_role(
            role_id, update_data, current_user['id']
        )
        
        if not result['success']:
            raise HTTPException(status_code=400, detail="更新部門角色失敗")
        
        # 記錄審計日誌（包含警告信息）
        changes = update_data.dict(exclude_unset=True)
        if result.get('warning'):
            changes['warning'] = result['warning']
            
        audit_log_dao.create_audit_log(AuditLog(
            user_id=current_user['id'],
            action="update_department_role",
            target_type="department_role",
            target_id=str(role_id),
            changes=changes,
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent")
        ))
        
        # 返回成功狀態和可能的警告
        return {"success": True, "warning": result.get('warning')}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating department role: {e}")
        raise HTTPException(status_code=500, detail="更新部門角色時發生錯誤")


@router.delete("/department-roles/{role_id}", response_model=Dict[str, Any])
def delete_department_role(
    role_id: int,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """刪除部門角色"""
    try:
        success = department_role_dao.delete_department_role(role_id)
        
        if not success:
            raise HTTPException(status_code=400, detail="刪除部門角色失敗")
        
        # 記錄審計日誌
        audit_log_dao.create_audit_log(AuditLog(
            user_id=current_user['id'],
            action="delete_department_role",
            target_type="department_role",
            target_id=str(role_id),
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent")
        ))
        
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting department role: {e}")
        raise HTTPException(status_code=500, detail="刪除部門角色時發生錯誤")


# ===== 用戶角色指派 API =====

@router.post("/department-roles/{role_id}/users", response_model=Dict[str, Any])
def assign_users_to_role(
    role_id: int,
    assign_data: UserDepartmentRoleAssign,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """指派用戶到角色"""
    try:
        created_ids = user_department_role_dao.assign_users_to_role(
            role_id, assign_data, current_user['id']
        )
        
        # 記錄審計日誌
        audit_log_dao.create_audit_log(AuditLog(
            user_id=current_user['id'],
            action="assign_users_to_role",
            target_type="department_role",
            target_id=str(role_id),
            changes={
                "user_ids": assign_data.user_ids,
                "assignments": created_ids
            },
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent")
        ))
        
        return {"success": True, "assignments": created_ids}
        
    except Exception as e:
        logger.error(f"Error assigning users to role: {e}")
        raise HTTPException(status_code=500, detail="指派用戶到角色時發生錯誤")


@router.delete("/department-roles/{role_id}/users/{user_id}", response_model=Dict[str, Any])
def remove_user_from_role(
    role_id: int,
    user_id: int,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """移除用戶的角色"""
    try:
        success = user_department_role_dao.remove_user_from_role(user_id, role_id)
        
        if not success:
            raise HTTPException(status_code=400, detail="移除用戶角色失敗")
        
        # 記錄審計日誌
        audit_log_dao.create_audit_log(AuditLog(
            user_id=current_user['id'],
            action="remove_user_from_role",
            target_type="department_role",
            target_id=str(role_id),
            changes={"user_id": user_id},
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent")
        ))
        
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing user from role: {e}")
        raise HTTPException(status_code=500, detail="移除用戶角色時發生錯誤")


@router.get("/department-roles/{role_id}/users", response_model=List[Dict[str, Any]])
def get_role_users(
    role_id: int,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """取得角色的所有用戶"""
    try:
        users = user_department_role_dao.get_role_users(role_id)
        return users
        
    except Exception as e:
        logger.error(f"Error getting role users: {e}")
        raise HTTPException(status_code=500, detail="取得角色用戶列表時發生錯誤")


@router.get("/users/{user_id}/department-roles", response_model=List[Dict[str, Any]])
def get_user_department_roles(
    user_id: int,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """取得用戶的所有部門角色"""
    try:
        roles = user_department_role_dao.get_user_roles(user_id)
        return roles
        
    except Exception as e:
        logger.error(f"Error getting user department roles: {e}")
        raise HTTPException(status_code=500, detail="取得用戶部門角色時發生錯誤")


# ===== 角色層級管理 API =====

@router.get("/roles/find-parent", response_model=Dict[str, Any])
def find_parent_role(
    department_id: int,
    template_id: int,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """自動尋找父角色"""
    try:
        parent_id = department_role_dao.find_parent_role(department_id, template_id)
        
        if parent_id:
            parent_role = department_role_dao.get_department_role(parent_id)
            return {
                "success": True,
                "parent_role": {
                    "id": parent_id,
                    "name": parent_role['name'],
                    "department_name": parent_role['department_name'],
                    "level": parent_role['level']
                }
            }
        else:
            return {
                "success": True,
                "parent_role": None,
                "message": "頂層角色，無父角色"
            }
        
    except Exception as e:
        logger.error(f"Error finding parent role: {e}")
        raise HTTPException(status_code=500, detail="尋找父角色時發生錯誤")


@router.get("/roles/search", response_model=List[Dict[str, Any]])
def search_roles(
    q: str = Query(..., description="搜尋關鍵字"),
    exclude_id: Optional[int] = Query(None, description="排除的角色ID"),
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """搜尋角色（支援角色名和部門名）"""
    try:
        if len(q.strip()) < 1:
            return []
        
        roles = department_role_dao.search_roles(q.strip(), exclude_id)
        
        # 格式化返回結果
        formatted_roles = []
        for role in roles:
            formatted_roles.append({
                "id": role['id'],
                "name": role['name'],
                "department_name": role['department_name'],
                "department_path": role['department_path'],
                "template_name": role['template_name'],
                "level": role['level'],
                "display_name": f"{role['department_path']} / {role['name']} (層級:{role['level']})"
            })
        
        return formatted_roles
        
    except Exception as e:
        logger.error(f"Error searching roles: {e}")
        raise HTTPException(status_code=500, detail="搜尋角色時發生錯誤")


@router.get("/department-roles/{role_id}/children", response_model=List[Dict[str, Any]])
def get_role_children(
    role_id: int,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """獲取角色的所有子角色"""
    try:
        # 檢查角色是否存在
        role = department_role_dao.get_department_role(role_id)
        if not role:
            raise HTTPException(status_code=404, detail="角色不存在")
        
        # 獲取子角色
        children = department_role_dao.get_child_roles(role_id)
        
        return children
        
    except Exception as e:
        logger.error(f"Error getting role children: {e}")
        raise HTTPException(status_code=500, detail="獲取子角色時發生錯誤")


@router.post("/department-roles/{role_id}/recalculate-children", response_model=Dict[str, Any])
def recalculate_child_role_levels(
    role_id: int,
    request: Request,
    preview: bool = Query(False, description="是否為預覽模式"),
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """重新計算子角色層級"""
    try:
        # 檢查角色是否存在
        role = department_role_dao.get_department_role(role_id)
        if not role:
            raise HTTPException(status_code=404, detail="角色不存在")
        
        result = department_role_dao.recalculate_child_levels(role_id, preview)
        
        # 如果不是預覽模式且有更新，記錄審計日誌
        if not preview and result.get('success') and result.get('count', 0) > 0:
            audit_log_dao.create_audit_log(AuditLog(
                user_id=current_user['id'],
                action="recalculate_child_role_levels",
                target_type="department_role",
                target_id=str(role_id),
                changes={
                    "affected_roles": result.get('count', 0),
                    "changes": result.get('changes', [])
                },
                ip_address=request.client.host,
                user_agent=request.headers.get("User-Agent")
            ))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error recalculating child role levels: {e}")
        raise HTTPException(status_code=500, detail="重算子角色層級時發生錯誤")


@router.get("/department-roles/{role_id}/safe-parents", response_model=List[Dict[str, Any]])
def get_safe_parent_candidates(
    role_id: int,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """獲取可安全設為父角色的候選角色（排除會造成循環的角色）"""
    try:
        candidates = department_role_dao.get_safe_parent_candidates(role_id)
        return candidates
        
    except Exception as e:
        logger.error(f"Error getting safe parent candidates: {e}")
        raise HTTPException(status_code=500, detail="獲取父角色候選項時發生錯誤")

@router.get("/roles/tree", response_model=Dict[str, Any])
def get_roles_tree(
    department_id: Optional[int] = Query(None, description="部門ID，不指定則返回所有部門"),
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """取得角色樹狀結構"""
    try:
        if department_id:
            # 只返回指定部門的角色
            roles = department_role_dao.get_department_roles(department_id)
            tree = _build_role_tree(roles)
        else:
            # 返回所有部門的角色樹
            # 這裡可以擴展實作，目前先簡化處理
            departments = department_dao.list_departments()
            all_roles = []
            for dept in departments:
                dept_roles = department_role_dao.get_department_roles(dept['id'])
                all_roles.extend(dept_roles)
            tree = _build_role_tree(all_roles)
        
        return {"success": True, "tree": tree}
        
    except Exception as e:
        logger.error(f"Error getting roles tree: {e}")
        raise HTTPException(status_code=500, detail="取得角色樹時發生錯誤")


@router.post("/department-roles/{role_id}/move-preview", response_model=Dict[str, Any])
def preview_role_move(
    role_id: int,
    preview_data: Dict[str, Any],
    request: Request,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """預覽角色移動影響"""
    try:
        new_department_id = preview_data.get('new_department_id')
        include_children = preview_data.get('include_children', False)
        
        if not new_department_id:
            raise HTTPException(status_code=400, detail="必須提供目標部門ID")
        
        # 獲取角色資訊
        role = department_role_dao.get_department_role(role_id)
        if not role:
            raise HTTPException(status_code=404, detail="角色不存在")
        
        # 始終獲取所有子角色資訊（用於判斷是否有子角色）
        all_child_roles = department_role_dao.get_child_roles(role_id)
        # 根據參數決定是否返回詳細的子角色資訊
        child_roles = all_child_roles if include_children else []
        
        # 獲取目標部門資訊
        target_dept = department_dao.get_department(new_department_id)
        if not target_dept:
            raise HTTPException(status_code=404, detail="目標部門不存在")
        
        # 獲取目標部門現有角色
        target_roles = department_role_dao.get_department_roles(new_department_id)
        
        # 使用智能父角色推算（會自動檢測子孫節點並找到安全的父角色）
        parent_role_info = department_role_dao.find_safe_parent_role_for_move(
            role_id, 
            new_department_id,
            preferred_parent_id=preview_data.get('preferred_parent_id')  # 允許用戶指定優先父角色
        )
        
        # 計算新的層級
        new_parent_role = None
        new_parent_role_id = parent_role_info['parent_role_id']
        new_level = 1
        
        if new_parent_role_id:
            # 有找到安全的父角色
            for tr in target_roles:
                if tr['id'] == new_parent_role_id:
                    new_parent_role = tr
                    new_level = tr['level'] + 10
                    break
        else:
            # 沒有父角色（頂層角色）
            new_level = 1
        
        # 檢測潛在的循環引用（舊的邏輯保留，但主要依賴智能推算）
        circular_risks = []
        if target_roles:
            for target_role in target_roles:
                # 檢查是否有原本的子角色在目標部門
                if any(child['id'] == target_role['id'] for child in child_roles):
                    circular_risks.append({
                        'role_id': target_role['id'],
                        'role_name': target_role['name'],
                        'risk_type': 'child_becomes_parent',
                        'message': f"角色 '{target_role['name']}' 原本是 '{role['name']}' 的子角色，移動後可能成為父角色"
                    })
        
        # 返回預覽結果（包含智能推算的警告）
        return {
            'success': True,
            'source_role': {
                'id': role['id'],
                'name': role['name'],
                'current_department': role['department_name'],
                'current_level': role['level']
            },
            'child_roles': [
                {
                    'id': child['id'],
                    'name': child['name'],
                    'current_level': child['level'],
                    'new_level': new_level + (child['level'] - role['level'])
                }
                for child in child_roles
            ],
            'target_department': {
                'id': new_department_id,
                'name': target_dept['name'],
                'existing_roles': len(target_roles),
                'suggested_parent': {
                    'id': new_parent_role['id'],
                    'name': new_parent_role['name'],
                    'level': new_parent_role['level']
                } if new_parent_role else None
            },
            'new_hierarchy': {
                'parent_role': parent_role_info['parent_role_name'] or '無（頂層角色）',
                'parent_role_id': parent_role_info['parent_role_id'],
                'new_level': new_level
            },
            'circular_risks': circular_risks,
            'has_children': len(all_child_roles) > 0,
            'children_count': len(all_child_roles),
            'total_affected': len(child_roles) + 1 if include_children else 1,
            # 新增：智能推算的警告信息
            'has_descendants_in_target': parent_role_info['has_descendants_in_target'],
            'descendants_found': parent_role_info['descendants_found'],
            'warning': parent_role_info['warning_message']
        }
        
    except Exception as e:
        logger.error(f"Error previewing role move: {e}")
        raise HTTPException(status_code=500, detail="預覽角色移動時發生錯誤")

@router.put("/department-roles/{role_id}/move", response_model=Dict[str, Any])
def move_department_role(
    role_id: int,
    move_data: Dict[str, Any],
    request: Request,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """移動角色到不同部門（支援批量移動）"""
    try:
        # 從請求體中獲取參數
        new_department_id = move_data.get('new_department_id')
        new_parent_role_id = move_data.get('new_parent_role_id')
        include_children = move_data.get('include_children', False)
        force = move_data.get('force', False)  # 強制執行（忽略警告）
        
        if not new_department_id:
            raise HTTPException(status_code=400, detail="必須提供目標部門ID")
        
        # 檢查角色是否存在
        role = department_role_dao.get_department_role(role_id)
        if not role:
            raise HTTPException(status_code=404, detail="角色不存在")
        
        # 檢查新部門是否存在
        new_dept = department_dao.get_department(new_department_id)
        if not new_dept:
            raise HTTPException(status_code=404, detail="目標部門不存在")
        
        # 檢查是否試圖移動到相同部門
        if role['department_id'] == new_department_id:
            raise HTTPException(status_code=400, detail="角色已在該部門")
        
        # 檢查新父角色（如果指定）是否存在且在目標部門
        if new_parent_role_id:
            parent_role = department_role_dao.get_department_role(new_parent_role_id)
            if not parent_role:
                raise HTTPException(status_code=404, detail="指定的父角色不存在")
            
            if parent_role['department_id'] != new_department_id:
                raise HTTPException(status_code=400, detail="父角色必須在目標部門內")
            
            # 防止循環依賴：檢查新父角色不是當前角色的子角色
            if _is_descendant_role(new_parent_role_id, role_id):
                if not force:
                    raise HTTPException(status_code=400, detail="檢測到循環引用風險：不能將角色移動到其子角色下。如確定要執行，請使用強制模式。")
        
        # 執行移動操作
        result = department_role_dao.move_role_to_department(
            role_id, 
            new_department_id, 
            new_parent_role_id,
            include_children=include_children
        )
        
        if not result.get('success'):
            raise HTTPException(status_code=400, detail=result.get('message', '移動角色失敗'))
        
        # 記錄審計日誌
        audit_log_dao.create_audit_log(AuditLog(
            user_id=current_user['id'],
            action="move_department_role",
            target_type="department_role",
            target_id=str(role_id),
            changes={
                "from_department_id": role['department_id'],
                "to_department_id": new_department_id,
                "new_parent_role_id": new_parent_role_id,
                "affected_roles": result.get('affected_roles', [])
            },
            ip_address=request.client.host if request else None,
            user_agent=request.headers.get("User-Agent") if request else None
        ))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error moving department role: {e}")
        raise HTTPException(status_code=500, detail="移動角色時發生錯誤")


def _is_descendant_role(parent_role_id: int, role_id: int) -> bool:
    """檢查 parent_role_id 是否為 role_id 的子孫角色"""
    try:
        # 取得 role_id 的所有子角色
        child_roles = department_role_dao.get_child_roles(role_id)
        
        for child_role in child_roles:
            if child_role['id'] == parent_role_id:
                return True
            # 遞歸檢查子角色的子角色
            if _is_descendant_role(parent_role_id, child_role['id']):
                return True
        
        return False
        
    except Exception:
        # 如果檢查過程中出錯，為安全起見返回 True
        return True


def _build_role_tree(roles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """建立角色樹狀結構"""
    # 創建 ID 到角色的映射
    role_map = {role['id']: {**role, 'children': []} for role in roles}
    
    # 建立樹狀結構
    tree = []
    for role in roles:
        if role.get('parent_id') is None:
            tree.append(role_map[role['id']])
        elif role.get('parent_id') in role_map:
            role_map[role['parent_id']]['children'].append(role_map[role['id']])
    
    return tree


# ===== 角色關係分析 API =====

@router.get("/role-relationships/analyze", response_model=Dict[str, Any])
def analyze_role_relationships(
    include_inactive: bool = Query(False, description="是否包含停用的角色"),
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """分析角色關係並提供調整建議"""
    try:
        logger.info(f"User {current_user['username']} analyzing role relationships (include_inactive={include_inactive})")
        
        analysis_result = role_relationship_analysis_dao.analyze_cross_department_relationships(
            include_inactive=include_inactive
        )
        
        logger.info(f"Role relationship analysis completed: {analysis_result['issues_count']} issues found")
        return {
            "success": True,
            "data": analysis_result
        }
        
    except Exception as e:
        logger.error(f"Error analyzing role relationships: {e}")
        raise HTTPException(status_code=500, detail="分析角色關係失敗")


@router.post("/role-relationships/preview-adjustments", response_model=Dict[str, Any])
def preview_role_adjustments(
    adjustments: List[Dict[str, Any]],
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """預覽批量角色調整的影響"""
    try:
        logger.info(f"User {current_user['username']} previewing {len(adjustments)} role adjustments")
        
        preview_result = role_relationship_analysis_dao.preview_bulk_role_adjustments(adjustments)
        
        return {
            "success": True,
            "data": preview_result
        }
        
    except Exception as e:
        logger.error(f"Error previewing role adjustments: {e}")
        raise HTTPException(status_code=500, detail="預覽角色調整失敗")


@router.get("/role-relationships/check-department-paths", response_model=Dict[str, Any])
def check_department_paths(
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """檢查部門路徑一致性"""
    try:
        logger.info(f"User {current_user['username']} checking department paths")
        
        path_check = role_relationship_analysis_dao.check_and_fix_department_paths()
        
        return {
            "success": True,
            "data": path_check
        }
        
    except Exception as e:
        logger.error(f"Error checking department paths: {e}")
        raise HTTPException(status_code=500, detail="檢查部門路徑失敗")

@router.post("/role-relationships/fix-department-paths", response_model=Dict[str, Any])
def fix_department_paths(
    path_issues: List[Dict[str, Any]],
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """修復部門路徑不一致問題"""
    try:
        logger.info(f"User {current_user['username']} fixing {len(path_issues)} department path issues")
        
        # 記錄操作到審計日誌
        from app.models.organization import AuditLog
        audit_log = AuditLog(
            user_id=current_user['id'],
            action="DEPARTMENT_PATH_FIX",
            target_type="DEPARTMENTS",
            target_id=None,
            changes={"description": f"修復 {len(path_issues)} 個部門的路徑不一致問題"},
            ip_address=None
        )
        audit_log_dao.create_audit_log(audit_log)
        
        # 執行修復
        result = role_relationship_analysis_dao.fix_department_paths(path_issues)
        
        return {
            "success": True,
            "data": result
        }
        
    except Exception as e:
        logger.error(f"Error fixing department paths: {e}")
        raise HTTPException(status_code=500, detail="修復部門路徑失敗")

@router.post("/role-relationships/apply-adjustments", response_model=Dict[str, Any])
def apply_role_adjustments(
    adjustments: List[Dict[str, Any]],
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """執行批量角色關係調整"""
    try:
        logger.info(f"User {current_user['username']} applying {len(adjustments)} role adjustments")
        
        # 記錄調整操作到審計日誌
        from app.models.organization import AuditLog
        audit_log = AuditLog(
            user_id=current_user['id'],
            action="ROLE_RELATIONSHIP_ADJUSTMENT",
            target_type="DEPARTMENT_ROLES",
            target_id=None,
            changes={"description": f"批量調整 {len(adjustments)} 個角色的父子關係"},
            ip_address=None
        )
        audit_log_dao.create_audit_log(audit_log)
        
        success_count = 0
        failed_adjustments = []
        
        # 逐個執行調整
        for adjustment in adjustments:
            try:
                role_id = adjustment['role_id']
                new_parent_id = adjustment.get('suggested_parent_id')
                
                # 使用現有的更新邏輯
                update_data = DepartmentRoleUpdate(parent_id=new_parent_id)
                result = department_role_dao.update_department_role(
                    role_id, 
                    update_data, 
                    current_user['id']
                )
                
                if result.get('success', True):
                    success_count += 1
                else:
                    failed_adjustments.append({
                        'role_id': role_id,
                        'role_name': adjustment.get('role_name', f'角色 {role_id}'),
                        'reason': result.get('warning', '未知錯誤')
                    })
                    
            except Exception as adj_error:
                logger.error(f"Error adjusting role {adjustment['role_id']}: {adj_error}")
                failed_adjustments.append({
                    'role_id': adjustment['role_id'],
                    'role_name': adjustment.get('role_name', f'角色 {adjustment["role_id"]}'),
                    'reason': str(adj_error)
                })
        
        return {
            "success": True,
            "data": {
                "total_adjustments": len(adjustments),
                "success_count": success_count,
                "failed_count": len(failed_adjustments),
                "failed_adjustments": failed_adjustments
            }
        }
        
    except Exception as e:
        logger.error(f"Error applying role adjustments: {e}")
        raise HTTPException(status_code=500, detail="執行角色調整失敗")


@router.post("/role-relationships/apply-role-assignments", response_model=Dict[str, Any])
def apply_role_assignment_suggestions(
    role_assignments: RoleAssignmentSuggestionCreate,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """應用角色分配建議，批量創建推薦的角色"""
    try:
        logger.info(f"User {current_user['username']} applying {len(role_assignments.suggestions)} role assignment suggestions")
        
        # 記錄審計日誌
        audit_log = AuditLog(
            user_id=current_user['id'],
            action="apply_role_assignment_suggestions",
            target_type="role_assignment_suggestions",
            target_id="batch",
            changes={"suggestions_count": len(role_assignments.suggestions)},
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent")
        )
        audit_log_dao.create_audit_log(audit_log)
        
        created_roles = []
        failed_suggestions = []
        
        # 逐個處理部門的角色分配建議
        for suggestion in role_assignments.suggestions:
            department_id = suggestion.get('department_id')
            department_name = suggestion.get('department_name', '未知部門')
            recommended_roles = suggestion.get('recommended_roles', [])
            
            suggestion_result = {
                "department_id": department_id,
                "department_name": department_name,
                "roles_created": [],
                "roles_failed": []
            }
            
            # 逐個創建推薦的角色
            for role_rec in recommended_roles:
                try:
                    # 構建角色創建請求
                    role_create = DepartmentRoleCreate(
                        template_id=role_rec.get('template_id'),
                        name=role_rec.get('suggested_role_name'),
                        parent_id=role_rec.get('suggested_parent_role_id')
                    )
                    
                    # 創建角色
                    role_id = department_role_dao.create_department_role(
                        department_id, role_create, current_user['id']
                    )
                    
                    if role_id:
                        suggestion_result["roles_created"].append({
                            "role_id": role_id,
                            "role_name": role_rec.get('suggested_role_name'),
                            "template_name": role_rec.get('template_name')
                        })
                        created_roles.append(role_id)
                    else:
                        suggestion_result["roles_failed"].append({
                            "template_id": role_rec.get('template_id'),
                            "role_name": role_rec.get('suggested_role_name'),
                            "error": "創建失敗"
                        })
                        
                except Exception as role_error:
                    suggestion_result["roles_failed"].append({
                        "template_id": role_rec.get('template_id'),
                        "role_name": role_rec.get('suggested_role_name'),
                        "error": str(role_error)
                    })
            
            # 判斷此建議的整體結果
            if suggestion_result["roles_failed"]:
                failed_suggestions.append(suggestion_result)
        
        total_roles_attempted = sum(len(s.get('recommended_roles', [])) for s in role_assignments.suggestions)
        success_count = len(created_roles)
        
        return {
            "success": True,
            "data": {
                "total_suggestions": len(role_assignments.suggestions),
                "total_roles_attempted": total_roles_attempted,
                "success_count": success_count,
                "failed_count": total_roles_attempted - success_count,
                "created_roles": created_roles,
                "failed_suggestions": failed_suggestions
            }
        }
        
    except Exception as e:
        logger.error(f"Error applying role assignment suggestions: {e}")
        raise HTTPException(status_code=500, detail="應用角色分配建議失敗")


