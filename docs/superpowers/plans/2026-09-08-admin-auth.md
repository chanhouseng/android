# Homework Admin Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an isolated Node.js administration service that provides one-password login, secure in-memory sessions, CSRF-protected logout, login throttling, and a minimal authenticated placeholder page.

**Architecture:** A dedicated `node:http` process serves a strict allowlist of admin HTML/CSS/JavaScript and four routes beneath one validated secret path. Small modules own configuration, password hashing, sessions, rate limiting, and response headers; the HTTP coordinator composes them without reading or writing website content.

**Tech Stack:** Node.js >= 20.6.0 built-ins (`node:http`, `node:crypto`, `node:fs`, `node:path`, `node:test`, built-in `fetch`), Vanilla HTML/CSS/JavaScript, existing UI foundation CSS.

**Spec:** `docs/superpowers/specs/2026-09-07-admin-auth-design.md`

## Global Constraints

- Do not modify `content/homework.json`, `homework/index.html`, `training/files.json`, Homework, World Skill, or Training content.
- Do not add the administration path to site navigation or expose it from the public site.
- Do not add dependencies, accounts, roles, databases, forms, preview, uploads, publication, deployment, or batch 10B behavior.
- Bind only to `127.0.0.1` or `::1`; production mode requires `ADMIN_COOKIE_SECURE=true`.
- Never write real credentials, password text, password hashes, session secrets, Session tokens, or CSRF tokens to Git or logs.
- Preserve all unrelated modified and untracked files. Do not reset, checkout, clean, commit, push, or deploy.
- Use tests before production code and verify every expected failure is caused by missing behavior.

## File Structure

- Create `admin/login.html`: unauthenticated page.
- Create `admin/index.html`: authenticated placeholder page.
- Create `admin/admin.css`: admin-only layout importing the existing foundation.
- Create `admin/login.js`: relative login API interaction.
- Create `admin/admin.js`: relative session and logout API interaction.
- Create `admin/server/config.mjs`: environment and Node version validation.
- Create `admin/server/password.mjs`: versioned scrypt hashing and verification.
- Create `admin/server/session-store.mjs`: hashed-token in-memory sessions and CSRF records.
- Create `admin/server/login-rate-limit.mjs`: injectable-clock IP failure limiter.
- Create `admin/server/security-headers.mjs`: common response security headers.
- Create `admin/server/server.mjs`: route coordinator and executable server entrypoint.
- Create `scripts/create-admin-credentials.mjs`: hidden TTY credential generator.
- Create `tests/admin-auth.test.mjs`: unit and real HTTP integration tests.
- Create `.env.example`: empty documented environment values.
- Modify `.gitignore`: ignore only the root `.env` used by the admin service.
- Modify `README.md`: document administration setup and batch 10A limits.

---

### Task 1: Configuration Contract

**Files:**
- Create: `tests/admin-auth.test.mjs`
- Create: `admin/server/config.mjs`

**Interfaces:**
- Produces: `loadAdminConfig(env, options?) -> { host, port, adminPath, passwordHash, sessionSecret, cookieSecure, nodeEnv, sessionTtlMs, bodyLimitBytes }`.
- `options.nodeVersion` defaults to `process.versions.node` and exists only to verify the runtime floor without changing the computer environment.

- [ ] **Step 1: Write failing configuration tests**

Add table-driven tests with literal invalid values:

```js
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
```

Add success tests for both loopback forms, port `0`, a decoded 32-byte base64url secret, and production Secure enforcement.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/admin-auth.test.mjs`

Expected: failure because `admin/server/config.mjs` does not exist.

- [ ] **Step 3: Implement minimal configuration parsing**

Implement fixed defaults for non-secret values, strict boolean and integer parsing, this path expression, and canonical base64url secret validation:

```js
const ADMIN_PATH_PATTERN = /^\/[a-z0-9]+(?:[/-][a-z0-9]+)*$/;
const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1']);
const MINIMUM_NODE = [20, 6, 0];

