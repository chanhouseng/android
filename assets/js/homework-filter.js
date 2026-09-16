(function initializeHomeworkFilter(global) {
  'use strict';

  function normalizeSearchValue(value = '') {
    return String(value).normalize('NFKC').toLocaleLowerCase('zh-Hant').trim();
  }

  function matchesItem(item, query) {
    const normalizedQuery = normalizeSearchValue(query);
    if (!normalizedQuery) return true;
    return [item.name, item.description, item.folder]
      .some((value) => normalizeSearchValue(value).includes(normalizedQuery));
  }

  function filterItems(items, query) {
    return items.filter((item) => matchesItem(item, query));
  }

  function shouldClearSearch(event, query) {
    return event?.key === 'Escape' && Boolean(normalizeSearchValue(query));
  }

  function setup(documentRef = document) {
    const form = documentRef.querySelector('[data-homework-filter]');
    if (!form) return;

    const searchInput = form.querySelector('[data-homework-search]');
    const clearButton = form.querySelector('[data-homework-clear]');
    const resultCount = documentRef.querySelector('[data-homework-result-count]');
    const emptyState = documentRef.querySelector('[data-homework-empty]');
    const itemElements = Array.from(documentRef.querySelectorAll('[data-homework-item]'));
    const items = itemElements.map((element) => ({
      element,
      name: element.dataset.homeworkName || '',
      description: element.dataset.description || '',
      folder: element.dataset.folder || '',
    }));

    function render() {
      const query = searchInput.value;
      const matches = new Set(filterItems(items, query).map(({ element }) => element));
      const hasQuery = Boolean(normalizeSearchValue(query));
      itemElements.forEach((element) => { element.hidden = !matches.has(element); });
      clearButton.disabled = !hasQuery;
      emptyState.hidden = matches.size > 0;
      resultCount.textContent = hasQuery
        ? `找到 ${matches.size} 個作業`
        : `顯示全部 ${items.length} 個作業`;
    }

    function clearSearch() {
      searchInput.value = '';
      render();
      searchInput.focus();
    }

    form.addEventListener('submit', (event) => event.preventDefault());
    searchInput.addEventListener('input', render);
    searchInput.addEventListener('keydown', (event) => {
      if (!shouldClearSearch(event, searchInput.value)) return;
      event.preventDefault();
      clearSearch();
    });
    clearButton.addEventListener('click', clearSearch);
    render();
  }

  global.HomeworkFilter = Object.freeze({
    filterItems,
    matchesItem,
    normalizeSearchValue,
    setup,
    shouldClearSearch,
  });

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setup(document), { once: true });
    } else {
      setup(document);
    }
  }
}(globalThis));
