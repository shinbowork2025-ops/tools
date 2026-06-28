(() => {
  'use strict';

  const STORAGE_KEY = 'komeriToolFavoritesV1';
  const grid = document.querySelector('.tool-grid');
  if (!grid || grid.dataset.favoritesReady === '1') return;
  grid.dataset.favoritesReady = '1';

  const style = document.createElement('style');
  style.textContent = `.tool-card-shell{position:relative;min-width:0;border:1px solid var(--line);border-radius:14px;background:var(--surface);box-shadow:0 2px 8px rgba(23,32,42,.05);overflow:hidden}.tool-card-shell:hover{border-color:#9bb7cf}.tool-card-link{display:block;height:100%;padding:16px 52px 16px 16px;color:inherit;text-decoration:none}.tool-card-link:focus-visible{outline:3px solid rgba(31,95,149,.25);outline-offset:-3px}.tool-card-shell h2{margin:5px 0 7px;font-size:1.05rem}.tool-card-shell p{margin:0;color:var(--muted);font-size:.82rem;line-height:1.55}.favorite-button{position:absolute;top:9px;right:9px;display:grid;place-items:center;width:38px;height:38px;padding:0;border:1px solid transparent;border-radius:50%;background:transparent;color:#677582;font:inherit;font-size:1.55rem;line-height:1;cursor:pointer}.favorite-button:hover{border-color:#c4d1db;background:#f3f7fa}.favorite-button[aria-pressed="true"]{color:#9a6500;background:#fff7d8}.favorite-button:focus-visible{outline:3px solid rgba(31,95,149,.25);outline-offset:1px}.pwa-panel.is-standalone{grid-template-columns:1fr auto;gap:10px 14px;margin:18px 0 0;padding:13px 16px}.pwa-panel.is-standalone>div:first-child{display:none}.pwa-panel.is-standalone .pwa-actions{grid-column:1;grid-row:1;justify-content:flex-start}.pwa-panel.is-standalone .pwa-actions[hidden]{display:none}.pwa-panel.is-standalone .pwa-actions button{background:#fff;color:#194f88}.pwa-panel.is-standalone .pwa-version{grid-column:2;grid-row:1;margin:0;white-space:nowrap}.pwa-panel.is-standalone .pwa-status{display:none}@media(max-width:620px){.pwa-panel.is-standalone{grid-template-columns:1fr}.pwa-panel.is-standalone .pwa-actions,.pwa-panel.is-standalone .pwa-version{grid-column:1;grid-row:auto}.pwa-panel.is-standalone .pwa-version{text-align:right}}`;
  document.head.appendChild(style);

  const originalLinks = [...grid.querySelectorAll(':scope > a.tool-card')];
  const cards = originalLinks.map((link, index) => {
    const path = new URL(link.getAttribute('href'), document.baseURI).pathname.replace(/\/$/, '');
    const id = path.split('/').pop() || `tool-${index + 1}`;
    const title = link.querySelector('h2')?.textContent?.replace('（試作版）', '') || 'ツール';
    const shell = document.createElement('article');
    shell.className = 'tool-card-shell';
    shell.dataset.toolId = id;
    shell.dataset.defaultOrder = String(index);

    link.before(shell);
    link.classList.remove('tool-card');
    link.classList.add('tool-card-link');

    const button = document.createElement('button');
    button.className = 'favorite-button';
    button.type = 'button';
    button.setAttribute('aria-pressed', 'false');
    button.dataset.title = title;
    button.innerHTML = '<span aria-hidden="true">☆</span>';

    shell.append(link, button);
    return shell;
  });

  if (!cards.length) return;
  const cardById = new Map(cards.map(card => [card.dataset.toolId, card]));

  function loadFavorites() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return new Set(Array.isArray(stored) ? stored.filter(id => cardById.has(id)) : []);
    } catch {
      return new Set();
    }
  }

  const favorites = loadFavorites();

  function saveFavorites() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...favorites]));
    } catch {
      // 保存できない環境でも、現在の画面内では並び替えを維持する。
    }
  }

  function updateButton(card) {
    const button = card.querySelector('.favorite-button');
    const active = favorites.has(card.dataset.toolId);
    button.setAttribute('aria-pressed', String(active));
    button.setAttribute('aria-label', `${button.dataset.title}をお気に入り${active ? 'から解除' : 'に追加'}`);
    button.querySelector('[aria-hidden="true"]').textContent = active ? '★' : '☆';
  }

  function reorderCards() {
    cards
      .slice()
      .sort((left, right) => {
        const favoriteDifference = Number(favorites.has(right.dataset.toolId)) - Number(favorites.has(left.dataset.toolId));
        if (favoriteDifference) return favoriteDifference;
        return Number(left.dataset.defaultOrder) - Number(right.dataset.defaultOrder);
      })
      .forEach(card => grid.append(card));
  }

  cards.forEach(card => {
    updateButton(card);
    card.querySelector('.favorite-button').addEventListener('click', () => {
      const id = card.dataset.toolId;
      if (favorites.has(id)) favorites.delete(id);
      else favorites.add(id);
      saveFavorites();
      updateButton(card);
      reorderCards();
    });
  });

  reorderCards();
})();