export function loadAdminConfig(env = process.env, { nodeVersion = process.versions.node } = {}) {
  // Return only normalized configuration values; throw field-specific errors.
}
```

Treat an empty `ADMIN_HOST`, `ADMIN_PORT`, `ADMIN_PATH`, or `ADMIN_COOKIE_SECURE` from `.env` as its documented local default. Require non-empty hash and secret. Decode and re-encode the secret to ensure canonical unpadded base64url and at least 32 bytes.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test tests/admin-auth.test.mjs`

Expected: all Task 1 tests pass.

---

### Task 2: Password Hashing and Credential Generation

**Files:**
- Modify: `tests/admin-auth.test.mjs`
- Create: `admin/server/password.mjs`
- Create: `scripts/create-admin-credentials.mjs`

**Interfaces:**
- Produces: `createPasswordHash(password) -> Promise<string>`.
- Produces: `verifyPassword(password, encodedHash) -> Promise<boolean>`.
- Produces: `generateAdminCredentials(password) -> Promise<{ passwordHash, sessionSecret }>`.
- Produces: `readHiddenLine({ input, output, prompt }) -> Promise<string>` with raw-mode restoration in `finally`.

- [ ] **Step 1: Write failing password behavior tests**

Test real crypto rather than a mock:

```js
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
```

Spawn the credentials CLI with an argument and assert non-zero exit plus output that does not contain the supplied value. Test `generateAdminCredentials` twice and verify distinct canonical 32-byte base64url secrets.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/admin-auth.test.mjs`

Expected: failure because password and credential modules do not exist.

- [ ] **Step 3: Implement the versioned scrypt format**

Use promisified `crypto.scrypt` with literal parameters:

```js
export const SCRYPT_PARAMETERS = Object.freeze({
  N: 131072,
  r: 8,
  p: 1,
  keyLength: 64,
  maxmem: 256 * 1024 * 1024,
});
```

Generate a 16-byte salt. Parse every stored parameter, reject duplicates or unsupported values, derive exactly `keyLength` bytes, compare equal-length buffers with `timingSafeEqual`, and return `false` for all malformed hashes.

- [ ] **Step 4: Implement the TTY-only credential command**

Reject all command-line arguments and non-TTY input. Write prompts to stderr and write only these two lines to stdout after matching non-empty passwords:

```text
ADMIN_PASSWORD_HASH=<versioned hash>
ADMIN_SESSION_SECRET=<32-byte base64url secret>
```

The hidden reader stores the prior raw state, enables raw mode, handles Enter, Backspace and Ctrl+C, then removes listeners and restores raw mode in `finally` for success, rejection, and cancellation.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --test tests/admin-auth.test.mjs`

Expected: all Tasks 1–2 tests pass with two different salts and secrets.

---

### Task 3: Session Store and Login Rate Limiter

**Files:**
- Modify: `tests/admin-auth.test.mjs`
- Create: `admin/server/session-store.mjs`
- Create: `admin/server/login-rate-limit.mjs`

**Interfaces:**
- Produces: `SessionStore({ secret, ttlMs, now, cleanupIntervalMs, storage? })`.
- Session methods: `create() -> { token, csrfToken, expiresAt }`, `get(token) -> record|null`, `destroy(token) -> boolean`, `cleanup()`, `close()`.
- Produces: `safeTokenEqual(left, right) -> boolean` for fixed-time CSRF comparison.
- Produces: `LoginRateLimiter({ windowMs, maxFailures, now })`.
- Rate methods: `check(ip) -> { limited, retryAfterSeconds }`, `recordFailure(ip)`, `clear(ip)`.

- [ ] **Step 1: Write failing Session tests**

Use an injected Map and clock:

