/**
 * 組織管理抽屜管理器
 * 管理組織管理頁面的抽屜開關和區塊切換
 */
const OrgDrawerManager = (function() {
    'use strict';
    
    // 私有變數
    let isDrawerOpen = true;
    let currentSection = 'departments';
    
    // 區塊配置
    const sections = {
        'role-templates': {
            icon: 'fas fa-user-cog',
            title: '角色模板',
            color: '#8b5cf6'
        },
        'departments': {
            icon: 'fas fa-sitemap',
            title: '部門管理',
            color: '#667eea'
        },
        'roles': {
            icon: 'fas fa-users-cog',
            title: '角色管理',
            color: '#10b981'
        },
        'employees': {
            icon: 'fas fa-id-card',
            title: '員工管理',
            color: '#f59e0b'
        }
    };
    
    /**
     * 初始化抽屜管理器
     */
    function init() {
        // 檢查必要元素
        const drawer = document.getElementById('orgDrawerContainer');
        if (!drawer) {
            console.error('OrgDrawerManager: 找不到抽屜容器');
            return;
        }
        
        // 設定初始狀態
        drawer.classList.add('drawer-open');
        drawer.classList.remove('drawer-closed');
        isDrawerOpen = true;
        
        // 顯示預設區塊
        switchSection('departments', false);
        
        // 載入儲存的抽屜狀態（但預設保持開啟）
        // const savedState = localStorage.getItem('orgDrawerState');
        // if (savedState === 'closed') {
        //     toggleDrawer(false);
        // }
        
        // 載入儲存的區塊
        const savedSection = localStorage.getItem('orgSelectedSection');
        if (savedSection && sections[savedSection]) {
            switchSection(savedSection, false);
        } else {
            // 確保初始麵包屑正確設置
            updateBreadcrumb('departments', sections['departments']);
        }
        
        // 綁定選單項目點擊事件
        bindMenuEvents();
        
        console.log('OrgDrawerManager 初始化完成');
    }
    
    /**
     * 切換抽屜開關狀態
     */
    function toggleDrawer(saveState = true) {
        const drawer = document.getElementById('orgDrawerContainer');
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
            localStorage.setItem('orgDrawerState', isDrawerOpen ? 'open' : 'closed');
        }
        
        // 觸發自定義事件
        window.dispatchEvent(new CustomEvent('orgDrawerToggle', {
            detail: { isOpen: isDrawerOpen }
        }));
    }
    
    /**
     * 切換區塊
     */
    function switchSection(sectionKey, saveState = true) {
        if (!sections[sectionKey]) {
            console.error('OrgDrawerManager: 無效的區塊', sectionKey);
            return;
        }
        
        currentSection = sectionKey;
        const sectionInfo = sections[sectionKey];
        
        // 更新選單項目的 active 狀態
        document.querySelectorAll('.org-menu-item').forEach(item => {
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
            localStorage.setItem('orgSelectedSection', sectionKey);
        }
        
        // 切換區塊時保持抽屜當前狀態，不強制打開
        // if (!isDrawerOpen) {
        //     toggleDrawer();
        // }
        
        // 觸發自定義事件
        window.dispatchEvent(new CustomEvent('orgSectionChange', {
            detail: { 
                section: sectionKey,
                sectionInfo: sectionInfo
            }
        }));
        
        // 移除直接調用 initRoleManagement，改由事件處理統一管理
    }
    
    /**
     * 更新麵包屑
     */
    function updateBreadcrumb(sectionKey, sectionInfo) {
        const orgLink = document.getElementById('breadcrumb-org-link');
        const orgCurrent = document.getElementById('breadcrumb-org-current');
        const sectionSeparator = document.getElementById('breadcrumb-section-separator');
        const sectionItem = document.getElementById('breadcrumb-section');
        const sectionText = document.getElementById('breadcrumb-section-text');
        
        // 所有區塊都顯示完整層級：首頁 > 系統管理中心 > 組織管理 > [當前區塊]
        if (orgLink) orgLink.classList.remove('d-none');
        if (orgCurrent) orgCurrent.classList.add('d-none');
        if (sectionSeparator) sectionSeparator.classList.remove('d-none');
        if (sectionItem) sectionItem.classList.remove('d-none');
        if (sectionText) sectionText.textContent = sectionInfo.title;
        
        // 組織管理連結點擊事件 - 點擊時切換到部門管理
        if (orgLink && !orgLink.hasAttribute('data-listener-added')) {
            orgLink.addEventListener('click', function(e) {
                e.preventDefault();
                switchSection('departments');
            });
            orgLink.setAttribute('data-listener-added', 'true');
        }
    }
    
    /**
     * 綁定選單項目點擊事件
     */
    function bindMenuEvents() {
        const menuItems = document.querySelectorAll('.org-menu-item');
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
        const drawer = document.getElementById('orgDrawerContainer');
        if (drawer) {
            drawer.classList.add('drawer-open');
            drawer.classList.remove('drawer-closed');
        }
        isDrawerOpen = true;
        currentSection = 'departments';
        
        // 清除儲存的狀態
        localStorage.removeItem('orgDrawerState');
        localStorage.removeItem('orgSelectedSection');
        
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
window.OrgDrawerManager = OrgDrawerManager;