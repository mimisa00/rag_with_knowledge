/**
 * 帳號管理抽屜管理器模組
 * 管理左側抽屜的展開/收合狀態與選單切換
 */
(function() {
    'use strict';

    const UserDrawerManager = {
        // 抽屜狀態
        isDrawerClosed: false,
        currentSection: 'all-users',
        
        // 初始化
        init: function() {
            this.bindEvents();
            this.loadSavedState();
            this.updateMenuBadges();
        },

        // 綁定事件
        bindEvents: function() {
            // 選單項目點擊事件
            document.querySelectorAll('.user-menu-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    const section = item.getAttribute('data-section');
                    this.switchSection(section);
                });
            });

            // 鍵盤快捷鍵
            document.addEventListener('keydown', (e) => {
                // Alt + D 切換抽屜
                if (e.altKey && e.key === 'd') {
                    e.preventDefault();
                    this.toggleDrawer();
                }
            });
        },

        // 切換抽屜展開/收合
        toggleDrawer: function() {
            const container = document.getElementById('userDrawerContainer');
            this.isDrawerClosed = !this.isDrawerClosed;
            
            if (this.isDrawerClosed) {
                container.classList.remove('drawer-open');
                container.classList.add('drawer-closed');
            } else {
                container.classList.remove('drawer-closed');
                container.classList.add('drawer-open');
            }
            
            // 儲存狀態
            this.saveState();
            
            // 觸發自定義事件
            window.dispatchEvent(new CustomEvent('drawerToggled', {
                detail: { isDrawerClosed: this.isDrawerClosed }
            }));
        },

        // 切換區塊
        switchSection: function(sectionId) {
            // 更新選單項目狀態
            document.querySelectorAll('.user-menu-item').forEach(item => {
                item.classList.remove('active');
            });
            
            const activeItem = document.querySelector(`.user-menu-item[data-section="${sectionId}"]`);
            if (activeItem) {
                activeItem.classList.add('active');
            }

            // 更新內容區塊
            document.querySelectorAll('.content-section').forEach(section => {
                section.classList.remove('active');
            });
            
            const activeSection = document.getElementById(`${sectionId}-section`);
            if (activeSection) {
                activeSection.classList.add('active');
            }

            // 更新狀態列
            this.updateStatusBar(sectionId);
            
            // 儲存當前區塊
            this.currentSection = sectionId;
            this.saveState();

            // 載入對應區塊的資料
            this.loadSectionData(sectionId);
        },

        // 更新狀態列
        updateStatusBar: function(sectionId) {
            const sectionInfo = this.getSectionInfo(sectionId);
            
            const iconElement = document.getElementById('sectionIcon');
            const titleElement = document.getElementById('sectionTitle');
            
            if (iconElement && titleElement) {
                iconElement.className = sectionInfo.icon;
                titleElement.textContent = sectionInfo.title;
            }
        },

        // 取得區塊資訊
        getSectionInfo: function(sectionId) {
            const sections = {
                'all-users': {
                    icon: 'fas fa-users',
                    title: '全部帳號'
                },
                'admin-users': {
                    icon: 'fas fa-user-shield',
                    title: '系統管理員'
                },
                'login-stats': {
                    icon: 'fas fa-chart-line',
                    title: '登入統計'
                },
                'recent-registrations': {
                    icon: 'fas fa-user-plus',
                    title: '近期註冊'
                },
                'anomaly-monitor': {
                    icon: 'fas fa-exclamation-triangle',
                    title: '異常監控'
                },
                'registration-trends': {
                    icon: 'fas fa-chart-area',
                    title: '註冊趨勢'
                }
            };
            
            return sections[sectionId] || { icon: 'fas fa-users', title: '帳號管理' };
        },

        // 載入區塊資料
        loadSectionData: function(sectionId) {
            switch(sectionId) {
                case 'all-users':
                    if (window.UserTimelineTree) {
                        UserTimelineTree.loadUsers();
                    }
                    break;
                case 'admin-users':
                    if (window.UserTimelineTree) {
                        UserTimelineTree.loadAdminUsers();
                    }
                    break;
                case 'login-stats':
                    if (window.UserAnalytics) {
                        UserAnalytics.loadLoginStats();
                    }
                    break;
                case 'recent-registrations':
                    if (window.UserAnalytics) {
                        UserAnalytics.loadRecentRegistrations();
                    }
                    break;
                case 'anomaly-monitor':
                    if (window.UserAnalytics) {
                        UserAnalytics.loadAnomalyMonitor();
                    }
                    break;
                case 'registration-trends':
                    if (window.UserAnalytics) {
                        UserAnalytics.loadRegistrationTrends();
                    }
                    break;
            }
        },

        // 更新選單徽章
        updateMenuBadges: async function() {
            try {
                // 獲取統計資料
                const res = await fetch('/api/admin/users');
                if (!res.ok) return;
                
                const users = await res.json();
                
                // 計算統計
                const totalCount = users.length;
                const adminCount = users.filter(u => u.role === 'admin').length;
                const recentDays = 7;
                const recentDate = new Date();
                recentDate.setDate(recentDate.getDate() - recentDays);
                const recentCount = users.filter(u => new Date(u.created_at) > recentDate).length;
                
                // 更新徽章
                this.updateBadge('totalUserCount', totalCount);
                this.updateBadge('adminUserCount', adminCount);
                this.updateBadge('recentRegCount', recentCount);
                
                // 更新統計資訊
                this.updateStats(users);
                
            } catch (error) {
                console.error('更新徽章失敗:', error);
            }
        },

        // 更新單個徽章
        updateBadge: function(id, count) {
            const badge = document.getElementById(id);
            if (badge) {
                badge.textContent = count;
                badge.style.display = count > 0 ? 'inline-block' : 'none';
            }
        },

        // 更新統計資訊
        updateStats: function(users) {
            const totalCount = users.length;
            const activeCount = users.filter(u => u.is_active).length;
            const inactiveCount = totalCount - activeCount;
            
            // 更新狀態列統計
            const statTotal = document.querySelector('#statTotal span');
            const statActive = document.querySelector('#statActive span');
            const statInactive = document.querySelector('#statInactive span');
            
            if (statTotal) statTotal.textContent = totalCount;
            if (statActive) statActive.textContent = activeCount;
            if (statInactive) statInactive.textContent = inactiveCount;
        },

        // 儲存狀態
        saveState: function() {
            const state = {
                isDrawerClosed: this.isDrawerClosed,
                currentSection: this.currentSection
            };
            localStorage.setItem('userDrawerState', JSON.stringify(state));
        },

        // 載入已儲存的狀態
        loadSavedState: function() {
            const savedState = localStorage.getItem('userDrawerState');
            if (savedState) {
                try {
                    const state = JSON.parse(savedState);
                    
                    // 恢復抽屜狀態
                    if (state.isDrawerClosed) {
                        this.isDrawerClosed = true;
                        const container = document.getElementById('userDrawerContainer');
                        container.classList.remove('drawer-open');
                        container.classList.add('drawer-closed');
                    }
                    
                    // 恢復當前區塊
                    if (state.currentSection) {
                        this.switchSection(state.currentSection);
                    }
                } catch (error) {
                    console.error('載入抽屜狀態失敗:', error);
                }
            }
        }
    };

    // 導出模組
    window.UserDrawerManager = UserDrawerManager;
})();