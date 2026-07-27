import { readFile } from 'node:fs/promises';
import { parseAnkiCsv } from '../tools/qualification-study/js/csv-import.js';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const sample = '\uFEFFFront,Back,Tags\r\n'
  + '"問1<br>A. 選択肢,補足<br>B. 選択肢<br>C. 選択肢","<b>正答：B</b><br>解説","資格A 元問題"\r\n'
  + '"問2\n改行を含む問題","正解：A","資格A 追加問題"\r\n';
const parsed = parseAnkiCsv(sample, 'fallback-name.csv');

assert(parsed.title === '資格A', 'Tagsの共通部分から資格名を推定できない');
assert(parsed.questions.length === 2, '引用符、カンマ、改行を含むCSVを解析できない');
assert(parsed.questions[0].answerKey === 'B', '正答記号を抽出できない');
assert(parsed.questions[0].choiceLabels.join('') === 'ABC', '選択肢記号を抽出できない');

const duplicate = parseAnkiCsv(
  'Front,Back,Tags\n同じ問題,正答：A,資格B\n同じ問題,正答：A,資格B',
  '資格B.csv'
);
assert(duplicate.questions.length === 1 && duplicate.duplicates === 1, '重複問題を除外できない');

const inputIndex = process.argv.indexOf('--input');
if (inputIndex >= 0) {
  const inputPath = process.argv[inputIndex + 1];
  if (!inputPath) throw new Error('--inputの後にCSVパスを指定してください');
  const real = parseAnkiCsv(await readFile(inputPath, 'utf8'), inputPath);
  console.log(`OK  実データ: ${real.title} ${real.questions.length}問（選択式 ${real.multipleChoiceCount}問）`);
}

console.log('OK  Anki CSVの引用符・カンマ・改行・BOMを解析');
console.log('OK  資格名、正答、選択肢、重複を判定');
