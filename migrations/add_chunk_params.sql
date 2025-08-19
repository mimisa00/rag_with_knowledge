-- 新增 knowledge_bases 表的 chunk 參數欄位
ALTER TABLE knowledge_bases 
ADD COLUMN chunk_size INT DEFAULT NULL COMMENT '知識庫特定的 chunk_size 設定',
ADD COLUMN chunk_overlap INT DEFAULT NULL COMMENT '知識庫特定的 chunk_overlap 設定';

-- 新增 index_jobs 表的 chunk 參數欄位（記錄建立索引時使用的參數）
ALTER TABLE index_jobs
ADD COLUMN chunk_size INT DEFAULT NULL COMMENT '建立索引時使用的 chunk_size',
ADD COLUMN chunk_overlap INT DEFAULT NULL COMMENT '建立索引時使用的 chunk_overlap';

-- 更新現有資料的預設值（可選）
-- UPDATE knowledge_bases SET chunk_size = NULL, chunk_overlap = NULL WHERE 1=1;