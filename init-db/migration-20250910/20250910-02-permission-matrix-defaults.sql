-- =====================================================
-- 檔案: 20250910-02-permission-matrix-defaults.sql
-- 描述: 權限矩陣預設值
-- 作者: Claude AI Assistant
-- 日期: 2025-01-22
-- =====================================================

-- =====================================================
-- 權限矩陣預設值
-- 注意：必須拆分權限代碼為 module_code 和 action_code
-- permission_key = module_code.action_code
-- =====================================================

INSERT IGNORE INTO permission_matrix 
(module_code, module_name, action_code, action_name, permission_key, description, permission_type, sort_order) VALUES

-- =====================================================
-- 使用者基本功能 (USER)
-- =====================================================
('USER', '使用者功能', 'LOGIN', '登入系統', 'USER.LOGIN', '使用者登入系統', 'system', 1),
('USER', '使用者功能', 'LOGOUT', '登出系統', 'USER.LOGOUT', '使用者登出系統', 'system', 2),
('USER', '使用者功能', 'PROFILE_VIEW', '查看個人資料', 'USER.PROFILE_VIEW', '查看個人資料', 'custom', 3),
('USER', '使用者功能', 'PROFILE_UPDATE', '更新個人資料', 'USER.PROFILE_UPDATE', '更新個人資料', 'custom', 4),
('USER', '使用者功能', 'PASSWORD_CHANGE', '變更密碼', 'USER.PASSWORD_CHANGE', '變更個人密碼', 'custom', 5),
('USER', '使用者功能', 'QUERY', 'AI 問答', 'USER.QUERY', '使用 AI 問答功能', 'custom', 6),
('USER', '使用者功能', 'CONVERSATION_VIEW', '查看對話記錄', 'USER.CONVERSATION_VIEW', '查看歷史對話記錄', 'custom', 7),
('USER', '使用者功能', 'CONVERSATION_DELETE', '刪除對話記錄', 'USER.CONVERSATION_DELETE', '刪除歷史對話記錄', 'custom', 8),

-- =====================================================
-- 管理員基本權限 (ADMIN)
-- =====================================================
('ADMIN', '管理員', 'ACCESS', '進入管理介面', 'ADMIN.ACCESS', '進入系統管理介面', 'system', 10),
('ADMIN', '管理員', 'DASHBOARD', '查看儀表板', 'ADMIN.DASHBOARD', '查看管理儀表板', 'custom', 11),
('ADMIN', '管理員', 'STATS_VIEW', '查看統計資料', 'ADMIN.STATS_VIEW', '查看系統統計資料', 'custom', 12),
('ADMIN', '管理員', 'LOG_VIEW', '查看系統日誌', 'ADMIN.LOG_VIEW', '查看系統操作日誌', 'custom', 13),

-- =====================================================
-- 帳號管理 (ACCOUNT)
-- =====================================================
('ACCOUNT', '帳號管理', 'USER_VIEW', '查看使用者', 'ACCOUNT.USER_VIEW', '查看使用者列表', 'custom', 20),
('ACCOUNT', '帳號管理', 'USER_CREATE', '新增使用者', 'ACCOUNT.USER_CREATE', '新增使用者帳號', 'custom', 21),
('ACCOUNT', '帳號管理', 'USER_UPDATE', '編輯使用者', 'ACCOUNT.USER_UPDATE', '編輯使用者資料', 'custom', 22),
('ACCOUNT', '帳號管理', 'USER_DELETE', '刪除使用者', 'ACCOUNT.USER_DELETE', '刪除使用者帳號', 'custom', 23),
('ACCOUNT', '帳號管理', 'USER_ACTIVATE', '啟用使用者', 'ACCOUNT.USER_ACTIVATE', '啟用或停用使用者', 'custom', 24),
('ACCOUNT', '帳號管理', 'USER_RESET_PASSWORD', '重設密碼', 'ACCOUNT.USER_RESET_PASSWORD', '重設使用者密碼', 'custom', 25),
('ACCOUNT', '帳號管理', 'USER_EXPORT', '匯出使用者', 'ACCOUNT.USER_EXPORT', '匯出使用者資料', 'custom', 26),
('ACCOUNT', '帳號管理', 'USER_IMPORT', '匯入使用者', 'ACCOUNT.USER_IMPORT', '匯入使用者資料', 'custom', 27),

