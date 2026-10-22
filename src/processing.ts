import { analyze, type Analysis, type Observation, type Settings } from './core';
import { plotScale, scaleDescription } from './plot-scale';
import { type ProcessingSettings, type ProcessingRecord } from './processing-types';

/** Original plausibility is independent of the scale used to fit statistical screens. */
export function processAnalysis(
  rows: Observation[],
  settings: Settings,
  config: ProcessingSettings,
): Analysis {
  const original = analyze(rows, settings);
  const pseudocount = config.scale === 'log10' ? config.pseudocount : 0;
  const view = plotScale(original, config.scale, pseudocount);
  const processing: ProcessingRecord = {
    ...config,
    pseudocount,
    originalSummary: original.summary,
    error: view.error,
    formula:
      Number.isFinite(pseudocount) && pseudocount >= 0
        ? scaleDescription(original, config.scale, pseudocount)
        : 'Transformation: log10(value + c), requested pseudocount invalid or not supplied.',
    boundPositions: { min: view.transform(settings.min), max: view.transform(settings.max) },
  };
  if (config.scope === 'figure' || config.scale === 'none') return { ...original, processing };
  if (view.error) return { ...analyze([], settings), processing };
  const transformed = analyze(
    rows.map((row) => ({
      ...row,
      rawValue: row.value,
      value: row.status === 'valid' ? view.transform(row.value) : row.value,
    })),
    { ...settings, min: null, max: null },
  );
  return {
    ...transformed,
    settings,
    processing,
    rows: transformed.rows.map((row, index) => {
      const plausible = original.rows[index].plausible;
      const priority =
        row.status !== 'valid'
          ? 'Invalid or missing value'
          : plausible === false
            ? 'Outside expected range'
            : row.extremeFlag
              ? 'Extreme statistical outlier'
              : row.iqrFlag || row.zFlag
                ? 'Statistical outlier'
                : 'No statistical flags';
      return { ...row, plausible, priority };
    }),
  };
}

export function processingDescription(analysis: Analysis) {
  const record = analysis.processing;
  if (!record) return 'No transformation. Statistics, screening and figures use original values.';
  const { scope, scale } = record;
  const order =
    scale === 'none'
      ? 'No transformation: statistics, screening and figures use original values.'
      : scope === 'analysis'
        ? 'Order: parse → transform all valid values → calculate statistics and screening flags → compare sensitivity exclusions using the same transformed values. Figures show the analyzed values; they are not transformed a second time. Means, SD, quartiles, MAD and IQR/modified-Z flags are calculated on the transformed scale. Transformation parameters are fitted once to all valid input observations and are not refitted after exclusions.'
        : 'Order: parse → calculate statistics and screening flags on original values → compare sensitivity exclusions on original values; transform figures only. Reference lines and box summaries mark transformed original statistics, not statistics recalculated on transformed data.';
  return `${order} ${record.formula} Expected bounds are entered and checked in original units, independently of transformation; any drawn bounds are mapped to the figure scale. Original identifiers and values are preserved. ${record.error ? `Transformation unavailable: ${record.error}` : ''}`;
}

/** Shared, full-precision processing audit for reports and spreadsheet exports. */
export function processingRows(analysis: Analysis): unknown[][] {
  const record = analysis.processing;
  return [
    ['Processing order and interpretation', processingDescription(analysis)],
    ['Transformation scope', record?.scope ?? 'figure'],
    ['Transformation', record?.scale ?? 'none'],
    [
      'Log10 pseudocount (added to every value, original units)',
      Number.isFinite(record?.pseudocount ?? 0)
        ? (record?.pseudocount ?? 0)
        : 'Invalid / not supplied',
    ],
    ['Statistics and screening scale', record?.scope === 'analysis' ? record.scale : 'original'],
    ['Expected-bound assessment scale', 'Original values and units'],
    [
      'Z-score centering mean (original full data)',
      record?.scale === 'zscore' ? record.originalSummary.mean : null,
    ],
    [
      'Z-score sample SD (original full data)',
      record?.scale === 'zscore' ? record.originalSummary.sd : null,
    ],
    ['Transformation error', record?.error || 'None'],
  ];
}
