from typing import Dict, List, Optional, Any
import traceback
from app.dao.base import BaseDAO, db_manager
from app.utils.logging import get_logger

logger = get_logger(__name__)


class LLMRequestDAO(BaseDAO):
    def __init__(self, db_manager_instance=None):
        super().__init__(db_manager_instance or db_manager)

    def get_user_active_request_count(self, user_id: int) -> int:
        """取得用戶目前進行中的請求數 (status = 'pending')"""
        try:
            query = "SELECT COUNT(*) FROM llm_requests WHERE user_id = %s AND status = 'pending'"
            results = self.execute_query(query, (user_id,))
            logger.info(f"查詢結果: {results}, 類型: {type(results)}")
            return results[0].get("COUNT(*)", 0) if results else 0
        except Exception as e:
            logger.error(f"取得用戶 {user_id} 進行中請求數失敗: {e}")
            logger.error(f"異常類型: {type(e)}")
            logger.error(f"異常訊息: {str(e)}")
            logger.error(f"異常追蹤: {traceback.print_exc()}")
            return 0

    def add_user_request(self, user_id: int, conv_id: str, question: str) -> int:
        """新增一筆用戶請求，預設 status = 'pending'，回傳 request_id"""
        try:
            query = """
                INSERT INTO llm_requests (user_id, conv_id, question, status)
                VALUES (%s, %s, %s, 'pending')
            """
            return self.execute_insert(query, (user_id, conv_id, question))
        except Exception as e:
            logger.error(f"新增用戶 {user_id} 請求失敗: {e}")
            return -1

    def mark_request_completed(self, request_id: int, response_time: float = None, error_message: str = None):
        """將請求標記為 completed，並可選擇記錄 response_time 與 error_message"""
        try:
            query = "UPDATE llm_requests SET status = 'completed', updated_at = NOW(), response_time = %s, error_message = %s WHERE id = %s"
            params = (
                response_time if response_time is not None else None,
                error_message if error_message is not None else None,
                request_id,
            )
            self.execute_update(query, params)
        except Exception as e:
            logger.error(f"標記請求 {request_id} 完成失敗: {e}")

    def has_user_active_request(self, user_id: int) -> bool:
        """檢查用戶是否有進行中的請求 (status = 'pending')"""
        try:
            query = "SELECT 1 FROM llm_requests WHERE user_id = %s AND status = 'pending' LIMIT 1"
            results = self.execute_query(query, (user_id,))
            return len(results) > 0
        except Exception as e:
            logger.error(f"檢查用戶 {user_id} 是否有進行中請求失敗: {e}")
            return False

    def get_total_active_request_count(self) -> int:
        """取得全系統目前進行中的請求數 (status = 'pending')"""
        try:
            query = "SELECT COUNT(*) FROM llm_requests WHERE status = 'pending'"
            results = self.execute_query(query)
            logger.info(f"查詢結果: {results}, 類型: {type(results)}")
            return results[0].get("COUNT(*)", 0) if results else 0
        except Exception as e:
            logger.error(f"取得全系統進行中請求數失敗: {str(e)}")
            logger.error(f"異常類型: {type(e)}")
            logger.error(f"異常訊息: {str(e)}")
            logger.error(f"異常追蹤: {traceback.print_exc()}")
            return 0


# 建立實例
llm_request_dao = LLMRequestDAO()