import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'parse5';
import { HOMEWORK_ID_PATTERN } from '../shared/homework-preview-contract.mjs';
import {
  readJson,
  resolveInside,
  withFileLock,
  writeTextAtomic,
} from '../../scripts/content-core.mjs';
import { buildContentIndexes } from '../../scripts/build-content-indexes.mjs';
import { validateContent } from '../../scripts/validate-content.mjs';
import { renderHomeworkPage } from './homework-page-renderer.mjs';

export class HomeworkMetadataEditError extends Error {
  constructor(status, code) {
    super(code);
    this.name = 'HomeworkMetadataEditError';
    this.status = status;
    this.code = code;
  }
}

function collectMarkedElements(node, state) {
  if (Array.isArray(node.attrs)) {
    const contentId = node.attrs.find(({ name }) => name === 'data-content-id');
    const originalContent = node.attrs.find(({ name }) => name === 'data-original-content');
    if (contentId) state.contentIds.push({ node, value: contentId.value });
    if (originalContent) state.originalContents.push(node);
  }
  for (const child of node.childNodes ?? []) collectMarkedElements(child, state);
}

export async function inspectHomeworkEditability({ rootDirectory, item } = {}) {
  try {
    if (!item || typeof item !== 'object' || Array.isArray(item)
      || typeof item.id !== 'string' || !HOMEWORK_ID_PATTERN.test(item.id)
      || item.status !== 'published' || item.resultPage !== `${item.id}.html`)
      return { editable: false };

    const homeworkDirectory = path.resolve(rootDirectory, 'homework');
    const pagePath = resolveInside(homeworkDirectory, item.resultPage, 'Homework 頁面');
    const details = await lstat(pagePath);
    if (!details.isFile() || details.isSymbolicLink()) return { editable: false };
    const pageHtml = await readFile(pagePath, 'utf8');
    const document = parse(pageHtml, { sourceCodeLocationInfo: true });
    const marked = { contentIds: [], originalContents: [] };
    collectMarkedElements(document, marked);
    if (marked.contentIds.length !== 1 || marked.contentIds[0].value !== item.id
      || marked.originalContents.length !== 1) return { editable: false };

    const location = marked.originalContents[0].sourceCodeLocation;
    const startOffset = location?.startTag?.endOffset;
    const endOffset = location?.endTag?.startOffset;
    if (!Number.isInteger(startOffset) || !Number.isInteger(endOffset) || endOffset < startOffset) {
      return { editable: false };
    }
    const wrapper = pageHtml.slice(startOffset, endOffset);
    const wrapperSuffix = '\n      ';
    if (!wrapper.startsWith('\n') || !wrapper.endsWith(wrapperSuffix)) return { editable: false };
    const contentHtml = wrapper.slice(1, -wrapperSuffix.length);
    const expectedPage = renderHomeworkPage({
      id: item.id,
      title: item.title,
      description: item.description,
      contentHtml,
      preview: false,
      assetBase: '../assets/css/',
      scriptBase: '../assets/js/',
    });
    if (expectedPage !== pageHtml) return { editable: false };
    return { editable: true, pagePath, pageHtml, contentHtml };
  } catch {
    return { editable: false };
  }
}

function defaultDependencies() {
  return {
    writeText: writeTextAtomic,
    buildIndexes: buildContentIndexes,
    validateProject: validateContent,
    checkIndexes: (options) => buildContentIndexes({ ...options, check: true }),
    restoreText: writeTextAtomic,
  };
}

export async function updateHomeworkMetadata({
  rootDirectory,
  id,
  metadata,
  dependencies = {},
  logger = console,
} = {}) {
  const projectRoot = path.resolve(rootDirectory);
  const services = { ...defaultDependencies(), ...dependencies };
  const jsonPath = path.join(projectRoot, 'content', 'homework.json');
  const indexPath = path.join(projectRoot, 'homework', 'index.html');
  const lockPath = path.join(projectRoot, 'content', 'homework.json.lock');
  try {
    return await withFileLock(lockPath, async () => {
      const records = await readJson(jsonPath, 'content/homework.json');
      if (!Array.isArray(records)) throw new HomeworkMetadataEditError(500, 'internal_error');
      const matches = records.filter((item) => item?.id === id);
      if (matches.length === 0) throw new HomeworkMetadataEditError(404, 'homework_not_found');
      if (matches.length !== 1) throw new HomeworkMetadataEditError(500, 'internal_error');
      const item = matches[0];
      const inspection = await inspectHomeworkEditability({ rootDirectory: projectRoot, item });
      if (!inspection.editable) throw new HomeworkMetadataEditError(409, 'homework_not_editable');

      const updatedItem = { ...item, title: metadata.title, description: metadata.description };
      const updatedRecords = records.map((record) => record === item ? updatedItem : record);
      const updatedPage = renderHomeworkPage({
        id: item.id,
        title: metadata.title,
        description: metadata.description,
        contentHtml: inspection.contentHtml,
        preview: false,
        assetBase: '../assets/css/',
        scriptBase: '../assets/js/',
      });
      const [originalJson, originalIndex, originalPage] = await Promise.all([
        readFile(jsonPath),
        readFile(indexPath),
        readFile(inspection.pagePath),
      ]);
      let writeStarted = false;
      try {
        writeStarted = true;
        await services.writeText(inspection.pagePath, updatedPage);
        await services.writeText(jsonPath, `${JSON.stringify(updatedRecords, null, 2)}\n`);
        await services.buildIndexes({ rootDirectory: projectRoot });
        const validation = await services.validateProject({ rootDirectory: projectRoot });
        if (!validation?.valid) throw new Error('Content validation failed.');
        await services.checkIndexes({ rootDirectory: projectRoot });
      } catch {
        if (writeStarted) {
          const restored = await Promise.allSettled([
            services.restoreText(jsonPath, originalJson.toString('utf8')),
            services.restoreText(indexPath, originalIndex.toString('utf8')),
            services.restoreText(inspection.pagePath, originalPage.toString('utf8')),
          ]);
          if (restored.some(({ status }) => status === 'rejected')) {
            logger.error?.('Critical Homework metadata rollback failure.');
          }
        }
        throw new HomeworkMetadataEditError(500, 'internal_error');
      }
      return {
        updated: true,
        homework: {
          id: item.id,
          title: metadata.title,
          description: metadata.description,
          url: `/homework/${item.resultPage}`,
        },
      };
    });
  } catch (error) {
    if (error instanceof HomeworkMetadataEditError) throw error;
    throw new HomeworkMetadataEditError(500, 'internal_error');
  }
}
