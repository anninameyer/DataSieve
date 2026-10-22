import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { unzipSync, strFromU8 } from 'fflate';
import { readSheet } from 'read-excel-file/node';

async function load(page: Page) {
  await page.getByRole('button', { name: 'Try an example' }).click();
  await expect(page.locator('.barlayer .point').first()).toBeVisible();
}
async function tabularDownload(page: Page, format: 'csv' | 'tsv' | 'xlsx', name: string) {
  await page
    .getByRole('combobox', { name: 'Data export format', exact: true })
    .selectOption(format);
  const promise = page.waitForEvent('download');
  await page.getByRole('button', { name }).click();
  const result = await promise;
  expect(result.suggestedFilename()).toMatch(new RegExp(`\\.${format}$`));
  return readFile((await result.path())!);
}
test('TSV and Excel exports preserve all records, original values, methods and citations', async ({
  page,
}) => {
  await page.goto('/');
  await load(page);
  const tsv = (await tabularDownload(page, 'tsv', 'Complete dataset')).toString('utf8');
  expect(tsv).toContain('"source_row"\t"original_sample_identifier"');
  expect(tsv).toContain('"S029"');
  const complete = await tabularDownload(page, 'xlsx', 'Complete dataset');
  const rows = await readSheet(complete, 'Observations');
  expect(rows).toHaveLength(33);
  expect(rows[29][1]).toBe('S029');
  expect(rows[29][3]).toBe('80.0');
  expect(rows[29][4]).toBe(80);
  const files = unzipSync(complete);
  expect(strFromU8(files['xl/workbook.xml'])).toContain('Methods and citations');
  expect((await readSheet(complete, 'Methods and citations')).flat().join(' ')).toContain(
    '75th percentile',
  );
  expect((await readSheet(complete, 'Methods and citations')).flat().join(' ')).toContain(
    'Meyer, A. R. (2026). RangeSieve: numerical data exploration and outlier review',
  );
  expect((await readSheet(complete, 'Methods and citations')).flat().join(' ')).toContain(
    'https://doi.org/10.5281/zenodo.23540904',
  );
  expect(strFromU8(files['docProps/core.xml'])).toContain(
    '<dc:creator>Annina R. Meyer</dc:creator>',
  );
  expect((await readSheet(complete, 'Methods and citations')).flat().join(' ')).toContain(
    'https://orcid.org/0009-0006-3110-6598',
  );
  expect((await readSheet(complete, 'Methods and citations')).flat().join(' ')).toContain(
    'GPT-6.1-Sol (high reasoning setting)',
  );
  expect((await readSheet(complete, 'Methods and citations')).flat().join(' ')).toContain(
    'does not upload it to external servers',
  );
  expect(
    await readSheet(await tabularDownload(page, 'xlsx', 'Observations to review'), 'Observations'),
  ).toHaveLength(7);
  expect(
    (await readSheet(await tabularDownload(page, 'xlsx', 'Statistical summary'), 'Summary'))
      .flat()
      .join(' '),
  ).toContain('Hyndman–Fan type 7');
});

test('introductory method examples, creator credit and citation are visible without technical client wording', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.brand')).toHaveText('RangeSieve');
  await expect(page.locator('.brand svg')).toHaveCount(1);
  await expect(page.locator('.brand-sub')).toHaveCount(0);
  await expect(page.locator('.processing-pill')).toHaveText('Runs in your browser');
  await expect(page.locator('body')).not.toContainText('Private by design');
  await expect(page.locator('.privacy-notice')).toContainText(
    'does not upload it to external servers',
  );
  await expect(page.locator('.privacy-notice')).toContainText('share it with third parties');
  await expect(page.locator('.privacy-notice')).toContainText('save your analysis automatically');
  await expect(page.locator('.privacy-notice')).not.toContainText(/client/i);
  await page
    .locator('#methods details')
    .filter({ has: page.locator('summary', { hasText: 'Modified Z-score' }) })
    .locator('summary')
    .click();
  const method = page.locator('#methods details[open]');
  await expect(method).toContainText('75th percentile');
  await expect(method).toContainText('4.7215');
  await expect(page.locator('.page-footer')).toContainText('@anninameyer');
  await expect(page.locator('.page-footer')).toContainText('Annina R. Meyer');
  await expect(page.locator('#citation .development-acknowledgement')).toContainText(
    'GPT-6.1-Sol (high reasoning setting)',
  );
  await expect(page.locator('#citation .development-acknowledgement')).toContainText(
    'Dataset analysis is performed by the local application code',
  );
  await expect(page.locator('#citation').getByRole('link', { name: 'ORCID:' })).toHaveAttribute(
    'href',
    'https://orcid.org/0009-0006-3110-6598',
  );
  await expect(page.locator('#citation')).not.toContainText('No DOI has been assigned yet');
  await expect(
    page.locator('#citation').getByRole('link', { name: 'Archived release' }),
  ).toHaveAttribute('href', 'https://doi.org/10.5281/zenodo.23540904');
  const promise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download software citation' }).click();
  const citation = await readFile((await (await promise).path())!, 'utf8');
  expect(citation).toContain(
    'Meyer, A. R. (2026). RangeSieve: numerical data exploration and outlier review',
  );
  expect(citation).toContain('https://doi.org/10.5281/zenodo.23540904');
  expect(citation).not.toContain('privacy-first');
});

