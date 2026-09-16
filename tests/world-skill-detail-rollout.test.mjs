import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root = process.cwd();
const worldSkillRoot = path.join(root, 'world skill');
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');
const baseline = JSON.parse(read('tests/fixtures/world-skill-detail-baseline.json'));
const rolloutFiles = Object.keys(baseline.files);
const pilotFiles = [
  'class1_2.html',
  'exercise4.html',
  'class9_2.html',
  '03_Module_A_AM.html',
  'class7_2.html',
  'exercise22.html',
];
const allDetailFiles = [...pilotFiles, ...rolloutFiles];

const compactText = (content) => content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const canonicalCode = (content) => content
  .replace(/\r\n?/g, '\n')
  .replace(/<span\b[^>]*>/gi, '<span>');
const hashCode = (content) => createHash('sha256').update(canonicalCode(content)).digest('hex');

function originalContent(html) {
  return html.match(/<div\b[^>]*data-original-content[^>]*>([\s\S]*?)\s*<\/div>\s*<footer\b/i)?.[1] ?? '';
}

function preContents(html) {
  return [...html.matchAll(/<pre\b[^>]*>\s*<code>([\s\S]*?)<\/code>\s*<\/pre>/gi)]
    .map((match) => match[1])
    .filter((content) => compactText(content) !== '');
}

function accordionTitles(html) {
  return [...html.matchAll(/<button\b[^>]*data-accordion-trigger[^>]*>([\s\S]*?)<\/button>/gi)]
    .map((match) => compactText(match[1]));
}

function attribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'))?.[1] ?? null;
}

