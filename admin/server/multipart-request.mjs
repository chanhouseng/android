import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import Busboy from 'busboy';
import { HOMEWORK_PUBLISH_LIMITS } from '../shared/homework-preview-contract.mjs';

const PAYLOAD_FIELD_LIMIT_BYTES = 512 * 1024;

export class MultipartRequestError extends Error {
  constructor(status, code) {
    super(code);
    this.name = 'MultipartRequestError';
    this.status = status;
    this.code = code;
  }
}

function requestError(status, code) {
  return new MultipartRequestError(status, code);
}

function requireMultipartContentType(headers) {
  const contentType = headers?.['content-type'];
  if (typeof contentType !== 'string' || !/^multipart\/form-data(?:\s*;|\s*$)/i.test(contentType)) {
    throw requestError(415, 'unsupported_media_type');
  }
  return contentType;
}

function declaredLength(headers, limitBytes) {
  const value = headers?.['content-length'];
  if (value === undefined) return;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw requestError(400, 'invalid_request');
  const length = Number(value);
  if (!Number.isSafeInteger(length)) throw requestError(400, 'invalid_request');
  if (length > limitBytes) throw requestError(413, 'payload_too_large');
}

export async function parsePublishMultipart(request, response, {
  rootDirectory,
  requestLimitBytes = HOMEWORK_PUBLISH_LIMITS.requestBytes,
} = {}) {
  requireMultipartContentType(request.headers);
  declaredLength(request.headers, requestLimitBytes);

  const stagingRoot = path.join(path.resolve(rootDirectory), '.admin-staging');
  await mkdir(stagingRoot, { recursive: true });
  const transactionDirectory = await mkdtemp(path.join(stagingRoot, 'publish-'));
  const uploadsDirectory = path.join(transactionDirectory, 'uploads');
  await mkdir(uploadsDirectory);

  const cleanup = () => rm(transactionDirectory, { recursive: true, force: true });
  let busboy;
  try {
    busboy = Busboy({
      headers: request.headers,
      preservePath: true,
      limits: {
        fieldNameSize: 32,
        fieldSize: PAYLOAD_FIELD_LIMIT_BYTES,
        fields: 2,
        fileSize: HOMEWORK_PUBLISH_LIMITS.imageBytes,
        files: HOMEWORK_PUBLISH_LIMITS.contentImageCount + 1,
        parts: HOMEWORK_PUBLISH_LIMITS.contentImageCount + 2,
      },
    });
  } catch {
    await cleanup();
    throw requestError(400, 'invalid_request');
  }

  let payloadText;
  let coverImage;
  const contentImages = [];
  const fileWrites = [];
  let streamBytes = 0;
  let terminalError;
  let abortParsing;
  const remember = (error) => {
    if (terminalError) return;
    terminalError = error;
    if (error.status === 413) {
      response?.setHeader?.('Connection', 'close');
      abortParsing?.(error);
    }
  };

  const finished = new Promise((resolve, reject) => {
    let stopped = false;
    abortParsing = (error) => {
      if (stopped) return;
      stopped = true;
      request.unpipe(busboy);
      request.pause();
      busboy.destroy();
      reject(error);
    };
    request.on('data', (chunk) => {
      streamBytes += chunk.length;
      if (streamBytes > requestLimitBytes) remember(requestError(413, 'payload_too_large'));
    });
    request.once('aborted', () => abortParsing(requestError(400, 'invalid_request')));
    request.once('error', () => abortParsing(requestError(400, 'invalid_request')));
    busboy.once('error', () => abortParsing(requestError(400, 'invalid_request')));
    busboy.once('close', () => { if (!stopped) resolve(); });

    busboy.on('field', (name, value, info) => {
      if (name !== 'payload' || payloadText !== undefined) {
        remember(requestError(400, 'invalid_request'));
        return;
      }
      if (info.nameTruncated) remember(requestError(400, 'invalid_request'));
      if (info.valueTruncated) remember(requestError(413, 'payload_too_large'));
      payloadText = value;
    });

    busboy.on('file', (name, file, info) => {
      if (!['coverImage', 'contentImages'].includes(name)) {
        remember(requestError(400, 'invalid_request'));
        file.resume();
        return;
      }
      if (name === 'coverImage' && coverImage) {
        remember(requestError(400, 'invalid_request'));
        file.resume();
        return;
      }
      const upload = {
        originalFilename: info.filename,
        clientMimeType: info.mimeType,
        path: path.join(uploadsDirectory, `${randomUUID()}.upload`),
        byteLength: 0,
        truncated: false,
      };
      file.on('data', (chunk) => { upload.byteLength += chunk.length; });
      file.once('limit', () => {
        upload.truncated = true;
        remember(requestError(413, 'payload_too_large'));
      });
      const writing = pipeline(file, createWriteStream(upload.path, { flags: 'wx' }))
        .catch(() => { throw requestError(400, 'invalid_request'); });
      fileWrites.push(writing);
      if (name === 'coverImage') coverImage = upload;
      else contentImages.push(upload);
    });

    for (const event of ['fieldsLimit', 'filesLimit', 'partsLimit']) {
      busboy.once(event, () => remember(requestError(413, 'payload_too_large')));
    }
    request.pipe(busboy);
  });

  try {
    await finished;
    await Promise.all(fileWrites);
    if (terminalError) throw terminalError;
    if (payloadText === undefined || !coverImage) throw requestError(400, 'invalid_request');
    return { transactionDirectory, payloadText, coverImage, contentImages, cleanup };
  } catch (error) {
    await Promise.allSettled(fileWrites);
    await cleanup();
    throw error instanceof MultipartRequestError ? error : requestError(400, 'invalid_request');
  }
}
