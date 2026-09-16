import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root = process.cwd();
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

const page1Titles = [
  'class2', 'class2_2', 'class2_exersive', 'Class2_exersive', 'class3', 'class3_1',
  'class3_exersive2', 'class3Exersive', 'class4', 'class7', 'class7_exersive',
  'class8_exersive', 'class10', 'class10_exerise', 'class11', 'class11_exerise',
  'class32', 'methood_post', 'MyApplication', 'MyPlayground.playground', 'Notification',
  'OnlineImage_GetingData', 'RecyclerActivity', 'testing',
];

const page2Titles = [
  'class_textEditText', 'countPoint', 'class_practise', 'class2Pdf', 'class3Pdf',
  'classPractise', 'random_game', 'spinnerCheck', 'class4Practise', 'class5Pdf',
  'class6Pdf', 'class6Practise', 'class7Pdf', 'class7Practise', 'food_order',
  'class8Pdf_jsonTo', 'class8Practise', 'class9Pdf', 'class9Pdf_returnActivityIntents',
  'class9Pratise', 'class10Pdf', 'class10Pdf_adapter', 'class12Pdf', '例子1',
  '賽後第一次複習(未攞題目)',
];

const page1Images = [
  'img/class2.png', 'img/class2_2.png', 'img/class2_exersive (2).png',
  'img/Class2_exersive.png', 'img/class3.png', 'img/class3_1.png',
  'img/class3_exersive2.png', 'img/class3Exersive.png', 'img/class4.png',
  'img/class7.png', 'img/class7_exersive.png', 'img/class10.png',
  'img/class10_exerise.png', 'img/class11.png', 'img/class11 (2).png',
  'img/class11_exerise.png', 'img/class32(1).png', 'img/class32(2).png',
  'img/methood_post.png', 'img/MyApplication.png', 'img/Notification.png',
];

const page2Images = [
  'img_myself/class_textEditText.png', 'img_myself/countPoint.png',
  'img_myself/class_practise.png', 'img_myself/class2Pdf.png',
  'img_myself/class3Pdf.png', 'img_myself/classPractise.png',
  'img_myself/random_game.png', 'img_myself/spinnerCheck.png',
  'img_myself/class4Practise.png', 'img_myself/class5Pdf.png',
  'img_myself/class6Pdf.png', 'img_myself/class6Practise.png',
  'img_myself/class7Pdf.png', 'img_myself/class7Practise.png',
  'img_myself/food_order.png', 'img_myself/class8Pdf_jsonTo.png',
  'img_myself/class8Practise.png', 'img_myself/class9Pdf.png',
  'img_myself/class9Pdf_returnActivityIntents.png', 'img_myself/class9Pratise.png',
  'img_myself/class10Pdf.png', 'img_myself/class10Pdf_adapter.png',
  'img_myself/class12Pdf.png',
];

const noteLinks = [
  ['class2Pdf.html', 'class2Pdf'],
  ['class3Pdf.html', 'class3Pdf'],
  ['class7Pdf.html', 'class7Pdf'],
  ['class9Pratise.html', 'class9Pratise'],
  ['class10Pdf.html', 'class10Pdf'],
  ['class10Pdf_adapter.html', 'class10Pdf_adapter'],
  ['exmple1.html', '例子1'],
  ['other1.html', '賽後第一次複習(未攞題目)'],
];

const missingImageTitles = [
  'class8_exersive',
  'MyPlayground.playground',
  'OnlineImage_GetingData',
  'RecyclerActivity',
  'testing',
];

function loadBrowserScript(relativePath) {
  const context = { console, globalThis: {} };
  vm.runInNewContext(read(relativePath), context, { filename: relativePath });
  return context.globalThis;
}

function extractItems(html) {
  return [...html.matchAll(/<article\b[^>]*data-class-learning-item[^>]*>([\s\S]*?)<\/article>/gi)];
}

function extractAttribute(tag, attribute) {
  return tag.match(new RegExp(`${attribute}=["']([^"']+)["']`, 'i'))?.[1] ?? '';
}

