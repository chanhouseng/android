import {
  buildBreadcrumbs,
  buildFileUrl,
  buildFolderUrl,
  getImmediateChildren,
  resolveCurrentFolder,
  searchEntries,
} from './browser-core.js';

const elements = {
  announcements: document.querySelector('#announcements'),
  breadcrumbs: document.querySelector('#breadcrumbs'),
  clearSearch: document.querySelector('#clear-search'),
  contentTitle: document.querySelector('#content-title'),
  fileList: document.querySelector('#file-list'),
  itemCount: document.querySelector('#item-count'),
  routeNotice: document.querySelector('#route-notice'),
  searchForm: document.querySelector('#search-form'),
  searchInput: document.querySelector('#search-input'),
  searchSummary: document.querySelector('#search-summary'),
  stateAction: document.querySelector('#state-action'),
  stateMessage: document.querySelector('#state-message'),
  statePanel: document.querySelector('#state-panel'),
  stateTitle: document.querySelector('#state-title'),
};

let entries = [];
let currentPath = '';
let query = '';
let stateActionHandler = null;

function createIcon(type) {
  const namespace = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(namespace, 'svg');
  svg.classList.add('entry-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const paths = type === 'folder'
    ? ['M3.5 6.75h6l2 2h9v9.5a1.75 1.75 0 0 1-1.75 1.75H5.25A1.75 1.75 0 0 1 3.5 18.25z']
    : ['M6 3.5h7l5 5v12H6z', 'M13 3.5v5h5'];

  for (const pathData of paths) {
    const iconPath = document.createElementNS(namespace, 'path');
    iconPath.setAttribute('d', pathData);
    svg.append(iconPath);
  }

  return svg;
}

function announce(message) {
  elements.announcements.textContent = '';
  window.requestAnimationFrame(() => {
    elements.announcements.textContent = message;
  });
}

function setRouteNotice(message = '') {
  elements.routeNotice.textContent = message;
  elements.routeNotice.hidden = !message;
}

function showState({ title, message = '', actionLabel = '', onAction = null }) {
  elements.fileList.hidden = true;
  elements.statePanel.hidden = false;
  elements.stateTitle.textContent = title;
  elements.stateMessage.textContent = message;
  elements.stateMessage.hidden = !message;
  elements.stateAction.textContent = actionLabel;
  elements.stateAction.hidden = !actionLabel;
  stateActionHandler = onAction;
}

function hideState() {
  elements.statePanel.hidden = true;
  elements.fileList.hidden = false;
  stateActionHandler = null;
}

function renderBreadcrumbs() {
  const breadcrumbData = buildBreadcrumbs(currentPath);
  const list = document.createElement('ol');
  list.className = 'breadcrumb-list';

  breadcrumbData.forEach((breadcrumb, index) => {
    const item = document.createElement('li');
    item.className = 'breadcrumb-item';

    if (index === 0) {
      const prefix = document.createElement('span');
      prefix.className = 'breadcrumb-prefix';
      prefix.textContent = '~/';
      prefix.setAttribute('aria-hidden', 'true');
      item.append(prefix);
    }

    const isCurrent = index === breadcrumbData.length - 1;
    if (isCurrent) {
      const current = document.createElement('span');
      current.className = 'breadcrumb-current';
      current.textContent = breadcrumb.name;
      current.setAttribute('aria-current', 'page');
      item.append(current);
    } else {
      const link = document.createElement('a');
      link.className = 'breadcrumb-link';
      link.href = buildFolderUrl(breadcrumb.path);
      link.textContent = breadcrumb.name;
      link.addEventListener('click', (event) => {
        event.preventDefault();
        navigateToFolder(breadcrumb.path);
      });
      item.append(link);
    }

    const separator = document.createElement('span');
    separator.className = 'breadcrumb-separator';
    separator.textContent = '/';
    separator.setAttribute('aria-hidden', 'true');
    item.append(separator);
    list.append(item);
  });

  elements.breadcrumbs.replaceChildren(list);
}

function createEntry(entry, isSearchResult) {
  const item = document.createElement('li');
  item.className = 'entry';

  const control = entry.type === 'folder'
    ? document.createElement('button')
    : document.createElement('a');
  control.className = `entry-control entry-${entry.type}`;

  if (entry.type === 'folder') {
    control.type = 'button';
    control.addEventListener('click', () => navigateToFolder(entry.path));
  } else {
    control.href = buildFileUrl(entry.path);
    control.download = entry.name;
  }

  const copy = document.createElement('span');
  copy.className = 'entry-copy';

  const name = document.createElement('span');
  name.className = 'entry-name';
  name.textContent = entry.name;
  copy.append(name);

  if (isSearchResult) {
    const location = document.createElement('span');
    location.className = 'entry-location';
    location.textContent = entry.parentPath || 'train';
    location.title = entry.parentPath || 'train';
    copy.append(location);
  }

  control.append(createIcon(entry.type), copy);
  item.append(control);
  return item;
}

function animateResults() {
  elements.fileList.classList.remove('is-refreshing');
  window.requestAnimationFrame(() => elements.fileList.classList.add('is-refreshing'));
}

function render() {
  renderBreadcrumbs();
  const isSearching = Boolean(query.trim());
  const visibleEntries = isSearching
    ? searchEntries(entries, query)
    : getImmediateChildren(entries, currentPath);
  const folderCount = visibleEntries.filter((entry) => entry.type === 'folder').length;
  const fileCount = visibleEntries.length - folderCount;
  const searchSummary = `找到 ${folderCount} 個資料夾、${fileCount} 個檔案`;

  elements.clearSearch.hidden = !isSearching;
  elements.contentTitle.textContent = isSearching ? '搜尋結果' : '資料夾內容';
  elements.itemCount.textContent = `${visibleEntries.length} 個項目`;
  elements.searchSummary.textContent = isSearching ? searchSummary : '';

  if (visibleEntries.length === 0) {
    elements.fileList.replaceChildren();
    if (isSearching) {
      showState({
        title: '找不到符合的檔案。',
        message: `沒有名稱符合「${query.trim()}」。`,
        actionLabel: '清除搜尋',
        onAction: clearSearch,
      });
      announce('找不到符合的檔案。');
    } else {
      showState({ title: '這個資料夾沒有可顯示的檔案。' });
      announce('這個資料夾沒有可顯示的檔案。');
    }
    return;
  }

  const fragment = document.createDocumentFragment();
  visibleEntries.forEach((entry) => fragment.append(createEntry(entry, isSearching)));
  elements.fileList.replaceChildren(fragment);
  elements.fileList.setAttribute('aria-busy', 'false');
  hideState();
  animateResults();

  announce(isSearching
    ? `${searchSummary}。`
    : `${currentPath || 'train'} 有 ${visibleEntries.length} 個項目。`);
}

function clearSearch() {
  query = '';
  elements.searchInput.value = '';
  render();
  elements.searchInput.focus();
}

function navigateToFolder(folderPath, { replace = false } = {}) {
  currentPath = folderPath;
  query = '';
  elements.searchInput.value = '';
  setRouteNotice();

  const method = replace ? 'replaceState' : 'pushState';
  window.history[method]({ path: folderPath }, '', buildFolderUrl(folderPath));
  render();
}

function syncPathFromLocation({ showInvalidNotice = false } = {}) {
  const requestedPath = new URL(window.location.href).searchParams.get('path') || '';
  const resolvedPath = resolveCurrentFolder(entries, requestedPath);
  const isInvalid = requestedPath !== resolvedPath;
  currentPath = resolvedPath;

  if (isInvalid) {
    window.history.replaceState({ path: '' }, '', buildFolderUrl(''));
    if (showInvalidNotice) {
      setRouteNotice('找不到要求的資料夾，已返回 train/ 根目錄。');
      announce('找不到要求的資料夾，已返回根目錄。');
    }
  } else {
    window.history.replaceState({ path: currentPath }, '', window.location.href);
    setRouteNotice();
  }
}

async function loadManifest() {
  elements.fileList.setAttribute('aria-busy', 'true');
  elements.searchInput.disabled = true;
  showState({ title: '正在載入檔案…' });

  try {
    const response = await fetch('./files.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Manifest request failed: ${response.status}`);

    const manifest = await response.json();
    if (!Array.isArray(manifest)) throw new TypeError('Manifest must be an array');

    entries = manifest;
    elements.searchInput.disabled = false;
    syncPathFromLocation({ showInvalidNotice: true });
    render();
  } catch (error) {
    console.error('Unable to load training index', error);
    elements.fileList.setAttribute('aria-busy', 'false');
    showState({
      title: '無法載入題目索引。請重新整理頁面。',
      message: '請檢查網路連線後再試一次。',
      actionLabel: '重試',
      onAction: loadManifest,
    });
    announce('無法載入題目索引。');
  }
}

elements.searchForm.addEventListener('submit', (event) => event.preventDefault());
elements.searchInput.addEventListener('input', (event) => {
  query = event.currentTarget.value;
  render();
});
elements.searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && query) clearSearch();
});
elements.clearSearch.addEventListener('click', clearSearch);
elements.stateAction.addEventListener('click', () => stateActionHandler?.());
window.addEventListener('popstate', () => {
  query = '';
  elements.searchInput.value = '';
  syncPathFromLocation({ showInvalidNotice: true });
  render();
});

loadManifest();
