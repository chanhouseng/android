import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { renderHomeworkPage } from '../admin/server/homework-page-renderer.mjs';
import { buildContentIndexes } from '../scripts/build-content-indexes.mjs';
import { validateContent } from '../scripts/validate-content.mjs';
import { writeTextAtomic } from '../scripts/content-core.mjs';

async function imageFixture(t) {
  const rootDirectory = await mkdtemp(path.join(os.tmpdir(), 'admin-homework-content-images-'));
  t.after(() => rm(rootDirectory, { recursive: true, force: true }));
  const imageDirectory = path.join(rootDirectory, 'homework', 'img', 'module-f');
  await mkdir(imageDirectory, { recursive: true });
  const bytes = Buffer.from('existing-png-bytes');
  await writeFile(path.join(imageDirectory, 'screen-1.png'), bytes);
  return { rootDirectory, imageDirectory, bytes };
}

const EDITABLE_ITEM = Object.freeze({
  id: 'module-f',
  title: 'Module F',
  description: '原簡介',
  image: 'img/module-f/cover.png',
  imageAlt: 'Module F 封面',
  additionalImages: ['img/module-f/screen-1.png'],
  additionalImageAlts: ['Module F 內容畫面'],
  resultPage: 'module-f.html',
  trainingFolder: 'Module F',
  status: 'published',
  order: 7,
});
const ORIGINAL_CONTENT = '<section><h2>原內容</h2><img src="img/module-f/screen-1.png" alt="畫面"></section>';
const UPDATED_CONTENT = '<section><h2>新內容</h2><p>安全更新。</p><img src="img/module-f/screen-1.png" alt="畫面"></section>';

async function snapshotProjectProtectedContent() {
  const projectRoot = new URL('../', import.meta.url);
  const files = ['content/homework.json', 'homework/index.html'];
  async function collectImages(directoryUrl, relativeDirectory) {
    const entries = await readdir(directoryUrl, { withFileTypes: true });
    for (const entry of entries) {
      const relativePath = `${relativeDirectory}/${entry.name}`;
      const childUrl = new URL(`${relativePath.replaceAll('\\', '/')}${entry.isDirectory() ? '/' : ''}`, projectRoot);
      if (entry.isDirectory()) await collectImages(childUrl, relativePath);
      else if (entry.isFile()) files.push(relativePath);
    }
  }
  await collectImages(new URL('homework/img/', projectRoot), 'homework/img');
  files.sort();
  return new Map(await Promise.all(files.map(async (file) => [file, await readFile(new URL(file, projectRoot))])));
}

const projectProtectedSnapshot = await snapshotProjectProtectedContent();

function renderedPage(item = EDITABLE_ITEM, contentHtml = ORIGINAL_CONTENT) {
  return renderHomeworkPage({
    id: item.id,
    title: item.title,
    description: item.description,
    contentHtml,
    preview: false,
    assetBase: '../assets/css/',
    scriptBase: '../assets/js/',
  });
}

const HOMEWORK_INDEX_SHELL = `<!doctype html>
<html><body>
<p><!-- GENERATED HOMEWORK COUNT START -->
顯示全部 0 個作業
<!-- GENERATED HOMEWORK COUNT END --></p>
<main><!-- GENERATED HOMEWORK ITEMS START -->
<!-- GENERATED HOMEWORK ITEMS END --></main>
</body></html>
`;
const WORLD_SKILL_INDEX_SHELL = `<!doctype html>
<html><body><main><!-- GENERATED WORLD SKILLS START -->
<!-- GENERATED WORLD SKILLS END --></main></body></html>
`;

