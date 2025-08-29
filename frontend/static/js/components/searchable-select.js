/**
 * SearchableSelect 元件
 * 將原生 select 元素轉換為可搜尋的自定義下拉選單
 */
class SearchableSelect {
    constructor(originalSelect, options = {}) {
        this.originalSelect = originalSelect;
        this.options = {
            placeholder: '請選擇...',
            searchPlaceholder: '搜尋...',
            noResultsText: '找不到符合的選項',
            maxHeight: '200px',
            allowClear: true,
            ...options
        };
        
        this.isOpen = false;
        this.filteredOptions = [];
        this.selectedIndex = -1;
        
        this.init();
    }
    
    /**
     * 初始化元件
     */
    init() {
        this.createWrapper();
        this.createDisplay();
        this.createDropdown();
        this.bindEvents();
        this.updateOptions();
        this.updateDisplay();
        
        // 隱藏原始 select
        this.originalSelect.style.display = 'none';
        
        // 如果原始 select 已經是禁用狀態，同步禁用狀態
        if (this.originalSelect.disabled) {
            this.disable();
        }
    }
    
    /**
     * 創建包裝容器
     */
    createWrapper() {
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'searchable-select-wrapper';
        this.wrapper.style.position = 'relative';
        this.wrapper.style.width = '100%';
        
        // 插入到原始 select 之前
        this.originalSelect.parentNode.insertBefore(this.wrapper, this.originalSelect);
        this.wrapper.appendChild(this.originalSelect);
    }
    
    /**
     * 創建顯示區域
     */
    createDisplay() {
        this.display = document.createElement('div');
        this.display.className = 'searchable-select-display form-control';
        this.display.style.cursor = 'pointer';
        this.display.style.display = 'flex';
        this.display.style.alignItems = 'center';
        this.display.style.justifyContent = 'space-between';
        this.display.innerHTML = `
            <span class="display-text">${this.options.placeholder}</span>
            <i class="fas fa-chevron-down dropdown-arrow"></i>
        `;
        
        this.wrapper.appendChild(this.display);
        this.displayText = this.display.querySelector('.display-text');
        this.dropdownArrow = this.display.querySelector('.dropdown-arrow');
    }
    
    /**
     * 創建下拉選單
     */
    createDropdown() {
        this.dropdown = document.createElement('div');
        this.dropdown.className = 'searchable-select-dropdown';
        this.dropdown.style.display = 'none';
        // 移除內聯樣式，讓 CSS 控制布局和滾動行為
        // 只保留必要的定位樣式
        
        // 搜尋輸入框
        this.searchInput = document.createElement('input');
        this.searchInput.type = 'text';
        this.searchInput.className = 'searchable-select-search';
        this.searchInput.placeholder = this.options.searchPlaceholder;
        // 移除內聯樣式，讓 CSS 控制外觀
        
        // 選項容器
        this.optionsContainer = document.createElement('div');
        this.optionsContainer.className = 'searchable-select-options scrollable-fade';
        
        this.dropdown.appendChild(this.searchInput);
        this.dropdown.appendChild(this.optionsContainer);
        this.wrapper.appendChild(this.dropdown);
    }
    
