"""
統一的 LLM 客戶端模組

提供與原始 ollama_client.py 相容的介面，
但支援多種 LLM provider (Ollama, OpenAI, Anthropic 等)
"""

import os
from typing import Dict, Any, Optional, Generator, List, Union
from app.core.llm.factory import LLMFactory
from app.core.llm.base import BaseLLMProvider
from app.config.settings import app_config
from app.utils.logging import get_logger

logger = get_logger(__name__)

# 全域變數，保持與原始 ollama_client.py 相同的結構
llm_client = None


def initialize_ollama_client():
    """
    初始化 LLM 客戶端
    函數名稱保持與原始相同以確保向後兼容
    """
    global llm_client

    try:
        # 重新從資料庫載入配置以確保使用最新值
        from app.dao.config import config_dao
        fresh_config = config_dao.get_all_configs()

        # 更新 app_config 快取
        app_config._config_cache = fresh_config

        # 從最新配置獲取 provider 類型
        provider_type = fresh_config.get("llm_provider", "ollama")
        logger.info(f"從資料庫載入 LLM provider 配置: {provider_type}")

        # 使用 Factory 創建適當的 provider
        llm_provider = LLMFactory.create_provider(provider_type)

        # 創建一個包裝器以提供與原始 ollama.Client 相同的介面
        llm_client = LLMClientWrapper(llm_provider, provider_type)

        logger.info(f"LLM 客戶端初始化成功，使用 provider: {provider_type}")
        return llm_client

    except Exception as e:
        logger.error(f"初始化 LLM 客戶端失敗: {e}")
        raise


def get_ollama_client():
    """
    獲取 LLM 客戶端實例
    函數名稱保持與原始相同以確保向後兼容
    """
    if llm_client is None:
        return initialize_ollama_client()
    return llm_client


def get_model_options() -> Dict[str, Any]:
    """
    獲取模型選項配置
    與原始 ollama_client.py 完全相同
    """
    config = app_config.all

    options = {
        "num_ctx": int(config.get("num_ctx", "6144")),
        "repeat_last_n": int(config.get("repeat_last_n", "64")),
        "repeat_penalty": float(config.get("repeat_penalty", "1.1")),
        "temperature": float(config.get("temperature", "0.5")),
        "seed": int(config.get("seed", "0")),
        "stop": [config.get("stop", "")],
        "num_predict": int(config.get("num_predict", "2048")),
        "top_k": int(config.get("top_k", "10")),
        "top_p": float(config.get("top_p", "0.9")),
        "min_p": float(config.get("min_p", "0.0")),
    }

    # 支援動態 keep_alive 設定
    keep_alive = os.getenv("OLLAMA_KEEP_ALIVE")
    if keep_alive:
        options["keep_alive"] = keep_alive
        logger.debug(f"使用 keep_alive 設定: {keep_alive}")

    return options


def update_ollama_model_options():
    """
    更新模型參數
    與原始 ollama_client.py 相同
    """
    # 重新初始化 client 以使用最新配置
    global llm_client
    llm_client = None  # 清除舊的實例
    client = get_ollama_client()  # 這會觸發重新初始化

    # 從資料庫重新載入配置
    from app.dao.config import config_dao
    config = config_dao.get_all_configs()

    try:
        # 對於非 Ollama provider，只測試連接
        if hasattr(client, 'test_connection'):
            result = client.test_connection()
            if result.get("success"):
                logger.info(f"LLM 模型參數更新成功")
            return

        # 對於 Ollama，執行原始邏輯
        options = get_model_options()
        client.generate(
            model=config.get("llm_model", "gemma3:4b"),
            prompt="TEST",
            options=options,
            stream=False,
        )
        logger.info(f"Ollama 模型參數更新成功，keep_alive: {options.get('keep_alive', '預設')}")
    except Exception as e:
        logger.error(f"更新模型參數失敗: {e}")


def test_connection() -> Dict[str, Any]:
    """
    測試 LLM 連接
    新增功能，用於測試各種 provider 的連接
    """
    try:
        client = get_ollama_client()
        if hasattr(client, 'test_connection'):
            return client.test_connection()
        else:
            # 向後兼容：如果是原始 Ollama client
            return {"success": True, "message": "Connected to Ollama"}
    except Exception as e:
        logger.error(f"連接測試失敗: {e}")
        return {"success": False, "error": str(e)}


