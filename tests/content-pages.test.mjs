import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root = process.cwd();
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

const worldSkillTitles = [
  'class1_1',
  'class1_2',
  'class1_3',
  'class1_4',
  'class1_5',
  'class2_1_ practise.png',
  'class2_again',
  'class3_1',
  'class3_2',
  'class3_3',
  'class3_4',
  'class3_5',
  'class4_1',
  'class4_2',
  'class4_3.png',
  'class4_4.png',
  'class4_5',
  'class5_1',
  'class5_2',
  'class5_3',
  'class5_4',
  'class5_5',
  'class6_1',
  'class6_2',
  'class7_1',
  'class7_2',
  'exercise1',
  'exercise2',
  'exercise3',
  'exercise4',
  'exercise6',
  'exercise7',
  'homework2',
  'exercise12',
  'exercise22',
  '03_Module_A_AM',
  'class8_1',
  'class8_2',
  'class9_1',
  'class9_2',
  'exercise21',
  'exercise24',
];

const worldSkillImages = worldSkillTitles.map((title) => (
  `img/${title.replace(/\.png$/i, '')}.png`
));

const worldSkillLinkedHrefs = [
  'class1_2.html', 'class1_4.html', 'class1_5.html', 'class2_again.html',
  'class3_1.html', 'class3_2.html', 'class3_4.html', 'class3_5.html',
  'class4_1.html', 'class4_2.html', 'class5_1.html', 'class5_3.html',
  'class5_4.html', 'class5_5.html', 'class6_1.html', 'class6_2.html',
  'class7_1.html', 'class7_2.html', 'exercise1.html', 'exercise2.html',
  'exercise3.html', 'exercise4.html', 'exercise6.html', 'exercise7.html',
  'homework2.html', 'exercise12.html', 'exercise22.html', '03_Module_A_AM.html',
  'class8_1.html', 'class8_2.html', 'class9_1.html', 'class9_2.html',
  'exercise21.html', 'exercise24.html',
];

const forgotTitles = [
  'try catch 多用在日期不是這個格式就去轉試另一個格式',
  'Bottom sheet Dialog 的背景設為透明',
  '把 AlertDialog 變成全螢幕',
  '多行文字的輸入框',
  '取消之前的待辦事項，然後安排 3 秒後執行某件事',
  '重覆地做相向動作',
  '底線、刪除線',
  'ValueAnimator setDelay',
  'editText passwordText 可見不可見',
  'bottomNavigationView當點擊時才顯示文字，否則只顯示圖標',
  'bottomNavigationView不可向下拉',
  'progress 顏色設定',
  'substring的使用',
  '拍照可以儲存uri',
  '消取內容的關聯性',
  '文字走馬燈效果',
  'Map轉list可以以index顯示key, value',
];

function loadBrowserScript(relativePath) {
  const context = { console, globalThis: {} };
  vm.runInNewContext(read(relativePath), context, { filename: relativePath });
  return context.globalThis;
}

function extractAttribute(tag, attribute) {
  return tag.match(new RegExp(`${attribute}=["']([^"']+)["']`, 'i'))?.[1] ?? '';
}

