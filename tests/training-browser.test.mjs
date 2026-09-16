import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const browserCorePath = path.resolve('training/browser-core.js');

async function loadCore(...exportNames) {
  assert.equal(existsSync(browserCorePath), true, 'training/browser-core.js should exist');
  const core = await import(pathToFileURL(browserCorePath));

  for (const exportName of exportNames) {
    assert.equal(typeof core[exportName], 'function', `${exportName} should be exported`);
  }

  return core;
}

const entries = [
  { name: 'Module 10', path: 'Module 10', parentPath: '', type: 'folder', extension: '' },
  { name: 'root.txt', path: 'root.txt', parentPath: '', type: 'file', extension: 'txt' },
  { name: 'Module 2', path: 'Module 2', parentPath: '', type: 'folder', extension: '' },
  {
    name: 'nested.txt',
    path: 'Module 2/nested.txt',
    parentPath: 'Module 2',
    type: 'file',
    extension: 'txt',
  },
  {
    name: 'assets',
    path: 'Module 2/assets',
    parentPath: 'Module 2',
    type: 'folder',
    extension: '',
  },
];

test('getImmediateChildren returns only direct children of the requested folder', async () => {
  const { getImmediateChildren } = await loadCore('getImmediateChildren');

  assert.deepEqual(
    getImmediateChildren(entries, 'Module 2').map(({ path: entryPath }) => entryPath),
    ['Module 2/assets', 'Module 2/nested.txt'],
  );
});

test('sortEntries places folders first and compares numeric names naturally', async () => {
  const { sortEntries } = await loadCore('sortEntries');

  assert.deepEqual(
    sortEntries(entries).map(({ type, name }) => `${type}:${name}`),
    [
      'folder:assets',
      'folder:Module 2',
      'folder:Module 10',
      'file:nested.txt',
      'file:root.txt',
    ],
  );
});

const searchableEntries = [
  {
    name: 'Module 10',
    path: 'Archive/Module 10',
    parentPath: 'Archive',
    type: 'folder',
    extension: '',
  },
  {
    name: 'Module 2',
    path: 'Archive/Module 2',
    parentPath: 'Archive',
    type: 'folder',
    extension: '',
  },
  {
    name: 'Module 10.pdf',
    path: 'Files/Module 10.pdf',
    parentPath: 'Files',
    type: 'file',
    extension: 'pdf',
  },
  {
    name: 'Module 2.pdf',
    path: 'Files/Module 2.pdf',
    parentPath: 'Files',
    type: 'file',
    extension: 'pdf',
  },
];

test('searchEntries places matching folders before files and naturally sorts each group', async () => {
  const { searchEntries } = await loadCore('searchEntries');

  assert.deepEqual(
    searchEntries(searchableEntries, 'Module').map(({ type, name }) => `${type}:${name}`),
    [
      'folder:Module 2',
      'folder:Module 10',
      'file:Module 2.pdf',
      'file:Module 10.pdf',
    ],
  );
});

test('searchEntries includes folders whose names match', async () => {
  const { searchEntries } = await loadCore('searchEntries');

  assert.deepEqual(searchEntries(searchableEntries, 'Module 2').map(({ type, name }) => [type, name]), [
    ['folder', 'Module 2'],
    ['file', 'Module 2.pdf'],
  ]);
});

test('searchEntries does not match file parentPath or complete path', async () => {
  const { searchEntries } = await loadCore('searchEntries');
  const pathOnlyEntry = {
    name: 'guide.pdf',
    path: 'Archive/Module 7/guide.pdf',
    parentPath: 'Archive/Module 7',
    type: 'file',
    extension: 'pdf',
  };

  assert.deepEqual(searchEntries([pathOnlyEntry], 'Module 7'), []);
  assert.deepEqual(searchEntries([pathOnlyEntry], 'Archive/Module 7'), []);
});

test('searchEntries still finds files whose names match', async () => {
  const { searchEntries } = await loadCore('searchEntries');
  const fileEntry = {
    name: 'reference guide.pdf',
    path: 'Archive/reference guide.pdf',
    parentPath: 'Archive',
    type: 'file',
    extension: 'pdf',
  };

  assert.deepEqual(searchEntries([fileEntry], 'guide.pdf'), [fileEntry]);
});

test('searchEntries compares names without regard to case', async () => {
  const { searchEntries } = await loadCore('searchEntries');

  assert.deepEqual(searchEntries(searchableEntries, 'mOdUlE 2').map((entry) => entry.name), [
    'Module 2',
    'Module 2.pdf',
  ]);
});

test('searchEntries matches names after NFKC Unicode normalization', async () => {
  const { searchEntries } = await loadCore('searchEntries');
  const unicodeEntry = {
    name: '\uff23\uff41\uff46\uff45\u0301 Guide.PDF',
    path: 'Guides/\uff23\uff41\uff46\uff45\u0301 Guide.PDF',
    parentPath: 'Guides',
    type: 'file',
    extension: 'pdf',
  };

  assert.deepEqual(searchEntries([unicodeEntry], 'caf\u00e9 guide'), [unicodeEntry]);
});

test('searchEntries returns an empty array for a whitespace-only query', async () => {
  const { searchEntries } = await loadCore('searchEntries');

  assert.deepEqual(searchEntries(searchableEntries, '  \t\n  '), []);
});

test('buildBreadcrumbs creates cumulative canonical URLs from the training root', async () => {
  const { buildBreadcrumbs } = await loadCore('buildBreadcrumbs');

  assert.deepEqual(buildBreadcrumbs('Module A/資料 子'), [
    { name: 'training', path: '', href: '/training/' },
    { name: 'Module A', path: 'Module A', href: '/training/Module%20A/' },
    {
      name: '資料 子',
      path: 'Module A/資料 子',
      href: '/training/Module%20A/%E8%B3%87%E6%96%99%20%E5%AD%90/',
    },
  ]);
  assert.deepEqual(buildBreadcrumbs(''), [{ name: 'training', path: '', href: '/training/' }]);
});

