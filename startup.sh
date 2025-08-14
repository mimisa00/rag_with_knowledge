#!/bin/bash
set -e  # 任一步驟失敗則終止腳本

echo "📁 切換到 RAG 專案目錄"
cd "$(dirname "$0")"

# 檢查環境變數檔案
if [ ! -f ".env" ]; then
    echo "📝 複製環境變數檔案..."
    cp env.example .env
    echo "✅ 環境變數檔案已建立，請檢查 .env 檔案設定"
fi

echo "🚀 啟動 RAG 系統..."
# 檢查 Docker 是否運行
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker 未運行，請先啟動 Docker"
    exit 1
fi

# 檢查 docker-compose.yml 是否存在
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ docker-compose.yml 不存在"
    exit 1
fi

echo "🧹 停止並移除舊容器"
docker compose down
docker compose build backend

# 建立必要的目錄
echo "📁 建立必要目錄..."
mkdir -p documents faiss_data logs mariadb_data models ollama



# 啟動 MariaDB 服務
echo "🗄️ 啟動 MariaDB 資料庫服務..."
docker compose up -d mariadb
# 檢查資料庫是否正常運行
echo "🔍 檢查資料庫狀態..."
for i in {1..30}; do
    if docker compose exec -T mariadb mysql -u rag_user -prag_password_2024 -e "SELECT 1;" > /dev/null 2>&1; then
        echo "✅ 資料庫已正常運行"
        break
    else
        echo "⏳ 等待資料庫啟動... ($i/30)"
        sleep 1
    fi
    
    if [ $i -eq 30 ]; then
        echo "❌ 資料庫啟動超時，請檢查日誌"
        docker compose logs mariadb
        exit 1
    fi
done

# 啟動其他服務
echo "🚀 啟動其他服務..."
#docker compose build
docker compose up -d

# 檢查服務狀態
echo "📊 服務狀態："
docker compose ps

# 測試資料庫連線
echo "🧪 測試資料庫連線..."
if docker compose exec rag python test_db_connection.py; then
    echo "✅ 資料庫連線測試通過"
else
    echo "⚠️ 資料庫連線測試失敗，但系統仍可運行"
fi

echo ""
echo "🎉 RAG 系統啟動完成！"
echo "📱 前端介面：http://localhost:8080"
echo "🗄️ 資料庫：localhost:3306"
echo "📊 查看日誌：docker compose logs -f"
echo "🛑 停止服務：docker compose down" 