function contentResources(html) {
  const content = originalContent(html);
  return {
    links: [...content.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)]
      .map((match) => match[1])
      .filter((value) => !/^([a-z]+:|#)/i.test(value)),
    images: [...content.matchAll(/<img\b[^>]*>/gi)].map((match) => ({
      src: attribute(match[0], 'src'),
      alt: attribute(match[0], 'alt'),
    })),
    iframes: [...content.matchAll(/<iframe\b[^>]*>/gi)].map((match) => ({
      src: attribute(match[0], 'src'),
      title: attribute(match[0], 'title'),
    })),
    embeds: [...content.matchAll(/<(?:embed|object|audio|video|source)\b[^>]*>/gi)].map((match) => ({
      tag: match[0].match(/^<([a-z]+)/i)[1].toLowerCase(),
      src: attribute(match[0], 'src') ?? attribute(match[0], 'data'),
    })),
  };
}

function loadNavigation() {
  const context = { console, globalThis: {} };
  vm.runInNewContext(read('assets/js/site-navigation.js'), context, { filename: 'site-navigation.js' });
  return context.globalThis.AndroidLearningNavigation;
}

test('fixture locks the pre-migration truth for all 29 rollout pages', () => {
  assert.equal(baseline.schemaVersion, 1);
  assert.equal(rolloutFiles.length, 29);
  assert.deepEqual(baseline.files['example.html'].blankAccordionPositions, [1]);
  assert.deepEqual(baseline.files['exercise7.html'].blankAccordionPositions, [1]);
  assert.deepEqual(
    baseline.files['exercise24.html'].blankAccordionPositions,
    [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
  );
  assert.equal(
    rolloutFiles.reduce((total, file) => total + baseline.files[file].nonEmptyPreCount, 0),
    48,
  );
});

test('all 35 World Skill detail pages use the shared semantic template', () => {
  const navigation = loadNavigation();
  assert.equal(allDetailFiles.length, 35);

  for (const filename of allDetailFiles) {
    const html = read(`world skill/${filename}`);
    assert.match(html, /<html\b[^>]*lang=["']zh-Hant["'][^>]*data-site-root=["']\.\.\/["']/i, filename);
    for (const asset of [
      '../assets/css/foundation.css',
      '../assets/css/app-shell.css',
      '../assets/css/accordion.css',
      '../assets/css/detail-page.css',
      '../assets/js/site-navigation.js',
      '../assets/js/accordion.js',
    ]) {
      assert.ok(html.includes(asset), `${filename} should load ${asset}`);
    }
    assert.doesNotMatch(html, /(?:href|src)=["'](?:style\.css|js\.js)["']/i, filename);
    assert.match(html, /class=["'][^"']*skip-link/i, filename);
    assert.match(html, /data-site-navigation=["']desktop["']/i, filename);
    assert.match(html, /data-site-navigation=["']mobile["']/i, filename);
    assert.match(html, /id=["']main-content["']/i, filename);
    assert.match(html, /aria-label=["']Breadcrumb["']/i, filename);
    assert.match(html, /class=["'][^"']*detail-header/i, filename);
    assert.match(html, /class=["'][^"']*detail-footer/i, filename);
    assert.match(html, /href=["']\.\.\/index\.html["'][^>]*>首頁<\/a>/i, filename);
    assert.match(html, /href=["']index\.html["'][^>]*>World Skill 練習<\/a>/i, filename);
    assert.equal(navigation.getActiveNavId(`/world%20skill/${filename}`), 'world-skills', filename);
  }
});

test('rollout pages preserve every real accordion title and non-empty code hash', () => {
  for (const filename of rolloutFiles) {
    const expected = baseline.files[filename];
    const html = read(`world skill/${filename}`);
    assert.deepEqual(accordionTitles(html), expected.retainedAccordionTitles, `${filename} titles`);
    assert.deepEqual(preContents(html).map(hashCode), expected.preSha256, `${filename} code hashes`);
  }
});

test('rollout pages preserve descriptions, marks and embedded content', () => {
  for (const filename of rolloutFiles) {
    const expected = baseline.files[filename];
    const content = originalContent(read(`world skill/${filename}`));
    for (const description of expected.descriptions) assert.ok(content.includes(description), `${filename}: ${description}`);
    assert.deepEqual(
      [...content.matchAll(/<mark\b[^>]*>([\s\S]*?)<\/mark>/gi)].map((match) => compactText(match[1])),
      expected.marks,
      `${filename} marks`,
    );
    assert.deepEqual(contentResources(read(`world skill/${filename}`)), {
      links: expected.links,
      images: expected.images,
      iframes: expected.iframes,
      embeds: expected.embeds,
    }, `${filename} resources`);
  }
});

test('every migrated accordion has unique accessible relationships and readable source content', () => {
  for (const filename of rolloutFiles) {
    const html = read(`world skill/${filename}`);
    const buttons = [...html.matchAll(/<button\b[^>]*data-accordion-trigger[^>]*>/gi)].map(([tag]) => tag);
    const panels = [...html.matchAll(/<(?:div|section)\b[^>]*data-accordion-panel[^>]*>/gi)].map(([tag]) => tag);
    const ids = new Set();
    assert.equal(buttons.length, panels.length, filename);
    buttons.forEach((button, index) => {
      const triggerId = attribute(button, 'id');
      const panelId = attribute(button, 'aria-controls');
      assert.ok(triggerId && panelId, filename);
      assert.equal(attribute(button, 'aria-expanded'), 'true', filename);
      assert.equal(attribute(panels[index], 'id'), panelId, filename);
      assert.equal(attribute(panels[index], 'aria-labelledby'), triggerId, filename);
      assert.doesNotMatch(panels[index], /\bhidden\b/i, filename);
      assert.equal(ids.has(triggerId) || ids.has(panelId), false, filename);
      ids.add(triggerId);
      ids.add(panelId);
    });
  }
});

test('only documented blank accordions are removed and example exposes an objective empty state', () => {
  assert.equal(accordionTitles(read('world skill/example.html')).length, 0);
  assert.match(read('world skill/example.html'), /class=["'][^"']*state[^"']*state--empty[^"']*["'][^>]*>[\s\S]*此頁暫未有內容/i);
  assert.deepEqual(accordionTitles(read('world skill/exercise7.html')), ['code']);
  assert.deepEqual(accordionTitles(read('world skill/exercise24.html')), ['setOnScrollChangeListener']);
});

test('World Skill index keeps 42 items and maps exercise22 to its own page exactly once', () => {
  const html = read('world skill/index.html');
  assert.equal((html.match(/\bdata-world-skill-item\b/g) ?? []).length, 42);
  const exercise22 = html.match(/<article\b[^>]*data-title=["']exercise22["'][\s\S]*?<\/article>/i)?.[0] ?? '';
  assert.match(exercise22, /href=["']exercise22\.html["']/i);
  assert.doesNotMatch(exercise22, /href=["']exercise21\.html["']/i);
  assert.equal((html.match(/href=["']exercise22\.html["']/gi) ?? []).length, 1);
});

test('all local links and embedded sources on the 35 detail pages resolve to existing targets', () => {
  for (const filename of allDetailFiles) {
    const htmlWithoutCode = read(`world skill/${filename}`).replace(/<pre\b[\s\S]*?<\/pre>/gi, '');
    const values = [...htmlWithoutCode.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)].map((match) => match[1]);
    for (const value of values) {
      if (/^(?:[a-z][a-z\d+.-]*:|#|\/)/i.test(value)) continue;
      const clean = decodeURIComponent(value.split(/[?#]/, 1)[0]);
      assert.equal(existsSync(path.resolve(worldSkillRoot, clean)), true, `${filename}: ${value}`);
    }
  }
});

test('rollout markup avoids presentation styles and shared CSS avoids unsafe global layout rules', () => {
  for (const filename of rolloutFiles) {
    const htmlWithoutCode = read(`world skill/${filename}`).replace(/<pre\b[\s\S]*?<\/pre>/gi, '');
    assert.doesNotMatch(htmlWithoutCode, /\bstyle=["']/i, filename);
  }

  const css = `${read('assets/css/accordion.css')}\n${read('assets/css/detail-page.css')}`;
  assert.match(read('world skill/class1_5.html'), /class=["'][^"']*detail-note[^"']*detail-note--warning/);
  assert.match(css, /\.detail-note/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|\brgba?\s*\(|\b\d+(?:\.\d+)?px\b/i);
  assert.doesNotMatch(css, /\bfloat\s*:|\.accordion-panel[^{}]*\{[^}]*\bheight\s*:/i);
  assert.doesNotMatch(css, /(?:^|})\s*(?:span|a|div|pre|code|mark)\s*\{/im);
});
