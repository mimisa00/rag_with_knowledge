/**
 * 組織管理 - 員工樹狀結構子模組
 * 負責部門樹與員工節點的顯示與互動
 */
const OrganizationEmployeeTreeModule = (function () {
    'use strict';

    // 樹狀結構相關變數
    let departmentTree = null;
    let selectedDeptId = null;
    let expandedNodes = new Set();
    let treeSearchTerm = '';
    let showInactiveEmployees = false;

    /**
     * 初始化樹狀結構
     */
    function init(mainModule) {
        console.log('OrganizationEmployeeTreeModule.init 開始');

        // 綁定樹狀結構事件
        bindTreeEvents();

        // 初始化拖放功能
        if (window.OrganizationEmployeeDragModule) {
            OrganizationEmployeeDragModule.init();
        }

        // 載入部門樹
        loadDepartmentTree(mainModule);
    }

    /**
     * 初始化樹狀結構（不載入資料）
     */
    function initWithoutLoad() {
        console.log('OrganizationEmployeeTreeModule.initWithoutLoad 開始');

        // 清空選擇狀態
        selectedDeptId = null;
        expandedNodes.clear();
        
        // 通知主模組清除選中的部門
        if (window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.clearSelectedDepartment) {
            window.OrganizationEmployeeModule.clearSelectedDepartment();
        }

        // 只綁定樹狀結構事件，不載入資料
        bindTreeEvents();
        
        console.log('樹狀結構事件綁定完成，等待資料');
    }

    /**
     * 使用傳入的資料渲染樹狀結構
     */
    function renderWithData(departments, users) {
        console.log('renderWithData 開始, 部門數:', departments.length, '員工數:', users.length);
        const container = document.getElementById('employeeTreeContainer');
        
        if (!container) {
            console.error('Container employeeTreeContainer not found!');
            return;
        }

        try {
            // 清空選擇狀態
            selectedDeptId = null;
            // 通知主模組清除選中的部門
            if (window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.clearSelectedDepartment) {
                window.OrganizationEmployeeModule.clearSelectedDepartment();
            }

            // 將員工分配到對應部門
            departmentTree = attachEmployeesToDepartments(departments, users);
            console.log('Department tree built with data:', departmentTree);

            // 預設展開第一層部門
            expandFirstLevel(departmentTree);

            renderDepartmentTree(departmentTree, window.OrganizationEmployeeModule);

        } catch (error) {
            console.error('使用傳入資料渲染樹狀結構失敗:', error);
            // 顯示錯誤訊息在容器中
            if (container) {
                container.innerHTML = `
                    <div class="error-message">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>渲染部門樹失敗: ${error.message}</p>
                    </div>
                `;
            }
        }
    }

    /**
     * 載入部門樹狀結構（包含員工）
     */
    async function loadDepartmentTree(mainModule) {
        console.log('loadDepartmentTree 開始');
        const container = document.getElementById('employeeTreeContainer');
        console.log('Tree container:', container);
        
        // 清空選擇狀態
        selectedDeptId = null;
        // 通知主模組清除選中的部門
        if (window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.clearSelectedDepartment) {
            window.OrganizationEmployeeModule.clearSelectedDepartment();
        }

        try {
            // 同時載入部門和員工數據
            console.log('正在載入部門和員工數據...');
            const [deptResponse, userResponse] = await Promise.all([
                fetch('/api/organization/departments?tree=true', { credentials: 'include' }),
                fetch('/api/organization/users?all=true', { credentials: 'include' })
            ]);

            console.log('Department response:', deptResponse.status);
            console.log('User response:', userResponse.status);

            if (!deptResponse.ok || !userResponse.ok) {
                throw new Error(`Failed to load data: dept=${deptResponse.status}, user=${userResponse.status}`);
            }

            const departments = await deptResponse.json();
            const usersData = await userResponse.json();
            
            // API 直接回傳陣列，不是包在 data 屬性中
            const users = Array.isArray(usersData) ? usersData : (usersData.data || []);

            console.log('Departments loaded:', departments);
            console.log('Users loaded:', users.length, 'users');

            // 將員工分配到對應部門
            departmentTree = attachEmployeesToDepartments(departments, users);
            console.log('Department tree built:', departmentTree);

            // 預設展開第一層部門
            expandFirstLevel(departmentTree);

            renderDepartmentTree(departmentTree, mainModule);

        } catch (error) {
            console.error('Error loading department tree:', error);
            // 顯示錯誤訊息在容器中
            if (container) {
                container.innerHTML = `
                    <div class="error-message">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>載入部門樹失敗: ${error.message}</p>
                    </div>
                `;
            }
        }
    }

    /**
     * 將員工附加到部門節點
     */
    function attachEmployeesToDepartments(departments, users) {
        const usersByDept = {};
        
        console.log('attachEmployeesToDepartments - users:', users);
        console.log('showInactiveEmployees:', showInactiveEmployees);

        // 按部門分組員工
        users.forEach(user => {
            if (!showInactiveEmployees && !user.is_active) return;

            // 從 API 回應取得 department_id
            // API 回應包含 department 物件和 user_extension
            const deptId = user.department?.id || 
                           user.user_extension?.department_id ||
                           user.department_id || 
                           user.dept_id;
            
            console.log(`User ${user.username || user.loginid} - dept_id: ${deptId}, is_active: ${user.is_active}, department: ${user.department?.name}`);
            
            if (deptId) {
                if (!usersByDept[deptId]) {
                    usersByDept[deptId] = [];
                }
                usersByDept[deptId].push(user);
            }
        });
        
        console.log('usersByDept:', usersByDept);

        // 遞迴附加員工到部門
        function attachToNode(node) {
            node.employees = usersByDept[node.id] || [];
            node.employee_count = node.employees.length;
            
            if (node.employees.length > 0) {
                console.log(`Department ${node.name} (${node.id}) has ${node.employees.length} employees`);
            }

            if (node.children && node.children.length > 0) {
                node.children.forEach(child => attachToNode(child));
            }

            return node;
        }

        return departments.map(dept => attachToNode(dept));
    }

    /**
     * 預設展開第一層部門節點
     */
    function expandFirstLevel(tree) {
        if (!tree || tree.length === 0) return;
        
        // 將第一層部門加入展開節點集合
        tree.forEach(dept => {
            // 只要第一層有子內容（子部門或員工），就預設展開
            const hasChildren = dept.children && dept.children.length > 0;
            const hasEmployees = dept.employees && dept.employees.length > 0;
            if (hasChildren || hasEmployees) {
                expandedNodes.add(dept.id);
                console.log(`預設展開第一層部門: ${dept.name} (ID: ${dept.id})`);
            }
        });
    }

    /**
     * 渲染部門樹
     */
    function renderDepartmentTree(tree, mainModule) {
        console.log('renderDepartmentTree 開始, tree:', tree);
        const container = document.getElementById('employeeTreeContainer');
        if (!container) {
            console.error('Container employeeTreeContainer not found!');
            return;
        }

        if (!tree || tree.length === 0) {
            container.innerHTML = '<p class="text-muted">暫無部門資料</p>';
            return;
        }

        const html = buildTreeHTML(tree, mainModule);
        console.log('Generated HTML length:', html.length);
        container.innerHTML = html;

        // 更新統計
        updateTreeStats(tree);

        // 綁定事件
        bindNodeEvents();
        
        // 啟用員工節點拖放功能
        if (window.OrganizationEmployeeDragModule) {
            setTimeout(() => {
                OrganizationEmployeeDragModule.enableDragForEmployeeNodes();
                OrganizationEmployeeDragModule.enableDropForDepartmentNodes();
            }, 100);
        }
    }

    /**
     * 更新樹狀結構統計employeeTreeContainer
     */
    function updateTreeStats(tree) {
        let totalDepts = 0;
        let totalEmployees = 0;
        let activeEmployees = 0;
        let inactiveEmployees = 0;

        function countNodes(nodes) {
            nodes.forEach(node => {
                totalDepts++;
                if (node.employees) {
                    node.employees.forEach(emp => {
                        totalEmployees++;
                        if (emp.is_active) {
                            activeEmployees++;
                        } else {
                            inactiveEmployees++;
                        }
                    });
                }
                if (node.children) {
                    countNodes(node.children);
                }
            });
        }

        countNodes(tree);

        // 更新統計顯示
        const totalDeptCount = document.querySelector('#empTreeTotalDeptCount');
        const totalEmpCount = document.querySelector('#empTreeTotalEmpCount');
        const activeCount = document.querySelector('#empTreeActiveCount strong');
        const inactiveCount = document.querySelector('#empTreeInactiveCount strong');

        if (totalDeptCount) totalDeptCount.textContent = totalDepts;
        if (totalEmpCount) totalEmpCount.textContent = totalEmployees;
        if (activeCount) activeCount.textContent = activeEmployees;
        if (inactiveCount) inactiveCount.textContent = inactiveEmployees;
    }

    /**
     * 建立樹狀HTML - 採用角色管理風格
     */
    function buildTreeHTML(nodes, mainModule, level = 0) {
        return nodes.map(node => {
            const isExpanded = expandedNodes.has(node.id);
            const hasChildren = node.children && node.children.length > 0;
            const hasEmployees = node.employees && node.employees.length > 0;
            const hasContent = hasChildren || hasEmployees;
            const isSelected = node.id === selectedDeptId;
            const chevronClass = isExpanded ? 'fa-chevron-down' : 'fa-chevron-right';
            const childrenClass = isExpanded ? 'tree-children expanded' : 'tree-children';

            // 生成子內容HTML
            let childrenHTML = '';
            if (hasContent) {
                childrenHTML = `<div class="${childrenClass}">`;
                if (hasEmployees) {
                    console.log(`Rendering ${node.employees.length} employees for department ${node.name}`);
                    const employeeHTML = renderEmployeeNodes(node.employees);
                    console.log('Employee HTML length:', employeeHTML.length);
                    childrenHTML += employeeHTML;
                }
                if (hasChildren) {
                    childrenHTML += buildTreeHTML(node.children, mainModule, level + 1);
                }
                childrenHTML += '</div>';
            }

            return `
                <div class="tree-node ${node.is_active ? '' : 'inactive'}" data-id="${node.id}">
                    <div class="node-content ${isSelected ? 'selected' : ''}" 
                         data-dept-id="${node.id}">
                        ${hasContent ?
                    `<span class="node-toggle">
                                <i class="fas ${chevronClass}"></i>
                            </span>` :
                    '<span class="node-toggle invisible"></span>'
                }
                        <span class="node-icon">
                            <i class="fas fa-folder"></i>
                        </span>
                        <span class="node-name">${node.name}</span>
                        ${node.employee_count > 0 ? `<span class="node-count" data-dept-id="${node.id}" title="點擊查看員工詳情">(${node.employee_count}人)</span>` : ''}
                    </div>
                    ${childrenHTML}
                </div>
            `;
        }).join('');
    }

    /**
     * 渲染員工節點 - 採用角色管理風格
     */
    function renderEmployeeNodes(employees) {
        if (!employees || employees.length === 0) return '';

        // 員工排序：管理角色優先 > 等級小優先 > 員工編號排序（與卡片模組保持一致）
        const sortedEmployees = [...employees].sort((a, b) => {
            const getRoleWeight = (employee) => {
                const roles = employee.department_roles || [];
                if (!roles.length) return { weight: 1000, level: 999, employeeNo: getEmployeeNo(employee) };
                
                // 找出最高優先級的角色
                const topRole = roles.reduce((top, role) => {
                    const isTopPrimary = top.is_primary === 1;
                    const isManager = role.role_type === 'manager';
                    const topIsManager = top.role_type === 'manager';
                    
                    // 管理角色而且是主要角色
                    if (isManager && isTopPrimary) return top;
                    // 管理角色優先
                    if (isManager && !topIsManager) return role;
                    if (!isManager && topIsManager) return top;
                    
                    // 相同類型比較等級（數字越小優先級越高）
                    if ((role.level || 999) < (top.level || 999)) return role;
                    return top;
                }, roles[0]);
                
                return {
                    weight: topRole.role_type === 'manager' ? 0 : 1,
                    level: topRole.level || 999,
                    employeeNo: getEmployeeNo(employee)
                };
            };
            
            const getEmployeeNo = (employee) => {
                return employee.user_extension?.employee_no || 
                       employee.employee_no || 
                       employee.loginid || 
                       employee.username || 
                       '';
            };
            
            const compareEmployeeNumber = (a, b) => {
                if (!a && !b) return 0;
                if (!a) return 1;
                if (!b) return -1;
                
                // 嘗試自然排序（A001, A002, A010）
                const regex = /^([A-Za-z]*)(\d+)(.*)$/;
                const matchA = a.match(regex);
                const matchB = b.match(regex);
                
                if (matchA && matchB) {
                    // 先比較字母部分
                    if (matchA[1] !== matchB[1]) {
                        return matchA[1].localeCompare(matchB[1]);
                    }
                    // 再比較數字部分
                    const numA = parseInt(matchA[2], 10);
                    const numB = parseInt(matchB[2], 10);
                    if (numA !== numB) {
                        return numA - numB;
                    }
                    // 最後比較後綴
                    return matchA[3].localeCompare(matchB[3]);
                }
                
                // 回退到字符串比較
                return a.localeCompare(b);
            };
            
            const aWeight = getRoleWeight(a);
            const bWeight = getRoleWeight(b);
            
            // 先比較角色類型權重
            if (aWeight.weight !== bWeight.weight) {
                return aWeight.weight - bWeight.weight;
            }
            
            // 再比較角色等級
            if (aWeight.level !== bWeight.level) {
                return aWeight.level - bWeight.level;
            }
            
            // 最後比較員工編號
            return compareEmployeeNumber(aWeight.employeeNo, bWeight.employeeNo);
        });

        return sortedEmployees.map(emp => {
            // 從 API 資料結構取得正確欄位
            const displayName = emp.username || emp.loginid || '未命名';
            const title = emp.user_extension?.title || emp.title || '';//未設定職稱
            const primaryRole = emp.department_roles?.find(r => r.is_primary === 1 || r.is_primary === true)?.name || 
                               (emp.department_roles && emp.department_roles.length > 0 ? emp.department_roles[0].name : '無角色');
            const userId = emp.user_id || emp.id;

            // 判斷是否為管理角色，選擇對應圖標
            const primaryRoleData = emp.department_roles?.find(r => r.is_primary === 1 || r.is_primary === true) || 
                                   (emp.department_roles && emp.department_roles.length > 0 ? emp.department_roles[0] : null);
            const isManager = primaryRoleData?.role_type === 'manager';
            const employeeIcon = isManager ? 'fa-user-tie' : 'fa-user';

            return `
                <div class="employee-tree-node ${emp.is_active ? '' : 'inactive'} ${isManager ? 'manager-node' : ''}" 
                     data-emp-id="${userId}"
                     onclick="OrganizationEmployeeTreeModule.selectEmployee(${userId}, event)">
                    <i class="fas ${employeeIcon}"></i>
                    <span class="role-name">
                        ${displayName}
                    </span>
                    <span class="node-actions">
                        <button class="btn-icon" onclick="event.stopPropagation(); OrganizationEmployeeTreeModule.viewDetails(${userId})" title="檢視詳情">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-icon" onclick="event.stopPropagation(); OrganizationEmployeeTreeModule.editEmployee(${userId})" title="編輯">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon" onclick="event.stopPropagation(); OrganizationEmployeeTreeModule.editUserPermissions(${userId})" title="編輯權限">
                            <i class="fas fa-shield-alt"></i>
                        </button>
                    </span>
                    <span class="role-info">${title}</span>
                    ${!emp.is_active ? '<span class="badge badge-secondary">停用</span>' : ''}
                </div>
            `;
        }).join('');
    }

    /**
     * 切換節點展開/收合
     */
    function toggleNode(deptId, event) {
        if (event) event.stopPropagation();
        
        const node = document.querySelector(`#employeeTreeContainer [data-id="${deptId}"]`);
        if (!node) return;

        const toggle = node.querySelector('.node-toggle i');
        const children = node.querySelector('.tree-children');

        if (!children) return;

        if (expandedNodes.has(deptId)) {
            // 收合
            expandedNodes.delete(deptId);
            if (toggle) {
                toggle.classList.remove('fa-chevron-down');
                toggle.classList.add('fa-chevron-right');
            }
            children.classList.remove('expanded');
            children.style.display = 'none';
        } else {
            // 展開
            expandedNodes.add(deptId);
            if (toggle) {
                toggle.classList.remove('fa-chevron-right');
                toggle.classList.add('fa-chevron-down');
            }
            children.classList.add('expanded');
            children.style.display = 'block';
        }
    }

    /**
     * 綁定節點事件
     */
    function bindNodeEvents() {
        // 綁定展開/收合事件
        document.querySelectorAll('#employeeTreeContainer .node-toggle').forEach(toggle => {
            if (!toggle.classList.contains('invisible')) {
                toggle.addEventListener('click', function (e) {
                    e.stopPropagation();
                    const node = this.closest('.tree-node');
                    const deptId = parseInt(node.dataset.id);
                    toggleNode(deptId);
                });
            }
        });

        // 綁定部門節點點擊事件
        document.querySelectorAll('#employeeTreeContainer .node-content').forEach(content => {
            content.addEventListener('click', function (e) {
                // 檢查是否點擊在箭頭區域
                if (e.target.closest('.node-toggle')) {
                    return; // 如果是箭頭區域，不處理部門選擇
                }
                e.stopPropagation();
                const deptId = parseInt(this.dataset.deptId);
                const node = this.closest('.tree-node');
                const hasContent = node.querySelector('.tree-children');
                
                // 判斷部門是否已被選中（focus）
                const isAlreadySelected = selectedDeptId === deptId;
                
                if (isAlreadySelected) {
                    // 如果部門已被選中，再次點擊時先重新載入員工，再切換展開/收合
                    console.log('重複點擊已選中的部門，重新載入員工卡片:', deptId);
                    selectDepartment(deptId); // 允許重新載入員工卡片
                    if (hasContent) {
                        toggleNode(deptId);
                    }
                } else {
                    // 如果部門未被選中
                    if (hasContent && !expandedNodes.has(deptId)) {
                        // 有子內容且未展開時，展開節點
                        toggleNode(deptId);
                    }
                    // 無論是否展開，都要選中部門（focus）
                    selectDepartment(deptId);
                }
            });
        });

        // 綁定人數點擊事件
        document.querySelectorAll('#employeeTreeContainer .node-count').forEach(countEl => {
            countEl.addEventListener('click', function(e) {
                e.stopPropagation(); // 防止觸發節點選擇
                e.preventDefault();
                
                const deptId = this.dataset.deptId;
                if (deptId && deptId !== 'undefined') {
                    // 調用員工模組的懸浮卡片功能
                    if (window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.showEmployeeHoverCard) {
                        window.OrganizationEmployeeModule.showEmployeeHoverCard(parseInt(deptId));
                    }
                }
            });
        });

        // 初始化展開/收合狀態
        document.querySelectorAll('#employeeTreeContainer .tree-children').forEach(children => {
            if (!children.classList.contains('expanded')) {
                children.style.display = 'none';
            } else {
                children.style.display = 'block';
            }
        });
    }

    /**
     * 選擇部門
     */
    function selectDepartment(deptId) {
        selectedDeptId = deptId;

        // 更新選中狀態 - 統一操作 .node-content 元素
        document.querySelectorAll('#employeeTreeContainer .node-content').forEach(content => {
            content.classList.remove('selected');
        });
        const selectedContent = document.querySelector(`#employeeTreeContainer [data-dept-id="${deptId}"]`);
        if (selectedContent) {
            selectedContent.classList.add('selected');
        }

        // 找到部門資訊
        function findDept(nodes) {
            for (let node of nodes) {
                if (node.id === deptId) return node;
                if (node.children) {
                    const found = findDept(node.children);
                    if (found) return found;
                }
            }
            return null;
        }

        const dept = findDept(departmentTree);
        if (dept) {
            // 更新右側標題
            const titleElement = document.getElementById('selectedEmpDeptName');
            if (titleElement) {
                titleElement.textContent = dept.name;
            }

            const countElement = document.getElementById('selectedEmpDeptCount');
            if (countElement) {
                countElement.textContent = `${dept.employee_count || 0} 位員工`;
            }

            // 通知主模組更新員工列表
            if (window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.loadEmployeesByDept) {
                window.OrganizationEmployeeModule.loadEmployeesByDept(deptId);
            }
            
            // 通知主模組設定選中的部門（用於控制新增員工按鈕）
            if (window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.setSelectedDepartment) {
                window.OrganizationEmployeeModule.setSelectedDepartment(deptId);
            }
        }
    }

    /**
     * 選擇員工 - 高亮對應的員工卡片
     */
    function selectEmployee(empId, event) {
        if (event) event.stopPropagation();

        // 高亮樹狀結構中的員工節點
        document.querySelectorAll('#employeeTreeContainer .employee-tree-node').forEach(node => {
            node.classList.remove('selected');
        });
        const selectedEmpNode = document.querySelector(`#employeeTreeContainer [data-emp-id="${empId}"]`);
        if (selectedEmpNode) {
            selectedEmpNode.classList.add('selected');
        }

        // 先找到員工所屬的部門，確保部門已選中
        const employeeNode = selectedEmpNode;
        if (employeeNode) {
            const departmentNode = employeeNode.closest('.tree-node[data-id]');
            if (departmentNode) {
                const deptId = parseInt(departmentNode.dataset.id);
                
                // 確保部門節點已展開（如果有子節點的話）
                if (!expandedNodes.has(deptId)) {
                    toggleNode(deptId);
                }
                
                // 選中部門（這會載入員工卡片）
                selectDepartment(deptId);
                
                // 等待卡片載入完成後再高亮員工卡片
                setTimeout(() => {
                    if (window.OrganizationEmployeeCardModule && window.OrganizationEmployeeCardModule.highlightEmployee) {
                        window.OrganizationEmployeeCardModule.highlightEmployee(empId);
                    }
                }, 200);
            }
        }
    }
    
    /**
     * 檢視員工詳情
     */
    function viewDetails(empId) {
        if (window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.showEmployeeDetail) {
            window.OrganizationEmployeeModule.showEmployeeDetail(empId);
        }
    }
    
    /**
     * 編輯員工
     */
    function editEmployee(empId) {
        if (window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.editEmployee) {
            window.OrganizationEmployeeModule.editEmployee(empId);
        }
    }
    
    /**
     * 編輯員工權限
     */
    function editUserPermissions(empId) {
        if (window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.editUserPermissions) {
            window.OrganizationEmployeeModule.editUserPermissions(empId);
        }
    }

    /**
     * 展開全部
     */
    function expandAll() {
        // 收集所有部門ID
        function collectDeptIds(nodes) {
            nodes.forEach(node => {
                expandedNodes.add(node.id);
                if (node.children) collectDeptIds(node.children);
            });
        }

        if (departmentTree) {
            collectDeptIds(departmentTree);
            renderDepartmentTree(departmentTree);
        }
    }

    /**
     * 收合全部
     */
    function collapseAll() {
        expandedNodes.clear();
        renderDepartmentTree(departmentTree);
    }

    /**
     * 重新整理
     */
    function refresh(mainModule) {
        // 保存當前狀態
        const currentSelectedDept = selectedDeptId;
        const currentExpandedNodes = new Set(expandedNodes);
        
        // 暫時清空狀態以進行重新載入
        expandedNodes.clear();
        selectedDeptId = null;
        
        // 重新載入樹狀結構並返回 Promise
        return loadDepartmentTree(mainModule).then(() => {
            // 恢復展開狀態
            expandedNodes = currentExpandedNodes;
            
            // 恢復選中狀態
            if (currentSelectedDept) {
                selectedDeptId = currentSelectedDept;
                
                // 通知主模組恢復選中的部門
                if (window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.setSelectedDepartment) {
                    window.OrganizationEmployeeModule.setSelectedDepartment(currentSelectedDept);
                }
                
                // 重新渲染樹狀結構以反映選中狀態
                renderDepartmentTree(departmentTree);
            }
            
            // 重新啟用拖放功能
            if (window.OrganizationEmployeeDragModule) {
                setTimeout(() => {
                    OrganizationEmployeeDragModule.enableDragForEmployeeNodes();
                    OrganizationEmployeeDragModule.enableDropForDepartmentNodes();
                }, 200);
            }
            
            console.log('樹狀結構刷新完成，當前選中部門:', selectedDeptId);
        }).catch(error => {
            console.error('樹狀結構重新載入失敗:', error);
            // 發生錯誤時清除狀態
            if (window.OrganizationEmployeeModule && window.OrganizationEmployeeModule.clearSelectedDepartment) {
                window.OrganizationEmployeeModule.clearSelectedDepartment();
            }
            throw error; // 重新拋出錯誤以便調用方知道失敗
        });
    }

    /**
     * 搜尋樹狀結構
     */
    function searchTree(term) {
        treeSearchTerm = term;

        // 移除所有高亮
        document.querySelectorAll('#employeeTreeContainer .tree-node').forEach(node => {
            node.classList.remove('highlight');
        });
        document.querySelectorAll('#employeeTreeContainer .employee-tree-node').forEach(node => {
            node.classList.remove('highlight');
        });

        if (term) {
            const matchedDepartments = [];
            const matchedEmployees = [];

            // 展開包含搜尋結果的節點
            function searchAndExpand(nodes) {
                let hasMatch = false;

                nodes.forEach(node => {
                    let nodeMatch = node.name.toLowerCase().includes(term.toLowerCase());
                    let childMatch = false;
                    let empMatch = false;
                    let matchedEmpIds = [];

                    // 檢查員工
                    if (node.employees) {
                        node.employees.forEach(emp => {
                            const empName = emp.name || emp.username || emp.loginid || '';
                            const empTitle = emp.user_extension?.title || emp.title || '';
                            const empEmail = emp.email || '';
                            
                            if (empName.toLowerCase().includes(term.toLowerCase()) ||
                                empTitle.toLowerCase().includes(term.toLowerCase()) ||
                                empEmail.toLowerCase().includes(term.toLowerCase())) {
                                empMatch = true;
                                const empId = emp.user_id || emp.id;
                                matchedEmpIds.push(empId);
                                matchedEmployees.push(empId);
                            }
                        });
                    }

                    // 檢查子節點
                    if (node.children) {
                        childMatch = searchAndExpand(node.children);
                    }

                    if (nodeMatch || childMatch || empMatch) {
                        expandedNodes.add(node.id);
                        hasMatch = true;
                        
                        // 只有部門名稱直接匹配時才高亮部門
                        if (nodeMatch) {
                            matchedDepartments.push(node.id);
                        }
                        
                        // 如果有員工匹配但部門名稱不匹配，不再標記部門
                        // 只展開節點以顯示匹配的員工，但不高亮部門節點
                    }
                });

                return hasMatch;
            }

            if (departmentTree) {
                searchAndExpand(departmentTree);
            }

            // 渲染樹狀結構
            renderDepartmentTree(departmentTree);

            // 套用部門高亮 class（只有部門名稱直接匹配的才會高亮）
            matchedDepartments.forEach(nodeId => {
                const nodeElement = document.querySelector(`#employeeTreeContainer [data-id="${nodeId}"]`);
                if (nodeElement) {
                    nodeElement.classList.add('highlight');
                }
            });

            // 套用員工高亮 class
            matchedEmployees.forEach(empId => {
                const empElement = document.querySelector(`#employeeTreeContainer [data-emp-id="${empId}"]`);
                if (empElement) {
                    empElement.classList.add('highlight');
                }
            });
            
            // 滾動到第一個匹配項（優先員工，然後部門）
            let firstHighlight = document.querySelector('#employeeTreeContainer .employee-tree-node.highlight');
            if (!firstHighlight) {
                firstHighlight = document.querySelector('#employeeTreeContainer .tree-node.highlight');
            }
            if (firstHighlight) {
                firstHighlight.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });
            }

            // 更新搜尋結果統計
            const searchResultCount = document.getElementById('empTreeSearchResultCount');
            if (searchResultCount) {
                const totalMatches = matchedDepartments.length + matchedEmployees.length;
                searchResultCount.textContent = `找到 ${totalMatches} 個符合結果`;
                searchResultCount.style.display = totalMatches > 0 ? 'inline' : 'none';
            }
        } else {
            // 沒有搜尋詞，隱藏搜尋結果統計
            const searchResultCount = document.getElementById('empTreeSearchResultCount');
            if (searchResultCount) {
                searchResultCount.style.display = 'none';
            }
            
            // 直接渲染
            renderDepartmentTree(departmentTree);
        }
    }

    /**
     * 切換顯示停用員工
     */
    function toggleInactive() {
        showInactiveEmployees = !showInactiveEmployees;
        // 更新按鈕圖示和樣式
        const toggleBtn = document.getElementById('toggleInactiveEmpTreeBtn');
        if (toggleBtn) {
            const icon = toggleBtn.querySelector('i');
            if (icon) {
                console.log(showInactiveEmployees)
                // 當顯示停用時，添加 active 樣式（藍色）
                if (showInactiveEmployees) {
                    toggleBtn.classList.add('active');
                    icon.className = 'fas fa-eye';
                    toggleBtn.title = '隱藏停用';
                } else {
                    toggleBtn.classList.remove('active');
                    icon.className = 'fas fa-eye-slash';
                    toggleBtn.title = '顯示停用';
                }
            }
        }

        // 重新載入樹
        loadDepartmentTree();
    }

    /**
     * 綁定樹狀結構事件
     */
    function bindTreeEvents() {
        // 搜尋框事件
        const searchInput = document.getElementById('employeeTreeSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchTree(e.target.value);
            });
        }

        // 展開全部按鈕
        const expandBtn = document.getElementById('empTreeExpandAll');
        if (expandBtn) {
            expandBtn.addEventListener('click', expandAll);
        }

        // 收合全部按鈕
        const collapseBtn = document.getElementById('empTreeCollapseAll');
        if (collapseBtn) {
            collapseBtn.addEventListener('click', collapseAll);
        }

        // 重新整理按鈕
        const refreshBtn = document.getElementById('empTreeRefresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => refresh());
        }

    }

    // 公開API
    return {
        init,
        initWithoutLoad,
        renderWithData,
        expandAll,
        collapseAll,
        refresh,
        searchTree,
        toggleNode,
        selectDepartment,
        selectEmployee,
        viewDetails,
        editEmployee,
        editUserPermissions,
        toggleInactive
    };
})();

// 確保模組可被存取
// 註冊到全域
window.OrganizationEmployeeTreeModule = OrganizationEmployeeTreeModule;