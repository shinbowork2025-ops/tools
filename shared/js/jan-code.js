(() => {
  'use strict';
  const SUPPORTED_LENGTHS = Object.freeze([8, 13]);
  function normalize(value) {
    return String(value ?? '').replace(/\D/g, '');
  }
  function hasSupportedLength(value) {
    return SUPPORTED_LENGTHS.includes(String(value ?? '').length);
  }
  function calculateCheckDigit(body) {
    const digits = String(body ?? '');
    if (!/^\d+$/.test(digits) || ![7, 12].includes(digits.length)) return null;
    const isEan13Body = digits.length === 12;
    let sum = 0;
    for (let index = 0; index < digits.length; index += 1) {
      const digit = Number(digits[index]);
      const weight = isEan13Body ? (index % 2 === 0 ? 1 : 3) : (index % 2 === 0 ? 3 : 1);
      sum += digit * weight;
    }
    return (10 - (sum % 10)) % 10;
  }
  function isValid(value) {
    const code = String(value ?? '');
    if (!/^\d+$/.test(code) || !hasSupportedLength(code)) return false;
    const expected = calculateCheckDigit(code.slice(0, -1));
    return expected !== null && expected === Number(code.at(-1));
  }
  globalThis.JanCode = Object.freeze({ SUPPORTED_LENGTHS, normalize, hasSupportedLength, calculateCheckDigit, isValid });
})();
