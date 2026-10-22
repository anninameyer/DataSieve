import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

async function ready(page: Page) {
  await expect(page.getByRole('heading', { name: 'A clearer view of your data.' })).toBeVisible();
}
async function example(page: Page) {
  await page.getByRole('button', { name: 'Try an example' }).click();
  await expect(page.getByTestId('valid-count')).toHaveText('30');
  await expect(page.locator('.barlayer .point').first()).toBeVisible();
}

test('empty state, paste Excel data, update a dataset, and clear the session', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await expect(page.getByRole('button', { name: 'Complete dataset' })).toBeDisabled();
  await page
    .getByLabel('Sample identifier & numerical value')
    .fill('Sample_ID\tValue\n001\t1\n002\t2\n003\t3\n004\t100\n005\t\n006\tbad');
  await page.getByRole('button', { name: 'Analyze dataset' }).click();
  await expect(page.getByTestId('valid-count')).toHaveText('4');
  await expect(page.locator('.results-table tbody tr')).toHaveCount(6);
  await expect(page.getByText('001', { exact: true })).toBeVisible();
  await page.getByLabel('Sample identifier & numerical value').fill('Sample_ID\tValue\nNEW\t8');
  await expect(page.getByRole('button', { name: 'Complete dataset' })).toBeDisabled();
  await page.getByRole('button', { name: 'Analyze dataset' }).click();
  await expect(page.getByTestId('valid-count')).toHaveText('1');
  await expect(page.locator('.results-table tbody')).toContainText('NEW');
  await page.getByRole('button', { name: 'Clear session' }).click();
  await expect(page.getByTestId('valid-count')).toHaveText('0');
  await expect(page.getByLabel('Sample identifier & numerical value')).toHaveValue('');
  await expect(page.locator('.plotly-target .point')).toHaveCount(0);
});

test('plots, search, sort, flags, thresholds, and independent range boundaries', async ({
  page,
}) => {
  await page.goto('/');
  await example(page);
  await page.getByRole('button', { name: 'Boxplot', exact: true }).click();
  await expect(page.locator('.boxlayer .box')).toHaveCount(1);
  await page.getByRole('button', { name: 'Sorted observations', exact: true }).click();
  await expect(page.locator('.scatterlayer .point').first()).toBeVisible();
  await page.getByLabel('Search sample identifiers').fill('S029');
  await expect(page.locator('.results-table tbody tr')).toHaveCount(1);
  await expect(page.locator('.results-table tbody')).toContainText('Outside range');
  await expect(page.locator('.results-table tbody')).toContainText('Extreme');
  await page.getByLabel('Search sample identifiers').fill('');
  await page.getByLabel('Only observations to review').check();
  await expect(page.locator('.results-table tbody tr')).toHaveCount(6);
  await page.getByLabel('Only observations to review').uncheck();
  await page.getByLabel('Sort observations').selectOption('descending');
  await expect(page.locator('.results-table tbody tr').first()).toContainText('S029');
  await page.getByLabel('Minimum', { exact: true }).fill('');
  await page.getByLabel('Maximum', { exact: true }).fill('');
  await expect(page.locator('.results-table tbody tr').first()).toContainText('Not specified');
  await page.locator('.threshold-settings summary').click();
  await page.getByLabel('Mild IQR multiplier').fill('4');
  await expect(page.getByRole('button', { name: 'Complete dataset' })).toBeDisabled();
  await page.getByLabel('Extreme IQR multiplier').fill('6');
  await expect(page.getByRole('button', { name: 'Complete dataset' })).toBeEnabled();
});

test('sensitivity uses union exclusions without removing observations', async ({ page }) => {
  await page.goto('/');
  await example(page);
  await expect(page.getByTestId('excluded-count')).toHaveText('0');
  await page.getByLabel('Outside expected range', { exact: true }).check();
  await expect(page.getByTestId('excluded-count')).toHaveText('2');
  await page.getByLabel('Extreme IQR outliers', { exact: true }).check();
  await expect(page.getByTestId('excluded-count')).toHaveText('3');
  await expect(page.locator('.results-table tbody tr')).toHaveCount(32);
  await expect(page.locator('.excluded-row')).toHaveCount(3);
});

