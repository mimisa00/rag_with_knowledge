-- =====================================================
-- 檔案: 20250910-04-permission-apis-defaults.sql
-- 描述: API 權限對應預設值
-- 作者: Claude AI Assistant
-- 日期: 2025-01-22
-- =====================================================

-- =====================================================
-- API 權限對應
-- 設定 API 端點訪問權限
-- =====================================================

INSERT IGNORE INTO permission_apis 
(api_pattern, method, permission_code, module_key, description, require_auth, priority, note) VALUES

-- =====================================================
-- 認證相關 API（公開）
-- =====================================================
('/api/user/login', 'POST', NULL, 'auth', '使用者登入', FALSE, 1,
'Backend: /app/api/routes/user.py:35:login()
Frontend: /frontend/static/login.html:85:submitLogin()
Form: #loginForm
Validation: checkLoginInput()'),

('/api/user/register', 'POST', NULL, 'auth', '使用者註冊', FALSE, 2,
'Backend: /app/api/routes/user.py:75:register()
Frontend: /frontend/static/register.html:95:submitRegister()
Form: #registerForm
Validation: checkRegisterInput()'),

('/api/user/activate', 'POST', NULL, 'auth', '帳號啟用', FALSE, 3,
'Backend: /app/api/routes/user.py:120:activate()
Frontend: /frontend/static/activate.html:145:submitActivate()
Form: #activateForm
Validation: checkPasswordMatch()'),

('/api/user/logout', 'POST', 'USER.LOGOUT', 'auth', '使用者登出', TRUE, 4,
'Backend: /app/api/routes/user.py:150:logout()
Frontend: 共用模組 user-menu-module.js:45:logout()
Button: #logoutBtn'),

-- =====================================================
-- 使用者相關 API
-- =====================================================
('/api/user/current-user', 'GET', 'USER.PROFILE_VIEW', 'user', '取得當前使用者資訊', TRUE, 10,
'Backend: /app/api/routes/user.py:180:get_current_user()
Frontend: 多個模組呼叫
Auth: @login_required'),

('/api/user/change-password', 'POST', 'USER.PASSWORD_CHANGE', 'user', '變更密碼', TRUE, 11,
'Backend: /app/api/routes/user.py:200:change_password()
Frontend: /frontend/static/js/modules/user-menu-module.js:80:changePassword()
Form: #changePasswordForm
Validation: checkPasswordStrength()'),

('/api/user/profile', 'PUT', 'USER.PROFILE_UPDATE', 'user', '更新個人資料', TRUE, 12,
'Backend: /app/api/routes/user.py:230:update_profile()
Frontend: /frontend/static/js/modules/user-profile-module.js:50:updateProfile()
Form: #profileForm'),

-- =====================================================
-- 問答系統 API
-- =====================================================
('/api/query', 'POST', 'USER.QUERY', 'query', 'AI 問答查詢', TRUE, 20,
'Backend: /app/api/routes/query.py:45:query()
Frontend: /frontend/static/js/modules/qa-module.js:120:sendQuery()
Button: #sendBtn
Streaming: Server-Sent Events'),

('/api/conversations', 'GET', 'USER.CONVERSATION_VIEW', 'query', '取得對話記錄', TRUE, 21,
'Backend: /app/api/routes/conversation.py:25:get_conversations()
Frontend: /frontend/static/js/modules/qa-module.js:200:loadConversations()'),

('/api/conversations/{id}', 'DELETE', 'USER.CONVERSATION_DELETE', 'query', '刪除對話記錄', TRUE, 22,
'Backend: /app/api/routes/conversation.py:55:delete_conversation()
Frontend: /frontend/static/js/modules/qa-module.js:250:deleteConversation()'),

('/api/knowledge-bases', 'GET', 'KB.LIST_VIEW', 'kb', '取得知識庫列表', TRUE, 23,
'Backend: /app/api/routes/knowledge_base.py:30:get_knowledge_bases()
Frontend: /frontend/static/js/modules/qa-module.js:100:loadKnowledgeBases()'),

-- =====================================================
-- 帳號管理 API
-- =====================================================
('/api/admin/users', 'GET', 'ACCOUNT.USER_VIEW', 'admin', '取得使用者列表', TRUE, 30,
'Backend: /app/api/routes/admin/user_management.py:35:get_users()
Frontend: /frontend/static/js/user-management-module.js:80:loadUsers()
Auth: @admin_required'),

('/api/admin/users', 'POST', 'ACCOUNT.USER_CREATE', 'admin', '新增使用者', TRUE, 31,
'Backend: /app/api/routes/admin/user_management.py:65:create_user()
Frontend: /frontend/static/js/user-management-module.js:150:createUser()
Form: #userForm
Button: #saveUserBtn'),

('/api/admin/users/{id}', 'PUT', 'ACCOUNT.USER_UPDATE', 'admin', '更新使用者', TRUE, 32,
'Backend: /app/api/routes/admin/user_management.py:95:update_user()
Frontend: /frontend/static/js/user-management-module.js:180:updateUser()
Form: #userForm'),

('/api/admin/users/{id}', 'DELETE', 'ACCOUNT.USER_DELETE', 'admin', '刪除使用者', TRUE, 33,
'Backend: /app/api/routes/admin/user_management.py:125:delete_user()
Frontend: /frontend/static/js/user-management-module.js:210:deleteUser()'),

('/api/admin/users/{id}/activate', 'POST', 'ACCOUNT.USER_ACTIVATE', 'admin', '啟用/停用使用者', TRUE, 34,
'Backend: /app/api/routes/admin/user_management.py:155:toggle_user_activation()
Frontend: /frontend/static/js/user-management-module.js:240:toggleUserActivation()'),

('/api/admin/users/{id}/reset-password', 'POST', 'ACCOUNT.USER_RESET_PASSWORD', 'admin', '重設使用者密碼', TRUE, 35,
'Backend: /app/api/routes/admin/user_management.py:185:reset_user_password()
Frontend: /frontend/static/js/user-management-module.js:270:resetPassword()'),

-- =====================================================
-- 組織管理 - 部門 API
-- =====================================================
('/api/organization/departments', 'GET', 'ORG.DEPT_VIEW', 'org', '取得部門列表', TRUE, 40,
'Backend: /app/api/routes/organization.py:40:get_departments()
Frontend: /frontend/static/js/organization-dept.js:60:loadDepartments()
Tree: #deptTree'),

('/api/organization/departments', 'POST', 'ORG.DEPT_CREATE', 'org', '新增部門', TRUE, 41,
'Backend: /app/api/routes/organization.py:70:create_department()
Frontend: /frontend/static/js/organization-dept.js:120:saveDepartment()
Form: #departmentForm
Button: #saveDeptBtn'),

('/api/organization/departments/{id}', 'GET', 'ORG.DEPT_VIEW', 'org', '取得部門詳情', TRUE, 42,
'Backend: /app/api/routes/organization.py:100:get_department()
Frontend: /frontend/static/js/organization-dept.js:90:loadDepartmentDetails()'),

('/api/organization/departments/{id}', 'PUT', 'ORG.DEPT_UPDATE', 'org', '更新部門', TRUE, 43,
'Backend: /app/api/routes/organization.py:130:update_department()
Frontend: /frontend/static/js/organization-dept.js:150:updateDepartment()
Form: #departmentForm'),

('/api/organization/departments/{id}', 'DELETE', 'ORG.DEPT_DELETE', 'org', '刪除部門', TRUE, 44,
'Backend: /app/api/routes/organization.py:160:delete_department()
Frontend: /frontend/static/js/organization-dept.js:180:deleteDepartment()'),

('/api/organization/departments/{id}/move', 'PUT', 'ORG.DEPT_MOVE', 'org', '調整部門層級', TRUE, 45,
'Backend: /app/api/routes/organization.py:190:move_department()
Frontend: /frontend/static/js/organization-dept.js:210:moveDepartment()
DragDrop: jsTree events'),

-- =====================================================
-- 組織管理 - 角色 API
-- =====================================================
('/api/organization/roles', 'GET', 'ORG.ROLE_VIEW', 'org', '取得角色列表', TRUE, 50,
'Backend: /app/api/routes/organization.py:220:get_roles()
Frontend: /frontend/static/js/organization-roles.js:50:loadRoles()'),

('/api/organization/roles', 'POST', 'ORG.ROLE_CREATE', 'org', '新增角色', TRUE, 51,
'Backend: /app/api/routes/organization.py:250:create_role()
Frontend: /frontend/static/js/organization-roles-crud.js:80:createRole()
Form: #roleForm
Button: #saveRoleBtn'),

('/api/organization/roles/{id}', 'PUT', 'ORG.ROLE_UPDATE', 'org', '更新角色', TRUE, 52,
'Backend: /app/api/routes/organization.py:280:update_role()
Frontend: /frontend/static/js/organization-roles-crud.js:110:updateRole()'),

('/api/organization/roles/{id}', 'DELETE', 'ORG.ROLE_DELETE', 'org', '刪除角色', TRUE, 53,
'Backend: /app/api/routes/organization.py:310:delete_role()
Frontend: /frontend/static/js/organization-roles-crud.js:140:deleteRole()'),

('/api/organization/role-analysis', 'POST', 'ORG.ROLE_ANALYSIS', 'org', 'AI 角色分析', TRUE, 54,
'Backend: /app/api/routes/organization.py:340:analyze_roles()
Frontend: /frontend/static/js/organization-role-analysis.js:30:analyzeRoles()
Button: #roleAnalysisBtn'),

-- =====================================================
-- 組織管理 - 員工 API
-- =====================================================
('/api/organization/users', 'GET', 'ORG.EMP_VIEW', 'org', '取得員工列表', TRUE, 60,
'Backend: /app/api/routes/organization.py:370:get_employees()
Frontend: /frontend/static/js/organization-emp.js:60:loadEmployees()'),

('/api/organization/users', 'POST', 'ORG.EMP_CREATE', 'org', '新增員工', TRUE, 61,
'Backend: /app/api/routes/organization.py:400:create_employee()
Frontend: /frontend/static/js/organization-emp-crud.js:90:createEmployee()
Form: #employeeForm
Button: #saveEmployeeBtn'),

('/api/organization/users/{id}', 'PUT', 'ORG.EMP_UPDATE', 'org', '更新員工', TRUE, 62,
'Backend: /app/api/routes/organization.py:430:update_employee()
Frontend: /frontend/static/js/organization-emp-crud.js:120:updateEmployee()'),

('/api/organization/users/{id}', 'DELETE', 'ORG.EMP_DELETE', 'org', '刪除員工', TRUE, 63,
'Backend: /app/api/routes/organization.py:460:delete_employee()
Frontend: /frontend/static/js/organization-emp-crud.js:150:deleteEmployee()'),

('/api/organization/users/{id}/roles', 'PUT', 'ORG.ROLE_ASSIGN', 'org', '指派員工角色', TRUE, 64,
'Backend: /app/api/routes/organization.py:490:assign_employee_roles()
Frontend: /frontend/static/js/organization-emp-roles.js:50:assignRoles()'),

-- =====================================================
-- 權限管理 - 矩陣 API
-- =====================================================
('/api/permissions/matrix', 'GET', 'PERM.MATRIX_VIEW', 'perm', '取得權限矩陣', TRUE, 70,
'Backend: /app/api/routes/permission.py:35:get_permission_matrix()
Frontend: /frontend/static/js/permission-matrix.js:45:loadMatrix()'),

('/api/permissions/matrix', 'POST', 'PERM.MATRIX_CREATE', 'perm', '新增權限項目', TRUE, 71,
'Backend: /app/api/routes/permission.py:65:create_permission()
Frontend: /frontend/static/js/permission-matrix.js:85:createPermission()
Form: #matrixForm
Button: #saveMatrixBtn'),

('/api/permissions/matrix/{id}', 'PUT', 'PERM.MATRIX_UPDATE', 'perm', '更新權限項目', TRUE, 72,
'Backend: /app/api/routes/permission.py:95:update_permission()
Frontend: /frontend/static/js/permission-matrix.js:115:updatePermission()'),

('/api/permissions/matrix/{id}', 'DELETE', 'PERM.MATRIX_DELETE', 'perm', '刪除權限項目', TRUE, 73,
'Backend: /app/api/routes/permission.py:125:delete_permission()
Frontend: /frontend/static/js/permission-matrix.js:145:deletePermission()'),

-- =====================================================
-- 權限管理 - 群組 API
-- =====================================================
('/api/permissions/groups', 'GET', 'PERM.GROUP_VIEW', 'perm', '取得權限群組', TRUE, 80,
'Backend: /app/api/routes/permission.py:155:get_permission_groups()
Frontend: /frontend/static/js/permission-group.js:40:loadGroups()'),

('/api/permissions/groups', 'POST', 'PERM.GROUP_CREATE', 'perm', '新增權限群組', TRUE, 81,
'Backend: /app/api/routes/permission.py:185:create_group()
Frontend: /frontend/static/js/permission-group.js:70:createGroup()
Form: #groupForm'),

('/api/permissions/groups/{id}', 'PUT', 'PERM.GROUP_UPDATE', 'perm', '更新權限群組', TRUE, 82,
'Backend: /app/api/routes/permission.py:215:update_group()
Frontend: /frontend/static/js/permission-group.js:100:updateGroup()'),

('/api/permissions/groups/{id}', 'DELETE', 'PERM.GROUP_DELETE', 'perm', '刪除權限群組', TRUE, 83,
'Backend: /app/api/routes/permission.py:245:delete_group()
Frontend: /frontend/static/js/permission-group.js:130:deleteGroup()'),

('/api/permissions/groups/{id}/permissions', 'GET', 'PERM.GROUP_VIEW', 'perm', '取得群組權限', TRUE, 84,
'Backend: /app/api/routes/permission.py:275:get_group_permissions()
Frontend: /frontend/static/js/permission-group.js:160:loadGroupPermissions()'),

('/api/permissions/groups/{id}/permissions', 'PUT', 'PERM.GROUP_PERM_UPDATE', 'perm', '更新群組權限', TRUE, 85,
'Backend: /app/api/routes/permission.py:305:update_group_permissions()
Frontend: /frontend/static/js/permission-group.js:190:updateGroupPermissions()'),

('/api/permissions/groups/{id}/department-roles', 'PUT', 'PERM.GROUP_DEPT_UPDATE', 'perm', '更新部門角色權限', TRUE, 86,
'Backend: /app/api/routes/permission.py:335:update_group_dept_roles()
Frontend: /frontend/static/js/permission-group.js:220:updateDeptRoles()'),

-- =====================================================
-- 權限管理 - 存取控制 API
-- =====================================================
('/api/permissions/urls', 'GET', 'PERM.URL_VIEW', 'perm', '取得 URL 權限', TRUE, 90,
'Backend: /app/api/routes/permission.py:365:get_url_permissions()
Frontend: /frontend/static/js/permission-access.js:35:loadUrlPermissions()'),

('/api/permissions/urls', 'POST', 'PERM.URL_CREATE', 'perm', '新增 URL 權限', TRUE, 91,
'Backend: /app/api/routes/permission.py:395:create_url_permission()
Frontend: /frontend/static/js/permission-access.js:65:createUrlPermission()'),

('/api/permissions/apis', 'GET', 'PERM.API_VIEW', 'perm', '取得 API 權限', TRUE, 92,
'Backend: /app/api/routes/permission.py:425:get_api_permissions()
Frontend: /frontend/static/js/permission-access.js:95:loadApiPermissions()'),

('/api/permissions/apis', 'POST', 'PERM.API_CREATE', 'perm', '新增 API 權限', TRUE, 93,
'Backend: /app/api/routes/permission.py:455:create_api_permission()
Frontend: /frontend/static/js/permission-access.js:125:createApiPermission()'),

('/api/permissions/cache/refresh', 'POST', 'PERM.CACHE_REFRESH', 'perm', '重新整理權限快取', TRUE, 94,
'Backend: /app/api/routes/permission.py:485:refresh_cache()
Frontend: /frontend/static/js/permission-access.js:155:refreshCache()
Button: #refreshCacheBtn'),

('/api/permissions/cache/clear', 'DELETE', 'PERM.CACHE_CLEAR', 'perm', '清除權限快取', TRUE, 95,
'Backend: /app/api/routes/permission.py:515:clear_cache()
Frontend: /frontend/static/js/permission-access.js:185:clearCache()
Button: #clearCacheBtn'),

-- =====================================================
-- 知識庫管理 API
-- =====================================================
('/api/knowledge_base/list', 'GET', 'KB.LIST_VIEW', 'kb', '取得知識庫列表', TRUE, 100,
'Backend: /app/api/routes/knowledge_base.py:40:list_knowledge_bases()
Frontend: /frontend/static/js/knowledge-base.js:55:loadKnowledgeBases()'),

('/api/knowledge_base/create', 'POST', 'KB.CREATE', 'kb', '建立知識庫', TRUE, 101,
'Backend: /app/api/routes/knowledge_base.py:70:create_knowledge_base()
Frontend: /frontend/static/js/knowledge-base.js:85:createKnowledgeBase()
Form: #kbForm
Button: #saveKBBtn'),

('/api/knowledge_base/{id}', 'GET', 'KB.VIEW', 'kb', '取得知識庫詳情', TRUE, 102,
'Backend: /app/api/routes/knowledge_base.py:100:get_knowledge_base()
Frontend: /frontend/static/js/knowledge-base.js:115:loadKnowledgeBaseDetails()'),

('/api/knowledge_base/{id}', 'PUT', 'KB.UPDATE', 'kb', '更新知識庫', TRUE, 103,
'Backend: /app/api/routes/knowledge_base.py:130:update_knowledge_base()
Frontend: /frontend/static/js/knowledge-base.js:145:updateKnowledgeBase()'),

('/api/knowledge_base/{id}', 'DELETE', 'KB.DELETE', 'kb', '刪除知識庫', TRUE, 104,
'Backend: /app/api/routes/knowledge_base.py:160:delete_knowledge_base()
Frontend: /frontend/static/js/knowledge-base.js:175:deleteKnowledgeBase()
Button: #deleteKBBtn'),

('/api/knowledge_base/{id}/upload', 'POST', 'KB.FILE_UPLOAD', 'kb', '上傳檔案', TRUE, 105,
'Backend: /app/api/routes/knowledge_base.py:190:upload_files()
Frontend: /frontend/static/js/knowledge-base.js:205:uploadFiles()
Button: #uploadBtn
FormData: multipart/form-data'),

('/api/knowledge_base/{id}/files', 'GET', 'KB.FILE_VIEW', 'kb', '取得檔案列表', TRUE, 106,
'Backend: /app/api/routes/knowledge_base.py:220:get_files()
Frontend: /frontend/static/js/knowledge-base.js:235:loadFiles()'),

('/api/knowledge_base/{id}/files', 'DELETE', 'KB.FILE_DELETE', 'kb', '刪除檔案', TRUE, 107,
'Backend: /app/api/routes/knowledge_base.py:250:delete_files()
Frontend: /frontend/static/js/knowledge-base.js:265:deleteFiles()
Button: #removeFilesBtn'),

('/api/knowledge_base/{id}/index', 'POST', 'KB.INDEX_CREATE', 'kb', '建立索引', TRUE, 108,
'Backend: /app/api/routes/knowledge_base.py:280:create_index()
Frontend: /frontend/static/js/knowledge-base-index-module.js:30:createIndex()
Button: #prepareSelectedBtn'),

('/api/knowledge_base/{id}/index', 'GET', 'KB.INDEX_VIEW', 'kb', '查看索引', TRUE, 109,
'Backend: /app/api/routes/knowledge_base.py:310:get_index()
Frontend: /frontend/static/js/knowledge-base-index-module.js:60:loadIndex()'),

('/api/knowledge_base/{id}/index', 'DELETE', 'KB.INDEX_DELETE', 'kb', '刪除索引', TRUE, 110,
'Backend: /app/api/routes/knowledge_base.py:340:delete_index()
Frontend: /frontend/static/js/knowledge-base-index-module.js:90:deleteIndex()'),

-- =====================================================
-- 系統管理 API
-- =====================================================
('/api/system/params', 'GET', 'SYSTEM.PARAM_VIEW', 'system', '取得系統參數', TRUE, 120,
'Backend: /app/api/routes/system.py:30:get_params()
Frontend: /frontend/static/js/system-params.js:40:loadParams()'),

('/api/system/params', 'PUT', 'SYSTEM.PARAM_UPDATE', 'system', '更新系統參數', TRUE, 121,
'Backend: /app/api/routes/system.py:60:update_params()
Frontend: /frontend/static/js/system-params.js:70:updateParams()
Form: #paramsForm
Button: #updateConfigBtn'),

('/api/system/params/export', 'GET', 'SYSTEM.PARAM_EXPORT', 'system', '匯出系統參數', TRUE, 122,
'Backend: /app/api/routes/system.py:90:export_params()
Frontend: /frontend/static/js/system-params.js:100:exportParams()'),

('/api/system/params/import', 'POST', 'SYSTEM.PARAM_IMPORT', 'system', '匯入系統參數', TRUE, 123,
'Backend: /app/api/routes/system.py:120:import_params()
Frontend: /frontend/static/js/system-params.js:130:importParams()'),

('/api/system/params/reset', 'POST', 'SYSTEM.PARAM_RESET', 'system', '重置系統參數', TRUE, 124,
'Backend: /app/api/routes/system.py:150:reset_params()
Frontend: /frontend/static/js/system-params.js:160:resetParams()');

-- =====================================================
-- 完成訊息
-- =====================================================
SELECT COUNT(*) AS total_apis, 'API 權限對應已載入' AS message FROM permission_apis;