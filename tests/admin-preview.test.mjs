import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const PROTECTED_CONTENT_FILES = [
  'content/homework.json',
  'homework/index.html',
  'training/files.json',
];
const protectedContentSnapshot = await Promise.all(
  PROTECTED_CONTENT_FILES.map((path) => readFile(new URL(`../${path}`, import.meta.url))),
);

const VALID_INPUT = Object.freeze({
  id: 'module-f',
  title: 'Module F',
  description: 'RecyclerView 練習',
  contentHtml: '<section><h2>功能說明</h2><p>Homework 內容。</p></section>',
});

async function load(path) {
  return import(`../${path}`);
}

function findError(result, field) {
  assert.equal(result.ok, false);
  const error = result.errors.find((candidate) => candidate.field === field);
  assert.ok(error, `expected ${field} error in ${JSON.stringify(result.errors)}`);
  assert.equal(typeof error.code, 'string');
  assert.equal(typeof error.message, 'string');
  return error;
}

test('Homework preview contract accepts and normalizes the complete value', async () => {
  const { validateHomeworkPreviewInput } = await load('admin/shared/homework-preview-contract.mjs');
  assert.deepEqual(validateHomeworkPreviewInput({
    ...VALID_INPUT,
    title: '  Module F  ',
    description: '  RecyclerView 練習  ',
  }), {
    ok: true,
    value: VALID_INPUT,
  });
});

test('Homework ID rejects missing, wrong-type, unsafe, and overlong values without rewriting them', async () => {
  const { validateHomeworkPreviewInput } = await load('admin/shared/homework-preview-contract.mjs');
  for (const id of [undefined, '', 4, '-module', 'module-', 'module--f', 'Module-f', 'module f',
    'module/f', 'module\\f', 'module.f', '..', 'module%2df', 'module?x=1', 'module#part', 'a'.repeat(81)]) {
    const error = findError(validateHomeworkPreviewInput({ ...VALID_INPUT, id }), 'id');
    assert.match(error.code, /required|type|format|too_long/);
  }
  for (const id of ['module-f', 'homework-34', 'android-timer', 'a', 'a'.repeat(80)]) {
    assert.equal(validateHomeworkPreviewInput({ ...VALID_INPUT, id }).ok, true, id);
  }
});

test('title trims edges and enforces type, required, and 120-character limits', async () => {
  const { validateHomeworkPreviewInput } = await load('admin/shared/homework-preview-contract.mjs');
  for (const title of [undefined, 4, '', '   ', 'a'.repeat(121)]) {
    findError(validateHomeworkPreviewInput({ ...VALID_INPUT, title }), 'title');
  }
  const accepted = validateHomeworkPreviewInput({ ...VALID_INPUT, title: `  ${'字'.repeat(120)}  ` });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.value.title, '字'.repeat(120));
});

test('description trims edges, remains plain text, and enforces its 500-character limit', async () => {
  const { validateHomeworkPreviewInput } = await load('admin/shared/homework-preview-contract.mjs');
  for (const description of [undefined, 4, '', '  ', '<strong>HTML</strong>', 'a'.repeat(501)]) {
    findError(validateHomeworkPreviewInput({ ...VALID_INPUT, description }), 'description');
  }
  const accepted = validateHomeworkPreviewInput({ ...VALID_INPUT, description: `  ${'😀'.repeat(500)}  ` });
  assert.equal(accepted.ok, true);
  assert.equal([...accepted.value.description].length, 500);
});

test('content HTML is required, preserved byte-for-byte, and limited to 400 KiB UTF-8', async () => {
  const { validateHomeworkPreviewInput, HOMEWORK_PREVIEW_LIMITS } = await load('admin/shared/homework-preview-contract.mjs');
  assert.equal(HOMEWORK_PREVIEW_LIMITS.contentHtmlBytes, 400 * 1024);
  for (const contentHtml of [undefined, 4, '', '  ']) {
    findError(validateHomeworkPreviewInput({ ...VALID_INPUT, contentHtml }), 'contentHtml');
  }
  const exact = ` <section>${'a'.repeat((400 * 1024) - 21)}</section> `;
  assert.equal(Buffer.byteLength(exact), 400 * 1024);
  const accepted = validateHomeworkPreviewInput({ ...VALID_INPUT, contentHtml: exact });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.value.contentHtml, exact);
  findError(validateHomeworkPreviewInput({ ...VALID_INPUT, contentHtml: `${exact}a` }), 'contentHtml');
});

test('contract reports all invalid fields in stable field order', async () => {
  const { validateHomeworkPreviewInput } = await load('admin/shared/homework-preview-contract.mjs');
  const result = validateHomeworkPreviewInput({ id: '', title: '', description: '', contentHtml: '' });
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors.map(({ field }) => field), ['id', 'title', 'description', 'contentHtml']);
});

function assertFragmentError(result, code) {
  assert.equal(result.ok, false);
  const error = result.errors.find((candidate) => candidate.code === code);
  assert.ok(error, `expected ${code} in ${JSON.stringify(result.errors)}`);
  assert.equal(error.field, 'contentHtml');
  assert.equal(typeof error.message, 'string');
  return error;
}

