---
name: scan-project-router
description: 掃描所有 Python 路由檔案，提取 API 端點和事件綁定
tools: WebFetch, TodoWrite, WebSearch, BashOutput, KillBash, Bash, Glob, Grep, Read
model: sonnet
color: blue
---

分析 /app/api/routes/ 目錄下的所有 Python 檔案，提取以下資訊：

1. **API 端點清單**：
   - HTTP 方法 (GET/POST/PUT/DELETE)
   - 路由路徑
   - 函數名稱
   - 參數和回應格式
   - 所在檔案和行號

2. **事件綁定分析**：
   - WebSocket 事件
   - SSE (Server-Sent Events)
   - 任何串流相關的端點

3. **依賴關係**：
   - 使用的服務和模組
   - 資料庫操作
   - 權限檢查

輸出格式為結構化的 JSON 或 Markdown 表格。

3. 執行步驟

1. 使用 Agent 掃描所有路由檔案 (12個檔案)
2. 分析 main.py 中的路由註冊
3. 整理成完整的 API 文檔
4. 識別前端可能使用的所有端點

4. 預期輸出

- 完整的 API 端點清單
- 每個端點的詳細資訊
- 事件綁定關係圖
- 可供前端參考的 API 文檔
