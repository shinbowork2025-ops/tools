/**
 * PWA版番号を一括更新する。
 * 使用例: node scripts/bump-version.mjs 1.0.1 "農薬データを更新"
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [version, note = '更新'] = process.argv.slice(2);

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version || '')) {
  console.error('版番号をSemantic Versioning形式で指定してください。例: 1.0.1');
  process.exit(1);
}

const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).format(new Date());
const serviceWorkerPath = join(root, 'service-worker.js');
const versionPath = join(root, 'version.json');
const changelogPath = join(root, 'CHANGELOG.md');

const serviceWorker = await readFile(serviceWorkerPath, 'utf8');
const updatedServiceWorker = serviceWorker.replace(
  /const APP_VERSION = '[^']+';/,
  `const APP_VERSION = '${version}';`
);
if (updatedServiceWorker === serviceWorker) {
  throw new Error('service-worker.jsのAPP_VERSIONを更新できませんでした。');
}
await writeFile(serviceWorkerPath, updatedServiceWorker, 'utf8');

const metadata = JSON.parse(await readFile(versionPath, 'utf8'));
metadata.version = version;
metadata.releasedAt = today;
metadata.notes = [note];
await writeFile(versionPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');

const changelog = await readFile(changelogPath, 'utf8');
const headingEnd = changelog.indexOf('\n', changelog.indexOf('\n') + 1);
const entry = `\n## ${version} — ${today}\n\n- ${note}\n\n`;
await writeFile(changelogPath, `${changelog.slice(0, headingEnd + 1)}${entry}${changelog.slice(headingEnd + 1)}`, 'utf8');

console.log(`PWA版番号を ${version} に更新しました。`);
console.log('公開前に node scripts/check-js.mjs を実行してください。');
