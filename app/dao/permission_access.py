"""
權限存取管理 DAO
處理 URL、API 和動作權限的資料存取
"""
from typing import List, Dict, Any, Optional
from app.dao.base import BaseDAO, db_manager
import json
import logging

logger = logging.getLogger(__name__)


class PermissionUrlDAO(BaseDAO):
    """URL 權限 DAO"""
    
    def __init__(self):
        super().__init__(db_manager)
        self.table_name = "permission_urls"
    
    def get_all(self, is_active: Optional[bool] = None, is_public: Optional[bool] = None) -> List[Dict[str, Any]]:
        """取得所有 URL 權限設定"""
        query = f"""
            SELECT pu.*, pm.permission_key, pm.module_name, pm.action_name
            FROM {self.table_name} pu
            LEFT JOIN permission_matrix pm ON pu.permission_matrix_id = pm.id
            WHERE 1=1
        """
        params = []
        
        if is_active is not None:
            query += " AND pu.is_active = %s"
            params.append(is_active)
            
        if is_public is not None:
            query += " AND pu.is_public = %s"
            params.append(is_public)
            
        query += " ORDER BY pu.priority, pu.url_pattern"
        
        return self.execute_query(query, params)
    
    def get_by_id(self, url_id: int) -> Optional[Dict[str, Any]]:
        """根據 ID 取得 URL 權限"""
        query = f"""
            SELECT pu.*, pm.permission_key, pm.module_name, pm.action_name
            FROM {self.table_name} pu
            LEFT JOIN permission_matrix pm ON pu.permission_matrix_id = pm.id
            WHERE pu.id = %s
        """
        result = self.execute_query(query, (url_id,))
        return result[0] if result else None
    
    def create(self, data: Dict[str, Any]) -> int:
        """建立 URL 權限"""
        columns = ['url_pattern', 'method', 'permission_matrix_id', 'permission_code', 
                  'module_key', 'description', 'priority', 'is_public', 'is_active', 'created_by']
        values = []
        placeholders = []
        
        for col in columns:
            if col in data:
                values.append(data[col])
                placeholders.append('%s')
        
        used_columns = columns[:len(values)]
        column_str = ', '.join(used_columns)
        value_str = ', '.join(placeholders)
        
        query = f"""
            INSERT INTO {self.table_name} ({column_str})
            VALUES ({value_str})
        """
        
        return self.execute_update(query, values)
    
    def update(self, url_id: int, data: Dict[str, Any]) -> bool:
        """更新 URL 權限"""
        update_fields = []
        values = []
        
        updatable_columns = ['url_pattern', 'method', 'permission_matrix_id', 'permission_code',
                           'module_key', 'description', 'priority', 'is_public', 'is_active', 'updated_by']
        
        for col in updatable_columns:
            if col in data:
                update_fields.append(f"{col} = %s")
                values.append(data[col])
        
        if not update_fields:
            return False
        
        values.append(url_id)
        update_str = ', '.join(update_fields)
        
        query = f"""
            UPDATE {self.table_name}
            SET {update_str}
            WHERE id = %s
        """
        
        rows_affected = self.execute_update(query, values)
        return rows_affected > 0
    
    def delete(self, url_id: int) -> bool:
        """刪除 URL 權限"""
        query = f"DELETE FROM {self.table_name} WHERE id = %s"
        rows_affected = self.execute_update(query, (url_id,))
        return rows_affected > 0
    
    def check_permission(self, user_id: int, url: str, method: str = 'GET') -> Dict[str, Any]:
        """檢查使用者對 URL 的存取權限"""
        query = """
            CALL check_url_permission(%s, %s, %s)
        """
        result = self.execute_query(query, (user_id, url, method))
        if result:
            return {
                'has_permission': result[0].get('has_permission', False),
                'reason': result[0].get('reason', 'Unknown')
            }
        return {'has_permission': False, 'reason': 'No permission found'}


