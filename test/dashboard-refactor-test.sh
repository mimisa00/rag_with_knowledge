#!/bin/bash
set -e

echo "🧪 測試重構後的 dashboard.html"
echo "================================"

# 切換到專案根目錄
cd "$(dirname "$0")/.."

# 檢查現有服務是否已啟動
if ! docker compose ps | grep -q backend; then
    echo "⚠️ 主服務未啟動，請先執行 ./startup.sh"
    exit 1
fi

echo "✅ 檢測到主服務運行中"

# 創建測試 Python 腳本
cat > frontend/static/test/test-dashboard.py << 'EOF'
#!/usr/bin/env python3
"""
測試重構後的 dashboard HTML
"""

import sys
import time
from pathlib import Path

def test_html_structure():
    """測試 HTML 結構"""
    html_path = Path("/backend/frontend/static/dashboard_refactored.html")
    
    print(f"📋 測試檔案: dashboard_refactored.html")
    print("-" * 40)
    
    if not html_path.exists():
        print("❌ 檔案不存在")
        return False
    
    print("✅ 檔案存在")
    
    with open(html_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 測試模組引用
    tests = {
        "ScriptLoader 載入": "loadWithTimestamp('/js/modules/script-loader.js')" in content,
        "CommonUI 模組": "/js/modules/common-ui.js" in content,
        "UserMenu 模組": "/js/modules/user-menu-module.js" in content,
        "QAModule 模組": "/js/modules/qa-module.js" in content,
        "UserMenu.openUserMenu": "UserMenu.openUserMenu()" in content,
        "UserMenu.logout": "UserMenu.logout()" in content,
        "QAModule.createNewConversation": "QAModule.createNewConversation()" in content,
        "QAModule.toggleNounAnalysis": "QAModule.toggleNounAnalysis()" in content,
        "QAModule.showDrawerContent": "QAModule.showDrawerContent('memoryDrawer')" in content,
        "模組初始化": "QAModule.init()" in content and "UserMenu.init()" in content
    }
    
    all_passed = True
    for test_name, result in tests.items():
        status = "✅" if result else "❌"
        print(f"  {status} {test_name}")
        if not result:
            all_passed = False
    
    # 檢查是否移除了舊的內嵌 JavaScript
    print("\n  檢查舊程式碼移除狀況:")
    old_code_checks = {
        "舊的 escapeHtml 函數": "function escapeHtml(" not in content,
        "舊的 sendQuestion 函數": "async function sendQuestion()" not in content,
        "舊的 toggleNounAnalysis": "function toggleNounAnalysis()" not in content,
        "舊的 createNewConversation": "function createNewConversation()" not in content
    }
    
    for check_name, result in old_code_checks.items():
        status = "✅" if result else "⚠️"
        print(f"    {status} {check_name}")
        if not result:
            print(f"      警告: 發現可能的重複程式碼")
    
    return all_passed

def main():
    print("🧪 開始測試重構後的 dashboard")
    print("=" * 50)
    
    result = test_html_structure()
    
    print("\n" + "=" * 50)
    if result:
        print("🎉 測試通過！")
        return 0
    else:
        print("⚠️ 部分測試失敗")
        return 1

if __name__ == "__main__":
    sys.exit(main())
EOF

echo ""
echo "📊 執行 HTML 結構測試..."
echo "================================"

docker compose exec backend python /backend/frontend/static/test/test-dashboard.py

TEST_RESULT=$?

# 清理測試檔案
rm -f frontend/static/test/test-dashboard.py

echo ""
echo "================================"
if [ $TEST_RESULT -eq 0 ]; then
    echo "✅ 重構測試通過！"
else
    echo "⚠️ 部分測試失敗，請檢查"
fi

exit $TEST_RESULT