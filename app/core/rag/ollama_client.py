"""
Ollama 客戶端核心模組

整合所有 Ollama 相關功能：
1. 客戶端初始化和配置
2. 模型參數更新
3. 名詞分析功能
4. RAG 查詢功能
"""
import os
import json
import time
from typing import Dict, Any, Generator, List, Optional
import ollama
from app.config.settings import app_config
from app.utils.logging import get_logger

logger = get_logger(__name__)

# 全域變數
ollama_client = None


def initialize_ollama_client():
    """初始化 Ollama 客戶端"""
    global ollama_client
    
    try:
        ollama_host = os.getenv("OLLAMA_API_HOST", "http://localhost:11434")
        ollama_client = ollama.Client(host=ollama_host)
        
        logger.info(f"Ollama 客戶端初始化成功，連接到: {ollama_host}")
        return ollama_client
        
    except Exception as e:
        logger.error(f"初始化 Ollama 客戶端失敗: {e}")
        raise


def get_ollama_client():
    """獲取 Ollama 客戶端實例"""
    if ollama_client is None:
        return initialize_ollama_client()
    return ollama_client


def get_model_options() -> Dict[str, Any]:
    """獲取模型選項配置"""
    config = app_config.all
    
    return {
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


def update_ollama_model_options():
    """更新 Ollama 模型的參數"""
    client = get_ollama_client()
    config = app_config.all
    
    try:
        client.generate(
            model=config.get("llm_model", "gemma3:4b"),
            prompt="TEST",
            options=get_model_options(),
            stream=False,
        )
        logger.info("Ollama 模型參數更新成功")
    except Exception as e:
        logger.error(f"更新 Ollama 模型參數失敗: {e}")


def noun_analysis_stream(question: str) -> Generator[str, None, None]:
    """
    名詞分析功能 - 流式回應
    
    Args:
        question: 要分析的問題
        
    Yields:
        str: 流式回應內容
    """
    client = get_ollama_client()
    config = app_config.all
    
    try:
        prompt = config.get("noun_analysis_prompt", "{question}").replace("{question}", question)
        messages = [{"role": "user", "content": prompt}]
        
        stream = client.chat(
            model=config.get("llm_model", "gemma3:4b"),
            messages=messages,
            think=False,
            stream=True,
            options=get_model_options(),
        )

        for chunk in stream:
            if chunk and getattr(chunk, "message", None):
                yield chunk.message.content
                
    except Exception as e:
        logger.error(f"名詞分析失敗: {e}")
        yield f"# 分析失敗: {str(e)}"


def rag_query_stream(
    system_prompt: str, 
    question: str, 
    think: bool = False
) -> Generator[Dict[str, Any], None, None]:
    """
    RAG 查詢功能 - 流式回應
    
    Args:
        system_prompt: 系統提示詞
        question: 用戶問題
        think: 是否啟用思考模式
        
    Yields:
        Dict[str, Any]: 包含回應內容和思考過程的字典
    """
    client = get_ollama_client()
    config = app_config.all
    
    try:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": question},
        ]

        # 首先返回系統提示詞
        yield {
            "prompt": system_prompt, 
            "answer": "", 
            "thinking": ""
        }

        logger.debug("開始調用 Ollama")
        
        stream = client.chat(
            model=config.get("llm_model", "gemma2:9b"),
            messages=messages,
            think=think,
            stream=True,
            options=get_model_options(),
        )
        
        for chunk in stream:
            if chunk and getattr(chunk, "message", None):
                yield {
                    "content": chunk.message.content,
                    "thinking": chunk.message.thinking or "",
                }
        
        logger.debug("Ollama 調用完成")
        
    except Exception as e:
        logger.error(f"RAG 查詢失敗: {e}")
        yield {
            "content": f"# 查詢失敗: {str(e)}",
            "thinking": "",
        }


def simple_generate(prompt: str, model: str = None) -> str:
    """
    簡單的文字生成功能
    
    Args:
        prompt: 提示詞
        model: 模型名稱（可選）
        
    Returns:
        str: 生成的回應
    """
    client = get_ollama_client()
    config = app_config.all
    
    if model is None:
        model = config.get("llm_model", "gemma2:9b")
    
    try:
        response = client.generate(
            model=model,
            prompt=prompt,
            options=get_model_options(),
            stream=False,
        )
        
        return response.response if hasattr(response, 'response') else str(response)
        
    except Exception as e:
        logger.error(f"文字生成失敗: {e}")
        return f"生成失敗: {str(e)}"


def chat_completion(
    messages: List[Dict[str, str]], 
    model: str = None, 
    stream: bool = False
) -> Any:
    """
    通用的聊天完成功能
    
    Args:
        messages: 對話訊息列表
        model: 模型名稱（可選）
        stream: 是否流式回應
        
    Returns:
        回應內容或流式生成器
    """
    client = get_ollama_client()
    config = app_config.all
    
    if model is None:
        model = config.get("llm_model", "gemma2:9b")
    
    try:
        return client.chat(
            model=model,
            messages=messages,
            stream=stream,
            options=get_model_options(),
        )
        
    except Exception as e:
        logger.error(f"聊天完成失敗: {e}")
        if stream:
            def error_generator():
                yield {"error": str(e)}
            return error_generator()
        else:
            return {"error": str(e)}


def test_connection() -> bool:
    """測試 Ollama 連接"""
    try:
        client = get_ollama_client()
        # 嘗試獲取模型列表來測試連接
        models = client.list()
        logger.info("Ollama 連接測試成功")
        return True
    except Exception as e:
        logger.error(f"Ollama 連接測試失敗: {e}")
        return False


def get_available_models() -> List[str]:
    """獲取可用的模型列表"""
    try:
        client = get_ollama_client()
        models = client.list()
        model_names = [model.model for model in models.models] if hasattr(models, 'models') else []
        logger.info(f"獲取到 {len(model_names)} 個可用模型")
        return model_names
    except Exception as e:
        logger.error(f"獲取模型列表失敗: {e}")
        return []


def cleanup_ollama_client():
    """清理 Ollama 客戶端資源"""
    global ollama_client
    
    try:
        ollama_client = None
        logger.info("Ollama 客戶端資源清理完成")
    except Exception as e:
        logger.error(f"清理 Ollama 客戶端資源失敗: {e}")