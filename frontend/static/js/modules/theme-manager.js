/**
 * 主題管理器 - 處理主題切換和儲存
 */
class ThemeManager {
    static STORAGE_KEY = 'app-theme';
    static DEFAULT_THEME = 'default';
    static THEMES = ['default', 'dark', 'corporate'];
    
    /**
     * 初始化主題系統
     */
    static init() {
        // 從 localStorage 讀取儲存的主題
        const savedTheme = this.getSavedTheme();
        this.applyTheme(savedTheme);
        
        // 監聽系統主題變化（如果使用 auto 模式）
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (this.getSavedTheme() === 'auto') {
                    this.applyTheme('auto');
                }
            });
        }
        
        console.log(`主題管理器初始化完成，當前主題: ${savedTheme}`);
    }
    
    /**
     * 獲取儲存的主題設定
     */
    static getSavedTheme() {
        try {
            const theme = localStorage.getItem(this.STORAGE_KEY);
            return theme && this.THEMES.includes(theme) ? theme : this.DEFAULT_THEME;
        } catch (e) {
            console.warn('無法讀取主題設定:', e);
            return this.DEFAULT_THEME;
        }
    }
    
    /**
     * 儲存主題設定
     */
    static saveTheme(theme) {
        try {
            localStorage.setItem(this.STORAGE_KEY, theme);
        } catch (e) {
            console.warn('無法儲存主題設定:', e);
        }
    }
    
    /**
     * 應用主題
     */
    static applyTheme(theme) {
        // 處理 auto 模式
        if (theme === 'auto') {
            theme = this.getSystemPreferredTheme();
        }
        
        // 驗證主題
        if (!this.THEMES.includes(theme)) {
            theme = this.DEFAULT_THEME;
        }
        
        // 移除所有主題
        document.documentElement.removeAttribute('data-theme');
        
        // 應用新主題（如果不是預設主題）
        if (theme !== 'default') {
            document.documentElement.setAttribute('data-theme', theme);
        }
        
        // 觸發自定義事件
        window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
    }
    
    /**
     * 切換主題
     */
    static switchTheme(theme) {
        if (!theme || !this.THEMES.includes(theme)) {
            console.warn(`無效的主題: ${theme}`);
            return false;
        }
        
        this.applyTheme(theme);
        this.saveTheme(theme);
        
        console.log(`主題已切換至: ${theme}`);
        return true;
    }
    
    /**
     * 切換至下一個主題
     */
    static toggleTheme() {
        const current = this.getCurrentTheme();
        const currentIndex = this.THEMES.indexOf(current);
        const nextIndex = (currentIndex + 1) % this.THEMES.length;
        const nextTheme = this.THEMES[nextIndex];
        
        this.switchTheme(nextTheme);
        return nextTheme;
    }
    
    /**
     * 獲取當前主題
     */
    static getCurrentTheme() {
        const dataTheme = document.documentElement.getAttribute('data-theme');
        return dataTheme || 'default';
    }
    
    /**
     * 獲取系統偏好主題
     */
    static getSystemPreferredTheme() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'default';
    }
    
    /**
     * 創建主題切換器 UI
     */
    static createThemeSwitcher(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn(`找不到容器: ${containerId}`);
            return;
        }
        
        // 創建主題選擇器
        const switcher = document.createElement('div');
        switcher.className = 'theme-switcher';
        switcher.innerHTML = `
            <label for="theme-select" class="form-label">主題：</label>
            <select id="theme-select" class="form-control">
                <option value="default">淺色主題</option>
                <option value="dark">深色主題</option>
                <option value="corporate">企業主題</option>
            </select>
        `;
        
        container.appendChild(switcher);
        
        // 設定當前值
        const select = document.getElementById('theme-select');
        select.value = this.getCurrentTheme();
        
        // 綁定事件
        select.addEventListener('change', (e) => {
            this.switchTheme(e.target.value);
        });
    }
    
    /**
     * 創建主題切換按鈕
     */
    static createThemeToggleButton(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn(`找不到容器: ${containerId}`);
            return;
        }
        
        // 創建切換按鈕
        const button = document.createElement('button');
        button.className = 'btn btn-sm btn-outline theme-toggle-btn';
        button.title = '切換主題';
        button.innerHTML = this.getThemeIcon(this.getCurrentTheme());
        
        container.appendChild(button);
        
        // 綁定事件
        button.addEventListener('click', () => {
            const newTheme = this.toggleTheme();
            button.innerHTML = this.getThemeIcon(newTheme);
        });
        
        // 監聽主題變化事件
        window.addEventListener('themeChanged', (e) => {
            button.innerHTML = this.getThemeIcon(e.detail.theme);
        });
    }
    
    /**
     * 獲取主題圖標
     */
    static getThemeIcon(theme) {
        const icons = {
            'default': '<i class="fas fa-sun"></i>',
            'dark': '<i class="fas fa-moon"></i>',
            'corporate': '<i class="fas fa-briefcase"></i>'
        };
        return icons[theme] || icons['default'];
    }
}

// 當 DOM 載入完成時自動初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ThemeManager.init());
} else {
    ThemeManager.init();
}

// 導出給全域使用
window.ThemeManager = ThemeManager;