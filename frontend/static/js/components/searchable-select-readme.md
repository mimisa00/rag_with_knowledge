# SearchableSelect 元件使用說明

## 簡介
SearchableSelect 是一個將原生 `<select>` 元素轉換為可搜尋下拉選單的 JavaScript 元件。特別適合用於選項較多的場景，提供流暢的搜尋體驗。

## 特色功能
- ✅ 即時搜尋過濾
- ✅ 鍵盤導航支援 (↑↓ 選擇, Enter 確認, Esc 關閉)
- ✅ 響應式設計，支援行動裝置
- ✅ 無障礙存取支援
- ✅ 模態框友好設計
- ✅ 自動初始化機制

## 基本使用

### 1. 引入檔案
```html
<!-- CSS -->
<link rel="stylesheet" href="/css/components/searchable-select.css">

<!-- JavaScript -->
<script src="/js/components/searchable-select.js"></script>
```

### 2. HTML 結構
```html
<select class="form-control searchable-select" id="mySelect" 
        data-placeholder="請選擇..." 
        data-search-placeholder="搜尋..." 
        data-no-results="找不到符合的選項">
    <option value="">請選擇</option>
    <option value="1">選項 1</option>
    <option value="2">選項 2</option>
    <!-- 更多選項... -->
</select>
```

### 3. 自動初始化
元件會在頁面載入時自動初始化所有具有 `searchable-select` class 的 select 元素。

## 設定選項

### 透過 data 屬性
- `data-placeholder`: 未選擇時的提示文字
- `data-search-placeholder`: 搜尋框的提示文字
- `data-no-results`: 無搜尋結果時的提示文字
- `data-max-height`: 下拉選單的最大高度

### 透過 JavaScript
```javascript
const select = document.getElementById('mySelect');
const searchableSelect = new SearchableSelect(select, {
    placeholder: '請選擇...',
    searchPlaceholder: '搜尋...',
    noResultsText: '找不到符合的選項',
    maxHeight: '200px'
});
```

## API 方法

### 基本操作
```javascript
const instance = select.searchableSelectInstance;

// 設定值
instance.setValue('1');

// 獲取值
const value = instance.getValue();

// 獲取選中文字
const text = instance.getSelectedText();

// 重新載入選項
instance.reload();

// 銷毀元件
instance.destroy();
```

### 動態更新選項
```javascript
// 修改原始 select 的選項後
const select = document.getElementById('mySelect');
const newOption = document.createElement('option');
newOption.value = '3';
newOption.textContent = '新選項';
select.appendChild(newOption);

// 重新載入 SearchableSelect
if (select.searchableSelectInstance) {
    select.searchableSelectInstance.reload();
}
```

## 樣式自訂

### CSS 變數覆寫
```css
.searchable-select-wrapper {
    --primary: #your-color;
    --border-color: #your-border-color;
    --bg-hover: #your-hover-color;
}
```

### 尺寸變化
```html
<!-- 小尺寸 -->
<div class="searchable-select-wrapper size-sm">
    <select class="searchable-select">...</select>
</div>

<!-- 大尺寸 -->
<div class="searchable-select-wrapper size-lg">
    <select class="searchable-select">...</select>
</div>
```

## 在模態框中使用

SearchableSelect 元件已針對模態框使用進行最佳化，包含：
- 正確的 z-index 設定
- 響應式定位
- 焦點管理

```html
<div class="modal">
    <div class="modal-content">
        <select class="searchable-select" ...>
            <!-- 選項 -->
        </select>
    </div>
</div>
```

## 事件監聽

元件會保持原始 select 元素的事件觸發：

```javascript
document.getElementById('mySelect').addEventListener('change', function(e) {
    console.log('選中值改變:', e.target.value);
});
```

## 瀏覽器支援

- Chrome 60+
- Firefox 60+
- Safari 12+
- Edge 79+
- iOS Safari 12+
- Chrome Android 60+

## 已知限制

1. 不支援 `<optgroup>` 標籤
2. 不支援多選模式
3. 需要 JavaScript 才能運作

## 故障排除

### 選項未更新
確保在動態修改選項後調用 `reload()` 方法：
```javascript
select.searchableSelectInstance.reload();
```

### 樣式問題
檢查 CSS 變數是否正確載入：
```css
:root {
    --primary: #667eea;
    --border-color: #e2e8f0;
    /* ... 其他變數 */
}
```

### 焦點問題
確保模態框的 z-index 設定正確，SearchableSelect 會自動調整為模態框 z-index + 10。