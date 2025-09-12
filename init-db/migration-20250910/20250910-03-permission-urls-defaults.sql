-- =====================================================
-- 檔案: 20250910-03-permission-urls-defaults.sql
-- 描述: URL 權限對應預設值
-- 作者: Claude AI Assistant
-- 日期: 2025-01-22
-- =====================================================

-- =====================================================
-- URL 權限對應
-- 設定頁面訪問權限
-- =====================================================

INSERT IGNORE INTO permission_urls 
(url_pattern, method, permission_code, module_key, description, priority, is_public, note) VALUES

-- =====================================================
-- 公開頁面（不需要登入）
-- =====================================================
('/login', 'GET', NULL, 'auth', '登入頁面', 1, TRUE, 
'HTML: /frontend/static/login.html
Router: /app/api/routes/static.py:24:login_page()
Init: 頁面載入時自動初始化'),

('/register', 'GET', NULL, 'auth', '註冊頁面', 2, TRUE, 
'HTML: /frontend/static/register.html
Router: /app/api/routes/static.py:29:register_page()
Init: 頁面載入時自動初始化'),

('/activate', 'GET', NULL, 'auth', '帳號啟用頁面', 3, TRUE, 
'HTML: /frontend/static/activate.html
Router: /app/api/routes/static.py:34:activate_page()
Init: /frontend/static/js/pages/activate.js:10:init()'),

('/showindex', 'GET', NULL, 'tool', '索引摘要工具', 4, TRUE, 
'HTML: /frontend/static/showindex.html
Router: /app/api/routes/static.py:39:showindex_page()
Init: 頁面載入時自動初始化'),

('/md_viewer', 'GET', NULL, 'tool', 'Markdown 檢視器', 5, TRUE, 
'HTML: /frontend/static/md_viewer.html
Router: /app/api/routes/static.py:44:md_viewer_page()
Init: marked.js 自動渲染'),

-- =====================================================
-- 需要登入的頁面（使用者功能）
-- =====================================================
('/dashboard', 'GET', 'USER.QUERY', 'user', '使用者主頁', 10, FALSE, 
'HTML: /frontend/static/dashboard.html
Router: /app/api/routes/static.py:49:dashboard_page()
Init: /frontend/static/js/modules/qa-module.js:15:initQA()
Auth: @login_required'),

-- =====================================================
-- 管理員頁面
-- =====================================================
('/admin', 'GET', 'ADMIN.ACCESS', 'admin', '管理中心首頁', 20, FALSE, 
'HTML: /frontend/static/admin.html
Router: /app/api/routes/static.py:54:admin_page()
Init: /frontend/static/js/admin.js:20:initAdmin()
Auth: @admin_required'),

('/dashboard_admin', 'GET', 'ADMIN.DASHBOARD', 'admin', '管理員問答介面', 21, FALSE, 
'HTML: /frontend/static/dashboard_admin.html
Router: /app/api/routes/static.py:59:dashboard_admin_page()
Init: /frontend/static/js/modules/qa-module.js:15:initQA()
Auth: @admin_required'),

('/admin/user-management', 'GET', 'ACCOUNT.USER_VIEW', 'admin', '帳號管理頁面', 30, FALSE, 
'HTML: /frontend/static/admin/user-management.html
Router: /app/api/routes/static.py:64:user_management_page()
Init: /frontend/static/js/user-management.js:25:initUserManagement()
Auth: @admin_required'),

('/admin/organization', 'GET', 'ORG.DEPT_VIEW', 'admin', '組織管理頁面', 40, FALSE, 
'HTML: /frontend/static/admin/organization.html
Router: /app/api/routes/static.py:69:organization_page()
Init: /frontend/static/js/organization.js:30:initOrganization()
Auth: @admin_required'),

('/admin/permission-management', 'GET', 'PERM.MATRIX_VIEW', 'admin', '權限管理頁面', 50, FALSE, 
'HTML: /frontend/static/admin/permission-management.html
Router: /app/api/routes/static.py:74:permission_management_page()
Init: /frontend/static/js/permission-management.js:25:initPermission()
Auth: @admin_required'),

('/admin/knowledge-base', 'GET', 'KB.LIST_VIEW', 'admin', '知識庫管理頁面', 60, FALSE, 
'HTML: /frontend/static/admin/knowledge-base.html
Router: /app/api/routes/static.py:79:knowledge_base_page()
Init: /frontend/static/js/knowledge-base.js:30:initKnowledgeBase()
Auth: @admin_or_org_admin_required'),

('/admin/system-params', 'GET', 'SYSTEM.PARAM_VIEW', 'admin', '系統參數管理頁面', 70, FALSE, 
'HTML: /frontend/static/admin/system-params.html
Router: /app/api/routes/static.py:84:system_params_page()
Init: /frontend/static/js/system-params.js:20:initSystemParams()
Auth: @admin_required'),

-- =====================================================
-- 特殊頁面（根據狀態）
-- =====================================================
('/', 'GET', NULL, 'root', '根目錄重定向', 0, FALSE, 
'Router: /app/api/routes/static.py:14:index()
Logic: 根據登入狀態重定向到 /dashboard 或 /login
Auth: 檢查 session'),

('/logout', 'GET', 'USER.LOGOUT', 'auth', '登出處理', 100, FALSE, 
'Router: /app/api/routes/auth.py:150:logout()
Logic: 清除 session 並重定向到 /login
Auth: @login_required');

-- =====================================================
-- 完成訊息
-- =====================================================
SELECT COUNT(*) AS total_urls, '頁面權限對應已載入' AS message FROM permission_urls;