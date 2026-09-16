(function initializeEntrySearch(global) {
  'use strict';

  const items = Object.freeze([
    Object.freeze({ title: '堂上練習', href: 'page1.html', keywords: ['class', '課堂'] }),
    Object.freeze({ title: '自己練習', href: 'page2.html', keywords: ['practice', '練習'] }),
    Object.freeze({ title: 'world skill', href: 'world skill/index.html', keywords: ['worldskills', '競賽'] }),
    Object.freeze({ title: '經常忘記大全', href: 'forgot.html', keywords: ['forgot', '忘記'] }),
    Object.freeze({ title: '所有pdf', href: 'pdf.html', keywords: ['pdf'] }),
    Object.freeze({ title: '練習題檔案', href: 'training/', keywords: ['training', '題目', '資源'] }),
    Object.freeze({ title: '知識點knowledge', href: 'knowledge/index.html', keywords: ['knowledge', '知識'] }),
    Object.freeze({ title: 'homework', href: 'homework/index.html', keywords: ['作業', '功課'] }),
  ]);

  function normalize(value = '') {
    return value.normalize('NFKC').trim().toLocaleLowerCase('zh-Hant');
  }

  function searchEntries(query) {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return [];

    return items.filter((item) => normalize([
      item.title,
      ...item.keywords,
    ].join(' ')).includes(normalizedQuery));
  }

  function createResult(documentRef, item) {
    const listItem = documentRef.createElement('li');
    const link = documentRef.createElement('a');
    const detail = documentRef.createElement('span');
    link.className = 'entry-search__result';
    link.href = item.href;
    link.textContent = item.title;
    detail.textContent = item.href;
    link.append(detail);
    listItem.append(link);
    return listItem;
  }

  function setupEntrySearch(documentRef = document) {
    const form = documentRef.querySelector('#entry-search');
    const input = documentRef.querySelector('#entry-search-input');
    const resultsPanel = documentRef.querySelector('#entry-search-results');
    const announcement = documentRef.querySelector('#entry-search-announcement');
    if (!form || !input || !resultsPanel || !announcement) return;

    let currentResults = [];

    function render() {
      const query = input.value;
      currentResults = searchEntries(query);
      resultsPanel.replaceChildren();

      if (!normalize(query)) {
        resultsPanel.hidden = true;
        announcement.textContent = '';
        return;
      }

      if (currentResults.length === 0) {
        const emptyState = documentRef.createElement('p');
        emptyState.className = 'state state--empty';
        emptyState.textContent = '找不到相符入口。可試「作業」、「知識」或「PDF」。';
        resultsPanel.append(emptyState);
      } else {
        const list = documentRef.createElement('ul');
        list.className = 'entry-search__results-list';
        currentResults.forEach((item) => list.append(createResult(documentRef, item)));
        resultsPanel.append(list);
      }

      resultsPanel.hidden = false;
      announcement.textContent = `找到 ${currentResults.length} 個入口。`;
    }

    input.addEventListener('input', render);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        input.value = '';
        render();
      }
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (currentResults[0]) global.location.href = currentResults[0].href;
    });
    documentRef.addEventListener('click', (event) => {
      if (!form.contains(event.target)) resultsPanel.hidden = true;
    });
  }

  global.AndroidLearningEntrySearch = Object.freeze({ items, searchEntries, setupEntrySearch });

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setupEntrySearch(document), { once: true });
    } else {
      setupEntrySearch(document);
    }
  }
}(globalThis));