test('HTML fragment validator preserves allowed content and source order', async () => {
  const { validateHtmlFragment } = await load('admin/server/html-fragment-validator.mjs');
  const html = [
    '<section id="intro" class="detail-section">',
    '<h2>功能說明</h2><details open><summary>展開</summary><p>內容</p></details>',
    '<table><caption>結果</caption><thead><tr><th>項目</th></tr></thead>',
    '<tbody><tr><td><pre class="code-block"><code>val x = &lt;safe&gt;</code></pre></td></tr></tbody></table>',
    '<a href="../homework/" target="_self">返回</a>',
    '<button type="button" aria-label="切換" data-action="toggle">切換</button>',
    '</section>',
  ].join('');
  assert.deepEqual(validateHtmlFragment(html, { reservedIds: new Set(['main-content']) }), { ok: true, html });
});

test('HTML fragment validator rejects document wrappers and every forbidden element family', async () => {
  const { validateHtmlFragment } = await load('admin/server/html-fragment-validator.mjs');
  const cases = [
    ['<!doctype html><section>內容</section>', 'forbidden_element'],
    ['<html><head><title>x</title></head><body><p>x</p></body></html>', 'forbidden_element'],
    ['<h1>重複主標題</h1>', 'forbidden_element'],
    ['<script>alert(1)</script>', 'forbidden_element'],
    ['<style>body{display:none}</style>', 'forbidden_element'],
    ['<iframe src="/x"></iframe>', 'forbidden_element'],
    ['<form><input></form>', 'forbidden_element'],
    ['<svg><script>alert(1)</script></svg>', 'forbidden_element'],
    ['<math><mi>x</mi></math>', 'forbidden_element'],
    ['<video src="x"></video>', 'forbidden_element'],
    ['<custom-element>未知</custom-element>', 'element_not_allowed'],
  ];
  for (const [html, code] of cases) assertFragmentError(validateHtmlFragment(html), code);
});

test('HTML fragment validator rejects malformed markup and malformed or unsafe attributes', async () => {
  const { validateHtmlFragment } = await load('admin/server/html-fragment-validator.mjs');
  assertFragmentError(validateHtmlFragment('<section><p title="unterminated></p></section>'), 'malformed_html');
  assertFragmentError(validateHtmlFragment('<p title="one" title="two">x</p>'), 'malformed_html');
  for (const html of [
    '<p onclick="alert(1)">x</p>',
    '<p ONFOCUS="alert(1)">x</p>',
    '<p style="color:red">x</p>',
    '<p hidden>x</p>',
  ]) assertFragmentError(validateHtmlFragment(html), 'attribute_not_allowed');
  assert.equal(validateHtmlFragment('<p class="copy" role="note" title="提示" aria-label="說明" data-kind="demo">x</p>').ok, true);
  assert.equal(validateHtmlFragment('<p tabindex="0">x</p>').ok, true);
  assert.equal(validateHtmlFragment('<p tabindex="-1">x</p>').ok, true);
  assertFragmentError(validateHtmlFragment('<p tabindex="1">x</p>'), 'invalid_attribute_value');
});

test('HTML fragment validator rejects unsafe, duplicate, and reserved IDs', async () => {
  const { validateHtmlFragment } = await load('admin/server/html-fragment-validator.mjs');
  assertFragmentError(validateHtmlFragment('<p id="bad id">x</p>'), 'invalid_id');
  assertFragmentError(validateHtmlFragment('<p id="same">x</p><p id="same">y</p>'), 'duplicate_id');
  assertFragmentError(validateHtmlFragment('<p id="main-content">x</p>'), 'reserved_id');
  assertFragmentError(validateHtmlFragment('<p id="preview-frame">x</p>'), 'reserved_id');
  assert.equal(validateHtmlFragment('<p id="safe_id-2">x</p>').ok, true);
});

test('anchors accept local and HTTPS URLs and reject dangerous or obfuscated URLs', async () => {
  const { validateHtmlFragment } = await load('admin/server/html-fragment-validator.mjs');
  for (const href of ['guide.html', '../guide/', '/homework/module-f.html', 'https://example.com/path?q=1#part']) {
    assert.equal(validateHtmlFragment(`<a href="${href}">連結</a>`).ok, true, href);
  }
  for (const href of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)',
    '&#x6a;avascript:alert(1)', 'java&#x0A;script:alert(1)', 'data:text/html,x', 'vbscript:msgbox(1)',
    '//example.com/path', 'blob:https://example.com/id', 'http://example.com/']) {
    assertFragmentError(validateHtmlFragment(`<a href="${href}">連結</a>`), 'invalid_url');
  }
});

