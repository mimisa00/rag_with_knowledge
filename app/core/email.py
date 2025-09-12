"""
電子郵件發送核心模組
處理 SMTP 郵件發送功能
"""
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Optional, List, Any
from datetime import datetime

from app.utils.logging import get_logger

logger = get_logger(__name__)


def send_test_email(recipient_email: str, smtp_config: Dict[str, Any]) -> bool:
    """
    發送測試郵件
    
    Args:
        recipient_email: 收件者郵件地址
        smtp_config: SMTP 配置字典
        
    Returns:
        bool: 發送成功返回 True，失敗返回 False
    """
    try:
        # 建立郵件內容
        message = MIMEMultipart("alternative")
        message["Subject"] = "E-Helper 系統測試郵件"
        message["From"] = f"{smtp_config['mail_from_name']} <{smtp_config['mail_from_email']}>"
        message["To"] = recipient_email

        # 建立郵件正文（HTML 格式）
        html_content = f"""
        <html>
            <body>
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #667eea; margin-bottom: 10px;">E-Helper 系統</h1>
                        <h2 style="color: #333; margin-top: 0;">測試郵件</h2>
                    </div>
                    
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h3 style="color: #333; margin-top: 0;">✅ SMTP 設定測試成功！</h3>
                        <p style="color: #666; line-height: 1.6;">
                            恭喜！您的 E-Helper 系統郵件服務已正確配置。系統現在可以正常發送電子郵件了。
                        </p>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <h4 style="color: #333; margin-bottom: 10px;">測試資訊：</h4>
                        <ul style="color: #666; line-height: 1.6;">
                            <li>測試時間：{datetime.now().strftime('%Y年%m月%d日 %H:%M:%S')}</li>
                            <li>SMTP 伺服器：{smtp_config['smtp_host']}:{smtp_config['smtp_port']}</li>
                            <li>收件者：{recipient_email}</li>
                            <li>寄件者：{smtp_config['mail_from_email']}</li>
                        </ul>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
                        <p style="color: #999; font-size: 12px; margin: 0;">
                            此郵件由 E-Helper 系統自動發送，請勿回覆
                        </p>
                    </div>
                </div>
            </body>
        </html>
        """

        # 文字版本（備用）
        text_content = f"""
E-Helper 系統測試郵件

✅ SMTP 設定測試成功！

恭喜！您的 E-Helper 系統郵件服務已正確配置。

測試資訊：
- 測試時間：{datetime.now().strftime('%Y年%m月%d日 %H:%M:%S')}
- SMTP 伺服器：{smtp_config['smtp_host']}:{smtp_config['smtp_port']}
- 收件者：{recipient_email}
- 寄件者：{smtp_config['mail_from_email']}

此郵件由 E-Helper 系統自動發送，請勿回覆
        """

        # 添加郵件內容
        part1 = MIMEText(text_content, "plain")
        part2 = MIMEText(html_content, "html")
        message.attach(part1)
        message.attach(part2)

        # 發送郵件
        return _send_email_via_smtp(message, smtp_config)

    except Exception as e:
        logger.error(f"建立測試郵件失敗: {e}")
        return False


