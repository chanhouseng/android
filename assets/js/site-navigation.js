(function initializeSiteNavigation(global) {
  'use strict';

  const items = Object.freeze([
    Object.freeze({ id: 'home', label: '首頁', href: 'index.html', matches: [], mobilePrimary: true }),
    Object.freeze({ id: 'learning', label: '課堂學習', href: 'page1.html', matches: ['/page1.html', '/page2.html'], mobilePrimary: true }),
    Object.freeze({ id: 'homework', label: '作業', href: 'homework/index.html', matches: ['/homework/'], mobilePrimary: true }),
    Object.freeze({ id: 'knowledge', label: '知識庫', href: 'knowledge/index.html', matches: ['/knowledge/'], mobilePrimary: true }),
    Object.freeze({ id: 'resources', label: '資源', href: 'training/', matches: ['/training/', '/train/'], mobilePrimary: false }),
    Object.freeze({ id: 'world-skills', label: 'World Skill 練習', href: 'world skill/', matches: ['/world skill/'], mobilePrimary: false }),
    Object.freeze({ id: 'forgot', label: '經常忘記大全', href: 'forgot.html', matches: ['/forgot.html'], mobilePrimary: false }),
    Object.freeze({ id: 'pdf', label: '所有 PDF', href: 'pdf.html', matches: ['/pdf.html'], mobilePrimary: false }),
  ]);

  function getMobilePrimaryItems() {
    return items.filter((item) => item.mobilePrimary);
  }

  function getMobileOverflowItems() {
    return items.filter((item) => !item.mobilePrimary);
  }

  function resolveNavigationHref(href, siteRoot = '') {
    if (/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(href)) return href;

    const normalizedRoot = String(siteRoot).trim();
    if (!normalizedRoot) return href;
    const rootWithSlash = normalizedRoot.endsWith('/') ? normalizedRoot : `${normalizedRoot}/`;
    return `${rootWithSlash}${href.replace(/^\.\//, '')}`;
  }

  function normalizePath(pathname = '') {
    const withoutQuery = pathname.split(/[?#]/, 1)[0].replaceAll('\\', '/');
    try {
      return decodeURIComponent(withoutQuery).toLocaleLowerCase('zh-Hant');
    } catch {
      return withoutQuery.toLocaleLowerCase('zh-Hant');
    }
  }

  function getActiveNavId(pathname = '') {
    const normalizedPath = normalizePath(pathname);
    const matchedItem = items.slice(1).find((item) => (
      item.matches.some((match) => normalizedPath.includes(match))
    ));
    if (matchedItem) return matchedItem.id;

    const trimmedPath = normalizedPath.replace(/\/+$/, '');
    if (!trimmedPath || trimmedPath.endsWith('/index.html')) return 'home';
    return 'home';
  }

  function createNavigationLink(
    documentRef,
    item,
    activeId,
    index,
    className = 'site-navigation__link',
    siteRoot = '',
  ) {
    const link = documentRef.createElement('a');
    const marker = documentRef.createElement('span');
    const label = documentRef.createElement('span');

    link.className = className;
    link.href = resolveNavigationHref(item.href, siteRoot);
    if (item.id === activeId) link.setAttribute('aria-current', 'page');

    marker.className = 'site-navigation__marker';
    marker.textContent = String(index + 1).padStart(2, '0');
    marker.setAttribute('aria-hidden', 'true');

    label.className = 'site-navigation__label';
    label.textContent = item.label;
    link.append(marker, label);
    return link;
  }

  function createDesktopNavigation(documentRef, activeId, siteRoot) {
    const list = documentRef.createElement('ul');
    list.className = 'site-navigation';

    items.forEach((item, index) => {
      const listItem = documentRef.createElement('li');
      listItem.append(createNavigationLink(documentRef, item, activeId, index, 'site-navigation__link', siteRoot));
      list.append(listItem);
    });

    list.dataset.navigationMode = 'desktop';
    return list;
  }

  function createMobileNavigation(documentRef, activeId, container, siteRoot) {
    const primaryItems = getMobilePrimaryItems();
    const overflowItems = getMobileOverflowItems();
    const list = documentRef.createElement('ul');
    const moreItem = documentRef.createElement('li');
    const moreToggle = documentRef.createElement('button');
    const moreMarker = documentRef.createElement('span');
    const moreLabel = documentRef.createElement('span');
    const moreMenu = documentRef.createElement('div');
    const moreList = documentRef.createElement('ul');
    const overflowIsActive = overflowItems.some((item) => item.id === activeId);

    list.className = 'site-navigation';
    list.dataset.navigationMode = 'mobile';

    primaryItems.forEach((item) => {
      const listItem = documentRef.createElement('li');
      const index = items.indexOf(item);
      listItem.append(createNavigationLink(documentRef, item, activeId, index, 'site-navigation__link', siteRoot));
      list.append(listItem);
    });

    moreToggle.className = 'site-navigation__link mobile-navigation__more-toggle';
    moreToggle.type = 'button';
    moreToggle.setAttribute('aria-expanded', 'false');
    moreToggle.setAttribute('aria-controls', 'mobile-navigation-more-menu');
    if (overflowIsActive) moreToggle.dataset.current = 'true';

    moreMarker.className = 'site-navigation__marker';
    moreMarker.setAttribute('aria-hidden', 'true');
    moreLabel.className = 'site-navigation__label';
    moreLabel.textContent = '更多';
    moreToggle.append(moreMarker, moreLabel);
    moreItem.append(moreToggle);
    list.append(moreItem);

    moreMenu.className = 'mobile-navigation__more-menu';
    moreMenu.id = 'mobile-navigation-more-menu';
    moreMenu.hidden = true;
    moreMenu.setAttribute('aria-label', '更多入口');
    moreList.className = 'mobile-navigation__more-list';

    overflowItems.forEach((item) => {
      const listItem = documentRef.createElement('li');
      const index = items.indexOf(item);
      listItem.append(createNavigationLink(
        documentRef,
        item,
        activeId,
        index,
        'mobile-navigation__more-link',
        siteRoot,
      ));
      moreList.append(listItem);
    });

    moreMenu.append(moreList);
    moreToggle.addEventListener('click', () => {
      const willOpen = moreToggle.getAttribute('aria-expanded') !== 'true';
      moreToggle.setAttribute('aria-expanded', String(willOpen));
      moreMenu.hidden = !willOpen;
    });
    documentRef.addEventListener('click', (event) => {
      if (!container.contains(event.target)) {
        moreToggle.setAttribute('aria-expanded', 'false');
        moreMenu.hidden = true;
      }
    });
    documentRef.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !moreMenu.hidden) {
        moreToggle.setAttribute('aria-expanded', 'false');
        moreMenu.hidden = true;
        moreToggle.focus();
      }
    });

    return [list, moreMenu];
  }

  function renderNavigation(documentRef = document) {
    const activeId = getActiveNavId(global.location?.pathname || '');
    const siteRoot = documentRef.documentElement?.dataset.siteRoot || '';
    documentRef.querySelectorAll('[data-site-navigation]').forEach((container) => {
      const mode = container.dataset.siteNavigation || 'desktop';
      if (mode === 'mobile') {
        container.replaceChildren(...createMobileNavigation(documentRef, activeId, container, siteRoot));
      } else {
        container.replaceChildren(createDesktopNavigation(documentRef, activeId, siteRoot));
      }
    });
  }

  global.AndroidLearningNavigation = Object.freeze({
    items,
    getActiveNavId,
    getMobilePrimaryItems,
    getMobileOverflowItems,
    resolveNavigationHref,
    renderNavigation,
  });

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => renderNavigation(document), { once: true });
    } else {
      renderNavigation(document);
    }
  }
}(globalThis));
