"""
請求模型定義
"""
from pydantic import BaseModel
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


class KnowledgeBaseCreateRequest(BaseModel):
    """知識庫創建請求模型"""
    id: str
    name: str
    system_prompt: str = ""
    note: str = ""


class KnowledgeBaseUpdateRequest(BaseModel):
    """知識庫更新請求模型"""
    name: Optional[str] = None
    status: Optional[str] = None
    system_prompt: Optional[str] = None
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