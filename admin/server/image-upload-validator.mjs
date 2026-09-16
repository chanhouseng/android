import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import jpegDecoder from 'jpeg-js';
import pngPackage from 'pngjs';
import decodeWebp, { init as initializeWebpDecoder } from '@jsquash/webp/decode.js';
import {
  HOMEWORK_PUBLISH_LIMITS,
  contentImagePath,
  isSafeContentImageFilename,
} from '../shared/homework-preview-contract.mjs';
import { extractImageSources } from './html-fragment-validator.mjs';

const ALLOWED_IMAGE_TYPES = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
]);

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_START_OF_FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);
const RESERVED_COVER_FILENAMES = new Set(['cover.png', 'cover.jpg', 'cover.webp']);
const MAX_IMAGE_PIXELS = 40_000_000;
const { PNG } = pngPackage;
const require = createRequire(import.meta.url);
const WEBP_DECODER_WASM_PATH = require.resolve('@jsquash/webp/codec/dec/webp_dec.wasm');
let webpDecoderInitialization;

function isCompletePng(buffer) {
  if (buffer.length < 45 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return false;
  let offset = 8;
  let firstChunk = true;
  let hasImageData = false;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const end = offset + 12 + length;
    if (end > buffer.length || !/^[A-Za-z]{4}$/.test(type)) return false;
    if (firstChunk) {
      if (type !== 'IHDR' || length !== 13) return false;
      if (buffer.readUInt32BE(offset + 8) === 0 || buffer.readUInt32BE(offset + 12) === 0) return false;
      firstChunk = false;
    }
    if (type === 'IDAT') hasImageData = true;
    if (type === 'IEND') return length === 0 && hasImageData && end === buffer.length;
    offset = end;
  }
  return false;
}

function isCompleteJpeg(buffer) {
  if (buffer.length < 16 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return false;
  let offset = 2;
  let hasStartOfFrame = false;
  let hasScan = false;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) return false;
    while (buffer[offset] === 0xff) offset += 1;
    if (offset >= buffer.length) return false;
    const marker = buffer[offset];
    offset += 1;
    if (marker === 0xd9) return hasStartOfFrame && hasScan && offset === buffer.length;
    if (marker === 0x00 || marker === 0xd8) return false;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > buffer.length) return false;
    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) return false;
    if (JPEG_START_OF_FRAME_MARKERS.has(marker)) {
      if (segmentLength < 8 || buffer.readUInt16BE(offset + 3) === 0 || buffer.readUInt16BE(offset + 5) === 0) return false;
      hasStartOfFrame = true;
    }
    offset += segmentLength;
    if (marker !== 0xda) continue;
    hasScan = true;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const markerStart = offset;
      while (buffer[offset] === 0xff) offset += 1;
      if (offset >= buffer.length) return false;
      const scanMarker = buffer[offset];
      offset += 1;
      if (scanMarker === 0x00 || (scanMarker >= 0xd0 && scanMarker <= 0xd7)) continue;
      offset = markerStart;
      break;
    }
  }
  return false;
}

