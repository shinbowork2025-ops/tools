(() => {
  'use strict';
  const app = globalThis.WoodCutSession;
  if (!app) return;
  const { M, dom, state } = app;

  function renderTabs() {
    dom.tabs.innerHTML = '';
    state.sheets.forEach((sheet, index) => {
      const item = document.createElement('div');
      item.className = `sheet-tab-item${sheet.id === state.activeId ? ' active' : ''}`;
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'sheet-tab';
      tab.dataset.sheetId = sheet.id;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(sheet.id === state.activeId));
      tab.textContent = `${index + 1}. ${sheet.label}`;
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'sheet-tab-close';
      close.dataset.deleteSheetId = sheet.id;
      close.setAttribute('aria-label', `${sheet.label}を削除`);
      close.textContent = '×';
      item.append(tab, close);
      dom.tabs.append(item);
    });
    dom.clearAll.hidden = state.sheets.length === 0;
  }

  function renderMeta() {
    const sheet = app.activeSheet();
    if (!sheet) {
      dom.title.textContent = '材料なし';
      dom.meta.textContent = '';
      dom.empty.hidden = false;
      dom.svg.hidden = true;
      return;
    }
    dom.empty.hidden = true;
    dom.svg.hidden = false;
    dom.title.textContent = sheet.label;
    const thickness = sheet.thickness === '' ? '' : ` × 厚さ ${app.format(sheet.thickness)} mm`;
    dom.meta.textContent = `${app.format(sheet.width)} × ${app.format(sheet.height)} mm${thickness}${sheet.jan ? ` / JAN ${sheet.jan}` : ''}`;
  }

  function buildSvg(sheet) {
    const layout = M.layoutTree(sheet.root, sheet.width, sheet.height);
    const view = app.getView(sheet);
    const base = Math.max(sheet.width, sheet.height);
    const dimensionGap = Math.max(28, base * 0.035);
    const tick = Math.max(8, base * 0.009);
    const dimensionFont = Math.max(14, base * 0.018);
    const badgeRadius = Math.max(10, Math.min(sheet.width, sheet.height) * 0.018);
    let html = `<rect class="canvas-background" x="${view.x}" y="${view.y}" width="${view.width}" height="${view.height}"></rect>`;
    html += `<rect class="sheet-outline" x="0" y="0" width="${sheet.width}" height="${sheet.height}" rx="2"></rect>`;

    for (const leaf of layout.leaves) {
      const selected = leaf.nodeId === state.selectedPieceId ? ' selected' : '';
      const font = Math.max(8, Math.min(30, Math.min(leaf.width, leaf.height) * 0.13));
      const centerX = leaf.x + leaf.width / 2;
      const centerY = leaf.y + leaf.height / 2;
      const showSize = leaf.width > font * 3.8 && leaf.height > font * 2.4;
      html += `<g class="piece${selected}" data-piece-id="${leaf.nodeId}"><rect class="piece-rect" x="${leaf.x}" y="${leaf.y}" width="${leaf.width}" height="${leaf.height}"></rect><text class="piece-label" x="${centerX}" y="${showSize ? centerY - font * 0.15 : centerY}" font-size="${font}" dominant-baseline="central">${leaf.label}</text>${showSize ? `<text class="piece-size" x="${centerX}" y="${centerY + font * 0.78}" font-size="${Math.max(7, font * 0.58)}">${app.format(leaf.width)} × ${app.format(leaf.height)}</text>` : ''}</g>`;
    }

    for (const cut of layout.cuts) {
      const selected = cut.cutId === state.selectedCutId ? ' selected' : '';
      const centerX = cut.axis === 'x' ? cut.x + cut.kerf / 2 : cut.x + cut.width / 2;
      const centerY = cut.axis === 'x' ? cut.y + cut.height / 2 : cut.y + cut.kerf / 2;
      const bandWidth = cut.axis === 'x' ? Math.max(cut.kerf, 0.7) : cut.width;
      const bandHeight = cut.axis === 'y' ? Math.max(cut.kerf, 0.7) : cut.height;
      const bandX = cut.axis === 'x' ? cut.x + (cut.kerf - bandWidth) / 2 : cut.x;
      const bandY = cut.axis === 'y' ? cut.y + (cut.kerf - bandHeight) / 2 : cut.y;
      const line = cut.axis === 'x'
        ? `<line class="cut-center" x1="${centerX}" y1="${cut.y}" x2="${centerX}" y2="${cut.y + cut.height}"></line><line class="cut-hit" data-cut-id="${cut.cutId}" x1="${centerX}" y1="${cut.y}" x2="${centerX}" y2="${cut.y + cut.height}"></line>`
        : `<line class="cut-center" x1="${cut.x}" y1="${centerY}" x2="${cut.x + cut.width}" y2="${centerY}"></line><line class="cut-hit horizontal" data-cut-id="${cut.cutId}" x1="${cut.x}" y1="${centerY}" x2="${cut.x + cut.width}" y2="${centerY}"></line>`;
      const badgeX = cut.axis === 'x' ? centerX : cut.parentX + Math.min(Math.max(badgeRadius * 1.5, cut.parentWidth * 0.08), cut.parentWidth / 2);
      const badgeY = cut.axis === 'x' ? cut.parentY + Math.min(Math.max(badgeRadius * 1.5, cut.parentHeight * 0.08), cut.parentHeight / 2) : centerY;
      html += `<g class="cut-group${selected}"><rect class="cut-band" x="${bandX}" y="${bandY}" width="${bandWidth}" height="${bandHeight}"></rect>${line}<circle class="cut-number" cx="${badgeX}" cy="${badgeY}" r="${badgeRadius}"></circle><text class="cut-number-text" x="${badgeX}" y="${badgeY}" font-size="${badgeRadius * 1.05}">${cut.order}</text></g>`;
    }

    const widthY = -dimensionGap;
    const heightX = -dimensionGap;
    html += `<g class="overall-dimensions"><line class="dimension-line" x1="0" y1="${widthY}" x2="${sheet.width}" y2="${widthY}"></line><line class="dimension-tick" x1="0" y1="${widthY - tick}" x2="0" y2="${widthY + tick}"></line><line class="dimension-tick" x1="${sheet.width}" y1="${widthY - tick}" x2="${sheet.width}" y2="${widthY + tick}"></line><text class="dimension-text" x="${sheet.width / 2}" y="${widthY - tick * 0.75}" font-size="${dimensionFont}">${app.format(sheet.width)} mm</text><line class="dimension-line" x1="${heightX}" y1="0" x2="${heightX}" y2="${sheet.height}"></line><line class="dimension-tick" x1="${heightX - tick}" y1="0" x2="${heightX + tick}" y2="0"></line><line class="dimension-tick" x1="${heightX - tick}" y1="${sheet.height}" x2="${heightX + tick}" y2="${sheet.height}"></line><text class="dimension-text" x="${heightX}" y="${sheet.height / 2}" font-size="${dimensionFont}" transform="rotate(-90 ${heightX} ${sheet.height / 2})">${app.format(sheet.height)} mm</text></g>`;
    return { html, layout, viewBox: `${view.x} ${view.y} ${view.width} ${view.height}` };
  }

  function renderSvg() {
    const sheet = app.activeSheet();
    if (!sheet) {
      dom.svg.innerHTML = '';
      state.layout = { leaves: [], cuts: [] };
      return;
    }
    const built = buildSvg(sheet);
    dom.svg.setAttribute('viewBox', built.viewBox);
    dom.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    dom.svg.innerHTML = built.html;
    state.layout = built.layout;
  }

  app.selectedLeaf = () => state.layout.leaves.find(item => item.nodeId === state.selectedPieceId) || null;
  app.selectedCut = () => state.layout.cuts.find(item => item.cutId === state.selectedCutId) || null;
  app.suggestOffset = () => {
    const leaf = app.selectedLeaf();
    if (!leaf) return;
    const edge = document.querySelector('input[name="cutEdge"]:checked')?.value || 'left';
    const extent = edge === 'left' || edge === 'right' ? leaf.width : leaf.height;
    dom.offset.value = app.format(Math.max(0.1, (extent - (Number(dom.kerf.value) || 0)) / 2));
  };

  function renderSelection() {
    const sheet = app.activeSheet();
    const radios = [...document.querySelectorAll('input[name="cutEdge"]')];
    if (!sheet) {
      dom.selectionBadge.textContent = '材料なし';
      dom.selectionDetail.textContent = '材料を追加してください。';
      dom.apply.disabled = true;
      dom.deleteCut.disabled = true;
      radios.forEach(input => { input.disabled = true; });
      return;
    }
    const leaf = app.selectedLeaf();
    const cut = app.selectedCut();
    if (leaf) {
      dom.selectionBadge.textContent = `部材 ${leaf.label}`;
      dom.selectionDetail.textContent = `横 ${app.format(leaf.width)} mm × 縦 ${app.format(leaf.height)} mm`;
      radios.forEach(input => { input.disabled = false; });
      dom.apply.disabled = false;
      dom.apply.textContent = 'カットを追加';
      dom.deleteCut.disabled = true;
      if (!dom.offset.value) app.suggestOffset();
      return;
    }
    if (cut) {
      dom.selectionBadge.textContent = `カット ${cut.order}`;
      dom.selectionDetail.textContent = M.instructionText(cut);
      radios.forEach(input => { input.disabled = true; input.checked = input.value === cut.from; });
      dom.offset.value = app.format(cut.offset);
      dom.kerf.value = app.format(cut.kerf);
      dom.apply.disabled = false;
      dom.apply.textContent = '寸法を更新';
      dom.deleteCut.disabled = false;
      return;
    }
    dom.selectionBadge.textContent = '領域を選択';
    dom.selectionDetail.textContent = '図面内の領域をタップしてください。';
    radios.forEach(input => { input.disabled = false; });
    dom.apply.disabled = true;
    dom.apply.textContent = 'カットを追加';
    dom.deleteCut.disabled = true;
  }

  function renderResults() {
    const sheet = app.activeSheet();
    if (!sheet) {
      dom.cutCount.textContent = '0本';
      dom.pieceCount.textContent = '0枚';
      dom.instructions.innerHTML = '<li class="instruction-empty">材料がありません。</li>';
      dom.pieces.innerHTML = '';
      return;
    }
    const instructions = M.collectInstructions(sheet.root, sheet.width, sheet.height);
    dom.cutCount.textContent = `${instructions.length}本`;
    dom.pieceCount.textContent = `${state.layout.leaves.length}枚`;
    dom.instructions.innerHTML = instructions.length ? instructions.map(item => `<li data-cut-id="${item.cutId}" class="${item.cutId === state.selectedCutId ? 'selected' : ''}"><strong>${item.order}.</strong> ${app.escapeHtml(item.text)}${item.kerf ? `<br><small>刃厚 ${app.format(item.kerf)} mm</small>` : ''}</li>`).join('') : '<li class="instruction-empty">まだカット線がありません。</li>';
    dom.pieces.innerHTML = state.layout.leaves.map(leaf => `<tr data-piece-id="${leaf.nodeId}"><td>${leaf.label}</td><td>${app.format(leaf.width)} mm</td><td>${app.format(leaf.height)} mm</td></tr>`).join('');
  }

  app.renderAll = () => {
    renderTabs();
    renderMeta();
    renderSvg();
    renderSelection();
    renderResults();
    dom.undo.disabled = state.history.length === 0;
    dom.redo.disabled = state.future.length === 0;
  };
  app.renderSvg = renderSvg;
})();
