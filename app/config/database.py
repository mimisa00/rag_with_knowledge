"""
資料庫配置模組
"""
import os
from typing import Dict, Any
from app.utils.logging import get_logger

logger = get_logger(__name__)


class DatabaseConfig:
    """資料庫配置類別"""
    
    @staticmethod
    def get_connection_config() -> Dict[str, Any]:
        """獲取資料庫連線配置"""
        db_port = os.getenv("DB_PORT", "3306")
        try:
            port = int(db_port) if db_port else 3306
        except (ValueError, TypeError):
            port = 3306
            
        return {
            "host": os.getenv("DB_HOST", "localhost"),
            "port": port,
            "user": os.getenv("DB_USER", "root"),
            "password": os.getenv("DB_PASSWORD", ""),
            "database": os.getenv("DB_NAME", "rag_db"),
            "charset": "utf8mb4",
            "autocommit": True,
        }
    
    @staticmethod
    def get_pool_config() -> Dict[str, Any]:
        """獲取連線池配置"""
        return {
            "maxconnections": 10,
            "mincached": 2,
            "maxcached": 5,
            "blocking": True,
        }


# 配置實例
database_config = DatabaseConfig()