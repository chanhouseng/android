export const HOMEWORK_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const HOMEWORK_PREVIEW_LIMITS = Object.freeze({
  idCharacters: 80,
  titleCharacters: 120,
  descriptionCharacters: 500,
  contentHtmlBytes: 400 * 1024,
});

export const HOMEWORK_PUBLISH_LIMITS = Object.freeze({
  coverAltCharacters: 160,
  imageBytes: 5 * 1024 * 1024,
  contentImageCount: 10,
  contentImagesBytes: 30 * 1024 * 1024,
  requestBytes: 36 * 1024 * 1024,
});

export const CONTENT_IMAGE_FILENAME_PATTERN = /^[a-z0-9_-]+\.(?:png|jpg|webp)$/;
const RESERVED_CONTENT_IMAGE_FILENAMES = new Set(['cover.png', 'cover.jpg', 'cover.webp']);

function error(field, code, message) {
  return { field, code, message };
}

function characterLength(value) {
  return [...value].length;
}

function utf8ByteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

function validateId(value) {
  if (value === undefined || value === null || value === '') {
    return error('id', 'required', '請輸入 Homework ID。');
  }
  if (typeof value !== 'string') return error('id', 'invalid_type', 'Homework ID 必須是文字。');
  if (characterLength(value) > HOMEWORK_PREVIEW_LIMITS.idCharacters) {
    return error('id', 'too_long', 'Homework ID 最多 80 個字元。');
  }
  if (!HOMEWORK_ID_PATTERN.test(value)) {
    return error('id', 'invalid_format', 'Homework ID 只可使用小寫英文字母、數字及單一連字符分隔。');
  }
  return null;
}

function validateTrimmedText(field, value, maximum, label) {
  if (value === undefined || value === null || value === '') {
    return { value: '', error: error(field, 'required', `請輸入${label}。`) };
  }
  if (typeof value !== 'string') {
    return { value: '', error: error(field, 'invalid_type', `${label}必須是文字。`) };
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return { value: trimmed, error: error(field, 'required', `請輸入${label}。`) };
  if (characterLength(trimmed) > maximum) {
    return { value: trimmed, error: error(field, 'too_long', `${label}最多 ${maximum} 個字元。`) };
  }
  return { value: trimmed, error: null };
}

function validateDescription(value) {
  const result = validateTrimmedText('description', value, HOMEWORK_PREVIEW_LIMITS.descriptionCharacters, '簡介');
  if (!result.error && (result.value.includes('<') || result.value.includes('>'))) {
    result.error = error('description', 'html_not_allowed', '簡介只接受普通文字，不可包含 HTML。');
  }
  return result;
}

function validateContentHtml(value) {
  if (value === undefined || value === null || value === '' || (typeof value === 'string' && value.trim() === '')) {
    return error('contentHtml', 'required', '請輸入主要內容 HTML。');
  }
  if (typeof value !== 'string') return error('contentHtml', 'invalid_type', '主要內容 HTML 必須是文字。');
  if (utf8ByteLength(value) > HOMEWORK_PREVIEW_LIMITS.contentHtmlBytes) {
    return error('contentHtml', 'too_large', '主要內容 HTML 最多 400 KiB。');
  }
  return null;
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isHomeworkContentPreviewRequest(input) {
  return isRecord(input)
    && Object.keys(input).length === 1
    && typeof input.contentHtml === 'string';
}

export function isHomeworkContentUpdateRequest(input) {
  if (!isRecord(input) || Object.keys(input).sort().join(',') !== 'contentHtml,revision') return false;
  return typeof input.contentHtml === 'string' && /^[a-f0-9]{64}$/.test(input.revision);
}

export function isHomeworkMetadataRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  const keys = Object.keys(input).sort();
  return keys.length === 2 && keys[0] === 'description' && keys[1] === 'title';
}

export function validateHomeworkMetadataInput(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const title = validateTrimmedText(
    'title',
    source.title,
    HOMEWORK_PREVIEW_LIMITS.titleCharacters,
    '顯示名稱',
  );
  const description = validateDescription(source.description);
  const errors = [title.error, description.error].filter(Boolean);
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { title: title.value, description: description.value },
  };
}

export function validateHomeworkPreviewInput(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const errors = [];
  const idError = validateId(source.id);
  if (idError) errors.push(idError);
  const title = validateTrimmedText('title', source.title, HOMEWORK_PREVIEW_LIMITS.titleCharacters, '顯示名稱');
  if (title.error) errors.push(title.error);
  const description = validateDescription(source.description);
  if (description.error) errors.push(description.error);
  const contentHtmlError = validateContentHtml(source.contentHtml);
  if (contentHtmlError) errors.push(contentHtmlError);

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      id: source.id,
      title: title.value,
      description: description.value,
      contentHtml: source.contentHtml,
    },
  };
}

export function isSafeContentImageFilename(filename) {
  return typeof filename === 'string' && CONTENT_IMAGE_FILENAME_PATTERN.test(filename)
    && !RESERVED_CONTENT_IMAGE_FILENAMES.has(filename);
}

export function contentImagePath(id, filename) {
  if (!HOMEWORK_ID_PATTERN.test(String(id)) || !isSafeContentImageFilename(filename)) {
    throw new TypeError('Homework ID or content image filename is unsafe.');
  }
  return `img/${id}/${filename}`;
}

export function validateHomeworkPublishInput(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const preview = validateHomeworkPreviewInput(source);
  const errors = preview.ok ? [] : [...preview.errors];
  const coverAlt = validateTrimmedText(
    'coverAlt',
    source.coverAlt,
    HOMEWORK_PUBLISH_LIMITS.coverAltCharacters,
    '封面替代文字',
  );
  if (!coverAlt.error && (coverAlt.value.includes('<') || coverAlt.value.includes('>'))) {
    coverAlt.error = error('coverAlt', 'html_not_allowed', '封面替代文字只接受普通文字，不可包含 HTML。');
  }
  if (coverAlt.error) errors.push(coverAlt.error);
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { ...preview.value, coverAlt: coverAlt.value } };
}
