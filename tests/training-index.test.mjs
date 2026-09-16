import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const generatorPath = path.resolve('scripts/generate-training-index.mjs');
const serverPath = path.resolve('scripts/serve-site.mjs');

async function createFixture(t, files) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'training-index-'));
  t.after(() => rm(root, { recursive: true, force: true }));

  for (const [relativePath, contents = 'fixture'] of Object.entries(files)) {
    const target = path.join(root, 'train', ...relativePath.split('/'));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, contents);
  }

  return root;
}

async function runGenerator(root) {
  await execFileAsync(process.execPath, [generatorPath], { cwd: root });
  return readFile(path.join(root, 'training', 'files.json'), 'utf8');
}

test('recursively records folders and files with original Unicode names and portable paths', async (t) => {
  const root = await createFixture(t, {
    'Module 10/子資料夾/題目 原稿.PDF': 'pdf',
    'Module 2/read me.txt': 'text',
    '根目錄.json': '{}',
  });

  const manifest = Object.fromEntries(
    JSON.parse(await runGenerator(root)).map((entry) => [entry.path, entry]),
  );

  assert.deepEqual(manifest, {
    'Module 2': {
      name: 'Module 2', path: 'Module 2', parentPath: '', type: 'folder', extension: '',
    },
    'Module 10': {
      name: 'Module 10', path: 'Module 10', parentPath: '', type: 'folder', extension: '',
    },
    'Module 10/子資料夾': {
      name: '子資料夾',
      path: 'Module 10/子資料夾',
      parentPath: 'Module 10',
      type: 'folder',
      extension: '',
    },
    'Module 2/read me.txt': {
      name: 'read me.txt',
      path: 'Module 2/read me.txt',
      parentPath: 'Module 2',
      type: 'file',
      extension: 'txt',
    },
    '根目錄.json': {
      name: '根目錄.json',
      path: '根目錄.json',
      parentPath: '',
      type: 'file',
      extension: 'json',
    },
    'Module 10/子資料夾/題目 原稿.PDF': {
      name: '題目 原稿.PDF',
      path: 'Module 10/子資料夾/題目 原稿.PDF',
      parentPath: 'Module 10/子資料夾',
      type: 'file',
      extension: 'pdf',
    },
  });
});

test('excludes hidden, system, temporary, and root train/docs entries', async (t) => {
  const root = await createFixture(t, {
    '.hidden.txt': '',
    '.private/secret.txt': '',
    'docs/development-plan.md': '',
    'desktop.ini': '',
    'THUMBS.DB': '',
    '.DS_Store': '',
    'draft~': '',
    'cache.tmp': '',
    'cache.TMP': '',
    '~$document.docx': '',
    'editor.swp': '',
    'nested/docs/keep.md': '',
    'keep.zip': '',
  });

  const manifest = JSON.parse(await runGenerator(root));

  assert.deepEqual(
    manifest.map(({ path: entryPath }) => entryPath).toSorted(),
    ['keep.zip', 'nested', 'nested/docs', 'nested/docs/keep.md'],
  );
});

test('sorts every folder before every file and compares names naturally', async (t) => {
  const root = await createFixture(t, {
    'Folder 10/item.txt': '',
    'Folder 2/item.txt': '',
    'File 10.txt': '',
    'File 2.txt': '',
  });

  const manifest = JSON.parse(await runGenerator(root));

  assert.deepEqual(
    manifest.map(({ type, path: entryPath }) => `${type}:${entryPath}`),
    [
      'folder:Folder 2',
      'folder:Folder 10',
      'file:File 2.txt',
      'file:File 10.txt',
      'file:Folder 2/item.txt',
      'file:Folder 10/item.txt',
    ],
  );
});

