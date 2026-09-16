import { parse, parseFragment } from 'parse5';

const ALLOWED_ELEMENTS = new Set([
  'section', 'article', 'aside', 'div',
  'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'span', 'strong', 'em', 'small', 'mark',
  'br', 'hr', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'blockquote',
  'figure', 'figcaption', 'details', 'summary', 'pre', 'code', 'kbd',
  'table', 'caption', 'colgroup', 'col', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'a', 'img', 'button',
]);

const FORBIDDEN_ELEMENTS = new Set([
  'doctype', 'html', 'head', 'body', 'h1', 'script', 'style', 'iframe', 'object', 'embed',
  'base', 'meta', 'link', 'form', 'input', 'textarea', 'select', 'option', 'template',
  'svg', 'math', 'canvas', 'audio', 'video', 'source',
]);

const DEFAULT_RESERVED_IDS = new Set([
  'main-content', 'site-navigation', 'admin-title', 'preview-frame',
]);

const ELEMENT_ATTRIBUTES = Object.freeze({
  a: new Set(['href', 'target', 'rel']),
  button: new Set(['type']),
  details: new Set(['open']),
  img: new Set(['src', 'alt', 'loading', 'decoding', 'width', 'height']),
  ol: new Set(['start', 'reversed']),
  li: new Set(['value']),
  col: new Set(['span']),
  th: new Set(['colspan', 'rowspan', 'scope']),
  td: new Set(['colspan', 'rowspan']),
});

const SAFE_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,127}$/;
const SAFE_INTEGER_PATTERN = /^[1-9]\d{0,4}$/;
const MAX_DIMENSION = 16_384;

function sourcePosition(location) {
  if (!location) return {};
  const line = location.startLine;
  const column = location.startCol;
  return Number.isInteger(line) && Number.isInteger(column) ? { line, column } : {};
}

function nodePosition(node) {
  return sourcePosition(node?.sourceCodeLocation?.startTag ?? node?.sourceCodeLocation);
}

function attributePosition(node, name) {
  const position = sourcePosition(node?.sourceCodeLocation?.attrs?.[name]);
  return Number.isInteger(position.line) ? position : nodePosition(node);
}

function validationError(code, message, position = {}) {
  return { field: 'contentHtml', code, message, ...position };
}

function isGlobalAttribute(name) {
  return name === 'class' || name === 'id' || name === 'role' || name === 'title'
    || name === 'tabindex' || name.startsWith('aria-') || name.startsWith('data-');
}

function isAllowedAttribute(tagName, name) {
  return isGlobalAttribute(name) || ELEMENT_ATTRIBUTES[tagName]?.has(name) === true;
}

function attributeMap(node) {
  return new Map((node.attrs ?? []).map(({ name, value }) => [name, value]));
}

function hasControlOrEdgeWhitespace(value) {
  return /[\u0000-\u001f\u007f]/.test(value) || value !== value.trim();
}

