import path from 'node:path';
import { readFile } from 'node:fs/promises';
import {
  encodePathSegments,
  escapeHtml,
  escapeHtmlText,
  isDirectInvocation,
  readJson,
  replaceGeneratedRegion,
  sortByOrder,
  writeTextAtomic,
} from './content-core.mjs';

const WORLD_SKILL_GROUPS = [
  { id: 'class', title: 'Class 練習', headingId: 'class-practice-title' },
  { id: 'exercise', title: 'Exercise 練習', headingId: 'exercise-practice-title' },
  { id: 'homework-module', title: 'Homework／Module', headingId: 'homework-module-title' },
];

function indent(text, spaces) {
  const prefix = ' '.repeat(spaces);
  return text.split('\n').map((line) => `${prefix}${line}`).join('\n');
}

function renderHomeworkMedia(item) {
  const sources = [item.image, ...(item.additionalImages ?? [])].filter(Boolean);
  const alts = [item.imageAlt, ...(item.additionalImageAlts ?? [])];
  if (sources.length === 0) {
    return '<div class="homework-card__media"><div class="state state--empty homework-card__missing">圖片暫缺</div></div>';
  }
  const className = sources.length > 1 ? 'homework-card__media homework-card__media--multiple' : 'homework-card__media';
  const images = sources.map((source, index) => {
    const fallback = sources.length > 1 ? `${item.title} 成果畫面 ${index + 1}` : `${item.title} 成果畫面`;
    return `<img src="${escapeHtml(source)}" alt="${escapeHtml(alts[index] || fallback)}">`;
  }).join('');
  return `<div class="${className}">${images}</div>`;
}

function renderHomeworkStatus(item) {
  const statuses = [];
  if (item.resultPage) statuses.push('<span class="status-badge">成果可用</span>');
  else if (!item.image && !item.trainingFolder) statuses.push('<span class="status-badge status-badge--warning">成果及題目資料暫缺</span>');
  else statuses.push('<span class="status-badge status-badge--warning">成果頁暫缺</span>');
  if (item.trainingFolder) statuses.push('<span class="status-badge status-badge--accent">題目資料可用</span>');
  else if (item.image || item.resultPage) statuses.push('<span class="status-badge status-badge--warning">題目資料暫缺</span>');
  return `<div class="homework-card__status">${statuses.join('')}</div>`;
}

function renderHomeworkActions(item) {
  const actions = [];
  if (item.resultPage) {
    actions.push(`<a class="button button--secondary" href="${escapeHtml(item.resultPage)}" data-homework-result>查看成果</a>`);
  }
  if (item.trainingFolder) {
    actions.push(`<a class="button" href="/training/${encodePathSegments(item.trainingFolder)}/" data-homework-question>開啟題目資料</a>`);
  }
  return actions.length ? `<div class="homework-card__actions">${actions.join('')}</div>` : '';
}

export function renderHomeworkCards(items) {
  return sortByOrder(items).filter(({ status }) => status === 'published').map((item) => {
    const body = [
      `<h2>${escapeHtmlText(item.title)}</h2>`,
      item.description ? `<p class="homework-card__description">${escapeHtmlText(item.description)}</p>` : '',
      item.trainingFolder ? `<p class="homework-card__folder"><strong>題目資料</strong>${escapeHtmlText(item.trainingFolder)}</p>` : '',
      renderHomeworkStatus(item),
      renderHomeworkActions(item),
    ].filter(Boolean).join('');
    return [
      `<article class="card homework-card" data-homework-item data-content-id="${escapeHtml(item.id)}" data-homework-name="${escapeHtml(item.title)}" data-description="${escapeHtml(item.description)}" data-folder="${escapeHtml(item.trainingFolder ?? '')}">`,
      `  ${renderHomeworkMedia(item)}<div class="homework-card__body">${body}</div>`,
      '</article>',
    ].join('\n');
  }).map((card) => indent(card, 8)).join('\n');
}

function renderPresentation(item) {
  const presentation = item.presentation;
  if (!presentation) return `<p>${escapeHtmlText(item.description)}</p>`;
  if (presentation.type === 'list') {
    return `<ul class="world-skill-card__hint">${presentation.items.map((value) => `<li>${escapeHtmlText(value)}</li>`).join('')}</ul>`;
  }
  if (presentation.type === 'paragraph') {
    return `<p class="world-skill-card__hint">${escapeHtmlText(item.description)}</p>`;
  }
  if (presentation.type === 'paragraphs') {
    const paragraphs = presentation.items.map(({ text, tone }) => (
      `<p${tone === 'comment' ? ' class="world-skill-card__comment"' : ''}>${escapeHtmlText(text)}</p>`
    )).join('');
    return `<div class="world-skill-card__hint">${paragraphs}</div>`;
  }
  if (presentation.type === 'lead-list') {
    return `<p>${escapeHtmlText(presentation.lead)}</p><ul>${presentation.items.map((value) => `<li>${escapeHtmlText(value)}</li>`).join('')}</ul>`;
  }
  throw new Error(`World Skill「${item.id}」使用不支援的 presentation.type。`);
}