-- =====================================================
-- 組織管理 - 部門 (ORG_DEPT)
-- =====================================================
('ORG', '組織管理', 'DEPT_VIEW', '查看部門', 'ORG.DEPT_VIEW', '查看部門結構', 'custom', 40),
('ORG', '組織管理', 'DEPT_CREATE', '新增部門', 'ORG.DEPT_CREATE', '新增部門', 'custom', 41),
('ORG', '組織管理', 'DEPT_UPDATE', '編輯部門', 'ORG.DEPT_UPDATE', '編輯部門資訊', 'custom', 42),
('ORG', '組織管理', 'DEPT_DELETE', '刪除部門', 'ORG.DEPT_DELETE', '刪除部門', 'custom', 43),
('ORG', '組織管理', 'DEPT_MOVE', '調整部門', 'ORG.DEPT_MOVE', '調整部門層級結構', 'custom', 44),
('ORG', '組織管理', 'DEPT_ACTIVATE', '啟停部門', 'ORG.DEPT_ACTIVATE', '啟用或停用部門', 'custom', 45),

-- =====================================================
-- 組織管理 - 角色 (ORG_ROLE)
-- =====================================================
('ORG', '組織管理', 'ROLE_VIEW', '查看角色', 'ORG.ROLE_VIEW', '查看角色列表', 'custom', 50),
('ORG', '組織管理', 'ROLE_CREATE', '新增角色', 'ORG.ROLE_CREATE', '新增角色', 'custom', 51),
('ORG', '組織管理', 'ROLE_UPDATE', '編輯角色', 'ORG.ROLE_UPDATE', '編輯角色資訊', 'custom', 52),
('ORG', '組織管理', 'ROLE_DELETE', '刪除角色', 'ORG.ROLE_DELETE', '刪除角色', 'custom', 53),
('ORG', '組織管理', 'ROLE_ASSIGN', '指派角色', 'ORG.ROLE_ASSIGN', '指派角色給員工', 'custom', 54),
('ORG', '組織管理', 'ROLE_TEMPLATE', '管理模板', 'ORG.ROLE_TEMPLATE', '管理角色模板', 'custom', 55),
('ORG', '組織管理', 'ROLE_ANALYSIS', 'AI 分析', 'ORG.ROLE_ANALYSIS', '使用 AI 分析角色關係', 'custom', 56),

-- =====================================================
-- 組織管理 - 員工 (ORG_EMP)
-- =====================================================
('ORG', '組織管理', 'EMP_VIEW', '查看員工', 'ORG.EMP_VIEW', '查看員工列表', 'custom', 60),
('ORG', '組織管理', 'EMP_CREATE', '新增員工', 'ORG.EMP_CREATE', '新增員工資料', 'custom', 61),
('ORG', '組織管理', 'EMP_UPDATE', '編輯員工', 'ORG.EMP_UPDATE', '編輯員工資料', 'custom', 62),
('ORG', '組織管理', 'EMP_DELETE', '刪除員工', 'ORG.EMP_DELETE', '刪除員工資料', 'custom', 63),
('ORG', '組織管理', 'EMP_ACTIVATE', '啟停員工', 'ORG.EMP_ACTIVATE', '啟用或停用員工', 'custom', 64),
('ORG', '組織管理', 'EMP_TRANSFER', '調動員工', 'ORG.EMP_TRANSFER', '調動員工部門', 'custom', 65),
('ORG', '組織管理', 'EMP_EXPORT', '匯出員工', 'ORG.EMP_EXPORT', '匯出員工資料', 'custom', 66),
('ORG', '組織管理', 'EMP_IMPORT', '匯入員工', 'ORG.EMP_IMPORT', '匯入員工資料', 'custom', 67),

