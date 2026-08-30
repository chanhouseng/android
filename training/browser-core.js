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
  const breadcrumbs = [{ name: 'train', path: '' }];
  const segments = currentPath.split('/').filter(Boolean);

  for (let index = 0; index < segments.length; index += 1) {
    breadcrumbs.push({
      name: segments[index],
      path: segments.slice(0, index + 1).join('/'),
    });
  }

  return breadcrumbs;
}

export function resolveCurrentFolder(entries, requestedPath = '') {
  if (!requestedPath) return '';
  return entries.some((entry) => entry.type === 'folder' && entry.path === requestedPath)
    ? requestedPath
    : '';
}

export function encodePathSegments(relativePath) {
  return relativePath.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

export function buildFolderUrl(folderPath = '') {
  if (!folderPath) return '/training/';
  const encodedPath = encodePathSegments(folderPath).replaceAll('/', '%2F');
  return `/training/?path=${encodedPath}`;
}

export function buildFileUrl(filePath) {
  return `/train/${encodePathSegments(filePath)}`;
}
