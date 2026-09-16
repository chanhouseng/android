import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { loadPublishedHomeworks } from '../admin/server/homework-list.mjs';
import { validateHomeworkMetadataInput } from '../admin/shared/homework-preview-contract.mjs';

const ADMIN_PATH = '/homework-editor-private';
const ADMIN_SECRET = Buffer.alloc(32, 23).toString('base64url');
const PROJECT_HOMEWORK_PATH = new URL('../content/homework.json', import.meta.url);
const protectedManifestSnapshot = await readFile(PROJECT_HOMEWORK_PATH);

const FIXTURE_RECORDS = [
  {
    id: 'published-one', title: 'Published One', description: '', image: null,
    resultPage: 'published-one.html', trainingFolder: null, status: 'published', order: 1,
    publishedAt: '2026-09-13',
  },
  {
    id: 'draft-one', title: 'Draft One', description: '', image: null,
    resultPage: 'draft-one.html', trainingFolder: null, status: 'draft', order: 2,
  },
  {
    id: 'cross-section', title: 'Cross Section', description: '', image: null,
    resultPage: '../world skill/cross section.html', trainingFolder: null, status: 'published', order: 3,
  },
  {
    id: 'no-page', title: 'No Page', description: '', image: null,
    resultPage: null, trainingFolder: null, status: 'published', order: 4,
  },
];

async function makeManifestRoot(t, value = FIXTURE_RECORDS) {
  const rootDirectory = await mkdtemp(path.join(os.tmpdir(), 'admin-homework-list-'));
  await mkdir(path.join(rootDirectory, 'content'), { recursive: true });
  const manifestPath = path.join(rootDirectory, 'content', 'homework.json');
  const text = typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(manifestPath, text);
  t.after(() => rm(rootDirectory, { recursive: true, force: true }));
  return { rootDirectory, manifestPath, text: Buffer.from(text) };
}

test('manifest reader returns only published records with trusted public URLs and no invented dates', async (t) => {
  const { rootDirectory, manifestPath, text } = await makeManifestRoot(t);
  const result = await loadPublishedHomeworks({ rootDirectory });
  assert.deepEqual(result, {
    homeworks: [
      {
        id: 'published-one', title: 'Published One', description: '', status: 'published',
        publishedAt: '2026-09-13', url: '/homework/published-one.html', editable: false,
      },
      {
        id: 'cross-section', title: 'Cross Section', description: '', status: 'published',
        publishedAt: null, url: '/world%20skill/cross%20section.html', editable: false,
      },
      {
        id: 'no-page', title: 'No Page', description: '', status: 'published', publishedAt: null,
        url: null, editable: false,
      },
    ],
    total: 3,
  });
  assert.deepEqual(await readFile(manifestPath), text);
});

test('manifest reader returns an exact empty contract', async (t) => {
  const { rootDirectory } = await makeManifestRoot(t, []);
  assert.deepEqual(await loadPublishedHomeworks({ rootDirectory }), { homeworks: [], total: 0 });
});

test('manifest reader fails closed without exposing physical paths', async (t) => {
  for (const invalid of [
    '{',
    {},
    [null],
    [{ id: 'bad', title: 7, resultPage: null, status: 'published' }],
    [{ id: 'bad', title: 'Bad', description: 7, resultPage: null, status: 'published' }],
    [{ id: 'bad', title: 'Bad', resultPage: 'https://attacker.invalid/x', status: 'published' }],
    [{ id: 'sentinel', title: 'Sentinel', resultPage: 'https://published.invalid/private', status: 'published' }],
    [{ id: 'bad-draft', title: 'Bad Draft', resultPage: 'https://attacker.invalid/x', status: 'draft' }],
    [{ id: 'bad', title: 'Bad', resultPage: null, status: 'unknown' }],
  ]) {
    const { rootDirectory } = await makeManifestRoot(t, invalid);
    await assert.rejects(
      () => loadPublishedHomeworks({ rootDirectory }),
      (error) => {
        assert.equal(error.code, 'invalid_manifest');
        assert.equal(error.status, 500);
        assert.doesNotMatch(error.message, /admin-homework-list-|content[\\/]homework\.json|attacker/i);
        return true;
      },
    );
  }
});

