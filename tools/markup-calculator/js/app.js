/** 値入率計算機の画面制御。 */
(() => {
  'use strict';

  const display = document.getElementById('compositeInput');
  const resultPanel = document.getElementById('resultPanel');
  const resultAmount = document.getElementById('resultAmount');
  const inputSummary = document.getElementById('inputSummary');
  const resultDetail = document.getElementById('resultDetail');
  const keypad = document.getElementById('keypad');

  const integerFormatter = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 0 });
  const decimalFormatter = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 2 });
  const rateFormatter = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 4 });

  function setState(state, message) {
    resultPanel.dataset.state = state;
    resultAmount.textContent = '―';
    inputSummary.textContent = message;
    resultDetail.textContent = '例：500.3 → 仕入500円・値入率30%';
  }

  function render() {
    const result = globalThis.MarkupCalc.parseInput(display.value);
    if (result.status !== 'valid') {
      setState(result.status, result.message);
      return;
    }

    resultPanel.dataset.state = 'valid';
    resultAmount.textContent = integerFormatter.format(result.sellingPrice);
    inputSummary.textContent = `仕入 ${integerFormatter.format(result.cost)}円 / 値入率 ${rateFormatter.format(result.ratePercent)}%`;
    const rounded = result.sellingPrice !== result.rawPrice;
    resultDetail.textContent = rounded
      ? `計算値 ${decimalFormatter.format(result.rawPrice)}円を切り上げ（実際の値入率 ${rateFormatter.format(result.actualRate * 100)}%）`
      : `端数なし（実際の値入率 ${rateFormatter.format(result.actualRate * 100)}%）`;
  }

  function updateValue(nextValue) {
    display.value = nextValue;
    render();
  }

  function append(value) {
    const current = display.value;
    if (value === '.') {
      if (!current || current.includes('.')) return;
    }
    if (current.length + value.length > globalThis.MarkupCalc.MAX_INPUT_LENGTH) return;
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
      updateValue(display.value.slice(0, -1));
      return;
    }
    if (key === 'clear') updateValue('');
  }

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

  render();
})();
