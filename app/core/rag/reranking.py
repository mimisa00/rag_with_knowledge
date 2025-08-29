"""
重排序核心模組
"""
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from typing import List, Dict, Any
from app.utils.logging import get_logger

logger = get_logger(__name__)

# 全域變數
reranker_tokenizer = None
reranker_model = None
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")


def load_reranker_model():
    """載入重排序模型"""
    global reranker_tokenizer, reranker_model
    
    try:
        logger.info("正在載入 BGE Reranker 模型...")
        
        reranker_tokenizer = AutoTokenizer.from_pretrained("BAAI/bge-reranker-v2-m3")
        reranker_model = AutoModelForSequenceClassification.from_pretrained(
            "BAAI/bge-reranker-v2-m3"
        )
        reranker_model.to(device)
        reranker_model.eval()
        
        logger.info("BGE Reranker 模型載入完成")
        
    except Exception as e:
        logger.error(f"載入 BGE Reranker 模型失敗: {e}")
        raise


def rerank_with_bge(query: str, candidate_texts: List[str], top_k: int) -> List[str]:
    """使用 BGE Reranker 模型進行重排序"""
    if reranker_tokenizer is None or reranker_model is None:
        raise RuntimeError("Reranker 模型未初始化")
    
    try:
        pairs = [(query, passage) for passage in candidate_texts]
        logger.debug(f"rerank top_k: {top_k}")
        
        # Tokenize
        inputs = reranker_tokenizer(
            [q for q, p in pairs],
            [p for q, p in pairs],
            padding=True,
            truncation=True,
            return_tensors="pt",
            max_length=512,
        )
        
        # 移動到正確的設備
        inputs = {k: v.to(device) for k, v in inputs.items()}

        with torch.no_grad():
            scores = reranker_model(**inputs).logits.squeeze(-1)

        # 排序並選出 top_k
        top_k_indices = torch.topk(
            scores, k=min(top_k, len(candidate_texts))
        ).indices.tolist()
        
        reranked_texts = [candidate_texts[i] for i in top_k_indices]
        
        logger.debug(f"重排序完成，返回 {len(reranked_texts)} 個結果")
        return reranked_texts
        
    except Exception as e:
        logger.error(f"重排序失敗: {e}")
        raise


def cleanup_reranker_model():
    """清理重排序模型資源"""
    global reranker_tokenizer, reranker_model
    
    try:
        reranker_tokenizer = None
        reranker_model = None
        
        # 清理 GPU 記憶體
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        logger.info("Reranker 模型資源清理完成")
    except Exception as e:
        logger.error(f"清理 Reranker 模型資源失敗: {e}")