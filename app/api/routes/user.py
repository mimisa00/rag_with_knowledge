"""
認證相關 API 路由
"""
import os
from fastapi import APIRouter, HTTPException, Response, status, Depends
from typing import Dict, Any, List

from app.models.request import (
    LoginRequest, RegisterRequest, PasswordChangeRequest, UserProfileUpdateRequest,
    TokenVerificationRequest, AccountActivationRequest, ResendActivationEmailRequest
)
from app.models.response import LoginResponse, BaseResponse, UserResponse, TokenVerificationResponse
from app.config.settings import app_config
from app.core.security.auth import auth_manager
from app.core.security.permissions import permission_required
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
@permission_required("USER.LOGOUT")
def api_logout(current_user: Dict[str, Any] = Depends(get_current_user)):
    """登出並清除 token"""
    from fastapi.responses import RedirectResponse
    response = RedirectResponse(url="/login")
    response.delete_cookie("access_token")
    response.delete_cookie("_sticky")
    return response

@router.post("/user/change-password", response_model=BaseResponse)
@permission_required("USER.PASSWORD_CHANGE")
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
@permission_required("USER.PROFILE_VIEW")
def api_get_current_user(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """獲取當前用戶資訊"""
    # 獲取完整使用者資訊
    complete_user_info = user_dao.get_user_complete_info(current_user["id"])
    
    if complete_user_info:
        return UserResponse(
            id=complete_user_info["id"],
            username=complete_user_info["username"],
            role=complete_user_info["role"],
            title=complete_user_info.get("title"),
            employee_no=complete_user_info.get("employee_no"),
            department_name=complete_user_info.get("department_name"),
            primary_role_name=complete_user_info.get("primary_role_name"),
            primary_role_type=complete_user_info.get("primary_role_type"),
            permission_groups=complete_user_info.get("permission_groups", [])
        )
    else:
        # 回退到基本資訊（向下相容）
        return UserResponse(
            id=current_user["id"],
            username=current_user["username"],
            role=current_user["role"]
        )


@router.put("/user/profile", response_model=BaseResponse)
@permission_required("USER.PROFILE_UPDATE")
def api_update_profile(
    profile_data: UserProfileUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """更新用戶資料"""
    try:
        # 準備更新資料
        updates = {}
        if profile_data.username is not None:
            updates["username"] = profile_data.username
        if profile_data.email is not None:
            updates["email"] = profile_data.email
        
        # 如果沒有任何需要更新的資料
        if not updates:
            return BaseResponse(success=True, message="沒有資料需要更新")
        
        # 更新用戶資料
        success = user_dao.update_user(current_user["id"], updates)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="更新用戶資料失敗"
            )
        
        return BaseResponse(success=True, message="用戶資料更新成功")
    except Exception as e:
        logger.error(f"更新用戶資料失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="系統錯誤"
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


@router.get("/user/permissions")
def get_user_permissions(current_user: Dict[str, Any] = Depends(get_current_user)):
    """獲取當前用戶的權限列表"""
    from app.core.security.permissions import get_user_permissions, get_user_permission_codes
    
    try:
        # 獲取用戶權限
        user_id = current_user.get("id")
        
        # 如果是管理員，返回所有權限
        if current_user.get("role") == "admin":
            # 從資料庫獲取所有權限代碼
            from app.dao.permission_matrix import permission_matrix_dao
            all_permissions = permission_matrix_dao.get_all(is_active=True)
            permission_codes = [p["permission_key"] for p in all_permissions]
            
            return {
                "success": True,
                "permissions": permission_codes,
                "groups": [],
                "is_admin": True
            }
        
        # 獲取用戶的權限代碼
        permission_codes = get_user_permission_codes(user_id)
        
        # 獲取用戶的權限群組
        permissions_detail = get_user_permissions(user_id)
        groups = [
            {
                "id": p["id"],
                "code": p["code"],
                "name": p["name"],
                "type": p["type"]
            }
            for p in permissions_detail
        ]
        
        return {
            "success": True,
            "permissions": permission_codes,
            "groups": groups,
            "is_admin": False
        }
        
    except Exception as e:
        logger.error(f"獲取用戶權限失敗: {e}")
        return {
            "success": False,
            "permissions": [],
            "groups": [],
            "error": str(e)
        }


@router.post("/auth/verify-activation-token", response_model=TokenVerificationResponse)
def api_verify_activation_token(token_data: TokenVerificationRequest):
    """驗證啟用 token"""
    try:
        # 驗證 token
        token_info = user_dao.verify_activation_token(token_data.token)
        
        if not token_info:
            return TokenVerificationResponse(
                success=False,
                valid=False,
                message="Token 無效或已過期"
            )
        
        # 獲取密碼策略
        password_policy = user_dao.get_password_policy('default_policy')
        
        # 準備使用者資訊
        user_info = {
            "id": token_info["user_id"],
            "name": token_info["username"],
            "email": token_info["email"],
            "loginid": token_info["loginid"]
        }
        
        # 準備密碼要求資訊
        password_requirements = {
            "min_length": password_policy.get("min_length", 8) if password_policy else 8,
            "require_uppercase": password_policy.get("require_uppercase", True) if password_policy else True,
            "require_lowercase": password_policy.get("require_lowercase", True) if password_policy else True,
            "require_numbers": password_policy.get("require_numbers", True) if password_policy else True,
            "require_special_chars": password_policy.get("require_special_chars", True) if password_policy else True
        }
        
        return TokenVerificationResponse(
            success=True,
            valid=True,
            user=user_info,
            password_requirements=password_requirements,
            message="Token 驗證成功"
        )
        
    except Exception as e:
        logger.error(f"驗證啟用 token 失敗: {e}")
        return TokenVerificationResponse(
            success=False,
            valid=False,
            message="系統錯誤"
        )


@router.post("/auth/activate-account", response_model=BaseResponse)
def api_activate_account(activation_data: AccountActivationRequest):
    """帳號啟用 API"""
    try:
        # 再次驗證 token
        token_info = user_dao.verify_activation_token(activation_data.token)
        
        if not token_info:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Token 無效或已過期"
            )
        
        # 驗證密碼強度
        password_policy = user_dao.get_password_policy('default_policy')
        if password_policy:
            if len(activation_data.password) < password_policy.get("min_length", 8):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"密碼長度至少需要 {password_policy.get('min_length', 8)} 個字元"
                )
            
            # 檢查其他密碼要求
            import re
            if password_policy.get("require_uppercase", True) and not re.search(r'[A-Z]', activation_data.password):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="密碼必須包含大寫字母"
                )
            
            if password_policy.get("require_lowercase", True) and not re.search(r'[a-z]', activation_data.password):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="密碼必須包含小寫字母"
                )
            
            if password_policy.get("require_numbers", True) and not re.search(r'\d', activation_data.password):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="密碼必須包含數字"
                )
            
            if password_policy.get("require_special_chars", True) and not re.search(r'[!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>\/?]', activation_data.password):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="密碼必須包含特殊字元"
                )
        
        # 加密密碼
        password_hash = auth_manager.get_password_hash(activation_data.password)
        
        # 啟用帳號並設定密碼
        user_id = token_info["user_id"]
        success = user_dao.activate_user_account(user_id, password_hash)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="帳號啟用失敗"
            )
        
        # 標記 token 為已使用
        user_dao.use_activation_token(activation_data.token)
        
        return BaseResponse(
            success=True,
            message="帳號啟用成功"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"帳號啟用失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="系統錯誤"
        )


