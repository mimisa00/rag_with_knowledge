"""
向量嵌入核心模組
"""
import torch
from langchain_huggingface import HuggingFaceEmbeddings
from app.config.settings import app_config
from app.utils.logging import get_logger

logger = get_logger(__name__)

# 全域變數
embedding_model = None
current_embedding_model = None
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")


def get_embedding_model():
    """獲取或初始化嵌入模型"""
    global embedding_model, current_embedding_model
    
    config = app_config.all
    requested_model_name = config.get("embedding_model", "multilingual-e5-large")
    
    # 判斷是否需要重建（第一次載入或模型名稱不同）
    if embedding_model is None or current_embedding_model != requested_model_name:
        logger.info(f"需要載入新的 embedding 模型: {requested_model_name}")
        try:
            embedding_model = HuggingFaceEmbeddings(
                model_name=requested_model_name, 
                model_kwargs={"device": device}
            )
            current_embedding_model = requested_model_name
            logger.info(f"Embedding 模型載入成功: {requested_model_name}")
        except Exception as e:
            logger.error(f"載入 embedding 模型失敗: {e}")
            raise
    else:
        logger.info(f"使用快取中的 embedding 模型: {current_embedding_model}")
    
    return embedding_model


def load_embedding_model():
    """載入並預熱嵌入模型"""
    try:
        model = get_embedding_model()
        # 預熱模型
        # model.embed_query("warmup")
        logger.info("Embedding 模型 warmup 成功")
        return model
    except Exception as e:
        logger.error(f"Embedding 模型 warmup 失敗: {e}")
        raise


def cleanup_embedding_model():
    """清理嵌入模型資源"""
    global embedding_model, current_embedding_model
    
    try:
        embedding_model = None
        current_embedding_model = None
        
        # 清理 GPU 記憶體
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        logger.info("Embedding 模型資源清理完成")
    except Exception as e:
        logger.error(f"清理 Embedding 模型資源失敗: {e}")