    /**
     * 綁定事件
     */
    bindEvents() {
        // 點擊顯示區域切換下拉選單
        this.display.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });
        
        // 搜尋輸入
        this.searchInput.addEventListener('input', (e) => {
            this.filterOptions(e.target.value);
        });
        
        // 鍵盤導航
        this.searchInput.addEventListener('keydown', (e) => {
            this.handleKeydown(e);
        });
        
        // 點擊外部關閉
        document.addEventListener('click', (e) => {
            if (!this.wrapper.contains(e.target)) {
                this.close();
            }
        });
        
        // 監聽原始 select 的變化
        this.originalSelect.addEventListener('change', () => {
            this.updateDisplay();
        });
        
        // 如果原始 select 被重新填充，更新選項
        const observer = new MutationObserver(() => {
            this.updateOptions();
            this.updateDisplay();
        });
        observer.observe(this.originalSelect, { childList: true, subtree: true });
    }
    
    /**
     * 處理鍵盤事件
     */
    handleKeydown(e) {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.navigateDown();
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.navigateUp();
                break;
            case 'Enter':
                e.preventDefault();
                if (this.selectedIndex >= 0 && this.selectedIndex < this.filteredOptions.length) {
                    this.selectOption(this.filteredOptions[this.selectedIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                this.close();
                break;
        }
    }
    
    /**
     * 向下導航
     */
    navigateDown() {
        if (this.filteredOptions.length === 0) return;
        
        this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredOptions.length - 1);
        this.highlightOption();
    }
    
    /**
     * 向上導航
     */
    navigateUp() {
        if (this.filteredOptions.length === 0) return;
        
        this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
        this.highlightOption();
    }
    
    /**
     * 高亮選項
     */
    highlightOption() {
        const options = this.optionsContainer.querySelectorAll('.searchable-select-option');
        options.forEach((option, index) => {
            option.classList.toggle('highlighted', index === this.selectedIndex);
        });
        
        // 滾動到選中項目
        if (this.selectedIndex >= 0) {
            const highlightedOption = options[this.selectedIndex];
            if (highlightedOption) {
                highlightedOption.scrollIntoView({
                    block: 'nearest',
                    behavior: 'smooth'
                });
            }
        }
    }
    
    /**
     * 更新選項列表
     */
    updateOptions() {
        this.allOptions = Array.from(this.originalSelect.options).map(option => ({
            value: option.value,
            text: option.textContent,
            selected: option.selected,
            disabled: option.disabled
        }));
        
        this.filteredOptions = [...this.allOptions];
    }
    
    /**
     * 過濾選項
     */
    filterOptions(searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        
        if (!term) {
            this.filteredOptions = [...this.allOptions];
        } else {
            this.filteredOptions = this.allOptions.filter(option => 
                option.text.toLowerCase().includes(term) || 
                option.value.toLowerCase().includes(term)
            );
        }
        
        this.selectedIndex = -1;
        this.renderOptions();
    }
    
    /**
     * 渲染選項
     */
    renderOptions() {
        this.optionsContainer.innerHTML = '';
        
        if (this.filteredOptions.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'searchable-select-no-results';
            noResults.textContent = this.options.noResultsText;
            noResults.style.padding = '12px';
            noResults.style.textAlign = 'center';
            noResults.style.color = 'var(--text-muted)';
            noResults.style.fontStyle = 'italic';
            this.optionsContainer.appendChild(noResults);
            return;
        }
        
        this.filteredOptions.forEach((option, index) => {
            const optionElement = document.createElement('div');
            optionElement.className = 'searchable-select-option';
            optionElement.style.padding = '10px 12px';
            optionElement.style.cursor = option.disabled ? 'not-allowed' : 'pointer';
            optionElement.style.transition = 'background-color 0.2s';
            
            if (option.disabled) {
                optionElement.style.color = 'var(--text-muted)';
                optionElement.style.backgroundColor = 'var(--bg-light)';
            } else {
                optionElement.addEventListener('mouseenter', () => {
                    if (!option.disabled) {
                        optionElement.style.backgroundColor = 'var(--bg-hover)';
                        this.selectedIndex = index;
                        this.highlightOption();
                    }
                });
                
                optionElement.addEventListener('mouseleave', () => {
                    if (!option.disabled) {
                        optionElement.style.backgroundColor = '';
                    }
                });
                
                optionElement.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (!option.disabled) {
                        this.selectOption(option);
                    }
                });
            }
            
            // 如果是當前選中的選項，添加標記
            if (option.selected) {
                optionElement.style.backgroundColor = 'rgba(var(--primary-rgb), 0.1)';
                optionElement.style.color = 'var(--primary)';
                optionElement.innerHTML = `<i class="fas fa-check" style="margin-right: 8px;"></i>${option.text}`;
            } else {
                optionElement.textContent = option.text;
            }
            
            this.optionsContainer.appendChild(optionElement);
        });
    }
    
    /**
     * 選擇選項
     */
    selectOption(option) {
        // 更新原始 select
        this.originalSelect.value = option.value;
        
        // 觸發 change 事件
        const event = new Event('change', { bubbles: true });
        this.originalSelect.dispatchEvent(event);
        
        this.updateDisplay();
        this.close();
    }
    
    /**
     * 更新顯示
     */
    updateDisplay() {
        const selectedOption = this.originalSelect.options[this.originalSelect.selectedIndex];
        
        if (selectedOption && selectedOption.value) {
            this.displayText.textContent = selectedOption.textContent;
            this.displayText.style.color = 'var(--text-primary)';
        } else {
            this.displayText.textContent = this.options.placeholder;
            this.displayText.style.color = 'var(--text-muted)';
        }
        
        this.updateOptions();
    }
    
    /**
     * 切換下拉選單
     */
    toggle() {
        if (this.isDisabled()) {
            return;
        }
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
    
    /**
     * 打開下拉選單
     */
    open() {
        this.isOpen = true;
        this.dropdown.style.display = 'block';
        this.dropdownArrow.style.transform = 'rotate(180deg)';
        this.searchInput.value = '';
        this.filterOptions('');
        this.renderOptions();
        
        // 焦點到搜尋框
        setTimeout(() => {
            this.searchInput.focus();
        }, 0);
    }
    
    /**
     * 關閉下拉選單
     */
    close() {
        this.isOpen = false;
        this.dropdown.style.display = 'none';
        this.dropdownArrow.style.transform = 'rotate(0deg)';
        this.selectedIndex = -1;
    }
    
    /**
     * 銷毀元件
     */
    destroy() {
        this.wrapper.parentNode.insertBefore(this.originalSelect, this.wrapper);
        this.wrapper.remove();
        this.originalSelect.style.display = '';
    }
    
    /**
     * 重新載入選項
     */
    reload() {
        this.updateOptions();
        this.updateDisplay();
        if (this.isOpen) {
            this.renderOptions();
        }
    }
    
    /**
     * 設置值
     */
    setValue(value) {
        this.originalSelect.value = value;
        this.updateDisplay();
    }
    
    /**
     * 獲取值
     */
    getValue() {
        return this.originalSelect.value;
    }
    
    /**
     * 獲取選中的選項文字
     */
    getSelectedText() {
        const selectedOption = this.originalSelect.options[this.originalSelect.selectedIndex];
        return selectedOption ? selectedOption.textContent : '';
    }
    
    /**
     * 禁用元件
     */
    disable() {
        this.originalSelect.disabled = true;
        this.display.classList.add('disabled');
        this.display.style.opacity = '0.6';
        this.display.style.cursor = 'not-allowed';
        this.display.style.backgroundColor = 'var(--bg-light)';
        this.close();
    }
    
    /**
     * 啟用元件
     */
    enable() {
        this.originalSelect.disabled = false;
        this.display.classList.remove('disabled');
        this.display.style.opacity = '';
        this.display.style.cursor = 'pointer';
        this.display.style.backgroundColor = '';
    }
    
    /**
     * 檢查是否禁用
     */
    isDisabled() {
        return this.originalSelect.disabled;
    }
}

/**
 * 初始化所有具有特定 class 的 select 元素
 */
function initSearchableSelects(selector = '.searchable-select') {
    const selects = document.querySelectorAll(selector);
    const instances = [];
    
    selects.forEach(select => {
        if (!select.dataset.searchableSelectInit) {
            const options = {
                placeholder: select.dataset.placeholder || '請選擇...',
                searchPlaceholder: select.dataset.searchPlaceholder || '搜尋...',
                noResultsText: select.dataset.noResults || '找不到符合的選項',
                maxHeight: select.dataset.maxHeight || '200px'
            };
            
            const instance = new SearchableSelect(select, options);
            instances.push(instance);
            select.dataset.searchableSelectInit = 'true';
            select.searchableSelectInstance = instance;
        }
    });
    
    return instances;
}

// 全域暴露
window.SearchableSelect = SearchableSelect;
window.initSearchableSelects = initSearchableSelects;

// 自動初始化
document.addEventListener('DOMContentLoaded', () => {
    initSearchableSelects();
});