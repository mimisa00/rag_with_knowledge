# RAG (Retrieval-Augmented Generation) 系統

## 本專案實作增強型檢索系統，支援多種 LLM 平台。系統具備以下功能：
- **帳號管理**：提供簡易的使用者註冊與登入功能
- **檔案上傳與擷取**：可上傳檔案並進行內容擷取
- **索引建立**：建立語意檢索所需的資料索引
- **後台參數調整**：可調整系統運作所需的參數設定
- **多 LLM Provider 支援**：Ollama、OpenAI、Anthropic、Vertex AI

## Quick View
<img width="500" alt="580768214-c731f5f6-96fc-456d-b55d-257c7c9c5c45" src="https://github.com/user-attachments/assets/b1716ef8-78c3-41c8-9a48-fad9599f1666" />


## 支援的 LLM Providers
- **Ollama**（預設）- 本地模型執行
- **OpenAI** - GPT-4、GPT-3.5 等模型
- **Anthropic** - Claude 4 模型
- **Vertex AI** - Google Cloud 上的 Anthropic Claude 模型 ([設定指南](docs/vertex-ai-setup.md))

歡迎提供寶貴建議，您可以留言或來信與我們聯繫！


## 專案結構

```
rag/
├── app/                      # Python 應用程式
│   ├── main.py               # FastAPI 主應用入口
│   ├── config/               # 配置管理
│   │   ├── settings.py       # 應用程式設定
│   │   ├── database.py       # 資料庫配置
│   │   └── paths.py          # 路徑配置
│   ├── api/                  # API 路由層
│   │   └── routes/           # 路由定義
│   ├── core/                 # 核心業務邏輯
│   │   ├── security/         # 安全相關
│   │   ├── rag/              # RAG 功能
│   │   └── document/         # 文檔處理
│   ├── dao/                  # 資料存取層
│   ├── models/               # 資料模型
│   ├── services/             # 業務服務層
│   ├── utils/                # 工具函數
│   └── tests/                # 單元測試
├── backend/                  # backend 配置
│   ├── Dockerfile            # 容器配置
│   ├── requirements.txt      # Python 依賴
│   └── test_db_connection.py # 啟動時DB測試
├── documents/                # 索引文件放置
├── faiss_data/               # 向量資料庫儲存位置
├── frontend/                 # 前端目錄
│   └── static/               # 靜態文件 (HTML, CSS, JS)
├── init-db/                  # 初始化 DB 文件
├── logs/                     # 日誌文件
├── mariadb_data/             # 資料庫儲存
├── models/                   # 模型儲存位置
├── ollama/                   # ollama 快取
├── ollama_modelfile/         # ollama 自訂 modelfile
├── docker-compose.yml        # Docker 服務配置
├── env.example               # 環境變數範例
├── README.md                 # 詳細文檔
├── startup.ps1.sh            # Windows 環境啟動腳本
└── startup.sh                # Linux   啟動腳本
```

## 快速開始

### 前置需求
- Docker
- Git
- 至少 8GB RAM
- NVIDIA GPU (可選，用於加速)

### 1. Clone 專案

```bash
git clone https://gitlab.iwerp.xyz/op/rag_with_ollama.git
cd rag_with_ollama
```

### 2. 環境設置

#### Linux/macOS:
```bash
chmod +x startup.sh
./startup.sh
```

### 3. 訪問系統
- 主界面: http://localhost:8080/login


## 配置本地端開發環境
```
# 需手動執行 
1.安裝並啟動 ollama
2.安裝 mariadb 資料庫 v10.11 並建立 DB 帳號，帳號密碼需與 env.example 一致
3.初始化資料庫     : 執行 init-db 底下所有 sql
4.建立環境變數     : 複製 env.example > .env 並放到專案目錄下
5.建立工作目錄     : documents faiss_data logs models
5.更新 python lib : pip install --upgrade pip
6.安裝 python lib : pip install -r requirements.txt
7.啟動 FastApi    : uvicorn app.main:app --host 127.0.0.1 --port 8080
```
