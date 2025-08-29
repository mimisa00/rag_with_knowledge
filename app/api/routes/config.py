"""
配置相關 API 路由
"""
from fastapi import APIRouter, Depends
from typing import Dict, Any

from app.config.settings import app_config
from app.api.dependencies import get_admin_user
from app.utils.logging import get_logger

logger = get_logger(__name__)

router = APIRouter()


@router.get("/config/get")
def get_config(current_user: Dict[str, Any] = Depends(get_admin_user)):
    """獲取系統配置（管理員專用）"""
    try:
        return app_config.all
    except Exception as e:
        logger.error(f"取得配置失敗: {e}")
        return {}


@router.get("/config/system-prompt")
def get_system_prompt(current_user: Dict[str, Any] = Depends(get_admin_user)):
    """獲取系統預設提示詞（管理員專用）"""
    try:
        system_prompt = app_config.get("system_prompt", "")
        return {"system_prompt": system_prompt}
    except Exception as e:
        logger.error(f"取得系統提示詞失敗: {e}")
        return {"system_prompt": ""}


@router.post("/config/update")
def update_config(
    new_config: dict, 
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """更新系統配置（管理員專用）"""
    try:
        app_config.update(new_config)
        
        # 更新 Ollama 模型選項
        from app.core.rag import update_ollama_model_options
        update_ollama_model_options()
        
        return {"status": "參數已儲存"}
    except Exception as e:
        logger.error(f"更新配置失敗: {e}")
        return {"status": "參數儲存失敗", "error": str(e)}