test('blank anchors require explicit noopener and noreferrer without silent rewriting', async () => {
  const { validateHtmlFragment } = await load('admin/server/html-fragment-validator.mjs');
  for (const html of [
    '<a href="https://example.com" target="_blank">x</a>',
    '<a href="https://example.com" target="_blank" rel="noopener">x</a>',
    '<a href="https://example.com" target="parent" rel="noopener noreferrer">x</a>',
  ]) assertFragmentError(validateHtmlFragment(html), html.includes('parent') ? 'invalid_attribute_value' : 'unsafe_blank_target');
  assert.equal(validateHtmlFragment('<a href="https://example.com" target="_blank" rel="external noreferrer noopener">x</a>').ok, true);
});

test('images require local sources, non-empty alt text, and bounded enumerated metadata', async () => {
  const { validateHtmlFragment } = await load('admin/server/html-fragment-validator.mjs');
  assert.equal(validateHtmlFragment('<img src="img/result.png" alt="結果" loading="lazy" decoding="async" width="640" height="480">').ok, true);
  for (const html of [
    '<img src="img/result.png">', '<img src="img/result.png" alt=" ">', '<img src="/img/result.png" alt="結果">',
    '<img src="https://example.com/x.png" alt="結果">', '<img src="//example.com/x.png" alt="結果">',
    '<img src="data:image/png;base64,x" alt="結果">', '<img src="blob:x" alt="結果">',
    '<img src="img/x.png" alt="結果" loading="auto">', '<img src="img/x.png" alt="結果" decoding="fast">',
    '<img src="img/x.png" alt="結果" width="0">', '<img src="img/x.png" alt="結果" height="100000">',
  ]) assertFragmentError(validateHtmlFragment(html), html.includes('src="/') || /(?:https:|data:|blob:)/.test(html) ? 'invalid_url' : 'invalid_attribute_value');
});

test('buttons must explicitly disable form submission behavior', async () => {
  const { validateHtmlFragment } = await load('admin/server/html-fragment-validator.mjs');
  assert.equal(validateHtmlFragment('<button type="button">切換</button>').ok, true);
  for (const html of ['<button>切換</button>', '<button type="submit">提交</button>', '<button type="reset">重設</button>']) {
    assertFragmentError(validateHtmlFragment(html), 'invalid_button_type');
  }
});

test('HTML errors use parser source locations when available', async () => {
  const { validateHtmlFragment } = await load('admin/server/html-fragment-validator.mjs');
  const result = validateHtmlFragment('<section>\n  <p>安全</p>\n  <script>alert(1)</script>\n</section>');
  const error = assertFragmentError(result, 'forbidden_element');
  assert.deepEqual({ line: error.line, column: error.column }, { line: 3, column: 3 });

  const missingAttribute = validateHtmlFragment('<section>\n  <img alt="結果">\n</section>');
  const missingSource = assertFragmentError(missingAttribute, 'invalid_url');
  assert.deepEqual({ line: missingSource.line, column: missingSource.column }, { line: 2, column: 3 });
});

test('Homework renderer returns a complete escaped App Shell preview document', async () => {
  const { renderHomeworkPage } = await load('admin/server/homework-page-renderer.mjs');
  const contentHtml = '<section><h2>功能</h2><p>保留 <strong>語意</strong></p></section>';
  const html = renderHomeworkPage({
    id: 'module-f&quot;',
    title: 'Module <F> & friends',
    description: 'RecyclerView <script>alert(1)</script> & 說明',
    contentHtml,
    preview: true,
    assetBase: '/private/assets/',
  });
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<html[^>]+lang="zh-Hant"/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
  assert.match(html, /<title>Module &lt;F&gt; &amp; friends｜Homework 預覽<\/title>/);
  assert.match(html, /<h1>Module &lt;F&gt; &amp; friends<\/h1>/);
  assert.match(html, /RecyclerView &lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; 說明/);
  assert.doesNotMatch(html, /<script\b/i);
  assert.ok(html.includes(contentHtml), 'validated fragment must retain its markup');
  assert.doesNotMatch(html, /&lt;section&gt;/);
  assert.match(html, /data-content-id="module-f&amp;quot;"/);
});

test('Homework renderer includes preview state, breadcrumb, returns, and both navigation containers', async () => {
  const { renderHomeworkPage } = await load('admin/server/homework-page-renderer.mjs');
  const html = renderHomeworkPage({ ...VALID_INPUT, preview: true, assetBase: './assets/' });
  assert.match(html, /class="status-badge status-badge--warning"[^>]*>尚未發佈</);
  assert.match(html, /<nav[^>]+aria-label="Breadcrumb"/);
  assert.match(html, /href="\/homework\/">Homework<\/a>/);
  assert.match(html, /返回 Homework/);
  assert.match(html, /class="desktop-navigation"[^>]+data-site-navigation="desktop"/);
  assert.match(html, /class="mobile-navigation"[^>]+data-site-navigation="mobile"/);
  assert.match(html, /id="main-content"[^>]+tabindex="-1"/);
  assert.doesNotMatch(html, /site-navigation\.js|accordion\.js/);
});

