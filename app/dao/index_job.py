from typing import Dict, List, Optional, Any
from app.dao.base import BaseDAO, db_manager
from app.utils.logging import get_logger

logger = get_logger(__name__)


class IndexJobDAO(BaseDAO):
    def __init__(self, db_manager_instance=None):
        super().__init__(db_manager_instance or db_manager)

    def create_index_job(self, kb_id: str, job_type: str, total_files: int = 0) -> int:
        """創建索引任務"""
        try:
            query = """
                INSERT INTO index_jobs (kb_id, job_type, status, total_files)
                VALUES (%s, %s, 'pending', %s)
            """
            job_id = self.execute_insert(query, (kb_id, job_type, total_files))
            if job_id > 0:
                logger.info(f"索引任務 {job_id} 建立成功")
            return job_id
        except Exception as e:
            logger.error(f"建立索引任務失敗: {e}")
            return -1

    def update_job_status(self, job_id: int, status: str, progress: int = None, 
                         processed_files: int = None, error_message: str = None) -> bool:
        """更新索引任務狀態"""
        try:
            updates = ["status = %s", "updated_at = NOW()"]
            params = [status]
            
            if progress is not None:
                updates.append("progress = %s")
                params.append(progress)
            if processed_files is not None:
                updates.append("processed_files = %s")
                params.append(processed_files)
            if error_message is not None:
                updates.append("error_message = %s")
                params.append(error_message)
            
            params.append(job_id)
            query = f"UPDATE index_jobs SET {', '.join(updates)} WHERE id = %s"
            return self.execute_update(query, tuple(params))
        except Exception as e:
            logger.error(f"更新索引任務 {job_id} 狀態失敗: {e}")
            return False

    def get_job_status(self, job_id: int) -> Optional[Dict[str, Any]]:
        """獲取索引任務狀態"""
        try:
            query = """
                SELECT id, kb_id, job_type, status, progress, total_files, 
                       processed_files, error_message, created_at, updated_at
                FROM index_jobs WHERE id = %s
            """
            results = self.execute_query(query, (job_id,))
            return results[0] if results else None
        except Exception as e:
            logger.error(f"獲取索引任務 {job_id} 狀態失敗: {e}")
            return None

    def get_running_jobs(self, kb_id: str = None) -> List[Dict[str, Any]]:
        """獲取正在運行的索引任務"""
        try:
            if kb_id:
                query = """
                    SELECT id, kb_id, job_type, status, progress, total_files, 
                           processed_files, error_message, created_at, updated_at
                    FROM index_jobs 
                    WHERE kb_id = %s AND status IN ('pending', 'running')
                    ORDER BY created_at DESC
                """
                return self.execute_query(query, (kb_id,))
            else:
                query = """
                    SELECT id, kb_id, job_type, status, progress, total_files, 
                           processed_files, error_message, created_at, updated_at
                    FROM index_jobs 
                    WHERE status IN ('pending', 'running')
                    ORDER BY created_at DESC
                """
                return self.execute_query(query)
        except Exception as e:
            logger.error(f"獲取運行中索引任務失敗: {e}")
            return []


# 建立實例
index_job_dao = IndexJobDAO()