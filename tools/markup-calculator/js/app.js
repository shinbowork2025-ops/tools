/** 値入率計算機の画面制御。 */
(() => {
  'use strict';

  const costInput = document.getElementById('costInput');
  const rateInput = document.getElementById('rateInput');
  const resultPanel = document.getElementById('resultPanel');
  const resultAmount = document.getElementById('resultAmount');
  const inputSummary = document.getElementById('inputSummary');
  const resultDetail = document.getElementById('resultDetail');
  const keypad = document.getElementById('keypad');

  const integerFormatter = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 0 });
  const numberFormatter = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 2 });
  const rateFormatter = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 4 });

  let activeInput = costInput;

  function setActiveInput(input) {
    activeInput = input;
    [costInput, rateInput].forEach(element => {
      element.dataset.active = String(element === input);
    });
    input.focus({ preventScroll: true });
  }

  function setState(state, message) {
    resultPanel.dataset.state = state;
    resultAmount.textContent = '―';
    inputSummary.textContent = message;
    resultDetail.textContent = '例：仕入500円・値入率3% → 516円';
  }

  function render() {
    const result = globalThis.MarkupCalc.calculate(costInput.value, rateInput.value);
    if (result.status !== 'valid') {
      setState(result.status, result.message);
      return;
    }

    resultPanel.dataset.state = 'valid';
    resultAmount.textContent = integerFormatter.format(result.sellingPrice);
    inputSummary.textContent = `仕入 ${numberFormatter.format(result.cost)}円 / 値入率 ${numberFormatter.format(result.ratePercent)}%`;
    const rounded = result.sellingPrice !== result.rawPrice;
    resultDetail.textContent = rounded
      ? `計算値 ${numberFormatter.format(result.rawPrice)}円を切り上げ（実際の値入率 ${rateFormatter.format(result.actualRate * 100)}%）`
      : `端数なし（実際の値入率 ${rateFormatter.format(result.actualRate * 100)}%）`;
  }

  function updateValue(nextValue) {
    activeInput.value = nextValue;
    render();
  }

  function append(value) {
    let current = activeInput.value;
    const decimalIndex = current.indexOf('.');

    if (value === '.') {
      if (decimalIndex >= 0) return;
      if (!current) current = '0';
      updateValue(`${current}.`);
      return;
    }

    if (!/^\d{1,2}$/.test(value)) return;

    if (decimalIndex >= 0) {
      const decimalDigits = current.length - decimalIndex - 1;
      if (decimalDigits + value.length > globalThis.MarkupCalc.MAX_DECIMAL_DIGITS) return;
    } else {
      const integerDigits = current.replace(/^0+(?=\d)/, '').length;
      if (integerDigits + value.length > globalThis.MarkupCalc.MAX_INTEGER_DIGITS) return;
      if (current === '0') current = '';
    }

    updateValue(current + value);
  }

  function handleKey(key) {
    if (/^\d{1,2}$/.test(key)) {
      append(key);
      return;
    }
    if (key === '.') {
      append(key);
      return;
    }
    if (key === 'backspace') {
      updateValue(activeInput.value.slice(0, -1));
      return;
    }
    if (key === 'clear') updateValue('');
  }

  [costInput, rateInput].forEach(input => {
    input.addEventListener('pointerdown', () => setActiveInput(input));
    input.addEventListener('focus', () => setActiveInput(input));
  });

  keypad.addEventListener('click', event => {
    const button = event.target.closest('button[data-key]');
    if (!button) return;
    handleKey(button.dataset.key);
  });

  document.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (/^\d$/.test(event.key) || event.key === '.') {
      event.preventDefault();
      handleKey(event.key);
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      handleKey('backspace');
    } else if (event.key === 'Delete' || event.key === 'Escape') {
      event.preventDefault();
      handleKey('clear');
    }
  });

  setActiveInput(costInput);
  render();
})();
