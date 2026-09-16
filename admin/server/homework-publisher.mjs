import { constants } from 'node:fs';
import { copyFile, lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  readJson,
  resolveInside,
  withFileLock,
  writeTextAtomic,
} from '../../scripts/content-core.mjs';
import { buildContentIndexes } from '../../scripts/build-content-indexes.mjs';
import { validateContent } from '../../scripts/validate-content.mjs';
import { renderHomeworkPage } from './homework-page-renderer.mjs';

export class HomeworkPublishError extends Error {
  constructor(status, code, { recoveryRetained = false } = {}) {
    super(code);
    this.name = 'HomeworkPublishError';
    this.status = status;
    this.code = code;
    this.recoveryRetained = recoveryRetained;
  }
}

function publishError(status, code, options) {
  return new HomeworkPublishError(status, code, options);
}

function inside(baseDirectory, candidate) {
  const relative = path.relative(path.resolve(baseDirectory), path.resolve(candidate));
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function pathExists(candidate) {
  try {
    await lstat(candidate);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function prepareOutput({ rootDirectory, transactionDirectory, homework, images }) {
  const stagingRoot = path.join(rootDirectory, '.admin-staging');
  if (!inside(stagingRoot, transactionDirectory) || path.resolve(stagingRoot) === path.resolve(transactionDirectory)) {
    throw publishError(500, 'internal_error');
  }
  const preparedRoot = path.join(transactionDirectory, 'prepared');
  const preparedImageDirectory = path.join(preparedRoot, 'images');
  const preparedPage = path.join(preparedRoot, `${homework.id}.html`);
  await mkdir(preparedImageDirectory, { recursive: true });

  const uploads = [images.coverImage, ...images.contentImages];
  for (const upload of uploads) {
    if (!upload || !inside(transactionDirectory, upload.path)) throw publishError(500, 'internal_error');
    const details = await lstat(upload.path);
    if (!details.isFile()) throw publishError(500, 'internal_error');
    const destination = resolveInside(preparedImageDirectory, upload.destinationFilename, '圖片檔名');
    await copyFile(upload.path, destination, constants.COPYFILE_EXCL);
  }

  const formalHtml = renderHomeworkPage({
    ...homework,
    preview: false,
    assetBase: '../assets/css/',
    scriptBase: '../assets/js/',
  });
  await writeFile(preparedPage, formalHtml, { encoding: 'utf8', flag: 'wx' });
  return { preparedPage, preparedImageDirectory };
}

function defaultDependencies() {
  return {
    buildIndexes: buildContentIndexes,
    validateProject: validateContent,
    checkIndexes: (options) => buildContentIndexes({ ...options, check: true }),
    restoreText: writeTextAtomic,
    cleanupTransaction: (transactionDirectory) => rm(transactionDirectory, { recursive: true, force: true }),
  };
}

export async function publishHomework({
  rootDirectory,
  transactionDirectory,
  homework,
  images,
  dependencies = {},
  logger = console,
}) {
  const projectRoot = path.resolve(rootDirectory);
  const services = { ...defaultDependencies(), ...dependencies };
  let retainStaging = false;
  let committed = false;
  let prepared;
  try {
    prepared = await prepareOutput({ rootDirectory: projectRoot, transactionDirectory, homework, images });
    const jsonPath = path.join(projectRoot, 'content', 'homework.json');
    const indexPath = path.join(projectRoot, 'homework', 'index.html');
    const targetPage = resolveInside(path.join(projectRoot, 'homework'), `${homework.id}.html`, 'Homework 頁面');
    const targetImageDirectory = resolveInside(path.join(projectRoot, 'homework', 'img'), homework.id, 'Homework 圖片目錄');
    const lockPath = path.join(projectRoot, 'content', 'homework.json.lock');

    await withFileLock(lockPath, async () => {
      const records = await readJson(jsonPath, 'content/homework.json');
      if (!Array.isArray(records)) throw publishError(500, 'internal_error');
      const resultPage = `${homework.id}.html`;
      if (records.some((item) => item?.id === homework.id || item?.resultPage === resultPage)
        || await pathExists(targetPage) || await pathExists(targetImageDirectory)) {
        throw publishError(409, 'publish_conflict');
      }

      const maximumOrder = records.reduce((maximum, item) => (
        Number.isInteger(item?.order) && item.order > maximum ? item.order : maximum
      ), 0);
      const item = {
        id: homework.id,
        title: homework.title,
        description: homework.description,
        image: `img/${homework.id}/${images.coverImage.destinationFilename}`,
        imageAlt: homework.coverAlt,
        resultPage,
        trainingFolder: null,
        status: 'published',
        order: maximumOrder + 1,
      };
      const [originalJson, originalIndex] = await Promise.all([readFile(jsonPath), readFile(indexPath)]);
      const recoveryDirectory = path.join(transactionDirectory, 'recovery');
      await mkdir(recoveryDirectory);
      await Promise.all([
        writeFile(path.join(recoveryDirectory, 'homework.json'), originalJson, { flag: 'wx' }),
        writeFile(path.join(recoveryDirectory, 'homework-index.html'), originalIndex, { flag: 'wx' }),
      ]);

      let imagePlaced = false;
      let pagePlaced = false;
      try {
        await rename(prepared.preparedImageDirectory, targetImageDirectory);
        imagePlaced = true;
        await rename(prepared.preparedPage, targetPage);
        pagePlaced = true;
        await writeTextAtomic(jsonPath, `${JSON.stringify([...records, item], null, 2)}\n`);
        await services.buildIndexes({ rootDirectory: projectRoot });
        const validation = await services.validateProject({ rootDirectory: projectRoot });
        if (!validation?.valid) throw new Error('Content validation failed.');
        await services.checkIndexes({ rootDirectory: projectRoot });
      } catch (error) {
        if (imagePlaced || pagePlaced) {
          try {
            await services.restoreText(jsonPath, originalJson.toString('utf8'));
            await services.restoreText(indexPath, originalIndex.toString('utf8'));
            if (pagePlaced) await rm(targetPage, { force: true });
            if (imagePlaced) await rm(targetImageDirectory, { recursive: true, force: true });
          } catch {
            retainStaging = true;
            logger.error?.('Critical Homework publish rollback failure; recovery data was retained.');
            throw publishError(500, 'internal_error', { recoveryRetained: true });
          }
        }
        if (error instanceof HomeworkPublishError) throw error;
        throw publishError(500, 'internal_error');
      }
    });

    committed = true;
    return {
      published: true,
      homework: {
        id: homework.id,
        title: homework.title,
        resultUrl: `/homework/${homework.id}.html`,
        indexUrl: '/homework/',
      },
    };
  } catch (error) {
    if (error instanceof HomeworkPublishError) throw error;
    throw publishError(500, 'internal_error');
  } finally {
    if (!retainStaging) {
      try {
        await services.cleanupTransaction(transactionDirectory);
      } catch {
        logger.warn?.(committed
          ? 'Homework publish committed, but staging cleanup failed.'
          : 'Homework publish staging cleanup failed.');
      }
    }
  }
}
