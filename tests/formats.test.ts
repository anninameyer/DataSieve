import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync, unzlibSync, zlibSync } from 'fflate';
import { readSheet as readXlsxFile } from 'read-excel-file/node';
import { workbook } from '../src/workbook';
import { delimited } from '../src/exports';
import { imagePdf, pngMetadata, tiff } from '../src/figure-formats';
import { defaultPalette, figureCaption, figureDescription } from '../src/figure-model';
import { analyze, defaultParse, defaultSettings, parseData, summarize } from '../src/core';
import { methods, references, softwareCitation } from '../src/references';

describe('Tabular formats and genuine Excel workbooks', () => {
  it('round-trips tabs, quotes, multiline values and missing fields through TSV', () => {
    const output = delimited(
      [
        ['ID', 'Value'],
        ['A\tB', '2,5'],
        ['C\nD', '-3'],
        ['E"F', ''],
      ],
      '\t',
    );
    const parsed = parseData(output, { ...defaultParse, delimiter: 'tab', header: 'yes' });
    expect(parsed.error).toBeNull();
    expect(parsed.rows.map((row) => [row.id, row.value])).toEqual([
      ['A\tB', 2.5],
      ['C\nD', -3],
      ['E"F', null],
    ]);
  });
  it('protects executable text in TSV as in CSV', () => {
    expect(delimited([['=1+1', '-3']], '\t')).toBe('\uFEFF"\'=1+1"\t"-3"\r\n');
  });
  it('is independently readable with exact text IDs/originals and typed parsed numbers', async () => {
    const output = workbook([
      {
        name: 'Observations',
        rows: [
          ['ID', 'Original', 'Parsed', 'Excluded'],
          ['001', '1.2300', 1.23, false],
          ['=HYPERLINK("https://example.invalid")', '-3', -3, true],
          ['A\r\nB', 'μg/L & <sample>', null, false],
        ],
      },
    ]);
    const rows = await readXlsxFile(Buffer.from(output));
    expect(rows[1]).toEqual(['001', '1.2300', 1.23, false]);
    expect(rows[2]).toEqual(['=HYPERLINK("https://example.invalid")', '-3', -3, true]);
    expect(rows[3]).toEqual(['A\r\nB', 'μg/L & <sample>', null, false]);
    const files = unzipSync(output);
    const xml = strFromU8(files['xl/worksheets/sheet1.xml']);
    expect(xml).not.toMatch(/<f(?:\s|>)/);
    expect(xml).toContain('state="frozen"');
    expect(Object.keys(files).some((path) => /externalLink|vbaProject/.test(path))).toBe(false);
  });
  it('supports multiple named worksheets and signed/extreme numeric values', async () => {
    const output = workbook([
      {
        name: 'Summary',
        rows: [
          ['Name', 'Value'],
          ['Mean', 1e100],
        ],
      },
      {
        name: 'Methods',
        rows: [
          ['Definition', 'Text'],
          ['Z', '0.6745 × (x − median) / MAD'],
        ],
      },
    ]);
    expect((await readXlsxFile(Buffer.from(output), 'Summary'))[1][1]).toBe(1e100);
    expect((await readXlsxFile(Buffer.from(output), 'Methods'))[1][1]).toContain('0.6745');
  });
  it('rejects oversized fields explicitly without truncation', () => {
    expect(() => workbook([{ name: 'Data', rows: [['X'.repeat(32768)]] }])).toThrow(/CSV or TSV/);
    expect(() => workbook([])).toThrow();
    expect(() => workbook([{ name: 'Bad/Name', rows: [] }])).toThrow();
  });
  it('escapes literal SpreadsheetML control markers instead of interpreting them', () => {
    const output = workbook([{ name: 'Data', rows: [['_x0000_\u0000']] }]);
    expect(strFromU8(unzipSync(output)['xl/worksheets/sheet1.xml'])).toContain(
      '_x005F_x0000__x0000_',
    );
  });
});

