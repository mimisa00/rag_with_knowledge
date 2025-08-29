"""
索引管理核心模組
"""
import os
import json
import numpy as np
import faiss
from typing import List, Dict, Any, Optional
from langchain.text_splitter import RecursiveCharacterTextSplitter

from app.config.settings import app_config
from app.config.paths import path_config
from app.core.rag.embedding import get_embedding_model
from app.utils.logging import get_logger

logger = get_logger(__name__)

# 全域變數
index = None
texts = []
kb_indexes = {}  # 用於快取不同知識庫的索引
kb_texts = {}    # 用於快取不同知識庫的文本


def get_kb_faiss_dir(kb_id: str = None) -> str:
    """獲取知識庫特定的 FAISS 目錄"""
    paths = path_config.get_base_paths()
    if kb_id:
        return os.path.join(os.path.dirname(paths["FAISS_DIR"]), "faiss_data", f"{kb_id}")
    return paths["FAISS_DIR"]


def get_kb_texts_path(kb_id: str = None) -> str:
    """獲取知識庫特定的 texts.json 路徑"""
    faiss_dir = get_kb_faiss_dir(kb_id)
    return os.path.join(faiss_dir, "texts.json")


def get_kb_index_path(kb_id: str = None) -> str:
    """獲取知識庫特定的 faiss.index 路徑"""
    faiss_dir = get_kb_faiss_dir(kb_id)
    return os.path.join(faiss_dir, "faiss.index")


def load_kb_index(kb_id: str = None):
    """載入知識庫特定的索引和文本"""
    global index, texts

    if kb_id and kb_id in kb_indexes:
        # 使用快取
        index = kb_indexes[kb_id]
        texts = kb_texts[kb_id]
        logger.info(f"使用快取的知識庫 {kb_id} 索引")
        return

    texts_path = get_kb_texts_path(kb_id)
    index_path = get_kb_index_path(kb_id)

    texts = []
    index = None

    try:
        if os.path.exists(texts_path):
            with open(texts_path, "r", encoding="utf-8") as f:
                texts = json.load(f)

        if os.path.exists(index_path):
            index = faiss.read_index(index_path)

        # 更新快取
        if kb_id:
            kb_indexes[kb_id] = index
            kb_texts[kb_id] = texts

        logger.info(f"載入知識庫 {kb_id or '預設'} 索引成功，文本數量: {len(texts)}")
    except Exception as e:
        logger.error(f"載入知識庫 {kb_id or '預設'} 索引失敗: {e}")
        texts = []
        index = None


def save_kb_index(kb_id: str = None):
    """儲存知識庫特定的索引和文本"""
    global index, texts

    faiss_dir = get_kb_faiss_dir(kb_id)
    os.makedirs(faiss_dir, exist_ok=True)

    texts_path = get_kb_texts_path(kb_id)
    index_path = get_kb_index_path(kb_id)

    try:
        with open(texts_path, "w", encoding="utf-8") as f:
            json.dump(texts, f, ensure_ascii=False, indent=2)

        if index is not None:
            faiss.write_index(index, index_path)

        # 更新快取
        if kb_id:
            kb_indexes[kb_id] = index
            kb_texts[kb_id] = texts.copy()

        logger.info(f"儲存知識庫 {kb_id or '預設'} 索引成功")
    except Exception as e:
        logger.error(f"儲存知識庫 {kb_id or '預設'} 索引失敗: {e}")
        raise


