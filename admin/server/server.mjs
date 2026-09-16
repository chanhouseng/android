import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadAdminConfig, PREVIEW_BODY_LIMIT_BYTES } from './config.mjs';
import { verifyPassword } from './password.mjs';
import { SessionStore, safeTokenEqual } from './session-store.mjs';
import { LoginRateLimiter } from './login-rate-limit.mjs';
import { applySecurityHeaders } from './security-headers.mjs';
import {
  HOMEWORK_ID_PATTERN,
  isHomeworkContentPreviewRequest,
  isHomeworkContentUpdateRequest,
  isHomeworkMetadataRequest,
  validateHomeworkMetadataInput,
  validateHomeworkPreviewInput,
  validateHomeworkPublishInput,
} from '../shared/homework-preview-contract.mjs';
import { validateHtmlFragment } from './html-fragment-validator.mjs';
import { renderHomeworkPage } from './homework-page-renderer.mjs';
import { MultipartRequestError, parsePublishMultipart } from './multipart-request.mjs';
import {
  ImageUploadValidationError,
  validateContentImageReferences,
  validateStagedImages,
} from './image-upload-validator.mjs';
import { HomeworkPublishError, publishHomework } from './homework-publisher.mjs';
import { HomeworkListError, loadPublishedHomeworks } from './homework-list.mjs';
import { HomeworkMetadataEditError, updateHomeworkMetadata } from './homework-metadata-editor.mjs';
import {
  HomeworkContentEditError,
  loadHomeworkContent,
  previewHomeworkContent,
  updateHomeworkContent,
} from './homework-content-editor.mjs';
import {
  HomeworkContentImageError,
  readHomeworkContentImage,
} from './homework-content-images.mjs';

const DEFAULT_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ERROR_MESSAGES = Object.freeze({
  invalid_request: '請提供有效的登入資料。',
  login_failed: '登入失敗，請檢查密碼。',
  invalid_origin: '此請求來源不獲允許。',
  payload_too_large: '請求資料超過大小限制。',
  unsupported_media_type: '請使用此操作支援的資料或圖片格式。',
  rate_limited: '嘗試次數過多，請稍後再試。',
  not_authenticated: '請先登入。',
  invalid_csrf: '無法驗證此請求，請重新整理頁面。',
  method_not_allowed: '此請求方法不獲允許。',
  validation_failed: '請修正表單內容。',
  publish_conflict: 'Homework ID、頁面或圖片目錄已存在。',
  homework_not_found: '找不到指定的 Homework。',
  homework_not_editable: '此舊項目暫不支援網站編輯。',
  content_changed: '主要內容已由其他分頁更新，請重新載入後再修改。',
  homework_image_not_found: '找不到指定的 Homework 圖片。',
  invalid_manifest: 'Homework 資料暫時無法讀取。',
  internal_error: '服務暫時無法處理請求。',
});

class RequestError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function sendError(response, status, code) {
  sendJson(response, status, { error: { code, message: ERROR_MESSAGES[code] } });
}

function sendValidationError(response, fields) {
  sendJson(response, 422, {
    error: {
      code: 'validation_failed',
      message: ERROR_MESSAGES.validation_failed,
      fields,
    },
  });
}

function trustedOrigin(config, server) {
  const host = config.host === '::1' ? '[::1]' : config.host;
  return new URL(`${config.cookieSecure ? 'https' : 'http'}://${host}:${server.address().port}`).origin;
}

