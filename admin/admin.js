import {
  HOMEWORK_ID_PATTERN,
  HOMEWORK_PREVIEW_LIMITS,
  HOMEWORK_PUBLISH_LIMITS,
  contentImagePath,
  isSafeContentImageFilename,
  validateHomeworkMetadataInput,
  validateHomeworkPublishInput,
} from './shared/homework-preview-contract.mjs';

const logoutButton = document.querySelector('#logout-button');
const logoutError = document.querySelector('#logout-error');
const homeworkForm = document.querySelector('#homework-form');
const previewButton = document.querySelector('#preview-button');
const publishButton = document.querySelector('#publish-button');
const publishConfirmButton = document.querySelector('#publish-confirm-button');
const publishDialog = document.querySelector('#publish-dialog');
const previewFrame = document.querySelector('#preview-frame');
const previewEmpty = document.querySelector('#preview-empty');
const previewLoading = document.querySelector('#preview-loading');
const previewError = document.querySelector('#preview-error');
const sessionExpiredPanel = document.querySelector('#session-expired');
const sessionExpiredMessage = document.querySelector('#session-expired-message');
const futureUrlValue = document.querySelector('#future-url-value');
const descriptionCount = document.querySelector('#description-count');
const formErrorSummary = document.querySelector('#form-error-summary');
const publishReadiness = document.querySelector('#publish-readiness');
const publishError = document.querySelector('#publish-error');
const publishSuccess = document.querySelector('#publish-success');
const publishedResultLink = document.querySelector('#published-result-link');
const publishedIndexLink = document.querySelector('#published-index-link');
const contentImageList = document.querySelector('#content-image-list');
const coverPreviewImage = document.querySelector('#cover-preview-image');
const coverPreviewEmpty = document.querySelector('#cover-preview-empty');
const coverPreviewTitle = document.querySelector('#cover-preview-title');
const coverPreviewDescription = document.querySelector('#cover-preview-description');
const coverPreviewUrl = document.querySelector('#cover-preview-url');
const publishedHomeworkState = document.querySelector('#published-homework-state');
const publishedHomeworkStateMessage = document.querySelector('#published-homework-state-message');
const publishedHomeworkRetry = document.querySelector('#published-homework-retry');
const publishedHomeworkList = document.querySelector('#published-homework-list');
const publishedHomeworkListHeader = document.querySelector('#published-homework-list-header');
const publishedHomeworkCount = document.querySelector('#published-homework-count');
const publishedHomeworkAnnouncement = document.querySelector('#published-homework-announcement');
const homeworkEditDialog = document.querySelector('#homework-edit-dialog');
const homeworkEditForm = document.querySelector('#homework-edit-form');
const homeworkEditView = document.querySelector('#homework-edit-view');
const homeworkEditConfirmView = document.querySelector('#homework-edit-confirm-view');
const homeworkEditId = document.querySelector('#homework-edit-id');
const homeworkEditTitle = document.querySelector('#homework-edit-title');
const homeworkEditDescription = document.querySelector('#homework-edit-description');
const homeworkEditDescriptionCount = document.querySelector('#homework-edit-description-count');
const homeworkEditUrl = document.querySelector('#homework-edit-url');
const homeworkEditTitleError = document.querySelector('#homework-edit-title-error');
const homeworkEditDescriptionError = document.querySelector('#homework-edit-description-error');
const homeworkEditError = document.querySelector('#homework-edit-error');
const homeworkEditCancel = document.querySelector('#homework-edit-cancel');
const homeworkEditSave = document.querySelector('#homework-edit-save');
const homeworkEditBack = document.querySelector('#homework-edit-back');
const homeworkEditConfirm = document.querySelector('#homework-edit-confirm');
const homeworkEditSummaryId = document.querySelector('#homework-edit-summary-id');
const homeworkEditSummaryTitle = document.querySelector('#homework-edit-summary-title');
const homeworkEditSummaryDescription = document.querySelector('#homework-edit-summary-description');
const homeworkEditAnnouncement = document.querySelector('#homework-edit-announcement');
const homeworkContentEditDialog = document.querySelector('#homework-content-edit-dialog');
const homeworkContentEditLoading = document.querySelector('#homework-content-edit-loading');
const homeworkContentEditMain = document.querySelector('#homework-content-edit-main');
const homeworkContentEditSuccess = document.querySelector('#homework-content-edit-success');
const homeworkContentEditId = document.querySelector('#homework-content-edit-id');
const homeworkContentEditName = document.querySelector('#homework-content-edit-name');
const homeworkContentEditUrl = document.querySelector('#homework-content-edit-url');
const homeworkContentEditHtml = document.querySelector('#homework-content-edit-html');
const homeworkContentEditSize = document.querySelector('#homework-content-edit-size');
const homeworkContentEditError = document.querySelector('#homework-content-edit-error');
const homeworkContentEditPreview = document.querySelector('#homework-content-edit-preview');
const homeworkContentEditSave = document.querySelector('#homework-content-edit-save');
const homeworkContentEditCancel = document.querySelector('#homework-content-edit-cancel');
const homeworkContentEditClose = document.querySelector('#homework-content-edit-close');
const homeworkContentEditFrame = document.querySelector('#homework-content-edit-frame');
const homeworkContentEditPreviewEmpty = document.querySelector('#homework-content-edit-preview-empty');
const homeworkContentEditPreviewLoading = document.querySelector('#homework-content-edit-preview-loading');
const homeworkContentEditPreviewError = document.querySelector('#homework-content-edit-preview-error');
const homeworkContentEditResultLink = document.querySelector('#homework-content-edit-result-link');
const homeworkContentEditAnnouncement = document.querySelector('#homework-content-edit-announcement');

const fieldElements = {
  id: document.querySelector('#homework-id'),
  title: document.querySelector('#homework-title'),
  description: document.querySelector('#homework-description'),
  coverImage: document.querySelector('#homework-cover-image'),
  coverAlt: document.querySelector('#homework-cover-alt'),
  contentImages: document.querySelector('#homework-content-images'),
  contentHtml: document.querySelector('#homework-content-html'),
};

const fieldErrors = {
  id: document.querySelector('#id-error'),
  title: document.querySelector('#title-error'),
  description: document.querySelector('#description-error'),
  coverImage: document.querySelector('#coverImage-error'),
  coverAlt: document.querySelector('#coverAlt-error'),
  contentImages: document.querySelector('#contentImages-error'),
  contentHtml: document.querySelector('#contentHtml-error'),
};

