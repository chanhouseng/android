import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const generatorPath = path.resolve('scripts/generate-training-index.mjs');

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