```js
test('sessions store only token hashes, expire at a fixed time, and disappear with a new store', async () => {
  let now = 1_000;
  const storage = new Map();
  const firstStore = new SessionStore({ secret: SECRET, ttlMs: 500, now: () => now, storage, cleanupIntervalMs: 0 });
  const issued = firstStore.create();
  assert.equal(storage.has(issued.token), false);
  assert.equal(firstStore.get(issued.token).expiresAt, 1_500);
  now = 1_501;
  assert.equal(firstStore.get(issued.token), null);
  const secondStore = new SessionStore({ secret: SECRET, ttlMs: 500, now: () => now, cleanupIntervalMs: 0 });
  assert.equal(secondStore.get(issued.token), null);
});
```

Also test 32-byte random token/CSRF lengths, destroy, cleanup, fixed expiry not extended by `get`, and constant-time-safe equality returning false for unequal lengths.

- [ ] **Step 2: Write failing rate-limit tests**

```js
test('the sixth attempt is limited until the 15-minute window expires', () => {
  let now = 0;
  const limiter = new LoginRateLimiter({ windowMs: 900_000, maxFailures: 5, now: () => now });
  for (let count = 0; count < 5; count += 1) limiter.recordFailure('127.0.0.1');
  assert.deepEqual(limiter.check('127.0.0.1'), { limited: true, retryAfterSeconds: 900 });
  now = 900_001;
  assert.deepEqual(limiter.check('127.0.0.1'), { limited: false, retryAfterSeconds: 0 });
});
```

Add a separate assertion that `clear(ip)` removes failures after successful login and that a fake `X-Forwarded-For` value is never part of this module's API.

- [ ] **Step 3: Run the focused test and verify RED**

Run: `node --test tests/admin-auth.test.mjs`

Expected: failure because Session and rate-limit modules do not exist.

- [ ] **Step 4: Implement Session and rate-limit modules**

Use `randomBytes(32).toString('base64url')` for both browser token and CSRF token. Key the Map by `createHmac('sha256', secretBytes).update(token).digest('base64url')`; never store the browser token. Use an unref'd interval only when `cleanupIntervalMs > 0`.