const imageExtensionByMime = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
]);

let csrfToken;
let currentPreviewUrl;
let currentCoverUrl;
let previewFingerprint;
let sessionExpired = false;
let previewBusy = false;
let publishing = false;
let published = false;
let publishedHomeworkBusy = false;
let publishedHomeworkRefreshQueued = false;
let editingHomework;
let homeworkEditTrigger;
let homeworkEditSaving = false;
let contentEditingHomework;
let homeworkContentEditTrigger;
let homeworkContentRevision;
let homeworkContentPreviewFingerprint;
let homeworkContentLoading = false;
let homeworkContentPreviewBusy = false;
let homeworkContentSaving = false;

if (logoutButton) logoutButton.disabled = true;
if (previewButton) previewButton.disabled = true;
if (publishButton) publishButton.disabled = true;

function selectedFiles(field) {
  return Array.from(field?.files ?? []);
}

function returnToLogin() {
  window.location.assign('./');
}

function showLogoutError() {
  if (!logoutError) return;
  logoutError.textContent = '登出未完成，請再試一次。';
  logoutError.hidden = false;
}

function releasePreviewUrl() {
  if (!currentPreviewUrl) return;
  URL.revokeObjectURL(currentPreviewUrl);
  currentPreviewUrl = undefined;
}

function clearHomeworkContentPreviewDocument() {
  if (!homeworkContentEditFrame) return;
  homeworkContentEditFrame.removeAttribute('src');
  homeworkContentEditFrame.srcdoc = '';
}

function releaseCoverUrl() {
  if (!currentCoverUrl) return;
  URL.revokeObjectURL(currentCoverUrl);
  currentCoverUrl = undefined;
}

function releaseObjectUrls() {
  releasePreviewUrl();
  releaseCoverUrl();
  clearHomeworkContentPreviewDocument();
}

function setPreviewState(state, message = '') {
  if (previewEmpty) previewEmpty.hidden = state !== 'empty';
  if (previewLoading) previewLoading.hidden = state !== 'loading';
  if (previewError) {
    previewError.hidden = state !== 'error';
    if (state === 'error') previewError.textContent = message;
  }
  if (sessionExpiredPanel) sessionExpiredPanel.hidden = state !== 'expired';
  if (previewFrame) previewFrame.hidden = state !== 'ready';
}

function currentInput() {
  return {
    id: fieldElements.id?.value,
    title: fieldElements.title?.value,
    description: fieldElements.description?.value,
    coverAlt: fieldElements.coverAlt?.value,
    contentHtml: fieldElements.contentHtml?.value,
  };
}

function fileFingerprint(file) {
  return [file.name, file.size, file.type, file.lastModified].join(':');
}

function currentFingerprint() {
  return JSON.stringify({
    fields: currentInput(),
    cover: selectedFiles(fieldElements.coverImage).map(fileFingerprint),
    content: selectedFiles(fieldElements.contentImages).map(fileFingerprint),
  });
}

function updateFutureUrl() {
  const id = fieldElements.id?.value ?? '';
  const valid = HOMEWORK_ID_PATTERN.test(id);
  const value = valid ? `/homework/${id}.html` : '/homework/<合法 ID>.html';
  if (futureUrlValue) futureUrlValue.textContent = value;
  if (coverPreviewUrl) coverPreviewUrl.textContent = value;
}

function updateDescriptionCount() {
  if (!fieldElements.description || !descriptionCount) return;
  descriptionCount.textContent = `${[...fieldElements.description.value].length} / 500`;
}

function updateCoverText() {
  if (coverPreviewTitle) coverPreviewTitle.textContent = fieldElements.title?.value.trim() || '尚未命名';
  if (coverPreviewDescription) coverPreviewDescription.textContent = fieldElements.description?.value.trim() || '填寫簡介後會顯示在此。';
  if (coverPreviewImage) coverPreviewImage.alt = fieldElements.coverAlt?.value.trim() || '封面預覽';
}

function updateCoverPreview() {
  releaseCoverUrl();
  const [file] = selectedFiles(fieldElements.coverImage);
  if (!file) {
    if (coverPreviewImage) {
      coverPreviewImage.hidden = true;
      coverPreviewImage.removeAttribute('src');
    }
    if (coverPreviewEmpty) coverPreviewEmpty.hidden = false;
    return;
  }
  currentCoverUrl = URL.createObjectURL(file);
  if (coverPreviewImage) {
    coverPreviewImage.src = currentCoverUrl;
    coverPreviewImage.hidden = false;
  }
  if (coverPreviewEmpty) coverPreviewEmpty.hidden = true;
  updateCoverText();
}

function makeImageError(field, code, message) {
  return { field, code, message };
}

function validateSelectedImages() {
  const errors = [];
  const covers = selectedFiles(fieldElements.coverImage);
  if (covers.length !== 1) {
    errors.push(makeImageError('coverImage', 'required', '請選擇一張封面圖片。'));
  } else if (!imageExtensionByMime.has(covers[0].type)) {
    errors.push(makeImageError('coverImage', 'unsupported_image_type', '封面只接受 PNG、JPEG 或 WebP。'));
  } else if (covers[0].size < 1) {
    errors.push(makeImageError('coverImage', 'empty_file', '封面圖片不可為空檔案。'));
  } else if (covers[0].size > HOMEWORK_PUBLISH_LIMITS.imageBytes) {
    errors.push(makeImageError('coverImage', 'file_too_large', '封面圖片最多 5 MiB。'));
  }

  const contentFiles = selectedFiles(fieldElements.contentImages);
  if (contentFiles.length > HOMEWORK_PUBLISH_LIMITS.contentImageCount) {
    errors.push(makeImageError('contentImages', 'too_many_files', '內容圖片最多 10 張。'));
  }
  if (contentFiles.reduce((total, file) => total + file.size, 0) > HOMEWORK_PUBLISH_LIMITS.contentImagesBytes) {
    errors.push(makeImageError('contentImages', 'files_too_large', '內容圖片總量最多 30 MiB。'));
  }
  const names = new Set();
  for (const file of contentFiles) {
    if (!isSafeContentImageFilename(file.name)) {
      errors.push(makeImageError('contentImages', 'unsafe_filename', `請自行更改不安全的檔名「${file.name}」。`));
      continue;
    }
    if (names.has(file.name)) errors.push(makeImageError('contentImages', 'duplicate_filename', `內容圖片檔名「${file.name}」重複。`));
    names.add(file.name);
    if (file.size < 1) errors.push(makeImageError('contentImages', 'empty_file', `內容圖片「${file.name}」不可為空檔案。`));
    if (file.size > HOMEWORK_PUBLISH_LIMITS.imageBytes) errors.push(makeImageError('contentImages', 'file_too_large', `內容圖片「${file.name}」最多 5 MiB。`));
    const expectedExtension = imageExtensionByMime.get(file.type);
    if (!expectedExtension) {
      errors.push(makeImageError('contentImages', 'unsupported_image_type', `內容圖片「${file.name}」格式不支援。`));
    } else if (!file.name.endsWith(`.${expectedExtension}`)) {
      errors.push(makeImageError('contentImages', 'extension_mismatch', `內容圖片「${file.name}」副檔名與格式不符。`));
    }
  }
  return errors;
}

