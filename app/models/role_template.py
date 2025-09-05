"""
角色模板資料模型
"""
from typing import Optional, Dict, Any, List
from datetime import datetime, date
from pydantic import BaseModel, Field


class RoleTemplateBase(BaseModel):
    """角色模板基礎模型"""
    code: str = Field(..., description="模板代碼")
    name: str = Field(..., description="模板名稱")
    description: Optional[str] = Field(None, description="模板描述")
    role_type: str = Field(..., description="角色類型：manager/staff")
    level: int = Field(0, description="角色層級")
    default_permissions: Optional[Dict[str, Any]] = Field(None, description="預設權限配置")
    is_active: bool = Field(True, description="是否啟用")
    sort_order: int = Field(0, description="排序順序")


class RoleTemplateCreate(RoleTemplateBase):
    """建立角色模板請求模型"""
    pass


class RoleTemplateUpdate(BaseModel):
    """更新角色模板請求模型"""
    name: Optional[str] = None
    description: Optional[str] = None
    role_type: Optional[str] = None
    level: Optional[int] = None
    default_permissions: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class RoleTemplate(RoleTemplateBase):
    """角色模板完整模型"""
    id: int
    is_system: bool = Field(False, description="是否為系統預設模板")
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int] = None
    updated_by: Optional[int] = None
    
    class Config:
        orm_mode = True


class RoleTemplateResponse(RoleTemplate):
    """角色模板回應模型"""
    usage_count: int = Field(0, description="使用次數")
    department_count: int = Field(0, description="使用部門數")
    user_count: int = Field(0, description="使用人數")


# =====================================================
# 部門角色模型
# =====================================================

class DepartmentRoleBase(BaseModel):
    """部門角色基礎模型"""
    department_id: int = Field(..., description="部門ID")
    template_id: int = Field(..., description="模板ID")
    parent_id: Optional[int] = Field(None, description="父角色ID")
    code: str = Field(..., description="角色代碼")
    name: str = Field(..., description="角色名稱")
    role_type: str = Field(..., description="角色類型")
    level: int = Field(0, description="角色層級")
    permissions: Optional[Dict[str, Any]] = Field(None, description="自訂權限")
    is_active: bool = Field(True, description="是否啟用")


class DepartmentRoleCreate(BaseModel):
    """建立部門角色請求模型"""
    template_id: int = Field(..., description="模板ID")
    name: Optional[str] = Field(None, description="角色名稱（可選，預設使用部門名-模板名）")
    parent_id: Optional[int] = Field(None, description="父角色ID（可選，系統會自動推導）")
    permissions: Optional[Dict[str, Any]] = Field(None, description="自訂權限")


class DepartmentRoleUpdate(BaseModel):
    """更新部門角色請求模型"""
    name: Optional[str] = None
    parent_id: Optional[int] = None
    level: Optional[int] = None
    permissions: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class DepartmentRole(DepartmentRoleBase):
    """部門角色完整模型"""
    id: int
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int] = None
    updated_by: Optional[int] = None
    
    class Config:
        orm_mode = True


class DepartmentRoleResponse(DepartmentRole):
    """部門角色回應模型"""
    department_name: str = Field(..., description="部門名稱")
    template_name: str = Field(..., description="模板名稱")
    user_count: int = Field(0, description="使用人數")


# =====================================================
# 用戶部門角色模型
# =====================================================

class UserDepartmentRoleBase(BaseModel):
    """用戶部門角色基礎模型"""
    user_id: int = Field(..., description="用戶ID")
    department_role_id: int = Field(..., description="部門角色ID")
    is_primary: bool = Field(False, description="是否為主要角色")
    effective_date: Optional[date] = Field(None, description="生效日期")
    expiry_date: Optional[date] = Field(None, description="失效日期")


class UserDepartmentRoleAssign(BaseModel):
    """指派用戶角色請求模型"""
    user_ids: List[int] = Field(..., description="用戶ID列表")
    is_primary: bool = Field(False, description="是否為主要角色")
    effective_date: Optional[date] = Field(None, description="生效日期")
    expiry_date: Optional[date] = Field(None, description="失效日期")


class UserDepartmentRole(UserDepartmentRoleBase):
    """用戶部門角色完整模型"""
    id: int
    assigned_at: datetime
    assigned_by: Optional[int] = None
    
    class Config:
        orm_mode = True


class UserDepartmentRoleResponse(UserDepartmentRole):
    """用戶部門角色回應模型"""
    username: str
    email: str
    role_name: str
    role_type: str
    department_name: str
    assigned_by_name: Optional[str] = None


# =====================================================
# 批量建立部門角色（新增部門時使用）
# =====================================================

class DepartmentRolesBatchCreate(BaseModel):
    """批量建立部門角色請求模型"""
    department_id: int = Field(..., description="部門ID")
    role_templates: List[Dict[str, Any]] = Field(..., description="角色模板列表")
    
    class Config:
        schema_extra = {
            "example": {
                "department_id": 1,
                "role_templates": [
                    {
                        "template_id": 1,
                        "name": "資訊部-主管"
                    },
                    {
                        "template_id": 2,
                        "name": "資訊部-員工"
                    }
                ]
            }
        }


class RoleAssignmentSuggestionCreate(BaseModel):
    """角色分配建議批量創建請求模型"""
    suggestions: List[Dict[str, Any]] = Field(..., description="選中的角色分配建議列表")
    
    class Config:
        schema_extra = {
            "example": {
                "suggestions": [
                    {
                        "department_id": 25,
                        "department_name": "NODE_14",
                        "recommended_roles": [
                            {
                                "template_id": 5,
                                "suggested_role_name": "NODE_14-資深工程師",
                                "suggested_parent_role_id": 136
                            },
                            {
                                "template_id": 6,
                                "suggested_role_name": "NODE_14-工程師", 
                                "suggested_parent_role_id": 136
                            }
                        ]
                    }
                ]
            }
        }