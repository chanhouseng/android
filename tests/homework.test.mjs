import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root = process.cwd();
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

const homeworkItems = [
  ['homework1', '顏色選擇遊戲'],
  ['homework2', '測試'],
  ['homework4', '樣題題目(爛尾)'],
  ['homework5', '學校報名系統(自動有格式、三秒停止輸入才顯示資料)'],
  ['homework6', '各種動畫(重覆上下移動、放大、橫向ScrollView的各種設定)'],
  ['homework7', '餐廳訂餐(爛尾，要重新做過，分得太多層)'],
  ['03_Module_C_PM', '各種動畫(scrollView自動向上、下移，按比例放大)'],
  ['03_Module_A_PM', '配對遊戲'],
  ['Moudle3_2(壞左，要重啟項目加入返啲內容)', ''],
  ['Moudle3(壞左，要重啟項目加入返啲內容)', ''],
  ['02_Module_A_PM', '攞http資料、畫畫、下載圖片、recyclerView制出現Fragment的內容顯示'],
  ['03_Module_A_AM', '跌落食物遊戲'],
  ['jp24july', '邏輯(播放音樂問題、各種動畫(寬度放大、三個layout有同一動畫問題)、拖放)'],
  ['ModuleD', '測試、同一層處理所有顯示'],
  ['2022_Module_A_AM', '2022MduleA(chip、下載、選取圖片並存入data) 欄尾(最後錄音嗰part)'],
  ['03_Module_C_AM', '2024ModuleC(動畫、旋轉嘅動畫)'],
  ['2024_ModuleC_PM', '餐廳訂餐'],
  ['passwordManager', '自定按條件生成密碼(練邏輯) --(有啲未做曬，如自定排序同navigation)'],
  ['MYHealthDATA', '2024交流題目，內容較雜(alertDialog)'],
  ['06_Module_KR_AM', '好多都要自己定data(佢要動畫去滑動下一版比較難)'],
  ['einsteinCup', '一個好好嘅ModuleA題目 (揀座位，要顯示返bottomNavigationView顏色)'],
  ['Note-Taking App', '類似word的功能，大量邏輯要處理，也有好多數據的處理'],
  ['3ModuleC', '普通的鍛練題目'],
  ['03_Module_B', '香港交流賽題目，最全面的凙輯處理、影相、選影等等相關的操作'],
  ['hkModuleC', '2022 ModuleC 舊題'],
  ['IN_Module2026(未做完，只係2.5小時成品)', '日本線上賽題目(多而煩，如加clipGroup)'],
  ['Skill08_Timer (2.5小時版本)', '日本線上題目(計時、加項目)'],
  ['NeubrandenBookFans', '印度愛因斯坦盃(多、要複製設計、reviews功能)'],
  ['203_Module_A_AM', '2022年moduleA，滑雪(兩小時版)'],
  ['203_Module_A_PM', '2022年moduleA，網上load影片'],
  ['203_Module_C_AM', '2024年moduleC舊題重做，改善左個第一版，之後會喺呢到做埋最後嗰版'],
  ['module1', '大小標的轉換做不到，加入刪除都要有動畫(做唔到)'],
  ['moduleE', '就好簡單的包剪揼遊戲，用when判斷'],
];

function extractItems(html) {
  return [...html.matchAll(/<article\b[^>]*data-homework-item[^>]*>([\s\S]*?)<\/article>/gi)];
}

function extractAttribute(tag, attribute) {
  return tag.match(new RegExp(`${attribute}=["']([^"']+)["']`, 'i'))?.[1] ?? '';
}

function loadHomeworkFilter() {
  const context = { console, globalThis: {} };
  vm.runInNewContext(read('assets/js/homework-filter.js'), context, { filename: 'homework-filter.js' });
  return context.globalThis.HomeworkFilter;
}

