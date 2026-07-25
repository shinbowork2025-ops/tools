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

function extractArrayPaths(source, variableName) {
  const block = source.match(new RegExp(`const\\s+${variableName}\\s*=\\s*\\[([\\s\\S]*?)\\];`))?.[1];
  if (!block) {
    errors.push(`service-worker.jsから${variableName}を取得できません`);
    return [];
  }
  return [...block.matchAll(/['"](\.\/[^'"]+)['"]/g)].map(match => match[1]);
}

function extractAssetGroups(source, variableName) {
  const objectBlock = source.match(
    new RegExp(`self\\.${variableName}\\s*=\\s*Object\\.freeze\\(\\{([\\s\\S]*?)\\}\\);`)
  )?.[1];

  if (!objectBlock) {
    errors.push(`sw-assets.jsから${variableName}を取得できません`);
    return new Map();
  }

  const groups = new Map();
  const pattern = /['"]([^'"]+)['"]\s*:\s*\[([\s\S]*?)\](?=\s*,|\s*$)/g;
  for (const match of objectBlock.matchAll(pattern)) {
    const paths = [...match[2].matchAll(/['"](\.\/[^'"]+)['"]/g)].map(item => item[1]);
    groups.set(match[1], paths);
  }

  if (!groups.size) errors.push(`sw-assets.jsの${variableName}に保存対象がありません`);
  return groups;
}

function reportDuplicates(label, assets, itemLabel = '保存対象') {
  const duplicates = assets.filter((asset, index) => assets.indexOf(asset) !== index);
  if (duplicates.length) {
    errors.push(`${label}の${itemLabel}が重複しています: ${[...new Set(duplicates)].join(', ')}`);
  }
}

const serviceWorker = read('service-worker.js');
const swAssets = read('sw-assets.js');
const version = serviceWorker.match(/const\s+APP_VERSION\s*=\s*['"]([^'"]+)['"]/)?.[1];
const metadata = JSON.parse(read('version.json'));

if (!version) errors.push('Service Workerの版番号を取得できません');
if (version && metadata.version !== version) {
  errors.push(`版番号が不一致です: service-worker=${version}, version.json=${metadata.version}`);
}

const coreAssets = extractArrayPaths(serviceWorker, 'CORE_ASSETS');
const toolGroups = extractAssetGroups(swAssets, 'KOMERI_TOOL_ASSETS');
const optionalGroups = extractAssetGroups(swAssets, 'KOMERI_OPTIONAL_ASSETS');

reportDuplicates('CORE_ASSETS', coreAssets);
for (const [groupId, assets] of toolGroups) reportDuplicates(`ツール ${groupId}`, assets);
for (const [groupId, assets] of optionalGroups) reportDuplicates(`追加データ ${groupId}`, assets);

const allAssets = [
  ...coreAssets,
  ...[...toolGroups.values()].flat(),
  ...[...optionalGroups.values()].flat()
];

for (const asset of new Set(allAssets)) {
  const clean = asset.replace(/^\.\//, '').replace(/[?#].*$/, '');
  if (!fs.existsSync(path.join(root, clean))) errors.push(`保存対象が存在しません: ${asset}`);
}

const topPage = read('index.html');
const pesticidePage = read('tools/pesticide-search/index.html');
const pesticideLoader = read('tools/pesticide-search/js/data-loader.js');
const pesticideScripts = [
  ...pesticidePage.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi),
  ...pesticideLoader.matchAll(/loadScript\(["']([^"']+)["']\)/g)
].map(match => match[1]);
reportDuplicates('農薬検索画面', pesticideScripts, 'スクリプト読み込み');

const cardToolIds = [
  ...topPage.matchAll(/href=["']tools\/([^/"']+)\/["']/g)
].map(match => match[1]);

for (const toolId of cardToolIds) {
  if (!toolGroups.has(toolId)) {
    errors.push(`トップ画面のツールがsw-assets.jsへ未登録です: ${toolId}`);
  }
}
for (const toolId of toolGroups.keys()) {
  if (!cardToolIds.includes(toolId)) {
    errors.push(`sw-assets.jsのツールにトップ画面カードがありません: ${toolId}`);
  }
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
console.log(`共通 ${coreAssets.length}件・ツール ${toolGroups.size}種 ${[...toolGroups.values()].flat().length}件・追加データ ${[...optionalGroups.values()].flat().length}件`);
console.log(`HTML ${htmlFiles.length}件・内部参照 ${references}件`);
