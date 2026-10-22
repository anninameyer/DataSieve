import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { violinBandwidth } from '../src/plot-scale';

async function enter(page: Page, values: number[]) {
  await page
    .getByLabel('Sample identifier & numerical value')
    .fill(`Sample_ID\tValue\n${values.map((value, i) => `S${i}\t${value}`).join('\n')}`);
  await page.getByRole('button', { name: 'Analyze dataset', exact: true }).click();
  await expect(page.getByTestId('valid-count')).toHaveText(String(values.length));
}
type Graph = HTMLElement & {
  data: { type: string; y: number[]; bandwidth?: number; q1?: number[]; median?: number[] }[];
  layout: {
    xaxis: { title: { text: string } };
    yaxis: { title: { text: string } };
    shapes: { name: string; y0?: number; x0?: number }[];
  };
  calcdata: { density: { t: number; v: number }[]; bandwidth: number }[][];
};
const bimodal = Array.from({ length: 80 }, (_, i) => (i < 40 ? 2 : 8) + ((i % 10) - 4.5) / 25);

test('every plot labels scaled axes and transforms original reference statistics without changing results', async ({
  page,
}) => {
  await page.goto('/');
  await enter(page, [1, 10, 100, 1000]);
  await expect(page.getByLabel('Transformation', { exact: true })).toHaveValue('none');
  const originalTable = await page.locator('.results-table').innerText();
  await page.getByLabel('Mean line', { exact: true }).check();
  await page.getByLabel('Minimum', { exact: true }).fill('1');
  await page.getByLabel('Maximum', { exact: true }).fill('100');
  for (const kind of ['Histogram', 'Boxplot', 'Violin plot', 'Sorted observations']) {
    await page.getByRole('button', { name: kind, exact: true }).click();
    await page.getByLabel('Transformation', { exact: true }).selectOption('log10');
    await expect(
      page.locator('.plotly-target .xtitle, .plotly-target .ytitle').filter({ hasText: 'log₁₀(' }),
    ).toHaveCount(1);
    await expect
      .poll(() =>
        page.locator('.plotly-target').evaluate((element) => {
          const graph = element as Graph;
          return graph.layout.shapes.find((shape) => shape.name.startsWith('Mean'))?.[
            graph.data[0].type === 'histogram' ? 'x0' : 'y0'
          ];
        }),
      )
      .toBeCloseTo(Math.log10(277.75));
    const graph = await page.locator('.plotly-target').evaluate((element) => {
      const graph = element as Graph;
      return {
        axes: graph.layout,
        box: graph.data.find((trace) => trace.type === 'box'),
        points: graph.data
          .filter((trace) => trace.type === 'scatter')
          .flatMap((trace) => trace.y)
          .sort((a, b) => a - b),
      };
    });
    if (kind === 'Histogram') expect(graph.axes.yaxis.title.text).toBe('Observations');
    else expect(graph.points).toEqual([0, 1, 2, 3]);
    if (kind === 'Boxplot') expect(graph.box!.q1![0]).toBeCloseTo(Math.log10(7.75));
    await page.getByLabel('Transformation', { exact: true }).selectOption('zscore');
    await expect(
      page
        .locator('.plotly-target .xtitle, .plotly-target .ytitle')
        .filter({ hasText: 'z-score (unitless)' }),
    ).toHaveCount(1);
    await expect
      .poll(() =>
        page.locator('.plotly-target').evaluate((element) => {
          const graph = element as Graph;
          const mean = graph.layout.shapes.find((shape) => shape.name.startsWith('Mean'))!;
          return graph.data[0].type === 'histogram' ? mean.x0 : mean.y0;
        }),
      )
      .toBe(0);
    await page.getByLabel('Transformation', { exact: true }).selectOption('none');
  }
  // Bounds deliberately changed above; compare after removing them again.
  await page.getByLabel('Minimum', { exact: true }).fill('');
  await page.getByLabel('Maximum', { exact: true }).fill('');
  await expect.poll(() => page.locator('.results-table').innerText()).toBe(originalTable);
});

test('unsupported transformations explain the problem and never silently discard values', async ({
  page,
}) => {
  await page.goto('/');
  await enter(page, [-1, 0, 10]);
  await page.locator('.figure-settings summary').click();
  await page.getByLabel('Transformation', { exact: true }).selectOption('log10');
  await expect(page.locator('.chart-empty')).toContainText(
    '2 valid observations are zero or negative',
  );
  await expect(page.locator('.plotly-target .point')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Download figure', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Complete dataset' })).toBeEnabled();
  await expect(page.locator('.results-table tbody tr')).toHaveCount(3);
  await page.getByLabel('Transformation', { exact: true }).selectOption('zscore');
  await expect(page.locator('.barlayer .point').first()).toBeVisible();
  await enter(page, [7, 7, 7]);
  await expect(page.locator('.chart-empty')).toContainText('positive sample SD');
  await page.getByLabel('Transformation', { exact: true }).selectOption('none');
  await page.getByRole('button', { name: 'Violin plot', exact: true }).click();
  await expect(page.locator('.violin-note')).toContainText('two distinct values');
  await expect(page.locator('.scatterlayer .point')).toHaveCount(3);
  await expect(page.locator('.violinlayer .violin')).toHaveCount(0);
});

