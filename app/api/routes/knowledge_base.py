"""
知識庫相關 API 路由
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List

from app.models.request import KnowledgeBaseCreateRequest, KnowledgeBaseUpdateRequest
from app.dao.knowledge_base import knowledge_base_dao
from app.api.dependencies import get_admin_user, get_current_user
from app.utils.logging import get_logger

logger = get_logger(__name__)

router = APIRouter()


@router.get("/knowledge-bases")
def get_available_knowledge_bases(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """獲取可用的知識庫列表（供用戶選擇）"""
    try:
        from app.core.rag import indexing
        
        knowledge_bases = knowledge_base_dao.get_knowledge_bases()
        # 只返回啟用狀態且有索引的知識庫
        available_kbs = []
        for kb in knowledge_bases:
            if kb["status"] == "enable":
                # 檢查索引狀態
                try:
                    index_status = indexing.get_index_status(kb["id"])
                    # 只有索引狀態為 ok 或 valid 的知識庫才會被返回
                    if index_status.get("status") in ["ok", "valid"]:
                        available_kbs.append(kb)
                    elif index_status.get("is_valid") and index_status.get("index_vectors", 0) > 0:
                        # 備用檢查：如果 status 欄位不存在但 is_valid 為 True 且有向量
                        available_kbs.append(kb)
                except Exception as index_error:
                    # 如果檢查索引失敗，記錄但不加入列表
                    logger.debug(f"知識庫 {kb['id']} 索引檢查失敗: {index_error}")
                    continue
        
        return {"knowledge_bases": available_kbs}
    except Exception as e:
        logger.error(f"獲取知識庫列表失敗: {e}")
        return {"knowledge_bases": []}


@router.get("/admin/knowledge-bases")
def get_all_knowledge_bases(current_user: Dict[str, Any] = Depends(get_admin_user)):
    """獲取所有知識庫列表（管理員專用，包含停用的）"""
    try:
        knowledge_bases = knowledge_base_dao.get_knowledge_bases()
        return {"knowledge_bases": knowledge_bases}
    except Exception as e:
        logger.error(f"獲取知識庫列表失敗: {e}")
        return {"knowledge_bases": []}


@router.post("/knowledge-bases")
def create_knowledge_base(
    kb_data: KnowledgeBaseCreateRequest,
    current_user: Dict[str, Any] = Depends(get_admin_user),
):
    """創建知識庫（管理員專用）"""
    import re
    import os
    from app.config.paths import path_config
    
    # 驗證 kb_id 格式
    if not re.match(r"^[a-zA-Z0-9_-]{1,36}$", kb_data.id):
        raise HTTPException(
            status_code=400,
            detail="知識庫 ID 只能包含英文、數字、底線和連字符，長度不超過36字元",
        )
    
    # 檢查 ID 是否已存在
    if knowledge_base_dao.check_kb_id_exists(kb_data.id):
        logger.warning(f"嘗試創建已存在的知識庫 ID: {kb_data.id}")
        raise HTTPException(status_code=400, detail=f"知識庫 ID '{kb_data.id}' 已存在，請使用不同的 ID")
    
    # 驗證 system_prompt 長度
    if len(kb_data.system_prompt) > 1024:
        raise HTTPException(status_code=400, detail="系統提示詞長度不能超過1024字元")
    
    # 創建知識庫
    success = knowledge_base_dao.create_knowledge_base(
        kb_data.id, kb_data.name, kb_data.system_prompt, kb_data.note
    )
    
    if not success:
        # 再次檢查是否因為 ID 重複（可能是並發問題）
        if knowledge_base_dao.check_kb_id_exists(kb_data.id):
            raise HTTPException(status_code=400, detail=f"知識庫 ID '{kb_data.id}' 已被其他用戶創建")
        else:
            raise HTTPException(status_code=500, detail="知識庫創建失敗，請稍後再試")
    
    # 創建對應的文件目錄
    paths = path_config.get_base_paths()
    kb_doc_dir = os.path.join(paths["DOC_PATH"], kb_data.id)
    kb_md_dir = os.path.join(kb_doc_dir, "markdown")
    
    try:
        # 創建目錄，設置權限為 755
        os.makedirs(kb_doc_dir, mode=0o755, exist_ok=True)
        os.makedirs(kb_md_dir, mode=0o755, exist_ok=True)
        # 嘗試設置目錄權限（在容器內可能無效，但不會出錯）
        try:
            os.chmod(kb_doc_dir, 0o755)
            os.chmod(kb_md_dir, 0o755)
        except Exception as perm_error:
            logger.warning(f"無法設置目錄權限: {perm_error}")
        
        logger.info(f"知識庫 {kb_data.id} 目錄創建成功")
    except Exception as e:
        logger.error(f"創建知識庫目錄失敗: {e}")
        # 嘗試回滾數據庫操作
        try:
            rollback_success = knowledge_base_dao.delete_knowledge_base(kb_data.id, logical_delete=False)
            if rollback_success:
                logger.info(f"已回滾知識庫 {kb_data.id} 的創建")
            else:
                logger.error(f"回滾知識庫 {kb_data.id} 失敗")
        except Exception as rollback_error:
            logger.error(f"回滾知識庫時發生錯誤: {rollback_error}")
        raise HTTPException(status_code=500, detail=f"知識庫目錄創建失敗: {str(e)}")

    return {"message": "知識庫創建成功", "id": kb_data.id}


@router.get("/knowledge-bases/{kb_id}")
def get_knowledge_base(
    kb_id: str, 
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """獲取知識庫詳情（管理員專用）"""
    kb = knowledge_base_dao.get_knowledge_base(kb_id)
    if not kb:
        raise HTTPException(status_code=404, detail="知識庫不存在")
    return {"knowledge_base": kb}


@router.put("/knowledge-bases/{kb_id}")
def update_knowledge_base(
    kb_id: str,
    kb_data: KnowledgeBaseUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_admin_user),
):
    """更新知識庫（管理員專用）"""
    # 檢查知識庫是否存在
    kb = knowledge_base_dao.get_knowledge_base(kb_id)
    if not kb:
        raise HTTPException(status_code=404, detail="知識庫不存在")

    # 驗證 system_prompt 長度
    if kb_data.system_prompt is not None and len(kb_data.system_prompt) > 1024:
        raise HTTPException(status_code=400, detail="系統提示詞長度不能超過1024字元")

    # 驗證 status 值
    if kb_data.status is not None and kb_data.status not in ["enable", "disable"]:
        raise HTTPException(status_code=400, detail="狀態值必須為 enable 或 disable")

    success = knowledge_base_dao.update_knowledge_base(
        kb_id, kb_data.name, kb_data.status, kb_data.system_prompt, kb_data.note
    )

    if not success:
        raise HTTPException(status_code=500, detail="知識庫更新失敗")

    return {"message": "知識庫更新成功"}


@router.delete("/knowledge-bases/{kb_id}")
def delete_knowledge_base(
    kb_id: str,
    delete_files: bool = False,
    current_user: Dict[str, Any] = Depends(get_admin_user),
):
    """刪除知識庫（管理員專用）"""
    import os
    import shutil
    from app.config.paths import path_config
    
    # 檢查知識庫是否存在
    kb = knowledge_base_dao.get_knowledge_base(kb_id)
    if not kb:
        raise HTTPException(status_code=404, detail="知識庫不存在")

    # 邏輯刪除知識庫
    success = knowledge_base_dao.delete_knowledge_base(kb_id, logical_delete=True)
    if not success:
        raise HTTPException(status_code=500, detail="知識庫刪除失敗")

    # 如果選擇刪除檔案，則刪除相關目錄和索引
    if delete_files:
        try:
            paths = path_config.get_base_paths()
            # 刪除文件目錄
            kb_doc_dir = os.path.join(paths["DOC_PATH"], kb_id)
            if os.path.exists(kb_doc_dir):
                shutil.rmtree(kb_doc_dir)
                logger.info(f"知識庫 {kb_id} 文件目錄已刪除")

            # 刪除索引檔案
            from app.core.rag.indexing import get_kb_faiss_dir
            kb_faiss_dir = get_kb_faiss_dir(kb_id)
            if os.path.exists(kb_faiss_dir):
                shutil.rmtree(kb_faiss_dir)
                logger.info(f"知識庫 {kb_id} 索引目錄已刪除")

        except Exception as e:
            logger.error(f"刪除知識庫檔案失敗: {e}")
            # 不中斷流程，因為邏輯刪除已經成功

    return {"message": "知識庫刪除成功", "files_deleted": delete_files}