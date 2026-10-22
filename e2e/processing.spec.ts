import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readSheet } from 'read-excel-file/node';
import { parseData } from '../src/core';

async function enter(page: Page, source = 'Sample_ID\tValue\n001\t0\n002\t9\n003\t99') {
  await page.getByLabel('Sample identifier & numerical value').fill(source);
  await page.getByRole('button', { name: 'Analyze dataset', exact: true }).click();
}
async function logWithZeros(page: Page) {
  await page.getByLabel('Transformation', { exact: true }).selectOption('log10');
  await page.getByLabel('Add pseudocount', { exact: true }).check();
  await page.getByLabel('Log10 pseudocount', { exact: true }).fill('1');
}
async function download(page: Page, button: string) {
  const pending = page.waitForEvent('download');
  await page
    .getByRole('button', {
      name: button,
      exact: !['Complete dataset', 'Analysis report', 'Statistical summary'].includes(button),
    })
    .click();
  const file = await pending;
  return { name: file.suggestedFilename(), bytes: await readFile((await file.path())!) };
}
type Graph = HTMLElement & {
  data: { type: string; y: number[]; q1?: number[] }[];
  layout: { shapes: { name: string; y0: number; x0: number }[] };
};

test('pseudocount preserves zero samples and scope changes summaries, box statistics and reference lines exactly once', async ({
  page,
}) => {
  await page.goto('/');
  await enter(page);
  await logWithZeros(page);
  await page.getByLabel('Mean line', { exact: true }).check();
  await page.getByRole('button', { name: 'Boxplot', exact: true }).click();
  await expect(page.locator('.plotly-target .ytitle')).toHaveText('log₁₀(Value + 1)');
  await expect(page.locator('.results-table tbody tr')).toHaveCount(3);
  await expect(page.getByRole('columnheader', { name: 'Analysis value' })).toHaveCount(0);
  await expect
    .poll(() =>
      page
        .locator('.plotly-target')
        .evaluate(
          (element) =>
            (element as Graph).layout.shapes.find((shape) => shape.name.startsWith('Mean'))!.y0,
        ),
    )
    .toBeCloseTo(Math.log10(37));
  await page.getByLabel('Apply transformation to', { exact: true }).selectOption('analysis');
  await expect(page.locator('.analysis-scale-note')).toContainText(
    'Calculated after transformation',
  );
  await expect(page.getByRole('columnheader', { name: /Analysis value/ })).toHaveCount(1);
  const graph = await page.locator('.plotly-target').evaluate((element) => {
    const graph = element as Graph;
    return {
      mean: graph.layout.shapes.find((shape) => shape.name.startsWith('Mean'))!.y0,
      q1: graph.data.find((trace) => trace.type === 'box')!.q1![0],
      points: graph.data
        .filter((trace) => trace.type === 'scatter')
        .flatMap((trace) => trace.y)
        .sort((a, b) => a - b),
    };
  });
  expect(graph).toEqual({ mean: 1, q1: 0.5, points: [0, 1, 2] });
  await expect(page.locator('#sensitivity')).toContainText('Comparison scale: log10(Value + 1)');
  await page.getByLabel('Apply transformation to', { exact: true }).selectOption('figure');
  await expect(page.locator('.analysis-scale-note')).toContainText('Original values and units');
  await expect
    .poll(() =>
      page
        .locator('.plotly-target')
        .evaluate(
          (element) =>
            (element as Graph).layout.shapes.find((shape) => shape.name.startsWith('Mean'))!.y0,
        ),
    )
    .toBeCloseTo(Math.log10(37));
});