test('custom figure colors change the plot and reset to accessible defaults', async ({ page }) => {
  await page.goto('/');
  await load(page);
  await page.locator('.figure-settings summary').click();
  const color = page.getByLabel('Color for Typical observations / bars', { exact: true });
  await expect(color).toHaveValue('#0072b2');
  await color.evaluate((element) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
      element,
      '#6b4c9a',
    );
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(color).toHaveValue('#6b4c9a');
  await expect(page.locator('.barlayer .point path').first()).toHaveCSS(
    'fill',
    'rgb(107, 76, 154)',
  );
  await page.getByRole('button', { name: 'Reset figure colors' }).click();
  await expect(color).toHaveValue('#0072b2');
  await page.getByRole('button', { name: 'Sorted observations', exact: true }).click();
  const symbols = await page
    .locator('.plotly-target')
    .evaluate((element) =>
      (element as HTMLElement & { data: { type: string; marker?: { symbol: string } }[] }).data
        .filter((trace) => trace.type === 'scatter')
        .map((trace) => trace.marker!.symbol),
    );
  expect(new Set(symbols)).toEqual(new Set(['circle', 'triangle-up', 'square', 'diamond']));
});

test('expected-bound, median and mean colors update the rendered reference lines', async ({
  page,
}) => {
  await page.goto('/');
  await load(page);
  await expect(page.getByLabel('Mean line', { exact: true })).not.toBeChecked();
  await page.getByLabel('Median line', { exact: true }).uncheck();
  await page.getByLabel('Expected bounds', { exact: true }).uncheck();
  await page.locator('.figure-settings summary').click();
  const changes = [
    ['Outside expected range / bounds', '#6842a8', [0, 1], 'Expected bounds'],
    ['Median line', '#b36c12', [2], 'Median line'],
    ['Mean line', '#a83579', [3], 'Mean line'],
  ] as const;
  for (const [label, color, indices, checkbox] of changes) {
    await page.getByLabel(`Hex color for ${label}`, { exact: true }).fill(color);
    await expect(page.getByLabel(`Color for ${label}`, { exact: true })).toHaveValue(color);
    await expect(page.getByLabel(checkbox, { exact: true })).toBeChecked();
    const rgb = `rgb(${color
      .slice(1)
      .match(/../g)!
      .map((value) => parseInt(value, 16))
      .join(', ')})`;
    for (const index of indices)
      await expect(page.locator('.plotly-target .shapelayer path').nth(index)).toHaveCSS(
        'stroke',
        rgb,
      );
  }
  for (const kind of ['Boxplot', 'Sorted observations']) {
    await page.getByRole('button', { name: kind, exact: true }).click();
    for (const [, color, indices] of changes) {
      const rgb = `rgb(${color
        .slice(1)
        .match(/../g)!
        .map((value) => parseInt(value, 16))
        .join(', ')})`;
      for (const index of indices)
        await expect(page.locator('.plotly-target .shapelayer path').nth(index)).toHaveCSS(
          'stroke',
          rgb,
        );
    }
  }
});

test('horizontal grid visibility applies to every plot and its unbranded SVG export', async ({
  page,
}) => {
  await page.goto('/');
  await load(page);
  const grid = page.locator('.plotly-target .gridlayer .ygrid');
  await expect.poll(() => grid.count()).toBeGreaterThan(0);
  await page.getByLabel('Horizontal grid lines', { exact: true }).uncheck();
  await expect(grid).toHaveCount(0);
  for (const kind of ['Boxplot', 'Sorted observations']) {
    await page.getByRole('button', { name: kind, exact: true }).click();
    await expect(grid).toHaveCount(0);
    await page.getByLabel('Horizontal grid lines', { exact: true }).check();
    await expect.poll(() => grid.count()).toBeGreaterThan(0);
    await page.getByLabel('Horizontal grid lines', { exact: true }).uncheck();
    await expect(grid).toHaveCount(0);
  }
  await page.locator('.figure-settings summary').click();
  await page.getByRole('combobox', { name: 'Figure format', exact: true }).selectOption('svg');
  const promise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download figure', exact: true }).click();
  const output = await readFile((await (await promise).path())!, 'utf8');
  expect(output).not.toContain('RangeSieve');
  expect(output).not.toContain('class="ygrid');
  expect(output).toContain('Horizontal grid lines: hidden');
});

