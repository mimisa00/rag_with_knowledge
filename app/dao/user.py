from typing import Dict, List, Optional, Any
from app.dao.base import BaseDAO, db_manager
from app.utils.logging import get_logger

logger = get_logger(__name__)


class UserDAO(BaseDAO):
    def __init__(self, db_manager_instance=None):
        super().__init__(db_manager_instance or db_manager)

    def get_user_by_loginid(self, loginid: str) -> Optional[Dict[str, Any]]:
        """根據登入帳號取得使用者資訊"""
        try:
            query = "SELECT * FROM users WHERE loginid = %s"
            results = self.execute_query(query, (loginid,))
            return results[0] if results else None
        except Exception as e:
            logger.error(f"取得使用者資訊失敗: {e}")
            return None
    
    def get_user_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        """根據使用者名稱取得使用者資訊（保留向後相容）"""
        return self.get_user_by_loginid(username)
    
    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """根據 email 取得使用者資訊"""
        try:
            query = "SELECT * FROM users WHERE email = %s"
            results = self.execute_query(query, (email,))
            return results[0] if results else None
        except Exception as e:
            logger.error(f"根據 email 取得使用者資訊失敗: {e}")
            return None

    def get_user_by_id(self, user_id: int, include_inactive: bool = False) -> Optional[Dict[str, Any]]:
        """根據使用者ID取得使用者資訊"""
        try:
            if include_inactive:
                query = "SELECT * FROM users WHERE id = %s"
                results = self.execute_query(query, (user_id,))
            else:
                query = "SELECT * FROM users WHERE id = %s AND is_active = 1"
                results = self.execute_query(query, (user_id,))
            return results[0] if results else None
        except Exception as e:
            logger.error(f"取得使用者資訊失敗: {e}")
            return None

    def get_all_users(self) -> List[Dict[str, Any]]:
        """獲取所有用戶（管理員功能）"""
        try:
            query = "SELECT id, loginid, username, email, role, is_active, created_at, last_login_at, last_activity_at FROM users ORDER BY created_at DESC"
            return self.execute_query(query)
        except Exception as e:
            logger.error(f"取得所有用戶失敗: {e}")
            return []

    def create_user(self, loginid: str, username: str, email: str, password_hash: str, role: str, is_active: bool = True) -> int:
        """創建新用戶"""
        try:
            query = "INSERT INTO users (loginid, username, email, password_hash, role, is_active) VALUES (%s, %s, %s, %s, %s, %s)"
            return self.execute_insert(query, (loginid, username, email, password_hash, role, is_active))
        except Exception as e:
            logger.error(f"創建用戶失敗: {e}")
            return -1
    
    def delete_user(self, user_id: int) -> bool:
        """刪除用戶（物理刪除，謹慎使用）"""
        try:
            query = "DELETE FROM users WHERE id = %s"
            return self.execute_update(query, (user_id,))
        except Exception as e:
            logger.error(f"刪除用戶失敗: {e}")
            return False

    def update_user_role(self, user_id: int, role: str) -> bool:
        """更新用戶角色"""
        try:
            query = "UPDATE users SET role = %s WHERE id = %s"
            affected_rows = self.execute_update(query, (role, user_id))
            return affected_rows > 0
        except Exception as e:
            logger.error(f"更新用戶角色失敗: {e}")
            return False

    def deactivate_user(self, user_id: int) -> Dict[str, Any]:
        """停用用戶"""
        try:
            # 首先檢查用戶是否存在且為啟用狀態
            user = self.get_user_by_id(user_id, include_inactive=True)
            if not user:
                logger.warning(f"嘗試停用不存在的用戶 ID: {user_id}")
                return {"success": False, "error": "用戶不存在"}
            
            if not user.get('is_active', False):
                logger.info(f"用戶 ID {user_id} 已經是停用狀態")
                return {"success": False, "error": "用戶已經是停用狀態"}
            
            # 執行停用操作
            query = "UPDATE users SET is_active = FALSE WHERE id = %s AND is_active = TRUE"
            affected_rows = self.execute_update(query, (user_id,))
            
            if affected_rows > 0:
                logger.info(f"用戶 ID {user_id} 成功停用")
                return {"success": True}
            else:
                logger.warning(f"停用用戶 ID {user_id} 失敗，可能已經是停用狀態")
                return {"success": False, "error": "用戶已經是停用狀態"}
                
        except Exception as e:
            logger.error(f"停用用戶失敗: {e}")
            return {"success": False, "error": f"系統錯誤: {str(e)}"}

    def activate_user(self, user_id: int) -> bool:
        """啟用用戶"""
        try:
            query = "UPDATE users SET is_active = TRUE WHERE id = %s"
            affected_rows = self.execute_update(query, (user_id,))
            return affected_rows > 0
        except Exception as e:
            logger.error(f"啟用用戶失敗: {e}")
            return False
    
    def update_user_status(self, user_id: int, is_active: bool) -> bool:
        """更新用戶啟用/停用狀態（統一方法供排程系統使用）"""
        try:
            if is_active:
                return self.activate_user(user_id)
            else:
                result = self.deactivate_user(user_id)
                return result.get('success', False)
        except Exception as e:
            logger.error(f"更新用戶狀態失敗 (user_id={user_id}, is_active={is_active}): {e}")
            return False
            
    def update_user_password(self, user_id: int, password_hash: str) -> bool:
        """更新用戶密碼"""
        try:
            query = "UPDATE users SET password_hash = %s WHERE id = %s"
            affected_rows = self.execute_update(query, (password_hash, user_id))
            return affected_rows > 0
        except Exception as e:
            logger.error(f"更新用戶密碼失敗: {e}")
            return False
            
    def update_user(self, user_id: int, updates: Dict[str, Any]) -> bool:
        """更新使用者基本資訊"""
        try:
            # 過濾掉 None 值和不允許更新的欄位
            allowed_fields = ['username', 'email', 'is_active']
            filtered_updates = {k: v for k, v in updates.items() 
                              if k in allowed_fields and v is not None}
            
            if not filtered_updates:
                return True  # 沒有需要更新的欄位
            
            # 先檢查用戶是否存在
            user = self.get_user_by_id(user_id, include_inactive=True)
            if not user:
                logger.warning(f"嘗試更新不存在的用戶: user_id={user_id}")
                return False
            
            # 建立 UPDATE 語句
            set_clauses = [f"{field} = %s" for field in filtered_updates.keys()]
            query = f"UPDATE users SET {', '.join(set_clauses)} WHERE id = %s"
            
            # 準備參數
            params = list(filtered_updates.values()) + [user_id]
            
            # 執行更新，即使沒有實際變更也視為成功（因為用戶存在且語句正確執行）
            affected_rows = self.execute_update(query, params)
            # 只要執行沒有拋出異常就視為成功，不管是否有實際更改
            return True
        except Exception as e:
            logger.error(f"更新使用者資訊失敗: {e}")
            return False
    
    def update_login_time(self, user_id: int) -> bool:
        """更新用戶登入時間"""
        try:
            query = "UPDATE users SET last_login_at = NOW(), last_activity_at = NOW() WHERE id = %s"
            affected_rows = self.execute_update(query, (user_id,))
            return affected_rows > 0
        except Exception as e:
            logger.error(f"更新用戶登入時間失敗: {e}")
            return False

    def update_activity_time(self, user_id: int) -> bool:
        """更新用戶最後活動時間"""
        try:
            query = "UPDATE users SET last_activity_at = NOW() WHERE id = %s"
            affected_rows = self.execute_update(query, (user_id,))
            return affected_rows > 0
        except Exception as e:
            logger.error(f"更新用戶最後活動時間失敗: {e}")
            return False

    def get_online_users_count(self) -> int:
        """獲取線上用戶數（最近15分鐘內有活動的用戶）"""
        try:
            from datetime import datetime, timedelta
            
            # 最近15分鐘內有活動的用戶視為線上
            fifteen_minutes_ago = datetime.now() - timedelta(minutes=15)
            
            query = """
                SELECT COUNT(*) as count
                FROM users 
                WHERE last_activity_at >= %s 
                AND is_active = TRUE
            """
            result = self.execute_query(query, (fifteen_minutes_ago,))
            
            return result[0]['count'] if result else 0
            
        except Exception as e:
            logger.error(f"獲取線上用戶數失敗: {e}")
            return 0

    def get_login_statistics(self) -> Dict[str, Any]:
        """獲取登入統計資料"""
        try:
            from datetime import datetime, timedelta
            
            # 獲取當前時間的各個時間點
            now = datetime.now()
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            week_start = today_start - timedelta(days=now.weekday())
            month_start = today_start.replace(day=1)
            seven_days_ago = today_start - timedelta(days=7)
            thirty_days_ago = today_start - timedelta(days=30)
            
            # 1. 今日登入用戶數
            today_login_query = """
                SELECT COUNT(DISTINCT id) as count 
                FROM users 
                WHERE last_login_at >= %s AND last_login_at < %s + INTERVAL 1 DAY
            """
            today_logins = self.execute_query(today_login_query, (today_start, today_start))
            
            # 2. 本週登入用戶數
            week_login_query = """
                SELECT COUNT(DISTINCT id) as count 
                FROM users 
                WHERE last_login_at >= %s AND last_login_at < %s + INTERVAL 7 DAY
            """
            week_logins = self.execute_query(week_login_query, (week_start, week_start))
            
            # 3. 本月登入用戶數
            month_login_query = """
                SELECT COUNT(DISTINCT id) as count 
                FROM users 
                WHERE last_login_at >= %s
            """
            month_logins = self.execute_query(month_login_query, (month_start,))
            
            # 4. 活躍用戶數（最近7天有活動）
            active_users_query = """
                SELECT COUNT(DISTINCT id) as count 
                FROM users 
                WHERE last_activity_at >= %s
            """
            active_users = self.execute_query(active_users_query, (seven_days_ago,))
            
            # 5. 每日登入趨勢（過去30天）
            daily_trend_query = """
                SELECT 
                    DATE(last_login_at) as login_date,
                    COUNT(DISTINCT id) as count
                FROM users 
                WHERE last_login_at >= %s
                GROUP BY DATE(last_login_at)
                ORDER BY login_date
            """
            daily_trends = self.execute_query(daily_trend_query, (thirty_days_ago,))
            
            # 6. 用戶登入狀態分析
            user_status_query = """
                SELECT 
                    CASE 
                        WHEN last_login_at IS NULL THEN 'never_logged_in'
                        WHEN last_login_at >= %s THEN 'active_today'
                        WHEN last_login_at >= %s THEN 'active_this_week'
                        WHEN last_login_at >= %s THEN 'active_this_month'
                        ELSE 'inactive'
                    END as status,
                    COUNT(*) as count
                FROM users 
                WHERE is_active = 1
                GROUP BY status
            """
            user_status = self.execute_query(user_status_query, (today_start, week_start, month_start))
            
            # 6. 獲取線上用戶數
            online_count = self.get_online_users_count()
            
            # 整理數據
            result = {
                "summary": {
                    "today_logins": today_logins[0]['count'] if today_logins else 0,
                    "week_logins": week_logins[0]['count'] if week_logins else 0,
                    "month_logins": month_logins[0]['count'] if month_logins else 0,
                    "active_users": active_users[0]['count'] if active_users else 0,
                    "online_users": online_count
                },
                "daily_trends": [
                    {
                        "date": str(trend["login_date"]),
                        "count": trend["count"]
                    } for trend in daily_trends
                ],
                "user_status": {
                    status["status"]: status["count"] 
                    for status in user_status
                },
                "generated_at": now.isoformat()
            }
            
            return result
            
        except Exception as e:
            logger.error(f"獲取登入統計失敗: {e}")
            return {
                "summary": {
                    "today_logins": 0,
                    "week_logins": 0,
                    "month_logins": 0,
                    "active_users": 0,
                    "online_users": 0
                },
                "daily_trends": [],
                "user_status": {},
                "generated_at": datetime.now().isoformat(),
                "error": str(e)
            }

    def get_security_anomalies(self) -> Dict[str, Any]:
        """獲取安全異常監控資料"""
        try:
            from datetime import datetime, timedelta
            
            now = datetime.now()
            today = now.replace(hour=0, minute=0, second=0, microsecond=0)
            one_hour_ago = now - timedelta(hours=1)
            one_day_ago = now - timedelta(days=1)
            seven_days_ago = now - timedelta(days=7)
            thirty_days_ago = now - timedelta(days=30)
            
            anomalies = []
            
            # 1. 異常時間登入檢測（凌晨 0-6 點登入）
            unusual_time_query = """
                SELECT loginid, username, last_login_at
                FROM users 
                WHERE DATE(last_login_at) = CURDATE()
                AND HOUR(last_login_at) BETWEEN 0 AND 6
                AND is_active = 1
                ORDER BY last_login_at DESC
                LIMIT 10
            """
            unusual_logins = self.execute_query(unusual_time_query)
            
            for login in unusual_logins:
                anomalies.append({
                    'type': 'unusual_time_login',
                    'user': login['loginid'],
                    'username': login['username'],
                    'time': login['last_login_at'].strftime('%Y-%m-%d %H:%M:%S') if login['last_login_at'] else '',
                    'severity': 'info',
                    'description': f"用戶 {login['loginid']} 在凌晨時段登入"
                })
            
            # 2. 快速註冊檢測（1小時內註冊超過5個帳號）
            rapid_registration_query = """
                SELECT COUNT(*) as count, MIN(created_at) as first_time, MAX(created_at) as last_time
                FROM users 
                WHERE created_at >= %s
            """
            rapid_reg = self.execute_query(rapid_registration_query, (one_hour_ago,))
            
            if rapid_reg and rapid_reg[0]['count'] > 5:
                anomalies.append({
                    'type': 'rapid_registration',
                    'count': rapid_reg[0]['count'],
                    'time': rapid_reg[0]['last_time'].strftime('%Y-%m-%d %H:%M:%S') if rapid_reg[0]['last_time'] else '',
                    'severity': 'warning',
                    'description': f"短時間內有 {rapid_reg[0]['count']} 個新帳號註冊"
                })
            
            # 3. 長期未活動後突然活躍檢測
            dormant_active_query = """
                SELECT u.loginid, u.username, u.last_login_at, u.last_activity_at,
                       DATEDIFF(u.last_activity_at, u.last_login_at) as dormant_days
                FROM users u
                WHERE u.last_login_at IS NOT NULL
                AND u.last_activity_at > %s
                AND u.last_login_at < %s
                AND DATEDIFF(u.last_activity_at, u.last_login_at) > 30
                AND u.is_active = 1
                ORDER BY dormant_days DESC
                LIMIT 5
            """
            dormant_active = self.execute_query(dormant_active_query, (one_day_ago, thirty_days_ago))
            
            for user in dormant_active:
                anomalies.append({
                    'type': 'dormant_account_active',
                    'user': user['loginid'],
                    'username': user['username'],
                    'time': user['last_activity_at'].strftime('%Y-%m-%d %H:%M:%S') if user['last_activity_at'] else '',
                    'severity': 'warning',
                    'description': f"長期未使用帳號 {user['loginid']} 突然活躍 (休眠 {user['dormant_days']} 天)"
                })
            
            # 4. 異常對話頻率檢測（基於conversations表，如果表存在）
            try:
                conversation_anomaly_query = """
                    SELECT c.user_id, u.loginid, u.username, COUNT(*) as conv_count
                    FROM conversations c
                    JOIN users u ON c.user_id = u.id
                    WHERE c.created_at >= %s
                    GROUP BY c.user_id, u.loginid, u.username
                    HAVING COUNT(*) > 100
                    ORDER BY conv_count DESC
                    LIMIT 5
                """
                high_conv_users = self.execute_query(conversation_anomaly_query, (one_hour_ago,))
                
                for user in high_conv_users:
                    anomalies.append({
                        'type': 'high_conversation_frequency',
                        'user': user['loginid'],
                        'username': user['username'],
                        'count': user['conv_count'],
                        'time': now.strftime('%Y-%m-%d %H:%M:%S'),
                        'severity': 'warning',
                        'description': f"用戶 {user['loginid']} 在短時間內進行了 {user['conv_count']} 次對話"
                    })
            except Exception:
                # 如果conversations表不存在或查詢失敗，忽略這個檢測
                pass
            
            # 5. 管理員權限異常提升檢測（最近24小時內新增的管理員）
            admin_elevation_query = """
                SELECT loginid, username, created_at
                FROM users 
                WHERE role = 'admin' 
                AND created_at >= %s
                ORDER BY created_at DESC
            """
            new_admins = self.execute_query(admin_elevation_query, (one_day_ago,))
            
            for admin in new_admins:
                anomalies.append({
                    'type': 'admin_elevation',
                    'user': admin['loginid'],
                    'username': admin['username'],
                    'time': admin['created_at'].strftime('%Y-%m-%d %H:%M:%S') if admin['created_at'] else '',
                    'severity': 'danger',
                    'description': f"新管理員帳號 {admin['loginid']} 被建立"
                })
            
            # 6. 帳號狀態異常變更檢測（recently reactivated accounts）
            reactivation_query = """
                SELECT loginid, username, updated_at
                FROM users 
                WHERE is_active = 1 
                AND updated_at >= %s
                AND updated_at != created_at
                ORDER BY updated_at DESC
                LIMIT 10
            """
            reactivated = self.execute_query(reactivation_query, (one_day_ago,))
            
            for user in reactivated:
                anomalies.append({
                    'type': 'account_reactivation',
                    'user': user['loginid'],
                    'username': user['username'],
                    'time': user['updated_at'].strftime('%Y-%m-%d %H:%M:%S') if user['updated_at'] else '',
                    'severity': 'info',
                    'description': f"帳號 {user['loginid']} 被重新啟用"
                })
            
            # 按嚴重性和時間排序
            severity_order = {'danger': 0, 'warning': 1, 'info': 2}
            anomalies.sort(key=lambda x: (severity_order.get(x.get('severity', 'info'), 2), x.get('time', '')), reverse=True)
            
            result = {
                "anomalies": anomalies[:20],  # 限制返回最多20個異常
                "total_count": len(anomalies),
                "generated_at": now.isoformat(),
                "summary": {
                    "danger": len([a for a in anomalies if a.get('severity') == 'danger']),
                    "warning": len([a for a in anomalies if a.get('severity') == 'warning']),
                    "info": len([a for a in anomalies if a.get('severity') == 'info'])
                }
            }
            
            return result
            
        except Exception as e:
            logger.error(f"獲取安全異常監控資料失敗: {e}")
            return {
                "anomalies": [],
                "total_count": 0,
                "generated_at": datetime.now().isoformat(),
                "summary": {"danger": 0, "warning": 0, "info": 0},
                "error": str(e)
            }

    def create_activation_token(self, user_id: int, token: str, token_type: str = 'activation', expires_hours: int = 168) -> bool:
        """創建啟用 token（預設7天過期）"""
        try:
            query = """
                INSERT INTO user_activation_tokens 
                (user_id, token, token_type, expires_at, used, created_at) 
                VALUES (%s, %s, %s, NOW() + INTERVAL %s HOUR, FALSE, NOW())
            """
            return self.execute_insert(query, (user_id, token, token_type, expires_hours)) > 0
        except Exception as e:
            logger.error(f"創建啟用 token 失敗: {e}")
            return False

    def verify_activation_token(self, token: str) -> Optional[Dict[str, Any]]:
        """驗證啟用 token"""
        try:
            query = """
                SELECT t.id, t.user_id, t.token_type, t.expires_at, t.used,
                       u.id as user_id, u.loginid, u.username, u.email, u.is_active,
                       ue.password_strategy
                FROM user_activation_tokens t
                JOIN users u ON t.user_id = u.id
                LEFT JOIN user_extensions ue ON u.id = ue.user_id
                WHERE t.token = %s
            """
            results = self.execute_query(query, (token,))
            
            if not results:
                return None
                
            token_data = results[0]
            
            # 檢查 token 是否已過期
            from datetime import datetime
            if token_data['expires_at'] < datetime.now():
                logger.warning(f"Token 已過期: {token}")
                return None
            
            # 檢查 token 是否已使用
            if token_data['used']:
                logger.warning(f"Token 已使用: {token}")
                return None
            
            return token_data
        except Exception as e:
            logger.error(f"驗證啟用 token 失敗: {e}")
            return None

    def use_activation_token(self, token: str) -> bool:
        """標記 token 為已使用"""
        try:
            query = """
                UPDATE user_activation_tokens 
                SET used = TRUE, used_at = NOW() 
                WHERE token = %s AND used = FALSE AND expires_at > NOW()
            """
            affected_rows = self.execute_update(query, (token,))
            return affected_rows > 0
        except Exception as e:
            logger.error(f"標記 token 為已使用失敗: {e}")
            return False

    def activate_user_account(self, user_id: int, password_hash: str) -> bool:
        """啟用使用者帳號並設定密碼"""
        try:
            # 更新使用者資料
            query = """
                UPDATE users 
                SET is_active = TRUE, 
                    password_hash = %s,
                    must_change_password = FALSE,
                    password_set_at = NOW(),
                    last_password_change = NOW()
                WHERE id = %s
            """
            users_updated = self.execute_update(query, (password_hash, user_id))
            
            # 更新擴充資料
            ext_query = """
                UPDATE user_extensions 
                SET activated_at = NOW(),
                    activation_scheduled = NULL
                WHERE user_id = %s
            """
            self.execute_update(ext_query, (user_id,))
            
            return users_updated > 0
        except Exception as e:
            logger.error(f"啟用使用者帳號失敗: {e}")
            return False

    def get_password_policy(self, policy_name: str = 'default_policy') -> Optional[Dict[str, Any]]:
        """獲取密碼策略"""
        try:
            query = """
                SELECT * FROM password_policies 
                WHERE policy_name = %s AND is_active = TRUE
            """
            results = self.execute_query(query, (policy_name,))
            return results[0] if results else None
        except Exception as e:
            logger.error(f"獲取密碼策略失敗: {e}")
            return None

    def has_active_activation_token(self, user_id: int) -> bool:
        """檢查使用者是否有有效的啟用 token"""
        try:
            query = """
                SELECT COUNT(*) as count FROM user_activation_tokens 
                WHERE user_id = %s AND used = FALSE AND expires_at > NOW() AND token_type = 'activation'
            """
            results = self.execute_query(query, (user_id,))
            return results and len(results) > 0 and results[0]['count'] > 0
        except Exception as e:
            logger.error(f"檢查使用者啟用 token 失敗: {e}")
            return False

    def get_users_activation_tokens_batch(self, user_ids: List[int]) -> Dict[int, bool]:
        """批次檢查多個使用者是否有有效的啟用 token"""
        if not user_ids:
            return {}
        
        try:
            placeholders = ','.join(['%s'] * len(user_ids))
            query = f"""
                SELECT user_id, COUNT(*) as count 
                FROM user_activation_tokens 
                WHERE user_id IN ({placeholders}) 
                  AND used = FALSE 
                  AND expires_at > NOW() 
                  AND token_type = 'activation'
                GROUP BY user_id
            """
            results = self.execute_query(query, tuple(user_ids))
            
            # 建立結果字典，預設都是 False
            token_map = {uid: False for uid in user_ids}
            
            # 標記有 token 的使用者為 True
            for row in results:
                if row['count'] > 0:
                    token_map[row['user_id']] = True
            
            return token_map
        except Exception as e:
            logger.error(f"批次檢查使用者啟用 token 失敗: {e}")
            # 發生錯誤時回傳預設值（全部為 False）
            return {uid: False for uid in user_ids}

    def clean_expired_tokens(self) -> int:
        """清理過期的 token"""
        try:
            query = """
                DELETE FROM user_activation_tokens 
                WHERE expires_at < NOW() AND used = FALSE
            """
            return self.execute_update(query)
        except Exception as e:
            logger.error(f"清理過期 token 失敗: {e}")
            return 0

    def delete_user_activation_tokens(self, user_id: int, token_type: str = 'activation') -> bool:
        """刪除使用者的所有未使用啟用 token"""
        try:
            query = """
                DELETE FROM user_activation_tokens 
                WHERE user_id = %s AND token_type = %s AND used = FALSE
            """
            affected_rows = self.execute_update(query, (user_id, token_type))
            return affected_rows >= 0  # >= 0 表示成功（可能刪除 0 筆記錄）
        except Exception as e:
            logger.error(f"刪除使用者 {user_id} 的啟用 token 失敗: {e}")
            return False

    def get_user_complete_info(self, user_id: int) -> Optional[Dict[str, Any]]:
        """獲取使用者完整資訊，包含員工擴充資料、部門角色、權限群組"""
        try:
            query = """
                SELECT 
                    u.id, u.loginid, u.username, u.email, u.role, u.is_active,
                    u.created_at, u.last_login_at,
                    ue.title, ue.employee_no, ue.department_id,
                    d.name as department_name,
                    dr.name as primary_role_name,
                    dr.role_type as primary_role_type,
                    GROUP_CONCAT(DISTINCT pg.name) as permission_group_names,
                    GROUP_CONCAT(DISTINCT pg.code) as permission_group_codes
                FROM users u
                LEFT JOIN user_extensions ue ON u.id = ue.user_id
                LEFT JOIN departments d ON ue.department_id = d.id
                LEFT JOIN user_department_roles udr ON u.id = udr.user_id AND udr.is_primary = 1
                LEFT JOIN department_roles dr ON udr.department_role_id = dr.id
                LEFT JOIN permission_groups_user pgu ON u.id = pgu.user_id 
                    AND (pgu.expires_at IS NULL OR pgu.expires_at > NOW())
                LEFT JOIN permission_groups pg ON pgu.permission_group_id = pg.id AND pg.is_active = 1
                WHERE u.id = %s
                GROUP BY u.id
            """
            
            results = self.execute_query(query, (user_id,))
            if results:
                user_info = results[0]
                
                # 處理 GROUP_CONCAT 結果
                if user_info.get('permission_group_names'):
                    user_info['permission_groups'] = [
                        {
                            'name': name,
                            'code': code
                        }
                        for name, code in zip(
                            user_info['permission_group_names'].split(','),
                            user_info['permission_group_codes'].split(',') if user_info.get('permission_group_codes') else []
                        )
                    ]
                else:
                    user_info['permission_groups'] = []
                
                # 清理不需要的欄位
                user_info.pop('permission_group_names', None)
                user_info.pop('permission_group_codes', None)
                
                return user_info
                
            return None
            
        except Exception as e:
            logger.error(f"獲取使用者 {user_id} 完整資訊失敗: {e}")
            return None


# 建立實例
user_dao = UserDAO()
