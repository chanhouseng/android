(function initializeAndroidLearningAccordion(global) {
  'use strict';

  function normalizeSearchValue(value = '') {
    return String(value).normalize('NFKC').trim().toLocaleLowerCase('zh-Hant');
  }

  function setExpanded(record, expanded) {
    record.button.setAttribute('aria-expanded', String(expanded));
    record.panel.hidden = !expanded;
  }

  function setAllExpanded(records, expanded) {
    records.filter((record) => !record.item?.hidden).forEach((record) => setExpanded(record, expanded));
  }

  function filterEntries(records, query, scope = 'title') {
    const normalizedQuery = normalizeSearchValue(query);
    if (!normalizedQuery) return records.slice();
    return records.filter((record) => normalizeSearchValue(
      scope === 'all' ? `${record.title} ${record.content || ''}` : record.title,
    ).includes(normalizedQuery));
  }

  function setupAccordion(documentRef = document) {
    documentRef.querySelectorAll('[data-accordion-root]').forEach(setupRoot);
  }

  function setupRoot(root) {
    if (root.dataset.enhanced === 'true') return;

    const form = root.querySelector('[data-accordion-filter]');
    const input = form?.querySelector('[data-accordion-search]');
    const clearButton = form?.querySelector('[data-accordion-clear]');
    const expandAllButton = root.querySelector('[data-accordion-expand-all]');
    const collapseAllButton = root.querySelector('[data-accordion-collapse-all]');
    const emptyState = root.querySelector('[data-accordion-empty]');
    const announcement = root.querySelector('[data-accordion-announcement]');
    const scope = root.dataset.accordionSearchScope === 'all' ? 'all' : 'title';
    const records = [...root.querySelectorAll('[data-accordion-item]')].map((item) => ({
      item,
      title: item.dataset.title || '',
      content: item.querySelector('[data-accordion-panel]').textContent,
      button: item.querySelector('[data-accordion-trigger]'),
      panel: item.querySelector('[data-accordion-panel]'),
    }));

    root.dataset.enhanced = 'true';
    setAllExpanded(records, false);

    records.forEach((record) => {
      record.button.addEventListener('click', () => {
        setExpanded(record, record.button.getAttribute('aria-expanded') !== 'true');
      });
    });

    if (!form || !input || !clearButton) return;

    function visibleRecords() {
      return records.filter((record) => !record.item.hidden);
    }

    function applyFilter() {
      const query = input.value;
      const matches = new Set(filterEntries(records, query, scope));

      records.forEach((record) => {
        record.item.hidden = !matches.has(record);
      });

      const hasQuery = normalizeSearchValue(query).length > 0;
      clearButton.disabled = !hasQuery;
      if (emptyState) emptyState.hidden = matches.size > 0;
      if (expandAllButton) expandAllButton.disabled = matches.size === 0;
      if (collapseAllButton) collapseAllButton.disabled = matches.size === 0;
      if (announcement) {
        announcement.textContent = hasQuery
          ? `找到 ${matches.size} 個條目`
          : `顯示全部 ${matches.size} 個條目`;
      }
    }

    form.addEventListener('submit', (event) => event.preventDefault());
    input.addEventListener('input', applyFilter);
    function clearSearch() {
      input.value = '';
      applyFilter();
      input.focus();
    }
    clearButton.addEventListener('click', clearSearch);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && input.value) {
        event.preventDefault();
        clearSearch();
      }
    });
    expandAllButton?.addEventListener('click', () => setAllExpanded(visibleRecords(), true));
    collapseAllButton?.addEventListener('click', () => setAllExpanded(visibleRecords(), false));

    applyFilter();
  }

  global.AndroidLearningAccordion = Object.freeze({
    filterEntries,
    normalizeSearchValue,
    setAllExpanded,
    setExpanded,
    setupAccordion,
  });

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setupAccordion(document), { once: true });
    } else {
      setupAccordion(document);
    }
  }
}(globalThis));