class LLMClientWrapper:
    """
    包裝器類別，提供與原始 ollama.Client 相同的介面
    這樣 query.py 中的代碼可以完全不變
    """

    def __init__(self, provider: BaseLLMProvider, provider_type: str):
        self.provider = provider
        self.provider_type = provider_type
        self.config = app_config.all

    def chat(self, model: str, messages: list, stream: bool = False,
             options: dict = None, think: bool = False, **kwargs):
        """
        提供與 ollama.Client.chat 相同的介面
        query.py 中使用這個方法
        """
        try:
            # 準備調用參數
            call_kwargs = {}

            # 對於 Ollama provider，傳遞原生 think 參數
            if self.provider_type == "ollama" and think:
                call_kwargs['think'] = think

            # 對於 OpenAI provider（含 vLLM 部署），傳遞 think 以觸發 reasoning_effort
            elif self.provider_type == "openai" and think:
                call_kwargs['think'] = think

            # 合併 options 到 kwargs
            if options:
                # 轉換 Ollama 特定的選項名稱到通用名稱
                if 'num_predict' in options:
                    call_kwargs['max_tokens'] = options['num_predict']
                if 'temperature' in options:
                    call_kwargs['temperature'] = options['temperature']

                # 保留其他 Ollama 特定選項
                for key, value in options.items():
                    if key not in ['num_predict', 'temperature']:
                        call_kwargs[key] = value

            # 調用 provider
            result = self.provider.chat_completion(
                messages=messages,
                model=model,
                stream=stream,
                **call_kwargs
            )

            if stream:
                # 對於串流回應，需要轉換為 Ollama 格式
                return self._convert_stream_to_ollama_format(result, think)
            else:
                # 對於非串流回應，轉換為 Ollama 格式
                return self._convert_response_to_ollama_format(result)

        except Exception as e:
            logger.error(f"Chat completion failed: {e}")
            raise

    def _convert_stream_to_ollama_format(self, stream, think: bool = False):
        """
        將 provider 的串流回應轉換為 Ollama 格式
        query.py 期望的格式: chunk.message.content 和 chunk.message.thinking
        """
        import json

        class OllamaChunk:
            def __init__(self, content="", thinking=""):
                self.message = type('obj', (object,), {
                    'content': content,
                    'thinking': thinking if think else ""
                })()

        for chunk in stream:
            # 解析 JSON 格式的串流回應
            try:
                data = json.loads(chunk)
                content = data.get("content", "")
                thinking = data.get("thinking", "")
                yield OllamaChunk(content, thinking)
            except json.JSONDecodeError:
                # 如果不是 JSON，假設是純文本內容
                yield OllamaChunk(chunk)

    def _convert_response_to_ollama_format(self, response):
        """
        將 provider 的回應轉換為 Ollama 格式
        """
        class OllamaResponse:
            def __init__(self, content):
                self.message = type('obj', (object,), {'content': content})()

        return OllamaResponse(response)

    def generate(self, model: str, prompt: str, options: dict = None,
                 stream: bool = False, **kwargs):
        """
        提供與 ollama.Client.generate 相同的介面
        主要用於 update_ollama_model_options
        """
        messages = [{"role": "user", "content": prompt}]
        return self.chat(model, messages, stream, options, **kwargs)

    def list(self):
        """
        提供與 ollama.Client.list 相同的介面
        """
        try:
            models = self.provider.list_models()
            return {
                'models': [{'name': model} for model in models]
            }
        except Exception as e:
            logger.error(f"List models failed: {e}")
            return {'models': []}

    def test_connection(self):
        """
        測試連接的包裝方法
        """
        return self.provider.test_connection()


# 向後兼容的別名
get_llm_client = get_ollama_client
initialize_llm_client = initialize_ollama_client


