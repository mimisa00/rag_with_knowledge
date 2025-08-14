from typing import Dict, Optional, Any
from app.dao.base import BaseDAO, db_manager
from app.utils.logging import get_logger

logger = get_logger(__name__)


class ConfigDAO(BaseDAO):
    def __init__(self, db_manager_instance=None):
        super().__init__(db_manager_instance or db_manager)

    def get_all_configs(self) -> Dict[str, Any]:
        """取得所有配置"""
        try:
            query = "SELECT `key`, value FROM configs"
            results = self.execute_query(query)
            
            configs = {}
            for row in results:
                configs[row["key"]] = row["value"]
            
            return configs
        except Exception as e:
            logger.error(f"取得配置失敗: {e}")
            return {}

    def get_config_by_key(self, key: str) -> Optional[str]:
        """根據鍵名取得配置值"""
        try:
            query = "SELECT value FROM configs WHERE `key` = %s"
            results = self.execute_query(query, (key,))
            return results[0]['value'] if results else None
        except Exception as e:
            logger.error(f"取得配置 {key} 失敗: {e}")
            return None

    def update_config(self, key: str, value: str) -> bool:
        """更新配置"""
        try:
            query = """
                INSERT INTO configs (`key`, value) 
                VALUES (%s, %s) 
                ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = CURRENT_TIMESTAMP
            """
            return self.execute_update(query, (key, value))
        except Exception as e:
            logger.error(f"更新配置 {key} 失敗: {e}")
            return False

    def update_configs(self, configs: Dict[str, Any]) -> bool:
        """批次更新配置"""
        try:
            for key, value in configs.items():
                query = """
                    INSERT INTO configs (`key`, value) 
                    VALUES (%s, %s) 
                    ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = CURRENT_TIMESTAMP
                """
                if not self.execute_update(query, (key, str(value))):
                    return False
            return True
        except Exception as e:
            logger.error(f"批次更新配置失敗: {e}")
            return False


# 建立實例
config_dao = ConfigDAO()