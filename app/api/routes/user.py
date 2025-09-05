"""
認證相關 API 路由
"""
import os
from fastapi import APIRouter, HTTPException, Response, status, Depends
from typing import Dict, Any

from app.models.request import LoginRequest, RegisterRequest, PasswordChangeRequest
from app.models.response import LoginResponse, BaseResponse, UserResponse
from app.config.settings import app_config
from app.core.security.auth import auth_manager
from app.dao.user import user_dao
from app.api.dependencies import get_current_user
from app.utils.logging import get_logger

logger = get_logger(__name__)

router = APIRouter()


@router.post("/user/login", response_model=LoginResponse)
def api_login(login_data: LoginRequest, response: Response):
    """用戶登入"""
    # username 現在是 loginid
    user = auth_manager.authenticate_user(login_data.loginid, login_data.password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="用戶名或密碼錯誤"
        )

    # 更新登入時間
    user_dao.update_login_time(user["id"])

    # 創建包含時間戳的 JWT token
    token = auth_manager.create_access_token(
        data={"sub": str(user["id"]), "username": user["username"]}
    )

    # 從環境變數讀取 cookie 安全設定
    cookie_secure = os.getenv("COOKIE_SECURE", "false").lower() == "true"
    
    # 從 token 設定獲取最大生命週期
    settings = auth_manager.get_token_settings()

    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        max_age=settings['max_lifetime'],  # 使用動態設定的最大生命週期
        secure=cookie_secure,  # 從環境變數控制
        samesite="lax",
    )

    return LoginResponse(
        success=True,
        user={
            "id": user["id"],
            "username": user["username"],
            "role": user["role"],
        }
    )


@router.post("/user/register", response_model=BaseResponse)
def api_register(register_data: RegisterRequest):
    """用戶註冊"""
    # 檢查登入帳號是否已存在
    existing_user = user_dao.get_user_by_loginid(register_data.loginid)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="登入帳號已存在"
        )

    # 檢查是否為第一個用戶（設為管理員）
    all_users = user_dao.get_all_users()
    role = "admin" if len(all_users) == 0 else "user"

    # 加密密碼
    password_hash = auth_manager.get_password_hash(register_data.password)
    
    # 使用 loginid 作為預設的 username（如果沒有提供）
    username = getattr(register_data, 'username', register_data.loginid)

    # 創建用戶
    user_id = user_dao.create_user(register_data.loginid, username, register_data.email, password_hash, role)
    
    if user_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="註冊失敗"
        )

    return BaseResponse(
        success=True,
        message=f"註冊成功，用戶ID: {user_id}，角色: {role}"
    )


@router.get("/user/logout")
def api_logout():
    """登出並清除 token"""
    from fastapi.responses import RedirectResponse
    response = RedirectResponse(url="/login")
    response.delete_cookie("access_token")
    return response

@router.post("/user/change-password", response_model=BaseResponse)
def api_change_password(
    password_data: PasswordChangeRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """用戶變更密碼"""
    # 驗證舊密碼
    if not auth_manager.verify_password(
        password_data.old_password, current_user["password_hash"]
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="舊密碼錯誤"
        )

    # 生成新密碼雜湊
    new_password_hash = auth_manager.get_password_hash(password_data.new_password)

    # 更新資料庫
    success = user_dao.update_user_password(current_user["id"], new_password_hash)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="密碼更新失敗"
        )

    return BaseResponse(success=True, message="密碼變更成功")


@router.get("/user/current-user", response_model=UserResponse)
def api_get_current_user(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """獲取當前用戶資訊"""
    return UserResponse(
        id=current_user["id"],
        username=current_user["username"],
        role=current_user["role"]
    )

@router.get("/user/is/enable/think")
def is_enable_think():
    """檢查是否啟用思考模式"""
    try:
        val = app_config.get("is_enable_think", "false")
        return val.lower() == "true"
    except Exception as e:
        logger.error(f"取得配置 is_enable_think 失敗: {e}")
        return False