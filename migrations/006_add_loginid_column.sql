-- 新增 loginid 欄位到 users 表
-- loginid: 用於登入的帳號 (例如: john.doe)
-- username: 使用者真實姓名 (例如: 張三)

-- 1. 新增 loginid 欄位
ALTER TABLE users ADD COLUMN IF NOT EXISTS loginid VARCHAR(50);

-- 2. 將現有的 username 資料複製到 loginid (作為初始值)
UPDATE users SET loginid = username WHERE loginid IS NULL;

-- 3. 設定 loginid 為 NOT NULL 和 UNIQUE
ALTER TABLE users MODIFY COLUMN loginid VARCHAR(50) NOT NULL;
ALTER TABLE users ADD UNIQUE KEY uk_loginid (loginid);

-- 4. 移除 username 的 UNIQUE 約束 (如果存在)
ALTER TABLE users DROP INDEX IF EXISTS username;

-- 5. 調整 username 欄位註解
ALTER TABLE users MODIFY COLUMN username VARCHAR(50) NOT NULL COMMENT '使用者姓名';
ALTER TABLE users MODIFY COLUMN loginid VARCHAR(50) NOT NULL COMMENT '登入帳號';

-- 顯示更新後的表結構
DESCRIBE users;