def process_documents_and_update_index(doc_texts: List[Dict[str, Any]], chunk_size: Optional[int] = None, chunk_overlap: Optional[int] = None) -> int:
    """處理文檔並更新索引
    
    Args:
        doc_texts: 文檔文本列表
        chunk_size: 自訂的 chunk_size，如果為 None 則使用系統預設值
        chunk_overlap: 自訂的 chunk_overlap，如果為 None 則使用系統預設值
    
    Returns:
        int: 產生的 chunk 數量
    """
    global texts, index

    logger.info("開始處理文檔並更新索引")
    logger.info(f"原始文件數量: {len(doc_texts)}")

    # 優先使用傳入的參數，否則使用系統配置
    config = app_config.all
    if chunk_size is None:
        chunk_size = int(config.get("chunk_size", "512"))
    if chunk_overlap is None:
        chunk_overlap = int(config.get("chunk_overlap", "64"))

    logger.info(f"分割參數 - chunk_size: {chunk_size}, chunk_overlap: {chunk_overlap}")
    
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size, 
        chunk_overlap=chunk_overlap
    )
    
    new_chunks = []
    for doc in doc_texts:
        # doc: {content, source_file, markdown_file}
        chunks = splitter.split_text(doc["content"])
        for chunk in chunks:
            new_chunks.append(
                {
                    "content": chunk,
                    "source_file": doc["source_file"],
                    "markdown_file": doc["markdown_file"],
                }
            )
    
    logger.info(f"產生 chunk 數量: {len(new_chunks)}")
    texts.extend(new_chunks)

    logger.info("開始批次計算向量")
    try:
        embedding_model = get_embedding_model()
        vectors = embedding_model.embed_documents(
            [chunk["content"] for chunk in new_chunks]
        )
        vectors = np.array(vectors).astype("float32")
        logger.info(f"向量 shape: {vectors.shape}")
    except Exception as e:
        logger.error(f"向量產生失敗: {str(e)}")
        raise

    if index is None:
        logger.info("尚未初始化 index，建立新 index")
        dimension = vectors.shape[1]
        index = faiss.IndexFlatL2(dimension)
    else:
        logger.info("使用現有 index")
    
    index.add(vectors)
    logger.info("新向量已加入 index")

    return len(new_chunks)


def clear_kb_index(kb_id: str = None):
    """清除知識庫索引"""
    global index, texts
    
    try:
        # 清除知識庫特定的索引檔案
        kb_index_path = get_kb_index_path(kb_id)
        kb_texts_path = get_kb_texts_path(kb_id)
        
        if os.path.exists(kb_index_path):
            os.remove(kb_index_path)
        if os.path.exists(kb_texts_path):
            os.remove(kb_texts_path)
        
        # 清除快取
        if kb_id in kb_indexes:
            del kb_indexes[kb_id]
        if kb_id in kb_texts:
            del kb_texts[kb_id]
        
        # 如果當前載入的是該知識庫，則清除全域變數
        load_kb_index(kb_id)  # 重新載入（現在應該是空的）
        
        logger.info(f"清除知識庫 {kb_id} 索引成功")
        
    except Exception as e:
        logger.error(f"清除知識庫索引失敗: {e}")
        raise


def validate_index(kb_id: str = None) -> Dict[str, Any]:
    """驗證索引與檔案內容是否一致"""
    load_kb_index(kb_id)
    
    if index is None or not texts:
        return {"status": "invalid", "reason": "index 或 texts 為空"}
    
    if index.ntotal != len(texts):
        return {
            "status": "invalid",
            "reason": f"index 向量數 {index.ntotal} 不等於 texts 數 {len(texts)}",
        }
    
    return {"status": "ok", "vectors": index.ntotal}


def search_similar_chunks(query: str, k: int = 20, kb_id: str = None) -> List[Dict[str, Any]]:
    """搜尋相似的文本塊"""
    load_kb_index(kb_id)
    
    if index is None or not texts:
        raise ValueError(f"知識庫 {kb_id or '預設'} 尚未建立索引")
    
    try:
        embedding_model = get_embedding_model()
        q_vec = embedding_model.embed_query(query)
        
        # 搜尋相似向量
        D, I = index.search(np.array([q_vec]).astype("float32"), k=k)
        
        # 回傳對應的文本塊
        result_chunks = []
        for i in I[0]:
            if i < len(texts):
                result_chunks.append(texts[i])
        
        logger.debug(f"搜尋到 {len(result_chunks)} 個相似文本塊")
        return result_chunks
        
    except Exception as e:
        logger.error(f"搜尋相似文本塊失敗: {e}")
        raise


def cleanup_indexing_resources():
    """清理索引相關資源"""
    global index, texts, kb_indexes, kb_texts
    
    try:
        index = None
        texts = []
        kb_indexes = {}
        kb_texts = {}
        
        logger.info("索引資源清理完成")
    except Exception as e:
        logger.error(f"清理索引資源失敗: {e}")