test('Homework loads the shared foundation, App Shell and page resources', () => {
  const html = read('homework/index.html');
  for (const asset of [
    '../assets/css/foundation.css',
    '../assets/css/app-shell.css',
    '../assets/css/homework.css',
    '../assets/js/site-navigation.js',
    '../assets/js/homework-filter.js',
  ]) assert.ok(html.includes(asset), `${asset} should load`);

  assert.match(html, /<html\b[^>]*lang=["']zh-Hant["'][^>]*data-site-root=["']\.\.\/["']/i);
  assert.match(html, /class=["'][^"']*skip-link/);
  assert.match(html, /data-site-navigation=["']desktop["']/);
  assert.match(html, /data-site-navigation=["']mobile["']/);
  assert.match(html, /id=["']main-content["']/);
});

test('Homework preserves the original 33 named items as an exact prefix while allowing appended items', () => {
  const html = read('homework/index.html');
  const items = extractItems(html);
  const actual = items.map(([, content]) => [
    content.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i)?.[1].trim(),
    extractAttribute(items.find((item) => item[1] === content)?.[0] ?? '', 'data-description'),
  ]);

  assert.ok(items.length >= 33);
  assert.deepEqual(actual.slice(0, 33), homeworkItems);
});

test('Homework removes blank placeholders and never emits their broken references', () => {
  const html = read('homework/index.html');
  assert.doesNotMatch(html, /href=["']\.html["']/);
  assert.doesNotMatch(html, /src=["']img\/\.png["']/);
  assert.doesNotMatch(html, /href=["']\/train\/\/["']/);
  assert.ok((html.match(/data-homework-item/g) ?? []).length >= 33);
});

test('Homework keeps every valid image and uses a missing state for incomplete named cards', () => {
  const html = read('homework/index.html');
  const items = extractItems(html);
  const imageTags = items.flatMap(([, content]) => [...content.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]));

  assert.ok(imageTags.length >= 32);
  for (const tag of imageTags) {
    const src = extractAttribute(tag, 'src');
    assert.match(tag, /\salt=["'][^"']+["']/i);
    assert.equal(existsSync(path.join(root, 'homework', src)), true, `${src} should exist`);
  }
  for (const title of homeworkItems.slice(8, 10).map(([name]) => name)) {
    const item = items.find(([, content]) => content.includes(`<h2>${title}</h2>`));
    assert.ok(item, title);
    assert.match(item[1], /成果及題目資料暫缺/);
    assert.doesNotMatch(item[1], /<(?:img|a)\b/);
  }
  const multiImageItem = items.find(([, content]) => content.includes('<h2>03_Module_C_PM</h2>'));
  assert.equal((multiImageItem?.[1].match(/<img\b/g) ?? []).length, 2);
});

test('missing result pages remain as cards without broken result links', () => {
  const html = read('homework/index.html');
  for (const missingPage of ['homework7.html', 'jp24july.html']) {
    assert.doesNotMatch(html, new RegExp(`href=["']${missingPage.replace('.', '\\.')}["']`));
  }
  assert.equal((html.match(/成果頁暫缺/g) ?? []).length, 2);

  const resultHrefs = [...html.matchAll(/<a\b[^>]*data-homework-result[^>]*>/gi)]
    .map(([tag]) => extractAttribute(tag, 'href'));
  assert.ok(resultHrefs.length >= 29);
  for (const resultHref of resultHrefs) {
    assert.equal(existsSync(path.resolve('homework', resultHref)), true, `${resultHref} should exist`);
  }
});

test('every available question folder uses a canonical Training URL found in the manifest', () => {
  const html = read('homework/index.html');
  const manifestFolders = new Set(
    JSON.parse(read('training/files.json')).filter(({ type }) => type === 'folder').map(({ path: folderPath }) => folderPath),
  );
  const questionHrefs = [...html.matchAll(/<a\b[^>]*data-homework-question[^>]*>/gi)]
    .map(([tag]) => extractAttribute(tag, 'href'));

  assert.ok(questionHrefs.length >= 30);
  assert.ok(questionHrefs.includes('/training/Stroop%20Challenge/'));
  assert.ok(questionHrefs.includes('/training/module5/module_a_am/'));
  assert.doesNotMatch(html, /href=["']\/train\/[^"']+\/["']/i);

  for (const href of questionHrefs) {
    assert.match(href, /^\/training\/(?:[^/]+\/)+$/);
    const folderPath = href.slice('/training/'.length, -1).split('/').map(decodeURIComponent).join('/');
    assert.equal(manifestFolders.has(folderPath), true, `${folderPath} should exist in training/files.json`);
  }
});

test('Homework search matches name, explanation and question folder and supports Escape clearing', () => {
  const filter = loadHomeworkFilter();
  const items = [
    { name: 'homework1', description: '顏色選擇遊戲', folder: 'Stroop Challenge' },
    { name: 'MYHealthDATA', description: '2024交流題目', folder: 'My Health data' },
  ];

  assert.deepEqual(Array.from(filter.filterItems(items, '顏色'), ({ name }) => name), ['homework1']);
  assert.deepEqual(Array.from(filter.filterItems(items, 'health data'), ({ name }) => name), ['MYHealthDATA']);
  assert.deepEqual(Array.from(filter.filterItems(items, '沒有結果')), []);
  assert.equal(filter.shouldClearSearch({ key: 'Escape' }, 'homework1'), true);
  assert.equal(filter.shouldClearSearch({ key: 'Escape' }, ''), false);
  assert.equal(filter.shouldClearSearch({ key: 'Enter' }, 'homework1'), false);

  const html = read('homework/index.html');
  assert.match(html, /搜尋本頁作業/);
  assert.match(html, /data-homework-result-count[^>]*aria-live=["']polite["']|aria-live=["']polite["'][^>]*data-homework-result-count/);
  assert.match(html, /data-homework-clear/);
  assert.match(html, /data-homework-empty[^>]*hidden/);
  assert.doesNotMatch(html, /全文搜尋|全站搜尋/);
});

test('Homework navigation is active and its CSS uses only the shared design tokens', () => {
  const navigation = (() => {
    const context = { console, globalThis: {} };
    vm.runInNewContext(read('assets/js/site-navigation.js'), context, { filename: 'site-navigation.js' });
    return context.globalThis.AndroidLearningNavigation;
  })();
  assert.equal(navigation.getActiveNavId('/homework/index.html'), 'homework');

  const css = read('assets/css/homework.css');
  assert.match(css, /grid-template-columns:\s*repeat\(auto-fit,/);
  assert.match(css, /object-fit:\s*contain/);
  assert.doesNotMatch(css, /\bfloat\s*:/i);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(css, /\b\d+(?:\.\d+)?px\b/i);
  const cardRule = css.match(/\.homework-card\s*\{([\s\S]*?)\}/)?.[1] ?? '';
  assert.doesNotMatch(cardRule, /\b(?:min-|max-)?height\s*:/i);
});