function contentReferenceErrors(payload) {
  if (!HOMEWORK_ID_PATTERN.test(payload.id)) return [];
  const parser = new DOMParser();
  const parsed = parser.parseFromString(payload.contentHtml, 'text/html');
  const referenced = new Set(Array.from(parsed.querySelectorAll('img[src]'), (image) => image.getAttribute('src')));
  const expected = new Set(selectedFiles(fieldElements.contentImages).filter((file) => isSafeContentImageFilename(file.name))
    .map((file) => contentImagePath(payload.id, file.name)));
  const errors = [];
  for (const source of referenced) {
    if (!expected.has(source)) errors.push(makeImageError('contentHtml', 'missing_uploaded_image', `主要內容圖片「${source}」沒有對應的已選檔案。`));
  }
  for (const source of expected) {
    if (!referenced.has(source)) errors.push(makeImageError('contentHtml', 'unused_uploaded_image', `已選圖片「${source}」未在主要內容 HTML 中使用。`));
  }
  return errors;
}

function validateLocalPublish() {
  const fields = validateHomeworkPublishInput(currentInput());
  const errors = fields.ok ? [] : [...fields.errors];
  errors.push(...validateSelectedImages());
  if (fields.ok) errors.push(...contentReferenceErrors(fields.value));
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: fields.value };
}

function clearFieldErrors() {
  for (const [field, errorElement] of Object.entries(fieldErrors)) {
    if (errorElement) {
      errorElement.textContent = '';
      errorElement.hidden = true;
    }
    fieldElements[field]?.removeAttribute('aria-invalid');
  }
  if (formErrorSummary) {
    formErrorSummary.textContent = '';
    formErrorSummary.hidden = true;
  }
}

function showFieldErrors(errors) {
  let firstField;
  const messagesByField = new Map();
  for (const error of errors) {
    const input = fieldElements[error.field];
    const output = fieldErrors[error.field];
    if (!input || !output) continue;
    if (!firstField) firstField = input;
    input.setAttribute('aria-invalid', 'true');
    const message = error.line && error.column
      ? `${error.message}（第 ${error.line} 行，第 ${error.column} 欄）`
      : error.message;
    const messages = messagesByField.get(error.field) ?? [];
    messages.push(message);
    messagesByField.set(error.field, messages);
  }
  for (const [field, messages] of messagesByField) {
    fieldErrors[field].textContent = messages.join('\n');
    fieldErrors[field].hidden = false;
  }
  if (formErrorSummary) {
    formErrorSummary.textContent = '請修正表單及圖片後再更新預覽。';
    formErrorSummary.hidden = false;
  }
  firstField?.focus();
}

function setPublishMessage(message) {
  if (publishReadiness) publishReadiness.textContent = message;
}

function canPublish() {
  return typeof csrfToken === 'string' && !sessionExpired && !previewBusy && !publishing && !published
    && previewFingerprint === currentFingerprint() && validateLocalPublish().ok;
}

function updateActionState() {
  if (previewButton) previewButton.disabled = previewBusy || publishing || sessionExpired || typeof csrfToken !== 'string';
  if (publishButton) publishButton.disabled = !canPublish();
}

function invalidatePreview() {
  previewFingerprint = undefined;
  published = false;
  if (publishSuccess) publishSuccess.hidden = true;
  setPublishMessage('內容或圖片已變更，請重新更新預覽。');
  updateActionState();
}

function renderContentImageList() {
  if (!contentImageList) return;
  contentImageList.replaceChildren();
  const files = selectedFiles(fieldElements.contentImages);
  if (files.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'state state--empty';
    empty.textContent = '尚未選擇內容圖片。';
    contentImageList.append(empty);
    return;
  }
  const id = fieldElements.id?.value ?? '';
  for (const file of files) {
    const item = document.createElement('div');
    item.className = 'content-image-item';
    const pathCode = document.createElement('code');
    const pathValue = HOMEWORK_ID_PATTERN.test(id) && isSafeContentImageFilename(file.name)
      ? contentImagePath(id, file.name) : '請先使用合法 ID 與安全檔名';
    pathCode.textContent = pathValue;
    const button = document.createElement('button');
    button.className = 'button button--ghost';
    button.type = 'button';
    button.textContent = '複製路徑';
    button.setAttribute('aria-label', `複製內容圖片路徑 ${pathValue}`);
    button.disabled = !pathValue.startsWith('img/');
    const status = document.createElement('span');
    status.className = 'copy-status';
    status.setAttribute('role', 'status');
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(pathValue);
        status.textContent = '已複製路徑。';
      } catch {
        status.textContent = '無法自動複製，請手動選取路徑。';
      }
    });
    item.append(pathCode, button, status);
    contentImageList.append(item);
  }
}

