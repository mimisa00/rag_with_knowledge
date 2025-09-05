-- =====================================================
-- 用戶活動追蹤欄位 Migration
-- 新增登入時間和最後活動時間追蹤功能
-- =====================================================

-- 新增用戶活動追蹤欄位
ALTER TABLE users 
ADD COLUMN last_login_at TIMESTAMP NULL COMMENT '最後登入時間',
ADD COLUMN last_activity_at TIMESTAMP NULL COMMENT '最後活動時間';

-- 新增索引以優化查詢效能
ALTER TABLE users 
ADD INDEX idx_last_login_at (last_login_at),
ADD INDEX idx_last_activity_at (last_activity_at);