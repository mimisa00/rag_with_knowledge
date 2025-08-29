"""
RAG (檢索增強生成) 核心模組

提供完整的 RAG 功能包括：
- 向量嵌入
- 索引管理  
- 重排序
- Ollama 客戶端
"""

from app.core.rag.embedding import (
    get_embedding_model,
    load_embedding_model,
    cleanup_embedding_model
)
from app.core.rag.indexing import (
    load_kb_index,
    save_kb_index,
    process_documents_and_update_index,
    clear_kb_index,
    validate_index,
    search_similar_chunks,
    cleanup_indexing_resources
)
from app.core.rag.reranking import (
    load_reranker_model,
    rerank_with_bge,
    cleanup_reranker_model
)
from app.core.rag.ollama_client import (
    initialize_ollama_client,
    get_ollama_client,
    update_ollama_model_options,
    noun_analysis_stream,
    rag_query_stream,
    simple_generate,
    chat_completion,
    test_connection,
    get_available_models,
    cleanup_ollama_client
)

__all__ = [
    # Embedding
    "get_embedding_model",
    "load_embedding_model", 
    "cleanup_embedding_model",
    
    # Indexing
    "load_kb_index",
    "save_kb_index",
    "process_documents_and_update_index",
    "clear_kb_index",
    "validate_index",
    "search_similar_chunks", 
    "cleanup_indexing_resources",
    
    # Reranking
    "load_reranker_model",
    "rerank_with_bge",
    "cleanup_reranker_model",
    
    # Ollama Client
    "initialize_ollama_client",
    "get_ollama_client",
    "update_ollama_model_options",
    "noun_analysis_stream",
    "rag_query_stream",
    "simple_generate", 
    "chat_completion",
    "test_connection",
    "get_available_models",
    "cleanup_ollama_client",
]