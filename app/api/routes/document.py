"""
文檔處理相關 API 路由
"""

import os
import mimetypes
import urllib.parse
from datetime import datetime
from fastapi import APIRouter, File, UploadFile, Form, HTTPException, Depends, Query
from fastapi.responses import FileResponse, JSONResponse
from typing import Dict, Any, List, Optional
from app.core.document.converter import document_converter
from app.dao.knowledge_base import knowledge_base_dao
from app.dao.index_job import index_job_dao
from app.api.dependencies import get_current_user, get_admin_user
from app.config.paths import path_config
from app.utils.logging import get_logger

logger = get_logger(__name__)

router = APIRouter()

# 支援的檔案類型
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc", ".txt", ".md"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


def allowed_file(filename: str) -> bool:
    """檢查檔案類型是否支援"""
    return (
        "." in filename and os.path.splitext(filename)[1].lower() in ALLOWED_EXTENSIONS
    )


@router.post("/document/upload")
async def upload_file(
    files: List[UploadFile] = File(...),
    overwrite: bool = Form(False),
    kb_id: str = Form(...),
    current_user: Dict[str, Any] = Depends(get_admin_user),
):
    """上傳文件到指定知識庫"""
    try:
        # 檢查知識庫是否存在且啟用
        kb = knowledge_base_dao.get_knowledge_base(kb_id)
        if not kb:
            raise HTTPException(status_code=404, detail="知識庫不存在")

        if kb["status"] != "enable":
            raise HTTPException(status_code=400, detail="知識庫已停用")

        # 確保知識庫目錄存在
        paths = path_config.get_base_paths()
        kb_dir = os.path.join(paths["DOC_PATH"], kb_id)
        os.makedirs(kb_dir, exist_ok=True)
        results = []
        for file in files:
            # 檢查檔案大小（10MB限制）
            file_content = file.file.read()
            file_size = len(file_content)
            file.file.seek(0)  # 重置文件指針

            if file_size > 10 * 1024 * 1024:  # 10MB
                results.append(
                    {
                        "filename": file.filename,
                        "status": "error",
                        "message": "檔案大小超過10MB限制",
                    }
                )
                continue

            file_path = os.path.join(kb_dir, file.filename)
            exists = os.path.exists(file_path)
            if exists and not overwrite:
                results.append(
                    {
                        "filename": file.filename,
                        "status": "exists",
                        "message": "檔案已存在",
                    }
                )
                continue

            try:
                with open(file_path, "wb") as f:
                    f.write(file_content)

                # 嘗試解析檔案以檢查可解析性
                try:
                    # 使用 docling 測試解析
                    temp_result = document_converter.convert_file_via_docling(
                        file_path, file.filename, kb_id
                    )
                    if (
                        not temp_result  # 轉換失敗 / 回傳 None
                        or not temp_result.get("content", "").strip()  # content 為空白
                    ):
                        raise Exception("檔案無法被解析或內容為空")
                except Exception as parse_error:
                    # 刪除無法解析的檔案
                    if os.path.exists(file_path):
                        os.remove(file_path)
                    results.append(
                        {
                            "filename": file.filename,
                            "status": "error",
                            "message": f"檔案無法解析: {str(parse_error)}",
                        }
                    )
                    continue

                results.append(
                    {
                        "filename": file.filename,
                        "status": "success",
                        "message": "檔案上傳成功",
                    }
                )
                logger.info(f"檔案上傳成功: {file_path} (知識庫: {kb_id or '預設'})")

            except Exception as e:
                results.append(
                    {
                        "filename": file.filename,
                        "status": "error",
                        "message": f"檔案上傳失敗: {str(e)}",
                    }
                )
                logger.error(f"檔案上傳失敗: {file.filename}, 錯誤: {str(e)}")

        return {"results": results}
    except Exception as e:
        logger.error(f"上傳檔案失敗: {e}")
        raise HTTPException(status_code=500, detail="檔案上傳失敗")


