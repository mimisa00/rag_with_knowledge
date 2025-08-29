"""
回應模型定義
"""
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class BaseResponse(BaseModel):
    """基礎回應模型"""
    success: bool = True
    message: Optional[str] = None
    error: Optional[str] = None


class LoginResponse(BaseResponse):
    """登入回應模型"""
    user: Optional[Dict[str, Any]] = None


class UserResponse(BaseModel):
    """用戶資訊回應模型"""
    id: int
    username: str
    role: str


class KnowledgeBaseResponse(BaseModel):
    """知識庫回應模型"""
    id: str
    name: str
    status: str
    system_prompt: str
    note: str
    created_at: datetime
    updated_at: Optional[datetime] = None


class ConversationResponse(BaseModel):
    """對話回應模型"""
    id: str
    title: str
    first_message_time: datetime
    last_message_time: datetime
    message_count: int
    messages: List[Dict[str, str]]


class FileUploadResult(BaseModel):
    """檔案上傳結果模型"""
    filename: str
    status: str  # success, exists, error
    message: str
    file_deleted: Optional[bool] = None
    md_deleted: Optional[bool] = None


class FileUploadResponse(BaseResponse):
    """檔案上傳回應模型"""
    results: List[FileUploadResult]


class IndexStatusResponse(BaseModel):
    """索引狀態回應模型"""
    count: int
    chunks: List[str]
    index_exists: bool


class ValidationResponse(BaseModel):
    """驗證回應模型"""
    status: str  # ok, invalid
    reason: Optional[str] = None
    vectors: Optional[int] = None