async function apiHarness(t, manifest = FIXTURE_RECORDS) {
  const fixture = await makeManifestRoot(t, manifest);
  const { createAdminServer } = await import('../admin/server/server.mjs');
  let currentTime = 1_000;
  const config = {
    host: '127.0.0.1', port: 0, adminPath: ADMIN_PATH,
    passwordHash: 'not-used-by-this-test', sessionSecret: ADMIN_SECRET,
    cookieSecure: false, nodeEnv: 'development', sessionTtlMs: 10_000, bodyLimitBytes: 4_096,
  };
  const errors = [];
  const app = createAdminServer({
    config, rootDirectory: fixture.rootDirectory, now: () => currentTime,
    logger: { error(message) { errors.push(message); }, warn() {}, log() {} },
  });
  await new Promise((resolve, reject) => {
    app.server.once('error', reject);
    app.server.listen(0, config.host, resolve);
  });
  const origin = `http://127.0.0.1:${app.server.address().port}`;
  t.after(() => app.close());
  function issueSession() {
    const session = app.sessions.create();
    return { ...session, cookie: `admin_session=${session.token}` };
  }
  async function send({ method = 'GET', session } = {}) {
    const response = await fetch(`${origin}${ADMIN_PATH}/api/homeworks`, {
      method,
      headers: session ? { Cookie: session.cookie } : {},
    });
    const text = await response.text();
    return { response, text, json: () => JSON.parse(text) };
  }
  return { ...fixture, ...app, errors, issueSession, send, advance(ms) { currentTime += ms; } };
}

function assertApiError(result, status, code) {
  assert.equal(result.response.status, status, result.text);
  const body = result.json();
  assert.equal(body.error.code, code);
  assert.equal(typeof body.error.message, 'string');
}

test('GET API requires a live Session, needs no CSRF, and returns only published items', async (t) => {
  const app = await apiHarness(t);
  const guest = await app.send();
  assertApiError(guest, 401, 'not_authenticated');
  assert.equal(guest.response.headers.get('cache-control'), 'no-store');

  const expired = app.issueSession();
  app.advance(10_001);
  const expiredResult = await app.send({ session: expired });
  assertApiError(expiredResult, 401, 'not_authenticated');
  assert.match(expiredResult.response.headers.get('set-cookie'), /Max-Age=0/);

  const session = app.issueSession();
  const result = await app.send({ session });
  assert.equal(result.response.status, 200, result.text);
  assert.equal(result.response.headers.get('cache-control'), 'no-store');
  assert.equal(result.json().total, 3);
  assert.deepEqual(result.json().homeworks.map(({ id }) => id), ['published-one', 'cross-section', 'no-page']);
  assert.ok(result.json().homeworks.every(({ status }) => status === 'published'));
  assert.doesNotMatch(result.text, /draft-one|csrf|admin_session|admin-homework-list-|[A-Z]:\\/i);
});

test('Homework list API accepts only GET and leaves the manifest byte-identical', async (t) => {
  const app = await apiHarness(t);
  const before = await readFile(app.manifestPath);
  const wrongMethod = await app.send({ method: 'POST', session: app.issueSession() });
  assertApiError(wrongMethod, 405, 'method_not_allowed');
  assert.equal(wrongMethod.response.headers.get('allow'), 'GET');
  assert.equal(wrongMethod.response.headers.get('cache-control'), 'no-store');
  await app.send({ session: app.issueSession() });
  assert.deepEqual(await readFile(app.manifestPath), before);
});