Store failure timestamps per IP, prune timestamps outside the injected window before every check or update, and compute `Retry-After` from the oldest remaining failure.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --test tests/admin-auth.test.mjs`

Expected: all Tasks 1–3 tests pass.

---

### Task 4: HTTP Authentication Service

**Files:**
- Modify: `tests/admin-auth.test.mjs`
- Create: `admin/server/security-headers.mjs`
- Create: `admin/server/server.mjs`

**Interfaces:**
- Produces: `applySecurityHeaders(response)`.
- Produces: `createAdminServer({ config, rootDirectory?, now?, sessionStore?, rateLimiter?, getClientIp? }) -> { server, sessions, rateLimiter, close }`.
- Produces: `startAdminServer({ env?, rootDirectory? }) -> Promise<{ server, close, origin }>`.
- `close() -> Promise<void>` closes the HTTP server and Session cleanup timer.

- [ ] **Step 1: Add a real HTTP test harness**

Create a helper that hashes a known password, builds a config with port `0`, listens on `127.0.0.1`, derives `origin` from `server.address().port`, sends built-in `fetch` requests, manually forwards the `admin_session` Cookie, and always awaits `close()` in test cleanup.

- [ ] **Step 2: Write failing route, status, header, and non-leakage tests**

Cover these literal outcomes independently:

- unauthenticated `GET <path>/` returns login HTML; authenticated request returns only the placeholder admin HTML.
- `/admin/`, `<path>/index.html`, sibling paths and encoded traversal return 404.
- wrong methods on the four known routes return 405 and correct `Allow`.
- missing/wrong media type returns 415; malformed, empty or oversized login JSON returns 400 or 413.
- cross-origin and missing-Origin login/logout return 403.
- wrong password returns 401 with `login_failed`; correct password returns 200 and a Cookie.
- five failures allow 401 responses; the next request returns 429 and integer `Retry-After`; injected time expiry allows another attempt.
- the default `getClientIp(request)` ignores `X-Forwarded-For` and returns `request.socket.remoteAddress`; an injected function can provide a deterministic test IP without enabling proxy trust.
- unauthenticated Session returns `{ authenticated: false }`; authenticated Session returns CSRF but no Session token.
- logout without valid Session returns 401; without valid CSRF returns 403; valid logout returns 200, clears the server record, and expires the Cookie.
- a Cookie created by one server/store is rejected by a newly created server/store.
- all page, API and 404 responses include the five required security headers and no `Access-Control-Allow-Origin`.
- concatenated response text and headers never contain password hash, Session secret, password, or complete Cookie token.

- [ ] **Step 3: Run the HTTP tests and verify RED**

Run: `node --test tests/admin-auth.test.mjs`

Expected: route tests fail because the server and security-header modules do not exist.

- [ ] **Step 4: Implement security headers and strict routing**

Apply this CSP to every response:

```text
default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'
```

Match request URL from `new URL(request.url, 'http://admin.invalid')`, reject malformed encoding, encoded slash/backslash/dot traversal, query and fragment on configured routes, and dispatch only exact allowlisted paths. For known paths, reject unsupported methods before reading a body.

- [ ] **Step 5: Implement origin, JSON, Cookie and API helpers**

Derive the trusted local origin from `config.host`, `config.cookieSecure`, and the actual bound port. Require exact `Origin` equality for both POST routes. Read at most 4096 bytes, allow `application/json` with case-insensitive parameters, and return the specified stable error envelope.

Parse only `admin_session`; hash it through `SessionStore`. Build login cookies with `HttpOnly`, `SameSite=Strict`, configured Path, `Max-Age=28800`, and optional `Secure`. Build logout cookies with the same Path plus `Max-Age=0`.

- [ ] **Step 6: Implement login, Session, logout, and limiter coordination**

Call the injected `getClientIp`, whose default reads only the real socket IP, before password hashing. On login failure record that IP and return only `login_failed`; on success clear that IP, create the Session, and set the Cookie. Session GET never mutates expiry. Logout requires Origin, valid Session and `safeTokenEqual` CSRF before `destroy()`.

- [ ] **Step 7: Run focused tests and verify GREEN**

Run: `node --test tests/admin-auth.test.mjs`

Expected: all configuration, crypto, Session, rate-limit and HTTP contract tests pass.

---

### Task 5: Minimal Accessible Admin Pages

**Files:**
- Modify: `tests/admin-auth.test.mjs`
- Create: `admin/login.html`
- Create: `admin/index.html`
- Create: `admin/admin.css`
- Create: `admin/login.js`
- Create: `admin/admin.js`
- Modify: `admin/server/server.mjs`

**Interfaces:**
- HTTP allowlist serves `admin.css`, `login.js`, `admin.js`, and `assets/{foundation,tokens,base,utilities,components}.css` beneath `ADMIN_PATH`.
- Browser scripts call only relative `api/login`, `api/session`, and `api/logout` URLs.

- [ ] **Step 1: Write failing page and static-asset tests**

Through the real HTTP server, assert:

- login HTML has `lang="zh-Hant"`, a meaningful title, visible password label, `type="password"`, `autocomplete="current-password"`, a submit button, disabled/loading hook, external `login.js`, and an `aria-live="polite"` error region.
- authenticated HTML contains exactly the approved message `Homework 編輯器將於下一批加入`, an authenticated status, logout button, and external `admin.js`; it contains no form fields for content editing.
- both pages load `admin.css`, and `admin.css` imports `./assets/foundation.css`.
- all five foundation dependency URLs return 200 with `text/css` and cannot be replaced by arbitrary path input.
- scripts contain relative API requests and no `localStorage`, external URL, embedded password, management path, inline script, or tracking code.

- [ ] **Step 2: Run page tests and verify RED**

Run: `node --test tests/admin-auth.test.mjs`

Expected: failures because the page assets and allowlist do not exist.

- [ ] **Step 3: Implement semantic HTML and token-based CSS**

Use one centered `.admin-auth-layout` and `.admin-auth-card`, existing `.card` and `.button` classes, token-based spacing, radius, color, typography and shadow, `min-height: 100svh`, and a small-screen media query expressed with existing viewport tokens where possible. Do not use hardcoded colors, fonts, shadows, fixed card height, gradients or remote assets.

- [ ] **Step 4: Implement browser interactions**

`login.js` prevents form submission, disables the button, changes its text to `登入中…`, posts JSON to `api/login`, reloads `./` on success, and restores the control plus an accessible generic message on error.

`admin.js` fetches `api/session` on startup, keeps CSRF only in a module variable, redirects to `./` if unauthenticated, and posts `{}` with `Content-Type: application/json` plus `X-CSRF-Token` for logout. It never stores tokens in URL, DOM dataset, localStorage, or sessionStorage.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --test tests/admin-auth.test.mjs`

