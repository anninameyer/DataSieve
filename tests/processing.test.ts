import { describe, expect, it } from 'vitest';
import { analyze, defaultExclusions, defaultSettings, parseData, sensitivity } from '../src/core';
import { processAnalysis, processingDescription, processingRows } from '../src/processing';
import {
  defaultProcessing,
  processingSettings,
  defaultProcessingInput,
  type ProcessingSettings,
} from '../src/processing-types';
import { figureScale, omittedReferenceLines, plotScale, scaleAxisLabel } from '../src/plot-scale';
import { annotatedRows, reportHtml, summaryRows } from '../src/exports';
import { workbook } from '../src/workbook';
import { defaultPalette, figureDescription, type FigureOptions } from '../src/figure-model';

const parsed = parseData('Sample_ID\tValue\n001\t0\n002\t9\n003\t99\n004\tNA\n005\tbad');
const log: ProcessingSettings = { scale: 'log10', scope: 'analysis', pseudocount: 1 };
const variable = { name: 'Mass', unit: 'mg', synthetic: false };
const options: FigureOptions = {
  kind: 'box',
  scale: 'log10',
  scope: 'analysis',
  pseudocount: 1,
  smoothing: 1,
  label: 'Mass (mg)',
  bins: 18,
  showMean: true,
  showMedian: true,
  showGrid: true,
  showRange: true,
  showIqr: true,
  palette: defaultPalette,
  dpi: 300,
  widthMm: 180,
  heightMm: 140,
};

describe('Pseudocount transformations', () => {
  it('adds a chosen constant to every valid value while retaining zero observations', () => {
    const original = analyze(parseData('A\t0\nB\t1\nC\t9').rows);
    const view = plotScale(original, 'log10', 1);
    expect(view.error).toBe('');
    expect(view.values).toEqual([0, Math.log10(2), 1]);
    expect(view.transform(0)).toBe(0);
    expect(scaleAxisLabel('Mass (mg)', 'log10', 0.01)).toBe('log10(Mass (mg) + 0.01)');
  });
  it.each([-1, NaN, Infinity])('rejects invalid pseudocount %s even without valid input', (c) => {
    expect(plotScale(analyze([]), 'log10', c).error).toContain('finite, nonnegative');
    expect(plotScale(analyze(parsed.rows), 'log10', c).error).toContain('finite, nonnegative');
  });
  it('requires every shifted value to be positive, without silently removing records', () => {
    const rows = parseData('A\t-1\nB\t0\nC\t9').rows;
    expect(processAnalysis(rows, defaultSettings, log).processing!.error).toContain(
      'zero or negative after this addition',
    );
    expect(processAnalysis(rows, defaultSettings, { ...log, pseudocount: 2 }).summary.n).toBe(3);
  });
  it('avoids overflowing addition when the resulting logarithm is representable', () => {
    const original = analyze(parseData('A\t1e308').rows);
    expect(plotScale(original, 'log10', 1e308).values[0]).toBeCloseTo(308 + Math.log10(2), 12);
    expect(plotScale(analyze(parseData('A\t0\nB\t1').rows), 'log10', 1e-300).values).toEqual([
      -300, 0,
    ]);
  });
  it('does not retain inactive pseudocounts and rejects blank enabled values', () => {
    expect(
      processingSettings({
        ...defaultProcessingInput,
        scale: 'zscore',
        addPseudocount: true,
        pseudocount: '1',
      }).pseudocount,
    ).toBe(0);
    expect(
      processingSettings({
        ...defaultProcessingInput,
        scale: 'log10',
        addPseudocount: true,
        pseudocount: '',
      }).pseudocount,
    ).toBeNaN();
  });
});