function renderWorldSkillCard(item) {
  const media = item.image
    ? `<div class="world-skill-card__image"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.imageAlt || `${item.title} 練習畫面`)}"></div>`
    : '<div class="world-skill-card__image"><div class="state state--empty">圖片暫缺</div></div>';
  let detail;
  if (item.detailPage) {
    const lines = item.descriptionLines ?? [item.description];
    detail = `<a class="world-skill-card__link" data-item-link href="${escapeHtml(item.detailPage)}">${lines.map(escapeHtmlText).join('<br>')}</a>`;
  } else {
    detail = renderPresentation(item);
  }
  return [
    `<article class="card world-skill-card" data-world-skill-item data-content-id="${escapeHtml(item.id)}" data-title="${escapeHtml(item.title)}" data-search-text="${escapeHtml(item.searchText)}">`,
    `  ${media}`,
    `  <div class="world-skill-card__body"><h3>${escapeHtmlText(item.title)}</h3>${detail}</div>`,
    '</article>',
  ].join('\n');
}

export function renderWorldSkillSections(items) {
  const published = sortByOrder(items).filter(({ status }) => status === 'published');
  return WORLD_SKILL_GROUPS.map((group) => {
    const groupItems = published.filter((item) => item.group === group.id);
    const cards = groupItems.map((item) => indent(renderWorldSkillCard(item), 12)).join('\n');
    return [
      `        <section class="world-skills-section" aria-labelledby="${group.headingId}" data-world-skill-section>`,
      '          <div class="world-skills-section__header">',
      `            <h2 id="${group.headingId}">${group.title}</h2>`,
      `            <span>${groupItems.length} 項</span>`,
      '          </div>',
      '          <div class="world-skills-grid">',
      cards,
      '          </div>',
      '        </section>',
    ].join('\n');
  }).join('\n\n');
}

function replaceOptionalGeneratedRegion(html, marker, content) {
  const start = `<!-- GENERATED ${marker} START -->`;
  const end = `<!-- GENERATED ${marker} END -->`;
  if (!html.includes(start) && !html.includes(end)) return html;
  return replaceGeneratedRegion(html, marker, content);
}

export async function buildContentIndexes({ rootDirectory = process.cwd(), check = false } = {}) {
  const projectRoot = path.resolve(rootDirectory);
  const homework = await readJson(path.join(projectRoot, 'content', 'homework.json'), 'content/homework.json');
  const worldSkills = await readJson(path.join(projectRoot, 'content', 'world-skills.json'), 'content/world-skills.json');
  if (!Array.isArray(homework) || !Array.isArray(worldSkills)) throw new Error('內容 JSON 的最外層必須是陣列。');
  const changed = [];
  const homeworkIndexPath = path.join(projectRoot, 'homework', 'index.html');
  const worldSkillsIndexPath = path.join(projectRoot, 'world skill', 'index.html');
  const [homeworkOriginal, worldSkillsOriginal] = await Promise.all([
    readFile(homeworkIndexPath, 'utf8'),
    readFile(worldSkillsIndexPath, 'utf8'),
  ]);
  const publishedHomework = homework.filter(({ status }) => status === 'published');
  const homeworkWithCount = replaceOptionalGeneratedRegion(
    homeworkOriginal,
    'HOMEWORK COUNT',
    `顯示全部 ${publishedHomework.length} 個作業`,
  );
  const homeworkUpdated = replaceGeneratedRegion(homeworkWithCount, 'HOMEWORK ITEMS', renderHomeworkCards(homework));
  const worldSkillsUpdated = replaceGeneratedRegion(worldSkillsOriginal, 'WORLD SKILLS', renderWorldSkillSections(worldSkills));
  if (homeworkUpdated !== homeworkOriginal) changed.push('homework/index.html');
  if (worldSkillsUpdated !== worldSkillsOriginal) changed.push('world skill/index.html');
  if (check && changed.length) throw new Error(`內容索引不同步（out of date）：${changed.join(', ')}`);
  await Promise.all([
    homeworkUpdated !== homeworkOriginal ? writeTextAtomic(homeworkIndexPath, homeworkUpdated) : null,
    worldSkillsUpdated !== worldSkillsOriginal ? writeTextAtomic(worldSkillsIndexPath, worldSkillsUpdated) : null,
  ]);
  return { changed };
}

if (isDirectInvocation(import.meta.url)) {
  const argumentsSet = new Set(process.argv.slice(2));
  const unknown = [...argumentsSet].filter((argument) => argument !== '--check');
  if (unknown.length) {
    console.error(`不支援的參數：${unknown.join(', ')}`);
    process.exitCode = 1;
  } else {
    buildContentIndexes({ check: argumentsSet.has('--check') })
      .then(({ changed }) => {
        console.log(argumentsSet.has('--check') ? '內容索引已同步。' : (changed.length ? `已更新：${changed.join(', ')}` : '內容索引沒有變更。'));
      })
      .catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
      });
  }
}
