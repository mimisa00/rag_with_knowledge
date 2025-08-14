from typing import Dict, List, Optional, Any
from app.dao.base import BaseDAO, db_manager
from app.dao.config import config_dao
from app.utils.logging import get_logger

logger = get_logger(__name__)


class KnowledgeBaseDAO(BaseDAO):
    def __init__(self, db_manager_instance=None):
        super().__init__(db_manager_instance or db_manager)

    def create_knowledge_base(self, kb_id: str, name: str, system_prompt: str = "", note: str = "") -> bool:
        """創建知識庫"""
        try:
            # 如果沒有提供 system_prompt，從資料庫配置中取得預設值
            if not system_prompt:
                default_prompt = config_dao.get_config_by_key("system_prompt")
                if default_prompt:
                    system_prompt = default_prompt
                    logger.info(f"使用資料庫預設的 system_prompt")
            
            query = """
                INSERT INTO knowledge_bases (id, name, system_prompt, note, status)
                VALUES (%s, %s, %s, %s, 'enable')
            """
            # 因為 id 是自定義的字符串，不是自增長，所以不能用 execute_insert 的返回值判斷
            # 改用 execute_update，它會返回 True/False
            success = self.execute_update(query, (kb_id, name, system_prompt, note))
            if success:
                logger.info(f"知識庫 {kb_id} 建立成功")
                return True
            return False
        except Exception as e:
            logger.error(f"建立知識庫 {kb_id} 失敗: {e}")
            return False

    def check_kb_id_exists(self, kb_id: str) -> bool:
        """檢查知識庫 ID 是否已存在（包含已刪除的）"""
        try:
            query = "SELECT 1 FROM knowledge_bases WHERE id = %s LIMIT 1"
            results = self.execute_query(query, (kb_id,))
            return len(results) > 0
        except Exception as e:
            logger.error(f"檢查知識庫 ID {kb_id} 是否存在失敗: {e}")
            return True  # 出錯時保守返回 True 避免重複創建

    def get_knowledge_bases(self, include_deleted: bool = False) -> List[Dict[str, Any]]:
        """獲取知識庫列表"""
        try:
            if include_deleted:
                query = """
                    SELECT id, name, status, system_prompt, note, created_at, updated_at
                    FROM knowledge_bases
                    ORDER BY created_at DESC
                """
                return self.execute_query(query)
            else:
                query = """
                    SELECT id, name, status, system_prompt, note, created_at, updated_at
                    FROM knowledge_bases
                    WHERE status != 'deleted'
                    ORDER BY created_at DESC
                """
                return self.execute_query(query)
        except Exception as e:
            logger.error(f"獲取知識庫列表失敗: {e}")
            return []

    def get_knowledge_base(self, kb_id: str) -> Optional[Dict[str, Any]]:
        """獲取單個知識庫詳情"""
        try:
            query = """
                SELECT id, name, status, system_prompt, note, created_at, updated_at
                FROM knowledge_bases
                WHERE id = %s AND status != 'deleted'
            """
            results = self.execute_query(query, (kb_id,))
            return results[0] if results else None
        except Exception as e:
            logger.error(f"獲取知識庫 {kb_id} 詳情失敗: {e}")
            return None

    def update_knowledge_base(self, kb_id: str, name: str = None, status: str = None, 
                            system_prompt: str = None, note: str = None) -> bool:
        """更新知識庫"""
        try:
            updates = []
            params = []
            
            if name is not None:
                updates.append("name = %s")
                params.append(name)
            if status is not None:
                updates.append("status = %s")
                params.append(status)
            if system_prompt is not None:
                updates.append("system_prompt = %s")
                params.append(system_prompt)
            if note is not None:
                updates.append("note = %s")
                params.append(note)
            
            if not updates:
                return True
            
            updates.append("updated_at = NOW()")
            params.append(kb_id)
            
            query = f"UPDATE knowledge_bases SET {', '.join(updates)} WHERE id = %s AND status != 'deleted'"
            success = self.execute_update(query, tuple(params))
            if success:
                logger.info(f"知識庫 {kb_id} 更新成功")
            return success
        except Exception as e:
            logger.error(f"更新知識庫 {kb_id} 失敗: {e}")
            return False

    def delete_knowledge_base(self, kb_id: str, logical_delete: bool = True) -> bool:
        """刪除知識庫（邏輯刪除或物理刪除）"""
        try:
            if logical_delete:
                query = "UPDATE knowledge_bases SET status = 'deleted', updated_at = NOW() WHERE id = %s"
            else:
                query = "DELETE FROM knowledge_bases WHERE id = %s"
            
            success = self.execute_update(query, (kb_id,))
            if success:
                logger.info(f"知識庫 {kb_id} 刪除成功 ({'邏輯' if logical_delete else '物理'})")
            return success
        except Exception as e:
            logger.error(f"刪除知識庫 {kb_id} 失敗: {e}")
            return False


# 建立實例
knowledge_base_dao = KnowledgeBaseDAO()