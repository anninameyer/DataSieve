import { describe, expect, it } from 'vitest';
import { analyze, defaultSettings, parseData, summarize } from '../src/core';
import {
  omittedReferenceLines,
  plotScale,
  scaleAxisLabel,
  scaleDescription,
  violinBandwidth,
} from '../src/plot-scale';
import { defaultPalette, figureDescription, type FigureOptions } from '../src/figure-model';

function analysis(values: number[]) {
  return analyze(parseData(values.map((value, i) => `S${i}\t${value}`).join('\n')).rows);
}
describe('Figure display transformations', () => {
  it('defaults to unchanged values and preserves data and scientific decisions', () => {
    const original = analysis([1, 2, 3, 4, 100]);
    const snapshot = JSON.stringify(original);
    expect(plotScale(original, 'none').values).toEqual([1, 2, 3, 4, 100]);
    for (const scale of ['none', 'log10', 'zscore'] as const) plotScale(original, scale);
    expect(JSON.stringify(original)).toBe(snapshot);
    expect(scaleAxisLabel('Salt (%)', 'none')).toBe('Salt (%)');
  });
  it('uses base-10 values and transforms original reference statistics, including interpolated quartiles', () => {
    const original = analysis([1, 10, 100, 1000]);
    const view = plotScale(original, 'log10');
    expect(view.values).toEqual([0, 1, 2, 3]);
    expect(view.transform(original.summary.mean)).toBeCloseTo(Math.log10(277.75));
    expect(view.transform(original.summary.q1)).toBeCloseTo(Math.log10(7.75));
    expect(view.transform(original.summary.q1)).not.toBe(summarize(view.values).q1);
    expect(scaleAxisLabel('Mass (mg)', 'log10')).toBe('log10(Mass (mg))');
  });
  it.each([
    [0, 1],
    [-1, 1],
    [-1, 0, 10],
  ])('rejects all of a log view with nonpositive values: %j', (...values) => {
    const view = plotScale(analysis(values), 'log10');
    expect(view.error).toContain('Log10 requires positive values');
    expect(view.values).toEqual([]);
  });
  it('excludes only already-invalid/missing input rows and handles extreme positive magnitudes', () => {
    const original = analyze(parseData('A\t1e-300\nB\t1e300\nC\tNA\nD\tbad').rows);
    expect(plotScale(original, 'log10')).toMatchObject({ values: [-300, 300], error: '' });
  });
  it('standardizes using full-data mean and sample SD, not MAD or population SD', () => {
    const original = analysis([1, 2, 3]);
    const view = plotScale(original, 'zscore');
    expect(view.values).toEqual([-1, 0, 1]);
    expect(view.transform(4)).toBe(2);
    expect(summarize(view.values).sd).toBe(1);
    expect(scaleAxisLabel('Salt (%)', 'zscore')).toContain('unitless');
    expect(scaleDescription(original, 'zscore')).toContain('sample SD');
  });
  it.each([[1], [7, 7, 7]])('reports unavailable z-score scaling explicitly: %j', (...values) => {
    expect(plotScale(analysis(values), 'zscore').error).toContain('positive sample SD');
  });
  it('avoids overflow in z-score subtraction when a finite SD is available', () => {
    const original = analysis([-1e308, -1e308, -1e308, 1e308]);
    const view = plotScale(original, 'zscore');
    expect(view.error).toBe('');
    expect(view.values).toHaveLength(4);
    expect(view.values[3]).toBeCloseTo(1.5);
  });
  it('empty data is an empty view for every scale', () => {
    for (const scale of ['none', 'log10', 'zscore'] as const)
      expect(plotScale(analysis([]), scale)).toMatchObject({ error: '', values: [] });
  });
  it('identifies only enabled nonrepresentable reference lines', () => {
    const original = analyze(parseData('A\t1\nB\t2\nC\t3\nD\t4\nE\t10').rows, {
      ...defaultSettings,
      min: 0,
      max: 10,
    });
    expect(
      omittedReferenceLines(original, 'log10', {
        showRange: true,
        showIqr: true,
        showMean: true,
        showMedian: true,
      }),
    ).toEqual(['expected minimum', 'mild lower fence', 'extreme lower fence']);
    expect(
      omittedReferenceLines(original, 'log10', {
        showRange: false,
        showIqr: false,
        showMean: true,
        showMedian: true,
      }),
    ).toEqual([]);
  });
});

describe('Explicit Gaussian violin bandwidth', () => {
  it('matches a hand-calculated Silverman 0.9 bandwidth with type-7 IQR', () => {
    // [1,2,3,4,5]: sample SD=sqrt(2.5), IQR=2, A=2/1.34.
    const expected = 0.9 * (2 / 1.34) * 5 ** -0.2;
    expect(violinBandwidth([1, 2, 3, 4, 5], 1).bandwidth).toBeCloseTo(expected, 14);
    expect(violinBandwidth([1, 2, 3, 4, 5], 0.5).bandwidth).toBeCloseTo(expected / 2, 14);
  });
  it('uses sample SD when IQR is zero and reports the computational floor', () => {
    const tied = [0, 0, 0, 0, 1];
    expect(violinBandwidth(tied, 1).bandwidth).toBeCloseTo(0.9 * Math.sqrt(0.2) * 5 ** -0.2);
    const sparse = [...Array.from({ length: 100 }, (_, i) => i / 10000), 1e6];
    expect(violinBandwidth(sparse, 0.25)).toMatchObject({ bandwidth: 10000, limited: true });
  });
  it.each([[], [1], [3, 3, 3]])(
    'does not invent a density for insufficient spread: %j',
    (...values) => {
      expect(violinBandwidth(values, 1).bandwidth).toBeNull();
      expect(violinBandwidth(values, 1).error).toContain('distinct values');
    },
  );
  it('rejects invalid smoothing and nonrepresentable spans explicitly', () => {
    for (const smoothing of [0, -1, NaN, 3])
      expect(() => violinBandwidth([1, 2], smoothing)).toThrow();
    expect(violinBandwidth([-1e308, 1e308], 1).error).toContain('numerical scale');
  });
  it('records reproducible scale parameters, omissions and smoothing without figure branding', () => {
    const original = analyze(parseData('A\t1\nB\t10\nC\t100').rows, { ...defaultSettings, min: 0 });
    const options: FigureOptions = {
      kind: 'violin',
      scale: 'log10',
      smoothing: 0.5,
      label: 'Mass (mg)',
      bins: 18,
      showMean: true,
      showMedian: true,
      showGrid: false,
      showRange: true,
      showIqr: false,
      palette: defaultPalette,
      dpi: 300,
      widthMm: 180,
      heightMm: 140,
    };
    const caption = figureDescription(original, options);
    expect(caption).toContain('Violin plot');
    expect(caption).toContain('log10(value)');
    expect(caption).toContain('expected minimum');
    expect(caption).toContain('smoothing multiplier 0.5');
    expect(caption).toContain('Silverman (1986)');
    expect(caption).not.toContain('RangeSieve');
    expect(figureDescription(original, { ...options, scale: 'zscore' })).toContain(
      `sample SD = ${original.summary.sd}`,
    );
  });
});
