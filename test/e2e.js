// Playwright smoke test: node test/e2e.js (expects http server on :8765 serving app/)
const { chromium } = require('playwright');
const path = require('path');
const SHOTS = path.join(__dirname, '..', 'screenshots');
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  const requests = [];
  page.on('request', r => { if (!r.url().startsWith('http://localhost:8765')) requests.push(r.url()); });
  await page.goto('http://localhost:8765/index.html');
  await page.selectOption('#sample', 'photo');
  await page.waitForSelector('#results:not([hidden])');
  const stats = await page.$$eval('.stat', s => s.map(x => x.innerText.replace(/\n/g, ' ')));
  console.log('stats', stats);
  const nGl = await page.$$eval('#reader .gl', b => b.length);
  const nHard = await page.$$eval('#reader .sent.hard', b => b.length);
  console.log('glossary buttons', nGl, 'hard sentences', nHard);
  if (!nGl || !nHard) throw new Error('missing highlights');
  await page.screenshot({ path: `${SHOTS}/01-full-text-desktop.png` });
  // glossary popover via keyboard
  await page.focus('#reader .gl[data-key="chlorophyll"]');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#pop:not([hidden])');
  console.log('pop:', await page.textContent('#popDef'));
  await page.screenshot({ path: `${SHOTS}/02-define-word-desktop.png` });
  await page.keyboard.press('Escape');
  if (!(await page.$eval('#pop', p => p.hidden))) throw new Error('pop not closed');
  // focus reader
  await page.click('#tab-focus');
  await page.click('#next');
  await page.keyboard.press('ArrowRight');
  console.log('focus:', await page.textContent('#focusMeta'));
  await page.screenshot({ path: `${SHOTS}/03-focus-reader-desktop.png` });
  // plain version
  await page.click('#tab-plain');
  console.log('plain:', (await page.innerText('#plain')).slice(0, 400));
  // hints
  await page.click('#tab-hints');
  console.log('hints count', await page.$$eval('#hints > li', l => l.length));
  // read-aloud button toggles state without errors
  await page.click('#play');
  await page.waitForTimeout(300);
  if (await page.isEnabled('#stop')) await page.click('#stop');
  console.log('play label after', await page.textContent('#play'));
  // display settings + persistence
  await page.click('#settingsToggle');
  await page.selectOption('#tint', 'blue');
  await page.fill('#fontSize', '24');
  await page.dispatchEvent('#fontSize', 'input');
  await page.fill('#line', '2.1'); await page.dispatchEvent('#line', 'input');
  await page.click('#tab-plain');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${SHOTS}/04-plainer-version-settings-desktop.png`, fullPage: true });
  await page.reload();
  const tint = await page.$eval('body', b => b.getAttribute('data-tint'));
  console.log('persisted tint', tint);
  if (tint !== 'blue') throw new Error('settings not persisted');
  // phone
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p2 = await phone.newPage();
  p2.on('console', m => { if (m.type() === 'error') errors.push('phone: ' + m.text()); });
  p2.on('pageerror', e => errors.push('phone: ' + e));
  await p2.goto('http://localhost:8765/index.html');
  await p2.selectOption('#sample', 'civics');
  await p2.waitForSelector('#results:not([hidden])');
  await p2.tap('#reader .gl[data-key="veto"]');
  await p2.waitForSelector('#pop:not([hidden])');
  const sw = await p2.evaluate(() => document.documentElement.scrollWidth);
  console.log('phone scrollWidth', sw);
  if (sw > 390) throw new Error('horizontal scroll on phone');
  await p2.screenshot({ path: `${SHOTS}/05-phone-define-word.png` });
  // file:// works too
  const p3 = await ctx.newPage();
  p3.on('pageerror', e => errors.push('file: ' + e));
  await p3.goto('file://' + path.join(__dirname, '..', 'app', 'index.html'));
  await p3.selectOption('#sample', 'water');
  await p3.waitForSelector('#results:not([hidden])');
  console.log('file:// OK');
  console.log('external requests', requests);
  console.log('errors', errors);
  await browser.close();
  if (errors.length || requests.length) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
