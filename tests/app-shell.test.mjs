import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root = process.cwd();
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

const foundationFiles = [
  'assets/css/tokens.css',
  'assets/css/base.css',
  'assets/css/utilities.css',
  'assets/css/components.css',
  'assets/css/foundation.css',
  'assets/css/app-shell.css',
  'assets/css/home.css',
  'assets/js/site-navigation.js',
  'assets/js/home-search.js',
];

const originalEntryHrefs = [
  'page1.html',
  'page2.html',
  'world skill/index.html',
  'forgot.html',
  'pdf.html',
  'training/',
  'knowledge/index.html',
  'homework/index.html',
];

const originalEntryLabels = [
  '堂上練習',
  '自己練習',
  'world skill',
  '經常忘記大全',
  '所有pdf',
  '練習題檔案',
  '知識點knowledge',
  'homework',
];

function loadBrowserScript(relativePath) {
  const context = { console, globalThis: {} };
  vm.runInNewContext(read(relativePath), context, { filename: relativePath });
  return context.globalThis;
}

test('creates the approved UI foundation and Homepage assets', () => {
  for (const relativePath of foundationFiles) {
    assert.equal(existsSync(path.join(root, relativePath)), true, `${relativePath} should exist`);
  }
});

test('defines every approved color, spacing, radius and font in tokens', () => {
  const tokens = read('assets/css/tokens.css');
  const approvedColors = [
    '#F7F8F6', '#FFFFFF', '#EEF1EE', '#18211D', '#6C7872', '#DCE3DF',
    '#2E7D5B', '#236047', '#E9F7F0', '#6550B8', '#F0EDFF', '#C47D17', '#C44747',
  ];
  const approvedSpacing = ['4px', '8px', '12px', '16px', '20px', '24px', '32px', '40px', '48px', '64px'];
  const approvedRadii = ['6px', '10px', '14px', '20px'];

  for (const value of [...approvedColors, ...approvedSpacing, ...approvedRadii]) {
    assert.match(tokens, new RegExp(value.replace('#', '\\#'), 'i'), `tokens should include ${value}`);
  }

  assert.match(tokens, /Noto Sans TC/);
  assert.match(tokens, /IBM Plex Sans/);
  assert.match(tokens, /IBM Plex Mono/);
  assert.match(tokens, /--radius-(?:pill|full):/);
  assert.match(tokens, /--shadow-/);
});

