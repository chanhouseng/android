(function initializeWorldSkillsFilter(global) {
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

  function setupFilter(documentRef = document) {
    const form = documentRef.querySelector('[data-world-skill-filter]');
    if (!form) return;

    const input = form.querySelector('[data-world-skill-search]');
    const clearButton = form.querySelector('[data-world-skill-clear]');
    const emptyState = documentRef.querySelector('[data-world-skill-empty]');
    const announcement = documentRef.querySelector('[data-world-skill-announcement]');
    const sections = [...documentRef.querySelectorAll('[data-world-skill-section]')];
    const records = [...documentRef.querySelectorAll('[data-world-skill-item]')].map((element) => ({
      element,
      title: element.dataset.title || '',
      searchText: element.dataset.searchText || '',
    }));

    function applyFilter() {
      const query = input.value;
      let visibleCount = 0;

      records.forEach((record) => {
        const isVisible = matchesItem(record, query);
        record.element.hidden = !isVisible;
        if (isVisible) visibleCount += 1;
      });

      sections.forEach((section) => {
        const sectionItems = [...section.querySelectorAll('[data-world-skill-item]')];
        section.hidden = sectionItems.every((item) => item.hidden);
      });

      const hasQuery = normalizeSearchValue(query).length > 0;
      clearButton.disabled = !hasQuery;
      emptyState.hidden = visibleCount > 0;
      announcement.textContent = hasQuery
        ? `找到 ${visibleCount} 個項目`
        : `顯示全部 ${visibleCount} 個項目`;
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

  global.WorldSkillsFilter = Object.freeze({
    filterItems,
    matchesItem,
    normalizeSearchValue,
    setupFilter,
  });

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setupFilter(document), { once: true });
    } else {
      setupFilter(document);
    }
  }
}(globalThis));
