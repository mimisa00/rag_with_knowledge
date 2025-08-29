/**
 * 權限管理抽屜管理器
 * 管理權限管理頁面的抽屜開關和區塊切換
 */
const PermDrawerManager = (function() {
    'use strict';
    
    // 私有變數
    let isDrawerOpen = true;
    let currentSection = 'groups';
    
    // 區塊配置
    const sections = {
        'groups': {
            icon: 'fas fa-users-cog',
            title: '群組權限',
            color: '#667eea'
        },
        'data-scope': {
            icon: 'fas fa-database',
            title: '資料範圍',
            color: '#764ba2'
        },
        'delegation': {
            icon: 'fas fa-user-tie',
            title: '委派管理',
            color: '#f59e0b'
        },
        'audit': {
            icon: 'fas fa-clipboard-list',
            title: '安全稽核',
            color: '#ef4444'
        }
    };
    
    /**
     * 初始化抽屜管理器
     */
    function init() {
        // 檢查必要元素
        const drawer = document.getElementById('permDrawerContainer');
        if (!drawer) {
            console.error('PermDrawerManager: 找不到抽屜容器');
            return;
        }
        
        // 設定初始狀態
        drawer.classList.add('drawer-open');
        drawer.classList.remove('drawer-closed');
        isDrawerOpen = true;
        
        // 顯示預設區塊
        switchSection('groups', false);
        
        // 載入儲存的抽屜狀態（但預設保持開啟）
        // const savedState = localStorage.getItem('permDrawerState');
        // if (savedState === 'closed') {
        //     toggleDrawer(false);
        // }
        
        // 載入儲存的區塊
        const savedSection = localStorage.getItem('permSelectedSection');
        if (savedSection && sections[savedSection]) {
            switchSection(savedSection, false);
        } else {
            // 確保初始麵包屑正確設置
            updateBreadcrumb('groups', sections['groups']);
        }
        
        // 綁定選單項目點擊事件
        bindMenuEvents();
        
        console.log('PermDrawerManager 初始化完成');
    }
    
    /**
     * 切換抽屜開關狀態
     */
    function toggleDrawer(saveState = true) {
        const drawer = document.getElementById('permDrawerContainer');
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
            localStorage.setItem('permDrawerState', isDrawerOpen ? 'open' : 'closed');
        }
        
        // 觸發自定義事件
        window.dispatchEvent(new CustomEvent('permDrawerToggle', {
            detail: { isOpen: isDrawerOpen }
        }));
    }
    
    /**
     * 切換區塊
     */
    function switchSection(sectionKey, saveState = true) {
        if (!sections[sectionKey]) {
            console.error('PermDrawerManager: 無效的區塊', sectionKey);
            return;
        }
        
        currentSection = sectionKey;
        const sectionInfo = sections[sectionKey];
        
        // 更新選單項目的 active 狀態
        document.querySelectorAll('.perm-menu-item').forEach(item => {
            if (item.dataset.section === sectionKey) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
        
        // 更新內容區塊的顯示
        document.querySelectorAll('.content-section').forEach(section => {
            if (section.id === `${sectionKey}-section`) {
                section.classList.add('active');
                section.style.display = 'block';
            } else {
                section.classList.remove('active');
                section.style.display = 'none';
            }
        });
        
        // 更新狀態列
        const iconElement = document.getElementById('sectionIcon');
        const titleElement = document.getElementById('sectionTitle');
        
        if (iconElement) {
            iconElement.className = sectionInfo.icon;
        }
        
        if (titleElement) {
            titleElement.textContent = sectionInfo.title;
        }
        
        // 更新麵包屑
        updateBreadcrumb(sectionKey, sectionInfo);
        
        // 儲存選擇
        if (saveState) {
            localStorage.setItem('permSelectedSection', sectionKey);
        }
        
        // 切換區塊時保持抽屜當前狀態，不強制打開
        // if (!isDrawerOpen) {
        //     toggleDrawer();
        // }
        
        // 觸發自定義事件
        window.dispatchEvent(new CustomEvent('permSectionChange', {
            detail: { 
                section: sectionKey,
                sectionInfo: sectionInfo
            }
        }));
    }
    
    /**
     * 更新麵包屑
     */
    function updateBreadcrumb(sectionKey, sectionInfo) {
        const permLink = document.getElementById('breadcrumb-perm-link');
        const permCurrent = document.getElementById('breadcrumb-perm-current');
        const sectionSeparator = document.getElementById('breadcrumb-section-separator');
        const sectionItem = document.getElementById('breadcrumb-section');
        const sectionText = document.getElementById('breadcrumb-section-text');
        
        // 所有區塊都顯示完整層級：首頁 > 系統管理中心 > 權限管理 > [當前區塊]
        if (permLink) permLink.classList.remove('d-none');
        if (permCurrent) permCurrent.classList.add('d-none');
        if (sectionSeparator) sectionSeparator.classList.remove('d-none');
        if (sectionItem) sectionItem.classList.remove('d-none');
        if (sectionText) sectionText.textContent = sectionInfo.title;
        
        // 權限管理連結點擊事件 - 點擊時切換到群組權限
        if (permLink && !permLink.hasAttribute('data-listener-added')) {
            permLink.addEventListener('click', function(e) {
                e.preventDefault();
                switchSection('groups');
            });
            permLink.setAttribute('data-listener-added', 'true');
        }
    }
    
    /**
     * 綁定選單項目點擊事件
     */
    function bindMenuEvents() {
        const menuItems = document.querySelectorAll('.perm-menu-item');
        menuItems.forEach(item => {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                const section = this.dataset.section;
                if (section) {
                    switchSection(section);
                }
            });
        });
    }
    
    /**
     * 獲取當前區塊
     */
    function getCurrentSection() {
        return currentSection;
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
        const drawer = document.getElementById('permDrawerContainer');
        if (drawer) {
            drawer.classList.add('drawer-open');
            drawer.classList.remove('drawer-closed');
        }
        isDrawerOpen = true;
        currentSection = 'groups';
        
        // 清除儲存的狀態
        localStorage.removeItem('permDrawerState');
        localStorage.removeItem('permSelectedSection');
        
        // 重新初始化
        init();
    }
    
    // 公開 API
    return {
        init: init,
        toggleDrawer: toggleDrawer,
        switchSection: switchSection,
        getCurrentSection: getCurrentSection,
        isOpen: isOpen,
        reset: reset
    };
})();

// 確保模組可被全域存取
window.PermDrawerManager = PermDrawerManager;