@router.post("/document/list/files")
def get_kb_files(
    kb_id: str = Form(...), current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """獲取知識庫的檔案列表（管理員專用）"""
    try:
        # 檢查知識庫是否存在
        kb = knowledge_base_dao.get_knowledge_base(kb_id)
        if not kb:
            raise HTTPException(status_code=404, detail="知識庫不存在")

        paths = path_config.get_base_paths()
        kb_dir = os.path.join(paths["DOC_PATH"], kb_id)

        if not os.path.exists(kb_dir):
            return {"files": []}

        files = []
        for filename in os.listdir(kb_dir):
            file_path = os.path.join(kb_dir, filename)
            if os.path.isfile(file_path) and allowed_file(filename):
                stat = os.stat(file_path)
                files.append(
                    {
                        "name": filename,
                        "size": stat.st_size,
                        "upload_time": datetime.fromtimestamp(
                            stat.st_mtime
                        ).isoformat(),
                        "extension": os.path.splitext(filename)[1].lower(),
                    }
                )

        return {"files": sorted(files, key=lambda x: x["upload_time"], reverse=True)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"獲取檔案列表失敗: {e}")
        return {"files": []}


@router.post("/document/check/file/exists")
def check_file_exists(
    files: List[str] = Form(...),
    kb_id: str = Form(...),
    current_user: Dict[str, Any] = Depends(get_admin_user),
):
    """檢查檔案是否存在（管理員專用）"""
    result = {}
    paths = path_config.get_base_paths()
    kb_dir = os.path.join(paths["DOC_PATH"], kb_id)
    for filename in files:
        file_path = os.path.join(kb_dir, filename)
        result[filename] = os.path.exists(file_path)
    return result


@router.delete("/document/delete/files")
def delete_kb_file(
    kb_id: str = Form(...),
    files: List[str] = Form(...),
    current_user: Dict[str, Any] = Depends(get_admin_user),
):
    """刪除知識庫檔案（管理員專用）"""
    try:
        # 檢查知識庫是否存在
        kb = knowledge_base_dao.get_knowledge_base(kb_id)
        if not kb:
            raise HTTPException(status_code=404, detail="知識庫不存在")

        paths = path_config.get_base_paths()
        kb_dir = os.path.join(paths["DOC_PATH"], kb_id)
        md_dir = os.path.join(kb_dir, "markdown")
        results = []
        for filename in files:
            # 刪除原始檔案
            file_path = os.path.join(kb_dir, filename)
            if os.path.exists(file_path):
                os.remove(file_path)
                file_deleted = True
            else:
                file_deleted = False

            # 刪除對應的markdown檔案
            md_filename = f"{filename}.md"
            md_path = os.path.join(md_dir, md_filename)
            if os.path.exists(md_path):
                os.remove(md_path)
                md_deleted = True
            else:
                md_deleted = False

            if file_deleted or md_deleted:
                results.append(
                    {
                        "filename": filename,
                        "status": "success",
                        "message": "檔案刪除成功",
                        "file_deleted": file_deleted,
                        "md_deleted": md_deleted,
                    }
                )
                logger.info(f"檔案刪除成功: {filename}")
            else:
                results.append(
                    {
                        "filename": filename,
                        "status": "not_found",
                        "message": "檔案不存在",
                    }
                )
        return {"results": results}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"刪除檔案失敗: {e}")
        raise HTTPException(status_code=500, detail="檔案刪除失敗")


@router.get("/document/file/{filename}")
def get_document_file(
    kb_id: str, 
    filename: str, current_user: Dict[str, Any] = Depends(get_current_user)
):

    paths = path_config.get_base_paths()
    kb_dir = os.path.join(paths["DOC_PATH"], kb_id)
    file_path = os.path.join(kb_dir, filename)

    # 檢查檔案是否存在
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    # 使用 mimetypes 判斷檔案的 MIME 類型
    mime_type, _ = mimetypes.guess_type(file_path)

    # 若 MIME 類型無法判斷，則設為 application/octet-stream
    if mime_type is None:
        mime_type = "application/octet-stream"

    # URL 編碼檔名，確保支持中文或特殊字符
    encoded_filename = urllib.parse.quote(filename)

    # 為了確保瀏覽器顯示檔案而不是下載，設定 Content-Disposition: inline
    headers = {"Content-Disposition": f"inline; filename={encoded_filename}"}

    # 返回檔案並設置適當的 media_type 和 headers
    return FileResponse(
        file_path, filename=filename, media_type=mime_type, headers=headers
    )

@router.post("/document/markdown")
def get_markdown_file(
    kb_id: str = Form(...),
    filename: str = Form(...),
    current_user: Dict[str, Any] = Depends(get_admin_user),
):
    """獲取轉換後的 Markdown 檔案（管理員專用）"""
    try:
        paths = path_config.get_base_paths()
        markdown_path = os.path.join(paths["DOC_PATH"], kb_id, "markdown", filename)

        if not os.path.exists(markdown_path):
            raise HTTPException(status_code=404, detail="Markdown 檔案不存在")

        from urllib.parse import quote
        
        # 對檔名進行 URL 編碼以處理中文字符
        encoded_filename = quote(filename.encode('utf-8'))
        
        return FileResponse(
            markdown_path,
            media_type="text/markdown",
            filename=filename,
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"},
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"獲取 Markdown 檔案失敗: {e}")
        raise HTTPException(status_code=500, detail="獲取 Markdown 檔案失敗")