def send_activation_email(recipient_email: str, activation_token: str, user_name: str, smtp_config: Dict[str, Any]) -> bool:
    """
    發送帳號啟用郵件
    
    Args:
        recipient_email: 收件者郵件地址
        activation_token: 啟用 token
        user_name: 用戶姓名
        smtp_config: SMTP 配置字典
        
    Returns:
        bool: 發送成功返回 True，失敗返回 False
    """
    try:
        from app.config.settings import app_config
        
        # 建立啟用連結
        activation_token_expire_hours = app_config.get('activation_token_expire_hours', '168')
        activation_token_expire_days = (int(activation_token_expire_hours) // 24) if activation_token_expire_hours else 7

        base_url = app_config.get('activation_base_url', 'http://localhost:8080')
        activation_url = f"{base_url}/activate?token={activation_token}"
        
        # 建立郵件內容
        message = MIMEMultipart("alternative")
        message["Subject"] = "E-Helper 系統 - 帳號啟用通知"
        message["From"] = f"{smtp_config['mail_from_name']} <{smtp_config['mail_from_email']}>"
        message["To"] = recipient_email

        # 建立郵件正文（HTML 格式）
        html_content = f"""
        <html>
            <body>
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #667eea; margin-bottom: 10px;">E-Helper 系統</h1>
                        <h2 style="color: #333; margin-top: 0;">帳號啟用通知</h2>
                    </div>
                    
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <p style="color: #333; line-height: 1.6; margin-top: 0;">
                            親愛的 <strong>{user_name}</strong>，您好：
                        </p>
                        <p style="color: #666; line-height: 1.6;">
                            您的 E-Helper 系統帳號已經建立完成，請點擊下方按鈕來啟用您的帳號並設定密碼。
                        </p>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{activation_url}" 
                           style="background-color: #667eea; color: white; padding: 15px 30px; 
                                  text-decoration: none; border-radius: 8px; display: inline-block; 
                                  font-weight: bold; font-size: 16px;">
                            🔑 啟用帳號
                        </a>
                    </div>
                    
                    <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <h4 style="color: #856404; margin-top: 0;">⚠️ 重要提醒：</h4>
                        <ul style="color: #856404; line-height: 1.6; margin-bottom: 0;">
                            <li>此啟用連結有效期為 {activation_token_expire_days} 天，請盡快完成啟用</li>
                            <li>啟用時請設定符合安全要求的密碼</li>
                            <li>如連結失效，請聯繫系統管理員重新發送</li>
                        </ul>
                    </div>
                    
                    <div style="font-size: 12px; color: #999; margin-top: 20px;">
                        <p>如果按鈕無法點擊，請複製以下連結到瀏覽器開啟：</p>
                        <p style="word-break: break-all; background-color: #f8f9fa; padding: 10px; border-radius: 4px;">
                            {activation_url}
                        </p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
                        <p style="color: #999; font-size: 12px; margin: 0;">
                            此郵件由 E-Helper 系統自動發送，請勿回覆
                        </p>
                    </div>
                </div>
            </body>
        </html>
        """

        # 文字版本（備用）
        text_content = f"""
E-Helper 系統 - 帳號啟用通知

親愛的 {user_name}，您好：

您的 E-Helper 系統帳號已經建立完成，請使用以下連結來啟用您的帳號並設定密碼。

啟用連結：{activation_url}

⚠️ 重要提醒：
- 此啟用連結有效期為 N 天，請盡快完成啟用
- 啟用時請設定符合安全要求的密碼  
- 如連結失效，請聯繫系統管理員重新發送

此郵件由 E-Helper 系統自動發送，請勿回覆
        """

        # 添加郵件內容
        part1 = MIMEText(text_content, "plain")
        part2 = MIMEText(html_content, "html")
        message.attach(part1)
        message.attach(part2)

        # 發送郵件
        return _send_email_via_smtp(message, smtp_config)

    except Exception as e:
        logger.error(f"建立啟用郵件失敗: {e}")
        return False


def _send_email_via_smtp(message: MIMEMultipart, smtp_config: Dict[str, Any]) -> bool:
    """
    透過 SMTP 發送郵件的內部方法
    
    Args:
        message: 郵件訊息物件
        smtp_config: SMTP 配置字典
        
    Returns:
        bool: 發送成功返回 True，失敗返回 False
    """
    try:
        # 建立 SMTP 連線
        if smtp_config['smtp_use_tls']:
            # 使用 STARTTLS 加密
            server = smtplib.SMTP(smtp_config['smtp_host'], smtp_config['smtp_port'])
            server.starttls()
        else:
            # 不使用加密或使用 SSL
            if smtp_config['smtp_port'] == 465:
                # SSL 連線
                context = ssl.create_default_context()
                server = smtplib.SMTP_SSL(smtp_config['smtp_host'], smtp_config['smtp_port'], context=context)
            else:
                # 普通連線
                server = smtplib.SMTP(smtp_config['smtp_host'], smtp_config['smtp_port'])
        
        # SMTP 認證
        if smtp_config['smtp_username'] and smtp_config['smtp_password']:
            server.login(smtp_config['smtp_username'], smtp_config['smtp_password'])
        
        # 發送郵件
        text = message.as_string()
        server.sendmail(smtp_config['mail_from_email'], message["To"], text)
        server.quit()
        
        logger.info(f"郵件成功發送至: {message['To']}")
        return True
        
    except smtplib.SMTPAuthenticationError as e:
        logger.error(f"SMTP 認證失敗: {e}")
        return False
    except smtplib.SMTPConnectError as e:
        logger.error(f"SMTP 連線失敗: {e}")
        return False  
    except smtplib.SMTPException as e:
        logger.error(f"SMTP 錯誤: {e}")
        return False
    except Exception as e:
        logger.error(f"發送郵件時發生未預期的錯誤: {e}")
        return False


def get_email_config() -> Optional[Dict[str, Any]]:
    """
    獲取郵件配置
    
    Returns:
        Dict: 郵件配置字典，如果配置不完整則返回 None
    """
    try:
        from app.config.settings import app_config
        
        config = {
            'smtp_host': app_config.get('smtp_host', 'smtp.gmail.com'),
            'smtp_port': int(app_config.get('smtp_port', 587)),
            'smtp_use_tls': app_config.get('smtp_use_tls', 'true').lower() == 'true',
            'smtp_username': app_config.get('smtp_username', ''),
            'smtp_password': app_config.get('smtp_password', ''),
            'mail_from_email': app_config.get('mail_from_email', ''),
            'mail_from_name': app_config.get('mail_from_name', 'E-Helper系統'),
        }
        
        # 檢查必要配置
        if not config['smtp_username'] or not config['smtp_password'] or not config['mail_from_email']:
            logger.warning("郵件配置不完整")
            return None
            
        return config
        
    except Exception as e:
        logger.error(f"獲取郵件配置失敗: {e}")
        return None


def process_activation_email(
    user_id: int,
    user_email: str,
    user_name: str,
    clear_old_tokens: bool = True,
    check_password_strategy: bool = False
) -> Dict[str, Any]:
    """
    處理單一使用者啟用郵件發送
    
    Args:
        user_id: 使用者ID
        user_email: 使用者電子郵件地址
        user_name: 使用者姓名
        clear_old_tokens: 是否清除舊的啟用 token
        check_password_strategy: 是否檢查密碼策略
        
    Returns:
        Dict: 處理結果
            - success: bool - 是否成功
            - message: str - 處理訊息
            - email_sent: bool - 郵件是否發送成功
            - token: str - 生成的 token（僅測試用）
    """
    from app.dao.user import user_dao
    from app.dao.organization import user_org_dao
    
    logger.info(f"DEBUG: process_activation_email 開始 - user_id={user_id}, email={user_email}, name={user_name}, clear_old_tokens={clear_old_tokens}, check_password_strategy={check_password_strategy}")
    
    try:
        # 1. 檢查密碼策略（如果需要）
        logger.info(f"DEBUG: 步驟1 - 檢查密碼策略 - check_password_strategy={check_password_strategy}")
        if check_password_strategy:
            from app.dao.organization import UserOrganizationDAO
            org_dao = UserOrganizationDAO()
            ext_query = """
                SELECT password_strategy
                FROM user_extensions
                WHERE user_id = %s
            """
            ext_result = org_dao.execute_query(ext_query, (user_id,))
            
            if not ext_result:
                logger.warning(f"找不到使用者擴充資訊: user_id={user_id}")
                return {
                    "success": False,
                    "message": "找不到使用者擴充資訊",
                    "email_sent": False
                }
            
            password_strategy = ext_result[0].get('password_strategy')
            if password_strategy != 'ACTIVATION_LINK':
                logger.info(f"使用者 {user_id} 密碼策略為 {password_strategy}，跳過啟用郵件")
                return {
                    "success": True,
                    "message": f"密碼策略為 {password_strategy}，無需發送啟用郵件",
                    "email_sent": False
                }
        
        # 2. 清除舊 token（如果需要）
        logger.info(f"DEBUG: 步驟2 - 清除舊 token - clear_old_tokens={clear_old_tokens}")
        if clear_old_tokens:
            clear_success = user_dao.delete_user_activation_tokens(user_id, 'activation')
            logger.info(f"DEBUG: 清除舊 token 結果 - user_id={user_id}, clear_success={clear_success}")
            if clear_success:
                logger.info(f"已清除使用者 {user_id} 的舊啟用 token")
        
        # 3. 生成新的啟用 token
        logger.info(f"DEBUG: 步驟3 - 生成新的啟用 token - user_id={user_id}")
        import secrets
        new_token = secrets.token_urlsafe(32)
        logger.info(f"DEBUG: 新 token 生成 - user_id={user_id}, token_length={len(new_token)}")
        
        # 4. 從配置表取得啟用連結有效期限
        logger.info(f"DEBUG: 步驟4 - 取得啟用連結有效期限")
        activation_expire_hours = 168  # 預設值 7 天
        try:
            from app.dao.config import ConfigDAO
            config_dao = ConfigDAO()
            expire_value = config_dao.get_config_by_key('activation_token_expire_hours')
            if expire_value:
                activation_expire_hours = int(expire_value)
        except Exception as e:
            logger.warning(f"無法取得啟用連結有效期限設定，使用預設值 {activation_expire_hours} 小時: {e}")
        
        # 5. 創建啟用 token 記錄
        logger.info(f"DEBUG: 步驟5 - 創建啟用 token 記錄 - user_id={user_id}, expire_hours={activation_expire_hours}")
        token_success = user_dao.create_activation_token(user_id, new_token, 'activation', activation_expire_hours)
        logger.info(f"DEBUG: 創建 token 記錄結果 - user_id={user_id}, token_success={token_success}")
        if not token_success:
            logger.error(f"創建啟用 token 失敗: user_id={user_id}")
            return {
                "success": False,
                "message": "創建啟用 token 失敗",
                "email_sent": False
            }
        
        # 6. 發送啟用郵件
        logger.info(f"DEBUG: 步驟6 - 發送啟用郵件 - user_id={user_id}, email={user_email}")
        email_sent = False
        email_config = get_email_config()
        logger.info(f"DEBUG: 取得郵件設定 - user_id={user_id}, email_config_available={email_config is not None}")
        
        if email_config:
            logger.info(f"DEBUG: 呼叫 send_activation_email - user_id={user_id}, email={user_email}, username={user_name}")
            
            # 重試機制：最多嘗試3次
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    email_sent = send_activation_email(user_email, new_token, user_name, email_config)
                    if email_sent:
                        logger.info(f"啟用郵件成功發送給: {user_email} (user_id: {user_id}), 嘗試次數: {attempt + 1}")
                        break
                    else:
                        if attempt < max_retries - 1:
                            import time
                            wait_seconds = 2 ** attempt  # 指數退避: 1秒, 2秒, 4秒
                            logger.warning(f"啟用郵件發送失敗 (user_id: {user_id}), 第 {attempt + 1} 次嘗試，將在 {wait_seconds} 秒後重試")
                            time.sleep(wait_seconds)
                        else:
                            logger.error(f"啟用郵件發送失敗: {user_email} (user_id: {user_id}), 已嘗試 {max_retries} 次")
                except Exception as e:
                    if attempt < max_retries - 1:
                        import time
                        wait_seconds = 2 ** attempt
                        logger.warning(f"發送郵件時發生錯誤 (user_id: {user_id}), 第 {attempt + 1} 次嘗試: {e}, 將在 {wait_seconds} 秒後重試")
                        time.sleep(wait_seconds)
                    else:
                        logger.error(f"發送郵件時發生錯誤 (user_id: {user_id}), 已嘗試 {max_retries} 次: {e}")
                        email_sent = False
                        break
                        
            logger.info(f"DEBUG: send_activation_email 最終結果 - user_id={user_id}, email_sent={email_sent}")
        else:
            logger.warning(f"郵件配置不完整，無法發送啟用郵件給 {user_email} (user_id: {user_id})")
        
        # 7. 更新 user_extensions 記錄郵件發送狀態
        logger.info(f"DEBUG: 步驟7 - 更新 user_extensions 記錄 - user_id={user_id}, email_sent={email_sent}")
        try:
            from app.dao.organization import UserOrganizationDAO
            org_dao = UserOrganizationDAO()
            
            update_data = {}
            if email_sent:
                update_data['activation_email_sent_at'] = datetime.now()
                logger.info(f"DEBUG: 準備更新郵件發送時間 - user_id={user_id}, timestamp={update_data['activation_email_sent_at']}, type={type(update_data['activation_email_sent_at'])}")
                
                # 取得現有計數並增加
                existing_ext = org_dao.get_user_extension(user_id)
                logger.info(f"DEBUG: 現有擴充資料 - user_id={user_id}, existing_ext={existing_ext}")
                current_count = existing_ext.get('activation_email_count', 0) if existing_ext else 0
                update_data['activation_email_count'] = current_count + 1
                logger.info(f"DEBUG: 郵件計數更新 - user_id={user_id}, current_count={current_count}, new_count={update_data['activation_email_count']}")
            
            logger.info(f"DEBUG: 準備更新資料 - user_id={user_id}, update_data={update_data}")
            if update_data:
                logger.info(f"DEBUG: 呼叫 update_user_extension - user_id={user_id}, update_data={update_data}")
                result = org_dao.update_user_extension(user_id, update_data)
                logger.info(f"DEBUG: update_user_extension 結果 - user_id={user_id}, result={result}")
                logger.info(f"已更新使用者 {user_id} 的郵件發送記錄")
        except Exception as e:
            logger.error(f"更新郵件發送記錄失敗: {e}")
        
        return {
            "success": True,
            "message": "啟用郵件已發送" if email_sent else "啟用連結已生成",
            "email_sent": email_sent,
            "token": new_token  # 僅用於測試，正式環境可移除
        }
        
    except Exception as e:
        logger.error(f"處理啟用郵件時發生錯誤 (user_id={user_id}): {e}")
        return {
            "success": False,
            "message": f"系統錯誤: {str(e)}",
            "email_sent": False
        }


def process_activation_emails_batch(
    users: List[Dict[str, Any]],
    clear_old_tokens: bool = True,
    check_password_strategy: bool = False
) -> List[Dict[str, Any]]:
    """
    批次處理多個使用者啟用郵件發送（效能優化版本）
    
    Args:
        users: 使用者列表，每個字典需包含:
            - user_id: int - 使用者ID
            - user_email: str - 電子郵件地址
            - user_name: str - 使用者姓名
        clear_old_tokens: 是否清除舊的啟用 token
        check_password_strategy: 是否檢查密碼策略
        
    Returns:
        List[Dict]: 處理結果列表，每個字典包含:
            - user_id: int - 使用者ID
            - success: bool - 是否成功
            - message: str - 處理訊息
            - email_sent: bool - 郵件是否發送成功
    """
    from app.dao.user import user_dao
    from app.dao.organization import UserOrganizationDAO
    from app.dao.config import ConfigDAO
    import secrets
    
    if not users:
        return []
    
    results = []
    org_dao = UserOrganizationDAO()
    
    logger.info(f"開始批次處理 {len(users)} 個使用者的啟用郵件")
    
    # 1. 批次檢查密碼策略（如果需要）
    user_ids = [user['user_id'] for user in users]
    users_to_process = {}
    
    if check_password_strategy:
        # 批次查詢所有使用者的密碼策略
        placeholders = ','.join(['%s'] * len(user_ids))
        ext_query = f"""
            SELECT user_id, password_strategy
            FROM user_extensions
            WHERE user_id IN ({placeholders})
        """
        ext_results = org_dao.execute_query(ext_query, user_ids)
        
        # 建立密碼策略映射
        password_strategies = {
            result['user_id']: result['password_strategy'] 
            for result in ext_results
        }
        
        # 過濾需要處理的使用者
        for user in users:
            user_id = user['user_id']
            strategy = password_strategies.get(user_id)
            
            if not strategy:
                logger.warning(f"找不到使用者擴充資訊: user_id={user_id}")
                results.append({
                    'user_id': user_id,
                    'success': False,
                    'message': "找不到使用者擴充資訊",
                    'email_sent': False
                })
            elif strategy != 'ACTIVATION_LINK':
                logger.info(f"使用者 {user_id} 密碼策略為 {strategy}，跳過啟用郵件")
                results.append({
                    'user_id': user_id,
                    'success': True,
                    'message': f"密碼策略為 {strategy}，無需發送啟用郵件",
                    'email_sent': False
                })
            else:
                users_to_process[user_id] = user
    else:
        # 不檢查策略，全部處理
        users_to_process = {user['user_id']: user for user in users}
    
    if not users_to_process:
        return results
    
    # 2. 批次清除舊 tokens（如果需要）
    if clear_old_tokens:
        for user_id in users_to_process.keys():
            try:
                user_dao.delete_user_activation_tokens(user_id, 'activation')
            except Exception as e:
                logger.warning(f"清除舊 token 失敗 user_id={user_id}: {e}")
    
    # 3. 取得啟用連結有效期限（只查詢一次）
    activation_expire_hours = 168  # 預設值 7 天
    try:
        config_dao = ConfigDAO()
        expire_value = config_dao.get_config_by_key('activation_token_expire_hours')
        if expire_value:
            activation_expire_hours = int(expire_value)
    except Exception as e:
        logger.warning(f"無法取得啟用連結有效期限設定，使用預設值 {activation_expire_hours} 小時: {e}")
    
    # 4. 批次生成 tokens 並創建記錄
    tokens_map = {}
    for user_id, user in users_to_process.items():
        try:
            # 生成 token
            new_token = secrets.token_urlsafe(32)
            tokens_map[user_id] = new_token
            
            # 創建 token 記錄
            token_success = user_dao.create_activation_token(
                user_id, new_token, 'activation', activation_expire_hours
            )
            
            if not token_success:
                logger.error(f"創建啟用 token 失敗: user_id={user_id}")
                results.append({
                    'user_id': user_id,
                    'success': False,
                    'message': "創建啟用 token 失敗",
                    'email_sent': False
                })
                del users_to_process[user_id]
                
        except Exception as e:
            logger.error(f"處理 token 失敗 user_id={user_id}: {e}")
            results.append({
                'user_id': user_id,
                'success': False,
                'message': f"處理失敗: {str(e)}",
                'email_sent': False
            })
            if user_id in users_to_process:
                del users_to_process[user_id]
    
    # 5. 取得郵件配置（只取一次）
    email_config = get_email_config()
    if not email_config:
        logger.warning("郵件配置不完整，無法發送任何啟用郵件")
        for user_id, user in users_to_process.items():
            results.append({
                'user_id': user_id,
                'success': True,
                'message': "啟用連結已生成，但郵件配置不完整",
                'email_sent': False
            })
        return results
    
    # 6. 批次發送郵件（可考慮使用執行緒池或非同步）
    successful_emails = []
    from concurrent.futures import ThreadPoolExecutor, as_completed
    import threading
    
    # 使用執行緒池並行發送郵件
    max_workers = min(10, len(users_to_process))  # 限制最多 10 個並行
    
    def send_email_task(user_id, user, token):
        """單一郵件發送任務"""
        try:
            email_sent = send_activation_email(
                user['user_email'], 
                token, 
                user['user_name'], 
                email_config
            )
            return user_id, email_sent, None
        except Exception as e:
            return user_id, False, str(e)
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # 提交所有郵件發送任務
        future_to_user = {
            executor.submit(
                send_email_task, 
                user_id, 
                user, 
                tokens_map[user_id]
            ): (user_id, user)
            for user_id, user in users_to_process.items()
            if user_id in tokens_map
        }
        
        # 收集結果
        for future in as_completed(future_to_user):
            user_id, user = future_to_user[future]
            try:
                result_user_id, email_sent, error = future.result()
                
                if email_sent:
                    logger.info(f"啟用郵件成功發送給: {user['user_email']} (user_id: {user_id})")
                    successful_emails.append(user_id)
                else:
                    if error:
                        logger.error(f"啟用郵件發送失敗: {user['user_email']} (user_id: {user_id}), 錯誤: {error}")
                    else:
                        logger.error(f"啟用郵件發送失敗: {user['user_email']} (user_id: {user_id})")
                
                results.append({
                    'user_id': user_id,
                    'success': True,
                    'message': "啟用郵件已發送" if email_sent else "啟用連結已生成",
                    'email_sent': email_sent,
                    'token': tokens_map.get(user_id)  # 僅用於測試
                })
                
            except Exception as e:
                logger.error(f"處理郵件發送結果時發生錯誤 user_id={user_id}: {e}")
                results.append({
                    'user_id': user_id,
                    'success': False,
                    'message': f"郵件發送失敗: {str(e)}",
                    'email_sent': False
                })
    
    # 7. 批次更新郵件發送狀態
    if successful_emails:
        try:
            # 批次更新成功發送的記錄
            placeholders = ','.join(['%s'] * len(successful_emails))
            update_query = f"""
                UPDATE user_extensions 
                SET activation_email_sent_at = NOW(), 
                    activation_email_count = COALESCE(activation_email_count, 0) + 1
                WHERE user_id IN ({placeholders})
            """
            org_dao.execute_update(update_query, successful_emails)
            logger.info(f"已批次更新 {len(successful_emails)} 個使用者的郵件發送記錄")
        except Exception as e:
            logger.error(f"批次更新郵件發送記錄失敗: {e}")
    
    successful_count = sum(1 for r in results if r.get('email_sent', False))
    logger.info(f"批次處理完成，成功發送 {successful_count}/{len(users)} 封啟用郵件")
    
    return results