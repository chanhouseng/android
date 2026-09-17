import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { spawn } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

const TEST_SECRET = Buffer.alloc(32, 7).toString('base64url');

function baseEnv(overrides = {}) {
  return {
    ADMIN_HOST: '127.0.0.1',
    ADMIN_PORT: '8787',
    ADMIN_PATH: '/admin',
    ADMIN_PASSWORD_HASH: 'scrypt$v=1$test-hash',
    ADMIN_SESSION_SECRET: TEST_SECRET,
    ADMIN_COOKIE_SECURE: 'false',
    NODE_ENV: 'development',
    ...overrides,
  };
}

async function load(path) {
  return import(`../${path}`);
}

test('configuration rejects missing secrets, old Node, public hosts, and unsafe paths', async () => {
  const { loadAdminConfig } = await load('admin/server/config.mjs');
  assert.throws(() => loadAdminConfig(baseEnv({ ADMIN_PASSWORD_HASH: '' })), /ADMIN_PASSWORD_HASH/);
  assert.throws(() => loadAdminConfig(baseEnv({ ADMIN_SESSION_SECRET: '' })), /ADMIN_SESSION_SECRET/);
  assert.throws(() => loadAdminConfig(baseEnv(), { nodeVersion: '20.5.1' }), /20\.6\.0/);
  for (const host of ['0.0.0.0', '::', '192.168.1.10', 'localhost']) {
    assert.throws(() => loadAdminConfig(baseEnv({ ADMIN_HOST: host })), /ADMIN_HOST/);
  }
  for (const adminPath of ['/', 'admin', '/Admin', '/a/', '/a//b', '/a?x=1', '/a#x', '/%2e%2e/x', '/../x']) {
    assert.throws(() => loadAdminConfig(baseEnv({ ADMIN_PATH: adminPath })), /ADMIN_PATH/);
  }
});

test('configuration accepts loopback hosts, zero port, and canonical 32-byte secret', async () => {
  const { loadAdminConfig } = await load('admin/server/config.mjs');
  for (const host of ['127.0.0.1', '::1']) {
    const config = loadAdminConfig(baseEnv({ ADMIN_HOST: host, ADMIN_PORT: '0' }));
    assert.equal(config.host, host);
    assert.equal(config.port, 0);
    assert.equal(config.adminPath, '/admin');
    assert.equal(config.sessionSecret, TEST_SECRET);
    assert.equal(Buffer.from(config.sessionSecret, 'base64url').byteLength, 32);
  }
});

test('configuration applies documented defaults and enforces secure cookies in production', async () => {
  const { loadAdminConfig } = await load('admin/server/config.mjs');
  const config = loadAdminConfig(baseEnv({
    ADMIN_HOST: '',
    ADMIN_PORT: '',
    ADMIN_PATH: '',
    ADMIN_COOKIE_SECURE: '',
  }));
  assert.deepEqual(config, {
    host: '127.0.0.1',
    port: 8787,
    adminPath: '/homework-editor-private',
    passwordHash: 'scrypt$v=1$test-hash',
    sessionSecret: TEST_SECRET,
    cookieSecure: false,
    nodeEnv: 'development',
    sessionTtlMs: 28_800_000,
    bodyLimitBytes: 4_096,
  });
  assert.throws(() => loadAdminConfig(baseEnv({ NODE_ENV: 'production' })), /ADMIN_COOKIE_SECURE/);
  assert.equal(loadAdminConfig(baseEnv({ NODE_ENV: 'production', ADMIN_COOKIE_SECURE: 'true' })).cookieSecure, true);
});

test('configuration rejects malformed booleans, ports, paths, and non-canonical secrets', async () => {
  const { loadAdminConfig } = await load('admin/server/config.mjs');
  for (const value of ['TRUE', '1', 'yes', '']) {
    if (value !== '') assert.throws(() => loadAdminConfig(baseEnv({ ADMIN_COOKIE_SECURE: value })), /ADMIN_COOKIE_SECURE/);
  }
  for (const value of ['-1', '65536', '1.5', 'abc', ' 8787']) {
    assert.throws(() => loadAdminConfig(baseEnv({ ADMIN_PORT: value })), /ADMIN_PORT/);
  }
  for (const secret of ['short', `${TEST_SECRET}=`, `${'A'.repeat(42)}B`, 'A'.repeat(42)]) {
    assert.throws(() => loadAdminConfig(baseEnv({ ADMIN_SESSION_SECRET: secret })), /ADMIN_SESSION_SECRET/);
  }
});

