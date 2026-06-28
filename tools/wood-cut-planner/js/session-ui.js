(() => {
  'use strict';
  const projectBar = document.querySelector('.project-bar');
  const newProject = document.getElementById('newProjectButton');
  if (newProject) {
    newProject.hidden = true;
    document.body.append(newProject);
  }
  projectBar?.remove();
  document.getElementById('saveState')?.remove();
  document.getElementById('printButton')?.remove();
  document.getElementById('resetSheetButton')?.remove();
  document.getElementById('deleteSheetButton')?.setAttribute('hidden', '');
  document.getElementById('printArea')?.remove();
  document.querySelector('.zoom-actions')?.remove();

  const subtitle = document.querySelector('.subtitle');
  if (subtitle) subtitle.textContent = '材料を選び、2D図の領域をタップして直線カットを追加します。作業内容はアプリを閉じるまで保持します。';

  const panel = document.getElementById('addSheetPanel');
  const select = document.getElementById('materialSelect');
  const add = document.getElementById('addSheetButton');
  const eyebrow = panel?.querySelector('.section-heading .eyebrow');
  const selectLabel = select?.closest('label')?.querySelector(':scope > span:first-child');
  if (eyebrow) eyebrow.textContent = '選択すると図面へ追加';
  if (selectLabel) selectLabel.textContent = '登録材料（選ぶと追加）';
  if (add) add.textContent = '手入力した材料を追加';

  const workspace = document.querySelector('.workspace');
  const drawing = document.querySelector('.drawing-column');
  const controls = document.querySelector('.control-panel');
  const results = document.querySelector('.result-panel');
  if (workspace && drawing && controls) {
    workspace.prepend(drawing);
    if (results) workspace.append(results);
  }

  const editPanel = document.getElementById('undoButton')?.closest('.panel');
  editPanel?.classList.add('edit-panel');
  const undo = document.getElementById('undoButton');
  const redo = document.getElementById('redoButton');
  if (undo) undo.textContent = '↶ UNDO';
  if (redo) redo.textContent = '↷ REDO';

  const help = document.querySelector('.help-list');
  if (help) help.innerHTML = '<li>材料を選ぶと、その材料を追加して2D図を表示します。</li><li>図面の領域をタップし、辺と寸法を入力します。</li><li>材料タブの×で、その材料を削除できます。</li><li>削除やカット操作はUNDO・REDOで戻せます。</li>';

  const style = document.createElement('style');
  style.textContent = '.sheet-tabs-wrap{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}.sheet-actions{display:flex;gap:6px;flex:0 0 auto}.sheet-tab-item{display:flex;align-items:stretch;flex:0 0 auto;border:1px solid var(--line);border-radius:9px;overflow:hidden;background:#fff}.sheet-tab-item.active{border-color:var(--accent);background:var(--accent-soft)}.sheet-tab-item .sheet-tab{border:0;border-radius:0;background:transparent;max-width:210px}.sheet-tab-item.active .sheet-tab{color:var(--accent-dark)}.sheet-tab-close{min-width:36px;padding:0;border:0;border-left:1px solid var(--line);border-radius:0;background:transparent;color:var(--danger);font-size:1.05rem}.workspace{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:10px;align-items:start}.drawing-column{grid-column:1;grid-row:1}.control-panel{grid-column:2;grid-row:1}.result-panel{grid-column:1/-1;grid-row:2;margin:0}.edit-panel .button-grid{grid-template-columns:repeat(3,1fr)}@media(max-width:980px){.workspace{grid-template-columns:1fr}.drawing-column,.control-panel,.result-panel{grid-column:1;grid-row:auto}.control-panel{grid-template-columns:1fr 1fr}.selection-panel{grid-row:span 2}.result-panel{margin:0}}@media(max-width:680px){.sheet-tabs-wrap{align-items:stretch}.sheet-actions{flex-direction:column}.control-panel{grid-template-columns:1fr}.selection-panel{grid-row:auto}.edit-panel .button-grid{grid-template-columns:repeat(3,1fr)}}@media(max-width:430px){.sheet-tabs-wrap{align-items:flex-start;flex-direction:column}.sheet-actions{width:100%;flex-direction:row}.sheet-actions button{flex:1}.edit-panel .button-grid{grid-template-columns:1fr}}';
  document.head.appendChild(style);
})();
