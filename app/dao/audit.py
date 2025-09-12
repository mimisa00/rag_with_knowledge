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
            
            changes_json = json.dumps(audit_log.changes, default=str) if audit_log.changes else None
            
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
audit_log_dao = AuditLogDAO()