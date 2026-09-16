import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { renderHomeworkPage } from '../admin/server/homework-page-renderer.mjs';
import { buildContentIndexes } from '../scripts/build-content-indexes.mjs';
import { writeTextAtomic } from '../scripts/content-core.mjs';
import { validateContent } from '../scripts/validate-content.mjs';

async function metadataContract() {
  return import('../admin/shared/homework-preview-contract.mjs');
}

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

test('metadata contract accepts exactly title and description and normalizes their edges', async () => {
  const { isHomeworkMetadataRequest, validateHomeworkMetadataInput } = await metadataContract();
  const input = { title: '  新名稱  ', description: '  新簡介  ' };

  assert.equal(typeof isHomeworkMetadataRequest, 'function');
  assert.equal(typeof validateHomeworkMetadataInput, 'function');
  assert.equal(isHomeworkMetadataRequest(input), true);
  assert.deepEqual(validateHomeworkMetadataInput(input), {
    ok: true,
    value: { title: '新名稱', description: '新簡介' },
  });
});

test('metadata contract rejects missing, extra and non-object request shapes', async () => {
  const { isHomeworkMetadataRequest } = await metadataContract();
  for (const input of [
    null,
    [],
    'text',
    { title: '名稱' },
    { description: '簡介' },
    { id: 'module-f', title: '名稱', description: '簡介' },
  ]) assert.equal(isHomeworkMetadataRequest(input), false);
});

test('metadata contract enforces Unicode limits and plain-text field validation', async () => {
  const { validateHomeworkMetadataInput } = await metadataContract();
  assert.equal(validateHomeworkMetadataInput({ title: '字'.repeat(120), description: '字'.repeat(500) }).ok, true);

  const cases = [
    [{ title: '', description: '簡介' }, [['title', 'required']]],
    [{ title: 7, description: '簡介' }, [['title', 'invalid_type']]],
    [{ title: '字'.repeat(121), description: '簡介' }, [['title', 'too_long']]],
    [{ title: '名稱', description: 7 }, [['description', 'invalid_type']]],
    [{ title: '名稱', description: '字'.repeat(501) }, [['description', 'too_long']]],
    [{ title: '名稱', description: '<script>alert(1)</script>' }, [['description', 'html_not_allowed']]],
  ];
  for (const [input, expected] of cases) {
    const result = validateHomeworkMetadataInput(input);
    assert.equal(result.ok, false);
    assert.deepEqual(result.errors.map(({ field, code }) => [field, code]), expected);
  }
});

const EDITABLE_ITEM = Object.freeze({
  id: 'module-f',
  title: 'Module F',
  description: '原簡介',
  image: 'img/module-f/cover.png',
  imageAlt: 'Module F 成果畫面',
  additionalImages: ['img/module-f/screen.png'],
  additionalImageAlts: ['Module F 內容畫面'],
  resultPage: 'module-f.html',
  trainingFolder: 'Module F',
  status: 'published',
  order: 7,
});
const ORIGINAL_CONTENT = '<section><h2>保留內容</h2><p>不要改寫 &amp; 不要執行。</p></section>';