class PermissionApiDAO(BaseDAO):
    """API 權限 DAO"""
    
    def __init__(self):
        super().__init__(db_manager)
        self.table_name = "permission_apis"
    
    def get_all(self, is_active: Optional[bool] = None, require_auth: Optional[bool] = None) -> List[Dict[str, Any]]:
        """取得所有 API 權限設定"""
        query = f"""
            SELECT pa.*, pm.permission_key, pm.module_name, pm.action_name
            FROM {self.table_name} pa
            LEFT JOIN permission_matrix pm ON pa.permission_matrix_id = pm.id
            WHERE 1=1
        """
        params = []
        
        if is_active is not None:
            query += " AND pa.is_active = %s"
            params.append(is_active)
            
        if require_auth is not None:
            query += " AND pa.require_auth = %s"
            params.append(require_auth)
            
        query += " ORDER BY pa.priority, pa.api_pattern"
        
        return self.execute_query(query, params)
    
    def get_by_id(self, api_id: int) -> Optional[Dict[str, Any]]:
        """根據 ID 取得 API 權限"""
        query = f"""
            SELECT pa.*, pm.permission_key, pm.module_name, pm.action_name
            FROM {self.table_name} pa
            LEFT JOIN permission_matrix pm ON pa.permission_matrix_id = pm.id
            WHERE pa.id = %s
        """
        result = self.execute_query(query, (api_id,))
        return result[0] if result else None
    
    def create(self, data: Dict[str, Any]) -> int:
        """建立 API 權限"""
        columns = ['api_pattern', 'method', 'permission_matrix_id', 'permission_code',
                  'module_key', 'description', 'require_auth', 'priority', 'is_active', 'created_by']
        values = []
        placeholders = []
        
        for col in columns:
            if col in data:
                values.append(data[col])
                placeholders.append('%s')
        
        used_columns = columns[:len(values)]
        column_str = ', '.join(used_columns)
        value_str = ', '.join(placeholders)
        
        query = f"""
            INSERT INTO {self.table_name} ({column_str})
            VALUES ({value_str})
        """
        
        return self.execute_update(query, values)
    
    def update(self, api_id: int, data: Dict[str, Any]) -> bool:
        """更新 API 權限"""
        update_fields = []
        values = []
        
        updatable_columns = ['api_pattern', 'method', 'permission_matrix_id', 'permission_code',
                           'module_key', 'description', 'require_auth', 'priority', 'is_active', 'updated_by']
        
        for col in updatable_columns:
            if col in data:
                update_fields.append(f"{col} = %s")
                values.append(data[col])
        
        if not update_fields:
            return False
        
        values.append(api_id)
        update_str = ', '.join(update_fields)
        
        query = f"""
            UPDATE {self.table_name}
            SET {update_str}
            WHERE id = %s
        """
        
        rows_affected = self.execute_update(query, values)
        return rows_affected > 0
    
    def delete(self, api_id: int) -> bool:
        """刪除 API 權限"""
        query = f"DELETE FROM {self.table_name} WHERE id = %s"
        rows_affected = self.execute_update(query, (api_id,))
        return rows_affected > 0
    
    def check_permission(self, user_id: int, api: str, method: str) -> Dict[str, Any]:
        """檢查使用者對 API 的存取權限"""
        query = """
            CALL check_api_permission(%s, %s, %s)
        """
        result = self.execute_query(query, (user_id, api, method))
        if result:
            return {
                'has_permission': result[0].get('has_permission', False),
                'reason': result[0].get('reason', 'Unknown')
            }
        return {'has_permission': False, 'reason': 'No permission found'}


class PermissionActionDAO(BaseDAO):
    """動作權限 DAO"""
    
    def __init__(self):
        super().__init__(db_manager)
        self.table_name = "permission_actions"
    
    def get_all(self, module_key: Optional[str] = None, is_active: Optional[bool] = None) -> List[Dict[str, Any]]:
        """取得所有動作權限設定"""
        query = f"""
            SELECT * FROM {self.table_name}
            WHERE 1=1
        """
        params = []
        
        if module_key:
            query += " AND module_key = %s"
            params.append(module_key)
            
        if is_active is not None:
            query += " AND is_active = %s"
            params.append(is_active)
            
        query += " ORDER BY module_key, action_key"
        
        results = self.execute_query(query, params)
        
        # 解析 JSON 欄位
        for item in results:
            if item.get('dependencies'):
                try:
                    item['dependencies'] = json.loads(item['dependencies'])
                except:
                    item['dependencies'] = []
        
        return results
    
    def get_by_id(self, action_id: int) -> Optional[Dict[str, Any]]:
        """根據 ID 取得動作權限"""
        query = f"SELECT * FROM {self.table_name} WHERE id = %s"
        result = self.execute_query(query, (action_id,))
        
        if result:
            item = result[0]
            if item.get('dependencies'):
                try:
                    item['dependencies'] = json.loads(item['dependencies'])
                except:
                    item['dependencies'] = []
            return item
        return None
    
    def create(self, data: Dict[str, Any]) -> int:
        """建立動作權限"""
        # 處理 dependencies JSON 欄位
        if 'dependencies' in data and isinstance(data['dependencies'], (list, dict)):
            data['dependencies'] = json.dumps(data['dependencies'])
        
        columns = ['module_key', 'action_key', 'permission_code', 'name',
                  'description', 'dependencies', 'is_active', 'created_by']
        values = []
        placeholders = []
        
        for col in columns:
            if col in data:
                values.append(data[col])
                placeholders.append('%s')
        
        used_columns = columns[:len(values)]
        column_str = ', '.join(used_columns)
        value_str = ', '.join(placeholders)
        
        query = f"""
            INSERT INTO {self.table_name} ({column_str})
            VALUES ({value_str})
        """
        
        return self.execute_update(query, values)
    
    def update(self, action_id: int, data: Dict[str, Any]) -> bool:
        """更新動作權限"""
        # 處理 dependencies JSON 欄位
        if 'dependencies' in data and isinstance(data['dependencies'], (list, dict)):
            data['dependencies'] = json.dumps(data['dependencies'])
        
        update_fields = []
        values = []
        
        updatable_columns = ['module_key', 'action_key', 'permission_code', 'name',
                           'description', 'dependencies', 'is_active', 'updated_by']
        
        for col in updatable_columns:
            if col in data:
                update_fields.append(f"{col} = %s")
                values.append(data[col])
        
        if not update_fields:
            return False
        
        values.append(action_id)
        update_str = ', '.join(update_fields)
        
        query = f"""
            UPDATE {self.table_name}
            SET {update_str}
            WHERE id = %s
        """
        
        rows_affected = self.execute_update(query, values)
        return rows_affected > 0
    
    def delete(self, action_id: int) -> bool:
        """刪除動作權限"""
        query = f"DELETE FROM {self.table_name} WHERE id = %s"
        rows_affected = self.execute_update(query, (action_id,))
        return rows_affected > 0