function readUint24LittleEndian(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function isCompleteWebp(buffer) {
  if (buffer.length < 20 || buffer.subarray(0, 4).toString('ascii') !== 'RIFF'
    || buffer.subarray(8, 12).toString('ascii') !== 'WEBP'
    || buffer.readUInt32LE(4) !== buffer.length - 8) return false;
  let offset = 12;
  let hasImageChunk = false;
  while (offset + 8 <= buffer.length) {
    const type = buffer.subarray(offset, offset + 4).toString('ascii');
    const length = buffer.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const paddedEnd = dataEnd + (length % 2);
    if (dataEnd > buffer.length || paddedEnd > buffer.length) return false;
    if (type === 'VP8 ') {
      if (length < 10 || buffer[dataStart + 3] !== 0x9d || buffer[dataStart + 4] !== 0x01
        || buffer[dataStart + 5] !== 0x2a) return false;
      hasImageChunk = true;
    } else if (type === 'VP8L') {
      if (length < 5 || buffer[dataStart] !== 0x2f) return false;
      const dimensions = buffer.readUInt32LE(dataStart + 1);
      if ((dimensions >>> 29) !== 0) return false;
      hasImageChunk = true;
    } else if (type === 'VP8X') {
      if (length !== 10 || readUint24LittleEndian(buffer, dataStart + 4) + 1 < 1
        || readUint24LittleEndian(buffer, dataStart + 7) + 1 < 1) return false;
    }
    offset = paddedEnd;
  }
  return hasImageChunk && offset === buffer.length;
}

function pngDimensions(buffer) {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function webpDimensions(buffer) {
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const type = buffer.subarray(offset, offset + 4).toString('ascii');
    const length = buffer.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    if (type === 'VP8 ' && length >= 10) {
      return {
        width: buffer.readUInt16LE(dataStart + 6) & 0x3fff,
        height: buffer.readUInt16LE(dataStart + 8) & 0x3fff,
      };
    }
    if (type === 'VP8L' && length >= 5) {
      const dimensions = buffer.readUInt32LE(dataStart + 1);
      return {
        width: (dimensions & 0x3fff) + 1,
        height: ((dimensions >>> 14) & 0x3fff) + 1,
      };
    }
    if (type === 'VP8X' && length === 10) {
      return {
        width: readUint24LittleEndian(buffer, dataStart + 4) + 1,
        height: readUint24LittleEndian(buffer, dataStart + 7) + 1,
      };
    }
    offset = dataStart + length + (length % 2);
  }
  return { width: 0, height: 0 };
}

function enforcePixelLimit({ width, height }) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1
    || width > MAX_IMAGE_PIXELS / height) throw new Error('Image dimensions exceed the safe decode limit.');
}

async function prepareWebpDecoder() {
  if (!webpDecoderInitialization) {
    webpDecoderInitialization = (async () => {
      const wasmBytes = await readFile(WEBP_DECODER_WASM_PATH);
      const wasmModule = await WebAssembly.compile(wasmBytes);
      await initializeWebpDecoder(wasmModule);
    })();
  }
  return webpDecoderInitialization;
}

async function decodeAllowedImage(buffer, mime) {
  if (mime === 'image/png') {
    enforcePixelLimit(pngDimensions(buffer));
    const decoded = PNG.sync.read(buffer, { checkCRC: true });
    enforcePixelLimit(decoded);
    return;
  }
  if (mime === 'image/jpeg') {
    const decoded = jpegDecoder.decode(buffer, {
      useTArray: true,
      tolerantDecoding: false,
      maxResolutionInMP: MAX_IMAGE_PIXELS / 1_000_000,
      maxMemoryUsageInMB: 192,
    });
    enforcePixelLimit(decoded);
    return;
  }
  enforcePixelLimit(webpDimensions(buffer));
  await prepareWebpDecoder();
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const decoded = await decodeWebp(arrayBuffer);
  enforcePixelLimit(decoded);
}

function detectAllowedImage(buffer) {
  if (isCompletePng(buffer)) return { mime: 'image/png' };
  if (isCompleteJpeg(buffer)) return { mime: 'image/jpeg' };
  if (isCompleteWebp(buffer)) return { mime: 'image/webp' };
  return undefined;
}

function fieldError(field, code, message) {
  return { field, code, message };
}

