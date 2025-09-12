-- =====================================================
-- 檔案: 20250910-05-permission-actions-defaults.sql
-- 描述: 前端動作權限預設值
-- 作者: Claude AI Assistant
-- 日期: 2025-01-22
-- =====================================================

-- =====================================================
-- 前端動作權限
-- 設定前端按鈕和功能的權限控制
-- =====================================================

INSERT IGNORE INTO permission_actions 
(module_key, action_key, permission_code, name, description, note) VALUES

-- =====================================================
-- 組織管理 - 部門操作
-- =====================================================
('org', 'dept_add', 'ORG.DEPT_CREATE', '新增部門按鈕', '顯示新增部門按鈕',
'HTML: /frontend/static/admin/organization.html:220
JS: /frontend/static/js/organization-dept.js:89:initButtons()
Element: #addDepartmentBtn
Event: click->openAddDeptDialog()
Check: hasPermission("ORG.DEPT_CREATE")'),

('org', 'dept_edit', 'ORG.DEPT_UPDATE', '編輯部門按鈕', '顯示編輯部門按鈕',
'HTML: 動態生成於部門卡片
JS: /frontend/static/js/organization-dept.js:234:renderDeptCard()
Element: .edit-dept-btn
Event: click->editDepartment(deptId)
Check: hasPermission("ORG.DEPT_UPDATE")'),

('org', 'dept_delete', 'ORG.DEPT_DELETE', '刪除部門按鈕', '顯示刪除部門按鈕',
'HTML: 動態生成於部門卡片
JS: /frontend/static/js/organization-dept.js:245:renderDeptCard()
Element: .delete-dept-btn
Event: click->deleteDepartment(deptId)
Check: hasPermission("ORG.DEPT_DELETE")'),

('org', 'dept_toggle', 'ORG.DEPT_ACTIVATE', '啟停部門開關', '顯示啟用/停用部門開關',
'HTML: /frontend/static/admin/organization.html:263
JS: /frontend/static/js/organization-dept.js:312:toggleInactiveDepts()
Element: #toggleInactiveBtn
Event: click->toggleInactiveDepts()
Check: hasPermission("ORG.DEPT_ACTIVATE")'),

-- =====================================================
-- 組織管理 - 角色操作
-- =====================================================
('org', 'role_add', 'ORG.ROLE_CREATE', '新增角色按鈕', '顯示新增角色按鈕',
'HTML: /frontend/static/admin/organization.html:297
JS: /frontend/static/js/organization-roles.js:95:initButtons()
Element: #addRoleBtn
Event: click->openAddRoleDialog()
Check: hasPermission("ORG.ROLE_CREATE")'),

('org', 'role_edit', 'ORG.ROLE_UPDATE', '編輯角色按鈕', '顯示編輯角色按鈕',
'HTML: 動態生成於角色卡片
JS: /frontend/static/js/organization-roles-card.js:145:renderRoleCard()
Element: .edit-role-btn
Event: click->editRole(roleId)
Check: hasPermission("ORG.ROLE_UPDATE")'),

('org', 'role_delete', 'ORG.ROLE_DELETE', '刪除角色按鈕', '顯示刪除角色按鈕',
'HTML: 動態生成於角色卡片
JS: /frontend/static/js/organization-roles-card.js:156:renderRoleCard()
Element: .delete-role-btn
Event: click->deleteRole(roleId)
Check: hasPermission("ORG.ROLE_DELETE")'),

('org', 'role_analysis', 'ORG.ROLE_ANALYSIS', 'AI 角色分析按鈕', '顯示 AI 角色優化分析按鈕',
'HTML: /frontend/static/admin/organization.html:301
JS: /frontend/static/js/organization-role-analysis.js:25:initAnalysisButton()
Element: #roleAnalysisBtn
Event: click->showRoleRelationshipAnalysis()
Check: hasPermission("ORG.ROLE_ANALYSIS")'),

-- =====================================================
-- 組織管理 - 員工操作
-- =====================================================
('org', 'emp_add', 'ORG.EMP_CREATE', '新增員工按鈕', '顯示新增員工按鈕',
'HTML: /frontend/static/admin/organization.html:393
JS: /frontend/static/js/organization-emp.js:112:initButtons()
Element: #addEmployeeBtn
Event: click->openAddEmployeeDialog()
Check: hasPermission("ORG.EMP_CREATE")'),

('org', 'emp_edit', 'ORG.EMP_UPDATE', '編輯員工按鈕', '顯示編輯員工按鈕',
'HTML: 動態生成於員工卡片
JS: /frontend/static/js/organization-emp-card.js:178:renderEmployeeCard()
Element: .edit-emp-btn
Event: click->editEmployee(empId)
Check: hasPermission("ORG.EMP_UPDATE")'),

('org', 'emp_delete', 'ORG.EMP_DELETE', '刪除員工按鈕', '顯示刪除員工按鈕',
'HTML: 動態生成於員工卡片
JS: /frontend/static/js/organization-emp-card.js:189:renderEmployeeCard()
Element: .delete-emp-btn
Event: click->deleteEmployee(empId)
Check: hasPermission("ORG.EMP_DELETE")'),

('org', 'emp_activate', 'ORG.EMP_ACTIVATE', '啟停員工開關', '顯示啟用/停用員工開關',
'HTML: 動態生成於員工卡片
JS: /frontend/static/js/organization-emp-card.js:200:renderEmployeeCard()
Element: .toggle-emp-activation
Event: change->toggleEmployeeActivation(empId)
Check: hasPermission("ORG.EMP_ACTIVATE")'),

-- =====================================================
-- 權限管理 - 矩陣操作
-- =====================================================
('perm', 'matrix_add', 'PERM.MATRIX_CREATE', '新增權限項目按鈕', '顯示新增權限項目按鈕',
'HTML: /frontend/static/admin/permission-management.html:207
JS: /frontend/static/js/permission-matrix.js:67:initButtons()
Element: #addMatrixBtn
Event: click->openAddMatrixDialog()
Check: hasPermission("PERM.MATRIX_CREATE")'),

('perm', 'matrix_edit', 'PERM.MATRIX_UPDATE', '編輯權限項目按鈕', '顯示編輯權限項目按鈕',
'HTML: 動態生成於權限卡片
JS: /frontend/static/js/permission-matrix.js:234:renderMatrixCard()
Element: .edit-matrix-btn
Event: click->editMatrix(matrixId)
Check: hasPermission("PERM.MATRIX_UPDATE")'),

('perm', 'matrix_delete', 'PERM.MATRIX_DELETE', '刪除權限項目按鈕', '顯示刪除權限項目按鈕',
'HTML: 動態生成於權限卡片
JS: /frontend/static/js/permission-matrix.js:245:renderMatrixCard()
Element: .delete-matrix-btn
Event: click->deleteMatrix(matrixId)
Check: hasPermission("PERM.MATRIX_DELETE")'),

('perm', 'matrix_toggle', 'PERM.MATRIX_ACTIVATE', '啟停權限項目開關', '顯示啟用/停用權限項目開關',
'HTML: /frontend/static/admin/permission-management.html:246
JS: /frontend/static/js/permission-matrix.js:312:toggleInactiveMatrix()
Element: #toggleInactiveMatrixBtn
Event: click->toggleInactiveMatrix()
Check: hasPermission("PERM.MATRIX_ACTIVATE")'),

-- =====================================================
-- 權限管理 - 群組操作
-- =====================================================
('perm', 'group_add', 'PERM.GROUP_CREATE', '新增群組按鈕', '顯示新增權限群組按鈕',
'HTML: /frontend/static/admin/permission-management.html:272
JS: /frontend/static/js/permission-group.js:78:initButtons()
Element: #addGroupBtn
Event: click->openAddGroupDialog()
Check: hasPermission("PERM.GROUP_CREATE")'),

('perm', 'group_edit', 'PERM.GROUP_UPDATE', '編輯群組按鈕', '顯示編輯權限群組按鈕',
'HTML: 動態生成於群組列表
JS: /frontend/static/js/permission-group.js:189:renderGroupRow()
Element: .edit-group-btn
Event: click->editGroup(groupId)
Check: hasPermission("PERM.GROUP_UPDATE")'),

('perm', 'group_delete', 'PERM.GROUP_DELETE', '刪除群組按鈕', '顯示刪除權限群組按鈕',
'HTML: 動態生成於群組列表
JS: /frontend/static/js/permission-group.js:200:renderGroupRow()
Element: .delete-group-btn
Event: click->deleteGroup(groupId)
Check: hasPermission("PERM.GROUP_DELETE")'),

('perm', 'group_perm_update', 'PERM.GROUP_PERM_UPDATE', '設定群組權限按鈕', '顯示設定群組權限按鈕',
'HTML: 動態生成於群組列表
JS: /frontend/static/js/permission-group.js:211:renderGroupRow()
Element: .set-group-perm-btn
Event: click->openGroupPermissionDialog(groupId)
Check: hasPermission("PERM.GROUP_PERM_UPDATE")'),

-- =====================================================
-- 權限管理 - 存取控制操作
-- =====================================================
('perm', 'url_add', 'PERM.URL_CREATE', '新增 URL 權限按鈕', '顯示新增 URL 權限按鈕',
'HTML: /frontend/static/admin/permission-management.html:372
JS: /frontend/static/js/permission-access.js:45:initUrlButtons()
Element: #addUrlBtn
Event: click->openAddUrlDialog()
Check: hasPermission("PERM.URL_CREATE")'),

('perm', 'api_add', 'PERM.API_CREATE', '新增 API 權限按鈕', '顯示新增 API 權限按鈕',
'HTML: /frontend/static/admin/permission-management.html:450
JS: /frontend/static/js/permission-access.js:89:initApiButtons()
Element: #addApiBtn
Event: click->openAddApiDialog()
Check: hasPermission("PERM.API_CREATE")'),

('perm', 'action_add', 'PERM.ACTION_CREATE', '新增動作權限按鈕', '顯示新增動作權限按鈕',
'HTML: /frontend/static/admin/permission-management.html:531
JS: /frontend/static/js/permission-access.js:134:initActionButtons()
Element: #addActionBtn
Event: click->openAddActionDialog()
Check: hasPermission("PERM.ACTION_CREATE")'),

('perm', 'cache_refresh', 'PERM.CACHE_REFRESH', '重新整理快取按鈕', '顯示重新整理權限快取按鈕',
'HTML: /frontend/static/admin/permission-management.html:591
JS: /frontend/static/js/permission-access.js:178:initCacheButtons()
Element: #refreshCacheBtn
Event: click->refreshCache()
Check: hasPermission("PERM.CACHE_REFRESH")'),

('perm', 'cache_clear', 'PERM.CACHE_CLEAR', '清除快取按鈕', '顯示清除所有快取按鈕',
'HTML: /frontend/static/admin/permission-management.html:594
JS: /frontend/static/js/permission-access.js:189:initCacheButtons()
Element: #clearCacheBtn
Event: click->clearCache()
Check: hasPermission("PERM.CACHE_CLEAR")'),

-- =====================================================
-- 知識庫管理操作
-- =====================================================
('kb', 'kb_create', 'KB.CREATE', '建立知識庫按鈕', '顯示建立新知識庫按鈕',
'HTML: /frontend/static/admin/knowledge-base.html:149
JS: /frontend/static/js/knowledge-base.js:67:initButtons()
Element: #drawerCreateKBBtn
Event: click->showKBForm("create", true)
Check: hasPermission("KB.CREATE")'),

('kb', 'kb_edit', 'KB.UPDATE', '編輯知識庫按鈕', '顯示編輯知識庫按鈕',
'HTML: /frontend/static/admin/knowledge-base.html:251
JS: /frontend/static/js/knowledge-base.js:145:initEditButtons()
Element: #editKBModeBtn
Event: click->editKnowledgeBase()
Check: hasPermission("KB.UPDATE")'),

('kb', 'kb_delete', 'KB.DELETE', '刪除知識庫按鈕', '顯示刪除知識庫按鈕',
'HTML: /frontend/static/admin/knowledge-base.html:252
JS: /frontend/static/js/knowledge-base.js:156:initDeleteButton()
Element: #deleteKBBtn
Event: click->deleteKnowledgeBase()
Check: hasPermission("KB.DELETE")'),

('kb', 'file_upload', 'KB.FILE_UPLOAD', '上傳檔案按鈕', '顯示上傳檔案按鈕',
'HTML: /frontend/static/admin/knowledge-base.html:331
JS: /frontend/static/js/knowledge-base.js:234:initUploadButton()
Element: #uploadBtn
Event: click->openUploadDialog()
Check: hasPermission("KB.FILE_UPLOAD")'),

('kb', 'file_delete', 'KB.FILE_DELETE', '刪除檔案按鈕', '顯示刪除檔案按鈕',
'HTML: /frontend/static/admin/knowledge-base.html:334
JS: /frontend/static/js/knowledge-base.js:267:initFileButtons()
Element: #removeFilesBtn
Event: click->removeSelectedFiles()
Check: hasPermission("KB.FILE_DELETE")'),

('kb', 'index_create', 'KB.INDEX_CREATE', '建立索引按鈕', '顯示建立索引按鈕',
'HTML: /frontend/static/admin/knowledge-base.html:356
JS: /frontend/static/js/knowledge-base-index-module.js:45:initIndexButtons()
Element: #prepareSelectedBtn
Event: click->createIndex()
Check: hasPermission("KB.INDEX_CREATE")'),

('kb', 'index_delete', 'KB.INDEX_DELETE', '刪除索引按鈕', '顯示刪除索引按鈕',
'HTML: /frontend/static/admin/knowledge-base.html:362
JS: /frontend/static/js/knowledge-base-index-module.js:89:initDeleteButton()
Element: .delete-index-btn
Event: click->deleteIndex()
Check: hasPermission("KB.INDEX_DELETE")'),

-- =====================================================
-- 系統參數管理操作
-- =====================================================
('system', 'param_update', 'SYSTEM.PARAM_UPDATE', '儲存參數按鈕', '顯示儲存系統參數按鈕',
'HTML: /frontend/static/admin/system-params.html:147
JS: /frontend/static/js/system-params.js:56:initSaveButton()
Element: #updateConfigBtn
Event: click->saveSystemParams()
Check: hasPermission("SYSTEM.PARAM_UPDATE")'),

('system', 'param_export', 'SYSTEM.PARAM_EXPORT', '匯出參數按鈕', '顯示匯出系統參數按鈕',
'HTML: 動態生成於參數頁面
JS: /frontend/static/js/system-params.js:123:initExportButton()
Element: #exportParamsBtn
Event: click->exportParams()
Check: hasPermission("SYSTEM.PARAM_EXPORT")'),

('system', 'param_import', 'SYSTEM.PARAM_IMPORT', '匯入參數按鈕', '顯示匯入系統參數按鈕',
'HTML: 動態生成於參數頁面
JS: /frontend/static/js/system-params.js:145:initImportButton()
Element: #importParamsBtn
Event: click->importParams()
Check: hasPermission("SYSTEM.PARAM_IMPORT")'),

('system', 'param_reset', 'SYSTEM.PARAM_RESET', '重置參數按鈕', '顯示重置系統參數按鈕',
'HTML: 動態生成於參數頁面
JS: /frontend/static/js/system-params.js:167:initResetButton()
Element: #resetParamsBtn
Event: click->resetParams()
Check: hasPermission("SYSTEM.PARAM_RESET")'),

-- =====================================================
-- 帳號管理操作
-- =====================================================
('account', 'user_add', 'ACCOUNT.USER_CREATE', '新增使用者按鈕', '顯示新增使用者按鈕',
'HTML: 動態生成於使用者管理頁面
JS: /frontend/static/js/user-management-module.js:89:initAddButton()
Element: #addUserBtn
Event: click->openAddUserDialog()
Check: hasPermission("ACCOUNT.USER_CREATE")'),

('account', 'user_edit', 'ACCOUNT.USER_UPDATE', '編輯使用者按鈕', '顯示編輯使用者按鈕',
'HTML: 動態生成於使用者列表
JS: /frontend/static/js/user-management-module.js:234:renderUserRow()
Element: .edit-user-btn
Event: click->editUser(userId)
Check: hasPermission("ACCOUNT.USER_UPDATE")'),

('account', 'user_delete', 'ACCOUNT.USER_DELETE', '刪除使用者按鈕', '顯示刪除使用者按鈕',
'HTML: 動態生成於使用者列表
JS: /frontend/static/js/user-management-module.js:245:renderUserRow()
Element: .delete-user-btn
Event: click->deleteUser(userId)
Check: hasPermission("ACCOUNT.USER_DELETE")'),

('account', 'user_reset_pwd', 'ACCOUNT.USER_RESET_PASSWORD', '重設密碼按鈕', '顯示重設使用者密碼按鈕',
'HTML: 動態生成於使用者詳情
JS: /frontend/static/js/user-management-details.js:178:renderUserActions()
Element: .reset-password-btn
Event: click->resetUserPassword(userId)
Check: hasPermission("ACCOUNT.USER_RESET_PASSWORD")');

-- =====================================================
-- 完成訊息
-- =====================================================
SELECT COUNT(*) AS total_actions, '前端動作權限已載入' AS message FROM permission_actions;