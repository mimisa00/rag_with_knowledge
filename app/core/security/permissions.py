"""
權限檢查模組
"""
import asyncio
from typing import Dict, Any, List, Optional
from fastapi import HTTPException, status
from app.utils.logging import get_logger

logger = get_logger(__name__)


def require_admin(user: Dict[str, Any]) -> None:
    """要求管理員權限（支援 role 或權限群組）"""
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="需要登入"
        )
    
    # 方式1: 檢查 role 是否為 admin
    if user.get("role") == "admin":
        return
    
    # 方式2: 檢查是否有 ADMIN.ACCESS 權限（透過權限群組）
    if check_permission(user, "ADMIN.ACCESS"):
        return
    
    # 都不符合，拒絕存取
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


def get_user_permissions(user_id: int) -> List[Dict[str, Any]]:
    """取得用戶的完整權限清單（個人權限 + 角色權限）"""
    try:
        from app.dao.base import BaseDAO, db_manager
        
        dao = BaseDAO(db_manager)
        
        # 查詢用戶的個人權限和角色權限
        query = """
            SELECT DISTINCT
                pg.id,
                pg.code,
                pg.name,
                pg.permission_type as type,
                pg.description,
                'personal' as permission_source
            FROM permission_groups_user upg
            JOIN permission_groups pg ON upg.permission_group_id = pg.id
            WHERE upg.user_id = %s AND pg.is_active = TRUE
            
            UNION
            
            SELECT DISTINCT
                pg.id,
                pg.code,
                pg.name,
                pg.permission_type as type,
                pg.description,
                'role' as permission_source
            FROM user_department_roles udr
            JOIN permission_groups_department_role drpg ON udr.department_role_id = drpg.department_role_id
            JOIN permission_groups pg ON drpg.permission_group_id = pg.id
            WHERE udr.user_id = %s AND pg.is_active = TRUE
            
            ORDER BY type, name
        """
        
        permissions = dao.execute_query(query, (user_id, user_id))
        return permissions or []
        
    except Exception as e:
        logger.error(f"Error getting user permissions: {e}")
        return []


def get_user_permission_codes(user_id: int) -> List[str]:
    """取得用戶的權限代碼清單"""
    try:
        from app.dao.base import BaseDAO, db_manager
        dao = BaseDAO(db_manager)
        
        # 直接從關聯表取得所有權限
        query = """
            SELECT DISTINCT pm.permission_key
            FROM permission_groups_user pgu
            JOIN permission_groups_matrix pgm ON pgu.permission_group_id = pgm.permission_group_id
            JOIN permission_matrix pm ON pgm.permission_matrix_id = pm.id
            WHERE pgu.user_id = %s
            AND (pgu.expires_at IS NULL OR pgu.expires_at > NOW())
            AND pm.is_active = 1
            
            UNION
            
            SELECT DISTINCT pm.permission_key
            FROM user_department_roles udr
            JOIN permission_groups_department_role drpg ON udr.department_role_id = drpg.department_role_id
            JOIN permission_groups_matrix pgm ON drpg.permission_group_id = pgm.permission_group_id
            JOIN permission_matrix pm ON pgm.permission_matrix_id = pm.id
            WHERE udr.user_id = %s
            AND pm.is_active = 1
        """
        
        results = dao.execute_query(query, [user_id, user_id])
        
        # 取得權限群組代碼
        permissions = get_user_permissions(user_id)
        permission_codes = []
        
        # 添加權限群組代碼
        for p in permissions:
            if p.get('code'):
                permission_codes.append(p['code'])
        
        # 添加具體權限
        if results:
            permission_codes.extend([r['permission_key'] for r in results])
        
        # 去重並返回
        return list(set(permission_codes))
        
    except Exception as e:
        logger.error(f"Error getting user permission codes: {e}")
        return []