test('invalid upfront transforms pause all results and exports, with recovery and original-unit plausibility', async ({
  page,
}) => {
  await page.goto('/');
  await enter(page);
  await page.getByLabel('Apply transformation to', { exact: true }).selectOption('analysis');
  await page.getByLabel('Transformation', { exact: true }).selectOption('log10');
  await expect(
    page.getByRole('alert').filter({ hasText: 'Statistics and exports are unavailable' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Complete dataset' })).toBeDisabled();
  await expect(page.getByTestId('valid-count')).toHaveText('3');
  await expect(page.locator('.results-table tbody tr')).toHaveCount(0);
  await page.getByLabel('Add pseudocount', { exact: true }).check();
  await page.getByLabel('Log10 pseudocount').fill('1');
  await expect(page.getByTestId('valid-count')).toHaveText('3');
  await page.getByLabel('Minimum', { exact: true }).fill('0');
  await page.getByLabel('Maximum', { exact: true }).fill('10');
  await expect(page.locator('.results-table tbody tr').last()).toContainText('Outside range');
  await expect(page.locator('.results-table tbody tr').first()).toContainText('Within range');
  await page.getByLabel('Outside expected range', { exact: true }).check();
  await expect(page.getByTestId('excluded-count')).toHaveText('1');
  await expect(
    page.locator('#sensitivity .comparison tbody tr').filter({ hasText: 'Mean' }),
  ).toContainText('0.5');
  await page.getByLabel('Log10 pseudocount').fill('-1');
  await expect(page.getByRole('button', { name: 'Complete dataset' })).toBeDisabled();
  await page.getByLabel('Log10 pseudocount').fill('');
  await expect(page.getByRole('alert').filter({ hasText: 'finite, nonnegative' })).toBeVisible();
  await page.getByLabel('Log10 pseudocount').fill('1');
  await expect(page.getByRole('button', { name: 'Complete dataset' })).toBeEnabled();
});

test('CSV, TSV, Excel, reports and captions record processing scope, original values and analyzed values', async ({
  page,
}) => {
  await page.goto('/');
  await enter(page);
  await logWithZeros(page);
  await page.getByLabel('Apply transformation to').selectOption('analysis');
  for (const format of ['csv', 'tsv', 'xlsx']) {
    await page.getByLabel('Data export format', { exact: true }).selectOption(format);
    const output = await download(page, 'Complete dataset');
    expect(output.name).toBe(`RangeSieve-annotated.${format}`);
    if (format === 'xlsx') {
      const rows = await readSheet(output.bytes, 'Observations');
      const headers = rows[0];
      expect(rows[2][headers.indexOf('parsed_value')]).toBe(9);
      expect(rows[2][headers.indexOf('analysis_value')]).toBe(1);
      expect(rows[2][headers.indexOf('transformation_scope')]).toBe('analysis');
      const settings = (await readSheet(output.bytes, 'Analysis settings')).flat().join(' ');
      expect(settings).toContain('parse → transform all valid values');
      expect(settings).toContain('Pseudocount c = 1');
      expect((await readSheet(output.bytes, 'Methods and citations')).flat().join(' ')).toContain(
        'log10(value + 1)',
      );
    } else {
      const text = output.bytes.toString('utf8');
      expect(text).toContain('"analysis_value"');
      expect(text).toContain('"log10_pseudocount"');
      expect(text).toContain('"log10"');
      expect(text).toContain('"analysis"');
    }
  }
  const report = (await download(page, 'Analysis report')).bytes.toString('utf8');
  expect(report).toContain('parse → transform all valid values');
  expect(report).toContain('log10(value + 1)');
  expect(report).toContain('not refitted after exclusions');
  await page.locator('.figure-settings summary').click();
  const caption = (await download(page, 'Download figure caption')).bytes.toString('utf8');
  expect(caption).toContain('"transformationScope":"analysis"');
  expect(caption).toContain('Pseudocount c = 1');
  expect(caption).not.toContain('Scaling affects figures only');
});

test('filter-first download retains original values and a second analysis refits to the retained input', async ({
  page,
}) => {
  await page.goto('/');
  await enter(page);
  await page.getByLabel('Maximum', { exact: true }).fill('10');
  await page.getByLabel('Outside expected range', { exact: true }).check();
  await expect(page.getByTestId('excluded-count')).toHaveText('1');
  await page.locator('.filter-first-help summary').click();
  for (const format of ['xlsx', 'tsv', 'csv']) {
    await page.getByLabel('Data export format', { exact: true }).selectOption(format);
    const output = await download(page, 'Download retained original values');
    if (format === 'xlsx') {
      expect(await readSheet(output.bytes, 'Observations')).toEqual([
        ['Sample_ID', 'Value'],
        ['001', '0'],
        ['002', '9'],
      ]);
      expect((await readSheet(output.bytes, 'Analysis settings')).flat()).toContain(
        'Sensitivity exclude plausible',
      );
    } else {
      const text = output.bytes.toString('utf8');
      const retained = parseData(text);
      expect(retained.rows.map((row) => [row.id, row.value])).toEqual([
        ['001', 0],
        ['002', 9],
      ]);
      if (format === 'csv') {
        await page.getByRole('button', { name: 'Clear session', exact: true }).click();
        await enter(page, text);
      }
    }
  }
  await page.getByLabel('Transformation', { exact: true }).selectOption('zscore');
  await page.getByLabel('Apply transformation to').selectOption('analysis');
  await expect(page.getByTestId('valid-count')).toHaveText('2');
  await page.getByLabel('Data export format', { exact: true }).selectOption('xlsx');
  const output = await download(page, 'Statistical summary');
  const rows = await readSheet(output.bytes, 'Summary');
  expect(rows.find((row) => row[0] === 'Z-score centering mean (original full data)')?.[1]).toBe(
    4.5,
  );
  expect(rows.find((row) => row[0] === 'Z-score sample SD (original full data)')?.[1]).toBeCloseTo(
    Math.sqrt(40.5),
  );
  await page.getByRole('button', { name: 'Clear session', exact: true }).click();
  await expect(page.getByLabel('Transformation', { exact: true })).toHaveValue('none');
  await expect(page.getByLabel('Apply transformation to')).toHaveValue('figure');
  await page.getByLabel('Transformation', { exact: true }).selectOption('log10');
  await expect(page.getByLabel('Add pseudocount', { exact: true })).not.toBeChecked();
});

test('upfront log pseudocount analysis, every plot and unbranded exports work in the disconnected offline HTML', async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(60000);
  const requests: string[] = [],
    errors: string[] = [];
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) requests.push(request.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await context.setOffline(true);
  await page.goto(pathToFileURL(resolve('offline/RangeSieve.html')).href);
  await enter(page);
  await logWithZeros(page);
  await page.getByLabel('Apply transformation to').selectOption('analysis');
  for (const kind of ['Histogram', 'Sorted observations', 'Boxplot', 'Violin plot']) {
    await page.getByRole('button', { name: kind, exact: true }).click();
    await expect(
      page.locator(kind === 'Histogram' ? '.plotly-target .xtitle' : '.plotly-target .ytitle'),
    ).toHaveText('log₁₀(Value + 1)');
    if (kind !== 'Histogram') {
      const points = await page.locator('.plotly-target').evaluate((element) =>
        (element as Graph).data
          .filter((trace) => trace.type === 'scatter')
          .flatMap((trace) => trace.y)
          .sort((a, b) => a - b),
      );
      expect(points).toEqual([0, 1, 2]);
    }
  }
  await page.locator('.figure-settings summary').click();
  for (const format of ['svg', 'png', 'tiff', 'pdf']) {
    await page.getByLabel('Figure format', { exact: true }).selectOption(format);
    const output = await download(page, 'Download figure');
    expect(output.name).toBe(`violin.${format}`);
    const text = output.bytes.toString('utf8');
    expect(text).not.toContain('RangeSieve');
    if (format !== 'pdf') expect(text).toContain('transformationScope');
    if (format === 'svg') {
      expect(text).toContain('log₁₀(Value + 1)');
      expect(text).toContain('&quot;pseudocount&quot;:1');
      expect(text).toContain('parse → transform');
    }
  }
  await page
    .locator('.chart-panel')
    .screenshot({ path: testInfo.outputPath('processing-controls.png') });
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});
