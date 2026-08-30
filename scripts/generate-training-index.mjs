import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SYSTEM_FILE_NAMES = new Set(['desktop.ini', 'thumbs.db', '.ds_store']);
const TEMPORARY_FILE_PATTERN = /(?:~|\.tmp|\.temp|\.swp|\.swo)$/i;
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

function isExcludedName(name) {
  const lowerName = name.toLowerCase();
  return (
    name.startsWith('.')
    || name.startsWith('~$')
    || SYSTEM_FILE_NAMES.has(lowerName)
    || TEMPORARY_FILE_PATTERN.test(name)
  );
}

function toManifestEntry(name, relativePath, parentPath, type) {
  const extension = type === 'file' ? path.extname(name).slice(1).toLowerCase() : '';
  return { name, path: relativePath, parentPath, type, extension };
}

export async function generateTrainingIndex({
  sourceDirectory = path.resolve('train'),
  outputFile = path.resolve('training/files.json'),
} = {}) {
  const sourceRoot = path.resolve(sourceDirectory);
  const outputPath = path.resolve(outputFile);
  const entries = [];

  async function scan(directory, parentPath = '') {
    const children = await readdir(directory, { withFileTypes: true });

    for (const child of children) {
      if (isExcludedName(child.name)) continue;
      if (parentPath === '' && child.isDirectory() && child.name === 'docs') continue;

      const absolutePath = path.join(directory, child.name);
      if (path.resolve(absolutePath) === outputPath) continue;

      const relativePath = parentPath ? `${parentPath}/${child.name}` : child.name;

      if (child.isDirectory()) {
        entries.push(toManifestEntry(child.name, relativePath, parentPath, 'folder'));
        await scan(absolutePath, relativePath);
      } else if (child.isFile()) {
        entries.push(toManifestEntry(child.name, relativePath, parentPath, 'file'));
      }
    }
  }

  await scan(sourceRoot);
  entries.sort(compareEntries);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');

  return entries;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  generateTrainingIndex().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
