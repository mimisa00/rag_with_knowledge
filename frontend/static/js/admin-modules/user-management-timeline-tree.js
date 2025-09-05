/**
 * 帳號管理時間軸組織樹模組
 * 以時間維度展示使用者帳號（年→月→日）
 */
(function() {
    'use strict';

    const UserTimelineTree = {
        // 資料儲存
        allUsers: [],
        timelineData: {},
        selectedUser: null,
        expandedNodes: new Set(),
        searchKeyword: '',
        filterStatus: 'all', // 'all', 'inactive', 'active'

        // 初始化
        init: function() {
            this.bindEvents();
            this.loadUsers();
        },

        // 綁定事件
        bindEvents: function() {
            // 搜尋功能
            const searchInput = document.getElementById('userSearchInput');
            if (searchInput) {
                // 保持原有的 Enter 鍵搜尋功能
                searchInput.addEventListener('keyup', (e) => {
                    if (e.key === 'Enter') {
                        this.searchUsers();
                    }
                });
                
                // 添加即時搜尋功能（防抖動）
                let searchTimeout;
                searchInput.addEventListener('input', (e) => {
                    clearTimeout(searchTimeout);
                    searchTimeout = setTimeout(() => {
                        this.searchUsers();
                    }, 100); 
                });
            }
        },

        // 載入所有使用者
        loadUsers: async function() {
            const container = document.getElementById('timelineTreeContainer');
            if (!container) return;

            // 顯示載入中
            container.innerHTML = `
                <div class="loading-spinner">
                    <div class="spinner"></div>
                    <p>載入帳號資料中...</p>
                </div>
            `;

            try {
                const res = await fetch('/api/admin/users');
                if (!res.ok) throw new Error('載入失敗');
                
                this.allUsers = await res.json();
                this.buildTimelineData();
                this.initCurrentMonthExpansion();
                this.renderTimelineTree();
                this.updateStatistics();
                
            } catch (error) {
                console.error('載入使用者失敗:', error);
                container.innerHTML = `
                    <div class="text-muted" style="text-align: center; padding: 20px;">
                        載入失敗，請重新整理頁面
                    </div>
                `;
            }
        },

        // 載入管理員使用者
        loadAdminUsers: async function() {
            const container = document.getElementById('adminUsersContainer');
            if (!container) return;

            try {
                const res = await fetch('/api/admin/users');
                if (!res.ok) throw new Error('載入失敗');
                
                const allUsers = await res.json();
                const adminUsers = allUsers.filter(u => u.role === 'admin');
                
                this.renderAdminList(adminUsers);
                
            } catch (error) {
                console.error('載入管理員失敗:', error);
                container.innerHTML = '<div class="text-muted">載入失敗</div>';
            }
        },

        // 建立時間軸資料結構
        buildTimelineData: function() {
            this.timelineData = {};
            
            // 根據篩選條件過濾使用者
            let filteredUsers;
            if (this.filterStatus === 'inactive') {
                filteredUsers = this.allUsers.filter(user => !user.is_active);
            } else if (this.filterStatus === 'active') {
                filteredUsers = this.allUsers.filter(user => user.is_active);
            } else {
                filteredUsers = this.allUsers; // 'all'
            }
            
            filteredUsers.forEach(user => {
                const date = new Date(user.created_at);
                const year = date.getFullYear();
                const month = date.getMonth() + 1; // 0-based
                const day = date.getDate();
                
                // 初始化年份
                if (!this.timelineData[year]) {
                    this.timelineData[year] = {};
                }
                
                // 初始化月份
                if (!this.timelineData[year][month]) {
                    this.timelineData[year][month] = {};
                }
                
                // 初始化日期
                if (!this.timelineData[year][month][day]) {
                    this.timelineData[year][month][day] = [];
                }
                
                // 加入使用者
                this.timelineData[year][month][day].push({
                    ...user,
                    time: date.toLocaleTimeString('zh-TW', { 
                        hour: '2-digit', 
                        minute: '2-digit', 
                        second: '2-digit' 
                    })
                });
            });
            
            // 排序使用者（同一天內按時間排序）
            Object.keys(this.timelineData).forEach(year => {
                Object.keys(this.timelineData[year]).forEach(month => {
                    Object.keys(this.timelineData[year][month]).forEach(day => {
                        this.timelineData[year][month][day].sort((a, b) => 
                            new Date(b.created_at) - new Date(a.created_at)
                        );
                    });
                });
            });
        },

        // 初始化當月份展開狀態
        initCurrentMonthExpansion: function() {
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth() + 1;
            
            // 檢查當前年份是否存在資料
            if (this.timelineData[currentYear]) {
                const yearId = `year-${currentYear}`;
                this.expandedNodes.add(yearId);
                
                // 檢查當前月份是否存在資料
                if (this.timelineData[currentYear][currentMonth]) {
                    const monthId = `month-${currentYear}-${currentMonth}`;
                    this.expandedNodes.add(monthId);
                    
                    // 展開當前月份所有的日期子節點
                    Object.keys(this.timelineData[currentYear][currentMonth]).forEach(day => {
                        const dayId = `day-${currentYear}-${currentMonth}-${day}`;
                        this.expandedNodes.add(dayId);
                    });
                }
            }
        },

        // 渲染時間軸樹
        renderTimelineTree: function() {
            const container = document.getElementById('timelineTreeContainer');
            if (!container) return;

            const years = Object.keys(this.timelineData).sort((a, b) => b - a);
            
            if (years.length === 0) {
                container.innerHTML = `
                    <div class="text-muted" style="text-align: center; padding: 20px;">
                        尚無帳號資料
                    </div>
                `;
                return;
            }

            let html = '';
            
            years.forEach((year, yearIndex) => {
                const yearId = `year-${year}`;
                const isExpanded = yearIndex === 0 || this.expandedNodes.has(yearId);
                const yearCount = this.getYearUserCount(year);
                
                html += `
                    <div class="timeline-node timeline-year">
                        <div class="timeline-node-header" onclick="UserTimelineTree.toggleNode('${yearId}')">
                            <span class="timeline-expand-icon ${isExpanded ? 'expanded' : ''}">
                                <i class="fas fa-chevron-right"></i>
                            </span>
                            <span class="timeline-node-icon">
                                <i class="fas fa-calendar-alt"></i>
                            </span>
                            <span class="timeline-node-label">${year}年</span>
                            <span class="timeline-node-count">${yearCount}</span>
                        </div>
                        <div class="timeline-children ${isExpanded ? 'expanded' : ''}" id="${yearId}">
                            ${this.renderMonths(year)}
                        </div>
                    </div>
                `;
            });
            
            container.innerHTML = html;
        },

        // 渲染月份節點
        renderMonths: function(year) {
            const months = Object.keys(this.timelineData[year]).sort((a, b) => b - a);
            let html = '';
            
            months.forEach(month => {
                const monthId = `month-${year}-${month}`;
                const isExpanded = this.expandedNodes.has(monthId);
                const monthCount = this.getMonthUserCount(year, month);
                
                html += `
                    <div class="timeline-node timeline-month">
                        <div class="timeline-node-header" onclick="UserTimelineTree.toggleNode('${monthId}')">
                            <span class="timeline-expand-icon ${isExpanded ? 'expanded' : ''}">
                                <i class="fas fa-chevron-right"></i>
                            </span>
                            <span class="timeline-node-icon">
                                <i class="fas fa-calendar"></i>
                            </span>
                            <span class="timeline-node-label">${month}月</span>
                            <span class="timeline-node-count">${monthCount}</span>
                        </div>
                        <div class="timeline-children ${isExpanded ? 'expanded' : ''}" id="${monthId}">
                            ${this.renderDays(year, month)}
                        </div>
                    </div>
                `;
            });
            
            return html;
        },

        // 渲染日期節點
        renderDays: function(year, month) {
            const days = Object.keys(this.timelineData[year][month]).sort((a, b) => b - a);
            let html = '';
            
            days.forEach(day => {
                const dayId = `day-${year}-${month}-${day}`;
                const isExpanded = this.expandedNodes.has(dayId);
                const dayUsers = this.timelineData[year][month][day];
                
                html += `
                    <div class="timeline-node timeline-day">
                        <div class="timeline-node-header" onclick="UserTimelineTree.toggleNode('${dayId}')">
                            <span class="timeline-expand-icon ${isExpanded ? 'expanded' : ''}">
                                <i class="fas fa-chevron-right"></i>
                            </span>
                            <span class="timeline-node-icon">
                                <i class="fas fa-calendar-day"></i>
                            </span>
                            <span class="timeline-node-label">${day}日</span>
                            <span class="timeline-node-count">${dayUsers.length}</span>
                        </div>
                        <div class="timeline-children ${isExpanded ? 'expanded' : ''}" id="${dayId}">
                            ${this.renderUsers(dayUsers)}
                        </div>
                    </div>
                `;
            });
            
            return html;
        },

        // 渲染使用者節點
        renderUsers: function(users) {
            let html = '';
            
            users.forEach(user => {
                const initials = user.username.substring(0, 2).toUpperCase();
                const roleClass = user.role === 'admin' ? 'role-admin' : 'role-user';
                const statusClass = user.is_active ? 'active' : 'inactive';
                const isSelected = this.selectedUser && this.selectedUser.id === user.id;
                
                html += `
                    <div class="timeline-user ${isSelected ? 'selected' : ''}" 
                         onclick="UserTimelineTree.selectUser(${user.id})"
                         data-user-id="${user.id}">
                        <div class="timeline-user-icon">
                            ${this.getUserIcon(user)}
                        </div>
                        <div class="timeline-user-info">
                            <span class="timeline-user-name">${user.loginid}</span>
                            <span class="timeline-user-time">${user.time}</span>
                        </div>
                        <span class="timeline-user-role ${roleClass}">
                            ${user.role === 'admin' ? '管理員' : '使用者'}
                        </span>
                        <span class="timeline-user-status ${statusClass}"></span>
                    </div>
                `;
            });
            
            return html;
        },

        // 渲染管理員列表
        renderAdminList: function(adminUsers) {
            const container = document.getElementById('adminUsersContainer');
            if (!container) return;

            if (adminUsers.length === 0) {
                container.innerHTML = `
                    <div class="text-muted" style="text-align: center; padding: 40px;">
                        尚無管理員帳號
                    </div>
                `;
                return;
            }

            let html = '<div class="admin-list">';
            
            adminUsers.forEach(user => {
                const statusClass = user.is_active ? 'active' : 'inactive';
                const statusText = user.is_active ? '啟用' : '停用';
                
                html += `
                    <div class="admin-card">
                        <div class="admin-info">
                            <h4>${user.username}</h4>
                            <p>帳號：${user.loginid}</p>
                            <p>Email：${user.email || '未設定'}</p>
                            <p>建立時間：${new Date(user.created_at).toLocaleString('zh-TW')}</p>
                        </div>
                        <div class="admin-status">
                            <span class="status-badge ${statusClass}">${statusText}</span>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            container.innerHTML = html;
        },

        // 切換節點展開/收合
        toggleNode: function(nodeId) {
            const childrenElement = document.getElementById(nodeId);
            const expandIcon = childrenElement.previousElementSibling.querySelector('.timeline-expand-icon');
            
            if (childrenElement.classList.contains('expanded')) {
                childrenElement.classList.remove('expanded');
                expandIcon.classList.remove('expanded');
                this.expandedNodes.delete(nodeId);
            } else {
                childrenElement.classList.add('expanded');
                expandIcon.classList.add('expanded');
                this.expandedNodes.add(nodeId);
            }
        },

        // 選擇使用者
        selectUser: function(userId) {
            // 移除之前的選擇
            document.querySelectorAll('.timeline-user.selected').forEach(el => {
                el.classList.remove('selected');
            });
            
            // 添加新選擇
            const userElement = document.querySelector(`.timeline-user[data-user-id="${userId}"]`);
            if (userElement) {
                userElement.classList.add('selected');
            }
            
            // 找到使用者資料
            this.selectedUser = this.allUsers.find(u => u.id === userId);
            
            // 顯示詳情
            if (window.UserDetailsPanel && this.selectedUser) {
                UserDetailsPanel.showUserDetails(this.selectedUser);
            }
        },

        // 搜尋使用者
        searchUsers: function() {
            const input = document.getElementById('userSearchInput');
            if (!input) return;
            
            this.searchKeyword = input.value.trim().toLowerCase();
            
            if (!this.searchKeyword) {
                this.renderTimelineTree();
                this.hideSearchResults();
                return;
            }
            
            // 篩選符合的使用者（結合搜尋和狀態篩選）
            let filteredUsers = this.allUsers.filter(user => {
                return user.loginid.toLowerCase().includes(this.searchKeyword) ||
                       user.username.toLowerCase().includes(this.searchKeyword) ||
                       (user.email && user.email.toLowerCase().includes(this.searchKeyword));
            });
            
            // 根據篩選狀態進一步過濾搜尋結果
            if (this.filterStatus === 'inactive') {
                filteredUsers = filteredUsers.filter(user => !user.is_active);
            } else if (this.filterStatus === 'active') {
                filteredUsers = filteredUsers.filter(user => user.is_active);
            }
            
            // 重新建立時間軸資料
            const tempUsers = this.allUsers;
            this.allUsers = filteredUsers;
            this.buildTimelineData();
            this.renderTimelineTree();
            this.allUsers = tempUsers;
            
            // 顯示搜尋結果數量
            this.showSearchResults(filteredUsers.length);
            
            // 自動展開所有節點以顯示結果
            if (filteredUsers.length > 0) {
                this.expandAll();
            }
        },

        // 顯示搜尋結果
        showSearchResults: function(count) {
            const resultElement = document.getElementById('searchResultCount');
            if (resultElement) {
                resultElement.style.display = 'inline-flex';
                resultElement.querySelector('strong').textContent = count;
            }
        },

        // 隱藏搜尋結果
        hideSearchResults: function() {
            const resultElement = document.getElementById('searchResultCount');
            if (resultElement) {
                resultElement.style.display = 'none';
            }
        },

        // 展開全部
        expandAll: function() {
            document.querySelectorAll('.timeline-children').forEach(el => {
                el.classList.add('expanded');
                const nodeId = el.id;
                if (nodeId) {
                    this.expandedNodes.add(nodeId);
                }
            });
            
            document.querySelectorAll('.timeline-expand-icon').forEach(el => {
                el.classList.add('expanded');
            });
        },

        // 收合全部
        collapseAll: function() {
            document.querySelectorAll('.timeline-children').forEach(el => {
                el.classList.remove('expanded');
            });
            
            document.querySelectorAll('.timeline-expand-icon').forEach(el => {
                el.classList.remove('expanded');
            });
            
            this.expandedNodes.clear();
        },

        // 重新整理
        refresh: function() {
            this.loadUsers();
        },

        // 統計功能
        getYearUserCount: function(year) {
            let count = 0;
            Object.values(this.timelineData[year]).forEach(monthData => {
                Object.values(monthData).forEach(dayData => {
                    count += dayData.length;
                });
            });
            return count;
        },

        getMonthUserCount: function(year, month) {
            let count = 0;
            Object.values(this.timelineData[year][month]).forEach(dayData => {
                count += dayData.length;
            });
            return count;
        },

        // 更新統計資訊
        updateStatistics: function() {
            const yearCount = Object.keys(this.timelineData).length;
            const yearCountElement = document.getElementById('yearCount');
            if (yearCountElement) {
                yearCountElement.textContent = yearCount;
            }
        },

        // 切換篩選狀態（循環：all → inactive → active → all）
        toggleFilter: function() {
            // 循環切換篩選狀態
            if (this.filterStatus === 'all') {
                this.filterStatus = 'inactive';
            } else if (this.filterStatus === 'inactive') {
                this.filterStatus = 'active';
            } else {
                this.filterStatus = 'all';
            }
            
            // 更新按鈕樣式
            const btn = document.getElementById('filterBtn');
            if (btn) {
                btn.classList.remove('active', 'active-green');
                
                if (this.filterStatus === 'all') {
                    btn.title = '只顯示停用帳號';
                    btn.querySelector('i').className = 'fas fa-users';
                } else if (this.filterStatus === 'inactive') {
                    btn.classList.add('active');
                    btn.title = '只顯示啟用帳號';
                    btn.querySelector('i').className = 'fas fa-user-times';
                } else { // 'active'
                    btn.classList.add('active-green');
                    btn.title = '顯示全部帳號';
                    btn.querySelector('i').className = 'fas fa-user-check';
                }
            }
            
            // 重新建立和渲染樹結構
            this.buildTimelineData();
            this.renderTimelineTree();
            this.updateStatistics();
            
            // 如果有搜尋關鍵字，重新執行搜尋
            if (this.searchKeyword) {
                this.searchUsers();
            }
        },

        // 取得使用者圖示
        getUserIcon: function(user) {
            if (user.role === 'admin') {
                return '<i class="fas fa-user-shield user-icon-admin"></i>';
            } else if (!user.is_active) {
                return '<i class="fas fa-user-slash user-icon-inactive"></i>';
            } else {
                return '<i class="fas fa-user user-icon-active"></i>';
            }
        }
    };

    // 導出模組
    window.UserTimelineTree = UserTimelineTree;
})();