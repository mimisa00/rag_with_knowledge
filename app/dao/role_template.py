"""
角色模板資料存取層
"""
from typing import List, Dict, Any, Optional
from datetime import datetime
import json
import logging
from app.dao.base import BaseDAO
from app.models.role_template import (
    RoleTemplate, RoleTemplateCreate, RoleTemplateUpdate,
    DepartmentRole, DepartmentRoleCreate, DepartmentRoleUpdate,
    UserDepartmentRole, UserDepartmentRoleAssign
)

logger = logging.getLogger(__name__)


class RoleTemplateDAO(BaseDAO):
    """角色模板 DAO"""
    
    def __init__(self, db_manager):
        """初始化角色模板 DAO"""
        super().__init__(db_manager)
        self._last_warning = None  # 存儲最後的警告信息
    
    def get_last_warning(self) -> str:
        """獲取最後的警告信息"""
        warning = self._last_warning
        self._last_warning = None  # 清除警告
        return warning
    
    def create_role_template(self, template: RoleTemplateCreate, created_by: int = None) -> int:
        """建立角色模板"""
        try:
            query = """
                INSERT INTO role_templates (
                    code, name, description, role_type, level,
                    default_permissions, is_active, sort_order, created_by
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            
            permissions_json = json.dumps(template.default_permissions) if template.default_permissions else None
            
            params = (
                template.code, template.name, template.description,
                template.role_type, template.level, permissions_json,
                template.is_active, template.sort_order, created_by
            )
            
            return self.execute_insert(query, params)
            
        except Exception as e:
            logger.error(f"Error creating role template: {e}")
            raise
    
    def get_role_template(self, template_id: int) -> Optional[Dict[str, Any]]:
        """取得角色模板"""
        try:
            query = """
                SELECT 
                    rt.*,
                    COUNT(DISTINCT dr.id) as usage_count,
                    COUNT(DISTINCT dr.department_id) as department_count,
                    COUNT(DISTINCT udr.user_id) as user_count
                FROM role_templates rt
                LEFT JOIN department_roles dr ON rt.id = dr.template_id
                LEFT JOIN user_department_roles udr ON dr.id = udr.department_role_id
                WHERE rt.id = %s
                GROUP BY rt.id
            """
            
            result = self.execute_query(query, (template_id,))
            if result:
                template = result[0]
                if template.get('default_permissions'):
                    template['default_permissions'] = json.loads(template['default_permissions'])
                return template
            return None
            
        except Exception as e:
            logger.error(f"Error getting role template: {e}")
            raise
    
    def list_role_templates(self, is_active: bool = None, is_system: bool = None) -> List[Dict[str, Any]]:
        """列出角色模板"""
        try:
            conditions = []
            params = []
            
            if is_active is not None:
                conditions.append("rt.is_active = %s")
                params.append(is_active)
            
            if is_system is not None:
                conditions.append("rt.is_system = %s")
                params.append(is_system)
            
            where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
            
            query = f"""
                SELECT 
                    rt.*,
                    COUNT(DISTINCT dr.id) as usage_count,
                    COUNT(DISTINCT dr.department_id) as department_count,
                    COUNT(DISTINCT udr.user_id) as user_count
                FROM role_templates rt
                LEFT JOIN department_roles dr ON rt.id = dr.template_id
                LEFT JOIN user_department_roles udr ON dr.id = udr.department_role_id
                {where_clause}
                GROUP BY rt.id
                ORDER BY rt.sort_order, rt.id
            """
            
            results = self.execute_query(query, params)
            for template in results:
                if template.get('default_permissions'):
                    template['default_permissions'] = json.loads(template['default_permissions'])
            return results
            
        except Exception as e:
            logger.error(f"Error listing role templates: {e}")
            raise
    
    def update_role_template(self, template_id: int, update_data: RoleTemplateUpdate, 
                           updated_by: int = None) -> bool:
        """更新角色模板"""
        try:
            # 檢查是否為系統模板
            check_query = "SELECT is_system FROM role_templates WHERE id = %s"
            result = self.execute_query(check_query, (template_id,))
            if result and result[0]['is_system']:
                logger.warning(f"Cannot update system template: {template_id}")
                return False
            
            updates = []
            params = []
            
            if update_data.name is not None:
                updates.append("name = %s")
                params.append(update_data.name)
            
            if update_data.description is not None:
                updates.append("description = %s")
                params.append(update_data.description)
            
            if update_data.role_type is not None:
                updates.append("role_type = %s")
                params.append(update_data.role_type)
            
            if update_data.level is not None:
                updates.append("level = %s")
                params.append(update_data.level)
            
            if update_data.default_permissions is not None:
                updates.append("default_permissions = %s")
                params.append(json.dumps(update_data.default_permissions))
            
            if update_data.is_active is not None:
                updates.append("is_active = %s")
                params.append(update_data.is_active)
            
            if update_data.sort_order is not None:
                updates.append("sort_order = %s")
                params.append(update_data.sort_order)
            
            if not updates:
                return True
            
            updates.append("updated_by = %s")
            params.append(updated_by)
            
            params.append(template_id)
            
            query = f"""
                UPDATE role_templates 
                SET {', '.join(updates)}
                WHERE id = %s AND is_system = FALSE
            """
            
            return self.execute_update(query, params) > 0
            
        except Exception as e:
            logger.error(f"Error updating role template: {e}")
            raise
    
    def delete_role_template(self, template_id: int) -> bool:
        """刪除角色模板"""
        try:
            # 檢查是否為系統模板
            check_query = "SELECT is_system FROM role_templates WHERE id = %s"
            result = self.execute_query(check_query, (template_id,))
            if result and result[0]['is_system']:
                logger.warning(f"Cannot delete system template: {template_id}")
                return False
            
            # 檢查是否有部門正在使用
            usage_query = "SELECT COUNT(*) as count FROM department_roles WHERE template_id = %s"
            usage = self.execute_query(usage_query, (template_id,))
            if usage and usage[0]['count'] > 0:
                logger.warning(f"Cannot delete template in use: {template_id}")
                return False
            
            query = "DELETE FROM role_templates WHERE id = %s AND is_system = FALSE"
            # 使用 execute_update 並檢查是否有影響行數
            success = self.execute_update(query, (template_id,))
            return success
            
        except Exception as e:
            logger.error(f"Error deleting role template: {e}")
            raise


class DepartmentRoleDAO(BaseDAO):
    """部門角色 DAO"""
    
    def find_parent_role(self, department_id: int, template_id: int) -> Optional[int]:
        """根據部門和模板智能推導父角色
        
        推導策略（按優先級）：
        第一階段 - 同部門內查找：
        1. 同部門內的管理者角色（如果新角色不是管理者）
        2. 同部門內層級最高的角色
        
        第二階段 - 父部門查找：
        3. 在父部門中尋找相同模板的角色
        4. 在父部門中尋找管理類型（manager）的角色
        5. 在父部門中尋找層級最高的角色
        
        第三階段 - 遞歸向上查找：
        6. 如果父部門沒有角色，遞歸向上級部門查找
        """
        try:
            # 首先取得要建立的角色模板資訊
            template_query = "SELECT role_type FROM role_templates WHERE id = %s"
            template_result = self.execute_query(template_query, (template_id,))
            
            if not template_result:
                logger.error(f"Template not found: {template_id}")
                return None
                
            current_role_type = template_result[0]['role_type']
            
            # === 第一階段：同部門內查找（只有非管理者角色才在同部門內找父角色）===
            if current_role_type != 'manager':
                logger.info(f"Looking for parent role in same department {department_id} for non-manager role")
                
                # 策略1: 同部門內的管理者角色
                same_dept_manager_query = """
                    SELECT dr.id, dr.level
                    FROM department_roles dr
                    JOIN role_templates rt ON dr.template_id = rt.id
                    WHERE dr.department_id = %s AND rt.role_type = 'manager' 
                    AND dr.is_active = TRUE
                    ORDER BY dr.level ASC
                    LIMIT 1
                """
                same_dept_manager_result = self.execute_query(same_dept_manager_query, (department_id,))
                
                if same_dept_manager_result:
                    logger.info(f"Found parent manager role in same department: {same_dept_manager_result[0]['id']} (level: {same_dept_manager_result[0]['level']})")
                    return same_dept_manager_result[0]['id']
                
                # 策略2: 同部門內層級最高的角色
                same_dept_highest_query = """
                    SELECT id, level FROM department_roles 
                    WHERE department_id = %s AND is_active = TRUE
                    ORDER BY level ASC
                    LIMIT 1
                """
                same_dept_highest_result = self.execute_query(same_dept_highest_query, (department_id,))
                
                if same_dept_highest_result:
                    logger.info(f"Found parent role with highest level in same department: {same_dept_highest_result[0]['id']} (level: {same_dept_highest_result[0]['level']})")
                    return same_dept_highest_result[0]['id']
                
                logger.info(f"No suitable parent role found in same department {department_id}")
            else:
                logger.info(f"Creating manager role, skipping same department search")
            
            # === 第二階段：父部門查找 ===
            current_dept_id = department_id
            visited_depts = set([department_id])  # 記錄已訪問的部門，防止循環
            max_depth = 10  # 最大查找深度
            depth = 0
            
            # 遞歸向上查找，直到找到有角色的部門或到達頂層
            while depth < max_depth:
                # 取得當前部門的父部門
                dept_query = "SELECT parent_id FROM departments WHERE id = %s"
                dept_result = self.execute_query(dept_query, (current_dept_id,))
                
                if not dept_result or not dept_result[0]['parent_id']:
                    logger.info(f"Reached top level department in parent search, no parent role found")
                    return None  # 已到達頂層部門，沒有父角色
                
                parent_dept_id = dept_result[0]['parent_id']
                
                # 檢查是否已經訪問過這個部門（防止循環引用）
                if parent_dept_id in visited_depts:
                    logger.warning(f"Circular reference detected in department hierarchy, stopping search")
                    return None
                
                visited_depts.add(parent_dept_id)
                logger.info(f"Searching in parent department {parent_dept_id} (depth: {depth})")
                
                # 策略3: 優先查找父部門中相同模板的角色
                same_template_query = """
                    SELECT id, level FROM department_roles 
                    WHERE department_id = %s AND template_id = %s 
                    AND is_active = TRUE
                    ORDER BY level ASC
                    LIMIT 1
                """
                same_template_result = self.execute_query(same_template_query, (parent_dept_id, template_id))
                
                if same_template_result:
                    logger.info(f"Found parent role with same template in parent dept: {same_template_result[0]['id']} (level: {same_template_result[0]['level']})")
                    return same_template_result[0]['id']
                
                # 策略4: 查找父部門中的管理者角色
                manager_role_query = """
                    SELECT dr.id, dr.level
                    FROM department_roles dr
                    JOIN role_templates rt ON dr.template_id = rt.id
                    WHERE dr.department_id = %s AND rt.role_type = 'manager' 
                    AND dr.is_active = TRUE
                    ORDER BY dr.level ASC
                    LIMIT 1
                """
                manager_result = self.execute_query(manager_role_query, (parent_dept_id,))
                
                if manager_result:
                    logger.info(f"Found parent manager role in parent dept: {manager_result[0]['id']} (level: {manager_result[0]['level']})")
                    return manager_result[0]['id']
                
                # 策略5: 查找父部門中層級最高的角色
                highest_level_query = """
                    SELECT id, level FROM department_roles 
                    WHERE department_id = %s AND is_active = TRUE
                    ORDER BY level ASC
                    LIMIT 1
                """
                highest_result = self.execute_query(highest_level_query, (parent_dept_id,))
                
                if highest_result:
                    logger.info(f"Found parent role with highest level in parent dept: {highest_result[0]['id']} (level: {highest_result[0]['level']})")
                    return highest_result[0]['id']
                
                # 策略6: 如果父部門沒有任何角色，繼續向上級部門查找
                logger.info(f"No roles found in parent department {parent_dept_id}, continuing recursive search")
                current_dept_id = parent_dept_id
                depth += 1
            
            logger.info(f"Reached maximum search depth ({max_depth}), no suitable parent role found")
            return None
            
        except Exception as e:
            logger.error(f"Error finding parent role: {e}")
            return None
    
    def calculate_role_level(self, parent_id: Optional[int]) -> int:
        """根據父角色計算層級"""
        if not parent_id:
            return 1  # 頂層角色
        
        try:
            parent_query = "SELECT level FROM department_roles WHERE id = %s"
            parent_result = self.execute_query(parent_query, (parent_id,))
            
            if parent_result:
                parent_level = parent_result[0]['level']
                return parent_level + 10  # 每層加10
            
            return 1  # 找不到父角色，預設為頂層
            
        except Exception as e:
            logger.error(f"Error calculating role level: {e}")
            return 1
    
    def create_department_role(self, department_id: int, role: DepartmentRoleCreate, 
                              created_by: int = None) -> int:
        """建立部門角色"""
        try:
            # 取得模板資訊
            template_query = "SELECT * FROM role_templates WHERE id = %s"
            template = self.execute_query(template_query, (role.template_id,))[0]
            
            # 取得部門名稱
            dept_query = "SELECT name FROM departments WHERE id = %s"
            dept = self.execute_query(dept_query, (department_id,))[0]
            
            # 自動推導父角色（如果未指定）
            parent_id = role.parent_id
            if parent_id is None:
                parent_id = self.find_parent_role(department_id, role.template_id)
            
            # 計算角色層級
            calculated_level = self.calculate_role_level(parent_id)
            
            # 生成角色名稱（如果未提供）
            role_name = role.name or f"{dept['name']}-{template['name']}"
            
            # 生成唯一的角色代碼（使用時間戳確保唯一性）
            import time
            timestamp = int(time.time() * 1000)  # 毫秒時間戳
            role_code = f"DEPT_{department_id}_ROLE_{role.template_id}_{timestamp}"
            
            query = """
                INSERT INTO department_roles (
                    department_id, template_id, parent_id, code, name, role_type,
                    level, permissions, is_active, created_by
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            
            permissions_json = json.dumps(role.permissions) if role.permissions else template.get('default_permissions')
            
            params = (
                department_id, role.template_id, parent_id, role_code, role_name,
                template['role_type'], calculated_level, permissions_json,
                True, created_by
            )
            
            return self.execute_insert(query, params)
            
        except Exception as e:
            logger.error(f"Error creating department role: {e}")
            raise
    
    def create_department_roles_batch(self, department_id: int, template_ids: List[int], 
                                     created_by: int = None) -> List[int]:
        """批量建立部門角色（新增部門時使用）"""
        try:
            created_ids = []
            for template_id in template_ids:
                role_create = DepartmentRoleCreate(template_id=template_id)
                role_id = self.create_department_role(department_id, role_create, created_by)
                if role_id:
                    created_ids.append(role_id)
            return created_ids
            
        except Exception as e:
            logger.error(f"Error creating department roles batch: {e}")
            raise
    
    def get_department_roles(self, department_id: int) -> List[Dict[str, Any]]:
        """取得部門的所有角色"""
        try:
            query = """
                SELECT 
                    dr.*,
                    rt.name as template_name,
                    d.name as department_name,
                    pr.name as parent_role_name,
                    COUNT(DISTINCT udr.user_id) as user_count
                FROM department_roles dr
                INNER JOIN role_templates rt ON dr.template_id = rt.id
                INNER JOIN departments d ON dr.department_id = d.id
                LEFT JOIN department_roles pr ON dr.parent_id = pr.id
                LEFT JOIN user_department_roles udr ON dr.id = udr.department_role_id
                WHERE dr.department_id = %s
                GROUP BY dr.id
                ORDER BY dr.level, dr.id
            """
            
            results = self.execute_query(query, (department_id,))
            for role in results:
                if role.get('permissions'):
                    role['permissions'] = json.loads(role['permissions'])
            return results
            
        except Exception as e:
            logger.error(f"Error getting department roles: {e}")
            raise
    
    def get_all_department_roles_batch(self, department_ids: List[int] = None) -> Dict[int, List[Dict[str, Any]]]:
        """批次取得多個部門的所有角色（優化版本）"""
        try:
            # 建立查詢條件
            where_clause = ""
            params = []
            
            if department_ids:
                placeholders = ','.join(['%s'] * len(department_ids))
                where_clause = f"WHERE dr.department_id IN ({placeholders})"
                params = department_ids
            
            query = f"""
                SELECT 
                    dr.*,
                    rt.name as template_name,
                    d.name as department_name,
                    pr.name as parent_role_name,
                    COUNT(DISTINCT udr.user_id) as user_count
                FROM department_roles dr
                INNER JOIN role_templates rt ON dr.template_id = rt.id
                INNER JOIN departments d ON dr.department_id = d.id
                LEFT JOIN department_roles pr ON dr.parent_id = pr.id
                LEFT JOIN user_department_roles udr ON dr.id = udr.department_role_id
                {where_clause}
                GROUP BY dr.id
                ORDER BY dr.department_id, dr.level, dr.id
            """
            
            results = self.execute_query(query, params)
            
            # 按部門 ID 分組結果
            roles_by_dept = {}
            for role in results:
                if role.get('permissions'):
                    role['permissions'] = json.loads(role['permissions'])
                    
                dept_id = role['department_id']
                if dept_id not in roles_by_dept:
                    roles_by_dept[dept_id] = []
                roles_by_dept[dept_id].append(role)
            
            return roles_by_dept
            
        except Exception as e:
            logger.error(f"Error getting all department roles batch: {e}")
            raise
    
    def get_department_role(self, role_id: int) -> Optional[Dict[str, Any]]:
        """取得單個部門角色詳情"""
        try:
            query = """
                SELECT 
                    dr.*,
                    rt.name as template_name,
                    d.name as department_name,
                    d.path as department_path,
                    pr.name as parent_role_name,
                    pd.name as parent_department_name,
                    COUNT(DISTINCT udr.user_id) as user_count
                FROM department_roles dr
                INNER JOIN role_templates rt ON dr.template_id = rt.id
                INNER JOIN departments d ON dr.department_id = d.id
                LEFT JOIN department_roles pr ON dr.parent_id = pr.id
                LEFT JOIN departments pd ON pr.department_id = pd.id
                LEFT JOIN user_department_roles udr ON dr.id = udr.department_role_id
                WHERE dr.id = %s
                GROUP BY dr.id
            """
            
            results = self.execute_query(query, (role_id,))
            if results:
                role = results[0]
                if role.get('permissions'):
                    role['permissions'] = json.loads(role['permissions'])
                return role
            return None
            
        except Exception as e:
            logger.error(f"Error getting department role: {e}")
            raise
    
    def _check_would_create_cycle(self, role_id: int, new_parent_id: int) -> Dict[str, Any]:
        """檢查設置新的父角色是否會造成循環引用，返回詳細信息"""
        result = {
            'has_cycle': False,
            'cycle_path': [],
            'message': ''
        }
        
        if not new_parent_id:
            return result  # 沒有父角色，不會有循環
        
        if role_id == new_parent_id:
            result['has_cycle'] = True
            result['message'] = '角色不能設置自己為父角色'
            result['cycle_path'] = [role_id]
            return result
        
        # 檢查 new_parent_id 的所有祖先中是否包含 role_id
        visited = []
        current_id = new_parent_id
        
        while current_id:
            if current_id in visited:
                # 發現循環（不是由本次設置引起的）
                logger.warning(f"Existing cycle detected in role hierarchy at role {current_id}")
                break
            
            visited.append(current_id)
            
            if current_id == role_id:
                # 發現循環
                result['has_cycle'] = True
                result['cycle_path'] = visited.copy()
                result['message'] = f'設置此父角色會造成循環引用：{" -> ".join(map(str, visited))}'
                return result
            
            # 獲取當前角色的父角色和名稱
            query = "SELECT parent_id, name FROM department_roles WHERE id = %s"
            res = self.execute_query(query, (current_id,))
            
            if res and res[0]['parent_id']:
                current_id = res[0]['parent_id']
            else:
                current_id = None
        
        return result

    def update_department_role(self, role_id: int, update_data: DepartmentRoleUpdate,
                              updated_by: int = None) -> Dict[str, Any]:
        """更新部門角色。注意：不會自動重算子角色層級"""
        try:
            updates = []
            params = []
            warning_message = None
            
            if update_data.name is not None:
                updates.append("name = %s")
                params.append(update_data.name)
            
            if update_data.parent_id is not None:
                # 檢查是否會造成循環引用
                cycle_check = self._check_would_create_cycle(role_id, update_data.parent_id)
                if cycle_check['has_cycle']:
                    # 主動修正：清除父角色設置，避免循環
                    logger.warning(f"Prevented cycle for role {role_id}: {cycle_check['message']}")
                    # 不設置父角色，但繼續其他更新
                    logger.info(f"Auto-corrected: Setting parent_id to NULL for role {role_id}")
                    updates.append("parent_id = NULL")
                    params.append(None)
                    # 返回警告信息給前端
                    warning_message = f"警告：{cycle_check['message']}。系統已自動修正，將父角色設為無。"
                else:
                    updates.append("parent_id = %s")
                    params.append(update_data.parent_id)
            
            if update_data.level is not None:
                # 限制層級範圍
                level = update_data.level
                if level < 1:
                    level = 1
                elif level > 100:
                    level = 100
                    logger.warning(f"Role level capped at 100 for role {role_id}")
                
                updates.append("level = %s")
                params.append(level)
            
            if update_data.permissions is not None:
                updates.append("permissions = %s")
                params.append(json.dumps(update_data.permissions))
            
            if update_data.is_active is not None:
                updates.append("is_active = %s")
                params.append(update_data.is_active)
            
            if not updates:
                return {'success': True, 'warning': None}
            
            updates.append("updated_by = %s")
            params.append(updated_by)
            
            params.append(role_id)
            
            query = f"""
                UPDATE department_roles 
                SET {', '.join(updates)}
                WHERE id = %s
            """
            
            success = self.execute_update(query, params) > 0
            
            return {
                'success': success,
                'warning': warning_message
            }
            
        except Exception as e:
            logger.error(f"Error updating department role: {e}")
            raise
    
    def get_safe_parent_candidates(self, role_id: int) -> List[Dict[str, Any]]:
        """獲取可安全設為父角色的候選角色（排除會造成循環的角色）"""
        try:
            # 獲取當前角色的所有子角色ID
            child_roles = self.get_child_roles(role_id)
            child_role_ids = [child['id'] for child in child_roles]
            child_role_ids.append(role_id)  # 也排除自己
            
            # 查詢所有可用的角色（排除子角色和自己）
            placeholders = ','.join(['%s'] * len(child_role_ids))
            query = f"""
                SELECT 
                    dr.id, dr.name, dr.level,
                    d.name as department_name,
                    d.path as department_path
                FROM department_roles dr
                INNER JOIN departments d ON dr.department_id = d.id
                WHERE dr.id NOT IN ({placeholders})
                  AND dr.is_active = TRUE
                ORDER BY d.path, dr.level, dr.name
            """
            
            candidates = self.execute_query(query, child_role_ids)
            
            # 額外檢查每個候選角色，確保不會形成循環
            safe_candidates = []
            for candidate in candidates:
                cycle_check = self._check_would_create_cycle(role_id, candidate['id'])
                if not cycle_check['has_cycle']:
                    safe_candidates.append(candidate)
            
            return safe_candidates
            
        except Exception as e:
            logger.error(f"Error getting safe parent candidates: {e}")
            return []
    
    def search_roles(self, keyword: str, exclude_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """搜尋角色（支援角色名和部門名）"""
        try:
            conditions = []
            params = []
            
            # 查找角色名稱或部門名稱包含關鍵字的角色
            conditions.append("(dr.name LIKE %s OR d.name LIKE %s)")
            search_pattern = f"%{keyword}%"
            params.extend([search_pattern, search_pattern])
            
            # 排除指定ID（避免循環引用）
            if exclude_id is not None:
                conditions.append("dr.id != %s")
                params.append(exclude_id)
            
            # 只搜尋啟用的角色
            conditions.append("dr.is_active = TRUE")
            conditions.append("d.is_active = TRUE")
            
            where_clause = "WHERE " + " AND ".join(conditions)
            
            query = f"""
                SELECT 
                    dr.*,
                    d.name as department_name,
                    d.path as department_path,
                    rt.name as template_name
                FROM department_roles dr
                INNER JOIN departments d ON dr.department_id = d.id
                INNER JOIN role_templates rt ON dr.template_id = rt.id
                {where_clause}
                ORDER BY d.level, d.path, dr.name
                LIMIT 50
            """
            
            results = self.execute_query(query, params)
            for role in results:
                if role.get('permissions'):
                    role['permissions'] = json.loads(role['permissions'])
            return results
            
        except Exception as e:
            logger.error(f"Error searching roles: {e}")
            raise
    
    def get_child_roles(self, parent_id: int, visited: set = None, depth: int = 0) -> List[Dict[str, Any]]:
        """獲取所有子角色（遞迴）"""
        try:
            # 初始化 visited 集合
            if visited is None:
                visited = set()
            
            # 防止循環引用和過深遞迴
            if parent_id in visited or depth > 100:
                logger.warning(f"Circular reference or max depth reached for role {parent_id}")
                return []
            
            visited.add(parent_id)
            all_children = []
            
            # 直接子角色
            direct_children_query = """
                SELECT 
                    dr.*,
                    d.name as department_name,
                    d.path as department_path
                FROM department_roles dr
                INNER JOIN departments d ON dr.department_id = d.id
                WHERE dr.parent_id = %s
            """
            
            direct_children = self.execute_query(direct_children_query, (parent_id,))
            all_children.extend(direct_children)
            
            # 遞迴獲取子角色的子角色（傳遞 visited 和深度）
            for child in direct_children:
                if child['id'] not in visited:  # 額外檢查
                    grandchildren = self.get_child_roles(child['id'], visited.copy(), depth + 1)
                    all_children.extend(grandchildren)
            
            return all_children
            
        except Exception as e:
            logger.error(f"Error getting child roles: {e}")
            raise
    
    def is_descendant_of(self, potential_descendant_id: int, ancestor_id: int) -> bool:
        """檢查一個角色是否是另一個角色的子孫
        
        Args:
            potential_descendant_id: 潛在的子孫角色ID
            ancestor_id: 祖先角色ID
            
        Returns:
            True 如果 potential_descendant_id 是 ancestor_id 的子孫，否則 False
        """
        try:
            # 如果兩個ID相同，不算子孫關係
            if potential_descendant_id == ancestor_id:
                return False
            
            # 獲取 ancestor_id 的所有子孫
            all_descendants = self.get_child_roles(ancestor_id)
            
            # 檢查 potential_descendant_id 是否在子孫列表中
            for descendant in all_descendants:
                if descendant['id'] == potential_descendant_id:
                    return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error checking descendant relationship: {e}")
            return False
    
    def find_safe_parent_role_for_move(self, role_id: int, target_department_id: int, 
                                       preferred_parent_id: Optional[int] = None) -> Dict[str, Any]:
        """為移動的角色找到安全的父角色（排除子孫節點）
        
        推導策略：
        1. 目標部門內查找合適的父角色
        2. 如果找不到，向上級部門遞歸查找
        3. 防止循環引用，排除所有子孫節點
        
        Args:
            role_id: 要移動的角色ID
            target_department_id: 目標部門ID
            preferred_parent_id: 優先選擇的父角色ID（可選）
            
        Returns:
            包含父角色資訊和警告的字典
        """
        try:
            result = {
                'parent_role_id': None,
                'parent_role_name': None,
                'parent_department_name': None,
                'has_descendants_in_target': False,
                'warning_message': None,
                'descendants_found': [],
                'search_depth': 0  # 記錄向上查找了幾層
            }
            
            # 獲取要移動的角色資訊
            current_role = self.get_department_role(role_id)
            if not current_role:
                logger.error(f"Role not found: {role_id}")
                result['warning_message'] = "角色不存在"
                return result
            
            # === 第一步：檢查目標部門是否有子孫節點 ===
            target_dept_roles = self.get_department_roles(target_department_id)
            descendants_in_target = []
            
            for dept_role in target_dept_roles:
                # 排除角色自己（如果已經在目標部門）
                if dept_role['id'] == role_id:
                    continue
                    
                if self.is_descendant_of(dept_role['id'], role_id):
                    descendants_in_target.append({
                        'id': dept_role['id'],
                        'name': dept_role['name'],
                        'level': dept_role['level']
                    })
            
            if descendants_in_target:
                result['has_descendants_in_target'] = True
                result['descendants_found'] = descendants_in_target
                logger.info(f"Found {len(descendants_in_target)} descendants of role {role_id} in target department {target_department_id}")
            
            # === 第二步：如果有指定優先父角色且安全，優先使用 ===
            if preferred_parent_id:
                if not self.is_descendant_of(preferred_parent_id, role_id):
                    # 查找這個角色（可能在任何部門）
                    preferred_role = self.get_department_role(preferred_parent_id)
                    if preferred_role:
                        result['parent_role_id'] = preferred_parent_id
                        result['parent_role_name'] = preferred_role['name']
                        result['parent_department_name'] = preferred_role['department_name']
                        logger.info(f"Using preferred parent role {preferred_parent_id}")
                        return result
                else:
                    logger.warning(f"Preferred parent {preferred_parent_id} is a descendant of {role_id}")
            
            # === 第三步：向上遞歸查找合適的父角色 ===
            current_dept_id = target_department_id
            visited_depts = set()
            max_depth = 10
            depth = 0
            
            while depth < max_depth:
                # 防止循環
                if current_dept_id in visited_depts:
                    logger.warning(f"Circular reference detected in department hierarchy")
                    break
                visited_depts.add(current_dept_id)
                
                # 獲取當前部門的角色
                dept_roles = self.get_department_roles(current_dept_id) if current_dept_id == target_department_id else \
                            self.execute_query("""
                                SELECT dr.*, d.name as department_name 
                                FROM department_roles dr 
                                INNER JOIN departments d ON dr.department_id = d.id
                                WHERE dr.department_id = %s AND dr.is_active = TRUE
                                ORDER BY dr.level ASC
                            """, (current_dept_id,))
                
                # 在當前部門查找安全的父角色
                safe_candidates = []
                for dept_role in dept_roles:
                    # 排除角色自己和其子孫
                    if dept_role['id'] != role_id and not self.is_descendant_of(dept_role['id'], role_id):
                        safe_candidates.append(dept_role)
                
                if safe_candidates:
                    # 找到安全的候選角色
                    # 優先選擇：1.管理者角色 2.層級最高的角色
                    manager_roles = [r for r in safe_candidates if r.get('role_type') == 'manager']
                    
                    if manager_roles:
                        # 有管理者角色，選擇層級最高的管理者
                        best_parent = min(manager_roles, key=lambda r: r['level'])
                    else:
                        # 沒有管理者，選擇層級最高的角色
                        best_parent = min(safe_candidates, key=lambda r: r['level'])
                    
                    result['parent_role_id'] = best_parent['id']
                    result['parent_role_name'] = best_parent['name']
                    result['parent_department_name'] = best_parent.get('department_name', '')
                    result['search_depth'] = depth
                    
                    # 生成警告訊息
                    if descendants_in_target:
                        desc_names = ', '.join([d['name'] for d in descendants_in_target[:3]])
                        if len(descendants_in_target) > 3:
                            desc_names += f' 等{len(descendants_in_target)}個角色'
                        
                        if depth == 0:
                            result['warning_message'] = (
                                f" 目標部門包含此角色的子孫節點（{desc_names}），"
                                f"為避免循環引用，已智能選擇 '{best_parent['name']}' 作為父角色"
                            )
                        else:
                            # 獲取當前部門名稱
                            dept_query = "SELECT name FROM departments WHERE id = %s"
                            dept_result = self.execute_query(dept_query, (current_dept_id,))
                            dept_name = dept_result[0]['name'] if dept_result else '上級部門'
                            
                            result['warning_message'] = (
                                f" 目標部門包含此角色的子孫節點（{desc_names}），"
                                f"已向上查找 {depth} 層，在 '{dept_name}' 找到合適的父角色 '{best_parent['name']}'"
                            )
                    elif depth > 0:
                        # 沒有子孫節點，但是向上查找了
                        dept_query = "SELECT name FROM departments WHERE id = %s"
                        dept_result = self.execute_query(dept_query, (current_dept_id,))
                        dept_name = dept_result[0]['name'] if dept_result else '上級部門'
                        
                        result['warning_message'] = (
                            f" 目標部門無合適的父角色，已向上查找 {depth} 層，"
                            f"在 '{dept_name}' 找到父角色 '{best_parent['name']}'"
                        )
                    
                    logger.info(f"Found safe parent role {best_parent['id']} at depth {depth}")
                    return result
                
                # 當前部門沒有合適的角色，向上級部門查找
                if depth == 0:
                    logger.info(f"No suitable parent role in target department {current_dept_id}, searching upwards")
                
                # 獲取當前部門的父部門
                dept_query = "SELECT parent_id FROM departments WHERE id = %s"
                dept_result = self.execute_query(dept_query, (current_dept_id,))
                
                if not dept_result or not dept_result[0]['parent_id']:
                    # 已經到達頂層部門
                    logger.info(f"Reached top level department at depth {depth}")
                    break
                
                current_dept_id = dept_result[0]['parent_id']
                depth += 1
            
            # === 第四步：找不到任何合適的父角色 ===
            if descendants_in_target:
                desc_names = ', '.join([d['name'] for d in descendants_in_target[:3]])
                if len(descendants_in_target) > 3:
                    desc_names += f' 等{len(descendants_in_target)}個角色'
                result['warning_message'] = (
                    f" 警告：無法找到安全的父角色（目標部門包含子孫節點：{desc_names}），"
                    f"將設為頂層角色（無父角色）"
                )
            else:
                result['warning_message'] = (
                    f"ℹ 無法找到合適的父角色，將設為頂層角色（無父角色）"
                )
            
            logger.info(f"No safe parent role found for role {role_id} moving to department {target_department_id}")
            return result
            
        except Exception as e:
            logger.error(f"Error finding safe parent role: {e}")
            return {
                'parent_role_id': None,
                'parent_role_name': None,
                'parent_department_name': None,
                'has_descendants_in_target': False,
                'warning_message': f"查找父角色時發生錯誤: {str(e)}",
                'descendants_found': [],
                'search_depth': 0
            }
    
    def recalculate_child_levels(self, role_id: int, preview_only: bool = False) -> Dict[str, Any]:
        """重新計算所有子角色的層級（遞歸處理所有後代節點）"""
        try:
            # 獲取當前角色的層級
            current_role = self.get_department_role(role_id)
            if not current_role:
                return {'success': False, 'message': '角色不存在'}
            
            current_level = current_role['level']
            
            # 獲取所有子角色
            child_roles = self.get_child_roles(role_id)
            
            if not child_roles:
                return {
                    'success': True,
                    'message': '沒有子角色需要更新',
                    'count': 0,
                    'changes': [],
                    'affected_roles': []
                }
            
            # 建立角色ID到角色數據的映射
            role_map = {child['id']: child for child in child_roles}
            role_map[role_id] = current_role  # 包含根角色
            
            # 維護新層級的緩存（用於正確計算間接子角色）
            new_levels = {role_id: current_level}
            visited = set()  # 防止無限遞歸
            
            # 遞歸計算所有子角色的新層級
            def calculate_levels_recursive(parent_id: int, parent_level: int, depth: int = 0):
                # 防止無限遞歸
                if parent_id in visited:
                    logger.warning(f"Circular reference detected for role {parent_id}, skipping")
                    return []
                
                if depth > 100:  # 防止過深的遞歸
                    logger.warning(f"Max depth reached for role {parent_id}, stopping recursion")
                    return []
                
                visited.add(parent_id)
                changes_list = []
                
                # 找出所有直接子角色
                direct_children = [role for role in child_roles if role['parent_id'] == parent_id]
                
                # 按照當前層級排序，確保處理順序一致
                direct_children.sort(key=lambda x: x['level'])
                
                for child in direct_children:
                    if child['id'] in visited:
                        logger.warning(f"Skipping role {child['id']} - already visited (circular reference)")
                        continue
                        
                    new_level = parent_level + 10
                    
                    # 限制層級範圍
                    if new_level > 100:
                        new_level = 100
                        
                    new_levels[child['id']] = new_level
                    
                    if new_level != child['level']:
                        changes_list.append({
                            'id': child['id'],
                            'name': child['name'],
                            'department_name': child['department_name'],
                            'department_path': child['department_path'],
                            'old_level': child['level'],  # 改名為 old_level，與前端顯示一致
                            'new_level': new_level
                        })
                    
                    # 遞歸處理這個子角色的子角色
                    sub_changes = calculate_levels_recursive(child['id'], new_level, depth + 1)
                    changes_list.extend(sub_changes)
                
                return changes_list
            
            # 從根角色開始計算所有子角色的新層級
            changes = calculate_levels_recursive(role_id, current_level, 0)
            
            # 準備返回結果
            result = {
                'count': len(changes),
                'changes': changes,
                'affected_roles': changes  # 前端顯示需要的格式
            }
            
            # 如果不是預覽模式，執行更新
            if not preview_only and changes:
                for change in changes:
                    update_query = "UPDATE department_roles SET level = %s WHERE id = %s"
                    self.execute_update(update_query, (change['new_level'], change['id']))
                
                result['success'] = True
                result['message'] = f'成功更新了 {len(changes)} 個子角色的層級（包含所有後代節點）'
            elif preview_only:
                result['success'] = True
                result['message'] = '預覽模式'
            else:
                result['success'] = True
                result['message'] = '沒有需要更新的子角色'
            
            return result
            
        except Exception as e:
            logger.error(f"Error recalculating child levels: {e}")
            raise
    
    def move_role_to_department(self, role_id: int, new_department_id: int, 
                               new_parent_role_id: Optional[int] = None,
                               include_children: bool = False) -> Dict[str, Any]:
        """移動角色到新部門（支援批量移動子角色）"""
        try:
            # 獲取當前角色資訊
            current_role = self.get_department_role(role_id)
            if not current_role:
                return {"success": False, "message": "角色不存在"}
            
            # 如果要包含子角色，先獲取所有子角色
            roles_to_move = [role_id]
            child_roles_data = []
            if include_children:
                child_roles_data = self.get_child_roles(role_id)
                roles_to_move.extend([child['id'] for child in child_roles_data])
            
            # 使用智能父角色推算
            parent_role_info = self.find_safe_parent_role_for_move(
                role_id, new_department_id, new_parent_role_id
            )
            
            # 更新父角色ID（可能與用戶指定的不同）
            actual_parent_role_id = parent_role_info['parent_role_id']
            warning_message = parent_role_info['warning_message']
            
            # 計算新層級
            if actual_parent_role_id:
                # 有父角色
                parent_role = self.get_department_role(actual_parent_role_id)
                if not parent_role:
                    return {"success": False, "message": "父角色不存在"}
                new_level = int(parent_role['level']) + 10  # 每層加10
                # 限制層級範圍
                if new_level > 100:
                    new_level = 100
            else:
                # 無父角色，設為頂層
                new_level = 1
            
            # 開始事務處理
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                
                try:
                    affected_roles = []
                    
                    if include_children:
                        # 批量移動模式：移動主角色和所有子角色
                        level_diff = new_level - int(current_role['level'])
                        
                        for move_role_id in roles_to_move:
                            # 獲取角色當前資訊
                            cursor.execute("""
                                SELECT id, name, level, parent_id, department_id 
                                FROM department_roles WHERE id = %s
                            """, (move_role_id,))
                            role_data = cursor.fetchone()
                            
                            if role_data:
                                # 從 dict 取得資料
                                r_id = role_data['id']
                                r_name = role_data['name']
                                r_level = role_data['level']
                                r_parent_id = role_data['parent_id']
                                r_dept_id = role_data['department_id']
                                
                                # 計算新層級（保持相對層級差）
                                role_new_level = int(r_level) + level_diff
                                if role_new_level > 100:
                                    role_new_level = 100
                                
                                # 決定父角色ID
                                if move_role_id == role_id:
                                    # 主角色使用智能推算的父角色
                                    role_parent_id = actual_parent_role_id
                                else:
                                    # 子角色保持原有的父子關係，但如果父角色也在移動列表中則保持
                                    if r_parent_id in roles_to_move:
                                        role_parent_id = r_parent_id
                                    else:
                                        # 如果原父角色不在移動列表，則掛到主角色下
                                        role_parent_id = role_id
                                
                                # 更新角色
                                update_query = """
                                    UPDATE department_roles 
                                    SET department_id = %s, parent_id = %s, level = %s, updated_at = NOW()
                                    WHERE id = %s
                                """
                                cursor.execute(update_query, (new_department_id, role_parent_id, role_new_level, move_role_id))
                                
                                affected_roles.append({
                                    'id': move_role_id,
                                    'name': r_name,
                                    'old_level': r_level,
                                    'new_level': role_new_level,
                                    'old_department_id': r_dept_id,
                                    'new_department_id': new_department_id
                                })
                    else:
                        # 單獨移動模式：只移動主角色，子角色留在原部門
                        update_query = """
                            UPDATE department_roles 
                            SET department_id = %s, parent_id = %s, level = %s, updated_at = NOW()
                            WHERE id = %s
                        """
                        cursor.execute(update_query, (new_department_id, actual_parent_role_id, new_level, role_id))
                        
                        # 子角色需要新的父角色（找原部門中層級最接近的角色）
                        if child_roles_data:
                            # 找原部門其他角色
                            cursor.execute("""
                                SELECT id, level FROM department_roles 
                                WHERE department_id = %s AND id != %s
                                ORDER BY ABS(level - %s) LIMIT 1
                            """, (current_role['department_id'], role_id, current_role['level']))
                            
                            new_parent_for_children = cursor.fetchone()
                            new_parent_id_for_children = new_parent_for_children[0] if new_parent_for_children else None
                            
                            # 更新子角色的父角色
                            for child in child_roles_data:
                                cursor.execute("""
                                    UPDATE department_roles 
                                    SET parent_id = %s, updated_at = NOW()
                                    WHERE id = %s
                                """, (new_parent_id_for_children, child['id']))
                        
                        affected_roles.append({
                            'id': role_id,
                            'name': current_role['name'],
                            'old_level': current_role['level'],
                            'new_level': new_level,
                            'old_department_id': current_role['department_id'],
                            'new_department_id': new_department_id
                        })
                    
                    conn.commit()
                    
                    move_mode = "批量移動" if include_children else "單獨移動"
                    return {
                        "success": True,
                        "message": f"{move_mode}成功，共影響 {len(affected_roles)} 個角色",
                        "affected_roles": affected_roles,
                        "new_level": new_level,
                        "new_parent_role_id": actual_parent_role_id,
                        "new_parent_role_name": parent_role_info.get('parent_role_name'),
                        "move_mode": move_mode,
                        "children_moved": len(child_roles_data) if include_children else 0,
                        "warning": warning_message,
                        "has_descendants_in_target": parent_role_info['has_descendants_in_target'],
                        "descendants_found": parent_role_info['descendants_found']
                    }
                    
                except Exception as e:
                    conn.rollback()
                    raise e
                    
        except Exception as e:
            logger.error(f"Error moving role to department: {e}")
            return {"success": False, "message": f"移動角色失敗: {str(e)}"}
    
    def _recalculate_children_levels_recursive(self, cursor, parent_role_id: int, 
                                              parent_level: int, affected_roles: List[Dict[str, Any]],
                                              visited: set = None, depth: int = 0):
        """遞歸重新計算子角色層級（內部事務使用）"""
        # 初始化 visited 集合
        if visited is None:
            visited = set()
        
        # 防止循環引用和過深遞迴
        if parent_role_id in visited or depth > 100:
            logger.warning(f"Detected circular reference or too deep recursion at role {parent_role_id}, depth {depth}")
            return
        
        visited.add(parent_role_id)
        
        # 找出所有直接子角色
        cursor.execute("""
            SELECT id, name, level, department_id 
            FROM department_roles 
            WHERE parent_id = %s
        """, (parent_role_id,))
        
        child_roles = cursor.fetchall()
        
        for child in child_roles:
            # 統一使用每層加10的邏輯
            new_level = parent_level + 10
            old_level = child['level']
            
            # 限制層級範圍在 1-100
            if new_level > 100:
                logger.warning(f"Role {child['id']} would exceed max level 100, capping at 100")
                new_level = 100
            
            if old_level != new_level:
                # 更新子角色層級
                cursor.execute("""
                    UPDATE department_roles 
                    SET level = %s, updated_at = NOW() 
                    WHERE id = %s
                """, (new_level, child['id']))
                
                affected_roles.append({
                    "id": child['id'],
                    "name": child['name'],
                    "old_level": old_level,
                    "new_level": new_level,
                    "department_id": child['department_id']
                })
                
                # 遞歸處理孫子角色（傳遞 visited 和增加深度）
                self._recalculate_children_levels_recursive(cursor, child['id'], new_level, affected_roles, visited, depth + 1)

    def delete_department_role(self, role_id: int) -> bool:
        """刪除部門角色"""
        try:
            # 檢查是否有用戶使用此角色
            check_query = "SELECT COUNT(*) as count FROM user_department_roles WHERE department_role_id = %s"
            result = self.execute_query(check_query, (role_id,))
            if result and result[0]['count'] > 0:
                # 如果有用戶使用，只停用不刪除
                query = "UPDATE department_roles SET is_active = FALSE WHERE id = %s"
                return self.execute_update(query, (role_id,)) > 0
            else:
                # 檢查是否有子角色，如有則不能刪除
                child_check = "SELECT COUNT(*) as count FROM department_roles WHERE parent_id = %s"
                child_result = self.execute_query(child_check, (role_id,))
                if child_result and child_result[0]['count'] > 0:
                    # 有子角色，只停用
                    query = "UPDATE department_roles SET is_active = FALSE WHERE id = %s"
                    return self.execute_update(query, (role_id,)) > 0
                else:
                    # 沒有用戶使用且沒有子角色，可以刪除
                    query = "DELETE FROM department_roles WHERE id = %s"
                    success = self.execute_update(query, (role_id,))
                    return success
                
        except Exception as e:
            logger.error(f"Error deleting department role: {e}")
            raise


class UserDepartmentRoleDAO(BaseDAO):
    """用戶部門角色 DAO"""
    
    def assign_users_to_role(self, role_id: int, assign_data: UserDepartmentRoleAssign,
                            assigned_by: int = None) -> List[int]:
        """指派用戶到角色"""
        try:
            created_ids = []
            
            for user_id in assign_data.user_ids:
                # 檢查是否已存在
                check_query = """
                    SELECT id FROM user_department_roles 
                    WHERE user_id = %s AND department_role_id = %s
                """
                existing = self.execute_query(check_query, (user_id, role_id))
                
                if not existing:
                    query = """
                        INSERT INTO user_department_roles (
                            user_id, department_role_id, is_primary,
                            effective_date, expiry_date, assigned_by
                        ) VALUES (%s, %s, %s, %s, %s, %s)
                    """
                    
                    params = (
                        user_id, role_id, assign_data.is_primary,
                        assign_data.effective_date, assign_data.expiry_date,
                        assigned_by
                    )
                    
                    role_id = self.execute_insert(query, params)
                    if role_id:
                        created_ids.append(role_id)
            
            return created_ids
            
        except Exception as e:
            logger.error(f"Error assigning users to role: {e}")
            raise
    
    def remove_user_from_role(self, user_id: int, role_id: int) -> bool:
        """移除用戶的角色"""
        try:
            query = """
                DELETE FROM user_department_roles 
                WHERE user_id = %s AND department_role_id = %s
            """
            success = self.execute_update(query, (user_id, role_id))
            return success
            
        except Exception as e:
            logger.error(f"Error removing user from role: {e}")
            raise
    
    def get_role_users(self, role_id: int) -> List[Dict[str, Any]]:
        """取得角色的所有用戶"""
        try:
            query = """
                SELECT 
                    udr.*,
                    u.username,
                    u.email,
                    u.loginid,
                    dr.name as role_name,
                    dr.role_type,
                    d.name as department_name,
                    au.username as assigned_by_name
                FROM user_department_roles udr
                INNER JOIN users u ON udr.user_id = u.id
                INNER JOIN department_roles dr ON udr.department_role_id = dr.id
                INNER JOIN departments d ON dr.department_id = d.id
                LEFT JOIN users au ON udr.assigned_by = au.id
                WHERE udr.department_role_id = %s
                ORDER BY udr.is_primary DESC, u.username
            """
            
            return self.execute_query(query, (role_id,))
            
        except Exception as e:
            logger.error(f"Error getting role users: {e}")
            raise
    
    def get_user_roles(self, user_id: int) -> List[Dict[str, Any]]:
        """取得用戶的所有角色"""
        try:
            query = """
                SELECT 
                    udr.*,
                    dr.name as role_name,
                    dr.role_type,
                    dr.level as role_level,
                    d.id as department_id,
                    d.name as department_name,
                    rt.name as template_name
                FROM user_department_roles udr
                INNER JOIN department_roles dr ON udr.department_role_id = dr.id
                INNER JOIN departments d ON dr.department_id = d.id
                INNER JOIN role_templates rt ON dr.template_id = rt.id
                WHERE udr.user_id = %s
                AND (udr.expiry_date IS NULL OR udr.expiry_date >= CURDATE())
                ORDER BY udr.is_primary DESC, dr.level
            """
            
            return self.execute_query(query, (user_id,))
            
        except Exception as e:
            logger.error(f"Error getting user roles: {e}")
            raise


class RoleRelationshipAnalysisDAO(BaseDAO):
    """角色關係分析 DAO"""
    
    def analyze_cross_department_relationships(self) -> Dict[str, Any]:
        """分析跨部門角色父子關係並提供調整建議"""
        try:
            # 查詢所有有父角色的角色，檢查是否跨部門
            query = """
                SELECT 
                    dr.id,
                    dr.name,
                    dr.department_id,
                    dr.parent_id,
                    dr.level,
                    dr.role_type,
                    d1.name as department_name,
                    d1.path as department_path,
                    d1.level as department_level,
                    pr.name as parent_role_name,
                    pr.department_id as parent_department_id,
                    pr.level AS parent_department_role_level,
                    d2.name as parent_department_name,
                    d2.path as parent_department_path,
                    d2.level as parent_department_level,
                    rt.name as template_name
                FROM department_roles dr
                INNER JOIN departments d1 ON dr.department_id = d1.id
                INNER JOIN department_roles pr ON dr.parent_id = pr.id
                INNER JOIN departments d2 ON pr.department_id = d2.id
                INNER JOIN role_templates rt ON dr.template_id = rt.id
                WHERE dr.parent_id IS NOT NULL
                  AND dr.is_active = TRUE
                  AND pr.is_active = TRUE
                  AND d1.is_active = TRUE
                  AND d2.is_active = TRUE
                ORDER BY d1.path, dr.level
            """
            
            all_relationships = self.execute_query(query)
            
            # 分析問題關係
            issues = []
            suggestions = []
            
            for relationship in all_relationships:
                role_dept_path = relationship['department_path']
                parent_dept_path = relationship['parent_department_path']
                
                # 檢查1: 跨部門且部門間無層級關係
                if relationship['department_id'] != relationship['parent_department_id']:
                    is_parent_dept_ancestor = role_dept_path.startswith(parent_dept_path + '/')
                    is_child_dept_ancestor = parent_dept_path.startswith(role_dept_path + '/')
                    
                    if not is_parent_dept_ancestor and not is_child_dept_ancestor:
                        # 完全不相關的部門
                        issue = {
                            'type': 'cross_department_unrelated',
                            'severity': 'high',
                            'role_id': relationship['id'],
                            'role_name': relationship['name'],
                            'department_name': relationship['department_name'],
                            'parent_role_name': relationship['parent_role_name'],
                            'parent_department_name': relationship['parent_department_name'],
                            'description': f"角色「{relationship['name']}」的父角色「{relationship['parent_role_name']}」在不相關的部門中"
                        }
                        issues.append(issue)
                        
                        # 生成調整建議
                        suggestion = self._generate_role_adjustment_suggestion(relationship)
                        if suggestion:
                            suggestions.append(suggestion)
                
                # 檢查2: 角色層級與父角色層級不匹配
                if relationship['level'] <= relationship.get('parent_department_role_level', 100):
                    issue = {
                        'type': 'level_mismatch',
                        'severity': 'medium',
                        'role_id': relationship['id'],
                        'role_name': relationship['name'],
                        'department_name': relationship['department_name'],
                        'parent_role_name': relationship['parent_role_name'],
                        'description': f"子部門角色「{relationship['name']}」層級不應小於或等於父部門角色「{relationship['parent_role_name']}」"
                    }
                    issues.append(issue)
                
                # 檢查3: 管理角色被非管理角色管理
                if relationship['role_type'] == 'manager':
                    parent_query = "SELECT role_type FROM department_roles WHERE id = %s"
                    parent_info = self.execute_query(parent_query, (relationship['parent_id'],))
                    if parent_info and parent_info[0]['role_type'] != 'manager':
                        issue = {
                            'type': 'manager_hierarchy_violation',
                            'severity': 'high',
                            'role_id': relationship['id'],
                            'role_name': relationship['name'],
                            'parent_role_name': relationship['parent_role_name'],
                            'description': f"管理角色「{relationship['name']}」不應被非管理角色「{relationship['parent_role_name']}」管理"
                        }
                        issues.append(issue)
            
            return {
                'total_relationships': len(all_relationships),
                'issues_count': len(issues),
                'suggestions_count': len(suggestions),
                'issues': issues,
                'suggestions': suggestions,
                'analysis_summary': {
                    'cross_department_unrelated': len([i for i in issues if i['type'] == 'cross_department_unrelated']),
                    'level_mismatch': len([i for i in issues if i['type'] == 'level_mismatch']),
                    'manager_hierarchy_violation': len([i for i in issues if i['type'] == 'manager_hierarchy_violation'])
                }
            }
            
        except Exception as e:
            logger.error(f"Error analyzing cross department relationships: {e}")
            raise
    
    def _generate_role_adjustment_suggestion(self, relationship: Dict[str, Any]) -> Dict[str, Any]:
        """為單個角色生成調整建議"""
        try:
            role_id = relationship['id']
            dept_id = relationship['department_id']
            
            # 使用現有的智能父角色推導邏輯
            from app.dao.role_template import department_role_dao
            
            # 在同部門或上級部門查找合適的父角色
            find_parent_query = """
                SELECT dr.id, dr.name, dr.level, dr.role_type, d.name as department_name
                FROM department_roles dr
                INNER JOIN departments d ON dr.department_id = d.id
                WHERE dr.department_id = %s 
                  AND dr.id != %s 
                  AND dr.is_active = TRUE
                  AND (dr.role_type = 'manager' OR dr.level < %s)
                ORDER BY 
                  CASE WHEN dr.role_type = 'manager' THEN 1 ELSE 2 END,
                  dr.level ASC
                LIMIT 1
            """
            
            candidates = self.execute_query(find_parent_query, (dept_id, role_id, relationship['level']))
            
            if candidates:
                return {
                    'role_id': role_id,
                    'role_name': relationship['name'],
                    'current_parent_id': relationship['parent_id'],
                    'current_parent_name': relationship['parent_role_name'],
                    'suggested_parent_id': candidates[0]['id'],
                    'suggested_parent_name': candidates[0]['name'],
                    'suggested_parent_department': candidates[0]['department_name'],
                    'reason': '建議調整到同部門的合適父角色',
                    'confidence': 'high'
                }
            else:
                # 如果同部門沒有合適的父角色，建議設為頂層角色
                return {
                    'role_id': role_id,
                    'role_name': relationship['name'],
                    'current_parent_id': relationship['parent_id'],
                    'current_parent_name': relationship['parent_role_name'],
                    'suggested_parent_id': None,
                    'suggested_parent_name': '無（頂層角色）',
                    'suggested_parent_department': relationship['department_name'],
                    'reason': '建議設為部門內的頂層角色',
                    'confidence': 'medium'
                }
                
        except Exception as e:
            logger.error(f"Error generating adjustment suggestion for role {relationship['id']}: {e}")
            return None
    
    def preview_bulk_role_adjustments(self, adjustments: List[Dict[str, Any]]) -> Dict[str, Any]:
        """預覽批量角色調整的影響"""
        try:
            preview_results = []
            
            for adjustment in adjustments:
                role_id = adjustment['role_id']
                new_parent_id = adjustment.get('suggested_parent_id')
                
                # 獲取當前角色資訊
                role_query = """
                    SELECT dr.*, d.name as department_name
                    FROM department_roles dr
                    INNER JOIN departments d ON dr.department_id = d.id
                    WHERE dr.id = %s
                """
                role_info = self.execute_query(role_query, (role_id,))
                if not role_info:
                    continue
                    
                role_info = role_info[0]
                
                # 計算新層級
                if new_parent_id:
                    parent_query = "SELECT level FROM department_roles WHERE id = %s"
                    parent_result = self.execute_query(parent_query, (new_parent_id,))
                    new_level = parent_result[0]['level'] + 10 if parent_result else role_info['level']
                else:
                    new_level = 1  # 頂層角色
                
                # 檢查子角色影響
                child_roles = self._get_all_child_roles(role_id)
                
                preview_results.append({
                    'role_id': role_id,
                    'role_name': role_info['name'],
                    'department_name': role_info['department_name'],
                    'current_level': role_info['level'],
                    'new_level': new_level,
                    'current_parent_id': role_info['parent_id'],
                    'new_parent_id': new_parent_id,
                    'affected_children_count': len(child_roles),
                    'affected_children': child_roles
                })
            
            return {
                'total_adjustments': len(adjustments),
                'preview_results': preview_results,
                'total_affected_roles': sum(len(r['affected_children']) + 1 for r in preview_results)
            }
            
        except Exception as e:
            logger.error(f"Error previewing bulk role adjustments: {e}")
            raise
    
    def _get_all_child_roles(self, parent_role_id: int, visited: set = None) -> List[Dict[str, Any]]:
        """遞歸獲取所有子角色"""
        if visited is None:
            visited = set()
            
        if parent_role_id in visited:
            return []
            
        visited.add(parent_role_id)
        
        try:
            direct_children_query = """
                SELECT dr.id, dr.name, dr.level, d.name as department_name
                FROM department_roles dr
                INNER JOIN departments d ON dr.department_id = d.id
                WHERE dr.parent_id = %s AND dr.is_active = TRUE
            """
            
            direct_children = self.execute_query(direct_children_query, (parent_role_id,))
            all_children = list(direct_children)
            
            # 遞歸獲取子角色的子角色
            for child in direct_children:
                grandchildren = self._get_all_child_roles(child['id'], visited.copy())
                all_children.extend(grandchildren)
            
            return all_children
            
        except Exception as e:
            logger.error(f"Error getting child roles for {parent_role_id}: {e}")
            return []


# 建立 DAO 實例
from app.dao.base import db_manager

role_template_dao = RoleTemplateDAO(db_manager)
department_role_dao = DepartmentRoleDAO(db_manager)
user_department_role_dao = UserDepartmentRoleDAO(db_manager)
role_relationship_analysis_dao = RoleRelationshipAnalysisDAO(db_manager)