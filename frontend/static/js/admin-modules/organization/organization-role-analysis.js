/**
 * 組織角色分析模組
 * 處理角色的統計分析、依賴關係檢查
 */
const OrganizationRoleAnalysisModule = (function () {
    'use strict';

     // API 端點
     const API_BASE = '/api/organization';

    /**
     * 檢查角色依賴關係
     * @param {number} roleId - 角色 ID
     * @param {number} userCount - 使用者數量（可選，如果已知的話）
     * @param {Object} departmentRolesCache - 部門角色快取（從主模組傳入）
     * @returns {Object} 包含依賴資訊的物件
     */
    function checkRoleDependencies(roleId, userCount = null, departmentRolesCache = {}) {
        let hasUsers = false;
        let actualUserCount = 0;
        let hasChildren = false;
        let childrenCount = 0;
        let childrenNames = [];

        // 如果已知使用者數量，直接使用
        if (userCount !== null) {
            hasUsers = userCount > 0;
            actualUserCount = userCount;
        } else {
            // 從快取中查找角色資訊來取得使用者數量
            for (const [deptId, roles] of Object.entries(departmentRolesCache)) {
                if (Array.isArray(roles)) {
                    const role = roles.find(r => r.id == roleId);
                    if (role) {
                        actualUserCount = role.user_count || 0;
                        hasUsers = actualUserCount > 0;
                        break;
                    }
                }
            }
        }

        // 檢查是否有子角色
        for (const [deptId, roles] of Object.entries(departmentRolesCache)) {
            if (Array.isArray(roles)) {
                const children = roles.filter(role => role.parent_id == roleId);
                if (children.length > 0) {
                    hasChildren = true;
                    childrenCount += children.length;
                    childrenNames.push(...children.map(child => child.name));
                }
            }
        }

        return {
            hasUsers,
            userCount: actualUserCount,
            hasChildren,
            childrenCount,
            childrenNames,
            hasAnyDependency: hasUsers || hasChildren,
            canDelete: !hasUsers && !hasChildren,
            canDisable: !hasUsers && !hasChildren
        };
    }

    /**
     * 取得按鈕禁用原因
     * @param {Object} dependencies - 依賴資訊
     * @returns {string} 禁用原因文字
     */
    function getDisableReason(dependencies) {
        if (!dependencies.hasAnyDependency) {
            return '刪除/停用角色';
        }

        const reasons = [];
        if (dependencies.hasUsers) {
            reasons.push(`${dependencies.userCount}位使用者`);
        }
        if (dependencies.hasChildren) {
            reasons.push(`${dependencies.childrenCount}個子角色`);
        }

        return `有${reasons.join('和')}，無法停用`;
    }

    /**
     * 更新角色統計
     * @param {Array} roles - 角色陣列
     */
    function updateRoleStats(roles) {
        const totalRoles = roles.length;
        const activeRoles = roles.filter(r => r.is_active).length;
        const totalUsers = roles.reduce((sum, r) => sum + (r.user_count || 0), 0);

        document.getElementById('selectedDeptRoleCount').textContent = `${totalRoles} 個角色`;

        const statsContainer = document.getElementById('rolesStats');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <span class="stat-item">
                    <i class="fas fa-check-circle text-success"></i> 
                    啟用 ${activeRoles} 個
                </span>
                <span class="stat-item">
                    <i class="fas fa-users"></i> 
                    共 ${totalUsers} 位使用者
                </span>
            `;
        }
    }

    /**
     * 更新左側樹狀統計區域
     * @param {Array} deptTreeData - 部門樹資料
     * @param {Object} departmentRolesCache - 部門角色快取
     * @param {boolean} showInactiveRoles - 是否顯示停用角色
     */
    function updateTreeStats(deptTreeData, departmentRolesCache, showInactiveRoles) {
        // 計算部門總數
        function countDepartments(deptArray) {
            let count = 0;
            for (const dept of deptArray) {
                count++;
                if (dept.children && dept.children.length > 0) {
                    count += countDepartments(dept.children);
                }
            }
            return count;
        }

        const totalDepts = countDepartments(deptTreeData);

        // 計算角色統計
        let totalRoles = 0;
        let activeRoles = 0;
        let inactiveRoles = 0;

        Object.values(departmentRolesCache).forEach(roles => {
            if (Array.isArray(roles)) {
                totalRoles += roles.length;
                activeRoles += roles.filter(r => r.is_active).length;
                inactiveRoles += roles.filter(r => !r.is_active).length;
            }
        });

        // 更新統計顯示
        const totalDeptCountEl = document.getElementById('rolesTotalDeptCount');
        const totalRoleCountEl = document.getElementById('rolesTotalRoleCount');
        const activeRoleCountEl = document.querySelector('#rolesActiveRoleCount strong');
        const inactiveRoleCountEl = document.querySelector('#rolesInactiveRoleCount strong');

        if (totalDeptCountEl) totalDeptCountEl.textContent = totalDepts;
        if (totalRoleCountEl) totalRoleCountEl.textContent = totalRoles;
        if (activeRoleCountEl) activeRoleCountEl.textContent = activeRoles;
        if (inactiveRoleCountEl) inactiveRoleCountEl.textContent = inactiveRoles;

        // 更新停用角色顯示/隱藏按鈕狀態
        const toggleBtn = document.getElementById('toggleInactiveRolesStatsBtn');
        if (toggleBtn) {
            const icon = toggleBtn.querySelector('i');
            if (showInactiveRoles) {
                toggleBtn.classList.add('active');
                if (icon) {
                    icon.className = 'fas fa-eye';
                }
                toggleBtn.title = '隱藏停用';
            } else {
                toggleBtn.classList.remove('active');
                if (icon) {
                    icon.className = 'fas fa-eye-slash';
                }
                toggleBtn.title = '顯示停用';
            }
        }
    }

    /**
     * 取得角色統計數據
     * @param {Object} departmentRolesCache - 部門角色快取
     * @returns {Object} 包含統計數據的物件
     */
    function getRoleStatistics(departmentRolesCache) {
        let totalRoles = 0;
        let activeRoles = 0;
        let inactiveRoles = 0;
        let totalUsers = 0;

        // 遍歷所有部門的角色緩存
        Object.values(departmentRolesCache).forEach(roles => {
            if (Array.isArray(roles)) {
                totalRoles += roles.length;

                roles.forEach(role => {
                    if (role.is_active) {
                        activeRoles++;
                    } else {
                        inactiveRoles++;
                    }
                    totalUsers += role.user_count || 0;
                });
            }
        });

        return {
            totalRoles,
            activeRoles,
            inactiveRoles,
            totalUsers
        };
    }

    /**
     * 發送角色統計變更通知
     * @param {Object} departmentRolesCache - 部門角色快取
     */
    function notifyRoleStatsChanged(departmentRolesCache) {
        const stats = getRoleStatistics(departmentRolesCache);
        window.dispatchEvent(new CustomEvent('roleStatsChanged', {
            detail: stats
        }));
    }

    // ===== 角色關係分析功能 =====

    // 存儲分析結果和選中的調整項目
    let analysisResult = null;
    let selectedAdjustments = [];

    /**
         * 顯示角色關係分析
         */
    async function showRoleRelationshipAnalysis() {
        try {
            const modal = document.getElementById('roleRelationshipAnalysisModal');
            if (!modal) return;

            // 顯示模態框
            modal.classList.add('show');

            // 重置內容為載入狀態
            const content = document.getElementById('roleAnalysisContent');
            content.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p>正在分析角色關係...</p>
            </div>
        `;

            // 初始化滾動效果
            if (window.CommonUI && window.CommonUI.initScrollFadeEffect) {
                setTimeout(() => CommonUI.initScrollFadeEffect(), 100);
            }

            // 執行分析
            const response = await fetch(`${API_BASE}/role-relationships/analyze`, {
                method: 'GET',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('分析失敗');
            }

            analysisResult = await response.json();
            renderAnalysisResults(analysisResult.data);

        } catch (error) {
            console.error('角色關係分析失敗:', error);
            if (window.Dialog) {
                Dialog.error('角色關係分析失敗: ' + error.message);
            }
            closeRoleRelationshipAnalysisModal();
        }
    }

    /**
     * 渲染分析結果
     */
    function renderAnalysisResults(data) {
        const content = document.getElementById('roleAnalysisContent');
        if (!content) return;

        const { issues, suggestions, analysis_summary, total_relationships, issues_count } = data;

        if (issues_count === 0) {
            content.innerHTML = `
            <div class="analysis-container">
                <div class="analysis-success">
                    <div class="success-icon">
                        <i class="fas fa-check-circle text-success fa-3x"></i>
                    </div>
                    <h3>角色關係良好</h3>
                    <p>經過分析 <strong>${total_relationships}</strong> 個角色關係，未發現需要調整的問題。</p>
                </div>
            </div>
        `;
            document.getElementById('applyAnalysisBtn').classList.add('d-none');
            return;
        }

        // 有問題需要處理
        content.innerHTML = `
        <div class="analysis-container">
            <!-- 分析摘要 -->
            <div class="analysis-section">
                <div class="section-title">
                    <span class="section-number">1</span>
                    <h3>分析摘要</h3>
                </div>
                <div class="summary-cards">
                    <div class="summary-card">
                        <div class="card-icon">
                            <i class="fas fa-sitemap"></i>
                        </div>
                        <div class="card-content">
                            <div class="card-value">${total_relationships}</div>
                            <div class="card-label">總關係數</div>
                        </div>
                    </div>
                    <div class="summary-card danger">
                        <div class="card-icon">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <div class="card-content">
                            <div class="card-value">${issues_count}</div>
                            <div class="card-label">發現問題</div>
                        </div>
                    </div>
                    <div class="summary-card success">
                        <div class="card-icon">
                            <i class="fas fa-lightbulb"></i>
                        </div>
                        <div class="card-content">
                            <div class="card-value">${suggestions.length}</div>
                            <div class="card-label">建議調整</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 問題分類 -->
            <div class="analysis-section">
                <div class="section-title">
                    <span class="section-number">2</span>
                    <h3>問題分類</h3>
                </div>
                <div class="category-cards">
                    ${renderProblemCategories(analysis_summary)}
                </div>
            </div>
            
            <!-- 發現的問題 -->
            <div class="analysis-section">
                <div class="section-title">
                    <span class="section-number">3</span>
                    <h3>發現的問題</h3>
                </div>
                <div class="issues-container scrollable-fade">
                    ${renderIssues(issues)}
                </div>
            </div>
            
            ${suggestions.length > 0 ? `
                <!-- 智能調整建議 -->
                <div class="analysis-section">
                    <div class="section-title">
                        <span class="section-number">4</span>
                        <h3>智能調整建議</h3>
                    </div>
                    <div class="suggestions-container scrollable-fade">
                        ${renderSuggestions(suggestions)}
                    </div>
                    <div class="suggestions-actions">
                        <button class="btn btn-sm btn-secondary" onclick="OrganizationRoleAnalysisModule.selectAllSuggestions()">
                            <i class="fas fa-check-square"></i> 全選
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="OrganizationRoleAnalysisModule.clearSuggestionSelection()">
                            <i class="fas fa-times"></i> 清除選擇
                        </button>
                    </div>
                </div>
            ` : ''}
        </div>
    `;

        // 如果有建議，顯示套用按鈕
        if (suggestions.length > 0) {
            document.getElementById('applyAnalysisBtn').classList.remove('d-none');
        } else {
            document.getElementById('applyAnalysisBtn').classList.add('d-none');
        }
    }

    /**
     * 渲染問題分類
     */
    function renderProblemCategories(summary) {
        const categories = [];

        if (summary.cross_department_unrelated > 0) {
            categories.push({
                type: 'danger',
                icon: 'fa-unlink',
                label: '跨部門無關聯',
                count: summary.cross_department_unrelated
            });
        }

        if (summary.manager_hierarchy_violation > 0) {
            categories.push({
                type: 'danger',
                icon: 'fa-layer-group',
                label: '管理層級異常',
                count: summary.manager_hierarchy_violation
            });
        }

        if (summary.level_mismatch > 0) {
            categories.push({
                type: 'warning',
                icon: 'fa-balance-scale',
                label: '層級不匹配',
                count: summary.level_mismatch
            });
        }

        return categories.map(cat => `
        <div class="category-card ${cat.type}">
            <div class="card-icon">
                <i class="fas ${cat.icon}"></i>
            </div>
            <div class="card-content">
                <div class="card-value">${cat.count}</div>
                <div class="card-label">${cat.label}</div>
            </div>
        </div>
    `).join('');
    }

    /**
     * 渲染問題列表
     */
    function renderIssues(issues) {
        return issues.map(issue => {
            const severityIcon = issue.severity === 'high' ? 'fa-exclamation-circle' : 'fa-exclamation-triangle';
            const severityColor = issue.severity === 'high' ? 'text-danger' : 'text-warning';

            return `
            <div class="issue-card">
                <div class="issue-header">
                    <span class="issue-type">
                        <i class="fas ${severityIcon} ${severityColor}"></i>
                        ${getIssueTypeLabel(issue.type)}
                    </span>
                    <span class="issue-role">${issue.role_name}</span>
                </div>
                <div class="issue-content">
                    <p class="issue-description">${issue.description}</p>
                    <div class="issue-meta">
                        <span class="meta-item">
                            <i class="fas fa-building text-muted"></i>
                            ${issue.department_name}
                        </span>
                        <span class="meta-item">
                            <i class="fas fa-user-tie text-primary"></i>
                            ${issue.parent_role_name || '無父角色'}
                        </span>
                        ${issue.parent_department_name ? `
                            <span class="meta-item">
                                <i class="fas fa-sitemap text-info"></i>
                                ${issue.parent_department_name}
                            </span>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
        }).join('');
    }

    /**
     * 渲染建議列表
     */
    function renderSuggestions(suggestions) {
        return suggestions.map((suggestion, index) => {
            const confidenceBadge = suggestion.confidence === 'high'
                ? '<span class="confidence-badge high"><i class="fas fa-star text-warning"></i> 高信心</span>'
                : '<span class="confidence-badge medium"><i class="fas fa-check text-success"></i> 中信心</span>';

            return `
            <div class="suggestion-card">
                <div class="suggestion-header">
                    <label class="suggestion-select">
                        <input type="checkbox" value="${index}" 
                               onchange="OrganizationRoleAnalysisModule.toggleSuggestionSelection(${index})">
                        <span class="suggestion-role">${suggestion.role_name}</span>
                    </label>
                    ${confidenceBadge}
                </div>
                <div class="suggestion-change">
                    <div class="change-item from">
                        <span class="change-label">目前</span>
                        <span class="change-value">${suggestion.current_parent_name || '無父角色'}</span>
                    </div>
                    <div class="change-arrow">
                        <i class="fas fa-arrow-right text-primary"></i>
                    </div>
                    <div class="change-item to">
                        <span class="change-label">建議</span>
                        <span class="change-value">${suggestion.suggested_parent_name}</span>
                    </div>
                </div>
                <div class="suggestion-reason">
                    <i class="fas fa-info-circle text-info"></i>
                    ${suggestion.reason}
                </div>
            </div>
        `;
        }).join('');
    }

    /**
     * 取得問題類型標籤
     */
    function getIssueTypeLabel(type) {
        const labels = {
            'cross_department_unrelated': '跨部門無關聯',
            'level_mismatch': '層級不匹配',
            'manager_hierarchy_violation': '管理層級異常'
        };
        return labels[type] || type;
    }

    /**
     * 切換建議選擇
     */
    function toggleSuggestionSelection(index) {
        // 使用更精確的選擇器來找到建議區塊內的 checkbox
        const checkbox = document.querySelector(`.suggestion-select input[value="${index}"]`);
        if (!checkbox) {
            console.error('Cannot find checkbox for index:', index);
            return;
        }

        if (!analysisResult || !analysisResult.data || !analysisResult.data.suggestions) {
            console.error('Analysis result not available');
            return;
        }

        const suggestion = analysisResult.data.suggestions[index];
        if (!suggestion) {
            console.error('Suggestion not found at index:', index);
            return;
        }

        if (checkbox.checked) {
            // 檢查是否已存在
            const exists = selectedAdjustments.some(adj => adj.role_id === suggestion.role_id);
            if (!exists) {
                selectedAdjustments.push(suggestion);
            }
        } else {
            selectedAdjustments = selectedAdjustments.filter(adj => adj.role_id !== suggestion.role_id);
        }

        console.log('Selected adjustments count:', selectedAdjustments.length);
        console.log('Selected adjustments:', selectedAdjustments);
    }

    /**
     * 選擇所有建議
     */
    function selectAllSuggestions() {
        if (!analysisResult || !analysisResult.data || !analysisResult.data.suggestions) {
            console.error('No analysis result available');
            return;
        }

        // 使用正確的選擇器
        const checkboxes = document.querySelectorAll('.suggestion-select input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
        });

        selectedAdjustments = [...analysisResult.data.suggestions];
        console.log('All suggestions selected:', selectedAdjustments.length);
    }

    /**
     * 清除所有選擇
     */
    function clearSuggestionSelection() {
        // 使用正確的選擇器
        const checkboxes = document.querySelectorAll('.suggestion-select input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });

        selectedAdjustments = [];
        console.log('All selections cleared');
    }

    /**
     * 關閉角色關係分析模態框
     */
    function closeRoleRelationshipAnalysisModal() {
        const modal = document.getElementById('roleRelationshipAnalysisModal');
        if (modal) {
            modal.classList.remove('show');
        }

        // 清理狀態
        analysisResult = null;
        selectedAdjustments = [];
    }

    /**
     * 顯示批量調整模態框
     */
    async function showBulkAdjustmentModal() {
        console.log('showBulkAdjustmentModal called');
        console.log('selectedAdjustments:', selectedAdjustments);

        if (!selectedAdjustments || selectedAdjustments.length === 0) {
            console.warn('No adjustments selected');
            if (window.Dialog) {
                Dialog.warning('請先選擇要調整的項目');
            } else {
                alert('請先選擇要調整的項目');
            }
            return;
        }

        try {
            // 關閉分析模態框，顯示調整模態框
            closeRoleRelationshipAnalysisModal();

            const modal = document.getElementById('bulkRoleAdjustmentModal');
            if (!modal) {
                console.error('Bulk adjustment modal not found');
                Dialog.error('無法開啟調整模態框');
                return;
            }

            modal.classList.add('show');

            // 重置內容為載入狀態
            const content = document.getElementById('adjustmentPreviewContent');
            content.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p>正在生成調整預覽...</p>
            </div>
        `;

            // 初始化滾動效果
            if (window.CommonUI && window.CommonUI.initScrollFadeEffect) {
                setTimeout(() => CommonUI.initScrollFadeEffect(), 100);
            }

            // 獲取預覽
            const response = await fetch(`${API_BASE}/role-relationships/preview-adjustments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(selectedAdjustments)
            });

            if (!response.ok) {
                throw new Error('預覽失敗');
            }

            const previewResult = await response.json();
            renderAdjustmentPreview(previewResult.data);

        } catch (error) {
            console.error('顯示批量調整預覽失敗:', error);
            if (window.Dialog) {
                Dialog.error('預覽失敗: ' + error.message);
            }
            closeBulkAdjustmentModal();
        }
    }

    /**
     * 渲染調整預覽
     */
    function renderAdjustmentPreview(previewData) {
        const content = document.getElementById('adjustmentPreviewContent');
        if (!content) return;

        content.innerHTML = `
        <div class="bulk-adjustment-container">
            <!-- 警告提示 -->
            <div class="adjustment-warning">
                <div class="warning-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="warning-content">
                    <h4>請確認調整內容</h4>
                    <p>此操作將會調整 <strong>${previewData.total_adjustments}</strong> 個角色關係，影響 <strong>${previewData.total_affected_roles}</strong> 個角色。</p>
                </div>
            </div>
            
            <!-- 調整摘要 -->
            <div class="adjustment-section">
                <div class="section-title">
                    <span class="section-number">1</span>
                    <h3>調整摘要</h3>
                </div>
                <div class="summary-cards">
                    <div class="summary-card">
                        <div class="card-icon">
                            <i class="fas fa-sync-alt"></i>
                        </div>
                        <div class="card-content">
                            <div class="card-value">${previewData.total_adjustments}</div>
                            <div class="card-label">總調整數</div>
                        </div>
                    </div>
                    <div class="summary-card warning">
                        <div class="card-icon">
                            <i class="fas fa-users"></i>
                        </div>
                        <div class="card-content">
                            <div class="card-value">${previewData.total_affected_roles}</div>
                            <div class="card-label">影響角色</div>
                        </div>
                    </div>
                    ${previewData.total_affected_children ? `
                    <div class="summary-card info">
                        <div class="card-icon">
                            <i class="fas fa-sitemap"></i>
                        </div>
                        <div class="card-content">
                            <div class="card-value">${previewData.total_affected_children}</div>
                            <div class="card-label">連動子角色</div>
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
            
            <!-- 詳細調整內容 -->
            <div class="adjustment-section">
                <div class="section-title">
                    <span class="section-number">2</span>
                    <h3>詳細調整內容</h3>
                </div>
                <div class="adjustments-list scrollable-fade">
                    ${renderAdjustmentItems(previewData.preview_results)}
                </div>
            </div>
        </div>
    `;

        // 啟用確認按鈕
        document.getElementById('confirmBulkAdjustmentBtn').disabled = false;

        // 初始化滾動條效果
        if (window.CommonUI && window.CommonUI.initScrollFadeEffect) {
            setTimeout(() => CommonUI.initScrollFadeEffect(), 100);
        }
    }

    /**
     * 渲染調整項目列表
     */
    function renderAdjustmentItems(adjustments) {
        return adjustments.map(adjustment => {
            const levelChange = adjustment.new_level - adjustment.current_level;
            const hasLevelChange = levelChange !== 0;
            const hasParentChange = adjustment.current_parent_id !== adjustment.new_parent_id;
            const hasChildren = adjustment.affected_children_count > 0;

            return `
            <div class="adjustment-item">
                <div class="adjustment-item-header">
                    <div class="item-role">
                        <i class="fas fa-user-tie"></i>
                        <span class="role-name">${adjustment.role_name}</span>
                    </div>
                    <span class="department-tag">
                        <i class="fas fa-building"></i>
                        ${adjustment.department_name}
                    </span>
                </div>
                
                <div class="adjustment-changes">
                    ${hasLevelChange ? `
                    <div class="change-detail">
                        <span class="change-type">層級調整</span>
                        <div class="change-flow">
                            <span class="change-from">${adjustment.current_level}</span>
                            <i class="fas fa-arrow-right"></i>
                            <span class="change-to">${adjustment.new_level}</span>
                            <span class="change-indicator ${levelChange > 0 ? 'increase' : 'decrease'}">
                                ${levelChange > 0 ? '+' : ''}${levelChange}
                            </span>
                        </div>
                    </div>
                    ` : ''}
                    
                    ${hasParentChange ? `
                    <div class="change-detail">
                        <span class="change-type">父角色</span>
                        <div class="change-flow">
                            <span class="change-from">${adjustment.current_parent_name || '無'}</span>
                            <i class="fas fa-arrow-right"></i>
                            <span class="change-to">${adjustment.new_parent_name || '無'}</span>
                        </div>
                    </div>
                    ` : ''}
                    
                    ${hasChildren ? `
                    <div class="children-alert">
                        <i class="fas fa-info-circle"></i>
                        <span>此調整將連動影響 ${adjustment.affected_children_count} 個子角色的層級</span>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
        }).join('');
    }

    /**
     * 關閉批量調整模態框
     */
    function closeBulkAdjustmentModal() {
        const modal = document.getElementById('bulkRoleAdjustmentModal');
        if (modal) {
            modal.classList.remove('show');
        }

        // 重置確認按鈕
        document.getElementById('confirmBulkAdjustmentBtn').disabled = true;
    }

    /**
     * 確認執行批量調整
     */
    async function confirmBulkAdjustment() {
        try {
            const response = await fetch(`${API_BASE}/role-relationships/apply-adjustments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(selectedAdjustments)
            });

            if (!response.ok) {
                throw new Error('執行調整失敗');
            }

            const result = await response.json();

            closeBulkAdjustmentModal();

            if (result.data.failed_count > 0) {
                const failedList = result.data.failed_adjustments.map(f => `• ${f.role_name}: ${f.reason}`).join('\n');
                Dialog.warning(
                    `調整完成！\n\n成功: ${result.data.success_count} 個\n失敗: ${result.data.failed_count} 個\n\n失敗原因:\n${failedList}`
                );
            } else {
                Dialog.success(`調整完成！成功調整了 ${result.data.success_count} 個角色關係`);
            }

            // 重新載入部門樹以反映變更
            if (refreshDeptTree) {
                await refreshDeptTree();
            }

        } catch (error) {
            console.error('執行批量調整失敗:', error);
            if (window.Dialog) {
                Dialog.error('執行調整失敗: ' + error.message);
            }
        }
    }

    // 公開 API
    return {
        checkRoleDependencies,
        getDisableReason,
        updateRoleStats,
        updateTreeStats,
        getRoleStatistics,
        notifyRoleStatsChanged,
        showRoleRelationshipAnalysis,
        closeRoleRelationshipAnalysisModal,
        toggleSuggestionSelection,
        selectAllSuggestions,
        clearSuggestionSelection,
        showBulkAdjustmentModal,
        closeBulkAdjustmentModal,
        confirmBulkAdjustment,
    };
})();

// 確保模組在全域可用
if (!window.OrganizationRoleAnalysisModule) {
    window.OrganizationRoleAnalysisModule = OrganizationRoleAnalysisModule;
}