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
    DepartmentRolePermissionBatchAssign,
    SystemMode, SystemModeUpdate, UserWithPermissionGroups,
    AuditLog
)
from app.dao.organization import (
    department_dao, permission_group_dao, user_org_dao, 
    system_mode_dao
)
from app.dao.audit import audit_log_dao
from app.dao.user import user_dao
from app.dao.permission_matrix import permission_matrix_dao
from app.dao.permission_groups import permission_groups_dao
from app.dao.permission_access import (
    permission_url_dao, permission_api_dao, 
    permission_action_dao, permission_cache_dao
)
from app.core.security.permissions import permission_required
import logging

# 導入批次查詢函式
from app.api.routes.organization import (
    get_users_permission_groups_batch, 
    get_users_department_roles_batch, 
    get_role_permission_groups_batch,
    merge_permissions
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/permissions", tags=["Permissions"])


# ===== 權限矩陣 API =====

@router.get("/matrix")
@permission_required("PERM.MATRIX_VIEW")
def get_permission_matrix(
    current_user: Dict[str, Any] = Depends(get_current_user),
    module_code: Optional[str] = Query(None, description="模組代碼篩選"),
    is_active: Optional[bool] = Query(None, description="啟用狀態篩選")
):
    """取得權限矩陣列表"""
    try:
        # 檢查表是否存在
        if permission_matrix_dao.check_table_exists():
            # 從 permission_matrix 表讀取
            items = permission_matrix_dao.get_all(module_code=module_code, is_active=is_active)
            return {"items": items}
        else:
            # 如果表不存在，嘗試從 configs 表讀取（向後相容）
            from app.dao.base import BaseDAO, db_manager
            import json
            
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
@permission_required("PERM.GROUP_CREATE")
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
        
        # 從請求中提取權限 ID 列表
        permission_ids = []
        if hasattr(permission_group, 'permission_ids') and permission_group.permission_ids:
            permission_ids = permission_group.permission_ids
        
        # 建立權限群組（不包含 permissions JSON 欄位）
        group_data = permission_group.dict()
        # 移除 permissions 和 permission_ids 欄位（如果存在）
        group_data.pop('permissions', None)
        group_data.pop('permission_ids', None)
        
        group_model = PermissionGroup(
            **group_data,
            created_by=current_user['id']
        )
        group_id = permission_group_dao.create_permission_group(group_model)
        
        if not group_id:
            raise HTTPException(status_code=400, detail="建立權限群組失敗")
        
        # 如果有權限 ID，新增到關聯表
        if permission_ids:
            success = permission_groups_dao.add_permissions_to_group(
                group_id, permission_ids, current_user['id']
            )
            if not success:
                logger.warning(f"Failed to add permissions to group {group_id}")
        
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
@permission_required("PERM.GROUP_VIEW")
def list_permission_groups(
    group_type: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """列出權限群組（優化版本 - 使用單一查詢取得統計資料）"""
    try:
        from app.dao.base import BaseDAO, db_manager
        
        # 使用 BaseDAO 執行優化查詢
        dao = BaseDAO(db_manager)
        
        # 構建 WHERE 條件
        where_conditions = []
        query_params = []
        
        if group_type is not None:
            where_conditions.append("pg.permission_type = %s")
            query_params.append(group_type)
        
        if is_active is not None:
            where_conditions.append("pg.is_active = %s")
            query_params.append(is_active)
        
        where_clause = ""
        if where_conditions:
            where_clause = "WHERE " + " AND ".join(where_conditions)
        
        # 優化的單一查詢：一次性取得群組和統計資料
        query = f"""
        SELECT 
            pg.id,
            pg.code,
            pg.name,
            pg.description,
            pg.permission_type,
            pg.is_active,
            pg.created_at,
            pg.created_by,
            pg.updated_at,
            pg.updated_by,
            COUNT(DISTINCT upg.user_id) as user_count,
            COUNT(DISTINCT dr.department_id) as department_count,
            COUNT(DISTINCT drpg.department_role_id) as role_count
        FROM permission_groups pg
        LEFT JOIN permission_groups_user upg ON pg.id = upg.permission_group_id
        LEFT JOIN permission_groups_department_role drpg ON pg.id = drpg.permission_group_id
        LEFT JOIN department_roles dr ON drpg.department_role_id = dr.id AND dr.is_active = true
        {where_clause}
        GROUP BY pg.id, pg.code, pg.name, pg.description, pg.permission_type, 
                 pg.is_active, pg.created_at, pg.created_by, 
                 pg.updated_at, pg.updated_by
        ORDER BY pg.created_at DESC
        """
        
        groups = dao.execute_query(query, query_params)
        
        # 轉換結果格式以符合預期的回應格式
        formatted_groups = []
        for group in groups or []:
            formatted_group = dict(group)
            # 確保數值類型正確
            formatted_group['user_count'] = int(group.get('user_count', 0))
            formatted_group['department_count'] = int(group.get('department_count', 0))
            formatted_group['role_count'] = int(group.get('role_count', 0))
            
            # 移除 permissions 欄位（不再使用）
            formatted_group.pop('permissions', None)
            
            formatted_groups.append(formatted_group)
        
        return formatted_groups
        
    except Exception as e:
        logger.error(f"Error listing permission groups: {e}")
        raise HTTPException(status_code=500, detail="取得權限群組列表時發生錯誤")


@router.get("/groups/{group_id}", response_model=PermissionGroupResponse)
@permission_required("PERM.GROUP_VIEW")
def get_permission_group(
    group_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """取得權限群組詳情"""
    try:
        group = permission_group_dao.get_permission_group(group_id)
        if not group:
            raise HTTPException(status_code=404, detail="權限群組不存在")
        
        # 移除 permissions JSON 欄位（如果存在）
        group.pop('permissions', None)
        
        # 從關聯表取得權限列表
        group['permission_ids'] = permission_groups_dao.get_group_permission_ids(group_id)
        group['permissions_detail'] = permission_groups_dao.get_group_permissions(group_id)
        
        # 加入使用者數量
        users = user_org_dao.list_users_with_permission_group(group_id)
        group['user_count'] = len(users)
        
        # 加入部門數量和角色數量統計（使用與列表頁面相同的查詢邏輯）
        from app.dao.base import BaseDAO, db_manager
        dao = BaseDAO(db_manager)
        stats_query = """
            SELECT 
                COUNT(DISTINCT dr.department_id) as department_count,
                COUNT(DISTINCT drpg.department_role_id) as role_count
            FROM permission_groups_department_role drpg
            LEFT JOIN department_roles dr ON drpg.department_role_id = dr.id AND dr.is_active = true
            WHERE drpg.permission_group_id = %s
        """
        stats_result = dao.execute_query(stats_query, (group_id,))
        if stats_result:
            group['department_count'] = int(stats_result[0]['department_count'])
            group['role_count'] = int(stats_result[0]['role_count'])
        else:
            group['department_count'] = 0
            group['role_count'] = 0
        
        return group
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting permission group: {e}")
        raise HTTPException(status_code=500, detail="取得權限群組詳情時發生錯誤")


@router.put("/groups/{group_id}", response_model=Dict[str, Any])
@permission_required("PERM.GROUP_UPDATE")
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
        
        # 從請求中提取權限 ID 列表
        permission_ids = None
        if hasattr(updates, 'permission_ids'):
            permission_ids = updates.permission_ids
        
        # 檢查是否為系統權限群組
        if group['permission_type'] == 'system':
            # 系統權限群組只能更新部分欄位，不允許類型轉換
            allowed_updates = ['description']  # 移除 'permissions'
            update_data = {k: v for k, v in updates.dict().items() 
                          if v is not None and k in allowed_updates}
        else:
            # 自訂權限群組也不允許變更為系統權限群組
            update_data = {k: v for k, v in updates.dict().items() if v is not None}
            if 'permission_type' in update_data:
                update_data['permission_type'] = 'custom'  # 強制保持為 custom
        
        # 移除 permissions 和 permission_ids 欄位（不應該在群組表中）
        update_data.pop('permissions', None)
        update_data.pop('permission_ids', None)
        
        update_data['updated_by'] = current_user['id']
        
        # 執行更新
        success = permission_group_dao.update_permission_group(group_id, update_data)
        if not success:
            raise HTTPException(status_code=400, detail="更新權限群組失敗")
        
        # 如果有提供權限 ID 列表，更新權限關聯
        if permission_ids is not None:
            success = permission_groups_dao.update_group_permissions(
                group_id, permission_ids, current_user['id']
            )
            if not success:
                logger.warning(f"Failed to update permissions for group {group_id}")
        
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
@permission_required("PERM.GROUP_DELETE")
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


@router.get("/groups/{group_id}/permissions", response_model=List[Dict[str, Any]])
@permission_required("PERM.GROUP_VIEW")
def get_group_permissions(
    group_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """取得權限群組的權限列表"""
    try:
        # 檢查權限群組是否存在
        group = permission_group_dao.get_permission_group(group_id)
        if not group:
            raise HTTPException(status_code=404, detail="權限群組不存在")
        
        # 從關聯表取得權限
        permissions = permission_groups_dao.get_group_permissions(group_id)
        return permissions
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting group permissions: {e}")
        raise HTTPException(status_code=500, detail="取得權限群組權限時發生錯誤")


@router.put("/groups/{group_id}/permissions", response_model=Dict[str, Any])
@permission_required("PERM.GROUP_PERM_UPDATE")
def update_group_permissions(
    group_id: int,
    permission_ids: List[int],
    request: Request,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """更新權限群組的權限"""
    try:
        # 檢查權限群組是否存在
        group = permission_group_dao.get_permission_group(group_id)
        if not group:
            raise HTTPException(status_code=404, detail="權限群組不存在")
        
        # 更新權限
        success = permission_groups_dao.update_group_permissions(
            group_id, permission_ids, current_user['id']
        )
        
        if not success:
            raise HTTPException(status_code=400, detail="更新權限失敗")
        
        # 記錄審計日誌
        audit_log_dao.create_audit_log(AuditLog(
            user_id=current_user['id'],
            action="update_group_permissions",
            target_type="permission_group",
            target_id=str(group_id),
            changes={'permission_ids': permission_ids},
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent")
        ))
        
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating group permissions: {e}")
        raise HTTPException(status_code=500, detail="更新權限群組權限時發生錯誤")


@router.get("/groups/{group_id}/users", response_model=List[Dict[str, Any]])
@permission_required("PERM.GROUP_VIEW")
def get_permission_group_users(
    group_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """取得權限群組的所有使用者（優化版本）"""
    try:
        # 檢查權限群組是否存在
        group = permission_group_dao.get_permission_group(group_id)
        if not group:
            raise HTTPException(status_code=404, detail="權限群組不存在")
        
        # 取得使用者基本資訊
        users = user_org_dao.list_users_with_permission_group(group_id)
        if not users:
            return []
        
        # 提取使用者ID列表
        user_ids = [user['id'] for user in users]
        
        # 批次取得完整使用者資訊
        full_users_map = {}
        for user_id in user_ids:
            full_user = user_dao.get_user_by_id(user_id)
            if full_user:
                full_users_map[user_id] = full_user
        
        # 批次取得所有使用者的權限群組
        users_permission_groups = get_users_permission_groups_batch(user_ids)
        
        # 批次取得所有使用者的部門角色
        users_department_roles = get_users_department_roles_batch(user_ids)
        
        # 收集所有角色ID以批次取得角色權限
        all_role_ids = set()
        for user_roles in users_department_roles.values():
            for role in user_roles:
                if role.get('department_role_id'):
                    all_role_ids.add(role['department_role_id'])
        
        # 批次取得角色權限群組
        role_permission_groups = get_role_permission_groups_batch(list(all_role_ids))
        
        # 組合使用者資料
        enriched_users = []
        for user in users:
            user_id = user['id']
            full_user = full_users_map.get(user_id)
            
            if full_user:
                # 基本資訊
                enriched_user = {
                    'id': user['id'],
                    'loginid': user.get('loginid'),
                    'username': user['username'],
                    'email': user['email'],
                    'is_active': user['is_active'],
                    'employee_no': user.get('employee_no'),
                    'title': user.get('title'),
                    'auth_source': user.get('auth_source'),
                    'assigned_at': user.get('assigned_at'),
                    'expires_at': user.get('expires_at'),
                    'department': {
                        'id': user.get('department_id'),
                        'name': user.get('department_name'),
                        'code': user.get('department_code')
                    } if user.get('department_name') else None
                }
                
                # 個人權限群組
                direct_permissions = users_permission_groups.get(user_id, [])
                enriched_user['permission_groups'] = direct_permissions
                
                # 部門角色
                user_roles = users_department_roles.get(user_id, [])
                enriched_user['department_roles'] = user_roles
                
                # 收集所有角色的權限群組
                role_permissions = []
                for role in user_roles:
                    role_id = role.get('department_role_id')
                    if role_id and role_id in role_permission_groups:
                        role_permissions.extend(role_permission_groups[role_id])
                
                # 角色繼承的權限群組
                enriched_user['role_permission_groups'] = role_permissions
                
                # 合併所有權限（去重）
                merged_permissions = merge_permissions(direct_permissions, role_permissions)
                enriched_user['all_permissions'] = merged_permissions
                
                enriched_users.append(enriched_user)
        
        return enriched_users
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting permission group users: {e}")
        raise HTTPException(status_code=500, detail="取得權限群組使用者列表時發生錯誤")


# ===== 部門角色權限批次管理 API =====

@router.get("/groups/{group_id}/department-roles", response_model=List[Dict[str, Any]])
@permission_required("PERM.GROUP_DEPT_UPDATE")
def get_group_department_roles(
    group_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """獲取權限群組已分配的部門角色"""
    try:
        from app.dao.base import BaseDAO, db_manager
        
        # 使用 BaseDAO 執行查詢
        dao = BaseDAO(db_manager)
        query = """
        SELECT 
            drpg.department_role_id as id,
            dr.name,
            dr.code,
            d.name as department_name,
            d.code as department_code
        FROM permission_groups_department_role drpg
        JOIN department_roles dr ON drpg.department_role_id = dr.id
        JOIN departments d ON dr.department_id = d.id
        WHERE drpg.permission_group_id = %s
        AND dr.is_active = true
        """
        
        result = dao.execute_query(query, (group_id,))
        return result or []
        
    except Exception as e:
        logger.error(f"Error getting group department roles: {e}")
        raise HTTPException(status_code=500, detail="獲取權限群組部門角色時發生錯誤")


@router.post("/groups/{group_id}/batch-assign", response_model=Dict[str, Any])
@permission_required("PERM.GROUP_DEPT_UPDATE")
def batch_assign_permission_group_to_roles(
    group_id: int,
    batch_data: DepartmentRolePermissionBatchAssign,
    request: Request,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """批次分配/移除權限群組給部門角色"""
    try:
        from app.dao.base import BaseDAO, db_manager
        
        # 驗證權限群組是否存在
        permission_group = permission_group_dao.get_permission_group(group_id)
        if not permission_group:
            raise HTTPException(status_code=404, detail="權限群組不存在")
        
        # 驗證動作類型
        if batch_data.action not in ['assign', 'remove']:
            raise HTTPException(status_code=400, detail="動作類型必須是 'assign' 或 'remove'")
            
        if not batch_data.department_role_ids:
            raise HTTPException(status_code=400, detail="必須提供至少一個部門角色ID")
        
        # 使用 BaseDAO 執行批次操作
        dao = BaseDAO(db_manager)
        success_count = 0
        failed_count = 0
        errors = []
        
        for role_id in batch_data.department_role_ids:
            try:
                # 驗證部門角色是否存在
                role_check_query = "SELECT id FROM department_roles WHERE id = %s AND is_active = true"
                role_exists = dao.execute_query(role_check_query, (role_id,))
                
                if not role_exists:
                    errors.append(f"部門角色ID {role_id} 不存在或已停用")
                    failed_count += 1
                    continue
                
                if batch_data.action == 'assign':
                    # 批次指派權限
                    insert_query = """
                    INSERT IGNORE INTO permission_groups_department_role 
                    (department_role_id, permission_group_id, assigned_by, assigned_at) 
                    VALUES (%s, %s, %s, NOW())
                    """
                    result = dao.execute_update(insert_query, (role_id, group_id, current_user['id']))
                    if result > 0:
                        success_count += 1
                    else:
                        errors.append(f"部門角色ID {role_id} 已經擁有此權限群組")
                        
                elif batch_data.action == 'remove':
                    # 批次移除權限
                    delete_query = """
                    DELETE FROM permission_groups_department_role 
                    WHERE department_role_id = %s AND permission_group_id = %s
                    """
                    result = dao.execute_update(delete_query, (role_id, group_id))
                    if result > 0:
                        success_count += 1
                    else:
                        errors.append(f"部門角色ID {role_id} 沒有此權限群組")
                        
            except Exception as role_error:
                logger.error(f"Error processing role {role_id}: {role_error}")
                errors.append(f"處理部門角色ID {role_id} 時發生錯誤: {str(role_error)}")
                failed_count += 1
        
        # 記錄審計日誌
        audit_log_dao.create_audit_log(AuditLog(
            user_id=current_user['id'],
            action=f"batch_{batch_data.action}_permission_group_to_roles",
            target_type="permission_group",
            target_id=str(group_id),
            changes={
                "department_role_ids": batch_data.department_role_ids,
                "action": batch_data.action,
                "success_count": success_count,
                "failed_count": failed_count,
                "errors": errors[:10]  # 只記錄前10個錯誤
            },
            ip_address=request.client.host
        ))
        
        response_data = {
            "success": True,
            "total": len(batch_data.department_role_ids),
            "success_count": success_count,
            "failed_count": failed_count,
            "action": batch_data.action,
            "permission_group_id": group_id
        }
        
        if errors:
            response_data["errors"] = errors[:20]  # 最多返回20個錯誤
        
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in batch assign permission group to roles: {e}")
        raise HTTPException(status_code=500, detail="批次分配權限群組時發生錯誤")


# ===== 權限矩陣 CRUD API =====

@router.post("/matrix")
@permission_required("PERM.MATRIX_CREATE")
def create_permission_matrix(
    matrix_data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """新增權限矩陣項目"""
    try:
        # 添加創建者資訊
        matrix_data['created_by'] = current_user['id']
        
        # 使用 DAO 創建
        matrix_id = permission_matrix_dao.create(matrix_data)
        
        if not matrix_id:
            permission_key = f"{matrix_data['module_code']}.{matrix_data['action_code']}"
            raise HTTPException(status_code=400, detail=f"權限鍵值 {permission_key} 已存在或創建失敗")
        
        # 記錄審計日誌
        audit_log_dao.create_audit_log(AuditLog(
            user_id=current_user['id'],
            action='CREATE',
            target_type='permission_matrix',
            target_id=str(matrix_id),
            changes={
                'module_code': matrix_data['module_code'],
                'action_code': matrix_data['action_code'],
                'permission_key': f"{matrix_data['module_code']}.{matrix_data['action_code']}"
            }
        ))
        
        return {"success": True, "message": "權限項目已新增", "id": matrix_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating permission matrix: {e}")
        raise HTTPException(status_code=500, detail="新增權限項目時發生錯誤")


@router.put("/matrix/{matrix_id}")
@permission_required("PERM.MATRIX_UPDATE")
def update_permission_matrix(
    matrix_id: int,
    matrix_data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """更新權限矩陣項目"""
    try:
        # 檢查權限項目是否存在
        existing = permission_matrix_dao.get_by_id(matrix_id)
        if not existing:
            raise HTTPException(status_code=404, detail="權限項目不存在")
        
        # 添加更新者資訊
        matrix_data['updated_by'] = current_user['id']
        
        # 使用 DAO 更新
        success = permission_matrix_dao.update(matrix_id, matrix_data)
        
        if not success:
            permission_key = f"{matrix_data['module_code']}.{matrix_data['action_code']}"
            raise HTTPException(status_code=400, detail=f"更新失敗，權限鍵值 {permission_key} 可能已被使用")
        
        # 記錄審計日誌
        audit_log_dao.create_audit_log(AuditLog(
            user_id=current_user['id'],
            action='UPDATE',
            target_type='permission_matrix',
            target_id=str(matrix_id),
            changes={
                'permission_key': existing['permission_key'],
                'updated_fields': matrix_data
            }
        ))
        
        return {"success": True, "message": "權限項目已更新"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating permission matrix: {e}")
        raise HTTPException(status_code=500, detail="更新權限項目時發生錯誤")


@router.patch("/matrix/{matrix_id}")
@permission_required("PERM.MATRIX_ACTIVATE")
def toggle_permission_matrix_status(
    matrix_id: int,
    status_data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """切換權限矩陣項目狀態"""
    try:
        # 使用 DAO 更新狀態
        success = permission_matrix_dao.update_status(
            matrix_id, 
            status_data['is_active'],
            current_user['id']
        )
        
        if not success:
            raise HTTPException(status_code=404, detail="權限項目不存在")
        
        # 記錄審計日誌
        action = "啟用" if status_data['is_active'] else "停用"
        audit_log_dao.create_audit_log(AuditLog(
            user_id=current_user['id'],
            action='TOGGLE_STATUS',
            target_type='permission_matrix',
            target_id=str(matrix_id),
            changes={
                'is_active': status_data['is_active'],
                'action_description': f"{action}權限項目"
            }
        ))
        
        return {"success": True, "message": f"權限項目已{action}"}
        
    except Exception as e:
        logger.error(f"Error toggling permission matrix status: {e}")
        raise HTTPException(status_code=500, detail="切換權限狀態時發生錯誤")


@router.delete("/matrix/{matrix_id}")
@permission_required("PERM.MATRIX_DELETE")
def delete_permission_matrix(
    matrix_id: int,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """刪除權限矩陣項目"""
    try:
        # 先取得項目資訊用於審計日誌
        existing = permission_matrix_dao.get_by_id(matrix_id)
        if not existing:
            raise HTTPException(status_code=404, detail="權限項目不存在")
        
        if existing['permission_type'] == 'system':
            raise HTTPException(status_code=403, detail="系統權限不能刪除")
        
        # 使用 DAO 刪除
        success = permission_matrix_dao.delete(matrix_id)
        
        if not success:
            raise HTTPException(status_code=500, detail="刪除權限項目失敗")
        
        # 記錄審計日誌
        audit_log_dao.create_audit_log(AuditLog(
            user_id=current_user['id'],
            action='DELETE',
            target_type='permission_matrix',
            target_id=str(matrix_id),
            changes={
                'deleted_permission_key': existing['permission_key'],
                'module_code': existing['module_code'],
                'action_code': existing['action_code']
            }
        ))
        
        return {"success": True, "message": "權限項目已刪除"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting permission matrix: {e}")
        raise HTTPException(status_code=500, detail="刪除權限項目時發生錯誤")


# ===== 權限存取管理 API =====

# URL 權限管理
@router.get("/access/urls")
@permission_required("PERM.URL_VIEW")
def get_permission_urls(
    current_user: Dict[str, Any] = Depends(get_current_user),
    is_active: Optional[bool] = Query(None, description="啟用狀態篩選"),
    is_public: Optional[bool] = Query(None, description="公開狀態篩選")
):
    """取得 URL 權限列表"""
    try:
        urls = permission_url_dao.get_all(is_active=is_active, is_public=is_public)
        return {"items": urls}
    except Exception as e:
        logger.error(f"Error getting URL permissions: {e}")
        raise HTTPException(status_code=500, detail="取得 URL 權限時發生錯誤")


@router.post("/access/urls")
@permission_required("PERM.URL_CREATE")
def create_permission_url(
    data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """新增 URL 權限"""
    try:
        data['created_by'] = current_user['id']
        url_id = permission_url_dao.create(data)
        return {"success": True, "id": url_id}
    except Exception as e:
        logger.error(f"Error creating URL permission: {e}")
        raise HTTPException(status_code=500, detail="新增 URL 權限失敗")


@router.put("/access/urls/{url_id}")
@permission_required("PERM.URL_UPDATE")
def update_permission_url(
    url_id: int,
    data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """更新 URL 權限"""
    try:
        data['updated_by'] = current_user['id']
        success = permission_url_dao.update(url_id, data)
        if success:
            return {"success": True}
        else:
            raise HTTPException(status_code=404, detail="URL 權限不存在")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating URL permission: {e}")
        raise HTTPException(status_code=500, detail="更新 URL 權限失敗")


@router.delete("/access/urls/{url_id}")
@permission_required("PERM.URL_DELETE")
def delete_permission_url(
    url_id: int,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """刪除 URL 權限"""
    try:
        success = permission_url_dao.delete(url_id)
        if success:
            return {"success": True}
        else:
            raise HTTPException(status_code=404, detail="URL 權限不存在")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting URL permission: {e}")
        raise HTTPException(status_code=500, detail="刪除 URL 權限失敗")


@router.post("/access/urls/test")
def test_url_permission(
    data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """測試 URL 權限"""
    try:
        url = data.get('url')
        method = data.get('method', 'GET')
        
        if not url:
            raise HTTPException(status_code=400, detail="URL 為必填")
        
        result = permission_url_dao.check_permission(
            current_user['id'], url, method
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error testing URL permission: {e}")
        raise HTTPException(status_code=500, detail="測試 URL 權限失敗")


# API 權限管理
@router.get("/access/apis")
@permission_required("PERM.API_VIEW")
def get_permission_apis(
    current_user: Dict[str, Any] = Depends(get_current_user),
    is_active: Optional[bool] = Query(None, description="啟用狀態篩選"),
    require_auth: Optional[bool] = Query(None, description="認證需求篩選")
):
    """取得 API 權限列表"""
    try:
        apis = permission_api_dao.get_all(is_active=is_active, require_auth=require_auth)
        return {"items": apis}
    except Exception as e:
        logger.error(f"Error getting API permissions: {e}")
        raise HTTPException(status_code=500, detail="取得 API 權限時發生錯誤")


@router.post("/access/apis")
@permission_required("PERM.API_CREATE")
def create_permission_api(
    data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """新增 API 權限"""
    try:
        data['created_by'] = current_user['id']
        api_id = permission_api_dao.create(data)
        return {"success": True, "id": api_id}
    except Exception as e:
        logger.error(f"Error creating API permission: {e}")
        raise HTTPException(status_code=500, detail="新增 API 權限失敗")


@router.put("/access/apis/{api_id}")
@permission_required("PERM.API_UPDATE")
def update_permission_api(
    api_id: int,
    data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """更新 API 權限"""
    try:
        data['updated_by'] = current_user['id']
        success = permission_api_dao.update(api_id, data)
        if success:
            return {"success": True}
        else:
            raise HTTPException(status_code=404, detail="API 權限不存在")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating API permission: {e}")
        raise HTTPException(status_code=500, detail="更新 API 權限失敗")


@router.delete("/access/apis/{api_id}")
@permission_required("PERM.API_DELETE")
def delete_permission_api(
    api_id: int,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """刪除 API 權限"""
    try:
        success = permission_api_dao.delete(api_id)
        if success:
            return {"success": True}
        else:
            raise HTTPException(status_code=404, detail="API 權限不存在")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting API permission: {e}")
        raise HTTPException(status_code=500, detail="刪除 API 權限失敗")


@router.post("/access/apis/test")
def test_api_permission(
    data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """測試 API 權限"""
    try:
        api = data.get('api')
        method = data.get('method', 'GET')
        
        if not api:
            raise HTTPException(status_code=400, detail="API 路徑為必填")
        
        result = permission_api_dao.check_permission(
            current_user['id'], api, method
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error testing API permission: {e}")
        raise HTTPException(status_code=500, detail="測試 API 權限失敗")


# 動作權限管理
@router.get("/access/actions")
@permission_required("PERM.ACTION_VIEW")
def get_permission_actions(
    current_user: Dict[str, Any] = Depends(get_current_user),
    module_key: Optional[str] = Query(None, description="模組篩選"),
    is_active: Optional[bool] = Query(None, description="啟用狀態篩選")
):
    """取得動作權限列表"""
    try:
        actions = permission_action_dao.get_all(module_key=module_key, is_active=is_active)
        return {"items": actions}
    except Exception as e:
        logger.error(f"Error getting action permissions: {e}")
        raise HTTPException(status_code=500, detail="取得動作權限時發生錯誤")


@router.post("/access/actions")
@permission_required("PERM.ACTION_CREATE")
def create_permission_action(
    data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """新增動作權限"""
    try:
        data['created_by'] = current_user['id']
        action_id = permission_action_dao.create(data)
        return {"success": True, "id": action_id}
    except Exception as e:
        logger.error(f"Error creating action permission: {e}")
        raise HTTPException(status_code=500, detail="新增動作權限失敗")


@router.put("/access/actions/{action_id}")
@permission_required("PERM.ACTION_UPDATE")
def update_permission_action(
    action_id: int,
    data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """更新動作權限"""
    try:
        data['updated_by'] = current_user['id']
        success = permission_action_dao.update(action_id, data)
        if success:
            return {"success": True}
        else:
            raise HTTPException(status_code=404, detail="動作權限不存在")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating action permission: {e}")
        raise HTTPException(status_code=500, detail="更新動作權限失敗")


@router.delete("/access/actions/{action_id}")
@permission_required("PERM.ACTION_DELETE")
def delete_permission_action(
    action_id: int,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """刪除動作權限"""
    try:
        success = permission_action_dao.delete(action_id)
        if success:
            return {"success": True}
        else:
            raise HTTPException(status_code=404, detail="動作權限不存在")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting action permission: {e}")
        raise HTTPException(status_code=500, detail="刪除動作權限失敗")


# 快取管理
@router.get("/access/cache")
def get_cache_info(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """取得快取資訊"""
    try:
        cache_info = permission_cache_dao.get_cache_info()
        return cache_info
    except Exception as e:
        logger.error(f"Error getting cache info: {e}")
        raise HTTPException(status_code=500, detail="取得快取資訊失敗")


@router.delete("/access/cache")
@permission_required("PERM.CACHE_CLEAR")
def clear_cache(
    user_id: Optional[int] = Query(None, description="特定使用者 ID"),
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """清除權限快取"""
    try:
        if user_id:
            success = permission_cache_dao.clear_user_cache(user_id)
            message = f"使用者 {user_id} 的快取已清除" if success else "清除失敗"
        else:
            count = permission_cache_dao.clear_all_cache()
            message = f"已清除 {count} 筆快取"
        
        return {"success": True, "message": message}
    except Exception as e:
        logger.error(f"Error clearing cache: {e}")
        raise HTTPException(status_code=500, detail="清除快取失敗")


@router.post("/access/cache/refresh")
@permission_required("PERM.CACHE_REFRESH")
def refresh_cache(
    user_id: Optional[int] = Query(None, description="特定使用者 ID"),
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """重新整理權限快取"""
    try:
        success = permission_cache_dao.refresh_cache(user_id)
        message = "快取已重新整理" if success else "重新整理失敗"
        return {"success": success, "message": message}
    except Exception as e:
        logger.error(f"Error refreshing cache: {e}")
        raise HTTPException(status_code=500, detail="重新整理快取失敗")

