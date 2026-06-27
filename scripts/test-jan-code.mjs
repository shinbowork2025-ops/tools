import assert from 'node:assert/strict';

await import('../shared/js/jan-code.js');

const { JanCode } = globalThis;
assert.ok(JanCode, 'JanCodeが公開されていること');
assert.equal(JanCode.normalize('49 01234-567890'), '4901234567890');
assert.equal(JanCode.hasSupportedLength('4901234567894'), true);
assert.equal(JanCode.hasSupportedLength('1234567'), false);
assert.equal(JanCode.calculateCheckDigit('490123456789'), 4);
assert.equal(JanCode.calculateCheckDigit('9638507'), 4);
assert.equal(JanCode.isValid('4901234567894'), true);
assert.equal(JanCode.isValid('4901234567890'), false);
assert.equal(JanCode.isValid('96385074'), true);
assert.equal(JanCode.isValid('96385075'), false);
assert.equal(JanCode.isValid('49012345-67894'), false);

console.log('JAN共通処理: 10件の検査に成功');
