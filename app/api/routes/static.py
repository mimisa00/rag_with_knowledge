"""
靜態檔案和頁面路由
"""
import os
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, RedirectResponse, Response
from typing import Dict, Any, Optional

from app.config.paths import path_config
from app.api.dependencies import get_current_user, get_current_user_optional, get_admin_user
from app.utils.logging import get_logger

logger = get_logger(__name__)

router = APIRouter()

# 獲取 HTML 路徑配置
html_paths = path_config.get_html_paths()


@router.get("/login")
def login_page(
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """登入頁面"""
    if current_user:
        return RedirectResponse(url="/dashboard", status_code=302)
    
    return FileResponse(
        html_paths["HTML_PATH_LOGIN"],
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


@router.get("/register")
def register_page(
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """註冊頁面"""
    if current_user:
        return RedirectResponse(url="/dashboard", status_code=302)
    
    return FileResponse(
        html_paths["HTML_PATH_REGISTER"],
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


@router.get("/dashboard")
def dashboard_page(current_user: Dict[str, Any] = Depends(get_current_user)):
    """主儀表板頁面"""
    try:
        # 防止瀏覽器緩存，確保每次都載入正確的頁面
        headers = {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        }
        
        if current_user["role"] == "admin":
            return FileResponse(html_paths["HTML_PATH_DASHBOARD_ADMIN"], headers=headers)
        else:
            return FileResponse(html_paths["HTML_PATH_DASHBOARD"], headers=headers)
    except Exception as e:
        logger.error(f"載入儀表板頁面失敗: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin")
def admin_page(current_user: Dict[str, Any] = Depends(get_admin_user)):
    """管理首頁（管理員專用）"""
    return FileResponse(html_paths["HTML_PATH_ADMIN"])


@router.get("/admin/knowledge-base")
def knowledge_base_page(current_user: Dict[str, Any] = Depends(get_admin_user)):
    """知識庫管理頁面（管理員專用）"""
    return FileResponse(html_paths["HTML_PATH_KNOWLEDGE_BASE"])


@router.get("/admin/system-params")
def system_params_page(current_user: Dict[str, Any] = Depends(get_admin_user)):
    """系統參數管理頁面（管理員專用）"""
    return FileResponse(html_paths["HTML_PATH_SYSTEM_PARAMS"])


@router.get("/admin/user-management")
def user_management_page(current_user: Dict[str, Any] = Depends(get_admin_user)):
    """帳號管理頁面（管理員專用）"""
    return FileResponse(html_paths["HTML_PATH_USER_MANAGEMENT"])


@router.get("/admin/organization")
def organization_page(current_user: Dict[str, Any] = Depends(get_admin_user)):
    """組織管理頁面（管理員專用）"""
    return FileResponse(html_paths["HTML_PATH_ORGANIZATION"])


@router.get("/dashboard_admin")
def dashboard_admin_page(current_user: Dict[str, Any] = Depends(get_admin_user)):
    """傳統管理頁面（管理員專用）"""
    return FileResponse(html_paths["HTML_PATH_DASHBOARD_ADMIN"])


@router.get("/showindex")
def showindex_page(current_user: Dict[str, Any] = Depends(get_admin_user)):
    """索引顯示頁面（管理員專用）"""
    return FileResponse(html_paths["HTML_PATH_SHOWINDEX"])


@router.get("/md_viewer")
def md_viewer_page(current_user: Dict[str, Any] = Depends(get_admin_user)):
    """Markdown 查看器頁面（管理員專用）"""
    return FileResponse(html_paths["HTML_PATH_MD_VIEWER"])


@router.get("/js/components/{component_name:path}")
async def get_component_script(
    component_name: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    獲取共用元件腳本文件（所有用戶可存取）
    
    Args:
        component_name: 元件文件名稱（相對於 components 目錄）
    
    Returns:
        JavaScript 文件內容
    
    Raises:
        HTTPException: 如果文件不存在或路徑不安全
    """
    try:
        # 確保腳本名稱安全（防止路徑遍歷攻擊）
        component_name = Path(component_name).name
        if not component_name.endswith('.js'):
            raise HTTPException(status_code=400, detail="只能請求 JavaScript 文件")
        
        # 構建文件路徑
        base_paths = path_config.get_base_paths()
        components_dir = os.path.join(
            base_paths["STATIC_DIR"], 
            "js", 
            "components"
        )
        file_path = os.path.join(components_dir, component_name)
        
        # 確保文件路徑在 components 目錄內
        real_file_path = os.path.realpath(file_path)
        real_components_dir = os.path.realpath(components_dir)
        if not real_file_path.startswith(real_components_dir):
            logger.warning(f"嘗試存取不安全的路徑: {component_name}")
            raise HTTPException(status_code=403, detail="存取被拒絕")
        
        # 檢查文件是否存在
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="文件不存在")
        
        # 讀取並返回文件內容
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        return Response(
            content=content,
            media_type="application/javascript",
            headers={
                "Cache-Control": "max-age=3600",  # 元件可以快取
                "X-Content-Type-Options": "nosniff"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"讀取元件腳本失敗: {e}")
        raise HTTPException(status_code=500, detail="內部伺服器錯誤")


@router.get("/css/components/{component_name:path}")
async def get_component_style(
    component_name: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    獲取共用元件樣式文件（所有用戶可存取）
    
    Args:
        component_name: 元件文件名稱（相對於 components 目錄）
    
    Returns:
        CSS 文件內容
    
    Raises:
        HTTPException: 如果文件不存在或路徑不安全
    """
    try:
        # 確保文件名稱安全（防止路徑遍歷攻擊）
        component_name = Path(component_name).name
        if not component_name.endswith('.css'):
            raise HTTPException(status_code=400, detail="只能請求 CSS 文件")
        
        # 構建文件路徑
        base_paths = path_config.get_base_paths()
        components_dir = os.path.join(
            base_paths["STATIC_DIR"], 
            "css", 
            "components"
        )
        file_path = os.path.join(components_dir, component_name)
        
        # 確保文件路徑在 components 目錄內
        real_file_path = os.path.realpath(file_path)
        real_components_dir = os.path.realpath(components_dir)
        if not real_file_path.startswith(real_components_dir):
            logger.warning(f"嘗試存取不安全的路徑: {component_name}")
            raise HTTPException(status_code=403, detail="存取被拒絕")
        
        # 檢查文件是否存在
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="文件不存在")
        
        # 讀取並返回文件內容
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        return Response(
            content=content,
            media_type="text/css",
            headers={
                "Cache-Control": "max-age=3600",  # 元件可以快取
                "X-Content-Type-Options": "nosniff"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"讀取元件樣式失敗: {e}")
        raise HTTPException(status_code=500, detail="內部伺服器錯誤")


@router.get("/api/admin/scripts/{script_name:path}")
async def get_admin_script(
    script_name: str,
    current_user: Dict[str, Any] = Depends(get_admin_user)
):
    """
    獲取管理員腳本文件（需要管理員權限）
    
    Args:
        script_name: 腳本文件名稱（相對於 admin-modules 目錄）
        current_user: 當前用戶（必須是管理員）
    
    Returns:
        JavaScript 文件內容
    
    Raises:
        HTTPException: 如果文件不存在或路徑不安全
    """
    try:
        # 確保腳本名稱安全（防止路徑遍歷攻擊）
        script_name = Path(script_name).name
        if not script_name.endswith('.js'):
            raise HTTPException(status_code=400, detail="只能請求 JavaScript 文件")
        
        # 構建文件路徑
        base_paths = path_config.get_base_paths()
        admin_modules_dir = os.path.join(
            base_paths["STATIC_DIR"], 
            "js", 
            "admin-modules"
        )
        file_path = os.path.join(admin_modules_dir, script_name)
        
        # 確保文件路徑在 admin-modules 目錄內
        real_file_path = os.path.realpath(file_path)
        real_admin_dir = os.path.realpath(admin_modules_dir)
        if not real_file_path.startswith(real_admin_dir):
            logger.warning(f"嘗試存取不安全的路徑: {script_name}")
            raise HTTPException(status_code=403, detail="存取被拒絕")
        
        # 檢查文件是否存在
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="文件不存在")
        
        # 讀取並返回文件內容
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 記錄存取日誌
        logger.info(f"管理員 {current_user['username']} 存取腳本: {script_name}")
        
        return Response(
            content=content,
            media_type="application/javascript",
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
                "X-Content-Type-Options": "nosniff"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"讀取管理員腳本失敗: {e}")
        raise HTTPException(status_code=500, detail="內部伺服器錯誤")

