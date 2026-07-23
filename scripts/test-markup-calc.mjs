import assert from 'node:assert/strict';

await import('../tools/markup-calculator/js/calc.js');

const { MarkupCalc } = globalThis;
assert.ok(MarkupCalc, 'MarkupCalcが公開されていること');

const standard = MarkupCalc.calculate('500', '3');
assert.equal(standard.status, 'valid');
assert.equal(standard.cost, 500);
assert.equal(standard.ratePercent, 3);
assert.equal(standard.rate, 0.03);
assert.equal(standard.sellingPrice, 516);
assert.ok(Math.abs(standard.rawPrice - 515.4639175258) < 1e-8);

const decimals = MarkupCalc.calculate('500.25', '3.25');
assert.equal(decimals.cost, 500.25);
assert.equal(decimals.ratePercent, 3.25);
assert.equal(decimals.sellingPrice, 518);

assert.equal(MarkupCalc.calculate('1000', '25').sellingPrice, 1334);
assert.equal(MarkupCalc.calculate('1000.', '25.').sellingPrice, 1334, '小数部未入力は0扱い');
assert.equal(MarkupCalc.calculate('500', '0').sellingPrice, 500);
assert.equal(MarkupCalc.calculate('', '').status, 'incomplete');
assert.equal(MarkupCalc.calculate('500', '').status, 'incomplete');
assert.equal(MarkupCalc.calculate('0', '3').status, 'invalid');
assert.equal(MarkupCalc.calculate('500.123', '3').status, 'invalid');
assert.equal(MarkupCalc.calculate('500', '3.256').status, 'invalid');
assert.equal(MarkupCalc.calculate('500', '100').status, 'invalid');

console.log('値入率計算の2入力・小数2桁・切り上げ検査に成功');