function setPublishedHomeworkState(state) {
  if (!publishedHomeworkState || !publishedHomeworkStateMessage || !publishedHomeworkRetry
    || !publishedHomeworkList || !publishedHomeworkListHeader) return;
  const messages = {
    loading: '正在載入已發佈 Homework…',
    empty: '目前還沒有已發佈的 Homework。',
    error: '無法載入 Homework，請稍後再試。',
  };
  const successful = state === 'success';
  publishedHomeworkState.hidden = successful;
  publishedHomeworkState.className = `state state--${state === 'error' ? 'error' : state === 'loading' ? 'loading' : 'empty'} published-homework-state`;
  publishedHomeworkState.setAttribute('role', state === 'error' ? 'alert' : 'status');
  if (!successful) publishedHomeworkStateMessage.textContent = messages[state];
  publishedHomeworkRetry.hidden = state !== 'error';
  publishedHomeworkList.hidden = !successful;
  publishedHomeworkListHeader.hidden = !successful;
}

function currentHomeworkEditInput() {
  return {
    title: homeworkEditTitle?.value ?? '',
    description: homeworkEditDescription?.value ?? '',
  };
}

function clearHomeworkEditErrors() {
  for (const [field, output] of [
    [homeworkEditTitle, homeworkEditTitleError],
    [homeworkEditDescription, homeworkEditDescriptionError],
  ]) {
    field?.removeAttribute('aria-invalid');
    if (output) {
      output.textContent = '';
      output.hidden = true;
    }
  }
  if (homeworkEditError) {
    homeworkEditError.textContent = '';
    homeworkEditError.hidden = true;
  }
}

function showHomeworkEditFieldErrors(errors) {
  clearHomeworkEditErrors();
  const byField = new Map();
  for (const error of errors) {
    const messages = byField.get(error.field) ?? [];
    messages.push(error.message);
    byField.set(error.field, messages);
  }
  for (const [field, element, output] of [
    ['title', homeworkEditTitle, homeworkEditTitleError],
    ['description', homeworkEditDescription, homeworkEditDescriptionError],
  ]) {
    const messages = byField.get(field);
    if (!messages || !output) continue;
    element?.setAttribute('aria-invalid', 'true');
    output.textContent = messages.join('\n');
    output.hidden = false;
  }
}

function setHomeworkEditView(confirming) {
  if (homeworkEditView) homeworkEditView.hidden = confirming;
  if (homeworkEditConfirmView) homeworkEditConfirmView.hidden = !confirming;
}

function setHomeworkEditControlsDisabled(disabled) {
  for (const element of [
    homeworkEditTitle,
    homeworkEditDescription,
    homeworkEditCancel,
    homeworkEditBack,
    homeworkEditConfirm,
  ]) if (element) element.disabled = disabled;
}

function updateHomeworkEditState() {
  if (homeworkEditDescriptionCount) {
    homeworkEditDescriptionCount.textContent = `${[...(homeworkEditDescription?.value ?? '')].length} / 500`;
  }
  const validation = validateHomeworkMetadataInput(currentHomeworkEditInput());
  const changed = validation.ok && editingHomework
    && (validation.value.title !== editingHomework.title
      || validation.value.description !== editingHomework.description);
  if (homeworkEditSave) homeworkEditSave.disabled = homeworkEditSaving || !changed;
  return { validation, changed };
}

function openHomeworkMetadataEditor(homework, trigger) {
  if (!homework.editable || homeworkEditSaving || !homeworkEditDialog) return;
  editingHomework = homework;
  homeworkEditTrigger = trigger;
  if (homeworkEditId) homeworkEditId.value = homework.id;
  if (homeworkEditTitle) homeworkEditTitle.value = homework.title;
  if (homeworkEditDescription) homeworkEditDescription.value = homework.description;
  if (homeworkEditUrl) homeworkEditUrl.textContent = homework.url;
  if (homeworkEditAnnouncement) homeworkEditAnnouncement.textContent = '';
  clearHomeworkEditErrors();
  setHomeworkEditView(false);
  updateHomeworkEditState();
  homeworkEditDialog.showModal();
  homeworkEditTitle?.focus();
}

function setHomeworkContentPreviewState(state, message = '') {
  if (homeworkContentEditPreviewEmpty) homeworkContentEditPreviewEmpty.hidden = state !== 'empty';
  if (homeworkContentEditPreviewLoading) homeworkContentEditPreviewLoading.hidden = state !== 'loading';
  if (homeworkContentEditPreviewError) {
    homeworkContentEditPreviewError.hidden = state !== 'error';
    if (state === 'error') homeworkContentEditPreviewError.textContent = message;
  }
  if (homeworkContentEditFrame) homeworkContentEditFrame.hidden = state !== 'ready';
}

function updateHomeworkContentSize() {
  const bytes = new TextEncoder().encode(homeworkContentEditHtml?.value ?? '').byteLength;
  if (homeworkContentEditSize) {
    homeworkContentEditSize.textContent = `${(bytes / 1024).toFixed(1)} KiB / 400 KiB`;
  }
  return bytes;
}

function currentHomeworkContentFingerprint() {
  return homeworkContentEditHtml?.value ?? '';
}

function updateHomeworkContentControls() {
  const bytes = updateHomeworkContentSize();
  const content = currentHomeworkContentFingerprint();
  const blocked = sessionExpired || typeof csrfToken !== 'string' || homeworkContentLoading
    || homeworkContentPreviewBusy || homeworkContentSaving;
  if (homeworkContentEditHtml) homeworkContentEditHtml.disabled = homeworkContentLoading || homeworkContentSaving;
  if (homeworkContentEditCancel) {
    homeworkContentEditCancel.disabled = homeworkContentLoading || homeworkContentPreviewBusy || homeworkContentSaving;
  }
  if (homeworkContentEditPreview) {
    homeworkContentEditPreview.disabled = blocked || content.trim() === ''
      || bytes > HOMEWORK_PREVIEW_LIMITS.contentHtmlBytes;
  }
  if (homeworkContentEditSave) {
    homeworkContentEditSave.disabled = blocked || homeworkContentPreviewFingerprint !== content;
  }
}

function clearHomeworkContentError() {
  if (homeworkContentEditError) {
    homeworkContentEditError.hidden = true;
    homeworkContentEditError.textContent = '';
  }
}

function invalidateHomeworkContentPreview() {
  homeworkContentPreviewFingerprint = undefined;
  clearHomeworkContentPreviewDocument();
  setHomeworkContentPreviewState('empty');
  updateHomeworkContentControls();
}