test('PNG, TIFF, PDF and vector SVG figures have print metadata and reproducible captions with no network', async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(60000);
  await page.goto('/');
  await load(page);
  await page.getByLabel('IQR fences', { exact: true }).check();
  await page.locator('.figure-settings summary').click();
  const requests: string[] = [],
    errors: string[] = [];
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) requests.push(request.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await context.route('**/*', (route) => route.abort());
  for (const format of ['png', 'tiff', 'pdf', 'svg']) {
    await page.getByRole('combobox', { name: 'Figure format', exact: true }).selectOption(format);
    const promise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download figure', exact: true }).click();
    const download = await promise;
    expect(download.suggestedFilename()).toBe(`histogram.${format}`);
    const output = await readFile((await download.path())!);
    expect(output.toString('utf8')).not.toContain('RangeSieve');
    // PDF text metadata is UTF-16BE, so check that encoding as well.
    expect(output.toString('latin1')).not.toContain('00520061006e0067006500530069006500760065');
    await download.saveAs(testInfo.outputPath(`synthetic-figure.${format}`));
    if (format === 'png') {
      expect([...output.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      expect(output.readUInt32BE(16)).toBe(Math.round((180 / 25.4) * 300));
      const at = output.indexOf('pHYs');
      expect(output.readUInt32BE(at + 4)).toBe(Math.round(300 / 0.0254));
      expect(output.toString('utf8')).toContain('IQR fences: multiplier 1.5');
    } else if (format === 'tiff') {
      expect([...output.subarray(0, 4)]).toEqual([73, 73, 42, 0]);
      expect(output.toString('latin1')).not.toContain('RangeSieve');
    } else if (format === 'pdf') {
      expect(output.toString('latin1')).toContain('%PDF-1.4');
      expect(output.toString('latin1')).toContain('/FlateDecode');
    } else {
      expect(output.toString('utf8')).toContain('<metadata>');
      expect(output.toString('utf8')).toContain('Mild upper fence');
      expect(output.toString('utf8')).toContain('Hyndman');
    }
  }
  const promise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download figure caption' }).click();
  const caption = await readFile((await (await promise).path())!, 'utf8');
  expect(caption).toContain('No sensitivity exclusions');
  expect(caption).toContain('Hyndman');
  expect(caption).toContain('https://doi.org/10.5281/zenodo.23540904');
  expect(caption).not.toContain('privacy-first');
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});

test('offline edition creates Excel and all figure formats with networking disabled', async ({
  browser,
}) => {
  test.setTimeout(60000);
  const context = await browser.newContext({ offline: true }),
    page = await context.newPage();
  const requests: string[] = [],
    errors: string[] = [];
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) requests.push(request.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(pathToFileURL(resolve('offline/RangeSieve.html')).href);
  await load(page);
  const workbook = await tabularDownload(page, 'xlsx', 'Complete dataset');
  expect(await readSheet(workbook, 'Observations')).toHaveLength(33);
  expect((await readSheet(workbook, 'Methods and citations')).flat().join(' ')).toContain(
    'https://doi.org/10.5281/zenodo.23540904',
  );
  await page.getByRole('button', { name: 'Sorted observations', exact: true }).click();
  await page.locator('.figure-settings summary').click();
  for (const format of ['png', 'tiff', 'pdf', 'svg']) {
    await page.getByRole('combobox', { name: 'Figure format', exact: true }).selectOption(format);
    const promise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download figure', exact: true }).click();
    expect((await promise).suggestedFilename()).toBe(`sorted-observations.${format}`);
  }
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
  await context.close();
});

test('figure exports are paused when input changes and invalid print sizes do not truncate data', async ({
  page,
}) => {
  await page.goto('/');
  await load(page);
  await page.locator('.figure-settings summary').click();
  await page.getByLabel('Width (mm)', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Download figure', exact: true }).click();
  await expect(page.locator('.figure-settings [role="status"]')).toContainText('80–300');
  await page.getByLabel('Sample identifier & numerical value').fill('A\t1');
  await expect(page.getByRole('button', { name: 'Download figure', exact: true })).toBeDisabled();
});