test('all four exports download valid local artifacts', async ({ page }) => {
  await page.goto('/');
  await example(page);
  for (const [name, filename, expected] of [
    ['Complete dataset', 'RangeSieve-annotated.csv', 'original_sample_identifier'],
    ['Observations to review', 'RangeSieve-flagged.csv', 'review_classification'],
    ['Statistical summary', 'RangeSieve-summary.csv', 'Hyndman–Fan type 7'],
    ['Analysis report', 'RangeSieve-report.html', 'Definitions and limitations'],
  ]) {
    const promise = page.waitForEvent('download');
    await page.getByRole('button', { name, exact: false }).click();
    const download = await promise;
    expect(download.suggestedFilename()).toBe(filename);
    const content = await readFile((await download.path())!, 'utf8');
    expect(content).toContain(expected);
    if (name === 'Statistical summary' || name === 'Analysis report') {
      expect(content).toContain('https://doi.org/10.5281/zenodo.23540904');
      expect(content).toContain('RangeSieve: numerical data exploration and outlier review');
      expect(content).not.toContain('privacy-first');
    }
    if (name === 'Analysis report') {
      expect(content).toContain('GPT-6.1-Sol (high reasoning setting)');
      expect(content).toContain('does not upload it to external servers');
    }
  }
});

test('input, analysis, chart interactions and export trigger no network or storage operations', async ({
  page,
  context,
}) => {
  const violations: string[] = [];
  await page.addInitScript(() => {
    for (const method of ['setItem', 'getItem', 'removeItem', 'clear'] as const)
      Storage.prototype[method] = () => {
        throw new Error('Browser storage access prohibited');
      };
    Object.defineProperty(window, 'indexedDB', {
      get() {
        throw new Error('IndexedDB access prohibited');
      },
    });
    Object.defineProperty(document, 'cookie', {
      get() {
        throw new Error('Cookie access prohibited');
      },
      set() {
        throw new Error('Cookie access prohibited');
      },
    });
  });
  page.on('pageerror', (error) => violations.push(error.message));
  await page.goto('/');
  await ready(page);
  const requests: string[] = [];
  const sockets: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  page.on('websocket', (socket) => sockets.push(socket.url()));
  await context.route('**/*', (route) => {
    violations.push(`Network attempt: ${route.request().url()}`);
    return route.abort();
  });
  await page
    .getByLabel('Sample identifier & numerical value')
    .fill('Sample_ID\tValue\nPRIVATE_SYNTHETIC_MARKER\t2\nB\t3\nC\t200');
  await page.getByRole('button', { name: 'Analyze dataset' }).click();
  await page.getByRole('button', { name: 'Sorted observations', exact: true }).click();
  await expect(page.locator('.scatterlayer .point').first()).toBeVisible();
  await page.getByLabel('All IQR outliers', { exact: true }).check();
  const promise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Analysis report' }).click();
  await promise;
  await expect(page.getByTestId('valid-count')).toHaveText('3');
  expect(requests).toEqual([]);
  expect(sockets).toEqual([]);
  expect(violations).toEqual([]);
  expect(await context.cookies()).toEqual([]);
});

test('refresh clears data and all settings without persistent storage', async ({ page }) => {
  await page.goto('/');
  await example(page);
  await page.reload();
  await ready(page);
  await expect(page.getByLabel('Sample identifier & numerical value')).toHaveValue('');
  await expect(page.getByLabel('Variable name')).toHaveValue('');
  await expect(page.getByTestId('valid-count')).toHaveText('0');
  expect(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
      cookies: document.cookie,
    })),
  ).toEqual({ local: 0, session: 0, cookies: '' });
});

test('decimal-comma ambiguity is visible and explicit import settings resolve it', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Sample identifier & numerical value').fill('1,5\n2,5');
  await expect(page.getByRole('alert')).toContainText('Ambiguous');
  await expect(page.getByRole('button', { name: 'Analyze dataset' })).toBeDisabled();
  await page.locator('.import-options summary').click();
  await page.getByRole('combobox', { name: 'Delimiter', exact: true }).selectOption('single');
  await page.getByRole('button', { name: 'Analyze dataset' }).click();
  await expect(page.getByTestId('valid-count')).toHaveText('2');
});

