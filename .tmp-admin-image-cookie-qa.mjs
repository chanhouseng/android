import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPasswordHash } from './admin/server/password.mjs';
import { renderHomeworkPage } from './admin/server/homework-page-renderer.mjs';
import { createAdminServer } from './admin/server/server.mjs';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = await mkdtemp(path.join(os.tmpdir(), 'admin-image-cookie-qa-'));
const id = 'module-f';
const item = {
  id, title: 'Module F', description: 'QA',
  image: 'img/module-f/cover.png', imageAlt: '封面',
  additionalImages: ['img/module-f/screen-1.png'],
  additionalImageAlts: ['畫面'],
  resultPage: 'module-f.html', trainingFolder: 'Module F',
  status: 'published', order: 1,
};
const contentHtml = '<section><h2>圖片預覽</h2><img src="img/module-f/screen-1.png" alt="畫面"></section>';
await cp(path.join(projectRoot, 'admin'), path.join(rootDirectory, 'admin'), { recursive: true });
await cp(path.join(projectRoot, 'assets'), path.join(rootDirectory, 'assets'), { recursive: true });
await mkdir(path.join(rootDirectory, 'content'), { recursive: true });
await mkdir(path.join(rootDirectory, 'homework', 'img', id), { recursive: true });
await writeFile(path.join(rootDirectory, 'content', 'homework.json'), `${JSON.stringify([item], null, 2)}\n`);
await writeFile(path.join(rootDirectory, 'homework', 'module-f.html'), renderHomeworkPage({
  id, title: item.title, description: item.description, contentHtml,
  preview: false, assetBase: '../assets/css/', scriptBase: '../assets/js/',
}));
const png = await readFile(path.join(projectRoot, 'homework', 'img', 'moduleE.png'));
await writeFile(path.join(rootDirectory, 'homework', 'img', id, 'cover.png'), png);
await writeFile(path.join(rootDirectory, 'homework', 'img', id, 'screen-1.png'), png);
const config = {
  host: '127.0.0.1', port: 0, adminPath: '/homework-editor-private',
  passwordHash: await createPasswordHash('qa-password-10f'),
  sessionSecret: Buffer.alloc(32, 73).toString('base64url'),
  cookieSecure: false, nodeEnv: 'development', sessionTtlMs: 28_800_000,
  bodyLimitBytes: 4_096,
};
const app = createAdminServer({ config, rootDirectory });
app.server.prependListener('request', (request) => {
  if (request.url?.includes('/images/')) {
    console.log(JSON.stringify({ imageRequest: request.url, hasCookie: Boolean(request.headers.cookie) }));
  }
});
await new Promise((resolve, reject) => {
  app.server.once('error', reject);
  app.server.listen(0, config.host, resolve);
});
console.log(JSON.stringify({
  url: `http://127.0.0.1:${app.server.address().port}${config.adminPath}/`,
  password: 'qa-password-10f',
  rootDirectory,
}));
async function shutdown() {
  await app.close();
  await rm(rootDirectory, { recursive: true, force: true });
}
process.once('SIGINT', () => shutdown().finally(() => process.exit()));