class PermissionCacheDAO(BaseDAO):
    """權限快取 DAO"""
    
    def __init__(self):
        super().__init__(db_manager)
        self.table_name = "permission_cache"
    
    def get_cache_info(self) -> Dict[str, Any]:
        """取得快取統計資訊"""
        query = """
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN expire_time IS NULL OR expire_time > NOW() THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN expire_time IS NOT NULL AND expire_time <= NOW() THEN 1 ELSE 0 END) as expired
            FROM permission_cache
        """
        result = self.execute_query(query)
        
        if result:
            return {
                'total': result[0].get('total', 0),
                'active': result[0].get('active', 0),
                'expired': result[0].get('expired', 0),
                'hit_rate': 0.0  # 需要另外計算
            }
        return {'total': 0, 'active': 0, 'expired': 0, 'hit_rate': 0.0}
    
    def get_user_cache(self, user_id: int) -> Optional[Dict[str, Any]]:
        """取得使用者的權限快取"""
        query = f"""
            SELECT * FROM {self.table_name}
            WHERE user_id = %s
              AND (expire_time IS NULL OR expire_time > NOW())
        """
        result = self.execute_query(query, (user_id,))
        
        if result:
            item = result[0]
            # 解析 JSON 欄位
            for field in ['group_ids', 'permissions', 'urls', 'apis']:
                if item.get(field):
                    try:
                        item[field] = json.loads(item[field])
                    except:
                        item[field] = []
            return item
        return None
    
    def set_user_cache(self, user_id: int, cache_data: Dict[str, Any]) -> bool:
        """設定使用者的權限快取"""
        # 處理 JSON 欄位
        for field in ['group_ids', 'permissions', 'urls', 'apis']:
            if field in cache_data and isinstance(cache_data[field], (list, dict)):
                cache_data[field] = json.dumps(cache_data[field])
        
        # 先嘗試更新，如果不存在則插入
        query = """
            INSERT INTO permission_cache (user_id, group_ids, permissions, urls, apis, expire_time)
            VALUES (%s, %s, %s, %s, %s, DATE_ADD(NOW(), INTERVAL 1 HOUR))
            ON DUPLICATE KEY UPDATE
                group_ids = VALUES(group_ids),
                permissions = VALUES(permissions),
                urls = VALUES(urls),
                apis = VALUES(apis),
                cache_time = NOW(),
                expire_time = VALUES(expire_time)
        """
        
        values = (
            user_id,
            cache_data.get('group_ids', '[]'),
            cache_data.get('permissions', '[]'),
            cache_data.get('urls', '[]'),
            cache_data.get('apis', '[]')
        )
        
        rows_affected = self.execute_update(query, values)
        return rows_affected > 0
    
    def clear_user_cache(self, user_id: int) -> bool:
        """清除使用者的權限快取"""
        query = f"DELETE FROM {self.table_name} WHERE user_id = %s"
        rows_affected = self.execute_update(query, (user_id,))
        return rows_affected > 0
    
    def clear_all_cache(self) -> int:
        """清除所有權限快取"""
        query = f"DELETE FROM {self.table_name}"
        return self.execute_update(query)
    
    def clear_expired_cache(self) -> int:
        """清除過期的權限快取"""
        query = f"""
            DELETE FROM {self.table_name}
            WHERE expire_time IS NOT NULL AND expire_time <= NOW()
        """
        return self.execute_update(query)
    
    def refresh_cache(self, user_id: Optional[int] = None) -> bool:
        """重新整理權限快取"""
        if user_id:
            # 重新整理特定使用者的快取
            return self.clear_user_cache(user_id)
        else:
            # 重新整理所有快取
            self.clear_all_cache()
            return True


# 建立 DAO 實例
permission_url_dao = PermissionUrlDAO()
permission_api_dao = PermissionApiDAO()
permission_action_dao = PermissionActionDAO()
permission_cache_dao = PermissionCacheDAO()