const pixels = new Uint8ClampedArray([0, 114, 178, 255, 230, 159, 0, 128]);
const expectedRgb = [0, 114, 178, 242, 207, 127];
function tiffTags(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    count = view.getUint16(8, true);
  return Object.fromEntries(
    Array.from({ length: count }, (_, i) => {
      const at = 10 + i * 12;
      return [
        view.getUint16(at, true),
        {
          type: view.getUint16(at + 2, true),
          count: view.getUint32(at + 4, true),
          value: view.getUint32(at + 8, true),
        },
      ];
    }),
  );
}
describe('Lossless scientific figure formats', () => {
  it('writes a baseline RGB TIFF with correct dimensions, pixel values and physical DPI', () => {
    const output = tiff(2, 1, pixels, 300, 'Synthetic thresholds');
    expect([...output.slice(0, 4)]).toEqual([73, 73, 42, 0]);
    const tags = tiffTags(output),
      view = new DataView(output.buffer);
    expect(tags[256].value).toBe(2);
    expect(tags[257].value).toBe(1);
    expect(tags[259].value).toBe(1);
    expect(tags[262].value).toBe(2);
    expect(tags[296].value).toBe(2);
    expect(view.getUint32(tags[282].value, true)).toBe(300);
    expect(view.getUint32(tags[282].value + 4, true)).toBe(1);
    expect([...output.slice(tags[273].value, tags[273].value + tags[279].value)]).toEqual(
      expectedRgb,
    );
  });
  it('writes a PDF with a lossless image, valid object offsets and selected print size', () => {
    const output = imagePdf(2, 1, pixels, 600, 'μg/L', 'Synthetic thresholds'),
      buffer = Buffer.from(output),
      text = buffer.toString('latin1');
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('/Filter /FlateDecode');
    expect(text).toContain('/Count 1');
    expect(text).not.toContain('/JavaScript');
    const xref = Number(text.match(/startxref\n(\d+)\n%%EOF/)![1]);
    expect(text.slice(xref, xref + 4)).toBe('xref');
    const entries = text.slice(xref).match(/\d{10} 00000 n/g)!;
    entries.forEach((entry, i) =>
      expect(text.slice(Number(entry.slice(0, 10)))).toMatch(new RegExp(`^${i + 1} 0 obj`)),
    );
    const at = text.indexOf('4 0 obj'),
      stream = text.indexOf('stream\n', at) + 7;
    const length = Number(text.slice(at, stream).match(/\/Length (\d+)/)![1]);
    expect([...unzlibSync(output.slice(stream, stream + length))]).toEqual(expectedRgb);
    expect(text).toContain(`/MediaBox [0 0 ${(2 / 600) * 72} ${(1 / 600) * 72}]`);
  });
  it('adds PNG physical resolution and international caption metadata exactly once', () => {
    // A synthetic minimal PNG container; pixel decoding is independently tested in browser exports.
    const chunk = (type: string, data: Uint8Array) => {
      const output = new Uint8Array(data.length + 12);
      new DataView(output.buffer).setUint32(0, data.length);
      output.set(new TextEncoder().encode(type), 4);
      output.set(data, 8);
      return output;
    };
    const ihdr = new Uint8Array(13);
    new DataView(ihdr.buffer).setUint32(0, 1);
    new DataView(ihdr.buffer).setUint32(4, 1);
    ihdr[8] = 8;
    ihdr[9] = 6;
    const parts = [
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', ihdr),
      chunk('IDAT', zlibSync(new Uint8Array([0, 0, 114, 178, 255]))),
      chunk('IEND', new Uint8Array()),
    ];
    const raw = Buffer.concat(parts),
      output = pngMetadata(raw, 600, 'μg/L; IQR × 1.5');
    expect(strFromU8(output)).toContain('μg/L; IQR × 1.5');
    const replaced = pngMetadata(output, 300, 'Second caption');
    expect(Buffer.from(replaced).toString('latin1').match(/pHYs/g)).toHaveLength(1);
    const at = Buffer.from(replaced).indexOf('pHYs');
    expect(new DataView(replaced.buffer).getUint32(at + 4)).toBe(Math.round(300 / 0.0254));
  });
  it('rejects malformed images and unsafe allocations', () => {
    expect(() => tiff(2, 2, pixels, 300, '')).toThrow();
    expect(() => imagePdf(1e6, 1e6, pixels, 300, '', '')).toThrow();
    expect(() => pngMetadata(new Uint8Array(), 300, '')).toThrow();
  });
});

describe('Accessible defaults, reproducible captions and introductory examples', () => {
  it('uses four distinct non-red/green defaults reinforced with labels and symbols', () => {
    expect(defaultPalette).toMatchObject({
      normal: '#0072B2',
      mild: '#E69F00',
      extreme: '#CC79A7',
      outside: '#000000',
    });
    expect(
      new Set([
        defaultPalette.normal,
        defaultPalette.mild,
        defaultPalette.extreme,
        defaultPalette.outside,
      ]).size,
    ).toBe(4);
  });
  it('records actual fences, settings, colors, full-dataset scope and citation in captions', () => {
    const analysis = analyze(parseData('A\t1\nB\t2\nC\t3\nD\t4\nE\t10').rows, {
      ...defaultSettings,
      max: 5,
    });
    const options = {
      kind: 'sorted' as const,
      label: 'Salt (%)',
      bins: 18,
      showMean: false,
      showMedian: true,
      showGrid: true,
      showIqr: true,
      showRange: true,
      palette: defaultPalette,
      dpi: 300,
      widthMm: 180,
      heightMm: 140,
    };
    const caption = figureCaption(analysis, options);
    const description = figureDescription(analysis, options);
    expect(description).not.toContain('RangeSieve');
    expect(description).toContain('Horizontal grid lines: shown');
    expect(figureDescription(analysis, { ...options, showGrid: false })).toContain(
      'Horizontal grid lines: hidden',
    );
    expect(caption).toContain('All 5');
    expect(caption).toContain('multiplier 1.5, [-1, 7]');
    expect(caption).toContain('maximum 5');
    expect(caption).toContain('No sensitivity exclusions');
    expect(caption).toContain('triangle');
    expect(caption).toContain('#0072B2');
    expect(caption).toContain(softwareCitation());
    expect(caption).toContain(
      'Meyer, A. R. (2026). RangeSieve: numerical data exploration and outlier review',
    );
    expect(caption).toContain('https://doi.org/10.5281/zenodo.23540904');
  });
  it('worked examples match the statistical implementation', () => {
    const summary = summarize([1, 2, 3, 4, 10]);
    expect(summary).toMatchObject({ mean: 4, median: 3, mad: 1 });
    expect(summary.sd).toBeCloseTo(3.5355339);
    const z = analyze(parseData('A\t1\nB\t2\nC\t3\nD\t4\nE\t10').rows).rows.at(-1)!.zScore;
    expect(z).toBeCloseTo(4.7215, 12);
    const text = methods.find((method) => method.title === 'Modified Z-score')!;
    expect(text.detail).toContain('75th percentile');
    expect(text.example).toContain('4.7215');
    expect(references.some((reference) => reference.title.includes('Hyndman'))).toBe(true);
  });
});
