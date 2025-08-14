
from fastapi import HTTPException, APIRouter, Form, Depends, Query, Response
from fastapi.responses import JSONResponse
from typing import Dict, Any, List
import os

from app.api.dependencies import get_admin_user
from app.core.rag.indexing import indexing
from app.dao.knowledge_base import knowledge_base_dao
from app.utils.logging import get_logger
from app.config.paths import path_config

logger = get_logger(__name__)
router = APIRouter()


@router.get("/vector/index/status")
def get_index_status(
    kb_id: str = Query(..., description="知識庫ID"),
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """獲取知識庫索引狀態（管理員專用）"""
    try:
        result = indexing.get_index_status(kb_id)
        return result
    except Exception as e:
        logger.error(f"獲取知識庫索引狀態失敗: {e}")
        raise HTTPException(status_code=500, detail=f"獲取知識庫索引狀態失敗: {str(e)}")

# 依照選擇的檔案建立索引
@router.post("/vector/index/prepare/file")
def api_prepare_files(
    filenames: List[str] = Form(...),
    kb_id: str = Form(None),
    current_user: Dict[str, Any] = Depends(get_admin_user),
):
    # 驗證知識庫是否存在
    kb = knowledge_base_dao.get_knowledge_base(kb_id)
    if not kb:
        return JSONResponse(
            status_code=404, content={"status": "error", "message": "知識庫不存在"}
        )
    
    paths = path_config.get_base_paths()
    doc_path = os.path.join(paths["DOC_PATH"], kb_id) if kb_id else paths["DOC_PATH"]

    results = []
    logger.info(f"filenames: {filenames}, kb_id: {kb_id}")
    
    try:
        for filename in filenames:
            full_path = os.path.join(doc_path, filename)
            if not os.path.exists(full_path):
                results.append(
                    {"filename": filename, "status": "error", "message": "檔案不存在"}
                )
                continue
            
            try:
                paths = path_config.get_base_paths()
                markdown_path = os.path.join(paths["DOC_PATH"], kb_id, "markdown", f"{filename}.md")
                result = {}
                result["content"] = open(markdown_path, "r", encoding="utf-8").read()
                result["source_file"] = filename
                result["markdown_file"] = f"{filename}.md"


                chunk_count = indexing.process_documents_and_update_index([result], kb_id)
                logger.info(f"chunk_count: {chunk_count}")

                results.append(
                    {"filename": filename, "status": "success", "chunks": chunk_count}
                )
            except Exception as e:
                logger.error(f"處理檔案 {filename} 失敗: {e}")
                results.append({"filename": filename, "status": "error", "message": str(e)})
        
        return {"results": results}
        
    except Exception as e:
        logger.error(f"建立索引失敗: {e}")
        raise HTTPException(status_code=500, detail=f"建立索引失敗: {str(e)}")


# 顯示索引前100筆內容
@router.get("/vector/index/summary/100")
def index_summary_100(
    response: Response,
    kb_id: str = Query(None), 
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    try:
        # 設定 no-cache headers 防止快取問題
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        
        result = indexing.index_summary_100(kb_id)
        return result
    except Exception as e:
        logger.error(f"顯示索引前100筆內容失敗: {e}")
        raise HTTPException(status_code=500, detail="顯示索引前100筆內容失敗")


# 顯示索引完整內容
@router.get("/vector/index/summary/all")
def index_summary_all(
    response: Response,
    kb_id: str = Query(None),
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    try:
        # 設定 no-cache headers 防止快取問題
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        
        result = indexing.index_summary_all(kb_id)
        return result
    except Exception as e:
        logger.error(f"顯示索引完整內容失敗: {e}")
        raise HTTPException(status_code=500, detail="顯示索引完整內容失敗")



# 清除索引
@router.post("/vector/index/clear")
def clear_index(
    kb_id: str = Form(None), 
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    try:
        indexing.clear_kb_index(kb_id)
        return {"success": True, "status": "cleared", "kb_id": kb_id}
    except Exception as e:
        logger.error(f"清除知識庫索引失敗: {e}")
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})



# 檢查索引與檔案內容是否一致
@router.get("/vector/index/validate")
def validate_index(
    kb_id: str = Query(None),
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    try:
        result = indexing.validate_index(kb_id)
        return result
    except Exception as e:
        logger.error(f"驗證知識庫索引失敗: {e}")
        raise HTTPException(status_code=500, detail="驗證知識庫索引失敗")