test('nonpositive log bounds are explicitly disclosed and positive bounds stay at transformed positions', async ({
  page,
}) => {
  await page.goto('/');
  await enter(page, [1, 2, 3, 4, 10]);
  await page.getByLabel('Minimum', { exact: true }).fill('0');
  await page.getByLabel('Maximum', { exact: true }).fill('10');
  await page.getByLabel('IQR fences', { exact: true }).check();
  await page.getByLabel('Transformation', { exact: true }).selectOption('log10');
  await expect(
    page.getByRole('status').filter({ hasText: 'Reference lines unavailable' }),
  ).toContainText('expected minimum, mild lower fence, extreme lower fence');
  const bound = await page
    .locator('.plotly-target')
    .evaluate((element) =>
      (element as Graph).layout.shapes.find((shape) => shape.name.startsWith('Expected maximum')),
    );
  expect(bound?.x0).toBe(1);
  await expect(page.locator('.barlayer .point').first()).toBeVisible();
});

test('violin KDE shows two lobes and uses the documented Gaussian bandwidth and smoothing', async ({
  page,
}) => {
  await page.goto('/');
  await enter(page, bimodal);
  await page.getByRole('button', { name: 'Violin plot', exact: true }).click();
  await expect(page.locator('.violinlayer .violin')).toHaveCount(1);
  await expect(page.locator('.scatterlayer .point')).toHaveCount(80);
  const computed = await page
    .locator('.plotly-target')
    .evaluate((element) => (element as Graph).calcdata[0][0]);
  const bandwidth = violinBandwidth(bimodal, 1).bandwidth!;
  expect(computed.bandwidth).toBeCloseTo(bandwidth, 12);
  const nearest = (target: number) =>
    computed.density.reduce((best, point) =>
      Math.abs(point.t - target) < Math.abs(best.t - target) ? point : best,
    );
  expect(nearest(2).v).toBeGreaterThan(2 * nearest(5).v);
  expect(nearest(8).v).toBeGreaterThan(2 * nearest(5).v);
  const point = nearest(2);
  const expected =
    bimodal.reduce((sum, value) => sum + Math.exp(-0.5 * ((point.t - value) / bandwidth) ** 2), 0) /
    (bimodal.length * bandwidth * Math.sqrt(2 * Math.PI));
  expect(point.v).toBeCloseTo(expected, 12);
  await page.getByLabel('Violin smoothing', { exact: true }).fill('0.5');
  await expect
    .poll(() =>
      page
        .locator('.plotly-target')
        .evaluate((element) => (element as Graph).calcdata[0][0].bandwidth),
    )
    .toBeCloseTo(bandwidth / 2, 12);
  await expect(page.locator('.violin-note')).toContainText('do not prove distinct populations');
});

for (const offline of [false, true]) {
  test(`scaled violin manuscript exports and captions work ${offline ? 'in the disconnected offline HTML' : 'online'}`, async ({
    page,
    context,
  }, testInfo) => {
    test.setTimeout(60000);
    const requests: string[] = [],
      errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    if (offline) {
      await context.setOffline(true);
      page.on('request', (request) => {
        if (/^https?:/.test(request.url())) requests.push(request.url());
      });
    }
    await page.goto(offline ? pathToFileURL(resolve('offline/RangeSieve.html')).href : '/');
    await enter(page, bimodal);
    await page.getByRole('button', { name: 'Violin plot', exact: true }).click();
    await page.getByLabel('Transformation', { exact: true }).selectOption('zscore');
    await page.getByLabel('Violin smoothing', { exact: true }).fill('0.5');
    await expect(page.locator('.violinlayer .violin')).toHaveCount(1);
    await page.getByLabel('Horizontal grid lines', { exact: true }).uncheck();
    await page.locator('.figure-settings summary').click();
    for (const format of ['svg', 'png']) {
      await page.getByLabel('Figure format', { exact: true }).selectOption(format);
      const pending = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download figure', exact: true }).click();
      const download = await pending;
      expect(download.suggestedFilename()).toBe(`violin.${format}`);
      const output = await readFile((await download.path())!);
      const text = output.toString('utf8');
      expect(text).not.toContain('RangeSieve');
      expect(text).toContain('Gaussian KDE');
      expect(text).toContain('smoothing multiplier 0.5');
      expect(text).toContain('zscoreSampleSD');
      expect(text).toContain('Horizontal grid lines: hidden');
      if (format === 'svg') {
        expect(text).toContain('z-score (unitless)');
        expect(text).toContain('class="violin"');
        expect(text).not.toContain('class="ygrid');
      }
      await download.saveAs(testInfo.outputPath(`scaled-violin.${format}`));
    }
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download figure caption' }).click();
    const caption = await readFile((await (await pending).path())!, 'utf8');
    expect(caption).toContain('Silverman (1986)');
    expect(caption).toContain('Software citation:');
    expect(caption).toContain('Mean =');
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('violin-dashboard.png'), fullPage: true });
  });
}
