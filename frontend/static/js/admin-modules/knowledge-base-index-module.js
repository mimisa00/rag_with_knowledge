/**
 * 索引管理模組
 * 處理檔案上傳、索引建立及相關操作
 */
(function() {
    'use strict';

    // 檔案相關變數
    let selectedFiles = [];
    
    // 索引建立專用的檔案選擇狀態（獨立於檔案管理的勾選）
    let indexFileSelection = new Set();

    // 儲存系統預設值
    let systemChunkSize = 500;
    let systemChunkOverlap = 50;
    
    // 公開 API
    const IndexModule = {
        // 初始化
        init: function() {
            this.bindEvents();
            this.initIndexDropdown();
            this.loadSystemParams();
        },

        // 載入檔案列表
        loadFileList: async function() {
            const fileCheckboxList = document.getElementById("fileCheckboxList");
            const selectAllCheckbox = document.getElementById('selectAllUploadedFilesCheckbox');
            
            fileCheckboxList.innerHTML = "";
            
            const currentKBId = window.KnowledgeBaseModule ? window.KnowledgeBaseModule.getCurrentKBId() : null;
            
            if (!currentKBId) {
                fileCheckboxList.innerHTML = "<p style='color: #666; text-align: center; padding: 1rem;'>請先選擇知識庫</p>";
                selectAllCheckbox.style.display = 'none';
                return;
            }

            try {
                const formData = new FormData();
                formData.append("kb_id", currentKBId);
                const res = await fetch(`/api/document/list/files`, { method: "POST", body: formData });
                if (!res.ok) {
                    const text = await res.text();
                    throw new Error("伺服器錯誤：" + text);
                }
                const data = await res.json();
                if (!data.files || !Array.isArray(data.files)) {
                    throw new Error("伺服器回傳格式錯誤：" + JSON.stringify(data));
                }

                if (data.files.length === 0) {
                    fileCheckboxList.innerHTML = "<p style='color: #666; text-align: center; padding: 1rem;'>此知識庫尚無檔案</p>";
                    selectAllCheckbox.style.display = 'none';
                    return;
                }

                selectAllCheckbox.style.display = 'inline-block';

                data.files.forEach(f => {
                    const div = document.createElement("div");
                    div.style.display = "flex";
                    div.style.alignItems = "center";
                    div.style.justifyContent = "space-between";
                    div.style.padding = "0.8rem";
                    div.style.borderBottom = "1px solid #eee";
                    div.style.backgroundColor = "#fafafa";
                    div.style.marginBottom = "0.5rem";
                    div.style.borderRadius = "4px";

                    const leftDiv = document.createElement("div");
                    leftDiv.style.display = "flex";
                    leftDiv.style.alignItems = "center";
                    leftDiv.style.flex = "1";

                    const cb = document.createElement("input");
                    cb.type = "checkbox";
                    cb.value = f.name;
                    cb.className = "file-checkbox";
                    cb.onchange = () => this.updateUploadedFilesSelectAllState();
                    cb.style.marginRight = "0.8rem";
                    leftDiv.appendChild(cb);

                    const fileInfoDiv = document.createElement("div");
                    fileInfoDiv.style.display = "flex";
                    fileInfoDiv.style.flexDirection = "column";
                    fileInfoDiv.style.flex = "1";

                    const link = document.createElement("a");
                    link.href = `/md_viewer?file=${encodeURIComponent(f.name)}.md&kb_id=${encodeURIComponent(currentKBId)}`;
                    link.target = "_blank";
                    link.textContent = f.name;
                    link.style.textDecoration = "none";
                    link.style.color = "#007bff";
                    link.style.fontWeight = "500";
                    link.style.fontSize = "0.95rem";
                    link.style.marginBottom = "0.3rem";
                    link.onmouseover = function() { this.style.textDecoration = "underline"; };
                    link.onmouseout = function() { this.style.textDecoration = "none"; };
                    fileInfoDiv.appendChild(link);

                    const detailsDiv = document.createElement("div");
                    detailsDiv.style.display = "flex";
                    detailsDiv.style.gap = "1rem";
                    detailsDiv.style.fontSize = "0.8rem";
                    detailsDiv.style.color = "#666";

                    const sizeSpan = document.createElement("span");
                    const sizeInKB = (f.size / 1024).toFixed(1);
                    const sizeInMB = (f.size / (1024 * 1024)).toFixed(2);
                    const displaySize = f.size > 1024 * 1024 ? `${sizeInMB} MB` : `${sizeInKB} KB`;
                    sizeSpan.textContent = `📄 ${displaySize}`;
                    sizeSpan.style.color = "#28a745";
                    detailsDiv.appendChild(sizeSpan);

                    const typeSpan = document.createElement("span");
                    typeSpan.textContent = `🏷️ ${f.extension.toUpperCase()}`;
                    typeSpan.style.color = "#6f42c1";
                    detailsDiv.appendChild(typeSpan);

                    const timeSpan = document.createElement("span");
                    const uploadDate = new Date(f.upload_time);
                    const now = new Date();
                    const timeDiff = now - uploadDate;
                    const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

                    let timeText;
                    if (daysDiff === 0) {
                        timeText = `🕒 今天 ${uploadDate.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`;
                    } else if (daysDiff === 1) {
                        timeText = `🕒 昨天 ${uploadDate.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`;
                    } else if (daysDiff < 7) {
                        timeText = `🕒 ${daysDiff} 天前`;
                    } else {
                        timeText = `🕒 ${uploadDate.toLocaleDateString('zh-TW')}`;
                    }
                    timeSpan.textContent = timeText;
                    timeSpan.style.color = "#dc3545";
                    detailsDiv.appendChild(timeSpan);

                    fileInfoDiv.appendChild(detailsDiv);
                    leftDiv.appendChild(fileInfoDiv);

                    div.appendChild(leftDiv);
                    fileCheckboxList.appendChild(div);
                });
                this.updateUploadedFilesSelectAllState();
            } catch (err) {
                fileCheckboxList.innerHTML = `<span style="color:red;">載入失敗：${err.message}</span>`;
                selectAllCheckbox.style.display = 'none';
            }
        },

        // 全選功能
        toggleSelectAllUploadedFiles: function() {
            const selectAllCheckbox = document.getElementById('selectAllUploadedFilesCheckbox');
            const fileCheckboxes = document.querySelectorAll('#fileCheckboxList .file-checkbox');
            const isChecked = selectAllCheckbox.checked;

            fileCheckboxes.forEach(checkbox => {
                checkbox.checked = isChecked;
            });
        },

        updateUploadedFilesSelectAllState: function() {
            const selectAllCheckbox = document.getElementById('selectAllUploadedFilesCheckbox');
            const fileCheckboxes = document.querySelectorAll('#fileCheckboxList .file-checkbox');

            if (fileCheckboxes.length === 0) {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = false;
                return;
            }

            const checkedCount = Array.from(fileCheckboxes).filter(cb => cb.checked).length;

            if (checkedCount === 0) {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = false;
            } else if (checkedCount === fileCheckboxes.length) {
                selectAllCheckbox.checked = true;
                selectAllCheckbox.indeterminate = false;
            } else {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = true;
            }
        },

        // 建立索引相關
        openBuildIndexModal: function() {
            const modal = document.getElementById('buildIndexModal');
            const fileList = document.getElementById('filesToIndexList');
            const checkedFiles = document.querySelectorAll('#fileCheckboxList .file-checkbox:checked');
            
            // 檢查是否為首次建立索引
            const hasSeenParams = localStorage.getItem('kb_index_params_seen');
            const content = document.getElementById('chunkParamsContent');
            const icon = document.getElementById('chunkParamsToggleIcon');
            
            if (content && icon) {
                if (!hasSeenParams) {
                    // 首次使用：展開參數設定，箭頭朝下（不加 rotated）
                    content.style.display = 'block';
                    icon.classList.remove('rotated');
                    // 標記已看過
                    localStorage.setItem('kb_index_params_seen', 'true');
                } else {
                    // 非首次使用：收合參數設定，箭頭朝上（加 rotated）
                    content.style.display = 'none';
                    icon.classList.add('rotated');
                }
            }

            fileList.innerHTML = '';
            if (checkedFiles.length === 0) {
                fileList.innerHTML = '<li style="color: #999; font-style: italic;">未選擇任何檔案</li>';
            } else {
                checkedFiles.forEach(checkbox => {
                    const filename = checkbox.value;
                    const listItem = document.createElement('li');
                    listItem.textContent = filename;
                    listItem.style.whiteSpace = 'nowrap';
                    listItem.style.overflow = 'hidden';
                    listItem.style.textOverflow = 'ellipsis';
                    fileList.appendChild(listItem);
                });
            }

            modal.classList.remove('d-none');
            modal.style.display = 'block';
        },

        confirmBuildIndex: function() {
            // 顯示建立索引 loading overlay
            if (window.KnowledgeBaseModule && window.KnowledgeBaseModule.showBuildIndexLoading) {
                window.KnowledgeBaseModule.showBuildIndexLoading();
            }
            this.rebuildIndex();
        },

        rebuildIndex: function() {
            this.clearIndexForRebuild().then(() => {
                this.executeOriginalPrepareSelected();
            }).catch(error => {
                console.error('清除索引時發生錯誤:', error);
                Dialog.error('清除索引時發生錯誤，請重試');
                if (window.KnowledgeBaseModule && window.KnowledgeBaseModule.stopBuildIndexLoading) {
                    window.KnowledgeBaseModule.stopBuildIndexLoading();
                } else if (window.AdminUI) {
                    window.AdminUI.hideBuildIndexLoading();
                    window.AdminUI.disableBuildIndexModalControls(false);
                }
            });
        },

        clearIndexForRebuild: function() {
            const currentKBId = window.KnowledgeBaseModule ? window.KnowledgeBaseModule.getCurrentKBId() : null;
            
            if (!currentKBId) {
                return Promise.reject(new Error('請先選擇知識庫'));
            }

            const formData = new FormData();
            formData.append("kb_id", currentKBId);

            return fetch('/api/vector/index/clear', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                if (!data.success) {
                    throw new Error(data.error || data.message || '清除索引失敗');
                }
                // 知識庫索引清除成功
            });
        },

        executeOriginalPrepareSelected: async function() {
            const indexSummaryDiv = document.getElementById("indexSummary");
            const currentKBId = window.KnowledgeBaseModule ? window.KnowledgeBaseModule.getCurrentKBId() : null;
            
            // 使用索引專用的選擇狀態，而非檔案管理的勾選狀態
            const selected = Array.from(indexFileSelection);
            if (selected.length === 0) {
                Dialog.warning("請選擇檔案後再建立索引");
                if (window.KnowledgeBaseModule && window.KnowledgeBaseModule.stopBuildIndexLoading) {
                    window.KnowledgeBaseModule.stopBuildIndexLoading();
                } else if (window.AdminUI) {
                    window.AdminUI.hideBuildIndexLoading();
                    window.AdminUI.disableBuildIndexModalControls(false);
                }
                return;
            }

            if (window.CommonUI) {
                window.CommonUI.showSpinner();
            }
            // 顯示建立索引 loading overlay
            if (window.KnowledgeBaseModule && window.KnowledgeBaseModule.showBuildIndexLoading) {
                window.KnowledgeBaseModule.showBuildIndexLoading();
            }
            indexSummaryDiv.innerHTML = "索引建立中...";
            try {
                const formData = new FormData();
                selected.forEach(f => formData.append("filenames", f));
                formData.append("kb_id", currentKBId);
                
                // 獲取並添加 chunk 參數
                const chunkSize = document.getElementById('indexChunkSize')?.value;
                const chunkOverlap = document.getElementById('indexChunkOverlap')?.value;
                if (chunkSize) formData.append("chunk_size", chunkSize);
                if (chunkOverlap) formData.append("chunk_overlap", chunkOverlap);
                
                const res = await fetch("/api/vector/index/prepare/file", { method: "POST", body: formData });

                const contentType = res.headers.get("content-type") || "";
                let data;
                if (contentType.includes("application/json")) {
                    data = await res.json();
                } else {
                    const text = await res.text();
                    indexSummaryDiv.innerHTML = `<p style='color:red;'>伺服器回傳非 JSON 格式：<br><pre>${window.CommonUI ? window.CommonUI.escapeHtml(text) : text}</pre></p>`;
                    return;
                }

                if (res.ok && data.results) {
                    indexSummaryDiv.innerHTML = data.results.map(r => {
                        if (r.status === "success") {
                            return `<p style='color:green;'>${r.filename}：已擷取並建索引，分割成 ${r.chunks} 個區塊。</p>`;
                        } else {
                            return `<p style='color:red;'>${r.filename}：${r.message}</p>`;
                        }
                    }).join("");
                    
                    // 顯示成功提示
                    this.showIndexSuccessTips();
                } else {
                    indexSummaryDiv.innerHTML = `<p style='color:red;'>錯誤：${JSON.stringify(data)}</p>`;
                }
            } catch (err) {
                indexSummaryDiv.innerHTML = `<p style='color:red;'>發生錯誤：${err.message}</p>`;
            } finally {
                if (window.CommonUI) {
                    window.CommonUI.stopSpinner();
                }
                // 平滑停止建立索引 loading overlay
                if (window.KnowledgeBaseModule && window.KnowledgeBaseModule.stopBuildIndexLoading) {
                    window.KnowledgeBaseModule.stopBuildIndexLoading();
                }
                await this.loadFileList();
                
                // 更新索引狀態顯示
                if (window.KnowledgeBaseModule && window.KnowledgeBaseModule.checkIndexStatus) {
                    await window.KnowledgeBaseModule.checkIndexStatus(currentKBId);
                }
                
                // 更新 TAB 狀態（建立索引後）
                if (window.KnowledgeBaseModule && window.KnowledgeBaseModule.updateTabStates) {
                    await window.KnowledgeBaseModule.updateTabStates(currentKBId);
                }
                
                // 顯示索引參數資訊（建立索引後立即顯示）
                await this.showIndexParamsInfo(currentKBId);
                
                // 清空索引檔案選擇（不記憶）
                indexFileSelection.clear();
                this.updateIndexButtonBadge();
            }
        },

        // 顯示索引參數資訊
        showIndexParamsInfo: async function(kbId) {
            try {
                const res = await fetch(`/api/vector/index/status?kb_id=${encodeURIComponent(kbId)}`, {
                    method: 'GET',
                    credentials: 'include'
                });
                
                if (res.ok) {
                    const data = await res.json();
                    const paramsInfo = document.getElementById('indexParamsInfo');
                    
                    // 只要有索引就顯示參數資訊區塊
                    if (data.is_valid) {
                        // 顯示參數資訊，如果沒有具體值就顯示「系統預設」
                        const chunkSizeEl = document.getElementById('currentChunkSize');
                        const chunkOverlapEl = document.getElementById('currentChunkOverlap');
                        const createTimeEl = document.getElementById('indexCreateTime');
                        const statusEl = document.getElementById('indexStatusInfo');
                        
                        if (chunkSizeEl) {
                            chunkSizeEl.textContent = data.latest_chunk_size !== undefined ? 
                                data.latest_chunk_size : '系統預設';
                        }
                        
                        if (chunkOverlapEl) {
                            chunkOverlapEl.textContent = data.latest_chunk_overlap !== undefined ? 
                                data.latest_chunk_overlap : '系統預設';
                        }
                        
                        if (createTimeEl) {
                            createTimeEl.textContent = data.latest_index_time ? 
                                new Date(data.latest_index_time).toLocaleString('zh-TW') : '未記錄';
                        }
                        
                        if (statusEl) {
                            statusEl.textContent = '有效';
                        }
                        
                        if (paramsInfo) {
                            paramsInfo.classList.remove('d-none');
                        }
                    } else {
                        // 沒有索引時隱藏參數資訊
                        if (paramsInfo) {
                            paramsInfo.classList.add('d-none');
                        }
                    }
                }
            } catch (err) {
                console.error('獲取索引參數失敗:', err);
            }
        },
        
        // 顯示索引摘要
        showIndexSummary100: async function() {
            const currentKBId = window.KnowledgeBaseModule ? window.KnowledgeBaseModule.getCurrentKBId() : null;
            const indexSummaryDiv = document.getElementById("indexSummary");
            
            if (!currentKBId) {
                indexSummaryDiv.innerHTML = "<p style='color: #666;'>請先選擇知識庫</p>";
                return;
            }

            indexSummaryDiv.innerHTML = "載入中...";
            try {
                const res = await fetch(`/api/vector/index/summary/100?kb_id=${currentKBId}`, { method: "GET" });
                if (!res.ok) {
                    const err = await res.text();
                    throw new Error(err);
                }
                const data = await res.json();
                indexSummaryDiv.innerHTML = `<p>總共 <b>${data.count}</b> 個區塊：</p><ul>` +
                    data.chunks.map((c, i) => `<li><pre>${c.slice(0, 200).replace(/</g, "&lt;")}</pre></li>`).join("") +
                    "</ul>";
            } catch (err) {
                indexSummaryDiv.innerHTML = `<span style="color:red;">載入失敗：${err.message}</span>`;
            }
        },
        
        // 顯示完整索引內容
        showCurrentKBIndex: async function() {
            const currentKBId = window.KnowledgeBaseModule ? window.KnowledgeBaseModule.getCurrentKBId() : null;
            
            if (!currentKBId) {
                Dialog.warning("請先選擇知識庫");
                return;
            }

            // 開啟新分頁顯示完整索引內容
            const url = `/showindex?kb_id=${encodeURIComponent(currentKBId)}`;
            window.open(url, '_blank');
        },

        // 顯示成功提示
        showIndexSuccessTips: function() {
            const tipsEl = document.getElementById('indexSuccessTips');
            if (tipsEl) {
                tipsEl.classList.remove('d-none', 'fade-out');
                
                // 設置剛完成索引的標記，防止立即隱藏
                window.justCompletedIndexing = true;
                
                // 不自動隱藏，讓使用者手動關閉或切換 TAB 時隱藏
            }
        },
        
        // 隱藏成功提示
        hideIndexSuccessTips: function() {
            // 如果剛完成索引，則不隱藏
            if (window.justCompletedIndexing) {
                return;
            }
            
            const tipsEl = document.getElementById('indexSuccessTips');
            if (tipsEl) {
                tipsEl.classList.add('fade-out');
                setTimeout(() => {
                    tipsEl.classList.add('d-none');
                }, 500);
            }
        },
        
        // 跳轉到問答頁面（新分頁）
        goToQAPage: function() {
            const currentKBId = window.KnowledgeBaseModule ? window.KnowledgeBaseModule.getCurrentKBId() : null;
            
            if (!currentKBId) {
                Dialog.warning("請先選擇知識庫");
                return;
            }
            
            // 在新分頁開啟 dashboard 並帶上知識庫 ID
            window.open(`/dashboard?kb_id=${encodeURIComponent(currentKBId)}`, '_blank');
        },
        
        // 刪除索引（帶確認對話框）
        deleteIndex: function() {
            const currentKBId = window.KnowledgeBaseModule ? window.KnowledgeBaseModule.getCurrentKBId() : null;
            
            if (!currentKBId) {
                Dialog.warning("請先選擇知識庫");
                return;
            }
            
            Dialog.confirm(
                `確定要刪除知識庫「${currentKBId}」的所有索引嗎？\n此操作無法復原，需要重新建立索引。`,
                () => {
                    this.clearIndex();
                },
                {
                    title: '刪除索引確認',
                    type: 'danger',
                    confirmText: '確認刪除',
                    cancelText: '取消'
                }
            );
        },

        // 清除索引（實際執行）
        clearIndex: async function() {
            const currentKBId = window.KnowledgeBaseModule ? window.KnowledgeBaseModule.getCurrentKBId() : null;
            const indexSummaryDiv = document.getElementById("indexSummary");
            
            if (!currentKBId) {
                Dialog.warning("請先選擇知識庫");
                return;
            }

            if (window.CommonUI) {
                window.CommonUI.showSpinner('刪除索引中...');
            }
            indexSummaryDiv.innerHTML = "";
            try {
                const formData = new FormData();
                formData.append("kb_id", currentKBId);

                const res = await fetch("/api/vector/index/clear", { method: "POST", body: formData });
                const data = await res.json();
                if (res.ok && data.status === "cleared") {
                    Dialog.success(`知識庫「${currentKBId}」的索引已成功刪除`);
                    indexSummaryDiv.innerHTML = `<p style="color:green;">知識庫 ${currentKBId} 的索引資料已清除。</p>`;
                    
                    // 隱藏成功提示（如果還在顯示）
                    this.hideIndexSuccessTips();
                    
                    // 更新索引狀態顯示
                    if (window.KnowledgeBaseModule && window.KnowledgeBaseModule.checkIndexStatus) {
                        await window.KnowledgeBaseModule.checkIndexStatus(currentKBId);
                    }
                    
                    // 更新索引參數資訊（刪除索引後應該隱藏）
                    await this.showIndexParamsInfo(currentKBId);
                    
                    // 更新 TAB 狀態（檢查是否還有檔案和索引）
                    if (window.KnowledgeBaseModule && window.KnowledgeBaseModule.updateTabStates) {
                        await window.KnowledgeBaseModule.updateTabStates(currentKBId);
                    }
                } else {
                    Dialog.error(`刪除索引失敗：${data.error || '未知錯誤'}`);
                    indexSummaryDiv.innerHTML = `<p style="color:red;">錯誤：${data.error || JSON.stringify(data)}</p>`;
                }
            } catch (err) {
                Dialog.error(`發生錯誤：${err.message}`);
                indexSummaryDiv.innerHTML = `<p style="color:red;">發生錯誤：${err.message}</p>`;
            } finally {
                if (window.CommonUI) {
                    window.CommonUI.stopSpinner();
                }
            }
        },

        // 上傳檔案相關
        openUploadModal: function() {
            const currentKBId = window.KnowledgeBaseModule ? window.KnowledgeBaseModule.getCurrentKBId() : null;
            
            if (!currentKBId) {
                Dialog.warning("請先選擇知識庫");
                return;
            }
            selectedFiles = [];
            this.updatePendingFilesList();
            this.clearUploadError();
            const uploadModal = document.getElementById('uploadFileModal');
            if (uploadModal) {
                uploadModal.classList.remove('d-none');
                uploadModal.style.display = 'block';
            }
        },

        /* 手動關閉上傳 modal */
        closeUploadModal: async function() {
            selectedFiles = [];
            this.updatePendingFilesList();
            this.clearUploadError();
            const uploadModal = document.getElementById('uploadFileModal');
            
            if (uploadModal) {
                // 立即關閉（用於錯誤情況或用戶手動關閉）
                uploadModal.style.display = 'none';
                uploadModal.classList.add('d-none');
                this.cleanupModal(uploadModal);
            }
            await this.loadFileList();
            
            // 更新 TAB 狀態（檢查是否有檔案和索引）
            const currentKBId = window.KnowledgeBaseModule ? window.KnowledgeBaseModule.getCurrentKBId() : null;
            if (currentKBId && window.KnowledgeBaseModule && window.KnowledgeBaseModule.updateTabStates) {
                await window.KnowledgeBaseModule.updateTabStates(currentKBId);
            }
        },

        /* 手動關閉建立索引 modal */
        closeBuildIndexModal: function() {
            const modal = document.getElementById('buildIndexModal');
            if (modal) {
                // 立即關閉（用於錯誤情況或用戶手動關閉）
                modal.style.display = 'none';
                modal.classList.add('d-none');
                this.cleanupModal(modal);
            }
        },

        /* 自動關閉上傳 modal */
        closeUploadModalAuto: function() {
            const uploadModal = document.getElementById('uploadFileModal');
            if (uploadModal) {
                // 平滑淡出關閉
                uploadModal.style.opacity = '0';
                uploadModal.style.transition = 'opacity 2s ease';
                setTimeout(() => {
                    uploadModal.style.display = 'none';
                    uploadModal.classList.add('d-none');
                    this.cleanupModal(uploadModal);
                    // 重置 opacity 供下次使用
                    uploadModal.style.opacity = '1';
                    uploadModal.style.transition = '';
                }, 2000);
            }
        },

        // 純粹關閉建立索引 modal（不執行其他邏輯）
        closeBuildIndexModalAuto: function() {
            const modal = document.getElementById('buildIndexModal');
            if (modal) {
                // 平滑淡出關閉
                modal.style.opacity = '0';
                modal.style.transition = 'opacity 2s ease';
                setTimeout(() => {
                    modal.style.display = 'none';
                    modal.classList.add('d-none');
                    this.cleanupModal(modal);
                    // 重置 opacity 供下次使用
                    modal.style.opacity = '1';
                    modal.style.transition = '';
                }, 2000);
            }
        },

        // 清理 modal 的輔助方法
        cleanupModal: function(modal) {
            // 確保移除任何可能的 backdrop
            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) {
                backdrop.remove();
            }
            // 強制重繪以確保樣式更新
            document.body.style.overflow = '';
            void document.body.offsetHeight;
        },

        selectFiles: function() {
            const hiddenInput = document.getElementById('hiddenFileInput');
            hiddenInput.onchange = (e) => {
                const files = Array.from(e.target.files);
                const validFiles = [];
                for (let file of files) {
                    if (file.size > 10 * 1024 * 1024) {
                        this.showUploadError(`檔案 ${file.name} 大小超過10MB限制，已跳過`);
                        continue;
                    }
                    validFiles.push(file);
                }
                selectedFiles = validFiles;
                this.updatePendingFilesList();
                hiddenInput.value = '';
            };
            hiddenInput.click();
        },

        clearSelectedFiles: function() {
            const checkedCheckboxes = document.querySelectorAll('#pendingFilesList input[type="checkbox"]:checked');
            const filesToRemove = Array.from(checkedCheckboxes).map(cb => parseInt(cb.dataset.index));
            selectedFiles = selectedFiles.filter((file, index) => !filesToRemove.includes(index));
            this.updatePendingFilesList();
            this.clearUploadError();
        },

        updatePendingFilesList: function() {
            const listContainer = document.getElementById('pendingFilesList');
            const selectAllCheckbox = document.getElementById('selectAllFilesCheckbox');

            if (selectedFiles.length === 0) {
                listContainer.innerHTML = '<p style="color: #666; text-align: center; margin: 50px 0;">尚未選擇任何檔案</p>';
                selectAllCheckbox.style.display = 'none';
                return;
            }

            selectAllCheckbox.style.display = 'inline-block';

            let html = '';
            selectedFiles.forEach((file, index) => {
                html += `
                    <div style="display: flex; align-items: center; padding: 5px 0; border-bottom: 1px solid #eee;">
                        <input type="checkbox" data-index="${index}" style="margin-right: 10px;" class="file-item-checkbox" onchange="IndexModule.updateSelectAllState()">
                        <span style="font-weight: bold; margin-right: 10px;">${file.name}</span>
                        <span style="color: #666; font-size: 0.9em;">(${this.formatFileSize(file.size)})</span>
                    </div>
                `;
            });
            listContainer.innerHTML = html;
            this.updateSelectAllState();
        },

        toggleSelectAllFiles: function() {
            const selectAllCheckbox = document.getElementById('selectAllFilesCheckbox');
            const fileCheckboxes = document.querySelectorAll('#pendingFilesList .file-item-checkbox');
            const isChecked = selectAllCheckbox.checked;

            fileCheckboxes.forEach(checkbox => {
                checkbox.checked = isChecked;
            });
        },

        updateSelectAllState: function() {
            const selectAllCheckbox = document.getElementById('selectAllFilesCheckbox');
            const fileCheckboxes = document.querySelectorAll('#pendingFilesList .file-item-checkbox');

            if (fileCheckboxes.length === 0) {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = false;
                return;
            }

            const checkedCount = Array.from(fileCheckboxes).filter(cb => cb.checked).length;

            if (checkedCount === 0) {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = false;
            } else if (checkedCount === fileCheckboxes.length) {
                selectAllCheckbox.checked = true;
                selectAllCheckbox.indeterminate = false;
            } else {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = true;
            }
        },

        formatFileSize: function(bytes) {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
            return Math.round(bytes / (1024 * 1024)) + ' MB';
        },

        startUpload: async function() {
            const currentKBId = window.KnowledgeBaseModule ? window.KnowledgeBaseModule.getCurrentKBId() : null;
            
            if (selectedFiles.length === 0) {
                this.showUploadError('請先選擇檔案');
                return;
            }

            const checkedCheckboxes = document.querySelectorAll('#pendingFilesList .file-item-checkbox:checked');
            if (checkedCheckboxes.length === 0) {
                this.showUploadError('請先勾選要上傳的檔案');
                return;
            }

            const checkedIndexes = Array.from(checkedCheckboxes).map(cb => parseInt(cb.dataset.index));
            const filesToUpload = selectedFiles.filter((file, index) => checkedIndexes.includes(index));

            this.clearUploadError();

            try {
                const files = filesToUpload.map(f => f.name);
                let exists = {};
                try {
                    const formData = new FormData();
                    formData.append("kb_id", currentKBId);
                    files.forEach(f => formData.append("files", f));
                    const res = await fetch("/api/document/check/file/exists", { method: "POST", body: formData });
                    exists = await res.json();
                } catch (e) { exists = {}; }

                const duplicated = Object.entries(exists).filter(([k, v]) => v).map(([k]) => k);
                
                if (duplicated.length > 0) {
                    // 使用 Dialog.confirm 替代 confirm
                    Dialog.confirm(
                        `以下檔案已存在，上傳會覆蓋檔案，是否繼續上傳？\n${duplicated.join("\n")}`,
                        async () => {
                            // 確認覆蓋 - 繼續上傳
                            await this.performUpload(filesToUpload, currentKBId, true);
                        },
                        {
                            title: '檔案重複警告',
                            type: 'warning',
                            confirmText: '覆蓋並上傳',
                            cancelText: '取消上傳',
                            onCancel: () => {
                                this.showUploadError('已取消上傳（檔案重複）');
                            }
                        }
                    );
                } else {
                    // 沒有重複檔案，直接上傳
                    await this.performUpload(filesToUpload, currentKBId, false);
                }

            } catch (err) {
                this.showUploadError(`上傳過程中出現異常，請通知系統管理員處理：${err.message}`);
            } finally {
                if (window.CommonUI) {
                    window.CommonUI.stopSpinner();
                }
                // 平滑停止上傳 loading overlay
                if (window.KnowledgeBaseModule && window.KnowledgeBaseModule.stopUploadLoading) {
                    window.KnowledgeBaseModule.stopUploadLoading();
                }
            }
        },

        // 執行實際的檔案上傳
        performUpload: async function(filesToUpload, currentKBId, overwrite) {
            try {
                if (window.CommonUI) {
                    window.CommonUI.showSpinner('上傳檔案中...');
                }
                // 顯示上傳 loading overlay
                if (window.KnowledgeBaseModule && window.KnowledgeBaseModule.showUploadLoading) {
                    window.KnowledgeBaseModule.showUploadLoading();
                }

                const formData = new FormData();
                filesToUpload.forEach(f => formData.append("files", f));
                formData.append("overwrite", overwrite ? "true" : "false");
                formData.append("kb_id", currentKBId);

                const res = await fetch("/api/document/upload", { method: "POST", body: formData });
                const data = await res.json();

                if (res.ok && data.results) {
                    const errors = data.results.filter(r => r.status === 'error');
                    if (errors.length > 0) {
                        const errorMessages = errors.map(e => `${e.filename}: ${e.message}`).join('\n');
                        this.showUploadError(`上傳過程中出現異常，請通知系統管理員處理：\n${errorMessages}`);
                    } else {
                        // 獲取已勾選的檔案索引
                        const checkboxes = document.querySelectorAll('.pending-file-checkbox:checked');
                        const checkedIndexes = Array.from(checkboxes).map(cb => parseInt(cb.getAttribute('data-index')));
                        
                        selectedFiles = selectedFiles.filter((file, index) => !checkedIndexes.includes(index));
                        this.updatePendingFilesList();
                        
                        // 延遲執行其他邏輯，等待 loading overlay 動畫完成
                        setTimeout(async () => {
                            await this.loadFileList();
                            
                            // 更新 TAB 狀態（檢查是否有檔案和索引）
                            const currentKBId = window.KnowledgeBaseModule ? window.KnowledgeBaseModule.getCurrentKBId() : null;
                            if (currentKBId && window.KnowledgeBaseModule && window.KnowledgeBaseModule.updateTabStates) {
                                await window.KnowledgeBaseModule.updateTabStates(currentKBId);
                            }
                            
                            // 檢查是否為第一個檔案並顯示引導
                            if (window.GuideModule && currentKBId) {
                                const isFirstFile = await window.GuideModule.checkIsFirstFile(currentKBId);
                                window.GuideModule.showUploadSuccessGuide(isFirstFile);
                            }
                        }, 1000); // 等待整個同步淡出動畫完成後再執行 (4200ms + 2000ms + 400ms)
                    }
                } else {
                    this.showUploadError(`上傳失敗：${JSON.stringify(data)}`);
                }
            } catch (err) {
                this.showUploadError(`上傳過程中出現異常：${err.message}`);
            } finally {
                if (window.CommonUI) {
                    window.CommonUI.stopSpinner();
                }
                // 平滑停止上傳 loading overlay
                if (window.KnowledgeBaseModule && window.KnowledgeBaseModule.stopUploadLoading) {
                    window.KnowledgeBaseModule.stopUploadLoading();
                }
            }
        },

        showUploadError: function(message) {
            const errorDiv = document.getElementById('uploadErrorMessage');
            errorDiv.textContent = message;
            errorDiv.classList.remove('d-none');
            errorDiv.style.display = 'block';
        },

        clearUploadError: function() {
            const errorDiv = document.getElementById('uploadErrorMessage');
            errorDiv.style.display = 'none';
            errorDiv.classList.add('d-none');
            errorDiv.textContent = '';
        },

        // 刪除檔案相關
        removeSelectedFiles: function() {
            const currentKBId = window.KnowledgeBaseModule ? window.KnowledgeBaseModule.getCurrentKBId() : null;
            const fileCheckboxList = document.getElementById("fileCheckboxList");
            
            if (!currentKBId) {
                Dialog.warning("請先選擇知識庫");
                return;
            }

            const selected = Array.from(fileCheckboxList.querySelectorAll(".file-checkbox:checked")).map(cb => cb.value);
            if (selected.length === 0) {
                Dialog.warning("請先勾選要刪除的檔案");
                return;
            }

            const filesToRemoveList = document.getElementById('filesToRemoveList');
            let html = '';
            selected.forEach(filename => {
                html += `<div style="padding: 5px 0; border-bottom: 1px solid #eee;">
                    <i class="fa-solid fa-file" style="margin-right: 8px; color: #666;"></i>
                    <span style="font-weight: bold;">${filename}</span>
                </div>`;
            });
            filesToRemoveList.innerHTML = html;

            const removeModal = document.getElementById('removeFileModal');
            if (removeModal) {
                removeModal.classList.remove('d-none');
                removeModal.style.display = 'block';
            }
        },

        closeRemoveFileModal: function() {
            const removeModal = document.getElementById('removeFileModal');
            if (removeModal) {
                removeModal.style.display = 'none';
                removeModal.classList.add('d-none');
            }
        },

        confirmRemoveFiles: async function() {
            const currentKBId = window.KnowledgeBaseModule ? window.KnowledgeBaseModule.getCurrentKBId() : null;
            const fileCheckboxList = document.getElementById("fileCheckboxList");
            
            const selected = Array.from(fileCheckboxList.querySelectorAll(".file-checkbox:checked")).map(cb => cb.value);

            if (selected.length === 0) {
                this.closeRemoveFileModal();
                return;
            }

            this.closeRemoveFileModal();

            if (window.CommonUI) {
                window.CommonUI.showSpinner('刪除檔案中...');
            }
            try {
                const formData = new FormData();
                selected.forEach(f => formData.append("files", f));
                formData.append("kb_id", currentKBId);

                const res = await fetch("/api/document/delete/files", { method: "DELETE", body: formData });
                const data = await res.json();

                if (res.ok && data.results) {
                    const successCount = data.results.filter(r => r.status === "success").length;
                    const errorCount = data.results.filter(r => r.status === "error").length;

                    let message = "";
                    if (successCount > 0) {
                        message += `成功刪除 ${successCount} 個檔案`;
                    }
                    if (errorCount > 0) {
                        message += (message ? "，" : "") + `${errorCount} 個檔案刪除失敗`;
                    }

                    Dialog.success(message);
                    await this.loadFileList();
                    
                    // 更新 TAB 狀態（檢查是否還有檔案和索引）
                    const currentKBId = window.KnowledgeBaseModule ? window.KnowledgeBaseModule.getCurrentKBId() : null;
                    if (currentKBId && window.KnowledgeBaseModule && window.KnowledgeBaseModule.updateTabStates) {
                        await window.KnowledgeBaseModule.updateTabStates(currentKBId);
                    }
                } else {
                    Dialog.error(`刪除失敗：${data.message || JSON.stringify(data)}`);
                }
            } catch (err) {
                Dialog.error(`刪除檔案時發生錯誤：${err.message}`);
            } finally {
                if (window.CommonUI) {
                    window.CommonUI.stopSpinner();
                }
            }
        },

        // 初始化索引下拉選單
        initIndexDropdown: function() {
            const btn = document.getElementById('prepareSelectedBtn');
            if (!btn) return;
            
            // 確保按鈕有正確的結構
            const container = btn.parentElement;
            if (!container.classList.contains('index-button-container')) {
                // 包裝按鈕以支援下拉選單
                const wrapper = document.createElement('div');
                wrapper.className = 'index-button-container';
                btn.parentNode.insertBefore(wrapper, btn);
                wrapper.appendChild(btn);
                
                // 創建下拉選單容器
                const dropdown = document.createElement('div');
                dropdown.id = 'indexDropdown';
                dropdown.className = 'index-dropdown';
                wrapper.appendChild(dropdown);
            }
            
            const dropdown = document.getElementById('indexDropdown');
            let hoverTimer;
            let isInDropdown = false;
            
            // 滑鼠進入按鈕區域
            btn.addEventListener('mouseenter', () => {
                clearTimeout(hoverTimer);
                hoverTimer = setTimeout(() => {
                    this.showIndexDropdown();
                }, 200);
            });
            
            // 滑鼠進入下拉選單
            dropdown.addEventListener('mouseenter', () => {
                isInDropdown = true;
                clearTimeout(hoverTimer);
            });
            
            // 滑鼠離開下拉選單
            dropdown.addEventListener('mouseleave', () => {
                isInDropdown = false;
                hoverTimer = setTimeout(() => {
                    if (!isInDropdown) {
                        this.hideIndexDropdown();
                    }
                }, 300);
            });
            
            // 滑鼠離開按鈕區域
            btn.addEventListener('mouseleave', () => {
                clearTimeout(hoverTimer);
                hoverTimer = setTimeout(() => {
                    if (!isInDropdown) {
                        this.hideIndexDropdown();
                    }
                }, 300);
            });
        },
        
        // 顯示索引下拉選單
        showIndexDropdown: async function() {
            const dropdown = document.getElementById('indexDropdown');
            if (!dropdown) return;
            
            const currentKBId = window.KnowledgeBaseModule ? window.KnowledgeBaseModule.getCurrentKBId() : null;
            if (!currentKBId) return;
            
            // 每次開啟下拉選單時清空選擇（不記憶使用者的選擇）
            indexFileSelection.clear();
            this.updateIndexButtonBadge();
            
            // 載入檔案列表
            const files = await this.loadFileListForDropdown(currentKBId);
            
            if (files.length === 0) {
                // 無檔案時顯示提示
                dropdown.innerHTML = `
                    <div class="dropdown-header">
                        <span>無可用檔案</span>
                        <button class="dropdown-close-btn" onclick="IndexModule.hideIndexDropdown()">×</button>
                    </div>
                    <div class="dropdown-empty-state">
                        <p style="text-align: center; padding: 20px; color: #666;">
                            <i class="fas fa-folder-open" style="font-size: 32px; display: block; margin-bottom: 10px; opacity: 0.5;"></i>
                            尚無檔案可建立索引<br>
                            <small>請先到檔案管理上傳檔案</small>
                        </p>
                        <div class="dropdown-footer">
                            <button class="btn btn-sm btn-primary" onclick="IndexModule.hideIndexDropdown(); KBTabManager.switchTab('files')">
                                前往檔案管理
                            </button>
                        </div>
                    </div>
                `;
                dropdown.classList.add('show');
                return;
            }
            
            // 渲染下拉選單內容
            dropdown.innerHTML = `
                <div class="dropdown-header">
                    <span>選擇要建立索引的檔案</span>
                    <button class="dropdown-close-btn" onclick="IndexModule.hideIndexDropdown()">×</button>
                </div>
                <div class="dropdown-controls">
                    <label class="select-all-label">
                        <input type="checkbox" id="indexSelectAll" 
                               onchange="IndexModule.toggleIndexSelectAll()">
                        <span>全選 (${files.length} 個檔案)</span>
                    </label>
                </div>
                <div class="dropdown-file-list">
                    ${files.map(f => `
                        <label class="dropdown-file-item">
                            <input type="checkbox" 
                                   value="${f.name}" 
                                   class="index-file-check"
                                   onchange="IndexModule.updateIndexSelection('${f.name.replace(/'/g, "\\'")}', this.checked)">
                            <span class="file-info">
                                <span class="file-name">${f.name}</span>
                                <span class="file-meta">${this.formatFileSize(f.size)}</span>
                            </span>
                        </label>
                    `).join('')}
                </div>
                <div class="dropdown-footer">
                    <button class="btn btn-sm btn-secondary me-2" 
                            onclick="IndexModule.clearIndexSelection()">
                        清除選擇
                    </button>
                    <button class="btn btn-sm btn-primary" 
                            onclick="IndexModule.confirmIndexSelection()"
                            ${indexFileSelection.size === 0 ? 'disabled' : ''}>
                        確認建立索引 (${indexFileSelection.size})
                    </button>
                </div>
            `;
            
            dropdown.classList.add('show');
            this.updateIndexSelectAllState();
        },
        
        // 隱藏索引下拉選單
        hideIndexDropdown: function() {
            const dropdown = document.getElementById('indexDropdown');
            if (dropdown) {
                dropdown.classList.remove('show');
            }
        },
        
        // 載入檔案列表（用於下拉選單）
        loadFileListForDropdown: async function(kbId) {
            try {
                const formData = new FormData();
                formData.append("kb_id", kbId);
                const res = await fetch(`/api/document/list/files`, { 
                    method: "POST", 
                    body: formData 
                });
                
                if (!res.ok) {
                    throw new Error("無法載入檔案列表");
                }
                
                const data = await res.json();
                return data.files || [];
            } catch (err) {
                console.error('載入檔案列表失敗:', err);
                return [];
            }
        },
        
        // 更新索引檔案選擇
        updateIndexSelection: function(filename, checked) {
            if (checked) {
                indexFileSelection.add(filename);
            } else {
                indexFileSelection.delete(filename);
            }
            this.updateIndexButtonBadge();
            this.updateDropdownFooter();
        },
        
        // 全選/取消全選索引檔案
        toggleIndexSelectAll: function() {
            const selectAll = document.getElementById('indexSelectAll');
            const checkboxes = document.querySelectorAll('.index-file-check');
            
            checkboxes.forEach(cb => {
                cb.checked = selectAll.checked;
                if (selectAll.checked) {
                    indexFileSelection.add(cb.value);
                } else {
                    indexFileSelection.delete(cb.value);
                }
            });
            
            this.updateIndexButtonBadge();
            this.updateDropdownFooter();
        },
        
        // 更新全選狀態
        updateIndexSelectAllState: function() {
            const selectAll = document.getElementById('indexSelectAll');
            if (!selectAll) return;
            
            const checkboxes = document.querySelectorAll('.index-file-check');
            const checkedCount = document.querySelectorAll('.index-file-check:checked').length;
            
            if (checkedCount === 0) {
                selectAll.checked = false;
                selectAll.indeterminate = false;
            } else if (checkedCount === checkboxes.length) {
                selectAll.checked = true;
                selectAll.indeterminate = false;
            } else {
                selectAll.checked = false;
                selectAll.indeterminate = true;
            }
        },
        
        // 清除索引選擇
        clearIndexSelection: function() {
            indexFileSelection.clear();
            const checkboxes = document.querySelectorAll('.index-file-check');
            checkboxes.forEach(cb => cb.checked = false);
            this.updateIndexButtonBadge();
            this.updateDropdownFooter();
            this.updateIndexSelectAllState();
        },
        
        // 確認索引選擇並建立索引
        confirmIndexSelection: function() {
            if (indexFileSelection.size === 0) {
                Dialog.warning("請至少選擇一個檔案");
                return;
            }
            this.hideIndexDropdown();
            this.openBuildIndexModalForSelected();
        },
        
        // 更新按鈕上的數字標記
        updateIndexButtonBadge: function() {
            // 不再更新按鈕文字，保持按鈕名稱不變
            // 可以在這裡做其他需要的更新
        },
        
        // 更新下拉選單底部按鈕
        updateDropdownFooter: function() {
            const confirmBtn = document.querySelector('.dropdown-footer .btn-primary');
            if (confirmBtn) {
                confirmBtn.textContent = `確認建立索引 (${indexFileSelection.size})`;
                confirmBtn.disabled = indexFileSelection.size === 0;
            }
        },
        
        // 開啟建立索引確認 Modal（針對下拉選單選擇的檔案）
        openBuildIndexModalForSelected: function() {
            const modal = document.getElementById('buildIndexModal');
            const fileList = document.getElementById('filesToIndexList');
            
            fileList.innerHTML = '';
            if (indexFileSelection.size === 0) {
                fileList.innerHTML = '<li style="color: #999; font-style: italic;">未選擇任何檔案</li>';
            } else {
                indexFileSelection.forEach(filename => {
                    const listItem = document.createElement('li');
                    listItem.textContent = filename;
                    listItem.style.whiteSpace = 'nowrap';
                    listItem.style.overflow = 'hidden';
                    listItem.style.textOverflow = 'ellipsis';
                    fileList.appendChild(listItem);
                });
            }
            
            // 載入並設定 chunk 參數
            this.loadAndSetChunkParams();
            
            modal.classList.remove('d-none');
            modal.style.display = 'block';
        },
        
        // 綁定事件
        bindEvents: function() {
            const prepareSelectedBtn = document.getElementById("prepareSelectedBtn");
            if (prepareSelectedBtn) {
                // 點擊按鈕切換下拉選單的顯示/隱藏
                prepareSelectedBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation(); // 防止事件冒泡
                    
                    const dropdown = document.getElementById('indexDropdown');
                    if (dropdown) {
                        if (dropdown.classList.contains('show')) {
                            // 如果已經顯示，則隱藏
                            this.hideIndexDropdown();
                        } else {
                            // 如果未顯示，則立即顯示（不需要等待 hover 延遲）
                            this.showIndexDropdown();
                        }
                    }
                };
                
                // 設置 cursor 樣式提示使用者
                prepareSelectedBtn.style.cursor = 'pointer';
                prepareSelectedBtn.title = '點擊或將滑鼠移到按鈕上選擇檔案';
            }

            const uploadBtn = document.getElementById("uploadBtn");
            if (uploadBtn) {
                uploadBtn.onclick = () => this.openUploadModal();
            }
            
            // 綁定 chunk 參數輸入框的即時更新事件
            const chunkSizeInput = document.getElementById('indexChunkSize');
            const chunkOverlapInput = document.getElementById('indexChunkOverlap');
            
            if (chunkSizeInput) {
                chunkSizeInput.addEventListener('input', (e) => {
                    document.getElementById('chunkSizeValue').textContent = `(${e.target.value})`;
                });
            }
            
            if (chunkOverlapInput) {
                chunkOverlapInput.addEventListener('input', (e) => {
                    document.getElementById('chunkOverlapValue').textContent = `(${e.target.value})`;
                });
            }
        },
        
        // 載入系統參數
        loadSystemParams: async function() {
            try {
                const res = await fetch('/api/config/get', {
                    method: 'GET',
                    credentials: 'include'
                });
                
                if (res.ok) {
                    const config = await res.json();
                    systemChunkSize = parseInt(config.chunk_size || '500');
                    systemChunkOverlap = parseInt(config.chunk_overlap || '50');
                }
            } catch (err) {
                console.error('載入系統參數失敗:', err);
            }
        },
        
        // 載入並設定 chunk 參數
        loadAndSetChunkParams: function() {
            const chunkSizeInput = document.getElementById('indexChunkSize');
            const chunkOverlapInput = document.getElementById('indexChunkOverlap');
            const maxChunkSizeSpan = document.getElementById('maxChunkSize');
            const maxChunkOverlapSpan = document.getElementById('maxChunkOverlap');
            
            if (chunkSizeInput && chunkOverlapInput) {
                // 設定預設值為系統參數
                chunkSizeInput.value = systemChunkSize;
                chunkOverlapInput.value = systemChunkOverlap;
                
                // 設定最大值為系統參數
                chunkSizeInput.max = systemChunkSize;
                chunkOverlapInput.max = systemChunkOverlap;
                
                // 更新顯示的最大值
                if (maxChunkSizeSpan) maxChunkSizeSpan.textContent = systemChunkSize;
                if (maxChunkOverlapSpan) maxChunkOverlapSpan.textContent = systemChunkOverlap;
                
                // 更新顯示的當前值
                document.getElementById('chunkSizeValue').textContent = `(${systemChunkSize})`;
                document.getElementById('chunkOverlapValue').textContent = `(${systemChunkOverlap})`;
            }
        },
        
        // 重置 chunk 參數為預設值
        resetChunkParams: function() {
            const chunkSizeInput = document.getElementById('indexChunkSize');
            const chunkOverlapInput = document.getElementById('indexChunkOverlap');
            
            if (chunkSizeInput && chunkOverlapInput) {
                chunkSizeInput.value = systemChunkSize;
                chunkOverlapInput.value = systemChunkOverlap;
                
                document.getElementById('chunkSizeValue').textContent = `(${systemChunkSize})`;
                document.getElementById('chunkOverlapValue').textContent = `(${systemChunkOverlap})`;
            }
        },

        // 切換 chunk 參數區域的展開/收合狀態
        toggleChunkParams: function() {
            const content = document.getElementById('chunkParamsContent');
            const icon = document.getElementById('chunkParamsToggleIcon');
            
            if (content && icon) {
                // 使用 getComputedStyle 來獲取實際的顯示狀態
                const isHidden = content.style.display === 'none' || 
                                (content.style.display === '' && window.getComputedStyle(content).display === 'none');
                
                if (isHidden) {
                    // 展開內容，箭頭朝下（移除 rotated）
                    content.style.display = 'block';
                    icon.classList.remove('rotated');
                } else {
                    // 收合內容，箭頭朝上（加 rotated）
                    content.style.display = 'none';
                    icon.classList.add('rotated');
                }
            }
        }
    };

    // 導出模組
    window.IndexModule = IndexModule;
})();