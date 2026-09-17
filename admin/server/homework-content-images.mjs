import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { parseFragment } from 'parse5';
import {
  HOMEWORK_ID_PATTERN,
  HOMEWORK_PUBLISH_LIMITS,
  contentImagePath,
  isSafeContentImageFilename,
} from '../shared/homework-preview-contract.mjs';
import { resolveInside } from '../../scripts/content-core.mjs';
import { extractImageSources } from './html-fragment-validator.mjs';

const IMAGE_MIME_TYPES = new Map([
  ['png', 'image/png'],
  ['jpg', 'image/jpeg'],
  ['webp', 'image/webp'],
]);

export class HomeworkContentImageError extends Error {
  constructor(status = 404, code = 'homework_image_not_found') {
    super(code);
    this.name = 'HomeworkContentImageError';
    this.status = status;
    this.code = code;
  }
}

function imageError() {
  return {
    field: 'contentHtml',
    code: 'invalid_existing_image',
    message: '主要內容圖片必須是此 Homework 已存在的安全圖片。',
  };
}

function isInside(baseDirectory, targetPath) {
  const relative = path.relative(baseDirectory, targetPath);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function resolveExistingImage({ rootDirectory, id, filename }) {
  if (!HOMEWORK_ID_PATTERN.test(String(id)) || !isSafeContentImageFilename(filename)) {
    throw new HomeworkContentImageError();
  }
  const homeworkDirectory = path.resolve(rootDirectory, 'homework');
  const imageRoot = path.join(homeworkDirectory, 'img');
  const imageDirectory = path.resolve(rootDirectory, 'homework', 'img', id);
  const imagePath = resolveInside(imageDirectory, filename, 'Homework 圖片');
  const [homeworkDetails, imageRootDetails, directoryDetails, fileDetails] = await Promise.all([
    lstat(homeworkDirectory),
    lstat(imageRoot),
    lstat(imageDirectory),
    lstat(imagePath),
  ]);
  if (!homeworkDetails.isDirectory() || homeworkDetails.isSymbolicLink()
    || !imageRootDetails.isDirectory() || imageRootDetails.isSymbolicLink()
    || !directoryDetails.isDirectory() || directoryDetails.isSymbolicLink()
    || !fileDetails.isFile() || fileDetails.isSymbolicLink()
    || fileDetails.size > HOMEWORK_PUBLISH_LIMITS.imageBytes) {
    throw new HomeworkContentImageError();
  }
  const [realDirectory, realImage] = await Promise.all([realpath(imageDirectory), realpath(imagePath)]);
  if (!isInside(realDirectory, realImage)) throw new HomeworkContentImageError();
  return imagePath;
}

export async function validateExistingHomeworkImageReferences({ rootDirectory, id, contentHtml } = {}) {
  const images = [];
  const seen = new Set();
  for (const source of extractImageSources(contentHtml)) {
    const prefix = `img/${id}/`;
    const filename = source.startsWith(prefix) ? source.slice(prefix.length) : '';
    if (!isSafeContentImageFilename(filename) || source !== contentImagePath(id, filename)) {
      return { ok: false, errors: [imageError()] };
    }
    try {
      await resolveExistingImage({ rootDirectory, id, filename });
    } catch {
      return { ok: false, errors: [imageError()] };
    }
    if (!seen.has(source)) {
      seen.add(source);
      images.push({ source, filename });
    }
  }
  return { ok: true, images };
}

function collectImageSourceLocations(node, id, imageBaseUrl, imageUrls, replacements) {
  if (node.tagName === 'img') {
    const source = (node.attrs ?? []).find(({ name }) => name === 'src')?.value;
    const prefix = `img/${id}/`;
    const filename = source?.startsWith(prefix) ? source.slice(prefix.length) : '';
    const location = node.sourceCodeLocation?.attrs?.src;
    if (isSafeContentImageFilename(filename) && source === contentImagePath(id, filename)
      && Number.isInteger(location?.startOffset) && Number.isInteger(location?.endOffset)) {
      const replacementUrl = imageUrls ? imageUrls.get(filename) : `${imageBaseUrl}${encodeURIComponent(filename)}`;
      if (typeof replacementUrl !== 'string') throw new HomeworkContentImageError();
      replacements.push({
        startOffset: location.startOffset,
        endOffset: location.endOffset,
        attribute: `src="${replacementUrl}"`,
      });
    }
  }
  for (const child of node.childNodes ?? []) {
    collectImageSourceLocations(child, id, imageBaseUrl, imageUrls, replacements);
  }
  if (node.content) collectImageSourceLocations(node.content, id, imageBaseUrl, imageUrls, replacements);
}

export function rewriteContentImageSources({ id, contentHtml, imageBaseUrl, imageUrls } = {}) {
  const fragment = parseFragment(contentHtml, { sourceCodeLocationInfo: true });
  const replacements = [];
  collectImageSourceLocations(fragment, id, imageBaseUrl, imageUrls, replacements);
  let rewritten = contentHtml;
  for (const replacement of replacements.sort((left, right) => right.startOffset - left.startOffset)) {
    rewritten = `${rewritten.slice(0, replacement.startOffset)}${replacement.attribute}${rewritten.slice(replacement.endOffset)}`;
  }
  return rewritten;
}

export async function readHomeworkContentImage({ rootDirectory, id, filename } = {}) {
  try {
    const imagePath = await resolveExistingImage({ rootDirectory, id, filename });
    return {
      bytes: await readFile(imagePath),
      mimeType: IMAGE_MIME_TYPES.get(filename.slice(filename.lastIndexOf('.') + 1)),
    };
  } catch (error) {
    if (error instanceof HomeworkContentImageError) throw error;
    throw new HomeworkContentImageError();
  }
}
