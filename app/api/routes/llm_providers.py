"""
LLM Provider 管理 API 路由

提供 LLM Provider 相關的管理功能：
- 測試連線
- 列出可用模型
- 驗證配置
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

from app.api.dependencies import get_current_user
from app.core.security.permissions import permission_required
from app.core.llm.factory import LLMFactory
from app.config.settings import app_config
from app.dao.config import config_dao
from app.utils.logging import get_logger

logger = get_logger(__name__)

router = APIRouter()


class TestConnectionRequest(BaseModel):
    """測試連線請求模型"""
    provider: str
    config: Optional[Dict[str, Any]] = None


class ProviderConfig(BaseModel):
    """Provider 配置模型"""
    provider: str
    api_key: Optional[str] = None
    api_base: Optional[str] = None
    model: Optional[str] = None
    organization: Optional[str] = None
    api_version: Optional[str] = None


@router.post("/test-connection")
@permission_required("ADMIN.CONFIG")
async def test_connection(
    request: TestConnectionRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    測試 LLM Provider 連線

    Args:
        request: 包含 provider 類型和配置的請求
        current_user: 當前用戶

    Returns:
        連線測試結果
    """
    try:
        provider_type = request.provider.lower()

        # 如果提供了臨時配置，使用臨時配置
        if request.config:
            # 建立臨時配置
            temp_config = {}

            if provider_type == 'ollama':
                temp_config['api_base'] = request.config.get('api_base', 'http://ollama:11434')
                temp_config['model'] = request.config.get('model', 'gemma3:4b')

            elif provider_type == 'openai':
                temp_config['api_key'] = request.config.get('api_key', '')
                temp_config['api_base'] = request.config.get('api_base', 'https://api.openai.com/v1')
                temp_config['model'] = request.config.get('model', 'gpt-4-turbo-preview')
                temp_config['organization'] = request.config.get('organization', '')

            elif provider_type == 'anthropic':
                temp_config['api_key'] = request.config.get('api_key', '')
                temp_config['api_base'] = request.config.get('api_base', 'https://api.anthropic.com')
                temp_config['model'] = request.config.get('model', 'claude-3-5-sonnet-20241022')
                temp_config['api_version'] = request.config.get('api_version', '2023-06-01')

            elif provider_type == 'vertex_ai':
                temp_config['project_id'] = request.config.get('project_id', '')
                temp_config['location_id'] = request.config.get('location_id', 'us-central1')
                temp_config['model'] = request.config.get('model', 'claude-4-5-haiku@20251001')
                temp_config['anthropic_version'] = request.config.get('anthropic_version', 'vertex-2023-10-16')
                temp_config['credentials_path'] = request.config.get('credentials_path', '')

            else:
                raise ValueError(f"不支援的 Provider: {provider_type}")

            # 使用 Factory 建立 provider 並測試
            provider = LLMFactory.PROVIDERS[provider_type](temp_config)
            result = provider.test_connection()

        else:
            # 使用系統配置測試
            result = LLMFactory.test_provider_connection(provider_type)

        logger.info(f"用戶 {current_user['username']} 測試 {provider_type} 連線: {result}")
        return result

    except Exception as e:
        logger.error(f"測試連線失敗: {e}")
        return {
            "success": False,
            "error": str(e)
        }