test('works under a repository subpath with relative bundled assets and offline download', async ({
  page,
  context,
}) => {
  await context.route('**/RangeSieve/**', async (route) => {
    const relative =
      new URL(route.request().url()).pathname.replace(/^\/RangeSieve\//, '') || 'index.html';
    const path = resolve('dist', relative);
    if (!path.startsWith(resolve('dist') + '/')) return route.abort();
    const contentType = relative.endsWith('.js')
      ? 'application/javascript'
      : relative.endsWith('.css')
        ? 'text/css'
        : 'text/html';
    await route.fulfill({ body: await readFile(path), contentType });
  });
  await page.goto('/RangeSieve/');
  await example(page);
  await expect(page.getByRole('link', { name: 'Download offline edition' })).toHaveAttribute(
    'href',
    './RangeSieve.html',
  );
});

test('the website download opens as a standalone application without network access', async ({
  page,
  browser,
}, testInfo) => {
  await page.goto('/');
  await ready(page);
  const pendingDownload = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download offline edition' }).click();
  const download = await pendingDownload;
  expect(download.suggestedFilename()).toBe('RangeSieve.html');
  const downloadedPath = testInfo.outputPath('RangeSieve.html');
  await download.saveAs(downloadedPath);
  expect((await readFile(downloadedPath)).equals(await readFile('offline/RangeSieve.html'))).toBe(
    true,
  );

  // Exercise the actual website download, rather than opening only the build output.
  const offlineContext = await browser.newContext({ offline: true });
  const offlinePage = await offlineContext.newPage();
  const errors: string[] = [];
  offlinePage.on('pageerror', (error) => errors.push(error.message));
  await offlinePage.goto(pathToFileURL(downloadedPath).href);
  await ready(offlinePage);
  await example(offlinePage);
  expect(errors).toEqual([]);
  await offlineContext.close();
});

test('tablet layout remains usable with keyboard navigation and no page overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/');
  await example(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByLabel('Search sample identifiers').fill('S029');
  await expect(page.locator('.results-table tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'Complete dataset' }).focus();
  await expect(page.getByRole('button', { name: 'Complete dataset' })).toBeFocused();
});

test('standalone file works offline with CSP, identical results, all plots and local exports', async ({
  browser,
}) => {
  const context = await browser.newContext({ offline: true });
  const page = await context.newPage();
  const requests: string[] = [],
    errors: string[] = [],
    csp: string[] = [];
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) requests.push(request.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.text().includes('Content Security Policy')) csp.push(message.text());
  });
  await page.goto(pathToFileURL(resolve('offline/RangeSieve.html')).href);
  await ready(page);
  await expect(
    page.getByRole('link', { name: 'Learn about the statistical methods', exact: true }),
  ).toHaveAttribute('href', '#methods');
  await expect(page.locator('#citation .development-acknowledgement')).toContainText(
    'GPT-6.1-Sol (high reasoning setting)',
  );
  await example(page);
  await expect(page.getByTestId('review-count')).toHaveText('6');
  await page.getByRole('button', { name: 'Boxplot', exact: true }).click();
  await expect(page.locator('.boxlayer .box')).toHaveCount(1);
  await page.getByRole('button', { name: 'Sorted observations', exact: true }).click();
  await expect(page.locator('.scatterlayer .point').first()).toBeVisible();
  await page.getByLabel('Outside expected range', { exact: true }).check();
  await expect(page.getByTestId('excluded-count')).toHaveText('2');
  const promise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Complete dataset' }).click();
  const content = await readFile((await (await promise).path())!, 'utf8');
  expect(content).toContain('S029');
  expect(content).toContain('Outside expected range');
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
  expect(csp).toEqual([]);
  await page.reload();
  await ready(page);
  await expect(page.getByTestId('valid-count')).toHaveText('0');
  await context.close();
});

