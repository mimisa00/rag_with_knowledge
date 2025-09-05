# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 當前工作狀態
**最後更新**: 2025-01-21 22:30
- **當前分支**: `feature/organization-phase1-complete`
- **最近完成**: Phase 2 - 組織管理介面
  - Phase 1: 資料模型實作完成
  - Phase 2: UI 介面與所有 CRUD 功能
  - 修正所有表單欄位對應問題
  - 實作完整編輯功能
- **下一步**: Phase 3 - 系統模式設定
- **實作記錄**: 
  - [Phase 1 完成報告](docs/implementation/phase1-complete.md)
- **自動執行**: [AUTO_PILOT](docs/AUTO_PILOT.md)


## 快速開始

### Docker 環境測試及調試
```bash
# 如果有修改 python 需重啟後端
docker restart backend

# 查看日誌
docker compose logs -f backend

# 停止所有服務
docker compose down
```

### 環境設置
- 系統參數在 `.env` 

## 專案概述

**知識庫系統**： 企業級智能問答系統，基於知識庫作為入口系統，未來可擴充各種 ERP 功能

### 核心特點
- **多知識庫架構**：每個知識庫有獨立的 FAISS 索引
- **模組化設計**：API 路由、業務邏輯、資料層清晰分離
- **串流回應**：支援即時的 LLM 生成回應
- **安全隔離**：管理員模組需透過 API 存取

### 技術棧
- **後端**：FastAPI + Python 3.8+W
- **LLM**：Ollama
- **向量資料庫**：FAISS
- **資料庫**：MariaDB 10.11
- **文檔處理**：Docling（PDF → Markdown）

### 詳細文件
- **API 設計**:    `/app/api/routes/` 
- **資料庫結構**:   `/init-db/*.sql`
- **Docker 設定**: `docker-compose.yml`
- **UI 設計系統**: `/docs/guidelines/ui-guidelines.md`
- **架構設計**:    `/docs/guidelines/arch-guidelines.md`
- **重構指南**:    `/docs/guidelines/refactoring-guidelines.md`
- **測試指南**:    `/docs/guidelines/test-guidelines.md`

### 注意事項
- 當檔案大於1000行時，就應該要依據重構指南，進行模組拆分