"""
權限矩陣 DAO (Data Access Object)
處理權限矩陣相關的資料庫操作
"""
from typing import List, Dict, Any, Optional
from app.dao.base import BaseDAO
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class PermissionMatrixDAO(BaseDAO):
    """權限矩陣資料存取物件"""
    
    def get_all(self, module_code: Optional[str] = None, is_active: Optional[bool] = None) -> List[Dict[str, Any]]:
        """
        取得所有權限矩陣項目
        
        Args:
            module_code: 模組代碼篩選
            is_active: 啟用狀態篩選
            
        Returns:
            權限矩陣列表
        """
        try:
            query = """
            SELECT 
                id,
                module_code,
                module_name,
                action_code,
                action_name,
                permission_key,
                description,
                permission_type,
                sort_order,
                is_active,
                created_at,
                updated_at,
                created_by,
                updated_by
            FROM permission_matrix
            WHERE 1=1
            """
            params = []
            
            if module_code:
                query += " AND module_code = %s"
                params.append(module_code)
            
            if is_active is not None:
                query += " AND is_active = %s"
                params.append(is_active)
            
            query += " ORDER BY module_name, sort_order, action_name"
            
            if params:
                result = self.execute_query(query, params)
            else:
                result = self.execute_query(query)
                
            return result or []
            
        except Exception as e:
            logger.error(f"Error getting permission matrix: {e}")
            return []
    
    def get_by_id(self, matrix_id: int) -> Optional[Dict[str, Any]]:
        """
        根據 ID 取得權限矩陣項目
        
        Args:
            matrix_id: 權限矩陣 ID
            
        Returns:
            權限矩陣項目或 None
        """
        try:
            query = """
            SELECT 
                id,
                module_code,
                module_name,
                action_code,
                action_name,
                permission_key,
                description,
                permission_type,
                sort_order,
                is_active,
                created_at,
                updated_at,
                created_by,
                updated_by
            FROM permission_matrix
            WHERE id = %s
            """
            result = self.execute_query(query, [matrix_id])
            return result[0] if result else None
            
        except Exception as e:
            logger.error(f"Error getting permission matrix by id: {e}")
            return None
    
    def get_by_permission_key(self, permission_key: str) -> Optional[Dict[str, Any]]:
        """
        根據權限鍵值取得權限矩陣項目
        
        Args:
            permission_key: 權限鍵值
            
        Returns:
            權限矩陣項目或 None
        """
        try:
            query = """
            SELECT 
                id,
                module_code,
                module_name,
                action_code,
                action_name,
                permission_key,
                description,
                permission_type,
                sort_order,
                is_active,
                created_at,
                updated_at,
                created_by,
                updated_by
            FROM permission_matrix
            WHERE permission_key = %s
            """
            result = self.execute_query(query, [permission_key])
            return result[0] if result else None
            
        except Exception as e:
            logger.error(f"Error getting permission matrix by key: {e}")
            return None
    
    def create(self, data: Dict[str, Any]) -> Optional[int]:
        """
        創建新的權限矩陣項目
        
        Args:
            data: 權限矩陣資料
            
        Returns:
            新創建的權限矩陣 ID 或 None
        """
        try:
            # 生成權限鍵值
            permission_key = f"{data['module_code']}.{data['action_code']}"
            
            # 檢查權限鍵值是否已存在
            if self.get_by_permission_key(permission_key):
                logger.error(f"Permission key {permission_key} already exists")
                return None
            
            query = """
            INSERT INTO permission_matrix (
                module_code, module_name, action_code, action_name,
                permission_key, description, permission_type, sort_order,
                is_active, created_by, created_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            """
            
            params = [
                data['module_code'],
                data['module_name'],
                data['action_code'],
                data['action_name'],
                permission_key,
                data.get('description', ''),
                data.get('permission_type', 'custom'),
                data.get('sort_order', 0),
                data.get('is_active', True),
                data.get('created_by')
            ]
            
            result = self.execute_update(query, params)
            
            if result:
                # 取得新插入的 ID
                last_id_query = "SELECT LAST_INSERT_ID() as id"
                id_result = self.execute_query(last_id_query)
                return id_result[0]['id'] if id_result else None
            
            return None
            
        except Exception as e:
            logger.error(f"Error creating permission matrix: {e}")
            return None
    
    def update(self, matrix_id: int, data: Dict[str, Any]) -> bool:
        """
        更新權限矩陣項目
        
        Args:
            matrix_id: 權限矩陣 ID
            data: 更新的資料
            
        Returns:
            是否更新成功
        """
        try:
            # 檢查權限項目是否存在
            existing = self.get_by_id(matrix_id)
            if not existing:
                logger.error(f"Permission matrix {matrix_id} not found")
                return False
            
            # 如果是系統權限，限制可修改的欄位
            if existing['permission_type'] == 'system':
                # 系統權限只能修改描述、排序和狀態
                query = """
                UPDATE permission_matrix 
                SET description = %s, sort_order = %s, is_active = %s, 
                    updated_by = %s, updated_at = NOW()
                WHERE id = %s
                """
                params = [
                    data.get('description', existing['description']),
                    data.get('sort_order', existing['sort_order']),
                    data.get('is_active', existing['is_active']),
                    data.get('updated_by'),
                    matrix_id
                ]
            else:
                # 自訂權限可以修改所有欄位
                permission_key = f"{data['module_code']}.{data['action_code']}"
                
                # 檢查新的權限鍵值是否與其他項目衝突
                if permission_key != existing['permission_key']:
                    conflict = self.get_by_permission_key(permission_key)
                    if conflict and conflict['id'] != matrix_id:
                        logger.error(f"Permission key {permission_key} already exists")
                        return False
                
                query = """
                UPDATE permission_matrix 
                SET module_code = %s, module_name = %s, action_code = %s, action_name = %s,
                    permission_key = %s, description = %s, permission_type = %s, 
                    sort_order = %s, is_active = %s, updated_by = %s, updated_at = NOW()
                WHERE id = %s
                """
                params = [
                    data['module_code'],
                    data['module_name'],
                    data['action_code'],
                    data['action_name'],
                    permission_key,
                    data.get('description', ''),
                    data.get('permission_type', 'custom'),
                    data.get('sort_order', 0),
                    data.get('is_active', True),
                    data.get('updated_by'),
                    matrix_id
                ]
            
            result = self.execute_update(query, params)
            return result > 0
            
        except Exception as e:
            logger.error(f"Error updating permission matrix: {e}")
            return False
    
    def update_status(self, matrix_id: int, is_active: bool, updated_by: int) -> bool:
        """
        更新權限矩陣項目狀態
        
        Args:
            matrix_id: 權限矩陣 ID
            is_active: 啟用狀態
            updated_by: 更新者 ID
            
        Returns:
            是否更新成功
        """
        try:
            query = """
            UPDATE permission_matrix 
            SET is_active = %s, updated_by = %s, updated_at = NOW()
            WHERE id = %s
            """
            
            result = self.execute_update(query, [is_active, updated_by, matrix_id])
            return result > 0
            
        except Exception as e:
            logger.error(f"Error updating permission matrix status: {e}")
            return False
    
    def delete(self, matrix_id: int) -> bool:
        """
        刪除權限矩陣項目
        
        Args:
            matrix_id: 權限矩陣 ID
            
        Returns:
            是否刪除成功
        """
        try:
            # 檢查是否為系統權限
            existing = self.get_by_id(matrix_id)
            if not existing:
                logger.error(f"Permission matrix {matrix_id} not found")
                return False
            
            if existing['permission_type'] == 'system':
                logger.error(f"Cannot delete system permission matrix {matrix_id}")
                return False
            
            query = "DELETE FROM permission_matrix WHERE id = %s"
            result = self.execute_update(query, [matrix_id])
            return result > 0
            
        except Exception as e:
            logger.error(f"Error deleting permission matrix: {e}")
            return False
    
    def get_modules(self) -> List[Dict[str, Any]]:
        """
        取得所有模組列表
        
        Returns:
            模組列表
        """
        try:
            query = """
            SELECT 
                module_code,
                module_name,
                COUNT(*) as action_count,
                SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_count
            FROM permission_matrix
            GROUP BY module_code, module_name
            ORDER BY module_name
            """
            
            result = self.execute_query(query)
            return result or []
            
        except Exception as e:
            logger.error(f"Error getting permission modules: {e}")
            return []
    
    def check_table_exists(self) -> bool:
        """
        檢查 permission_matrix 表是否存在
        
        Returns:
            表是否存在
        """
        try:
            query = """
            SELECT COUNT(*) as cnt 
            FROM information_schema.tables 
            WHERE table_schema = DATABASE() 
            AND table_name = 'permission_matrix'
            """
            result = self.execute_query(query)
            return result and result[0]['cnt'] > 0
            
        except Exception as e:
            logger.error(f"Error checking permission_matrix table: {e}")
            return False
    
    def batch_create(self, items: List[Dict[str, Any]], created_by: int) -> Dict[str, Any]:
        """
        批次創建權限矩陣項目
        
        Args:
            items: 權限矩陣項目列表
            created_by: 創建者 ID
            
        Returns:
            創建結果統計
        """
        success_count = 0
        failed_count = 0
        errors = []
        
        for item in items:
            try:
                item['created_by'] = created_by
                if self.create(item):
                    success_count += 1
                else:
                    failed_count += 1
                    errors.append(f"Failed to create {item.get('permission_key', 'unknown')}")
            except Exception as e:
                failed_count += 1
                errors.append(str(e))
        
        return {
            'success_count': success_count,
            'failed_count': failed_count,
            'errors': errors
        }


# 創建全域實例
from app.dao.base import db_manager
permission_matrix_dao = PermissionMatrixDAO(db_manager)