test('scrypt hashes carry fixed parameters, random salts, and verify safely', async () => {
  const { createPasswordHash, verifyPassword } = await load('admin/server/password.mjs');
  const first = await createPasswordHash('correct horse battery staple');
  const second = await createPasswordHash('correct horse battery staple');
  assert.notEqual(first, second);
  assert.match(first, /^scrypt\$v=1\$N=131072\$r=8\$p=1\$keyLength=64\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
  assert.equal(await verifyPassword('correct horse battery staple', first), true);
  assert.equal(await verifyPassword('wrong password', first), false);
  assert.equal(await verifyPassword('anything', 'malformed'), false);
});

test('password verification rejects duplicate, unsupported, non-canonical, and wrong-sized hash fields', async () => {
  const { createPasswordHash, verifyPassword } = await load('admin/server/password.mjs');
  const password = 'correct horse battery staple';
  const hash = await createPasswordHash(password);
  const parts = hash.split('$');
  const wrongSaltLength = [...parts];
  wrongSaltLength[6] = Buffer.alloc(15, 1).toString('base64url');
  const wrongKeyLength = [...parts];
  wrongKeyLength[7] = Buffer.alloc(63, 1).toString('base64url');
  const nonCanonicalSalt = [...parts];
  nonCanonicalSalt[6] += '=';
  for (const malformed of [
    hash.replace('$N=131072$', '$N=131072$N=131072$'),
    hash.replace('$p=1$', '$p=1$memory=256$'),
    wrongSaltLength.join('$'),
    wrongKeyLength.join('$'),
    nonCanonicalSalt.join('$'),
  ]) {
    assert.equal(await verifyPassword(password, malformed), false);
  }
});

test('credential generation creates distinct canonical session secrets', async () => {
  const { generateAdminCredentials } = await load('scripts/create-admin-credentials.mjs');
  const first = await generateAdminCredentials('a strong password');
  const second = await generateAdminCredentials('a strong password');
  assert.match(first.passwordHash, /^scrypt\$v=1\$N=131072\$r=8\$p=1\$keyLength=64\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
  assert.match(first.sessionSecret, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(Buffer.from(first.sessionSecret, 'base64url').byteLength, 32);
  assert.notEqual(first.sessionSecret, second.sessionSecret);
});

test('hidden reader restores raw mode after success, rejection, and cancellation', async () => {
  const { readHiddenLine } = await load('scripts/create-admin-credentials.mjs');
  for (const outcome of ['success', 'error', 'cancel']) {
    const input = new EventEmitter();
    input.isTTY = true;
    input.isRaw = false;
    const rawModeCalls = [];
    input.setRawMode = (value) => {
      rawModeCalls.push(value);
      input.isRaw = value;
    };
    const output = { write() {} };
    const result = readHiddenLine({ input, output, prompt: 'Password: ' });
    if (outcome === 'success') {
      input.emit('data', Buffer.from('secret\r'));
      assert.equal(await result, 'secret');
    } else if (outcome === 'error') {
      input.emit('error', new Error('read failure'));
      await assert.rejects(result, /read failure/);
    } else {
      input.emit('data', Buffer.from('\x03'));
      await assert.rejects(result, /cancelled/i);
    }
    assert.deepEqual(rawModeCalls, [true, false]);
    assert.equal(input.listenerCount('data'), 0);
  }
});

test('hidden reader restores enabled raw mode when it was already enabled', async () => {
  const { readHiddenLine } = await load('scripts/create-admin-credentials.mjs');
  const input = new EventEmitter();
  input.isTTY = true;
  input.isRaw = true;
  const rawModeCalls = [];
  input.setRawMode = (value) => {
    rawModeCalls.push(value);
    input.isRaw = value;
  };
  const read = readHiddenLine({ input, output: { write() {} }, prompt: 'Password: ' });
  input.emit('data', Buffer.from('secret\r'));
  assert.equal(await read, 'secret');
  assert.deepEqual(rawModeCalls, [true, true]);
  assert.equal(input.isRaw, true);
});

for (const initialFlow of [null, false, true]) {
  for (const outcome of ['success', 'error', 'cancel']) {
    test(`hidden reader releases a real Readable after ${outcome}, initial flow ${initialFlow}`, async () => {
      const { readHiddenLine } = await load('scripts/create-admin-credentials.mjs');
      const input = new Readable({ read() {} });
      input.isTTY = true;
      input.isRaw = false;
      input.setRawMode = (value) => { input.isRaw = value; };
      if (initialFlow === false) input.pause();
      if (initialFlow === true) input.resume();
      const read = readHiddenLine({ input, output: { write() {} }, prompt: 'Password: ' });
      // Attach a rejection handler immediately, including when an assertion fails.
      const settled = read.catch(() => {});
      try {
        await new Promise((resolve) => setImmediate(resolve));
        assert.equal(input.readableFlowing, true, 'reader must resume even previously paused input');
        if (outcome === 'error') input.emit('error', new Error('read failure'));
        else input.push(Buffer.from(outcome === 'cancel' ? '\x03' : 'fixture\r'));
        if (outcome === 'success') assert.equal(await read, 'fixture');
        else await assert.rejects(read, outcome === 'error' ? /read failure/ : /cancelled/i);
        assert.equal(input.isRaw, false);
        assert.equal(input.listenerCount('data'), 0);
        assert.equal(input.listenerCount('error'), 0);
        assert.equal(input.readableFlowing, initialFlow === true,
          'reader must stop input it started, and preserve existing flowing input');
      } finally {
        input.emit('data', Buffer.from('\x03'));
        await settled;
        input.destroy();
      }
    });
  }
}

test('hidden reader can read confirmation from the same real Readable after pausing it', async () => {
  const { readHiddenLine } = await load('scripts/create-admin-credentials.mjs');
  const input = new Readable({ read() {} });
  input.isTTY = true;
  input.isRaw = false;
  input.setRawMode = (value) => { input.isRaw = value; };
  try {
    for (let count = 0; count < 2; count += 1) {
      const read = readHiddenLine({ input, output: { write() {} }, prompt: 'Password: ' });
      input.push(Buffer.from('fixture\r'));
      assert.equal(await read, 'fixture');
      assert.equal(input.readableFlowing, false);
    }
  } finally {
    input.destroy();
  }
});

test('hidden reader preserves UTF-8 passwords for a hash verification round trip', async () => {
  const { createPasswordHash, verifyPassword } = await load('admin/server/password.mjs');
  const { readHiddenLine } = await load('scripts/create-admin-credentials.mjs');
  const input = new EventEmitter();
  input.isTTY = true;
  input.isRaw = false;
  input.setRawMode = (value) => { input.isRaw = value; };
  const password = '密碼päss';
  const encoded = Buffer.from(password);
  const read = readHiddenLine({ input, output: { write() {} }, prompt: 'Password: ' });
  input.emit('data', Buffer.from('é'));
  input.emit('data', Buffer.from('\x7f'));
  input.emit('data', encoded.subarray(0, 2));
  input.emit('data', encoded.subarray(2));
  input.emit('data', Buffer.from('\r'));
  const hash = await createPasswordHash(await read);
  assert.equal(await verifyPassword(password, hash), true);
});

test('credential command rejects arguments and never echoes supplied values', async () => {
  const suppliedValue = 'do-not-echo-this-credential';
  const child = spawn(process.execPath, ['scripts/create-admin-credentials.mjs', suppliedValue], {
    cwd: new URL('..', import.meta.url),
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
  child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
  const [exitCode] = await onceChildExit(child);
  assert.notEqual(exitCode, 0);
  assert.doesNotMatch(`${stdout}${stderr}`, new RegExp(suppliedValue));
});

test('sessions store only token hashes, expire at a fixed time, and disappear with a new store', async () => {
  const { SessionStore } = await load('admin/server/session-store.mjs');
  let now = 1_000;
  const storage = new Map();
  const firstStore = new SessionStore({
    secret: TEST_SECRET,
    ttlMs: 500,
    now: () => now,
    storage,
    cleanupIntervalMs: 0,
  });
  const issued = firstStore.create();
  assert.equal(storage.has(issued.token), false);
  assert.equal(Buffer.from(issued.token, 'base64url').byteLength, 32);
  assert.equal(Buffer.from(issued.csrfToken, 'base64url').byteLength, 32);
  assert.equal(firstStore.get(issued.token).expiresAt, 1_500);
  now = 1_501;
  assert.equal(firstStore.get(issued.token), null);
  const secondStore = new SessionStore({ secret: TEST_SECRET, ttlMs: 500, now: () => now, cleanupIntervalMs: 0 });
  assert.equal(secondStore.get(issued.token), null);
  firstStore.close();
  secondStore.close();
});

test('sessions support destroy, cleanup, fixed expiry, and safe CSRF equality', async () => {
  const { SessionStore, safeTokenEqual } = await load('admin/server/session-store.mjs');
  let now = 10_000;
  const store = new SessionStore({ secret: TEST_SECRET, ttlMs: 100, now: () => now, cleanupIntervalMs: 0 });
  const first = store.create();
  assert.equal(store.get(first.token).expiresAt, 10_100);
  now = 10_050;
  assert.equal(store.get(first.token).expiresAt, 10_100);
  assert.equal(store.destroy(first.token), true);
  assert.equal(store.destroy(first.token), false);
  const second = store.create();
  now = 10_200;
  store.cleanup();
  assert.equal(store.get(second.token), null);
  assert.equal(safeTokenEqual(second.csrfToken, second.csrfToken), true);
  assert.equal(safeTokenEqual(second.csrfToken, `${second.csrfToken}x`), false);
  store.close();
});

test('session records retain fixed creation and expiry timestamps across reads', async () => {
  const { SessionStore } = await load('admin/server/session-store.mjs');
  let now = 1_000;
  const storage = new Map();
  const store = SessionStore({ secret: TEST_SECRET, ttlMs: 100, now: () => now, storage, cleanupIntervalMs: 0 });
  const issued = store.create();
  assert.equal([...storage.values()][0].createdAt, 1_000);
  assert.equal(issued.createdAt, 1_000);
  now = 1_050;
  assert.equal(store.get(issued.token).createdAt, 1_000);
  assert.equal(store.get(issued.token).expiresAt, 1_100);
});

for (const operation of ['create', 'get', 'destroy', 'get-invalid', 'destroy-invalid']) {
  test(`session ${operation} clears other expired records on access`, async () => {
    const { SessionStore } = await load('admin/server/session-store.mjs');
    let now = 1_000;
    const storage = new Map();
    const store = SessionStore({ secret: TEST_SECRET, ttlMs: 100, now: () => now, storage, cleanupIntervalMs: 0 });
    store.create();
    now = 1_050;
    const active = store.create();
    now = 1_100;
    if (operation === 'create') store.create();
    else if (operation.endsWith('-invalid')) store[operation.split('-')[0]](undefined);
    else store[operation](active.token);
    assert.equal(storage.size, operation === 'create' ? 2 : operation === 'destroy' ? 0 : 1);
    for (const record of storage.values()) assert.ok(record.expiresAt > now);
  });
}

test('the sixth attempt is limited until the 15-minute window expires', async () => {
  const { LoginRateLimiter } = await load('admin/server/login-rate-limit.mjs');
  let now = 0;
  const limiter = new LoginRateLimiter({ windowMs: 900_000, maxFailures: 5, now: () => now });
  for (let count = 0; count < 5; count += 1) limiter.recordFailure('127.0.0.1');
  assert.deepEqual(limiter.check('127.0.0.1'), { limited: true, retryAfterSeconds: 900 });
  now = 900_001;
  assert.deepEqual(limiter.check('127.0.0.1'), { limited: false, retryAfterSeconds: 0 });
});

test('rate limiter clear removes failures after successful login', async () => {
  const { LoginRateLimiter } = await load('admin/server/login-rate-limit.mjs');
  const limiter = new LoginRateLimiter({ windowMs: 60_000, maxFailures: 2, now: () => 1_000 });
  limiter.recordFailure('127.0.0.1');
  limiter.recordFailure('127.0.0.1');
  limiter.clear('127.0.0.1');
  assert.deepEqual(limiter.check('127.0.0.1'), { limited: false, retryAfterSeconds: 0 });
  assert.equal(Object.hasOwn(limiter, 'X-Forwarded-For'), false);
});

function onceChildExit(child) {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve([code, signal]));
  });
}

const HTTP_PASSWORD = 'http-only-test-password';
const HTTP_PATH = '/homework-editor-private';
const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));
const SECURITY_HEADERS = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-src blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};
let httpPasswordHash;

