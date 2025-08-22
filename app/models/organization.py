"""
組織管理系統資料模型
"""
from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field
import json


class Department(BaseModel):
    """部門模型"""
    id: Optional[int] = None
    parent_id: Optional[int] = None
    external_id: Optional[str] = None
    code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    path: Optional[str] = Field(None, max_length=500)
    level: int = 0
    sort_order: int = 0
    is_active: bool = True
    sync_source: Optional[str] = Field(None, max_length=50)
    metadata: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[int] = None
    updated_by: Optional[int] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class Role(BaseModel):
    """角色模型"""
    id: Optional[int] = None
    code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    role_type: str = Field(default="custom", max_length=20)
    permissions: Optional[Dict[str, Any]] = None
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[int] = None
    updated_by: Optional[int] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class UserExtension(BaseModel):
    """使用者擴充資訊模型"""
    user_id: int
    department_id: Optional[int] = None
    external_id: Optional[str] = Field(None, max_length=100)
    employee_no: Optional[str] = Field(None, max_length=50)
    title: Optional[str] = Field(None, max_length=100)
    manager_id: Optional[int] = None
    auth_source: str = Field(default="local", max_length=20)
    password_strategy: Optional[str] = Field(None, max_length=20)
    activation_token: Optional[str] = Field(None, max_length=255)
    activation_expires: Optional[datetime] = None
    last_sync_at: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class UserRole(BaseModel):
    """使用者角色關聯模型"""
    id: Optional[int] = None
    user_id: int
    role_id: int
    department_id: Optional[int] = None
    assigned_at: Optional[datetime] = None
    assigned_by: Optional[int] = None
    expires_at: Optional[datetime] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class SystemMode(BaseModel):
    """系統模式設定模型"""
    id: Optional[int] = None
    mode_key: str = Field(..., max_length=50)
    mode_value: str = Field(..., max_length=255)
    category: str = Field(default="general", max_length=50)
    description: Optional[str] = None
    updated_at: Optional[datetime] = None
    updated_by: Optional[int] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class PasswordPolicy(BaseModel):
    """密碼策略模型"""
    id: Optional[int] = None
    policy_name: str = Field(..., max_length=50)
    policy_type: str = Field(..., max_length=20)
    apply_to: str = Field(default="all", max_length=20)
    target_id: Optional[str] = Field(None, max_length=100)
    min_length: int = 8
    require_uppercase: bool = True
    require_lowercase: bool = True
    require_numbers: bool = True
    require_special: bool = False
    expire_days: int = 90
    force_change_first: bool = True
    config: Optional[Dict[str, Any]] = None
    is_active: bool = True
    created_at: Optional[datetime] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class AuditLog(BaseModel):
    """審計日誌模型"""
    id: Optional[int] = None
    user_id: Optional[int] = None
    action: str = Field(..., max_length=50)
    target_type: Optional[str] = Field(None, max_length=50)
    target_id: Optional[str] = Field(None, max_length=100)
    changes: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = Field(None, max_length=45)
    user_agent: Optional[str] = None
    created_at: Optional[datetime] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


# 請求模型
class DepartmentCreate(BaseModel):
    """建立部門請求"""
    code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    parent_id: Optional[int] = None
    external_id: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True
    metadata: Optional[Dict[str, Any]] = None


class DepartmentUpdate(BaseModel):
    """更新部門請求"""
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    parent_id: Optional[int] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None
    metadata: Optional[Dict[str, Any]] = None


class RoleCreate(BaseModel):
    """建立角色請求"""
    code: str = Field(..., min_length=1, max_length=50, description="角色代碼不能為空")
    name: str = Field(..., min_length=1, max_length=100, description="角色名稱不能為空")
    description: Optional[str] = None
    role_type: str = Field(default="custom", max_length=20)
    permissions: Optional[Dict[str, Any]] = None
    is_active: bool = True


class RoleUpdate(BaseModel):
    """更新角色請求"""
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="角色名稱不能為空")
    description: Optional[str] = None
    role_type: Optional[str] = Field(None, max_length=20, description="角色類型")
    permissions: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class UserRoleAssign(BaseModel):
    """分配使用者角色請求"""
    user_id: int
    role_id: int
    department_id: Optional[int] = None
    expires_at: Optional[datetime] = None


class UserExtensionUpdate(BaseModel):
    """更新使用者擴充資訊請求"""
    department_id: Optional[int] = None
    employee_no: Optional[str] = Field(None, max_length=50)
    title: Optional[str] = Field(None, max_length=100)
    manager_id: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None


class SystemModeUpdate(BaseModel):
    """更新系統模式請求"""
    mode_value: str = Field(..., max_length=255)
    description: Optional[str] = None


class UserUpdate(BaseModel):
    """更新使用者完整資訊請求"""
    # 基本資訊
    username: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, max_length=100)
    password: Optional[str] = Field(None, min_length=6)
    is_active: Optional[bool] = None
    # 擴充資訊
    department_id: Optional[int] = None
    employee_no: Optional[str] = Field(None, max_length=50)
    title: Optional[str] = Field(None, max_length=100)
    # 角色
    role_ids: Optional[List[int]] = None

# 回應模型
class DepartmentResponse(Department):
    """部門回應模型"""
    children: Optional[List['DepartmentResponse']] = []
    user_count: Optional[int] = 0


class RoleResponse(Role):
    """角色回應模型"""
    user_count: Optional[int] = 0


class UserWithRoles(BaseModel):
    """包含角色的使用者模型"""
    user_id: int
    loginid: str  # 登入帳號
    username: str  # 真實姓名
    email: str
    is_active: bool
    department: Optional[Department] = None
    roles: List[Role] = []
    user_extension: Optional[UserExtension] = None


# 更新 forward references
DepartmentResponse.model_rebuild()