test('both pages load the shared foundation, App Shell and their own assets', () => {
  const expectedFiles = [
    'assets/css/world-skills.css',
    'assets/css/forgot.css',
    'assets/js/world-skills-filter.js',
    'assets/js/accordion.js',
  ];

  for (const relativePath of expectedFiles) {
    assert.equal(existsSync(path.join(root, relativePath)), true, `${relativePath} should exist`);
  }

  const worldHtml = read('world skill/index.html');
  assert.match(worldHtml, /href=["']\.\.\/assets\/css\/foundation\.css["']/);
  assert.match(worldHtml, /href=["']\.\.\/assets\/css\/app-shell\.css["']/);
  assert.match(worldHtml, /href=["']\.\.\/assets\/css\/world-skills\.css["']/);
  assert.match(worldHtml, /src=["']\.\.\/assets\/js\/site-navigation\.js["']/);
  assert.match(worldHtml, /src=["']\.\.\/assets\/js\/world-skills-filter\.js["']/);
  assert.match(worldHtml, /data-site-root=["']\.\.[\/\\]["']/);

  const forgotHtml = read('forgot.html');
  assert.match(forgotHtml, /href=["']assets\/css\/foundation\.css["']/);
  assert.match(forgotHtml, /href=["']assets\/css\/app-shell\.css["']/);
  assert.match(forgotHtml, /href=["']assets\/css\/forgot\.css["']/);
  assert.match(forgotHtml, /src=["']assets\/js\/site-navigation\.js["']/);
  assert.match(forgotHtml, /src=["']assets\/js\/accordion\.js["']/);
  assert.match(forgotHtml, /data-site-root=["']\.\/["']/);

  for (const html of [worldHtml, forgotHtml]) {
    assert.match(html, /class=["'][^"']*skip-link/);
    assert.match(html, /data-site-navigation=["']desktop["']/);
    assert.match(html, /data-site-navigation=["']mobile["']/);
    assert.match(html, /id=["']main-content["']/);
  }
});

test('navigation resolves root and deep-page links while retaining active states', () => {
  const navigation = loadBrowserScript('assets/js/site-navigation.js').AndroidLearningNavigation;

  assert.ok(navigation);
  assert.equal(navigation.resolveNavigationHref('index.html', './'), './index.html');
  assert.equal(navigation.resolveNavigationHref('forgot.html', '../'), '../forgot.html');
  assert.equal(navigation.resolveNavigationHref('world skill/', '../'), '../world skill/');
  assert.equal(navigation.resolveNavigationHref('https://example.com', '../'), 'https://example.com');
  assert.equal(navigation.getActiveNavId('/world%20skill/'), 'world-skills');
  assert.equal(navigation.getActiveNavId('/world%20skill/class3_1.html'), 'world-skills');
  assert.equal(navigation.getActiveNavId('/forgot.html'), 'forgot');
});

test('World Skill keeps all 42 real items, images, valid links and original notes', () => {
  const html = read('world skill/index.html');
  const itemTags = [...html.matchAll(/<article\b[^>]*data-world-skill-item[^>]*>/gi)];
  const headingTitles = [...html.matchAll(/<h3\b[^>]*>([^<]+)<\/h3>/gi)].map((match) => match[1].trim());
  const imageTags = [...html.matchAll(/<img\b[^>]*>/gi)];
  const images = imageTags.map((tag) => extractAttribute(tag[0], 'src'));
  const itemLinks = [...html.matchAll(/<a\b[^>]*data-item-link[^>]*href=["']([^"']+)["']/gi)]
    .map((match) => match[1]);

  assert.equal(itemTags.length, 42);
  assert.deepEqual(headingTitles.toSorted(), worldSkillTitles.toSorted());
  assert.equal(imageTags.length, 42);
  assert.deepEqual(images.toSorted(), worldSkillImages.toSorted());
  assert.deepEqual(itemLinks.toSorted(), worldSkillLinkedHrefs.toSorted());
  assert.doesNotMatch(html, /href=["']\.html["']|src=["']img\/\.png["']/);

  const preservedNotes = [
    'android:drawableStart=""',
    '即時計total',
    'ios堂上練習',
    '當未登入時就入name 在另一版顯示name。如果已登入就不用打字 直接登入',
    'class userClass(var id:Int , var name:String, var address: address) {}',
    'imageView.load(result.link){}',
    'formJson -&gt; 字串轉JSON',
    '//1f,1f左上, 1f, 0f, 左下, 0f,1f 右上 放大方向',
    'scrollView setOnscrollChangeListener',
  ];
  for (const note of preservedNotes) assert.match(html, new RegExp(note.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  for (const imageTag of imageTags) assert.match(imageTag[0], /\salt=["'][^"']*["']/i);
  for (const href of itemLinks) {
    assert.equal(existsSync(path.join(root, 'world skill', href)), true, `${href} should resolve`);
  }
  for (const src of images) {
    assert.equal(existsSync(path.join(root, 'world skill', src)), true, `${src} should resolve`);
  }
});

test('World Skill search matches existing title and explanation text, clears and exposes empty state hooks', () => {
  const html = read('world skill/index.html');
  const search = loadBrowserScript('assets/js/world-skills-filter.js').WorldSkillsFilter;

  assert.ok(search);
  assert.equal(search.matchesItem({ title: 'class3_1', searchText: '自製spinner、進度條' }, 'spinner'), true);
  assert.equal(search.matchesItem({ title: 'exercise3', searchText: '動畫' }, 'exercise3'), true);
  assert.equal(search.matchesItem({ title: 'exercise3', searchText: '動畫' }, '全文搜尋'), false);
  assert.deepEqual(Array.from(search.filterItems([
    { id: 'one', title: 'class3_1', searchText: '自製spinner、進度條' },
    { id: 'two', title: 'exercise3', searchText: '動畫' },
  ], '進度'), ({ id }) => id), ['one']);
  assert.match(html, /type=["']search["'][^>]*data-world-skill-search|data-world-skill-search[^>]*type=["']search["']/i);
  assert.match(html, /data-world-skill-clear/);
  assert.match(html, /data-world-skill-empty[^>]*hidden/);
  assert.match(html, /aria-live=["']polite["']/);
  assert.match(html, /本頁內容搜尋/);
  assert.doesNotMatch(html, /全站搜尋|全文搜尋/);
});

test('Forgot keeps all 16 original entries and the added Map entry, code, notes and links', () => {
  const html = read('forgot.html');
  const items = [...html.matchAll(/<article\b[^>]*data-accordion-item[^>]*>/gi)];
  const buttons = [...html.matchAll(/<button\b[^>]*data-accordion-trigger[^>]*>([\s\S]*?)<\/button>/gi)];
  const titles = buttons.map((match) => match[1].replace(/<[^>]*>/g, '').trim());

  assert.equal(items.length, 17);
  assert.deepEqual(titles, forgotTitles);
  assert.equal((html.match(/href=["']homework\/Note_Taking_App\.html["']/g) ?? []).length, 2);

  const preservedContent = [
    'LocalDate.parse(text, formatterList[2])',
    'bottomSheetDialog.window?.setDimAmount(0f)',
    'WindowManager.LayoutParams.MATCH_PARENT',
    'android:inputType="textMultiLine"',
    'searchHandler.removeCallbacksAndMessages(null)',
    'downAnim.repeatMode = Animation.REVERSE',
    'Paint.STRIKE_THRU_TEXT_FLAG',
    'valueAnimator.startDelay = 2600',
    'PasswordTransformationMethod()',
    'app:labelVisibilityMode="selected"',
    'bottomSheetDialog.behavior.isDraggable = false',
    'android:progressTint="#18abc8"',
    'substring(1,2)',
    'registerForActivityResult(ActivityResultContracts.TakePicture())',
    'fun deepCopy(): ContentClass',
    'android:ellipsize="marquee"',
    'val list = skils.entries.toList()',
    '//將Map轉換為List，可以以lilst[i].value去引用',
    'var Ki = i + 1',
    'val keyNew = list[Ki].key',
    'loadAlert(skils, Ki, keyNew)',
    '//按鍵值、skills Map, 第幾個值去loadAlert',
    'href="homework/203_Module_A_PM.html"',
    '參考呢到 loadAlert 顯示放大內容',
  ];
  for (const snippet of preservedContent) assert.ok(html.includes(snippet), `should keep: ${snippet}`);
});

test('Forgot accordion has unique accessible relationships and readable no-JavaScript content', () => {
  const html = read('forgot.html');
  const buttonTags = [...html.matchAll(/<button\b[^>]*data-accordion-trigger[^>]*>/gi)].map((match) => match[0]);
  const panelTags = [...html.matchAll(/<(?:div|section)\b[^>]*data-accordion-panel[^>]*>/gi)].map((match) => match[0]);
  const buttonIds = buttonTags.map((tag) => extractAttribute(tag, 'id'));
  const panelIds = panelTags.map((tag) => extractAttribute(tag, 'id'));

  assert.equal(buttonTags.length, 17);
  assert.equal(panelTags.length, 17);
  assert.equal(new Set([...buttonIds, ...panelIds]).size, 34);
  buttonTags.forEach((tag, index) => {
    assert.equal(extractAttribute(tag, 'aria-expanded'), 'true');
    assert.equal(extractAttribute(tag, 'aria-controls'), panelIds[index]);
    assert.doesNotMatch(tag, /\bhidden\b/);
  });
  panelTags.forEach((tag, index) => {
    assert.equal(extractAttribute(tag, 'aria-labelledby'), buttonIds[index]);
    assert.doesNotMatch(tag, /\bhidden\b/);
  });
});

test('accordion supports item toggles, expand all, collapse all, filtering and empty state hooks', () => {
  const html = read('forgot.html');
  const accordion = loadBrowserScript('assets/js/accordion.js').AndroidLearningAccordion;
  const makeButton = () => ({
    attributes: new Map([['aria-expanded', 'true']]),
    getAttribute(name) { return this.attributes.get(name); },
    setAttribute(name, value) { this.attributes.set(name, value); },
  });
  const records = Array.from({ length: 3 }, (_, index) => ({
    id: `entry-${index + 1}`,
    title: index === 0 ? '日期格式' : `其他 ${index}`,
    button: makeButton(),
    panel: { hidden: false },
  }));

  assert.ok(accordion);
  accordion.setExpanded(records[0], false);
  assert.equal(records[0].button.getAttribute('aria-expanded'), 'false');
  assert.equal(records[0].panel.hidden, true);
  accordion.setExpanded(records[0], true);
  assert.equal(records[0].button.getAttribute('aria-expanded'), 'true');
  assert.equal(records[0].panel.hidden, false);
  accordion.setAllExpanded(records, false);
  assert.ok(records.every(({ panel }) => panel.hidden));
  accordion.setAllExpanded(records, true);
  assert.ok(records.every(({ panel }) => !panel.hidden));
  assert.deepEqual(Array.from(accordion.filterEntries(records, '日期'), ({ id }) => id), ['entry-1']);

  assert.match(html, /data-accordion-expand-all/);
  assert.match(html, /data-accordion-collapse-all/);
  assert.match(html, /data-accordion-search/);
  assert.match(html, /data-accordion-clear/);
  assert.match(html, /data-accordion-empty[^>]*hidden/);
  assert.match(html, /aria-live=["']polite["']/);
});

test('new page CSS uses design tokens and scopes code comments', () => {
  const css = [read('assets/css/world-skills.css'), read('assets/css/forgot.css'), read('assets/css/accordion.css')].join('\n');

  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(css, /\b\d+(?:\.\d+)?px\b/i);
  assert.doesNotMatch(css, /^\s*span\s*\{/m);
  assert.match(css, /var\(--font-code\)/);
  assert.match(css, /overflow-x:\s*auto/);
  assert.match(css, /object-fit:\s*contain/);

  for (const property of ['color', 'background', 'border-color', 'font-family', 'font-size', 'border-radius', 'box-shadow']) {
    const declarations = [...css.matchAll(new RegExp(`${property}\\s*:\\s*([^;\\n]+)`, 'gi'))];
    for (const [, value] of declarations) {
      assert.match(value.trim(), /^(?:var\(|inherit$|transparent$)/, `${property}: ${value.trim()} should use a token`);
    }
  }
});
