
from fastapi import HTTPException, APIRouter, Form, Depends, Query, Response
from fastapi.responses import JSONResponse
from typing import Dict, Any, List
import os

from app.api.dependencies import get_admin_user
from app.core.security.permissions import permission_required
from app.core.rag.indexing import indexing
from app.dao.knowledge_base import knowledge_base_dao
from app.utils.logging import get_logger
from app.config.paths import path_config

logger = get_logger(__name__)
router = APIRouter()


@router.get("/vector/index/status")
@permission_required("KB.INDEX_VIEW")
def get_index_status(
    kb_id: str = Query(..., description="知識庫ID"),
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """獲取知識庫索引狀態（管理員專用）"""
    try:
        result = indexing.get_index_status(kb_id)
        
        # 嘗試獲取最後一次索引建立的參數
        try:
            from app.dao.index_job import index_job_dao
            latest_job = index_job_dao.get_latest_job(kb_id)
            if latest_job:
                result['latest_chunk_size'] = latest_job.get('chunk_size')
                result['latest_chunk_overlap'] = latest_job.get('chunk_overlap')
                result['latest_index_time'] = latest_job.get('created_at')
        except Exception as e:
            logger.warning(f"無法獲取最新索引參數: {e}")
        
        return result
    except Exception as e:
        logger.error(f"獲取知識庫索引狀態失敗: {e}")
        raise HTTPException(status_code=500, detail=f"獲取知識庫索引狀態失敗: {str(e)}")

# 依照選擇的檔案建立索引
@router.post("/vector/index/prepare/file")
@permission_required("KB.INDEX_CREATE")
def api_prepare_files(
    filenames: List[str] = Form(...),
    kb_id: str = Form(None),
    chunk_size: int = Form(None),
    chunk_overlap: int = Form(None),
    current_user: Dict[str, Any] = Depends(get_admin_user),
):
    # 驗證知識庫是否存在
    kb = knowledge_base_dao.get_knowledge_base(kb_id)
    if not kb:
        return JSONResponse(
            status_code=404, content={"status": "error", "message": "知識庫不存在"}
        )
    
    # 驗證 chunk 參數（如果有提供）
    if chunk_size is not None or chunk_overlap is not None:
        from app.config.settings import app_config
        config = app_config.all
        max_chunk_size = int(config.get("chunk_size", "512"))
        max_chunk_overlap = int(config.get("chunk_overlap", "64"))
        
        if chunk_size and chunk_size > max_chunk_size:
            return JSONResponse(
                status_code=400, 
                content={"status": "error", "message": f"chunk_size 不能超過系統設定的最大值 {max_chunk_size}"}
            )
        
        if chunk_overlap and chunk_overlap > max_chunk_overlap:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": f"chunk_overlap 不能超過系統設定的最大值 {max_chunk_overlap}"}
            )
    
    paths = path_config.get_base_paths()
    doc_path = os.path.join(paths["DOC_PATH"], kb_id) if kb_id else paths["DOC_PATH"]

    results = []
    logger.info(f"filenames: {filenames}, kb_id: {kb_id}")
    
    try:
        # 在處理檔案之前，先建立一筆 index_job 記錄
        job_id = None
        if chunk_size is not None or chunk_overlap is not None:
            from app.dao.index_job import index_job_dao
            try:
                job_data = {
                    'kb_id': kb_id,
                    'job_type': 'build',
                    'status': 'running',  # 初始狀態為 running
                    'chunk_size': chunk_size,
                    'chunk_overlap': chunk_overlap,
                    'total_files': len(filenames),  # 記錄總檔案數
                    'processed_files': 0  # 初始處理數為 0
                }
                job_id = index_job_dao.create_job(job_data)
                logger.info(f"建立 index job {job_id}，總檔案數: {len(filenames)}")
            except Exception as e:
                logger.warning(f"無法建立 index job: {e}")
        
        # 統計成功處理的檔案數
        processed_count = 0
        
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

                chunk_count = indexing.process_documents_and_update_index([result], kb_id, chunk_size, chunk_overlap)
                logger.info(f"chunk_count: {chunk_count}, chunk_size: {chunk_size}, chunk_overlap: {chunk_overlap}")
                
                processed_count += 1  # 成功處理的檔案數加 1
                
                results.append(
                    {"filename": filename, "status": "success", "chunks": chunk_count}
                )
            except Exception as e:
                logger.error(f"處理檔案 {filename} 失敗: {e}")
                results.append({"filename": filename, "status": "error", "message": str(e)})
        
        # 處理完所有檔案後，更新 index_job 狀態
        if job_id and job_id > 0:
            try:
                index_job_dao.update_job_status(
                    job_id, 
                    status='completed',
                    processed_files=processed_count
                )
                logger.info(f"更新 index job {job_id} 狀態為 completed，處理檔案數: {processed_count}")
            except Exception as e:
                logger.warning(f"無法更新 index job 狀態: {e}")
        
        return {"results": results}
        
    except Exception as e:
        logger.error(f"建立索引失敗: {e}")
        raise HTTPException(status_code=500, detail=f"建立索引失敗: {str(e)}")


# 顯示索引前100筆內容
@router.get("/vector/index/summary/100")
@permission_required("KB.INDEX_VIEW")
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
@permission_required("KB.INDEX_VIEW")
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
@permission_required("KB.INDEX_DELETE")
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
@permission_required("KB.INDEX_VIEW")
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
