import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { inspectHomeworkEditability } from './homework-metadata-editor.mjs';

const HOMEWORK_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CONTENT_STATUSES = new Set(['draft', 'published']);
const PUBLIC_HOMEWORK_BASE = new URL('https://published.invalid/homework/');

export class HomeworkListError extends Error {
  constructor() {
    super('Homework manifest is unavailable or invalid.');
    this.name = 'HomeworkListError';
    this.status = 500;
    this.code = 'invalid_manifest';
  }
}

function invalidManifest() {
  return new HomeworkListError();
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validPublishedDate(value) {
  if (value === undefined || value === null) return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function publicHomeworkUrl(resultPage) {
  if (resultPage === null) return null;
  if (typeof resultPage !== 'string' || resultPage.length === 0 || resultPage !== resultPage.trim()
    || resultPage.startsWith('/') || /^[a-z][a-z\d+.-]*:/i.test(resultPage)
    || /[\\?#\u0000-\u001f\u007f]/.test(resultPage)) {
    throw invalidManifest();
  }
  let target;
  try {
    target = new URL(resultPage, PUBLIC_HOMEWORK_BASE);
  } catch {
    throw invalidManifest();
  }
  if (target.origin !== PUBLIC_HOMEWORK_BASE.origin || target.username || target.password
    || target.search || target.hash) {
    throw invalidManifest();
  }
  return target.pathname;
}

function validateRecord(item) {
  if (!isRecord(item) || typeof item.id !== 'string' || !HOMEWORK_ID_PATTERN.test(item.id)
    || typeof item.title !== 'string' || item.title.trim().length === 0
    || typeof item.description !== 'string'
    || !CONTENT_STATUSES.has(item.status)
    || (item.resultPage !== null && (typeof item.resultPage !== 'string' || item.resultPage.length === 0))
    || !validPublishedDate(item.publishedAt)) {
    throw invalidManifest();
  }
  publicHomeworkUrl(item.resultPage);
}

export async function loadPublishedHomeworks({ rootDirectory } = {}) {
  try {
    const manifestText = await readFile(resolve(rootDirectory, 'content', 'homework.json'), 'utf8');
    const manifest = JSON.parse(manifestText);
    if (!Array.isArray(manifest)) throw invalidManifest();
    for (const item of manifest) validateRecord(item);
    const homeworks = await Promise.all(manifest
      .filter(({ status }) => status === 'published')
      .map(async (item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        status: item.status,
        publishedAt: item.publishedAt ?? null,
        url: publicHomeworkUrl(item.resultPage),
        editable: (await inspectHomeworkEditability({ rootDirectory, item })).editable,
      })));
    return { homeworks, total: homeworks.length };
  } catch (error) {
    if (error instanceof HomeworkListError) throw error;
    throw invalidManifest();
  }
}
