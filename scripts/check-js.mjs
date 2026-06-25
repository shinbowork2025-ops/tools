/**
 * リポジトリ内のJavaScript・Node.jsスクリプトを node --check で一括検査する。
 * 外部パッケージは使用しない。
 */
import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

async function collectJavaScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectJavaScriptFiles(path));
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs'))) {
      files.push(path);
    }
  }
  return files;
}

const files = await collectJavaScriptFiles(root);
let failed = false;

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  const name = relative(root, file);
  if (result.status === 0) {
    console.log(`OK  ${name}`);
  } else {
    failed = true;
    console.error(`NG  ${name}`);
    console.error(result.stderr.trim());
  }
}

if (failed) process.exit(1);
console.log(`\n${files.length}ファイルの構文検査が完了しました。`);