function validHomeworkContentPayload(body, expectedId) {
  const homework = body?.homework;
  return homework && homework.id === expectedId
    && typeof homework.title === 'string'
    && typeof homework.contentHtml === 'string'
    && /^[a-f0-9]{64}$/.test(homework.revision)
    && typeof homework.url === 'string' && homework.url.startsWith('/')
    && !homework.url.startsWith('//') && !/[\\\u0000-\u001f\u007f]/.test(homework.url);
}

async function openHomeworkContentEditor(homework, trigger) {
  if (!homework.editable || homeworkContentLoading || homeworkContentSaving
    || !homeworkContentEditDialog) return;
  contentEditingHomework = homework;
  homeworkContentEditTrigger = trigger;
  homeworkContentRevision = undefined;
  homeworkContentPreviewFingerprint = undefined;
  clearHomeworkContentPreviewDocument();
  clearHomeworkContentError();
  if (homeworkContentEditSuccess) homeworkContentEditSuccess.hidden = true;
  if (homeworkContentEditMain) homeworkContentEditMain.hidden = true;
  if (homeworkContentEditLoading) homeworkContentEditLoading.hidden = false;
  setHomeworkContentPreviewState('empty');
  homeworkContentEditDialog.showModal();
  homeworkContentLoading = true;
  updateHomeworkContentControls();
  try {
    const response = await fetch(`api/homeworks/${encodeURIComponent(homework.id)}/content`);
    if (response.status === 401) {
      showExpiredSession();
      throw new Error('expired session');
    }
    const body = await response.json();
    if (!response.ok || !validHomeworkContentPayload(body, homework.id)) throw new Error('content load failed');
    if (contentEditingHomework !== homework) return;
    const loaded = body.homework;
    homeworkContentRevision = loaded.revision;
    if (homeworkContentEditId) homeworkContentEditId.value = loaded.id;
    if (homeworkContentEditName) homeworkContentEditName.value = loaded.title;
    if (homeworkContentEditUrl) {
      homeworkContentEditUrl.textContent = loaded.url;
      homeworkContentEditUrl.href = loaded.url;
    }
    if (homeworkContentEditHtml) homeworkContentEditHtml.value = loaded.contentHtml;
    if (homeworkContentEditLoading) homeworkContentEditLoading.hidden = true;
    if (homeworkContentEditMain) homeworkContentEditMain.hidden = false;
    invalidateHomeworkContentPreview();
    homeworkContentEditHtml?.focus();
  } catch {
    if (homeworkContentEditLoading) homeworkContentEditLoading.hidden = true;
    if (homeworkContentEditMain) homeworkContentEditMain.hidden = false;
    if (homeworkContentEditError) {
      homeworkContentEditError.textContent = sessionExpired
        ? '登入已失效；主要內容未被清除，請重新登入。'
        : '無法載入主要內容，請關閉後再試。';
      homeworkContentEditError.hidden = false;
      homeworkContentEditError.focus?.();
    }
  } finally {
    homeworkContentLoading = false;
    updateHomeworkContentControls();
  }
}

function validHomeworkListPayload(body) {
  if (!body || !Array.isArray(body.homeworks) || !Number.isInteger(body.total)
    || body.total !== body.homeworks.length) return false;
  return body.homeworks.every((item) => item && typeof item === 'object'
    && typeof item.id === 'string' && typeof item.title === 'string'
    && typeof item.description === 'string' && typeof item.editable === 'boolean'
    && item.status === 'published'
    && (item.publishedAt === null || typeof item.publishedAt === 'string')
    && (item.url === null || (typeof item.url === 'string' && item.url.startsWith('/')
      && !item.url.startsWith('//') && !/[\\\u0000-\u001f\u007f]/.test(item.url)))
    && (!item.editable || typeof item.url === 'string'));
}

function createHomeworkListCell(label, value, className = '') {
  const cell = document.createElement('span');
  cell.className = `published-homework-cell ${className}`.trim();
  cell.setAttribute('data-label', label);
  cell.setAttribute('aria-label', `${label}：${value}`);
  cell.textContent = value;
  return cell;
}

function renderPublishedHomeworkList(homeworks) {
  if (!publishedHomeworkList) return;
  const rows = homeworks.map((homework) => {
    const row = document.createElement('li');
    row.className = 'published-homework-item';
    row.append(
      createHomeworkListCell('標題', homework.title, 'published-homework-cell--title'),
      createHomeworkListCell('Homework ID', homework.id, 'published-homework-cell--code'),
      createHomeworkListCell('發佈日期', homework.publishedAt || '未提供'),
      createHomeworkListCell('狀態', homework.status, 'status-badge status-badge--accent'),
      createHomeworkListCell('公開網址', homework.url || '未提供', 'published-homework-cell--code'),
    );
    const actions = document.createElement('div');
    actions.className = 'published-homework-actions';
    if (homework.url) {
      const link = document.createElement('a');
      link.className = 'button button--secondary published-homework-open';
      link.href = homework.url;
      link.textContent = '開啟 Homework';
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
      link.setAttribute('aria-label', `開啟 ${homework.title} Homework`);
      actions.append(link);
    } else {
      const unavailable = document.createElement('button');
      unavailable.className = 'button button--secondary published-homework-open';
      unavailable.type = 'button';
      unavailable.textContent = '開啟 Homework';
      unavailable.disabled = true;
      unavailable.setAttribute('aria-label', `${homework.title} 未提供公開頁面`);
      actions.append(unavailable);
    }
    if (homework.editable) {
      const edit = document.createElement('button');
      edit.className = 'button published-homework-edit';
      edit.type = 'button';
      edit.textContent = '編輯基本資料';
      edit.setAttribute('aria-label', `編輯 ${homework.title} 基本資料`);
      edit.addEventListener('click', () => openHomeworkMetadataEditor(homework, edit));
      actions.append(edit);
      const contentEdit = document.createElement('button');
      contentEdit.className = 'button button--secondary published-homework-content-edit';
      contentEdit.type = 'button';
      contentEdit.textContent = '編輯主要內容';
      contentEdit.setAttribute('aria-label', `編輯 ${homework.title} 主要內容`);
      contentEdit.addEventListener('click', () => openHomeworkContentEditor(homework, contentEdit));
      actions.append(contentEdit);
    } else {
      const unsupported = document.createElement('span');
      unsupported.className = 'published-homework-edit-unavailable';
      unsupported.textContent = '此舊項目暫不支援網站編輯';
      actions.append(unsupported);
    }
    row.append(actions);
    return row;
  });
  publishedHomeworkList.replaceChildren(...rows);
}