test('keeps literal colors, pixel dimensions, fonts, radii and shadows out of component CSS', () => {
  const nonTokenCss = foundationFiles
    .filter((file) => file.endsWith('.css') && !file.endsWith('tokens.css'))
    .map(read)
    .join('\n');

  assert.doesNotMatch(nonTokenCss, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(nonTokenCss, /\b\d+(?:\.\d+)?px\b/i);

  for (const property of ['font-family', 'font-size', 'letter-spacing', 'border-radius', 'box-shadow']) {
    const declarations = [...nonTokenCss.matchAll(new RegExp(`${property}\\s*:\\s*([^;\\n]+)`, 'gi'))];
    for (const [, value] of declarations) {
      assert.match(value.trim(), /^(?:var\(|inherit$)/, `${property}: ${value.trim()} should use a token`);
    }
  }
});

test('provides the requested components and interaction states', () => {
  const css = read('assets/css/components.css');
  const componentSelectors = [
    '.button', '.icon-button', '.search-field', '.filter-chip', '.status-badge',
    '.progress', '.card', '.code-block', '.state', '.state--empty', '.state--loading', '.state--error',
  ];

  for (const selector of componentSelectors) assert.match(css, new RegExp(selector.replace('.', '\\.')));
  assert.match(css, /:hover/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /:disabled|\[aria-disabled=["']true["']\]/);
});

test('uses one eight-item source for desktop links and mobile overflow navigation', () => {
  const globals = loadBrowserScript('assets/js/site-navigation.js');
  const navigation = globals.AndroidLearningNavigation;

  assert.ok(navigation);
  assert.deepEqual(Array.from(navigation.items, ({ id }) => id), [
    'home', 'learning', 'homework', 'knowledge', 'resources', 'world-skills', 'forgot', 'pdf',
  ]);
  assert.deepEqual(Array.from(navigation.items, ({ href }) => href), [
    'index.html', 'page1.html', 'homework/index.html', 'knowledge/index.html',
    'training/', 'world skill/', 'forgot.html', 'pdf.html',
  ]);
  assert.deepEqual(Array.from(navigation.getMobilePrimaryItems(), ({ id }) => id), [
    'home', 'learning', 'homework', 'knowledge',
  ]);
  assert.deepEqual(Array.from(navigation.getMobileOverflowItems(), ({ id }) => id), [
    'resources', 'world-skills', 'forgot', 'pdf',
  ]);
  assert.equal(navigation.getActiveNavId('/index.html'), 'home');
  assert.equal(navigation.getActiveNavId('/world%20skill/class3_1.html'), 'world-skills');
  assert.equal(navigation.getActiveNavId('/homework/Note_Taking_App.html'), 'homework');
  assert.equal(navigation.getActiveNavId('/knowledge/index.html'), 'knowledge');
  assert.equal(navigation.getActiveNavId('/training/?path=Module%20A'), 'resources');
  assert.equal(navigation.getActiveNavId('/forgot.html'), 'forgot');
  assert.equal(navigation.getActiveNavId('/pdf.html'), 'pdf');
});

test('preserves the original Homepage entries, dependencies and explanatory notes', () => {
  const html = read('index.html');
  for (const href of originalEntryHrefs) {
    assert.match(html, new RegExp(`href=["']${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`));
  }

  for (const label of originalEntryLabels) {
    assert.match(html, new RegExp(label, 'i'));
  }

  assert.match(html, /implementation\("io\.coil-kt:coil:2\.4\.0"\)/);
  assert.match(html, /implementation\("com\.squareup\.okhttp3:okhttp:4\.9\.0"\)/);
  assert.match(html, /implementation\("com\.google\.code\.gson:gson:2\.8\.6"\)/);
  assert.match(html, /如果介面係左右分且各不相干/);
  assert.match(html, /val list = Data\.ABC\.filter/);
  assert.match(html, /要真係去睇時間是否充足/);
  assert.match(html, /各個\s+檔案分類/);
  assert.match(html, /入口搜尋/);
  assert.doesNotMatch(html, /全文搜尋/);
  assert.doesNotMatch(html, /本週學習摘要|待完成作業|課程進度|Continue learning|繼續你的學習路線/iu);
  assert.doesNotMatch(html, /id=["'](?:weekly-summary|pending-homework|course-progress|continue-learning|continue-route)["']/i);
  assert.match(html, /data-site-navigation=["']desktop["']/);
  assert.match(html, /data-site-navigation=["']mobile["']/);
});

test('searches only the known entry catalogue and keeps its wording honest', () => {
  const globals = loadBrowserScript('assets/js/home-search.js');
  const search = globals.AndroidLearningEntrySearch;

  assert.ok(search);
  assert.deepEqual(Array.from(search.items, ({ href }) => href).sort(), [...originalEntryHrefs].sort());
  assert.deepEqual(Array.from(search.items, ({ title }) => title), originalEntryLabels);
  assert.equal(search.searchEntries('pdf')[0].href, 'pdf.html');
  assert.equal(search.searchEntries('知識')[0].href, 'knowledge/index.html');
  assert.deepEqual(Array.from(search.searchEntries('不存在的全文內容')), []);
});

test('provides responsive entry grids and a touch-safe mobile more menu', () => {
  const css = read('assets/css/home.css');
  const shellCss = read('assets/css/app-shell.css');

  assert.match(css, /\.entry-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*var\(--card-min\)\),\s*1fr\)\)/);
  assert.match(shellCss, /\.mobile-navigation__more-toggle[\s\S]*?min-height:\s*var\(--control-size\)/);
  assert.match(shellCss, /\.mobile-navigation__more-menu/);
});
