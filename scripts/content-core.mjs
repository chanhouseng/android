import path from 'node:path';
import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

export const SAFE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const CONTENT_STATUSES = new Set(['draft', 'published']);

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function escapeHtmlText(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function encodePathSegment(segment) {
  return encodeURIComponent(segment).replace(/[!'()*]/g, (character) => (
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  ));
}

export function encodePathSegments(relativePath) {
  return String(relativePath).split('/').map(encodePathSegment).join('/');
}

export function assertSafeId(id) {
  if (!SAFE_ID_PATTERN.test(String(id))) {
    throw new Error(`ID「${id}」不安全；只可使用小寫英文字母、數字及單一連字符分隔。`);
  }
  return id;
}

export function resolveInside(baseDirectory, relativePath, label = '路徑') {
  if (typeof relativePath !== 'string' || relativePath.length === 0 || path.isAbsolute(relativePath)) {
    throw new Error(`${label}必須是指定目錄內的相對路徑。`);
  }
  const base = path.resolve(baseDirectory);
  const target = path.resolve(base, relativePath);
  const relative = path.relative(base, target);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`${label}超出指定目錄：${relativePath}`);
  }
  return target;
}

export async function readJson(filePath, label = filePath) {
  let text;
  try {
    text = await readFile(filePath, 'utf8');
  } catch (error) {
    throw new Error(`無法讀取 ${label}：${error.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} 不是有效 JSON：${error.message}`);
  }
}

export async function writeTextAtomic(filePath, text) {
  const temporaryPath = `${filePath}.tmp-${process.pid}-${randomUUID()}`;
  await writeFile(temporaryPath, text, { encoding: 'utf8', flag: 'wx' });
  try {
    await rename(temporaryPath, filePath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw new Error(`無法更新 ${filePath}：${error.message}`);
  }
}

function lockPort(lockPath, offset = 0) {
  const digest = createHash('sha256').update(path.resolve(lockPath).toLowerCase()).digest();
  return 10000 + ((digest.readUInt32BE(0) + (offset * 7919)) % 38000);
}

async function tryAcquireLocalLock(port) {
  const server = createServer();
  return new Promise((resolve, reject) => {
    server.once('error', (error) => {
      server.close();
      if (error.code === 'EADDRINUSE') resolve({ server: null, busy: true });
      else if (error.code === 'EACCES' || error.code === 'EADDRNOTAVAIL') resolve({ server: null, unavailable: true });
      else reject(error);
    });
    server.once('listening', () => resolve({ server }));
    server.listen({ host: '127.0.0.1', port, exclusive: true });
  });
}

export async function withFileLock(lockPath, action, { timeoutMs = 5000, retryMs = 20 } = {}) {
  const startedAt = Date.now();
  let portOffset = 0;
  let server;
  while (!server) {
    const result = await tryAcquireLocalLock(lockPort(lockPath, portOffset));
    server = result.server;
    if (result.unavailable) {
      portOffset += 1;
      if (portOffset >= 16) throw new Error(`找不到可用的本機內容工作流程鎖：${lockPath}`);
      continue;
    }
    if (result.busy && Date.now() - startedAt >= timeoutMs) {
      throw new Error(`內容工作流程正在由另一個程序執行；鎖定逾時：${lockPath}`);
    }
    if (!server) await new Promise((resolve) => setTimeout(resolve, retryMs));
  }
  try {
    return await action();
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

export function sortByOrder(items) {
  return [...items].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id, 'en'));
}

export function generatedMarkers(name) {
  return {
    start: `<!-- GENERATED ${name} START -->`,
    end: `<!-- GENERATED ${name} END -->`,
  };
}

export function replaceGeneratedRegion(html, name, generatedContent) {
  const { start, end } = generatedMarkers(name);
  const startIndex = html.indexOf(start);
  const endIndex = html.indexOf(end);
  if (startIndex < 0 || endIndex < 0 || endIndex < startIndex) {
    throw new Error(`找不到有效的 ${name} 自動產生區域。`);
  }
  if (html.indexOf(start, startIndex + start.length) >= 0 || html.indexOf(end, endIndex + end.length) >= 0) {
    throw new Error(`${name} 自動產生區域標記重複。`);
  }
  return `${html.slice(0, startIndex + start.length)}\n${generatedContent}\n${html.slice(endIndex)}`;
}

const naturalCollator = new Intl.Collator('en', {
  numeric: true,
  sensitivity: 'base',
  usage: 'sort',
});

function compareExact(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function compareManifestEntries(left, right) {
  if (left.type !== right.type) return left.type === 'folder' ? -1 : 1;
  return (
    naturalCollator.compare(left.name, right.name)
    || compareExact(left.name, right.name)
    || naturalCollator.compare(left.path, right.path)
    || compareExact(left.path, right.path)
  );
}

export function isDirectInvocation(importMetaUrl) {
  const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
  return invokedPath === fileURLToPath(importMetaUrl);
}
