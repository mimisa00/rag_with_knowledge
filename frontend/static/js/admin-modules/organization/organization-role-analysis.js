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
                    const role = roles.find(r => r.id === roleId);
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
                const children = roles.filter(role => role.parent_id === roleId);
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
    let selectedRoleAssignments = [];
    let currentAdjustmentsToApply = [];
    let includeInactiveRoles = true;  // 預設包含停用角色，提供完整分析

    /**
         * 顯示角色關係分析
         */
    async function showRoleRelationshipAnalysis(forceIncludeInactive = null) {
        try {
            const modal = document.getElementById('roleRelationshipAnalysisModal');
            if (!modal) return;

            // 如果有強制設定，使用強制設定，否則使用當前設定
            const includeInactive = forceIncludeInactive !== null ? 
                                   forceIncludeInactive : includeInactiveRoles;

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

            // 構建查詢參數
            const params = new URLSearchParams();
            if (includeInactive) {
                params.append('include_inactive', 'true');
            }

            // 執行分析
            const url = params.toString() ? 
                       `${API_BASE}/role-relationships/analyze?${params}` : 
                       `${API_BASE}/role-relationships/analyze`;
            
            const response = await fetch(url, {
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

        const { issues, suggestions, role_assignment_suggestions = [], analysis_summary, total_relationships, issues_count } = data;

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
        const hasPathIssues = data.path_check && data.path_check.inconsistent_count > 0;
        
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
                    <div class="summary-card info">
                        <div class="card-icon">
                            <i class="fas fa-plus-circle"></i>
                        </div>
                        <div class="card-content">
                            <div class="card-value">${role_assignment_suggestions.length}</div>
                            <div class="card-label">建議新增</div>
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
                ${hasPathIssues ? `
                    <div class="path-fix-actions">
                        <button class="btn btn-warning" onclick="OrganizationRoleAnalysisModule.fixDepartmentPaths()">
                            <i class="fas fa-wrench"></i> 立即修復部門路徑
                        </button>
                        <small class="text-muted">此操作將修復 ${data.path_check.inconsistent_count} 個部門的路徑不一致問題</small>
                    </div>
                ` : ''}
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
                </div>
            ` : ''}
            
            ${role_assignment_suggestions.length > 0 ? `
                <!-- 角色分配建議 -->
                <div class="analysis-section">
                    <div class="section-title">
                        <span class="section-number">${suggestions.length > 0 ? '5' : '4'}</span>
                        <h3>角色分配建議</h3>
                        <div class="section-subtitle">為沒有角色的部門建議合適的角色配置</div>
                    </div>
                    <div class="role-assignment-container scrollable-fade">
                        ${renderRoleAssignmentSuggestions(role_assignment_suggestions)}
                    </div>
                </div>
            ` : ''}
            
            ${suggestions.length > 0 || role_assignment_suggestions.length > 0 ? `
                <!-- 統一選擇控制區 -->
                <div class="analysis-section">
                    <button class="btn btn-sm btn-outline-secondary" onclick="OrganizationRoleAnalysisModule.selectAllRecommendations()">
                        <i class="fas fa-check-square"></i> 全選
                    </button>
                    <button class="btn btn-sm btn-outline-secondary" onclick="OrganizationRoleAnalysisModule.clearAllSelections()">
                        <i class="fas fa-times"></i> 清除
                    </button>
                </div>
            ` : ''}
        </div>
    `;

        // 如果有建議，顯示套用按鈕
        if (suggestions.length > 0 || role_assignment_suggestions.length > 0) {
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

        if (summary.department_path_inconsistent > 0) {
            categories.push({
                type: 'danger',
                icon: 'fa-folder-open',
                label: '部門路徑不一致',
                count: summary.department_path_inconsistent
            });
        }

        if (summary.departments_without_roles > 0) {
            categories.push({
                type: 'warning',
                icon: 'fa-building',
                label: '部門無角色',
                count: summary.departments_without_roles
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

            // 部門路徑問題的特殊處理
            if (issue.type === 'department_path_inconsistent') {
                return `
                <div class="issue-card">
                    <div class="issue-header">
                        <span class="issue-type">
                            <i class="fas ${severityIcon} ${severityColor}"></i>
                            ${getIssueTypeLabel(issue.type)}
                        </span>
                        <span class="issue-role">${issue.department_name}</span>
                    </div>
                    <div class="issue-content">
                        <p class="issue-description">${issue.description}</p>
                        <div class="issue-meta">
                            <span class="meta-item">
                                <i class="fas fa-folder text-muted"></i>
                                實際路徑: ${issue.current_path}
                            </span>
                            <span class="meta-item">
                                <i class="fas fa-folder-open text-success"></i>
                                正確路徑: ${issue.expected_path}
                            </span>
                        </div>
                    </div>
                </div>
                `;
            }

            // 部門無角色問題的特殊處理
            if (issue.type === 'departments_without_roles') {
                return `
                <div class="issue-card">
                    <div class="issue-header">
                        <span class="issue-type">
                            <i class="fas ${severityIcon} ${severityColor}"></i>
                            ${getIssueTypeLabel(issue.type)}
                        </span>
                        <span class="issue-role">${issue.department_name}</span>
                    </div>
                    <div class="issue-content">
                        <p class="issue-description">${issue.description}</p>
                        <div class="issue-meta">
                            <span class="meta-item">
                                <i class="fas fa-sitemap text-muted"></i>
                                部門路徑: ${issue.department_path || '無'}
                            </span>
                            <span class="meta-item">
                                <i class="fas fa-users-cog text-warning"></i>
                                角色數量: ${issue.role_count || 0}
                            </span>
                            ${issue.created_date ? `
                                <span class="meta-item">
                                    <i class="fas fa-calendar-plus text-info"></i>
                                    建立時間: ${issue.created_date}
                                </span>
                            ` : ''}
                        </div>
                    </div>
                </div>
                `;
            }

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
                            <i class="fas fa-user-tie text-manager"></i>
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
     * 渲染角色分配建議
     */
    function renderRoleAssignmentSuggestions(roleAssignmentSuggestions) {
        return roleAssignmentSuggestions.map((suggestion, index) => {
            const confidenceBadge = suggestion.confidence === 'high'
                ? '<span class="confidence-badge high"><i class="fas fa-star text-warning"></i> 高信心</span>'
                : suggestion.confidence === 'medium' 
                ? '<span class="confidence-badge medium"><i class="fas fa-check text-success"></i> 中信心</span>'
                : '<span class="confidence-badge low"><i class="fas fa-exclamation-triangle text-warning"></i> 低信心</span>';
                
            const rolesHtml = suggestion.recommended_roles.map(role => `
                <div class="recommended-role">
                    <div class="role-info">
                        <div class="role-name">
                            <i class="fas fa-user-tag text-primary"></i>
                            <strong>${role.suggested_role_name}</strong>
                        </div>
                        <div class="role-details">
                            <span class="role-template">${role.template_name}</span>
                            <span class="role-type badge badge-secondary">${role.template_type}</span>
                        </div>
                        <div class="role-hierarchy">
                            <i class="fas fa-arrow-right text-muted"></i>
                            <span class="parent-info">
                                父角色: ${role.suggested_parent_role_name || '無'}
                            </span>
                        </div>
                    </div>
                </div>
            `).join('');
            
            return `
            <div class="role-assignment-suggestion" data-index="${index}">
                <div class="suggestion-header">
                    <label class="suggestion-select">
                        <input type="checkbox" value="${index}" 
                               onchange="OrganizationRoleAnalysisModule.toggleRoleAssignmentSelection(${index})">
                        <span class="suggestion-department">
                            <i class="fas fa-building text-info"></i>
                            ${suggestion.department_name}
                        </span>
                    </label>
                    ${confidenceBadge}
                </div>
                <div class="department-path">
                    <i class="fas fa-sitemap text-muted"></i>
                    ${suggestion.department_path}
                </div>
                ${suggestion.recommended_roles.length > 0 ? `
                    <div class="recommended-roles">
                        <div class="roles-count">
                            <i class="fas fa-plus-circle text-success"></i>
                            建議新增 ${suggestion.recommended_roles.length} 個角色
                        </div>
                        <div class="roles-list">
                            ${rolesHtml}
                        </div>
                    </div>
                ` : `
                    <div class="no-roles">
                        <i class="fas fa-exclamation-circle text-warning"></i>
                        ${suggestion.recommendation_reason}
                    </div>
                `}
                <div class="suggestion-reason">
                    <i class="fas fa-lightbulb text-info"></i>
                    ${suggestion.recommendation_reason}
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
            'manager_hierarchy_violation': '管理層級異常',
            'department_path_inconsistent': '部門路徑不一致',
            'departments_without_roles': '部門無角色'
        };
        return labels[type] || type;
    }

    /**
     * 切換建議選擇
     */
    function toggleSuggestionSelection(index) {
        console.log('toggleSuggestionSelection called with index:', index);
        // 使用更精確的選擇器來找到建議區塊內的 checkbox
        const checkbox = document.querySelector(`.suggestion-select input[value="${index}"]`);
        console.log('Found checkbox:', checkbox);
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

        console.log('Checkbox checked status:', checkbox.checked);
        console.log('Current selectedAdjustments before update:', selectedAdjustments);
        
        if (checkbox.checked) {
            // 檢查是否已存在
            const exists = selectedAdjustments.some(adj => adj.role_id === suggestion.role_id);
            console.log('Suggestion already exists:', exists);
            if (!exists) {
                selectedAdjustments.push(suggestion);
                console.log('Added suggestion:', suggestion);
            }
        } else {
            selectedAdjustments = selectedAdjustments.filter(adj => adj.role_id !== suggestion.role_id);
            console.log('Removed suggestion with role_id:', suggestion.role_id);
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
     * 切換角色分配建議選擇
     */
    function toggleRoleAssignmentSelection(index) {
        console.log('toggleRoleAssignmentSelection called with index:', index);
        const checkbox = document.querySelector(`input[type="checkbox"][value="${index}"][onchange*="toggleRoleAssignmentSelection"]`);
        
        if (!checkbox) {
            console.error('Checkbox not found for index:', index);
            return;
        }

        if (!selectedRoleAssignments) {
            selectedRoleAssignments = [];
        }

        if (checkbox.checked) {
            if (!selectedRoleAssignments.includes(index)) {
                selectedRoleAssignments.push(index);
            }
        } else {
            selectedRoleAssignments = selectedRoleAssignments.filter(i => i !== index);
        }

        console.log('Selected role assignments:', selectedRoleAssignments);
    }

    /**
     * 選擇所有角色分配建議
     */
    function selectAllRoleAssignments() {
        if (!analysisResult || !analysisResult.data || !analysisResult.data.role_assignment_suggestions) {
            console.error('No role assignment suggestions available');
            return;
        }

        const checkboxes = document.querySelectorAll('input[type="checkbox"][onchange*="toggleRoleAssignmentSelection"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
        });

        selectedRoleAssignments = analysisResult.data.role_assignment_suggestions.map((_, index) => index);
        console.log('All role assignments selected:', selectedRoleAssignments);
    }

    /**
     * 清除所有角色分配建議選擇
     */
    function clearRoleAssignmentSelection() {
        const checkboxes = document.querySelectorAll('input[type="checkbox"][onchange*="toggleRoleAssignmentSelection"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });

        selectedRoleAssignments = [];
        console.log('All role assignment selections cleared');
    }

    /**
     * 統一選擇所有建議（智能調整建議 + 角色分配建議）
     */
    function selectAllRecommendations() {
        console.log('Selecting all recommendations (adjustments + role assignments)');
        
        // 選擇所有智能調整建議
        if (analysisResult && analysisResult.data && analysisResult.data.suggestions && analysisResult.data.suggestions.length > 0) {
            selectAllSuggestions();
        }
        
        // 選擇所有角色分配建議
        if (analysisResult && analysisResult.data && analysisResult.data.role_assignment_suggestions && analysisResult.data.role_assignment_suggestions.length > 0) {
            selectAllRoleAssignments();
        }
        
        console.log('All recommendations selected');
    }

    /**
     * 統一清除所有選擇（智能調整建議 + 角色分配建議）
     */
    function clearAllSelections() {
        console.log('Clearing all selections (adjustments + role assignments)');
        
        // 清除智能調整建議選擇
        if (analysisResult && analysisResult.data && analysisResult.data.suggestions && analysisResult.data.suggestions.length > 0) {
            clearSuggestionSelection();
        }
        
        // 清除角色分配建議選擇
        if (analysisResult && analysisResult.data && analysisResult.data.role_assignment_suggestions && analysisResult.data.role_assignment_suggestions.length > 0) {
            clearRoleAssignmentSelection();
        }
        
        console.log('All selections cleared');
    }

    /**
     * 套用角色分配建議
     */
    async function applyRoleAssignmentSuggestions() {
        // 獲取套用按鈕參考
        const applyBtn = document.getElementById('applyAnalysisBtn');
        
        try {
            console.log('applyRoleAssignmentSuggestions called');
            console.log('selectedRoleAssignments:', selectedRoleAssignments);

            if (!analysisResult || !analysisResult.data || !analysisResult.data.role_assignment_suggestions) {
                console.error('No role assignment suggestions data available');
                if (window.Dialog) {
                    Dialog.error('沒有角色分配建議資料');
                } else {
                    alert('沒有角色分配建議資料');
                }
                return;
            }

            // 根據選擇的索引獲取對應的建議資料
            const selectedSuggestions = selectedRoleAssignments.map(index => {
                const suggestion = analysisResult.data.role_assignment_suggestions[index];
                if (!suggestion) {
                    console.warn(`No suggestion found for index ${index}`);
                    return null;
                }
                return suggestion;
            }).filter(s => s !== null);

            if (selectedSuggestions.length === 0) {
                console.warn('No valid selected role assignment suggestions');
                if (window.Dialog) {
                    Dialog.warning('沒有有效的角色分配建議');
                } else {
                    alert('沒有有效的角色分配建議');
                }
                return;
            }

            console.log('Selected suggestions to apply:', selectedSuggestions);

            // 禁用套用按鈕並顯示載入狀態
            if (applyBtn) {
                applyBtn.disabled = true;
                applyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在套用角色分配建議...';
            }
            
            if (window.CommonUI && window.CommonUI.showSpinner) {
                CommonUI.showSpinner('正在套用角色分配建議...');
            }

            // 呼叫後端 API
            const response = await fetch(`${API_BASE}/role-relationships/apply-role-assignments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    suggestions: selectedSuggestions
                })
            });

            // 隱藏載入狀態並恢復按鈕
            if (window.CommonUI && window.CommonUI.hideSpinner) {
                CommonUI.hideSpinner();
            }
            
            if (applyBtn) {
                applyBtn.disabled = false;
                applyBtn.innerHTML = '<i class="fas fa-magic"></i> 套用建議調整';
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `HTTP ${response.status}`);
            }

            const result = await response.json();
            console.log('Apply role assignments result:', result);

            if (result.success) {
                const { data } = result;
                const message = `成功套用角色分配建議！\n` +
                    `處理了 ${data.total_suggestions} 個部門建議\n` +
                    `成功創建 ${data.success_count} 個角色\n` +
                    (data.failed_count > 0 ? `失敗 ${data.failed_count} 個角色` : '');

                if (window.Dialog) {
                    Dialog.success(message);
                } else {
                    alert(message);
                }

                // 清除選擇並重新載入分析結果
                selectedRoleAssignments = [];
                
                // 重新分析以更新結果
                await showRoleRelationshipAnalysis();
            } else {
                throw new Error('套用角色分配建議失敗');
            }

        } catch (error) {
            console.error('Error applying role assignment suggestions:', error);
            
            if (window.CommonUI && window.CommonUI.hideSpinner) {
                CommonUI.hideSpinner();
            }
            
            // 恢復按鈕狀態
            if (applyBtn) {
                applyBtn.disabled = false;
                applyBtn.innerHTML = '<i class="fas fa-magic"></i> 套用建議調整';
            }
            
            if (window.Dialog) {
                Dialog.error('套用角色分配建議失敗: ' + error.message);
            } else {
                alert('套用角色分配建議失敗: ' + error.message);
            }
        }
    }

    /**
     * 關閉角色關係分析模態框
     */
    function closeRoleRelationshipAnalysisModal() {
        const modal = document.getElementById('roleRelationshipAnalysisModal');
        if (modal) {
            modal.classList.remove('show');
        }

        // 清理狀態（但不清空 currentAdjustmentsToApply，因為可能正在用於批量調整）
        analysisResult = null;
        selectedAdjustments = [];
    }

    /**
     * 顯示批量調整模態框
     */
    async function showBulkAdjustmentModal() {
        console.log('showBulkAdjustmentModal called');
        console.log('selectedAdjustments:', selectedAdjustments);
        console.log('selectedRoleAssignments:', selectedRoleAssignments);

        // 檢查是否有任何類型的建議被選擇
        const hasAdjustments = selectedAdjustments && selectedAdjustments.length > 0;
        const hasRoleAssignments = selectedRoleAssignments && selectedRoleAssignments.length > 0;
        
        if (!hasAdjustments && !hasRoleAssignments) {
            console.warn('No suggestions selected');
            if (window.Dialog) {
                Dialog.warning('請先選擇要套用的建議項目');
            } else {
                alert('請先選擇要套用的建議項目');
            }
            return;
        }

        // 如果只有角色分配建議，直接處理角色分配
        if (!hasAdjustments && hasRoleAssignments) {
            console.log('Only role assignment suggestions selected, processing directly');
            await applyRoleAssignmentSuggestions();
            return;
        }

        // 如果有智能調整建議（可能同時有角色分配建議），使用現有的批量調整流程
        if (hasAdjustments) {
            console.log('Smart adjustment suggestions found, proceeding with bulk adjustment modal');
            
            // 如果同時有角色分配建議，提醒用戶
            if (hasRoleAssignments) {
                console.log('Both adjustment and role assignment suggestions selected');
                if (window.Dialog) {
                    Dialog.info('注意：您同時選擇了智能調整建議和角色分配建議。\n系統將先處理智能調整建議，角色分配建議請稍後單獨處理。');
                }
            }
            
            // 繼續原有的批量調整流程...
        }

        try {
            // 保存選擇的調整項目到全域變數，避免關閉模態框時被清空
            console.log('Selected adjustments before copy:', selectedAdjustments);
            currentAdjustmentsToApply = [...selectedAdjustments];
            console.log('Current adjustments to apply:', currentAdjustmentsToApply);
            
            // 關閉分析模態框，顯示調整模態框
            closeRoleRelationshipAnalysisModal();

            const modal = document.getElementById('bulkRoleAdjustmentModal');
            if (!modal) {
                console.error('Bulk adjustment modal not found');
                if (window.Dialog) {
                    Dialog.error('無法開啟調整模態框');
                } else {
                    alert('無法開啟調整模態框');
                }
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

            // 轉換為後端期望的格式
            console.log('Starting data conversion...');
            let adjustmentsData = [];
            try {
                console.log('currentAdjustmentsToApply length:', currentAdjustmentsToApply.length);
                adjustmentsData = currentAdjustmentsToApply.map((adjustment, index) => {
                    console.log(`Processing adjustment ${index}:`, adjustment);
                    console.log('adjustment.role_id:', adjustment.role_id, typeof adjustment.role_id);
                    console.log('adjustment.suggested_parent_id:', adjustment.suggested_parent_id, typeof adjustment.suggested_parent_id);
                    const result = {
                        role_id: adjustment.role_id,
                        suggested_parent_id: adjustment.suggested_parent_id
                    };
                    console.log('Converted to:', result);
                    return result;
                });
                console.log('After map, before filter:', adjustmentsData);
                
                adjustmentsData = adjustmentsData.filter((adj, index) => {
                    const isValid = adj.role_id !== undefined && adj.role_id !== null;
                    console.log(`Filter check for item ${index}:`, adj, 'Valid:', isValid);
                    return isValid;
                });
                console.log('After filter:', adjustmentsData);
            } catch (error) {
                console.error('Error in data conversion:', error);
                adjustmentsData = [];
            }
            
            // 獲取預覽
            console.log('Sending adjustments to preview:', adjustmentsData);
            const response = await fetch(`${API_BASE}/role-relationships/preview-adjustments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(adjustmentsData)
            });

            if (!response.ok) {
                throw new Error('預覽失敗');
            }

            const previewResult = await response.json();
            console.log('Preview result from backend:', previewResult);
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
        console.log('Rendering preview data:', previewData);
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
                    <p>此操作將會調整 <strong>${previewData.total_adjustments}</strong> 個角色，總共影響 <strong>${previewData.total_affected_roles}</strong> 個角色（含連動子角色）。</p>
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
                            <div class="card-label">直接調整角色</div>
                        </div>
                    </div>
                    <div class="summary-card warning">
                        <div class="card-icon">
                            <i class="fas fa-users"></i>
                        </div>
                        <div class="card-content">
                            <div class="card-value">${previewData.total_affected_roles}</div>
                            <div class="card-label">總受影響角色</div>
                        </div>
                    </div>
                    <div class="summary-card info">
                        <div class="card-icon">
                            <i class="fas fa-sitemap"></i>
                        </div>
                        <div class="card-content">
                            <div class="card-value">${previewData.total_affected_children || 0}</div>
                            <div class="card-label">連動子角色</div>
                        </div>
                    </div>
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
        console.log('Rendering adjustment items:', adjustments);
        if (!adjustments || adjustments.length === 0) {
            return '<div class="no-adjustments">沒有調整項目</div>';
        }
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
        
        // 清理調整項目
        currentAdjustmentsToApply = [];
    }

    /**
     * 修復部門路徑
     */
    function fixDepartmentPaths() {
        try {
            if (!analysisResult || !analysisResult.data || !analysisResult.data.path_check) {
                Dialog.error('沒有找到路徑問題資訊');
                return;
            }

            const pathIssues = analysisResult.data.path_check.inconsistent_paths;
            if (!pathIssues || pathIssues.length === 0) {
                Dialog.info('沒有需要修復的路徑問題');
                return;
            }

            // 格式化確認訊息為 HTML
            const confirmMessage = `
                <div style="text-align: left; line-height: 1.6;">
                    <h4 style="margin-bottom: 12px; color: #333;">確定要修復 ${pathIssues.length} 個部門的路徑不一致問題嗎？</h4>
                    <div style="margin-bottom: 16px;">
                        <strong>此操作將會：</strong>
                        <ul style="margin: 8px 0; padding-left: 20px;">
                            <li>更新部門路徑為正確格式</li>
                            <li>確保路徑與父子關係一致</li>
                        </ul>
                    </div>
                    <div style="background: #f8f9fa; padding: 12px; border-radius: 4px; border-left: 4px solid #007bff;">
                        <strong>受影響的部門：</strong><br>
                        ${pathIssues.map(issue => `• ${issue.name} (${issue.current_path} → ${issue.expected_path})`).join('<br>')}
                    </div>
                </div>
            `;

            Dialog.confirm(
                confirmMessage,
                async () => {
                    // 確認後執行 API 呼叫
                    try {
                        const response = await fetch(`${API_BASE}/role-relationships/fix-department-paths`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            credentials: 'include',
                            body: JSON.stringify(pathIssues)
                        });

                        if (!response.ok) {
                            throw new Error('修復路徑失敗');
                        }

                        const result = await response.json();

                        if (result.data.failed_count > 0) {
                            const failedListHtml = result.data.failed_fixes.map(f => 
                                `<div style="margin: 4px 0;"><strong>${f.name || f.department_name}:</strong> ${f.reason}</div>`
                            ).join('');
                            
                            Dialog.warning(
                                `<div style="text-align: left;">
                                    <h4>路徑修復完成！</h4>
                                    <div style="margin: 12px 0;">
                                        <div style="color: #28a745;">✓ 成功: ${result.data.success_count} 個</div>
                                        <div style="color: #dc3545;">✗ 失敗: ${result.data.failed_count} 個</div>
                                    </div>
                                    <div style="background: #fff3cd; padding: 12px; border-radius: 4px; border-left: 4px solid #ffc107;">
                                        <strong>失敗原因:</strong><br>
                                        ${failedListHtml}
                                    </div>
                                </div>`,
                                { allowHTML: true }
                            );
                        } else {
                            Dialog.success(`路徑修復完成！成功修復了 ${result.data.success_count} 個部門的路徑`);
                        }

                        // 重新執行分析以顯示最新結果
                        showRoleRelationshipAnalysis();

                    } catch (error) {
                        console.error('修復部門路徑失敗:', error);
                        Dialog.error('修復路徑失敗: ' + error.message);
                    }
                },
                {
                    title: '修復部門路徑',
                    confirmText: '確認修復',
                    cancelText: '取消',
                    allowHTML: true
                }
            );

        } catch (error) {
            console.error('修復部門路徑失敗:', error);
            if (window.Dialog) {
                Dialog.error('修復路徑失敗: ' + error.message);
            }
        }
    }

    /**
     * 確認執行批量調整
     */
    async function confirmBulkAdjustment() {
        try {
            // 轉換為後端期望的格式
            const adjustmentsData = currentAdjustmentsToApply.map(adjustment => {
                console.log('Processing adjustment for apply:', adjustment);
                const result = {
                    role_id: adjustment.role_id,
                    suggested_parent_id: adjustment.suggested_parent_id
                };
                console.log('Converted to:', result);
                return result;
            }).filter(adj => adj.role_id !== undefined && adj.role_id !== null);
            
            const response = await fetch(`${API_BASE}/role-relationships/apply-adjustments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(adjustmentsData)
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
            if (window.OrganizationRolesModule && window.OrganizationRolesModule.refreshDeptTree) {
                await window.OrganizationRolesModule.refreshDeptTree();
            }

        } catch (error) {
            console.error('執行批量調整失敗:', error);
            if (window.Dialog) {
                Dialog.error('執行調整失敗: ' + error.message);
            }
        }
    }

    /**
     * 切換包含停用角色的選項
     */
    function toggleIncludeInactive() {
        const checkbox = document.getElementById('includeInactiveRoles');
        if (checkbox) {
            includeInactiveRoles = checkbox.checked;
            
            // 重新執行分析
            showRoleRelationshipAnalysis(includeInactiveRoles);
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
        toggleRoleAssignmentSelection,
        selectAllRoleAssignments,
        clearRoleAssignmentSelection,
        selectAllRecommendations,
        clearAllSelections,
        applyRoleAssignmentSuggestions,
        showBulkAdjustmentModal,
        closeBulkAdjustmentModal,
        confirmBulkAdjustment,
        fixDepartmentPaths,
        toggleIncludeInactive,
    };
})();

// 確保模組在全域可用
if (!window.OrganizationRoleAnalysisModule) {
    window.OrganizationRoleAnalysisModule = OrganizationRoleAnalysisModule;
}