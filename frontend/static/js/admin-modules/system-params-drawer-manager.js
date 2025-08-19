/**
 * 參數抽屜管理器
 * 管理系統參數頁面的抽屜開關和分類切換
 */
const ParamDrawerManager = (function() {
    'use strict';
    
    // 私有變數
    let isDrawerOpen = false;
    let currentCategory = 'request';
    
    // 分類配置
    const categories = {
        'request': {
            icon: 'fas fa-network-wired',
            title: '請求控制設定',
            color: '#e74c3c'
        },
        'file': {
            icon: 'fas fa-file-alt',
            title: '文檔處理設定',
            color: '#3498db'
        },
        'embedding': {
            icon: 'fas fa-project-diagram',
            title: '嵌入設定',
            color: '#2ecc71'
        },
        'llm': {
            icon: 'fas fa-robot',
            title: '模型設定',
            color: '#9b59b6'
        },
        'prompt': {
            icon: 'fas fa-comment-dots',
            title: '提示詞管理',
            color: '#f39c12'
        }
    };
    
    /**
     * 初始化抽屜管理器
     */
    function init() {
        // 檢查必要元素
        const drawer = document.getElementById('paramDrawerContainer');
        if (!drawer) {
            console.error('ParamDrawerManager: 找不到抽屜容器');
            return;
        }
        
        // 設定初始狀態
        drawer.classList.add('drawer-open');
        drawer.classList.remove('drawer-closed');
        isDrawerOpen = true;
        
        // 顯示預設分類
        switchCategory('request', false);
        
        // 載入儲存的抽屜狀態
        const savedState = localStorage.getItem('paramDrawerState');
        if (savedState === 'open') {
            toggleDrawer(false);
        }
        
        // 載入儲存的分類
        const savedCategory = localStorage.getItem('paramSelectedCategory');
        if (savedCategory && categories[savedCategory]) {
            switchCategory(savedCategory, false);
        }
        
        console.log('ParamDrawerManager 初始化完成');
    }
    
    /**
     * 切換抽屜開關狀態
     */
    function toggleDrawer(saveState = true) {
        const drawer = document.getElementById('paramDrawerContainer');
        if (!drawer) return;
        
        isDrawerOpen = !isDrawerOpen;
        
        if (isDrawerOpen) {
            drawer.classList.remove('drawer-closed');
            drawer.classList.add('drawer-open');
        } else {
            drawer.classList.add('drawer-closed');
            drawer.classList.remove('drawer-open');
        }
        
        // 儲存狀態
        if (saveState) {
            localStorage.setItem('paramDrawerState', isDrawerOpen ? 'open' : 'closed');
        }
        
        // 觸發自定義事件
        window.dispatchEvent(new CustomEvent('paramDrawerToggle', {
            detail: { isOpen: isDrawerOpen }
        }));
    }
    
    /**
     * 切換參數分類
     */
    function switchCategory(categoryKey, saveState = true) {
        if (!categories[categoryKey]) {
            console.error('ParamDrawerManager: 無效的分類', categoryKey);
            return;
        }
        
        currentCategory = categoryKey;
        const categoryInfo = categories[categoryKey];
        
        // 更新分類項目的 active 狀態
        document.querySelectorAll('.category-item').forEach(item => {
            if (item.dataset.category === categoryKey) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
        
        // 更新狀態列圖標和標題
        const iconElement = document.getElementById('categoryIcon');
        const titleElement = document.getElementById('categoryTitle');
        
        if (iconElement) {
            iconElement.className = categoryInfo.icon;
            iconElement.style.color = categoryInfo.color;
        }
        
        if (titleElement) {
            titleElement.textContent = categoryInfo.title;
        }
        
        // 切換參數區塊的顯示
        document.querySelectorAll('.param-category-section').forEach(section => {
            if (section.id === `${categoryKey}Category`) {
                section.classList.add('active');
            } else {
                section.classList.remove('active');
            }
        });
        
        // 儲存選擇
        if (saveState) {
            localStorage.setItem('paramSelectedCategory', categoryKey);
        }
        
        // 觸發自定義事件
        window.dispatchEvent(new CustomEvent('paramCategoryChange', {
            detail: { 
                category: categoryKey,
                categoryInfo: categoryInfo
            }
        }));
    }
    
    /**
     * 獲取當前分類
     */
    function getCurrentCategory() {
        return currentCategory;
    }
    
    /**
     * 獲取抽屜狀態
     */
    function isOpen() {
        return isDrawerOpen;
    }
    
    /**
     * 重置抽屜狀態
     */
    function reset() {
        const drawer = document.getElementById('paramDrawerContainer');
        if (drawer) {
            drawer.classList.add('drawer-closed');
            drawer.classList.remove('drawer-open');
        }
        isDrawerOpen = false;
        currentCategory = 'request';
        
        // 清除儲存的狀態
        localStorage.removeItem('paramDrawerState');
        localStorage.removeItem('paramSelectedCategory');
        
        // 重新初始化
        init();
    }
    
    // 公開 API
    return {
        init: init,
        toggleDrawer: toggleDrawer,
        switchCategory: switchCategory,
        getCurrentCategory: getCurrentCategory,
        isOpen: isOpen,
        reset: reset
    };
})();

// 確保模組可被全域存取
window.ParamDrawerManager = ParamDrawerManager;