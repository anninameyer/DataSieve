import type { Analysis } from './core';
import { format } from './exports';
import { softwareCitation } from './references';
import {
  omittedReferenceLines,
  figureScale,
  scaleDescription,
  violinBandwidth,
  type PlotScale,
} from './plot-scale';
import { processingDescription } from './processing';

export const defaultPalette = {
  normal: '#0072B2',
  mild: '#E69F00',
  extreme: '#CC79A7',
  outside: '#000000',
  median: '#333333',
  mean: '#777777',
};
export type Palette = typeof defaultPalette;
export type FigureFormat = 'png' | 'tiff' | 'pdf' | 'svg';
/** Undefined uses the automatic text; an empty string intentionally hides a label. */
export interface FigureText {
  title?: string;
  xAxis?: string;
  yAxis?: string;
}
export interface FigureOptions {
  kind: 'histogram' | 'box' | 'sorted' | 'violin';
  scale: PlotScale;
  scope?: 'figure' | 'analysis';
  pseudocount?: number;
  smoothing: number;
  label: string;
  unit?: string;
  text?: FigureText;
  bins: number;
  showMean: boolean;
  showMedian: boolean;
  showGrid: boolean;
  showRange: boolean;
  showIqr: boolean;
  palette: Palette;
  dpi: number;
  widthMm: number;
  heightMm: number;
}

/** Compact exact notation for labels; the full numeric value remains in the audit. */
export function compactConstant(value: number): string {
  if (!Number.isFinite(value)) return 'c';
  if (value === 0 || (Math.abs(value) >= 0.001 && Math.abs(value) < 10000)) return String(value);
  const [mantissa, exponent] = value.toExponential().split('e');
  const superscript: Record<string, string> = {
    '-': '⁻',
    '+': '',
    '0': '⁰',
    '1': '¹',
    '2': '²',
    '3': '³',
    '4': '⁴',
    '5': '⁵',
    '6': '⁶',
    '7': '⁷',
    '8': '⁸',
    '9': '⁹',
  };
  return `${mantissa === '1' ? '' : `${mantissa} × `}10${[...exponent].map((char) => superscript[char]).join('')}`;
}

type TextOptions = Pick<
  FigureOptions,
  'kind' | 'label' | 'unit' | 'scale' | 'pseudocount' | 'text'
