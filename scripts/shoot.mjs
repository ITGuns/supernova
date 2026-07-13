import { chromium } from 'playwright';

const base = process.env.BASE ?? 'http://localhost:5173';
const outDir = 'docs/reference/nova-shots';
const theme = process.env.THEME; // 'light' | 'dark' | undefined (section default)

const routes = [
  ['sell', '/sell'],
  ['sales-history', '/sell/sales-history'],
  ['cash-management', '/sell/cash-management'],
  ['close-register', '/sell/open-close'],
  ['home', '/home'],
  ['reporting', '/reporting'],
  ['catalog', '/catalog'],
  ['customers', '/customers'],
  ['inventory', '/inventory'],
  ['setup', '/setup'],
];

const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const suffix = theme ? `-${theme}` : '';

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: process.env.FULL ? 2700 : 880 },
  deviceScaleFactor: 1,
});
if (theme) {
  await context.addInitScript((t) => {
    try {
      localStorage.setItem('nova-theme', t);
    } catch {
      /* ignore */
    }
  }, theme);
}
const page = await context.newPage();

for (const [name, route] of routes) {
  if (only && !only.includes(name)) continue;
  try {
    await page.goto(base + route, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(500);
    if (process.env.CLICK) {
      await page.getByText(process.env.CLICK, { exact: true }).first().click();
      await page.waitForTimeout(400);
    }
    if (process.env.CLICK2) {
      await page.getByText(process.env.CLICK2, { exact: true }).first().click();
      await page.waitForTimeout(400);
    }
    await page.screenshot({ path: `${outDir}/${name}${suffix}.png`, fullPage: !!process.env.FULL });
    console.log('shot', name + suffix);
  } catch (e) {
    console.log('FAIL', name, String(e).slice(0, 120));
  }
}

await browser.close();
console.log('done');
