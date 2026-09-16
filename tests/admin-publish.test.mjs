import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PassThrough, Readable } from 'node:stream';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const PROTECTED_CONTENT_FILES = [
  'content/homework.json',
  'homework/index.html',
  'training/files.json',
];
const protectedContentSnapshot = await Promise.all(
  PROTECTED_CONTENT_FILES.map((file) => readFile(new URL(`../${file}`, import.meta.url))),
);

const VALID_PAYLOAD = Object.freeze({
  id: 'module-f',
  title: 'Module F',
  description: 'RecyclerView 練習',
  coverAlt: 'Module F 成果畫面',
  contentHtml: '<section><h2>功能說明</h2><p>Homework 內容。</p></section>',
});

async function publishContract() {
  return import('../admin/shared/homework-preview-contract.mjs');
}

test('publish contract validates cover alt and retains normalized preview fields', async () => {
  const { validateHomeworkPublishInput } = await publishContract();
  assert.deepEqual(validateHomeworkPublishInput({
    ...VALID_PAYLOAD,
    title: '  Module F  ',
    description: '  RecyclerView 練習  ',
    coverAlt: '  Module F 成果畫面  ',
  }), { ok: true, value: VALID_PAYLOAD });

  for (const coverAlt of [undefined, null, 4, '', '   ', '<img>', '字'.repeat(161)]) {
    const result = validateHomeworkPublishInput({ ...VALID_PAYLOAD, coverAlt });
    assert.equal(result.ok, false);
    assert.equal(result.errors.at(-1).field, 'coverAlt');
  }
});

test('publish contract exposes exact image limits and canonical safe future paths', async () => {
  const {
    HOMEWORK_PUBLISH_LIMITS,
    contentImagePath,
    isSafeContentImageFilename,
  } = await publishContract();

  assert.deepEqual(HOMEWORK_PUBLISH_LIMITS, {
    coverAltCharacters: 160,
    imageBytes: 5 * 1024 * 1024,
    contentImageCount: 10,
    contentImagesBytes: 30 * 1024 * 1024,
    requestBytes: 36 * 1024 * 1024,
  });
  for (const filename of ['screen-1.png', 'login_page.webp', 'result.jpg']) {
    assert.equal(isSafeContentImageFilename(filename), true, filename);
    assert.equal(contentImagePath('module-f', filename), `img/module-f/${filename}`);
  }
  for (const filename of [
    '畫面.png', 'Screen 1.png', '../screen.png', 'screen.php.png', 'screen.jpeg',
    'screen.gif', 'screen.PNG', 'screen%2epng', 'screen\\x.png', 'screen\0.png',
    'cover.png', 'cover.jpg', 'cover.webp',
  ]) assert.equal(isSafeContentImageFilename(filename), false, filename);
});

const IMAGE_BYTES = Object.freeze({
  png: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4AWP4DwQACfsD/c8LaHIAAAAASUVORK5CYII=', 'base64'),
  jpg: Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRQBAwQEBQQFCQUFCRQNCw0UFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFP/AABEIAAEAAQMBEQACEQEDEQH/xAGiAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgsQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+gEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoLEQACAQIEBAMEBwUEBAABAncAAQIDEQQFITEGEkFRB2FxEyIygQgUQpGhscEJIzNS8BVictEKFiQ04SXxFxgZGiYnKCkqNTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqCg4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2dri4+Tl5ufo6ery8/T19vf4+fr/2gAMAwEAAhEDEQA/AP1ToA//2Q==', 'base64'),
  webp: Buffer.from('UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=', 'base64'),
});

async function withImageDirectory(action) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'admin-publish-images-'));
  try {
    return await action(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function stagedImage(directory, filename, bytes, clientMimeType) {
  const filePath = path.join(directory, `${Math.random().toString(16).slice(2)}.upload`);
  await writeFile(filePath, bytes);
  return { originalFilename: filename, clientMimeType, path: filePath, byteLength: bytes.length, truncated: false };
}

test('image validator accepts actual PNG, JPEG and WebP and chooses the detected cover extension', async () => {
  const { validateStagedImages } = await import('../admin/server/image-upload-validator.mjs');
  await withImageDirectory(async (directory) => {
    for (const [extension, mime] of [['png', 'image/png'], ['jpg', 'image/jpeg'], ['webp', 'image/webp']]) {
      const coverImage = await stagedImage(directory, `cover.${extension}`, IMAGE_BYTES[extension], mime);
      const contentImage = await stagedImage(directory, `screen-1.${extension}`, IMAGE_BYTES[extension], mime);
      const result = await validateStagedImages({ id: 'module-f', coverImage, contentImages: [contentImage] });
      assert.equal(result.coverImage.destinationFilename, `cover.${extension}`);
      assert.equal(result.coverImage.actualMime, mime);
      assert.equal(result.contentImages[0].destinationFilename, `screen-1.${extension}`);
    }
  });
});

test('image validator rejects empty, truncated, disguised, mismatched and unsafe uploads', async () => {
  const { validateStagedImages, ImageUploadValidationError } = await import('../admin/server/image-upload-validator.mjs');
  await withImageDirectory(async (directory) => {
    const validCover = await stagedImage(directory, 'cover.png', IMAGE_BYTES.png, 'image/png');
    const invalidCases = [
      ['empty.png', Buffer.alloc(0), 'image/png', 422],
      ['fake.png', Buffer.from('<!doctype html><svg></svg>'), 'image/png', 415],
      ['fake.png', Buffer.from('GIF89a'), 'image/gif', 415],
      ['wrong.png', IMAGE_BYTES.jpg, 'image/png', 415],
      ['wrong.png', IMAGE_BYTES.jpg, 'image/jpeg', 422],
      ['../screen.png', IMAGE_BYTES.png, 'image/png', 422],
      ['screen.php.png', IMAGE_BYTES.png, 'image/png', 422],
      ['screen\0.png', IMAGE_BYTES.png, 'image/png', 422],
    ];
    for (const [filename, bytes, mime, status] of invalidCases) {
      const contentImage = await stagedImage(directory, filename, bytes, mime);
      await assert.rejects(
        () => validateStagedImages({ id: 'module-f', coverImage: validCover, contentImages: [contentImage] }),
        (error) => error instanceof ImageUploadValidationError && error.status === status && error.fields.length > 0,
        filename,
      );
    }
    const truncated = { ...(await stagedImage(directory, 'screen.png', IMAGE_BYTES.png, 'image/png')), truncated: true };
    await assert.rejects(
      () => validateStagedImages({ id: 'module-f', coverImage: validCover, contentImages: [truncated] }),
      (error) => error instanceof ImageUploadValidationError && error.status === 400,
    );
    const polyglot = await stagedImage(directory, 'polyglot.png',
      Buffer.concat([IMAGE_BYTES.png, Buffer.from('<svg><script>alert(1)</script></svg>')]), 'image/png');
    await assert.rejects(
      () => validateStagedImages({ id: 'module-f', coverImage: validCover, contentImages: [polyglot] }),
      (error) => error instanceof ImageUploadValidationError && error.status === 415,
    );

    const corruptPngBytes = Buffer.from(IMAGE_BYTES.png);
    const idatOffset = corruptPngBytes.indexOf(Buffer.from('IDAT'));
    corruptPngBytes[idatOffset + 4] ^= 0xff;
    const structurallyWrappedCases = [
      ['corrupt.png', corruptPngBytes, 'image/png'],
      ['wrapped.jpg', Buffer.from([
        0xff, 0xd8,
        0xff, 0xe0, 0x00, 0x02,
        0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00,
        0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
        0x00, 0xff, 0xd9,
      ]), 'image/jpeg'],
      ['header.webp', Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0x16, 0x00, 0x00, 0x00,
        0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58,
        0x0a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      ]), 'image/webp'],
    ];
    for (const [filename, bytes, mime] of structurallyWrappedCases) {
      const invalidImage = await stagedImage(directory, filename, bytes, mime);
      await assert.rejects(
        () => validateStagedImages({ id: 'module-f', coverImage: validCover, contentImages: [invalidImage] }),
        (error) => error instanceof ImageUploadValidationError && error.status === 415,
        filename,
      );
    }

    for (const [filename, bytes, mime] of [
      ['truncated.png', IMAGE_BYTES.png.subarray(0, -1), 'image/png'],
      ['truncated.jpg', IMAGE_BYTES.jpg.subarray(0, -1), 'image/jpeg'],
      ['truncated.webp', IMAGE_BYTES.webp.subarray(0, -1), 'image/webp'],
      ['trailing.png', Buffer.concat([IMAGE_BYTES.png, Buffer.from([0])]), 'image/png'],
      ['trailing.jpg', Buffer.concat([IMAGE_BYTES.jpg, Buffer.from([0])]), 'image/jpeg'],
      ['trailing.webp', Buffer.concat([IMAGE_BYTES.webp, Buffer.from([0])]), 'image/webp'],
    ]) {
      const invalidImage = await stagedImage(directory, filename, bytes, mime);
      await assert.rejects(
        () => validateStagedImages({ id: 'module-f', coverImage: validCover, contentImages: [invalidImage] }),
        (error) => error instanceof ImageUploadValidationError && error.status === 415,
        filename,
      );
    }
  });
});