async function loadPublishedHomeworkList({ queueIfBusy = false } = {}) {
  if (!publishedHomeworkList) return false;
  if (publishedHomeworkBusy) {
    if (queueIfBusy) publishedHomeworkRefreshQueued = true;
    return false;
  }
  publishedHomeworkBusy = true;
  if (publishedHomeworkRetry) publishedHomeworkRetry.disabled = true;
  if (publishedHomeworkAnnouncement) publishedHomeworkAnnouncement.textContent = '';
  setPublishedHomeworkState('loading');
  try {
    const response = await fetch('api/homeworks');
    if (response.status === 401) {
      setPublishedHomeworkState('error');
      showExpiredSession();
      return false;
    }
    const body = await response.json();
    if (!response.ok || !validHomeworkListPayload(body)) throw new Error('homework list failed');
    if (publishedHomeworkCount) publishedHomeworkCount.textContent = `（${body.total}）`;
    renderPublishedHomeworkList(body.homeworks);
    setPublishedHomeworkState(body.total === 0 ? 'empty' : 'success');
    if (publishedHomeworkAnnouncement) {
      publishedHomeworkAnnouncement.textContent = `已載入 ${body.total} 個 Homework。`;
    }
    return true;
  } catch {
    setPublishedHomeworkState('error');
    return false;
  } finally {
    publishedHomeworkBusy = false;
    if (publishedHomeworkRetry) publishedHomeworkRetry.disabled = false;
    if (publishedHomeworkRefreshQueued) {
      publishedHomeworkRefreshQueued = false;
      await loadPublishedHomeworkList();
    }
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result), { once: true });
    reader.addEventListener('error', reject, { once: true });
    reader.readAsDataURL(file);
  });
}

async function previewHtmlWithSelectedImages(previewHtml, id) {
  const files = selectedFiles(fieldElements.contentImages);
  const dataUrls = await Promise.all(files.map(readFileAsDataUrl));
  const replacements = new Map(files.map((file, index) => [contentImagePath(id, file.name), dataUrls[index]]));
  const parser = new DOMParser();
  const parsed = parser.parseFromString(previewHtml, 'text/html');
  for (const image of parsed.querySelectorAll('img[src]')) {
    const replacement = replacements.get(image.getAttribute('src'));
    if (replacement) image.setAttribute('src', replacement);
  }
  return `<!doctype html>\n${parsed.documentElement.outerHTML}`;
}

function showExpiredSession() {
  sessionExpired = true;
  previewFingerprint = undefined;
  homeworkContentPreviewFingerprint = undefined;
  releasePreviewUrl();
  clearHomeworkContentPreviewDocument();
  if (previewFrame) {
    previewFrame.hidden = true;
    previewFrame.removeAttribute('src');
  }
  if (sessionExpiredMessage) sessionExpiredMessage.textContent = '登入已失效，請重新登入';
  setPreviewState('expired');
  updateActionState();
  updateHomeworkContentControls();
}

async function loadSession() {
  try {
    const response = await fetch('api/session');
    const session = await response.json();
    if (!response.ok || session.authenticated !== true || typeof session.csrfToken !== 'string') {
      returnToLogin();
      return;
    }
    csrfToken = session.csrfToken;
    sessionExpired = false;
    if (logoutButton) logoutButton.disabled = false;
    updateActionState();
    await loadPublishedHomeworkList();
  } catch {
    returnToLogin();
  }
}

for (const field of [fieldElements.id, fieldElements.title, fieldElements.description,
  fieldElements.coverAlt, fieldElements.contentHtml]) {
  field?.addEventListener('input', () => {
    updateFutureUrl();
    updateDescriptionCount();
    updateCoverText();
    renderContentImageList();
    invalidatePreview();
  });
}

fieldElements.coverImage?.addEventListener('change', () => {
  updateCoverPreview();
  invalidatePreview();
});

fieldElements.contentImages?.addEventListener('change', () => {
  renderContentImageList();
  invalidatePreview();
});

homeworkForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (typeof csrfToken !== 'string' || sessionExpired || previewBusy || publishing) return;
  clearFieldErrors();
  if (publishError) publishError.hidden = true;
  const validation = validateLocalPublish();
  if (!validation.ok) {
    showFieldErrors(validation.errors);
    setPreviewState('error', '部分欄位或圖片需要修正。');
    return;
  }

  previewBusy = true;
  setPreviewState('loading');
  updateActionState();
  const submittedFingerprint = currentFingerprint();
  try {
    const { coverAlt, ...previewPayload } = validation.value;
    const response = await fetch('api/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
      body: JSON.stringify(previewPayload),
    });
    if (response.status === 401) {
      showExpiredSession();
      return;
    }
    const body = await response.json();
    if (response.status === 422 && Array.isArray(body?.error?.fields)) {
      showFieldErrors(body.error.fields);
      setPreviewState('error', '部分欄位需要修正。');
      return;
    }
    if (!response.ok || typeof body.previewHtml !== 'string') throw new Error('preview failed');
    const hydratedPreview = await previewHtmlWithSelectedImages(body.previewHtml, validation.value.id);
    if (submittedFingerprint !== currentFingerprint()) {
      setPreviewState('error', '建立預覽期間內容已變更，請重新更新預覽。');
      return;
    }
    const nextPreviewUrl = URL.createObjectURL(new Blob([hydratedPreview], { type: 'text/html;charset=utf-8' }));
    releasePreviewUrl();
    currentPreviewUrl = nextPreviewUrl;
    previewFrame.src = currentPreviewUrl;
    previewFingerprint = submittedFingerprint;
    published = false;
    setPreviewState('ready');
    setPublishMessage('預覽與目前內容一致，可以正式發佈。');
  } catch {
    setPreviewState('error', '無法建立預覽，請稍後再試。');
  } finally {
    previewBusy = false;
    updateActionState();
  }
});

function fillPublishSummary(payload) {
  const [cover] = selectedFiles(fieldElements.coverImage);
  const coverExtension = imageExtensionByMime.get(cover.type);
  const values = {
    '#publish-summary-id': payload.id,
    '#publish-summary-title': payload.title,
    '#publish-summary-url': `/homework/${payload.id}.html`,
    '#publish-summary-cover': `img/${payload.id}/cover.${coverExtension}`,
    '#publish-summary-image-count': `${selectedFiles(fieldElements.contentImages).length} 張`,
  };
  for (const [selector, value] of Object.entries(values)) {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  }
}