describe('Explicit scientific processing order', () => {
  it('leaves original statistics/flags unchanged in figures-only mode', () => {
    const original = analyze(parsed.rows);
    const result = processAnalysis(parsed.rows, defaultSettings, { ...log, scope: 'figure' });
    expect(result.summary).toEqual(original.summary);
    expect(result.rows).toEqual(original.rows);
    expect(result.processing!.formula).toContain('log10(value + 1)');
    expect(figureScale(result, 'log10', 1).transform(result.summary.mean)).toBeCloseTo(
      Math.log10(37),
    );
  });
  it('calculates statistics on transformed values without altering input or invalid/missing rows', () => {
    const snapshot = JSON.stringify(parsed);
    const result = processAnalysis(parsed.rows, defaultSettings, log);
    expect(result.summary).toMatchObject({
      n: 3,
      mean: 1,
      median: 1,
      sd: 1,
      q1: 0.5,
      q3: 1.5,
      mad: 1,
    });
    expect(result.rows.map((row) => row.value)).toEqual([0, 1, 2, null, null]);
    expect(result.rows.map((row) => row.rawValue)).toEqual([0, 9, 99, null, null]);
    expect(result.rows[0].id).toBe('001');
    expect(result.rows[3].status).toBe('missing');
    expect(result.rows[4].status).toBe('invalid');
    expect(JSON.stringify(parsed)).toBe(snapshot);
    expect(figureScale(result, 'log10', 1).values).toEqual([0, 1, 2]);
    expect(figureScale(result, 'log10', 1).transform(result.summary.mean)).toBe(1);
  });
  it('refits statistical screening on logged values, but preserves original-unit plausibility and priority', () => {
    const rows = parseData('A\t1\nB\t10\nC\t100\nD\t1000').rows;
    const settings = { ...defaultSettings, min: 0, max: 999 };
    expect(analyze(rows, settings).rows[3].iqrFlag).toBe(true);
    const result = processAnalysis(rows, settings, { ...log, pseudocount: 0 });
    expect(result.rows[3]).toMatchObject({
      iqrFlag: false,
      zFlag: false,
      plausible: false,
      priority: 'Outside expected range',
    });
    expect(result.summary.q1).toBe(0.75);
    expect(result.processing!.boundPositions).toEqual({ min: null, max: Math.log10(999) });
    expect(result.settings).toEqual(settings);
    expect(omittedReferenceLines(result, 'log10', options)).toEqual(['expected minimum']);
  });
  it('keeps z-score parameters fixed when sensitivity exclusions change', () => {
    const rows = parseData('A\t1\nB\t2\nC\t100').rows;
    const settings = { ...defaultSettings, max: 2 };
    const result = processAnalysis(rows, settings, {
      ...defaultProcessing,
      scope: 'analysis',
      scale: 'zscore',
    });
    expect(result.summary.mean).toBeCloseTo(0, 14);
    expect(result.summary.sd).toBeCloseTo(1, 14);
    const comparison = sensitivity(result, { ...defaultExclusions, plausible: true });
    const { mean, sd } = result.processing!.originalSummary;
    expect(comparison.summary.mean).toBeCloseTo((1.5 - mean!) / sd!, 14);
    expect(comparison.summary.sd).toBeCloseTo(Math.SQRT1_2 / sd!, 14);
    expect(comparison.summary.mean).not.toBe(0);
    expect(result.processing!.originalSummary.n).toBe(3);
    expect(comparison.excluded).toBe(1);
    const refitted = processAnalysis(rows.slice(0, 2), settings, {
      ...defaultProcessing,
      scope: 'analysis',
      scale: 'zscore',
    });
    expect(refitted.processing!.originalSummary.n).toBe(2);
    expect(refitted.summary.sd).toBeCloseTo(1);
  });
  it('standardization preserves the statistical screening decisions to numerical tolerance', () => {
    const rows = parseData('A\t-10\nB\t1\nC\t2\nD\t3\nE\t4\nF\t100').rows;
    const original = analyze(rows);
    const transformed = processAnalysis(rows, defaultSettings, {
      ...defaultProcessing,
      scope: 'analysis',
      scale: 'zscore',
    });
    expect(transformed.rows.map((row) => [row.iqrFlag, row.extremeFlag, row.zFlag])).toEqual(
      original.rows.map((row) => [row.iqrFlag, row.extremeFlag, row.zFlag]),
    );
  });
  it('blocks unavailable upfront analysis rather than substituting original-scale results', () => {
    const invalid = processAnalysis(parsed.rows, defaultSettings, { ...log, pseudocount: 0 });
    expect(invalid.summary.n).toBe(0);
    expect(invalid.rows).toEqual([]);
    expect(invalid.processing!.originalSummary.n).toBe(3);
    expect(figureScale(invalid, 'log10').error).toContain('positive');
    expect(
      processAnalysis(parsed.rows, defaultSettings, { ...log, scope: 'figure', pseudocount: 0 })
        .summary.n,
    ).toBe(3);
    const constant = processAnalysis(parseData('A\t7\nB\t7').rows, defaultSettings, {
      ...defaultProcessing,
      scope: 'analysis',
      scale: 'zscore',
    });
    expect(constant.processing!.error).toContain('positive sample SD');
  });
  it('none uses original values regardless of scope', () => {
    for (const scope of ['figure', 'analysis'] as const) {
      const result = processAnalysis(parsed.rows, defaultSettings, { ...defaultProcessing, scope });
      expect(result.summary.mean).toBeCloseTo(36, 12);
      expect(processingDescription(result)).toContain('No transformation');
    }
  });
});

