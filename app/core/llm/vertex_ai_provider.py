"""
Vertex AI Provider Implementation
使用 Google Cloud Vertex AI 提供的 Anthropic Claude 模型

這個 Provider 透過 Google Cloud Platform 的 Vertex AI 服務
來使用 Anthropic 的 Claude 模型，提供與其他 LLM Provider 相同的介面。
"""

import json
import time
import requests
from typing import Dict, Any, List, Generator, Optional, Union
from requests.exceptions import RequestException

from app.core.llm.base import BaseLLMProvider
from app.core.auth.gcloud_token_manager import get_token_manager, GCloudTokenManager
from app.utils.logging import get_logger

logger = get_logger(__name__)


class VertexAIProvider(BaseLLMProvider):
    """
    Vertex AI provider for Anthropic Claude on GCP

    透過 Google Cloud Platform 的 Vertex AI 服務使用 Claude 模型。
    支援所有 Claude 模型的功能，包括串流回應、系統提示等。
    """

    def __init__(self, config: Dict[str, Any]):
        """
        初始化 Vertex AI Provider

        Args:
            config: 包含以下配置的字典
                - project_id: GCP 專案 ID
                - location_id: 部署區域 (如 us-central1, europe-west4)
                - model: 模型 ID (如 claude-4-5-haiku@20251001)
                - anthropic_version: API 版本 (如 vertex-2023-10-16)
                - credentials_path: 可選的憑證檔案路徑
        """
        super().__init__(config)
        self.client = None
        self.token_manager: Optional[GCloudTokenManager] = None
        self._initialize_client()

    def _initialize_client(self):
        """
        初始化 Vertex AI client 和認證
        """
        try:
            # 建立 HTTP session
            self.client = requests.Session()
            self.client.headers.update({
                'Content-Type': 'application/json; charset=utf-8',
                'Accept': 'application/json'
            })

            # 初始化 Token Manager
            credentials_path = self.config.get('credentials_path')
            self.token_manager = get_token_manager(credentials_path)

            # 嘗試初始化並驗證
            if not self.token_manager.initialize():
                raise ValueError("無法初始化 Google Cloud 認證")

            logger.info("Vertex AI client initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize Vertex AI client: {e}")
            raise

    def _build_endpoint_url(self, stream: bool = False) -> str:
        """
        建立 Vertex AI 端點 URL

        Args:
            stream: 是否為串流請求

        Returns:
            str: 完整的 API 端點 URL
        """
        project_id = self.config.get('project_id', '')
        location_id = self.config.get('location_id', 'us-central1')
        model = self.config.get('model', 'claude-4-5-haiku@20251001')

        # 根據是否串流選擇不同的方法
        method = 'streamRawPredict' if stream else 'rawPredict'

        # 注意：某些區域使用不同的端點格式
        if location_id == 'global':
            base_url = "https://aiplatform.googleapis.com/v1"
        else:
            base_url = f"https://{location_id}-aiplatform.googleapis.com/v1"

        endpoint = f"{base_url}/projects/{project_id}/locations/{location_id}/publishers/anthropic/models/{model}:{method}"

        logger.debug(f"Built endpoint URL: {endpoint}")
        return endpoint

    def _convert_messages_to_anthropic_format(self, messages: List[Dict[str, str]]) -> tuple:
        """
        將通用訊息格式轉換為 Anthropic 格式

        Args:
            messages: 通用格式的訊息列表

        Returns:
            tuple: (system_prompt, conversation_messages)
        """
        system_prompt = ""
        conversation_messages = []

        for msg in messages:
            role = msg.get('role', '')
            content = msg.get('content', '')

            if role == 'system':
                # Anthropic 使用獨立的 system 參數
                system_prompt = content
            elif role == 'user':
                conversation_messages.append({
                    "role": "user",
                    "content": [{"type": "text", "text": content}]
                })
            elif role == 'assistant':
                conversation_messages.append({
                    "role": "assistant",
                    "content": [{"type": "text", "text": content}]
                })

        return system_prompt, conversation_messages

    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 1024,
        stream: bool = False,
        **kwargs
    ) -> Union[Generator[str, None, None], str]:
        """
        生成對話回應

        Args:
            messages: 訊息列表
            model: 模型名稱（會覆蓋配置中的模型）
            temperature: 溫度參數（0-2）
            max_tokens: 最大 token 數
            stream: 是否使用串流回應
            **kwargs: 其他參數（如 top_p, top_k 等）

        Returns:
            如果 stream=True，返回生成器；否則返回完整回應字串
        """
        if not self.client or not self.token_manager:
            raise RuntimeError("Vertex AI client not initialized")

        try:
            # 取得有效的 access token
            access_token = self.token_manager.get_token()

            # 如果提供了模型參數，更新配置
            if model:
                self.config['model'] = model

            # 建立端點 URL
            endpoint_url = self._build_endpoint_url(stream=stream)

            # 轉換訊息格式
            system_prompt, conversation_messages = self._convert_messages_to_anthropic_format(messages)

            # 建立請求 payload
            payload = {
                "anthropic_version": self.config.get('anthropic_version', 'vertex-2023-10-16'),
                "messages": conversation_messages,
                "max_tokens": max_tokens,
                "stream": stream
            }

            # 加入系統提示（如果有）
            if system_prompt:
                payload["system"] = system_prompt

            # 處理溫度參數
            # Vertex AI 的 Anthropic API 支援 temperature 或 top_p，但不能同時使用
            if 'top_p' in kwargs:
                payload['top_p'] = kwargs['top_p']
            else:
                payload['temperature'] = temperature

            # 加入其他支援的參數
            if 'top_k' in kwargs:
                payload['top_k'] = kwargs['top_k']
            if 'stop_sequences' in kwargs:
                payload['stop_sequences'] = kwargs['stop_sequences']

            # 設定請求 headers
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json; charset=utf-8"
            }

            # 發送請求
            if stream:
                return self._handle_stream_response(endpoint_url, headers, payload)
            else:
                return self._handle_sync_response(endpoint_url, headers, payload)

        except Exception as e:
            logger.error(f"Vertex AI chat completion failed: {e}")
            error_msg = self._format_error_message(e)
            if stream:
                def error_generator():
                    yield self.format_streaming_response(f"錯誤: {error_msg}", error=True)
                return error_generator()
            else:
                raise Exception(error_msg)

    def _handle_stream_response(self, url: str, headers: dict, payload: dict) -> Generator[str, None, None]:
        """
        處理串流回應

        Args:
            url: API 端點
            headers: 請求 headers
            payload: 請求 payload

        Yields:
            格式化的串流回應
        """
        try:
            response = self.client.post(
                url,
                headers=headers,
                json=payload,
                stream=True,
                timeout=120.0
            )
            response.raise_for_status()

            # 處理 Server-Sent Events (SSE)
            for line in response.iter_lines():
                if line:
                    decoded_line = line.decode('utf-8')

                    # SSE 格式：data: {json}
                    if decoded_line.startswith("data: "):
                        data_str = decoded_line[6:]  # 移除 "data: " 前綴

                        # 跳過 [DONE] 標記
                        if data_str.strip() == "[DONE]":
                            break

                        try:
                            chunk_data = json.loads(data_str)

                            # 根據 Anthropic 的回應格式處理
                            if chunk_data.get('type') == 'content_block_delta':
                                delta = chunk_data.get('delta', {})
                                content = delta.get('text', '')
                                if content:
                                    yield self.format_streaming_response(content)

                            elif chunk_data.get('type') == 'message_delta':
                                # 處理使用量資訊等
                                pass

                            elif chunk_data.get('type') == 'error':
                                error_msg = chunk_data.get('error', {}).get('message', 'Unknown error')
                                yield self.format_streaming_response(f"錯誤: {error_msg}", error=True)
                                break

                        except json.JSONDecodeError as e:
                            logger.warning(f"Failed to parse streaming chunk: {data_str[:100]}...")
                            continue

        except requests.exceptions.HTTPError as e:
            error_msg = self._extract_error_from_response(e.response)
            yield self.format_streaming_response(f"錯誤: {error_msg}", error=True)

        except Exception as e:
            logger.error(f"Stream processing error: {e}")
            yield self.format_streaming_response(f"串流處理錯誤: {str(e)}", error=True)

    def _handle_sync_response(self, url: str, headers: dict, payload: dict) -> str:
        """
        處理同步（非串流）回應

        Args:
            url: API 端點
            headers: 請求 headers
            payload: 請求 payload

        Returns:
            完整的回應文字
        """
        try:
            response = self.client.post(
                url,
                headers=headers,
                json=payload,
                timeout=120.0
            )
            response.raise_for_status()

            data = response.json()

            # 從 Anthropic 回應格式中提取文字
            if 'content' in data and len(data['content']) > 0:
                text_content = ""
                for content_block in data['content']:
                    if content_block.get('type') == 'text':
                        text_content += content_block.get('text', '')
                return text_content

            return ""

        except requests.exceptions.HTTPError as e:
            error_msg = self._extract_error_from_response(e.response)
            raise Exception(error_msg)

    def _extract_error_from_response(self, response) -> str:
        """
        從 HTTP 回應中提取錯誤訊息

        Args:
            response: requests Response 物件

        Returns:
            格式化的錯誤訊息
        """
        try:
            error_data = response.json()
            if 'error' in error_data:
                error_info = error_data['error']
                if isinstance(error_info, dict):
                    return error_info.get('message', str(error_info))
                return str(error_info)
            return response.text
        except:
            return f"HTTP {response.status_code}: {response.text[:200]}"

    def _format_error_message(self, error: Exception) -> str:
        """
        格式化錯誤訊息，提供解決建議

        Args:
            error: 錯誤例外

        Returns:
            格式化的錯誤訊息
        """
        error_str = str(error).lower()

        if "could not find default credentials" in error_str:
            return (
                "找不到 Google Cloud 憑證。\n"
                "請確認：\n"
                "1. 已建立 Service Account 並下載 key\n"
                "2. 將 key 放在 ./credentials/vertex-ai-key.json\n"
                "3. 重啟服務：docker compose restart backend"
            )
        elif "permission denied" in error_str or "403" in error_str:
            return (
                "權限不足。\n"
                "請確認 Service Account 有以下角色：\n"
                "- Vertex AI User (roles/aiplatform.user)\n"
                "- 或 Vertex AI Administrator"
            )
        elif "404" in error_str:
            return (
                "找不到指定的模型或專案。\n"
                "請確認：\n"
                "1. Project ID 正確\n"
                "2. Location 支援該模型\n"
                "3. 模型 ID 格式正確"
            )
        elif "invalid_grant" in error_str:
            return (
                "憑證無效或已過期。\n"
                "請重新建立 Service Account Key"
            )
        else:
            return f"Vertex AI 錯誤: {str(error)}"

    def test_connection(self) -> Dict[str, Any]:
        """
        測試連線和配置

        Returns:
            包含測試結果的字典
        """
        try:
            # 檢查 Token Manager
            if not self.token_manager:
                return {
                    "success": False,
                    "error": "Token Manager 未初始化"
                }

            # 驗證憑證
            valid, message = self.token_manager.validate_credentials()
            if not valid:
                return {
                    "success": False,
                    "error": f"憑證驗證失敗: {message}"
                }

            # 檢查必要配置
            project_id = self.config.get('project_id')
            if not project_id:
                return {
                    "success": False,
                    "error": "未設定 Project ID"
                }

            # 嘗試簡單的 API 呼叫
            test_messages = [{"role": "user", "content": "Hi"}]

            # 使用非串流模式測試
            result = self.chat_completion(
                messages=test_messages,
                max_tokens=10,
                stream=False
            )

            if result:
                return {
                    "success": True,
                    "message": f"成功連接到 Vertex AI",
                    "project_id": project_id,
                    "location": self.config.get('location_id', 'us-central1'),
                    "model": self.config.get('model', 'claude-4-5-haiku@20251001'),
                    "credentials_info": self.token_manager.get_credentials_info()
                }
            else:
                return {
                    "success": False,
                    "error": "測試呼叫未返回結果"
                }

        except Exception as e:
            logger.error(f"Vertex AI connection test failed: {e}")
            error_msg = self._format_error_message(e)
            return {
                "success": False,
                "error": error_msg,
                "details": str(e)
            }

    def list_models(self) -> List[str]:
        """
        列出可用的模型

        Returns:
            模型 ID 列表
        """
        # Vertex AI 上可用的 Claude 模型
        # 注意：實際可用的模型取決於區域和專案配額
        return [
            "claude-4-5-haiku@20251001",
            "claude-4-5-sonnet@20250929",
            "claude-4-1-opus@20250805"
        ]

    def get_required_config_fields(self) -> List[str]:
        """
        取得必要的配置欄位

        Returns:
            必要欄位列表
        """
        return ['project_id']  # 最少只需要 project_id，其他有預設值

    def get_default_model(self) -> str:
        """
        取得預設模型

        Returns:
            預設模型 ID
        """
        return self.config.get('model', 'claude-4-5-haiku@20251001')

    def validate_config(self) -> tuple[bool, str]:
        """
        驗證配置是否有效

        Returns:
            tuple: (是否有效, 錯誤訊息)
        """
        # 檢查必要欄位
        project_id = self.config.get('project_id')
        if not project_id:
            return False, "缺少必要配置：project_id"

        # 檢查 project_id 格式
        if not project_id.replace("-", "").replace("_", "").isalnum():
            return False, "Project ID 格式不正確"

        # 檢查 location
        location = self.config.get('location_id', 'us-central1')
        valid_locations = [
            'us-central1', 'us-east5', 'us-west1', 'us-west4',
            'europe-west1', 'europe-west2', 'europe-west4',
            'asia-southeast1', 'asia-northeast1'
        ]
        if location not in valid_locations:
            return False, f"不支援的 location: {location}"

        return True, "配置有效"

    def get_usage_info(self) -> Dict[str, Any]:
        """
        取得使用資訊（Vertex AI 不提供即時使用資訊）

        Returns:
            使用資訊字典
        """
        return {
            "provider": "vertex_ai",
            "project_id": self.config.get('project_id'),
            "location": self.config.get('location_id', 'us-central1'),
            "model": self.config.get('model'),
            "note": "使用資訊請查看 GCP Console"
        }

    def __del__(self):
        """清理資源"""
        if self.client:
            self.client.close()
        self.token_manager = None