publishButton?.addEventListener('click', () => {
  if (!canPublish()) return;
  const validation = validateLocalPublish();
  if (!validation.ok) return;
  fillPublishSummary(validation.value);
  publishDialog?.showModal();
  publishConfirmButton?.focus();
});

publishConfirmButton?.addEventListener('click', async () => {
  if (!canPublish()) return;
  const validation = validateLocalPublish();
  if (!validation.ok) return;
  publishDialog?.close();
  publishing = true;
  if (publishError) publishError.hidden = true;
  if (publishSuccess) publishSuccess.hidden = true;
  setPublishMessage('正在正式發佈，請勿關閉頁面。');
  updateActionState();
  try {
    const formData = new FormData();
    formData.append('payload', JSON.stringify(validation.value));
    formData.append('coverImage', selectedFiles(fieldElements.coverImage)[0]);
    for (const file of selectedFiles(fieldElements.contentImages)) formData.append('contentImages', file);
    const response = await fetch('api/publish', {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken },
      body: formData,
    });
    if (response.status === 401) {
      showExpiredSession();
      return;
    }
    const body = await response.json();
    if (!response.ok) {
      if (Array.isArray(body?.error?.fields)) showFieldErrors(body.error.fields);
      const message = response.status === 409
        ? '此 Homework ID、成果頁或圖片目錄已存在，請使用另一個 ID。'
        : body?.error?.message || '正式發佈失敗，已保留表單內容。';
      if (publishError) {
        publishError.textContent = message;
        publishError.hidden = false;
        publishError.focus?.();
      }
      return;
    }
    published = true;
    if (publishedResultLink) publishedResultLink.href = body.homework.resultUrl;
    if (publishedIndexLink) publishedIndexLink.href = body.homework.indexUrl;
    if (publishSuccess) {
      publishSuccess.hidden = false;
      publishSuccess.focus();
    }
    setPublishMessage('正式發佈完成。表單內容保留供你核對。');
    await loadPublishedHomeworkList({ queueIfBusy: true });
  } catch {
    if (publishError) {
      publishError.textContent = '正式發佈失敗，已保留表單內容，請稍後再試。';
      publishError.hidden = false;
    }
  } finally {
    publishing = false;
    updateActionState();
  }
});

for (const field of [homeworkEditTitle, homeworkEditDescription]) {
  field?.addEventListener('input', () => {
    clearHomeworkEditErrors();
    updateHomeworkEditState();
  });
}

homeworkEditForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (homeworkEditSaving || !editingHomework) return;
  const { validation, changed } = updateHomeworkEditState();
  if (!validation.ok) {
    showHomeworkEditFieldErrors(validation.errors);
    const firstInvalid = validation.errors[0]?.field === 'description'
      ? homeworkEditDescription : homeworkEditTitle;
    firstInvalid?.focus();
    return;
  }
  if (!changed) return;
  clearHomeworkEditErrors();
  if (homeworkEditSummaryId) homeworkEditSummaryId.textContent = editingHomework.id;
  if (homeworkEditSummaryTitle) homeworkEditSummaryTitle.textContent = validation.value.title;
  if (homeworkEditSummaryDescription) homeworkEditSummaryDescription.textContent = validation.value.description;
  setHomeworkEditView(true);
  homeworkEditBack?.focus();
});

homeworkEditCancel?.addEventListener('click', () => {
  if (!homeworkEditSaving) homeworkEditDialog?.close();
});

homeworkEditBack?.addEventListener('click', () => {
  if (homeworkEditSaving) return;
  setHomeworkEditView(false);
  updateHomeworkEditState();
  homeworkEditTitle?.focus();
});

homeworkEditConfirm?.addEventListener('click', async () => {
  if (homeworkEditSaving || !editingHomework || typeof csrfToken !== 'string' || sessionExpired) return;
  const { validation, changed } = updateHomeworkEditState();
  if (!validation.ok || !changed) {
    setHomeworkEditView(false);
    if (!validation.ok) showHomeworkEditFieldErrors(validation.errors);
    return;
  }
  homeworkEditSaving = true;
  setHomeworkEditControlsDisabled(true);
  if (homeworkEditSave) homeworkEditSave.disabled = true;
  clearHomeworkEditErrors();
  try {
    const response = await fetch(`api/homeworks/${encodeURIComponent(editingHomework.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
      body: JSON.stringify(validation.value),
    });
    if (response.status === 401) {
      homeworkEditDialog?.close();
      showExpiredSession();
      return;
    }
    const body = await response.json();
    if (!response.ok) {
      setHomeworkEditView(false);
      if (response.status === 422 && Array.isArray(body?.error?.fields)) {
        showHomeworkEditFieldErrors(body.error.fields);
      }
      if (homeworkEditError) {
        homeworkEditError.textContent = response.status === 409
          ? '此舊項目暫不支援網站編輯。'
          : body?.error?.message || '無法儲存 Homework，請稍後再試。';
        homeworkEditError.hidden = false;
        homeworkEditError.focus?.();
      }
      return;
    }
    if (body?.updated !== true || body?.homework?.id !== editingHomework.id) {
      throw new Error('invalid edit response');
    }
    homeworkEditDialog?.close();
    if (homeworkEditAnnouncement) homeworkEditAnnouncement.textContent = 'Homework 基本資料已更新。';
    await loadPublishedHomeworkList({ queueIfBusy: true });
  } catch {
    setHomeworkEditView(false);
    if (homeworkEditError) {
      homeworkEditError.textContent = '無法儲存 Homework，已保留輸入內容，請稍後再試。';
      homeworkEditError.hidden = false;
      homeworkEditError.focus?.();
    }
  } finally {
    homeworkEditSaving = false;
    setHomeworkEditControlsDisabled(false);
    updateHomeworkEditState();
  }
});

homeworkEditDialog?.addEventListener('cancel', (event) => {
  if (homeworkEditSaving) event.preventDefault();
});

homeworkEditDialog?.addEventListener('close', () => {
  if (!homeworkEditSaving) homeworkEditTrigger?.focus();
});

homeworkContentEditHtml?.addEventListener('input', () => {
  clearHomeworkContentError();
  invalidateHomeworkContentPreview();
});

homeworkContentEditPreview?.addEventListener('click', async () => {
  if (!contentEditingHomework || homeworkContentPreviewBusy || homeworkContentSaving
    || sessionExpired || typeof csrfToken !== 'string') return;
  const submittedContent = currentHomeworkContentFingerprint();
  const bytes = updateHomeworkContentSize();
  if (submittedContent.trim() === '' || bytes > HOMEWORK_PREVIEW_LIMITS.contentHtmlBytes) return;
  homeworkContentPreviewBusy = true;
  clearHomeworkContentError();
  setHomeworkContentPreviewState('loading');
  updateHomeworkContentControls();
  try {
    const response = await fetch(`api/homeworks/${encodeURIComponent(contentEditingHomework.id)}/content/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ contentHtml: submittedContent }),
    });
    if (response.status === 401) {
      showExpiredSession();
      setHomeworkContentPreviewState('error', '登入已失效；HTML 已保留，請重新登入。');
      return;
    }
    const body = await response.json();
    if (!response.ok) {
      const message = response.status === 422 && Array.isArray(body?.error?.fields)
        ? body.error.fields.map(({ message: fieldMessage }) => fieldMessage).filter(Boolean).join('\n')
        : body?.error?.message || '無法更新預覽，請稍後再試。';
      setHomeworkContentPreviewState('error', message);
      homeworkContentEditPreviewError?.focus?.();
      return;
    }
    if (typeof body.previewHtml !== 'string') throw new Error('invalid preview response');
    if (submittedContent !== currentHomeworkContentFingerprint()) {
      setHomeworkContentPreviewState('error', '更新預覽期間 HTML 已變更，請再次更新預覽。');
      return;
    }
    clearHomeworkContentPreviewDocument();
    if (homeworkContentEditFrame) homeworkContentEditFrame.srcdoc = body.previewHtml;
    homeworkContentPreviewFingerprint = submittedContent;
    setHomeworkContentPreviewState('ready');
  } catch {
    setHomeworkContentPreviewState('error', '無法更新預覽，請稍後再試。');
  } finally {
    homeworkContentPreviewBusy = false;
    updateHomeworkContentControls();
  }
});

