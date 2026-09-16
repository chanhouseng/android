function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizedAssetBase(assetBase) {
  const base = String(assetBase ?? '');
  return base.endsWith('/') ? base : `${base}/`;
}

export function renderHomeworkPage({
  id,
  title,
  description,
  contentHtml,
  preview = false,
  assetBase,
  scriptBase = '',
}) {
  const safeId = escapeHtml(id);
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeAssetBase = escapeHtml(normalizedAssetBase(assetBase));
  const safeScriptBase = escapeHtml(normalizedAssetBase(scriptBase));
  const documentTitle = `${safeTitle}｜Homework${preview ? ' 預覽' : ''}`;
  const previewBadge = preview
    ? '<span class="status-badge status-badge--warning" role="status">尚未發佈</span>'
    : '';
  const previewPolicy = preview
    ? '  <meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'self\'; img-src \'self\' data:; script-src \'none\'; connect-src \'none\'; object-src \'none\'; frame-src \'none\'; base-uri \'none\'; form-action \'none\'">\n'
    : '';
  const hasAccordion = /<[a-z][^>]*\sdata-accordion-root(?:\s|=|>)/i.test(contentHtml);
  const productionScripts = preview ? '' : [
    `  <script src="${safeScriptBase}site-navigation.js"></script>`,
    hasAccordion ? `  <script src="${safeScriptBase}accordion.js"></script>` : '',
  ].filter(Boolean).join('\n').concat('\n');

  return `<!doctype html>
<html lang="zh-Hant" data-site-root="${preview ? '/' : '../'}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
${previewPolicy}  <title>${documentTitle}</title>
  <link rel="stylesheet" href="${safeAssetBase}foundation.css">
  <link rel="stylesheet" href="${safeAssetBase}app-shell.css">
  <link rel="stylesheet" href="${safeAssetBase}accordion.css">
  <link rel="stylesheet" href="${safeAssetBase}detail-page.css">
</head>
<body>
  <a class="skip-link" href="#main-content">跳到主要內容</a>
  <aside class="app-sidebar" aria-label="Android Learning Workspace">
    <a class="brand-lockup" href="/" aria-label="返回首頁"><span class="brand-mark" aria-hidden="true">AL</span><span class="brand-copy"><strong>Android Learning</strong><span>WORKSPACE</span></span></a>
    <nav class="desktop-navigation" aria-label="主導覽" data-site-navigation="desktop"></nav>
    <p class="sidebar-note">LEARNING ROUTE RAIL</p>
  </aside>
  <main class="app-main" id="main-content" tabindex="-1" data-content-id="${safeId}">
    <div class="container detail-page">
      <nav aria-label="Breadcrumb">
        <ol class="detail-breadcrumb">
          <li><a href="/">首頁</a></li>
          <li><a href="/homework/">Homework</a></li>
          <li><span aria-current="page">${safeTitle}</span></li>
        </ol>
      </nav>
      <header class="detail-header">
        <a class="button button--ghost detail-header__back" href="/homework/">返回 Homework</a>
        <div class="cluster"><p class="detail-eyebrow">HOMEWORK · DETAIL</p>${previewBadge}</div>
        <h1>${safeTitle}</h1>
        <p>${safeDescription}</p>
      </header>
      <div class="detail-content" data-original-content>
${contentHtml}
      </div>
      <footer class="detail-footer">
        <a class="button button--secondary" href="/homework/">返回 Homework</a>
      </footer>
    </div>
  </main>
  <nav class="mobile-navigation" aria-label="手機主導覽" data-site-navigation="mobile"></nav>
${productionScripts}</body>
</html>
`;
}