function exactPath(rawUrl) {
  try {
    const url = new URL(rawUrl, 'http://admin.invalid');
    // Reject URL normalization and aliases before consulting the allowlist.
    // Every configured route is ASCII, so no percent-encoded form is needed.
    decodeURIComponent(rawUrl);
    if (!rawUrl.startsWith('/') || rawUrl.startsWith('//') || /[%\\?#]/.test(rawUrl)
      || url.origin !== 'http://admin.invalid' || url.pathname !== rawUrl) return null;
    return url.pathname;
  } catch {
    return null;
  }
}

function requireJsonType(request) {
  const contentType = request.headers['content-type'];
  // Media types and parameter names are case-insensitive; accept token or quoted values.
  const jsonType = /^application\/json(?:\s*;\s*[!#$%&'*+.^_`|~\w-]+\s*=\s*(?:[!#$%&'*+.^_`|~\w-]+|"(?:[^"\\\r\n]|\\[\t -~])*"))*\s*$/i;
  if (typeof contentType !== 'string' || !jsonType.test(contentType.trim())) {
    throw new RequestError(415, 'unsupported_media_type');
  }
}

function readJson(request, response, limitBytes) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let byteLength = 0;
    function cleanup() {
      request.off('data', onData);
      request.off('end', onEnd);
      request.off('aborted', onAborted);
      request.off('error', onError);
    }
    function fail(error) {
      cleanup();
      reject(error);
    }
    function tooLarge() {
      request.pause();
      response.setHeader('Connection', 'close');
      fail(new RequestError(413, 'payload_too_large'));
    }
    function onData(chunk) {
      byteLength += chunk.length;
      if (byteLength > limitBytes) return tooLarge();
      chunks.push(chunk);
    }
    function onEnd() {
      cleanup();
      try {
        const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
        resolveBody(JSON.parse(text));
      } catch {
        reject(new RequestError(400, 'invalid_request'));
      }
    }
    function onAborted() { fail(new RequestError(400, 'invalid_request')); }
    function onError() { fail(new RequestError(400, 'invalid_request')); }
    if (Number(request.headers['content-length']) > limitBytes) return tooLarge();
    request.on('data', onData);
    request.once('end', onEnd);
    request.once('aborted', onAborted);
    request.once('error', onError);
  });
}

function sessionCookie(request) {
  const header = request.headers.cookie;
  if (typeof header !== 'string') return { present: false, token: null };
  const matches = header.split(';').map((part) => part.trim())
    .filter((part) => part.split('=', 1)[0] === 'admin_session');
  if (matches.length === 0) return { present: false, token: null };
  if (matches.length !== 1) return { present: true, token: null };
  const token = matches[0].slice('admin_session='.length);
  return { present: true, token: /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null };
}

function setSessionCookie(response, config, token = '') {
  const flags = [`admin_session=${token}`, `Path=${config.adminPath}`,
    `Max-Age=${token ? 28800 : 0}`, 'HttpOnly', 'SameSite=Strict'];
  if (config.cookieSecure) flags.push('Secure');
  response.setHeader('Set-Cookie', flags.join('; '));
}