async function httpHarness(t, options = {}) {
  const { createAdminServer } = await load('admin/server/server.mjs');
  const { createPasswordHash } = await load('admin/server/password.mjs');
  const { loadAdminConfig } = await load('admin/server/config.mjs');
  httpPasswordHash ??= createPasswordHash(HTTP_PASSWORD);
  const config = loadAdminConfig(baseEnv({ ADMIN_PORT: '0', ADMIN_PATH: HTTP_PATH,
    ADMIN_PASSWORD_HASH: await httpPasswordHash, ...options.env }));
  const rootDirectory = options.rootDirectory ?? await mkdtemp(join(tmpdir(), 'admin-http-test-'));
  if (!options.rootDirectory) {
    t.after(() => rm(rootDirectory, { recursive: true, force: true }));
    await mkdir(join(rootDirectory, 'admin'));
    await mkdir(join(rootDirectory, 'assets', 'css'), { recursive: true });
    await writeFile(join(rootDirectory, 'admin', 'login.html'), '<!doctype html><title>Test login</title>Login fixture');
    await writeFile(join(rootDirectory, 'admin', 'index.html'), '<!doctype html><title>Test admin</title>Homework placeholder fixture');
    for (const name of ['admin.css', 'login.js', 'admin.js']) await writeFile(join(rootDirectory, 'admin', name), `/* ${name} */`);
    for (const name of ['foundation', 'tokens', 'base', 'utilities', 'components', 'app-shell', 'accordion', 'detail-page']) {
      await writeFile(join(rootDirectory, 'assets', 'css', `${name}.css`), `/* ${name} */`);
    }
  }
  const app = createAdminServer({ ...options, config, rootDirectory });
  t.after(() => app.close());
  await new Promise((resolve, reject) => {
    app.server.once('error', reject);
    app.server.listen(0, config.host, resolve);
  });
  const origin = `http://127.0.0.1:${app.server.address().port}`;
  const trustedOrigin = `${config.cookieSecure ? 'https' : 'http'}://127.0.0.1:${app.server.address().port}`;
  async function send(path = '/', init = {}) {
    const response = await fetch(`${origin}${HTTP_PATH}${path}`, init);
    const text = await response.text();
    return { status: response.status, headers: response.headers, text, json: () => JSON.parse(text) };
  }
  const post = (path, body, headers = {}) => send(path, { method: 'POST',
    headers: { Origin: trustedOrigin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  return { ...app, config, origin, trustedOrigin, send, post };
}

function assertSecurity(result) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) assert.equal(result.headers.get(name), value, name);
  assert.equal(result.headers.has('access-control-allow-origin'), false);
}

function assertError(result, status, code) {
  assert.equal(result.status, status);
  assert.equal(result.headers.get('content-type'), 'application/json; charset=utf-8');
  const body = result.json();
  assert.deepEqual(Object.keys(body), ['error']);
  assert.deepEqual(Object.keys(body.error).sort(), ['code', 'message']);
  assert.equal(body.error.code, code);
  assert.equal(typeof body.error.message, 'string');
  assert.ok(body.error.message.length > 0);
  assertSecurity(result);
}

async function login(app) {
  const result = await app.post('/api/login', { password: HTTP_PASSWORD });
  assert.equal(result.status, 200);
  assert.deepEqual(result.json(), { authenticated: true });
  const cookie = result.headers.get('set-cookie').split(';')[0];
  return { result, cookie, token: cookie.slice('admin_session='.length) };
}

function rawRequest(app, path, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const request = httpRequest(app.origin, { path, method, headers }, (response) => {
      let text = '';
      response.setEncoding('utf8').on('data', (chunk) => { text += chunk; });
      response.on('end', () => resolve({ status: response.statusCode,
        headers: new Headers(response.headers), text, json: () => JSON.parse(text) }));
    });
    request.once('error', reject);
    request.end(body);
  });
}