test('resolveCurrentFolder distinguishes missing folders from the root folder', async () => {
  const { resolveCurrentFolder } = await loadCore('resolveCurrentFolder');

  assert.equal(resolveCurrentFolder(entries, 'Module 2'), 'Module 2');
  assert.equal(resolveCurrentFolder(entries, ''), '');
  assert.equal(resolveCurrentFolder(entries, 'root.txt'), null);
  assert.equal(resolveCurrentFolder(entries, 'missing/folder'), null);
});

test('encodePathSegments encodes each segment while preserving path separators', async () => {
  const { encodePathSegments } = await loadCore('encodePathSegments');

  assert.equal(
    encodePathSegments('Module A/資料 #1?.pdf'),
    'Module%20A/%E8%B3%87%E6%96%99%20%231%3F.pdf',
  );
});

test('buildFolderUrl creates canonical path URLs with independently encoded segments', async () => {
  const { buildFolderUrl } = await loadCore('buildFolderUrl');

  assert.equal(
    buildFolderUrl('Module A/資料 #1'),
    '/training/Module%20A/%E8%B3%87%E6%96%99%20%231/',
  );
  assert.equal(buildFolderUrl('Round (1)/A&B'), '/training/Round%20(1)/A%26B/');
  assert.equal(buildFolderUrl(''), '/training/');
});

test('parseTrainingPathname decodes each path segment and preserves nested folders', async () => {
  const { parseTrainingPathname } = await loadCore('parseTrainingPathname');

  assert.equal(parseTrainingPathname('/training/'), '');
  assert.equal(parseTrainingPathname('/training/Module%20A/media/images/'), 'Module A/media/images');
  assert.equal(
    parseTrainingPathname('/training/%E8%B3%87%E6%96%99/%E9%A1%8C%E7%9B%AE%20(1)/'),
    '資料/題目 (1)',
  );
});

test('parseTrainingPathname rejects unsafe, empty and malformed segments without throwing', async () => {
  const { parseTrainingPathname } = await loadCore('parseTrainingPathname');

  for (const pathname of [
    '/training/Module%20A',
    '/training/Module%20A//images/',
    '/training/./images/',
    '/training/%2E%2E/images/',
    '/training/%20/images/',
    '/training/Module%2FA/images/',
    '/training/Module%5CA/images/',
    '/training/%E0%A4%A/',
    '/knowledge/Module%20A/',
  ]) {
    assert.doesNotThrow(() => parseTrainingPathname(pathname));
    assert.equal(parseTrainingPathname(pathname), null, pathname);
  }
});

test('parseTrainingRoute supports legacy query URLs and returns a canonical replacement', async () => {
  const { parseTrainingRoute } = await loadCore('parseTrainingRoute');

  assert.deepEqual(parseTrainingRoute('/training/', '?path=Module%20A'), {
    path: 'Module A',
    isLegacy: true,
    isValid: true,
    canonicalUrl: '/training/Module%20A/',
  });
  assert.deepEqual(parseTrainingRoute('/training/', '?path=Module%20A%2Fmedia'), {
    path: 'Module A/media',
    isLegacy: true,
    isValid: true,
    canonicalUrl: '/training/Module%20A/media/',
  });
  assert.deepEqual(parseTrainingRoute('/training/', '?path=%E0%A4%A'), {
    path: null,
    isLegacy: true,
    isValid: false,
    canonicalUrl: null,
  });
});

test('resolveTrainingRoute preserves missing and malformed paths as Not Found states', async () => {
  const { resolveTrainingRoute } = await loadCore('resolveTrainingRoute');

  assert.deepEqual(resolveTrainingRoute(entries, '/training/Module%202/', ''), {
    status: 'ready',
    path: 'Module 2',
    requestedPath: 'Module 2',
    isLegacy: false,
    canonicalUrl: '/training/Module%202/',
  });
  assert.deepEqual(resolveTrainingRoute(entries, '/training/missing/folder/', ''), {
    status: 'not-found',
    path: null,
    requestedPath: 'missing/folder',
    isLegacy: false,
    canonicalUrl: '/training/missing/folder/',
  });
  assert.equal(resolveTrainingRoute(entries, '/training/%2E%2E/private/', '').status, 'not-found');
});

test('updateTrainingHistory uses canonical folder URLs for push and replace navigation', async () => {
  const { updateTrainingHistory } = await loadCore('updateTrainingHistory');
  const calls = [];
  const history = {
    pushState: (...args) => calls.push(['pushState', ...args]),
    replaceState: (...args) => calls.push(['replaceState', ...args]),
  };

  assert.equal(updateTrainingHistory(history, 'Module A'), '/training/Module%20A/');
  assert.equal(updateTrainingHistory(history, 'Module A/media', { replace: true }), '/training/Module%20A/media/');
  assert.deepEqual(calls, [
    ['pushState', { path: 'Module A' }, '', '/training/Module%20A/'],
    ['replaceState', { path: 'Module A/media' }, '', '/training/Module%20A/media/'],
  ]);
});

test('buildFileUrl creates a same-origin train URL with independently encoded segments', async () => {
  const { buildFileUrl } = await loadCore('buildFileUrl');

  assert.equal(
    buildFileUrl('Module A/資料 #1?.pdf'),
    '/train/Module%20A/%E8%B3%87%E6%96%99%20%231%3F.pdf',
  );
});