export function createAdminServer({
  config,
  rootDirectory = DEFAULT_ROOT,
  now = () => Date.now(),
  sessionStore,
  rateLimiter = LoginRateLimiter({ now }),
  getClientIp = (request) => request.socket.remoteAddress,
  logger = console,
} = {}) {
  const sessions = sessionStore ?? SessionStore({ secret: config.sessionSecret, ttlMs: config.sessionTtlMs, now });
  const prefix = config.adminPath;
  const routes = new Map([
    [`${prefix}/`, { method: 'GET', kind: 'page' }],
    [`${prefix}/api/login`, { method: 'POST', kind: 'login' }],
    [`${prefix}/api/session`, { method: 'GET', kind: 'session' }],
    [`${prefix}/api/logout`, { method: 'POST', kind: 'logout' }],
    [`${prefix}/api/preview`, { method: 'POST', kind: 'preview' }],
    [`${prefix}/api/publish`, { method: 'POST', kind: 'publish' }],
    [`${prefix}/api/homeworks`, { method: 'GET', kind: 'homeworks' }],
  ]);
  for (const name of ['admin.css', 'login.js', 'admin.js']) {
    routes.set(`${prefix}/${name}`, { method: 'GET', kind: 'file', file: `admin/${name}`,
      type: name.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8' });
  }
  routes.set(`${prefix}/shared/homework-preview-contract.mjs`, { method: 'GET', kind: 'file',
    file: 'admin/shared/homework-preview-contract.mjs', type: 'text/javascript; charset=utf-8' });
  for (const name of ['foundation', 'tokens', 'base', 'utilities', 'components', 'app-shell', 'accordion', 'detail-page']) {
    routes.set(`${prefix}/assets/${name}.css`, { method: 'GET', kind: 'file',
      file: `assets/css/${name}.css`, type: 'text/css; charset=utf-8' });
  }
  function resolveRoute(rawUrl) {
    const pathname = exactPath(rawUrl);
    if (!pathname) return null;
    const fixed = routes.get(pathname);
    if (fixed) return fixed;
    const editPrefix = `${prefix}/api/homeworks/`;
    if (pathname.startsWith(editPrefix)) {
      const suffix = pathname.slice(editPrefix.length);
      const previewMatch = suffix.match(/^([^/]+)\/content\/preview$/);
      if (previewMatch) return { method: 'POST', kind: 'homework-content-preview', id: previewMatch[1] };
      const contentMatch = suffix.match(/^([^/]+)\/content$/);
      if (contentMatch) return { methods: ['GET', 'PATCH'], kind: 'homework-content', id: contentMatch[1] };
      const imageMatch = suffix.match(/^([^/]+)\/images\/([^/]+)$/);
      if (imageMatch) {
        return { method: 'GET', kind: 'homework-content-image', id: imageMatch[1], filename: imageMatch[2] };
      }
      return { method: 'PATCH', kind: 'homework-edit', id: suffix };
    }
    return null;
  }
  let closing = false;
  let closePromise;
  const pendingLogins = new Map();

  async function serializeLogin(ip, operation) {
    const previous = pendingLogins.get(ip);
    let release;
    const current = new Promise((resolveTurn) => { release = resolveTurn; });
    pendingLogins.set(ip, current);
    try {
      await previous;
      if (!closing) await operation();
    } finally {
      release();
      if (pendingLogins.get(ip) === current) pendingLogins.delete(ip);
    }
  }

  function checkLoginLimit(ip, response) {
    const limit = rateLimiter.check(ip);
    if (limit.limited) {
      response.setHeader('Retry-After', String(limit.retryAfterSeconds));
      throw new RequestError(429, 'rate_limited');
    }
  }

  const server = createServer({ requestTimeout: 15000, headersTimeout: 10000 }, (request, response) => {
    applySecurityHeaders(response);
    handle(request, response).catch((error) => {
      if (response.destroyed || response.writableEnded) return;
      if (error instanceof HomeworkContentEditError && error.fields) {
        sendValidationError(response, error.fields);
      } else if (error instanceof RequestError || error instanceof MultipartRequestError
        || error instanceof HomeworkPublishError || error instanceof HomeworkListError
        || error instanceof HomeworkMetadataEditError || error instanceof HomeworkContentEditError
        || error instanceof HomeworkContentImageError) {
        sendError(response, error.status, error.code);
      } else if (error instanceof ImageUploadValidationError) {
        const code = error.status === 413 ? 'payload_too_large'
          : error.status === 415 ? 'unsupported_media_type' : 'validation_failed';
        sendJson(response, error.status, { error: { code, message: ERROR_MESSAGES[code], fields: error.fields } });
      }
      else {
        // Exception messages may contain input, credentials, paths or tokens.
        logger.error?.('Admin service request failed.');
        sendError(response, 500, 'internal_error');
      }
    });
  });

  async function handle(request, response) {
    const route = resolveRoute(request.url);
    if (!route) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    if (route.kind === 'homeworks' || route.kind.startsWith('homework-')) {
      response.setHeader('Cache-Control', 'no-store');
    }
    const allowedMethods = route.methods ?? [route.method];
    if (!allowedMethods.includes(request.method)) {
      response.setHeader('Allow', allowedMethods.join(', '));
      sendError(response, 405, 'method_not_allowed');
      return;
    }
    if (request.method === 'POST' || request.method === 'PATCH') {
      if (request.headers.origin !== trustedOrigin(config, server)) throw new RequestError(403, 'invalid_origin');
      if (route.kind !== 'publish') requireJsonType(request);
    }
    if (route.kind === 'login') {
      const ip = getClientIp(request);
      checkLoginLimit(ip, response);
      const body = await readJson(request, response, config.bodyLimitBytes);
      if (!body || Array.isArray(body) || typeof body.password !== 'string' || body.password.length === 0) {
        throw new RequestError(400, 'invalid_request');
      }
      // Recheck after earlier attempts finish so simultaneous hashes cannot
      // all pass the same pre-failure rate-limit check.
      await serializeLogin(ip, async () => {
        if (response.destroyed) return;
        checkLoginLimit(ip, response);
        const valid = await verifyPassword(body.password, config.passwordHash);
        if (closing) return;
        if (!valid) {
          rateLimiter.recordFailure(ip);
          throw new RequestError(401, 'login_failed');
        }
        if (response.destroyed) return;
        rateLimiter.clear(ip);
        const session = sessions.create();
        setSessionCookie(response, config, session.token);
        sendJson(response, 200, { authenticated: true });
      });
      return;
    }
    if (route.kind === 'file') {
      const body = await readFile(resolve(rootDirectory, route.file));
      response.writeHead(200, { 'Content-Type': route.type });
      response.end(body);
      return;
    }
    const cookie = sessionCookie(request);
    const session = sessions.get(cookie.token);
    if (cookie.present && !session) setSessionCookie(response, config);
    if (route.kind === 'session') {
      sendJson(response, 200, session ? { authenticated: true, csrfToken: session.csrfToken } : { authenticated: false });
    } else if (route.kind === 'logout') {
      if (!session) throw new RequestError(401, 'not_authenticated');
      if (!safeTokenEqual(request.headers['x-csrf-token'], session.csrfToken)) throw new RequestError(403, 'invalid_csrf');
      sessions.destroy(cookie.token);
      setSessionCookie(response, config);
      sendJson(response, 200, { authenticated: false });
    } else if (route.kind === 'preview') {
      if (!session) throw new RequestError(401, 'not_authenticated');
      if (!safeTokenEqual(request.headers['x-csrf-token'], session.csrfToken)) throw new RequestError(403, 'invalid_csrf');
      const body = await readJson(request, response, PREVIEW_BODY_LIMIT_BYTES);
      const fields = validateHomeworkPreviewInput(body);
      if (!fields.ok) {
        sendValidationError(response, fields.errors);
        return;
      }
      const fragment = validateHtmlFragment(fields.value.contentHtml);
      if (!fragment.ok) {
        sendValidationError(response, fragment.errors);
        return;
      }
      const assetBase = `${trustedOrigin(config, server)}${prefix}/assets/`;
      const previewHtml = renderHomeworkPage({ ...fields.value, contentHtml: fragment.html, preview: true, assetBase });
      sendJson(response, 200, { previewHtml });
    } else if (route.kind === 'homeworks') {
      if (!session) throw new RequestError(401, 'not_authenticated');
      sendJson(response, 200, await loadPublishedHomeworks({ rootDirectory }));
    } else if (route.kind === 'homework-content') {
      if (!session) throw new RequestError(401, 'not_authenticated');
      if (!HOMEWORK_ID_PATTERN.test(route.id)) throw new RequestError(400, 'invalid_request');
      if (request.method === 'GET') {
        sendJson(response, 200, await loadHomeworkContent({ rootDirectory, id: route.id }));
        return;
      }
      if (!safeTokenEqual(request.headers['x-csrf-token'], session.csrfToken)) {
        throw new RequestError(403, 'invalid_csrf');
      }
      const body = await readJson(request, response, PREVIEW_BODY_LIMIT_BYTES);
      if (!isHomeworkContentUpdateRequest(body)) throw new RequestError(400, 'invalid_request');
      sendJson(response, 200, await updateHomeworkContent({
        rootDirectory,
        id: route.id,
        contentHtml: body.contentHtml,
        revision: body.revision,
        logger,
      }));
    } else if (route.kind === 'homework-content-preview') {
      if (!session) throw new RequestError(401, 'not_authenticated');
      if (!safeTokenEqual(request.headers['x-csrf-token'], session.csrfToken)) {
        throw new RequestError(403, 'invalid_csrf');
      }
      if (!HOMEWORK_ID_PATTERN.test(route.id)) throw new RequestError(400, 'invalid_request');
      const body = await readJson(request, response, PREVIEW_BODY_LIMIT_BYTES);
      if (!isHomeworkContentPreviewRequest(body)) throw new RequestError(400, 'invalid_request');
      const base = `${trustedOrigin(config, server)}${prefix}/`;
      sendJson(response, 200, await previewHomeworkContent({
        rootDirectory,
        id: route.id,
        contentHtml: body.contentHtml,
        assetBase: `${base}assets/`,
        imageBaseUrl: `${base}api/homeworks/${route.id}/images/`,
      }));
    } else if (route.kind === 'homework-content-image') {
      if (!session) throw new RequestError(401, 'not_authenticated');
      if (!HOMEWORK_ID_PATTERN.test(route.id)) throw new RequestError(400, 'invalid_request');
      await loadHomeworkContent({ rootDirectory, id: route.id });
      const image = await readHomeworkContentImage({
        rootDirectory,
        id: route.id,
        filename: route.filename,
      });
      response.writeHead(200, { 'Content-Type': image.mimeType });
      response.end(image.bytes);
    } else if (route.kind === 'homework-edit') {
      if (!session) throw new RequestError(401, 'not_authenticated');
      if (!safeTokenEqual(request.headers['x-csrf-token'], session.csrfToken)) {
        throw new RequestError(403, 'invalid_csrf');
      }
      if (!HOMEWORK_ID_PATTERN.test(route.id)) throw new RequestError(400, 'invalid_request');
      const body = await readJson(request, response, config.bodyLimitBytes);
      if (!isHomeworkMetadataRequest(body)) throw new RequestError(400, 'invalid_request');
      const fields = validateHomeworkMetadataInput(body);
      if (!fields.ok) {
        sendValidationError(response, fields.errors);
        return;
      }
      const result = await updateHomeworkMetadata({
        rootDirectory,
        id: route.id,
        metadata: fields.value,
        logger,
      });
      sendJson(response, 200, result);
    } else if (route.kind === 'publish') {
      if (!session) throw new RequestError(401, 'not_authenticated');
      if (!safeTokenEqual(request.headers['x-csrf-token'], session.csrfToken)) throw new RequestError(403, 'invalid_csrf');
      let multipart;
      let retainRecovery = false;
      try {
        multipart = await parsePublishMultipart(request, response, { rootDirectory });
        let payload;
        try {
          payload = JSON.parse(multipart.payloadText);
        } catch {
          throw new RequestError(400, 'invalid_request');
        }
        const fields = validateHomeworkPublishInput(payload);
        if (!fields.ok) {
          await multipart.cleanup();
          multipart = undefined;
          sendValidationError(response, fields.errors);
          return;
        }
        const fragment = validateHtmlFragment(fields.value.contentHtml);
        if (!fragment.ok) {
          await multipart.cleanup();
          multipart = undefined;
          sendValidationError(response, fragment.errors);
          return;
        }
        const images = await validateStagedImages({
          id: fields.value.id,
          coverImage: multipart.coverImage,
          contentImages: multipart.contentImages,
        });
        const references = validateContentImageReferences({
          id: fields.value.id,
          contentHtml: fragment.html,
          filenames: images.contentImages.map(({ destinationFilename }) => destinationFilename),
        });
        if (!references.ok) {
          await multipart.cleanup();
          multipart = undefined;
          sendValidationError(response, references.errors);
          return;
        }
        const result = await publishHomework({
          rootDirectory,
          transactionDirectory: multipart.transactionDirectory,
          homework: { ...fields.value, contentHtml: fragment.html },
          images,
          logger,
        });
        sendJson(response, 201, result);
      } catch (error) {
        retainRecovery = error?.recoveryRetained === true;
        throw error;
      } finally {
        if (multipart && !retainRecovery) await multipart.cleanup();
      }
    } else {
      const file = session ? 'admin/index.html' : 'admin/login.html';
      const body = await readFile(resolve(rootDirectory, file));
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(body);
    }
  }

  function close() {
    if (closePromise) return closePromise;
    closing = true;
    sessions.close();
    closePromise = new Promise((resolveClose, reject) => {
      if (!server.listening) return resolveClose();
      server.close((error) => error ? reject(error) : resolveClose());
      server.closeAllConnections();
    });
    return closePromise;
  }
  return { server, sessions, rateLimiter, close };
}

async function warnForIncompleteStaging(rootDirectory, logger) {
  try {
    const entries = await readdir(resolve(rootDirectory ?? DEFAULT_ROOT, '.admin-staging'), { withFileTypes: true });
    const incompleteCount = entries.filter((entry) => entry.isDirectory()).length;
    if (incompleteCount > 0) logger.warn?.(`偵測到 ${incompleteCount} 個未完成的 Homework staging transaction；不會自動發佈。`);
  } catch (error) {
    if (error.code !== 'ENOENT') logger.warn?.('無法檢查未完成的 Homework staging transaction。');
  }
}

export async function startAdminServer({ env = process.env, rootDirectory, logger = console } = {}) {
  const config = loadAdminConfig(env);
  await warnForIncompleteStaging(rootDirectory, logger);
  const app = createAdminServer({ config, rootDirectory, logger });
  try {
    await new Promise((resolveListen, reject) => {
      function onError(error) { reject(error); }
      app.server.once('error', onError);
      app.server.listen(config.port, config.host, () => {
        app.server.off('error', onError);
        resolveListen();
      });
    });
    return { server: app.server, close: app.close, origin: trustedOrigin(config, app.server) };
  } catch (error) {
    await app.close();
    throw error;
  }
}

const isEntryPoint = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isEntryPoint) {
  try {
    const app = await startAdminServer();
    console.log(`Admin service listening at ${app.origin}`);
    const shutdown = () => { app.close().catch(() => { process.exitCode = 1; }); };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  } catch {
    console.error('Admin service could not start. Check configuration and port availability.');
    process.exitCode = 1;
  }
}
