"""
組織管理系統資料模型
"""
from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field, validator, EmailStr
import json
import re


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


class PermissionGroup(BaseModel):
    """權限群組模型"""
    id: Optional[int] = None
    code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    permission_type: str = Field(default="custom", max_length=20)  # 保留欄位名稱以相容資料庫
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
    activation_scheduled: Optional[datetime] = None
    last_sync_at: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class UserPermissionGroup(BaseModel):
    """使用者權限群組關聯模型"""
    id: Optional[int] = None
    user_id: int
    permission_group_id: int
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


class PermissionGroupCreate(BaseModel):
    """建立權限群組請求"""
    code: str = Field(..., min_length=1, max_length=50, description="權限群組代碼不能為空")
    name: str = Field(..., min_length=1, max_length=100, description="權限群組名稱不能為空")
    description: Optional[str] = None
    permission_type: str = Field(default="custom", max_length=20)  # 保留欄位名稱以相容資料庫
    permissions: Optional[Dict[str, Any]] = None
    is_active: bool = True


class PermissionGroupUpdate(BaseModel):
    """更新權限群組請求"""
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="權限群組名稱不能為空")
    description: Optional[str] = None
    permission_type: Optional[str] = Field(None, max_length=20, description="權限群組類型")  # 保留欄位名稱
    permissions: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class UserPermissionGroupAssign(BaseModel):
    """分配使用者權限群組請求"""
    user_id: int
    permission_group_id: int
    department_id: Optional[int] = None
    expires_at: Optional[datetime] = None


class UserExtensionUpdate(BaseModel):
    """更新使用者擴充資訊請求"""
    department_id: Optional[int] = None
    employee_no: Optional[str] = Field(None, max_length=50)
    title: Optional[str] = Field(None, max_length=100)
    manager_id: Optional[int] = None
    activation_expires: Optional[datetime] = Field(None, description="帳號停用時間")
    activation_scheduled: Optional[datetime] = Field(None, description="預約啟用時間")
    metadata: Optional[Dict[str, Any]] = None


class SystemModeUpdate(BaseModel):
    """更新系統模式請求"""
    mode_value: str = Field(..., max_length=255)
    description: Optional[str] = None


class UserCreate(BaseModel):
    """新增使用者請求模型"""
    # 基本資訊 (必填)
    loginid: str = Field(..., min_length=3, max_length=50, description="登入帳號")
    username: str = Field(..., min_length=2, max_length=100, description="真實姓名")
    email: EmailStr = Field(..., description="電子信箱")
    password: str = Field(..., min_length=6, description="密碼")
    
    # 組織資訊 (必填)
    department_id: int = Field(..., description="部門ID")
    primary_role_id: int = Field(..., description="主要角色ID")
    
    # 擴充資訊 (選填)
    employee_no: Optional[str] = Field(None, max_length=50, description="員工編號")
    title: Optional[str] = Field(None, max_length=100, description="職稱")
    
    # 其他角色和權限 (選填)
    department_roles: Optional[List[int]] = Field(default=[], description="其他部門角色ID列表")
    permission_groups: Optional[List[int]] = Field(default=[], description="權限群組ID列表")
    
    # 帳號狀態
    is_active: bool = Field(default=True, description="帳號狀態")
    
    # 密碼策略 (系統內部使用)
    password_strategy: Optional[str] = Field(default="MANUAL", max_length=20, description="密碼策略")
    
    @validator('loginid')
    def validate_loginid(cls, v):
        """驗證登入帳號格式"""
        if not v or not v.strip():
            raise ValueError('登入帳號不能為空')
        
        # 只允許英數字、點號、底線、短橫線
        if not re.match(r'^[a-zA-Z0-9._-]+$', v):
            raise ValueError('登入帳號只能包含英數字、點號、底線或短橫線')
        
        return v.strip().lower()
    
    @validator('username')
    def validate_username(cls, v):
        """驗證真實姓名"""
        if not v or not v.strip():
            raise ValueError('姓名不能為空')
        return v.strip()
    
    @validator('password')
    def validate_password(cls, v):
        """驗證密碼強度"""
        if not v or len(v) < 6:
            raise ValueError('密碼長度至少6個字元')
        
        # 檢查是否包含至少一個數字和一個字母
        if not re.search(r'[0-9]', v) or not re.search(r'[a-zA-Z]', v):
            raise ValueError('密碼必須包含至少一個數字和一個字母')
        
        return v
    
    @validator('employee_no')
    def validate_employee_no(cls, v):
        """驗證員工編號格式"""
        if v is not None:
            v = v.strip()
            if v and not re.match(r'^[A-Z0-9-]+$', v):
                raise ValueError('員工編號只能包含大寫英文、數字或短橫線')
        return v
    
    @validator('department_id')
    def validate_department_id(cls, v):
        """驗證部門ID"""
        if not v or v <= 0:
            raise ValueError('必須選擇有效的部門')
        return v
    
    @validator('primary_role_id') 
    def validate_primary_role_id(cls, v):
        """驗證主要角色ID"""
        if not v or v <= 0:
            raise ValueError('必須選擇有效的主要角色')
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "loginid": "john.doe",
                "username": "約翰·道爾",
                "email": "john.doe@company.com",
                "password": "password123",
                "department_id": 1,
                "primary_role_id": 2,
                "employee_no": "EMP001",
                "title": "軟體工程師",
                "department_roles": [3, 4],
                "permission_groups": [1],
                "is_active": True
            }
        }

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
    activation_expires: Optional[datetime] = Field(None, description="帳號停用時間")
    activation_scheduled: Optional[datetime] = Field(None, description="預約啟用時間")
    # 角色資訊
    primary_role_id: Optional[int] = Field(None, description="主要角色ID")
    department_roles: Optional[List[int]] = Field(None, description="其他部門角色ID列表")
    # 權限群組
    permission_group_ids: Optional[List[int]] = None


class UserStatusUpdate(BaseModel):
    """使用者狀態更新請求（用於 PATCH 操作）"""
    is_active: Optional[bool] = None
    activation_expires: Optional[datetime] = Field(None, description="帳號停用時間")
    activation_scheduled: Optional[datetime] = Field(None, description="預約啟用時間")

# 回應模型
class DepartmentResponse(Department):
    """部門回應模型"""
    children: Optional[List['DepartmentResponse']] = []
    user_count: Optional[int] = 0


class PermissionGroupResponse(PermissionGroup):
    """權限群組回應模型"""
    user_count: Optional[int] = 0


class UserWithPermissionGroups(BaseModel):
    """包含權限群組的使用者模型"""
    user_id: int
    loginid: str  # 登入帳號
    username: str  # 真實姓名
    email: str
    is_active: bool
    department: Optional[Department] = None
    permission_groups: List[PermissionGroup] = []
    user_extension: Optional[UserExtension] = None
    department_roles: Optional[List[Dict[str, Any]]] = []  # 新增部門角色資訊欄位
    last_login_at: Optional[datetime] = None  # 最後登入時間
    last_activity_at: Optional[datetime] = None  # 最後活動時間


# 更新 forward references
DepartmentResponse.model_rebuild()