test('Homework renderer builds formal stylesheet and navigation URLs from their explicit bases', async () => {
  const { renderHomeworkPage } = await load('admin/server/homework-page-renderer.mjs');
  const html = renderHomeworkPage({ ...VALID_INPUT, preview: false,
    assetBase: 'https://preview.invalid/private/assets', scriptBase: '../assets/js' });
  for (const name of ['foundation', 'app-shell', 'accordion', 'detail-page']) {
    assert.match(html, new RegExp(`href="https://preview\\.invalid/private/assets/${name}\\.css"`));
  }
  assert.doesNotMatch(html, /尚未發佈/);
  assert.match(html, /<script src="\.\.\/assets\/js\/site-navigation\.js"><\/script>/);
  assert.doesNotMatch(html, /accordion\.js|javascript:/i);
  assert.doesNotMatch(html, /Content-Security-Policy/);
});

test('Homework renderer emits a restrictive script-free preview CSP', async () => {
  const { renderHomeworkPage } = await load('admin/server/homework-page-renderer.mjs');
  const html = renderHomeworkPage({
    ...VALID_INPUT,
    preview: true,
    assetBase: 'https://preview.invalid/private/assets/',
  });
  const policy = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)?.[1];
  assert.ok(policy);
  assert.match(policy, /default-src 'none'/);
  assert.match(policy, /style-src 'self'/);
  assert.match(policy, /img-src 'self'/);
  assert.match(policy, /img-src 'self' data:/);
  assert.match(policy, /script-src 'none'/);
  assert.match(policy, /form-action 'none'/);
  assert.match(policy, /object-src 'none'/);
  assert.doesNotMatch(policy, /frame-ancestors/);
  assert.doesNotMatch(policy, /unsafe-inline|unsafe-eval|\*/);
});

test('Homework renderer CSP stays valid for the supported IPv6 loopback asset URL', async () => {
  const { renderHomeworkPage } = await load('admin/server/homework-page-renderer.mjs');
  const html = renderHomeworkPage({
    ...VALID_INPUT,
    preview: true,
    assetBase: 'http://[::1]:8080/private/assets/',
  });
  const policy = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)?.[1];
  assert.match(policy, /style-src 'self'/);
  assert.match(policy, /img-src 'self'/);
  assert.doesNotMatch(policy, /\[::1\]/);
  assert.match(html, /href="http:\/\/\[::1\]:8080\/private\/assets\/foundation\.css"/);
});

const HTTP_PATH = '/homework-editor-private';
const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));
const TEST_SECRET = Buffer.alloc(32, 19).toString('base64url');

