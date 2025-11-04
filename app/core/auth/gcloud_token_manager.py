"""
Google Cloud Token Manager
管理 Google Cloud Platform 的認證和 token 更新

這個模組負責處理 Vertex AI 的認證，使用 Application Default Credentials (ADC)
或 Service Account Key 來取得和管理 access token。
"""

import os
import datetime
from typing import Optional, Tuple
from google.auth import default, exceptions as auth_exceptions
from google.auth.transport.requests import Request
from google.oauth2 import service_account
import json

from app.utils.logging import get_logger

logger = get_logger(__name__)


class GCloudTokenManager:
    """
    Google Cloud Token 管理器

    負責管理 GCP access token 的取得和更新。
    支援兩種認證方式：
    1. Application Default Credentials (ADC) - 自動從環境變數讀取
    2. Service Account Key - 從指定路徑讀取 JSON key 檔案
    """

    def __init__(self, credentials_path: Optional[str] = None):
        """
        初始化 Token Manager

        Args:
            credentials_path: 可選的憑證檔案路徑。如果不提供，將使用 ADC
        """
        self.credentials_path = credentials_path
        self.credentials = None
        self.project_id = None
        self.token = None
        self.token_expiry = None
        self._initialized = False

    def initialize(self) -> bool:
        """
        初始化憑證

        Returns:
            bool: 初始化成功返回 True，失敗返回 False
        """
        if self._initialized:
            return True

        try:
            self._initialize_credentials()
            self._initialized = True
            logger.info("GCloud Token Manager initialized successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize GCloud Token Manager: {e}")
            self._initialized = False
            return False

    def _initialize_credentials(self):
        """
        初始化 Google Cloud 憑證

        嘗試以下順序：
        1. 使用提供的 credentials_path
        2. 使用環境變數 GOOGLE_APPLICATION_CREDENTIALS
        3. 使用 gcloud 登入的 ADC
        """
        try:
            # 方法 1: 如果提供了特定的憑證路徑
            if self.credentials_path and os.path.exists(self.credentials_path):
                logger.info(f"Using credentials from: {self.credentials_path}")
                with open(self.credentials_path, 'r') as f:
                    key_data = json.load(f)

                self.credentials = service_account.Credentials.from_service_account_info(
                    key_data,
                    scopes=['https://www.googleapis.com/auth/cloud-platform']
                )
                self.project_id = key_data.get('project_id')
                logger.info(f"Loaded Service Account credentials for project: {self.project_id}")

            # 方法 2: 使用 Application Default Credentials
            else:
                logger.info("Using Application Default Credentials")
                self.credentials, self.project_id = default(
                    scopes=['https://www.googleapis.com/auth/cloud-platform']
                )

                # 檢查是否有環境變數設定
                env_cred_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
                if env_cred_path:
                    logger.info(f"Using credentials from environment variable: {env_cred_path}")
                else:
                    logger.info("Using gcloud default credentials")

                logger.info(f"GCloud credentials initialized for project: {self.project_id}")

        except auth_exceptions.DefaultCredentialsError as e:
            error_msg = (
                "無法找到 Google Cloud 憑證。請確認：\n"
                "1. 已建立 Service Account 並下載 key\n"
                "2. 將 key 檔案放在 ./credentials/vertex-ai-key.json\n"
                "3. 或執行 'gcloud auth application-default login'\n"
                f"錯誤詳情：{str(e)}"
            )
            logger.error(error_msg)
            raise ValueError(error_msg)

        except Exception as e:
            logger.error(f"Failed to initialize GCloud credentials: {e}")
            raise

    def get_token(self) -> str:
        """
        取得有效的 access token

        Returns:
            str: 有效的 access token

        Raises:
            ValueError: 如果未初始化或無法取得 token
        """
        if not self._initialized:
            if not self.initialize():
                raise ValueError("Token Manager 未初始化")

        # 檢查是否需要更新 token
        if not self.token or self._is_token_expired():
            self._refresh_token()

        return self.token

    def _refresh_token(self):
        """
        更新 access token

        Raises:
            Exception: 如果無法更新 token
        """
        try:
            logger.debug("Refreshing access token...")

            # 使用 google-auth 的 Request 物件來更新憑證
            request = Request()
            self.credentials.refresh(request)

            # 取得新的 token 和過期時間
            self.token = self.credentials.token
            self.token_expiry = self.credentials.expiry

            if self.token_expiry:
                logger.info(f"Access token refreshed, expires at: {self.token_expiry}")
            else:
                logger.info("Access token refreshed (no expiry information)")

        except Exception as e:
            error_msg = f"Failed to refresh access token: {e}"
            logger.error(error_msg)

            # 提供更詳細的錯誤資訊
            if "invalid_grant" in str(e).lower():
                error_msg += (
                    "\n可能的原因：\n"
                    "1. Service Account Key 已過期或被撤銷\n"
                    "2. 系統時間不正確\n"
                    "3. 權限不足\n"
                    "請重新建立 Service Account Key"
                )

            raise Exception(error_msg)

    def _is_token_expired(self) -> bool:
        """
        檢查 token 是否過期或即將過期

        Returns:
            bool: 如果 token 過期或即將在 5 分鐘內過期，返回 True
        """
        if not self.token_expiry:
            # 如果沒有過期資訊，保守地認為需要更新
            return True

        # 提前 5 分鐘更新，避免在使用時過期
        now = datetime.datetime.utcnow()
        if not self.token_expiry.tzinfo:
            # 如果 expiry 沒有時區資訊，假設是 UTC
            buffer_time = datetime.timedelta(minutes=5)
            return now >= (self.token_expiry - buffer_time)
        else:
            # 如果有時區資訊，轉換為 UTC 比較
            from datetime import timezone
            now_tz = now.replace(tzinfo=timezone.utc)
            buffer_time = datetime.timedelta(minutes=5)
            return now_tz >= (self.token_expiry - buffer_time)

    def get_project_id(self) -> Optional[str]:
        """
        取得當前的 GCP Project ID

        Returns:
            Optional[str]: Project ID，如果未初始化則返回 None
        """
        if not self._initialized:
            self.initialize()
        return self.project_id

    def validate_credentials(self) -> Tuple[bool, str]:
        """
        驗證憑證是否有效

        Returns:
            Tuple[bool, str]: (是否有效, 訊息)
        """
        try:
            # 嘗試初始化
            if not self._initialized:
                if not self.initialize():
                    return False, "無法初始化憑證"

            # 嘗試取得 token
            token = self.get_token()

            if token:
                return True, f"憑證有效 (Project: {self.project_id})"
            else:
                return False, "無法取得 access token"

        except Exception as e:
            return False, f"憑證驗證失敗: {str(e)}"

    def get_credentials_info(self) -> dict:
        """
        取得憑證相關資訊（用於除錯和狀態顯示）

        Returns:
            dict: 包含憑證資訊的字典
        """
        info = {
            "initialized": self._initialized,
            "project_id": self.project_id,
            "has_token": bool(self.token),
            "token_expired": self._is_token_expired() if self.token else None,
            "credentials_type": "unknown"
        }

        if self._initialized and self.credentials:
            # 判斷憑證類型
            if isinstance(self.credentials, service_account.Credentials):
                info["credentials_type"] = "service_account"
                info["service_account_email"] = getattr(self.credentials, "service_account_email", None)
            else:
                info["credentials_type"] = "application_default"

        # 檢查環境變數
        env_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
        if env_path:
            info["env_credentials_path"] = env_path
            info["env_credentials_exists"] = os.path.exists(env_path)

        return info

    def __del__(self):
        """清理資源"""
        # Google auth 物件會自動管理資源，這裡只需要清除引用
        self.credentials = None
        self.token = None


# 全域 Token Manager 實例（單例模式）
_global_token_manager: Optional[GCloudTokenManager] = None


def get_token_manager(credentials_path: Optional[str] = None) -> GCloudTokenManager:
    """
    取得全域的 Token Manager 實例（單例模式）

    Args:
        credentials_path: 可選的憑證檔案路徑

    Returns:
        GCloudTokenManager: Token Manager 實例
    """
    global _global_token_manager

    if _global_token_manager is None:
        _global_token_manager = GCloudTokenManager(credentials_path)

    return _global_token_manager


def reset_token_manager():
    """重置全域 Token Manager（用於測試或重新載入配置）"""
    global _global_token_manager
    if _global_token_manager:
        del _global_token_manager
        _global_token_manager = None