-- =====================================================
-- 權限管理 - 矩陣 (PERM_MATRIX)
-- =====================================================
('PERM', '權限管理', 'MATRIX_VIEW', '查看權限矩陣', 'PERM.MATRIX_VIEW', '查看權限矩陣', 'custom', 70),
('PERM', '權限管理', 'MATRIX_CREATE', '新增權限項目', 'PERM.MATRIX_CREATE', '新增權限項目', 'custom', 71),
('PERM', '權限管理', 'MATRIX_UPDATE', '編輯權限項目', 'PERM.MATRIX_UPDATE', '編輯權限項目', 'custom', 72),
('PERM', '權限管理', 'MATRIX_DELETE', '刪除權限項目', 'PERM.MATRIX_DELETE', '刪除權限項目', 'custom', 73),
('PERM', '權限管理', 'MATRIX_ACTIVATE', '啟停權限項目', 'PERM.MATRIX_ACTIVATE', '啟用或停用權限項目', 'custom', 74),

-- =====================================================
-- 權限管理 - 群組 (PERM_GROUP)
-- =====================================================
('PERM', '權限管理', 'GROUP_VIEW', '查看權限群組', 'PERM.GROUP_VIEW', '查看權限群組', 'custom', 80),
('PERM', '權限管理', 'GROUP_CREATE', '新增權限群組', 'PERM.GROUP_CREATE', '新增權限群組', 'custom', 81),
('PERM', '權限管理', 'GROUP_UPDATE', '編輯權限群組', 'PERM.GROUP_UPDATE', '編輯權限群組', 'custom', 82),
('PERM', '權限管理', 'GROUP_DELETE', '刪除權限群組', 'PERM.GROUP_DELETE', '刪除權限群組', 'custom', 83),
('PERM', '權限管理', 'GROUP_ASSIGN', '指派權限群組', 'PERM.GROUP_ASSIGN', '指派權限群組給使用者', 'custom', 84),
('PERM', '權限管理', 'GROUP_PERM_UPDATE', '設定群組權限', 'PERM.GROUP_PERM_UPDATE', '設定群組的權限項目', 'custom', 85),
('PERM', '權限管理', 'GROUP_DEPT_UPDATE', '設定部門權限', 'PERM.GROUP_DEPT_UPDATE', '設定群組的部門角色權限', 'custom', 86),

-- =====================================================
-- 權限管理 - 存取控制 (PERM_ACCESS)
-- =====================================================
('PERM', '權限管理', 'URL_VIEW', '查看 URL 權限', 'PERM.URL_VIEW', '查看 URL 權限設定', 'custom', 90),
('PERM', '權限管理', 'URL_CREATE', '新增 URL 權限', 'PERM.URL_CREATE', '新增 URL 權限規則', 'custom', 91),
('PERM', '權限管理', 'URL_UPDATE', '編輯 URL 權限', 'PERM.URL_UPDATE', '編輯 URL 權限規則', 'custom', 92),
('PERM', '權限管理', 'URL_DELETE', '刪除 URL 權限', 'PERM.URL_DELETE', '刪除 URL 權限規則', 'custom', 93),
('PERM', '權限管理', 'API_VIEW', '查看 API 權限', 'PERM.API_VIEW', '查看 API 權限設定', 'custom', 94),
('PERM', '權限管理', 'API_CREATE', '新增 API 權限', 'PERM.API_CREATE', '新增 API 權限規則', 'custom', 95),
('PERM', '權限管理', 'API_UPDATE', '編輯 API 權限', 'PERM.API_UPDATE', '編輯 API 權限規則', 'custom', 96),
('PERM', '權限管理', 'API_DELETE', '刪除 API 權限', 'PERM.API_DELETE', '刪除 API 權限規則', 'custom', 97),
('PERM', '權限管理', 'ACTION_VIEW', '查看動作權限', 'PERM.ACTION_VIEW', '查看前端動作權限', 'custom', 98),
('PERM', '權限管理', 'ACTION_CREATE', '新增動作權限', 'PERM.ACTION_CREATE', '新增前端動作權限', 'custom', 99),
('PERM', '權限管理', 'ACTION_UPDATE', '編輯動作權限', 'PERM.ACTION_UPDATE', '編輯前端動作權限', 'custom', 100),
('PERM', '權限管理', 'ACTION_DELETE', '刪除動作權限', 'PERM.ACTION_DELETE', '刪除前端動作權限', 'custom', 101),
('PERM', '權限管理', 'CACHE_REFRESH', '重新整理快取', 'PERM.CACHE_REFRESH', '重新整理權限快取', 'custom', 102),
('PERM', '權限管理', 'CACHE_CLEAR', '清除快取', 'PERM.CACHE_CLEAR', '清除所有權限快取', 'custom', 103),