test('image validator enforces per-file, content total, count and duplicate filename limits', async () => {
  const { validateStagedImages, ImageUploadValidationError } = await import('../admin/server/image-upload-validator.mjs');
  await withImageDirectory(async (directory) => {
    const coverImage = await stagedImage(directory, 'cover.png', IMAGE_BYTES.png, 'image/png');
    const duplicate = await stagedImage(directory, 'screen.png', IMAGE_BYTES.png, 'image/png');
    await assert.rejects(
      () => validateStagedImages({ id: 'module-f', coverImage, contentImages: [duplicate, duplicate] }),
      (error) => error instanceof ImageUploadValidationError && error.status === 422,
    );
    const tooMany = Array.from({ length: 11 }, (_, index) => ({
      ...duplicate, originalFilename: `screen-${index}.png`,
    }));
    await assert.rejects(
      () => validateStagedImages({ id: 'module-f', coverImage, contentImages: tooMany }),
      (error) => error instanceof ImageUploadValidationError && error.status === 413,
    );
    const oversized = { ...duplicate, byteLength: (5 * 1024 * 1024) + 1 };
    await assert.rejects(
      () => validateStagedImages({ id: 'module-f', coverImage, contentImages: [oversized] }),
      (error) => error instanceof ImageUploadValidationError && error.status === 413,
    );
    const total = Array.from({ length: 7 }, (_, index) => ({
      ...duplicate, originalFilename: `screen-${index}.png`, byteLength: 5 * 1024 * 1024,
    }));
    await assert.rejects(
      () => validateStagedImages({ id: 'module-f', coverImage, contentImages: total }),
      (error) => error instanceof ImageUploadValidationError && error.status === 413,
    );
    const coverCollision = await stagedImage(directory, 'cover.png', IMAGE_BYTES.png, 'image/png');
    await assert.rejects(
      () => validateStagedImages({ id: 'module-f', coverImage, contentImages: [coverCollision] }),
      (error) => error instanceof ImageUploadValidationError && error.status === 422
        && error.fields.some(({ code }) => code === 'reserved_filename'),
    );
  });
});

test('content image references must exactly equal the uploaded image path set', async () => {
  const { validateContentImageReferences } = await import('../admin/server/image-upload-validator.mjs');
  const valid = '<section><img src="img/module-f/screen-1.png" alt="畫面"><img src="img/module-f/result.jpg" alt="結果"></section>';
  assert.deepEqual(validateContentImageReferences({
    id: 'module-f', contentHtml: valid, filenames: ['screen-1.png', 'result.jpg'],
  }), { ok: true });
  assert.deepEqual(validateContentImageReferences({
    id: 'module-f', contentHtml: `${valid}<img src="img/module-f/screen-1.png" alt="重複">`,
    filenames: ['screen-1.png', 'result.jpg'],
  }), { ok: true });

  for (const [contentHtml, filenames] of [
    ['<img src="img/module-f/missing.png" alt="缺少">', []],
    ['<p>沒有圖片</p>', ['unused.png']],
    ['<img src="img/other/screen.png" alt="其他">', ['screen.png']],
    ['<img src="img/module-f/Screen.png" alt="大小寫">', ['screen.png']],
    ['<img src="img/module-f/screen%2epng" alt="編碼">', ['screen.png']],
  ]) {
    const result = validateContentImageReferences({ id: 'module-f', contentHtml, filenames });
    assert.equal(result.ok, false);
    assert.ok(result.errors.every(({ field }) => field === 'contentHtml'));
  }
});

function multipartBody(boundary, parts, { close = true } = {}) {
  const chunks = [];
  for (const part of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    if (part.filename !== undefined) {
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\n`));
      chunks.push(Buffer.from(`Content-Type: ${part.type ?? 'application/octet-stream'}\r\n\r\n`));
      chunks.push(Buffer.from(part.value));
    } else {
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${part.name}"\r\n\r\n${part.value}`));
    }
    chunks.push(Buffer.from('\r\n'));
  }
  if (close) chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(chunks);
}

function multipartRequest(body, boundary, headers = {}) {
  const request = Readable.from([body]);
  request.headers = {
    'content-type': `multipart/form-data; boundary=${boundary}`,
    'content-length': String(body.length),
    ...headers,
  };
  return request;
}

