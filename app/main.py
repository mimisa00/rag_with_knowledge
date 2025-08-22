"""
RAG 系統主要入口檔案

專注於 FastAPI 應用程式的建立和啟動配置
"""

import os
from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

from app.config.settings import app_config
from app.config.paths import path_config
from app.utils.logging import get_logger, setup_logging
from app.core.security.auth import auth_manager

# 初始化日誌系統
setup_logging()
logger = get_logger(__name__)

# 載入環境變數
load_dotenv()

# 建立 FastAPI 應用程式
app = FastAPI(
    title="RAG 系統 API",
    description="基於 Ollama 的檢索增強生成系統",
    version="2.0.0",
)

# 獲取路徑配置
paths = path_config.get_base_paths()

# 全域變數（用於 RAG 系統）
config = {}
embedding_model = None
current_embedding_model = None
index = None
texts = []
reranker_tokenizer = None
reranker_model = None

# 知識庫索引管理
kb_indexes = {}  # 用於快取不同知識庫的索引
kb_texts = {}  # 用於快取不同知識庫的文本


@app.on_event("startup")
async def startup_event():
    """應用程式啟動事件"""
    logger.info("正在啟動 RAG 系統...")

    # 載入配置
    load_system_config()

    # 確保必要目錄存在
    ensure_directories_exist()

    # 初始化模型
    await initialize_models()

    logger.info("RAG 系統啟動完成")


@app.on_event("shutdown")
async def shutdown_event():
    """應用程式關閉事件"""
    logger.info("正在關閉 RAG 系統...")

    # 清理資源
    cleanup_resources()

    logger.info("RAG 系統已關閉")


def load_system_config():
    """載入系統配置"""
    global config
    try:
        config = app_config.all
        logger.info("系統配置載入完成")
    except Exception as e:
        logger.error(f"載入系統配置失敗: {e}")


def ensure_directories_exist():
    """確保必要目錄存在"""
    try:
        os.makedirs(paths["FAISS_DIR"], exist_ok=True)
        os.makedirs(paths["DOC_PATH"], exist_ok=True)
        os.makedirs(paths["MODELS_DIR"], exist_ok=True)
        os.makedirs(paths["LOGS_DIR"], exist_ok=True)
        logger.info("目錄結構檢查完成")
    except Exception as e:
        logger.error(f"建立目錄結構失敗: {e}")


async def initialize_models():
    """初始化模型"""
    try:
        # 初始化 Ollama 客戶端
        from app.core.rag import (
            initialize_ollama_client,
            load_embedding_model,
            load_reranker_model,
            test_connection,
        )

        # 測試 Ollama 連接
        if not test_connection():
            logger.warning("Ollama 服務連接失敗，某些功能可能無法使用")

        # 初始化嵌入模型
        load_embedding_model()

        # 初始化重排序模型
        load_reranker_model()

        logger.info("模型初始化完成")
    except Exception as e:
        logger.error(f"模型初始化失敗: {e}")
        # 不拋出異常，允許應用程式繼續運行


def cleanup_resources():
    """清理系統資源"""
    try:
        from app.core.rag import (
            cleanup_embedding_model,
            cleanup_reranker_model,
            cleanup_ollama_client,
            cleanup_indexing_resources,
        )

        # 清理各個模組的資源
        cleanup_embedding_model()
        cleanup_reranker_model()
        cleanup_ollama_client()
        cleanup_indexing_resources()

        # 清理全域變數
        global config, embedding_model, index, texts
        global reranker_tokenizer, reranker_model
        global kb_indexes, kb_texts

        config = {}
        embedding_model = None
        index = None
        texts = []
        reranker_tokenizer = None
        reranker_model = None
        kb_indexes = {}
        kb_texts = {}

        logger.info("系統資源清理完成")
    except Exception as e:
        logger.error(f"清理系統資源失敗: {e}")


# 根路由 - 重導向到登入頁面
@app.get("/")
def root():
    """主頁面重導向"""
    return RedirectResponse(url="/login", status_code=302)


# 匯入和註冊路由模組
from app.api.routes.static import router as static_router
from app.api.routes.config import router as config_router
from app.api.routes.admin import router as admin_router
from app.api.routes.knowledge_base import router as kb_router
from app.api.routes.document import router as document_router
from app.api.routes.vector_index import router as vector_index_router
from app.api.routes.user import router as user_router
from app.api.routes.conversation import router as conversation_router
from app.api.routes.query import router as query_router
from app.api.routes.organization import router as organization_router

app.include_router(static_router, tags=["頁面"])
app.include_router(config_router, prefix="/api", tags=["配置"])
app.include_router(admin_router, prefix="/api", tags=["管理"])
app.include_router(kb_router, prefix="/api", tags=["知識庫"])
app.include_router(document_router, prefix="/api", tags=["文檔"])
app.include_router(vector_index_router, prefix="/api", tags=["向量索引"])
app.include_router(user_router, prefix="/api", tags=["使用者"])
app.include_router(conversation_router, prefix="/api", tags=["對話"])
app.include_router(query_router, prefix="/api", tags=["查詢"])
app.include_router(organization_router, tags=["組織管理"])

# 掛載靜態文件服務
static_dir = path_config.get_base_paths()["STATIC_DIR"]

# 安全地掛載存在的靜態文件目錄
# 只掛載公共資源，admin-modules 將透過 API 提供
static_dirs = {
    "css": os.path.join(static_dir, "css"),
    "js/modules": os.path.join(static_dir, "js", "modules"),  # 只掛載公共模組
    "js/lib": os.path.join(static_dir, "js", "lib"),  # 第三方函式庫 (marked.js 等)
    "components": os.path.join(static_dir, "components")
}

for endpoint, directory in static_dirs.items():
    if os.path.exists(directory):
        app.mount(f"/{endpoint}", StaticFiles(directory=directory), name=endpoint.replace("/", "_"))
        logger.info(f"Mounted static files: /{endpoint} -> {directory}")
    else:
        logger.warning(f"Static directory not found, skipping: {directory}")




# 所有主要路由模組已完成實作和註冊


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8080)
