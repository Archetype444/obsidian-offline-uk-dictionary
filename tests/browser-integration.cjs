/* Optional real-DOM integration tests. Requires Playwright in the test environment only. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const {chromium} = require(process.env.OUK_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const routes = {
  '/': ['tests/browser-harness.html', 'text/html'],
  '/harness.js': ['tests/browser-harness.js', 'text/javascript'],
  '/main.js': ['dist/main.js', 'text/javascript'],
  '/styles.css': ['dist/styles.css', 'text/css'],
};

async function main() {
  const temporary = path.join(root, 'test-results', 'tmp');
  fs.mkdirSync(temporary, {recursive: true});
  process.env.TMPDIR = temporary;
  const server = http.createServer((request, response) => {
    const route = routes[new URL(request.url, 'http://localhost').pathname];
    if (!route) {response.writeHead(404); response.end(); return;}
    response.writeHead(200, {'Content-Type': route[1], 'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'none'; img-src 'none'; font-src 'none'"});
    response.end(fs.readFileSync(path.join(root, route[0])));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  if (process.argv.includes('--serve')) {
    console.log(`Integration fixture: http://127.0.0.1:${server.address().port}`);
    return;
  }
  let browser;
  try {
    browser = await chromium.launch({headless: true, executablePath: process.env.OUK_CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox']});
    const page = await browser.newPage({viewport: {width: 1100, height: 840}, reducedMotion: 'reduce'});
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {if (!request.url().endsWith('/favicon.ico')) requests.push(request.url());});
    const base = `http://127.0.0.1:${server.address().port}`;
    await page.goto(base);
    await page.waitForFunction(() => window.fixtureReady === true);
    const baseline = requests.length;

    async function selectAndLookup(selector, expected) {
      const target = page.locator(selector);
      await target.dblclick();
      await target.click({button: 'right'});
      await page.locator('.test-context-menu').getByRole('button', {name: 'Look up', exact: true}).click();
      await page.waitForFunction(word => document.querySelector('.ouk-search-input')?.value === word && document.querySelector('.ouk-headword') !== null, expected);
      assert.equal(await page.locator('#right').evaluate(element => element.classList.contains('collapsed')), false);
      assert.equal(await page.locator('#dictionary-tab').evaluate(element => element.classList.contains('active')), true);
    }
    await selectAndLookup('[data-testid="reading-word"]', 'colour');
    assert.ok(await page.locator('.ouk-definition').count());
    await page.locator('#other').click();
    await page.locator('#collapse').click();
    await selectAndLookup('[data-testid="pdf-word"]', 'centre');
    assert.equal(await page.evaluate(() => fixture.leaves.length), 1);

    const input = page.getByTestId('text-input');
    await input.fill('organise'); await input.press('ControlOrMeta+A'); await input.click({button: 'right'});
    await page.locator('.test-context-menu').getByRole('button', {name: 'Look up', exact: true}).click();
    await page.waitForFunction(() => document.querySelector('.ouk-search-input')?.value === 'organise' && document.querySelector('.ouk-headword')?.textContent === 'organise');

    const frame = page.frameLocator('#text-frame');
    await frame.locator('#frame-word').dblclick(); await frame.locator('#frame-word').click({button: 'right'});
    await frame.getByRole('button', {name: 'Look up', exact: true}).click();
    await page.waitForFunction(() => document.querySelector('.ouk-search-input')?.value === 'privacy' && document.querySelector('.ouk-headword')?.textContent === 'privacy');

    await page.locator('.ouk-search-input').fill('colur');
    await page.locator('form').getByRole('button', {name: 'Look up', exact: true}).click();
    await page.locator('.ouk-suggestions').getByRole('button', {name: 'colour', exact: true}).click();
    await page.waitForFunction(() => document.querySelector('.ouk-headword')?.textContent === 'colour');

    // Deliberately hostile dictionary text must remain inert text, never DOM or a request.
    await page.evaluate(async () => {
      const dictionary = await fixture.plugin.getDictionary();
      const index = dictionary.synsets.push(['<img src="https://invalid.example/track" onerror="window.injected=true">', [], []]) - 1;
      dictionary.entries.syntheticinjection = [{w: 'syntheticinjection', p: 'n', s: [index]}];
      await fixture.plugin.openLookup('syntheticinjection');
    });
    assert.equal(await page.locator('.ouk-results img').count(), 0);
    assert.ok((await page.locator('.ouk-definition').first().textContent()).includes('<img'));
    assert.equal(await page.evaluate(() => Boolean(window.injected)), false);
    assert.deepEqual(await page.evaluate(() => fixture.leaves[0].view.getState()), {});

    await page.locator('.ouk-search-input').fill('colour');
    await page.locator('form').getByRole('button', {name: 'Look up', exact: true}).click();
    await page.waitForFunction(() => document.querySelector('.ouk-headword')?.textContent === 'colour');
    fs.mkdirSync(path.join(root, 'test-results'), {recursive: true});
    await page.screenshot({path: path.join(root, 'test-results/sidebar.png')});
    await page.locator('#right').evaluate(element => {element.style.width = '280px';});
    await page.screenshot({path: path.join(root, 'test-results/sidebar-narrow.png')});
    assert.ok(await page.locator('.ouk-search-input').isVisible());
    await page.getByRole('button', {name: 'Clear', exact: true}).click();
    assert.equal(await page.locator('.ouk-search-input').inputValue(), '');
    assert.equal(await page.locator('.ouk-headword').count(), 0);

    const password = page.getByTestId('password');
    await password.click(); await password.press('ControlOrMeta+A'); await password.click({button: 'right'});
    assert.equal(await page.locator('.test-context-menu').count(), 0);
    assert.equal(await page.evaluate(() => window.outboundAttempts), 0);
    assert.equal(requests.slice(baseline).length, 0, `Unexpected runtime requests: ${requests.slice(baseline)}`);
    await page.evaluate(() => fixture.stop());
    assert.equal(await page.locator('.ouk-search-input').count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS: Chromium integration — selected Markdown/PDF-style/input/frame text, sidebar reveal/tab reuse, local suggestions, XSS resistance, clear/unload, password exclusion and zero runtime requests.');
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => {console.error(error); process.exitCode = 1;});