async function contentTransactionRoot(t) {
  const rootDirectory = await mkdtemp(path.join(os.tmpdir(), 'admin-homework-content-transaction-'));
  t.after(() => rm(rootDirectory, { recursive: true, force: true }));
  await Promise.all([
    mkdir(path.join(rootDirectory, 'content'), { recursive: true }),
    mkdir(path.join(rootDirectory, 'homework', 'img', 'module-f'), { recursive: true }),
    mkdir(path.join(rootDirectory, 'world skill'), { recursive: true }),
    mkdir(path.join(rootDirectory, 'training'), { recursive: true }),
    mkdir(path.join(rootDirectory, 'train', 'Module F'), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(path.join(rootDirectory, 'content', 'homework.json'), `${JSON.stringify([EDITABLE_ITEM], null, 2)}\n`),
    writeFile(path.join(rootDirectory, 'content', 'world-skills.json'), '[]\n'),
    writeFile(path.join(rootDirectory, 'homework', 'index.html'), HOMEWORK_INDEX_SHELL),
    writeFile(path.join(rootDirectory, 'world skill', 'index.html'), WORLD_SKILL_INDEX_SHELL),
    writeFile(path.join(rootDirectory, 'homework', 'module-f.html'), renderedPage()),
    writeFile(path.join(rootDirectory, 'homework', 'img', 'module-f', 'cover.png'), Buffer.from('cover-image-bytes')),
    writeFile(path.join(rootDirectory, 'homework', 'img', 'module-f', 'screen-1.png'), Buffer.from('screen-image-bytes')),
    writeFile(path.join(rootDirectory, 'training', 'files.json'), `${JSON.stringify([{
      name: 'Module F', path: 'Module F', parentPath: '', type: 'folder', extension: '',
    }], null, 2)}\n`),
  ]);
  await buildContentIndexes({ rootDirectory });
  return rootDirectory;
}

async function contentSnapshots(rootDirectory) {
  const [manifest, index, page, cover, screen] = await Promise.all([
    readFile(path.join(rootDirectory, 'content', 'homework.json')),
    readFile(path.join(rootDirectory, 'homework', 'index.html')),
    readFile(path.join(rootDirectory, 'homework', 'module-f.html')),
    readFile(path.join(rootDirectory, 'homework', 'img', 'module-f', 'cover.png')),
    readFile(path.join(rootDirectory, 'homework', 'img', 'module-f', 'screen-1.png')),
  ]);
  return { manifest, index, page, cover, screen };
}

test('content request contracts accept only their exact JSON shapes', async () => {
  const {
    isHomeworkContentPreviewRequest,
    isHomeworkContentUpdateRequest,
  } = await import('../admin/shared/homework-preview-contract.mjs');

  assert.equal(isHomeworkContentPreviewRequest({ contentHtml: '<p>內容</p>' }), true);
  assert.equal(isHomeworkContentPreviewRequest({ contentHtml: '<p>內容</p>', id: 'module-f' }), false);
  assert.equal(isHomeworkContentPreviewRequest([]), false);
  assert.equal(isHomeworkContentUpdateRequest({
    contentHtml: '<p>內容</p>',
    revision: 'a'.repeat(64),
  }), true);
  assert.equal(isHomeworkContentUpdateRequest({ contentHtml: '<p>內容</p>' }), false);
  assert.equal(isHomeworkContentUpdateRequest({
    contentHtml: '<p>內容</p>',
    revision: 'A'.repeat(64),
  }), false);
});

test('content revisions are deterministic and bind the Homework ID to exact UTF-8 HTML', async () => {
  const { homeworkContentRevision } = await import('../admin/server/homework-content-editor.mjs');

  assert.equal(
    homeworkContentRevision({ id: 'module-f', contentHtml: '<p>內容</p>' }),
    'b99fae8e55eac9718a9fad6e852ad3e4eff5f2c8dd3fb098a05e91c5ecd54829',
  );
  assert.notEqual(
    homeworkContentRevision({ id: 'module-g', contentHtml: '<p>內容</p>' }),
    'b99fae8e55eac9718a9fad6e852ad3e4eff5f2c8dd3fb098a05e91c5ecd54829',
  );
  assert.notEqual(
    homeworkContentRevision({ id: 'module-f', contentHtml: '<p>內容</p>\n' }),
    'b99fae8e55eac9718a9fad6e852ad3e4eff5f2c8dd3fb098a05e91c5ecd54829',
  );
});

test('existing image validation accepts only files owned by the current Homework', async (t) => {
  const { rootDirectory } = await imageFixture(t);
  const { validateExistingHomeworkImageReferences } = await import('../admin/server/homework-content-images.mjs');

  const valid = await validateExistingHomeworkImageReferences({
    rootDirectory,
    id: 'module-f',
    contentHtml: '<figure><img src="img/module-f/screen-1.png" alt="畫面"></figure>',
  });
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.images.map(({ filename, source }) => ({ filename, source })), [{
    filename: 'screen-1.png',
    source: 'img/module-f/screen-1.png',
  }]);

  for (const source of [
    'img/module-x/screen-1.png',
    'img/module-f/missing.png',
    '../module-f/screen-1.png',
    '/homework/img/module-f/screen-1.png',
    'https://example.test/screen-1.png',
  ]) {
    const result = await validateExistingHomeworkImageReferences({
      rootDirectory,
      id: 'module-f',
      contentHtml: `<img src="${source}" alt="畫面">`,
    });
    assert.equal(result.ok, false, source);
    assert.deepEqual(result.errors.map(({ field, code }) => [field, code]), [
      ['contentHtml', 'invalid_existing_image'],
    ]);
    assert.doesNotMatch(JSON.stringify(result), /admin-homework-content-images-|[A-Z]:\\/i);
  }
});

test('existing image validation rejects directories and symlinks', async (t) => {
  const { rootDirectory, imageDirectory } = await imageFixture(t);
  const { validateExistingHomeworkImageReferences } = await import('../admin/server/homework-content-images.mjs');
  await mkdir(path.join(imageDirectory, 'folder.png'));

  const directoryResult = await validateExistingHomeworkImageReferences({
    rootDirectory,
    id: 'module-f',
    contentHtml: '<img src="img/module-f/folder.png" alt="畫面">',
  });
  assert.equal(directoryResult.ok, false);

  try {
    await symlink(path.join(imageDirectory, 'screen-1.png'), path.join(imageDirectory, 'linked.png'));
  } catch (error) {
    if (error?.code === 'EPERM') return t.skip('This Windows account cannot create symlinks.');
    throw error;
  }
  const symlinkResult = await validateExistingHomeworkImageReferences({
    rootDirectory,
    id: 'module-f',
    contentHtml: '<img src="img/module-f/linked.png" alt="畫面">',
  });
  assert.equal(symlinkResult.ok, false);
});

test('existing image validation rejects an ancestor image-directory symlink', async (t) => {
  const rootDirectory = await mkdtemp(path.join(os.tmpdir(), 'admin-homework-image-ancestor-'));
  t.after(() => rm(rootDirectory, { recursive: true, force: true }));
  const relocatedDirectory = path.join(rootDirectory, 'relocated', 'module-f');
  await mkdir(path.join(rootDirectory, 'homework'), { recursive: true });
  await mkdir(relocatedDirectory, { recursive: true });
  await writeFile(path.join(relocatedDirectory, 'screen-1.png'), Buffer.from('existing-image'));
  try {
    await symlink(path.join(rootDirectory, 'relocated'), path.join(rootDirectory, 'homework', 'img'), 'dir');
  } catch (error) {
    if (error?.code === 'EPERM') return t.skip('This Windows account cannot create symlinks.');
    throw error;
  }
  const { validateExistingHomeworkImageReferences } = await import('../admin/server/homework-content-images.mjs');
  const result = await validateExistingHomeworkImageReferences({
    rootDirectory,
    id: 'module-f',
    contentHtml: '<img src="img/module-f/screen-1.png" alt="畫面">',
  });
  assert.equal(result.ok, false);
});

