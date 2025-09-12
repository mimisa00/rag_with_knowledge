"""
配置相關 API 路由
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any
from pydantic import BaseModel

from app.config.settings import app_config
from app.api.dependencies import get_admin_user
from app.utils.logging import get_logger
from app.models.response import BaseResponse

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


@router.get("/config/activation-expire-hours")
def get_activation_expire_hours(current_user: Dict[str, Any] = Depends(get_admin_user)):
    """取得啟用連結有效期限（小時）"""
    try:
        from app.dao.config import ConfigDAO
        config_dao = ConfigDAO()
        hours = config_dao.get_config_by_key('activation_token_expire_hours')
        return {
            "key": "activation_token_expire_hours",
            "value": hours or "168",
            "hours": int(hours) if hours else 168,
            "days": (int(hours) // 24) if hours else 7
        }
    except Exception as e:
        logger.error(f"取得啟用連結有效期限失敗: {e}")
        return {
            "key": "activation_token_expire_hours",
            "value": "168",
            "hours": 168,
            "days": 7
        }


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


class TestEmailRequest(BaseModel):
    """測試郵件請求模型"""
    email: str


@router.post("/config/test-email", response_model=BaseResponse)
def send_test_email(
    request: TestEmailRequest,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """發送測試郵件（管理員專用）"""
    try:
        # 導入郵件發送功能
        from app.core.email import send_test_email as send_email_test
        
        # 獲取當前郵件配置
        smtp_config = {
            'smtp_host': app_config.get('smtp_host', 'smtp.gmail.com'),
            'smtp_port': int(app_config.get('smtp_port', 587)),
            'smtp_use_tls': app_config.get('smtp_use_tls', 'true').lower() == 'true',
            'smtp_username': app_config.get('smtp_username', ''),
            'smtp_password': app_config.get('smtp_password', ''),
            'mail_from_email': app_config.get('mail_from_email', ''),
            'mail_from_name': app_config.get('mail_from_name', 'E-Helper系統'),
        }
        
        # 檢查必要的郵件設定
        if not smtp_config['smtp_username'] or not smtp_config['smtp_password']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="請先設定 SMTP 使用者名稱和密碼"
            )
            
        if not smtp_config['mail_from_email']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="請先設定寄件者信箱"
            )
        
        # 發送測試郵件
        success = send_email_test(request.email, smtp_config)
        
        if success:
            return BaseResponse(
                success=True,
                message=f"測試郵件已成功發送至 {request.email}"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="測試郵件發送失敗"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"發送測試郵件失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"發送測試郵件失敗: {str(e)}"
        )