#!/usr/bin/env python3
"""
前端模組測試腳本
直接測試 JavaScript 模組功能
"""

import os
import sys
import json
import time
import requests
from pathlib import Path

BASE_URL = "http://localhost:8080"

def test_js_file_structure(filepath):
    """測試 JS 檔案結構"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    tests = {
        "IIFE模式": "(() => {" in content or "(function()" in content,
        "公開API": "return {" in content,
        "模組導出": "module.exports" in content
    }
    return tests

def test_module_functions(module_path, expected_functions):
    """測試模組包含的函數"""
    with open(module_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    results = {}
    for func in expected_functions:
        results[func] = func in content
    return results

def main():
    print("🧪 前端模組測試開始")
    print("=" * 50)
    
    # 定義模組路徑
    modules_dir = Path("/backend/frontend/static/js/modules")
    
    # 定義測試案例
    test_cases = {
        "script-loader.js": ["loadScript", "loadCSS", "loadModulesInOrder", "reloadScript"],
        "common-ui.js": ["showSpinner", "hideSpinner", "escapeHtml", "debounce", "throttle"],
        "user-menu-module.js": ["init", "loadUserInfo", "openUserMenu", "closeUserMenu", "logout"],
        "qa-module.js": ["init", "createNewConversation", "switchConversation", "deleteConversation", 
                         "toggleNounAnalysis", "toggleThinkResponse", "showDrawerContent", "sendQuestion"]
    }
    
    all_passed = True
    report = {"timestamp": time.strftime("%Y-%m-%d %H:%M:%S"), "tests": {}}
    
    for module_name, expected_functions in test_cases.items():
        module_path = modules_dir / module_name
        print(f"\n📋 測試模組: {module_name}")
        print("-" * 40)
        
        module_report = {"exists": False, "structure": {}, "functions": {}}
        
        # 檢查檔案存在
        if not module_path.exists():
            print(f"❌ 檔案不存在")
            all_passed = False
            report["tests"][module_name] = module_report
            continue
        
        module_report["exists"] = True
        print(f"✅ 檔案存在")
        
        # 測試結構
        structure = test_js_file_structure(module_path)
        module_report["structure"] = structure
        
        for test, result in structure.items():
            status = "✅" if result else "❌"
            print(f"  {status} {test}")
            if not result:
                all_passed = False
        
        # 測試函數
        functions = test_module_functions(module_path, expected_functions)
        module_report["functions"] = functions
        
        print(f"\n  函數檢查:")
        for func, exists in functions.items():
            status = "✅" if exists else "❌"
            print(f"    {status} {func}")
            if not exists:
                all_passed = False
        
        report["tests"][module_name] = module_report
    
    # 測試 HTTP 訪問
    print(f"\n📋 測試 HTTP 訪問")
    print("-" * 40)
    
    http_tests = []
    for module_name in test_cases.keys():
        url = f"{BASE_URL}/js/modules/{module_name}"
        try:
            resp = requests.get(url, timeout=5)
            success = resp.status_code == 200
            status = "✅" if success else "❌"
            print(f"  {status} {url} ({resp.status_code})")
            http_tests.append({"module": module_name, "url": url, "status": resp.status_code, "success": success})
            if not success:
                all_passed = False
        except Exception as e:
            print(f"  ❌ {url} (錯誤: {e})")
            http_tests.append({"module": module_name, "url": url, "error": str(e), "success": False})
            all_passed = False
    
    report["http_tests"] = http_tests
    report["all_passed"] = all_passed
    
    # 保存報告
    report_path = Path("/backend/frontend/static/test/reports/test-report.json")
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    
    # 總結
    print("\n" + "=" * 50)
    if all_passed:
        print("🎉 所有測試通過！")
        return 0
    else:
        print("⚠️ 部分測試失敗")
        return 1

if __name__ == "__main__":
    sys.exit(main())