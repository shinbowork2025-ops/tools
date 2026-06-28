import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const rootDir = process.cwd();
const configPath = process.env.SCREENSHOT_CONFIG || path.join(rootDir, 'manual', 'screenshots.json');
const outputDir = process.env.SCREENSHOT_OUTPUT || path.join(rootDir, 'manual', 'output');
const config = JSON.parse(await readFile(configPath, 'utf8'));

await mkdir(outputDir, { recursive: true });

function createContextOptions(viewport) {
  return {
    viewport: {
      width: viewport?.width ?? 412,
      height: viewport?.height ?? 915
    },
    deviceScaleFactor: viewport?.deviceScaleFactor ?? 1,
    colorScheme: 'light',
    locale: 'ja-JP',
    reducedMotion: 'reduce'
  };
}

async function applyStorage(page, storage) {
  if (!storage) return;
  await page.addInitScript(value => {
    const localEntries = Object.entries(value?.local ?? {});
    const sessionEntries = Object.entries(value?.session ?? {});

    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}

    for (const [key, raw] of localEntries) {
      const payload = typeof raw === 'string' ? raw : JSON.stringify(raw);
      localStorage.setItem(key, payload);
    }
    for (const [key, raw] of sessionEntries) {
      const payload = typeof raw === 'string' ? raw : JSON.stringify(raw);
      sessionStorage.setItem(key, payload);
    }
  }, storage);
}

async function performAction(page, action) {
  const timeout = Number(action.timeout ?? 10_000);
  if (action.type === 'click') {
    await page.locator(action.selector).first().click({ timeout });
    return;
  }
  if (action.type === 'fill') {
    await page.locator(action.selector).first().fill(String(action.value ?? ''), { timeout });
    return;
  }
  if (action.type === 'press') {
    await page.locator(action.selector).first().press(String(action.key ?? 'Enter'), { timeout });
    return;
  }
  if (action.type === 'select') {
    await page.locator(action.selector).first().selectOption(String(action.value ?? ''), { timeout });
    return;
  }
  if (action.type === 'check') {
    await page.locator(action.selector).first().setChecked(Boolean(action.value ?? true), { timeout });
    return;
  }
  if (action.type === 'wait') {
    await page.waitForTimeout(Number(action.ms ?? 300));
    return;
  }
  if (action.type === 'waitFor') {
    await page.locator(action.selector).first().waitFor({ state: action.state ?? 'visible', timeout });
    return;
  }
  if (action.type === 'evaluate') {
    await page.evaluate(action.script);
    return;
  }
  throw new Error(`未対応の操作種別です: ${action.type}`);
}

async function performActions(page, actions = []) {
  for (const action of actions) {
    await performAction(page, action);
  }
}

async function clearHighlights(page) {
  await page.evaluate(() => {
    document.getElementById('manualShotOverlay')?.remove();
  });
}

async function applyHighlights(page, highlights = []) {
  if (!highlights.length) return;
  await clearHighlights(page);
  await page.evaluate(items => {
    const overlay = document.createElement('div');
    overlay.id = 'manualShotOverlay';
    overlay.style.position = 'absolute';
    overlay.style.left = '0';
    overlay.style.top = '0';
    overlay.style.width = `${Math.max(document.documentElement.scrollWidth, window.innerWidth)}px`;
    overlay.style.height = `${Math.max(document.documentElement.scrollHeight, window.innerHeight)}px`;
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '2147483647';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.appendChild(overlay);

    items.forEach((item, index) => {
      const target = document.querySelector(item.selector);
      if (!target) return;
      const rect = target.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const left = rect.left + window.scrollX;
      const top = rect.top + window.scrollY;
      const border = document.createElement('div');
      border.style.position = 'absolute';
      border.style.left = `${left - 4}px`;
      border.style.top = `${top - 4}px`;
      border.style.width = `${rect.width + 8}px`;
      border.style.height = `${rect.height + 8}px`;
      border.style.border = '3px solid #d43f1a';
      border.style.borderRadius = item.radius ? `${item.radius}px` : '14px';
      border.style.boxSizing = 'border-box';
      border.style.boxShadow = '0 0 0 9999px rgba(212, 63, 26, 0.08)';
      overlay.appendChild(border);

      const labelValue = item.label || String(index + 1);
      const badge = document.createElement('div');
      badge.textContent = labelValue;
      badge.style.position = 'absolute';
      badge.style.left = `${Math.max(8, left - 10)}px`;
      badge.style.top = `${Math.max(8, top - 14)}px`;
      badge.style.minWidth = '30px';
      badge.style.height = '30px';
      badge.style.padding = '0 8px';
      badge.style.display = 'inline-flex';
      badge.style.alignItems = 'center';
      badge.style.justifyContent = 'center';
      badge.style.borderRadius = '999px';
      badge.style.background = '#d43f1a';
      badge.style.color = '#fff';
      badge.style.font = '700 16px/1 sans-serif';
      badge.style.boxShadow = '0 4px 10px rgba(0, 0, 0, 0.2)';
      overlay.appendChild(badge);
    });
  }, highlights);
}

