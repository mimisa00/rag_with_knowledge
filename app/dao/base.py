import os
import pymysql
from dbutils.pooled_db import PooledDB
from typing import Dict, List, Optional, Any
import traceback
from app.utils.logging import get_logger

logger = get_logger(__name__)


class DatabaseManager:
    def __init__(self):
        self.connection_pool = None

    def _init_pool(self):
        """初始化資料庫連線池"""
        try:
            self.host = os.getenv("DB_HOST")
            self.port = int(os.getenv("DB_PORT"))
            self.database = os.getenv("DB_NAME")
            self.user = os.getenv("DB_USER")
            self.password = os.getenv("DB_PASSWORD")

            self.connection_pool = PooledDB(
                creator=pymysql,
                maxconnections=10,
                mincached=2,
                maxcached=5,
                blocking=True,
                host=self.host,
                port=self.port,
                user=self.user,
                password=self.password,
                database=self.database,
                charset="utf8mb4",
                cursorclass=pymysql.cursors.DictCursor,
                autocommit=True,
            )
            logger.info("資料庫連線池初始化成功")
        except Exception as e:
            logger.error(f"資料庫連線池初始化失敗: {e}")
            raise

    def get_connection(self):
        """從連線池中獲取資料庫連線"""
        try:
            if self.connection_pool is None:
                self._init_pool()
            connection = self.connection_pool.connection()
            return connection
        except Exception as e:
            logger.error(f"取得資料庫連線失敗: {e}")
            raise

    def _is_connection_alive(self):
        """檢查資料庫連線是否有效"""
        try:
            with self.connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            return True
        except:
            return False

    def close(self):
        """關閉資料庫連線池"""
        if self.connection_pool:
            self.connection_pool.close()
            logger.info("資料庫連線池已關閉")

    def close_connection(self, connection):
        """手動關閉資料庫連線"""
        if connection:
            connection.close()
            logger.info("資料庫連線已關閉")


class BaseDAO:
    """基礎 DAO 類別"""
    
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager

    def execute_query(self, query: str, params: tuple = None) -> List[Dict[str, Any]]:
        """執行查詢並回傳結果"""
        try:
            connection = self.db_manager.get_connection()
            with connection.cursor() as cursor:
                if params:
                    cursor.execute(query, params)
                else:
                    cursor.execute(query)
                results = cursor.fetchall()
            return results if results else []
        except Exception as e:
            logger.error(f"執行查詢失敗: {e}")
            return []

    def execute_update(self, query: str, params: tuple = None) -> int:
        """執行更新操作，回傳受影響的行數"""
        connection = None
        try:
            connection = self.db_manager.get_connection()
            with connection.cursor() as cursor:
                if params:
                    cursor.execute(query, params)
                else:
                    cursor.execute(query)
                affected_rows = cursor.rowcount
            connection.commit()
            logger.debug(f"更新操作完成，影響行數: {affected_rows}")
            return affected_rows
        except Exception as e:
            if connection:
                connection.rollback()
            logger.error(f"執行更新失敗: {e}")
            return -1

    def execute_insert(self, query: str, params: tuple = None) -> int:
        """執行插入操作並回傳插入的 ID"""
        try:
            connection = self.db_manager.get_connection()
            with connection.cursor() as cursor:
                if params:
                    cursor.execute(query, params)
                else:
                    cursor.execute(query)
                insert_id = cursor.lastrowid
            connection.commit()
            return insert_id
        except Exception as e:
            if connection:
                connection.rollback()
            logger.error(f"執行插入失敗: {e}")
            return -1


# 全域資料庫管理器
db_manager = DatabaseManager()