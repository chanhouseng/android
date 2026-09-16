import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const defaultRoot = path.resolve(path.dirname(scriptPath), '..');

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.htm', 'text/html; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.mp3', 'audio/mpeg'],
  ['.pdf', 'application/pdf'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.wav', 'audio/wav'],
  ['.webp', 'image/webp'],
  ['.zip', 'application/zip'],
]);

function encodePathSegments(relativePath) {
  return relativePath.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

function sendText(response, statusCode, message, method = 'GET') {
  const body = `${message}\n`;
  response.writeHead(statusCode, {
    'Content-Length': Buffer.byteLength(body),
    'Content-Type': 'text/plain; charset=utf-8',
  });
  response.end(method === 'HEAD' ? undefined : body);
}

async function getFileStat(filePath) {
  try {
    return await stat(filePath);
  } catch {
    return null;
  }
}

function resolveInside(root, decodedPathname) {
  const target = path.resolve(root, `.${decodedPathname}`);
  const relative = path.relative(root, target);
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) return target;
  return null;
}

function decodeRequestPath(requestUrl = '/') {
  const rawPathname = requestUrl.split(/[?#]/, 1)[0] || '/';
  let pathname;
  try {
    pathname = decodeURIComponent(rawPathname);
  } catch {
    return null;
  }

  if (!pathname.startsWith('/') || pathname.includes('\0') || pathname.includes('\\')) return null;
  const segments = pathname.split('/');
  if (segments.some((segment) => segment === '.' || segment === '..')) return null;
  return pathname;
}

async function sendFile(response, filePath, method) {
  const fileStat = await getFileStat(filePath);
  if (!fileStat?.isFile()) return false;

  response.writeHead(200, {
    'Content-Length': fileStat.size,
    'Content-Type': mimeTypes.get(path.extname(filePath).toLocaleLowerCase('en')) ?? 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
  });
  if (method === 'HEAD') response.end();
  else createReadStream(filePath).pipe(response);
  return true;
}

async function handleTrainRoute({ pathname, request, response, root }) {
  const relativePath = pathname.slice('/train/'.length).replace(/\/$/, '');
  if (!relativePath) {
    sendText(response, 404, 'Not Found', request.method);
    return;
  }

  const target = resolveInside(path.join(root, 'train'), `/${relativePath}`);
  if (!target) {
    sendText(response, 400, 'Bad Request', request.method);
    return;
  }

  const targetStat = await getFileStat(target);
  if (targetStat?.isDirectory()) {
    response.writeHead(301, { Location: `/training/${encodePathSegments(relativePath)}/` });
    response.end();
    return;
  }

  if (!pathname.endsWith('/') && await sendFile(response, target, request.method)) return;
  sendText(response, 404, 'Not Found', request.method);
}

async function handleTrainingRoute({ pathname, request, response, root }) {
  if (pathname === '/training') {
    response.writeHead(308, { Location: '/training/' });
    response.end();
    return;
  }

  const staticTarget = resolveInside(root, pathname);
  if (staticTarget && await sendFile(response, staticTarget, request.method)) return;

  if (path.extname(pathname)) {
    sendText(response, 404, 'Not Found', request.method);
    return;
  }

  if (!pathname.endsWith('/')) {
    response.writeHead(308, { Location: `${encodeURI(pathname)}/` });
    response.end();
    return;
  }

  await sendFile(response, path.join(root, 'training', 'index.html'), request.method);
}

async function handleStaticRoute({ pathname, request, response, root }) {
  const target = resolveInside(root, pathname);
  if (!target) {
    sendText(response, 400, 'Bad Request', request.method);
    return;
  }

  const targetStat = await getFileStat(target);
  if (targetStat?.isFile()) {
    await sendFile(response, target, request.method);
    return;
  }

  if (targetStat?.isDirectory()) {
    if (!pathname.endsWith('/')) {
      response.writeHead(308, { Location: `${encodeURI(pathname)}/` });
      response.end();
      return;
    }
    if (await sendFile(response, path.join(target, 'index.html'), request.method)) return;
  }

  sendText(response, 404, 'Not Found', request.method);
}

export function createSiteServer({ root = defaultRoot } = {}) {
  const siteRoot = path.resolve(root);

  return createServer((request, response) => {
    Promise.resolve().then(async () => {
      if (!['GET', 'HEAD'].includes(request.method ?? 'GET')) {
        response.setHeader('Allow', 'GET, HEAD');
        sendText(response, 405, 'Method Not Allowed', request.method);
        return;
      }

      const pathname = decodeRequestPath(request.url);
      if (pathname === null) {
        sendText(response, 400, 'Bad Request', request.method);
        return;
      }

      if (pathname === '/train' || pathname.startsWith('/train/')) {
        await handleTrainRoute({ pathname, request, response, root: siteRoot });
      } else if (pathname === '/training' || pathname.startsWith('/training/')) {
        await handleTrainingRoute({ pathname, request, response, root: siteRoot });
      } else {
        await handleStaticRoute({ pathname, request, response, root: siteRoot });
      }
    }).catch((error) => {
      console.error('Unable to serve request', error);
      if (!response.headersSent) sendText(response, 500, 'Internal Server Error', request.method);
      else response.destroy();
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const port = Number.parseInt(process.env.PORT ?? '8765', 10);
  const host = process.env.HOST ?? '127.0.0.1';
  const server = createSiteServer();
  server.listen(port, host, () => {
    console.log(`Android Learning site: http://${host}:${port}/`);
  });
}