async function loadAdminClient({ logoutResponse = { ok: true } } = {}) {
  const rawSource = await readFile(join(PROJECT_ROOT, 'admin', 'admin.js'), 'utf8');
  const source = rawSource.replace(/^import[^;]+;\s*/m, '');
  const listeners = new Map();
  const logoutButton = {
    disabled: false,
    addEventListener(type, listener) { listeners.set(type, listener); },
    async activate() {
      if (!this.disabled) await listeners.get('click')();
    },
  };
  const errorMessage = { hidden: true, textContent: '' };
  const fetchCalls = [];
  const redirects = [];
  let resolveSession;
  const sessionResponse = new Promise((resolve) => { resolveSession = resolve; });
  const document = {
    querySelector(selector) {
      if (selector === '#logout-button') return logoutButton;
      if (selector === '#logout-error') return errorMessage;
      return null;
    },
  };
  const fetch = (url, init) => {
    fetchCalls.push({ url, init });
    if (url === 'api/session') return sessionResponse;
    if (url === 'api/logout') return Promise.resolve(logoutResponse);
    throw new Error(`Unexpected request: ${url}`);
  };
  const window = { location: { assign: (path) => redirects.push(path) }, addEventListener() {} };
  runInNewContext(source, { document, fetch, window,
    URL: { revokeObjectURL() {} }, HOMEWORK_ID_PATTERN: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    validateHomeworkPreviewInput() { return { ok: false, errors: [] }; } });
  return {
    errorMessage,
    fetchCalls,
    logoutButton,
    redirects,
    async resolveAuthenticatedSession() {
      resolveSession({ ok: true, json: async () => ({ authenticated: true, csrfToken: 'csrf-test-token' }) });
      await new Promise((resolve) => setImmediate(resolve));
    },
  };
}

