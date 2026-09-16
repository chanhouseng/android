import path from 'node:path';
import { lstat, readdir, readFile, realpath } from 'node:fs/promises';
import {
  CONTENT_STATUSES,
  SAFE_ID_PATTERN,
  isDirectInvocation,
  readJson,
} from './content-core.mjs';
import { buildContentIndexes } from './build-content-indexes.mjs';

const SCHEMAS = {
  homework: ['id', 'title', 'description', 'image', 'resultPage', 'trainingFolder', 'status', 'order'],
  worldSkills: ['id', 'title', 'description', 'image', 'detailPage', 'group', 'searchText', 'status', 'order'],
};

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateStringArray(value, label, errors, { nonEmpty = false } = {}) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || (nonEmpty && entry.length === 0))) {
    errors.push(`${label}：必須是字串陣列。`);
  }
}

function validatePresentation(presentation, label, errors) {
  if (!isRecord(presentation) || !['list', 'paragraph', 'paragraphs', 'lead-list'].includes(presentation.type)) {
    errors.push(`${label}.presentation：必須使用支援的結構及 type。`);
    return;
  }
  if (presentation.variant !== undefined && typeof presentation.variant !== 'string') {
    errors.push(`${label}.presentation.variant：必須是字串。`);
  }
  if (presentation.type === 'list') validateStringArray(presentation.items, `${label}.presentation.items`, errors);
  if (presentation.type === 'lead-list') {
    if (typeof presentation.lead !== 'string') errors.push(`${label}.presentation.lead：必須是字串。`);
    validateStringArray(presentation.items, `${label}.presentation.items`, errors);
  }
  if (presentation.type === 'paragraphs' && (
    !Array.isArray(presentation.items)
    || presentation.items.some((entry) => !isRecord(entry) || typeof entry.text !== 'string' || (entry.tone !== undefined && entry.tone !== 'comment'))
  )) {
    errors.push(`${label}.presentation.items：paragraphs 必須是含 text 字串及可選 comment tone 的物件陣列。`);
  }
}

function validateRecords(kind, items, errors) {
  if (!Array.isArray(items)) {
    errors.push(`${kind}：JSON 最外層必須是陣列。`);
    return [];
  }
  const ids = new Map();
  const orders = new Map();
  const usable = [];
  items.forEach((item, index) => {
    const label = `${kind}[${index}]`;
    if (!isRecord(item)) {
      errors.push(`${label}：項目必須是物件。`);
      return;
    }
    usable.push(item);
    for (const field of SCHEMAS[kind]) {
      if (!(field in item)) errors.push(`${label}：缺少必要欄位「${field}」。`);
    }
    if (!SAFE_ID_PATTERN.test(String(item.id ?? ''))) errors.push(`${label}.id：只可使用小寫英文字母、數字及連字符。`);
    if (ids.has(item.id)) errors.push(`${label}.id：重複 ID「${item.id}」，首次出現在第 ${ids.get(item.id) + 1} 項。`);
    else ids.set(item.id, index);
    if (!Number.isInteger(item.order) || item.order < 1) errors.push(`${label}.order：排序值必須是大於零的整數。`);
    else if (orders.has(item.order)) errors.push(`${label}.order：排序值 ${item.order} 重複。`);
    else orders.set(item.order, index);
    if (!CONTENT_STATUSES.has(item.status)) errors.push(`${label}.status：只可為 draft 或 published。`);
    for (const field of ['title', 'description']) {
      if (typeof item[field] !== 'string') errors.push(`${label}.${field}：必須是字串。`);
    }
    if (item.image !== null && (typeof item.image !== 'string' || item.image.length === 0)) errors.push(`${label}.image：必須是非空相對路徑字串或 null。`);
    if (item.imageAlt !== undefined && typeof item.imageAlt !== 'string') errors.push(`${label}.imageAlt：必須是字串。`);
    if (kind === 'homework') {
      if (item.resultPage !== null && (typeof item.resultPage !== 'string' || item.resultPage.length === 0)) errors.push(`${label}.resultPage：必須是非空相對路徑字串或 null。`);
      if (item.trainingFolder !== null && (typeof item.trainingFolder !== 'string' || item.trainingFolder.length === 0)) errors.push(`${label}.trainingFolder：必須是非空相對資料夾字串或 null。`);
      if (item.additionalImages !== undefined) validateStringArray(item.additionalImages, `${label}.additionalImages`, errors, { nonEmpty: true });
      if (item.additionalImageAlts !== undefined) validateStringArray(item.additionalImageAlts, `${label}.additionalImageAlts`, errors);
    } else {
      if (item.detailPage !== null && (typeof item.detailPage !== 'string' || item.detailPage.length === 0)) errors.push(`${label}.detailPage：必須是非空相對路徑字串或 null。`);
      if (!['class', 'exercise', 'homework-module'].includes(item.group)) errors.push(`${label}.group：只可為 class、exercise 或 homework-module。`);
      if (typeof item.searchText !== 'string') errors.push(`${label}.searchText：必須是字串。`);
      if (item.descriptionLines !== undefined) validateStringArray(item.descriptionLines, `${label}.descriptionLines`, errors);
      if (item.presentation !== undefined) validatePresentation(item.presentation, label, errors);
    }
  });
  return usable;
}

