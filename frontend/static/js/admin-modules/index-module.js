/**
 * 索引管理模組
 * 處理檔案上傳、索引建立及相關操作
 */
(function() {
    'use strict';

    // 檔案相關變數
    let selectedFiles = [];

    // 公開 API
    const IndexModule = {
        // 初始化
        init: function() {
            this.bindEvents();
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

            modal.style.display = 'block';
        },

        closeBuildIndexModal: function() {
            const modal = document.getElementById('buildIndexModal');
            modal.style.display = 'none';
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
                alert('清除索引時發生錯誤，請重試');
                if (window.KnowledgeBaseModule && window.KnowledgeBaseModule.hideBuildIndexLoading) {
                    window.KnowledgeBaseModule.hideBuildIndexLoading();
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
                console.log(`知識庫 ${currentKBId} 索引清除成功`);
            });
        },

        executeOriginalPrepareSelected: async function() {
            const fileCheckboxList = document.getElementById("fileCheckboxList");
            const indexSummaryDiv = document.getElementById("indexSummary");
            const currentKBId = window.KnowledgeBaseModule ? window.KnowledgeBaseModule.getCurrentKBId() : null;
            
            const selected = Array.from(fileCheckboxList.querySelectorAll(".file-checkbox:checked")).map(cb => cb.value);
            if (selected.length === 0) {
                alert("請選擇檔案後再建立索引");
                if (window.KnowledgeBaseModule && window.KnowledgeBaseModule.hideBuildIndexLoading) {
                    window.KnowledgeBaseModule.hideBuildIndexLoading();
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
                } else {
                    indexSummaryDiv.innerHTML = `<p style='color:red;'>錯誤：${JSON.stringify(data)}</p>`;
                }
            } catch (err) {
                indexSummaryDiv.innerHTML = `<p style='color:red;'>發生錯誤：${err.message}</p>`;
            } finally {
                if (window.CommonUI) {
                    window.CommonUI.stopSpinner();
                }
                // 隱藏建立索引 loading overlay
                if (window.KnowledgeBaseModule && window.KnowledgeBaseModule.hideBuildIndexLoading) {
                    window.KnowledgeBaseModule.hideBuildIndexLoading();
                }
                await this.loadFileList();
                this.closeBuildIndexModal();
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

        // 清除索引
        clearIndex: async function() {
            const currentKBId = window.KnowledgeBaseModule ? window.KnowledgeBaseModule.getCurrentKBId() : null;
            const indexSummaryDiv = document.getElementById("indexSummary");
            
            if (!currentKBId) {
                alert("請先選擇知識庫");
                return;
            }

            if (window.CommonUI) {
                window.CommonUI.showSpinner();
            }
            indexSummaryDiv.innerHTML = "";
            try {
                const formData = new FormData();
                formData.append("kb_id", currentKBId);

                const res = await fetch("/api/vector/index/clear", { method: "POST", body: formData });
                const data = await res.json();
                if (res.ok && data.status === "cleared") {
                    indexSummaryDiv.innerHTML = `<p style="color:green;">知識庫 ${currentKBId} 的索引資料已清除。</p>`;
                } else {
                    indexSummaryDiv.innerHTML = `<p style="color:red;">錯誤：${data.error || JSON.stringify(data)}</p>`;
                }
            } catch (err) {
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
                alert("請先選擇知識庫");
                return;
            }
            selectedFiles = [];
            this.updatePendingFilesList();
            this.clearUploadError();
            document.getElementById('uploadFileModal').style.display = 'block';
        },

        closeUploadModal: function() {
            selectedFiles = [];
            this.updatePendingFilesList();
            this.clearUploadError();
            document.getElementById('uploadFileModal').style.display = 'none';
            this.loadFileList();
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
                let overwrite = false;
                if (duplicated.length > 0) {
                    overwrite = confirm(`以下檔案已存在，上傳會覆蓋檔案，是否繼續上傳？\n${duplicated.join("\n")}`);
                    if (!overwrite) {
                        this.showUploadError('已取消上傳（檔案重複）');
                        return;
                    }
                }

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
                        selectedFiles = selectedFiles.filter((file, index) => !checkedIndexes.includes(index));
                        this.updatePendingFilesList();
                        if (selectedFiles.length === 0) {
                            // 直接關閉對話框，不需要延遲
                            this.closeUploadModal();
                        }
                    }
                } else {
                    this.showUploadError(`上傳失敗：${JSON.stringify(data)}`);
                }

            } catch (err) {
                this.showUploadError(`上傳過程中出現異常，請通知系統管理員處理：${err.message}`);
            } finally {
                if (window.CommonUI) {
                    window.CommonUI.stopSpinner();
                }
                // 隱藏上傳 loading overlay
                if (window.KnowledgeBaseModule && window.KnowledgeBaseModule.hideUploadLoading) {
                    window.KnowledgeBaseModule.hideUploadLoading();
                }
            }
        },

        showUploadError: function(message) {
            const errorDiv = document.getElementById('uploadErrorMessage');
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        },

        clearUploadError: function() {
            const errorDiv = document.getElementById('uploadErrorMessage');
            errorDiv.style.display = 'none';
            errorDiv.textContent = '';
        },

        // 刪除檔案相關
        removeSelectedFiles: function() {
            const currentKBId = window.KnowledgeBaseModule ? window.KnowledgeBaseModule.getCurrentKBId() : null;
            const fileCheckboxList = document.getElementById("fileCheckboxList");
            
            if (!currentKBId) {
                alert("請先選擇知識庫");
                return;
            }

            const selected = Array.from(fileCheckboxList.querySelectorAll(".file-checkbox:checked")).map(cb => cb.value);
            if (selected.length === 0) {
                alert("請先勾選要刪除的檔案");
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

            document.getElementById('removeFileModal').style.display = 'block';
        },

        closeRemoveFileModal: function() {
            document.getElementById('removeFileModal').style.display = 'none';
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

                    alert(message);
                    await this.loadFileList();
                } else {
                    alert(`刪除失敗：${data.message || JSON.stringify(data)}`);
                }
            } catch (err) {
                alert(`刪除檔案時發生錯誤：${err.message}`);
            } finally {
                if (window.CommonUI) {
                    window.CommonUI.stopSpinner();
                }
            }
        },

        // 綁定事件
        bindEvents: function() {
            const prepareSelectedBtn = document.getElementById("prepareSelectedBtn");
            if (prepareSelectedBtn) {
                prepareSelectedBtn.onclick = () => {
                    const currentKBId = window.KnowledgeBaseModule ? window.KnowledgeBaseModule.getCurrentKBId() : null;
                    if (!currentKBId) {
                        alert("請先選擇知識庫");
                        return;
                    }
                    const fileCheckboxList = document.getElementById("fileCheckboxList");
                    const selected = Array.from(fileCheckboxList.querySelectorAll(".file-checkbox:checked")).map(cb => cb.value);
                    if (selected.length === 0) {
                        alert("請先勾選檔案");
                        return;
                    }
                    this.openBuildIndexModal();
                };
            }

            const uploadBtn = document.getElementById("uploadBtn");
            if (uploadBtn) {
                uploadBtn.onclick = () => this.openUploadModal();
            }
        }
    };

    // 導出模組
    window.IndexModule = IndexModule;
})();