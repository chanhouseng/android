import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const requiredFiles = [
  'content/homework.json',
  'content/world-skills.json',
  'scripts/content-core.mjs',
  'scripts/build-content-indexes.mjs',
  'scripts/new-content.mjs',
  'scripts/validate-content.mjs',
  'scripts/publish-training-folder.mjs',
];

async function load(relativePath) {
  assert.equal(existsSync(path.join(root, relativePath)), true, `${relativePath} should exist`);
  return import(`${pathToFileURL(path.join(root, relativePath)).href}?test=${Date.now()}-${Math.random()}`);
}

async function json(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

async function makeRoot() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'android-content-workflow-'));
  await Promise.all([
    mkdir(path.join(directory, 'content'), { recursive: true }),
    mkdir(path.join(directory, 'homework', 'img'), { recursive: true }),
    mkdir(path.join(directory, 'world skill', 'img'), { recursive: true }),
    mkdir(path.join(directory, 'training'), { recursive: true }),
    mkdir(path.join(directory, 'train'), { recursive: true }),
  ]);
  return directory;
}

function template(markerName) {
  return `<!doctype html><main><!-- GENERATED ${markerName} START -->old<!-- GENERATED ${markerName} END --></main>\n`;
}

test('canonical content files preserve all existing cards and their order', async () => {
  for (const file of requiredFiles) assert.equal(existsSync(path.join(root, file)), true, `${file} should exist`);
  const homework = await json('content/homework.json');
  const worldSkills = await json('content/world-skills.json');

  assert.ok(homework.length >= 33);
  assert.equal(worldSkills.length, 42);
  assert.deepEqual(homework.slice(0, 33).map(({ title }) => title), [
    'homework1', 'homework2', 'homework4', 'homework5', 'homework6', 'homework7',
    '03_Module_C_PM', '03_Module_A_PM', 'Moudle3_2(壞左，要重啟項目加入返啲內容)',
    'Moudle3(壞左，要重啟項目加入返啲內容)', '02_Module_A_PM', '03_Module_A_AM',
    'jp24july', 'ModuleD', '2022_Module_A_AM', '03_Module_C_AM', '2024_ModuleC_PM',
    'passwordManager', 'MYHealthDATA', '06_Module_KR_AM', 'einsteinCup', 'Note-Taking App',
    '3ModuleC', '03_Module_B', 'hkModuleC', 'IN_Module2026(未做完，只係2.5小時成品)',
    'Skill08_Timer (2.5小時版本)', 'NeubrandenBookFans', '203_Module_A_AM',
    '203_Module_A_PM', '203_Module_C_AM', 'module1', 'moduleE',
  ]);
  assert.deepEqual(worldSkills.map(({ title }) => title), [
    'class1_1', 'class1_2', 'class1_3', 'class1_4', 'class1_5', 'class2_1_ practise.png',
    'class2_again', 'class3_1', 'class3_2', 'class3_3', 'class3_4', 'class3_5',
    'class4_1', 'class4_2', 'class4_3.png', 'class4_4.png', 'class4_5', 'class5_1',
    'class5_2', 'class5_3', 'class5_4', 'class5_5', 'class6_1', 'class6_2',
    'class7_1', 'class7_2', 'class8_1', 'class8_2', 'class9_1', 'class9_2',
    'exercise1', 'exercise2', 'exercise3', 'exercise4', 'exercise6', 'exercise7',
    'exercise12', 'exercise22', 'exercise21', 'exercise24', 'homework2', '03_Module_A_AM',
  ]);
  assert.ok(homework.every(({ status }, index) => status === 'published' && index + 1 === homework[index].order));
  assert.ok(worldSkills.every(({ status }, index) => status === 'published' && index + 1 === worldSkills[index].order));
  assert.equal(homework.find(({ title }) => title === 'moduleE').trainingFolder, 'Module E');
  assert.equal(worldSkills.find(({ title }) => title === 'exercise22').detailPage, 'exercise22.html');
  assert.equal(createHash('sha256').update(JSON.stringify(homework.slice(0, 33))).digest('hex'), 'a23204975024efce9f33d7d06bd6b96e600c7350d892ce21835d815d4c49ba36');
  assert.equal(createHash('sha256').update(JSON.stringify(worldSkills)).digest('hex'), '389800b232cf402dbb0772280e0ad422416fac71bf206e764af6b87bda03add3');
});