def get_current_model() -> str:
    """
    根據當前 provider 獲取正確的模型名稱
    """
    from app.dao.config import config_dao
    config = config_dao.get_all_configs()
    provider_type = config.get("llm_provider", "ollama")

    if provider_type == "anthropic":
        return config.get("anthropic_model", "claude-sonnet-4-5")
    elif provider_type == "openai":
        return config.get("openai_model", "gpt-4-turbo-preview")
    elif provider_type == "vertex_ai":
        return config.get("vertex_ai_model_id", "claude-4-5-haiku@20251001")
    else:  # ollama
        return config.get("llm_model", "gemma3:4b")


def noun_analysis_stream(question: str) -> Generator[str, None, None]:
    """
    名詞分析功能 - 流式回應
    與原始 ollama_client.py 相同
    """
    client = get_ollama_client()
    config = app_config.all

    try:
        prompt = config.get("noun_analysis_prompt", "{question}").replace("{question}", question)
        messages = [{"role": "user", "content": prompt}]

        # 使用包裝器的 chat 方法
        for chunk in client.chat(
            model=get_current_model(),
            messages=messages,
            stream=True,
            options=get_model_options(),
        ):
            yield chunk

    except Exception as e:
        logger.error(f"名詞分析失敗: {e}")
        yield f"# 分析失敗: {str(e)}"


def rag_query_stream(
    prompt: str,
    model: str = None,
    context: str = "",
    question: str = "",
    keyword: str = "",
    think: bool = False
) -> Generator[str, None, None]:
    """
    RAG 查詢功能 - 流式回應
    與原始 ollama_client.py 相同
    """
    client = get_ollama_client()
    config = app_config.all

    try:
        # 處理模板替換
        final_prompt = prompt.replace("{context}", context)
        final_prompt = final_prompt.replace("{question}", question)
        final_prompt = final_prompt.replace("{keyword}", keyword)

        messages = [{"role": "user", "content": final_prompt}]

        # 使用包裝器的 chat 方法
        for chunk in client.chat(
            model=model or get_current_model(),
            messages=messages,
            stream=True,
            think=think,
            options=get_model_options(),
        ):
            yield chunk

    except Exception as e:
        logger.error(f"RAG 查詢失敗: {e}")
        yield f"# 查詢失敗: {str(e)}"


def simple_generate(prompt: str, model: str = None) -> str:
    """
    簡單生成功能 - 非流式
    與原始 ollama_client.py 相同
    """
    client = get_ollama_client()
    config = app_config.all

    try:
        messages = [{"role": "user", "content": prompt}]

        # 使用包裝器的 chat 方法（非流式）
        response = client.chat(
            model=model or get_current_model(),
            messages=messages,
            stream=False,
            options=get_model_options(),
        )

        return response

    except Exception as e:
        logger.error(f"生成失敗: {e}")
        return f"生成失敗: {str(e)}"


def chat_completion(
    messages: list,
    model: str = None,
    stream: bool = False,
    **kwargs
) -> Union[str, Generator[str, None, None]]:
    """
    通用對話完成功能
    與原始 ollama_client.py 相同
    """
    client = get_ollama_client()
    config = app_config.all

    try:
        result = client.chat(
            model=model or get_current_model(),
            messages=messages,
            stream=stream,
            options=get_model_options(),
            **kwargs
        )

        if stream:
            # 流式回應
            for chunk in result:
                yield chunk
        else:
            # 非流式回應
            return result

    except Exception as e:
        logger.error(f"對話完成失敗: {e}")
        if stream:
            yield f"對話失敗: {str(e)}"
        else:
            return f"對話失敗: {str(e)}"


def get_available_models() -> List[str]:
    """
    獲取可用模型列表
    與原始 ollama_client.py 相同
    """
    try:
        client = get_ollama_client()

        # 如果是包裝器，獲取 provider
        if isinstance(client, LLMClientWrapper):
            return client.provider.list_models()
        else:
            # 原始 Ollama client
            models = client.list()
            return [model["name"] for model in models["models"]]

    except Exception as e:
        logger.error(f"獲取模型列表失敗: {e}")
        return []


def cleanup_ollama_client():
    """
    清理客戶端資源
    與原始 ollama_client.py 相同
    """
    global llm_client
    if llm_client:
        logger.info("清理 LLM 客戶端資源")
        llm_client = None