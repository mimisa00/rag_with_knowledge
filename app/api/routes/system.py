"""
系統參數管理 API 路由
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import JSONResponse, StreamingResponse
from typing import Dict, Any, Optional
from pydantic import BaseModel
import json
import io

from app.config.settings import app_config
from app.api.dependencies import get_admin_user
from app.utils.logging import get_logger
from app.core.security.permissions import permission_required

logger = get_logger(__name__)

router = APIRouter(prefix="/system", tags=["System Parameters"])


class SystemParamsUpdate(BaseModel):
    """系統參數更新模型"""
    params: Dict[str, Any]


@router.get("/params")
@permission_required("SYSTEM.PARAM_VIEW")
def get_params(current_user: Dict[str, Any] = Depends(get_admin_user)):
    """取得系統參數"""
    try:
        params = app_config.all
        return {
            "success": True,
            "data": params,
            "message": "系統參數取得成功"
        }
    except Exception as e:
        logger.error(f"取得系統參數失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="取得系統參數失敗"
        )


@router.put("/params")
@permission_required("SYSTEM.PARAM_UPDATE")
def update_params(
    update_data: SystemParamsUpdate,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """更新系統參數"""
    try:
        # 檢查是否有 LLM provider 變更
        provider_changed = False
        if 'llm_provider' in update_data.params:
            old_provider = app_config.all.get('llm_provider', 'ollama')
            new_provider = update_data.params['llm_provider']
            provider_changed = (old_provider != new_provider)
            if provider_changed:
                logger.info(f"LLM Provider 變更: {old_provider} -> {new_provider}")

        # 更新配置
        app_config.update(update_data.params)

        # 如果 LLM provider 變更，清除舊的 client 實例
        if provider_changed:
            from app.core.rag import llm_client
            llm_client.llm_client = None
            logger.info("已清除舊的 LLM client 實例")

        # 更新 Ollama 模型選項（這會重新初始化 client）
        from app.core.rag import update_ollama_model_options
        update_ollama_model_options()

        return {
            "success": True,
            "message": "系統參數更新成功"
        }
    except Exception as e:
        logger.error(f"更新系統參數失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新系統參數失敗: {str(e)}"
        )


@router.get("/params/export")
@permission_required("SYSTEM.PARAM_EXPORT")
def export_params(current_user: Dict[str, Any] = Depends(get_admin_user)):
    """匯出系統參數"""
    try:
        params = app_config.all
        
        # 建立 JSON 字串
        params_json = json.dumps(params, indent=2, ensure_ascii=False)
        
        # 建立檔案流
        file_stream = io.BytesIO(params_json.encode('utf-8'))
        
        return StreamingResponse(
            io.BytesIO(params_json.encode('utf-8')),
            media_type="application/json",
            headers={
                "Content-Disposition": "attachment; filename=system_params.json"
            }
        )
    except Exception as e:
        logger.error(f"匯出系統參數失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="匯出系統參數失敗"
        )


@router.post("/params/import")
@permission_required("SYSTEM.PARAM_IMPORT")
async def import_params(
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """匯入系統參數"""
    try:
        # 檢查檔案類型
        if not file.filename.endswith('.json'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="只支援 JSON 格式檔案"
            )
        
        # 讀取檔案內容
        content = await file.read()
        
        try:
            params = json.loads(content.decode('utf-8'))
        except json.JSONDecodeError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"JSON 格式錯誤: {str(e)}"
            )
        
        # 檢查參數格式
        if not isinstance(params, dict):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="參數檔案格式不正確，必須是 JSON 物件"
            )
        
        # 更新配置
        app_config.update(params)
        
        # 更新 Ollama 模型選項
        from app.core.rag import update_ollama_model_options
        update_ollama_model_options()
        
        return {
            "success": True,
            "message": f"成功匯入 {len(params)} 個參數",
            "imported_keys": list(params.keys())
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"匯入系統參數失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"匯入系統參數失敗: {str(e)}"
        )


@router.post("/params/reset")
@permission_required("SYSTEM.PARAM_RESET")
def reset_params(
    reset_keys: Optional[Dict[str, list]] = None,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """重設系統參數"""
    try:
        if reset_keys and 'keys' in reset_keys:
            # 重設指定的參數
            keys_to_reset = reset_keys['keys']
            reset_count = 0
            
            for key in keys_to_reset:
                if app_config.has_key(key):
                    app_config.delete(key)
                    reset_count += 1
            
            message = f"成功重設 {reset_count} 個參數"
        else:
            # 重設所有參數
            app_config.reset_all()
            message = "所有系統參數已重設為預設值"
        
        # 更新 Ollama 模型選項
        from app.core.rag import update_ollama_model_options
        update_ollama_model_options()
        
        return {
            "success": True,
            "message": message
        }
        
    except Exception as e:
        logger.error(f"重設系統參數失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"重設系統參數失敗: {str(e)}"
        )


@router.get("/backup")
@permission_required("SYSTEM.BACKUP")
def system_backup(current_user: Dict[str, Any] = Depends(get_admin_user)):
    """系統備份"""
    try:
        # 這裡應該實作系統備份邏輯
        # 暫時返回模擬結果
        return {
            "success": True,
            "message": "系統備份功能待實作",
            "backup_id": "backup_placeholder"
        }
    except Exception as e:
        logger.error(f"系統備份失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="系統備份失敗"
        )


@router.post("/restore")
@permission_required("SYSTEM.RESTORE")
def system_restore(
    backup_data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """系統還原"""
    try:
        # 這裡應該實作系統還原邏輯
        # 暫時返回模擬結果
        return {
            "success": True,
            "message": "系統還原功能待實作"
        }
    except Exception as e:
        logger.error(f"系統還原失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="系統還原失敗"
        )


@router.get("/monitor")
@permission_required("SYSTEM.MONITOR")
def system_monitor(current_user: Dict[str, Any] = Depends(get_admin_user)):
    """系統監控"""
    try:
        import psutil
        import datetime
        
        # 取得系統資訊
        cpu_usage = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        monitor_data = {
            "timestamp": datetime.datetime.now().isoformat(),
            "cpu": {
                "usage_percent": cpu_usage,
                "count": psutil.cpu_count()
            },
            "memory": {
                "total": memory.total,
                "used": memory.used,
                "available": memory.available,
                "percent": memory.percent
            },
            "disk": {
                "total": disk.total,
                "used": disk.used,
                "free": disk.free,
                "percent": round((disk.used / disk.total) * 100, 2)
            }
        }
        
        return {
            "success": True,
            "data": monitor_data,
            "message": "系統監控資料取得成功"
        }
    except Exception as e:
        logger.error(f"取得系統監控資料失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="取得系統監控資料失敗"
        )


@router.post("/maintenance")
@permission_required("SYSTEM.MAINTENANCE")
def system_maintenance(
    maintenance_data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """系統維護"""
    try:
        action = maintenance_data.get('action', 'status')
        
        if action == 'status':
            # 取得維護狀態
            return {
                "success": True,
                "data": {
                    "maintenance_mode": False,
                    "last_maintenance": None
                },
                "message": "維護狀態取得成功"
            }
        elif action == 'enable':
            # 啟用維護模式
            return {
                "success": True,
                "message": "維護模式已啟用（功能待實作）"
            }
        elif action == 'disable':
            # 停用維護模式
            return {
                "success": True,
                "message": "維護模式已停用（功能待實作）"
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="不支援的維護動作"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"系統維護操作失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="系統維護操作失敗"
        )