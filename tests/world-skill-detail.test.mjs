import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root = process.cwd();
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');
const details = {
  'class1_2.html': {
    title: 'class1_2',
    accordions: ['code'],
    hashes: ['ecf63ea6fe1240f76d91d9c6a8ce498d0a2da5b8ffd2057d55f674144a466bd7'],
  },
  'exercise4.html': {
    title: 'exercise4',
    accordions: ['Switch 按鈕', 'SeekBar 滑動條', 'BottomSheetDialog', 'PopupMenu', 'numberPicker 顯示', 'WebView', 'ValueAnimator', 'Copy text', '放音槳', '播影片'],
    hashes: ['b9d1a123d0e2eca856bdf5432c8a052e4852d01f4fe358a6dc86fa203c4f93e4', '66d2371fe65ae4cf44abd4dd2c01f4bc405eec0d8b4c17516db086248f736ce6', '510f0991276a4307b19d63ce9e3dc6e60c7961009440ae703a192de99cce412a', '2be05239b7f77b643e082cfd6456a2c141bab286f42d69998b545c4c74abc46e', 'ac33f81003d6a052299ca4eb0f9d3482d90b96b6d3467bdeba0ac471cddf631f', '893722766f1464b10a772045be72e00193ef14043b5e4318769919de98180213', '5519de3e1b18b22006990340eb62136b3d7f16460ee58b0d1317283b3d611c4b', '9aa1649a11b80cfb53a744a88f786ec0224a19e2bd012de77bd2a77b0fc5918e', '03750f99c6fbdca1ac45817db1a0061e457bb25d85a256c0550b1db1471ff0fc', '315eea4467a65064470800fae20fea2081181dfaee3b65150e267872a62b995f'],
  },
  'class9_2.html': {
    title: 'class9_2',
    accordions: ['code', 'code', 'MainAvitivty.kt'],
    hashes: ['97c9360271e4b5c4b2cacdb8f9f3155de26c8697c9426acbd2b941a5af380216', 'b036e636c6e4a0344081dc42b28c601a85b98991742bdd7a264be4e7aa04b038', '43029c8b187cc6f7ef9682049e8bcae4c878558451c9f16c5b7637f37132f5bd'],
  },
  '03_Module_A_AM.html': {
    title: '03_Module_A_AM',
    accordions: ['Data.kt', 'GameOverActivity.kt', 'MainActivity.kt', 'activity_game_over.xml', 'activity_main.xml'],
    hashes: ['004b3e2df772cccf9f832c4ed2fcf538570601db157eec55afd5b5e5d1165cda', '9ef8a2323ba4f513b3d02b977004d8f551681fe4eb82ebdee301d2766cf795a2', '8f30395b3e3d0926699ed7fcf29dbb6fffd35a07008818d75de47f0349134ef1', 'ddff43f412664a6ba557ef891f27cdfd771dd41d9605fb1e994054155ed99bbb', 'b9a06d52a4e324d7366b129443f888347d821e3ed9fe08f2e2254fbc273bc9e9'],
  },
  'class7_2.html': {
    title: 'class7_2',
    accordions: ['code'],
    hashes: ['c7697aa7a1929cfc1ec1eb68aad4fece0808b708d20b042b869dc3f6548bf3c0'],
  },
  'exercise22.html': {
    title: 'exercise22',
    accordions: ['放大', '移勳'],
    hashes: ['a912735da6bbae8b06451450aa8ed8f3a7a422ed66016ad1a6229dde1a352f95', '05a68007851b320d2e6208e076975852663c03d46ea1a40a9e31dffed0af5b16', 'e7849add3ebd9314d3a4911ffeb0c25e4aaf1fd5825ce964ed33a326349c84ac', '898ca1a59a4fea5f266d3526b6833af38ab2f03d29f5cf94af16b6f72d883f16'],
  },
};

function getPreContents(html, filename) {
  return [...html.matchAll(/<pre\b[^>]*>\s*<code>([\s\S]*?)<\/code>\s*<\/pre>/gi)].map((match) => {
    let content = match[1].replace(/<span class="code-comment">/g, '<span>');
    if (filename === 'class7_2.html') content = content.replaceAll('&lt;TextView&gt;', '<TextView>');
    return content;
  });
}

const hash = (content) => createHash('sha256').update(content.replace(/\r\n?/g, '\n')).digest('hex');

