import path from 'node:path';
import { lstat, readdir, realpath } from 'node:fs/promises';
import {
  compareManifestEntries,
  encodePathSegments,
  isDirectInvocation,
  readJson,
  withFileLock,
  writeTextAtomic,
} from './content-core.mjs';

const SENSITIVE_NAMES = new Set([
  'local.properties', 'credentials.json', 'credential.json',
  'id_rsa', 'id_dsa', 'id_ecdsa', 'id_ed25519',
]);
const SENSITIVE_EXTENSIONS = new Set(['.pem', '.key', '.p12', '.pfx', '.jks', '.keystore']);
const SYSTEM_FILE_NAMES = new Set(['desktop.ini', 'thumbs.db', '.ds_store']);
const TEMPORARY_FILE_PATTERN = /(?:~|\.tmp|\.temp|\.swp|\.swo)$/i;

function sensitiveReason(name) {
  const lower = name.toLowerCase();
  if (lower === '.env' || lower.startsWith('.env.')) return '.env 設定檔';
  if (name.startsWith('.') || name.startsWith('~$')) return '隱藏、憑證或暫存檔';
  if (SYSTEM_FILE_NAMES.has(lower) || TEMPORARY_FILE_PATTERN.test(name)) return '系統或暫存檔';
  if (SENSITIVE_NAMES.has(lower)) return 'credentials／本機設定或私鑰檔';
  if (SENSITIVE_EXTENSIONS.has(path.extname(lower))) return '私鑰或 keystore';
  if (/credential|secret/.test(lower)) return '檔名包含 credential 或 secret';
  return null;
}

function validateFolderName(folderName) {
  if (
    typeof folderName !== 'string'
    || folderName.length === 0
    || folderName === '.'
    || folderName === '..'
    || path.isAbsolute(folderName)
    || folderName.includes('/')
    || folderName.includes('\\')
  ) {
    throw new Error('Training 資料夾必須是 train/ 下單一、安全的直接子資料夾名稱。');
  }
}

function ensureRealPathInside(rootRealPath, candidateRealPath, label) {
  const relative = path.relative(rootRealPath, candidateRealPath);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`${label} 經由 symlink 或路徑穿越離開 train/，已停止發佈。`);
  }
}

function manifestEntry(name, entryPath, parentPath, type) {
  return {
    name,
    path: entryPath,
    parentPath,
    type,
    extension: type === 'file' ? path.extname(name).slice(1).toLowerCase() : '',
  };
}

export async function publishTrainingFolder({ rootDirectory = process.cwd(), folderName } = {}) {
  validateFolderName(folderName);
  const rootSensitiveReason = sensitiveReason(folderName);
  if (rootSensitiveReason) {
    throw new Error(`train/${folderName}/ 是敏感或不允許發佈的根資料夾：${rootSensitiveReason}。`);
  }
  const projectRoot = path.resolve(rootDirectory);
  const trainRoot = path.join(projectRoot, 'train');
  let rootChildren;
  try {
    rootChildren = await readdir(trainRoot, { withFileTypes: true });
  } catch (error) {
    throw new Error(`無法讀取 train/：${error.message}`);
  }
  const exactChild = rootChildren.find(({ name }) => name === folderName);
  if (!exactChild) {
    const caseMatch = rootChildren.find(({ name }) => name.localeCompare(folderName, undefined, { sensitivity: 'accent' }) === 0);
    const hint = caseMatch ? `；實際大小寫為「${caseMatch.name}」` : '';
    throw new Error(`找不到名稱及大小寫完全相符的 train/${folderName}/${hint}`);
  }
  if (!exactChild.isDirectory() || exactChild.isSymbolicLink()) {
    throw new Error(`train/${folderName}/ 必須是真實資料夾，不能是 symlink。`);
  }
  const sourceFolder = path.join(trainRoot, exactChild.name);
  const [trainRealPath, sourceDetails] = await Promise.all([realpath(trainRoot), lstat(sourceFolder)]).catch((error) => {
    throw new Error(`找不到 train/${folderName}/：${error.message}`);
  });
  if (sourceDetails.isSymbolicLink() || !sourceDetails.isDirectory()) throw new Error(`train/${folderName}/ 必須是真實資料夾，不能是 symlink。`);
  const sourceRealPath = await realpath(sourceFolder);
  ensureRealPathInside(trainRealPath, sourceRealPath, `train/${folderName}/`);

  const entries = [manifestEntry(folderName, folderName, '', 'folder')];
  const securityErrors = [];

  async function scan(directory, parentPath) {
    const children = await readdir(directory, { withFileTypes: true });
    for (const child of children) {
      const relativePath = `${parentPath}/${child.name}`;
      const reason = sensitiveReason(child.name);
      if (reason) {
        securityErrors.push(`${relativePath}：${reason}`);
        continue;
      }
      const absolutePath = path.join(directory, child.name);
      const details = await lstat(absolutePath);
      if (details.isSymbolicLink() || child.isSymbolicLink()) {
        securityErrors.push(`${relativePath}：symlink 不允許發佈`);
        continue;
      }
      const childRealPath = await realpath(absolutePath);
      try {
        ensureRealPathInside(sourceRealPath, childRealPath, relativePath);
      } catch (error) {
        securityErrors.push(error.message);
        continue;
      }
      if (details.isDirectory()) {
        entries.push(manifestEntry(child.name, relativePath, parentPath, 'folder'));
        await scan(absolutePath, relativePath);
      } else if (details.isFile()) {
        entries.push(manifestEntry(child.name, relativePath, parentPath, 'file'));
      } else {
        securityErrors.push(`${relativePath}：不支援的檔案類型`);
      }
    }
  }

  await scan(sourceFolder, folderName);
  if (securityErrors.length) {
    throw new Error(`發現敏感或不安全檔案，未修改 training/files.json：\n${securityErrors.map((error) => `- ${error}`).join('\n')}`);
  }

  const manifestPath = path.join(projectRoot, 'training', 'files.json');
  return withFileLock(`${manifestPath}.lock`, async () => {
    const existing = await readJson(manifestPath, 'training/files.json');
    if (!Array.isArray(existing)) throw new Error('training/files.json 必須維持現有陣列格式。');
    const prefix = `${folderName}/`;
    const preserved = existing.filter(({ path: entryPath }) => entryPath !== folderName && !String(entryPath).startsWith(prefix));
    const merged = [...preserved, ...entries].sort(compareManifestEntries);
    await writeTextAtomic(manifestPath, `${JSON.stringify(merged, null, 2)}\n`);
    return { folderName, added: entries.length, total: merged.length };
  });
}

if (isDirectInvocation(import.meta.url)) {
  const [folderName, ...extra] = process.argv.slice(2);
  if (!folderName || extra.length) {
    console.error('用法：node scripts/publish-training-folder.mjs "Training 資料夾名稱"');
    process.exitCode = 1;
  } else {
    publishTrainingFolder({ folderName }).then(({ added, total }) => {
      console.log(`已安全發佈 train/${folderName}/：合併 ${added} 筆，manifest 共 ${total} 筆。`);
      console.log(`公開網址：/training/${encodePathSegments(folderName)}/`);
    }).catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
  }
}
