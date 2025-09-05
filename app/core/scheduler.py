"""
排程任務系統模組
處理使用者帳號的排程啟用和停用功能
"""

import os
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from app.dao.organization import UserOrganizationDAO
from app.dao.user import UserDAO


logger = logging.getLogger(__name__)


class AccountScheduler:
    """帳號排程管理器"""
    
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.is_running = False
        self.enabled = self._get_scheduler_enabled()
        self.check_interval = self._get_check_interval()
        self.user_org_dao = UserOrganizationDAO()
        self.user_dao = UserDAO()
    
    def _get_scheduler_enabled(self) -> bool:
        """從環境變數讀取排程器啟用狀態"""
        return os.getenv("SCHEDULER_ENABLED", "true").lower() in ("true", "1", "yes")
    
    def _get_check_interval(self) -> int:
        """從環境變數讀取檢查間隔時間（分鐘）"""
        try:
            return int(os.getenv("SCHEDULER_CHECK_INTERVAL", "1"))
        except ValueError:
            logger.warning("SCHEDULER_CHECK_INTERVAL 環境變數格式錯誤，使用預設值 1 分鐘")
            return 1
    
    def start(self):
        """啟動排程器"""
        if not self.enabled:
            logger.info("排程系統已透過環境變數停用 (SCHEDULER_ENABLED=false)")
            return
            
        if not self.is_running:
            # 根據環境變數設定檢查間隔
            self.scheduler.add_job(
                self.check_account_expiration,
                trigger=IntervalTrigger(minutes=self.check_interval),
                id='account_expiration_check',
                name='檢查帳號過期狀態',
                replace_existing=True
            )
            
            self.scheduler.start()
            self.is_running = True
            logger.info(f"帳號排程器已啟動，檢查間隔: {self.check_interval} 分鐘")
    
    def stop(self):
        """停止排程器"""
        if not self.enabled:
            logger.info("排程系統未啟用，無需停止")
            return
            
        if self.is_running:
            self.scheduler.shutdown()
            self.is_running = False
            logger.info("帳號排程器已停止")
    
    async def check_account_expiration(self):
        """檢查帳號過期狀態並執行相應操作"""
        try:
            current_time = datetime.now(timezone.utc)
            logger.debug(f"開始檢查帳號過期狀態 - 當前時間: {current_time}")
            
            # 檢查需要停用的帳號
            await self._process_deactivation_schedules(current_time)
            
            # 檢查需要啟用的帳號
            await self._process_activation_schedules(current_time)
            
        except Exception as e:
            logger.error(f"檢查帳號過期狀態時發生錯誤: {e}")
    
    async def _process_deactivation_schedules(self, current_time: datetime):
        """處理排程停用"""
        try:
            # 查詢需要停用的帳號
            query = """
                SELECT ue.user_id, u.loginid, u.username, u.is_active, ue.activation_expires
                FROM user_extensions ue
                JOIN users u ON ue.user_id = u.id
                WHERE ue.activation_expires IS NOT NULL
                  AND ue.activation_expires >= %s
                  AND u.is_active = 1
            """
            
            results = self.user_org_dao.execute_query(query, (current_time,))
            
            if results:
                logger.info(f"找到 {len(results)} 個需要停用的帳號")
                
                for user_data in results:
                    await self._deactivate_user(user_data, current_time)
            
        except Exception as e:
            logger.error(f"處理排程停用時發生錯誤: {e}")
    
    async def _process_activation_schedules(self, current_time: datetime):
        """處理排程啟用"""
        try:
            # 查詢需要啟用的帳號
            query = """
                SELECT ue.user_id, u.loginid, u.username, u.is_active, ue.activation_scheduled
                FROM user_extensions ue
                JOIN users u ON ue.user_id = u.id
                WHERE ue.activation_scheduled IS NOT NULL
                  AND ue.activation_scheduled >= %s
                  AND u.is_active = 0
            """
            
            results = self.user_org_dao.execute_query(query, (current_time,))
            
            if results:
                logger.info(f"找到 {len(results)} 個需要啟用的帳號")
                
                for user_data in results:
                    await self._activate_user(user_data, current_time)
            
        except Exception as e:
            logger.error(f"處理排程啟用時發生錯誤: {e}")
    
    async def _deactivate_user(self, user_data: Dict[str, Any], current_time: datetime):
        """執行使用者停用"""
        try:
            user_id = user_data['user_id']
            loginid = user_data['loginid']
            username = user_data['username']
            
            # 更新使用者狀態為停用
            success = self.user_dao.update_user_status(user_id, False)
            
            if success:
                # 清除 activation_expires 欄位（表示已處理）
                update_query = """
                    UPDATE user_extensions 
                    SET activation_expires = NULL 
                    WHERE user_id = %s
                """
                self.user_org_dao.execute_update(update_query, (user_id,))
                
                logger.info(f"已自動停用使用者: {loginid} ({username}) - 過期時間: {user_data['activation_expires']}")
                
                # 記錄審計日誌
                await self._log_audit_event(
                    user_id=None,  # 系統自動操作
                    action="AUTO_DEACTIVATE",
                    target_type="user",
                    target_id=str(user_id),
                    changes={
                        "is_active": False,
                        "reason": "scheduled_deactivation",
                        "expires_at": user_data['activation_expires'].isoformat() if user_data['activation_expires'] else None,
                        "processed_at": current_time.isoformat()
                    }
                )
            else:
                logger.error(f"停用使用者失敗: {loginid} ({username})")
                
        except Exception as e:
            logger.error(f"執行使用者停用時發生錯誤 {user_data.get('loginid', 'unknown')}: {e}")
    
    async def _activate_user(self, user_data: Dict[str, Any], current_time: datetime):
        """執行使用者啟用"""
        try:
            user_id = user_data['user_id']
            loginid = user_data['loginid']
            username = user_data['username']
            
            # 更新使用者狀態為啟用
            success = self.user_dao.update_user_status(user_id, True)
            
            if success:
                # 清除 activation_scheduled 欄位（表示已處理）
                update_query = """
                    UPDATE user_extensions 
                    SET activation_scheduled = NULL 
                    WHERE user_id = %s
                """
                self.user_org_dao.execute_update(update_query, (user_id,))
                
                logger.info(f"已自動啟用使用者: {loginid} ({username}) - 預約時間: {user_data['activation_scheduled']}")
                
                # 記錄審計日誌
                await self._log_audit_event(
                    user_id=None,  # 系統自動操作
                    action="AUTO_ACTIVATE",
                    target_type="user",
                    target_id=str(user_id),
                    changes={
                        "is_active": True,
                        "reason": "scheduled_activation",
                        "scheduled_at": user_data['activation_scheduled'].isoformat() if user_data['activation_scheduled'] else None,
                        "processed_at": current_time.isoformat()
                    }
                )
            else:
                logger.error(f"啟用使用者失敗: {loginid} ({username})")
                
        except Exception as e:
            logger.error(f"執行使用者啟用時發生錯誤 {user_data.get('loginid', 'unknown')}: {e}")
    
    async def _log_audit_event(self, user_id: Optional[int], action: str, target_type: str, 
                             target_id: str, changes: Dict[str, Any]):
        """記錄審計日誌"""
        try:
            import json
            
            audit_query = """
                INSERT INTO audit_logs (user_id, action, target_type, target_id, changes, created_at)
                VALUES (%s, %s, %s, %s, %s, %s)
            """
            
            self.user_org_dao.execute_update(
                audit_query,
                (user_id, action, target_type, target_id, json.dumps(changes, ensure_ascii=False), 
                 datetime.now(timezone.utc))
            )
            
        except Exception as e:
            logger.warning(f"記錄審計日誌失敗: {e}")
    
    def get_scheduled_users(self) -> Dict[str, List[Dict[str, Any]]]:
        """取得所有有排程的使用者"""
        try:
            # 取得排程停用的使用者
            deactivation_query = """
                SELECT ue.user_id, u.loginid, u.username, u.is_active, ue.activation_expires
                FROM user_extensions ue
                JOIN users u ON ue.user_id = u.id
                WHERE ue.activation_expires IS NOT NULL
                  AND u.is_active = 1
                ORDER BY ue.activation_expires ASC
            """
            
            # 取得排程啟用的使用者
            activation_query = """
                SELECT ue.user_id, u.loginid, u.username, u.is_active, ue.activation_scheduled
                FROM user_extensions ue
                JOIN users u ON ue.user_id = u.id
                WHERE ue.activation_scheduled IS NOT NULL
                  AND u.is_active = 0
                ORDER BY ue.activation_scheduled ASC
            """
            
            deactivation_users = self.user_org_dao.execute_query(deactivation_query)
            activation_users = self.user_org_dao.execute_query(activation_query)
            
            return {
                'scheduled_deactivations': deactivation_users or [],
                'scheduled_activations': activation_users or []
            }
            
        except Exception as e:
            logger.error(f"取得排程使用者時發生錯誤: {e}")
            return {
                'scheduled_deactivations': [],
                'scheduled_activations': []
            }


# 全域排程器實例
account_scheduler = AccountScheduler()


def get_scheduler() -> AccountScheduler:
    """取得全域排程器實例"""
    return account_scheduler


def start_scheduler():
    """啟動排程器"""
    account_scheduler.start()


def stop_scheduler():
    """停止排程器"""
    account_scheduler.stop()