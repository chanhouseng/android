(function initializePdfLibrary(global) {
  'use strict';

  function normalize(value = '') {
    return String(value).normalize('NFKC').toLocaleLowerCase('zh-Hant');
  }

  function filterItems(items, { query = '', category = 'all' } = {}) {
    const normalizedQuery = normalize(query.trim());
    return items.filter((item) => {
      const categoryMatches = category === 'all' || item.category === category;
      const searchableText = normalize(`${item.title || ''} ${item.description || ''}`);
      return categoryMatches && (!normalizedQuery || searchableText.includes(normalizedQuery));
    });
  }

  function enhance(documentRef = document) {
    const searchForm = documentRef.querySelector('[data-pdf-search]');
    if (!searchForm || searchForm.dataset.enhanced === 'true') return;

    const queryInput = documentRef.querySelector('[data-pdf-query]');
    const clearButton = documentRef.querySelector('[data-pdf-clear]');
    const count = documentRef.querySelector('[data-pdf-count]');
    const emptyState = documentRef.querySelector('[data-pdf-empty]');
    const resetButton = documentRef.querySelector('[data-pdf-reset]');
    const categoryButtons = [...documentRef.querySelectorAll('[data-pdf-category]')];
    const sections = [...documentRef.querySelectorAll('[data-pdf-section]')];
    const elements = [...documentRef.querySelectorAll('[data-pdf-item]')];
    const items = elements.map((element) => ({
      element,
      title: element.dataset.title,
      description: element.dataset.description,
      category: element.dataset.category,
    }));
    let category = 'all';

    function render() {
      const visibleItems = filterItems(items, { query: queryInput.value, category });
      const visibleElements = new Set(visibleItems.map((item) => item.element));
      elements.forEach((element) => { element.hidden = !visibleElements.has(element); });
      sections.forEach((section) => {
        section.hidden = !visibleItems.some((item) => item.category === section.dataset.pdfSection);
      });
      categoryButtons.forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.pdfCategory === category));
      });
      clearButton.hidden = !queryInput.value;
      emptyState.hidden = visibleItems.length !== 0;
      count.textContent = `顯示 ${visibleItems.length} 份 PDF`;
    }

    function clearQuery({ focus = true } = {}) {
      queryInput.value = '';
      render();
      if (focus) queryInput.focus();
    }

    function reset() {
      category = 'all';
      clearQuery();
    }

    searchForm.dataset.enhanced = 'true';
    searchForm.addEventListener('submit', (event) => event.preventDefault());
    queryInput.addEventListener('input', render);
    queryInput.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && queryInput.value) clearQuery();
    });
    clearButton.addEventListener('click', () => clearQuery());
    resetButton.addEventListener('click', reset);
    categoryButtons.forEach((button) => {
      button.addEventListener('click', () => {
        category = button.dataset.pdfCategory;
        render();
      });
    });
    render();
  }

  global.AndroidLearningPdfLibrary = Object.freeze({ filterItems, enhance });

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => enhance(document), { once: true });
    } else {
      enhance(document);
    }
  }
}(globalThis));
