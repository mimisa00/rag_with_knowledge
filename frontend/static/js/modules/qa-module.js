(() => {
    'use strict';

    // QA模組 - 處理問答相關功能
    const QAModule = (() => {
        // 私有變數
        let conversations = {};
        let currentConvId = null;
        let enableNounAnalysis = false;
        let enableThink = false;
        let selectedQAKBId = null;
        let userScrolled = false;
        let fullAnswer = "";

        // DOM 元素快取
        let elements = {};

        // 常數定義
        const PARSER_TITLE_STR = "分析問題名詞並生成同義詞中...";

        // 初始化 marked.js 設定
        function initMarked() {
            if (typeof marked !== 'undefined') {
                marked.setOptions({
                    breaks: true,
                    gfm: true
                });
            }
        }

        // 初始化 DOM 元素參考
        function initElements() {
            elements = {
                answerDiv: document.getElementById("answer"),
                questionInput: document.getElementById("question"),
                sendBtn: document.getElementById("sendBtn"),
                nounAnalysisDiv: document.getElementById("nounAnalysis"),
                thinkResponseDiv: document.getElementById("thinkResponse"),
                actualpromptDiv: document.getElementById("actualprompt"),
                conversationList: document.getElementById("conversationList"),
                qaKnowledgeBaseSelect: document.getElementById("qaKnowledgeBaseSelect"),
                drawerContainer: document.getElementById("drawerContainer"),
                thinkToggleSection: document.getElementById("thinkToggleSection")
            };
        }

        // 對話管理功能
        function createNewConversation() {
            const q = elements.questionInput.value.trim();
            const title = q.slice(0, 10);
            const id = `conv-${Date.now()}`;
            fullAnswer = "";
            elements.answerDiv.innerHTML = "";
            conversations[id] = { title: title, messages: [] };
            currentConvId = id;
            updateConversationList();
        }

        function updateConversationList() {
            if (!elements.conversationList) return;

            const list = elements.conversationList;
            list.innerHTML = "";

            for (const [id, conv] of Object.entries(conversations)) {
                const li = document.createElement("li");
                li.dataset.convId = id;
                li.style.display = "flex";
                li.style.justifyContent = "space-between";
                li.style.alignItems = "center";
                li.style.marginBottom = "8px";
                li.onclick = () => switchConversation(id);

                const titleSpan = document.createElement("span");
                titleSpan.textContent = conv.title;
                titleSpan.style.flex = "1";
                titleSpan.style.fontSize = "clamp(10px, 2vw, 14px)";
                titleSpan.style.overflow = "hidden";
                titleSpan.style.textOverflow = "ellipsis";
                titleSpan.style.whiteSpace = "nowrap";
                titleSpan.style.marginRight = "8px";

                const delBtn = document.createElement("button");
                delBtn.className = "delete-btn";
                delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
                delBtn.onclick = (e) => {
                    e.stopPropagation(); // 防止觸發 li 的點擊事件
                    deleteConversation(id);
                };

                li.appendChild(titleSpan);
                li.appendChild(delBtn);
                list.appendChild(li);

                if (id === currentConvId) {
                    li.classList.add("active-conversation");
                }
            }
        }

        async function switchConversation(id) {
            currentConvId = id;

            document.querySelectorAll("#conversationList li").forEach(li => {
                li.classList.remove("active-conversation");
            });

            const activeLi = document.querySelector(`#conversationList li[data-conv-id='${id}']`);
            if (activeLi) {
                activeLi.classList.add("active-conversation");
            }

            const conv = conversations[id];

            elements.answerDiv.innerHTML = "";
            fullAnswer = "";
            conv.messages.forEach(item => {
                const userBlock = document.createElement("div");
                const escapedQ = CommonUI && CommonUI.escapeHtml ? CommonUI.escapeHtml(item.q) : item.q;
                userBlock.innerHTML = `<i class="fa-solid fa-user-minus"></i> ${escapedQ}`;
                userBlock.style.background = "#e8f0fe";
                userBlock.style.padding = "8px";
                userBlock.style.marginBottom = "10px";
                userBlock.style.textAlign = "right";

                const answerHtml = marked.parse(item.a);
                const answerBlock = document.createElement("div");
                answerBlock.className = "markdown-body";
                answerBlock.innerHTML = answerHtml;
                answerBlock.style.background = "#f4f4f4";
                answerBlock.style.padding = "8px";
                answerBlock.style.marginBottom = "20px";
                elements.answerDiv.appendChild(userBlock);
                elements.answerDiv.appendChild(answerBlock);
                fullAnswer += answerHtml;
            });

            elements.answerDiv.scrollTop = elements.answerDiv.scrollHeight;
            elements.questionInput.value = "";
        }

        async function deleteConversation(id) {
            try {
                delete conversations[id];
                if (currentConvId === id) {
                    currentConvId = null;
                    elements.questionInput.value = "";
                    elements.answerDiv.innerHTML = "";
                }
                const res = await fetch("/api/conversations/" + id, {
                    method: "DELETE",
                });
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }
                updateConversationList();
            } catch (error) {
                console.error('刪除對話失敗:', error);
            }
        }

        async function loadConversations() {
            try {
                const res = await fetch("/api/conversations");
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }
                const list = await res.json();

                list.forEach(item => {
                    conversations[item.id] = {
                        title: item.title,
                        messages: item.messages,
                    };
                });
                updateConversationList();
            } catch (error) {
                console.error('載入對話列表失敗:', error);
            }
        }

        // 名詞分析功能
        function toggleNounAnalysis() {
            enableNounAnalysis = !enableNounAnalysis;
            // 更新狀態顯示
            if (enableNounAnalysis) {
                elements.nounAnalysisDiv.innerHTML = "已啟用名詞分析功能";
            } else {
                elements.nounAnalysisDiv.innerHTML = "已關閉名詞分析功能";
            }
        }

        async function nounAnalysis() {
            const q = elements.questionInput.value.trim();
            try {
                // 顯示載入動畫
                elements.nounAnalysisDiv.innerHTML = '<i class="fa fa-spinner fa-spin"></i> 分析中...';
                
                const res = await fetch("/api/query/noun/analysis", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ question: q, conv_id: currentConvId })
                });

                const reader = res.body.getReader();
                const decoder = new TextDecoder("utf-8");
                let fullResponse = PARSER_TITLE_STR + "\n";
                elements.nounAnalysisDiv.innerHTML = marked.parse(fullResponse);
                let buffer = "";
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    buffer += chunk;
                    try {
                        fullResponse += buffer;
                    } catch (e) {
                        continue;
                    }
                    buffer = "";
                    elements.nounAnalysisDiv.innerHTML = marked.parse(fullResponse);
                    elements.nounAnalysisDiv.scrollTop = elements.nounAnalysisDiv.scrollHeight;
                }
            } catch (err) {
                elements.nounAnalysisDiv.innerHTML = `<p style="color:red;">出現錯誤：${err.message}</p>`;
            }
        }

        // 推理功能
        function toggleThinkResponse() {
            // 獲取系統狀態
            let systemEnabled = true;
            if (window.UserMenu && window.UserMenu.getFeatureStates) {
                const states = window.UserMenu.getFeatureStates();
                systemEnabled = states.thinkEnabled;
            }
            
            // 如果系統禁用，不允許切換
            if (!systemEnabled) {
                enableThink = false;
                if (elements.thinkResponseDiv) {
                    elements.thinkResponseDiv.innerHTML = "已關閉推理";
                }
                if (elements.thinkToggleSection) {
                    elements.thinkToggleSection.classList.remove('d-flex');
                    elements.thinkToggleSection.classList.add('d-none');
                }
                return;
            }
            
            // 正常切換
            enableThink = !enableThink;
            if (enableThink) {
                elements.thinkResponseDiv.innerHTML = "已啟用推理";
                if (elements.thinkToggleSection) {
                    elements.thinkToggleSection.classList.remove('d-none');
                    elements.thinkToggleSection.classList.add('d-flex');
                }
            } else {
                elements.thinkResponseDiv.innerHTML = "已關閉推理";
                if (elements.thinkToggleSection) {
                    elements.thinkToggleSection.classList.remove('d-flex');
                    elements.thinkToggleSection.classList.add('d-none');
                }
            }
        }

        async function checkThinkFeature() {
            try {
                const res = await fetch('/api/user/is/enable/think');
                const isEnabled = await res.json();
                
                if (!isEnabled) {
                    // 系統禁用時，強制關閉用戶設定
                    enableThink = false;
                    if (elements.thinkToggleSection) {
                        elements.thinkToggleSection.classList.remove('d-flex');
                        elements.thinkToggleSection.classList.add('d-none');
                    }
                    if (elements.thinkResponseDiv) {
                        elements.thinkResponseDiv.innerHTML = "已關閉推理";
                    }
                } else {
                    // 系統允許推理，預設開啟（使用者可隨時手動關閉）
                    enableThink = true;
                    if (elements.thinkToggleSection) {
                        elements.thinkToggleSection.classList.remove('d-none');
                        elements.thinkToggleSection.classList.add('d-flex');
                    }
                    if (elements.thinkResponseDiv) {
                        elements.thinkResponseDiv.innerHTML = "已啟用推理";
                    }
                }
                
                // 通知 UserMenu 更新狀態
                if (window.UserMenu && window.UserMenu.checkThinkAvailability) {
                    window.UserMenu.checkThinkAvailability();
                }
            } catch (error) {
                console.error("讀取推理開關狀態失敗：", error);
            }
        }
        
        // 同步 UserMenu 的功能狀態
        function syncWithUserMenu() {
            if (window.UserMenu && window.UserMenu.getFeatureStates) {
                const states = window.UserMenu.getFeatureStates();
                enableNounAnalysis = states.nounAnalysis;
                enableThink = states.thinkResponse;
                
                // 更新 UI 顯示
                if (elements.nounAnalysisDiv) {
                    elements.nounAnalysisDiv.innerHTML = enableNounAnalysis ? "已啟用名詞分析功能" : "已關閉名詞分析功能";
                }
                if (elements.thinkResponseDiv) {
                    elements.thinkResponseDiv.innerHTML = enableThink ? "已啟用推理" : "已關閉推理";
                }
                
                // 處理推理區塊的顯示/隱藏
                if (elements.thinkToggleSection) {
                    // 只有在系統允許且用戶開啟時才顯示
                    if (states.thinkEnabled && enableThink) {
                        elements.thinkToggleSection.classList.remove('d-none');
                        elements.thinkToggleSection.classList.add('d-flex');
                    } else {
                        elements.thinkToggleSection.classList.remove('d-flex');
                        elements.thinkToggleSection.classList.add('d-none');
                    }
                }
            }
        }

        // 知識庫選擇功能
        async function loadAvailableKnowledgeBases() {
            try {
                const response = await fetch('/api/knowledge-bases', {
                    credentials: 'include'
                });
                if (response.ok) {
                    const data = await response.json();
                    updateQAKnowledgeBaseSelect(data.knowledge_bases);
                    
                    // 檢查 URL 參數是否有指定知識庫
                    checkURLForKnowledgeBase();
                } else {
                    console.error('載入可用知識庫列表失敗');
                }
            } catch (error) {
                console.error('載入可用知識庫列表錯誤：', error);
            }
        }
        
        // 檢查 URL 參數並自動選擇知識庫
        function checkURLForKnowledgeBase() {
            const urlParams = new URLSearchParams(window.location.search);
            const kbId = urlParams.get('kb_id');
            
            if (kbId && elements.qaKnowledgeBaseSelect) {
                // 檢查該知識庫是否存在於選項中
                const options = elements.qaKnowledgeBaseSelect.options;
                for (let i = 0; i < options.length; i++) {
                    if (options[i].value === kbId) {
                        elements.qaKnowledgeBaseSelect.value = kbId;
                        selectedQAKBId = kbId;
                        
                        // 顯示提示訊息
                        Dialog.success(`已自動選擇知識庫：${options[i].text}`);
                        
                        // 清除 URL 參數（避免重複提示）
                        const newUrl = window.location.pathname;
                        window.history.replaceState({}, document.title, newUrl);
                        break;
                    }
                }
            }
        }

        function updateQAKnowledgeBaseSelect(knowledgeBases) {
            const select = elements.qaKnowledgeBaseSelect;
            if (!select) return;

            select.innerHTML = '<option value="">請選擇知識庫</option>';

            if (knowledgeBases.length === 0) {
                select.innerHTML = '<option value="">無可用知識庫</option>';
                select.disabled = true;
                disableQAButton(true, '請通知系統管理者建立知識庫');
                return;
            }

            select.disabled = false;
            knowledgeBases.forEach(kb => {
                const option = document.createElement('option');
                option.value = kb.id;
                option.textContent = kb.name;
                select.appendChild(option);
            });

            if (knowledgeBases.length === 1) {
                select.value = knowledgeBases[0].id;
                selectedQAKBId = knowledgeBases[0].id;
                disableQAButton(false);
            }
        }

        function onQAKnowledgeBaseChange() {
            const select = elements.qaKnowledgeBaseSelect;
            selectedQAKBId = select.value;

            if (selectedQAKBId) {
                disableQAButton(false);
            } else {
                disableQAButton(true, '請選擇知識庫');
            }
        }

        function disableQAButton(disabled, message = '') {
            const sendBtn = elements.sendBtn;
            sendBtn.disabled = disabled;
            if (disabled) {
                sendBtn.style.backgroundColor = '#ccc';
                sendBtn.style.cursor = 'not-allowed';
                sendBtn.textContent = message || '送出問題';
            } else {
                sendBtn.style.backgroundColor = '';
                sendBtn.style.cursor = '';
                sendBtn.textContent = '送出問題';
            }
        }

        function setButtonLoading(loading) {
            const sendBtn = elements.sendBtn;
            const questionInput = elements.questionInput;
            if (loading) {
                sendBtn.disabled = true;
                sendBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> 處理中...';
                if (questionInput) {
                    questionInput.disabled = true;  // 禁用輸入框
                }
            } else {
                sendBtn.disabled = false;
                sendBtn.innerHTML = '送出問題';
                if (questionInput) {
                    questionInput.disabled = false;  // 啟用輸入框
                }
            }
        }

        // 抽屜功能
        function updateMemoryDrawerIcon() {
            const drawer = elements.drawerContainer;
            const memoryBtn = document.querySelector('#drawerToggleButtons .drawer-toggle-btn[title="對話記憶"] i');
            const memoryPanel = document.getElementById('memoryDrawer');
            if (drawer && drawer.classList.contains('drawer-open') && memoryPanel && memoryPanel.classList.contains('active')) {
                if (memoryBtn) memoryBtn.className = 'fa-solid fa-folder-open';
            } else {
                if (memoryBtn) memoryBtn.className = 'fa-solid fa-folder';
            }
        }

        // 切換抽屜開關
        function toggleDrawer() {
            const container = document.getElementById("drawerContainer");
            if (container) {
                container.classList.toggle("drawer-open");
                container.classList.toggle("drawer-closed");
                updateMemoryDrawerIcon();
            }
        }

        // 更新記憶抽屜圖示
        function updateMemoryDrawerIcon() {
            const memoryBtn = document.querySelector('#drawerToggleButtons .drawer-toggle-btn[title="對話記憶"] i');
            const drawer = document.getElementById('drawerContainer');
            const memoryPanel = document.getElementById('memoryDrawer');
            if (drawer && memoryPanel && memoryBtn) {
                if (drawer.classList.contains('drawer-open') && memoryPanel.classList.contains('active')) {
                    memoryBtn.className = 'fa-solid fa-folder-open';
                } else {
                    memoryBtn.className = 'fa-solid fa-folder';
                }
            }
        }

        function showDrawerContent(id, role) {
            const drawer = elements.drawerContainer;
            if (drawer && role === "user") {
                drawer.classList.toggle("drawer-open");
                drawer.classList.toggle("drawer-closed");
            }

            if (drawer && role === "admin") {
                document.getElementById("drawerContainer").classList.add("drawer-open");
                document.getElementById("drawerContainer").classList.remove("drawer-closed");
            }
            
            document.querySelectorAll(".drawer-panel").forEach(el => {
                el.classList.remove("active");
            });

            const panel = document.getElementById(id);
            if (panel) {
                panel.classList.add("active");
            }

            document.querySelectorAll("#drawerToggleButtons .drawer-toggle-btn").forEach(btn => {
                btn.classList.remove("active");
            });

            if (id === "memoryDrawer") {
                const memoryBtn = document.querySelector('#drawerToggleButtons .drawer-toggle-btn[title="對話記憶"]');
                if (memoryBtn) memoryBtn.classList.add("active");
            } else if (id === "promptDrawer") {
                const promptBtn = document.querySelector('#drawerToggleButtons .drawer-toggle-btn[title="系統提示"]');
                if (promptBtn) promptBtn.classList.add("active");
            }

            updateMemoryDrawerIcon();
        }

        // 主要送出問題功能
        async function sendQuestion() {
            if (elements.thinkResponseDiv) elements.thinkResponseDiv.innerHTML = "";
            if (elements.nounAnalysisDiv) elements.nounAnalysisDiv.innerHTML = "";
            if (elements.actualpromptDiv) elements.actualpromptDiv.innerHTML = "";

            const q = elements.questionInput.value.trim();
            if (!q) {
                alert("請建立新對話");
                return;
            }

            if (!currentConvId) {
                const title = q.slice(0, 10);
                const id = `conv-${Date.now()}`;
                conversations[id] = { title: title, messages: [] };
                currentConvId = id;
                updateConversationList();
            }

            if (typeof CommonUI !== 'undefined' && CommonUI.hideSpinner) {
                CommonUI.hideSpinner();
            }
            setButtonLoading(true);
            if (enableNounAnalysis) {
                await nounAnalysis();
            }

            // 渲染使用者問題
            const userBlock = document.createElement("div");
            const escapedQ = CommonUI && CommonUI.escapeHtml ? CommonUI.escapeHtml(q) : q;
            userBlock.innerHTML = `<i class="fa-solid fa-user-minus"></i> ${escapedQ}`;
            userBlock.style.background = "#e8f0fe";
            userBlock.style.padding = "8px";
            userBlock.style.marginBottom = "10px";
            userBlock.style.textAlign = "right";
            elements.answerDiv.appendChild(userBlock);

            // 預留答案區塊，顯示載入動畫
            const answerBlock = document.createElement("div");
            answerBlock.className = "markdown-body";
            answerBlock.style.background = "#f4f4f4";
            answerBlock.style.padding = "8px";
            answerBlock.style.marginBottom = "20px";
            elements.answerDiv.appendChild(answerBlock);

            // 顯示載入動畫
            answerBlock.innerHTML = '<i class="fa fa-spinner fa-spin"></i> 處理中...';
            fullAnswer = "";  // 清空 fullAnswer，等待實際內容
            elements.answerDiv.scrollTop = elements.answerDiv.scrollHeight;

            try {
                const keyword = elements.nounAnalysisDiv ?
                    elements.nounAnalysisDiv.textContent.trim().replace(PARSER_TITLE_STR, "") : "";
                elements.answerDiv.scrollTop = elements.answerDiv.scrollHeight;
                userScrolled = false;

                // 檢查知識庫選擇（管理員頁面可能需要）
                if (!selectedQAKBId && elements.qaKnowledgeBaseSelect && !elements.qaKnowledgeBaseSelect.disabled) {
                    alert("請選擇知識庫");
                    setButtonLoading(false);
                    return;
                }

                const res = await fetch("/api/query", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        question: q,
                        keyword: keyword,
                        conv_id: currentConvId,
                        think: enableThink,
                        kb_id: selectedQAKBId
                    })
                });

                let thinkResponse = "";
                const reader = res.body.getReader();
                const decoder = new TextDecoder("utf-8");
                let promptExtracted = false;
                let promptValue = "";
                let buffer = "";

                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });

                    // 解析 JSON 串流
                    while (true) {
                        const startIdx = buffer.indexOf('{');
                        if (startIdx === -1) break;

                        let bracketCount = 0;
                        let endIdx = -1;
                        for (let i = startIdx; i < buffer.length; i++) {
                            if (buffer[i] === '{') bracketCount++;
                            else if (buffer[i] === '}') bracketCount--;
                            if (bracketCount === 0) {
                                endIdx = i;
                                break;
                            }
                        }

                        if (endIdx === -1) break;

                        const jsonStr = buffer.slice(startIdx, endIdx + 1);
                        try {
                            const data = JSON.parse(jsonStr);

                            if (!promptExtracted && data.prompt !== undefined) {
                                promptExtracted = true;
                                if (elements.actualpromptDiv) {
                                    elements.actualpromptDiv.innerHTML = `<div style="white-space:pre-wrap; color: var(--text-primary);">${data.prompt}</div>`;
                                }
                            } else {
                                if (data.thinking && elements.thinkResponseDiv) {
                                    thinkResponse += data.thinking;
                                    elements.thinkResponseDiv.innerHTML = marked.parse(thinkResponse);
                                    elements.thinkResponseDiv.scrollTop = elements.thinkResponseDiv.scrollHeight;
                                }
                                if (data.content) {
                                    fullAnswer += data.content;
                                }
                                answerBlock.innerHTML = marked.parse(fullAnswer);

                                if (!userScrolled) {
                                    elements.answerDiv.scrollTop = elements.answerDiv.scrollHeight;
                                }
                            }

                            buffer = buffer.slice(endIdx + 1).trimStart();
                        } catch (e) {
                            break;
                        }
                    }
                }

                // 記錄對話
                if (currentConvId) {
                    conversations[currentConvId].messages.push({ q, a: fullAnswer });
                } else {
                    const newId = `conv-${Date.now()}`;
                    conversations[newId] = {
                        title: q.slice(0, 10),
                        messages: [{ q, a: fullAnswer }]
                    };
                    currentConvId = newId;
                }
            } catch (err) {
                elements.answerDiv.innerHTML = `<p style="color:red;">出現錯誤：${err.message}</p>`;
            } finally {
                await loadConversations();
                if (currentConvId && conversations[currentConvId]) {
                    await switchConversation(currentConvId);
                }
                setButtonLoading(false);
            }
        }

        // 滾動監聽
        function setupScrollListener() {
            if (elements.answerDiv) {
                elements.answerDiv.addEventListener('scroll', () => {
                    const isNearBottom = elements.answerDiv.scrollHeight -
                        elements.answerDiv.scrollTop -
                        elements.answerDiv.clientHeight < 10;
                    if (!isNearBottom) {
                        userScrolled = true;
                    } else {
                        userScrolled = false;
                    }
                });
            }
        }

        // 初始化模組
        function init() {
            initElements();
            initMarked();

            // 綁定事件
            if (elements.sendBtn) {
                elements.sendBtn.addEventListener("click", sendQuestion);
            }

            if (elements.qaKnowledgeBaseSelect) {
                elements.qaKnowledgeBaseSelect.addEventListener('change', onQAKnowledgeBaseChange);
            }

            // 設置滾動監聽
            setupScrollListener();

            // 載入初始資料
            loadConversations();
            loadAvailableKnowledgeBases();
            checkThinkFeature();
            
            // 同步 UserMenu 的功能狀態
            syncWithUserMenu();
        }

        // 設定選擇的知識庫（供外部呼叫）
        function setSelectedKnowledgeBase(kbId) {
            if (elements.qaKnowledgeBaseSelect) {
                const options = elements.qaKnowledgeBaseSelect.options;
                for (let i = 0; i < options.length; i++) {
                    if (options[i].value === kbId) {
                        elements.qaKnowledgeBaseSelect.value = kbId;
                        selectedQAKBId = kbId;
                        return true;
                    }
                }
            }
            return false;
        }
        
        // 公開 API
        return {
            init,
            toggleDrawer,
            createNewConversation,
            switchConversation,
            deleteConversation,
            toggleNounAnalysis,
            toggleThinkResponse,
            showDrawerContent,
            sendQuestion,
            loadConversations,
            checkThinkFeature,
            syncWithUserMenu,
            setSelectedKnowledgeBase
        };
    })();

    // 導出到全域
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = QAModule;
    } else {
        window.QAModule = QAModule;
    }
})();