test('HTTP entry gates the admin HTML on a valid session and attaches security headers', async (t) => {
  const app = await httpHarness(t);
  const guest = await app.send();
  assert.equal(guest.status, 200);
  assert.equal(guest.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.match(guest.text, /Login fixture/);
  assert.doesNotMatch(guest.text, /Homework placeholder/);
  const { cookie } = await login(app);
  const member = await app.send('/', { headers: { Cookie: cookie } });
  assert.match(member.text, /Homework placeholder fixture/);
  assert.doesNotMatch(member.text, /Login fixture/);
  assertSecurity(guest);
  assertSecurity(member);
});

for (const value of ['', undefined]) {
  test(`HTTP ${value === '' ? 'blank' : 'missing'} ADMIN_PATH serves the private default and rejects /admin/`, async (t) => {
    const app = await httpHarness(t, { env: { ADMIN_PATH: value } });
    assert.equal((await rawRequest(app, '/admin/')).status, 404);
    assert.equal((await rawRequest(app, '/homework-editor-private/')).status, 200);
  });
}

test('HTTP login form without JavaScript sends credentials in a POST body to a safe relative action', async (t) => {
  const app = await httpHarness(t, { rootDirectory: PROJECT_ROOT });
  const page = await app.send();
  const form = page.text.match(/<form\b[^>]*\bid=["']login-form["'][^>]*>/i)?.[0];
  assert.ok(form);
  const method = form.match(/\bmethod=["']([^"']+)["']/i)?.[1] ?? 'get';
  const action = form.match(/\baction=["']([^"']+)["']/i)?.[1];
  assert.equal(method.toLowerCase(), 'post', 'native form submission must never default to GET');
  assert.equal(action, './api/login');
  const target = new URL(action, `${app.origin}${HTTP_PATH}/`);
  assert.equal(target.origin, app.origin);
  assert.equal(target.search, '');
  const requests = [];
  app.server.on('request', (request) => requests.push({ method: request.method, url: request.url }));
  const response = await rawRequest(app, target.pathname, { method: method.toUpperCase(),
    headers: { Origin: app.origin, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ password: 'native-form-test-only' }).toString() });
  assert.deepEqual(requests, [{ method: 'POST', url: '/homework-editor-private/api/login' }]);
  assertError(response, 415, 'unsupported_media_type');
  assert.equal(response.headers.get('set-cookie'), null);
  assert.doesNotMatch(response.text, /native-form-test-only/);
});

test('HTTP allowlist rejects direct HTML, siblings, normalization, malformed encoding and query variants', async (t) => {
  const app = await httpHarness(t);
  for (const path of ['/admin/', `${HTTP_PATH}/index.html`, `${HTTP_PATH}/login.html`, `${HTTP_PATH}-sibling/`,
    HTTP_PATH, `${HTTP_PATH}/%2e%2e/`, `${HTTP_PATH}/a/../`, `${HTTP_PATH}/%2F`, `${HTTP_PATH}/%5c`,
    `${HTTP_PATH}/%ZZ`, `${HTTP_PATH}/%C0%AF`, `${HTTP_PATH}/?x=1`, `${HTTP_PATH}/?`,
    `${HTTP_PATH}/#x`, `${HTTP_PATH}/api/session?x=1`, `${HTTP_PATH}//api/session`,
    `${HTTP_PATH}/server/config.mjs`, '/.env']) {
    const result = await rawRequest(app, path);
    assert.equal(result.status, 404, path);
    assertSecurity(result);
  }
});

test('HTTP static routes expose only the fixed CSS and JS assets', async (t) => {
  const app = await httpHarness(t);
  for (const path of ['/admin.css', '/login.js', '/admin.js', '/assets/foundation.css',
    '/assets/tokens.css', '/assets/base.css', '/assets/utilities.css', '/assets/components.css',
    '/assets/app-shell.css', '/assets/accordion.css', '/assets/detail-page.css']) {
    const result = await app.send(path);
    assert.equal(result.status, 200, path);
    assert.match(result.headers.get('content-type'), path.endsWith('.css') ? /text\/css/ : /javascript/);
    assertSecurity(result);
  }
  assert.equal((await app.send('/assets/homework.css')).status, 404);
});

test('HTTP admin pages serve the accessible login and authenticated Homework editor', async (t) => {
  const app = await httpHarness(t, { rootDirectory: PROJECT_ROOT });
  const guest = await app.send();
  assert.equal(guest.status, 200);
  assert.match(guest.text, /<html[^>]+lang=["']zh-Hant["']/i);
  assert.match(guest.text, /<title>\s*作業管理登入\s*<\/title>/i);
  assert.match(guest.text, /<label[^>]*for=["']password["'][^>]*>\s*管理密碼\s*<\/label>/i);
  assert.match(guest.text, /<input[^>]+id=["']password["'][^>]+type=["']password["'][^>]+autocomplete=["']current-password["']/i);
  assert.match(guest.text, /<button[^>]+type=["']submit["'][^>]+data-loading-label=["']登入中…["'][^>]*>/i);
  assert.match(guest.text, /aria-live=["']polite["']/i);
  assert.match(guest.text, /<link[^>]+href=["']\.\/admin\.css["']/i);
  assert.match(guest.text, /<script[^>]+src=["']\.\/login\.js["'][^>]*><\/script>/i);
  assert.doesNotMatch(guest.text, /<script(?![^>]+\bsrc=)/i);

  const { cookie } = await login(app);
  const member = await app.send('/', { headers: { Cookie: cookie } });
  assert.equal(member.status, 200);
  assert.match(member.text, /<title>\s*新增 Homework｜作業管理\s*<\/title>/i);
  assert.match(member.text, /<h1[^>]+id=["']admin-title["'][^>]*>\s*新增 Homework\s*<\/h1>/i);
  assert.match(member.text, /<form[^>]+id=["']homework-form["']/i);
  assert.match(member.text, /<iframe[^>]+id=["']preview-frame["'][^>]+sandbox/i);
  assert.match(member.text, /<button[^>]+id=["']logout-button["'][^>]+disabled[^>]*>\s*登出\s*<\/button>/i);
  assert.match(member.text, /id=["']logout-error["'][^>]+aria-live=["']polite["']/i);
  assert.match(member.text, /<link[^>]+href=["']\.\/admin\.css["']/i);
  assert.match(member.text, /<script[^>]+src=["']\.\/admin\.js["'][^>]*><\/script>/i);
  assert.match(member.text, /<input[^>]+id=["']homework-cover-image["'][^>]+type=["']file["'][^>]+required/i);
  assert.match(member.text, /<input[^>]+id=["']homework-content-images["'][^>]+type=["']file["'][^>]+multiple/i);
  assert.doesNotMatch(member.text, /contenteditable|儲存草稿|name=["']trainingFolder["']/i);
  assert.doesNotMatch(member.text, /<script(?![^>]+\bsrc=)/i);
});

test('HTTP admin static assets use the foundation dependency set without arbitrary file routes', async (t) => {
  const app = await httpHarness(t, { rootDirectory: PROJECT_ROOT });
  const adminCss = await app.send('/admin.css');
  assert.equal(adminCss.status, 200);
  assert.match(adminCss.headers.get('content-type'), /text\/css/);
  assert.match(adminCss.text, /@import\s+(?:url\()?['"]\.\/assets\/foundation\.css['"]\)?/i);
  for (const name of ['foundation', 'tokens', 'base', 'utilities', 'components', 'app-shell', 'accordion', 'detail-page']) {
    const result = await app.send(`/assets/${name}.css`);
    assert.equal(result.status, 200, name);
    assert.match(result.headers.get('content-type'), /text\/css/, name);
  }
  assert.equal((await app.send('/assets/other.css')).status, 404);
  assert.equal((await app.send('/assets/foundation.css/extra')).status, 404);
});

test('HTTP admin scripts use only relative authentication APIs and keep credentials out of client storage', async (t) => {
  const app = await httpHarness(t, { rootDirectory: PROJECT_ROOT });
  const loginScript = await app.send('/login.js');
  const adminScript = await app.send('/admin.js');
  assert.equal(loginScript.status, 200);
  assert.equal(adminScript.status, 200);
  assert.match(loginScript.text, /fetch\(\s*['"]api\/login['"]/);
  assert.match(adminScript.text, /fetch\(\s*['"]api\/session['"]/);
  assert.match(adminScript.text, /fetch\(\s*['"]api\/logout['"]/);
  for (const source of [loginScript.text, adminScript.text]) {
    assert.doesNotMatch(source, /(?:local|session)Storage|https?:\/\/|tracking|analytics|\/homework-editor-private/i);
  }
  assert.doesNotMatch(loginScript.text, /password\s*(?:=|:)\s*['"][^'"]+['"]/i);
});

test('admin client keeps logout unavailable until an authenticated session supplies CSRF', async () => {
  const client = await loadAdminClient();
  assert.equal(client.logoutButton.disabled, true);
  await client.logoutButton.activate();
  assert.deepEqual(client.fetchCalls.map(({ url }) => url), ['api/session']);
  await client.resolveAuthenticatedSession();
  assert.equal(client.logoutButton.disabled, false);
});

test('admin client reports a failed logout without redirecting away from the authenticated page', async () => {
  for (const status of [403, 500]) {
    const client = await loadAdminClient({ logoutResponse: { ok: false, status } });
    await client.resolveAuthenticatedSession();
    await client.logoutButton.activate();
    assert.deepEqual(client.redirects, []);
    assert.equal(client.logoutButton.disabled, false);
    assert.equal(client.errorMessage.hidden, false);
    assert.match(client.errorMessage.textContent, /登出/);
  }
});

test('admin client returns to the entry when logout finds an expired or already ended session', async () => {
  const client = await loadAdminClient({ logoutResponse: { ok: false, status: 401 } });
  await client.resolveAuthenticatedSession();
  await client.logoutButton.activate();
  assert.deepEqual(client.redirects, ['./']);
  assert.equal(client.errorMessage.hidden, true);
});

test('admin client returns to the entry only after a successful CSRF-protected logout', async () => {
  const client = await loadAdminClient();
  await client.resolveAuthenticatedSession();
  await client.logoutButton.activate();
  assert.deepEqual(client.redirects, ['./']);
  const [sessionCall, logoutCall] = client.fetchCalls;
  assert.equal(sessionCall.url, 'api/session');
  assert.equal(sessionCall.init, undefined);
  assert.equal(logoutCall.url, 'api/logout');
  assert.deepEqual({ ...logoutCall.init, headers: { ...logoutCall.init.headers } }, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'csrf-test-token' },
    body: '{}',
  });
});

test('HTTP known routes reject wrong methods before attempting to parse a body', async (t) => {
  const app = await httpHarness(t);
  for (const [path, method, allow] of [['/', 'POST', 'GET'], ['/api/login', 'GET', 'POST'],
    ['/api/session', 'POST', 'GET'], ['/api/logout', 'GET', 'POST'], ['/admin.css', 'POST', 'GET']]) {
    const result = await app.send(path, { method });
    assertError(result, 405, 'method_not_allowed');
    assert.equal(result.headers.get('allow'), allow);
  }
});

test('HTTP login requires JSON media type and validates the JSON/password shape', async (t) => {
  const app = await httpHarness(t);
  for (const type of [undefined, 'text/plain', 'application/jsonish']) {
    const headers = { Origin: app.origin };
    if (type) headers['Content-Type'] = type;
    const result = await rawRequest(app, `${HTTP_PATH}/api/login`, { method: 'POST', headers, body: '{}' });
    assertError(result, 415, 'unsupported_media_type');
  }
  for (const body of ['', '{', 'null', '[]', '{}', '{"password":""}', '{"password":4}']) {
    assertError(await app.send('/api/login', { method: 'POST',
      headers: { Origin: app.origin, 'Content-Type': 'application/json' }, body }), 400, 'invalid_request');
  }
  assertError(await app.post('/api/login', { password: 'wrong' }, {
    'Content-Type': 'Application/JSON; Charset=UTF-8' }), 401, 'login_failed');
});

test('HTTP login enforces the 4096-byte limit, including streamed requests', async (t) => {
  const app = await httpHarness(t);
  for (const length of [4096, 4097]) {
    const body = JSON.stringify({ password: 'x'.repeat(length - 15) });
    assert.equal(Buffer.byteLength(body), length);
    const result = await rawRequest(app, `${HTTP_PATH}/api/login`, { method: 'POST',
      headers: { Origin: app.origin, 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked' }, body });
    assertError(result, length === 4096 ? 401 : 413, length === 4096 ? 'login_failed' : 'payload_too_large');
  }
});

test('HTTP both POST routes reject missing/cross origins and never trust the Host header', async (t) => {
  const app = await httpHarness(t);
  for (const path of ['/api/login', '/api/logout']) {
    for (const origin of [undefined, 'http://attacker.invalid', `${app.origin}/`]) {
      const headers = { 'Content-Type': 'application/json', Host: 'attacker.invalid' };
      if (origin) headers.Origin = origin;
      assertError(await rawRequest(app, `${HTTP_PATH}${path}`, { method: 'POST', headers, body: '{}' }), 403, 'invalid_origin');
    }
  }
  const result = await rawRequest(app, `${HTTP_PATH}/api/login`, { method: 'POST',
    headers: { Origin: app.origin, Host: 'attacker.invalid', 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: HTTP_PASSWORD }) });
  assert.equal(result.status, 200);
});

test('HTTP cookies carry exact path, fixed expiry, HttpOnly, Strict and optional Secure', async (t) => {
  for (const secure of [false, true]) {
    const app = await httpHarness(t, { env: { ADMIN_COOKIE_SECURE: String(secure) } });
    const { result } = await login(app);
    const cookie = result.headers.get('set-cookie');
    assert.match(cookie, /^admin_session=[A-Za-z0-9_-]{43};/);
    for (const flag of [`Path=${HTTP_PATH}`, 'Max-Age=28800', 'HttpOnly', 'SameSite=Strict']) assert.ok(cookie.split('; ').includes(flag));
    assert.equal(cookie.split('; ').includes('Secure'), secure);
    assertSecurity(result);
  }
});

test('HTTP default IP ignores changing X-Forwarded-For; sixth attempt is limited until clock expiry', async (t) => {
  let now = 1000;
  const app = await httpHarness(t, { now: () => now });
  for (let count = 0; count < 5; count += 1) {
    assertError(await app.post('/api/login', { password: 'wrong' }, { 'X-Forwarded-For': `192.0.2.${count}` }), 401, 'login_failed');
  }
  assert.equal(app.rateLimiter.check('127.0.0.1').limited, true);
  const blocked = await app.post('/api/login', { password: HTTP_PASSWORD }, { 'X-Forwarded-For': '192.0.2.99' });
  assertError(blocked, 429, 'rate_limited');
  assert.match(blocked.headers.get('retry-after'), /^\d+$/);
  assert.equal(blocked.headers.get('set-cookie'), null);
  now += 900001;
  assertError(await app.post('/api/login', { password: 'wrong' }), 401, 'login_failed');
});

test('HTTP injected client IP isolates failures and a successful login clears its failures', async (t) => {
  const app = await httpHarness(t, { getClientIp: () => 'test-client' });
  assertError(await app.post('/api/login', { password: 'wrong' }), 401, 'login_failed');
  for (let count = 0; count < 3; count += 1) app.rateLimiter.recordFailure('test-client');
  await login(app);
  for (let count = 0; count < 5; count += 1) assertError(await app.post('/api/login', { password: 'wrong' }), 401, 'login_failed');
  assert.equal(app.rateLimiter.check('test-client').limited, true);
  assert.equal(app.rateLimiter.check('127.0.0.1').limited, false);
});

test('HTTP session emits only authentication and CSRF, has fixed expiry and expires invalid cookies', async (t) => {
  let now = 1000;
  const app = await httpHarness(t, { now: () => now });
  const guest = await app.send('/api/session');
  assert.deepEqual(guest.json(), { authenticated: false });
  const { cookie, token } = await login(app);
  const expiry = app.sessions.get(token).expiresAt;
  now += 1000;
  const member = await app.send('/api/session', { headers: { Cookie: `unrelated=abc; ${cookie}` } });
  assert.deepEqual(member.json(), { authenticated: true, csrfToken: app.sessions.get(token).csrfToken });
  assert.equal(app.sessions.get(token).expiresAt, expiry);
  assert.equal(member.headers.get('set-cookie'), null);
  now = expiry;
  const expired = await app.send('/api/session', { headers: { Cookie: cookie } });
  assert.deepEqual(expired.json(), { authenticated: false });
  assert.match(expired.headers.get('set-cookie'), /Max-Age=0/);
  assertSecurity(guest);
  assertSecurity(member);
});

test('HTTP logout requires a session, JSON media type and valid CSRF before destroying the session', async (t) => {
  const app = await httpHarness(t);
  assertError(await app.post('/api/logout', {}), 401, 'not_authenticated');
  const { cookie, token } = await login(app);
  const csrfToken = app.sessions.get(token).csrfToken;
  for (const csrf of ['', 'wrong', `${csrfToken}x`]) {
    assertError(await app.post('/api/logout', {}, { Cookie: cookie, 'X-CSRF-Token': csrf }), 403, 'invalid_csrf');
    assert.ok(app.sessions.get(token));
  }
  assertError(await app.post('/api/logout', {}, { Cookie: cookie, 'X-CSRF-Token': csrfToken,
    'Content-Type': 'text/plain' }), 415, 'unsupported_media_type');
  const result = await app.post('/api/logout', {}, { Cookie: cookie, 'X-CSRF-Token': csrfToken });
  assert.equal(result.status, 200);
  assert.deepEqual(result.json(), { authenticated: false });
  assert.equal(app.sessions.get(token), null);
  assert.match(result.headers.get('set-cookie'), new RegExp(`Path=${HTTP_PATH};`));
  assert.match(result.headers.get('set-cookie'), /Max-Age=0/);
  assert.match(result.headers.get('set-cookie'), /HttpOnly/);
  assert.match(result.headers.get('set-cookie'), /SameSite=Strict/);
  assertSecurity(result);
});

test('HTTP a fresh server rejects cookies created by another store', async (t) => {
  const first = await httpHarness(t);
  const { cookie } = await login(first);
  await first.close();
  const second = await httpHarness(t);
  const result = await second.send('/api/session', { headers: { Cookie: cookie } });
  assert.deepEqual(result.json(), { authenticated: false });
  assert.match(result.headers.get('set-cookie'), /Max-Age=0/);
});

test('HTTP response bodies and non-cookie headers never expose credentials or complete session tokens', async (t) => {
  const app = await httpHarness(t);
  const { result, cookie, token } = await login(app);
  const responses = [result, await app.send(), await app.send('/api/session', { headers: { Cookie: cookie } }),
    await app.post('/api/login', { password: 'wrong' }), await app.send('/server/password.mjs')];
  // Set-Cookie is the one intentional token delivery channel; it must never appear in any other header or body.
  const output = responses.map((response) => response.text + [...response.headers]
    .filter(([name]) => name !== 'set-cookie').map(([name, value]) => `${name}: ${value}`).join('\n')).join('\n');
  for (const secret of [app.config.passwordHash, TEST_SECRET, HTTP_PASSWORD, token]) assert.equal(output.includes(secret), false);
  const allHeaders = responses.map((response) => [...response.headers].flat().join('\n')).join('\n');
  for (const secret of [app.config.passwordHash, TEST_SECRET, HTTP_PASSWORD]) assert.equal(allHeaders.includes(secret), false);
});

test('HTTP unexpected failures return a general error without exposing exception details', async (t) => {
  const app = await httpHarness(t, { getClientIp() { throw new Error('private-error-detail'); } });
  const result = await app.post('/api/login', { password: HTTP_PASSWORD });
  assertError(result, 500, 'internal_error');
  assert.doesNotMatch(result.text, /private-error-detail/);
});

test('HTTP close releases its listening port and can be awaited repeatedly', async (t) => {
  const app = await httpHarness(t);
  await app.close();
  await app.close();
  assert.equal(app.server.listening, false);
});

test('security header helper supplies the complete required policy', async () => {
  const { applySecurityHeaders } = await load('admin/server/security-headers.mjs');
  const headers = new Headers();
  applySecurityHeaders({ setHeader: (name, value) => headers.set(name, value) });
  assertSecurity({ headers });
});

test('HTTP start helper binds the configured ephemeral port and closes cleanly', async (t) => {
  const { startAdminServer } = await load('admin/server/server.mjs');
  const app = await startAdminServer({ env: baseEnv({ ADMIN_PORT: '0', ADMIN_PATH: HTTP_PATH }) });
  t.after(() => app.close());
  assert.equal(app.origin, `http://127.0.0.1:${app.server.address().port}`);
  const response = await fetch(`${app.origin}${HTTP_PATH}/api/session`);
  assert.deepEqual(await response.json(), { authenticated: false });
  await app.close();
  assert.equal(app.server.listening, false);
});

test('HTTP concurrent attempts cannot bypass the fifth failure boundary', async (t) => {
  const app = await httpHarness(t, { getClientIp: () => 'parallel-client' });
  for (let count = 0; count < 4; count += 1) app.rateLimiter.recordFailure('parallel-client');
  const results = await Promise.all([
    app.post('/api/login', { password: 'wrong-one' }),
    app.post('/api/login', { password: 'wrong-two' }),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [401, 429]);
});

test('HTTP ambiguous and malformed session cookies fail closed', async (t) => {
  const app = await httpHarness(t);
  const { cookie, token } = await login(app);
  for (const value of [`${cookie}; ${cookie}`, `other_session=${token}`, 'admin_session=%ZZ',
    'admin_session=', `admin_session="${token}"`, `admin_session=${token}x`]) {
    const result = await app.send('/api/session', { headers: { Cookie: value } });
    assert.deepEqual(result.json(), { authenticated: false });
  }
});

test('HTTP close stops the owned session lifecycle and aborts an incomplete login request', async (t) => {
  const app = await httpHarness(t);
  let cleanupStopped = false;
  const originalClose = app.sessions.close;
  app.sessions.close = () => { cleanupStopped = true; originalClose(); };
  const request = httpRequest(`${app.origin}${HTTP_PATH}/api/login`, { method: 'POST',
    headers: { Origin: app.origin, 'Content-Type': 'application/json', 'Content-Length': '100' } });
  request.on('error', () => {});
  const accepted = new Promise((resolve) => app.server.once('request', resolve));
  request.write('{');
  await accepted;
  await app.close();
  assert.equal(cleanupStopped, true);
  assert.equal(app.server.listening, false);
  request.destroy();
});

test('HTTP command entry rejects invalid configuration without exposing environment values', async () => {
  const child = spawn(process.execPath, ['admin/server/server.mjs'], { cwd: new URL('..', import.meta.url),
    env: { ...process.env, ...baseEnv({ ADMIN_HOST: '0.0.0.0' }) }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.setEncoding('utf8').on('data', (chunk) => { output += chunk; });
  child.stderr.setEncoding('utf8').on('data', (chunk) => { output += chunk; });
  const [code] = await onceChildExit(child);
  assert.equal(code, 1);
  assert.match(output, /could not start/);
  assert.equal(output.includes(TEST_SECRET), false);
  assert.equal(output.includes(baseEnv().ADMIN_PASSWORD_HASH), false);
});

for (const { secure, port, origin } of [
  { secure: false, port: 80, origin: 'http://127.0.0.1' },
  { secure: true, port: 443, origin: 'https://127.0.0.1' },
]) {
  test(`HTTP default-port Origin permits login and logout on ${port}`, async (t) => {
    const app = await httpHarness(t, { env: { ADMIN_COOKIE_SECURE: String(secure) } });
    const actualAddress = app.server.address();
    // Keep real requests on the ephemeral listener, but exercise the same
    // Origin check with an OS-reported default port without binding 80/443.
    t.mock.method(app.server, 'address', () => ({ ...actualAddress, port }));
    const loggedIn = await app.post('/api/login', { password: HTTP_PASSWORD }, { Origin: origin });
    assert.equal(loggedIn.status, 200);
    assert.deepEqual(loggedIn.json(), { authenticated: true });
    const cookie = loggedIn.headers.get('set-cookie').split(';')[0];
    const token = cookie.slice('admin_session='.length);
    const csrfToken = app.sessions.get(token).csrfToken;
    const loggedOut = await app.post('/api/logout', {}, { Origin: origin,
      Cookie: cookie, 'X-CSRF-Token': csrfToken });
    assert.equal(loggedOut.status, 200);
    assert.deepEqual(loggedOut.json(), { authenticated: false });
    assert.equal(app.sessions.get(token), null);
    assertSecurity(loggedIn);
    assertSecurity(loggedOut);
  });
}

test('environment template and documentation keep admin credentials local and explicit', async () => {
  const [environmentTemplate, ignoreRules, readme] = await Promise.all([
    readFile(new URL('../.env.example', import.meta.url), 'utf8'),
    readFile(new URL('../.gitignore', import.meta.url), 'utf8'),
    readFile(new URL('../README.md', import.meta.url), 'utf8'),
  ]);
  const expectedAssignments = [
    'ADMIN_HOST=',
    'ADMIN_PORT=',
    'ADMIN_PATH=',
    'ADMIN_PASSWORD_HASH=',
    'ADMIN_SESSION_SECRET=',
    'ADMIN_COOKIE_SECURE=',
  ];
  const assignments = parseEnvironmentAssignments(environmentTemplate);
  assertEmptyEnvironmentAssignmentValues(assignments);
  assert.deepEqual(assignments.map(({ key, value }) => `${key}=${value}`), expectedAssignments);
  assert.match(environmentTemplate, /#.+/);
  assert.doesNotMatch(environmentTemplate, /scrypt\$|ADMIN_(?:PASSWORD_HASH|SESSION_SECRET)=.+/);
  assert.ok(ignoreRules.split(/\r?\n/).includes('/.env'));
  assert.match(readme, /Node\.js\s*>=?\s*20\.6\.0/);
  assert.match(readme, /node scripts\/create-admin-credentials\.mjs/);
  assert.match(readme, /(?:cp|Copy-Item).*\.env\.example.*\.env/i);
  assert.match(readme, /ADMIN_PATH/);
  assert.match(readme, /node --env-file=\.env admin\/server\/server\.mjs/);
  assert.match(readme, /local(?:host)? HTTP.*Secure.*false/i);
  assert.match(readme, /production.*Secure.*true/i);
  assert.match(readme, /Batch 10A[\s\S]*no Homework creation\/editing\/upload\/publication behavior/i);
});

function parseEnvironmentAssignments(source) {
  return source.split(/\r?\n/)
    .map((line) => line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/))
    .filter(Boolean)
    .map(([, key, value]) => ({ key, value }));
}

function assertEmptyEnvironmentAssignmentValues(assignments) {
  for (const { key, value } of assignments) assert.equal(value, '', `${key} must have an empty value`);
}

test('environment assignment parser exposes non-ADMIN values for the empty-value safety check', () => {
  const assignments = parseEnvironmentAssignments([
    '# A comment is not an assignment.',
    'ADMIN_HOST=',
    'UNRELATED_VALUE=must-not-be-present',
    'not a legal assignment',
  ].join('\n'));
  assert.deepEqual(assignments, [
    { key: 'ADMIN_HOST', value: '' },
    { key: 'UNRELATED_VALUE', value: 'must-not-be-present' },
  ]);
  assert.throws(
    () => assertEmptyEnvironmentAssignmentValues(assignments),
    /UNRELATED_VALUE must have an empty value/,
  );
});

test('admin-auth tests leave protected public content byte-identical', async () => {
  const currentContent = await Promise.all(
    PROTECTED_CONTENT_FILES.map((path) => readFile(new URL(`../${path}`, import.meta.url))),
  );
  assert.deepEqual(currentContent, protectedContentSnapshot);
});
