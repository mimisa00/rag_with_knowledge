"""
組織管理系統資料存取層
"""
import json
from typing import List, Dict, Any, Optional
from datetime import datetime
from app.dao.base import BaseDAO, db_manager
from app.models.organization import (
    Department, PermissionGroup, UserExtension, UserPermissionGroup, 
    SystemMode, PasswordPolicy, AuditLog
)
from app.utils.logging import get_logger

logger = get_logger(__name__)


class DepartmentDAO(BaseDAO):
    """部門資料存取物件"""
    
    def __init__(self, db_manager_instance=None):
        super().__init__(db_manager_instance or db_manager)
    
    def create_department(self, department: Department) -> Optional[int]:
        """建立部門"""
        try:
            # 計算層級和路徑
            level = 0
            path = f"/{department.name}"
            
            if department.parent_id:
                query = "SELECT level, path, name FROM departments WHERE id = %s"
                results = self.execute_query(query, (department.parent_id,))
                if results:
                    parent = results[0]
                    level = parent['level'] + 1
                    path = f"{parent['path']}/{department.name}"
                else:
                    logger.error(f"父部門 {department.parent_id} 不存在")
                    return None
            
            query = """
                INSERT INTO departments (
                    parent_id, external_id, code, name, description, path, level,
                    sort_order, is_active, sync_source, metadata, created_by
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            
            metadata_json = json.dumps(department.metadata) if department.metadata else None
            
            dept_id = self.execute_insert(query, (
                department.parent_id, department.external_id, department.code,
                department.name, department.description, path, level, department.sort_order,
                department.is_active, department.sync_source,
                metadata_json, department.created_by
            ))
            
            if dept_id > 0:
                logger.info(f"部門 {department.code} 建立成功，ID: {dept_id}")
                return dept_id
            else:
                logger.error(f"部門 {department.code} 建立失敗")
                return None
                
        except Exception as e:
            logger.error(f"建立部門失敗: {e}")
            return None
    
    def get_department(self, dept_id: int) -> Optional[Dict[str, Any]]:
        """取得單一部門"""
        try:
            query = "SELECT * FROM departments WHERE id = %s"
            results = self.execute_query(query, (dept_id,))
            if results:
                dept = results[0]
                if dept.get('metadata'):
                    dept['metadata'] = json.loads(dept['metadata'])
                return dept
            return None
        except Exception as e:
            logger.error(f"取得部門失敗: {e}")
            return None
    
    def get_department_by_code(self, code: str) -> Optional[Dict[str, Any]]:
        """根據代碼取得部門"""
        try:
            query = "SELECT * FROM departments WHERE code = %s"
            results = self.execute_query(query, (code,))
            if results:
                dept = results[0]
                if dept.get('metadata'):
                    dept['metadata'] = json.loads(dept['metadata'])
                return dept
            return None
        except Exception as e:
            logger.error(f"根據代碼取得部門失敗: {e}")
            return None
    
    def list_departments(self, parent_id: Optional[Any] = None, 
                        is_active: Optional[bool] = None) -> List[Dict[str, Any]]:
        """列出部門"""
        try:
            conditions = []
            params = []
            
            # 修改邏輯：預設返回所有部門
            if parent_id == "root":
                # 只要根部門
                conditions.append("parent_id IS NULL")
            elif parent_id is not None and parent_id != "all":
                # 指定父部門
                conditions.append("parent_id = %s")
                params.append(parent_id)
            # 如果 parent_id 是 None 或 "all"，不加條件（返回所有部門）
            
            # 移除 is_active 過濾，讓前端處理
            # if is_active is not None:
            #     conditions.append("is_active = %s")
            #     params.append(is_active)
            
            where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
            
            query = f"""
                SELECT * FROM departments {where_clause}
                ORDER BY level, sort_order, name
            """
            
            departments = self.execute_query(query, tuple(params) if params else None)
            
            # 解析 JSON metadata
            for dept in departments:
                if dept.get('metadata'):
                    dept['metadata'] = json.loads(dept['metadata'])
            
            return departments
            
        except Exception as e:
            logger.error(f"列出部門失敗: {e}")
            return []
    
    def update_department(self, dept_id: int, updates: Dict[str, Any]) -> bool:
        """更新部門"""
        try:
            # 如果更新父部門或名稱，需要重新計算路徑和層級
            if 'parent_id' in updates or 'name' in updates:
                query = "SELECT * FROM departments WHERE id = %s"
                results = self.execute_query(query, (dept_id,))
                if not results:
                    logger.error(f"部門 {dept_id} 不存在")
                    return False
                
                current = results[0]
                parent_id = updates.get('parent_id', current['parent_id'])
                name = updates.get('name', current['name'])
                
                # 明確檢查 parent_id 是否為 None 或 0（表示頂層部門）
                if parent_id is not None and parent_id != 0:
                    query = "SELECT level, path FROM departments WHERE id = %s"
                    parent_results = self.execute_query(query, (parent_id,))
                    if parent_results:
                        parent = parent_results[0]
                        updates['level'] = parent['level'] + 1
                        updates['path'] = f"{parent['path']}/{name}"
                    else:
                        # 父部門不存在
                        logger.error(f"父部門 {parent_id} 不存在")
                        return False
                else:
                    # 移到頂層
                    updates['level'] = 0
                    updates['path'] = f"/{name}"
                    updates['parent_id'] = None  # 確保設為 NULL
            
            # 處理 metadata
            if 'metadata' in updates and updates['metadata'] is not None:
                updates['metadata'] = json.dumps(updates['metadata'])
            
            # 建立更新語句
            set_clauses = []
            values = []
            for key, value in updates.items():
                set_clauses.append(f"{key} = %s")
                values.append(value)
            
            values.append(dept_id)
            
            query = f"""
                UPDATE departments 
                SET {', '.join(set_clauses)}, updated_at = NOW()
                WHERE id = %s
            """
            
            success = self.execute_update(query, tuple(values))
            if success:
                logger.info(f"部門 {dept_id} 更新成功")
            return success
            
        except Exception as e:
            logger.error(f"更新部門失敗: {e}")
            return False
    
    def delete_department(self, dept_id: int) -> bool:
        """刪除部門"""
        try:
            # 檢查是否有子部門
            query = "SELECT COUNT(*) as count FROM departments WHERE parent_id = %s"
            results = self.execute_query(query, (dept_id,))
            if results and results[0]['count'] > 0:
                logger.warning(f"無法刪除部門 {dept_id}：有子部門")
                return False
            
            # 檢查是否有使用者
            query = "SELECT COUNT(*) as count FROM user_extensions WHERE department_id = %s"
            results = self.execute_query(query, (dept_id,))
            if results and results[0]['count'] > 0:
                logger.warning(f"無法刪除部門 {dept_id}：有使用者")
                return False
            
            query = "DELETE FROM departments WHERE id = %s"
            success = self.execute_update(query, (dept_id,))
            if success:
                logger.info(f"部門 {dept_id} 刪除成功")
            return success
            
        except Exception as e:
            logger.error(f"刪除部門失敗: {e}")
            return False
    
    def get_department_tree(self) -> List[Dict[str, Any]]:
        """取得部門樹狀結構"""
        try:
            departments = self.list_departments("all")
            
            # 建立 ID 到部門的映射
            dept_map = {dept['id']: {**dept, 'children': []} for dept in departments}
            
            # 建立樹狀結構
            tree = []
            for dept in departments:
                if dept['parent_id'] is None:
                    tree.append(dept_map[dept['id']])
                elif dept['parent_id'] in dept_map:
                    dept_map[dept['parent_id']]['children'].append(dept_map[dept['id']])
            
            return tree
            
        except Exception as e:
            logger.error(f"取得部門樹狀結構失敗: {e}")
            return []


class PermissionGroupDAO(BaseDAO):
    """權限群組資料存取物件"""
    
    def __init__(self, db_manager_instance=None):
        super().__init__(db_manager_instance or db_manager)
    
    def create_permission_group(self, permission_group: PermissionGroup) -> Optional[int]:
        """建立權限群組"""
        try:
            query = """
                INSERT INTO permission_groups (
                    code, name, description, permission_type, permissions,
                    is_active, created_by
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            """
            
            permissions_json = json.dumps(permission_group.permissions) if permission_group.permissions else None
            
            group_id = self.execute_insert(query, (
                permission_group.code, permission_group.name, permission_group.description, permission_group.permission_type,
                permissions_json, permission_group.is_active, permission_group.created_by
            ))
            
            if group_id > 0:
                logger.info(f"權限群組 {permission_group.code} 建立成功，ID: {group_id}")
                return group_id
            else:
                logger.error(f"權限群組 {permission_group.code} 建立失敗")
                return None
                
        except Exception as e:
            logger.error(f"建立權限群組失敗: {e}")
            return None
    
    def get_permission_group(self, group_id: int) -> Optional[Dict[str, Any]]:
        """取得單一權限群組"""
        try:
            query = "SELECT * FROM permission_groups WHERE id = %s"
            results = self.execute_query(query, (group_id,))
            if results:
                group = results[0]
                if group.get('permissions'):
                    group['permissions'] = json.loads(group['permissions'])
                return group
            return None
        except Exception as e:
            logger.error(f"取得權限群組失敗: {e}")
            return None
    
    def get_permission_group_by_code(self, code: str) -> Optional[Dict[str, Any]]:
        """根據代碼取得權限群組"""
        try:
            query = "SELECT * FROM permission_groups WHERE code = %s"
            results = self.execute_query(query, (code,))
            if results:
                group = results[0]
                if group.get('permissions'):
                    group['permissions'] = json.loads(group['permissions'])
                return group
            return None
        except Exception as e:
            logger.error(f"根據代碼取得權限群組失敗: {e}")
            return None
    
    def list_permission_groups(self, group_type: Optional[str] = None,
                  is_active: Optional[bool] = None) -> List[Dict[str, Any]]:
        """列出權限群組"""
        try:
            conditions = []
            params = []
            
            if group_type:
                conditions.append("permission_type = %s")
                params.append(group_type)
            
            if is_active is not None:
                conditions.append("is_active = %s")
                params.append(is_active)
            
            where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
            
            query = f"""
                SELECT * FROM permission_groups {where_clause}
                ORDER BY permission_type, name
            """
            
            groups = self.execute_query(query, tuple(params) if params else None)
            
            # 解析 JSON permissions
            for group in groups:
                if group.get('permissions'):
                    group['permissions'] = json.loads(group['permissions'])
            
            return groups
            
        except Exception as e:
            logger.error(f"列出權限群組失敗: {e}")
            return []
    
    def update_permission_group(self, group_id: int, updates: Dict[str, Any]) -> bool:
        """更新權限群組"""
        try:
            # 處理 permissions
            if 'permissions' in updates and updates['permissions'] is not None:
                updates['permissions'] = json.dumps(updates['permissions'])
            
            set_clauses = []
            values = []
            for key, value in updates.items():
                set_clauses.append(f"{key} = %s")
                values.append(value)
            
            values.append(group_id)
            
            query = f"""
                UPDATE permission_groups 
                SET {', '.join(set_clauses)}, updated_at = NOW()
                WHERE id = %s
            """
            
            success = self.execute_update(query, tuple(values))
            if success:
                logger.info(f"權限群組 {group_id} 更新成功")
            return success
            
        except Exception as e:
            logger.error(f"更新權限群組失敗: {e}")
            return False
    
    def delete_permission_group(self, group_id: int) -> bool:
        """刪除權限群組"""
        try:
            # 檢查是否為系統權限群組
            query = "SELECT permission_type FROM permission_groups WHERE id = %s"
            results = self.execute_query(query, (group_id,))
            if results and results[0]['permission_type'] == 'system':
                logger.warning(f"無法刪除系統權限群組 {group_id}")
                return False
            
            # 檢查是否有使用者使用
            query = "SELECT COUNT(*) as count FROM user_permission_groups WHERE permission_group_id = %s"
            results = self.execute_query(query, (group_id,))
            if results and results[0]['count'] > 0:
                logger.warning(f"無法刪除權限群組 {group_id}：有使用者使用")
                return False
            
            query = "DELETE FROM permission_groups WHERE id = %s"
            success = self.execute_update(query, (group_id,))
            if success:
                logger.info(f"權限群組 {group_id} 刪除成功")
            return success
            
        except Exception as e:
            logger.error(f"刪除權限群組失敗: {e}")
            return False


class UserOrganizationDAO(BaseDAO):
    """使用者組織資料存取物件"""
    
    def __init__(self, db_manager_instance=None):
        super().__init__(db_manager_instance or db_manager)
    
    def create_user_extension(self, user_extension: UserExtension) -> bool:
        """建立使用者擴充資訊"""
        try:
            query = """
                INSERT INTO user_extensions (
                    user_id, department_id, external_id, employee_no,
                    title, manager_id, auth_source, password_strategy,
                    activation_token, activation_expires, metadata
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            
            metadata_json = json.dumps(user_extension.metadata) if user_extension.metadata else None
            
            result = self.execute_insert(query, (
                user_extension.user_id, user_extension.department_id,
                user_extension.external_id, user_extension.employee_no,
                user_extension.title, user_extension.manager_id,
                user_extension.auth_source, user_extension.password_strategy,
                user_extension.activation_token, user_extension.activation_expires,
                metadata_json
            ))
            
            if result >= 0:
                logger.info(f"使用者擴充資訊 {user_extension.user_id} 建立成功")
                return True
            return False
            
        except Exception as e:
            logger.error(f"建立使用者擴充資訊失敗: {e}")
            return False
    
    def get_user_extension(self, user_id: int) -> Optional[Dict[str, Any]]:
        """取得使用者擴充資訊"""
        try:
            query = """
                SELECT ue.*, d.name as department_name, d.path as department_path
                FROM user_extensions ue
                LEFT JOIN departments d ON ue.department_id = d.id
                WHERE ue.user_id = %s
            """
            results = self.execute_query(query, (user_id,))
            if results:
                ext = results[0]
                if ext.get('metadata'):
                    ext['metadata'] = json.loads(ext['metadata'])
                return ext
            return None
        except Exception as e:
            logger.error(f"取得使用者擴充資訊失敗: {e}")
            return None
    
    def update_user_extension(self, user_id: int, updates: Dict[str, Any]) -> bool:
        """更新使用者擴充資訊"""
        try:
            # 處理 metadata
            if 'metadata' in updates and updates['metadata'] is not None:
                updates['metadata'] = json.dumps(updates['metadata'])
            
            set_clauses = []
            values = []
            for key, value in updates.items():
                set_clauses.append(f"{key} = %s")
                values.append(value)
            
            values.append(user_id)
            
            query = f"""
                UPDATE user_extensions 
                SET {', '.join(set_clauses)}, updated_at = NOW()
                WHERE user_id = %s
            """
            
            success = self.execute_update(query, tuple(values))
            if success:
                logger.info(f"使用者擴充資訊 {user_id} 更新成功")
            return success
            
        except Exception as e:
            logger.error(f"更新使用者擴充資訊失敗: {e}")
            return False
    
    def assign_user_permission_group(self, user_permission_group: UserPermissionGroup) -> bool:
        """分配使用者權限群組"""
        try:
            query = """
                INSERT INTO user_permission_groups (
                    user_id, permission_group_id, department_id, assigned_by, expires_at
                ) VALUES (%s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    assigned_at = NOW(),
                    assigned_by = VALUES(assigned_by),
                    expires_at = VALUES(expires_at)
            """
            
            result = self.execute_update(query, (
                user_permission_group.user_id, user_permission_group.permission_group_id, user_permission_group.department_id,
                user_permission_group.assigned_by, user_permission_group.expires_at
            ))
            
            if result:
                logger.info(f"使用者 {user_permission_group.user_id} 分配權限群組 {user_permission_group.permission_group_id} 成功")
            return result
            
        except Exception as e:
            logger.error(f"分配使用者權限群組失敗: {e}")
            return False
    
    def revoke_user_permission_group(self, user_id: int, permission_group_id: int, 
                        department_id: Optional[int] = None) -> bool:
        """撤銷使用者權限群組"""
        try:
            if department_id is not None:
                query = """
                    DELETE FROM user_permission_groups 
                    WHERE user_id = %s AND permission_group_id = %s AND department_id = %s
                """
                params = (user_id, permission_group_id, department_id)
            else:
                query = """
                    DELETE FROM user_permission_groups 
                    WHERE user_id = %s AND permission_group_id = %s AND department_id IS NULL
                """
                params = (user_id, permission_group_id)
            
            success = self.execute_update(query, params)
            if success:
                logger.info(f"使用者 {user_id} 撤銷權限群組 {permission_group_id} 成功")
            return success
            
        except Exception as e:
            logger.error(f"撤銷使用者權限群組失敗: {e}")
            return False
    
    def get_user_permission_groups(self, user_id: int) -> List[Dict[str, Any]]:
        """取得使用者權限群組"""
        try:
            query = """
                SELECT upg.*, pg.code, pg.name, pg.permissions, pg.permission_type,
                       d.name as department_name
                FROM user_permission_groups upg
                JOIN permission_groups pg ON upg.permission_group_id = pg.id
                LEFT JOIN departments d ON upg.department_id = d.id
                WHERE upg.user_id = %s
                AND (upg.expires_at IS NULL OR upg.expires_at > NOW())
                ORDER BY pg.permission_type, pg.name
            """
            
            groups = self.execute_query(query, (user_id,))
            
            # 解析 JSON permissions
            for group in groups:
                if group.get('permissions'):
                    group['permissions'] = json.loads(group['permissions'])
            
            return groups
            
        except Exception as e:
            logger.error(f"取得使用者權限群組失敗: {e}")
            return []
    
    def list_users_in_department(self, department_id: int) -> List[Dict[str, Any]]:
        """列出部門中的使用者"""
        try:
            query = """
                SELECT u.id, u.username, u.email, u.is_active,
                       ue.employee_no, ue.title, ue.auth_source
                FROM users u
                JOIN user_extensions ue ON u.id = ue.user_id
                WHERE ue.department_id = %s
                ORDER BY u.username
            """
            return self.execute_query(query, (department_id,))
        except Exception as e:
            logger.error(f"列出部門使用者失敗: {e}")
            return []
    
    def list_users_with_permission_group(self, permission_group_id: int) -> List[Dict[str, Any]]:
        """列出擁有特定權限群組的使用者"""
        try:
            query = """
                SELECT u.id, u.username, u.email, u.is_active,
                       upg.department_id, upg.assigned_at, upg.expires_at,
                       d.name as department_name
                FROM users u
                JOIN user_permission_groups upg ON u.id = upg.user_id
                LEFT JOIN departments d ON upg.department_id = d.id
                WHERE upg.permission_group_id = %s
                AND (upg.expires_at IS NULL OR upg.expires_at > NOW())
                ORDER BY u.username
            """
            return self.execute_query(query, (permission_group_id,))
        except Exception as e:
            logger.error(f"列出權限群組使用者失敗: {e}")
            return []


class SystemModeDAO(BaseDAO):
    """系統模式資料存取物件"""
    
    def __init__(self, db_manager_instance=None):
        super().__init__(db_manager_instance or db_manager)
    
    def get_system_mode(self, mode_key: str) -> Optional[Dict[str, Any]]:
        """取得系統模式設定"""
        try:
            query = "SELECT * FROM system_modes WHERE mode_key = %s"
            results = self.execute_query(query, (mode_key,))
            return results[0] if results else None
        except Exception as e:
            logger.error(f"取得系統模式失敗: {e}")
            return None
    
    def list_system_modes(self, category: Optional[str] = None) -> List[Dict[str, Any]]:
        """列出系統模式設定"""
        try:
            if category:
                query = """
                    SELECT * FROM system_modes 
                    WHERE category = %s
                    ORDER BY mode_key
                """
                return self.execute_query(query, (category,))
            else:
                query = "SELECT * FROM system_modes ORDER BY category, mode_key"
                return self.execute_query(query)
                
        except Exception as e:
            logger.error(f"列出系統模式失敗: {e}")
            return []
    
    def update_system_mode(self, mode_key: str, mode_value: str, 
                          updated_by: Optional[int] = None) -> bool:
        """更新系統模式設定"""
        try:
            query = """
                UPDATE system_modes 
                SET mode_value = %s, updated_by = %s, updated_at = NOW()
                WHERE mode_key = %s
            """
            success = self.execute_update(query, (mode_value, updated_by, mode_key))
            if success:
                logger.info(f"系統模式 {mode_key} 更新為 {mode_value}")
            return success
        except Exception as e:
            logger.error(f"更新系統模式失敗: {e}")
            return False


class AuditLogDAO(BaseDAO):
    """審計日誌資料存取物件"""
    
    def __init__(self, db_manager_instance=None):
        super().__init__(db_manager_instance or db_manager)
    
    def create_audit_log(self, audit_log: AuditLog) -> bool:
        """建立審計日誌"""
        try:
            query = """
                INSERT INTO audit_logs (
                    user_id, action, target_type, target_id,
                    changes, ip_address, user_agent
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            """
            
            changes_json = json.dumps(audit_log.changes) if audit_log.changes else None
            
            result = self.execute_insert(query, (
                audit_log.user_id, audit_log.action, audit_log.target_type,
                audit_log.target_id, changes_json,
                audit_log.ip_address, audit_log.user_agent
            ))
            
            return result >= 0
            
        except Exception as e:
            logger.error(f"建立審計日誌失敗: {e}")
            return False
    
    def list_audit_logs(self, user_id: Optional[int] = None,
                       action: Optional[str] = None,
                       target_type: Optional[str] = None,
                       limit: int = 100) -> List[Dict[str, Any]]:
        """列出審計日誌"""
        try:
            conditions = []
            params = []
            
            if user_id:
                conditions.append("user_id = %s")
                params.append(user_id)
            
            if action:
                conditions.append("action = %s")
                params.append(action)
            
            if target_type:
                conditions.append("target_type = %s")
                params.append(target_type)
            
            where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
            params.append(limit)
            
            query = f"""
                SELECT * FROM audit_logs {where_clause}
                ORDER BY created_at DESC
                LIMIT %s
            """
            
            logs = self.execute_query(query, tuple(params))
            
            # 解析 JSON changes
            for log in logs:
                if log.get('changes'):
                    log['changes'] = json.loads(log['changes'])
            
            return logs
            
        except Exception as e:
            logger.error(f"列出審計日誌失敗: {e}")
            return []


# 建立 DAO 實例
department_dao = DepartmentDAO()
permission_group_dao = PermissionGroupDAO()
user_org_dao = UserOrganizationDAO()
system_mode_dao = SystemModeDAO()
audit_log_dao = AuditLogDAO()