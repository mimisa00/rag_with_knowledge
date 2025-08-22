"""
路徑配置模組
"""
import os
from typing import Dict
from app.utils.logging import get_logger

logger = get_logger(__name__)


class PathConfig:
    """路徑配置類別"""
    
    @staticmethod
    def get_base_paths() -> Dict[str, str]:
        """獲取基礎路徑配置"""
        base_dir = os.path.dirname(os.path.dirname(__file__))  # app/ 目錄
        parent_dir = os.path.dirname(base_dir)  # 專案根目錄
        
        return {
            "BASE_DIR": base_dir,
            "STATIC_DIR": os.path.join(parent_dir, "frontend", "static"),
            "DOC_PATH": os.path.join(parent_dir, "documents"),
            "FAISS_DIR": os.getenv("FAISS_DIR", os.path.join(parent_dir, "faiss_data")),
            "MODELS_DIR": os.path.join(parent_dir, "models"),
            "LOGS_DIR": os.path.join(parent_dir, "logs"),
        }
    
    @staticmethod
    def get_html_paths() -> Dict[str, str]:
        """獲取 HTML 檔案路徑"""
        static_dir = PathConfig.get_base_paths()["STATIC_DIR"]
        
        return {
            "HTML_PATH_DASHBOARD": os.path.join(static_dir, "dashboard.html"),
            "HTML_PATH_DASHBOARD_ADMIN": os.path.join(static_dir, "dashboard_admin.html"),
            "HTML_PATH_ADMIN": os.path.join(static_dir, "admin.html"),
            "HTML_PATH_KNOWLEDGE_BASE": os.path.join(static_dir, "admin", "knowledge-base.html"),
            "HTML_PATH_SYSTEM_PARAMS": os.path.join(static_dir, "admin", "system-params.html"),
            "HTML_PATH_USER_MANAGEMENT": os.path.join(static_dir, "admin", "user-management.html"),
            "HTML_PATH_ORGANIZATION": os.path.join(static_dir, "admin", "organization.html"),
            "HTML_PATH_LOGIN": os.path.join(static_dir, "login.html"),
            "HTML_PATH_REGISTER": os.path.join(static_dir, "register.html"),
            "HTML_PATH_SHOWINDEX": os.path.join(static_dir, "showindex.html"),
            "HTML_PATH_MD_VIEWER": os.path.join(static_dir, "md_viewer.html"),
        }


# 配置實例
path_config = PathConfig()