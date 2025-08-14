#!/bin/bash
# 測試管理員模組重構

echo "================================"
echo "管理員模組重構測試"
echo "================================"

# 顏色定義
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 基礎路徑
BASE_PATH="/home/shaun/workspace/gitlab/rag_with_ollama/frontend/static"

echo ""
echo "檢查管理員模組檔案..."
echo "------------------------"

# 檢查管理員模組檔案
ADMIN_MODULES=(
    "js/admin-modules/knowledge-base-module.js"
    "js/admin-modules/index-module.js"
    "js/admin-modules/param-module.js"
    "js/admin-modules/account-module.js"
    "js/admin-modules/admin-common-ui.js"
)

all_exist=true
for module in "${ADMIN_MODULES[@]}"; do
    if [ -f "$BASE_PATH/$module" ]; then
        echo -e "${GREEN}✓${NC} $module"
    else
        echo -e "${RED}✗${NC} $module - 檔案不存在"
        all_exist=false
    fi
done

if [ "$all_exist" = true ]; then
    echo -e "${GREEN}所有管理員模組檔案都存在${NC}"
else
    echo -e "${RED}有管理員模組檔案缺失${NC}"
    exit 1
fi

echo ""
echo "檢查 dashboard_admin.html 模組化載入..."
echo "----------------------------------------"

# 檢查是否有模組化載入機制
if grep -q "ScriptLoader.loadModulesInOrder" "$BASE_PATH/dashboard_admin.html"; then
    echo -e "${GREEN}✓${NC} 模組化載入機制已實作"
else
    echo -e "${RED}✗${NC} 未找到模組化載入機制"
fi

# 檢查是否載入管理員模組
if grep -q "admin-modules" "$BASE_PATH/dashboard_admin.html"; then
    echo -e "${GREEN}✓${NC} 管理員模組載入路徑正確"
else
    echo -e "${RED}✗${NC} 未找到管理員模組載入"
fi

# 檢查是否有殘留的舊代碼
echo ""
echo "檢查是否有殘留的舊代碼..."
echo "-------------------------"

# 計算檔案行數
line_count=$(wc -l < "$BASE_PATH/dashboard_admin.html")
echo "dashboard_admin.html 行數: $line_count"

if [ "$line_count" -lt 1000 ]; then
    echo -e "${GREEN}✓${NC} 檔案大小合理，應該已清理舊代碼"
else
    echo -e "${YELLOW}⚠${NC} 檔案可能還有殘留的舊代碼"
fi

# 檢查備份檔案
echo ""
echo "檢查備份檔案..."
echo "---------------"

if [ -f "$BASE_PATH/backup/dashboard_admin.html.original" ]; then
    echo -e "${GREEN}✓${NC} 原始備份存在"
    original_lines=$(wc -l < "$BASE_PATH/backup/dashboard_admin.html.original")
    echo "  原始檔案行數: $original_lines"
    echo "  重構後行數: $line_count"
    reduction=$((original_lines - line_count))
    echo "  減少了 $reduction 行代碼"
else
    echo -e "${YELLOW}⚠${NC} 未找到原始備份"
fi

echo ""
echo "檢查模組結構..."
echo "---------------"

# 檢查模組是否有正確的 IIFE 結構
for module in "${ADMIN_MODULES[@]}"; do
    module_file="$BASE_PATH/$module"
    if [ -f "$module_file" ]; then
        # 檢查 IIFE 開頭
        if head -n 5 "$module_file" | grep -q "(function()"; then
            echo -e "${GREEN}✓${NC} $(basename $module) - IIFE 結構正確"
        else
            echo -e "${RED}✗${NC} $(basename $module) - IIFE 結構可能有問題"
        fi
        
        # 檢查模組導出
        module_name=$(basename "$module" .js | sed 's/-module/Module/' | sed 's/\b\(.\)/\u\1/g' | sed 's/-//g')
        if grep -q "window\.$module_name" "$module_file"; then
            echo -e "${GREEN}✓${NC} $(basename $module) - 模組導出正確"
        else
            echo -e "${YELLOW}⚠${NC} $(basename $module) - 未找到預期的模組導出"
        fi
    fi
done

echo ""
echo "================================"
echo "測試完成"
echo "================================"
echo ""
echo "建議："
echo "1. 啟動應用程式並在瀏覽器中測試"
echo "2. 檢查瀏覽器控制台是否有錯誤"
echo "3. 測試所有管理員功能是否正常運作"
echo ""