test('content preview rejects an existing image replaced with an oversized file', async (t) => {
  const rootDirectory = await contentTransactionRoot(t);
  await writeFile(
    path.join(rootDirectory, 'homework', 'img', 'module-f', 'screen-1.png'),
    Buffer.alloc(5 * 1024 * 1024 + 1),
  );
  const { previewHomeworkContent } = await import('../admin/server/homework-content-editor.mjs');
  await assert.rejects(
    previewHomeworkContent({
      rootDirectory,
      id: 'module-f',
      contentHtml: UPDATED_CONTENT,
      assetBase: 'http://127.0.0.1:3000/private/assets/',
    }),
    (error) => error.status === 422 && error.code === 'validation_failed'
      && error.fields.some(({ code }) => code === 'invalid_existing_image'),
  );
});

test('preview rewriting changes only existing image source values and not stored HTML', async () => {
  const { rewriteContentImageSources } = await import('../admin/server/homework-content-images.mjs');
  const original = '<figure class="shot"><img alt="畫面" src="img/module-f/screen-1.png"><figcaption>保留</figcaption></figure>';
  const rewritten = rewriteContentImageSources({
    id: 'module-f',
    contentHtml: original,
    imageBaseUrl: 'http://127.0.0.1:3000/private/api/homeworks/module-f/images/',
  });

  assert.equal(original, '<figure class="shot"><img alt="畫面" src="img/module-f/screen-1.png"><figcaption>保留</figcaption></figure>');
  assert.equal(rewritten, '<figure class="shot"><img alt="畫面" src="http://127.0.0.1:3000/private/api/homeworks/module-f/images/screen-1.png"><figcaption>保留</figcaption></figure>');
});

test('protected image reader returns only a validated ordinary image file', async (t) => {
  const { rootDirectory, bytes } = await imageFixture(t);
  const { readHomeworkContentImage } = await import('../admin/server/homework-content-images.mjs');

  const result = await readHomeworkContentImage({ rootDirectory, id: 'module-f', filename: 'screen-1.png' });
  assert.equal(result.mimeType, 'image/png');
  assert.deepEqual(result.bytes, bytes);
  await assert.rejects(
    readHomeworkContentImage({ rootDirectory, id: 'module-f', filename: '../screen-1.png' }),
    (error) => error.status === 404 && error.code === 'homework_image_not_found',
  );
});

test('content loader returns exact renderer content and a safe revision', async (t) => {
  const rootDirectory = await contentTransactionRoot(t);
  const { loadHomeworkContent, homeworkContentRevision } = await import('../admin/server/homework-content-editor.mjs');

  assert.deepEqual(await loadHomeworkContent({ rootDirectory, id: 'module-f' }), {
    homework: {
      id: 'module-f',
      title: 'Module F',
      url: '/homework/module-f.html',
      contentHtml: ORIGINAL_CONTENT,
      revision: homeworkContentRevision({ id: 'module-f', contentHtml: ORIGINAL_CONTENT }),
    },
  });
});

test('content loader distinguishes missing and legacy Homework without leaking paths', async (t) => {
  const rootDirectory = await contentTransactionRoot(t);
  const { loadHomeworkContent } = await import('../admin/server/homework-content-editor.mjs');
  await assert.rejects(
    loadHomeworkContent({ rootDirectory, id: 'missing' }),
    (error) => error.status === 404 && error.code === 'homework_not_found'
      && !error.message.includes(rootDirectory),
  );
  await writeFile(path.join(rootDirectory, 'homework', 'module-f.html'), '<!doctype html><p>legacy</p>');
  await assert.rejects(
    loadHomeworkContent({ rootDirectory, id: 'module-f' }),
    (error) => error.status === 409 && error.code === 'homework_not_editable'
      && !error.message.includes(rootDirectory),
  );
});

