/** JANスキャンの複数フレーム一致判定を検査する。 */
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(join(root, 'tools/jan-scanner/js/scan-consensus.js'), 'utf8');
const context = vm.createContext({ globalThis: {} });
vm.runInContext(source, context);
const ScanConsensus = context.globalThis.JanScanConsensus;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const stable = new ScanConsensus({ requiredHits: 5, maxGapMs: 700, minDurationMs: 600, windowMs: 1800 });
const times = [0, 180, 360, 540, 720];
const stableResults = times.map(time => stable.observe('4901234567894', time));
assert(stableResults.slice(0, 4).every(result => !result.confirmed), '4回以下で確定している');
assert(stableResults[4].confirmed, '5回一致しても確定しない');

const noise = new ScanConsensus({ requiredHits: 5, maxGapMs: 700, minDurationMs: 600, windowMs: 1800 });
noise.observe('4901234567894', 0);
noise.observe('4901234567894', 180);
const changed = noise.observe('4901234567887', 360);
assert(changed.hits === 1 && !changed.confirmed, '異なるJANで連続回数がリセットされない');

const gap = new ScanConsensus({ requiredHits: 5, maxGapMs: 700, minDurationMs: 600, windowMs: 1800 });
gap.observe('4901234567894', 0);
const afterGap = gap.observe('4901234567894', 900);
assert(afterGap.hits === 1 && !afterGap.confirmed, '長い空白後に連続回数がリセットされない');

console.log('OK  安定した5回一致だけを確定');
console.log('OK  異なるJANと長い空白で判定をリセット');