@router.post("/auth/resend-activation-email", response_model=BaseResponse)
def api_resend_activation_email(email_data: ResendActivationEmailRequest):
    """重新發送啟用郵件 API"""
    try:
        # 查找使用者
        user = user_dao.get_user_by_email(email_data.email)
        
        if not user:
            # 為了安全考量，即使使用者不存在也回傳成功訊息
            return BaseResponse(
                success=True,
                message="如果該電子郵件地址存在於系統中，啟用郵件將會重新發送"
            )
        
        # 檢查使用者是否已經啟用
        if user.get("is_active", False):
            return BaseResponse(
                success=False,
                message="該帳號已經啟用"
            )
        
        # 使用統一的啟用郵件處理函數
        from app.core.email import process_activation_email
        
        result = process_activation_email(
            user_id=user["id"],
            user_email=email_data.email,
            user_name=user.get("username", user.get("full_name", "用戶")),
            clear_old_tokens=True,  # 重新發送需要清除舊 token
            check_password_strategy=False  # 使用者自助不檢查策略（假設都需要）
        )
        
        # 如果郵件沒發送成功，記錄備案
        if not result.get("email_sent") and result.get("success"):
            activation_token = result.get("token")
            if activation_token:
                activation_url = f"http://localhost:8080/activate?token={activation_token}"
                logger.info(f"啟用郵件連結備案: {activation_url}")
        
        return BaseResponse(
            success=result.get("success", False),
            message=result.get("message", "啟用郵件已重新發送，請檢查您的信箱")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"重新發送啟用郵件失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="系統錯誤"
        )