from typing import Dict, List, Optional, Any
from app.dao.base import BaseDAO, db_manager
from app.utils.logging import get_logger

logger = get_logger(__name__)


class UserDAO(BaseDAO):
    def __init__(self, db_manager_instance=None):
        super().__init__(db_manager_instance or db_manager)

    def get_user_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        """根據使用者名稱取得使用者資訊"""
        try:
            query = "SELECT * FROM users WHERE username = %s"
            results = self.execute_query(query, (username,))
            return results[0] if results else None
        except Exception as e:
            logger.error(f"取得使用者資訊失敗: {e}")
            return None

    def get_user_by_id(self, user_id: int) -> Optional[Dict[str, Any]]:
        """根據使用者ID取得使用者資訊"""
        try:
            query = "SELECT * FROM users WHERE id = %s AND is_active = 1"
            results = self.execute_query(query, (user_id,))
            return results[0] if results else None
        except Exception as e:
            logger.error(f"取得使用者資訊失敗: {e}")
            return None

    def get_all_users(self) -> List[Dict[str, Any]]:
        """獲取所有用戶（管理員功能）"""
        try:
            query = "SELECT id, username, role, is_active, created_at FROM users ORDER BY created_at DESC"
            return self.execute_query(query)
        except Exception as e:
            logger.error(f"取得所有用戶失敗: {e}")
            return []

    def create_user(self, username: str, password_hash: str, role: str) -> int:
        """創建新用戶"""
        try:
            query = "INSERT INTO users (username, password_hash, role) VALUES (%s, %s, %s)"
            return self.execute_insert(query, (username, password_hash, role))
        except Exception as e:
            logger.error(f"創建用戶失敗: {e}")
            return -1

    def update_user_role(self, user_id: int, role: str) -> bool:
        """更新用戶角色"""
        try:
            query = "UPDATE users SET role = %s WHERE id = %s"
            return self.execute_update(query, (role, user_id))
        except Exception as e:
            logger.error(f"更新用戶角色失敗: {e}")
            return False

    def deactivate_user(self, user_id: int) -> bool:
        """停用用戶"""
        try:
            query = "UPDATE users SET is_active = FALSE WHERE id = %s"
            return self.execute_update(query, (user_id,))
        except Exception as e:
            logger.error(f"停用用戶失敗: {e}")
            return False

    def activate_user(self, user_id: int) -> bool:
        """啟用用戶"""
        try:
            query = "UPDATE users SET is_active = TRUE WHERE id = %s"
            return self.execute_update(query, (user_id,))
        except Exception as e:
            logger.error(f"啟用用戶失敗: {e}")
            return False
            
    def update_user_password(self, user_id: int, password_hash: str) -> bool:
        """更新用戶密碼"""
        try:
            query = "UPDATE users SET password_hash = %s WHERE id = %s"
            return self.execute_update(query, (password_hash, user_id))
        except Exception as e:
            logger.error(f"更新用戶密碼失敗: {e}")
            return False


# 建立實例
user_dao = UserDAO()