import assert from 'node:assert/strict';

await import('../tools/markup-calculator/js/calc.js');

const { MarkupCalc } = globalThis;
assert.ok(MarkupCalc, 'MarkupCalcが公開されていること');

const standard = MarkupCalc.parseInput('500.3');
assert.equal(standard.status, 'valid');
assert.equal(standard.cost, 500);
assert.equal(standard.rate, 0.3);
assert.equal(standard.sellingPrice, 715);
assert.ok(Math.abs(standard.rawPrice - 714.2857142857) < 1e-8);

assert.equal(MarkupCalc.parseInput('1000.25').sellingPrice, 1334);
assert.equal(MarkupCalc.parseInput('1000.0').sellingPrice, 1000);
assert.equal(MarkupCalc.parseInput('500').status, 'incomplete');
assert.equal(MarkupCalc.parseInput('500.').status, 'incomplete');
assert.equal(MarkupCalc.parseInput('.3').status, 'incomplete');
assert.equal(MarkupCalc.parseInput('0.3').status, 'invalid');
assert.equal(MarkupCalc.parseInput('500.100').sellingPrice, 556);
assert.equal(MarkupCalc.parseInput('500.9999999999999999').status, 'invalid');
assert.equal(MarkupCalc.parseInput('500.3.0').status, 'invalid');

console.log('値入率計算の入力解析・切り上げ検査に成功');
