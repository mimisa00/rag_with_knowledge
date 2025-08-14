"""
應用程式配置管理模組
"""
import os
from typing import Dict, Any
from app.dao.config import config_dao
from app.utils.logging import get_logger

logger = get_logger(__name__)


class AppConfig:
    """應用程式配置管理類別"""
    
    def __init__(self):
        self._config_cache: Dict[str, Any] = {}
        self._load_config()
    
    def _load_config(self):
        """從資料庫載入配置"""
        try:
            self._config_cache = config_dao.get_all_configs()
            logger.info("配置已從資料庫載入")
        except Exception as e:
            logger.error(f"載入配置失敗: {e}")
            self._config_cache = {}
    
    def get(self, key: str, default: Any = None) -> Any:
        """獲取配置值"""
        return self._config_cache.get(key, default)
    
    def get_int(self, key: str, default: int = 0) -> int:
        """獲取整數配置值"""
        value = self.get(key, default)
        try:
            return int(value)
        except (ValueError, TypeError):
            return default
    
    def get_float(self, key: str, default: float = 0.0) -> float:
        """獲取浮點數配置值"""
        value = self.get(key, default)
        try:
            return float(value)
        except (ValueError, TypeError):
            return default
    
    def get_bool(self, key: str, default: bool = False) -> bool:
        """獲取布林配置值"""
        value = self.get(key, default)
        if isinstance(value, str):
            return value.lower() == "true"
        return bool(value)
    
    def update(self, config_data: Dict[str, Any]):
        """更新配置"""
        try:
            self._config_cache.update(config_data)
            config_dao.update_configs(config_data)
            logger.info("配置已更新")
        except Exception as e:
            logger.error(f"更新配置失敗: {e}")
            raise
    
    def reload(self):
        """重新載入配置"""
        self._load_config()
    
    @property
    def all(self) -> Dict[str, Any]:
        """獲取所有配置"""
        return self._config_cache.copy()


# 全域配置實例
app_config = AppConfig()