-- =====================================================
-- 知識庫管理 (KB)
-- =====================================================
('KB', '知識庫', 'LIST_VIEW', '查看知識庫列表', 'KB.LIST_VIEW', '查看知識庫列表', 'custom', 110),
('KB', '知識庫', 'CREATE', '建立知識庫', 'KB.CREATE', '建立新知識庫', 'custom', 111),
('KB', '知識庫', 'VIEW', '查看知識庫', 'KB.VIEW', '查看知識庫詳情', 'custom', 112),
('KB', '知識庫', 'UPDATE', '更新知識庫', 'KB.UPDATE', '更新知識庫設定', 'custom', 113),
('KB', '知識庫', 'DELETE', '刪除知識庫', 'KB.DELETE', '刪除知識庫', 'custom', 114),
('KB', '知識庫', 'FILE_UPLOAD', '上傳檔案', 'KB.FILE_UPLOAD', '上傳檔案到知識庫', 'custom', 115),
('KB', '知識庫', 'FILE_VIEW', '查看檔案', 'KB.FILE_VIEW', '查看知識庫檔案', 'custom', 116),
('KB', '知識庫', 'FILE_DELETE', '刪除檔案', 'KB.FILE_DELETE', '刪除知識庫檔案', 'custom', 117),
('KB', '知識庫', 'INDEX_CREATE', '建立索引', 'KB.INDEX_CREATE', '建立知識庫索引', 'custom', 118),
('KB', '知識庫', 'INDEX_VIEW', '查看索引', 'KB.INDEX_VIEW', '查看知識庫索引', 'custom', 119),
('KB', '知識庫', 'INDEX_DELETE', '刪除索引', 'KB.INDEX_DELETE', '刪除知識庫索引', 'custom', 120),
('KB', '知識庫', 'PERM_VIEW', '查看權限', 'KB.PERM_VIEW', '查看知識庫權限設定', 'custom', 121),
('KB', '知識庫', 'PERM_UPDATE', '更新權限', 'KB.PERM_UPDATE', '更新知識庫權限設定', 'custom', 122),

-- =====================================================
-- 系統管理 (SYSTEM)
-- =====================================================
('SYSTEM', '系統管理', 'PARAM_VIEW', '查看系統參數', 'SYSTEM.PARAM_VIEW', '查看系統參數設定', 'custom', 130),
('SYSTEM', '系統管理', 'PARAM_UPDATE', '更新系統參數', 'SYSTEM.PARAM_UPDATE', '更新系統參數設定', 'custom', 131),
('SYSTEM', '系統管理', 'PARAM_EXPORT', '匯出系統參數', 'SYSTEM.PARAM_EXPORT', '匯出系統參數設定', 'custom', 132),
('SYSTEM', '系統管理', 'PARAM_IMPORT', '匯入系統參數', 'SYSTEM.PARAM_IMPORT', '匯入系統參數設定', 'custom', 133),
('SYSTEM', '系統管理', 'PARAM_RESET', '重置系統參數', 'SYSTEM.PARAM_RESET', '重置系統參數為預設值', 'custom', 134),
('SYSTEM', '系統管理', 'BACKUP', '系統備份', 'SYSTEM.BACKUP', '執行系統備份', 'custom', 135),
('SYSTEM', '系統管理', 'RESTORE', '系統還原', 'SYSTEM.RESTORE', '執行系統還原', 'custom', 136),
('SYSTEM', '系統管理', 'MONITOR', '系統監控', 'SYSTEM.MONITOR', '查看系統監控資訊', 'custom', 137),
('SYSTEM', '系統管理', 'MAINTENANCE', '系統維護', 'SYSTEM.MAINTENANCE', '執行系統維護作業', 'custom', 138);

-- =====================================================
-- 完成訊息
-- =====================================================
SELECT COUNT(*) AS total_permissions, '權限矩陣預設值已載入' AS message FROM permission_matrix;