test('builder escapes text, hides drafts, encodes Training segments, and is idempotent', async () => {
  const { buildContentIndexes } = await load('scripts/build-content-indexes.mjs');
  const directory = await makeRoot();
  const homework = [
    { id: 'safe', title: '<測試>', description: 'A & B', image: 'img/a.png', resultPage: 'safe.html', trainingFolder: '資料 夾/Module (A)', status: 'published', order: 1 },
    { id: 'draft', title: '草稿', description: '不顯示', image: null, resultPage: 'draft.html', trainingFolder: null, status: 'draft', order: 2 },
  ];
  const worldSkills = [
    { id: 'exercise-25', title: 'exercise25', description: '中文 & <安全>', image: 'img/e.png', detailPage: 'exercise25.html', group: 'exercise', searchText: 'exercise25 中文', status: 'published', order: 1 },
    { id: 'draft-exercise', title: 'draft', description: '', image: null, detailPage: 'draft.html', group: 'exercise', searchText: '', status: 'draft', order: 2 },
  ];
  await Promise.all([
    writeFile(path.join(directory, 'content', 'homework.json'), `${JSON.stringify(homework, null, 2)}\n`),
    writeFile(path.join(directory, 'content', 'world-skills.json'), `${JSON.stringify(worldSkills, null, 2)}\n`),
    writeFile(path.join(directory, 'homework', 'index.html'), template('HOMEWORK ITEMS')),
    writeFile(path.join(directory, 'world skill', 'index.html'), template('WORLD SKILLS')),
  ]);

  await buildContentIndexes({ rootDirectory: directory });
  const firstHomework = await readFile(path.join(directory, 'homework', 'index.html'), 'utf8');
  const firstWorld = await readFile(path.join(directory, 'world skill', 'index.html'), 'utf8');
  assert.ok(firstHomework.startsWith('<!doctype html><main><!-- GENERATED HOMEWORK ITEMS START -->'));
  assert.ok(firstHomework.endsWith('<!-- GENERATED HOMEWORK ITEMS END --></main>\n'));
  assert.ok(firstWorld.startsWith('<!doctype html><main><!-- GENERATED WORLD SKILLS START -->'));
  assert.ok(firstWorld.endsWith('<!-- GENERATED WORLD SKILLS END --></main>\n'));
  assert.match(firstHomework, /&lt;測試&gt;/);
  assert.match(firstHomework, /data-content-id="safe"/);
  assert.match(firstHomework, /A &amp; B/);
  assert.match(firstHomework, /\/training\/%E8%B3%87%E6%96%99%20%E5%A4%BE\/Module%20%28A%29\//);
  assert.doesNotMatch(firstHomework, /草稿|不顯示/);
  assert.match(firstWorld, /中文 &amp; &lt;安全&gt;/);
  assert.match(firstWorld, /data-content-id="exercise-25"/);
  assert.doesNotMatch(firstWorld, />draft</);

  await buildContentIndexes({ rootDirectory: directory });
  assert.equal(await readFile(path.join(directory, 'homework', 'index.html'), 'utf8'), firstHomework);
  assert.equal(await readFile(path.join(directory, 'world skill', 'index.html'), 'utf8'), firstWorld);
  await buildContentIndexes({ rootDirectory: directory, check: true });
  const driftedHomework = firstHomework.replace('&lt;測試&gt;', '不同步');
  await writeFile(path.join(directory, 'homework', 'index.html'), driftedHomework);
  await assert.rejects(() => buildContentIndexes({ rootDirectory: directory, check: true }), /不同步|out of date/i);
  assert.equal(await readFile(path.join(directory, 'homework', 'index.html'), 'utf8'), driftedHomework);
});

test('new-content creates non-published App Shell drafts and rejects unsafe or existing IDs', async () => {
  const { createNewContent } = await load('scripts/new-content.mjs');
  const directory = await makeRoot();
  await Promise.all([
    writeFile(path.join(directory, 'content', 'homework.json'), '[]\n'),
    writeFile(path.join(directory, 'content', 'world-skills.json'), '[]\n'),
  ]);

  const homeworkResult = await createNewContent({ rootDirectory: directory, type: 'homework', id: 'module-f' });
  const exerciseResult = await createNewContent({ rootDirectory: directory, type: 'exercise', id: 'exercise25' });
  assert.equal(homeworkResult.item.status, 'draft');
  assert.equal(exerciseResult.item.status, 'draft');
  assert.equal(existsSync(path.join(directory, 'homework', 'module-f.html')), true);
  assert.equal(existsSync(path.join(directory, 'world skill', 'exercise25.html')), true);
  const exerciseDraft = await readFile(path.join(directory, 'world skill', 'exercise25.html'), 'utf8');
  assert.match(exerciseDraft, /data-site-root="\.\.\/"[\s\S]*data-site-navigation="desktop"[\s\S]*data-site-navigation="mobile"/);
  assert.match(exerciseDraft, /<nav aria-label="Breadcrumb">[\s\S]*<ol class="detail-breadcrumb">/);
  await assert.rejects(() => createNewContent({ rootDirectory: directory, type: 'exercise', id: '../escape' }), /安全|ID|invalid/i);
  await assert.rejects(() => createNewContent({ rootDirectory: directory, type: 'exercise', id: 'exercise25' }), /已存在|exists/i);
});

test('new-content serializes concurrent drafts without losing either JSON record', async () => {
  const { createNewContent } = await load('scripts/new-content.mjs');
  const directory = await makeRoot();
  await Promise.all([
    writeFile(path.join(directory, 'content', 'homework.json'), '[]\n'),
    writeFile(path.join(directory, 'content', 'world-skills.json'), '[]\n'),
  ]);
  await Promise.all([
    createNewContent({ rootDirectory: directory, type: 'exercise', id: 'exercise25' }),
    createNewContent({ rootDirectory: directory, type: 'exercise', id: 'exercise26' }),
  ]);
  const items = JSON.parse(await readFile(path.join(directory, 'content', 'world-skills.json'), 'utf8'));
  assert.deepEqual(items.map(({ id }) => id).sort(), ['exercise25', 'exercise26']);
  assert.deepEqual(items.map(({ order }) => order).sort(), [1, 2]);
});

test('validator reports missing resources, exact-case Training errors, duplicates, and duplicate accordion IDs', async () => {
  const { validateContent } = await load('scripts/validate-content.mjs');
  const directory = await makeRoot();
  const homework = [
    { id: 'one', title: 'One', description: '', image: 'img/missing.png', resultPage: 'missing.html', trainingFolder: 'module f', status: 'published', order: 1 },
    { id: 'one', title: 'Two', description: '', image: null, resultPage: null, trainingFolder: null, status: 'published', order: 1 },
  ];
  const worldSkills = [
    { id: 'world', title: 'World', description: '', image: '../outside.png', detailPage: '../../outside.html', group: 'unknown', searchText: 5, status: 'published', order: 1 },
  ];
  await mkdir(path.join(directory, 'train', 'Module F'));
  await Promise.all([
    writeFile(path.join(directory, 'content', 'homework.json'), `${JSON.stringify(homework)}\n`),
    writeFile(path.join(directory, 'content', 'world-skills.json'), `${JSON.stringify(worldSkills)}\n`),
    writeFile(path.join(directory, 'homework', 'index.html'), `${template('HOMEWORK ITEMS')}<article data-homework-item data-homework-name="draft"></article>`),
    writeFile(path.join(directory, 'world skill', 'index.html'), template('WORLD SKILLS')),
    writeFile(path.join(directory, 'training', 'files.json'), '[]\n'),
    writeFile(path.join(directory, 'homework', 'duplicate.html'), '<button id="same" data-accordion-trigger></button><section id="same" data-accordion-panel></section>'),
  ]);
  const result = await validateContent({ rootDirectory: directory });
  assert.equal(result.valid, false);
  const messages = result.errors.join('\n');
  assert.match(messages, /重複.*one|one.*重複/i);
  assert.match(messages, /order|排序/i);
  assert.match(messages, /missing\.png/);
  assert.match(messages, /missing\.html/);
  assert.match(messages, /module f[\s\S]*Module F|大小寫/i);
  assert.match(messages, /duplicate\.html[\s\S]*same|same[\s\S]*duplicate\.html/i);
  assert.match(messages, /group[\s\S]*(class|exercise|homework-module)/i);
  assert.match(messages, /searchText[\s\S]*字串/i);
  assert.match(messages, /outside\.(?:png|html)[\s\S]*(超出|指定目錄)/i);
});

test('validator rejects malformed records, wrong-case files, symlink escapes, non-directory Training targets, and broken accordion ARIA', async () => {
  const { validateContent } = await load('scripts/validate-content.mjs');
  const directory = await makeRoot();
  const outside = path.join(directory, 'outside-assets');
  await mkdir(outside);
  await writeFile(path.join(outside, 'escaped.png'), 'png');
  await symlink(outside, path.join(directory, 'homework', 'linked-images'), 'junction');
  await writeFile(path.join(directory, 'homework', 'img', 'Actual.png'), 'png');
  await writeFile(path.join(directory, 'train', 'NotAFolder'), 'file');
  const homework = [
    null,
    { id: 'case-test', title: 'Case', description: '', image: 'img/actual.png', resultPage: null, trainingFolder: 'NotAFolder', status: 'published', order: 1 },
    { id: 'link-test', title: 'Link', description: '', image: 'linked-images/escaped.png', resultPage: null, trainingFolder: null, status: 'published', order: 2 },
  ];
  const worldSkills = [{
    id: 'bad-shape', title: 'Bad', description: '', image: null, detailPage: null,
    group: 'exercise', searchText: 'Bad', status: 'published', order: 1,
    presentation: { type: 'paragraphs', items: ['not-an-object'] },
    descriptionLines: 'not-an-array',
  }];
  await Promise.all([
    writeFile(path.join(directory, 'content', 'homework.json'), `${JSON.stringify(homework)}\n`),
    writeFile(path.join(directory, 'content', 'world-skills.json'), `${JSON.stringify(worldSkills)}\n`),
    writeFile(path.join(directory, 'homework', 'index.html'), template('HOMEWORK ITEMS')),
    writeFile(path.join(directory, 'world skill', 'index.html'), template('WORLD SKILLS')),
    writeFile(path.join(directory, 'training', 'files.json'), `${JSON.stringify([{ name: 'NotAFolder', path: 'NotAFolder', parentPath: '', type: 'folder', extension: '' }])}\n`),
    writeFile(path.join(directory, 'world skill', 'broken-aria.html'), '<button id="trigger" data-accordion-trigger aria-controls="missing"></button><section id="panel" data-accordion-panel aria-labelledby="other"></section>'),
  ]);
  const result = await validateContent({ rootDirectory: directory });
  assert.equal(result.valid, false);
  const messages = result.errors.join('\n');
  assert.match(messages, /homework\[0\].*物件/i);
  assert.match(messages, /actual\.png[\s\S]*(大小寫|Actual\.png)/i);
  assert.match(messages, /linked-images[\s\S]*symlink/i);
  assert.match(messages, /NotAFolder[\s\S]*(資料夾|directory)/i);
  assert.match(messages, /presentation/i);
  assert.match(messages, /descriptionLines/i);
  assert.match(messages, /broken-aria\.html[\s\S]*(aria-controls|aria-labelledby)/i);
});

test('validator detects escaped-title drafts outside generated regions and empty resource paths', async () => {
  const { validateContent } = await load('scripts/validate-content.mjs');
  const directory = await makeRoot();
  const homework = [{
    id: 'draft-escaped', title: 'A & B', description: '', image: '', resultPage: null,
    trainingFolder: null, status: 'draft', order: 1,
  }];
  await Promise.all([
    writeFile(path.join(directory, 'content', 'homework.json'), `${JSON.stringify(homework)}\n`),
    writeFile(path.join(directory, 'content', 'world-skills.json'), '[]\n'),
    writeFile(path.join(directory, 'homework', 'index.html'), `${template('HOMEWORK ITEMS')}<article DATA-CONTENT-ID = draft-escaped data-homework-name="A &amp; B"></article>`),
    writeFile(path.join(directory, 'world skill', 'index.html'), template('WORLD SKILLS')),
    writeFile(path.join(directory, 'training', 'files.json'), '[]\n'),
  ]);
  const result = await validateContent({ rootDirectory: directory });
  const messages = result.errors.join('\n');
  assert.match(messages, /draft-escaped[\s\S]*draft/i);
  assert.match(messages, /image[\s\S]*(空|非空|null)/i);
});

test('workflow locks are released by the operating system after a process exits', async () => {
  const { withFileLock } = await load('scripts/content-core.mjs');
  const directory = await makeRoot();
  const lockPath = path.join(directory, 'content', 'process.lock');
  const moduleUrl = pathToFileURL(path.join(root, 'scripts', 'content-core.mjs')).href;
  const childScript = `import { withFileLock } from ${JSON.stringify(moduleUrl)}; await withFileLock(${JSON.stringify(lockPath)}, async () => { console.log('LOCKED'); await new Promise(() => {}); });`;
  const child = spawn(process.execPath, ['--input-type=module', '--eval', childScript], { stdio: ['ignore', 'pipe', 'pipe'] });
  await Promise.race([
    once(child.stdout, 'data').then(([chunk]) => assert.match(String(chunk), /LOCKED/)),
    new Promise((_, reject) => setTimeout(() => reject(new Error('child lock acquisition timed out')), 2000)),
  ]);
  child.kill();
  await once(child, 'exit');
  let ran = false;
  await withFileLock(lockPath, async () => { ran = true; }, { timeoutMs: 1000, retryMs: 5 });
  assert.equal(ran, true);
  assert.equal(existsSync(lockPath), false);
});

test('the canonical project content validates including its existing cross-section result link', async () => {
  const { validateContent } = await load('scripts/validate-content.mjs');
  const result = await validateContent({ rootDirectory: root });
  assert.deepEqual(result, { valid: true, errors: [] });
});

test('single-folder publisher merges compatible entries and never writes sensitive or traversed folders', async () => {
  const { publishTrainingFolder } = await load('scripts/publish-training-folder.mjs');
  const directory = await makeRoot();
  const folder = path.join(directory, 'train', 'Module F');
  await mkdir(path.join(folder, '子資料夾'), { recursive: true });
  await writeFile(path.join(folder, '題目 A.pdf'), 'pdf');
  await writeFile(path.join(folder, '子資料夾', '圖片.png'), 'png');
  const existing = [{ name: 'Keep', path: 'Keep', parentPath: '', type: 'folder', extension: '' }];
  await writeFile(path.join(directory, 'training', 'files.json'), `${JSON.stringify(existing, null, 2)}\n`);

  const result = await publishTrainingFolder({ rootDirectory: directory, folderName: 'Module F' });
  assert.equal(result.folderName, 'Module F');
  const manifest = JSON.parse(await readFile(path.join(directory, 'training', 'files.json'), 'utf8'));
  assert.ok(manifest.some(({ path: itemPath }) => itemPath === 'Keep'));
  assert.ok(manifest.some(({ path: itemPath, type }) => itemPath === 'Module F' && type === 'folder'));
  assert.ok(manifest.some(({ path: itemPath, extension }) => itemPath === 'Module F/題目 A.pdf' && extension === 'pdf'));
  assert.ok(manifest.some(({ path: itemPath }) => itemPath === 'Module F/子資料夾/圖片.png'));
  await assert.rejects(() => publishTrainingFolder({ rootDirectory: directory, folderName: '../outside' }), /安全|路徑|direct child|invalid/i);

  const outsideDirectory = path.join(directory, 'outside-source');
  await mkdir(outsideDirectory);
  await symlink(outsideDirectory, path.join(folder, 'outside-link'), 'junction');
  const beforeSymlinkAttempt = await readFile(path.join(directory, 'training', 'files.json'), 'utf8');
  await assert.rejects(() => publishTrainingFolder({ rootDirectory: directory, folderName: 'Module F' }), /symlink/i);
  assert.equal(await readFile(path.join(directory, 'training', 'files.json'), 'utf8'), beforeSymlinkAttempt);

  await writeFile(path.join(folder, '.env'), 'SECRET=value');
  const before = await readFile(path.join(directory, 'training', 'files.json'), 'utf8');
  await assert.rejects(() => publishTrainingFolder({ rootDirectory: directory, folderName: 'Module F' }), /敏感|\.env|sensitive/i);
  assert.equal(await readFile(path.join(directory, 'training', 'files.json'), 'utf8'), before);
});

test('single-folder publisher enforces canonical case and serializes concurrent manifest merges', async () => {
  const { publishTrainingFolder } = await load('scripts/publish-training-folder.mjs');
  const directory = await makeRoot();
  for (const folderName of ['Module F', 'Module G']) {
    await mkdir(path.join(directory, 'train', folderName));
    await writeFile(path.join(directory, 'train', folderName, `${folderName}.pdf`), 'pdf');
  }
  await writeFile(path.join(directory, 'training', 'files.json'), '[]\n');
  await assert.rejects(
    () => publishTrainingFolder({ rootDirectory: directory, folderName: 'module f' }),
    /大小寫|Module F|exact case/i,
  );
  await Promise.all([
    publishTrainingFolder({ rootDirectory: directory, folderName: 'Module F' }),
    publishTrainingFolder({ rootDirectory: directory, folderName: 'Module G' }),
  ]);
  const manifest = JSON.parse(await readFile(path.join(directory, 'training', 'files.json'), 'utf8'));
  assert.ok(manifest.some(({ path: itemPath }) => itemPath === 'Module F/Module F.pdf'));
  assert.ok(manifest.some(({ path: itemPath }) => itemPath === 'Module G/Module G.pdf'));

  await mkdir(path.join(directory, 'train', '.git'));
  await assert.rejects(
    () => publishTrainingFolder({ rootDirectory: directory, folderName: '.git' }),
    /敏感|隱藏|不允許|sensitive/i,
  );
});