test('API returns empty data and a safe unified error for invalid manifests', async (t) => {
  const empty = await apiHarness(t, []);
  const emptyResult = await empty.send({ session: empty.issueSession() });
  assert.deepEqual(emptyResult.json(), { homeworks: [], total: 0 });

  const invalid = await apiHarness(t, '{');
  const invalidResult = await invalid.send({ session: invalid.issueSession() });
  assertApiError(invalidResult, 500, 'invalid_manifest');
  assert.equal(invalidResult.response.headers.get('cache-control'), 'no-store');
  assert.doesNotMatch(invalidResult.text, /admin-homework-list-|content[\\/]homework\.json|SyntaxError|stack/i);
  assert.deepEqual(invalid.errors, []);
});

function browserElement(tagName = 'div', initial = {}) {
  const listeners = new Map();
  return {
    tagName: tagName.toUpperCase(), hidden: false, disabled: false, textContent: '', value: '',
    href: '', className: '', childNodes: [], attributes: new Map(), ...initial,
    addEventListener(type, listener) { listeners.set(type, listener); },
    setAttribute(name, value) { this.attributes.set(name, String(value)); },
    removeAttribute(name) { this.attributes.delete(name); },
    getAttribute(name) { return this.attributes.get(name) ?? null; },
    replaceChildren(...children) { this.childNodes = [...children]; },
    append(...children) { this.childNodes.push(...children); },
    focus() { this.focused = true; },
    async dispatch(type) { return listeners.get(type)?.({ preventDefault() {}, target: this }); },
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

async function flushClient() {
  await new Promise((resolve) => setImmediate(resolve));
}

async function loadListClient({ homeworkResponses = [], patchResponses = [], inspectLoading } = {}) {
  const source = (await readFile(new URL('../admin/admin.js', import.meta.url), 'utf8')).replace(/^import[^;]+;\s*/m, '');
  const selectors = new Map();
  const register = (selector, tagName = 'div', initial = {}) => {
    const element = browserElement(tagName, initial);
    selectors.set(selector, element);
    return element;
  };
  const id = register('#homework-id', 'input', { value: 'draft-in-progress' });
  const title = register('#homework-title', 'input', { value: '尚未發佈表單' });
  const description = register('#homework-description', 'textarea', { value: '保留我' });
  const contentHtml = register('#homework-content-html', 'textarea', { value: '<p>保留我</p>' });
  const state = register('#published-homework-state');
  const stateMessage = register('#published-homework-state-message', 'span');
  const retry = register('#published-homework-retry', 'button', { hidden: true });
  const list = register('#published-homework-list', 'ul', { hidden: true });
  const listHeader = register('#published-homework-list-header', 'div', { hidden: true });
  const count = register('#published-homework-count', 'span');
  const announcement = register('#published-homework-announcement', 'p');
  const expired = register('#session-expired', 'div', { hidden: true });
  register('#session-expired-message', 'strong');
  const editDialog = register('#homework-edit-dialog', 'dialog', {
    open: false,
    showModal() { this.open = true; },
    close() { this.open = false; },
  });
  const editForm = register('#homework-edit-form', 'form');
  const editView = register('#homework-edit-view', 'div');
  const editConfirmView = register('#homework-edit-confirm-view', 'div', { hidden: true });
  const editId = register('#homework-edit-id', 'input');
  const editTitle = register('#homework-edit-title', 'input');
  const editDescription = register('#homework-edit-description', 'textarea');
  const editDescriptionCount = register('#homework-edit-description-count', 'span');
  const editUrl = register('#homework-edit-url', 'span');
  const editTitleError = register('#homework-edit-title-error', 'p', { hidden: true });
  const editDescriptionError = register('#homework-edit-description-error', 'p', { hidden: true });
  const editError = register('#homework-edit-error', 'div', { hidden: true });
  const editCancel = register('#homework-edit-cancel', 'button');
  const editSave = register('#homework-edit-save', 'button', { disabled: true });
  const editBack = register('#homework-edit-back', 'button');
  const editConfirm = register('#homework-edit-confirm', 'button');
  const editSummaryId = register('#homework-edit-summary-id', 'dd');
  const editSummaryTitle = register('#homework-edit-summary-title', 'dd');
  const editSummaryDescription = register('#homework-edit-summary-description', 'dd');
  const editAnnouncement = register('#homework-edit-announcement', 'p');
  const fetchCalls = [];
  let homeworkIndex = 0;
  let patchIndex = 0;
  const fetch = async (url, init) => {
    fetchCalls.push({ url, init });
    if (url === 'api/session') return { ok: true, status: 200,
      json: async () => ({ authenticated: true, csrfToken: 'csrf-token' }) };
    if (url === 'api/homeworks') {
      return await (homeworkResponses[homeworkIndex++] ?? {
        ok: true, status: 200, json: async () => ({ homeworks: [], total: 0 }),
      });
    }
    if (url.startsWith('api/homeworks/') && init?.method === 'PATCH') {
      return await (patchResponses[patchIndex++] ?? {
        ok: true, status: 200, json: async () => ({ updated: true, homework: {
          id: 'safe', title: '新名稱', description: '新簡介', url: '/homework/safe.html',
        } }),
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  const redirects = [];
  const window = { location: { assign(value) { redirects.push(value); } }, addEventListener() {} };
  const document = {
    querySelector(selector) { return selectors.get(selector) ?? null; },
    createElement(tagName) { return browserElement(tagName); },
  };
  runInNewContext(source, {
    document, window, fetch, URL: { revokeObjectURL() {} }, TextEncoder,
    HOMEWORK_ID_PATTERN: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    HOMEWORK_PUBLISH_LIMITS: { imageBytes: 5_242_880, totalImageBytes: 31_457_280, contentImageCount: 10 },
    contentImagePath: (homeworkId, filename) => `img/${homeworkId}/${filename}`,
    isSafeContentImageFilename: () => true,
    validateHomeworkPublishInput: () => ({ ok: false, errors: [] }),
    validateHomeworkMetadataInput,
    console,
  });
  await flushClient();
  inspectLoading?.({ state, stateMessage, retry, list, fetchCalls });
  return { selectors, id, title, description, contentHtml, state, stateMessage, retry,
    list, listHeader, count, announcement, expired, fetchCalls, redirects,
    editDialog, editForm, editView, editConfirmView, editId, editTitle, editDescription,
    editDescriptionCount, editUrl, editTitleError, editDescriptionError, editError,
    editCancel, editSave, editBack, editConfirm, editSummaryId, editSummaryTitle,
    editSummaryDescription, editAnnouncement };
}

function descendants(node) {
  return [node, ...node.childNodes.flatMap(descendants)];
}

test('client shows loading, then count and safe published Homework rows without clearing the form', async () => {
  const pending = deferred();
  const clientPromise = loadListClient({ homeworkResponses: [pending.promise], inspectLoading(client) {
    assert.equal(client.stateMessage.textContent, '正在載入已發佈 Homework…');
    assert.equal(client.state.hidden, false);
    assert.equal(client.retry.disabled, true);
    pending.resolve({ ok: true, status: 200, json: async () => ({
      homeworks: [
        { id: 'safe', title: '<img src=x onerror=alert(1)>', description: '安全簡介',
          status: 'published', publishedAt: null, url: '/homework/safe.html', editable: true },
        { id: 'no-page', title: 'No Page', description: '', status: 'published',
          publishedAt: '2026-09-13', url: null, editable: false },
      ],
      total: 2,
    }) });
  } });
  const client = await clientPromise;
  await flushClient();
  assert.equal(client.count.textContent, '（2）');
  assert.equal(client.announcement.textContent, '已載入 2 個 Homework。');
  assert.equal(client.list.hidden, false);
  assert.equal(client.list.childNodes.length, 2);
  const nodes = descendants(client.list);
  const hostileTitle = nodes.find((node) => node.textContent === '<img src=x onerror=alert(1)>');
  assert.ok(hostileTitle);
  assert.equal(hostileTitle.childNodes.length, 0);
  assert.ok(nodes.some((node) => node.textContent === '未提供'));
  const link = nodes.find((node) => node.tagName === 'A');
  assert.equal(link.href, '/homework/safe.html');
  assert.equal(link.getAttribute('target'), '_blank');
  assert.equal(link.getAttribute('rel'), 'noopener noreferrer');
  const unavailable = nodes.find((node) => node.tagName === 'BUTTON' && node.textContent === '開啟 Homework');
  assert.equal(unavailable.disabled, true);
  assert.ok(nodes.some((node) => node.tagName === 'BUTTON' && node.textContent === '編輯基本資料'));
  assert.ok(nodes.some((node) => node.textContent === '此舊項目暫不支援網站編輯'));
  assert.deepEqual([client.id.value, client.title.value, client.description.value, client.contentHtml.value],
    ['draft-in-progress', '尚未發佈表單', '保留我', '<p>保留我</p>']);
});

test('client edits metadata through a text-only confirmation and refreshes without touching the publish form', async () => {
  const patchPending = deferred();
  const client = await loadListClient({
    homeworkResponses: [
      { ok: true, status: 200, json: async () => ({ homeworks: [{
        id: 'safe', title: '原名稱', description: '原簡介', status: 'published',
        publishedAt: null, url: '/homework/safe.html', editable: true,
      }], total: 1 }) },
      { ok: true, status: 200, json: async () => ({ homeworks: [{
        id: 'safe', title: '新名稱', description: '新簡介', status: 'published',
        publishedAt: null, url: '/homework/safe.html', editable: true,
      }], total: 1 }) },
    ],
    patchResponses: [patchPending.promise],
  });
  const editButton = descendants(client.list)
    .find((node) => node.tagName === 'BUTTON' && node.textContent === '編輯基本資料');
  assert.ok(editButton);
  await editButton.dispatch('click');
  assert.equal(client.editDialog.open, true);
  assert.deepEqual(
    [client.editId.value, client.editTitle.value, client.editDescription.value, client.editUrl.textContent],
    ['safe', '原名稱', '原簡介', '/homework/safe.html'],
  );
  assert.equal(client.editSave.disabled, true);

  client.editTitle.value = '<img src=x onerror=alert(1)> 新名稱';
  client.editDescription.value = '新簡介';
  await client.editTitle.dispatch('input');
  await client.editDescription.dispatch('input');
  assert.equal(client.editDescriptionCount.textContent, '3 / 500');
  assert.equal(client.editSave.disabled, false);
  await client.editForm.dispatch('submit');
  assert.equal(client.editView.hidden, true);
  assert.equal(client.editConfirmView.hidden, false);
  assert.equal(client.editSummaryTitle.textContent, '<img src=x onerror=alert(1)> 新名稱');
  assert.equal(client.editSummaryTitle.childNodes.length, 0);

  const firstSubmit = client.editConfirm.dispatch('click');
  const duplicateSubmit = client.editConfirm.dispatch('click');
  assert.equal(client.fetchCalls.filter(({ init }) => init?.method === 'PATCH').length, 1);
  assert.equal(client.editConfirm.disabled, true);
  patchPending.resolve({ ok: true, status: 200, json: async () => ({ updated: true, homework: {
    id: 'safe', title: '<img src=x onerror=alert(1)> 新名稱', description: '新簡介',
    url: '/homework/safe.html',
  } }) });
  await Promise.all([firstSubmit, duplicateSubmit]);
  await flushClient();
  assert.equal(client.editDialog.open, false);
  assert.equal(client.editAnnouncement.textContent, 'Homework 基本資料已更新。');
  assert.equal(client.fetchCalls.filter(({ url }) => url === 'api/homeworks').length, 2);
  assert.deepEqual([client.id.value, client.title.value, client.description.value, client.contentHtml.value],
    ['draft-in-progress', '尚未發佈表單', '保留我', '<p>保留我</p>']);
});

test('client preserves edit values on validation failure and keeps successful save distinct from refresh failure', async () => {
  const failed = await loadListClient({
    homeworkResponses: [{ ok: true, status: 200, json: async () => ({ homeworks: [{
      id: 'safe', title: '原名稱', description: '原簡介', status: 'published',
      publishedAt: null, url: '/homework/safe.html', editable: true,
    }], total: 1 }) }],
    patchResponses: [{ ok: false, status: 422, json: async () => ({ error: {
      code: 'validation_failed', message: '請修正表單內容。',
      fields: [{ field: 'title', code: 'too_long', message: '顯示名稱最多 120 個字元。' }],
    } }) }],
  });
  await descendants(failed.list).find((node) => node.textContent === '編輯基本資料').dispatch('click');
  failed.editTitle.value = '保留的名稱';
  failed.editDescription.value = '保留的簡介';
  await failed.editTitle.dispatch('input');
  await failed.editForm.dispatch('submit');
  await failed.editConfirm.dispatch('click');
  assert.equal(failed.editDialog.open, true);
  assert.equal(failed.editView.hidden, false);
  assert.deepEqual([failed.editTitle.value, failed.editDescription.value], ['保留的名稱', '保留的簡介']);
  assert.equal(failed.editTitleError.textContent, '顯示名稱最多 120 個字元。');

  const saved = await loadListClient({
    homeworkResponses: [
      { ok: true, status: 200, json: async () => ({ homeworks: [{
        id: 'safe', title: '原名稱', description: '原簡介', status: 'published',
        publishedAt: null, url: '/homework/safe.html', editable: true,
      }], total: 1 }) },
      { ok: false, status: 500, json: async () => ({ error: { code: 'invalid_manifest' } }) },
    ],
  });
  await descendants(saved.list).find((node) => node.textContent === '編輯基本資料').dispatch('click');
  saved.editTitle.value = '新名稱';
  await saved.editTitle.dispatch('input');
  await saved.editForm.dispatch('submit');
  await saved.editConfirm.dispatch('click');
  await flushClient();
  assert.equal(saved.editAnnouncement.textContent, 'Homework 基本資料已更新。');
});

test('client follows the existing expired-Session flow and explains an editability conflict', async () => {
  const listedHomework = { ok: true, status: 200, json: async () => ({ homeworks: [{
    id: 'safe', title: '原名稱', description: '原簡介', status: 'published',
    publishedAt: null, url: '/homework/safe.html', editable: true,
  }], total: 1 }) };
  const expired = await loadListClient({
    homeworkResponses: [listedHomework],
    patchResponses: [{ ok: false, status: 401, json: async () => ({ error: {
      code: 'not_authenticated', message: '請先登入。',
    } }) }],
  });
  await descendants(expired.list).find((node) => node.textContent === '編輯基本資料').dispatch('click');
  expired.editTitle.value = 'Session 過期仍保留';
  await expired.editTitle.dispatch('input');
  await expired.editForm.dispatch('submit');
  await expired.editConfirm.dispatch('click');
  assert.equal(expired.expired.hidden, false);
  assert.equal(expired.editDialog.open, false);

  const conflict = await loadListClient({
    homeworkResponses: [listedHomework],
    patchResponses: [{ ok: false, status: 409, json: async () => ({ error: {
      code: 'homework_not_editable', message: '此舊項目暫不支援網站編輯。',
    } }) }],
  });
  await descendants(conflict.list).find((node) => node.textContent === '編輯基本資料').dispatch('click');
  conflict.editTitle.value = '衝突時保留';
  conflict.editDescription.value = '保留簡介';
  await conflict.editTitle.dispatch('input');
  await conflict.editForm.dispatch('submit');
  await conflict.editConfirm.dispatch('click');
  assert.equal(conflict.editDialog.open, true);
  assert.equal(conflict.editView.hidden, false);
  assert.equal(conflict.editError.textContent, '此舊項目暫不支援網站編輯。');
  assert.deepEqual([conflict.editTitle.value, conflict.editDescription.value], ['衝突時保留', '保留簡介']);
});

test('client exposes empty, error, retry-lock and expired-Session states', async () => {
  const empty = await loadListClient();
  assert.equal(empty.stateMessage.textContent, '目前還沒有已發佈的 Homework。');
  assert.equal(empty.count.textContent, '（0）');

  const reload = deferred();
  const failed = await loadListClient({ homeworkResponses: [
    { ok: false, status: 500, json: async () => ({ error: { code: 'invalid_manifest' } }) },
    reload.promise,
  ] });
  assert.equal(failed.stateMessage.textContent, '無法載入 Homework，請稍後再試。');
  assert.equal(failed.retry.hidden, false);
  const first = failed.retry.dispatch('click');
  const second = failed.retry.dispatch('click');
  assert.equal(failed.retry.disabled, true);
  assert.equal(failed.fetchCalls.filter(({ url }) => url === 'api/homeworks').length, 2);
  reload.resolve({ ok: true, status: 200, json: async () => ({ homeworks: [], total: 0 }) });
  await Promise.all([first, second]);
  assert.equal(failed.retry.disabled, false);

  const expired = await loadListClient({ homeworkResponses: [
    { ok: false, status: 401, json: async () => ({ error: { code: 'not_authenticated' } }) },
  ] });
  assert.equal(expired.expired.hidden, false);
});

test('authenticated page contains the semantic list states after the existing form', async () => {
  const html = await readFile(new URL('../admin/index.html', import.meta.url), 'utf8');
  const workspaceIndex = html.indexOf('class="admin-workspace"');
  const panelIndex = html.indexOf('id="published-homework-panel"');
  assert.ok(workspaceIndex >= 0 && panelIndex > workspaceIndex);
  assert.match(html, /id="published-homework-title"[\s\S]*已發佈 Homework[\s\S]*id="published-homework-count"/);
  assert.match(html, /id="published-homework-state"[^>]+role="status"[^>]+aria-live="polite"/);
  assert.match(html, /id="published-homework-announcement"[^>]+role="status"[^>]+aria-live="polite"/);
  assert.match(html, /正在載入已發佈 Homework…/);
  assert.match(html, /id="published-homework-retry"[^>]+type="button"[^>]+hidden[^>]*>重新載入/);
});

test('authenticated page exposes the accessible two-step metadata edit dialog', async () => {
  const html = await readFile(new URL('../admin/index.html', import.meta.url), 'utf8');
  assert.match(html, /<dialog id="homework-edit-dialog"[^>]+aria-labelledby="homework-edit-dialog-title"/);
  assert.match(html, /id="homework-edit-id"[^>]+readonly/);
  assert.match(html, /id="homework-edit-title"[^>]+maxlength="120"/);
  assert.match(html, /id="homework-edit-description"[^>]+maxlength="500"/);
  assert.match(html, /id="homework-edit-description-count"[^>]+aria-live="polite"/);
  assert.match(html, /id="homework-edit-confirm-view"[^>]+hidden/);
  assert.match(html, /id="homework-edit-save"[^>]+>儲存變更<\/button>/);
  assert.match(html, /id="homework-edit-confirm"[^>]+>確認儲存<\/button>/);
  assert.match(html, /id="homework-edit-announcement"[^>]+role="status"[^>]+aria-live="polite"/);
});

test('project Homework manifest remains byte-identical after all list tests', async () => {
  const current = await readFile(PROJECT_HOMEWORK_PATH);
  assert.deepEqual(current, protectedManifestSnapshot);
  assert.equal(createHash('sha256').update(current).digest('hex'),
    createHash('sha256').update(protectedManifestSnapshot).digest('hex'));
});