test('column mapping, explicit headers, and table pagination preserve every record', async ({
  page,
}) => {
  await page.goto('/');
  const rows = Array.from({ length: 105 }, (_, i) => `${i + 1};kept;ID-${i + 1}`);
  await page
    .getByLabel('Sample identifier & numerical value')
    .fill(['reading;note;code', ...rows].join('\n'));
  await page.locator('.import-options summary').click();
  await page.getByRole('combobox', { name: 'Column headers', exact: true }).selectOption('yes');
  await page
    .getByRole('combobox', { name: 'Numerical value column', exact: true })
    .selectOption('0');
  await page.getByRole('combobox', { name: 'Identifier column', exact: true }).selectOption('2');
  await page.getByRole('button', { name: 'Analyze dataset' }).click();
  await expect(page.getByTestId('valid-count')).toHaveText('105');
  await expect(page.locator('.results-table tbody tr')).toHaveCount(50);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('.results-table tbody tr')).toHaveCount(5);
  await expect(page.locator('.results-table tbody')).toContainText('ID-105');
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
});

test('histogram includes all values, controls work, and point hover shows original identifiers', async ({
  page,
}) => {
  await page.goto('/');
  await example(page);
  const count = await page.locator('.plotly-target').evaluate((element) => {
    const plot = element as HTMLElement & { calcdata: { y: number }[][] };
    return plot.calcdata[0].reduce((total, bin) => total + (bin.y || 0), 0);
  });
  expect(count).toBe(30);
  await page.getByLabel('Number of histogram bins').focus();
  await page.getByLabel('Number of histogram bins').press('End');
  await expect(page.getByLabel('Number of histogram bins')).toHaveValue('80');
  await page.getByLabel('Mean line', { exact: true }).check();
  await page.getByLabel('IQR fences', { exact: true }).check();
  await expect(page.locator('.shapelayer .shape-group')).toHaveCount(8);
  await page.getByRole('button', { name: 'Sorted observations', exact: true }).click();
  await expect(page.locator('.scatterlayer .point')).toHaveCount(30);
  // Plotly deliberately routes pointer events through its transparent drag layer.
  await page.locator('.scatterlayer .point').last().hover({ force: true });
  await expect(page.locator('.hoverlayer')).toContainText('S029');
  await expect(page.locator('.hoverlayer')).toContainText('80.0');
});

test('zero MAD, all-excluded state, and invalid range are explained explicitly', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByLabel('Sample identifier & numerical value')
    .fill('ID\tValue\nA\t1\nB\t1\nC\t1\nD\t1\nE\t100');
  await page.getByRole('button', { name: 'Analyze dataset' }).click();
  await expect(page.getByText('MAD is zero:', { exact: false })).toBeVisible();
  await page.getByLabel('Maximum', { exact: true }).fill('0');
  await page.getByLabel('Outside expected range', { exact: true }).check();
  await expect(page.getByTestId('excluded-count')).toHaveText('5');
  await expect(page.locator('.comparison tbody')).toContainText('Unavailable');
  await page.getByLabel('Minimum', { exact: true }).fill('10');
  await expect(page.getByRole('button', { name: 'Complete dataset' })).toBeDisabled();
  await expect(page.locator('.input-panel [role="alert"]')).toContainText('minimum');
});

test('hostile labels remain inert in charts, tables, and the local report', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await ready(page);
  const network: string[] = [];
  page.on('request', (request) => network.push(request.url()));
  await context.route('**/*', (route) => route.abort());
  await page
    .getByLabel('Sample identifier & numerical value')
    .fill('ID\tValue\n<img src=https://example.invalid/leak onerror=alert(1)>\t2\nB\t3\nC\t100');
  await page.getByLabel('Variable name').fill('<script>alert(1)</script>');
  await page.getByRole('button', { name: 'Analyze dataset' }).click();
  await page.getByRole('button', { name: 'Sorted observations', exact: true }).click();
  await expect(page.locator('.scatterlayer .point')).toHaveCount(3);
  await expect(page.locator('img')).toHaveCount(0);
  await expect(page.locator('.results-table tbody')).toContainText('<img src=');
  const promise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Analysis report' }).click();
  const html = await readFile((await (await promise).path())!, 'utf8');
  expect(html).toContain('&lt;script&gt;');
  expect(html).not.toContain('<script>');
  expect(network).toEqual([]);
});

test('desktop dashboard visual review and offline package parity', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/');
  await example(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('dashboard-desktop.png') });
  await page.screenshot({ path: testInfo.outputPath('dashboard-full.png'), fullPage: true });
  expect(await readFile('offline/RangeSieve.html', 'utf8')).toBe(
    await readFile('dist/RangeSieve.html', 'utf8'),
  );
});
