import path from 'node:path';
import { access, unlink, writeFile } from 'node:fs/promises';
import {
  assertSafeId,
  escapeHtml,
  isDirectInvocation,
  readJson,
  resolveInside,
  withFileLock,
  writeTextAtomic,
} from './content-core.mjs';

const CONFIG = {
  homework: {
    dataFile: 'content/homework.json',
    pageDirectory: 'homework',
    sectionName: '作業',
    sectionHref: 'index.html',
  },
  exercise: {
    dataFile: 'content/world-skills.json',
    pageDirectory: 'world skill',
    sectionName: 'World Skill 練習',
    sectionHref: 'index.html',
  },
};

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function nextOrder(items) {
  return items.reduce((highest, item) => Math.max(highest, Number.isInteger(item.order) ? item.order : 0), 0) + 1;
}

function createItem(type, id, order) {
  if (type === 'homework') {
    return {
      id,
      title: id,
      description: '',
      image: null,
      resultPage: `${id}.html`,
      trainingFolder: null,
      status: 'draft',
      order,
    };
  }
  return {
    id,
    title: id,
    description: '',
    image: null,
    detailPage: `${id}.html`,
    group: 'exercise',
    searchText: id,
    status: 'draft',
    order,
  };
}

function renderDraftPage(type, item, config) {
  const title = escapeHtml(item.title);
  const eyebrow = type === 'homework' ? 'HOMEWORK · DRAFT' : 'WORLD SKILL · DRAFT';
  return `<!DOCTYPE html>
<html lang="zh-Hant" data-site-root="../">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>${title}｜${escapeHtml(config.sectionName)}</title>
  <link rel="stylesheet" href="../assets/css/foundation.css">
  <link rel="stylesheet" href="../assets/css/app-shell.css">
  <link rel="stylesheet" href="../assets/css/accordion.css">
  <link rel="stylesheet" href="../assets/css/detail-page.css">
</head>
<body>
  <a class="skip-link" href="#main-content">跳到主要內容</a>
  <aside class="app-sidebar" aria-label="Android Learning Workspace">
    <a class="brand-lockup" href="../index.html" aria-label="返回首頁"><span class="brand-mark" aria-hidden="true">AL</span><span class="brand-copy"><strong>Android Learning</strong><span>WORKSPACE</span></span></a>
    <nav class="desktop-navigation" aria-label="主導覽" data-site-navigation="desktop"></nav>
    <p class="sidebar-note">LEARNING ROUTE RAIL</p>
  </aside>
  <main class="app-main" id="main-content" tabindex="-1">
    <div class="container detail-page">
      <nav aria-label="Breadcrumb">
        <ol class="detail-breadcrumb">
          <li><a href="../index.html">首頁</a></li>
          <li><a href="${escapeHtml(config.sectionHref)}">${escapeHtml(config.sectionName)}</a></li>
          <li><span aria-current="page">${title}</span></li>
        </ol>
      </nav>
      <header class="detail-header">
        <a class="button button--ghost detail-header__back" href="${escapeHtml(config.sectionHref)}">返回 ${escapeHtml(config.sectionName)}</a>
        <p class="detail-eyebrow">${eyebrow}</p>
        <h1>${title}</h1>
      </header>
      <div class="detail-content">
        <div class="state state--empty"><strong>此頁為草稿</strong><span>尚未加入內容。</span></div>
      </div>
      <footer class="detail-footer"><a class="button button--secondary" href="${escapeHtml(config.sectionHref)}">返回 ${escapeHtml(config.sectionName)}</a></footer>
    </div>
  </main>
  <nav class="mobile-navigation" aria-label="手機主導覽" data-site-navigation="mobile"></nav>
  <script src="../assets/js/site-navigation.js" defer></script>
  <script src="../assets/js/accordion.js" defer></script>
</body>
</html>
`;
}

export async function createNewContent({ rootDirectory = process.cwd(), type, id } = {}) {
  const config = CONFIG[type];
  if (!config) throw new Error('內容類型只支援 homework 或 exercise。');
  assertSafeId(id);
  const projectRoot = path.resolve(rootDirectory);
  const dataPath = resolveInside(projectRoot, config.dataFile, '內容資料檔');
  const pageDirectory = resolveInside(projectRoot, config.pageDirectory, '內容目錄');
  const pagePath = resolveInside(pageDirectory, `${id}.html`, '草稿頁面');
  return withFileLock(`${dataPath}.lock`, async () => {
    const items = await readJson(dataPath, config.dataFile);
    if (!Array.isArray(items)) throw new Error(`${config.dataFile} 的最外層必須是陣列。`);
    const pageField = type === 'homework' ? 'resultPage' : 'detailPage';
    if (items.some((item) => item?.id === id || item?.title === id || item?.[pageField] === `${id}.html`)) {
      throw new Error(`ID 或 JSON 項目「${id}」已存在，未覆寫任何檔案。`);
    }
    if (await pathExists(pagePath)) throw new Error(`目標頁面 ${config.pageDirectory}/${id}.html 已存在，未覆寫。`);

    const item = createItem(type, id, nextOrder(items));
    const nextJson = `${JSON.stringify([...items, item], null, 2)}\n`;
    await writeFile(pagePath, renderDraftPage(type, item, config), { encoding: 'utf8', flag: 'wx' });
    try {
      await writeTextAtomic(dataPath, nextJson);
    } catch (error) {
      await unlink(pagePath).catch(() => {});
      throw error;
    }
    return { item, pagePath, dataPath };
  });
}

if (isDirectInvocation(import.meta.url)) {
  const [type, id, ...extra] = process.argv.slice(2);
  if (!type || !id || extra.length) {
    console.error('用法：node scripts/new-content.mjs <homework|exercise> <安全-id>');
    process.exitCode = 1;
  } else {
    createNewContent({ type, id }).then(({ item, pagePath, dataPath }) => {
      console.log(`已建立 draft：${path.relative(process.cwd(), pagePath)}`);
      console.log(`已更新資料：${path.relative(process.cwd(), dataPath)}`);
      console.log(`下一步：填寫 ${item.id} 的 title、description、圖片及${type === 'homework' ? ' Training folder' : '教學內容'}，驗證後把 status 改為 published，再重建索引。`);
    }).catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
  }
}
