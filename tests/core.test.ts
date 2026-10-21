import { describe, expect, it } from 'vitest';
import {
  analyze,
  defaultExclusions,
  defaultParse,
  defaultSettings,
  exampleData,
  isExcluded,
  MAX_ROWS,
  numeric,
  parseData,
  quantile,
  sensitivity,
  summarize,
} from '../src/core';
import { annotatedCsv, csv, escapeHtml, format, reportHtml, summaryCsv } from '../src/exports';

const from = (values: number[]) =>
  parseData(values.map((value, i) => `S${i}\t${value}`).join('\n')).rows;
describe('Type-7 quantiles and descriptive statistics', () => {
  it('matches independent hand-calculated reference values', () => {
    const result = summarize([1, 2, 3, 4, 5]);
    expect(result).toMatchObject({
      n: 5,
      mean: 3,
      median: 3,
      min: 1,
      max: 5,
      q1: 2,
      q3: 4,
      iqr: 2,
      mad: 1,
    });
    expect(result.sd).toBeCloseTo(Math.sqrt(2.5), 12);
    expect(result.p1).toBeCloseTo(1.04, 12);
    expect(result.p5).toBeCloseTo(1.2, 12);
    expect(result.p95).toBeCloseTo(4.8, 12);
    expect(result.p99).toBeCloseTo(4.96, 12);
  });
  it('interpolates quartiles rather than using Tukey hinges', () => {
    expect(summarize([0, 1, 2, 3])).toMatchObject({ q1: 0.75, median: 1.5, q3: 2.25, iqr: 1.5 });
  });
  it('handles unsorted and negative values without modifying input', () => {
    const values = [-1, -5, -3];
    expect(summarize(values)).toMatchObject({ mean: -3, median: -3, sd: 2, min: -5, max: -1 });
    expect(values).toEqual([-1, -5, -3]);
  });
  it('uses unavailable quantities for empty datasets', () => {
    const result = summarize([]);
    expect(result.n).toBe(0);
    Object.entries(result)
      .filter(([key]) => key !== 'n')
      .forEach(([, value]) => expect(value).toBeNull());
  });
  it('handles one and two observations', () => {
    expect(summarize([4])).toMatchObject({ mean: 4, median: 4, q1: 4, q3: 4, sd: null, mad: 0 });
    expect(summarize([0, 2]).sd).toBeCloseTo(Math.sqrt(2), 12);
  });
  it('handles identical values', () => {
    expect(summarize([3, 3, 3, 3])).toMatchObject({ mean: 3, sd: 0, mad: 0, iqr: 0 });
  });
  it('avoids avoidable overflow in mean, median and sample SD', () => {
    expect(summarize([1e308, 1e308])).toMatchObject({ mean: 1e308, median: 1e308, sd: 0 });
    expect(summarize([-1e308, 1e308])).toMatchObject({ mean: 0, median: 0 });
    expect(summarize([-1e308, 1e308]).sd! / 1e308).toBeCloseTo(Math.sqrt(2), 12);
    expect(summarize([Number.MAX_VALUE, -Number.MAX_VALUE]).sd).toBeNull();
  });
  it('preserves small spread around a large offset', () => {
    expect(summarize([1e15, 1e15 + 1, 1e15 + 2]).sd).toBeCloseTo(1, 12);
  });
  it('avoids underflow of small squared deviations', () => {
    expect(summarize([1e-200, 3e-200]).sd! / 1e-200).toBeCloseTo(Math.sqrt(2), 12);
  });
  it('validates probabilities and finite inputs', () => {
    expect(() => quantile([1], -1)).toThrow();
    expect(() => quantile([1], NaN)).toThrow();
    expect(() => summarize([Infinity])).toThrow();
    expect(() => summarize([NaN])).toThrow();
    expect(quantile([1, 4], 0)).toBe(1);
    expect(quantile([1, 4], 1)).toBe(4);
  });
});
describe('Spreadsheet and CSV parsing', () => {
  it('preserves quoted CRLF identifiers and counts quoted empty single-column records', () => {
    const result = parseData('ID,Value\r\n"A\r\nB",2\r\nC,3');
    expect(result.rows[0].originalId).toBe('A\r\nB');
    expect(result.rows).toHaveLength(2);
    expect(parseData('""\n""').rows.map((row) => row.status)).toEqual(['missing', 'missing']);
  });
  it('discloses precision limits without discarding original high-precision text', () => {
    const result = parseData('A\t9007199254740993\nB\t1.12345678901234567');
    expect(result.rows[0].original).toBe('9007199254740993');
    expect(result.rows[1].original).toBe('1.12345678901234567');
    expect(result.rows.every((row) => row.status === 'valid')).toBe(true);
    expect(result.issues.join(' ')).toMatch(/2 numerical field.*safe integer/);
    expect(result.rows[0].issue).toMatch(/precision/);
  });
  it('recognizes Excel tabs and optional headers', () => {
    const result = parseData('Sample_ID\tSalt_percentage\r\n001\t2.5\r\n002\t-3');
    expect(result.hasHeader).toBe(true);
    expect(result.delimiter).toBe('tab');
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      id: '001',
      originalId: '001',
      original: '2.5',
      value: 2.5,
      status: 'valid',
    });
  });
  it('retains data without headers and unknown headers unless explicitly selected', () => {
    expect(parseData('X\t5\nY\t2').rows).toHaveLength(2);
    expect(parseData('mystery\tunknown\nX\t2').rows[0].status).toBe('invalid');
    expect(
      parseData('mystery\tunknown\nX\t2', { ...defaultParse, header: 'yes' }).rows,
    ).toHaveLength(1);
  });
  it('allows column selection and rejects identical selected columns', () => {
    const text = 'value;extra;subject\n1;foo;A\n2;bar;B';
    expect(
      parseData(text, { ...defaultParse, header: 'yes', idColumn: 2, valueColumn: 0 }).rows[1],
    ).toMatchObject({ id: 'B', value: 2 });
    expect(parseData(text, { ...defaultParse, idColumn: 0, valueColumn: 0 }).error).toMatch(
      /different/,
    );
    expect(parseData(text, { ...defaultParse, valueColumn: 20 }).error).toMatch(/do not exist/);
  });
  it('supports RFC-style quoted IDs, commas, escaped quotes and newlines', () => {
    const result = parseData('Sample_ID,Value\n"A,one",2\n"B""two",3\n"C\nthree",4');
    expect(result.error).toBeNull();
    expect(result.rows.map((row) => row.id)).toEqual(['A,one', 'B"two', 'C\nthree']);
  });
  it.each(['A,"2', 'A,1"2', 'A,"1"x'])('reports malformed quoting: %s', (source) => {
    expect(parseData(source, { ...defaultParse, delimiter: 'comma' }).error).toBeTruthy();
  });
  it('distinguishes missing from nonnumerical values', () => {
    const result = parseData(
      'ID\tValue\nA\t\nB\tNA\nC\tNaN\nD\tN/A\nE\t.\nF\tbad\nG\tInfinity\nH\t1e309',
    );
    expect(result.rows.filter((row) => row.status === 'missing')).toHaveLength(5);
    expect(result.rows.filter((row) => row.status === 'invalid')).toHaveLength(3);
  });
  it('never silently truncates an invalid-width row', () => {
    const result = parseData('ID\tValue\nA\t1\textra\nB\nC\t2');
    expect(result.rows.map((row) => row.status)).toEqual(['invalid', 'invalid', 'valid']);
    expect(result.rows[0].issue).toMatch(/Expected 2 fields/);
  });
  it('preserves duplicate and empty original sample identifiers', () => {
    const result = parseData('ID\tValue\n001\t1\n001\t2\n\t3');
    expect(result.rows.map((row) => row.originalId)).toEqual(['001', '001', '']);
    expect(result.rows.map((row) => row.row)).toEqual([1, 2, 3]);
    expect(result.issues.join(' ')).toContain('repeated');
    expect(result.issues.join(' ')).toContain('empty identifier');
  });
  it('parses unambiguous decimal commas, including quoted CSV fields', () => {
    expect(parseData('A\t-1,5\nB\t2,75').rows.map((row) => row.value)).toEqual([-1.5, 2.75]);
    expect(parseData('A;1,5\nB;2,5').rows[0].value).toBe(1.5);
    expect(parseData('A,"1,5"\nB,"2,5"').rows[0].value).toBe(1.5);
    expect(parseData('A\t1,5').issues[0]).toMatch(/decimal-comma/);
  });
  it('requires explicit interpretation of ambiguous comma-only numeric input', () => {
    expect(parseData('1,5\n2,5').error).toMatch(/Ambiguous/);
    expect(
      parseData('1,5\n2,5', { ...defaultParse, delimiter: 'single' }).rows.map((row) => row.value),
    ).toEqual([1.5, 2.5]);
    expect(
      parseData('1,5\n2,5', { ...defaultParse, delimiter: 'comma' }).rows.map((row) => row.value),
    ).toEqual([5, 5]);
  });
  it('does not parse mixed decimal and thousands formats or trailing text', () => {
    for (const value of ['1,234.5', '1.234,5', '1,234,567', '2.5 mg', '0x10', '3%', '--2'])
      expect(numeric(value).status).toBe('invalid');
  });
  it('supports integer, scientific notation, whitespace and signed decimals', () => {
    expect([' 2 ', '+3.5', '-.25', '1e-3', '0', '-0'].map((x) => numeric(x).value)).toEqual([
      2, 3.5, -0.25, 0.001, 0, -0,
    ]);
    expect(numeric(' 2 ').status).toBe('valid');
  });
  it('flags overflow and nonzero underflow without substituting zero', () => {
    expect(numeric('1e309').status).toBe('invalid');
    expect(numeric('1e-999').status).toBe('invalid');
    expect(numeric('0e-999').value).toBe(0);
    expect(numeric('5e-324').status).toBe('valid');
  });
  it('ignores empty lines and handles BOMs and empty datasets', () => {
    expect(parseData('\uFEFFID\tValue\nA\t2\n\n').rows).toHaveLength(1);
    expect(parseData(' \n\t ').rows).toHaveLength(0);
    expect(parseData('').error).toBeNull();
  });
  it('supports single-column and space-aligned data', () => {
    expect(parseData('1\n2\n3').rows.map((row) => row.value)).toEqual([1, 2, 3]);
    expect(parseData('Sample_ID    Value\nA    1\nB    2').rows.map((row) => row.value)).toEqual([
      1, 2,
    ]);
  });
  it('rejects oversized input without silently taking a subset', () => {
    expect(parseData('1\n'.repeat(MAX_ROWS + 2)).error).toMatch(/50,000/);
    expect(parseData('x'.repeat(5_000_001)).error).toMatch(/5 million/);
  });
});
describe('Independent screening flags', () => {
  it('computes mild and extreme IQR fences correctly', () => {
    const result = analyze(from([0, 1, 2, 3, 4, 5, 6, 10, 20]));
    expect(result).toMatchObject({ mildLow: -4, mildHigh: 12, extremeLow: -10, extremeHigh: 18 });
    expect(result.rows.at(-1)).toMatchObject({ iqrFlag: true, extremeFlag: true });
  });
  it('does not flag observations equal to fences or Z thresholds', () => {
    const result = analyze(from([0, 1, 2, 3, 4, 5, 9]));
    const equalFence = result.rows.find((row) => row.value === 9)!;
    expect(result.mildHigh).toBe(9);
    expect(equalFence.iqrFlag).toBe(false);
    const z = analyze(from([0, 1, 2]), { ...defaultSettings, z: 0.6745 });
    expect(z.rows[0].zFlag).toBe(false);
    expect(z.rows[2].zFlag).toBe(false);
  });
  it('matches the modified Z-score definition', () => {
    const result = analyze(from([0, 1, 2, 3, 4, 20]));
    expect(result.summary.median).toBe(2.5);
    expect(result.summary.mad).toBe(1.5);
    expect(result.rows.at(-1)!.zScore).toBeCloseTo((0.6745 * 17.5) / 1.5, 12);
    expect(result.rows.at(-1)!.zFlag).toBe(true);
  });
  it('makes modified Z unavailable when MAD is zero, even for the median', () => {
    const result = analyze(from([1, 1, 1, 1, 50]));
    result.rows.forEach((row) => {
      expect(row.zScore).toBeNull();
      expect(row.zFlag).toBeNull();
    });
    expect(result.rows.at(-1)!.extremeFlag).toBe(true);
    expect(result.warnings.join(' ')).toMatch(/MAD is zero/);
  });
  it('supports each inclusive plausibility boundary independently', () => {
    const rows = from([-1, 0, 10, 11]);
    expect(analyze(rows, { ...defaultSettings, min: 0 }).rows.map((row) => row.plausible)).toEqual([
      false,
      true,
      true,
      true,
    ]);
    expect(analyze(rows, { ...defaultSettings, max: 10 }).rows.map((row) => row.plausible)).toEqual(
      [true, true, true, false],
    );
    expect(analyze(rows).rows.every((row) => row.plausible === null)).toBe(true);
  });
  it('preserves overlapping flags but gives domain violations review priority', () => {
    const result = analyze(from([1, 2, 3, 4, 5, 100]), { ...defaultSettings, max: 10 });
    expect(result.rows.at(-1)).toMatchObject({
      iqrFlag: true,
      extremeFlag: true,
      zFlag: true,
      plausible: false,
      priority: 'Outside expected range',
    });
  });
  it('supports configurable multipliers and validates settings', () => {
    const rows = from([1, 2, 3, 4, 100]);
    expect(
      analyze(rows, { ...defaultSettings, mild: 100, extreme: 101, z: 1000 }).rows.at(-1)!.iqrFlag,
    ).toBe(false);
    for (const settings of [
      { ...defaultSettings, mild: 0 },
      { ...defaultSettings, z: NaN },
      { ...defaultSettings, extreme: 1 },
      { ...defaultSettings, min: 5, max: 4 },
      { ...defaultSettings, min: Infinity },
    ])
      expect(() => analyze(rows, settings)).toThrow();
  });
  it('keeps missing/invalid flags unavailable, without numerical coercion', () => {
    const result = analyze(parseData('A\t\nB\tbad\nC\t0').rows);
    expect(result.summary.n).toBe(1);
    expect(result.rows[0]).toMatchObject({
      iqrFlag: null,
      zScore: null,
      plausible: null,
      priority: 'Invalid or missing value',
    });
  });
  it('has explicit warnings and unavailable checks for unrepresentable quantities', () => {
    const result = analyze(
      from([-Number.MAX_VALUE, -Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE]),
    );
    expect(result.summary.iqr).toBeNull();
    expect(result.mildLow).toBeNull();
    expect(result.rows[0].iqrFlag).toBeNull();
    expect(result.warnings.join(' ')).toMatch(/floating-point/);
  });
  it('synthetic example includes every requested type of observation', () => {
    const result = analyze(parseData(exampleData).rows, { ...defaultSettings, min: 0, max: 10 });
    expect(result.rows).toHaveLength(32);
    expect(result.rows.some((row) => row.iqrFlag && !row.extremeFlag)).toBe(true);
    expect(result.rows.some((row) => row.extremeFlag)).toBe(true);
    expect(result.rows.some((row) => row.plausible === false)).toBe(true);
    expect(result.rows.some((row) => row.status === 'missing')).toBe(true);
    expect(result.rows.some((row) => row.status === 'invalid')).toBe(true);
  });
});
describe('Sensitivity analysis', () => {
  const analysis = analyze(from([1, 2, 3, 4, 100]), { ...defaultSettings, max: 10 });
  it('starts with all valid data and preserves original observations', () => {
    expect(sensitivity(analysis, defaultExclusions).excluded).toBe(0);
    expect(sensitivity(analysis, defaultExclusions).summary).toEqual(analysis.summary);
  });
  it('recomputes statistics and changes after a selected exclusion', () => {
    const result = sensitivity(analysis, { ...defaultExclusions, plausible: true });
    expect(result).toMatchObject({ excluded: 1, percent: 20, medianChange: -0.5 });
    expect(result.meanChange).toBeCloseTo(-19.5, 12);
    expect(result.summary).toMatchObject({ n: 4, mean: 2.5, median: 2.5, min: 1, max: 4 });
    expect(result.summary.sd).toBeCloseTo(Math.sqrt(5 / 3), 12);
  });
  it('uses a union of criteria without double-counting and keeps thresholds fixed', () => {
    const result = sensitivity(analysis, { plausible: true, extreme: true, iqr: true, z: true });
    expect(result.excluded).toBe(1);
    expect(analysis.rows).toHaveLength(5);
    expect(analysis.summary.mean).toBeCloseTo(22, 12);
    expect(analysis.mildHigh).toBe(7);
  });
  it('handles excluding all observations, none, and no numerical data', () => {
    const all = analyze(from([1, 2]), { ...defaultSettings, max: 0 });
    expect(sensitivity(all, { ...defaultExclusions, plausible: true })).toMatchObject({
      excluded: 2,
      percent: 100,
      summary: { n: 0, mean: null },
      meanChange: null,
    });
    expect(sensitivity(analyze([]), defaultExclusions)).toMatchObject({
      excluded: 0,
      percent: 0,
      meanChange: null,
    });
    expect(
      isExcluded(analyze(parseData('A\tbad').rows).rows[0], {
        plausible: true,
        extreme: true,
        iqr: true,
        z: true,
      }),
    ).toBe(false);
  });
});
describe('Local exports and HTML security', () => {
  const parsed = parseData('Sample_ID,Value\n"A,1",2\n"B""2",100\nC,\nD,bad');
  const analysis = analyze(parsed.rows, { ...defaultSettings, max: 10 });
  const variable = { name: '<img src=x onerror=alert(1)>', unit: '"%</style>', synthetic: true };
  it('quotes commas, quotes and newlines with UTF-8 BOM and CRLF', () => {
    expect(csv([['a,b', 'a"b', 'a\nb', 3, null]])).toBe('\uFEFF"a,b","a""b","a\nb","3",""\r\n');
  });
  it('protects spreadsheet formula text while preserving finite numeric text', () => {
    const result = csv([
      ['=SUM(1,2)', '+cmd', '-cmd', '@cmd', '  =1', '\tvalue', '-1.2', '+3', '001'],
    ]);
    expect(result).toContain('"\'=SUM(1,2)"');
    expect(result).toContain('"\'  =1"');
    expect(result).toContain('"-1.2"');
    expect(result).toContain('"+3"');
    expect(result).toContain('"001"');
  });
  it('exports every row, original fields, flags, and current exclusion state', () => {
    const exported = annotatedCsv(analysis, { ...defaultExclusions, plausible: true });
    expect(exported).toContain('"A,1"');
    expect(exported).toContain('"B""2"');
    expect(exported).toContain('excluded_in_sensitivity');
    expect(exported).toContain('"Outside expected range","true"');
    const reparsed = parseData(exported, {
      ...defaultParse,
      header: 'yes',
      idColumn: 1,
      valueColumn: 4,
    });
    expect(reparsed.rows).toHaveLength(4);
    expect(reparsed.rows[0].id).toBe('A,1');
  });
  it('includes missing/invalid observations in the review-only export', () => {
    const rows = parseData(annotatedCsv(analysis, defaultExclusions, true), {
      ...defaultParse,
      header: 'yes',
      idColumn: 1,
      valueColumn: 4,
    }).rows;
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.id)).toEqual(['B"2', 'C', 'D']);
  });
  it('exports full precision and statistical definitions', () => {
    const output = summaryCsv(analysis, parsed, variable, defaultExclusions);
    expect(output).toContain('Hyndman–Fan type 7');
    expect(output).toContain('IQR mild lower fence');
    expect(output).toContain('Sensitivity retained: Mean');
    expect(output).toContain('Modified Z-score absolute threshold');
  });
  it('generates a self-contained report with escaped input and all required sections', () => {
    const html = reportHtml(analysis, parsed, variable, { ...defaultExclusions, plausible: true });
    expect(html).toContain('&lt;img');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script');
    expect(html).toContain('Content-Security-Policy');
    expect(html).toContain('Synthetic demonstration');
    expect(html).toContain('Sensitivity analysis');
    expect(html).toContain('MAD = 0');
    expect(html).toContain('Rows requiring review');
  });
  it('formats unavailable and extreme values and escapes HTML', () => {
    expect(format(null)).toBe('Unavailable');
    expect(format(Infinity)).toBe('Unavailable');
    expect(format(0)).toBe('0');
    expect(format(1e200)).toContain('e+200');
    expect(escapeHtml('<"&\'>')).toBe('&lt;&quot;&amp;&#39;&gt;');
  });
});