async function previewHarness(t, { now: suppliedNow } = {}) {
  const { createAdminServer } = await load('admin/server/server.mjs');
  let currentTime = 1_000;
  const now = suppliedNow ?? (() => currentTime);
  const config = {
    host: '127.0.0.1',
    port: 0,
    adminPath: HTTP_PATH,
    passwordHash: 'malformed-test-hash',
    sessionSecret: TEST_SECRET,
    cookieSecure: false,
    nodeEnv: 'development',
    sessionTtlMs: 10_000,
    bodyLimitBytes: 4_096,
  };
  const app = createAdminServer({ config, rootDirectory: PROJECT_ROOT, now });
  t.after(() => app.close());
  await new Promise((resolve, reject) => {
    app.server.once('error', reject);
    app.server.listen(0, config.host, resolve);
  });
  const origin = `http://127.0.0.1:${app.server.address().port}`;
  async function send(path, init = {}) {
    const response = await fetch(`${origin}${HTTP_PATH}${path}`, init);
    const text = await response.text();
    return { status: response.status, headers: response.headers, text, json: () => JSON.parse(text) };
  }
  function issueSession() {
    const session = app.sessions.create();
    return { ...session, cookie: `admin_session=${session.token}` };
  }
  function preview(body, session, headers = {}) {
    return send('/api/preview', {
      method: 'POST',
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        ...(session ? { Cookie: session.cookie, 'X-CSRF-Token': session.csrfToken } : {}),
        ...headers,
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  }
  return { ...app, config, origin, send, preview, issueSession, advance(ms) { currentTime += ms; } };
}

function assertApiError(result, status, code) {
  assert.equal(result.status, status, result.text);
  const body = result.json();
  assert.equal(body.error.code, code);
  assert.equal(typeof body.error.message, 'string');
  return body.error;
}

function streamPreviewRequest(app, session, chunks) {
  return new Promise((resolve, reject) => {
    const request = httpRequest(app.origin, {
      path: `${HTTP_PATH}/api/preview`,
      method: 'POST',
      headers: {
        Origin: app.origin,
        'Content-Type': 'application/json',
        Cookie: session.cookie,
        'X-CSRF-Token': session.csrfToken,
        'Transfer-Encoding': 'chunked',
      },
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve({
        status: response.statusCode,
        headers: new Headers(response.headers),
        text: body,
        json: () => JSON.parse(body),
      }));
    });
    request.once('error', reject);
    for (const chunk of chunks) request.write(chunk);
    request.end();
  });
}

test('Preview API rejects wrong methods before request validation and advertises POST', async (t) => {
  const app = await previewHarness(t);
  for (const method of ['GET', 'PUT', 'DELETE']) {
    const result = await app.send('/api/preview', { method });
    assertApiError(result, 405, 'method_not_allowed');
    assert.equal(result.headers.get('allow'), 'POST');
  }
});

test('Preview API validates Origin then JSON media type', async (t) => {
  const app = await previewHarness(t);
  const session = app.issueSession();
  for (const origin of [undefined, 'http://attacker.invalid', `${app.origin}/`]) {
    const headers = { 'Content-Type': 'application/json', Cookie: session.cookie, 'X-CSRF-Token': session.csrfToken };
    if (origin) headers.Origin = origin;
    assertApiError(await app.send('/api/preview', { method: 'POST', headers, body: '{}' }), 403, 'invalid_origin');
  }
  for (const type of [undefined, 'text/plain', 'application/jsonish']) {
    const headers = { Origin: app.origin, Cookie: session.cookie, 'X-CSRF-Token': session.csrfToken };
    if (type) headers['Content-Type'] = type;
    assertApiError(await app.send('/api/preview', { method: 'POST', headers, body: '{}' }), 415, 'unsupported_media_type');
  }
  const acceptedType = await app.preview(VALID_INPUT, session, { 'Content-Type': 'application/json; charset=utf-8' });
  assert.equal(acceptedType.status, 200);
});

test('Preview API requires a live Session before reading a large request body', async (t) => {
  const app = await previewHarness(t);
  const unauthenticated = await app.preview('x'.repeat((512 * 1024) + 1), null);
  assertApiError(unauthenticated, 401, 'not_authenticated');
  const expired = app.issueSession();
  app.advance(10_001);
  const result = await app.preview(VALID_INPUT, expired);
  assertApiError(result, 401, 'not_authenticated');
  assert.match(result.headers.get('set-cookie'), /Max-Age=0/);
});

test('Preview API requires the exact Session CSRF token before reading JSON', async (t) => {
  const app = await previewHarness(t);
  const session = app.issueSession();
  for (const csrf of [undefined, '', 'wrong', `${session.csrfToken}x`]) {
    const headers = { Origin: app.origin, 'Content-Type': 'application/json', Cookie: session.cookie };
    if (csrf !== undefined) headers['X-CSRF-Token'] = csrf;
    const result = await app.send('/api/preview', { method: 'POST', headers, body: '{not json' });
    assertApiError(result, 403, 'invalid_csrf');
  }
});

test('Preview API keeps Login at 4 KiB and applies an independent 512 KiB request limit', async (t) => {
  const app = await previewHarness(t);
  const session = app.issueSession();
  const loginBody = JSON.stringify({ password: 'x'.repeat(4_100) });
  assertApiError(await app.send('/api/login', { method: 'POST', headers: {
    Origin: app.origin, 'Content-Type': 'application/json',
  }, body: loginBody }), 413, 'payload_too_large');
  const largeButBounded = JSON.stringify({ ...VALID_INPUT, contentHtml: 'x'.repeat(500 * 1024) });
  assert.ok(Buffer.byteLength(largeButBounded) < 512 * 1024);
  assertApiError(await app.preview(largeButBounded, session), 422, 'validation_failed');
  const oversized = JSON.stringify({ ...VALID_INPUT, contentHtml: 'x'.repeat(512 * 1024) });
  assert.ok(Buffer.byteLength(oversized) > 512 * 1024);
  assertApiError(await app.preview(oversized, session), 413, 'payload_too_large');
  const streamed = await streamPreviewRequest(app, session, [
    'x'.repeat(256 * 1024),
    'y'.repeat((256 * 1024) + 1),
  ]);
  assertApiError(streamed, 413, 'payload_too_large');
});

test('Preview API separates malformed JSON from field and HTML validation errors', async (t) => {
  const app = await previewHarness(t);
  const session = app.issueSession();
  assertApiError(await app.preview('{', session), 400, 'invalid_request');
  const fields = assertApiError(await app.preview({ ...VALID_INPUT, id: 'Bad ID' }, session), 422, 'validation_failed').fields;
  assert.equal(fields[0].field, 'id');
  assert.equal(typeof fields[0].code, 'string');
  assert.equal(typeof fields[0].message, 'string');
  const htmlFields = assertApiError(await app.preview({ ...VALID_INPUT,
    contentHtml: '<section>\n<script>alert(1)</script>\n</section>' }, session), 422, 'validation_failed').fields;
  assert.deepEqual({ field: htmlFields[0].field, code: htmlFields[0].code,
    line: htmlFields[0].line, column: htmlFields[0].column },
  { field: 'contentHtml', code: 'forbidden_element', line: 2, column: 1 });
});

test('Preview API returns rendered HTML without extending the Session lifetime', async (t) => {
  const app = await previewHarness(t);
  const session = app.issueSession();
  const expiresAt = app.sessions.get(session.token).expiresAt;
  app.advance(5_000);
  const result = await app.preview(VALID_INPUT, session);
  assert.equal(result.status, 200, result.text);
  const body = result.json();
  assert.equal(Object.keys(body).length, 1);
  assert.match(body.previewHtml, /^<!doctype html>/i);
  assert.match(body.previewHtml, /尚未發佈/);
  assert.match(body.previewHtml, /Module F/);
  assert.ok(body.previewHtml.includes(VALID_INPUT.contentHtml));
  assert.equal(app.sessions.get(session.token).expiresAt, expiresAt);
  assert.equal(result.headers.get('cache-control'), 'no-store');
});

test('Admin server exposes exactly the eight approved preview stylesheets', async (t) => {
  const app = await previewHarness(t);
  for (const name of ['foundation', 'tokens', 'base', 'utilities', 'components', 'app-shell', 'accordion', 'detail-page']) {
    const result = await app.send(`/assets/${name}.css`);
    assert.equal(result.status, 200, name);
    assert.match(result.headers.get('content-type'), /text\/css/);
  }
  for (const path of ['/assets/homework.css', '/assets/../content/homework.json', '/server/config.mjs', '/.env', '/scripts/validate-content.mjs']) {
    assert.equal((await app.send(path)).status, 404, path);
  }
});

test('authenticated page preserves the accessible preview form while adding Batch 10C publishing', async (t) => {
  const app = await previewHarness(t);
  const session = app.issueSession();
  const page = await app.send('/', { headers: { Cookie: session.cookie } });
  assert.equal(page.status, 200);
  assert.match(page.text, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
  assert.match(page.text, /<h1[^>]+id="admin-title"[^>]*>新增 Homework<\/h1>/);
  assert.match(page.text, /填寫內容、確認圖片預覽，再完成一次性的正式發佈。/);
  const fields = [
    ['homework-id', 'Homework ID'], ['homework-title', '顯示名稱'],
    ['homework-description', '簡介'], ['homework-content-html', '主要內容 HTML'],
  ];
  for (const [id, label] of fields) {
    assert.match(page.text, new RegExp(`<label[^>]+for="${id}"[^>]*>\\s*${label}\\s*<`));
    assert.match(page.text, new RegExp(`<(?:input|textarea)[^>]+id="${id}"[^>]+required`));
  }
  assert.match(page.text, /id="homework-id"[^>]+maxlength="80"[^>]+pattern="\[a-z0-9\]/);
  assert.match(page.text, /id="homework-title"[^>]+maxlength="120"/);
  assert.match(page.text, /id="homework-description"[^>]+maxlength="500"/);
  assert.match(page.text, /id="description-count"[^>]*>0 \/ 500</);
  assert.match(page.text, /未來網址：<span id="future-url-value">\/homework\/&lt;id&gt;\.html<\/span>/);
  assert.match(page.text, /程式碼內的 &lt;、&gt;、&amp; 請使用 &amp;lt;、&amp;gt;、&amp;amp;。/);
  assert.match(page.text, /<button[^>]+id="preview-button"[^>]+type="submit"[^>]*>\s*更新預覽\s*<\/button>/);
  assert.match(page.text, /id="publish-button"[^>]*>正式發佈<\/button>/);
  assert.match(page.text, /id="homework-cover-image"[^>]+type="file"/);
  assert.doesNotMatch(page.text, /儲存草稿|Training ZIP|contenteditable/i);
});

test('preview iframe has no capabilities and starts with a clear empty state', async (t) => {
  const app = await previewHarness(t);
  const session = app.issueSession();
  const page = await app.send('/', { headers: { Cookie: session.cookie } });
  const iframe = page.text.match(/<iframe\b[^>]+id="preview-frame"[^>]*><\/iframe>/i)?.[0];
  assert.ok(iframe);
  assert.match(iframe, /title="Homework 預覽"/);
  assert.match(iframe, /\ssandbox(?:\s|>|="")/);
  assert.doesNotMatch(iframe, /allow-/i);
  assert.match(page.text, /id="preview-empty"[^>]*>[\s\S]*填寫左側內容後按「預覽」/);
  assert.match(page.text, /預覽標籤[\s\S]*尚未發佈/);
});

test('admin assets avoid persistence, service workers, unsafe DOM insertion, and absolute preview APIs', async (t) => {
  const app = await previewHarness(t);
  const [script, style] = await Promise.all([app.send('/admin.js'), app.send('/admin.css')]);
  assert.equal(script.status, 200);
  assert.equal(style.status, 200);
  assert.match(script.text, /fetch\(\s*['"]api\/preview['"]/);
  assert.doesNotMatch(script.text, /(?:local|session)Storage|indexedDB|serviceWorker|\.innerHTML\s*=|https?:\/\/|\/homework-editor-private/i);
  assert.match(style.text, /grid-template-columns:\s*minmax\(0,\s*44fr\)\s+minmax\(0,\s*56fr\)/);
  assert.match(style.text, /@media\s*\(max-width:\s*48rem\)/);
  assert.match(style.text, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.doesNotMatch(style.text, /#[0-9a-f]{3,8}\b/i);
  for (const [, property, value] of style.text.matchAll(/\b(box-shadow|border-radius|font-family):\s*([^;]+)/gi)) {
    assert.match(value.trim(), /^var\(/, property);
  }
});

test('management CSP permits Blob frames and validated data images for preview', async (t) => {
  const app = await previewHarness(t);
  const result = await app.send('/api/session');
  const policy = result.headers.get('content-security-policy');
  assert.equal(policy, "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-src blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  assert.doesNotMatch(policy, /unsafe-inline|unsafe-eval|script:\s|(?:^|;)\s*\*(?:\s|;|$)/);
});

test('browser can load only the fixed shared preview contract module', async (t) => {
  const app = await previewHarness(t);
  const contract = await app.send('/shared/homework-preview-contract.mjs');
  assert.equal(contract.status, 200);
  assert.match(contract.headers.get('content-type'), /javascript/);
  assert.match(contract.text, /export function validateHomeworkPreviewInput/);
  assert.equal((await app.send('/shared/other.mjs')).status, 404);
  assert.equal((await app.send('/shared/../server/config.mjs')).status, 404);
});

function makeClientElement(initial = {}) {
  const listeners = new Map();
  return {
    hidden: false,
    disabled: false,
    textContent: '',
    value: '',
    src: '',
    attributes: new Map(),
    focused: false,
    childNodes: [],
    files: [],
    ...initial,
    addEventListener(type, listener) { listeners.set(type, listener); },
    setAttribute(name, value) { this.attributes.set(name, String(value)); },
    removeAttribute(name) { this.attributes.delete(name); },
    getAttribute(name) { return this.attributes.get(name) ?? null; },
    replaceChildren(...children) { this.childNodes = [...children]; },
    append(...children) { this.childNodes.push(...children); },
    showModal() { this.open = true; },
    close() { this.open = false; },
    focus() { this.focused = true; },
    async dispatch(type, extra = {}) {
      const listener = listeners.get(type);
      if (listener) await listener({ preventDefault() {}, target: this, ...extra });
    },
  };
}

async function loadPreviewClient({ previewResponses = [] } = {}) {
  const rawSource = await readFile(new URL('../admin/admin.js', import.meta.url), 'utf8');
  const source = rawSource.replace(/^import[^;]+;\s*/m, '');
  const {
    HOMEWORK_ID_PATTERN,
    HOMEWORK_PUBLISH_LIMITS,
    contentImagePath,
    isSafeContentImageFilename,
    validateHomeworkPublishInput,
  } = await load('admin/shared/homework-preview-contract.mjs');
  const selectors = new Map();
  const register = (selector, initial) => {
    const element = makeClientElement(initial);
    selectors.set(selector, element);
    return element;
  };
  const form = register('#homework-form');
  const id = register('#homework-id', { value: VALID_INPUT.id });
  const title = register('#homework-title', { value: VALID_INPUT.title });
  const description = register('#homework-description', { value: VALID_INPUT.description });
  const contentHtml = register('#homework-content-html', { value: VALID_INPUT.contentHtml });
  const coverAlt = register('#homework-cover-alt', { value: 'Module F 成果畫面' });
  const coverImage = register('#homework-cover-image', { files: [
    { name: 'cover.png', size: 68, type: 'image/png', lastModified: 1 },
  ] });
  const contentImages = register('#homework-content-images', { files: [] });
  const previewButton = register('#preview-button', { disabled: true });
  register('#publish-button', { disabled: true });
  register('#publish-confirm-button');
  register('#publish-dialog');
  const frame = register('#preview-frame', { hidden: true });
  const empty = register('#preview-empty');
  const loading = register('#preview-loading', { hidden: true });
  const previewError = register('#preview-error', { hidden: true });
  const expired = register('#session-expired', { hidden: true });
  const expiredMessage = register('#session-expired-message', { textContent: '登入已失效，請重新登入' });
  const logoutButton = register('#logout-button', { disabled: false });
  register('#logout-error', { hidden: true });
  register('#future-url-value');
  register('#description-count');
  register('#form-error-summary', { hidden: true });
  register('#publish-readiness');
  register('#publish-error', { hidden: true });
  register('#publish-success', { hidden: true });
  register('#published-result-link');
  register('#published-index-link');
  register('#content-image-list');
  register('#cover-preview-image', { hidden: true });
  register('#cover-preview-empty');
  register('#cover-preview-title');
  register('#cover-preview-description');
  register('#cover-preview-url');
  for (const field of ['id', 'title', 'description', 'coverImage', 'coverAlt', 'contentImages', 'contentHtml']) {
    register(`#${field}-error`, { hidden: true });
  }
  const fetchCalls = [];
  let responseIndex = 0;
  const fetch = async (url, init) => {
    fetchCalls.push({ url, init });
    if (url === 'api/session') return { ok: true, status: 200,
      json: async () => ({ authenticated: true, csrfToken: 'csrf-test-token' }) };
    if (url === 'api/preview') return previewResponses[responseIndex++] ?? {
      ok: true, status: 200, json: async () => ({ previewHtml: '<!doctype html><title>Preview</title>' }),
    };
    if (url === 'api/logout') return { ok: true, status: 200, json: async () => ({ authenticated: false }) };
    throw new Error(`unexpected fetch ${url}`);
  };
  const created = [];
  const revoked = [];
  const Blob = class TestBlob { constructor(parts, options) { this.parts = parts; this.options = options; } };
  const TestURL = {
    createObjectURL(blob) { created.push(blob); return `blob:test-${created.length}`; },
    revokeObjectURL(url) { revoked.push(url); },
  };
  const windowListeners = new Map();
  const redirects = [];
  const window = {
    location: { assign(path) { redirects.push(path); } },
    addEventListener(type, listener) { windowListeners.set(type, listener); },
  };
  const document = {
    querySelector(selector) { return selectors.get(selector) ?? null; },
    createElement() { return makeClientElement(); },
  };
  const DOMParser = class {
    parseFromString(markup) {
      return { querySelectorAll() { return []; }, documentElement: { outerHTML: markup } };
    }
  };
  const FileReader = class {
    addEventListener() {}
    readAsDataURL() {}
  };
  const FormData = class { append() {} };
  const navigator = { clipboard: { async writeText() {} } };
  runInNewContext(source, { document, window, fetch, Blob, URL: TestURL,
    HOMEWORK_ID_PATTERN, HOMEWORK_PUBLISH_LIMITS, contentImagePath, isSafeContentImageFilename,
    validateHomeworkPublishInput, DOMParser, FileReader, FormData, navigator, TextEncoder, console });
  await new Promise((resolve) => setImmediate(resolve));
  return { selectors, form, id, title, description, coverAlt, coverImage, contentImages, contentHtml, previewButton, frame, empty,
    loading, previewError, expired, expiredMessage, logoutButton, fetchCalls, created, revoked, windowListeners, redirects };
}

test('admin client posts the normalized value and replaces then releases Blob previews', async () => {
  const client = await loadPreviewClient({ previewResponses: [
    { ok: true, status: 200, json: async () => ({ previewHtml: '<!doctype html><title>One</title>' }) },
    { ok: true, status: 200, json: async () => ({ previewHtml: '<!doctype html><title>Two</title>' }) },
  ] });
  assert.equal(client.previewButton.disabled, false);
  await client.form.dispatch('submit');
  assert.equal(client.frame.src, 'blob:test-1');
  assert.equal(client.frame.hidden, false);
  assert.equal(client.empty.hidden, true);
  assert.match(client.created[0].parts[0], /<!doctype html>[\s\S]*<title>One<\/title>/);
  assert.match(client.created[0].options.type, /text\/html/);
  const firstPreviewCall = client.fetchCalls.find(({ url }) => url === 'api/preview');
  assert.deepEqual(JSON.parse(firstPreviewCall.init.body), VALID_INPUT);
  assert.equal(firstPreviewCall.init.headers['X-CSRF-Token'], 'csrf-test-token');
  await client.form.dispatch('submit');
  assert.equal(client.frame.src, 'blob:test-2');
  assert.deepEqual(client.revoked, ['blob:test-1']);
  client.windowListeners.get('pagehide')();
  assert.deepEqual(client.revoked, ['blob:test-1', 'blob:test-2']);
});

test('admin client retains all entered values when Preview reports an expired Session', async () => {
  const client = await loadPreviewClient({ previewResponses: [
    { ok: false, status: 401, json: async () => ({ error: { code: 'not_authenticated', message: 'expired' } }) },
  ] });
  const original = [client.id.value, client.title.value, client.description.value, client.contentHtml.value];
  await client.form.dispatch('submit');
  assert.deepEqual([client.id.value, client.title.value, client.description.value, client.contentHtml.value], original);
  assert.equal(client.expired.hidden, false);
  assert.match(client.expiredMessage.textContent, /登入已失效，請重新登入/);
  assert.equal(client.previewButton.disabled, true);
  assert.equal(client.frame.hidden, true);
  assert.deepEqual(client.redirects, []);
});

test('admin client displays every server error reported for the same field', async () => {
  const client = await loadPreviewClient({ previewResponses: [
    {
      ok: false,
      status: 422,
      json: async () => ({
        error: {
          code: 'validation_failed',
          fields: [
            { field: 'contentHtml', code: 'forbidden_element', message: '不可包含 script。', line: 2, column: 3 },
            { field: 'contentHtml', code: 'invalid_url', message: '連結網址不安全。', line: 4, column: 5 },
          ],
        },
      }),
    },
  ] });
  await client.form.dispatch('submit');
  const output = client.selectors.get('#contentHtml-error');
  assert.match(output.textContent, /不可包含 script。.*第 2 行，第 3 欄/s);
  assert.match(output.textContent, /連結網址不安全。.*第 4 行，第 5 欄/s);
  assert.equal(client.contentHtml.focused, true);
});

test('admin-preview tests leave protected public content byte-identical', async () => {
  const currentContent = await Promise.all(
    PROTECTED_CONTENT_FILES.map((path) => readFile(new URL(`../${path}`, import.meta.url))),
  );
  assert.deepEqual(currentContent, protectedContentSnapshot);
});
