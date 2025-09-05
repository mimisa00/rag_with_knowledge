-- =====================================================
-- Migration: 新增 sources 欄位到 conversations 表
-- 用途: 分離儲存引用來源，避免 HTML 標籤污染 LLM 輸入
-- 作者: Claude Code
-- 日期: 2025-01-21
-- =====================================================

USE rag_db;

-- 新增 sources 欄位用於儲存引用來源的 JSON 資料
ALTER TABLE conversations 
ADD COLUMN sources TEXT COMMENT '引用來源JSON格式，包含檔案名稱和連結' 
AFTER answer;

-- 新增索引提升查詢效能（如果需要按 sources 搜尋）
-- CREATE INDEX idx_sources ON conversations(sources(100));