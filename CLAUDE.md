# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 開發指令

### Docker 環境（建議使用）
```bash
# Start all services
./startup.sh

# Stop all services
docker compose down

# View logs
docker compose logs -f

# Rebuild backend only
docker compose build backend

# Restart backend service (快速重啟後端服務)
docker restart backend

# Test database connection
docker compose exec backend python test_db_connection.py
```

### 本地開發環境
```bash
# Install dependencies
pip install -r backend/requirements.txt

# Start FastAPI server
uvicorn app.main:app --host 127.0.0.1 --port 8080

# Initialize database (manual setup required)
# 1. Install MariaDB 10.11
# 2. Create database and user matching env.example
# 3. Execute SQL files in init-db/
```

### 環境設置
- 複製 `env.example` 到 `.env` 並調整設定值
- 確保 Ollama 在 11434 端口運行
- 必要目錄：`documents/`、`faiss_data/`、`logs/`、`models/`

## 架構概述

這是一個使用 Ollama 作為 LLM 後端的 RAG（檢索增強生成）系統，包含以下核心組件：

### 核心架構
- **FastAPI 後端**（`app/main.py`）：主應用程式入口點，包含啟動/關閉事件處理器
- **模組化設計**：API 路由、核心業務邏輯、資料存取層和工具函數清晰分離
- **多知識庫支援**：每個知識庫都有獨立的 FAISS 索引和文檔存儲

### 主要組件

**API 層**（`app/api/routes/`）：
- 身份驗證和使用者管理
- 文檔上傳和處理
- 知識庫操作
- 向量索引管理
- 查詢處理與串流支援

**核心業務邏輯**（`app/core/`）：
- **RAG 管道**：嵌入生成、索引建立、檢索和重排序
- **文檔處理**：使用 Docling 將文檔轉換為 markdown
- **Ollama 整合**：LLM 互動客戶端，支援串流回應
- **安全性**：基於 JWT 的身份驗證和權限管理

**資料層**（`app/dao/`）：
- MariaDB 操作的資料庫抽象層
- 管理使用者、知識庫、對話記錄和系統配置

### 技術棧
- **後端**：FastAPI、Python 3.8+
- **LLM**：Ollama（可配置模型，預設：gemma3）
- **嵌入模型**：Hugging Face sentence-transformers（multilingual-e5-large）
- **重排序**：BAAI/bge-reranker-v2-m3
- **向量資料庫**：FAISS 本地檔案存儲
- **文檔處理**：Docling 用於 PDF/文檔轉換
- **資料庫**：MariaDB 10.11
- **部署**：Docker Compose 支援 GPU

### 資料流程
1. 上傳到知識庫的文檔被處理並轉換為 markdown
2. 文本分塊並使用 sentence transformers 生成嵌入
3. 為每個知識庫建立 FAISS 索引
4. 查詢處理使用語義搜索 + 重排序 + LLM 生成
5. 支援串流回應以提供即時使用者體驗

### 關鍵配置
- 系統參數存儲在資料庫 `configs` 表中
- 模型選項（溫度、top_k 等）可動態配置
- 資料庫、Ollama 主機和 GPU 設定通過環境變數配置

## 專案結構說明

- `documents/`：按知識庫組織，包含原始檔案和 markdown 轉換版本
- `faiss_data/`：每個知識庫的向量索引及相關文本元資料
- `models/`：Hugging Face 模型快取目錄
- `ollama/`：Ollama 模型存儲和配置
- 前端以靜態檔案形式從 `frontend/static/` 提供服務

## 重要實作細節

- 在 `app/main.py` 中進行全域狀態管理，包含模型和索引的適當清理
- 啟動順序：配置載入 → 目錄建立 → 模型初始化 → Ollama 連接測試
- 資料庫連接使用 DBUtils 連接池
- 身份驗證使用 JWT token，可配置過期時間
- GPU 支援通過 NVIDIA_GPU_COUNT 環境變數配置

## 安全性功能

### 管理員模組存取控制（2025-08-13 實作）
- **靜態文件隔離**：管理員專用 JavaScript 模組（`/js/admin-modules/`）不再通過靜態文件服務公開
- **受保護的 API 端點**：新增 `/api/admin/scripts/{script_name}` 端點，需要管理員權限才能存取
- **Cookie 認證**：統一使用 httpOnly cookie 進行身份驗證，提升安全性
- **路徑遍歷防護**：API 端點包含路徑驗證，防止目錄遍歷攻擊
- **存取日誌**：記錄所有管理員腳本的存取記錄

### 前端模組架構
- **公共模組** (`/js/modules/`)：所有用戶可存取
  - `script-loader.js`：動態腳本載入器，支援受保護腳本載入
  - `common-ui.js`：通用 UI 功能
  - `qa-module.js`：問答功能模組
  - `user-menu-module.js`：用戶選單功能（含管理員入口）
- **管理員模組** (`/js/admin-modules/`)：僅管理員可透過 API 存取
  - `admin-router.js`：管理介面路由控制
  - `admin.js`：管理首頁主控制器
  - `account-module.js`：帳號管理
  - `knowledge-base-module.js`：知識庫管理
  - `index-module.js`：索引管理
  - `param-module.js`：參數設定

### 新增頁面路由
- `/admin`：企業級管理首頁（需管理員權限）
- `/dashboard_admin`：傳統管理頁面（需管理員權限）
- `/admin/knowledge-base`：獨立知識庫管理頁面（需管理員權限）

### 路徑配置更新
新增頁面需要在 `app/config/paths.py` 的 `get_html_paths()` 方法中註冊：
```python
"HTML_PATH_ADMIN": os.path.join(static_dir, "admin.html"),
"HTML_PATH_KNOWLEDGE_BASE": os.path.join(static_dir, "admin", "knowledge-base.html"),
```

### 前端模組架構更新 (2025-01-13)

#### 模組職責分層
- **業務邏輯層**
  - `KnowledgeBaseModule` (`/js/admin-modules/knowledge-base-module.js`)：知識庫 CRUD 操作與資料管理
  - `IndexModule` (`/js/admin-modules/index-module.js`)：檔案上傳、索引建立與管理
  
- **頁面初始化層**
  - `knowledge-base-page.js`：knowledge-base.html 頁面初始化，處理全域函數綁定
  
#### 頁面特定配置
- `/admin/knowledge-base`：獨立知識庫管理頁面
  - 需載入 `knowledge-base-page.js` 進行全域函數綁定
  - 檔案輸入元素 ID 必須為 `hiddenFileInput`
  - 模態框元素 ID 必須與 dashboard_admin.html 保持一致：
    - 上傳錯誤訊息：`uploadErrorMessage`
    - 移除檔案列表：`filesToRemoveList`  
    - 建立索引列表：`filesToIndexList`

#### 載入器樣式架構
- **獨立載入器樣式** (`/css/spinner-loader.css`)
  - 可重複使用的右下角小型載入指示器
  - 使用 class `corner-loader-overlay` 
  - 透過 `.show` class 控制顯示/隱藏
  - 避免與 admin.css 的全螢幕載入器樣式衝突

#### 事件綁定機制
- IndexModule.bindEvents() 需要在按鈕元素顯示後調用
- KnowledgeBaseModule 在顯示檔案操作區域後會重新綁定事件
- 使用 setTimeout 確保 DOM 完全渲染後再綁定