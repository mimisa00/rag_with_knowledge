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
- 依循測試驅動方法進行開發(TDD)，先撰寫測試程式再寫功能程式，寫出來的程需通過測試程式
- 如果 python 要跟資料庫比對時間，要用本地時間比對 datetime.now() 因為資料庫的時間通常存的是本地時間
- 如果有修改 python 才需要重啟 backend 

### API 修改原則
- **擴充而非替換**：當需要增加 API 功能時，應該擴充現有 API 而非建議前端改用其他端點
- **保持相容性**：確保修改不會破壞現有的前端功能，避免造成其他地方的問題
- **批次查詢優化**：當處理多筆資料時，使用批次查詢而非循環單一查詢以提升效能
- **向後相容**：新增欄位應該提供預設值，避免破壞現有的 API 回應格式

### 權限系統開發規範
- **權限綁定必要性**：實作任何新功能時，必須同時提供對應的權限資料 SQL
- **權限資料格式**：新增功能需提供以下權限資料：
  - `permission_matrix`: 權限矩陣項目（module_code, action_code, permission_key）
  - `permission_urls`: 頁面 URL 權限對應（含 note 欄位記錄程式碼位置）
  - `permission_apis`: API 端點權限對應（含前後端對應關係備註）
  - `permission_actions`: 前端按鈕/動作權限（含元素選擇器和事件綁定）
- **程式碼位置備註**：所有權限項目的 note 欄位必須包含：
  - 後端：檔案路徑:行號:函數名稱
  - 前端：HTML 位置、JS 函數位置、元素 ID/Class、事件類型
- **權限檢查實作**：
  - 後端 API：使用裝飾器檢查權限（如 @require_permission("MODULE.ACTION")）
  - 前端按鈕：使用 hasPermission() 函數控制顯示/隱藏
  - 頁面存取：在路由層級檢查 URL 權限