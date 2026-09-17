import { createHash } from 'node:crypto';
import path from 'node:path';
import {
  validateHomeworkPreviewInput,
} from '../shared/homework-preview-contract.mjs';
import {
  readJson,
  withFileLock,
  writeTextAtomic,
} from '../../scripts/content-core.mjs';
import { buildContentIndexes } from '../../scripts/build-content-indexes.mjs';
import { validateContent } from '../../scripts/validate-content.mjs';
import { validateHtmlFragment } from './html-fragment-validator.mjs';
import { inspectHomeworkEditability } from './homework-metadata-editor.mjs';
import { renderHomeworkPage } from './homework-page-renderer.mjs';
import {
  readHomeworkContentImage,
  rewriteContentImageSources,
  validateExistingHomeworkImageReferences,
} from './homework-content-images.mjs';

export class HomeworkContentEditError extends Error {
  constructor(status, code, fields) {
    super(code);
    this.name = 'HomeworkContentEditError';
    this.status = status;
    this.code = code;
    if (fields) this.fields = fields;
  }
}

export function homeworkContentRevision({ id, contentHtml } = {}) {
  return createHash('sha256')
    .update(String(id))
    .update('\0')
    .update(String(contentHtml), 'utf8')
    .digest('hex');
}

function pathsFor(rootDirectory) {
  const projectRoot = path.resolve(rootDirectory);
  return {
    projectRoot,
    manifestPath: path.join(projectRoot, 'content', 'homework.json'),
    lockPath: path.join(projectRoot, 'content', 'homework.json.lock'),
  };
}

async function loadEditableRecord({ projectRoot, manifestPath, id }) {
  const records = await readJson(manifestPath, 'content/homework.json');
  if (!Array.isArray(records)) throw new HomeworkContentEditError(500, 'internal_error');
  const matches = records.filter((item) => item?.id === id);
  if (matches.length === 0) throw new HomeworkContentEditError(404, 'homework_not_found');
  if (matches.length !== 1) throw new HomeworkContentEditError(500, 'internal_error');
  const item = matches[0];
  const inspection = await inspectHomeworkEditability({ rootDirectory: projectRoot, item });
  if (!inspection.editable) throw new HomeworkContentEditError(409, 'homework_not_editable');
  return { item, inspection };
}

async function validateContentInput({ projectRoot, item, contentHtml }) {
  const input = validateHomeworkPreviewInput({
    id: item.id,
    title: item.title,
    description: item.description,
    contentHtml,
  });
  if (!input.ok) throw new HomeworkContentEditError(422, 'validation_failed', input.errors);
  const fragment = validateHtmlFragment(input.value.contentHtml);
  if (!fragment.ok) throw new HomeworkContentEditError(422, 'validation_failed', fragment.errors);
  const images = await validateExistingHomeworkImageReferences({
    rootDirectory: projectRoot,
    id: item.id,
    contentHtml: fragment.html,
  });
  if (!images.ok) throw new HomeworkContentEditError(422, 'validation_failed', images.errors);
  return { fragment, images };
}

function safeResult(item, contentHtml) {
  return {
    id: item.id,
    title: item.title,
    url: `/homework/${item.resultPage}`,
    contentHtml,
    revision: homeworkContentRevision({ id: item.id, contentHtml }),
  };
}

export async function loadHomeworkContent({ rootDirectory, id } = {}) {
  const locations = pathsFor(rootDirectory);
  try {
    return await withFileLock(locations.lockPath, async () => {
      const { item, inspection } = await loadEditableRecord({ ...locations, id });
      return { homework: safeResult(item, inspection.contentHtml) };
    });
  } catch (error) {
    if (error instanceof HomeworkContentEditError) throw error;
    throw new HomeworkContentEditError(500, 'internal_error');
  }
}

export async function previewHomeworkContent({
  rootDirectory,
  id,
  contentHtml,
  assetBase,
} = {}) {
  const locations = pathsFor(rootDirectory);
  try {
    return await withFileLock(locations.lockPath, async () => {
      const { item } = await loadEditableRecord({ ...locations, id });
      const { fragment, images: imageValidation } = await validateContentInput({
        projectRoot: locations.projectRoot,
        item,
        contentHtml,
      });
      const imageUrls = new Map(await Promise.all(imageValidation.images.map(async ({ filename }) => {
        const { bytes, mimeType } = await readHomeworkContentImage({
          rootDirectory: locations.projectRoot,
          id: item.id,
          filename,
        });
        return [filename, `data:${mimeType};base64,${bytes.toString('base64')}`];
      })));
      const previewContent = rewriteContentImageSources({
        id: item.id,
        contentHtml: fragment.html,
        imageUrls,
      });
      return {
        previewHtml: renderHomeworkPage({
          id: item.id,
          title: item.title,
          description: item.description,
          contentHtml: previewContent,
          preview: true,
          assetBase,
        }),
      };
    });
  } catch (error) {
    if (error instanceof HomeworkContentEditError) throw error;
    throw new HomeworkContentEditError(500, 'internal_error');
  }
}

function defaultDependencies() {
  return {
    writeText: writeTextAtomic,
    restoreText: writeTextAtomic,
    validateProject: validateContent,
    checkIndexes: (options) => buildContentIndexes({ ...options, check: true }),
  };
}

export async function updateHomeworkContent({
  rootDirectory,
  id,
  contentHtml,
  revision,
  dependencies = {},
  logger = console,
} = {}) {
  const locations = pathsFor(rootDirectory);
  const services = { ...defaultDependencies(), ...dependencies };
  try {
    return await withFileLock(locations.lockPath, async () => {
      const { item, inspection } = await loadEditableRecord({ ...locations, id });
      const currentRevision = homeworkContentRevision({ id: item.id, contentHtml: inspection.contentHtml });
      if (revision !== currentRevision) throw new HomeworkContentEditError(409, 'content_changed');
      const { fragment } = await validateContentInput({
        projectRoot: locations.projectRoot,
        item,
        contentHtml,
      });
      const updatedPage = renderHomeworkPage({
        id: item.id,
        title: item.title,
        description: item.description,
        contentHtml: fragment.html,
        preview: false,
        assetBase: '../assets/css/',
        scriptBase: '../assets/js/',
      });
      let writeStarted = false;
      try {
        writeStarted = true;
        await services.writeText(inspection.pagePath, updatedPage);
        const validation = await services.validateProject({ rootDirectory: locations.projectRoot });
        if (!validation?.valid) throw new Error('Content validation failed.');
        await services.checkIndexes({ rootDirectory: locations.projectRoot });
      } catch {
        if (writeStarted) {
          try {
            await services.restoreText(inspection.pagePath, inspection.pageHtml);
          } catch {
            logger.error?.('Critical Homework content rollback failure.');
          }
        }
        throw new HomeworkContentEditError(500, 'internal_error');
      }
      return {
        updated: true,
        homework: {
          id: item.id,
          title: item.title,
          url: `/homework/${item.resultPage}`,
          revision: homeworkContentRevision({ id: item.id, contentHtml: fragment.html }),
        },
      };
    });
  } catch (error) {
    if (error instanceof HomeworkContentEditError) throw error;
    throw new HomeworkContentEditError(500, 'internal_error');
  }
}
