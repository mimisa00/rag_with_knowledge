#!/bin/bash
#############################################
# 前端模組測試系統啟動腳本
# 用途：測試前端重構後的模組功能
#############################################

set -e

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印帶顏色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 顯示測試選單
show_menu() {
    echo ""
    echo "=================================="
    echo "🧪 前端功能測試系統"
    echo "=================================="
    echo "1. 測試 JavaScript 模組載入"
    echo "2. 測試 Dashboard 頁面重構"
    echo "3. 開啟瀏覽器測試頁面"
    echo "4. 執行完整前端測試"
    echo "5. 清理測試產生的檔案"
    echo "0. 退出"
    echo "=================================="
    echo -n "請選擇測試項目 [0-5]: "
}

# 檢查服務狀態
check_services() {
    print_info "檢查服務狀態..."
    
    if ! docker compose ps | grep -q backend; then
        print_error "後端服務未啟動！"
        echo -n "是否要啟動服務？[y/N]: "
        read -r answer
        if [[ "$answer" == "y" || "$answer" == "Y" ]]; then
            print_info "啟動服務中..."
            ./startup.sh
            sleep 5
        else
            return 1
        fi
    else
        print_success "後端服務運行中"
    fi
    
    return 0
}

# 測試 JavaScript 模組
test_js_modules() {
    print_info "開始測試 JavaScript 模組..."
    echo ""
    
    if [ -f "./test/frontend-modules-test.sh" ]; then
        ./test/frontend-modules-test.sh
    else
        print_error "測試腳本 test/frontend-modules-test.sh 不存在"
        return 1
    fi
}

# 測試重構後的 dashboard
test_dashboard_refactor() {
    print_info "開始測試重構後的 dashboard.html..."
    echo ""
    
    if [ -f "./test/dashboard-refactor-test.sh" ]; then
        ./test/dashboard-refactor-test.sh
    else
        print_error "測試腳本 test/dashboard-refactor-test.sh 不存在"
        return 1
    fi
}

# 開啟瀏覽器測試頁面
open_browser_test() {
    print_info "準備開啟瀏覽器測試頁面..."
    
    # 確保測試 HTML 檔案存在
    if [ ! -f "frontend/static/test/frontend-test.html" ]; then
        print_warning "測試頁面不存在，創建中..."
        create_test_html
    fi
    
    local URL="http://localhost:8080/test/frontend-test.html"
    print_info "測試頁面位址: $URL"
    
    # 嘗試自動開啟瀏覽器
    if command -v xdg-open > /dev/null; then
        xdg-open "$URL"
    elif command -v open > /dev/null; then
        open "$URL"
    else
        print_warning "請手動在瀏覽器中開啟: $URL"
    fi
    
    print_info "請在瀏覽器的開發者工具 Console 中查看測試結果"
}

