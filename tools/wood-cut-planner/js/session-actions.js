(() => {
  'use strict';
  const app = globalThis.WoodCutSession;
  if (!app?.renderAll) return;
  const { M, dom, state } = app;

  function addSheet() {
    const width = Number(dom.width.value);
    const height = Number(dom.height.value);
    const thickness = dom.thickness.value === '' ? '' : Number(dom.thickness.value);
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return app.setMessage('材料の横寸法と縦寸法を入力してください。');
    if (thickness !== '' && (!Number.isFinite(thickness) || thickness < 0)) return app.setMessage('厚さを確認してください。');
    const source = app.materials.find(material => material.id === dom.material.value) || {};
    const sheet = M.createSheet({ ...source, label: dom.label.value.trim() || source.name || '材料', name: source.name || dom.label.value.trim() || '手入力材料', width, height, thickness });
    app.commit(() => {
      state.sheets.push(sheet);
      state.activeId = sheet.id;
      state.views.set(sheet.id, app.fitView(sheet));
    });
    dom.addPanel.hidden = true;
    app.setMessage(`${sheet.label}を追加しました。図面の領域を選択してください。`, true);
    requestAnimationFrame(() => dom.drawing.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function deleteSheet(id) {
    const sheet = state.sheets.find(item => item.id === id);
    if (!sheet) return;
    app.commit(() => {
      const index = state.sheets.findIndex(item => item.id === id);
      state.sheets.splice(index, 1);
      state.views.delete(id);
      if (state.activeId === id) state.activeId = state.sheets[Math.min(index, state.sheets.length - 1)]?.id || '';
    });
    if (!state.sheets.length) dom.addPanel.hidden = false;
    app.setMessage(`${sheet.label}を削除しました。UNDOで戻せます。`, true);
  }

  function clearAll() {
    if (!state.sheets.length || !confirm('現在の材料とカットをすべて消しますか？')) return;
    app.commit(() => {
      state.sheets = [];
      state.activeId = '';
      state.views.clear();
    });
    dom.addPanel.hidden = false;
    app.setMessage('作業内容をすべて消しました。UNDOで戻せます。', true);
  }

  function selectPiece(id) {
    state.selectedPieceId = id;
    state.selectedCutId = '';
    dom.offset.value = '';
    app.renderAll();
    app.suggestOffset();
    app.setMessage('');
  }

  function selectCut(id) {
    state.selectedCutId = id;
    state.selectedPieceId = '';
    app.renderAll();
    app.setMessage('');
  }

  function applyCut() {
    const sheet = app.activeSheet();
    if (!sheet) return;
    const offset = Number(dom.offset.value);
    const kerf = Number(dom.kerf.value);
    if (!Number.isFinite(offset) || offset <= 0) return app.setMessage('残す寸法を0より大きい数値で入力してください。');
    if (!Number.isFinite(kerf) || kerf < 0) return app.setMessage('刃厚は0以上で入力してください。');

    if (state.selectedCutId) {
      const result = M.updateCut(sheet.root, state.selectedCutId, { offset, kerf });
      const check = M.validateTree(result.root, sheet.width, sheet.height, 5);
      if (!result.ok || !check.ok) return app.setMessage(result.error || check.error);
      const cutId = state.selectedCutId;
      app.commit(() => { sheet.root = result.root; }, true);
      state.selectedCutId = cutId;
      app.renderAll();
      return app.setMessage('カット寸法を更新しました。', true);
    }

    if (!state.selectedPieceId) return app.setMessage('カットする領域を選択してください。');
    const from = document.querySelector('input[name="cutEdge"]:checked')?.value || 'left';
    const result = M.applyCut(sheet.root, state.selectedPieceId, { from, offset, kerf, order: M.maxOrder(sheet.root) + 1 });
    const check = M.validateTree(result.root, sheet.width, sheet.height, 5);
    if (!result.ok || !check.ok) return app.setMessage(result.error || check.error);
    app.commit(() => { sheet.root = result.root; }, true);
    state.selectedPieceId = '';
    state.selectedCutId = result.cutId;
    app.renderAll();
    app.setMessage('カット線を追加しました。', true);
  }

  function deleteSelectedCut() {
    const sheet = app.activeSheet();
    if (!sheet || !state.selectedCutId) return;
    const result = M.removeCut(sheet.root, state.selectedCutId);
    if (!result.ok) return app.setMessage(result.error);
    app.commit(() => { sheet.root = result.root; });
    app.setMessage('選択したカット線を削除しました。', true);
  }

  function undo() {
    if (!state.history.length) return;
    state.future.push(app.snapshot());
    app.restore(state.history.pop());
    app.renderAll();
    app.setMessage('一つ前の状態に戻しました。', true);
  }

  function redo() {
    if (!state.future.length) return;
    state.history.push(app.snapshot());
    app.restore(state.future.pop());
    app.renderAll();
    app.setMessage('操作をやり直しました。', true);
  }

  dom.tabs.addEventListener('click', event => {
    const close = event.target.closest('[data-delete-sheet-id]');
    if (close) return deleteSheet(close.dataset.deleteSheetId);
    const tab = event.target.closest('[data-sheet-id]');
    if (!tab) return;
    state.activeId = tab.dataset.sheetId;
    state.selectedPieceId = '';
    state.selectedCutId = '';
    app.renderAll();
  });
  dom.addOpen.addEventListener('click', () => { dom.addPanel.hidden = false; dom.filter.focus(); });
  dom.addClose.addEventListener('click', () => { dom.addPanel.hidden = true; });
  dom.clearAll.addEventListener('click', clearAll);
  dom.filter.addEventListener('input', app.populateMaterials);
  dom.material.addEventListener('change', () => { const item = app.fillMaterialForm(); if (item) addSheet(); });
  dom.add.addEventListener('click', addSheet);
  document.querySelectorAll('input[name="cutEdge"]').forEach(input => input.addEventListener('change', app.suggestOffset));
  dom.apply.addEventListener('click', applyCut);
  dom.deleteCut.addEventListener('click', deleteSelectedCut);
  dom.undo.addEventListener('click', undo);
  dom.redo.addEventListener('click', redo);
  dom.fit.addEventListener('click', () => {
    const sheet = app.activeSheet();
    if (!sheet) return;
    state.views.set(sheet.id, app.fitView(sheet));
    app.renderSvg();
  });
  dom.instructions.addEventListener('click', event => { const item = event.target.closest('[data-cut-id]'); if (item) selectCut(item.dataset.cutId); });
  dom.pieces.addEventListener('click', event => { const row = event.target.closest('[data-piece-id]'); if (row) selectPiece(row.dataset.pieceId); });
  dom.svg.addEventListener('click', event => {
    const cut = event.target.closest?.('[data-cut-id]');
    if (cut) return selectCut(cut.dataset.cutId);
    const piece = event.target.closest?.('[data-piece-id]');
    if (piece) return selectPiece(piece.dataset.pieceId);
    if (event.target.classList.contains('canvas-background')) {
      state.selectedPieceId = '';
      state.selectedCutId = '';
      app.renderAll();
    }
  });

  app.populateMaterials();
  app.fillMaterialForm();
  dom.addPanel.hidden = false;
  app.renderAll();
})();
