(() => {
  'use strict';
  const style = document.createElement('style');
  style.textContent = `
    .sheet-tabs-wrap{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}
    .sheet-actions{display:flex;gap:6px;flex:0 0 auto}
    .sheet-tab-item{display:flex;align-items:stretch;flex:0 0 auto;border:1px solid var(--line);border-radius:9px;overflow:hidden;background:#fff}
    .sheet-tab-item.active{border-color:var(--accent);background:var(--accent-soft)}
    .sheet-tab-item .sheet-tab{border:0;border-radius:0;background:transparent;max-width:210px}
    .sheet-tab-item.active .sheet-tab{color:var(--accent-dark)}
    .sheet-tab-close{min-width:36px;padding:0;border:0;border-left:1px solid var(--line);border-radius:0;background:transparent;color:var(--danger);font-size:1.05rem}
    .workspace{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:10px;align-items:start}
    .drawing-column{grid-column:1;grid-row:1}.control-panel{grid-column:2;grid-row:1}
    .result-panel{grid-column:1/-1;grid-row:2;margin:0}
    .edit-panel .button-grid{grid-template-columns:repeat(3,1fr)}
    @media(max-width:980px){.workspace{grid-template-columns:1fr}.drawing-column,.control-panel,.result-panel{grid-column:1;grid-row:auto}.control-panel{grid-template-columns:1fr 1fr}.selection-panel{grid-row:span 2}.result-panel{margin:0}}
    @media(max-width:680px){.sheet-tabs-wrap{align-items:stretch}.sheet-actions{flex-direction:column}.sheet-actions button{min-width:42px}.control-panel{grid-template-columns:1fr}.selection-panel{grid-row:auto}.edit-panel .button-grid{grid-template-columns:repeat(3,1fr)}}
    @media(max-width:430px){.sheet-tabs-wrap{align-items:flex-start;flex-direction:column}.sheet-actions{width:100%;flex-direction:row}.sheet-actions button{flex:1}.edit-panel .button-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
})();
