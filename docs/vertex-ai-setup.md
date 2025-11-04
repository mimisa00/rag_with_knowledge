# Vertex AI (Anthropic on GCP) 設定指南

本文件說明如何設定 RAG 系統使用 Google Cloud Platform 的 Vertex AI 服務來執行 Anthropic Claude 模型。

## 目錄

1. [概述](#概述)
2. [前置需求](#前置需求)
3. [設定步驟](#設定步驟)
4. [配置說明](#配置說明)
5. [測試連線](#測試連線)
6. [常見問題](#常見問題)
7. [安全最佳實踐](#安全最佳實踐)
8. [費用估算](#費用估算)

## 概述

Vertex AI 是 Google Cloud Platform 提供的機器學習平台，現在支援 Anthropic Claude 模型。使用 Vertex AI 的優勢：

- **企業級安全性**：資料保留在 Google Cloud 環境中
- **整合計費**：統一的 GCP 帳單管理
- **低延遲**：可選擇最近的區域部署
- **配額管理**：企業級的配額和使用控制

## 前置需求

### 1. Google Cloud Platform 帳戶
- 有效的 GCP 帳戶和專案
- 啟用計費功能
- 具有適當權限（見下方）

### 2. 必要的 GCP API
需要啟用以下 API：
```bash
# 啟用 Vertex AI API
gcloud services enable aiplatform.googleapis.com

# 啟用 IAM API（管理服務帳戶）
gcloud services enable iam.googleapis.com
```

### 3. gcloud CLI 工具
```bash
# macOS
brew install google-cloud-sdk

# Linux
curl https://sdk.cloud.google.com | bash

# 初始化
gcloud init
```

### 4. 必要權限
執行設定的使用者需要以下權限：
- `roles/iam.serviceAccountCreator` - 建立服務帳戶
- `roles/iam.serviceAccountKeyAdmin` - 管理服務帳戶金鑰
- `roles/resourcemanager.projectIamAdmin` - 授予 IAM 角色

## 設定步驟

### 步驟 1：設定環境變數
```bash
# 設定您的 GCP 專案 ID
export PROJECT_ID="your-project-id"

# 設定預設專案
gcloud config set project ${PROJECT_ID}
```

### 步驟 2：建立 Service Account
```bash
# 建立服務帳戶
gcloud iam service-accounts create rag-vertex-ai \
    --display-name="RAG Vertex AI Service Account" \
    --project=${PROJECT_ID}

# 確認建立成功
gcloud iam service-accounts list --project=${PROJECT_ID}
```

### 步驟 3：授予必要權限
```bash
# 授予 Vertex AI User 角色
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:rag-vertex-ai@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/aiplatform.user"

# （可選）如果需要列出模型，可額外授予 viewer 角色
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:rag-vertex-ai@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/aiplatform.viewer"
```

### 步驟 4：建立並下載金鑰
```bash
# 建立金鑰並下載到正確位置
gcloud iam service-accounts keys create ./credentials/vertex-ai-key.json \
    --iam-account=rag-vertex-ai@${PROJECT_ID}.iam.gserviceaccount.com

# 設定檔案權限
chmod 644 ./credentials/vertex-ai-key.json

# 驗證檔案內容（應該是 JSON 格式）
cat ./credentials/vertex-ai-key.json | jq .type
# 應該顯示 "service_account"
```

### 步驟 5：重啟 Docker 服務
```bash
# 重啟後端服務以載入新的憑證
docker compose restart backend

# 檢查服務狀態
docker compose ps

# 查看日誌確認無錯誤
docker compose logs backend | tail -20
```

## 配置說明

### 系統參數配置

在系統參數頁面 (`/admin/system-params.html`) 中設定：

1. **選擇 Provider**
   - 在「模型設定」分類下
   - Provider 下拉選單選擇「Vertex AI (Anthropic on GCP)」

2. **填寫配置**
   - **GCP Project ID**（必填）: 您的 Google Cloud 專案 ID
   - **Location**: 選擇部署區域
     - `us-central1`（推薦）- 美國中部
     - `us-east5` - 美國東部
     - `europe-west1` - 歐洲西部
     - `asia-southeast1` - 亞洲東南
   - **Model**: 選擇 Claude 模型版本
     - `claude-4-5-haiku@20251001` - Claude 4.5 Haiku（快速、經濟）
     - `claude-sonnet-4-5@20250929` - Claude 4.5 Sonnet（平衡）
     - `claude-opus-4-1@20250805` - Claude 4.1 Opus（最強大）

3. **儲存參數**
   - 點擊「儲存參數」按鈕

### 環境變數

系統會自動設定以下環境變數：
```yaml
GOOGLE_APPLICATION_CREDENTIALS: /credentials/vertex-ai-key.json
```

## 測試連線

### 方法 1：使用 Web UI

1. 進入系統參數頁面
2. 選擇 Vertex AI provider
3. 點擊「檢查憑證」按鈕
4. 點擊「測試連線」按鈕

### 方法 2：使用 API

```bash
# 測試連線
curl -X POST http://localhost:8080/api/llm/test-connection \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "provider": "vertex_ai",
    "config": {
      "project_id": "your-project-id",
      "location_id": "us-central1",
      "model": "claude-4-5-haiku@20251001"
    }
  }'
```

### 方法 3：直接測試對話

```bash
# 執行簡單的對話測試
curl -X POST http://localhost:8080/api/query \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "question": "Hello, how are you?",
    "kb_id": "default"
  }'
```

## 常見問題

### Q1: 找不到憑證檔案
**錯誤訊息**: `could not find default credentials`

**解決方案**:
1. 確認檔案存在：
   ```bash
   ls -la ./credentials/vertex-ai-key.json
   ```
2. 確認 Docker 已重啟：
   ```bash
   docker compose restart backend
   ```
3. 檢查容器內的檔案：
   ```bash
   docker exec backend ls -la /credentials/
   ```

### Q2: 權限不足
**錯誤訊息**: `Permission denied` 或 `403 Forbidden`

**解決方案**:
1. 確認服務帳戶有正確的角色：
   ```bash
   gcloud projects get-iam-policy ${PROJECT_ID} \
     --flatten="bindings[].members" \
     --filter="bindings.members:rag-vertex-ai@${PROJECT_ID}.iam.gserviceaccount.com"
   ```
2. 確認 Vertex AI API 已啟用：
   ```bash
   gcloud services list --enabled | grep aiplatform
   ```

### Q3: 找不到模型
**錯誤訊息**: `Model not found`

**解決方案**:
1. 確認區域支援該模型
2. 檢查模型 ID 格式是否正確
3. 嘗試不同的區域：
   ```bash
   # 列出可用的模型（需要 gcloud 登入）
   gcloud ai models list --region=us-central1
   ```

### Q4: Token 過期
**錯誤訊息**: `invalid_grant` 或 `Token has been expired or revoked`

**解決方案**:
1. 重新建立金鑰：
   ```bash
   # 列出現有金鑰
   gcloud iam service-accounts keys list \
     --iam-account=rag-vertex-ai@${PROJECT_ID}.iam.gserviceaccount.com

   # 刪除舊金鑰
   gcloud iam service-accounts keys delete KEY_ID \
     --iam-account=rag-vertex-ai@${PROJECT_ID}.iam.gserviceaccount.com

   # 建立新金鑰
   gcloud iam service-accounts keys create ./credentials/vertex-ai-key.json \
     --iam-account=rag-vertex-ai@${PROJECT_ID}.iam.gserviceaccount.com
   ```
2. 重啟服務

## 安全最佳實踐

### 1. 金鑰管理
- **定期輪替**: 每 90 天更換一次金鑰
- **最小權限**: 只授予必要的權限
- **版本控制**: 永遠不要提交金鑰到 Git
  ```bash
  # 確認 .gitignore 包含
  credentials/*.json
  vertex-ai-key.json
  ```

### 2. 服務帳戶管理
- 為不同環境使用不同的服務帳戶：
  ```bash
  # 開發環境
  rag-vertex-ai-dev@${PROJECT_ID}.iam.gserviceaccount.com

  # 生產環境
  rag-vertex-ai-prod@${PROJECT_ID}.iam.gserviceaccount.com
  ```

### 3. 審計和監控
- 啟用 Cloud Audit Logs：
  ```bash
  gcloud logging read "resource.type=aiplatform.googleapis.com" \
    --limit 10 \
    --format json
  ```

### 4. 網路安全
- 考慮使用 Private Service Connect
- 限制服務帳戶的 IP 存取範圍

## 費用估算

### Claude 模型定價（2024 年參考）

| 模型 | 輸入價格 (每百萬 tokens) | 輸出價格 (每百萬 tokens) |
|------|-------------------------|-------------------------|
| Claude 4.5 Haiku | $0.25 | $1.25 |
| Claude 4.5 Sonnet | $3.00 | $15.00 |
| Claude 4.1 Opus | $15.00 | $75.00 |

### 成本計算範例
假設每日使用量：
- 100 次查詢
- 每次輸入 1,000 tokens
- 每次輸出 500 tokens

**Haiku 模型月成本**:
- 輸入: 100 × 1,000 × 30 ÷ 1,000,000 × $0.25 = $0.75
- 輸出: 100 × 500 × 30 ÷ 1,000,000 × $1.25 = $1.88
- **總計**: 約 $2.63/月

### 成本優化建議
1. 使用 Haiku 模型進行開發和測試
2. 設定使用配額限制
3. 實作快取機制減少重複查詢
4. 監控使用量：
   ```bash
   # 查看 Vertex AI 使用量
   gcloud billing budgets list
   ```

## 進階設定

### 使用 Workload Identity (Kubernetes)
如果在 GKE 上運行：
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: rag-backend
  annotations:
    iam.gke.io/gcp-service-account: rag-vertex-ai@PROJECT_ID.iam.gserviceaccount.com
```

### 使用 Secret Manager
儲存金鑰在 Secret Manager：
```bash
# 建立 secret
gcloud secrets create vertex-ai-key \
  --data-file=./credentials/vertex-ai-key.json

# 授予存取權限
gcloud secrets add-iam-policy-binding vertex-ai-key \
  --member="serviceAccount:rag-vertex-ai@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## 支援資源

- [Vertex AI 文件](https://cloud.google.com/vertex-ai/docs)
- [Anthropic on Vertex AI](https://cloud.google.com/vertex-ai/generative-ai/docs/partner-models/use-claude)
- [GCP 定價計算機](https://cloud.google.com/products/calculator)
- [服務帳戶最佳實踐](https://cloud.google.com/iam/docs/best-practices-service-accounts)

## 疑難排解檢查清單

- [ ] GCP 專案 ID 正確設定
- [ ] Vertex AI API 已啟用
- [ ] Service Account 已建立
- [ ] 正確的 IAM 角色已授予
- [ ] 金鑰檔案已下載到 `./credentials/vertex-ai-key.json`
- [ ] 檔案權限設定為 644
- [ ] Docker 服務已重啟
- [ ] 環境變數 `GOOGLE_APPLICATION_CREDENTIALS` 已設定
- [ ] 選擇的區域支援所需的模型
- [ ] 專案有足夠的配額

---

*最後更新: 2024-11-28*