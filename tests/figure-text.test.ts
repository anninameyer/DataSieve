import { expect, it } from 'vitest';
import { analyze, parseData } from '../src/core';
import {
  compactConstant,
  defaultFigureText,
  resolveFigureText,
  figureDescription,
  defaultPalette,
  type FigureOptions,
} from '../src/figure-model';

const options: FigureOptions = {
  kind: 'box',
  label: 'Mannitol dehydrogenase (gene count)',
  unit: 'gene count',
  scale: 'log10',
  pseudocount: 0.00001,
  smoothing: 1,
  bins: 18,
  showMean: false,
  showMedian: true,
  showRange: true,
  showIqr: false,
  showGrid: true,
  palette: defaultPalette,
  dpi: 300,
  widthMm: 180,
  heightMm: 140,
};
it.each([
  [0, '0'],
  [1, '1'],
  [0.01, '0.01'],
  [0.00001, '10⁻⁵'],
  [2.5e-5, '2.5 × 10⁻⁵'],
  [1e-12, '10⁻¹²'],
  [1e4, '10⁴'],
  [1.23456789012345e-6, '1.23456789012345 × 10⁻⁶'],
])('uses compact exact notation for %s', (value, expected) => {
  expect(compactConstant(Number(value))).toBe(expected);
});
it('uses units for short value-axis text and keeps the full variable in the title', () => {
  expect(defaultFigureText(options)).toEqual({
    title: options.label,
    xAxis: '',
    yAxis: 'log₁₀(gene count + 10⁻⁵)',
  });
  expect(defaultFigureText({ ...options, kind: 'histogram' })).toEqual({
    title: options.label,
    xAxis: 'log₁₀(gene count + 10⁻⁵)',
    yAxis: 'Observations',
  });
  expect(defaultFigureText({ ...options, kind: 'sorted' }).xAxis).toBe(
    'Observation rank (ordered by value)',
  );
  expect(defaultFigureText({ ...options, kind: 'violin' }).yAxis).toBe('log₁₀(gene count + 10⁻⁵)');
});
it('handles no units, original scale, zero pseudocount and unitless standardization', () => {
  expect(defaultFigureText({ ...options, label: 'Mass', unit: '' }).yAxis).toBe(
    'log₁₀(Mass + 10⁻⁵)',
  );
  expect(defaultFigureText({ ...options, scale: 'none' }).yAxis).toBe('gene count');
  expect(defaultFigureText({ ...options, scale: 'log10', pseudocount: 0 }).yAxis).toBe(
    'log₁₀(gene count)',
  );
  expect(defaultFigureText({ ...options, scale: 'zscore' }).yAxis).toBe('z-score (unitless)');
  expect(defaultFigureText({ ...options, label: '', unit: '' }).yAxis).toBe('log₁₀(Value + 10⁻⁵)');
});
it('distinguishes automatic defaults, custom labels and intentional hiding', () => {
  expect(
    resolveFigureText({ ...options, text: { title: 'Panel A', xAxis: '', yAxis: 'Abundance' } }),
  ).toEqual({ title: 'Panel A', xAxis: '', yAxis: 'Abundance' });
  expect(resolveFigureText({ ...options, text: { title: '', yAxis: undefined } })).toMatchObject({
    title: '',
    yAxis: 'log₁₀(gene count + 10⁻⁵)',
  });
});
it('retains original scientific identity and exact settings when visible labels are changed', () => {
  const analysis = analyze(parseData('A\t1\nB\t2\nC\t3').rows);
  const snapshot = JSON.stringify(analysis);
  const metadata = figureDescription(analysis, {
    ...options,
    text: { title: 'Panel A', xAxis: 'Group', yAxis: 'Expression' },
  });
  expect(metadata).toContain(options.label);
  expect(metadata).toContain('"title":"Panel A"');
  expect(metadata).toContain('"yAxis":"Expression"');
  expect(metadata).toContain('Pseudocount c = 0.00001');
  expect(metadata).toContain('"pseudocount":0.00001');
  expect(metadata).not.toContain('RangeSieve');
  expect(JSON.stringify(analysis)).toBe(snapshot);
});