function renderedEditablePage(item = EDITABLE_ITEM, contentHtml = ORIGINAL_CONTENT) {
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

async function inspectionRoot(t, html = renderedEditablePage()) {
  const rootDirectory = await mkdtemp(path.join(os.tmpdir(), 'admin-homework-edit-inspect-'));
  await mkdir(path.join(rootDirectory, 'homework'), { recursive: true });
  await writeFile(path.join(rootDirectory, 'homework', 'module-f.html'), html);
  t.after(() => rm(rootDirectory, { recursive: true, force: true }));
  return rootDirectory;
}

test('editability inspector accepts only a byte-identical current renderer page and extracts exact content', async (t) => {
  const { inspectHomeworkEditability } = await import('../admin/server/homework-metadata-editor.mjs');
  const rootDirectory = await inspectionRoot(t);

  const result = await inspectHomeworkEditability({ rootDirectory, item: EDITABLE_ITEM });

  assert.equal(result.editable, true);
  assert.equal(result.contentHtml, ORIGINAL_CONTENT);
  assert.equal(result.pageHtml, renderedEditablePage());
  assert.equal(path.basename(result.pagePath), 'module-f.html');
});

test('editability inspector rejects legacy, outside, missing and draft pages without exposing a path', async (t) => {
  const { inspectHomeworkEditability } = await import('../admin/server/homework-metadata-editor.mjs');
  const rootDirectory = await inspectionRoot(t, '<!doctype html><title>Legacy</title><main>舊頁</main>');
  const cases = [
    EDITABLE_ITEM,
    { ...EDITABLE_ITEM, resultPage: '../world skill/module-f.html' },
    { ...EDITABLE_ITEM, resultPage: 'missing.html' },
    { ...EDITABLE_ITEM, status: 'draft' },
  ];

  for (const item of cases) {
    const result = await inspectHomeworkEditability({ rootDirectory, item });
    assert.deepEqual(result, { editable: false });
    assert.doesNotMatch(JSON.stringify(result), /admin-homework-edit-inspect-|[A-Z]:\\/i);
  }
});

test('editability inspector rejects missing, duplicate or mismatched renderer markers', async (t) => {
  const { inspectHomeworkEditability } = await import('../admin/server/homework-metadata-editor.mjs');
  const valid = renderedEditablePage();
  const cases = [
    valid.replace(' data-original-content', ''),
    valid.replace(' data-original-content', ' data-original-content><div data-original-content></div'),
    valid.replace('data-content-id="module-f"', 'data-content-id="other-id"'),
  ];

  for (const html of cases) {
    const rootDirectory = await inspectionRoot(t, html);
    assert.deepEqual(
      await inspectHomeworkEditability({ rootDirectory, item: EDITABLE_ITEM }),
      { editable: false },
    );
  }
});

test('editability inspector rejects a renderer page with any manual document change', async (t) => {
  const { inspectHomeworkEditability } = await import('../admin/server/homework-metadata-editor.mjs');
  const changed = renderedEditablePage().replace('</body>', '<p>手動加入</p></body>');
  const rootDirectory = await inspectionRoot(t, changed);

  assert.deepEqual(
    await inspectHomeworkEditability({ rootDirectory, item: EDITABLE_ITEM }),
    { editable: false },
  );
});

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

async function transactionRoot(t) {
  const rootDirectory = await mkdtemp(path.join(os.tmpdir(), 'admin-homework-edit-transaction-'));
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
    writeFile(path.join(rootDirectory, 'homework', 'module-f.html'), renderedEditablePage()),
    writeFile(path.join(rootDirectory, 'homework', 'img', 'module-f', 'cover.png'), Buffer.from('cover-image-bytes')),
    writeFile(path.join(rootDirectory, 'homework', 'img', 'module-f', 'screen.png'), Buffer.from('screen-image-bytes')),
    writeFile(path.join(rootDirectory, 'training', 'files.json'), `${JSON.stringify([{
      name: 'Module F', path: 'Module F', parentPath: '', type: 'folder', extension: '',
    }], null, 2)}\n`),
  ]);
  await buildContentIndexes({ rootDirectory });
  t.after(() => rm(rootDirectory, { recursive: true, force: true }));
  return rootDirectory;
}

async function readTransactionFiles(rootDirectory) {
  const [manifest, page, index, cover, screen] = await Promise.all([
    readFile(path.join(rootDirectory, 'content', 'homework.json')),
    readFile(path.join(rootDirectory, 'homework', 'module-f.html')),
    readFile(path.join(rootDirectory, 'homework', 'index.html')),
    readFile(path.join(rootDirectory, 'homework', 'img', 'module-f', 'cover.png')),
    readFile(path.join(rootDirectory, 'homework', 'img', 'module-f', 'screen.png')),
  ]);
  return { manifest, page, index, cover, screen };
}

