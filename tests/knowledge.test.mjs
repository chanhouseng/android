import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const read = (file) => readFileSync(path.resolve(file), 'utf8');
const attr = (tag, name) => tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`))?.[1];
const titles = [
  '文字輸入驗證(常見的字元檢查方法)', '獲得他的第幾個元素(0,1,...R)',
  '設定ScollView滑到那裏', '打開google map', '打開apps', '動態加入多行layout',
  '日期選擇器最小可選日期設為「今天」', 'Double', '轉換日夜間模式',
  'viewPager2因應內容大小而改變大小',
];

// Captured from the original page before migration. Only outer whitespace and
// HTML presentation tags are ignored; code indentation, comments and words are not.
const knowledgeCodeHashes = [
  'd8debfb35af96a6c27b6dd2b257c60b65e5c111cf781b97d69278f9ae8e98142',
  '18d827a7239bdfa7acb874c71f2de623f57d1cca10e848445d45699174588038',
  'b90e7aab3a70498e90484beb976b5404f6c26551e859cafe3a51cab75d15b246',
  '4eee3fb7754de80b38d15421557278fec7686917a335121ac0212c27b3fb8971',
  '26b280de8e5c90e239ed63e55105dbad2b029207726b04aa2354f2753b84d4be',
  'e43eb8727799a6329698ebefee56995d4eec6e23c3889ae5d020218a421d9227',
  'cba48a2198decdc3c65b82ccc87ce06cdb2f89e7e1f33366b35a94249dcc4d6a',
  'fdd0c5e8be0b50b57f9045cfc6092096aa02bc3563d665abc3f704517cc97a28',
  '6749a10ad7d967fb7addbd9da53ca182b9e0db0bf5036b08a274b63ec72c9396',
];
const forgotCodeHashes = [
  '5dd453ef03961895b67039855798c92931eca949ed26612098280df9ce439ca1',
  '4c7a2ba0349f8025418ec571a4fe0e9f2b0f38ab466ee69e0179b3dab6602c48',
  'f80165bab21893d82b7008d5a0a1cba3351ac05ac91eb50ae166689e1564fdb2',
  'c28fe041c7db05d2bea7771bb225df19a41f40e5037d68e5e574b518a69a45dd',
  'd0fec71098f5f4a8746e8d618302e0f81ee3eed9c07239f82f073e6508c8d0c7',
  'c4050b769c07b1e4c41f8475305437eb684ad8fe1e72ffe6b6a23ae9bde981a8',
  '6623725d97f35f2f62114555c48f99b52903035dabf740c12d3ca4016625986e',
  '70387bce27f99beff48345a3d9d359e51b9344cadaa61852e1a4d23fcfde24bd',
  'e420083e6ab31052f267e526b21c59b67fb3790baf281ff492b399d43bb5ef4b',
  'e3feb90ded9dcd3df5a53287129696ae218a980cf923407133d01b9ae5cff1c9',
  'd6783a41e8c0dcfc46af285f655c860ab418caac94cdddfce3f9f5a7bd1eb70d',
  '6cc266f4811ec3db2c83aafb03a02f4a2c102dfdaeef8f4591f344626284075b',
  'b7c0fcf5281951f01f96b6bbfb3975f7ed51f78a04b6a44116a382defa4b4ff6',
  '2e46c88a81d2ad8917fae48a2f1bb29e3d1885d040fdc5b48d98b7c42bc9fec1',
  '070c1a4ebf4c6b7b4ebb25e000bfba5aa22307cddefd3c4f0cceae588c4d8410',
  '350b469241acfc8fe7171f397f9631eb9c866c27db4ebfdac949161724c83fdc',
  '7899d74aa16988ea99c6764084c242fc0bfcdb28844df17d8da3175e4d04da2e',
];
function codeHashes(html) {
  return [...html.matchAll(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi)]
    .map(([, body]) => body.replace(/<(p|a)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&').replace(/\r\n/g, '\n').trim())
    .filter(Boolean).map((code) => createHash('sha256').update(code).digest('hex'));
}

test('Knowledge loads the shared shell and accordion without legacy page assets', () => {
  const html = read('knowledge/index.html');
  for (const asset of ['foundation.css', 'app-shell.css', 'accordion.css', 'knowledge.css']) {
    assert.ok(html.includes(`../assets/css/${asset}`));
  }
  for (const asset of ['site-navigation.js', 'accordion.js']) assert.ok(html.includes(`../assets/js/${asset}`));
  assert.match(html, /lang="zh-Hant"/);
  assert.match(html, /data-site-root="\.\.\/"/);
  assert.match(html, /<title>知識庫｜Android Learning<\/title>/);
  assert.match(html, /class="skip-link"/);
  assert.match(html, /id="main-content"[^>]*tabindex="-1"/);
  for (const mode of ['desktop', 'mobile']) assert.ok(html.includes(`data-site-navigation="${mode}"`));
  assert.doesNotMatch(html, /(?:href|src)="(?:\.\/)?(?:style\.css|js\.js)"/);
  assert.ok(existsSync('knowledge/style.css') && existsSync('knowledge/js.js'));
  const context = { globalThis: {} };
  vm.runInNewContext(read('assets/js/site-navigation.js'), context);
  assert.equal(context.globalThis.AndroidLearningNavigation.getActiveNavId('/knowledge/index.html'), 'knowledge');
});

test('Knowledge preserves 10 real titles in order and removes only empty code placeholders', () => {
  const html = read('knowledge/index.html');
  const actual = [...html.matchAll(/<button\b[^>]*data-accordion-trigger[^>]*>([\s\S]*?)<\/button>/g)]
    .map(([, title]) => title.trim());
  assert.deepEqual(actual, titles);
  assert.equal((html.match(/data-accordion-item/g) ?? []).length, 10);
});

test('both pages retain all original code, indentation and comments', () => {
  assert.deepEqual(codeHashes(read('knowledge/index.html')), knowledgeCodeHashes);
  assert.deepEqual(codeHashes(read('forgot.html')), forgotCodeHashes);
});

test('Knowledge retains the image, highlights, explanations and valid reference links outside pre', () => {
  const html = read('knowledge/index.html');
  const pres = [...html.matchAll(/<pre\b[^>]*>([\s\S]*?)<\/pre>/g)];
  assert.equal(pres.length, 9);
  for (const [, body] of pres) {
    assert.match(body, /^<code>[\s\S]*<\/code>$/);
    assert.doesNotMatch(body, /<(?:p|a)\b/);
  }
  assert.equal((html.match(/homework6常用/g) ?? []).length, 2);
  for (const mark of ['linearLayout.getChildAt', 'scrollView.scrollX, scrollY']) assert.ok(html.includes(`<mark>${mark}</mark>`));
  const image = html.match(/<img\b[^>]*>/)?.[0];
  assert.equal(attr(image, 'src'), 'img/table1.png');
  assert.ok((attr(image, 'alt') ?? '').length > 8);
  for (const href of ['img/table1.png', '../homework/02_Module_A_PM.html', '../forgot.html']) {
    assert.ok(html.includes(`href="${href}"`));
    assert.ok(existsSync(path.resolve('knowledge', href)));
  }
});

test('both accordions have unique relationships and readable initial panels', () => {
  for (const [file, count, scope] of [['knowledge/index.html', 10, 'all'], ['forgot.html', 17, 'title']]) {
    const html = read(file);
    assert.ok(html.includes(`data-accordion-search-scope="${scope}"`));
    assert.ok(html.includes('assets/css/accordion.css'));
    const triggers = [...html.matchAll(/<button\b[^>]*data-accordion-trigger[^>]*>/g)].map(m=>m[0]);
    const panels = [...html.matchAll(/<div\b[^>]*data-accordion-panel[^>]*>/g)].map(m=>m[0]);
    assert.equal(triggers.length, count);
    assert.equal(panels.length, count);
    assert.equal(new Set([...triggers,...panels].map(tag=>attr(tag,'id'))).size, count*2);
    triggers.forEach((tag,i)=>{
      assert.equal(attr(tag,'type'),'button');
      assert.equal(attr(tag,'aria-expanded'),'true');
      assert.equal(attr(tag,'aria-controls'),attr(panels[i],'id'));
      assert.equal(attr(panels[i],'aria-labelledby'),attr(tag,'id'));
      assert.doesNotMatch(panels[i], /\bhidden\b/);
    });
    const countTag = html.match(/<p\b[^>]*data-accordion-announcement[^>]*>/)?.[0] ?? '';
    assert.equal(attr(countTag,'aria-live'),'polite');
    assert.doesNotMatch(countTag, /sr-only/);
  }
});

function loadAccordion() {
  const context = { globalThis: {} };
  vm.runInNewContext(read('assets/js/accordion.js'), context);
  assert.ok(context.globalThis.AndroidLearningAccordion, 'generic component API is exported');
  return context.globalThis.AndroidLearningAccordion;
}

// Minimal DOM boundary; handlers run the production component. No DOM package is installed.
function node(children = {}) {
  return {
    dataset: {}, hidden: false, value: '', disabled: false, textContent: '', attributes: {}, listeners: {},
    querySelector: (selector) => children[selector] ?? null,
    querySelectorAll: (selector) => children[selector] ?? [],
    setAttribute(name,value) { this.attributes[name] = value; },
    getAttribute(name) { return this.attributes[name] ?? null; },
    addEventListener(name,handler) { (this.listeners[name] ??= []).push(handler); },
    fire(name,event={}) { for (const handler of this.listeners[name] ?? []) handler(event); },
    focus() { this.focused = true; },
  };
}
function fixture(scope) {
  const search=node(), clear=node(), expand=node(), collapse=node(), empty=node(), count=node();
  const form=node({'[data-accordion-search]':search,'[data-accordion-clear]':clear});
  const records = [['日期', 'LocalDate.parse 日期格式'], ['地圖', 'Intent.ACTION_VIEW'], ['Double', 'var n: Double = 0.0']]
    .map(([title,content])=>{
      const button=node(), panel=node(); panel.textContent=content;
      button.setAttribute('aria-expanded','true');
      const item=node({'[data-accordion-trigger]':button,'[data-accordion-panel]':panel}); item.dataset.title=title;
      return {item,button,panel};
    });
  const root=node({
    '[data-accordion-filter]':form, '[data-accordion-expand-all]':expand,
    '[data-accordion-collapse-all]':collapse, '[data-accordion-empty]':empty,
    '[data-accordion-announcement]':count, '[data-accordion-item]':records.map(r=>r.item),
  }); root.dataset.accordionSearchScope=scope;
  return {root,records,search,clear,expand,collapse,empty,count};
}

test('shared search normalizes Unicode and case and supports title-only or all-content modes', () => {
  const api=loadAccordion();
  const records=[{title:'日期',content:'LocalDate.parse()'}, {title:'Map',content:'Intent.ACTION_VIEW'}];
  assert.equal(api.filterEntries(records,'ＬＯＣＡＬＤＡＴＥ','all').length,1);
  assert.equal(api.filterEntries(records,'localdate','title').length,0);
  assert.equal(api.filterEntries(records,'ＭＡＰ','title').length,1);
  assert.equal(api.filterEntries(records,'不存在','all').length,0);
});

test('component enhances each root independently and does not bind duplicate handlers', () => {
  const api=loadAccordion(), first=fixture('title'), second=fixture('all');
  const doc=node({'[data-accordion-root]':[first.root,second.root]});
  api.setupAccordion(doc); api.setupAccordion(doc);
  for (const f of [first,second]) assert.ok(f.records.every(r=>r.panel.hidden));
  first.records[0].button.fire('click');
  assert.equal(first.records[0].panel.hidden,false);
  assert.equal(second.records[0].panel.hidden,true);
  assert.equal(first.records[0].button.getAttribute('aria-expanded'),'true');
});

test('search preserves expansion, bulk actions affect only visible entries, Escape restores focus and count', () => {
  const api=loadAccordion(), f=fixture('all'); api.setupAccordion(node({'[data-accordion-root]':[f.root]}));
  f.records[0].button.fire('click');
  f.search.value='action_view'; f.search.fire('input');
  assert.deepEqual(f.records.map(r=>r.item.hidden),[true,false,true]);
  assert.equal(f.records[0].panel.hidden,false,'filter must not collapse a hidden match');
  assert.equal(f.count.textContent,'找到 1 個條目');
  f.expand.fire('click');
  assert.deepEqual(f.records.map(r=>r.panel.hidden),[false,false,true]);
  f.collapse.fire('click');
  assert.deepEqual(f.records.map(r=>r.panel.hidden),[false,true,true]);
  f.search.value='not-found'; f.search.fire('input');
  assert.equal(f.empty.hidden,false);
  assert.equal(f.count.textContent,'找到 0 個條目');
  f.search.fire('keydown',{key:'Escape',preventDefault(){}});
  assert.equal(f.search.value,''); assert.equal(f.search.focused,true);
  assert.ok(f.records.every(r=>!r.item.hidden));
  assert.equal(f.records[0].panel.hidden,false);
  assert.equal(f.count.textContent,'顯示全部 3 個條目');
  assert.equal(f.empty.hidden,true); assert.equal(f.clear.disabled,true);
  f.search.value='Double'; f.search.fire('input'); f.clear.fire('click');
  assert.equal(f.search.value,''); assert.ok(f.records.every(r=>!r.item.hidden));
});

test('Forgot integration searches titles rather than code', () => {
  const api=loadAccordion(), f=fixture('title'); api.setupAccordion(node({'[data-accordion-root]':[f.root]}));
  f.search.value='LocalDate'; f.search.fire('input'); assert.equal(f.empty.hidden,false);
  f.search.value='日期'; f.search.fire('input'); assert.equal(f.count.textContent,'找到 1 個條目');
});

test('shared Accordion CSS owns the component styles and all new styles use tokens', () => {
  assert.doesNotMatch(read('assets/css/forgot.css'), /\.accordion-(?:trigger|panel|item|list)/);
  const css=read('assets/css/accordion.css')+'\n'+read('assets/css/knowledge.css');
  assert.doesNotMatch(css, /#[\da-f]{3,8}\b|\brgba?\s*\(|\b\d+(?:\.\d+)?px\b/i);
  assert.doesNotMatch(css, /^\s*(?:span|a|div)\s*\{/m);
  assert.match(css,/\.accordion-trigger:disabled/);
  assert.match(css,/\.accordion-trigger:focus-visible/);
  assert.match(css,/prefers-reduced-motion/);
  assert.match(css,/var\(--font-code\)/);
  assert.match(css,/overflow-x:\s*auto/);
  assert.match(css,/object-fit:\s*contain/);
  for (const property of ['color','background','font-family','font-size','border-radius','box-shadow']) {
    for (const [,value] of css.matchAll(new RegExp(`${property}\\s*:\\s*([^;\\n]+)`,'gi'))) {
      assert.match(value.trim(),/^(?:var\(|inherit$)/,`${property}: ${value}`);
    }
  }
});
