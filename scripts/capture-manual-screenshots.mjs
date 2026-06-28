import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const rootDir = process.cwd();
const configPath = process.env.SCREENSHOT_CONFIG || path.join(rootDir, 'manual', 'screenshots.json');
const outputDir = process.env.SCREENSHOT_OUTPUT || path.join(rootDir, 'manual', 'output');
const config = JSON.parse(await readFile(configPath, 'utf8'));

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: {
    width: config.viewport?.width ?? 412,
    height: config.viewport?.height ?? 915
  },
  deviceScaleFactor: config.viewport?.deviceScaleFactor ?? 1,
  colorScheme: 'light',
  locale: 'ja-JP',
  reducedMotion: 'reduce'
});

const results = [];

try {
  for (const target of config.pages) {
    const page = await context.newPage();
    const url = new URL(target.path, config.baseUrl).toString();

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
      await page.emulateMedia({ reducedMotion: 'reduce' });

      if (target.waitFor) {
        await page.locator(target.waitFor).waitFor({ state: 'visible', timeout: 10_000 });
      }

      if (Array.isArray(target.actions)) {
        for (const action of target.actions) {
          if (action.type === 'click') {
            await page.locator(action.selector).click();
          } else if (action.type === 'fill') {
            await page.locator(action.selector).fill(String(action.value ?? ''));
          } else if (action.type === 'select') {
            await page.locator(action.selector).selectOption(String(action.value ?? ''));
          } else if (action.type === 'check') {
            await page.locator(action.selector).setChecked(Boolean(action.value ?? true));
          } else if (action.type === 'wait') {
            await page.waitForTimeout(Number(action.ms ?? 300));
          } else {
            throw new Error(`未対応の操作種別です: ${action.type}`);
          }
        }
      }

      const fileName = `${target.name}.png`;
      const filePath = path.join(outputDir, fileName);
      await page.screenshot({
        path: filePath,
        fullPage: target.fullPage ?? true,
        animations: 'disabled'
      });

      results.push({ name: target.name, url, file: fileName, status: 'ok' });
      console.log(`captured: ${target.name}`);
    } catch (error) {
      results.push({ name: target.name, url, status: 'error', message: error.message });
      console.error(`failed: ${target.name}: ${error.message}`);
      process.exitCode = 1;
    } finally {
      await page.close();
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
