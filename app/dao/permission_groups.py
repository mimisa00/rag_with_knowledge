"""
權限群組 DAO (Data Access Object)
處理權限群組與權限矩陣關聯的資料庫操作
"""
from typing import List, Dict, Any, Optional
from app.dao.base import BaseDAO
import logging

logger = logging.getLogger(__name__)


class PermissionGroupsDAO(BaseDAO):
    """權限群組資料存取物件"""
    
    def get_group_permissions(self, group_id: int) -> List[Dict[str, Any]]:
        """
        取得權限群組的所有權限
        
        Args:
            group_id: 權限群組 ID
            
        Returns:
            權限列表
        """
        try:
            query = """
            SELECT 
                pm.id,
                pm.module_code,
                pm.module_name,
                pm.action_code,
                pm.action_name,
                pm.permission_key,
                pm.description,
                pm.permission_type,
                pm.sort_order,
                pm.is_active,
                pgm.created_at as assigned_at
            FROM permission_groups_matrix pgm
            JOIN permission_matrix pm ON pgm.permission_matrix_id = pm.id
            WHERE pgm.permission_group_id = %s
            ORDER BY pm.module_name, pm.sort_order, pm.action_name
            """
            
            result = self.execute_query(query, [group_id])
            return result or []
            
        except Exception as e:
            logger.error(f"Error getting group permissions: {e}")
            return []
    
    def get_group_permission_ids(self, group_id: int) -> List[int]:
        """
        取得權限群組的權限 ID 列表
        
        Args:
            group_id: 權限群組 ID
            
        Returns:
            權限 ID 列表
        """
        try:
            query = """
            SELECT permission_matrix_id
            FROM permission_groups_matrix
            WHERE permission_group_id = %s
            """
            
            result = self.execute_query(query, [group_id])
            return [row['permission_matrix_id'] for row in result] if result else []
            
        except Exception as e:
            logger.error(f"Error getting group permission IDs: {e}")
            return []
    
    def add_permissions_to_group(self, group_id: int, permission_ids: List[int], created_by: Optional[int] = None) -> bool:
        """
        為權限群組新增權限
        
        Args:
            group_id: 權限群組 ID
            permission_ids: 權限 ID 列表
            created_by: 創建者 ID
            
        Returns:
            是否成功
        """
        try:
            if not permission_ids:
                return True
            
            # 批次插入
            values = []
            params = []
            for permission_id in permission_ids:
                values.append("(%s, %s, %s)")
                params.extend([group_id, permission_id, created_by])
            
            query = f"""
            INSERT IGNORE INTO permission_groups_matrix 
            (permission_group_id, permission_matrix_id, created_by) 
            VALUES {', '.join(values)}
            """
            
            result = self.execute_update(query, params)
            return result >= 0
            
        except Exception as e:
            logger.error(f"Error adding permissions to group: {e}")
            return False
    
    def remove_permissions_from_group(self, group_id: int, permission_ids: Optional[List[int]] = None) -> bool:
        """
        從權限群組移除權限
        
        Args:
            group_id: 權限群組 ID
            permission_ids: 要移除的權限 ID 列表，如果為 None 則移除所有權限
            
        Returns:
            是否成功
        """
        try:
            if permission_ids is None:
                # 移除所有權限
                query = "DELETE FROM permission_groups_matrix WHERE permission_group_id = %s"
                params = [group_id]
            elif not permission_ids:
                # 沒有要移除的權限
                return True
            else:
                # 移除指定權限
                placeholders = ','.join(['%s'] * len(permission_ids))
                query = f"""
                DELETE FROM permission_groups_matrix 
                WHERE permission_group_id = %s 
                AND permission_matrix_id IN ({placeholders})
                """
                params = [group_id] + permission_ids
            
            result = self.execute_update(query, params)
            return result >= 0
            
        except Exception as e:
            logger.error(f"Error removing permissions from group: {e}")
            return False
    
    def update_group_permissions(self, group_id: int, permission_ids: List[int], created_by: Optional[int] = None) -> bool:
        """
        更新權限群組的權限（完全替換）
        
        Args:
            group_id: 權限群組 ID
            permission_ids: 新的權限 ID 列表
            created_by: 創建者 ID
            
        Returns:
            是否成功
        """
        try:
            # 先移除所有現有權限
            if not self.remove_permissions_from_group(group_id):
                return False
            
            # 再新增新的權限
            if permission_ids:
                return self.add_permissions_to_group(group_id, permission_ids, created_by)
            
            return True
            
        except Exception as e:
            logger.error(f"Error updating group permissions: {e}")
            return False
    
    def get_groups_by_permission(self, permission_id: int) -> List[Dict[str, Any]]:
        """
        取得擁有特定權限的所有群組
        
        Args:
            permission_id: 權限 ID
            
        Returns:
            群組列表
        """
        try:
            query = """
            SELECT 
                pg.id,
                pg.code,
                pg.name,
                pg.description,
                pg.permission_type,
                pg.is_active,
                pgm.created_at as assigned_at
            FROM permission_groups pg
            JOIN permission_groups_matrix pgm ON pg.id = pgm.permission_group_id
            WHERE pgm.permission_matrix_id = %s
            AND pg.is_active = 1
            ORDER BY pg.name
            """
            
            result = self.execute_query(query, [permission_id])
            return result or []
            
        except Exception as e:
            logger.error(f"Error getting groups by permission: {e}")
            return []
    
    def check_group_has_permission(self, group_id: int, permission_key: str) -> bool:
        """
        檢查群組是否擁有特定權限
        
        Args:
            group_id: 權限群組 ID
            permission_key: 權限鍵值
            
        Returns:
            是否擁有權限
        """
        try:
            query = """
            SELECT COUNT(*) as count
            FROM permission_groups_matrix pgm
            JOIN permission_matrix pm ON pgm.permission_matrix_id = pm.id
            WHERE pgm.permission_group_id = %s
            AND pm.permission_key = %s
            AND pm.is_active = 1
            """
            
            result = self.execute_query(query, [group_id, permission_key])
            return result and result[0]['count'] > 0
            
        except Exception as e:
            logger.error(f"Error checking group permission: {e}")
            return False
    
    def get_group_permissions_by_module(self, group_id: int, module_code: str) -> List[Dict[str, Any]]:
        """
        取得權限群組在特定模組的權限
        
        Args:
            group_id: 權限群組 ID
            module_code: 模組代碼
            
        Returns:
            權限列表
        """
        try:
            query = """
            SELECT 
                pm.id,
                pm.action_code,
                pm.action_name,
                pm.permission_key,
                pm.description
            FROM permission_groups_matrix pgm
            JOIN permission_matrix pm ON pgm.permission_matrix_id = pm.id
            WHERE pgm.permission_group_id = %s
            AND pm.module_code = %s
            AND pm.is_active = 1
            ORDER BY pm.sort_order, pm.action_name
            """
            
            result = self.execute_query(query, [group_id, module_code])
            return result or []
            
        except Exception as e:
            logger.error(f"Error getting group module permissions: {e}")
            return []
    
    def copy_group_permissions(self, source_group_id: int, target_group_id: int, created_by: Optional[int] = None) -> bool:
        """
        複製權限群組的權限到另一個群組
        
        Args:
            source_group_id: 來源群組 ID
            target_group_id: 目標群組 ID
            created_by: 創建者 ID
            
        Returns:
            是否成功
        """
        try:
            # 取得來源群組的所有權限 ID
            permission_ids = self.get_group_permission_ids(source_group_id)
            
            if permission_ids:
                # 將權限新增到目標群組
                return self.add_permissions_to_group(target_group_id, permission_ids, created_by)
            
            return True
            
        except Exception as e:
            logger.error(f"Error copying group permissions: {e}")
            return False


# 創建全域實例
from app.dao.base import db_manager
permission_groups_dao = PermissionGroupsDAO(db_manager)