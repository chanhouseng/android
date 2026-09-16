import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root = process.cwd();
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');
const expectedTitles = [
  'class 1', 'class 2', 'class 3', 'class 4', 'class 5', 'class 6',
  'class 7', 'class 8', 'class 9', 'class 10', 'class 11', 'class 12',
  'Android 動畫', 'AlertDialog 用法', 'CheckBox 的用法', 'Kotlin 日期時間及相關處理',
  'NumberPicker 用法', 'SeekBar 的用法', '日期選擇器用法', '打開其他 App 的 Activity',
  '打開新Activity並要求返回結果', '自定義 Spinner', '判斷上下左右滑動',
  'Toolbar 建立標題欄菜單', 'ViewPager 顯示 Fragment', 'WebView', '動態加入元素',
  '建立  Navigation Drawer', '建立彈出菜單', '為 TextView 某段字符增加樣式',
  '時間選擇器用法', '圖片手指放大或縮小', '實現拖曳功能', '播放音頻',
];
const expectedDescriptions = [
  'ImageVIew, EditText, checkbox, radioButton, Spinner,',
  '判斷checkBox點擊, 獲得radioButton所選內容, 獲得spinner選中內容',
  '隨機數, while, break, arrayof',
  'intent, CountDownTimer',
  'function, arrayListOf, contains, startsWith, 打開電話app, 打開指定網址',
  '生命週期, oneSaveInstance保存數據, checkBox點擊狀態改變, EditText輸入改變, RadioButton選擇改變, shape圖形',
  'layoutInflater, 定義 class',
  'getSharedPreferences, 轉換字串, 轉換列表, 獲得網絡資料',
  '網絡圖片, 向指定網址發送數據, 打開新Activity並要求返回結果, 系統提示',
  'bottomNavigationView 及其兩種轉換畫面方法, AlertDialog',
  '四種動畫, 動畫監聽器, valueAnimator 及其監聽器',
  'RecyclerView 相關內容, 自定義 AlertDialog',
  '', '建立單選式 AlertDialog', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
];
const expectedResources = expectedTitles.map((title, index) => ({
  category: index < 12 ? 'selection' : 'intensive',
  title,
  description: expectedDescriptions[index],
}));

function loadPdfLibrary() {
  const context = { console, globalThis: {} };
  vm.runInNewContext(read('assets/js/pdf-library.js'), context, { filename: 'pdf-library.js' });
  return context.globalThis.AndroidLearningPdfLibrary;
}

