(() => {
  'use strict';

  const summaryEl = document.getElementById('summary');
  const groupsEl = document.getElementById('groups');

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[ch]));
  }

  async function load() {
    const response = await fetch('./screenshots.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('screenshots.json を読み込めません');
    return response.json();
  }

  function groupByTool(pages) {
    const map = new Map();
    for (const page of pages) {
      const bucket = map.get(page.tool) || [];
      bucket.push(page);
      map.set(page.tool, bucket);
    }
    return [...map.entries()];
  }

  function renderSummary(config) {
    const shotCount = config.pages.reduce((sum, page) => sum + (page.shots?.length || 0), 0);
    summaryEl.innerHTML = `
      <div class="summary-card"><strong>${config.pages.length}</strong><span>ページ</span></div>
      <div class="summary-card"><strong>${shotCount}</strong><span>撮影カット</span></div>
      <div class="summary-card"><strong>${config.viewport.width}×${config.viewport.height}</strong><span>ビューポート</span></div>
    `;
  }

  function renderGroups(config) {
    const groups = groupByTool(config.pages);
    groupsEl.innerHTML = groups.map(([tool, pages]) => `
      <section class="tool-section">
        <header class="tool-header">
          <h2>${escapeHtml(tool)}</h2>
          <p>${pages.length}ページ / ${pages.reduce((sum, page) => sum + (page.shots?.length || 0), 0)}カット</p>
        </header>
        <div class="card-grid">
          ${pages.map(page => (page.shots || []).map(shot => `
            <article class="shot-card">
              <div class="meta-row">
                <span class="tag">${escapeHtml(page.category || '')}</span>
                <code>${escapeHtml(shot.name)}.png</code>
              </div>
              <h3>${escapeHtml(shot.title)}</h3>
              <p class="description">${escapeHtml(shot.description || '')}</p>
              <dl class="meta-list">
                <div><dt>対象URL</dt><dd>${escapeHtml(page.path)}</dd></div>
                <div><dt>切り出し</dt><dd>${shot.selector ? escapeHtml(shot.selector) : '全画面'}</dd></div>
                <div><dt>強調数</dt><dd>${Array.isArray(shot.highlights) ? shot.highlights.length : 0}</dd></div>
              </dl>
              <ol class="steps">
                ${(shot.instructions || []).map(step => `<li>${escapeHtml(step)}</li>`).join('')}
              </ol>
            </article>
          `).join('')).join('')}
        </div>
      </section>
    `).join('');
  }

  load().then(config => {
    renderSummary(config);
    renderGroups(config);
  }).catch(error => {
    summaryEl.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
  });
})();