test('metadata editor updates manifest, detail page and index while preserving content, images and other fields', async (t) => {
  const { updateHomeworkMetadata, inspectHomeworkEditability } = await import('../admin/server/homework-metadata-editor.mjs');
  const rootDirectory = await transactionRoot(t);
  const before = await readTransactionFiles(rootDirectory);

  const result = await updateHomeworkMetadata({
    rootDirectory,
    id: 'module-f',
    metadata: { title: '新名稱', description: '新簡介' },
  });

  assert.deepEqual(result, {
    updated: true,
    homework: { id: 'module-f', title: '新名稱', description: '新簡介', url: '/homework/module-f.html' },
  });
  const after = await readTransactionFiles(rootDirectory);
  const [record] = JSON.parse(after.manifest.toString('utf8'));
  assert.deepEqual(record, { ...EDITABLE_ITEM, title: '新名稱', description: '新簡介' });
  assert.match(after.page.toString('utf8'), /<title>新名稱｜Homework<\/title>/);
  assert.match(after.page.toString('utf8'), /<h1>新名稱<\/h1>\n        <p>新簡介<\/p>/);
  assert.match(after.index.toString('utf8'), /data-homework-name="新名稱" data-description="新簡介"/);
  const inspection = await inspectHomeworkEditability({ rootDirectory, item: record });
  assert.equal(inspection.editable, true);
  assert.equal(inspection.contentHtml, ORIGINAL_CONTENT);
  assert.deepEqual(after.cover, before.cover);
  assert.deepEqual(after.screen, before.screen);
});

test('metadata editor renders HTML-like title text inert in both public outputs', async (t) => {
  const { updateHomeworkMetadata } = await import('../admin/server/homework-metadata-editor.mjs');
  const rootDirectory = await transactionRoot(t);
  const title = '<script>alert(1)</script>';

  await updateHomeworkMetadata({
    rootDirectory,
    id: 'module-f',
    metadata: { title, description: '安全純文字簡介' },
  });

  const after = await readTransactionFiles(rootDirectory);
  for (const html of [after.page.toString('utf8'), after.index.toString('utf8')]) {
    assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  }
});

test('metadata editor restores all three formal files after every transaction-stage failure', async (t) => {
  const { updateHomeworkMetadata } = await import('../admin/server/homework-metadata-editor.mjs');
  const failures = [
    {
      label: 'second formal write',
      dependencies() {
        let calls = 0;
        return {
          async writeText(filePath, text) {
            calls += 1;
            if (calls === 2) throw new Error('injected write failure');
            return writeTextAtomic(filePath, text);
          },
        };
      },
    },
    {
      label: 'index build',
      dependencies: () => ({ buildIndexes: async () => { throw new Error('injected build failure'); } }),
    },
    {
      label: 'content validation',
      dependencies: () => ({ validateProject: async () => ({ valid: false, errors: ['injected'] }) }),
    },
    {
      label: 'index check',
      dependencies: () => ({ checkIndexes: async () => { throw new Error('injected check failure'); } }),
    },
  ];

  for (const failure of failures) {
    await t.test(failure.label, async (subtest) => {
      const rootDirectory = await transactionRoot(subtest);
      const before = await readTransactionFiles(rootDirectory);
      await assert.rejects(
        () => updateHomeworkMetadata({
          rootDirectory,
          id: 'module-f',
          metadata: { title: '失敗名稱', description: '失敗簡介' },
          dependencies: failure.dependencies(),
        }),
        (error) => error.code === 'internal_error' && error.status === 500
          && !error.message.includes(rootDirectory),
      );
      const after = await readTransactionFiles(rootDirectory);
      assert.deepEqual(after.manifest, before.manifest);
      assert.deepEqual(after.page, before.page);
      assert.deepEqual(after.index, before.index);
    });
  }
});

