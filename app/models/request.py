"""
請求模型定義
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional


class LoginRequest(BaseModel):
    """登入請求模型"""
    loginid: str
    password: str


class RegisterRequest(BaseModel):
    """註冊請求模型"""
    loginid: str
    username: str
    email: str
    password: str


class PasswordChangeRequest(BaseModel):
    """密碼變更請求模型"""
    old_password: str
    new_password: str


class AdminPasswordChangeRequest(BaseModel):
    """管理員密碼變更請求模型"""
    new_password: str


class UserProfileUpdateRequest(BaseModel):
    """用戶資料更新請求模型"""
    username: Optional[str] = Field(None, min_length=1, max_length=100, description="用戶姓名")
    email: Optional[EmailStr] = Field(None, description="電子郵件地址")


class KnowledgeBaseCreateRequest(BaseModel):
    """知識庫創建請求模型"""
    id: str
    name: str
    system_prompt: str = ""
    conversation_history_limit: Optional[int] = 0
    note: str = ""


class KnowledgeBaseUpdateRequest(BaseModel):
    """知識庫更新請求模型"""
    name: Optional[str] = None
    status: Optional[str] = None
    system_prompt: Optional[str] = None
    conversation_history_limit: Optional[int] = None
    note: Optional[str] = None


class QueryRequest(BaseModel):
    """查詢請求模型"""
    question: str
    keyword: Optional[str] = ""
    conv_id: Optional[str] = ""
    think: Optional[bool] = False
    kb_id: Optional[str] = None
    top_k: Optional[int] = 20
    rerank_top_k: Optional[int] = 16


class QueryStreamRequest(BaseModel):
    """串流查詢請求模型"""
    question: str
    kb_id: Optional[str] = None
    top_k: Optional[int] = 20
    rerank_top_k: Optional[int] = 16


class DocumentUploadRequest(BaseModel):
    """文檔上傳請求模型"""
    kb_id: str
    filename: Optional[str] = None


class AdminUserUpdateRequest(BaseModel):
    """管理員用戶更新請求模型"""
    role: str


class AdminUserEditRequest(BaseModel):
    """管理員用戶編輯請求模型"""
    username: Optional[str] = Field(None, min_length=1, max_length=100, description="用戶姓名")
    email: Optional[EmailStr] = Field(None, description="電子郵件地址")
    is_active: Optional[bool] = Field(None, description="帳號啟用狀態")


class TokenVerificationRequest(BaseModel):
    """Token 驗證請求模型"""
    token: str = Field(..., description="啟用 token")


class AccountActivationRequest(BaseModel):
    """帳號啟用請求模型"""
    token: str = Field(..., description="啟用 token")
    password: str = Field(..., min_length=8, description="新密碼")


class ResendActivationEmailRequest(BaseModel):
    """重發啟用郵件請求模型"""
    email: EmailStr = Field(..., description="電子郵件地址")