>;
export function defaultFigureText(options: TextOptions): Required<FigureText> {
  const measure = options.unit?.trim() || options.label.trim() || 'Value';
  const constant = options.pseudocount ?? 0;
  const value =
    options.scale === 'log10'
      ? `log₁₀(${measure}${constant !== 0 ? ` + ${compactConstant(constant)}` : ''})`
      : options.scale === 'zscore'
        ? 'z-score (unitless)'
        : measure;
  return {
    title: options.label,
    xAxis:
      options.kind === 'histogram'
        ? value
        : options.kind === 'sorted'
          ? 'Observation rank (ordered by value)'
          : '',
    yAxis: options.kind === 'histogram' ? 'Observations' : value,
  };
}
export function resolveFigureText(options: TextOptions): Required<FigureText> {
  const automatic = defaultFigureText(options);
  return {
    title: options.text?.title ?? automatic.title,
    xAxis: options.text?.xAxis ?? automatic.xAxis,
    yAxis: options.text?.yAxis ?? automatic.yAxis,
  };
}
/** Neutral image metadata; credit is provided separately in the downloadable caption. */
export function figureDescription(analysis: Analysis, options: FigureOptions): string {
  const pseudocount = analysis.processing?.pseudocount ?? options.pseudocount ?? 0;
  const upfront = analysis.processing?.scope === 'analysis' && options.scale !== 'none';
  const view = figureScale(analysis, options.scale, pseudocount);
  const density =
    options.kind === 'violin' ? violinBandwidth(view.values, options.smoothing) : null;
  const omitted = omittedReferenceLines(analysis, options.scale, options, pseudocount);
  return [
    `${options.kind === 'box' ? 'Boxplot' : options.kind === 'sorted' ? 'Sorted observations' : options.kind === 'violin' ? 'Violin plot' : 'Histogram'} of ${options.label}.`,
    `Visible figure text: ${JSON.stringify(resolveFigureText(options))}. Custom text changes presentation only; the original variable, units and exact processing settings are recorded independently below.`,
    `All ${analysis.summary.n} valid numerical observations; missing and invalid rows are absent from the figure. No sensitivity exclusions are applied to figures.`,
    analysis.processing
      ? processingDescription(analysis)
      : scaleDescription(analysis, options.scale, pseudocount),
    `${upfront ? 'Statistics, IQR/modified-Z screening and reference summaries use analyzed transformed values. Expected-bound legend values use original units; other reference-line legend values use the analysis scale.' : 'Scaling affects figures only. Screening flags, summaries and sensitivity results use original data and units. Reference lines and box summaries are transformed original statistics, not statistics recalculated on transformed data. Reference-line legend values use original units.'} The value axis is horizontal for histograms and vertical for other plots.`,
    view.error,
    omitted.length
      ? `Reference lines omitted because they cannot be represented on this scale: ${omitted.join(', ')}.`
      : '',
    density
      ? density.error ||
        `Violin: Gaussian KDE on displayed values, f(t) = sum exp(−0.5((t − x)/h)^2) / (n h sqrt(2π)). Bandwidth h = ${density.bandwidth}; smoothing multiplier ${options.smoothing}. Rule: 0.9 × min(sample SD, IQR/1.34) × n^(−1/5) × smoothing, using SD if IQR = 0; final h is at least observed range/100 to bound computation${density.limited ? ' (floor active)' : ''}. Type-7 IQR is computed on displayed values. Width is normalized to peak density, not observation counts; the contour is truncated at the observed extrema, without boundary correction or renormalization. Peaks depend on bandwidth and sample size and do not prove distinct populations. Silverman (1986), Density Estimation for Statistics and Data Analysis, p. 48, eq. 3.31.`
      : '',
    `Quantiles: Hyndman–Fan type 7. Median ${format(analysis.summary.median)}; mean ${format(analysis.summary.mean)}; raw MAD ${format(analysis.summary.mad)}.`,
    `IQR fences: multiplier ${analysis.settings.mild}, [${format(analysis.mildLow)}, ${format(analysis.mildHigh)}]; extreme multiplier ${analysis.settings.extreme}, [${format(analysis.extremeLow)}, ${format(analysis.extremeHigh)}]. Values strictly outside are flagged.`,
    `Modified Z = 0.6745 × (value − median) / MAD; flag |M| > ${analysis.settings.z}. ${analysis.summary.mad === 0 ? 'MAD = 0: this method is unavailable.' : ''}`,
    `Expected bounds (inclusive, original units): minimum ${analysis.settings.min === null ? 'not specified' : format(analysis.settings.min)}, maximum ${analysis.settings.max === null ? 'not specified' : format(analysis.settings.max)}.`,
    `Visible lines: ${options.showMedian ? 'median; ' : ''}${options.showMean ? 'mean; ' : ''}${options.showRange ? 'specified expected bounds; ' : ''}${options.showIqr ? 'IQR fences' : 'IQR fences hidden'}. Horizontal grid lines: ${options.showGrid ? 'shown' : 'hidden'}. ${options.kind === 'histogram' ? `${options.bins} equal-width bins; all valid values counted.` : 'Symbols: circle = no statistical flags; triangle = statistical outlier; square = extreme IQR outlier; diamond = outside expected range. Color/symbol shows highest review priority; multiple row flags may coexist.'}`,
    `Colors: ${Object.entries(options.palette)
      .map(([key, value]) => `${key} ${value}`)
      .join('; ')}.`,
    `Full-precision analysis settings: ${JSON.stringify({ ...analysis.settings, displayScale: options.scale, transformationScope: analysis.processing?.scope ?? options.scope ?? 'figure', pseudocount, zscoreMean: options.scale === 'zscore' ? (analysis.processing?.originalSummary ?? analysis.summary).mean : null, zscoreSampleSD: options.scale === 'zscore' ? (analysis.processing?.originalSummary ?? analysis.summary).sd : null, violinSmoothing: density ? options.smoothing : null, violinBandwidth: density?.bandwidth ?? null, quantileType: 7, mildLower: analysis.mildLow, mildUpper: analysis.mildHigh, extremeLower: analysis.extremeLow, extremeUpper: analysis.extremeHigh, median: analysis.summary.median, mad: analysis.summary.mad })}.`,
    `Print size ${options.widthMm} × ${options.heightMm} mm; raster resolution ${options.dpi} DPI. PDF embeds a lossless raster; SVG is vector. Exports reset zoom to show the full dataset.`,
    'Screening flags do not establish errors or scientifically justify exclusion. Review source records and domain knowledge.',
    ...analysis.warnings,
    'Methods: Hyndman & Fan (1996), DOI 10.1080/00031305.1996.10473566; Tukey (1977), Exploratory Data Analysis; Iglewicz & Hoaglin (1993), How to Detect and Handle Outliers. Default palette adapted from Okabe & Ito, Color Universal Design.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function figureCaption(analysis: Analysis, options: FigureOptions): string {
  return `${figureDescription(analysis, options)}\n\nSoftware citation: ${softwareCitation()}`;
}