Expected: all admin authentication and page tests pass.

---

### Task 6: Environment Safety, Documentation, and Full Verification

**Files:**
- Modify: `tests/admin-auth.test.mjs`
- Create: `.env.example`
- Modify: `.gitignore`
- Modify: `README.md`

**Interfaces:**
- `.env.example` contains empty `ADMIN_HOST`, `ADMIN_PORT`, `ADMIN_PATH`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`, and `ADMIN_COOKIE_SECURE` values plus comments.
- README startup command is `node --env-file=.env admin/server/server.mjs`.

- [ ] **Step 1: Write failing safety regression tests**

Read `.env.example` and assert every assignment has an empty value, no generated hash/secret is present, and `.gitignore` ignores root `/.env`. Snapshot `content/homework.json`, `homework/index.html`, and `training/files.json` before admin tests and assert byte equality afterward.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/admin-auth.test.mjs`

Expected: failure because `.env.example`, the ignore entry, and README admin instructions are absent.

- [ ] **Step 3: Add environment template and ignore rule**

Add comments and these empty assignments:

```ini
ADMIN_HOST=
ADMIN_PORT=
ADMIN_PATH=
ADMIN_PASSWORD_HASH=
ADMIN_SESSION_SECRET=
ADMIN_COOKIE_SECURE=
```

Append `/.env` to `.gitignore` without altering existing rules.

- [ ] **Step 4: Extend README**

Document Node.js >=20.6.0, credential generation, copying `.env.example` to `.env`, setting the custom path, startup, why local HTTP uses Secure false, why production must use Secure true, and that batch 10A has no Homework creation/editing/upload/publication behavior.

- [ ] **Step 5: Run focused and complete automated verification**

Run in order:

```sh
node --test tests/admin-auth.test.mjs
node --test tests/*.test.mjs
node scripts/validate-content.mjs
node scripts/build-content-indexes.mjs --check
```

Expected: zero failures; content validation passes; generated indexes are synchronized without writes.

- [ ] **Step 6: Start a disposable local acceptance server**

Generate test-only credentials in memory, set `ADMIN_HOST=127.0.0.1`, `ADMIN_PORT=8787`, `ADMIN_PATH=/homework-editor-private`, `ADMIN_COOKIE_SECURE=false`, and start the server without creating a real `.env` or printing secrets.

- [ ] **Step 7: Perform browser acceptance**

At desktop width and 390px verify the hidden URL, `/admin/` 404, wrong password, five-failure limit, correct login after an isolated restart, authenticated placeholder only, refresh preserving the same fixed Session expiry, keyboard focus, logout, back-navigation denial, no horizontal overflow, and an empty browser console.

- [ ] **Step 8: Confirm the content boundary and report**

Compare the three byte snapshots, inspect `git status` and scoped diffs, stop the disposable server, and report files, startup command, route, test counts, Cookie flags, security headers, responsive/keyboard/console results, limitations, and explicit confirmation that website content data was untouched.