@router.get("/models")
@permission_required("ADMIN.CONFIG")
async def list_models(
    provider: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> List[str]:
    """
    列出指定 Provider 的可用模型

    Args:
        provider: Provider 類型
        current_user: 當前用戶

    Returns:
        模型列表
    """
    try:
        provider_type = provider.lower()
        models = LLMFactory.get_provider_models(provider_type)

        logger.info(f"用戶 {current_user['username']} 查詢 {provider_type} 模型列表")
        return models

    except Exception as e:
        logger.error(f"獲取模型列表失敗: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/providers")
@permission_required("ADMIN.CONFIG")
async def list_providers(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> List[str]:
    """
    列出所有可用的 LLM Provider

    Args:
        current_user: 當前用戶

    Returns:
        Provider 列表
    """
    try:
        providers = LLMFactory.list_available_providers()
        logger.info(f"用戶 {current_user['username']} 查詢可用 Provider 列表")
        return providers

    except Exception as e:
        logger.error(f"獲取 Provider 列表失敗: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/validate-config")
@permission_required("ADMIN.CONFIG")
async def validate_config(
    config: ProviderConfig,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    驗證 Provider 配置

    Args:
        config: Provider 配置
        current_user: 當前用戶

    Returns:
        驗證結果
    """
    try:
        provider_type = config.provider.lower()

        # 檢查必要欄位
        if provider_type in ['openai', 'anthropic'] and not config.api_key:
            return {
                "valid": False,
                "message": f"{provider_type} 需要 API Key"
            }

        # 建立臨時配置並測試
        temp_config = {
            'api_key': config.api_key,
            'api_base': config.api_base,
            'model': config.model,
        }

        if provider_type == 'openai' and config.organization:
            temp_config['organization'] = config.organization
        elif provider_type == 'anthropic' and config.api_version:
            temp_config['api_version'] = config.api_version

        # 測試配置
        provider = LLMFactory.PROVIDERS[provider_type](temp_config)
        result = provider.test_connection()

        if result.get('success'):
            return {
                "valid": True,
                "message": "配置有效"
            }
        else:
            return {
                "valid": False,
                "message": result.get('error', '配置無效')
            }

    except Exception as e:
        logger.error(f"驗證配置失敗: {e}")
        return {
            "valid": False,
            "message": str(e)
        }


@router.get("/vertex-ai/key-status")
@permission_required("ADMIN.CONFIG")
async def check_vertex_ai_key_status(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    檢查 Vertex AI 憑證狀態

    Returns:
        憑證狀態資訊
    """
    try:
        from app.core.auth.gcloud_token_manager import get_token_manager
        import os

        # 取得 Token Manager
        token_manager = get_token_manager()

        # 檢查環境變數
        env_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
        key_exists = False
        key_info = {}

        if env_path:
            key_exists = os.path.exists(env_path)
            if key_exists:
                # 嘗試讀取 key 檔案的基本資訊
                try:
                    import json
                    with open(env_path, 'r') as f:
                        key_data = json.load(f)
                        key_info = {
                            "type": key_data.get("type", "unknown"),
                            "project_id": key_data.get("project_id", ""),
                            "client_email": key_data.get("client_email", ""),
                        }
                except Exception as e:
                    logger.warning(f"無法讀取憑證檔案資訊: {e}")

        # 驗證憑證
        is_valid = False
        validation_message = ""

        try:
            is_valid, validation_message = token_manager.validate_credentials()
        except Exception as e:
            validation_message = f"驗證失敗: {str(e)}"

        # 取得詳細資訊
        credentials_info = token_manager.get_credentials_info() if token_manager else {}

        result = {
            "status": "valid" if is_valid else "invalid",
            "message": validation_message,
            "env_path": env_path,
            "key_exists": key_exists,
            "key_info": key_info,
            "credentials_info": credentials_info,
            "setup_required": not key_exists or not is_valid
        }

        logger.info(f"用戶 {current_user['username']} 檢查 Vertex AI 憑證狀態: {result['status']}")
        return result

    except Exception as e:
        logger.error(f"檢查 Vertex AI 憑證狀態失敗: {e}")
        return {
            "status": "error",
            "message": str(e),
            "setup_required": True
        }


@router.post("/vertex-ai/validate-setup")
@permission_required("ADMIN.CONFIG")
async def validate_vertex_ai_setup(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    驗證 Vertex AI 完整設定

    Returns:
        驗證結果
    """
    try:
        # 從資料庫讀取配置
        config = config_dao.get_all_configs()

        project_id = config.get('vertex_ai_project_id', '')
        location_id = config.get('vertex_ai_location_id', 'us-central1')
        model_id = config.get('vertex_ai_model_id', 'claude-4-5-haiku@20251001')

        # 檢查必要配置
        if not project_id:
            return {
                "valid": False,
                "message": "未設定 GCP Project ID",
                "missing_fields": ["project_id"]
            }

        # 建立 Provider 並測試
        from app.core.llm.vertex_ai_provider import VertexAIProvider

        provider_config = {
            'project_id': project_id,
            'location_id': location_id,
            'model': model_id,
            'anthropic_version': config.get('vertex_ai_anthropic_version', 'vertex-2023-10-16')
        }

        provider = VertexAIProvider(provider_config)
        test_result = provider.test_connection()

        logger.info(f"用戶 {current_user['username']} 驗證 Vertex AI 設定: {test_result}")

        return {
            "valid": test_result.get("success", False),
            "message": test_result.get("message", "") or test_result.get("error", "未知錯誤"),
            "details": test_result
        }

    except Exception as e:
        logger.error(f"驗證 Vertex AI 設定失敗: {e}")
        return {
            "valid": False,
            "message": str(e)
        }