test('PDF page loads the shared foundation, App Shell and PDF resources', () => {
  for (const file of ['assets/css/resources.css', 'assets/js/pdf-library.js']) {
    assert.equal(existsSync(path.join(root, file)), true, `${file} should exist`);
  }

  const html = read('pdf.html');
  assert.match(html, /<html\b[^>]*lang=["']zh-Hant["'][^>]*data-site-root=["']\.\/["']/i);
  assert.match(html, /href=["']assets\/css\/foundation\.css["']/);
  assert.match(html, /href=["']assets\/css\/app-shell\.css["']/);
  assert.match(html, /href=["']assets\/css\/resources\.css["']/);
  assert.match(html, /src=["']assets\/js\/site-navigation\.js["']/);
  assert.match(html, /src=["']assets\/js\/pdf-library\.js["']/);
  assert.match(html, /class=["'][^"']*skip-link/);
  assert.match(html, /data-site-navigation=["']desktop["']/);
  assert.match(html, /data-site-navigation=["']mobile["']/);
  assert.match(html, /id=["']main-content["']/);
});

test('PDF page preserves 12 selection and 22 intensive-training resources', () => {
  const html = read('pdf.html');
  const items = [...html.matchAll(/<article\b[^>]*data-pdf-item[^>]*data-category=["']([^"']+)["'][^>]*>/gi)];
  assert.equal(items.length, 34);
  assert.deepEqual(items.map(([tag, category]) => ({
    category,
    title: tag.match(/data-title=["']([^"']*)["']/i)?.[1],
    description: tag.match(/data-description=["']([^"']*)["']/i)?.[1],
  })), expectedResources);
  assert.equal(items.filter(([, category]) => category === 'selection').length, 12);
  assert.equal(items.filter(([, category]) => category === 'intensive').length, 22);

  for (const text of [
    'class 1', 'ImageVIew, EditText, checkbox, radioButton, Spinner',
    'class 6', '生命週期, oneSaveInstance保存數據',
    'class 12', 'RecyclerView 相關內容, 自定義 AlertDialog',
    'Android 動畫', 'AlertDialog 用法', '建立單選式 AlertDialog',
    'Kotlin 日期時間及相關處理', '實現拖曳功能', '播放音頻',
  ]) assert.match(html, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('every PDF resource has valid open and same-origin download links', () => {
  const html = read('pdf.html');
  const itemBlocks = [...html.matchAll(/<article\b[^>]*data-pdf-item[\s\S]*?<\/article>/gi)].map((match) => match[0]);
  assert.equal(itemBlocks.length, 34);

  for (const block of itemBlocks) {
    const openHref = block.match(/<a\b[^>]*data-pdf-open[^>]*href=["']([^"']+)["'][^>]*>/i)?.[1];
    const downloadHref = block.match(/<a\b[^>]*data-pdf-download[^>]*href=["']([^"']+)["'][^>]*>/i)?.[1];
    assert.ok(openHref, 'resource should have an open link');
    assert.equal(downloadHref, openHref, 'open and download should use the same file');
    assert.equal(existsSync(path.join(root, decodeURIComponent(openHref))), true, `${openHref} should exist`);
    assert.match(block, /data-pdf-open[^>]*target=["']_blank["'][^>]*rel=["']noopener["']|target=["']_blank["'][^>]*rel=["']noopener["'][^>]*data-pdf-open/i);
    assert.match(block, /data-pdf-download[^>]*download(?:=["'][^"']*["'])?/i);
  }
});

test('each PDF action has a resource-specific accessible name', () => {
  const html = read('pdf.html');
  const itemBlocks = [...html.matchAll(/<article\b[^>]*data-pdf-item[\s\S]*?<\/article>/gi)].map((match) => match[0]);
  const labels = [];

  itemBlocks.forEach((block, index) => {
    const title = expectedTitles[index];
    const openLabel = block.match(/data-pdf-open[^>]*aria-label=["']([^"']+)["']/i)?.[1];
    const downloadLabel = block.match(/data-pdf-download[^>]*aria-label=["']([^"']+)["']/i)?.[1];
    assert.equal(openLabel, `開啟 ${title} PDF`);
    assert.equal(downloadLabel, `下載 ${title} PDF`);
    labels.push(openLabel, downloadLabel);
  });

  assert.equal(new Set(labels).size, 68);
});

test('known broken PDF URLs are corrected and the World Skill reference remains', () => {
  const html = read('pdf.html');
  assert.match(html, /pdf\/密集式訓練\/NumberPicker%20用法\.pdf/);
  assert.match(html, /pdf\/密集式訓練\/SeekBar%20的用法\.pdf/);
  assert.doesNotMatch(html, /href=["']pdf\/密集式訓練\/NumberPicker["']/);
  assert.doesNotMatch(html, /href=["']pdf\/密集式訓練SeekBar["']/);
  assert.match(html, /href=["']world%20skill\/exercise12\.html["'][^>]*target=["']_blank["'][^>]*rel=["']noopener["']/);
});

test('PDF filtering normalizes Unicode and combines query with category', () => {
  const library = loadPdfLibrary();
  const items = [
    { title: 'Ｋｏｔｌｉｎ 日期', description: '時間處理', category: 'intensive' },
    { title: 'class 1', description: 'ImageView', category: 'selection' },
    { title: 'class 2', description: 'Spinner', category: 'selection' },
  ];

  assert.ok(library);
  assert.deepEqual(Array.from(library.filterItems(items, { query: 'kotlin', category: 'all' }), (item) => item.title), ['Ｋｏｔｌｉｎ 日期']);
  assert.deepEqual(Array.from(library.filterItems(items, { query: 'imageview', category: 'selection' }), (item) => item.title), ['class 1']);
  assert.deepEqual(Array.from(library.filterItems(items, { query: '', category: 'selection' }), (item) => item.title), ['class 1', 'class 2']);
  assert.deepEqual(Array.from(library.filterItems(items, { query: '時間', category: 'selection' })), []);
});

test('PDF enhancement updates search, categories, count, empty state and reset behavior', () => {
  const library = loadPdfLibrary();
  const element = (dataset = {}) => ({
    dataset,
    hidden: false,
    value: '',
    textContent: '',
    attributes: new Map(),
    listeners: new Map(),
    addEventListener(type, listener) { this.listeners.set(type, listener); },
    dispatch(type, extra = {}) {
      this.listeners.get(type)?.({ currentTarget: this, preventDefault() {}, ...extra });
    },
    setAttribute(name, value) { this.attributes.set(name, value); },
    getAttribute(name) { return this.attributes.get(name); },
    focus() { this.focused = true; },
  });
  const searchForm = element();
  const queryInput = element();
  const clearButton = element();
  clearButton.hidden = true;
  const count = element();
  const emptyState = element();
  emptyState.hidden = true;
  const resetButton = element();
  const categoryButtons = ['all', 'selection', 'intensive'].map((category) => element({ pdfCategory: category }));
  const sections = ['selection', 'intensive'].map((category) => element({ pdfSection: category }));
  const items = [
    element({ title: 'class 1', description: 'ImageView', category: 'selection' }),
    element({ title: 'Kotlin 日期', description: '時間處理', category: 'intensive' }),
    element({ title: 'WebView', description: '', category: 'intensive' }),
  ];
  const singles = new Map([
    ['[data-pdf-search]', searchForm],
    ['[data-pdf-query]', queryInput],
    ['[data-pdf-clear]', clearButton],
    ['[data-pdf-count]', count],
    ['[data-pdf-empty]', emptyState],
    ['[data-pdf-reset]', resetButton],
  ]);
  const documentRef = {
    querySelector(selector) { return singles.get(selector); },
    querySelectorAll(selector) {
      if (selector === '[data-pdf-category]') return categoryButtons;
      if (selector === '[data-pdf-section]') return sections;
      if (selector === '[data-pdf-item]') return items;
      return [];
    },
  };

  library.enhance(documentRef);
  assert.equal(count.textContent, '顯示 3 份 PDF');
  queryInput.value = '時間';
  queryInput.dispatch('input');
  assert.deepEqual(items.map(({ hidden }) => hidden), [true, false, true]);
  assert.equal(count.textContent, '顯示 1 份 PDF');
  assert.equal(clearButton.hidden, false);

  categoryButtons[0].dispatch('click');
  queryInput.value = '不存在';
  queryInput.dispatch('input');
  assert.equal(emptyState.hidden, false);
  assert.deepEqual(sections.map(({ hidden }) => hidden), [true, true]);

  queryInput.dispatch('keydown', { key: 'Escape' });
  assert.equal(queryInput.value, '');
  assert.equal(queryInput.focused, true);
  assert.equal(count.textContent, '顯示 3 份 PDF');

  categoryButtons[1].dispatch('click');
  assert.equal(count.textContent, '顯示 1 份 PDF');
  resetButton.dispatch('click');
  assert.equal(categoryButtons[0].getAttribute('aria-pressed'), 'true');
  assert.equal(count.textContent, '顯示 3 份 PDF');
});

test('PDF page exposes search, category, count, clear and reset controls progressively', () => {
  const html = read('pdf.html');
  assert.match(html, /<form\b[^>]*data-pdf-search/);
  assert.match(html, /placeholder=["'][^"']*名稱或說明[^"']*["']/);
  for (const category of ['all', 'selection', 'intensive']) {
    assert.match(html, new RegExp(`data-pdf-category=["']${category}["']`));
  }
  assert.match(html, /data-pdf-count[^>]*aria-live=["']polite["']/);
  assert.match(html, /data-pdf-clear/);
  assert.match(html, /data-pdf-empty/);
  assert.match(html, /data-pdf-reset/);
  assert.doesNotMatch(html, /全文搜尋/);
});

test('resource styles use tokens, responsive layout and no fixed cards or floats', () => {
  const css = read('assets/css/resources.css');
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|\brgba?\s*\(/i);
  assert.doesNotMatch(css, /\b\d+(?:\.\d+)?px\b/i);
  assert.doesNotMatch(css, /\bfloat\s*:/i);
  for (const [, declarations] of css.matchAll(/\.pdf-resource\s*\{([^}]*)\}/gi)) {
    assert.doesNotMatch(declarations, /(?:^|;)\s*height\s*:/i);
  }
  assert.match(css, /@media/);

  for (const property of ['font-family', 'font-size', 'letter-spacing', 'border-radius', 'box-shadow']) {
    for (const [, value] of css.matchAll(new RegExp(`${property}\\s*:\\s*([^;\\n]+)`, 'gi'))) {
      assert.match(value.trim(), /^(?:var\(|inherit$)/, `${property}: ${value.trim()} should use a token`);
    }
  }
});
