(() => {
  'use strict';
  const M = globalThis.WoodCutModel;
  if (!M) return;
  const $ = id => document.getElementById(id);
  const app = {
    M,
    materials: Array.isArray(globalThis.WOOD_MATERIALS) ? globalThis.WOOD_MATERIALS : [],
    dom: {
      tabs: $('sheetTabs'), addOpen: $('showAddSheetButton'), clearAll: $('clearAllButton'), addPanel: $('addSheetPanel'), addClose: $('closeAddSheetButton'),
      filter: $('materialFilter'), material: $('materialSelect'), label: $('sheetLabelInput'), width: $('sheetWidthInput'), height: $('sheetHeightInput'), thickness: $('sheetThicknessInput'), add: $('addSheetButton'), note: $('materialNote'),
      selectionBadge: $('selectionBadge'), selectionDetail: $('selectionDetail'), offset: $('cutOffsetInput'), kerf: $('kerfInput'), apply: $('applyCutButton'), deleteCut: $('deleteCutButton'),
      undo: $('undoButton'), redo: $('redoButton'), fit: $('fitButton'), drawing: $('drawingColumn'), svg: $('cutSvg'), empty: $('drawingEmpty'), message: $('message'),
      title: $('activeSheetTitle'), meta: $('activeSheetMeta'), instructions: $('instructionList'), cutCount: $('cutCountBadge'), pieceCount: $('pieceCountBadge'), pieces: $('pieceTableBody')
    },
    state: { sheets: [], activeId: '', selectedPieceId: '', selectedCutId: '', history: [], future: [], views: new Map(), layout: { leaves: [], cuts: [] } }
  };

  app.activeSheet = () => app.state.sheets.find(sheet => sheet.id === app.state.activeId) || app.state.sheets[0] || null;
  app.format = value => M.formatMm(value);
  app.escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  app.fitView = sheet => {
    const base = Math.max(sheet.width, sheet.height);
    const margin = Math.max(60, base * 0.11);
    return { x: -margin, y: -margin, width: sheet.width + margin * 2, height: sheet.height + margin * 2 };
  };
  app.getView = sheet => {
    if (!app.state.views.has(sheet.id)) app.state.views.set(sheet.id, app.fitView(sheet));
    return app.state.views.get(sheet.id);
  };
  app.setMessage = (text = '', ok = false) => {
    app.dom.message.textContent = text;
    app.dom.message.style.color = ok ? '#17633a' : '';
  };
  app.snapshot = () => JSON.stringify({ sheets: app.state.sheets, activeId: app.state.activeId });
  app.restore = serialized => {
    const data = JSON.parse(serialized);
    app.state.sheets = data.sheets || [];
    app.state.activeId = data.activeId || app.state.sheets[0]?.id || '';
    app.state.selectedPieceId = '';
    app.state.selectedCutId = '';
    app.state.views.clear();
  };
  app.pushHistory = () => {
    app.state.history.push(app.snapshot());
    if (app.state.history.length > 60) app.state.history.shift();
    app.state.future = [];
  };
  app.commit = (mutator, keepSelection = false) => {
    app.pushHistory();
    mutator();
    if (!keepSelection) {
      app.state.selectedPieceId = '';
      app.state.selectedCutId = '';
    }
    app.renderAll();
  };
  app.populateMaterials = () => {
    const query = app.dom.filter.value.trim().toLowerCase();
    const current = app.dom.material.value;
    const filtered = app.materials.filter(item => !query || [item.jan, item.name, item.category, item.note].join(' ').toLowerCase().includes(query));
    app.dom.material.innerHTML = '<option value="">手入力</option>' + filtered.map(item => `<option value="${app.escapeHtml(item.id)}">${app.escapeHtml(item.jan ? `${item.jan} / ${item.name}` : item.name)}</option>`).join('');
    if (filtered.some(item => item.id === current)) app.dom.material.value = current;
  };
  app.fillMaterialForm = () => {
    const item = app.materials.find(material => material.id === app.dom.material.value);
    if (!item) {
      app.dom.note.textContent = '寸法を直接入力して追加できます。';
      return null;
    }
    app.dom.label.value = item.name;
    app.dom.width.value = item.width;
    app.dom.height.value = item.height;
    app.dom.thickness.value = item.thickness ?? '';
    app.dom.note.textContent = [item.category, item.note].filter(Boolean).join(' / ');
    return item;
  };
  globalThis.WoodCutSession = app;
})();
