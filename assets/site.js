(() => {
  'use strict';

  const STORAGE_KEY = 'komeriToolFavoritesV1';
  const grid = document.querySelector('.tool-grid');
  if (!grid || grid.dataset.favoritesReady === '1') return;
  grid.dataset.favoritesReady = '1';

  const style = document.createElement('style');
  style.textContent = `
    .tool-card-shell{position:relative;display:flex;min-width:0;flex-direction:column;border:1px solid var(--line);border-radius:14px;background:var(--surface);box-shadow:0 2px 8px rgba(23,32,42,.05);overflow:hidden;content-visibility:auto;contain-intrinsic-size:180px}
    .tool-card-shell:hover{border-color:#9bb7cf}
    .tool-card-shell[data-offline="saved"]{border-color:#9fc5ad}
    .tool-card-link{display:block;flex:1;padding:16px 52px 12px 16px;color:inherit;text-decoration:none}
    .tool-card-link:focus-visible{outline:3px solid rgba(31,95,149,.25);outline-offset:-3px}
    .tool-card-shell h2{margin:5px 0 7px;font-size:1.05rem}
    .tool-card-shell p{margin:0;color:var(--muted);font-size:.82rem;line-height:1.55}
    .favorite-button{position:absolute;top:9px;right:9px;display:grid;place-items:center;width:38px;height:38px;padding:0;border:1px solid transparent;border-radius:50%;background:transparent;color:#677582;font:inherit;font-size:1.55rem;line-height:1;cursor:pointer}
    .favorite-button:hover{border-color:#c4d1db;background:#f3f7fa}
    .favorite-button[aria-pressed="true"]{color:#9a6500;background:#fff7d8}
    .favorite-button:focus-visible{outline:3px solid rgba(31,95,149,.25);outline-offset:1px}
    .tool-offline-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 12px 12px 16px}
    .tool-offline-status{min-width:0;color:#6b7781;font-size:.68rem;line-height:1.35}
    .tool-offline-button{flex:none;min-height:36px;padding:6px 10px;border:1px solid #b9ccdc;border-radius:8px;background:#f7fbff;color:#194f88;font:inherit;font-size:.72rem;font-weight:700;cursor:pointer}
    .tool-offline-button:hover:not(:disabled){background:#eaf4fb}
    .tool-offline-button:disabled{cursor:default;opacity:.72}
    .tool-offline-button:focus-visible{outline:3px solid rgba(31,95,149,.25);outline-offset:2px}
    .tool-card-shell[data-offline="saved"] .tool-offline-button{border-color:#a7c9b3;background:#eef8f1;color:#176137}
    .tool-card-shell[data-offline="error"] .tool-offline-status{color:#a43a32}
    .pwa-panel.is-standalone{grid-template-columns:1fr auto;gap:10px 14px;margin:18px 0 0;padding:13px 16px}
    .pwa-panel.is-standalone>div:first-child{display:none}
    .pwa-panel.is-standalone .pwa-actions{grid-column:1;grid-row:1;justify-content:flex-start}
    .pwa-panel.is-standalone .pwa-actions[hidden]{display:none}
    .pwa-panel.is-standalone .pwa-actions button{background:#fff;color:#194f88}
    .pwa-panel.is-standalone .pwa-version{grid-column:2;grid-row:1;margin:0;white-space:nowrap}
    .pwa-panel.is-standalone .pwa-status{display:none}
    @media(max-width:620px){
      .pwa-panel.is-standalone{grid-template-columns:1fr}
      .pwa-panel.is-standalone .pwa-actions,.pwa-panel.is-standalone .pwa-version{grid-column:1;grid-row:auto}
      .pwa-panel.is-standalone .pwa-version{text-align:right}
    }
  `;
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
    shell.dataset.offline = 'checking';

    link.before(shell);
    link.classList.remove('tool-card');
    link.classList.add('tool-card-link');

    const favoriteButton = document.createElement('button');
    favoriteButton.className = 'favorite-button';
    favoriteButton.type = 'button';
    favoriteButton.setAttribute('aria-pressed', 'false');
    favoriteButton.dataset.title = title;
    favoriteButton.innerHTML = '<span aria-hidden="true">☆</span>';

    const offlineRow = document.createElement('div');
    offlineRow.className = 'tool-offline-row';

    const offlineStatus = document.createElement('span');
    offlineStatus.className = 'tool-offline-status';
    offlineStatus.id = `offlineStatus-${id}`;
    offlineStatus.textContent = '保存状態を確認中';

    const offlineButton = document.createElement('button');
    offlineButton.className = 'tool-offline-button';
    offlineButton.type = 'button';
    offlineButton.textContent = 'オフライン保存';
    offlineButton.setAttribute('aria-describedby', offlineStatus.id);
    offlineButton.setAttribute('aria-label', `${title}をオフライン用に保存`);

    offlineRow.append(offlineStatus, offlineButton);
    shell.append(link, favoriteButton, offlineRow);
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

  function updateFavoriteButton(card) {
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

  function setOfflineState(card, state, statusText, buttonText, disabled) {
    const button = card.querySelector('.tool-offline-button');
    const status = card.querySelector('.tool-offline-status');
    card.dataset.offline = state;
    status.textContent = statusText;
    button.textContent = buttonText;
    button.disabled = disabled;
  }

  async function refreshOfflineState(card) {
    if (!('serviceWorker' in navigator) || !globalThis.KomeriPwa) {
      setOfflineState(card, 'error', 'このブラウザでは利用不可', '保存不可', true);
      return;
    }

    try {
      const result = await globalThis.KomeriPwa.getToolCacheStatus(card.dataset.toolId);
      if (result.complete) {
        setOfflineState(card, 'saved', `${result.total}ファイル保存済み`, '保存済み', true);
      } else if (result.cached > 0) {
        setOfflineState(card, 'unsaved', `${result.cached}/${result.total}ファイル`, '保存を再開', false);
      } else {
        setOfflineState(card, 'unsaved', '未保存', 'オフライン保存', false);
      }
    } catch (error) {
      setOfflineState(card, 'error', error.message, '再確認', false);
    }
  }

  async function saveToolOffline(card) {
    const button = card.querySelector('.tool-offline-button');
    const status = card.querySelector('.tool-offline-status');
    button.disabled = true;
    button.textContent = '保存中…';
    card.dataset.offline = 'saving';
    status.textContent = '通信を切らずにお待ちください';

    try {
      const result = await globalThis.KomeriPwa.cacheTool(card.dataset.toolId, message => {
        if (message.type !== 'TOOL_CACHE_PROGRESS') return;
        button.textContent = `保存中 ${message.completed}/${message.total}`;
        status.textContent = `${message.completed}/${message.total}ファイル`;
      });
      setOfflineState(card, 'saved', `${result.total}ファイル保存済み`, '保存済み', true);
    } catch (error) {
      setOfflineState(card, 'error', `保存失敗：${error.message}`, '再試行', false);
    }
  }

  cards.forEach(card => {
    updateFavoriteButton(card);

    card.querySelector('.favorite-button').addEventListener('click', () => {
      const id = card.dataset.toolId;
      if (favorites.has(id)) favorites.delete(id);
      else favorites.add(id);
      saveFavorites();
      updateFavoriteButton(card);
      reorderCards();
    });

    card.querySelector('.tool-offline-button').addEventListener('click', () => {
      if (card.dataset.offline === 'error' && !navigator.onLine) {
        card.querySelector('.tool-offline-status').textContent = 'オンライン時に保存してください';
        return;
      }
      saveToolOffline(card);
    });
  });

  reorderCards();

  Promise.all(cards.map(refreshOfflineState)).catch(() => {});
  document.addEventListener('komeri-pwa-worker-ready', () => {
    Promise.all(cards.map(refreshOfflineState)).catch(() => {});
  });
  window.addEventListener('online', () => {
    cards.filter(card => card.dataset.offline !== 'saved').forEach(refreshOfflineState);
  });
})();
