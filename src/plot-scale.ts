import { type Analysis, summarize } from './core';

export type PlotScale = 'none' | 'log10' | 'zscore';

/** Display transformations only: never refit flags, bounds or sensitivity results. */
export function plotScale(analysis: Analysis, scale: PlotScale) {
  const raw = analysis.rows.filter((row) => row.status === 'valid').map((row) => row.value!);
  const { mean, sd } = analysis.summary;
  const nonpositive = raw.filter((value) => value <= 0).length;
  const error =
    !raw.length || scale === 'none'
      ? ''
      : scale === 'log10' && nonpositive
        ? `Log10 requires positive values. ${nonpositive} valid observation${nonpositive === 1 ? ' is' : 's are'} zero or negative. Choose another scale; no observations have been removed.`
        : scale === 'zscore' && (mean === null || sd === null || sd <= 0)
          ? 'Z-score scaling requires at least two observations and a finite, positive sample SD. Choose another scale for this dataset.'
          : '';
  function transform(value: number | null): number | null {
    if (value === null || error || !Number.isFinite(value)) return null;
    const result =
      scale === 'log10'
        ? value > 0
          ? Math.log10(value)
          : NaN
        : scale === 'zscore'
          ? Number.isFinite(value - mean!)
            ? (value - mean!) / sd!
            : value / sd! - mean! / sd!
          : value;
    return Number.isFinite(result) ? result : null;
  }
  const values = error ? [] : raw.map(transform);
  const numericError = values.some((value) => value === null)
    ? 'This transformation exceeds numerical precision. Choose another scale or measurement unit.'
    : '';
  return {
    transform,
    values: values.filter((value): value is number => value !== null),
    error: error || numericError,
  };
}

export function scaleAxisLabel(label: string, scale: PlotScale) {
  return scale === 'log10'
    ? `log10(${label})`
    : scale === 'zscore'
      ? `${label} — z-score (unitless)`
      : label;
}

export function scaleDescription(analysis: Analysis, scale: PlotScale) {
  if (scale === 'log10')
    return 'Display scale: log10(value), using the entered numerical units. All valid values must be positive; no offset or pseudocount is added.';
  if (scale === 'zscore')
    return `Display scale: z = (value − full-data mean) / full-data sample SD (n − 1 denominator); unitless. Mean = ${analysis.summary.mean}; sample SD = ${analysis.summary.sd}. This is different from the modified Z-score used for screening.`;
  return 'Display scale: none (original values and units).';
}

/** Gaussian KDE bandwidth; a floor bounds Plotly's evaluation work for 50,000 rows. */
export function violinBandwidth(values: number[], smoothing: number) {
  if (!Number.isFinite(smoothing) || smoothing < 0.25 || smoothing > 2)
    throw new Error('Violin smoothing must be between 0.25 and 2.');
  const summary = summarize(values);
  if (summary.n < 2 || summary.min === summary.max)
    return {
      bandwidth: null,
      limited: false,
      error:
        'A violin density requires at least two distinct values. Individual observations are still shown.',
    };
  const span = summary.max! - summary.min!;
  if (!Number.isFinite(span) || summary.sd === null || summary.sd <= 0)
    return {
      bandwidth: null,
      limited: false,
      error:
        'A violin density is unavailable at this numerical scale. Try another display scale or measurement unit.',
    };
  const spread = summary.iqr! > 0 ? Math.min(summary.sd, summary.iqr! / 1.34) : summary.sd;
  const requested = 0.9 * spread * summary.n ** -0.2 * smoothing;
  const floor = span / 100;
  return { bandwidth: Math.max(requested, floor), limited: requested < floor, error: '' };
}

export function omittedReferenceLines(
  analysis: Analysis,
  scale: PlotScale,
  visible: { showRange: boolean; showIqr: boolean; showMean: boolean; showMedian: boolean },
) {
  const view = plotScale(analysis, scale);
  if (view.error) return [];
  const candidates: [string, number | null][] = [
    ...(visible.showRange
      ? ([
          ['expected minimum', analysis.settings.min],
          ['expected maximum', analysis.settings.max],
        ] as [string, number | null][])
      : []),
    ...(visible.showIqr
      ? ([
          ['mild lower fence', analysis.mildLow],
          ['mild upper fence', analysis.mildHigh],
          ['extreme lower fence', analysis.extremeLow],
          ['extreme upper fence', analysis.extremeHigh],
        ] as [string, number | null][])
      : []),
    ...(visible.showMean ? ([['mean', analysis.summary.mean]] as [string, number | null][]) : []),
    ...(visible.showMedian
      ? ([['median', analysis.summary.median]] as [string, number | null][])
      : []),
  ];
  return candidates
    .filter(([, value]) => value !== null && view.transform(value) === null)
    .map(([name]) => name);
}
