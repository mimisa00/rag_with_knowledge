from typing import Dict, List, Optional, Any
import json
from app.dao.base import BaseDAO, db_manager
from app.utils.logging import get_logger

logger = get_logger(__name__)


class ConversationDAO(BaseDAO):
    def __init__(self, db_manager_instance=None):
        super().__init__(db_manager_instance or db_manager)

    def store_conversation(self, conv_id: str, question: str, answer: str, user_id: int, sources: Optional[List[str]] = None) -> bool:
        """儲存對話記錄"""
        try:
            sources_json = json.dumps(sources) if sources else None
            query = """
            INSERT INTO conversations (conv_id, user_id, question, answer, sources) 
            VALUES (%s, %s, %s, %s, %s)
            """
            return self.execute_insert(query, (conv_id, user_id, question, answer, sources_json)) > 0
        except Exception as e:
            logger.error(f"儲存對話記錄失敗: {e}")
            return False

    def get_conversations_by_conv_id(self, conv_id: str) -> List[Dict[str, Any]]:
        """根據對話ID取得對話記錄"""
        try:
            query = """
            SELECT id, conv_id, user_id, question, answer, sources, created_at 
            FROM conversations 
            WHERE conv_id = %s 
            ORDER BY created_at ASC
            """
            results = self.execute_query(query, (conv_id,))
            # 解析 sources JSON 
            for result in results:
                if result.get('sources'):
                    try:
                        result['sources'] = json.loads(result['sources'])
                    except json.JSONDecodeError:
                        result['sources'] = []
                else:
                    result['sources'] = []
            return results
        except Exception as e:
            logger.error(f"取得對話記錄失敗: {e}")
            return []

    def list_all_conversations(self, user_id: int) -> List[Dict[str, Any]]:
        """列出所有對話（可選按使用者篩選）"""
        try:
            if user_id is not None:
                query = """
                    SELECT DISTINCT conv_id, 
                           MIN(created_at) as first_message_time,
                           MAX(created_at) as last_message_time,
                           COUNT(*) as message_count
                    FROM conversations 
                    WHERE user_id = %s 
                    GROUP BY conv_id 
                    ORDER BY last_message_time DESC
                """
                results = self.execute_query(query, (user_id,))
            else:
                query = """
                    SELECT DISTINCT conv_id, 
                           MIN(created_at) as first_message_time,
                           MAX(created_at) as last_message_time,
                           COUNT(*) as message_count
                    FROM conversations 
                    GROUP BY conv_id 
                    ORDER BY last_message_time DESC
                """
                results = self.execute_query(query)

            # 為每個對話取得第一條訊息作為標題
            conversations = []
            for row in results:
                conv_id = row["conv_id"]
                first_message = self.get_conversations_by_conv_id(conv_id)
                title = (
                    first_message[0]["question"][:10]
                    if first_message
                    else "New Conversation"
                )

                conversations.append(
                    {
                        "id": conv_id,
                        "title": title,
                        "first_message_time": row["first_message_time"],
                        "last_message_time": row["last_message_time"],
                        "message_count": row["message_count"],
                    }
                )

            return conversations
        except Exception as e:
            logger.error(f"列出對話失敗: {e}")
            return []

    def delete_conversation(self, conv_id: str, user_id: int) -> bool:
        """刪除對話記錄"""
        try:
            if user_id is not None:
                query = "DELETE FROM conversations WHERE conv_id = %s AND user_id = %s"
                return self.execute_update(query, (conv_id, user_id))
            else:
                query = "DELETE FROM conversations WHERE conv_id = %s"
                return self.execute_update(query, (conv_id,))
        except Exception as e:
            logger.error(f"刪除對話記錄失敗: {e}")
            return False


# 建立實例
conversation_dao = ConversationDAO()