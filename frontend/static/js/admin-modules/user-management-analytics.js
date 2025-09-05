/**
 * 帳號管理使用分析模組
 * 提供登入統計、註冊趨勢、異常監控等分析功能
 */
(function() {
    'use strict';

    const UserAnalytics = {
        // 資料儲存
        analyticsData: null,
        charts: {},

        // 初始化
        init: function() {
            // 初始化分析資料
            this.loadAnalyticsData();
        },

        // 載入分析資料
        loadAnalyticsData: async function() {
            try {
                const res = await fetch('/api/admin/users');
                if (!res.ok) throw new Error('載入失敗');
                
                const users = await res.json();
                this.analyticsData = this.processAnalyticsData(users);
                
            } catch (error) {
                console.error('載入分析資料失敗:', error);
            }
        },

        // 處理分析資料
        processAnalyticsData: function(users) {
            const data = {
                users: users,
                totalCount: users.length,
                activeCount: users.filter(u => u.is_active).length,
                adminCount: users.filter(u => u.role === 'admin').length,
                registrationByMonth: {},
                registrationByDay: {},
                loginStats: {},
                anomalies: []
            };

            // 按月統計註冊
            users.forEach(user => {
                const date = new Date(user.created_at);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                data.registrationByMonth[monthKey] = (data.registrationByMonth[monthKey] || 0) + 1;

                // 按日統計（最近30天）
                const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                data.registrationByDay[dayKey] = (data.registrationByDay[dayKey] || 0) + 1;
            });

            return data;
        },

        // 載入登入統計
        loadLoginStats: async function() {
            const container = document.getElementById('loginStatsContainer');
            if (!container) return;

            // 顯示載入中狀態
            container.innerHTML = `
                <div class="loading-spinner">
                    <div class="spinner"></div>
                    <p>載入登入統計中...</p>
                </div>
            `;

            try {
                // 獲取登入統計資料
                const response = await fetch('/api/admin/login-stats');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const stats = await response.json();
                this.renderLoginStats(stats);
                
            } catch (error) {
                console.error('載入登入統計失敗:', error);
                this.renderLoginStatsError(error);
            }
        },

        // 渲染登入統計
        renderLoginStats: function(stats) {
            const container = document.getElementById('loginStatsContainer');
            if (!container) return;

            const summary = stats.summary || {};
            
            container.innerHTML = `
                <div class="stats-header">
                    <h3>登入統計分析</h3>
                    <p>最近30天的登入活動統計</p>
                    <div class="stats-update-time">
                        最後更新: ${new Date(stats.generated_at || new Date()).toLocaleString('zh-TW')}
                    </div>
                </div>
                <div class="stats-summary">
                    <div class="stat-card">
                        <div class="stat-value">${summary.today_logins || 0}</div>
                        <div class="stat-label">今日登入</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${summary.week_logins || 0}</div>
                        <div class="stat-label">本週登入</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${summary.month_logins || 0}</div>
                        <div class="stat-label">本月登入</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${summary.active_users || 0}</div>
                        <div class="stat-label">活躍用戶</div>
                    </div>
                </div>
                <div class="chart-section">
                    <div class="chart-header">
                        <h4>登入趨勢圖</h4>
                        <p>過去30天每日登入用戶數</p>
                    </div>
                    <div class="chart-container">
                        <div id="loginTrendChart"></div>
                    </div>
                </div>
                <div class="user-status-section">
                    <div class="status-header">
                        <h4>用戶活動狀態</h4>
                    </div>
                    <div id="userStatusContainer"></div>
                </div>
            `;

            // 渲染趨勢圖和狀態分析
            this.renderLoginChart(stats.daily_trends || []);
            this.renderUserStatus(stats.user_status || {});
        },

        // 渲染登入統計錯誤狀態
        renderLoginStatsError: function(error) {
            const container = document.getElementById('loginStatsContainer');
            if (!container) return;

            container.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle fa-3x text-danger"></i>
                    <h3>載入統計資料失敗</h3>
                    <p class="text-muted">${error.message}</p>
                    <button class="btn btn-primary" onclick="UserAnalytics.loadLoginStats()">
                        <i class="fas fa-refresh"></i>
                        重試
                    </button>
                </div>
            `;
        },

        // 渲染用戶狀態分析
        renderUserStatus: function(userStatus) {
            const container = document.getElementById('userStatusContainer');
            if (!container) return;

            const statusConfig = {
                'active_today': { label: '今日活躍', color: '#28a745', icon: 'fa-check-circle' },
                'active_this_week': { label: '本週活躍', color: '#17a2b8', icon: 'fa-clock' },
                'active_this_month': { label: '本月活躍', color: '#ffc107', icon: 'fa-calendar-alt' },
                'inactive': { label: '久未登入', color: '#dc3545', icon: 'fa-times-circle' },
                'never_logged_in': { label: '未曾登入', color: '#6c757d', icon: 'fa-user-times' }
            };

            let html = '<div class="status-cards">';
            
            Object.keys(statusConfig).forEach(status => {
                const count = userStatus[status] || 0;
                const config = statusConfig[status];
                
                html += `
                    <div class="status-card">
                        <div class="status-icon" style="color: ${config.color}">
                            <i class="fas ${config.icon}"></i>
                        </div>
                        <div class="status-content">
                            <div class="status-count" style="color: ${config.color}">${count}</div>
                            <div class="status-label">${config.label}</div>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            container.innerHTML = html;
        },

        // 載入近期註冊
        loadRecentRegistrations: function() {
            this.updateRecentRegistrations();
        },

        // 更新近期註冊
        updateRecentRegistrations: function() {
            const container = document.getElementById('recentRegistrationsContainer');
            if (!container || !this.analyticsData) return;

            const daysSelect = document.getElementById('recentDaysSelect');
            const days = parseInt(daysSelect ? daysSelect.value : 7);
            
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);

            const recentUsers = this.analyticsData.users.filter(user => 
                new Date(user.created_at) > cutoffDate
            ).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            if (recentUsers.length === 0) {
                container.innerHTML = `
                    <div class="empty-state" style="text-align: center; padding: 40px;">
                        <i class="fas fa-user-plus fa-3x text-muted"></i>
                        <p class="text-muted mt-3">最近 ${days} 天內沒有新註冊的帳號</p>
                    </div>
                `;
                return;
            }

            let html = `
                <div class="recent-list">
                    <table class="data-table" style="width: 100%;">
                        <thead>
                            <tr>
                                <th>帳號</th>
                                <th>姓名</th>
                                <th>Email</th>
                                <th>角色</th>
                                <th>註冊時間</th>
                                <th>狀態</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            recentUsers.forEach(user => {
                const statusClass = user.is_active ? 'badge-success' : 'badge-danger';
                const statusText = user.is_active ? '啟用' : '停用';
                const roleClass = user.role === 'admin' ? 'badge-warning' : 'badge-info';
                const roleText = user.role === 'admin' ? '管理員' : '使用者';

                html += `
                    <tr>
                        <td>${user.loginid}</td>
                        <td>${user.username}</td>
                        <td>${user.email || '未設定'}</td>
                        <td><span class="badge ${roleClass}">${roleText}</span></td>
                        <td>${new Date(user.created_at).toLocaleString('zh-TW')}</td>
                        <td><span class="badge ${statusClass}">${statusText}</span></td>
                    </tr>
                `;
            });

            html += `
                        </tbody>
                    </table>
                </div>
            `;

            container.innerHTML = html;

            // 更新徽章數量
            const badge = document.getElementById('recentRegCount');
            if (badge) {
                badge.textContent = recentUsers.length;
            }
        },

        // 載入異常監控
        loadAnomalyMonitor: async function() {
            const container = document.getElementById('anomalyMonitorContainer');
            if (!container) return;

            // 顯示載入中狀態
            container.innerHTML = `
                <div class="loading-spinner">
                    <div class="spinner"></div>
                    <p>載入異常監控資料中...</p>
                </div>
            `;

            try {
                // 調用真實API獲取異常監控資料
                const response = await fetch('/api/admin/anomaly-monitor');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                this.renderAnomalyMonitor(data);
                
            } catch (error) {
                console.error('載入異常監控資料失敗:', error);
                this.renderAnomalyMonitorError(error);
            }
        },

        // 渲染異常監控數據
        renderAnomalyMonitor: function(data) {
            const container = document.getElementById('anomalyMonitorContainer');
            if (!container) return;

            const anomalies = data.anomalies || [];
            const summary = data.summary || { danger: 0, warning: 0, info: 0 };

            if (anomalies.length === 0) {
                container.innerHTML = `
                    <div class="empty-state" style="text-align: center; padding: 40px;">
                        <i class="fas fa-shield-alt fa-3x text-success"></i>
                        <p class="text-muted mt-3">系統運行正常，沒有偵測到異常活動</p>
                        <div class="stats-update-time">
                            最後更新: ${new Date(data.generated_at || new Date()).toLocaleString('zh-TW')}
                        </div>
                    </div>
                `;
                // 清空徽章數量
                const badge = document.getElementById('anomalyCount');
                if (badge) {
                    badge.textContent = '0';
                }
                return;
            }

            let html = `
                <div class="anomaly-list">
                    <div class="anomaly-header">
                        <h3>安全異常監控</h3>
                        <p>偵測到的系統安全異常活動</p>
                        <div class="stats-update-time">
                            最後更新: ${new Date(data.generated_at || new Date()).toLocaleString('zh-TW')}
                        </div>
                    </div>
                    <div class="anomaly-summary">
                        <div class="anomaly-stat danger">
                            <span class="count">${summary.danger}</span>
                            <span class="label">嚴重異常</span>
                        </div>
                        <div class="anomaly-stat warning">
                            <span class="count">${summary.warning}</span>
                            <span class="label">警告異常</span>
                        </div>
                        <div class="anomaly-stat info">
                            <span class="count">${summary.info}</span>
                            <span class="label">資訊異常</span>
                        </div>
                    </div>
                    <div class="anomaly-cards">
            `;

            anomalies.forEach(anomaly => {
                const severity = anomaly.severity || 'info';
                const icon = this.getAnomalyIcon(anomaly.type);
                const title = this.getAnomalyTitle(anomaly.type);

                html += `
                    <div class="anomaly-card severity-${severity}">
                        <div class="anomaly-icon">
                            <i class="fas ${icon}"></i>
                        </div>
                        <div class="anomaly-content">
                            <h4>${title}</h4>
                            <p>${anomaly.description}</p>
                            <small class="anomaly-time">
                                <i class="fas fa-clock"></i>
                                ${anomaly.time}
                            </small>
                            ${anomaly.user ? `<small class="anomaly-user">
                                <i class="fas fa-user"></i>
                                ${anomaly.user}${anomaly.username ? ` (${anomaly.username})` : ''}
                            </small>` : ''}
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;

            container.innerHTML = html;

            // 更新徽章數量
            const badge = document.getElementById('anomalyCount');
            if (badge) {
                badge.textContent = data.total_count || anomalies.length;
            }
        },

        // 獲取異常圖標
        getAnomalyIcon: function(type) {
            const iconMap = {
                'unusual_time_login': 'fa-clock',
                'rapid_registration': 'fa-user-plus',
                'dormant_account_active': 'fa-user-clock',
                'high_conversation_frequency': 'fa-comments',
                'admin_elevation': 'fa-user-shield',
                'account_reactivation': 'fa-user-check'
            };
            return iconMap[type] || 'fa-exclamation-triangle';
        },

        // 獲取異常標題
        getAnomalyTitle: function(type) {
            const titleMap = {
                'unusual_time_login': '異常時間登入',
                'rapid_registration': '快速註冊',
                'dormant_account_active': '休眠帳號活動',
                'high_conversation_frequency': '異常對話頻率',
                'admin_elevation': '管理員權限提升',
                'account_reactivation': '帳號重新啟用'
            };
            return titleMap[type] || '未知異常';
        },

        // 渲染異常監控錯誤狀態
        renderAnomalyMonitorError: function(error) {
            const container = document.getElementById('anomalyMonitorContainer');
            if (!container) return;

            container.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle fa-3x text-danger"></i>
                    <h3>載入異常監控資料失敗</h3>
                    <p class="text-muted">${error.message}</p>
                    <button class="btn btn-primary" onclick="UserAnalytics.loadAnomalyMonitor()">
                        <i class="fas fa-refresh"></i>
                        重試
                    </button>
                </div>
            `;
        },

        // 載入註冊趨勢
        loadRegistrationTrends: function() {
            const container = document.getElementById('registrationTrendsContainer');
            if (!container || !this.analyticsData) return;

            // 準備圖表資料
            const months = Object.keys(this.analyticsData.registrationByMonth).sort();
            const lastSixMonths = months.slice(-6);

            container.innerHTML = `
                <div class="trends-header">
                    <h3>註冊趨勢分析</h3>
                    <p>過去6個月的註冊趨勢</p>
                </div>
                <div class="trends-summary">
                    <div class="trend-stat">
                        <span class="trend-label">本月新增</span>
                        <span class="trend-value">${this.getCurrentMonthRegistrations()}</span>
                    </div>
                    <div class="trend-stat">
                        <span class="trend-label">月平均</span>
                        <span class="trend-value">${this.getMonthlyAverage()}</span>
                    </div>
                    <div class="trend-stat">
                        <span class="trend-label">成長率</span>
                        <span class="trend-value">${this.getGrowthRate()}%</span>
                    </div>
                </div>
                <div class="chart-container">
                    <canvas id="trendsChart"></canvas>
                </div>
                <div class="trends-table">
                    ${this.renderTrendsTable(lastSixMonths)}
                </div>
            `;

            // 這裡可以整合圖表庫來顯示趨勢圖
            this.renderTrendsChart(lastSixMonths);
        },

        // 渲染趨勢表格
        renderTrendsTable: function(months) {
            let html = `
                <table class="data-table" style="width: 100%; margin-top: 20px;">
                    <thead>
                        <tr>
                            <th>月份</th>
                            <th>註冊數</th>
                            <th>較上月</th>
                            <th>趨勢</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            months.forEach((month, index) => {
                const count = this.analyticsData.registrationByMonth[month] || 0;
                const prevMonth = index > 0 ? months[index - 1] : null;
                const prevCount = prevMonth ? (this.analyticsData.registrationByMonth[prevMonth] || 0) : 0;
                const diff = count - prevCount;
                const trend = diff > 0 ? 'up' : (diff < 0 ? 'down' : 'flat');
                const trendIcon = trend === 'up' ? 'fa-arrow-up text-success' : 
                                 (trend === 'down' ? 'fa-arrow-down text-danger' : 'fa-minus text-muted');

                html += `
                    <tr>
                        <td>${month}</td>
                        <td>${count}</td>
                        <td>${diff > 0 ? '+' : ''}${diff}</td>
                        <td><i class="fas ${trendIcon}"></i></td>
                    </tr>
                `;
            });

            html += `
                    </tbody>
                </table>
            `;

            return html;
        },

        // 取得當月註冊數
        getCurrentMonthRegistrations: function() {
            const now = new Date();
            const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            return this.analyticsData.registrationByMonth[currentMonth] || 0;
        },

        // 取得月平均
        getMonthlyAverage: function() {
            const months = Object.values(this.analyticsData.registrationByMonth);
            if (months.length === 0) return 0;
            const sum = months.reduce((a, b) => a + b, 0);
            return Math.round(sum / months.length);
        },

        // 取得成長率
        getGrowthRate: function() {
            const months = Object.keys(this.analyticsData.registrationByMonth).sort();
            if (months.length < 2) return 0;
            
            const lastMonth = this.analyticsData.registrationByMonth[months[months.length - 1]] || 0;
            const prevMonth = this.analyticsData.registrationByMonth[months[months.length - 2]] || 0;
            
            if (prevMonth === 0) return 100;
            return Math.round(((lastMonth - prevMonth) / prevMonth) * 100);
        },

        // 渲染登入圖表
        renderLoginChart: function(dailyTrends) {
            const container = document.getElementById('loginTrendChart');
            if (!container) return;

            if (!dailyTrends || dailyTrends.length === 0) {
                container.innerHTML = `
                    <div class="empty-chart">
                        <i class="fas fa-chart-line fa-3x text-muted"></i>
                        <p class="text-muted">暫無登入資料</p>
                    </div>
                `;
                return;
            }

            // 準備過去30天的完整日期範圍
            const today = new Date();
            const thirtyDaysAgo = new Date(today);
            thirtyDaysAgo.setDate(today.getDate() - 30);

            const chartData = [];
            for (let d = new Date(thirtyDaysAgo); d <= today; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().split('T')[0];
                const trend = dailyTrends.find(t => t.date === dateStr);
                chartData.push({
                    date: dateStr,
                    count: trend ? trend.count : 0,
                    displayDate: d.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })
                });
            }

            // 計算最大值用於標準化
            const maxCount = Math.max(...chartData.map(d => d.count), 1);

            // 生成圖表HTML
            let chartHTML = '<div class="simple-chart">';
            
            // 圖表區域
            chartHTML += '<div class="chart-area">';
            
            // Y軸標籤
            chartHTML += '<div class="y-axis">';
            for (let i = maxCount; i >= 0; i -= Math.ceil(maxCount / 4)) {
                chartHTML += `<div class="y-label">${i}</div>`;
            }
            chartHTML += '</div>';
            
            // 圖表柱狀區
            chartHTML += '<div class="chart-bars">';
            chartData.forEach((data, index) => {
                const height = maxCount > 0 ? (data.count / maxCount) * 100 : 0;
                const isWeekend = new Date(data.date).getDay() % 6 === 0;
                
                chartHTML += `
                    <div class="bar-container" title="${data.displayDate}: ${data.count}次登入">
                        <div class="bar ${isWeekend ? 'weekend' : ''}" 
                             style="height: ${height}%"
                             data-count="${data.count}">
                        </div>
                        ${index % 5 === 0 ? `<div class="x-label">${data.displayDate}</div>` : ''}
                    </div>
                `;
            });
            chartHTML += '</div>';
            
            chartHTML += '</div>';
            chartHTML += '</div>';

            // 圖表說明
            chartHTML += `
                <div class="chart-legend">
                    <div class="legend-item">
                        <div class="legend-color weekday"></div>
                        <span>平日</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color weekend"></div>
                        <span>週末</span>
                    </div>
                </div>
            `;

            container.innerHTML = chartHTML;

            // 添加動畫效果
            setTimeout(() => {
                const bars = container.querySelectorAll('.bar');
                bars.forEach((bar, index) => {
                    setTimeout(() => {
                        bar.classList.add('animated');
                    }, index * 20);
                });
            }, 100);
        },

        // 渲染趨勢圖表（佔位符）
        renderTrendsChart: function(months) {
            console.log('渲染趨勢圖表（需整合圖表庫）');
        }
    };


    // 導出模組
    window.UserAnalytics = UserAnalytics;
})();