test('both Class Learning pages load the shared foundation, shell and page assets', () => {
  assert.equal(existsSync(path.join(root, 'assets/css/class-learning.css')), true);
  assert.equal(existsSync(path.join(root, 'assets/js/class-learning.js')), true);

  for (const page of ['page1.html', 'page2.html']) {
    const html = read(page);
    assert.match(html, /<html\b[^>]*lang=["']zh-Hant["'][^>]*data-site-root=["']\.\/["']/i);
    assert.match(html, /href=["']assets\/css\/foundation\.css["']/);
    assert.match(html, /href=["']assets\/css\/app-shell\.css["']/);
    assert.match(html, /href=["']assets\/css\/class-learning\.css["']/);
    assert.match(html, /src=["']assets\/js\/site-navigation\.js["']/);
    assert.match(html, /src=["']assets\/js\/class-learning\.js["']/);
    assert.match(html, /class=["'][^"']*skip-link/);
    assert.match(html, /data-site-navigation=["']desktop["']/);
    assert.match(html, /data-site-navigation=["']mobile["']/);
    assert.match(html, /id=["']main-content["']/);
  }
});

test('page switcher uses real page links and marks only the current page', () => {
  const page1 = read('page1.html');
  const page2 = read('page2.html');

  assert.match(page1, /<a\b[^>]*href=["']page1\.html["'][^>]*aria-current=["']page["'][^>]*>堂上練習<\/a>/);
  assert.match(page1, /<a\b[^>]*href=["']page2\.html["'][^>]*>自己練習<\/a>/);
  assert.doesNotMatch(page1, /href=["']page2\.html["'][^>]*aria-current=["']page["']/);

  assert.match(page2, /<a\b[^>]*href=["']page1\.html["'][^>]*>堂上練習<\/a>/);
  assert.match(page2, /<a\b[^>]*href=["']page2\.html["'][^>]*aria-current=["']page["'][^>]*>自己練習<\/a>/);
  assert.doesNotMatch(page2, /href=["']page1\.html["'][^>]*aria-current=["']page["']/);

  const navigation = loadBrowserScript('assets/js/site-navigation.js').AndroidLearningNavigation;
  assert.equal(navigation.getActiveNavId('/page1.html'), 'learning');
  assert.equal(navigation.getActiveNavId('/page2.html'), 'learning');
});

test('page1 preserves its 24 items, order, explanations and valid images', () => {
  const html = read('page1.html');
  const items = extractItems(html);
  const titles = items.map(([, content]) => content.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1].trim());
  const imageTags = items.flatMap(([, content]) => [...content.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]));
  const images = imageTags.map((tag) => extractAttribute(tag, 'src'));

  assert.equal(items.length, 24);
  assert.deepEqual(titles, page1Titles);
  assert.deepEqual(images, page1Images);
  assert.match(html, />完成所有功能</);
  imageTags.forEach((tag) => assert.match(tag, /\salt=["'][^"']+["']/i));
  images.forEach((src) => assert.equal(existsSync(path.join(root, src)), true, `${src} should exist`));
});

test('page2 preserves its 25 items, order, explanations, links and valid images', () => {
  const html = read('page2.html');
  const items = extractItems(html);
  const titles = items.map(([, content]) => content.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1].trim());
  const imageTags = items.flatMap(([, content]) => [...content.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]));
  const images = imageTags.map((tag) => extractAttribute(tag, 'src'));

  assert.equal(items.length, 25);
  assert.deepEqual(titles, page2Titles);
  assert.deepEqual(images, page2Images);
  for (const explanation of [
    '輪換四張相', 'radioButton 是否被點擊的判斷', '重設計時器',
    '永久不斷的計時器', '圖片漸變背景', '本機存儲問題的處理-覆蓋原有數據',
    '網上數據', 'class9的打開新 Activity , 要求返回結果', '兩行式的卡片',
    '導航菜單', 'fragment的Alert及轉fragment', 'viewPager2',
  ]) assert.ok(html.includes(explanation), `should preserve: ${explanation}`);

  for (const [href, label] of noteLinks) {
    assert.match(html, new RegExp(`<a\\b[^>]*data-note-link[^>]*href=["']${href.replace('.', '\\.')}["'][^>]*>查看筆記<\\/a>`));
    assert.ok(html.includes(`<h3>${label}</h3>`), `should preserve item name: ${label}`);
    assert.equal(existsSync(path.join(root, href)), true, `${href} should exist`);
  }
  imageTags.forEach((tag) => assert.match(tag, /\salt=["'][^"']+["']/i));
  images.forEach((src) => assert.equal(existsSync(path.join(root, src)), true, `${src} should exist`));
});

test('five known missing-image items remain without broken img elements', () => {
  const html = read('page1.html');
  const items = extractItems(html);
  const missingItems = items.filter((match) => /data-missing-image/.test(match[0]));
  const missingTitles = missingItems.map(([, content]) => content.match(/<h3\b[^>]*>([^<]+)<\/h3>/i)?.[1].trim());

  assert.deepEqual(missingTitles, missingImageTitles);
  assert.equal((html.match(/圖片暫缺/g) ?? []).length, 5);
  missingItems.forEach(([, content]) => assert.doesNotMatch(content, /<img\b/i));
  assert.doesNotMatch(html, /img\/螢幕擷取畫面 2026-03-05 154346\.png|img\/螢幕擷(?:g|ng)?["']/);
});

test('multi-image cards preserve separate preview controls for each image', () => {
  const html = read('page1.html');
  for (const title of ['class11', 'class32']) {
    const item = extractItems(html).find(([, content]) => content.includes(`<h3>${title}</h3>`));
    assert.ok(item, `${title} should exist`);
    assert.equal((item[1].match(/data-preview-button/g) ?? []).length, 2);
    assert.equal((item[1].match(/<img\b/g) ?? []).length, 2);
  }
});

test('search filters names and explanations and exposes count, clear and empty-state controls', () => {
  const learning = loadBrowserScript('assets/js/class-learning.js').ClassLearning;
  assert.ok(learning);
  assert.equal(learning.matchesItem({ title: 'class2Pdf', searchText: 'radioButton 是否被點擊的判斷' }, 'radioButton'), true);
  assert.equal(learning.matchesItem({ title: 'class2Pdf', searchText: 'radioButton 是否被點擊的判斷' }, 'class2pdf'), true);
  assert.equal(learning.matchesItem({ title: 'class2Pdf', searchText: 'radioButton 是否被點擊的判斷' }, '全文'), false);
  assert.deepEqual(Array.from(learning.filterItems([
    { id: 'one', title: 'class2Pdf', searchText: 'radioButton 是否被點擊的判斷' },
    { id: 'two', title: 'class3Pdf', searchText: '重設計時器' },
  ], '計時器'), ({ id }) => id), ['two']);

  for (const page of ['page1.html', 'page2.html']) {
    const html = read(page);
    assert.match(html, /data-class-learning-search/);
    assert.match(html, /data-class-learning-clear/);
    assert.match(html, /data-class-learning-result-count[^>]*aria-live=["']polite["']|aria-live=["']polite["'][^>]*data-class-learning-result-count/);
    assert.match(html, /data-class-learning-empty[^>]*hidden/);
    assert.match(html, /搜尋本頁練習/);
    assert.doesNotMatch(html, /全站搜尋|全文搜尋/);
  }
});

test('image preview opens a named modal dialog and restores trigger focus after closing', () => {
  const learning = loadBrowserScript('assets/js/class-learning.js').ClassLearning;
  const title = { textContent: '' };
  const image = {
    src: '',
    alt: '',
    hidden: true,
    removeAttribute(name) { if (name === 'src') this.src = ''; },
  };
  const trigger = {
    dataset: { previewSrc: 'img/class2.png', previewAlt: 'class2 練習圖片', previewTitle: 'class2' },
    focused: false,
    focus() { this.focused = true; },
  };
  const dialog = {
    open: false,
    returnValue: '',
    querySelector(selector) { return selector === '[data-preview-title]' ? title : image; },
    showModal() { this.open = true; },
    close() { this.open = false; },
  };

  learning.openPreview(trigger, dialog);
  assert.equal(dialog.open, true);
  assert.equal(title.textContent, 'class2');
  assert.equal(image.src, 'img/class2.png');
  assert.equal(image.alt, 'class2 練習圖片');
  assert.equal(image.hidden, false);
  learning.closePreview(dialog);
  learning.restorePreviewFocus(dialog);
  assert.equal(dialog.open, false);
  assert.equal(trigger.focused, true);
  assert.equal(image.hidden, true);
  assert.equal(image.src, '');

  for (const page of ['page1.html', 'page2.html']) {
    const html = read(page);
    assert.match(html, /<dialog\b(?=[^>]*data-image-preview)(?=[^>]*aria-labelledby=["']class-preview-title["'])[^>]*>/i);
    assert.match(html, /id=["']class-preview-title["'][^>]*data-preview-title/);
    assert.match(html, /<button\b[^>]*type=["']button["'][^>]*data-preview-close[^>]*>關閉<\/button>/);
    const previewImageTag = html.match(/<img\b[^>]*data-preview-image[^>]*>/i)?.[0] ?? '';
    assert.match(previewImageTag, /\bhidden\b/);
    assert.doesNotMatch(previewImageTag, /\ssrc=/i);
  }
});

test('Class Learning CSS uses responsive grid and tokens without fixed card heights or floats', () => {
  const css = read('assets/css/class-learning.css');

  assert.match(css, /grid-template-columns:\s*repeat\(auto-fit,/);
  assert.match(css, /object-fit:\s*contain/);
  assert.match(css, /:hover/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /:disabled/);
  assert.doesNotMatch(css, /\bfloat\s*:/i);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(css, /\b\d+(?:\.\d+)?px\b/i);

  const cardRule = css.match(/\.learning-card\s*\{([\s\S]*?)\}/)?.[1] ?? '';
  assert.doesNotMatch(cardRule, /\b(?:min-|max-)?height\s*:/i);

  for (const property of ['color', 'background', 'border-color', 'font-family', 'font-size', 'border-radius', 'box-shadow']) {
    const declarations = [...css.matchAll(new RegExp(`${property}\\s*:\\s*([^;\\n]+)`, 'gi'))];
    for (const [, value] of declarations) {
      assert.match(value.trim(), /^(?:var\(|inherit$|transparent$)/, `${property}: ${value.trim()} should use a token`);
    }
  }
});
