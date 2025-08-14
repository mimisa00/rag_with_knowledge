/**
 * Script Loader 模組
 * 處理動態載入JS/CSS檔案並自動加上時間戳以避免快取問題
 */

const ScriptLoader = (() => {
    
    /**
     * 動態載入JavaScript檔案
     * @param {string} src - JS檔案路徑
     * @param {Object} options - 載入選項
     * @param {boolean} options.async - 是否異步載入（預設true）
     * @param {boolean} options.defer - 是否延遲載入（預設false）
     * @param {boolean} options.noCache - 是否強制不快取（預設true）
     * @param {Function} options.onload - 載入成功回調
     * @param {Function} options.onerror - 載入失敗回調
     * @returns {Promise} 載入Promise
     */
    function loadScript(src, options = {}) {
        return new Promise((resolve, reject) => {
            // 預設選項
            const config = {
                async: true,
                defer: false,
                noCache: true,
                onload: null,
                onerror: null,
                ...options
            };
            
            // 檢查是否已載入（根據原始路徑）
            const existingScript = document.querySelector(`script[data-src="${src}"]`);
            if (existingScript && !config.noCache) {
                console.log(`Script already loaded: ${src}`);
                resolve();
                return;
            }
            
            // 如果存在舊的，先移除
            if (existingScript) {
                existingScript.remove();
            }
            
            // 創建script標籤
            const script = document.createElement('script');
            
            // 加上時間戳避免快取
            let finalSrc = src;
            if (config.noCache) {
                const timestamp = Date.now();
                const separator = src.includes('?') ? '&' : '?';
                finalSrc = `${src}${separator}_t=${timestamp}`;
            }
            
            script.src = finalSrc;
            script.dataset.src = src; // 儲存原始路徑
            script.async = config.async;
            script.defer = config.defer;
            
            // 事件處理
            script.onload = () => {
                console.log(`Script loaded: ${src}`);
                if (config.onload) config.onload();
                resolve();
            };
            
            script.onerror = (error) => {
                console.error(`Failed to load script: ${src}`, error);
                if (config.onerror) config.onerror(error);
                reject(new Error(`Failed to load script: ${src}`));
            };
            
            // 加入到DOM
            document.head.appendChild(script);
        });
    }
    
    /**
     * 動態載入CSS檔案
     * @param {string} href - CSS檔案路徑
     * @param {Object} options - 載入選項
     * @param {boolean} options.noCache - 是否強制不快取（預設true）
     * @param {Function} options.onload - 載入成功回調
     * @param {Function} options.onerror - 載入失敗回調
     * @returns {Promise} 載入Promise
     */
    function loadCSS(href, options = {}) {
        return new Promise((resolve, reject) => {
            // 預設選項
            const config = {
                noCache: true,
                onload: null,
                onerror: null,
                ...options
            };
            
            // 檢查是否已載入
            const existingLink = document.querySelector(`link[data-href="${href}"]`);
            if (existingLink && !config.noCache) {
                console.log(`CSS already loaded: ${href}`);
                resolve();
                return;
            }
            
            // 如果存在舊的，先移除
            if (existingLink) {
                existingLink.remove();
            }
            
            // 創建link標籤
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            
            // 加上時間戳避免快取
            let finalHref = href;
            if (config.noCache) {
                const timestamp = Date.now();
                const separator = href.includes('?') ? '&' : '?';
                finalHref = `${href}${separator}_t=${timestamp}`;
            }
            
            link.href = finalHref;
            link.dataset.href = href; // 儲存原始路徑
            
            // 事件處理
            link.onload = () => {
                console.log(`CSS loaded: ${href}`);
                if (config.onload) config.onload();
                resolve();
            };
            
            link.onerror = (error) => {
                console.error(`Failed to load CSS: ${href}`, error);
                if (config.onerror) config.onerror(error);
                reject(new Error(`Failed to load CSS: ${href}`));
            };
            
            // 加入到DOM
            document.head.appendChild(link);
        });
    }
    
    /**
     * 批量載入JavaScript檔案
     * @param {string[]} scripts - JS檔案路徑陣列
     * @param {Object} options - 載入選項（套用到所有檔案）
     * @returns {Promise} 載入Promise
     */
    function loadScripts(scripts, options = {}) {
        const promises = scripts.map(src => loadScript(src, options));
        return Promise.all(promises);
    }
    
    /**
     * 批量載入CSS檔案
     * @param {string[]} styles - CSS檔案路徑陣列
     * @param {Object} options - 載入選項（套用到所有檔案）
     * @returns {Promise} 載入Promise
     */
    function loadStyles(styles, options = {}) {
        const promises = styles.map(href => loadCSS(href, options));
        return Promise.all(promises);
    }
    
    /**
     * 載入模組（按順序載入）
     * @param {string[]} modules - 模組路徑陣列
     * @param {Object} options - 載入選項
     * @returns {Promise} 載入Promise
     */
    async function loadModulesInOrder(modules, options = {}) {
        for (const module of modules) {
            await loadScript(module, options);
        }
    }
    
    /**
     * 載入受保護的管理員腳本
     * @param {string} scriptName - 腳本名稱（不含路徑）
     * @param {Object} options - 載入選項
     * @returns {Promise} 載入Promise
     */
    async function loadProtectedAdminScript(scriptName, options = {}) {
        try {
            // 加入時間戳參數以繞過快取（開發時使用）
            const timestamp = Date.now();
            const url = `/api/admin/scripts/${scriptName}?_t=${timestamp}`;
            
            // 使用 cookie 認證（後端會自動從 cookie 讀取 access_token）
            const response = await fetch(url, {
                method: 'GET',
                credentials: 'include',  // 確保包含 cookie
                headers: {
                    'Accept': 'application/javascript'
                }
            });
            
            if (!response.ok) {
                if (response.status === 403) {
                    throw new Error('無權限存取管理員腳本');
                }
                throw new Error(`載入腳本失敗: ${response.status}`);
            }
            
            const scriptContent = await response.text();
            
            // 創建並執行腳本
            const script = document.createElement('script');
            script.dataset.src = `/admin-modules/${scriptName}`; // 標記來源
            script.textContent = scriptContent;
            
            // 加入到 DOM
            document.head.appendChild(script);
            
            console.log(`Protected admin script loaded: ${scriptName}`);
            
            // 執行回調
            if (options.onload) options.onload();
            
        } catch (error) {
            console.error(`Failed to load protected admin script: ${scriptName}`, error);
            if (options.onerror) options.onerror(error);
            throw error;
        }
    }
    
    /**
     * 批量載入受保護的管理員腳本（按順序）
     * @param {string[]} scriptNames - 腳本名稱陣列
     * @param {Object} options - 載入選項
     * @returns {Promise} 載入Promise
     */
    async function loadProtectedAdminScriptsInOrder(scriptNames, options = {}) {
        for (const scriptName of scriptNames) {
            await loadProtectedAdminScript(scriptName, options);
        }
    }
    
    /**
     * 重新載入指定的腳本
     * @param {string} src - JS檔案路徑
     * @returns {Promise} 載入Promise
     */
    function reloadScript(src) {
        return loadScript(src, { noCache: true });
    }
    
    /**
     * 重新載入指定的CSS
     * @param {string} href - CSS檔案路徑
     * @returns {Promise} 載入Promise
     */
    function reloadCSS(href) {
        return loadCSS(href, { noCache: true });
    }
    
    /**
     * 移除指定的腳本
     * @param {string} src - JS檔案路徑
     */
    function removeScript(src) {
        const script = document.querySelector(`script[data-src="${src}"]`);
        if (script) {
            script.remove();
            console.log(`Script removed: ${src}`);
        }
    }
    
    /**
     * 移除指定的CSS
     * @param {string} href - CSS檔案路徑
     */
    function removeCSS(href) {
        const link = document.querySelector(`link[data-href="${href}"]`);
        if (link) {
            link.remove();
            console.log(`CSS removed: ${href}`);
        }
    }
    
    /**
     * 檢查腳本是否已載入
     * @param {string} src - JS檔案路徑
     * @returns {boolean} 是否已載入
     */
    function isScriptLoaded(src) {
        return !!document.querySelector(`script[data-src="${src}"]`);
    }
    
    /**
     * 檢查CSS是否已載入
     * @param {string} href - CSS檔案路徑
     * @returns {boolean} 是否已載入
     */
    function isCSSLoaded(href) {
        return !!document.querySelector(`link[data-href="${href}"]`);
    }
    
    // 公開API
    return {
        loadScript,
        loadCSS,
        loadScripts,
        loadStyles,
        loadModulesInOrder,
        loadProtectedAdminScript,
        loadProtectedAdminScriptsInOrder,
        reloadScript,
        reloadCSS,
        removeScript,
        removeCSS,
        isScriptLoaded,
        isCSSLoaded
    };
})();

// 如果支援ES6模組，則導出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScriptLoader;
}