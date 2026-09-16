import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parse } from 'parse5';

function elements(node, tagName, result = []) {
  if (node?.tagName === tagName) result.push(node);
  for (const child of node?.childNodes ?? []) elements(child, tagName, result);
  return result;
}

function attribute(node, name) {
  return node.attrs?.find((item) => item.name === name)?.value ?? null;
}

function text(node) {
  return (node.childNodes ?? []).map((child) => child.nodeName === '#text' ? child.value : text(child)).join('').trim();
}

function ancestor(node, predicate) {
  for (let current = node.parentNode; current; current = current.parentNode) {
    if (predicate(current)) return current;
  }
  return null;
}

async function documentFor(relativePath) {
  return parse(await readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8'));
}

function assertSafeBlankLink(link, href) {
  assert.ok(link, `missing link for ${href}`);
  assert.equal(attribute(link, 'href'), href);
  assert.equal(attribute(link, 'target'), '_blank');
  assert.equal(attribute(link, 'rel'), 'noopener noreferrer');
  assert.equal((link.attrs ?? []).some(({ name }) => name.startsWith('on')), false);
}

test('authenticated management header exposes both safe public-site shortcuts outside logout controls', async () => {
  const document = await documentFor('admin/index.html');
  const links = elements(document, 'a');
  const homepage = links.find((link) => text(link) === '查看網站首頁');
  const homework = links.find((link) => text(link) === '查看 Homework');

  assertSafeBlankLink(homepage, '/');
  assertSafeBlankLink(homework, '/homework/');
  for (const link of [homepage, homework]) {
    assert.ok(ancestor(link, (node) => attribute(node, 'aria-label') === '公開網站快捷入口'));
    assert.equal(Boolean(ancestor(link, (node) => attribute(node, 'class')?.includes('admin-editor__logout'))), false);
  }
});

test('login card ends with a subdued safe link back to the public homepage', async () => {
  const document = await documentFor('admin/login.html');
  const link = elements(document, 'a').find((item) => text(item) === '返回公開網站');

  assertSafeBlankLink(link, '/');
  assert.equal(attribute(link, 'class'), 'admin-auth-public-link');
  assert.ok(ancestor(link, (node) => attribute(node, 'class')?.split(/\s+/).includes('admin-auth-card')));
  assert.equal(Boolean(ancestor(link, (node) => node.tagName === 'form')), false);
});

test('public Homepage and Homework pages expose no management entry', async () => {
  for (const relativePath of ['index.html', 'homework/index.html']) {
    const document = await documentFor(relativePath);
    const links = elements(document, 'a');
    assert.equal(links.some((link) => /homework-editor-private|admin/i.test(attribute(link, 'href') ?? '')), false);
    assert.equal(links.some((link) => /作業管理|管理員入口/.test(text(link))), false);
  }
});