async function withMultipartRoot(action) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'admin-publish-multipart-'));
  try {
    return await action(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function validMultipartParts() {
  return [
    { name: 'payload', value: JSON.stringify(VALID_PAYLOAD) },
    { name: 'coverImage', filename: 'cover.png', type: 'image/png', value: IMAGE_BYTES.png },
    { name: 'contentImages', filename: 'screen-1.png', type: 'image/png', value: IMAGE_BYTES.png },
  ];
}

test('multipart parser stages only the exact publish fields and reports their real byte lengths', async () => {
  const { parsePublishMultipart } = await import('../admin/server/multipart-request.mjs');
  await withMultipartRoot(async (rootDirectory) => {
    const boundary = 'batch10c-valid-boundary';
    const body = multipartBody(boundary, validMultipartParts());
    const headers = new Map();
    const result = await parsePublishMultipart(
      multipartRequest(body, boundary),
      { setHeader(name, value) { headers.set(name, value); } },
      { rootDirectory },
    );
    assert.equal(result.payloadText, JSON.stringify(VALID_PAYLOAD));
    assert.equal(result.coverImage.originalFilename, 'cover.png');
    assert.equal(result.coverImage.byteLength, IMAGE_BYTES.png.length);
    assert.deepEqual(result.contentImages.map(({ originalFilename }) => originalFilename), ['screen-1.png']);
    assert.equal(existsSync(result.coverImage.path), true);
    assert.equal(path.dirname(path.dirname(result.coverImage.path)), path.join(rootDirectory, '.admin-staging', path.basename(result.transactionDirectory)));
    await result.cleanup();
    assert.equal(existsSync(result.transactionDirectory), false);
    assert.equal(headers.size, 0);
  });
});

test('multipart parser preserves a suspicious original filename so validation can reject instead of rename it', async () => {
  const { parsePublishMultipart } = await import('../admin/server/multipart-request.mjs');
  await withMultipartRoot(async (rootDirectory) => {
    const boundary = 'batch10c-preserve-path';
    const parts = validMultipartParts();
    parts[2] = { ...parts[2], filename: '../screen-1.png' };
    const body = multipartBody(boundary, parts);
    const result = await parsePublishMultipart(
      multipartRequest(body, boundary), { setHeader() {} }, { rootDirectory },
    );
    assert.equal(result.contentImages[0].originalFilename, '../screen-1.png');
    await result.cleanup();
  });
});

test('multipart parser rejects unsupported type before staging and enforces request bytes before and during streaming', async () => {
  const { parsePublishMultipart, MultipartRequestError } = await import('../admin/server/multipart-request.mjs');
  await withMultipartRoot(async (rootDirectory) => {
    const responseHeaders = new Map();
    const response = { setHeader(name, value) { responseHeaders.set(name, value); } };
    const wrongType = Readable.from(['{}']);
    wrongType.headers = { 'content-type': 'application/json', 'content-length': '2' };
    await assert.rejects(
      () => parsePublishMultipart(wrongType, response, { rootDirectory }),
      (error) => error instanceof MultipartRequestError && error.status === 415,
    );
    assert.equal(existsSync(path.join(rootDirectory, '.admin-staging')), false);

    const boundary = 'batch10c-size-boundary';
    const tiny = multipartBody(boundary, validMultipartParts());
    const declared = multipartRequest(tiny, boundary, { 'content-length': String((36 * 1024 * 1024) + 1) });
    await assert.rejects(
      () => parsePublishMultipart(declared, response, { rootDirectory }),
      (error) => error instanceof MultipartRequestError && error.status === 413,
    );
    const streamed = multipartRequest(tiny, boundary, { 'content-length': undefined });
    await assert.rejects(
      () => parsePublishMultipart(streamed, response, { rootDirectory, requestLimitBytes: tiny.length - 1 }),
      (error) => error instanceof MultipartRequestError && error.status === 413,
    );
    assert.equal(responseHeaders.get('Connection'), 'close');
  });
});

test('multipart parser rejects a continuing chunked request promptly at the total byte limit', async () => {
  const { parsePublishMultipart, MultipartRequestError } = await import('../admin/server/multipart-request.mjs');
  await withMultipartRoot(async (rootDirectory) => {
    const boundary = 'batch10c-never-ending';
    const request = new PassThrough();
    request.headers = { 'content-type': `multipart/form-data; boundary=${boundary}` };
    const responseHeaders = new Map();
    const outcome = parsePublishMultipart(request, {
      setHeader(name, value) { responseHeaders.set(name, value); },
    }, { rootDirectory, requestLimitBytes: 128 }).then(
      () => ({ type: 'success' }),
      (error) => ({ type: 'error', error }),
    );
    request.write(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="coverImage"; filename="cover.png"\r\nContent-Type: image/png\r\n\r\n`));
    request.write(Buffer.alloc(256, 1));
    const result = await Promise.race([
      outcome,
      new Promise((resolve) => setTimeout(() => resolve({ type: 'timeout' }), 250)),
    ]);
    request.destroy();
    assert.equal(result.type, 'error');
    assert.ok(result.error instanceof MultipartRequestError);
    assert.equal(result.error.status, 413);
    assert.equal(responseHeaders.get('Connection'), 'close');
  });
});

test('multipart parser rejects missing, repeated and unknown parts and cleans each transaction', async () => {
  const { parsePublishMultipart, MultipartRequestError } = await import('../admin/server/multipart-request.mjs');
  await withMultipartRoot(async (rootDirectory) => {
    const cases = [
      validMultipartParts().filter(({ name }) => name !== 'payload'),
      [...validMultipartParts(), { name: 'payload', value: '{}' }],
      [...validMultipartParts(), { name: 'coverImage', filename: 'again.png', type: 'image/png', value: IMAGE_BYTES.png }],
      [...validMultipartParts(), { name: 'unexpected', value: 'x' }],
    ];
    for (const [index, parts] of cases.entries()) {
      const boundary = `batch10c-invalid-${index}`;
      const body = multipartBody(boundary, parts);
      await assert.rejects(
        () => parsePublishMultipart(multipartRequest(body, boundary), { setHeader() {} }, { rootDirectory }),
        (error) => error instanceof MultipartRequestError && error.status === 400,
      );
    }
    const staging = path.join(rootDirectory, '.admin-staging');
    assert.deepEqual(existsSync(staging) ? await (await import('node:fs/promises')).readdir(staging) : [], []);
  });
});

test('multipart parser rejects incomplete, oversized and excessive file streams', async () => {
  const { parsePublishMultipart, MultipartRequestError } = await import('../admin/server/multipart-request.mjs');
  await withMultipartRoot(async (rootDirectory) => {
    const incompleteBoundary = 'batch10c-incomplete';
    const incomplete = multipartBody(incompleteBoundary, validMultipartParts(), { close: false });
    await assert.rejects(
      () => parsePublishMultipart(multipartRequest(incomplete, incompleteBoundary), { setHeader() {} }, { rootDirectory }),
      (error) => error instanceof MultipartRequestError && error.status === 400,
    );

    const largeBoundary = 'batch10c-file-limit';
    const largeParts = validMultipartParts();
    largeParts[1] = { ...largeParts[1], value: Buffer.alloc((5 * 1024 * 1024) + 1, 1) };
    const large = multipartBody(largeBoundary, largeParts);
    await assert.rejects(
      () => parsePublishMultipart(multipartRequest(large, largeBoundary), { setHeader() {} }, { rootDirectory }),
      (error) => error instanceof MultipartRequestError && error.status === 413,
    );

    const countBoundary = 'batch10c-count-limit';
    const tooMany = [validMultipartParts()[0], validMultipartParts()[1], ...Array.from({ length: 11 }, (_, index) => ({
      name: 'contentImages', filename: `screen-${index}.png`, type: 'image/png', value: IMAGE_BYTES.png,
    }))];
    const count = multipartBody(countBoundary, tooMany);
    await assert.rejects(
      () => parsePublishMultipart(multipartRequest(count, countBoundary), { setHeader() {} }, { rootDirectory }),
      (error) => error instanceof MultipartRequestError && error.status === 413,
    );
  });
});

test('renderer keeps previews script-free with data images and emits production-only scripts', async () => {
  const { renderHomeworkPage } = await import('../admin/server/homework-page-renderer.mjs');
  const preview = renderHomeworkPage({
    ...VALID_PAYLOAD,
    preview: true,
    assetBase: '/private/assets/',
    scriptBase: '/private/scripts/',
  });
  assert.match(preview, /img-src 'self' data:/);
  assert.match(preview, /script-src 'none'/);
  assert.doesNotMatch(preview, /<script\b/i);

  const formal = renderHomeworkPage({
    ...VALID_PAYLOAD,
    contentHtml: '<section data-accordion-root><article data-accordion-item><button type="button" data-accordion-trigger aria-expanded="true" aria-controls="panel">內容</button><div id="panel" data-accordion-panel>說明</div></article></section>',
    preview: false,
    assetBase: '../assets/css/',
    scriptBase: '../assets/js/',
  });
  assert.doesNotMatch(formal, /Content-Security-Policy|尚未發佈|data:|admin_session|csrf/i);
  for (const stylesheet of ['foundation', 'app-shell', 'accordion', 'detail-page']) {
    assert.match(formal, new RegExp(`href="\.\./assets/css/${stylesheet}\\.css"`));
  }
  assert.match(formal, /<script src="\.\.\/assets\/js\/site-navigation\.js"><\/script>/);
  assert.match(formal, /<script src="\.\.\/assets\/js\/accordion\.js"><\/script>/);
  assert.match(formal, /data-site-root="\.\.\/"/);

  const withoutAccordion = renderHomeworkPage({
    ...VALID_PAYLOAD,
    preview: false,
    assetBase: '../assets/css/',
    scriptBase: '../assets/js/',
  });
  assert.match(withoutAccordion, /site-navigation\.js/);
  assert.doesNotMatch(withoutAccordion, /accordion\.js/);
});

function indexTemplate(marker, count = false) {
  const countRegion = count ? '<!-- GENERATED HOMEWORK COUNT START -->0<!-- GENERATED HOMEWORK COUNT END -->' : '';
  return `<!doctype html><html><body>${countRegion}<!-- GENERATED ${marker} START -->old<!-- GENERATED ${marker} END --></body></html>\n`;
}

async function makePublisherFixture() {
  const rootDirectory = await mkdtemp(path.join(os.tmpdir(), 'admin-publisher-project-'));
  await Promise.all([
    mkdir(path.join(rootDirectory, 'content'), { recursive: true }),
    mkdir(path.join(rootDirectory, 'homework', 'img'), { recursive: true }),
    mkdir(path.join(rootDirectory, 'world skill'), { recursive: true }),
    mkdir(path.join(rootDirectory, 'training'), { recursive: true }),
    mkdir(path.join(rootDirectory, 'train'), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(path.join(rootDirectory, 'content', 'homework.json'), '[]\n'),
    writeFile(path.join(rootDirectory, 'content', 'world-skills.json'), '[]\n'),
    writeFile(path.join(rootDirectory, 'training', 'files.json'), '[]\n'),
    writeFile(path.join(rootDirectory, 'homework', 'index.html'), indexTemplate('HOMEWORK ITEMS', true)),
    writeFile(path.join(rootDirectory, 'world skill', 'index.html'), indexTemplate('WORLD SKILLS')),
  ]);
  return rootDirectory;
}

async function makePublishTransaction(rootDirectory, payload = VALID_PAYLOAD, content = []) {
  const stagingRoot = path.join(rootDirectory, '.admin-staging');
  await mkdir(stagingRoot, { recursive: true });
  const transactionDirectory = await mkdtemp(path.join(stagingRoot, 'publish-'));
  const uploads = path.join(transactionDirectory, 'uploads');
  await mkdir(uploads);
  const coverPath = path.join(uploads, 'cover.upload');
  await writeFile(coverPath, IMAGE_BYTES.png);
  const contentImages = [];
  for (const [index, filename] of content.entries()) {
    const uploadPath = path.join(uploads, `${index}.upload`);
    await writeFile(uploadPath, IMAGE_BYTES.png);
    contentImages.push({ path: uploadPath, destinationFilename: filename, originalFilename: filename,
      actualMime: 'image/png', actualExtension: 'png', byteLength: IMAGE_BYTES.png.length });
  }
  return {
    transactionDirectory,
    homework: payload,
    images: {
      coverImage: { path: coverPath, destinationFilename: 'cover.png', originalFilename: 'cover.png',
        actualMime: 'image/png', actualExtension: 'png', byteLength: IMAGE_BYTES.png.length },
      contentImages,
    },
  };
}

test('publisher creates formal page, images, lock-time JSON order and rebuilt index', async () => {
  const { publishHomework } = await import('../admin/server/homework-publisher.mjs');
  const rootDirectory = await makePublisherFixture();
  try {
    await writeFile(path.join(rootDirectory, 'content', 'homework.json'), `${JSON.stringify([{
      id: 'existing', title: 'Existing', description: 'Existing', image: null, resultPage: null,
      trainingFolder: null, status: 'draft', order: 7,
    }], null, 2)}\n`);
    const homework = { ...VALID_PAYLOAD,
      contentHtml: '<section><h2>圖片</h2><img src="img/module-f/screen-1.png" alt="畫面"></section>' };
    const transaction = await makePublishTransaction(rootDirectory, homework, ['screen-1.png']);
    const result = await publishHomework({ rootDirectory, ...transaction });
    assert.deepEqual(result, {
      published: true,
      homework: { id: 'module-f', title: 'Module F', resultUrl: '/homework/module-f.html', indexUrl: '/homework/' },
    });
    const records = JSON.parse(await readFile(path.join(rootDirectory, 'content', 'homework.json'), 'utf8'));
    assert.deepEqual(records.at(-1), {
      id: 'module-f', title: 'Module F', description: 'RecyclerView 練習',
      image: 'img/module-f/cover.png', imageAlt: 'Module F 成果畫面', resultPage: 'module-f.html',
      trainingFolder: null, status: 'published', order: 8,
    });
    const page = await readFile(path.join(rootDirectory, 'homework', 'module-f.html'), 'utf8');
    assert.match(page, /<title>Module F｜Homework<\/title>/);
    assert.match(page, /\.\.\/assets\/js\/site-navigation\.js/);
    assert.doesNotMatch(page, /尚未發佈|Content-Security-Policy|Training|csrf|admin_session/i);
    assert.deepEqual(await readdir(path.join(rootDirectory, 'homework', 'img', 'module-f')), ['cover.png', 'screen-1.png']);
    const index = await readFile(path.join(rootDirectory, 'homework', 'index.html'), 'utf8');
    assert.match(index, /data-content-id="module-f"/);
    assert.match(index, /img\/module-f\/cover\.png/);
    assert.match(index, /href="module-f\.html"/);
    assert.doesNotMatch(index, /data-homework-question[^>]*module-f|Training/);
    assert.equal(existsSync(transaction.transactionDirectory), false);
  } finally {
    await rm(rootDirectory, { recursive: true, force: true });
  }
});

test('publisher serializes different IDs and gives each the latest unique order', async () => {
  const { publishHomework } = await import('../admin/server/homework-publisher.mjs');
  const rootDirectory = await makePublisherFixture();
  try {
    const left = await makePublishTransaction(rootDirectory, { ...VALID_PAYLOAD, id: 'module-left', title: 'Left' });
    const right = await makePublishTransaction(rootDirectory, { ...VALID_PAYLOAD, id: 'module-right', title: 'Right' });
    await Promise.all([
      publishHomework({ rootDirectory, ...left }),
      publishHomework({ rootDirectory, ...right }),
    ]);
    const records = JSON.parse(await readFile(path.join(rootDirectory, 'content', 'homework.json'), 'utf8'));
    assert.deepEqual(records.map(({ id }) => id).sort(), ['module-left', 'module-right']);
    assert.deepEqual(records.map(({ order }) => order).sort(), [1, 2]);
  } finally {
    await rm(rootDirectory, { recursive: true, force: true });
  }
});

test('publisher never overwrites an existing ID, page or image directory, including same-ID races', async () => {
  const { publishHomework, HomeworkPublishError } = await import('../admin/server/homework-publisher.mjs');
  const rootDirectory = await makePublisherFixture();
  try {
    const first = await makePublishTransaction(rootDirectory);
    const second = await makePublishTransaction(rootDirectory);
    const settled = await Promise.allSettled([
      publishHomework({ rootDirectory, ...first }),
      publishHomework({ rootDirectory, ...second }),
    ]);
    assert.equal(settled.filter(({ status }) => status === 'fulfilled').length, 1);
    const rejected = settled.find(({ status }) => status === 'rejected').reason;
    assert.ok(rejected instanceof HomeworkPublishError);
    assert.equal(rejected.status, 409);
    const records = JSON.parse(await readFile(path.join(rootDirectory, 'content', 'homework.json'), 'utf8'));
    assert.equal(records.filter(({ id }) => id === 'module-f').length, 1);

    await writeFile(path.join(rootDirectory, 'homework', 'page-conflict.html'), 'keep-page');
    const pageConflict = await makePublishTransaction(rootDirectory, { ...VALID_PAYLOAD, id: 'page-conflict' });
    await assert.rejects(() => publishHomework({ rootDirectory, ...pageConflict }),
      (error) => error instanceof HomeworkPublishError && error.status === 409);
    assert.equal(await readFile(path.join(rootDirectory, 'homework', 'page-conflict.html'), 'utf8'), 'keep-page');
  } finally {
    await rm(rootDirectory, { recursive: true, force: true });
  }
});

test('publisher rolls back page, images, JSON and index after build, validation or check failure', async () => {
  const { publishHomework, HomeworkPublishError } = await import('../admin/server/homework-publisher.mjs');
  const { buildContentIndexes } = await import('../scripts/build-content-indexes.mjs');
  const { validateContent } = await import('../scripts/validate-content.mjs');
  for (const phase of ['build', 'validate', 'check']) {
    const rootDirectory = await makePublisherFixture();
    try {
      const originalJson = await readFile(path.join(rootDirectory, 'content', 'homework.json'));
      const originalIndex = await readFile(path.join(rootDirectory, 'homework', 'index.html'));
      const transaction = await makePublishTransaction(rootDirectory);
      const dependencies = {
        buildIndexes: phase === 'build' ? async () => { throw new Error('forced build failure'); } : buildContentIndexes,
        validateProject: phase === 'validate' ? async () => ({ valid: false, errors: ['forced'] }) : validateContent,
        checkIndexes: phase === 'check' ? async () => { throw new Error('forced check failure'); }
          : (options) => buildContentIndexes({ ...options, check: true }),
      };
      await assert.rejects(
        () => publishHomework({ rootDirectory, ...transaction, dependencies }),
        (error) => error instanceof HomeworkPublishError && error.status === 500,
        phase,
      );
      assert.deepEqual(await readFile(path.join(rootDirectory, 'content', 'homework.json')), originalJson);
      assert.deepEqual(await readFile(path.join(rootDirectory, 'homework', 'index.html')), originalIndex);
      assert.equal(existsSync(path.join(rootDirectory, 'homework', 'module-f.html')), false);
      assert.equal(existsSync(path.join(rootDirectory, 'homework', 'img', 'module-f')), false);
      assert.equal(existsSync(transaction.transactionDirectory), false);
    } finally {
      await rm(rootDirectory, { recursive: true, force: true });
    }
  }
});

test('publisher retains recovery staging and logs only a generic critical message when rollback fails', async () => {
  const { publishHomework, HomeworkPublishError } = await import('../admin/server/homework-publisher.mjs');
  const rootDirectory = await makePublisherFixture();
  try {
    const transaction = await makePublishTransaction(rootDirectory);
    const messages = [];
    await assert.rejects(
      () => publishHomework({
        rootDirectory,
        ...transaction,
        logger: { error(message) { messages.push(message); } },
        dependencies: {
          buildIndexes: async () => { throw new Error('secret forced build failure'); },
          restoreText: async () => { throw new Error('secret forced restore failure'); },
        },
      }),
      (error) => error instanceof HomeworkPublishError && error.status === 500 && error.recoveryRetained,
    );
    assert.equal(existsSync(transaction.transactionDirectory), true);
    assert.equal(existsSync(path.join(transaction.transactionDirectory, 'recovery', 'homework.json')), true);
    assert.deepEqual(messages, ['Critical Homework publish rollback failure; recovery data was retained.']);
    assert.doesNotMatch(messages[0], /secret|module-f|admin-publisher-project/i);
  } finally {
    await rm(rootDirectory, { recursive: true, force: true });
  }
});

test('publisher reports committed success when only post-commit staging cleanup fails', async () => {
  const { publishHomework } = await import('../admin/server/homework-publisher.mjs');
  const rootDirectory = await makePublisherFixture();
  try {
    const transaction = await makePublishTransaction(rootDirectory);
    const warnings = [];
    const result = await publishHomework({
      rootDirectory,
      ...transaction,
      logger: { warn(message) { warnings.push(message); } },
      dependencies: {
        cleanupTransaction: async () => { throw new Error('secret cleanup failure'); },
      },
    });
    assert.equal(result.published, true);
    assert.equal(existsSync(path.join(rootDirectory, 'homework', 'module-f.html')), true);
    assert.equal(existsSync(transaction.transactionDirectory), true);
    assert.deepEqual(warnings, ['Homework publish committed, but staging cleanup failed.']);
    assert.doesNotMatch(warnings[0], /secret|module-f|admin-publisher-project/i);
  } finally {
    await rm(rootDirectory, { recursive: true, force: true });
  }
});

const ADMIN_PATH = '/homework-editor-private';
const ADMIN_SECRET = Buffer.alloc(32, 23).toString('base64url');

async function publishApiHarness(t) {
  const rootDirectory = await makePublisherFixture();
  const { createAdminServer } = await import('../admin/server/server.mjs');
  let currentTime = 1_000;
  const config = {
    host: '127.0.0.1', port: 0, adminPath: ADMIN_PATH,
    passwordHash: 'malformed-test-hash', sessionSecret: ADMIN_SECRET,
    cookieSecure: false, nodeEnv: 'development', sessionTtlMs: 10_000, bodyLimitBytes: 4_096,
  };
  const app = createAdminServer({ config, rootDirectory, now: () => currentTime });
  await new Promise((resolve, reject) => {
    app.server.once('error', reject);
    app.server.listen(0, config.host, resolve);
  });
  const origin = `http://127.0.0.1:${app.server.address().port}`;
  t.after(async () => {
    await app.close();
    await rm(rootDirectory, { recursive: true, force: true });
  });
  function issueSession() {
    const session = app.sessions.create();
    return { ...session, cookie: `admin_session=${session.token}` };
  }
  async function sendPublish({ payload = VALID_PAYLOAD, session, requestOrigin = origin, form, headers = {} } = {}) {
    const body = form ?? new FormData();
    if (!form) {
      body.append('payload', typeof payload === 'string' ? payload : JSON.stringify(payload));
      body.append('coverImage', new Blob([IMAGE_BYTES.png], { type: 'image/png' }), 'cover.png');
    }
    const response = await fetch(`${origin}${ADMIN_PATH}/api/publish`, {
      method: 'POST',
      headers: {
        ...(requestOrigin === undefined ? {} : { Origin: requestOrigin }),
        ...(session ? { Cookie: session.cookie, 'X-CSRF-Token': session.csrfToken } : {}),
        ...headers,
      },
      body,
    });
    const text = await response.text();
    return { status: response.status, headers: response.headers, text, json: () => JSON.parse(text) };
  }
  return { ...app, rootDirectory, origin, issueSession, sendPublish, advance(ms) { currentTime += ms; } };
}

function assertPublishApiError(result, status, code) {
  assert.equal(result.status, status, result.text);
  const body = result.json();
  assert.equal(body.error.code, code);
  assert.equal(typeof body.error.message, 'string');
  return body.error;
}

test('Publish API rejects wrong methods, origins, sessions and CSRF before staging a body', async (t) => {
  const app = await publishApiHarness(t);
  const wrongMethod = await fetch(`${app.origin}${ADMIN_PATH}/api/publish`);
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.get('allow'), 'POST');

  const session = app.issueSession();
  assertPublishApiError(await app.sendPublish({ session, requestOrigin: 'http://attacker.invalid' }), 403, 'invalid_origin');
  assertPublishApiError(await app.sendPublish(), 401, 'not_authenticated');
  assert.equal(existsSync(path.join(app.rootDirectory, '.admin-staging')), false);

  const missingCsrf = { ...session, csrfToken: undefined };
  assertPublishApiError(await app.sendPublish({ session: missingCsrf }), 403, 'invalid_csrf');
  const expired = app.issueSession();
  app.advance(10_001);
  const expiredResult = await app.sendPublish({ session: expired });
  assertPublishApiError(expiredResult, 401, 'not_authenticated');
  assert.match(expiredResult.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal(existsSync(path.join(app.rootDirectory, '.admin-staging')), false);
});

test('Publish API accepts only multipart then separates JSON, field, HTML and image-reference errors', async (t) => {
  const app = await publishApiHarness(t);
  const session = app.issueSession();
  const wrongType = await fetch(`${app.origin}${ADMIN_PATH}/api/publish`, {
    method: 'POST', headers: { Origin: app.origin, Cookie: session.cookie,
      'X-CSRF-Token': session.csrfToken, 'Content-Type': 'application/json' }, body: '{}',
  });
  assertPublishApiError({ status: wrongType.status, headers: wrongType.headers,
    text: await wrongType.text(), json() { return JSON.parse(this.text); } }, 415, 'unsupported_media_type');
  assertPublishApiError(await app.sendPublish({ session, payload: '{' }), 400, 'invalid_request');
  const fieldError = assertPublishApiError(await app.sendPublish({ session, payload: { ...VALID_PAYLOAD, coverAlt: '' } }), 422, 'validation_failed');
  assert.equal(fieldError.fields[0].field, 'coverAlt');
  const htmlError = assertPublishApiError(await app.sendPublish({ session,
    payload: { ...VALID_PAYLOAD, contentHtml: '<script>alert(1)</script>' } }), 422, 'validation_failed');
  assert.equal(htmlError.fields[0].field, 'contentHtml');
  const relationError = assertPublishApiError(await app.sendPublish({ session,
    payload: { ...VALID_PAYLOAD, contentHtml: '<img src="img/module-f/missing.png" alt="缺少">' } }), 422, 'validation_failed');
  assert.equal(relationError.fields[0].code, 'missing_uploaded_image');
});

test('Publish API creates fixture content once and returns a stable 201 contract then 409', async (t) => {
  const app = await publishApiHarness(t);
  const session = app.issueSession();
  const created = await app.sendPublish({ session });
  assert.equal(created.status, 201, created.text);
  assert.deepEqual(created.json(), {
    published: true,
    homework: { id: 'module-f', title: 'Module F', resultUrl: '/homework/module-f.html', indexUrl: '/homework/' },
  });
  assert.equal(existsSync(path.join(app.rootDirectory, 'homework', 'module-f.html')), true);
  assertPublishApiError(await app.sendPublish({ session }), 409, 'publish_conflict');
});

test('admin startup warns about incomplete staging without publishing it', async () => {
  const rootDirectory = await makePublisherFixture();
  try {
    const abandoned = path.join(rootDirectory, '.admin-staging', 'publish-abandoned');
    await mkdir(abandoned, { recursive: true });
    await writeFile(path.join(abandoned, 'marker'), 'not published');
    const warnings = [];
    const { startAdminServer } = await import('../admin/server/server.mjs');
    const app = await startAdminServer({
      rootDirectory,
      logger: { warn(message) { warnings.push(message); }, error() {}, log() {} },
      env: {
        ADMIN_HOST: '127.0.0.1', ADMIN_PORT: '0', ADMIN_PATH,
        ADMIN_PASSWORD_HASH: 'test', ADMIN_SESSION_SECRET: ADMIN_SECRET,
        ADMIN_COOKIE_SECURE: 'false', NODE_ENV: 'development',
      },
    });
    await app.close();
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /incomplete|未完成/i);
    assert.doesNotMatch(warnings[0], /marker|test|ADMIN_SECRET/);
    assert.equal(existsSync(abandoned), true);
    assert.equal(existsSync(path.join(rootDirectory, 'homework', 'publish-abandoned.html')), false);
  } finally {
    await rm(rootDirectory, { recursive: true, force: true });
  }
});

test('management page exposes accessible image, preview and publish controls without expanding scope', async () => {
  const html = await readFile(new URL('../admin/index.html', import.meta.url), 'utf8');
  for (const [id, name] of [
    ['homework-cover-image', 'coverImage'],
    ['homework-cover-alt', 'coverAlt'],
    ['homework-content-images', 'contentImages'],
  ]) {
    assert.match(html, new RegExp(`id="${id}"[^>]+name="${name}"`));
    assert.match(html, new RegExp(`<label[^>]+for="${id}"`));
  }
  assert.match(html, /id="homework-cover-image"[^>]+type="file"[^>]+required[^>]+accept="image\/png,image\/jpeg,image\/webp"/);
  assert.match(html, /id="homework-cover-alt"[^>]+required[^>]+maxlength="160"/);
  assert.match(html, /id="homework-content-images"[^>]+type="file"[^>]+multiple[^>]+accept="image\/png,image\/jpeg,image\/webp"/);
  assert.match(html, /id="content-image-list"/);
  assert.match(html, /id="cover-card-preview"[\s\S]+尚未發佈/);
  assert.match(html, /id="publish-button"[^>]+type="button"[^>]+disabled/);
  assert.match(html, /<dialog[^>]+id="publish-dialog"[\s\S]+Training：本批未加入[\s\S]+id="publish-confirm-button"/);
  assert.match(html, /id="publish-success"[^>]+hidden[\s\S]+id="published-result-link"[\s\S]+id="published-index-link"/);
  const iframe = html.match(/<iframe\b[^>]+id="preview-frame"[^>]*><\/iframe>/i)?.[0];
  assert.ok(iframe);
  assert.match(iframe, /\ssandbox(?:\s|>|="")/);
  assert.doesNotMatch(iframe, /allow-(?:scripts|same-origin|forms|popups)/i);
  assert.doesNotMatch(html, /儲存草稿|刪除 Homework|Training ZIP|name="trainingFolder"/i);
});

test('management assets use inert parsing, bounded file APIs and token-based responsive presentation', async () => {
  const [script, style] = await Promise.all([
    readFile(new URL('../admin/admin.js', import.meta.url), 'utf8'),
    readFile(new URL('../admin/admin.css', import.meta.url), 'utf8'),
  ]);
  assert.match(script, /new DOMParser\(\)/);
  assert.match(script, /new FileReader\(\)/);
  assert.match(script, /new FormData\(\)/);
  assert.match(script, /fetch\(\s*['"]api\/publish['"]/);
  assert.match(script, /URL\.revokeObjectURL/);
  assert.match(script, /contentImagePath/);
  assert.doesNotMatch(script, /\.innerHTML\s*=|(?:local|session)Storage|indexedDB|serviceWorker/);
  assert.match(style, /\.cover-card-preview/);
  assert.match(style, /\.content-image-list/);
  assert.match(style, /@media\s*\(max-width:\s*48rem\)/);
  assert.match(style, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.doesNotMatch(style, /#[0-9a-f]{3,8}\b/i);
});

function browserElement(initial = {}) {
  const listeners = new Map();
  return {
    hidden: false, disabled: false, textContent: '', value: '', href: '', src: '', alt: '', files: [],
    childNodes: [], attributes: new Map(), focused: false, open: false, ...initial,
    addEventListener(type, listener) { listeners.set(type, listener); },
    setAttribute(name, value) { this.attributes.set(name, String(value)); },
    removeAttribute(name) { this.attributes.delete(name); },
    getAttribute(name) { return this.attributes.get(name) ?? null; },
    replaceChildren(...children) { this.childNodes = [...children]; },
    append(...children) { this.childNodes.push(...children); },
    focus() { this.focused = true; },
    showModal() { this.open = true; },
    close() { this.open = false; },
    async dispatch(type, extra = {}) {
      const listener = listeners.get(type);
      if (listener) await listener({ preventDefault() {}, target: this, ...extra });
    },
  };
}

async function loadPublishClient({ previewResponses = [], publishResponses = [], homeworkResponses = [] } = {}) {
  const source = (await readFile(new globalThis.URL('../admin/admin.js', import.meta.url), 'utf8')).replace(/^import[^;]+;\s*/m, '');
  const contract = await publishContract();
  const selectors = new Map();
  const register = (selector, initial) => {
    const element = browserElement(initial);
    selectors.set(selector, element);
    return element;
  };
  const form = register('#homework-form');
  const id = register('#homework-id', { value: VALID_PAYLOAD.id });
  const title = register('#homework-title', { value: VALID_PAYLOAD.title });
  const description = register('#homework-description', { value: VALID_PAYLOAD.description });
  const coverAlt = register('#homework-cover-alt', { value: VALID_PAYLOAD.coverAlt });
  const contentHtml = register('#homework-content-html', {
    value: '<section><img src="img/module-f/screen-1.png" alt="畫面"></section>',
  });
  const coverFile = { name: 'cover.png', size: IMAGE_BYTES.png.length, type: 'image/png', lastModified: 1, data: 'cover' };
  const contentFile = { name: 'screen-1.png', size: IMAGE_BYTES.png.length, type: 'image/png', lastModified: 2, data: 'screen' };
  const coverImage = register('#homework-cover-image', { files: [coverFile] });
  const contentImages = register('#homework-content-images', { files: [contentFile] });
  const previewButton = register('#preview-button', { disabled: true });
  const publishButton = register('#publish-button', { disabled: true });
  const publishConfirm = register('#publish-confirm-button');
  const dialog = register('#publish-dialog');
  const frame = register('#preview-frame', { hidden: true });
  register('#preview-empty');
  register('#preview-loading', { hidden: true });
  register('#preview-error', { hidden: true });
  const expired = register('#session-expired', { hidden: true });
  register('#session-expired-message');
  register('#future-url-value');
  register('#description-count');
  register('#form-error-summary', { hidden: true });
  const readiness = register('#publish-readiness');
  const publishError = register('#publish-error', { hidden: true });
  const publishSuccess = register('#publish-success', { hidden: true });
  const resultLink = register('#published-result-link');
  const indexLink = register('#published-index-link');
  const imageList = register('#content-image-list');
  const homeworkList = register('#published-homework-list', { hidden: true });
  register('#published-homework-list-header', { hidden: true });
  register('#published-homework-state');
  register('#published-homework-state-message');
  register('#published-homework-retry', { hidden: true });
  register('#published-homework-count');
  register('#published-homework-announcement');
  register('#cover-preview-image', { hidden: true });
  register('#cover-preview-empty');
  register('#cover-preview-title');
  register('#cover-preview-description');
  register('#cover-preview-url');
  register('#logout-button', { disabled: true });
  register('#logout-error', { hidden: true });
  for (const field of ['id', 'title', 'description', 'coverImage', 'coverAlt', 'contentImages', 'contentHtml']) {
    register(`#${field}-error`, { hidden: true });
  }
  for (const selector of ['#publish-summary-id', '#publish-summary-title', '#publish-summary-url',
    '#publish-summary-cover', '#publish-summary-image-count']) register(selector);

  const createdUrls = [];
  const revokedUrls = [];
  const TestURL = {
    createObjectURL(value) { createdUrls.push(value); return `blob:test-${createdUrls.length}`; },
    revokeObjectURL(value) { revokedUrls.push(value); },
  };
  const Blob = class TestBlob { constructor(parts, options) { this.parts = parts; this.options = options; } };
  const fileReaders = [];
  const FileReader = class {
    constructor() { this.listeners = new Map(); fileReaders.push(this); }
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    readAsDataURL(file) {
      this.result = `data:${file.type};base64,${file.data}`;
      queueMicrotask(() => this.listeners.get('load')?.());
    }
  };
  const DOMParser = class {
    parseFromString(markup) {
      const images = [...markup.matchAll(/<img\b[^>]*\bsrc="([^"]+)"[^>]*>/gi)].map((match) => {
        let sourceValue = match[1];
        return {
          original: match[0],
          getAttribute(name) { return name === 'src' ? sourceValue : null; },
          setAttribute(name, value) { if (name === 'src') sourceValue = value; },
          serialize() { return this.original.replace(/\bsrc="[^"]+"/i, `src="${sourceValue}"`); },
        };
      });
      return {
        querySelectorAll() { return images; },
        documentElement: {
          get outerHTML() {
            let serialized = markup;
            for (const image of images) serialized = serialized.replace(image.original, image.serialize());
            return serialized;
          },
        },
      };
    }
  };
  const formDataInstances = [];
  const FormData = class {
    constructor() { this.parts = []; formDataInstances.push(this); }
    append(...part) { this.parts.push(part); }
  };
  const fetchCalls = [];
  let previewIndex = 0;
  let publishIndex = 0;
  let homeworkIndex = 0;
  const fetch = async (url, init) => {
    fetchCalls.push({ url, init });
    if (url === 'api/session') return { ok: true, status: 200,
      json: async () => ({ authenticated: true, csrfToken: 'csrf-token' }) };
    if (url === 'api/preview') return previewResponses[previewIndex++] ?? { ok: true, status: 200,
      json: async () => ({ previewHtml: '<html><body><img src="img/module-f/screen-1.png" alt="畫面"></body></html>' }) };
    if (url === 'api/publish') return publishResponses[publishIndex++] ?? { ok: true, status: 201,
      json: async () => ({ published: true, homework: { id: 'module-f', title: 'Module F',
        resultUrl: '/homework/module-f.html', indexUrl: '/homework/' } }) };
    if (url === 'api/homeworks') return homeworkResponses[homeworkIndex++] ?? { ok: true, status: 200, json: async () => ({
      homeworks: [{ id: 'module-f', title: 'Module F', description: 'RecyclerView 練習',
        status: 'published', publishedAt: null, url: '/homework/module-f.html', editable: true }], total: 1,
    }) };
    if (url === 'api/logout') return { ok: true, status: 200, json: async () => ({ authenticated: false }) };
    throw new Error(`unexpected fetch ${url}`);
  };
  const windowListeners = new Map();
  const window = { location: { assign() {} }, addEventListener(type, listener) { windowListeners.set(type, listener); } };
  const document = { querySelector(selector) { return selectors.get(selector) ?? null; }, createElement() { return browserElement(); } };
  const navigator = { clipboard: { async writeText() {} } };
  runInNewContext(source, { ...contract, document, window, navigator, fetch, Blob, FileReader, DOMParser,
    FormData, URL: TestURL, TextEncoder, queueMicrotask, console });
  await new Promise((resolve) => setImmediate(resolve));
  return { selectors, form, id, title, description, coverAlt, contentHtml, coverImage, contentImages,
    coverFile, contentFile, previewButton, publishButton, publishConfirm, dialog, frame, expired,
    readiness, publishError, publishSuccess, resultLink, indexLink, imageList, createdUrls, revokedUrls,
    homeworkList, fileReaders, formDataInstances, fetchCalls, windowListeners };
}

test('client hydrates exact content image previews and invalidates Publish after any change', async () => {
  const client = await loadPublishClient();
  assert.equal(client.publishButton.disabled, true);
  await client.contentImages.dispatch('change');
  assert.equal(client.imageList.childNodes[0].childNodes[0].textContent, 'img/module-f/screen-1.png');
  await client.form.dispatch('submit');
  assert.equal(client.publishButton.disabled, false);
  assert.match(client.createdUrls.at(-1).parts[0], /src="data:image\/png;base64,screen"/);
  client.contentHtml.value += '<p>已變更</p>';
  await client.contentHtml.dispatch('input');
  assert.equal(client.publishButton.disabled, true);
  assert.match(client.readiness.textContent, /重新更新預覽/);
  await client.form.dispatch('submit');
  assert.equal(client.publishButton.disabled, false);
});

test('client confirmation summarizes the exact publish and prevents duplicate submissions', async () => {
  const client = await loadPublishClient();
  await client.form.dispatch('submit');
  await client.publishButton.dispatch('click');
  assert.equal(client.dialog.open, true);
  assert.equal(client.selectors.get('#publish-summary-id').textContent, 'module-f');
  assert.equal(client.selectors.get('#publish-summary-title').textContent, 'Module F');
  assert.equal(client.selectors.get('#publish-summary-url').textContent, '/homework/module-f.html');
  assert.equal(client.selectors.get('#publish-summary-cover').textContent, 'img/module-f/cover.png');
  assert.equal(client.selectors.get('#publish-summary-image-count').textContent, '1 張');
  const original = [client.id.value, client.title.value, client.description.value, client.coverAlt.value, client.contentHtml.value];
  await Promise.all([client.publishConfirm.dispatch('click'), client.publishConfirm.dispatch('click')]);
  assert.equal(client.fetchCalls.filter(({ url }) => url === 'api/publish').length, 1);
  assert.deepEqual([client.id.value, client.title.value, client.description.value, client.coverAlt.value, client.contentHtml.value], original);
  assert.equal(client.publishSuccess.hidden, false);
  assert.equal(client.resultLink.href, '/homework/module-f.html');
  assert.equal(client.indexLink.href, '/homework/');
  assert.equal(client.publishButton.disabled, true);
  assert.equal(client.fetchCalls.filter(({ url }) => url === 'api/homeworks').length, 2);
  assert.equal(client.homeworkList.childNodes[0].childNodes.some((node) => node.textContent === 'Module F'), true);
});

test('client preserves the form and gives specific 401 and 409 publish states', async () => {
  for (const [response, expected] of [
    [{ ok: false, status: 401, json: async () => ({ error: { code: 'not_authenticated', message: 'expired' } }) }, 'expired'],
    [{ ok: false, status: 409, json: async () => ({ error: { code: 'publish_conflict', message: 'exists' } }) }, 'conflict'],
  ]) {
    const client = await loadPublishClient({ publishResponses: [response] });
    const original = [client.id.value, client.title.value, client.description.value, client.coverAlt.value, client.contentHtml.value];
    await client.form.dispatch('submit');
    await client.publishButton.dispatch('click');
    await client.publishConfirm.dispatch('click');
    assert.deepEqual([client.id.value, client.title.value, client.description.value, client.coverAlt.value, client.contentHtml.value], original);
    if (expected === 'expired') {
      assert.equal(client.expired.hidden, false);
      assert.equal(client.publishButton.disabled, true);
    } else {
      assert.equal(client.publishError.hidden, false);
      assert.match(client.publishError.textContent, /已存在/);
    }
  }
});

test('successful publish queues a fresh list request when an older list request is still running', async () => {
  let resolveStale;
  const staleResponse = new Promise((resolve) => { resolveStale = resolve; });
  const freshResponse = { ok: true, status: 200, json: async () => ({
    homeworks: [{ id: 'module-f', title: 'Module F', description: 'RecyclerView 練習',
      status: 'published', publishedAt: null, url: '/homework/module-f.html', editable: true }], total: 1,
  }) };
  const client = await loadPublishClient({ homeworkResponses: [staleResponse, freshResponse] });
  const original = [client.id.value, client.title.value, client.description.value, client.coverAlt.value, client.contentHtml.value];
  await client.form.dispatch('submit');
  await client.publishButton.dispatch('click');
  const publishPromise = client.publishConfirm.dispatch('click');
  await new Promise((resolve) => setImmediate(resolve));
  resolveStale({ ok: true, status: 200, json: async () => ({ homeworks: [], total: 0 }) });
  await publishPromise;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(client.fetchCalls.filter(({ url }) => url === 'api/homeworks').length, 2);
  assert.equal(client.homeworkList.childNodes[0].childNodes.some((node) => node.textContent === 'Module F'), true);
  assert.equal(client.publishSuccess.hidden, false);
  assert.deepEqual([client.id.value, client.title.value, client.description.value, client.coverAlt.value, client.contentHtml.value], original);
});

test('client revokes replaced cover and preview Object URLs on change and page exit', async () => {
  const client = await loadPublishClient();
  await client.coverImage.dispatch('change');
  const firstCoverUrl = 'blob:test-1';
  client.coverImage.files = [{ ...client.coverFile, name: 'second.png', lastModified: 3 }];
  await client.coverImage.dispatch('change');
  assert.ok(client.revokedUrls.includes(firstCoverUrl));
  client.coverImage.files = [client.coverFile];
  await client.form.dispatch('submit');
  client.windowListeners.get('pagehide')();
  assert.ok(client.revokedUrls.includes(client.frame.src));
  assert.ok(client.revokedUrls.includes(client.createdUrls.length ? `blob:test-${client.createdUrls.length - 1}` : ''));
});

test('admin-publish tests leave protected public content byte-identical', async () => {
  const currentContent = await Promise.all(
    PROTECTED_CONTENT_FILES.map((file) => readFile(new URL(`../${file}`, import.meta.url))),
  );
  assert.deepEqual(currentContent, protectedContentSnapshot);
});
