import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const variable = 'Mannitol dehydrogenase';
const fullLabel = `${variable} (gene count)`;
const shortLabel = 'log₁₀(gene count + 10⁻⁵)';
async function setup(page: Page) {
  await page
    .getByLabel('Sample identifier & numerical value')
    .fill('Sample_ID\tValue\nA\t0\nB\t1\nC\t2');
  await page.getByLabel('Variable name', { exact: true }).fill(variable);
  await page.getByLabel('Measurement unit', { exact: true }).fill('gene count');
  await page.getByRole('button', { name: 'Analyze dataset', exact: true }).click();
  await page.getByLabel('Transformation', { exact: true }).selectOption('log10');
  await page.getByLabel('Add pseudocount', { exact: true }).check();
  await page.getByLabel('Log10 pseudocount', { exact: true }).fill('0.00001');
}
async function download(page: Page, name: string) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name, exact: true }).click();
  const result = await pending;
  return readFile((await result.path())!);
}
function imageMetadata(output: Buffer, format: string) {
  if (format === 'tiff') {
    const directory = output.readUInt32LE(4);
    for (let i = 0; i < output.readUInt16LE(directory); i++) {
      const entry = directory + 2 + i * 12;
      if (output.readUInt16LE(entry) === 270) {
        const at = output.readUInt32LE(entry + 8),
          length = output.readUInt32LE(entry + 4);
        // Baseline TIFF's ASCII description preserves Unicode as literal escapes.
        return output
          .subarray(at, at + length - 1)
          .toString('ascii')
          .replace(/\\u([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
      }
    }
  } else if (format === 'png') {
    for (let at = 8; at + 12 <= output.length;) {
      const length = output.readUInt32BE(at);
      if (output.toString('ascii', at + 4, at + 8) === 'iTXt')
        return output.subarray(at + 8, at + 8 + length).toString('utf8');
      at += length + 12;
    }
  } else if (format === 'svg') {
    return output.toString('utf8').match(/<metadata>([\s\S]*?)<\/metadata>/)?.[1] ?? '';
  }
  throw new Error(`Missing ${format} figure metadata`);
}

test('automatic value axes are compact in every plot and keep original processing descriptions', async ({
  page,
}) => {
  await page.goto('/');
  await setup(page);
  const original = await page.locator('.results-table').innerText();
  for (const kind of ['Histogram', 'Boxplot', 'Violin plot', 'Sorted observations']) {
    await page.getByRole('button', { name: kind, exact: true }).click();
    await expect(
      page.locator(`.plotly-target .${kind === 'Histogram' ? 'x' : 'y'}title`),
    ).toHaveText(shortLabel);
    await expect(page.locator('.plotly-target .gtitle')).toHaveText(fullLabel);
  }
  await page.getByLabel('Apply transformation to', { exact: true }).selectOption('analysis');
  await expect(page.locator('.plotly-target .ytitle')).toHaveText(shortLabel);
  await expect(page.locator('.analysis-scale-note')).toContainText(
    'log10(Mannitol dehydrogenase (gene count) + 0.00001)',
  );
  await page.getByLabel('Apply transformation to', { exact: true }).selectOption('figure');
  await expect.poll(() => page.locator('.results-table').innerText()).toBe(original);
  await page.getByLabel('Measurement unit', { exact: true }).fill('');
  await expect(page.locator('.plotly-target .ytitle')).toHaveText(`log₁₀(${variable} + 10⁻⁵)`);
});

test('custom title and axes preview, hide and reset independently for each plot and reset for new data', async ({
  page,
}) => {
  await page.goto('/');
  await setup(page);
  const original = await page.locator('.results-table').innerText();
  await page.locator('.figure-settings summary').click();
  await page.getByLabel('Figure title', { exact: true }).fill('Panel A');
  await page.getByLabel('X-axis label', { exact: true }).fill('Relative abundance');
  await page.getByLabel('Y-axis label', { exact: true }).fill('Number of samples');
  await expect(page.locator('.plotly-target .gtitle')).toHaveText('Panel A');
  await expect(page.locator('.plotly-target .xtitle')).toHaveText('Relative abundance');
  await expect(page.locator('.plotly-target .ytitle')).toHaveText('Number of samples');
  await page.getByRole('button', { name: 'Boxplot', exact: true }).click();
  await expect(page.locator('.plotly-target .gtitle')).toHaveText(fullLabel);
  await expect(page.locator('.plotly-target .ytitle')).toHaveText(shortLabel);
  await page.getByLabel('Figure title', { exact: true }).fill('Panel B');
  await page.getByLabel('X-axis label', { exact: true }).fill('Group');
  await expect(page.locator('.plotly-target .xtitle')).toHaveText('Group');
  for (const label of ['figure title', 'x-axis label', 'y-axis label'])
    await page.getByLabel(`Include ${label}`, { exact: true }).uncheck();
  await expect(
    page.locator('.plotly-target .gtitle, .plotly-target .xtitle, .plotly-target .ytitle'),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset figure labels', exact: true }).click();
  await expect(page.locator('.plotly-target .gtitle')).toHaveText(fullLabel);
  await expect(page.locator('.plotly-target .ytitle')).toHaveText(shortLabel);
  await page.getByRole('button', { name: 'Histogram', exact: true }).click();
  await expect(page.locator('.plotly-target .gtitle')).toHaveText('Panel A');
  await page.getByLabel('Figure title', { exact: true }).fill('');
  await expect(page.locator('.plotly-target .gtitle')).toHaveText(fullLabel);
  await expect.poll(() => page.locator('.results-table').innerText()).toBe(original);
  await page
    .getByLabel('Sample identifier & numerical value')
    .fill('Sample_ID\tValue\nNEW\t3\nNEXT\t4');
  await page.getByRole('button', { name: 'Analyze dataset', exact: true }).click();
  await expect(page.getByLabel('X-axis label', { exact: true })).toHaveValue('');
  await expect(page.locator('.plotly-target .xtitle')).toHaveText(shortLabel);
});

for (const offline of [false, true]) {
  test(`custom manuscript text is preserved in every figure format ${offline ? 'offline' : 'online'}`, async ({
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
    await setup(page);
    await page.getByRole('button', { name: 'Violin plot', exact: true }).click();
    await page.locator('.figure-settings summary').click();
    await page.getByLabel('Figure title', { exact: true }).fill('Panel A — Mannitol');
    await page.getByLabel('X-axis label', { exact: true }).fill('Samples');
    await page.getByLabel('Y-axis label', { exact: true }).fill(shortLabel);
    for (const format of ['svg', 'png', 'tiff', 'pdf']) {
      await page.getByLabel('Figure format', { exact: true }).selectOption(format);
      const output = await download(page, 'Download figure');
      expect(output.includes(Buffer.from('RangeSieve'))).toBe(false);
      if (format !== 'pdf') {
        const text = imageMetadata(output, format);
        expect(text).toContain('Panel A — Mannitol');
        expect(text).toContain('Mannitol dehydrogenase (gene count)');
        expect(text).toContain('Pseudocount c = 0.00001');
        expect(text).toContain(shortLabel);
      }
      if (format === 'svg') {
        const titles = await page.evaluate((text) => {
          const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
          return ['.gtitle', '.xtitle', '.ytitle'].map(
            (selector) => doc.querySelector(selector)?.textContent,
          );
        }, output.toString('utf8'));
        expect(titles[0]).toContain('Panel A — Mannitol');
        expect(titles[1]).toBe('Samples');
        expect(titles[2]).toBe(shortLabel);
      }
      await testInfo.attach(`custom-figure.${format}`, { body: output });
    }
    const caption = (await download(page, 'Download figure caption')).toString('utf8');
    expect(caption).toContain('"title":"Panel A — Mannitol"');
    expect(caption).toContain('"xAxis":"Samples"');
    expect(caption).toContain('"pseudocount":0.00001');
    await page.getByLabel('Include figure title', { exact: true }).uncheck();
    await page.getByLabel('Include x-axis label', { exact: true }).uncheck();
    await page.getByLabel('Include y-axis label', { exact: true }).uncheck();
    await page.getByLabel('Figure format', { exact: true }).selectOption('svg');
    const hidden = (await download(page, 'Download figure')).toString('utf8');
    expect(
      await page.evaluate(
        (text) =>
          new DOMParser()
            .parseFromString(text, 'image/svg+xml')
            .querySelectorAll('.gtitle, .xtitle, .ytitle').length,
        hidden,
      ),
    ).toBe(0);
    await page.getByRole('button', { name: 'Reset figure labels', exact: true }).click();
    await page
      .locator('.chart-panel')
      .screenshot({ path: testInfo.outputPath('compact-labels.png') });
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('custom text is literal and cannot introduce scripts, markup or network requests', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await setup(page);
  await page.locator('.figure-settings summary').click();
  const requests: string[] = [];
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) requests.push(request.url());
  });
  await context.route('**/*', (route) => route.abort());
  const hostile = '<img src=https://example.invalid/leak onerror=alert(1)>';
  await page.getByLabel('Figure title', { exact: true }).fill(hostile);
  await page.getByLabel('X-axis label', { exact: true }).fill('<script>alert(1)</script>');
  await page.getByLabel('Y-axis label', { exact: true }).fill('<b>literal</b> & μ');
  await expect(page.locator('.plotly-target .gtitle')).toHaveText(hostile);
  await page.getByLabel('Figure format', { exact: true }).selectOption('svg');
  const svg = (await download(page, 'Download figure')).toString('utf8');
  expect(svg).not.toContain('<script>');
  expect(svg).not.toContain('<img ');
  expect(svg).toContain('&lt;script&gt;');
  expect(requests).toEqual([]);
});