test('content preview reuses current metadata and embeds validated images for the opaque sandbox', async (t) => {
  const rootDirectory = await contentTransactionRoot(t);
  const { previewHomeworkContent } = await import('../admin/server/homework-content-editor.mjs');
  const result = await previewHomeworkContent({
    rootDirectory,
    id: 'module-f',
    contentHtml: UPDATED_CONTENT,
    assetBase: 'http://127.0.0.1:3000/private/assets/',
    imageBaseUrl: 'http://127.0.0.1:3000/private/api/homeworks/module-f/images/',
  });

  assert.match(result.previewHtml, /<title>Module F｜Homework 預覽<\/title>/);
  assert.match(result.previewHtml, /<p>原簡介<\/p>/);
  assert.match(result.previewHtml, /script-src 'none'/);
  assert.match(result.previewHtml, /src="data:image\/png;base64,c2NyZWVuLWltYWdlLWJ5dGVz"/);
  assert.doesNotMatch(result.previewHtml, /src="http:\/\/127\.0\.0\.1:3000\/private\/api\/homeworks\/module-f\/images\//);
  assert.doesNotMatch(result.previewHtml, /<script\b/i);
  assert.equal(UPDATED_CONTENT.includes('/private/api/'), false);

  for (const [contentHtml, expectedCode] of [
    ['<script>alert(1)</script>', 'forbidden_element'],
    ['<p onclick="alert(1)">內容</p>', 'attribute_not_allowed'],
    ['<a href="javascript:alert(1)">內容</a>', 'invalid_url'],
    ['<img src="img/module-f/missing.png" alt="畫面">', 'invalid_existing_image'],
    ['<img src="img/module-x/screen-1.png" alt="畫面">', 'invalid_existing_image'],
    [`<p>${'中'.repeat((400 * 1024) / 3 + 1)}</p>`, 'too_large'],
  ]) {
    await assert.rejects(
      previewHomeworkContent({
        rootDirectory,
        id: 'module-f',
        contentHtml,
        assetBase: 'http://127.0.0.1:3000/private/assets/',
        imageBaseUrl: 'http://127.0.0.1:3000/private/api/homeworks/module-f/images/',
      }),
      (error) => error.status === 422 && error.code === 'validation_failed'
        && error.fields.some(({ code }) => code === expectedCode),
      expectedCode,
    );
  }
});

test('content update changes only the detail page and retains lock-time metadata', async (t) => {
  const rootDirectory = await contentTransactionRoot(t);
  const { loadHomeworkContent, updateHomeworkContent } = await import('../admin/server/homework-content-editor.mjs');
  const before = await contentSnapshots(rootDirectory);
  const loaded = await loadHomeworkContent({ rootDirectory, id: 'module-f' });
  const newerItem = { ...EDITABLE_ITEM, title: '較新的標題', description: '較新的簡介' };
  await writeFile(path.join(rootDirectory, 'content', 'homework.json'), `${JSON.stringify([newerItem], null, 2)}\n`);
  await writeFile(path.join(rootDirectory, 'homework', 'module-f.html'), renderedPage(newerItem));
  await buildContentIndexes({ rootDirectory });
  const metadataSnapshot = await contentSnapshots(rootDirectory);

  const result = await updateHomeworkContent({
    rootDirectory,
    id: 'module-f',
    contentHtml: UPDATED_CONTENT,
    revision: loaded.homework.revision,
  });

  assert.equal(result.updated, true);
  assert.equal(result.homework.url, '/homework/module-f.html');
  const after = await contentSnapshots(rootDirectory);
  assert.deepEqual(after.manifest, metadataSnapshot.manifest);
  assert.deepEqual(after.index, metadataSnapshot.index);
  assert.deepEqual(after.cover, before.cover);
  assert.deepEqual(after.screen, before.screen);
  assert.notDeepEqual(after.page, metadataSnapshot.page);
  assert.match(after.page.toString('utf8'), /<h1>較新的標題<\/h1>\n        <p>較新的簡介<\/p>/);
  assert.match(after.page.toString('utf8'), /<h2>新內容<\/h2>/);
});

test('content revision prevents stale tabs from overwriting a newer update', async (t) => {
  const rootDirectory = await contentTransactionRoot(t);
  const { loadHomeworkContent, updateHomeworkContent } = await import('../admin/server/homework-content-editor.mjs');
  const { homework: loaded } = await loadHomeworkContent({ rootDirectory, id: 'module-f' });

  const outcomes = await Promise.allSettled([
    updateHomeworkContent({ rootDirectory, id: 'module-f', contentHtml: '<section><p>分頁一</p></section>', revision: loaded.revision }),
    updateHomeworkContent({ rootDirectory, id: 'module-f', contentHtml: '<section><p>分頁二</p></section>', revision: loaded.revision }),
  ]);
  assert.equal(outcomes.filter(({ status }) => status === 'fulfilled').length, 1);
  const rejected = outcomes.find(({ status }) => status === 'rejected');
  assert.equal(rejected.reason.status, 409);
  assert.equal(rejected.reason.code, 'content_changed');
});

test('content update restores the detail page after write, validation or index-check failure', async (t) => {
  const { loadHomeworkContent, updateHomeworkContent } = await import('../admin/server/homework-content-editor.mjs');
  const failures = [
    ['write', { writeText: async () => { throw new Error('injected write failure'); } }],
    ['validation', { validateProject: async () => ({ valid: false, errors: ['injected'] }) }],
    ['index check', { checkIndexes: async () => { throw new Error('injected check failure'); } }],
  ];
  for (const [label, dependencies] of failures) {
    await t.test(label, async (subtest) => {
      const rootDirectory = await contentTransactionRoot(subtest);
      const before = await contentSnapshots(rootDirectory);
      const { homework: loaded } = await loadHomeworkContent({ rootDirectory, id: 'module-f' });
      await assert.rejects(
        updateHomeworkContent({
          rootDirectory,
          id: 'module-f',
          contentHtml: UPDATED_CONTENT,
          revision: loaded.revision,
          dependencies,
        }),
        (error) => error.status === 500 && error.code === 'internal_error'
          && !error.message.includes(rootDirectory),
      );
      const after = await contentSnapshots(rootDirectory);
      for (const key of Object.keys(before)) assert.deepEqual(after[key], before[key], `${label}: ${key}`);
    });
  }
});

const ADMIN_PATH = '/homework-editor-private';
const ADMIN_SECRET = Buffer.alloc(32, 43).toString('base64url');

async function contentApiHarness(t) {
  const rootDirectory = await contentTransactionRoot(t);
  const { createAdminServer } = await import('../admin/server/server.mjs');
  let currentTime = 20_000;
  const config = {
    host: '127.0.0.1', port: 0, adminPath: ADMIN_PATH,
    passwordHash: 'not-used', sessionSecret: ADMIN_SECRET,
    cookieSecure: false, nodeEnv: 'development', sessionTtlMs: 10_000, bodyLimitBytes: 4_096,
  };
  const loggedErrors = [];
  const app = createAdminServer({
    config,
    rootDirectory,
    now: () => currentTime,
    logger: { error(message) { loggedErrors.push(message); }, warn() {}, log() {} },
  });
  await new Promise((resolve, reject) => {
    app.server.once('error', reject);
    app.server.listen(0, config.host, resolve);
  });
  t.after(() => app.close());
  const origin = `http://127.0.0.1:${app.server.address().port}`;
  function issueSession() {
    const session = app.sessions.create();
    return { ...session, cookie: `admin_session=${session.token}` };
  }
  async function send(route, {
    method,
    session,
    csrf = session?.csrfToken,
    requestOrigin = origin,
    body,
    contentType = 'application/json',
  } = {}) {
    const headers = {};
    if (requestOrigin !== null) headers.Origin = requestOrigin;
    if (contentType !== null) headers['Content-Type'] = contentType;
    if (session) headers.Cookie = session.cookie;
    if (csrf !== null && csrf !== undefined) headers['X-CSRF-Token'] = csrf;
    const response = await fetch(`${origin}${ADMIN_PATH}/${route}`, {
      method,
      headers,
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    return {
      response,
      bytes,
      text: bytes.toString('utf8'),
      json() { return JSON.parse(bytes.toString('utf8')); },
    };
  }
  return {
    rootDirectory, origin, app, loggedErrors, issueSession, send,
    advance(ms) { currentTime += ms; },
  };
}

function assertContentApiError(result, status, code) {
  assert.equal(result.response.status, status, result.text);
  assert.equal(result.response.headers.get('cache-control'), 'no-store');
  assert.equal(result.json().error.code, code);
  assert.doesNotMatch(result.text, /admin-homework-content-transaction-|[A-Z]:\\|stack|injected/i);
}

test('admin CSP permits validated inline preview images in its sandboxed frame', async (t) => {
  const api = await contentApiHarness(t);
  const session = api.issueSession();
  const result = await api.send('api/homeworks/module-f/content', { method: 'GET', session, requestOrigin: null, contentType: null });
  assert.equal(result.response.status, 200);
  assert.match(result.response.headers.get('content-security-policy'), /img-src 'self' data:/);
});

test('content GET requires a live Session and returns exact content without CSRF', async (t) => {
  const api = await contentApiHarness(t);
  assertContentApiError(await api.send('api/homeworks/module-f/content', { method: 'GET' }), 401, 'not_authenticated');
  const session = api.issueSession();
  const result = await api.send('api/homeworks/module-f/content', { method: 'GET', session, csrf: null, requestOrigin: null, contentType: null });
  assert.equal(result.response.status, 200, result.text);
  assert.equal(result.response.headers.get('cache-control'), 'no-store');
  assert.equal(result.json().homework.contentHtml, ORIGINAL_CONTENT);
  assert.match(result.json().homework.revision, /^[a-f0-9]{64}$/);
  api.advance(10_001);
  assertContentApiError(await api.send('api/homeworks/module-f/content', { method: 'GET', session, requestOrigin: null, contentType: null }), 401, 'not_authenticated');
});

test('content routes reject unsafe IDs, missing Homework and unsupported pages', async (t) => {
  const api = await contentApiHarness(t);
  const session = api.issueSession();
  assertContentApiError(await api.send('api/homeworks/Bad_ID/content', {
    method: 'GET', session, requestOrigin: null, contentType: null,
  }), 400, 'invalid_request');
  assertContentApiError(await api.send('api/homeworks/not-found/content', {
    method: 'GET', session, requestOrigin: null, contentType: null,
  }), 404, 'homework_not_found');
  await writeFile(path.join(api.rootDirectory, 'homework', 'module-f.html'), '<!doctype html><p>legacy</p>');
  assertContentApiError(await api.send('api/homeworks/module-f/content', {
    method: 'GET', session, requestOrigin: null, contentType: null,
  }), 409, 'homework_not_editable');
  assertContentApiError(await api.send('api/homeworks/module-f/images/screen-1.png', {
    method: 'GET', session, requestOrigin: null, contentType: null,
  }), 409, 'homework_not_editable');
});

test('content preview enforces method, Origin, Session and CSRF before parsing JSON', async (t) => {
  const api = await contentApiHarness(t);
  const session = api.issueSession();
  const route = 'api/homeworks/module-f/content/preview';
  const body = { contentHtml: UPDATED_CONTENT };
  const wrongMethod = await api.send(route, { method: 'GET', session, body: undefined, requestOrigin: null, contentType: null });
  assertContentApiError(wrongMethod, 405, 'method_not_allowed');
  assert.equal(wrongMethod.response.headers.get('allow'), 'POST');
  assertContentApiError(await api.send(route, { method: 'POST', session, requestOrigin: 'https://attacker.invalid', body }), 403, 'invalid_origin');
  assertContentApiError(await api.send(route, { method: 'POST', body: 'x'.repeat(600_000) }), 401, 'not_authenticated');
  assertContentApiError(await api.send(route, { method: 'POST', session, csrf: 'wrong', body }), 403, 'invalid_csrf');
});

test('content preview rejects malformed, oversized, unsafe and missing-image input', async (t) => {
  const api = await contentApiHarness(t);
  const session = api.issueSession();
  const route = 'api/homeworks/module-f/content/preview';
  assertContentApiError(await api.send(route, { method: 'POST', session, contentType: 'text/plain', body: UPDATED_CONTENT }), 415, 'unsupported_media_type');
  assertContentApiError(await api.send(route, { method: 'POST', session, body: '{bad json' }), 400, 'invalid_request');
  assertContentApiError(await api.send(route, { method: 'POST', session, body: { contentHtml: UPDATED_CONTENT, id: 'module-f' } }), 400, 'invalid_request');
  const unsafe = await api.send(route, { method: 'POST', session, body: { contentHtml: '<script>alert(1)</script>' } });
  assertContentApiError(unsafe, 422, 'validation_failed');
  assert.equal(unsafe.json().error.fields[0].code, 'forbidden_element');
  const missing = await api.send(route, { method: 'POST', session, body: { contentHtml: '<img src="img/module-f/missing.png" alt="畫面">' } });
  assertContentApiError(missing, 422, 'validation_failed');
  assert.equal(missing.json().error.fields[0].code, 'invalid_existing_image');
  assertContentApiError(await api.send(route, { method: 'POST', session, body: { contentHtml: '中'.repeat(180_000) } }), 413, 'payload_too_large');
});

test('content PATCH rejects stale revisions and updates only the detail page', async (t) => {
  const api = await contentApiHarness(t);
  const session = api.issueSession();
  const before = await contentSnapshots(api.rootDirectory);
  const loaded = await api.send('api/homeworks/module-f/content', { method: 'GET', session, requestOrigin: null, contentType: null });
  const revision = loaded.json().homework.revision;
  const route = 'api/homeworks/module-f/content';
  assertContentApiError(await api.send(route, { method: 'PATCH', session, body: { contentHtml: UPDATED_CONTENT } }), 400, 'invalid_request');
  assertContentApiError(await api.send(route, { method: 'PATCH', session, body: { contentHtml: UPDATED_CONTENT, revision: '0'.repeat(64) } }), 409, 'content_changed');
  const result = await api.send(route, { method: 'PATCH', session, body: { contentHtml: UPDATED_CONTENT, revision } });
  assert.equal(result.response.status, 200, result.text);
  assert.equal(result.response.headers.get('cache-control'), 'no-store');
  assert.equal(result.json().updated, true);
  assert.match(result.json().homework.revision, /^[a-f0-9]{64}$/);
  const after = await contentSnapshots(api.rootDirectory);
  assert.deepEqual(after.manifest, before.manifest);
  assert.deepEqual(after.index, before.index);
  assert.deepEqual(after.cover, before.cover);
  assert.deepEqual(after.screen, before.screen);
  assert.match(after.page.toString('utf8'), /<h2>新內容<\/h2>/);
  assertContentApiError(await api.send(route, { method: 'PATCH', session, body: { contentHtml: '<p>舊分頁</p>', revision } }), 409, 'content_changed');
});

test('content PATCH enforces Origin, Session and CSRF before reading a large body', async (t) => {
  const api = await contentApiHarness(t);
  const session = api.issueSession();
  const route = 'api/homeworks/module-f/content';
  const body = 'x'.repeat(600_000);
  assertContentApiError(await api.send(route, { method: 'PATCH', session, requestOrigin: 'https://attacker.invalid', body }), 403, 'invalid_origin');
  assertContentApiError(await api.send(route, { method: 'PATCH', body }), 401, 'not_authenticated');
  assertContentApiError(await api.send(route, { method: 'PATCH', session, csrf: 'wrong', body }), 403, 'invalid_csrf');
});

test('content PATCH rolls its detail page back when project validation fails', async (t) => {
  const api = await contentApiHarness(t);
  const session = api.issueSession();
  const before = await contentSnapshots(api.rootDirectory);
  const loaded = await api.send('api/homeworks/module-f/content', {
    method: 'GET', session, requestOrigin: null, contentType: null,
  });
  await rm(path.join(api.rootDirectory, 'world skill', 'index.html'));
  const result = await api.send('api/homeworks/module-f/content', {
    method: 'PATCH', session,
    body: { contentHtml: UPDATED_CONTENT, revision: loaded.json().homework.revision },
  });
  assertContentApiError(result, 500, 'internal_error');
  const after = await contentSnapshots(api.rootDirectory);
  for (const key of Object.keys(before)) assert.deepEqual(after[key], before[key], key);
});

test('protected content image GET validates ownership and serves fixed MIME bytes', async (t) => {
  const api = await contentApiHarness(t);
  const session = api.issueSession();
  const result = await api.send('api/homeworks/module-f/images/screen-1.png', {
    method: 'GET', session, requestOrigin: null, contentType: null,
  });
  assert.equal(result.response.status, 200, result.text);
  assert.equal(result.response.headers.get('cache-control'), 'no-store');
  assert.equal(result.response.headers.get('content-type'), 'image/png');
  assert.deepEqual(result.bytes, Buffer.from('screen-image-bytes'));
  assertContentApiError(await api.send('api/homeworks/module-f/images/missing.png', {
    method: 'GET', session, requestOrigin: null, contentType: null,
  }), 404, 'homework_image_not_found');
  assertContentApiError(await api.send('api/homeworks/module-f/images/screen-1.png', {
    method: 'GET', requestOrigin: null, contentType: null,
  }), 401, 'not_authenticated');
});

test('management page exposes an accessible isolated content editor and sandbox preview', async () => {
  const html = await readFile(new URL('../admin/index.html', import.meta.url), 'utf8');
  assert.match(html, /<dialog id="homework-content-edit-dialog"[^>]+aria-labelledby="homework-content-edit-title"/);
  assert.match(html, /id="homework-content-edit-id"[^>]+readonly/);
  assert.match(html, /id="homework-content-edit-name"[^>]+readonly/);
  assert.match(html, /id="homework-content-edit-html"[^>]+aria-describedby="[^"]*homework-content-edit-size/);
  assert.match(html, /id="homework-content-edit-size"[^>]+aria-live="polite"/);
  assert.match(html, /id="homework-content-edit-preview"[^>]*>更新預覽<\/button>/);
  assert.match(html, /id="homework-content-edit-save"[^>]+disabled[^>]*>儲存變更<\/button>/);
  const iframe = html.match(/<iframe id="homework-content-edit-frame"[^>]*><\/iframe>/)?.[0];
  assert.ok(iframe);
  assert.match(iframe, /sandbox(?:="")?/);
  assert.doesNotMatch(iframe, /allow-scripts|allow-same-origin|allow-forms/);
  const resultLink = html.match(/<a id="homework-content-edit-result-link"[^>]*>開啟公開 Homework<\/a>/)?.[0];
  assert.ok(resultLink);
  assert.match(resultLink, /target="_blank"/);
  assert.match(resultLink, /rel="noopener noreferrer"/);
});

function clientElement(initial = {}) {
  const listeners = new Map();
  return {
    hidden: false, disabled: false, textContent: '', value: '', href: '', src: '',
    childNodes: [], attributes: new Map(), focused: false, open: false, className: '',
    ...initial,
    addEventListener(type, listener) { listeners.set(type, listener); },
    setAttribute(name, value) { this.attributes.set(name, String(value)); },
    getAttribute(name) { return this.attributes.get(name) ?? null; },
    removeAttribute(name) { this.attributes.delete(name); },
    replaceChildren(...children) { this.childNodes = [...children]; },
    append(...children) { this.childNodes.push(...children); },
    focus() { this.focused = true; },
    showModal() { this.open = true; },
    close() { this.open = false; },
    async dispatch(type, extra = {}) {
      const listener = listeners.get(type);
      if (listener) await listener({ preventDefault() {}, target: this, ...extra });
    },
  };
}

function findClientNode(root, text) {
  if (root?.textContent === text) return root;
  for (const child of root?.childNodes ?? []) {
    const found = findClientNode(child, text);
    if (found) return found;
  }
  return undefined;
}

async function loadContentEditorClient({ contentResponses = [], previewResponses = [], updateResponses = [] } = {}) {
  const source = (await readFile(new URL('../admin/admin.js', import.meta.url), 'utf8')).replace(/^import[^;]+;\s*/m, '');
  const contract = await import('../admin/shared/homework-preview-contract.mjs');
  const selectors = new Map();
  const register = (selector, initial) => {
    const element = clientElement(initial);
    selectors.set(selector, element);
    return element;
  };
  const publishForm = register('#homework-form');
  const publishId = register('#homework-id', { value: 'draft-stays' });
  const publishTitle = register('#homework-title', { value: '未發佈標題' });
  const publishDescription = register('#homework-description', { value: '未發佈簡介' });
  const publishHtml = register('#homework-content-html', { value: '<p>未發佈內容</p>' });
  register('#logout-button', { disabled: true });
  const list = register('#published-homework-list', { hidden: true });
  register('#published-homework-list-header', { hidden: true });
  register('#published-homework-state');
  register('#published-homework-state-message');
  register('#published-homework-retry', { hidden: true });
  register('#published-homework-count');
  register('#published-homework-announcement');
  const expired = register('#session-expired', { hidden: true });
  register('#session-expired-message');
  const dialog = register('#homework-content-edit-dialog');
  const loading = register('#homework-content-edit-loading');
  const main = register('#homework-content-edit-main', { hidden: true });
  const success = register('#homework-content-edit-success', { hidden: true });
  const editId = register('#homework-content-edit-id');
  const editName = register('#homework-content-edit-name');
  const editUrl = register('#homework-content-edit-url');
  const textarea = register('#homework-content-edit-html');
  const size = register('#homework-content-edit-size');
  const error = register('#homework-content-edit-error', { hidden: true });
  const preview = register('#homework-content-edit-preview');
  const save = register('#homework-content-edit-save', { disabled: true });
  const cancel = register('#homework-content-edit-cancel');
  const close = register('#homework-content-edit-close');
  const frame = register('#homework-content-edit-frame', { hidden: true });
  register('#homework-content-edit-preview-empty');
  register('#homework-content-edit-preview-loading', { hidden: true });
  register('#homework-content-edit-preview-error', { hidden: true });
  const resultLink = register('#homework-content-edit-result-link');
  register('#homework-content-edit-announcement');

  const created = [];
  const revoked = [];
  const TestURL = {
    createObjectURL(value) { created.push(value); return `blob:content-${created.length}`; },
    revokeObjectURL(value) { revoked.push(value); },
  };
  const Blob = class TestBlob { constructor(parts, options) { this.parts = parts; this.options = options; } };
  const fetchCalls = [];
  let contentIndex = 0;
  let previewIndex = 0;
  let updateIndex = 0;
  const fetch = async (url, init = {}) => {
    fetchCalls.push({ url, init });
    if (url === 'api/session') return { ok: true, status: 200, json: async () => ({ authenticated: true, csrfToken: 'csrf-token' }) };
    if (url === 'api/homeworks') return { ok: true, status: 200, json: async () => ({
      homeworks: [{ id: 'module-f', title: '<img src=x onerror=alert(1)>', description: '原簡介',
        status: 'published', publishedAt: null, url: '/homework/module-f.html', editable: true }],
      total: 1,
    }) };
    if (url === 'api/homeworks/module-f/content' && (!init.method || init.method === 'GET')) {
      return contentResponses[contentIndex++] ?? { ok: true, status: 200, json: async () => ({ homework: {
        id: 'module-f', title: '<img src=x onerror=alert(1)>', url: '/homework/module-f.html',
        contentHtml: ORIGINAL_CONTENT, revision: 'a'.repeat(64),
      } }) };
    }
    if (url === 'api/homeworks/module-f/content/preview') {
      return previewResponses[previewIndex++] ?? { ok: true, status: 200, json: async () => ({ previewHtml: '<!doctype html><title>安全預覽</title>' }) };
    }
    if (url === 'api/homeworks/module-f/content' && init.method === 'PATCH') {
      return updateResponses[updateIndex++] ?? { ok: true, status: 200, json: async () => ({ updated: true, homework: {
        id: 'module-f', title: '<img src=x onerror=alert(1)>', url: '/homework/module-f.html', revision: 'b'.repeat(64),
      } }) };
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  const windowListeners = new Map();
  const window = {
    location: { assign() {} },
    addEventListener(type, listener) { windowListeners.set(type, listener); },
  };
  const document = {
    querySelector(selector) { return selectors.get(selector) ?? null; },
    createElement() { return clientElement(); },
  };
  runInNewContext(source, {
    ...contract, document, window, fetch, Blob, URL: TestURL, TextEncoder, queueMicrotask, console,
    FormData: class { append() {} },
    FileReader: class {},
    DOMParser: class {},
    navigator: { clipboard: { async writeText() {} } },
  });
  await new Promise((resolve) => setImmediate(resolve));
  return {
    selectors, publishForm, publishId, publishTitle, publishDescription, publishHtml,
    list, expired, dialog, loading, main, success, editId, editName, editUrl, textarea,
    size, error, preview, save, cancel, close, frame, resultLink, fetchCalls, created, revoked,
    windowListeners,
  };
}

test('client lists both edit actions safely and loads content into its independent dialog', async () => {
  const client = await loadContentEditorClient();
  const metadataButton = findClientNode(client.list, '編輯基本資料');
  const contentButton = findClientNode(client.list, '編輯主要內容');
  assert.ok(metadataButton);
  assert.ok(contentButton);
  assert.equal(findClientNode(client.list, '<img src=x onerror=alert(1)>').childNodes.length, 0);
  await contentButton.dispatch('click');
  assert.equal(client.dialog.open, true);
  assert.equal(client.loading.hidden, true);
  assert.equal(client.main.hidden, false);
  assert.equal(client.editId.value, 'module-f');
  assert.equal(client.editName.value, '<img src=x onerror=alert(1)>');
  assert.equal(client.textarea.value, ORIGINAL_CONTENT);
  assert.equal(client.save.disabled, true);
  assert.deepEqual(
    [client.publishId.value, client.publishTitle.value, client.publishDescription.value, client.publishHtml.value],
    ['draft-stays', '未發佈標題', '未發佈簡介', '<p>未發佈內容</p>'],
  );
});

test('client invalidates changed content, previews once, and saves only the exact previewed value', async () => {
  const client = await loadContentEditorClient();
  await findClientNode(client.list, '編輯主要內容').dispatch('click');
  client.textarea.value = UPDATED_CONTENT;
  await client.textarea.dispatch('input');
  assert.equal(client.save.disabled, true);
  assert.match(client.size.textContent, /KiB/);
  await Promise.all([client.preview.dispatch('click'), client.preview.dispatch('click')]);
  assert.equal(client.fetchCalls.filter(({ url }) => url.endsWith('/content/preview')).length, 1);
  assert.equal(client.created.length, 0);
  assert.match(client.frame.srcdoc, /<title>安全預覽<\/title>/);
  assert.equal(client.frame.hidden, false);
  assert.equal(client.save.disabled, false);
  assert.equal(client.textarea.value, UPDATED_CONTENT);
  client.textarea.value += '<p>未預覽</p>';
  await client.textarea.dispatch('input');
  assert.equal(client.frame.srcdoc, '');
  assert.equal(client.save.disabled, true);
  await client.preview.dispatch('click');
  await Promise.all([client.save.dispatch('click'), client.save.dispatch('click')]);
  assert.equal(client.fetchCalls.filter(({ url, init }) => url.endsWith('/content') && init.method === 'PATCH').length, 1);
  assert.equal(client.success.hidden, false);
  assert.equal(client.resultLink.href, '/homework/module-f.html');
  assert.deepEqual(
    [client.publishId.value, client.publishTitle.value, client.publishDescription.value, client.publishHtml.value],
    ['draft-stays', '未發佈標題', '未發佈簡介', '<p>未發佈內容</p>'],
  );
});

test('client keeps the content dialog open while a preview request is pending', async () => {
  let resolvePreview;
  const pendingPreview = new Promise((resolve) => {
    resolvePreview = resolve;
  });
  const client = await loadContentEditorClient({ previewResponses: [pendingPreview] });
  await findClientNode(client.list, '編輯主要內容').dispatch('click');
  client.textarea.value = UPDATED_CONTENT;
  await client.textarea.dispatch('input');

  const previewRequest = client.preview.dispatch('click');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(client.cancel.disabled, true);
  assert.equal(client.dialog.open, true);

  resolvePreview({
    ok: true,
    status: 200,
    json: async () => ({ previewHtml: '<!doctype html><title>安全預覽</title>' }),
  });
  await previewRequest;
  assert.equal(client.cancel.disabled, false);
});

test('client keeps edited HTML when preview expires or save reports a revision conflict', async () => {
  const expiredClient = await loadContentEditorClient({ previewResponses: [{
    ok: false, status: 401, json: async () => ({ error: { code: 'not_authenticated', message: 'expired' } }),
  }] });
  await findClientNode(expiredClient.list, '編輯主要內容').dispatch('click');
  expiredClient.textarea.value = UPDATED_CONTENT;
  await expiredClient.textarea.dispatch('input');
  await expiredClient.preview.dispatch('click');
  assert.equal(expiredClient.textarea.value, UPDATED_CONTENT);
  assert.equal(expiredClient.dialog.open, true);
  assert.equal(expiredClient.expired.hidden, false);

  const conflictClient = await loadContentEditorClient({ updateResponses: [{
    ok: false, status: 409, json: async () => ({ error: { code: 'content_changed', message: 'changed' } }),
  }] });
  await findClientNode(conflictClient.list, '編輯主要內容').dispatch('click');
  conflictClient.textarea.value = UPDATED_CONTENT;
  await conflictClient.textarea.dispatch('input');
  await conflictClient.preview.dispatch('click');
  await conflictClient.save.dispatch('click');
  assert.equal(conflictClient.textarea.value, UPDATED_CONTENT);
  assert.equal(conflictClient.error.hidden, false);
  assert.match(conflictClient.error.textContent, /重新載入/);
});

test('content editing tests leave the project manifest, Homework index and images byte-identical', async () => {
  const current = await snapshotProjectProtectedContent();
  assert.deepEqual([...current.keys()], [...projectProtectedSnapshot.keys()]);
  for (const [file, before] of projectProtectedSnapshot) assert.deepEqual(current.get(file), before, file);
});
