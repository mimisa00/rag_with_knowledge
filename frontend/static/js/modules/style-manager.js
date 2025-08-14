/**
 * 樣式管理器 - 提供統一的樣式操作 API
 * 取代直接操作 element.style 的方式
 */
class StyleManager {
    
    /**
     * 顯示元素
     */
    static show(element) {
        if (!element) return;
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        if (element) {
            element.classList.remove('d-none');
            element.classList.remove('is-hidden');
        }
    }
    
    /**
     * 隱藏元素
     */
    static hide(element) {
        if (!element) return;
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        if (element) {
            element.classList.add('d-none');
        }
    }
    
    /**
     * 切換元素顯示/隱藏
     */
    static toggle(element) {
        if (!element) return;
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        if (element) {
            element.classList.toggle('d-none');
        }
    }
    
    /**
     * 檢查元素是否可見
     */
    static isVisible(element) {
        if (!element) return false;
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        return element && !element.classList.contains('d-none') && !element.classList.contains('is-hidden');
    }
    
    /**
     * 設定元素為載入狀態
     */
    static setLoading(element, isLoading = true) {
        if (!element) return;
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        if (element) {
            if (isLoading) {
                element.classList.add('is-loading');
                if (element.tagName === 'BUTTON') {
                    element.classList.add('btn-loading');
                    element.disabled = true;
                }
            } else {
                element.classList.remove('is-loading');
                if (element.tagName === 'BUTTON') {
                    element.classList.remove('btn-loading');
                    element.disabled = false;
                }
            }
        }
    }
    
    /**
     * 設定元素為禁用狀態
     */
    static setDisabled(element, isDisabled = true) {
        if (!element) return;
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        if (element) {
            if (isDisabled) {
                element.classList.add('is-disabled');
                element.setAttribute('disabled', 'disabled');
            } else {
                element.classList.remove('is-disabled');
                element.removeAttribute('disabled');
            }
        }
    }
    
    /**
     * 添加類別
     */
    static addClass(element, className) {
        if (!element || !className) return;
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        if (element) {
            const classes = className.split(' ').filter(c => c);
            element.classList.add(...classes);
        }
    }
    
    /**
     * 移除類別
     */
    static removeClass(element, className) {
        if (!element || !className) return;
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        if (element) {
            const classes = className.split(' ').filter(c => c);
            element.classList.remove(...classes);
        }
    }
    
    /**
     * 切換類別
     */
    static toggleClass(element, className) {
        if (!element || !className) return;
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        if (element) {
            element.classList.toggle(className);
        }
    }
    
    /**
     * 檢查是否有類別
     */
    static hasClass(element, className) {
        if (!element || !className) return false;
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        return element && element.classList.contains(className);
    }
    
    /**
     * 設定元素為活動狀態
     */
    static setActive(element, isActive = true) {
        if (!element) return;
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        if (element) {
            if (isActive) {
                element.classList.add('is-active');
            } else {
                element.classList.remove('is-active');
            }
        }
    }
    
    /**
     * 批量顯示元素
     */
    static showAll(...elements) {
        elements.forEach(el => this.show(el));
    }
    
    /**
     * 批量隱藏元素
     */
    static hideAll(...elements) {
        elements.forEach(el => this.hide(el));
    }
    
    /**
     * 顯示模態框
     */
    static showModal(modalId) {
        const modal = typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
        if (modal) {
            modal.classList.add('show');
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    }
    
    /**
     * 隱藏模態框
     */
    static hideModal(modalId) {
        const modal = typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
        if (modal) {
            modal.classList.remove('show');
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    }
    
    /**
     * 顯示載入器
     */
    static showLoader(loaderId = 'loader-overlay') {
        const loader = document.getElementById(loaderId);
        if (loader) {
            loader.classList.add('show');
            loader.style.display = 'flex';
        }
    }
    
    /**
     * 隱藏載入器
     */
    static hideLoader(loaderId = 'loader-overlay') {
        const loader = document.getElementById(loaderId);
        if (loader) {
            loader.classList.remove('show');
            setTimeout(() => {
                if (!loader.classList.contains('show')) {
                    loader.style.display = 'none';
                }
            }, 300);
        }
    }
    
    /**
     * 顯示抽屜
     */
    static openDrawer(drawerId) {
        const drawer = typeof drawerId === 'string' ? document.getElementById(drawerId) : drawerId;
        if (drawer) {
            drawer.classList.add('open');
        }
    }
    
    /**
     * 隱藏抽屜
     */
    static closeDrawer(drawerId) {
        const drawer = typeof drawerId === 'string' ? document.getElementById(drawerId) : drawerId;
        if (drawer) {
            drawer.classList.remove('open');
        }
    }
    
    /**
     * 切換抽屜
     */
    static toggleDrawer(drawerId) {
        const drawer = typeof drawerId === 'string' ? document.getElementById(drawerId) : drawerId;
        if (drawer) {
            drawer.classList.toggle('open');
        }
    }
    
    /**
     * 淡入效果
     */
    static fadeIn(element, duration = 300) {
        if (!element) return;
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        if (element) {
            element.style.opacity = '0';
            element.style.display = 'block';
            element.style.transition = `opacity ${duration}ms`;
            
            // 強制重繪
            element.offsetHeight;
            
            element.style.opacity = '1';
        }
    }
    
    /**
     * 淡出效果
     */
    static fadeOut(element, duration = 300) {
        if (!element) return;
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        if (element) {
            element.style.transition = `opacity ${duration}ms`;
            element.style.opacity = '0';
            
            setTimeout(() => {
                if (element.style.opacity === '0') {
                    element.style.display = 'none';
                }
            }, duration);
        }
    }
    
    /**
     * 滑動顯示
     */
    static slideDown(element, duration = 300) {
        if (!element) return;
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        if (element) {
            element.style.height = '0';
            element.style.overflow = 'hidden';
            element.style.display = 'block';
            element.style.transition = `height ${duration}ms`;
            
            const height = element.scrollHeight;
            element.style.height = height + 'px';
            
            setTimeout(() => {
                element.style.height = '';
                element.style.overflow = '';
                element.style.transition = '';
            }, duration);
        }
    }
    
    /**
     * 滑動隱藏
     */
    static slideUp(element, duration = 300) {
        if (!element) return;
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        if (element) {
            const height = element.scrollHeight;
            element.style.height = height + 'px';
            element.style.overflow = 'hidden';
            element.style.transition = `height ${duration}ms`;
            
            // 強制重繪
            element.offsetHeight;
            
            element.style.height = '0';
            
            setTimeout(() => {
                element.style.display = 'none';
                element.style.height = '';
                element.style.overflow = '';
                element.style.transition = '';
            }, duration);
        }
    }
    
    /**
     * 批量操作樣式
     */
    static batch(operations) {
        operations.forEach(({ action, element, ...params }) => {
            if (this[action]) {
                this[action](element, ...Object.values(params));
            }
        });
    }
}

// 導出給全域使用
window.StyleManager = StyleManager;