test('metadata editor serializes simultaneous updates with the shared manifest lock', async (t) => {
  const { updateHomeworkMetadata, inspectHomeworkEditability } = await import('../admin/server/homework-metadata-editor.mjs');
  const rootDirectory = await transactionRoot(t);
  const firstValidationEntered = deferred();
  const releaseFirstValidation = deferred();
  let validationCalls = 0;
  let activeValidations = 0;
  let maximumActiveValidations = 0;
  const dependencies = {
    async validateProject(options) {
      validationCalls += 1;
      activeValidations += 1;
      maximumActiveValidations = Math.max(maximumActiveValidations, activeValidations);
      if (validationCalls === 1) {
        firstValidationEntered.resolve();
        await releaseFirstValidation.promise;
      }
      const result = await validateContent(options);
      activeValidations -= 1;
      return result;
    },
  };

  const first = updateHomeworkMetadata({
    rootDirectory, id: 'module-f',
    metadata: { title: '第一個名稱', description: '第一個簡介' }, dependencies,
  });
  await firstValidationEntered.promise;
  const second = updateHomeworkMetadata({
    rootDirectory, id: 'module-f',
    metadata: { title: '第二個名稱', description: '第二個簡介' }, dependencies,
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(validationCalls, 1);
  releaseFirstValidation.resolve();
  await Promise.all([first, second]);

  assert.equal(maximumActiveValidations, 1);
  const [record] = JSON.parse((await readTransactionFiles(rootDirectory)).manifest.toString('utf8'));
  assert.equal(record.title, '第二個名稱');
  assert.equal(record.description, '第二個簡介');
  assert.equal((await inspectHomeworkEditability({ rootDirectory, item: record })).editable, true);
});

test('metadata editor distinguishes missing Homework from an unsupported legacy page', async (t) => {
  const { updateHomeworkMetadata } = await import('../admin/server/homework-metadata-editor.mjs');
  const missingRoot = await transactionRoot(t);
  await assert.rejects(
    () => updateHomeworkMetadata({
      rootDirectory: missingRoot, id: 'not-found',
      metadata: { title: '名稱', description: '簡介' },
    }),
    (error) => error.status === 404 && error.code === 'homework_not_found',
  );

  const legacyRoot = await transactionRoot(t);
  await writeFile(path.join(legacyRoot, 'homework', 'module-f.html'), '<!doctype html><p>legacy</p>');
  const before = await readTransactionFiles(legacyRoot);
  await assert.rejects(
    () => updateHomeworkMetadata({
      rootDirectory: legacyRoot, id: 'module-f',
      metadata: { title: '名稱', description: '簡介' },
    }),
    (error) => error.status === 409 && error.code === 'homework_not_editable',
  );
  const after = await readTransactionFiles(legacyRoot);
  assert.deepEqual(after.manifest, before.manifest);
  assert.deepEqual(after.page, before.page);
  assert.deepEqual(after.index, before.index);
});

test('published Homework list reports renderer-safe editability and includes the edit fields', async (t) => {
  const { loadPublishedHomeworks } = await import('../admin/server/homework-list.mjs');
  const rootDirectory = await transactionRoot(t);

  assert.deepEqual(await loadPublishedHomeworks({ rootDirectory }), {
    homeworks: [{
      id: 'module-f',
      title: 'Module F',
      description: '原簡介',
      status: 'published',
      publishedAt: null,
      url: '/homework/module-f.html',
      editable: true,
    }],
    total: 1,
  });
});

const ADMIN_PATH = '/homework-editor-private';
const ADMIN_SECRET = Buffer.alloc(32, 31).toString('base64url');

async function metadataApiHarness(t) {
  const rootDirectory = await transactionRoot(t);
  const { createAdminServer } = await import('../admin/server/server.mjs');
  let currentTime = 10_000;
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
  async function send({
    id = 'module-f', method = 'PATCH', session, csrf = session?.csrfToken,
    requestOrigin = origin, body = { title: '更新名稱', description: '更新簡介' },
    contentType = 'application/json',
  } = {}) {
    const headers = {};
    if (requestOrigin !== null) headers.Origin = requestOrigin;
    if (contentType !== null) headers['Content-Type'] = contentType;
    if (session) headers.Cookie = session.cookie;
    if (csrf !== null && csrf !== undefined) headers['X-CSRF-Token'] = csrf;
    const response = await fetch(`${origin}${ADMIN_PATH}/api/homeworks/${id}`, {
      method,
      headers,
      body: method === 'GET' ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    const text = await response.text();
    return { response, text, json: () => JSON.parse(text) };
  }
  return {
    rootDirectory, origin, app, loggedErrors, issueSession, send,
    advance(ms) { currentTime += ms; },
  };
}

function assertApiError(result, status, code) {
  assert.equal(result.response.status, status, result.text);
  assert.equal(result.response.headers.get('cache-control'), 'no-store');
  const body = result.json();
  assert.equal(body.error.code, code);
  assert.equal(typeof body.error.message, 'string');
  assert.doesNotMatch(result.text, /admin-homework-edit-transaction-|[A-Z]:\\|stack|injected/i);
}

test('PATCH metadata API enforces method, Origin, live Session and CSRF before editing', async (t) => {
  const api = await metadataApiHarness(t);
  const session = api.issueSession();
  const wrongMethod = await api.send({ method: 'GET', session });
  assertApiError(wrongMethod, 405, 'method_not_allowed');
  assert.equal(wrongMethod.response.headers.get('allow'), 'PATCH');

  assertApiError(await api.send({ requestOrigin: 'https://attacker.invalid', session }), 403, 'invalid_origin');
  assertApiError(await api.send(), 401, 'not_authenticated');
  assertApiError(await api.send({ session, csrf: 'wrong-token' }), 403, 'invalid_csrf');

  const expired = api.issueSession();
  api.advance(10_001);
  const expiredResult = await api.send({ session: expired });
  assertApiError(expiredResult, 401, 'not_authenticated');
  assert.match(expiredResult.response.headers.get('set-cookie'), /Max-Age=0/);
});

test('PATCH metadata API separates invalid request, validation, missing and unsupported errors', async (t) => {
  const api = await metadataApiHarness(t);
  const session = api.issueSession();
  assertApiError(await api.send({ session, contentType: 'text/plain' }), 415, 'unsupported_media_type');
  assertApiError(await api.send({ session, body: '{not json' }), 400, 'invalid_request');
  assertApiError(await api.send({ session, body: `{"title":"${'字'.repeat(4_096)}","description":"簡介"}` }), 413, 'payload_too_large');
  assertApiError(await api.send({ id: 'Bad_ID', session }), 400, 'invalid_request');
  assertApiError(await api.send({ session, body: { id: 'module-f', title: '名稱', description: '簡介' } }), 400, 'invalid_request');
  const invalidFields = await api.send({ session, body: { title: '', description: '<script>' } });
  assertApiError(invalidFields, 422, 'validation_failed');
  assert.deepEqual(invalidFields.json().error.fields.map(({ field, code }) => [field, code]), [
    ['title', 'required'],
    ['description', 'html_not_allowed'],
  ]);
  assertApiError(await api.send({ id: 'not-found', session }), 404, 'homework_not_found');

  await writeFile(path.join(api.rootDirectory, 'homework', 'module-f.html'), '<!doctype html><p>legacy</p>');
  assertApiError(await api.send({ session }), 409, 'homework_not_editable');
});

test('PATCH metadata API authenticates before a large body and safely rolls back an internal failure', async (t) => {
  const api = await metadataApiHarness(t);
  assertApiError(await api.send({ body: 'x'.repeat(8_192) }), 401, 'not_authenticated');

  const before = await readTransactionFiles(api.rootDirectory);
  await rm(path.join(api.rootDirectory, 'world skill', 'index.html'));
  const failed = await api.send({
    session: api.issueSession(),
    body: { title: '不可留下', description: '必須完整回滾' },
  });
  assertApiError(failed, 500, 'internal_error');
  const after = await readTransactionFiles(api.rootDirectory);
  assert.deepEqual(after.manifest, before.manifest);
  assert.deepEqual(after.page, before.page);
  assert.deepEqual(after.index, before.index);
  assert.deepEqual(after.cover, before.cover);
  assert.deepEqual(after.screen, before.screen);
});

test('PATCH metadata API returns the safe updated contract and synchronizes formal files', async (t) => {
  const api = await metadataApiHarness(t);
  const result = await api.send({
    session: api.issueSession(),
    body: { title: 'API 新名稱', description: 'API 新簡介' },
  });

  assert.equal(result.response.status, 200, result.text);
  assert.equal(result.response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(result.json(), {
    updated: true,
    homework: {
      id: 'module-f', title: 'API 新名稱', description: 'API 新簡介',
      url: '/homework/module-f.html',
    },
  });
  const after = await readTransactionFiles(api.rootDirectory);
  assert.match(after.page.toString('utf8'), /<h1>API 新名稱<\/h1>/);
  assert.match(after.index.toString('utf8'), /data-homework-name="API 新名稱"/);
  assert.equal(JSON.parse(after.manifest.toString('utf8'))[0].description, 'API 新簡介');
  assert.deepEqual(api.loggedErrors, []);
});