function isSafeAnchorUrl(value) {
  if (!value || hasControlOrEdgeWhitespace(value) || value.includes('\\') || value.startsWith('//')) return false;
  const compact = value.replace(/[\u0000-\u0020\u007f]+/g, '').toLowerCase();
  if (/^(?:javascript|data|vbscript):/.test(compact)) return false;
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(value);
  if (!scheme) return true;
  if (scheme[1].toLowerCase() !== 'https') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isSafeImageUrl(value) {
  if (!value || hasControlOrEdgeWhitespace(value) || value.includes('\\')
    || value.startsWith('/') || value.startsWith('//') || value.startsWith('#') || value.startsWith('?')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return false;
  try {
    const resolved = new URL(value, 'https://preview.invalid/base/');
    return resolved.origin === 'https://preview.invalid';
  } catch {
    return false;
  }
}

function isPositiveInteger(value, maximum = 99_999) {
  return SAFE_INTEGER_PATTERN.test(value) && Number(value) <= maximum;
}

function validateCommonAttributes(node, attrs, errors, seenIds, reservedIds) {
  for (const { name } of node.attrs ?? []) {
    const position = attributePosition(node, name);
    if (name.startsWith('on') || name === 'style' || !isAllowedAttribute(node.tagName, name)) {
      errors.push(validationError('attribute_not_allowed', `主要內容不可使用 ${name} 屬性。`, position));
      continue;
    }
    const value = attrs.get(name);
    if (name === 'id') {
      if (!SAFE_ID_PATTERN.test(value)) {
        errors.push(validationError('invalid_id', '主要內容的 id 格式不安全。', position));
      } else if (reservedIds.has(value)) {
        errors.push(validationError('reserved_id', `主要內容不可使用保留 id「${value}」。`, position));
      } else if (seenIds.has(value)) {
        errors.push(validationError('duplicate_id', `主要內容的 id「${value}」重複。`, position));
      } else {
        seenIds.add(value);
      }
    }
    if (name === 'tabindex' && value !== '0' && value !== '-1') {
      errors.push(validationError('invalid_attribute_value', 'tabindex 只可使用 0 或 -1。', position));
    }
  }
}

function validateAnchor(node, attrs, errors) {
  if (attrs.has('href') && !isSafeAnchorUrl(attrs.get('href'))) {
    errors.push(validationError('invalid_url', '連結只可使用站內相對路徑、站內絕對路徑或 https 網址。', attributePosition(node, 'href')));
  }
  if (attrs.has('target') && !new Set(['_self', '_blank']).has(attrs.get('target'))) {
    errors.push(validationError('invalid_attribute_value', '連結 target 只可使用 _self 或 _blank。', attributePosition(node, 'target')));
  }
  if (attrs.get('target') === '_blank') {
    const relTokens = new Set((attrs.get('rel') ?? '').toLowerCase().split(/\s+/).filter(Boolean));
    if (!relTokens.has('noopener') || !relTokens.has('noreferrer')) {
      errors.push(validationError('unsafe_blank_target', '使用 target="_blank" 時必須同時加入 rel="noopener noreferrer"。', nodePosition(node)));
    }
  }
}

function validateImage(node, attrs, errors) {
  if (!attrs.has('src') || !isSafeImageUrl(attrs.get('src'))) {
    errors.push(validationError('invalid_url', '圖片 src 只可使用站內相對路徑。', attributePosition(node, 'src')));
  }
  if (!attrs.has('alt') || attrs.get('alt').trim() === '') {
    errors.push(validationError('invalid_attribute_value', '圖片必須提供非空白 alt 文字。', attributePosition(node, 'alt')));
  }
  if (attrs.has('loading') && !new Set(['lazy', 'eager']).has(attrs.get('loading'))) {
    errors.push(validationError('invalid_attribute_value', '圖片 loading 只可使用 lazy 或 eager。', attributePosition(node, 'loading')));
  }
  if (attrs.has('decoding') && !new Set(['async', 'sync', 'auto']).has(attrs.get('decoding'))) {
    errors.push(validationError('invalid_attribute_value', '圖片 decoding 值不正確。', attributePosition(node, 'decoding')));
  }
  for (const name of ['width', 'height']) {
    if (attrs.has(name) && !isPositiveInteger(attrs.get(name), MAX_DIMENSION)) {
      errors.push(validationError('invalid_attribute_value', `圖片 ${name} 必須是合理的正整數。`, attributePosition(node, name)));
    }
  }
}

function validateElementAttributes(node, attrs, errors) {
  if (node.tagName === 'a') validateAnchor(node, attrs, errors);
  if (node.tagName === 'img') validateImage(node, attrs, errors);
  if (node.tagName === 'button' && attrs.get('type') !== 'button') {
    errors.push(validationError('invalid_button_type', 'button 必須明確使用 type="button"。', nodePosition(node)));
  }
  if (node.tagName === 'details' && attrs.has('open') && !['', 'open'].includes(attrs.get('open'))) {
    errors.push(validationError('invalid_attribute_value', 'details 的 open 必須是布林屬性。', attributePosition(node, 'open')));
  }
  for (const name of ['start', 'value', 'span', 'colspan', 'rowspan']) {
    if (attrs.has(name) && !isPositiveInteger(attrs.get(name))) {
      errors.push(validationError('invalid_attribute_value', `${name} 必須是合理的正整數。`, attributePosition(node, name)));
    }
  }
  if (attrs.has('scope') && !new Set(['row', 'col', 'rowgroup', 'colgroup']).has(attrs.get('scope'))) {
    errors.push(validationError('invalid_attribute_value', 'th scope 值不正確。', attributePosition(node, 'scope')));
  }
}

function visit(node, errors, seenIds, reservedIds) {
  if (node.tagName) {
    if (!ALLOWED_ELEMENTS.has(node.tagName)) {
      const code = FORBIDDEN_ELEMENTS.has(node.tagName) ? 'forbidden_element' : 'element_not_allowed';
      errors.push(validationError(code, `主要內容不可包含 <${node.tagName}>。`, nodePosition(node)));
    } else {
      const attrs = attributeMap(node);
      validateCommonAttributes(node, attrs, errors, seenIds, reservedIds);
      validateElementAttributes(node, attrs, errors);
    }
  }
  for (const child of node.childNodes ?? []) visit(child, errors, seenIds, reservedIds);
  if (node.content) visit(node.content, errors, seenIds, reservedIds);
}

function findExplicitDocumentNodes(node, errors) {
  if (node.nodeName === '#documentType' && node.sourceCodeLocation) {
    errors.push(validationError('forbidden_element', '主要內容不可包含 doctype。', nodePosition(node)));
  }
  if (['html', 'head', 'body'].includes(node.tagName) && node.sourceCodeLocation) {
    errors.push(validationError('forbidden_element', `主要內容不可包含 <${node.tagName}>。`, nodePosition(node)));
  }
  for (const child of node.childNodes ?? []) findExplicitDocumentNodes(child, errors);
}

export function validateHtmlFragment(contentHtml, { reservedIds = [] } = {}) {
  if (typeof contentHtml !== 'string') {
    return { ok: false, errors: [validationError('invalid_type', '主要內容 HTML 必須是文字。')] };
  }

  const parseErrors = [];
  const fragment = parseFragment(contentHtml, {
    sourceCodeLocationInfo: true,
    onParseError: (parseError) => parseErrors.push(parseError),
  });
  if (parseErrors.length > 0) {
    return {
      ok: false,
      errors: parseErrors.map((parseError) => validationError(
        'malformed_html',
        '主要內容包含格式不正確的 HTML。',
        sourcePosition({ startLine: parseError.startLine, startCol: parseError.startCol }),
      )),
    };
  }

  const errors = [];
  findExplicitDocumentNodes(parse(contentHtml, { sourceCodeLocationInfo: true }), errors);
  const combinedReservedIds = new Set([...DEFAULT_RESERVED_IDS, ...reservedIds]);
  visit(fragment, errors, new Set(), combinedReservedIds);
  return errors.length > 0 ? { ok: false, errors } : { ok: true, html: contentHtml };
}

export function extractImageSources(contentHtml) {
  if (typeof contentHtml !== 'string') return [];
  const sources = [];
  const fragment = parseFragment(contentHtml);
  function collect(node) {
    if (node.tagName === 'img') {
      const source = (node.attrs ?? []).find(({ name }) => name === 'src');
      if (source) sources.push(source.value);
    }
    for (const child of node.childNodes ?? []) collect(child);
    if (node.content) collect(node.content);
  }
  collect(fragment);
  return sources;
}