test('writes byte-for-byte identical JSON when the input tree is unchanged', async (t) => {
  const root = await createFixture(t, {
    'Module 10/z.txt': '',
    'Module 2/a.txt': '',
  });

  const first = await runGenerator(root);
  const second = await runGenerator(root);

  assert.equal(second, first);
  assert.equal(first, `${JSON.stringify(JSON.parse(first), null, 2)}\n`);
});

async function startSiteServer(t) {
  const { createSiteServer } = await import(`${pathToFileURL(serverPath).href}?test=${Date.now()}`);
  const server = createSiteServer({ root: process.cwd() });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
}

function requestRawPath(origin, requestPath) {
  return new Promise((resolve, reject) => {
    const target = new URL(origin);
    const clientRequest = request({
      host: target.hostname,
      method: 'GET',
      path: requestPath,
      port: target.port,
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({
        body: Buffer.concat(chunks).toString('utf8'),
        headers: response.headers,
        status: response.statusCode,
      }));
    });
    clientRequest.on('error', reject);
    clientRequest.end();
  });
}

test('site server serves canonical Training routes and keeps deep assets typed correctly', async (t) => {
  const origin = await startSiteServer(t);
  for (const pathname of ['/training/', '/training/Stroop%20Challenge/', '/training/Module%20A/nested/']) {
    const response = await fetch(`${origin}${pathname}`);
    assert.equal(response.status, 200, pathname);
    assert.match(response.headers.get('content-type') ?? '', /^text\/html/);
    assert.match(await response.text(), /id=["']training-browser["']/);
  }

  for (const [pathname, contentType] of [
    ['/training/styles.css', /^text\/css/],
    ['/training/app.js', /javascript/],
    ['/training/files.json', /^application\/json/],
  ]) {
    const response = await fetch(`${origin}${pathname}`);
    const body = await response.text();
    assert.equal(response.status, 200, pathname);
    assert.match(response.headers.get('content-type') ?? '', contentType);
    assert.doesNotMatch(body, /<!doctype html>/i);
  }
});

test('Training app normalizes valid legacy query paths even when the folder is missing', async () => {
  const appSource = await readFile(path.resolve('training', 'app.js'), 'utf8');

  assert.match(appSource, /route\.isLegacy\s*&&\s*route\.canonicalUrl/);
  assert.match(appSource, /updateTrainingHistory\(window\.history,\s*requestedPath,\s*\{\s*replace:\s*true\s*\}\)/);
});

test('site server redirects legacy folders without intercepting train files', async (t) => {
  const origin = await startSiteServer(t);
  const legacy = await fetch(`${origin}/train/Stroop%20Challenge/`, { redirect: 'manual' });
  assert.equal(legacy.status, 301);
  assert.equal(legacy.headers.get('location'), '/training/Stroop%20Challenge/');

  const redirected = await fetch(`${origin}${legacy.headers.get('location')}`);
  assert.equal(redirected.status, 200);
  assert.match(await redirected.text(), /id=["']training-browser["']/);

  const file = await fetch(`${origin}/train/Stroop%20Challenge/Module%20Stroop%20Challenge(CO).pdf`, { redirect: 'manual' });
  assert.equal(file.status, 200);
  assert.match(file.headers.get('content-type') ?? '', /^application\/pdf/);
  assert.equal(file.headers.has('location'), false);

  const missingFile = await fetch(`${origin}/train/Stroop%20Challenge/example.pdf`, { redirect: 'manual' });
  assert.equal(missingFile.status, 404);
  assert.equal(missingFile.headers.has('location'), false);
});

test('site server rejects traversal and never lists arbitrary directories', async (t) => {
  const origin = await startSiteServer(t);
  for (const pathname of ['/train/%2E%2E/homework/index.html', '/train/..%2Fhomework%2Findex.html', '/train/']) {
    const response = await requestRawPath(origin, pathname);
    assert.ok([400, 404].includes(response.status), `${pathname}: ${response.status}`);
    assert.doesNotMatch(response.body, /<title>Index of \/train/i);
  }
});