homeworkContentEditSave?.addEventListener('click', async () => {
  const submittedContent = currentHomeworkContentFingerprint();
  if (!contentEditingHomework || homeworkContentSaving || homeworkContentPreviewBusy
    || sessionExpired || typeof csrfToken !== 'string'
    || !homeworkContentRevision || homeworkContentPreviewFingerprint !== submittedContent) return;
  homeworkContentSaving = true;
  clearHomeworkContentError();
  updateHomeworkContentControls();
  try {
    const response = await fetch(`api/homeworks/${encodeURIComponent(contentEditingHomework.id)}/content`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ contentHtml: submittedContent, revision: homeworkContentRevision }),
    });
    if (response.status === 401) {
      showExpiredSession();
      if (homeworkContentEditError) {
        homeworkContentEditError.textContent = '登入已失效；HTML 已保留，請重新登入。';
        homeworkContentEditError.hidden = false;
      }
      return;
    }
    const body = await response.json();
    if (!response.ok) {
      if (homeworkContentEditError) {
        homeworkContentEditError.textContent = response.status === 409 && body?.error?.code === 'content_changed'
          ? '其他分頁已更新主要內容。請重新載入後再修改，系統不會自動覆蓋。'
          : body?.error?.message || '無法儲存主要內容，HTML 已保留。';
        homeworkContentEditError.hidden = false;
        homeworkContentEditError.focus?.();
      }
      return;
    }
    if (body?.updated !== true || body?.homework?.id !== contentEditingHomework.id
      || typeof body?.homework?.url !== 'string' || !/^[a-f0-9]{64}$/.test(body?.homework?.revision)) {
      throw new Error('invalid content update response');
    }
    homeworkContentRevision = body.homework.revision;
    homeworkContentPreviewFingerprint = undefined;
    clearHomeworkContentPreviewDocument();
    if (homeworkContentEditMain) homeworkContentEditMain.hidden = true;
    if (homeworkContentEditSuccess) homeworkContentEditSuccess.hidden = false;
    if (homeworkContentEditResultLink) homeworkContentEditResultLink.href = body.homework.url;
    if (homeworkContentEditAnnouncement) homeworkContentEditAnnouncement.textContent = 'Homework 主要內容已更新。';
    homeworkContentEditSuccess?.focus?.();
  } catch {
    if (homeworkContentEditError) {
      homeworkContentEditError.textContent = '無法儲存主要內容，HTML 已保留，請稍後再試。';
      homeworkContentEditError.hidden = false;
      homeworkContentEditError.focus?.();
    }
  } finally {
    homeworkContentSaving = false;
    updateHomeworkContentControls();
  }
});

homeworkContentEditCancel?.addEventListener('click', () => {
  if (!homeworkContentLoading && !homeworkContentPreviewBusy && !homeworkContentSaving) {
    homeworkContentEditDialog?.close();
  }
});

homeworkContentEditClose?.addEventListener('click', () => homeworkContentEditDialog?.close());

homeworkContentEditDialog?.addEventListener('cancel', (event) => {
  if (homeworkContentLoading || homeworkContentPreviewBusy || homeworkContentSaving) event.preventDefault();
});

homeworkContentEditDialog?.addEventListener('close', () => {
  clearHomeworkContentPreviewDocument();
  homeworkContentEditTrigger?.focus();
});

logoutButton?.addEventListener('click', async () => {
  if (typeof csrfToken !== 'string') return;
  logoutButton.disabled = true;
  if (logoutError) logoutError.hidden = true;
  try {
    const response = await fetch('api/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({}),
    });
    if (!response.ok && response.status !== 401) throw new Error('logout failed');
  } catch {
    logoutButton.disabled = false;
    showLogoutError();
    return;
  }
  releaseObjectUrls();
  returnToLogin();
});

window.addEventListener('pagehide', releaseObjectUrls);
publishedHomeworkRetry?.addEventListener('click', () => loadPublishedHomeworkList());
updateFutureUrl();
updateDescriptionCount();
updateCoverText();
renderContentImageList();
loadSession();
