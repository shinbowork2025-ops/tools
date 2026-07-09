/**
 * 発注数計算ツールv2の画面制御。
 *
 * 計算はOrderCalc(純関数)、永続化はOrderDb(IndexedDB)へ委譲し、
 * このファイルは入力の検証・画面切替・表示だけを担当する。
 * 業務数値は端末内にのみ保存し、外部送信は行わない。
 */
(() => {
  'use strict';

  const calc = globalThis.OrderCalc;
  const db = globalThis.OrderDb;
  const janCode = globalThis.JanCode;
  const $ = id => document.getElementById(id);

  const CLASSIFICATION_LABELS = Object.freeze({
    auto: '自動相当',
    check: '要確認',
    stop: '発注不要',
    lowRotation: '低回転',
    newItem: '新商品'
  });

  let settings = { ...calc.DEFAULT_SETTINGS };
  let lastResult = null;
  let lastContext = null;
  let recordFilter = 'all';

  // ---------- 汎用 ----------

  function parseNumber(raw, { label, required = false, min = 0, max = Infinity, integer = true } = {}) {
    const text = String(raw ?? '').trim().replace(/[,，]/g, '');
    if (!text) {
      if (required) throw new Error(`${label}を入力してください`);
      return null;
    }
    const value = Number(text);
    if (!Number.isFinite(value)) throw new Error(`${label}が数値ではありません`);
    if (integer && !Number.isInteger(value)) throw new Error(`${label}は整数で入力してください`);
    if (value < min || value > max) throw new Error(`${label}は${min}〜${max === Infinity ? '' : max}の範囲で入力してください`);
    return value;
  }

  function fmt(value, digits = 2) {
    if (!Number.isFinite(value)) return '―';
    return Number.isInteger(value) ? String(value) : value.toFixed(digits);
  }

  function setMessage(element, text, ok = false) {
    element.textContent = text;
    element.classList.toggle('ok', ok);
  }

  function downloadFile(name, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  // ---------- タブ ----------

  const tabs = [
    { button: $('tabCalc'), view: $('calcView') },
    { button: $('tabRecords'), view: $('recordsView') },
    { button: $('tabSettings'), view: $('settingsView') }
  ];

  function selectTab(selected) {
    tabs.forEach(({ button, view }) => {
      const active = button === selected;
      button.setAttribute('aria-selected', String(active));
      view.classList.toggle('is-active', active);
      view.hidden = !active;
    });
    if (selected === $('tabRecords')) renderRecords();
  }

  tabs.forEach(({ button }) => button.addEventListener('click', () => selectTab(button)));

  // ---------- 設定 ----------

  function fillSettingsForm() {
    $('setMargin').value = settings.grossMarginPct;
    $('setLeadTime').value = settings.leadTimeDays;
    $('setReview').value = settings.reviewPeriodDays;
    $('setOverageLow').value = settings.overageCostPresets.low;
    $('setOverageMid').value = settings.overageCostPresets.mid;
    $('setOverageHigh').value = settings.overageCostPresets.high;
    $('setCvLow').value = settings.variabilityPresets.low;
    $('setCvMid').value = settings.variabilityPresets.mid;
    $('setCvHigh').value = settings.variabilityPresets.high;
    $('setWarnMin').value = settings.shrinkageWarnRange.min;
    $('setWarnMax').value = settings.shrinkageWarnRange.max;
  }

  function collectSettingsForm() {
    const decimal = { integer: false };
    const margin = parseNumber($('setMargin').value, { ...decimal, label: '名目粗利率', required: true, min: 1, max: 99 });
    const leadTime = parseNumber($('setLeadTime').value, { label: 'リードタイム', required: true, min: 0, max: 365 });
    const review = parseNumber($('setReview').value, { label: '発注間隔', required: true, min: 1, max: 365 });

    const overage = {
      low: parseNumber($('setOverageLow').value, { ...decimal, label: '過剰コスト率:低', required: true, min: 0.1, max: 1000 }),
      mid: parseNumber($('setOverageMid').value, { ...decimal, label: '過剰コスト率:中', required: true, min: 0.1, max: 1000 }),
      high: parseNumber($('setOverageHigh').value, { ...decimal, label: '過剰コスト率:高', required: true, min: 0.1, max: 1000 })
    };
    const variability = {
      low: parseNumber($('setCvLow').value, { ...decimal, label: '変動係数:小', required: true, min: 0.01, max: 10 }),
      mid: parseNumber($('setCvMid').value, { ...decimal, label: '変動係数:中', required: true, min: 0.01, max: 10 }),
      high: parseNumber($('setCvHigh').value, { ...decimal, label: '変動係数:大', required: true, min: 0.01, max: 10 })
    };
    const warnMin = parseNumber($('setWarnMin').value, { ...decimal, label: '前年比 警告下限', required: true, min: 0.01, max: 100 });
    const warnMax = parseNumber($('setWarnMax').value, { ...decimal, label: '前年比 警告上限', required: true, min: 0.01, max: 100 });
    if (warnMax <= warnMin) throw new Error('前年比の警告上限は下限より大きくしてください');

    return {
      grossMarginPct: margin,
      overageCostPresets: overage,
      variabilityPresets: variability,
      shrinkageWarnRange: { min: warnMin, max: warnMax },
      leadTimeDays: leadTime,
      reviewPeriodDays: review
    };
  }

  $('saveSettingsButton').addEventListener('click', async () => {
    try {
      settings = collectSettingsForm();
      await db.saveSettings(settings);
      setMessage($('settingsMessage'), '設定を保存しました', true);
    } catch (error) {
      setMessage($('settingsMessage'), error.message);
    }
  });

  $('resetSettingsButton').addEventListener('click', () => {
    settings = JSON.parse(JSON.stringify(calc.DEFAULT_SETTINGS));
    fillSettingsForm();
    setMessage($('settingsMessage'), '既定値を表示中です。「設定を保存」で確定します', true);
  });

  // ---------- 商品 ----------

  function normalizedJan() {
    return janCode.normalize($('janInput').value);
  }

  function fillItemForm(item) {
    $('itemName').value = item.name || '';
    $('riskClass').value = item.riskClass || 'standard';
    $('variability').value = item.variability || 'mid';
    $('orderUnit').value = item.orderUnit ?? 1;
    $('minDisplay').value = item.minDisplay ?? 0;
    $('trackedFlag').checked = item.tracked !== false;
  }

  function collectItemForm(jan) {
    return {
      jan,
      name: $('itemName').value.trim(),
      riskClass: $('riskClass').value,
      variability: $('variability').value,
      orderUnit: parseNumber($('orderUnit').value, { label: '入数', required: true, min: 1, max: 10000 }),
      minDisplay: parseNumber($('minDisplay').value, { label: '最低陳列数', required: true, min: 0, max: 10000 }),
      tracked: $('trackedFlag').checked
    };
  }

  async function loadItem(jan) {
    if (!janCode.isValid(jan)) {
      $('janStatus').textContent = 'JANの桁数またはチェックデジットが正しくありません。';
      return;
    }
    try {
      const item = await db.getItem(jan);
      if (item) {
        fillItemForm(item);
        $('janStatus').textContent = `登録済み商品を読み込みました${item.name ? `：${item.name}` : ''}`;
      } else {
        $('janStatus').textContent = '未登録のJANです。商品設定を入力してください(記録時に保存されます)。';
      }
    } catch (error) {
      $('janStatus').textContent = `商品を読み込めません：${error.message}`;
    }
  }

  $('janInput').addEventListener('change', () => {
    const jan = normalizedJan();
    if (jan) loadItem(jan);
  });

  globalThis.OrderJanScanner?.init({
    startButton: $('scanButton'),
    status: message => { $('janStatus').textContent = message; },
    onScan: jan => {
      $('janInput').value = jan;
      loadItem(jan);
    }
  });

  // ---------- 計算 ----------

  $('newItemMode').addEventListener('change', () => {
    const isNewItem = $('newItemMode').checked;
    $('normalInputs').hidden = isNewItem;
    $('newItemInputs').hidden = !isNewItem;
    $('resultPanel').hidden = true;
    setMessage($('calcMessage'), '');
  });

  function parseSimilarSales() {
    const text = $('similarSales').value.trim();
    if (!text) throw new Error('類似商品の販売数を入力してください');
    const values = text.split(/[,、\s]+/).filter(Boolean).map(part => {
      const value = Number(part);
      if (!Number.isFinite(value) || value < 0) throw new Error(`「${part}」を数値として読めません`);
      return value;
    });
    if (values.length > 10) throw new Error('類似商品は最大10件までです');
    return values;
  }

  function collectNormalInputs() {
    return {
      lastYearPast6w: parseNumber($('lastYearPast6w').value, { label: '前年 過去6週販売数', required: true, max: 100000 }),
      lastYearNext4w: parseNumber($('lastYearNext4w').value, { label: '前年 今後4週販売数', required: true, max: 100000 }),
      thisYearPast6w: parseNumber($('thisYearPast6w').value, { label: '今年 過去6週販売数', required: true, max: 100000 }),
      stockOnHand: parseNumber($('stockOnHand').value, { label: '現在庫', required: true, max: 100000 }),
      onOrder: parseNumber($('onOrder').value, { label: '発注残', max: 100000 }),
      oosDaysPast6w: parseNumber($('oosDays').value, { label: '欠品日数', required: true, max: calc.HISTORY_DAYS }) ?? 0,
      saleFlag: $('saleFlag').checked,
      motherOrderQty: parseNumber($('motherOrderQty').value, { label: 'マザー発注数', max: 100000 }) ?? 0
    };
  }

  function detailPairs(result, isNewItem) {
    const detail = result.detail;
    if (isNewItem) {
      return [
        ['サンプル数 n', fmt(detail.sampleSize, 0)],
        ['目標分位点CR', fmt(detail.cr)],
        ['安全係数z', fmt(detail.z)],
        ['CR分位点', fmt(detail.quantileValue)],
        ['陳列数とのmax', fmt(detail.candidate)]
      ].filter(([, value]) => value !== '―');
    }
    return [
      ['補正前6週販売', fmt(detail.rawSales6w)],
      ['補正後6週販売', fmt(detail.correctedSales6w)],
      ['週販', fmt(detail.weeklySales)],
      ['補正係数r', fmt(detail.ratio)],
      ['目標分位点CR', fmt(detail.cr)],
      ['安全係数z', fmt(detail.z)],
      ['保護期間需要', fmt(detail.protectionDemand)],
      ['安全在庫', fmt(detail.safetyStock)],
      ['丸め前', fmt(detail.rawQuantity)]
    ].filter(([, value]) => value !== '―');
  }

  function renderResult(result, isNewItem) {
    $('resultQty').textContent = Number.isFinite(result.quantity) ? String(result.quantity) : '―';
    const badge = $('resultBadge');
    badge.textContent = CLASSIFICATION_LABELS[result.classification] || result.classification;
    badge.className = `badge ${result.classification}`;

    const diffBadge = $('motherDiffBadge');
    if (Number.isFinite(result.motherDiff)) {
      diffBadge.hidden = false;
      diffBadge.textContent = `マザー比 ${result.motherDiff >= 0 ? '+' : ''}${result.motherDiff}`;
    } else {
      diffBadge.hidden = true;
    }

    const reasons = $('resultReasons');
    reasons.innerHTML = '';
    (result.reasons || []).forEach(reason => {
      const li = document.createElement('li');
      li.textContent = reason;
      reasons.appendChild(li);
    });
    if (result.referenceOnly) {
      const li = document.createElement('li');
      li.textContent = '推奨数は参考値です';
      reasons.appendChild(li);
    }

    const details = $('resultDetails');
    details.innerHTML = '';
    detailPairs(result, isNewItem).forEach(([term, value]) => {
      const wrap = document.createElement('div');
      const dt = document.createElement('dt');
      dt.textContent = term;
      const dd = document.createElement('dd');
      dd.textContent = value;
      wrap.append(dt, dd);
      details.appendChild(wrap);
    });

    $('myFinalQty').value = Number.isFinite(result.quantity) ? String(result.quantity) : '';
    setMessage($('recordMessage'), '');
    $('resultPanel').hidden = false;
  }

  $('calcButton').addEventListener('click', () => {
    setMessage($('calcMessage'), '');
    try {
      const isNewItem = $('newItemMode').checked;
      const jan = normalizedJan();
      const item = collectItemForm(jan);

      if (isNewItem) {
        const similarSales = parseSimilarSales();
        const result = calc.evaluateNewItem({
          similarSales,
          minDisplay: item.minDisplay,
          orderUnit: item.orderUnit,
          riskClass: item.riskClass
        }, settings);
        const mother = parseNumber($('motherOrderQtyNew').value, { label: 'マザー発注数', max: 100000 }) ?? 0;
        result.motherDiff = Number.isFinite(result.quantity) ? result.quantity - mother : null;
        lastResult = result;
        lastContext = { mode: 'newItem', item, similarSales, motherOrderQty: mother };
        renderResult(result, true);
      } else {
        const inputs = collectNormalInputs();
        const result = calc.evaluate(inputs, item, settings);
        lastResult = result;
        lastContext = { mode: 'normal', item, inputs };
        renderResult(result, false);
      }
    } catch (error) {
      $('resultPanel').hidden = true;
      lastResult = null;
      lastContext = null;
      setMessage($('calcMessage'), error.message);
    }
  });

  $('clearButton').addEventListener('click', () => {
    ['lastYearPast6w', 'lastYearNext4w', 'thisYearPast6w', 'stockOnHand', 'onOrder',
      'motherOrderQty', 'motherOrderQtyNew', 'similarSales', 'myFinalQty', 'recordNote'].forEach(id => { $(id).value = ''; });
    $('oosDays').value = '0';
    $('saleFlag').checked = false;
    $('resultPanel').hidden = true;
    setMessage($('calcMessage'), '');
  });

  // ---------- 記録 ----------

  $('recordButton').addEventListener('click', async () => {
    try {
      if (!lastResult || !lastContext) throw new Error('先に計算してください');
      const jan = normalizedJan();
      if (!janCode.isValid(jan)) throw new Error('記録にはJANコードが必要です(8桁/13桁)');
      const myFinalQty = parseNumber($('myFinalQty').value, { label: '自分の最終発注数', required: true, max: 100000 });

      const item = { ...collectItemForm(jan), createdAt: new Date().toISOString() };
      const existing = await db.getItem(jan);
      if (existing?.createdAt) item.createdAt = existing.createdAt;
      await db.putItem(item);

      const isNewItem = lastContext.mode === 'newItem';
      const inputs = isNewItem
        ? {
          lastYearPast6w: 0, lastYearNext4w: 0, thisYearPast6w: 0,
          stockOnHand: 0, onOrder: 0, oosDaysPast6w: 0, saleFlag: false
        }
        : { ...lastContext.inputs, onOrder: lastContext.inputs.onOrder ?? 0 };
      const noteInput = $('recordNote').value.trim();
      const note = isNewItem
        ? [`類似28日販売数: ${lastContext.similarSales.join(' ')}`, noteInput].filter(Boolean).join(' / ')
        : noteInput;

      await db.addRecord({
        jan,
        week: calc.isoWeekKey(),
        createdAt: new Date().toISOString(),
        inputs,
        motherOrderQty: isNewItem ? lastContext.motherOrderQty : lastContext.inputs.motherOrderQty,
        toolRecommendedQty: Number.isFinite(lastResult.quantity) ? lastResult.quantity : null,
        myFinalQty,
        classification: lastResult.classification,
        reasons: lastResult.reasons || [],
        actualSalesNext4w: null,
        note
      });
      setMessage($('recordMessage'), `記録しました(${calc.isoWeekKey()})`, true);
    } catch (error) {
      setMessage($('recordMessage'), error.message);
    }
  });

  // ---------- 記録一覧・精度比較 ----------

  $('filterAll').addEventListener('click', () => { recordFilter = 'all'; renderRecords(); });
  $('filterPending').addEventListener('click', () => { recordFilter = 'pending'; renderRecords(); });

  function appendStat(container, term, value) {
    const wrap = document.createElement('div');
    const dt = document.createElement('dt');
    dt.textContent = term;
    const dd = document.createElement('dd');
    dd.textContent = value;
    wrap.append(dt, dd);
    container.appendChild(wrap);
  }

  function renderAccuracy(records) {
    const stats = $('accuracyStats');
    stats.innerHTML = '';
    const scored = records
      .map(record => ({ record, errors: calc.recordErrors(record) }))
      .filter(entry => entry.errors);

    if (!scored.length) {
      appendStat(stats, '実績入力済み', '0件');
      return;
    }

    const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
    const tool = scored.filter(entry => entry.errors.toolError !== null);

    appendStat(stats, '実績入力済み', `${scored.length}件`);
    appendStat(stats, 'ナイーブ平均誤差', fmt(mean(scored.map(entry => entry.errors.naiveError))));
    appendStat(stats, 'マザー平均誤差', fmt(mean(scored.map(entry => entry.errors.motherError))));
    if (tool.length) {
      appendStat(stats, '新方式平均誤差', fmt(mean(tool.map(entry => entry.errors.toolError))));
      const beatNaive = tool.filter(entry => entry.errors.toolError < entry.errors.naiveError).length;
      const beatMother = tool.filter(entry => entry.errors.toolError < entry.errors.motherError).length;
      appendStat(stats, 'ナイーブに勝った週', `${Math.round(beatNaive / tool.length * 100)}%`);
      appendStat(stats, 'マザーに勝った週', `${Math.round(beatMother / tool.length * 100)}%`);
    }
  }

  async function renderRecords() {
    const list = $('recordList');
    try {
      const [records, items] = await Promise.all([db.getAllRecords(), db.getAllItems()]);
      const names = new Map(items.map(item => [item.jan, item.name]));
      records.sort((left, right) => right.id - left.id);
      renderAccuracy(records);

      const visible = recordFilter === 'pending'
        ? records.filter(record => record.actualSalesNext4w === null || record.actualSalesNext4w === undefined)
        : records;
      $('filterAll').classList.toggle('primary', recordFilter === 'all');
      $('filterPending').classList.toggle('primary', recordFilter === 'pending');
      $('recordsStatus').textContent = recordFilter === 'pending'
        ? `実績入力待ち ${visible.length}件(約4週間後の実績販売数を追記してください)`
        : `全${visible.length}件`;

      list.innerHTML = '';
      visible.forEach(record => list.appendChild(buildRecordCard(record, names)));
    } catch (error) {
      list.innerHTML = '';
      $('recordsStatus').textContent = `記録を読み込めません：${error.message}`;
    }
  }

  function buildRecordCard(record, names) {
    const card = document.createElement('div');
    card.className = 'record-card';

    const head = document.createElement('div');
    head.className = 'head';
    const title = document.createElement('strong');
    title.textContent = `${record.week} ${names.get(record.jan) || ''}`.trim();
    const janSpan = document.createElement('span');
    janSpan.textContent = record.jan;
    const badge = document.createElement('span');
    badge.className = `badge ${record.classification}`;
    badge.textContent = CLASSIFICATION_LABELS[record.classification] || record.classification;
    head.append(title, janSpan, badge);
    card.appendChild(head);

    const numItem = (label, value) => {
      const span = document.createElement('span');
      const bold = document.createElement('b');
      bold.textContent = value;
      span.append(`${label} `, bold);
      return span;
    };

    const nums = document.createElement('div');
    nums.className = 'nums';
    nums.append(
      numItem('マザー', fmt(record.motherOrderQty, 0)),
      numItem('新方式', record.toolRecommendedQty === null ? '―' : fmt(record.toolRecommendedQty, 0)),
      numItem('最終判断', fmt(record.myFinalQty, 0)),
      numItem('実績4週', Number.isFinite(record.actualSalesNext4w) ? fmt(record.actualSalesNext4w, 0) : '未入力')
    );
    card.appendChild(nums);

    const errors = calc.recordErrors(record);
    if (errors) {
      const errorLine = document.createElement('div');
      errorLine.className = 'nums';
      errorLine.append(
        numItem('誤差:ナイーブ', fmt(errors.naiveError)),
        numItem('誤差:マザー', fmt(errors.motherError)),
        numItem('誤差:新方式', errors.toolError === null ? '―' : fmt(errors.toolError))
      );
      card.appendChild(errorLine);
    }

    if (record.note) {
      const note = document.createElement('p');
      note.className = 'note';
      note.textContent = record.note;
      card.appendChild(note);
    }

    const actualRow = document.createElement('div');
    actualRow.className = 'actual-row';
    const actualInput = document.createElement('input');
    actualInput.type = 'text';
    actualInput.inputMode = 'numeric';
    actualInput.placeholder = 'その後4週の実績販売数';
    if (Number.isFinite(record.actualSalesNext4w)) actualInput.value = record.actualSalesNext4w;
    const saveButton = document.createElement('button');
    saveButton.type = 'button';
    saveButton.className = 'action';
    saveButton.textContent = '実績を保存';
    saveButton.addEventListener('click', async () => {
      try {
        const actual = parseNumber(actualInput.value, { label: '実績販売数', required: true, max: 100000 });
        await db.putRecord({ ...record, actualSalesNext4w: actual });
        renderRecords();
      } catch (error) {
        $('recordsStatus').textContent = error.message;
      }
    });
    actualRow.append(actualInput, saveButton);
    card.appendChild(actualRow);

    return card;
  }

  // ---------- エクスポート・インポート・全削除 ----------

  const EXPORT_WARNING = 'エクスポートには販売実績等の業務データが含まれます。取り扱いに注意してください。続行しますか?';

  function timestampName(base, extension) {
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    return `${base}-${stamp}.${extension}`;
  }

  $('exportJsonButton').addEventListener('click', async () => {
    if (!confirm(EXPORT_WARNING)) return;
    try {
      const data = await db.exportAll();
      downloadFile(timestampName('order-calculator-export', 'json'), JSON.stringify(data, null, 2), 'application/json');
      setMessage($('dataMessage'), 'JSONをエクスポートしました', true);
    } catch (error) {
      setMessage($('dataMessage'), error.message);
    }
  });

  function csvEscape(value) {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  $('exportCsvButton').addEventListener('click', async () => {
    if (!confirm(EXPORT_WARNING)) return;
    try {
      const [records, items] = await Promise.all([db.getAllRecords(), db.getAllItems()]);
      const names = new Map(items.map(item => [item.jan, item.name]));
      // 粗利率(名目値)はCSVへ含めない。
      const header = ['id', 'week', 'jan', 'name', 'lastYearPast6w', 'lastYearNext4w', 'thisYearPast6w',
        'stockOnHand', 'onOrder', 'oosDaysPast6w', 'saleFlag', 'motherOrderQty', 'toolRecommendedQty',
        'myFinalQty', 'classification', 'reasons', 'actualSalesNext4w', 'note'];
      const rows = records.map(record => [
        record.id, record.week, record.jan, names.get(record.jan) || '',
        record.inputs.lastYearPast6w, record.inputs.lastYearNext4w, record.inputs.thisYearPast6w,
        record.inputs.stockOnHand, record.inputs.onOrder, record.inputs.oosDaysPast6w,
        record.inputs.saleFlag ? 1 : 0, record.motherOrderQty, record.toolRecommendedQty ?? '',
        record.myFinalQty, record.classification, (record.reasons || []).join(';'),
        record.actualSalesNext4w ?? '', record.note || ''
      ].map(csvEscape).join(','));
      const csv = `${'\ufeff'}${header.join(',')}\n${rows.join('\n')}\n`;
      downloadFile(timestampName('order-calculator-records', 'csv'), csv, 'text/csv');
      setMessage($('dataMessage'), 'CSVをエクスポートしました', true);
    } catch (error) {
      setMessage($('dataMessage'), error.message);
    }
  });

  $('importButton').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', async () => {
    const file = $('importFile').files[0];
    $('importFile').value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const counts = await db.importAll(data);
      if (data.settings) {
        settings = {
          ...calc.DEFAULT_SETTINGS,
          ...data.settings,
          overageCostPresets: { ...calc.DEFAULT_SETTINGS.overageCostPresets, ...(data.settings.overageCostPresets || {}) },
          variabilityPresets: { ...calc.DEFAULT_SETTINGS.variabilityPresets, ...(data.settings.variabilityPresets || {}) },
          shrinkageWarnRange: { ...calc.DEFAULT_SETTINGS.shrinkageWarnRange, ...(data.settings.shrinkageWarnRange || {}) }
        };
        fillSettingsForm();
      }
      setMessage($('dataMessage'), `取り込みました(商品${counts.items}件・記録${counts.records}件)`, true);
    } catch (error) {
      setMessage($('dataMessage'), `取り込みに失敗しました：${error.message}`);
    }
  });

  $('clearAllButton').addEventListener('click', async () => {
    if (!confirm('端末内の設定・商品・記録をすべて削除します。元に戻せません。よろしいですか?')) return;
    try {
      await db.clearAll();
      settings = JSON.parse(JSON.stringify(calc.DEFAULT_SETTINGS));
      fillSettingsForm();
      setMessage($('dataMessage'), '全データを削除しました', true);
    } catch (error) {
      setMessage($('dataMessage'), error.message);
    }
  });

  // ---------- 起動 ----------

  (async () => {
    try {
      const saved = await db.getSettings();
      if (saved) {
        settings = {
          ...calc.DEFAULT_SETTINGS,
          ...saved,
          overageCostPresets: { ...calc.DEFAULT_SETTINGS.overageCostPresets, ...(saved.overageCostPresets || {}) },
          variabilityPresets: { ...calc.DEFAULT_SETTINGS.variabilityPresets, ...(saved.variabilityPresets || {}) },
          shrinkageWarnRange: { ...calc.DEFAULT_SETTINGS.shrinkageWarnRange, ...(saved.shrinkageWarnRange || {}) }
        };
      }
    } catch (error) {
      setMessage($('calcMessage'), `端末内保存を利用できません(${error.message})。計算のみ使用できます`);
    }
    fillSettingsForm();
  })();
})();