describe('Processing audit in all scientific exports', () => {
  it('keeps original-data workbooks exportable when a figure-only pseudocount is invalid', () => {
    const result = processAnalysis(parsed.rows, defaultSettings, {
      ...log,
      scope: 'figure',
      pseudocount: NaN,
    });
    expect(result.summary.n).toBe(3);
    expect(processingDescription(result)).toContain('pseudocount invalid or not supplied');
    expect(() =>
      workbook([
        { name: 'Settings', rows: processingRows(result) },
        { name: 'Observations', rows: annotatedRows(result, defaultExclusions) },
      ]),
    ).not.toThrow();
    expect(processingRows(result).flat()).toContain('Invalid / not supplied');
  });
  const result = processAnalysis(parsed.rows, { ...defaultSettings, min: 0, max: 10 }, log);
  it('exports parsed originals and analysis values separately with scope and parameters', () => {
    const [headers, ...data] = annotatedRows(result, defaultExclusions);
    const row = Object.fromEntries(headers.map((header, i) => [String(header), data[1][i]]));
    expect(row).toMatchObject({
      original_value: '9',
      parsed_value: 9,
      analysis_value: 1,
      statistics_scale: 'log10',
      figure_transformation: 'log10',
      transformation_scope: 'analysis',
      log10_pseudocount: 1,
      expected_range_scale: 'original',
    });
    const settings = Object.fromEntries(
      summaryRows(result, parsed, variable, defaultExclusions) as [string, unknown][],
    );
    expect(settings['Statistics scale / label']).toBe('log10(Mass + 1)');
    expect(settings['Expected maximum (inclusive, original units)']).toBe(10);
    expect(settings['Processing order and interpretation']).toContain('parse → transform');
    expect(processingRows(result).flat().join(' ')).toContain('not refitted');
  });
  it('reports actual processing and labels without branding figures', () => {
    const text = figureDescription(result, options);
    expect(text).toContain('parse → transform');
    expect(text).toContain('Pseudocount c = 1');
    expect(text).toContain('"transformationScope":"analysis"');
    expect(text).toContain('Median 1; mean 1');
    expect(text).not.toContain('Scaling affects figures only');
    expect(text).not.toContain('RangeSieve');
    const report = reportHtml(result, parsed, variable, defaultExclusions);
    expect(report).toContain('transform all valid values');
    expect(report).toContain('log10(Mass + 1)');
    expect(report).toContain('Pseudocount c = 1');
  });
});
