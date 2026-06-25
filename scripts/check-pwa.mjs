/**
 * PWA関連ファイルの整合性を検査する。
 * - service-worker.jsとversion.jsonの版番号一致
 * - precache対象の実在
 * - 全画面のmanifest・PWA登録処理の参照
 * - manifestのJSON構文と必須項目
 */
import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let failed = false;

function fail(message) {
  failed = true;
  console.error(`NG  ${message}`);
}

function ok(message) {
  console.log(`OK  ${message}`);
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function collectHtml(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === '.git') continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectHtml(path));
    else if (entry.isFile() && extname(entry.name) === '.html') files.push(path);
  }
  return files;
}

const metadata = JSON.parse(await readFile(join(root, 'version.json'), 'utf8'));
const serviceWorker = await readFile(join(root, 'service-worker.js'), 'utf8');
const versionMatch = serviceWorker.match(/const APP_VERSION = '([^']+)'/);

if (!versionMatch) fail('service-worker.jsからAPP_VERSIONを取得できません');
else if (versionMatch[1] !== metadata.version) {
  fail(`版番号が不一致です: service-worker.js=${versionMatch[1]}, version.json=${metadata.version}`);
} else ok(`版番号 ${metadata.version} が一致`);

const manifest = JSON.parse(await readFile(join(root, 'manifest.webmanifest'), 'utf8'));
for (const key of ['name', 'short_name', 'start_url', 'scope', 'display', 'icons']) {
  if (!manifest[key]) fail(`manifest.webmanifestに${key}がありません`);
}
if (Array.isArray(manifest.icons) && manifest.icons.some(icon => icon.purpose === 'maskable')) {
  ok('maskableアイコンを確認');
} else fail('maskableアイコンがありません');

const assetBlocks = [...serviceWorker.matchAll(/const (?:CORE_ASSETS|OPTIONAL_ASSETS) = \[([\s\S]*?)\];/g)];
const assetPaths = assetBlocks.flatMap(match => [...match[1].matchAll(/'([^']+)'/g)].map(item => item[1]));

for (const asset of assetPaths) {
  if (!asset.startsWith('./')) continue;
  const relative = asset.slice(2);
  let target = join(root, relative);
  if (!relative || relative.endsWith('/')) target = join(target, 'index.html');
  if (!await exists(target)) fail(`キャッシュ対象が存在しません: ${asset}`);
}
if (!failed) ok(`${assetPaths.length}件のキャッシュ対象を確認`);

const htmlFiles = await collectHtml(root);
for (const file of htmlFiles) {
  if (file.endsWith('offline.html')) continue;
  const html = await readFile(file, 'utf8');
  if (!html.includes('manifest.webmanifest')) fail(`manifest参照がありません: ${file.slice(root.length + 1)}`);
  if (!html.includes('pwa-client.js')) fail(`PWA登録処理がありません: ${file.slice(root.length + 1)}`);
}
if (!failed) ok(`${htmlFiles.length - 1}画面のPWA参照を確認`);

if (failed) process.exit(1);
console.log('\nPWA整合性検査が完了しました。');