function buildManualDraft(capturedShots) {
  const lines = [
    '# アプリ使い方マニュアル下書き',
    '',
    `作成日時: ${new Date().toISOString()}`,
    ''
  ];

  let currentTool = '';
  for (const shot of capturedShots) {
    if (shot.tool !== currentTool) {
      currentTool = shot.tool;
      lines.push(`## ${shot.tool}`);
      lines.push('');
    }
    lines.push(`### ${shot.title}`);
    lines.push('');
    if (shot.description) {
      lines.push(shot.description);
      lines.push('');
    }
    const instructions = Array.isArray(shot.instructions) ? shot.instructions : [];
    instructions.forEach((step, index) => {
      lines.push(`${index + 1}. ${step}`);
    });
    if (instructions.length) lines.push('');
    lines.push(`![${shot.alt || shot.title}](./${shot.fileName})`);
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

const browser = await chromium.launch({ headless: true });
const results = [];
const capturedShots = [];

try {
  for (const target of config.pages) {
    const context = await browser.newContext(createContextOptions(config.viewport));
    const page = await context.newPage();
    const url = new URL(target.path, config.baseUrl).toString();

    try {
      await applyStorage(page, target.storage);
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
      await page.emulateMedia({ reducedMotion: 'reduce' });

      if (target.waitFor) {
        await page.locator(target.waitFor).first().waitFor({ state: 'visible', timeout: 10_000 });
      }
      if (Array.isArray(target.before)) {
        await performActions(page, target.before);
      }

      const shots = Array.isArray(target.shots) ? target.shots : [];
      for (const shot of shots) {
        try {
          if (Array.isArray(shot.before)) {
            await performActions(page, shot.before);
          }
          if (shot.waitFor) {
            await page.locator(shot.waitFor).first().waitFor({ state: 'visible', timeout: Number(shot.timeout ?? 10_000) });
          }

          await applyHighlights(page, shot.highlights ?? []);
          const fileName = `${shot.name}.png`;
          const filePath = path.join(outputDir, fileName);

          if (shot.selector) {
            await page.locator(shot.selector).first().screenshot({
              path: filePath,
              animations: 'disabled'
            });
          } else {
            await page.screenshot({
              path: filePath,
              fullPage: shot.fullPage ?? true,
              animations: 'disabled'
            });
          }

          results.push({
            page: target.name,
            shot: shot.name,
            tool: target.tool,
            title: shot.title,
            description: shot.description ?? '',
            file: fileName,
            url,
            status: 'ok'
          });
          capturedShots.push({
            tool: target.tool,
            title: shot.title,
            description: shot.description ?? '',
            instructions: shot.instructions ?? [],
            alt: shot.alt ?? shot.title,
            fileName
          });
          console.log(`captured: ${shot.name}`);
          await clearHighlights(page);
          if (Array.isArray(shot.after)) {
            await performActions(page, shot.after);
          }
        } catch (error) {
          results.push({
            page: target.name,
            shot: shot.name,
            tool: target.tool,
            title: shot.title,
            url,
            status: 'error',
            message: error.message
          });
          console.error(`failed: ${shot.name}: ${error.message}`);
          process.exitCode = 1;
          await clearHighlights(page);
        }
      }
    } catch (error) {
      results.push({ page: target.name, url, status: 'error', message: error.message });
      console.error(`failed page: ${target.name}: ${error.message}`);
      process.exitCode = 1;
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

await writeFile(
  path.join(outputDir, 'capture-report.json'),
  `${JSON.stringify({ createdAt: new Date().toISOString(), results }, null, 2)}\n`,
  'utf8'
);

await writeFile(
  path.join(outputDir, 'manual-draft.md'),
  buildManualDraft(capturedShots),
  'utf8'
);
