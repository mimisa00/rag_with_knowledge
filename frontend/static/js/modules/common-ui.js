/**
 * 共用UI元件模組
 * 包含 Spinner、Modal、工具函數等共用功能
 */

const CommonUI = (() => {
    
    /**
     * 顯示載入動畫
     * @param {string} message - 載入提示訊息
     */
    function showSpinner(message = "系統處理中...") {
        const loaderOverlay = document.getElementById('loader-overlay');
        const loaderText = document.querySelector('#loader-overlay .loader-text');
        const loaderIcon = document.querySelector('#loader-overlay .loader');

        if (!loaderOverlay) return;

        // 顯示容器
        loaderOverlay.style.display = 'flex';
        loaderOverlay.style.opacity = '1';

        // 恢復動畫與透明度
        if (loaderIcon) {
            loaderIcon.style.animation = 'spin 1s linear infinite';
            loaderIcon.style.opacity = '1';
            loaderIcon.style.transition = 'none';
            loaderIcon.style.transform = 'rotate(0deg)';
        }

        if (loaderText) {
            loaderText.textContent = message;
            loaderText.style.opacity = '1';
            loaderText.style.transition = 'none';
        }
    }

    /**
     * 停止載入動畫（平滑過渡）
     */
    function stopSpinner() {
        const loader = document.getElementById('loader-overlay');
        const loaderText = document.querySelector('#loader-overlay .loader-text');
        const loaderIcon = document.querySelector('#loader-overlay .loader');
        
        if (!loader) return;

        // 更新顯示文字
        if (loaderIcon) {
            loaderIcon.style.transition = 'opacity 1s ease';
            loaderIcon.style.opacity = '0';
        }
        
        setTimeout(function () {
            if (loaderIcon) {
                // 強制 reflow，確保下一步 transition 生效
                void loaderIcon.offsetWidth;
                // 設置最終角度，並添加平滑旋轉 + 淡入
                loaderIcon.style.transition = 'transform 2s ease-out, opacity 1s ease-in';
                loaderIcon.style.transform = 'rotate(360deg)';
                loaderIcon.style.opacity = '1';
                loaderIcon.style.animation = 'none';
                loaderIcon.style.animation = 'slow-stop 2s ease-out forwards';
            }

            if (loaderText) {
                loaderText.style.transition = 'transform 2s ease-out, opacity 1s ease-in';
                loaderText.style.opacity = '1';
                loaderText.style.animation = 'none';
                loaderText.style.animation = '2s ease-out forwards';
                loaderText.textContent = '系統處理完成';
            }
        }, 600); // 等待淡出完成
        
        // 等待過渡結束後再關閉事件源
        setTimeout(function () {
            if (loader) {
                loader.style.display = "none";
            }
        }, 2000); // 等待過渡時間結束
    }

    /**
     * 隱藏載入動畫（快速隱藏）
     */
    function hideSpinner() {
        const loader = document.getElementById("loader-overlay");
        if (loader) {
            loader.style.opacity = "0";
            loader.style.transition = "opacity 0.3s ease";
            setTimeout(() => {
                loader.style.display = "none";
            }, 300);
        }
    }

    /**
     * HTML字串轉義
     * @param {string} text - 需要轉義的文字
     * @returns {string} 轉義後的文字
     */
    function escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /**
     * 設置按鈕載入狀態
     * @param {string} buttonId - 按鈕ID
     * @param {boolean} isLoading - 是否載入中
     */
    function setButtonLoading(buttonId, isLoading) {
        const btn = document.getElementById(buttonId);
        if (!btn) return;
        
        if (isLoading) {
            btn.dataset.originalText = btn.innerHTML;
            btn.innerHTML = '<span class="btn-loader"></span>';
            btn.classList.add("btn-loading");
            btn.disabled = true;
        } else {
            if (btn.dataset.originalText) {
                btn.innerHTML = btn.dataset.originalText;
                delete btn.dataset.originalText;
            }
            btn.classList.remove("btn-loading");
            btn.disabled = false;
        }
    }

    /**
     * 顯示模態框
     * @param {string} modalId - 模態框ID
     */
    function showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'block';
        }
    }

    /**
     * 關閉模態框
     * @param {string} modalId - 模態框ID
     */
    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * 清空表單欄位
     * @param {string[]} fieldIds - 欄位ID陣列
     */
    function clearFormFields(fieldIds) {
        fieldIds.forEach(id => {
            const field = document.getElementById(id);
            if (field) {
                field.value = '';
            }
        });
    }

    /**
     * 顯示錯誤訊息
     * @param {string} containerId - 容器ID
     * @param {string} message - 錯誤訊息
     */
    function showError(containerId, message) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `<p style="color:red;">${escapeHtml(message)}</p>`;
            container.style.display = 'block';
        }
    }

    /**
     * 隱藏錯誤訊息
     * @param {string} containerId - 容器ID
     */
    function hideError(containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = '';
            container.style.display = 'none';
        }
    }

    /**
     * 確認對話框
     * @param {string} message - 確認訊息
     * @returns {boolean} 使用者確認結果
     */
    function confirmAction(message) {
        return window.confirm(message);
    }

    /**
     * 顯示提示訊息
     * @param {string} message - 提示訊息
     */
    function showAlert(message) {
        window.alert(message);
    }

    /**
     * 切換元素顯示/隱藏
     * @param {string} elementId - 元素ID
     */
    function toggleElement(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            if (element.style.display === 'none') {
                element.style.display = 'block';
            } else {
                element.style.display = 'none';
            }
        }
    }

    /**
     * 防抖函數
     * @param {Function} func - 需要防抖的函數
     * @param {number} wait - 等待時間（毫秒）
     * @returns {Function} 防抖後的函數
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * 節流函數
     * @param {Function} func - 需要節流的函數
     * @param {number} limit - 時間間隔（毫秒）
     * @returns {Function} 節流後的函數
     */
    function throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // 公開API
    return {
        showSpinner,
        stopSpinner,
        hideSpinner,
        escapeHtml,
        setButtonLoading,
        showModal,
        closeModal,
        clearFormFields,
        showError,
        hideError,
        confirmAction,
        showAlert,
        toggleElement,
        debounce,
        throttle
    };
})();

// 導出到全域
window.CommonUI = CommonUI;

// 如果支援ES6模組，則導出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CommonUI;
}