def check_permission(user: Dict[str, Any], permission: str) -> bool:
    """檢查用戶是否有指定權限"""
    if not user:
        return False
    
    user_id = user.get("id")
    user_role = user.get("role", "")
    
    # 管理員有所有權限
    if user_role == "admin":
        return True
    
    # 檢查新權限系統
    if user_id:
        user_permission_codes = get_user_permission_codes(user_id)
        
        # 檢查是否有對應的權限代碼
        if permission in user_permission_codes:
            return True
        
        # 檢查特殊權限映射
        permission_mapping = {
            "read": ["USER", "MANAGER", "ADMIN"],
            "write": ["USER", "MANAGER", "ADMIN"], 
            "admin": ["SYSTEM_ADMIN", "ADMIN"],
            "manage_users": ["MANAGER", "SYSTEM_ADMIN"],
            "manage_departments": ["SYSTEM_ADMIN"],
            "manage_roles": ["SYSTEM_ADMIN"],
            "view_audit_logs": ["MANAGER", "SYSTEM_ADMIN"]
        }
        
        if permission in permission_mapping:
            required_codes = permission_mapping[permission]
            if any(code in user_permission_codes for code in required_codes):
                return True
    
    # 回退到舊權限系統檢查
    if permission == "read":
        return user_role in ["admin", "user"]
    elif permission == "write":
        return user_role in ["admin", "user"]
    elif permission == "admin":
        return user_role == "admin"
    
    return False


def check_permission_group(user: Dict[str, Any], permission_group_code: str) -> bool:
    """檢查用戶是否有指定權限群組"""
    if not user:
        return False
    
    user_role = user.get("role", "")
    
    # 管理員有所有權限
    if user_role == "admin":
        return True
    
    user_id = user.get("id")
    if user_id:
        user_permission_codes = get_user_permission_codes(user_id)
        return permission_group_code in user_permission_codes
    
    return False


def require_permission(user: Dict[str, Any], permission: str) -> None:
    """要求指定權限"""
    if not check_permission(user, permission):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"需要 {permission} 權限"
        )


def permission_required(permission_code: str):
    """
    權限檢查裝飾器 (用於 FastAPI 路由)
    
    使用範例:
    @router.post("/api/example")
    @permission_required("MODULE.ACTION")
    async def example_endpoint(user: Dict = Depends(get_current_user)):
        return {"message": "success"}
    """
    from functools import wraps
    from fastapi import Depends
    from app.api.dependencies import get_current_user
    
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            # 從 kwargs 中取得 user 參數
            user = kwargs.get('user') or kwargs.get('current_user')
            
            if not user:
                # 如果沒有 user 參數，嘗試從依賴注入中獲取
                for arg in args:
                    if isinstance(arg, dict) and 'id' in arg:
                        user = arg
                        break
            
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="需要登入"
                )
            
            # 檢查權限
            if not check_permission(user, permission_code):
                logger.warning(f"User {user.get('id')} denied access to {permission_code}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"需要 {permission_code} 權限"
                )
            
            # 權限通過，執行原始函數
            if asyncio.iscoroutinefunction(func):
                return await func(*args, **kwargs)
            else:
                return func(*args, **kwargs)
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            # 從 kwargs 中取得 user 參數
            user = kwargs.get('user') or kwargs.get('current_user')
            
            if not user:
                # 如果沒有 user 參數，嘗試從參數中獲取
                for arg in args:
                    if isinstance(arg, dict) and 'id' in arg:
                        user = arg
                        break
            
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="需要登入"
                )
            
            # 檢查權限
            if not check_permission(user, permission_code):
                logger.warning(f"User {user.get('id')} denied access to {permission_code}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"需要 {permission_code} 權限"
                )
            
            return func(*args, **kwargs)
        
        # 根據函數類型返回對應的 wrapper
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator


def require_permission_group(user: Dict[str, Any], permission_group_code: str) -> None:
    """要求指定權限群組"""
    if not check_permission_group(user, permission_group_code):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"需要 {permission_group_code} 權限"
        )