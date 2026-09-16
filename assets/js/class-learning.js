(function initializeClassLearning(global) {
  'use strict';

  function normalizeSearchValue(value = '') {
    return String(value).trim().toLocaleLowerCase('zh-Hant');
  }

  function matchesItem(item, query) {
    const normalizedQuery = normalizeSearchValue(query);
    if (!normalizedQuery) return true;

    return normalizeSearchValue(`${item.title || ''} ${item.searchText || ''}`)
      .includes(normalizedQuery);
  }

  function filterItems(items, query) {
    return items.filter((item) => matchesItem(item, query));
  }

  function openPreview(trigger, dialog) {
    const title = dialog.querySelector('[data-preview-title]');
    const image = dialog.querySelector('[data-preview-image]');

    title.textContent = trigger.dataset.previewTitle;
    image.src = trigger.dataset.previewSrc;
    image.alt = trigger.dataset.previewAlt;
    image.hidden = false;
    dialog.previewReturnFocus = trigger;
    dialog.showModal();
  }

  function closePreview(dialog) {
    if (dialog.open) dialog.close();
  }

  function restorePreviewFocus(dialog) {
    const returnFocus = dialog.previewReturnFocus;
    const image = dialog.querySelector('[data-preview-image]');
    dialog.previewReturnFocus = null;
    image.hidden = true;
    image.removeAttribute('src');
    image.alt = '';
    returnFocus?.focus();
  }

  function setupSearch(documentRef = document) {
    const form = documentRef.querySelector('[data-class-learning-filter]');
    if (!form) return;

    const input = form.querySelector('[data-class-learning-search]');
    const clearButton = form.querySelector('[data-class-learning-clear]');
    const resultCount = documentRef.querySelector('[data-class-learning-result-count]');
    const emptyState = documentRef.querySelector('[data-class-learning-empty]');
    const records = [...documentRef.querySelectorAll('[data-class-learning-item]')].map((element) => ({
      element,
      title: element.dataset.title || '',
      searchText: element.dataset.searchText || '',
    }));

    function applyFilter() {
      const query = input.value;
      const matches = new Set(filterItems(records, query));

      records.forEach((record) => {
        record.element.hidden = !matches.has(record);
      });

      const hasQuery = normalizeSearchValue(query).length > 0;
      clearButton.disabled = !hasQuery;
      emptyState.hidden = matches.size > 0;
      resultCount.textContent = hasQuery
        ? `找到 ${matches.size} 個項目`
        : `顯示全部 ${matches.size} 個項目`;
    }

    form.addEventListener('submit', (event) => event.preventDefault());
    input.addEventListener('input', applyFilter);
    clearButton.addEventListener('click', () => {
      input.value = '';
      applyFilter();
      input.focus();
    });

    applyFilter();
  }

  function setupPreview(documentRef = document) {
    const dialog = documentRef.querySelector('[data-image-preview]');
    if (!dialog) return;

    documentRef.querySelectorAll('[data-preview-button]').forEach((trigger) => {
      trigger.addEventListener('click', () => openPreview(trigger, dialog));
    });
    dialog.querySelector('[data-preview-close]').addEventListener('click', () => closePreview(dialog));
    dialog.addEventListener('close', () => restorePreviewFocus(dialog));
  }

  function setupClassLearning(documentRef = document) {
    setupSearch(documentRef);
    setupPreview(documentRef);
  }

  global.ClassLearning = Object.freeze({
    closePreview,
    filterItems,
    matchesItem,
    normalizeSearchValue,
    openPreview,
    restorePreviewFocus,
    setupClassLearning,
  });

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setupClassLearning(document), { once: true });
    } else {
      setupClassLearning(document);
    }
  }
}(globalThis));