def get_kb_doc_path(kb_id: str = None) -> str:
    """獲取知識庫特定的文檔目錄"""
    from app.config.paths import path_config
    paths = path_config.get_base_paths()
    if kb_id:
        return os.path.join(paths["DOC_PATH"], kb_id)
    return paths["DOC_PATH"]


def get_kb_md_path(kb_id: str = None) -> str:
    """獲取知識庫特定的 markdown 目錄"""
    kb_doc_path = get_kb_doc_path(kb_id)
    return os.path.join(kb_doc_path, "markdown")


def get_index_status(kb_id: str = None) -> Dict[str, Any]:
    """獲取索引狀態"""
    try:
        load_kb_index(kb_id)
        
        index_path = get_kb_index_path(kb_id)
        texts_path = get_kb_texts_path(kb_id)
        
        index_exists = os.path.exists(index_path)
        texts_exist = os.path.exists(texts_path)
        
        status_info = {
            "kb_id": kb_id,
            "index_exists": index_exists,
            "texts_exist": texts_exist,
            "texts_count": len(texts) if texts else 0,
            "index_vectors": index.ntotal if index else 0,
            "is_valid": False
        }
        
        if index and texts:
            if index.ntotal == len(texts):
                status_info["is_valid"] = True
                status_info["status"] = "valid"
            else:
                status_info["status"] = "invalid"
                status_info["reason"] = f"index 向量數 {index.ntotal} 不等於 texts 數 {len(texts)}"
        else:
            status_info["status"] = "empty"
            status_info["reason"] = "index 或 texts 為空"
        
        return status_info
        
    except Exception as e:
        logger.error(f"獲取索引狀態失敗: {e}")
        raise


def index_summary_100(kb_id: str = None) -> Dict[str, Any]:
    """顯示索引前100筆內容"""
    try:
        load_kb_index(kb_id)
        
        # 從 texts 中提取出所有的 content
        content_chunks = [item["content"] for item in texts[:100]]  # 最多顯示前100筆內容
        
        return {
            "count": len(texts),
            "chunks": content_chunks,
            "index_exists": os.path.exists(get_kb_index_path(kb_id)),
        }
        
    except Exception as e:
        logger.error(f"顯示索引前100筆內容失敗: {e}")
        raise


def index_summary_all(kb_id: str = None) -> Dict[str, Any]:
    """顯示索引完整內容"""
    try:
        load_kb_index(kb_id)
        
        # 從 texts 中提取出所有的 content
        content_chunks = [item["content"] for item in texts]  # 顯示全部內容
        
        return {
            "count": len(texts),
            "chunks": content_chunks,
            "index_exists": os.path.exists(get_kb_index_path(kb_id)),
        }
        
    except Exception as e:
        logger.error(f"顯示索引完整內容失敗: {e}")
        raise


# 創建 indexing 對象，包含所有方法
class IndexingManager:
    """索引管理器"""
        
    def get_index_status(self, kb_id: str = None):
        return get_index_status(kb_id)
    
    def process_documents_and_update_index(self, doc_texts: List[Dict[str, Any]], kb_id: str = None, chunk_size: Optional[int] = None, chunk_overlap: Optional[int] = None):
        # 載入知識庫特定的索引
        load_kb_index(kb_id)
        # 處理文檔並更新索引，傳遞自訂的 chunk 參數
        chunk_count = process_documents_and_update_index(doc_texts, chunk_size, chunk_overlap)
        # 儲存知識庫特定的索引
        save_kb_index(kb_id)
        return chunk_count
    
    def index_summary_100(self, kb_id: str = None):
        return index_summary_100(kb_id)
    
    def index_summary_all(self, kb_id: str = None):
        return index_summary_all(kb_id)
    
    def clear_kb_index(self, kb_id: str = None):
        return clear_kb_index(kb_id)
    
    def validate_index(self, kb_id: str = None):
        return validate_index(kb_id)


# 創建全局 indexing 實例
indexing = IndexingManager()