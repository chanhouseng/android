const naturalCollator = new Intl.Collator('en', {
  numeric: true,
  sensitivity: 'base',
  usage: 'sort',
});

function compareExact(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function compareEntries(left, right) {
  if (left.type !== right.type) return left.type === 'folder' ? -1 : 1;

  return (
    naturalCollator.compare(left.name, right.name)
    || compareExact(left.name, right.name)
    || naturalCollator.compare(left.path, right.path)
    || compareExact(left.path, right.path)
  );
}

export function sortEntries(entries) {
  return [...entries].sort(compareEntries);
}

export function getImmediateChildren(entries, currentPath = '') {
  return sortEntries(entries.filter((entry) => entry.parentPath === currentPath));
}

function normalizeForSearch(value) {
  return value.normalize('NFKC').toLocaleLowerCase('en');
}

export function searchEntries(entries, query) {
  const normalizedQuery = normalizeForSearch(query.trim());
  if (!normalizedQuery) return [];

  return sortEntries(entries.filter((entry) => (
    normalizeForSearch(entry.name).includes(normalizedQuery)
  )));
}

export function buildBreadcrumbs(currentPath = '') {
  const breadcrumbs = [{ name: 'training', path: '', href: buildFolderUrl('') }];
  const segments = currentPath.split('/').filter(Boolean);

  for (let index = 0; index < segments.length; index += 1) {
    const breadcrumbPath = segments.slice(0, index + 1).join('/');
    breadcrumbs.push({
      name: segments[index],
      path: breadcrumbPath,
      href: buildFolderUrl(breadcrumbPath),
    });
  }

  return breadcrumbs;
}

export function resolveCurrentFolder(entries, requestedPath = '') {
  if (!requestedPath) return '';
  return entries.some((entry) => entry.type === 'folder' && entry.path === requestedPath)
    ? requestedPath
    : null;
}

export function encodePathSegments(relativePath) {
  return relativePath.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

export function buildFolderUrl(folderPath = '') {
  if (!folderPath) return '/training/';
  return `/training/${encodePathSegments(folderPath)}/`;
}

export function buildFileUrl(filePath) {
  return `/train/${encodePathSegments(filePath)}`;
}

function decodePathSegment(segment) {
  let decoded;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    return null;
  }

  if (!decoded.trim() || decoded === '.' || decoded === '..') return null;
  if (decoded.includes('/') || decoded.includes('\\')) return null;
  return decoded;
}

function validateDecodedPath(decodedPath) {
  if (decodedPath === '') return '';
  if (decodedPath.includes('\\')) return null;

  const segments = decodedPath.split('/');
  if (segments.some((segment) => !segment.trim() || segment === '.' || segment === '..')) return null;
  return segments.join('/');
}

export function parseTrainingPathname(pathname = '/training/') {
  const pathOnly = String(pathname).split(/[?#]/, 1)[0];
  if (pathOnly === '/training' || pathOnly === '/training/') return '';
  if (!pathOnly.startsWith('/training/') || !pathOnly.endsWith('/')) return null;

  const encodedPath = pathOnly.slice('/training/'.length, -1);
  if (!encodedPath) return '';

  const decodedSegments = encodedPath.split('/').map(decodePathSegment);
  if (decodedSegments.some((segment) => segment === null)) return null;
  return decodedSegments.join('/');
}

function readLegacyPath(search = '') {
  const query = String(search).replace(/^\?/, '');
  if (!query) return { present: false, path: null };

  for (const pair of query.split('&')) {
    const separator = pair.indexOf('=');
    const encodedKey = separator === -1 ? pair : pair.slice(0, separator);
    const encodedValue = separator === -1 ? '' : pair.slice(separator + 1);
    let key;
    let value;

    try {
      key = decodeURIComponent(encodedKey.replaceAll('+', ' '));
      value = decodeURIComponent(encodedValue.replaceAll('+', ' '));
    } catch {
      if (encodedKey === 'path') return { present: true, path: null };
      continue;
    }

    if (key === 'path') return { present: true, path: validateDecodedPath(value) };
  }

  return { present: false, path: null };
}

export function parseTrainingRoute(pathname = '/training/', search = '') {
  const legacy = readLegacyPath(search);
  const path = legacy.present ? legacy.path : parseTrainingPathname(pathname);
  const isValid = path !== null;

  return {
    path,
    isLegacy: legacy.present,
    isValid,
    canonicalUrl: isValid ? buildFolderUrl(path) : null,
  };
}

export function resolveTrainingRoute(entries, pathname = '/training/', search = '') {
  const route = parseTrainingRoute(pathname, search);
  const resolvedPath = route.isValid ? resolveCurrentFolder(entries, route.path) : null;

  return {
    status: resolvedPath === null ? 'not-found' : 'ready',
    path: resolvedPath,
    requestedPath: route.path,
    isLegacy: route.isLegacy,
    canonicalUrl: route.canonicalUrl,
  };
}

export function updateTrainingHistory(history, folderPath = '', { replace = false } = {}) {
  const url = buildFolderUrl(folderPath);
  const method = replace ? 'replaceState' : 'pushState';
  history[method]({ path: folderPath }, '', url);
  return url;
}