# 創建測試 HTML 頁面
create_test_html() {
    cat > frontend/static/test/frontend-test.html << 'EOF'
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <title>前端功能測試頁面</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        body { 
            font-family: monospace; 
            padding: 20px;
            background: #f5f5f5;
        }
        .test-section {
            background: white;
            padding: 15px;
            margin: 10px 0;
            border-radius: 5px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .test-result {
            padding: 5px;
            margin: 5px 0;
        }
        .success { color: green; }
        .error { color: red; }
        .warning { color: orange; }
        button {
            padding: 10px 20px;
            margin: 5px;
            cursor: pointer;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
        }
        button:hover {
            background: #0056b3;
        }
        pre {
            background: #f0f0f0;
            padding: 10px;
            overflow-x: auto;
            border-radius: 4px;
        }
        h1 {
            color: #333;
            border-bottom: 2px solid #007bff;
            padding-bottom: 10px;
        }
        h2 {
            color: #555;
        }
    </style>
</head>
<body>
    <h1>🧪 前端功能測試頁面</h1>
    
    <div class="test-section">
        <h2>模組載入測試</h2>
        <button onclick="testModuleLoading()">測試模組載入</button>
        <button onclick="testModuleFunctions()">測試模組功能</button>
        <button onclick="testAPIConnections()">測試 API 連接</button>
        <button onclick="clearResults()">清除結果</button>
        <div id="loadResults"></div>
    </div>
    
    <div class="test-section">
        <h2>Console 輸出</h2>
        <pre id="consoleOutput"></pre>
    </div>
    
    <!-- 測試用的 DOM 元素 -->
    <div id="loader-overlay" style="display:none;">
        <div class="loader"></div>
        <div class="loader-text">測試中...</div>
    </div>
    
    <div id="qaKnowledgeBaseSelect" style="display:none;"></div>
    <div id="answer" style="display:none;"></div>
    <div id="question" style="display:none;"></div>
    <div id="sendBtn" style="display:none;"></div>
    
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <script>
        const output = document.getElementById('consoleOutput');
        const results = document.getElementById('loadResults');
        
        function log(msg, type = 'info') {
            const timestamp = new Date().toISOString().substr(11, 8);
            output.textContent += `[${timestamp}] ${msg}\n`;
            console.log(msg);
            
            const div = document.createElement('div');
            div.className = `test-result ${type}`;
            div.textContent = msg;
            results.appendChild(div);
        }
        
        function clearResults() {
            output.textContent = '';
            results.innerHTML = '';
        }
        
        async function testModuleLoading() {
            clearResults();
            log('開始測試模組載入...', 'info');
            
            try {
                // 載入 ScriptLoader
                log('載入 ScriptLoader...', 'info');
                await loadScript('/js/modules/script-loader.js');
                
                if (typeof ScriptLoader === 'undefined') {
                    throw new Error('ScriptLoader 載入失敗');
                }
                log('✅ ScriptLoader 載入成功', 'success');
                
                // 使用 ScriptLoader 載入其他模組
                log('載入其他模組...', 'info');
                await ScriptLoader.loadModulesInOrder([
                    '/js/modules/common-ui.js',
                    '/js/modules/user-menu-module.js',
                    '/js/modules/qa-module.js'
                ]);
                
                // 檢查模組是否載入
                const modules = ['CommonUI', 'UserMenu', 'QAModule'];
                for (const module of modules) {
                    if (typeof window[module] !== 'undefined') {
                        log(`✅ ${module} 載入成功`, 'success');
                    } else {
                        log(`❌ ${module} 載入失敗`, 'error');
                    }
                }
                
            } catch (error) {
                log(`❌ 錯誤: ${error.message}`, 'error');
            }
        }
        
        async function testModuleFunctions() {
            log('開始測試模組功能...', 'info');
            
            // 測試 CommonUI
            if (typeof CommonUI !== 'undefined') {
                log('測試 CommonUI 功能...', 'info');
                
                const functions = ['showSpinner', 'hideSpinner', 'escapeHtml', 'debounce', 'throttle'];
                for (const func of functions) {
                    if (typeof CommonUI[func] === 'function') {
                        log(`  ✅ CommonUI.${func} 存在`, 'success');
                    } else {
                        log(`  ❌ CommonUI.${func} 不存在`, 'error');
                    }
                }
                
                // 實際測試 escapeHtml
                const testStr = '<script>alert("test")</script>';
                const escaped = CommonUI.escapeHtml(testStr);
                if (!escaped.includes('<script>')) {
                    log(`  ✅ escapeHtml 功能正常: ${escaped}`, 'success');
                } else {
                    log(`  ❌ escapeHtml 功能異常`, 'error');
                }
            } else {
                log('❌ CommonUI 未載入', 'error');
            }
            
            // 測試 UserMenu
            if (typeof UserMenu !== 'undefined') {
                log('測試 UserMenu 功能...', 'info');
                
                const functions = ['init', 'openUserMenu', 'closeUserMenu', 'logout'];
                for (const func of functions) {
                    if (typeof UserMenu[func] === 'function') {
                        log(`  ✅ UserMenu.${func} 存在`, 'success');
                    } else {
                        log(`  ❌ UserMenu.${func} 不存在`, 'error');
                    }
                }
            } else {
                log('❌ UserMenu 未載入', 'error');
            }
            
            // 測試 QAModule
            if (typeof QAModule !== 'undefined') {
                log('測試 QAModule 功能...', 'info');
                
                const functions = ['init', 'createNewConversation', 'toggleNounAnalysis', 'toggleThinkResponse'];
                for (const func of functions) {
                    if (typeof QAModule[func] === 'function') {
                        log(`  ✅ QAModule.${func} 存在`, 'success');
                    } else {
                        log(`  ❌ QAModule.${func} 不存在`, 'error');
                    }
                }
            } else {
                log('❌ QAModule 未載入', 'error');
            }
        }
        
        async function testAPIConnections() {
            log('開始測試 API 連接...', 'info');
            
            const apis = [
                { path: '/api/conversations', method: 'GET', name: '對話列表' },
                { path: '/api/knowledge-bases', method: 'GET', name: '知識庫列表' },
                { path: '/api/user/current-user', method: 'GET', name: '當前用戶' },
                { path: '/api/user/is/enable/think', method: 'GET', name: '推理功能狀態' }
            ];
            
            for (const api of apis) {
                try {
                    const response = await fetch(api.path, { method: api.method });
                    if (response.ok) {
                        log(`  ✅ ${api.name} API (${api.path}): ${response.status}`, 'success');
                    } else {
                        log(`  ⚠️ ${api.name} API (${api.path}): ${response.status}`, 'warning');
                    }
                } catch (error) {
                    log(`  ❌ ${api.name} API (${api.path}): ${error.message}`, 'error');
                }
            }
        }
        
        function loadScript(src) {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = src + '?_t=' + Date.now();
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        
        // 頁面載入時自動執行基本測試
        window.addEventListener('load', () => {
            log('測試頁面已載入，請點擊按鈕開始測試', 'info');
        });
    </script>
</body>
</html>
EOF
    print_success "測試頁面已創建"
}

# 執行所有測試
run_all_tests() {
    print_info "執行完整前端測試..."
    echo ""
    
    local failed=0
    
    # 測試 JavaScript 模組
    echo "==== 1. JavaScript 模組測試 ===="
    if ! test_js_modules; then
        ((failed++))
    fi
    echo ""
    
    # 測試 Dashboard 重構
    echo "==== 2. Dashboard 重構測試 ===="
    if ! test_dashboard_refactor; then
        ((failed++))
    fi
    echo ""
    
    if [ $failed -eq 0 ]; then
        print_success "所有測試通過！"
    else
        print_warning "有 $failed 個測試失敗"
    fi
}

# 清理測試檔案
cleanup_test_files() {
    print_info "清理測試產生的檔案..."
    
    # 清理測試報告
    rm -f frontend/static/test/reports/*.json
    
    # 清理臨時測試檔案
    rm -f frontend/static/test/test-dashboard.py
    rm -f frontend/static/test/run-module-tests.py
    
    print_success "測試檔案已清理"
}

# 主程式
main() {
    # 檢查服務
    if ! check_services; then
        print_error "服務檢查失敗，退出"
        exit 1
    fi
    
    while true; do
        show_menu
        read -r choice
        
        case $choice in
            1)
                test_js_modules
                ;;
            2)
                test_dashboard_refactor
                ;;
            3)
                open_browser_test
                ;;
            4)
                run_all_tests
                ;;
            5)
                cleanup_test_files
                ;;
            0)
                print_info "退出測試系統"
                exit 0
                ;;
            *)
                print_warning "無效選項，請重新選擇"
                ;;
        esac
        
        echo ""
        echo -n "按 Enter 繼續..."
        read -r
    done
}

# 執行主程式
main