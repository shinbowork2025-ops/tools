import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function walk(directory, predicate = () => true) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute, predicate));
    else if (predicate(absolute)) files.push(absolute);
  }
  return files;
}

function relative(absolute) {
  return path.relative(root, absolute).split(path.sep).join('/');
}

function extractAssetPaths(source, variableName) {
  const block = source.match(new RegExp(`const\\s+${variableName}\\s*=\\s*\\[([\\s\\S]*?)\\];`))?.[1];
  if (!block) {
    errors.push(`service-worker.jsから${variableName}を取得できません`);
    return [];
  }
  return [...block.matchAll(/['"]([^'"]+)['"]/g)].map(match => match[1]);
}

const serviceWorker = read('service-worker.js');
const version = serviceWorker.match(/const\s+APP_VERSION\s*=\s*['"]([^'"]+)['"]/)?.[1];
const metadata = JSON.parse(read('version.json'));
if (!version) errors.push('Service Workerの版番号を取得できません');
if (version && metadata.version !== version) {
  errors.push(`版番号が不一致です: service-worker=${version}, version.json=${metadata.version}`);
}

const coreAssets = extractAssetPaths(serviceWorker, 'CORE_ASSETS');
const optionalAssets = extractAssetPaths(serviceWorker, 'OPTIONAL_ASSETS');
const assets = [...coreAssets, ...optionalAssets];
const duplicates = assets.filter((asset, index) => assets.indexOf(asset) !== index);
if (duplicates.length) errors.push(`キャッシュ対象が重複しています: ${[...new Set(duplicates)].join(', ')}`);

for (const asset of assets) {
  const clean = asset.replace(/^\.\//, '').replace(/[?#].*$/, '');
  if (!fs.existsSync(path.join(root, clean))) errors.push(`キャッシュ対象が存在しません: ${asset}`);
}

const htmlFiles = walk(root, file => file.endsWith('.html'));
let references = 0;
for (const htmlFile of htmlFiles) {
  const source = fs.readFileSync(htmlFile, 'utf8');
  const pattern = /<(?:script|link|a)\b[^>]*?\b(?:src|href)=["']([^"']+)["']/gi;
  for (const match of source.matchAll(pattern)) {
    const reference = match[1];
    if (/^(?:https?:|data:|mailto:|tel:|javascript:|#)/i.test(reference)) continue;
    references += 1;
    const target = path.resolve(path.dirname(htmlFile), reference.replace(/[?#].*$/, ''));
    if (!target.startsWith(root)) errors.push(`${relative(htmlFile)}が公開ルート外を参照しています: ${reference}`);
    else if (!fs.existsSync(target)) errors.push(`${relative(htmlFile)}の参照先が存在しません: ${reference}`);
  }
}

if (errors.length) {
  console.error('静的アプリ検査で問題を検出しました。');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`静的アプリ検査に成功（版 ${version}）`);
console.log(`キャッシュ対象 ${assets.length}件`);
console.log(`HTML ${htmlFiles.length}件・内部参照 ${references}件`);
