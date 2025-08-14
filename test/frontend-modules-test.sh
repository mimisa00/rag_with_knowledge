#!/bin/bash
set -e  # 任一步驟失敗則終止腳本

echo "🧪 前端模組測試系統（簡化版）"
echo "================================"

# 切換到專案根目錄
cd "$(dirname "$0")/.."

# 檢查現有服務是否已啟動
if ! docker compose ps | grep -q backend; then
    echo "⚠️ 主服務未啟動，請先執行 ./startup.sh"
    exit 1
fi

echo "✅ 檢測到主服務運行中"

# 創建測試報告目錄
mkdir -p frontend/static/test/reports

# 複製測試腳本到容器可訪問的位置
cp test/frontend-modules-validator.py frontend/static/test/frontend-modules-validator.py


# 執行測試
echo ""
echo "📊 執行模組測試..."
echo "================================"

docker compose exec backend python /backend/frontend/static/test/frontend-modules-validator.py

TEST_RESULT=$?

# 顯示測試報告
if [ -f "frontend/static/test/reports/test-report.json" ]; then
    echo ""
    echo "📋 測試報告已生成："
    echo "frontend/static/test/reports/test-report.json"
    echo ""
    echo "報告內容："
    cat frontend/static/test/reports/test-report.json | python3 -m json.tool | head -50
fi

# 清理測試檔案
rm -f frontend/static/test/frontend-modules-validator.py

echo ""
echo "================================"
if [ $TEST_RESULT -eq 0 ]; then
    echo "✅ 測試全部通過！"
else
    echo "⚠️ 部分測試失敗，請檢查報告"
fi

exit $TEST_RESULT