test('six detail pages load the shared shell, accordion and detail styles without legacy assets', () => {
  assert.equal(existsSync(path.join(root, 'assets/css/detail-page.css')), true);
  for (const filename of Object.keys(details)) {
    const html = read(`world skill/${filename}`);
    assert.match(html, /<html\b[^>]*lang=["']zh-Hant["'][^>]*data-site-root=["']\.\.\/["']/i);
    for (const asset of ['../assets/css/foundation.css', '../assets/css/app-shell.css', '../assets/css/accordion.css', '../assets/css/detail-page.css', '../assets/js/site-navigation.js', '../assets/js/accordion.js']) {
      assert.ok(html.includes(asset), `${filename} should load ${asset}`);
    }
    assert.doesNotMatch(html, /(?:href|src)=["'](?:style\.css|js\.js)["']/);
    assert.match(html, /class=["'][^"']*skip-link/);
    assert.match(html, /data-site-navigation=["']desktop["']/);
    assert.match(html, /data-site-navigation=["']mobile["']/);
    assert.match(html, /id=["']main-content["']/);
  }
});

test('detail headings and breadcrumbs use the original item names and valid routes', () => {
  for (const [filename, expected] of Object.entries(details)) {
    const html = read(`world skill/${filename}`);
    assert.ok(html.includes(`<title>${expected.title}｜World Skill 練習</title>`));
    assert.ok(html.includes(`<h1>${expected.title}</h1>`));
    assert.match(html, /href=["']\.\.\/index\.html["'][^>]*>首頁<\/a>/);
    assert.match(html, /href=["']index\.html["'][^>]*>World Skill 練習<\/a>/);
    assert.match(html, /aria-current=["']page["']/);
    assert.ok((html.match(/href=["']index\.html["']/g) ?? []).length >= 2);
  }
});

test('all original accordion titles and code blocks remain in order', () => {
  for (const [filename, expected] of Object.entries(details)) {
    const html = read(`world skill/${filename}`);
    const titles = [...html.matchAll(/<button\b[^>]*data-accordion-trigger[^>]*>([\s\S]*?)<\/button>/gi)]
      .map((match) => match[1].replace(/<[^>]*>/g, '').trim());
    const contents = getPreContents(html, filename);
    assert.deepEqual(titles, expected.accordions, `${filename} accordion titles`);
    assert.equal(contents.length, expected.hashes.length, `${filename} pre count`);
    assert.deepEqual(contents.map(hash), expected.hashes, `${filename} code preservation`);
  }
});

test('accordions have unique accessible relationships and readable initial panels', () => {
  const allIds = new Set();
  for (const filename of Object.keys(details)) {
    const html = read(`world skill/${filename}`);
    const buttons = [...html.matchAll(/<button\b[^>]*data-accordion-trigger[^>]*>/gi)].map(([tag]) => tag);
    const panels = [...html.matchAll(/<div\b[^>]*data-accordion-panel[^>]*>/gi)].map(([tag]) => tag);
    assert.equal(buttons.length, details[filename].accordions.length);
    assert.equal(panels.length, buttons.length);
    buttons.forEach((button, index) => {
      const id = button.match(/\bid=["']([^"']+)["']/i)?.[1];
      const panelId = button.match(/\baria-controls=["']([^"']+)["']/i)?.[1];
      assert.ok(id && panelId);
      assert.equal(button.match(/\baria-expanded=["']([^"']+)["']/i)?.[1], 'true');
      assert.equal(panels[index].match(/\bid=["']([^"']+)["']/i)?.[1], panelId);
      assert.equal(panels[index].match(/\baria-labelledby=["']([^"']+)["']/i)?.[1], id);
      assert.doesNotMatch(panels[index], /\bhidden\b/i);
      assert.equal(allIds.has(id) || allIds.has(panelId), false);
      allIds.add(id);
      allIds.add(panelId);
    });
  }
});

test('shared accordion enhances detail roots when optional toolbar controls are absent', () => {
  const context = { console, globalThis: {} };
  vm.runInNewContext(read('assets/js/accordion.js'), context, { filename: 'accordion.js' });
  const accordion = context.globalThis.AndroidLearningAccordion;
  const button = {
    attributes: new Map([['aria-expanded', 'true']]),
    listeners: new Map(),
    addEventListener(type, listener) { this.listeners.set(type, listener); },
    setAttribute(name, value) { this.attributes.set(name, value); },
    getAttribute(name) { return this.attributes.get(name); },
  };
  const panel = { hidden: false, textContent: 'content' };
  const item = {
    hidden: false,
    dataset: { title: 'code' },
    querySelector(selector) { return selector === '[data-accordion-trigger]' ? button : panel; },
  };
  const rootElement = {
    dataset: {},
    querySelector() { return null; },
    querySelectorAll() { return [item]; },
  };
  assert.doesNotThrow(() => accordion.setupAccordion({ querySelectorAll: () => [rootElement] }));
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  assert.equal(panel.hidden, true);
  button.listeners.get('click')();
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  assert.equal(panel.hidden, false);
});

test('class7_2 keeps a responsive titled PDF with a normal fallback link', () => {
  const html = read('world skill/class7_2.html');
  const iframe = html.match(/<iframe\b[^>]*>/i)?.[0] ?? '';
  assert.match(iframe, /src=["']Kotlin 日期時間\.pdf["']/);
  assert.match(iframe, /title=["'][^"']+["']/);
  assert.doesNotMatch(iframe, /\b(?:height|style)=/i);
  assert.match(html, /href=["']Kotlin%20日期時間\.pdf["'][^>]*target=["']_blank["'][^>]*rel=["']noopener["']/);
  assert.equal(existsSync(path.join(root, 'world skill/Kotlin 日期時間.pdf')), true);
});

test('exercise22 retains two standalone code blocks outside its accordions', () => {
  const html = read('world skill/exercise22.html');
  const firstItem = html.indexOf('data-accordion-item');
  const lastItemEnd = html.lastIndexOf('</article>');
  const prePositions = [...html.matchAll(/<pre\b[^>]*class=["'][^"']*code-block/gi)].map((match) => match.index);
  assert.equal(prePositions.length, 4);
  assert.ok(prePositions[0] < firstItem);
  assert.ok(prePositions[3] > lastItemEnd);
});

test('detail page CSS uses only design tokens and avoids fixed heights and floats', () => {
  const css = read('assets/css/detail-page.css');
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|\brgba?\s*\(|\b\d+(?:\.\d+)?px\b/i);
  assert.doesNotMatch(css, /\bfloat\s*:|(?:^|;)\s*height\s*:/im);
  assert.match(css, /\.detail-breadcrumb/);
  assert.match(css, /\.detail-pdf/);
  assert.match(css, /overflow-x:\s*auto/);
  assert.match(css, /@media/);
});