export class ImageUploadValidationError extends Error {
  constructor(status, code, fields) {
    super(code);
    this.name = 'ImageUploadValidationError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

function fail(status, code, field, message) {
  throw new ImageUploadValidationError(status, code, [fieldError(field, code, message)]);
}

function unsafeOriginalFilename(filename) {
  return typeof filename !== 'string' || filename.length === 0
    || filename.includes('\0') || filename.includes('/') || filename.includes('\\')
    || filename.includes('..') || filename.includes('%');
}

async function validateImageFile(upload, field, { content = false } = {}) {
  if (!upload || typeof upload !== 'object') fail(422, 'required', field, `請選擇${content ? '內容' : '封面'}圖片。`);
  if (upload.truncated) fail(400, 'incomplete_upload', field, '圖片上傳未完成，請重新選擇。');
  if (unsafeOriginalFilename(upload.originalFilename)) {
    fail(422, 'unsafe_filename', field, '圖片檔名包含不安全的字元或路徑。');
  }
  if (content && RESERVED_COVER_FILENAMES.has(upload.originalFilename)) {
    fail(422, 'reserved_filename', field, '內容圖片不可使用保留的封面檔名。');
  }
  if (content && !isSafeContentImageFilename(upload.originalFilename)) {
    fail(422, 'unsafe_filename', field, '內容圖片檔名只可使用小寫英文字母、數字、連字符、底線和一個支援的副檔名。');
  }
  if (!Number.isInteger(upload.byteLength) || upload.byteLength < 1) {
    fail(422, 'empty_file', field, '圖片不可為空檔案。');
  }
  if (upload.byteLength > HOMEWORK_PUBLISH_LIMITS.imageBytes) {
    fail(413, 'file_too_large', field, '每張圖片最多 5 MiB。');
  }

  let details;
  try {
    details = await stat(upload.path);
  } catch {
    fail(400, 'incomplete_upload', field, '找不到完整的暫存圖片，請重新上傳。');
  }
  if (!details.isFile() || details.size !== upload.byteLength) {
    fail(400, 'incomplete_upload', field, '圖片上傳未完成，請重新選擇。');
  }
  if (details.size > HOMEWORK_PUBLISH_LIMITS.imageBytes) {
    fail(413, 'file_too_large', field, '每張圖片最多 5 MiB。');
  }

  let imageBytes;
  try {
    imageBytes = await readFile(upload.path);
  } catch {
    fail(422, 'invalid_image', field, '圖片內容無法驗證。');
  }
  const detected = detectAllowedImage(imageBytes);
  const extension = ALLOWED_IMAGE_TYPES.get(detected?.mime);
  if (!extension) {
    fail(415, 'unsupported_image_type', field, '只接受 PNG、JPEG 或 WebP 圖片。');
  }
  if (upload.clientMimeType !== detected.mime) {
    fail(415, 'mime_mismatch', field, '圖片宣告格式與實際內容不符。');
  }
  const binaryText = imageBytes.toString('latin1');
  if (/<\s*(?:!doctype\s+html|html|svg|script)\b/i.test(binaryText)) {
    fail(415, 'unsupported_image_type', field, '圖片包含不允許的 HTML 或 SVG 內容。');
  }
  try {
    await decodeAllowedImage(imageBytes, detected.mime);
  } catch {
    fail(415, 'invalid_image', field, '圖片內容不完整或無法安全解碼。');
  }
  if (content && !upload.originalFilename.endsWith(`.${extension}`)) {
    fail(422, 'extension_mismatch', field, '內容圖片副檔名與實際圖片類型不符。');
  }

  return {
    ...upload,
    actualMime: detected.mime,
    actualExtension: extension,
    destinationFilename: content ? upload.originalFilename : `cover.${extension}`,
  };
}

export async function validateStagedImages({ id, coverImage, contentImages = [] } = {}) {
  if (!Array.isArray(contentImages)) {
    fail(422, 'invalid_type', 'contentImages', '內容圖片資料格式不正確。');
  }
  if (contentImages.length > HOMEWORK_PUBLISH_LIMITS.contentImageCount) {
    fail(413, 'too_many_files', 'contentImages', '內容圖片最多 10 張。');
  }
  const totalBytes = contentImages.reduce((total, upload) => total + (Number(upload?.byteLength) || 0), 0);
  if (totalBytes > HOMEWORK_PUBLISH_LIMITS.contentImagesBytes) {
    fail(413, 'files_too_large', 'contentImages', '內容圖片總量最多 30 MiB。');
  }
  const filenames = contentImages.map(({ originalFilename } = {}) => originalFilename);
  if (new Set(filenames).size !== filenames.length) {
    fail(422, 'duplicate_filename', 'contentImages', '同一次上傳不可包含重複的內容圖片檔名。');
  }

  const validatedCover = await validateImageFile(coverImage, 'coverImage');
  const validatedContent = [];
  for (const upload of contentImages) {
    validatedContent.push(await validateImageFile(upload, 'contentImages', { content: true }));
  }
  return { id, coverImage: validatedCover, contentImages: validatedContent };
}

export function validateContentImageReferences({ id, contentHtml, filenames = [] } = {}) {
  const referenced = new Set(extractImageSources(contentHtml));
  const expected = new Set(filenames.map((filename) => contentImagePath(id, filename)));
  const errors = [];
  for (const source of referenced) {
    if (!expected.has(source)) {
      errors.push(fieldError('contentHtml', 'missing_uploaded_image', `主要內容圖片「${source}」沒有對應的本次上傳檔案。`));
    }
  }
  for (const source of expected) {
    if (!referenced.has(source)) {
      errors.push(fieldError('contentHtml', 'unused_uploaded_image', `已上傳圖片「${source}」未在主要內容 HTML 中使用。`));
    }
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}