function inside(base, candidate) {
  const relative = path.relative(base, candidate);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function inspectExactPath(containmentDirectory, target, expectedType) {
  const containment = path.resolve(containmentDirectory);
  if (!inside(containment, target)) return { ok: false, reason: 'outside' };
  const relative = path.relative(containment, target);
  const segments = relative ? relative.split(path.sep) : [];
  let current = containment;
  for (const segment of segments) {
    let names;
    try {
      names = await readdir(current);
    } catch {
      return { ok: false, reason: 'missing' };
    }
    const exact = names.find((name) => name === segment);
    if (!exact) {
      const actual = names.find((name) => name.localeCompare(segment, undefined, { sensitivity: 'accent' }) === 0);
      return { ok: false, reason: actual ? 'case' : 'missing', actual };
    }
    current = path.join(current, exact);
    let details;
    try {
      details = await lstat(current);
    } catch {
      return { ok: false, reason: 'missing' };
    }
    if (details.isSymbolicLink()) return { ok: false, reason: 'symlink' };
  }
  let details;
  try {
    details = await lstat(current);
    const [containmentReal, targetReal] = await Promise.all([realpath(containment), realpath(current)]);
    if (!inside(containmentReal, targetReal)) return { ok: false, reason: 'symlink' };
  } catch {
    return { ok: false, reason: 'missing' };
  }
  const actualType = details.isDirectory() ? 'directory' : details.isFile() ? 'file' : 'other';
  return actualType === expectedType ? { ok: true, path: current } : { ok: false, reason: 'type', actualType };
}

async function validateFileReference({ item, field, baseDirectory, containmentDirectory = baseDirectory, expectedType, label, errors }) {
  const value = item[field];
  if (value === null || value === '') return null;
  if (typeof value !== 'string') return null;
  if (path.isAbsolute(value)) {
    errors.push(`${label}.${field}必須是相對路徑。修正方法：移除絕對路徑。`);
    return null;
  }
  const target = path.resolve(baseDirectory, value);
  const result = await inspectExactPath(containmentDirectory, target, expectedType);
  if (result.ok) return result.path;
  const reasons = {
    outside: `超出指定目錄：${value}`,
    missing: `找不到 ${value}`,
    case: `路徑大小寫不符：${value}；實際名稱為「${result.actual}」`,
    symlink: `${value} 包含 symlink 或越出指定目錄`,
    type: `${value} 不是${expectedType === 'directory' ? '資料夾' : '檔案'}`,
  };
  errors.push(`${label}.${field}：${reasons[result.reason]}。修正方法：使用正確、大小寫一致且位於指定目錄內的${expectedType === 'directory' ? '資料夾' : '檔案'}。`);
  return null;
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match ? (match[1] ?? match[2] ?? match[3]) : null;
}

async function validateAccordionIds(filePath, relativeLabel, errors) {
  let html;
  try {
    html = await readFile(filePath, 'utf8');
  } catch {
    return;
  }
  const triggerTags = [...html.matchAll(/<[^>]+data-accordion-trigger[^>]*>/gi)].map((match) => match[0]);
  const panelTags = [...html.matchAll(/<[^>]+data-accordion-panel[^>]*>/gi)].map((match) => match[0]);
  const allIds = [...triggerTags, ...panelTags].map((tag) => attribute(tag, 'id')).filter(Boolean);
  const duplicate = allIds.find((id, index) => allIds.indexOf(id) !== index);
  if (duplicate) errors.push(`${relativeLabel}：Accordion ID「${duplicate}」重複。修正方法：為 trigger 及 panel 使用整頁唯一 ID。`);
  const panels = new Map(panelTags.map((tag) => [attribute(tag, 'id'), tag]));
  const triggers = new Map(triggerTags.map((tag) => [attribute(tag, 'id'), tag]));
  for (const trigger of triggerTags) {
    const triggerId = attribute(trigger, 'id');
    const panelId = attribute(trigger, 'aria-controls');
    if (!triggerId || !panelId || !panels.has(panelId)) {
      errors.push(`${relativeLabel}：Accordion trigger 缺少有效 id 或 aria-controls 對應。`);
      continue;
    }
    if (attribute(panels.get(panelId), 'aria-labelledby') !== triggerId) {
      errors.push(`${relativeLabel}：Accordion panel「${panelId}」的 aria-labelledby 未對應 trigger「${triggerId}」。`);
    }
  }
  for (const panel of panelTags) {
    const panelId = attribute(panel, 'id');
    const triggerId = attribute(panel, 'aria-labelledby');
    if (!panelId || !triggerId) {
      errors.push(`${relativeLabel}：Accordion panel 缺少 id 或 aria-labelledby。`);
    } else if (!triggers.has(triggerId) || attribute(triggers.get(triggerId), 'aria-controls') !== panelId) {
      errors.push(`${relativeLabel}：Accordion panel「${panelId}」的 aria-labelledby 未對應有效 trigger。`);
    }
  }
}

export async function validateContent({ rootDirectory = process.cwd() } = {}) {
  const projectRoot = path.resolve(rootDirectory);
  const errors = [];
  let homework;
  let worldSkills;
  try {
    [homework, worldSkills] = await Promise.all([
      readJson(path.join(projectRoot, 'content', 'homework.json'), 'content/homework.json'),
      readJson(path.join(projectRoot, 'content', 'world-skills.json'), 'content/world-skills.json'),
    ]);
  } catch (error) {
    return { valid: false, errors: [error.message] };
  }
  const usableHomework = validateRecords('homework', homework, errors);
  const usableWorldSkills = validateRecords('worldSkills', worldSkills, errors);
  if (!Array.isArray(homework) || !Array.isArray(worldSkills)) return { valid: false, errors };

  const manifestPath = path.join(projectRoot, 'training', 'files.json');
  let manifest = [];
  try {
    manifest = await readJson(manifestPath, 'training/files.json');
    if (!Array.isArray(manifest)) errors.push('training/files.json：最外層必須是相容的陣列。');
  } catch (error) {
    errors.push(error.message);
  }
  const manifestFolders = new Set(Array.isArray(manifest) ? manifest.filter((entry) => entry?.type === 'folder').map(({ path: folderPath }) => folderPath) : []);

  for (const item of usableHomework) {
    const label = `homework「${item.id ?? '(缺少 id)'}」`;
    if (item.status !== 'published') continue;
    await validateFileReference({ item, field: 'image', baseDirectory: path.join(projectRoot, 'homework'), expectedType: 'file', label, errors });
    if (Array.isArray(item.additionalImages)) {
      for (const [index, image] of item.additionalImages.entries()) {
        await validateFileReference({ item: { image }, field: 'image', baseDirectory: path.join(projectRoot, 'homework'), expectedType: 'file', label: `${label}.additionalImages[${index}]`, errors });
      }
    }
    await validateFileReference({ item, field: 'resultPage', baseDirectory: path.join(projectRoot, 'homework'), containmentDirectory: projectRoot, expectedType: 'file', label, errors });
    if (typeof item.trainingFolder === 'string' && item.trainingFolder) {
      const target = path.resolve(projectRoot, 'train', item.trainingFolder);
      const result = await inspectExactPath(path.join(projectRoot, 'train'), target, 'directory');
      if (!result.ok) {
        const detail = result.reason === 'case' ? `；實際名稱為「${result.actual}」` : result.reason === 'type' ? '；目標不是資料夾' : result.reason === 'symlink' ? '；symlink 不允許' : '';
        errors.push(`${label}.trainingFolder：找不到正確資料夾「${item.trainingFolder}」${detail}。修正方法：使用 train/ 內的實際資料夾名稱及大小寫。`);
      } else if (!manifestFolders.has(item.trainingFolder)) {
        errors.push(`${label}.trainingFolder：「${item.trainingFolder}」尚未發佈到 training/files.json。修正方法：執行單一資料夾發佈指令。`);
      }
    }
  }

  for (const item of usableWorldSkills) {
    const label = `world-skills「${item.id ?? '(缺少 id)'}」`;
    if (item.status !== 'published') continue;
    await validateFileReference({ item, field: 'image', baseDirectory: path.join(projectRoot, 'world skill'), expectedType: 'file', label, errors });
    await validateFileReference({ item, field: 'detailPage', baseDirectory: path.join(projectRoot, 'world skill'), expectedType: 'file', label, errors });
  }

  for (const directoryName of ['homework', 'world skill']) {
    const directory = path.join(projectRoot, directoryName);
    let names = [];
    try {
      names = await readdir(directory);
    } catch (error) {
      errors.push(`${directoryName}/：無法讀取內容目錄：${error.message}`);
    }
    for (const name of names.filter((fileName) => fileName.toLowerCase().endsWith('.html'))) {
      await validateAccordionIds(path.join(directory, name), `${directoryName}/${name}`, errors);
    }
  }

  for (const [kind, items, indexPath] of [
    ['homework', usableHomework, path.join(projectRoot, 'homework', 'index.html')],
    ['world-skills', usableWorldSkills, path.join(projectRoot, 'world skill', 'index.html')],
  ]) {
    let html = '';
    try {
      html = await readFile(indexPath, 'utf8');
    } catch (error) {
      errors.push(`${kind} index：${error.message}`);
    }
    const indexedContentIds = [...html.matchAll(/<[^>]*\bdata-content-id\b[^>]*>/gi)]
      .map((match) => attribute(match[0], 'data-content-id'));
    for (const item of items.filter((entry) => entry.status === 'draft' && SAFE_ID_PATTERN.test(String(entry.id)))) {
      if (indexedContentIds.includes(item.id)) errors.push(`${kind}「${item.id}」：draft 不可出現在正式索引。`);
    }
  }

  if (errors.length === 0) {
    try {
      await buildContentIndexes({ rootDirectory: projectRoot, check: true });
    } catch (error) {
      errors.push(`${error.message} 修正方法：執行 node scripts/build-content-indexes.mjs。`);
    }
  }
  return { valid: errors.length === 0, errors };
}

if (isDirectInvocation(import.meta.url)) {
  validateContent().then(({ valid, errors }) => {
    if (valid) {
      console.log('內容驗證通過。');
      return;
    }
    console.error(`內容驗證失敗（${errors.length} 項）：`);
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
