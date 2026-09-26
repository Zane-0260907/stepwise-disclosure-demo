import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const browser = await chromium.launch({
  executablePath: process.env.EDGE_PATH || (process.platform === 'win32'
    ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
    : undefined),
  headless: true,
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 640 }, deviceScaleFactor: 1 });
  await page.goto(new URL('./social-preview.html', import.meta.url).href, { waitUntil: 'load' });
  await page.locator('.screen img').waitFor({ state: 'visible' });
  const loaded = await page.locator('main img').evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0));
  if (!loaded) throw new Error('A source image did not load');
  await page.screenshot({ path: fileURLToPath(new URL('./social-preview.png', import.meta.url)) });
} finally {
  await browser.close();
}
