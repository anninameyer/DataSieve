import {
  type Analysis,
  type Exclusions,
  type Parsed,
  type Summary,
  isExcluded,
  sensitivity,
  numeric,
} from './core';
import { methodText, references, softwareCitation } from './references';
export { methodText } from './references';

export interface Variable {
  name: string;
  unit: string;
  synthetic: boolean;
}
export const summaryLabels: [keyof Summary, string][] = [
  ['n', 'Valid observations'],
  ['mean', 'Mean'],
  ['median', 'Median'],
  ['sd', 'Sample standard deviation'],
  ['min', 'Minimum'],
  ['max', 'Maximum'],
  ['q1', 'Q1 (25th percentile)'],
  ['q3', 'Q3 (75th percentile)'],
  ['iqr', 'Interquartile range'],
  ['p1', '1st percentile'],
  ['p5', '5th percentile'],
  ['p95', '95th percentile'],
  ['p99', '99th percentile'],
  ['mad', 'Median absolute deviation'],
];
export function format(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'Unavailable';
  if (value === 0) return '0';
  return Math.abs(value) < 0.001 || Math.abs(value) >= 1e7
    ? value.toExponential(4)
    : new Intl.NumberFormat('en', { maximumSignificantDigits: 7 }).format(value);
}
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );
}
/** RFC 4180 quoting plus spreadsheet formula protection for text cells. */
export function csv(rows: unknown[][]): string {
  return delimited(rows, ',');
}
export function delimited(rows: unknown[][], separator: ',' | '\t'): string {
  return (
    '\uFEFF' +
    rows
      .map((row) =>
        row
          .map((value) => {
            let text = value === null || value === undefined ? '' : String(value);
            if (
              typeof value === 'string' &&
              ((/^[\s]*[=+\-@]/.test(text) && numeric(text).status !== 'valid') ||
                /^[\t\r\n]/.test(text))
            )
              text = "'" + text;
            return `"${text.replaceAll('"', '""')}"`;
          })
          .join(separator),
      )
      .join('\r\n') +
    '\r\n'
  );
}
function indicator(value: boolean | null): string {
  return value === null ? 'Unavailable' : value ? 'Yes' : 'No';
}
export function annotatedCsv(
  analysis: Analysis,
  criteria: Exclusions,
  flaggedOnly = false,
): string {
  return csv(annotatedRows(analysis, criteria, flaggedOnly));
}
export function annotatedRows(
  analysis: Analysis,
  criteria: Exclusions,
  flaggedOnly = false,
): unknown[][] {
  const rows = flaggedOnly
    ? analysis.rows.filter((row) => row.priority !== 'No statistical flags')
    : analysis.rows;
  return [
    [
      'source_row',
      'original_sample_identifier',
      'display_identifier',
      'original_value',
      'parsed_value',
      'value_status',
      'parsing_issue',
      'iqr_outlier',
      'extreme_iqr_outlier',
      'modified_z_score',
      'modified_z_outlier',
      'within_expected_range',
      'review_classification',
      'excluded_in_sensitivity',
    ],
    ...rows.map((row) => [
      row.row,
      row.originalId,
      row.id,
      row.original,
      row.value,
      row.status,
      row.issue,
      indicator(row.iqrFlag),
      indicator(row.extremeFlag),
      row.zScore,
      indicator(row.zFlag),
      row.plausible === null
        ? analysis.settings.min === null && analysis.settings.max === null
          ? 'Not specified'
          : 'Unavailable'
        : indicator(row.plausible),
      row.priority,
      isExcluded(row, criteria),
    ]),
  ];
}
export function summaryRows(
  analysis: Analysis,
  parsed: Parsed,
  variable: Variable,
  criteria: Exclusions,
): unknown[][] {
  const comparison = sensitivity(analysis, criteria);
  return [
    ['Variable', variable.name],
    ['Unit', variable.unit],
    ['Synthetic example', variable.synthetic],
    ['Quantiles', 'Hyndman–Fan type 7; h = (n−1)p; linear interpolation'],
    ['Standard deviation', 'Sample; denominator n−1'],
    ['Input rows (excluding header and blank lines)', parsed.rows.length],
    ['Missing', parsed.rows.filter((row) => row.status === 'missing').length],
    ['Invalid', parsed.rows.filter((row) => row.status === 'invalid').length],
    ['Delimiter', parsed.delimiter],
    ['Headers present', parsed.hasHeader],
    ...summaryLabels.map(([key, label]) => [label, analysis.summary[key]]),
    ['IQR mild multiplier', analysis.settings.mild],
    ['IQR extreme multiplier', analysis.settings.extreme],
    ['IQR mild lower fence', analysis.mildLow],
    ['IQR mild upper fence', analysis.mildHigh],
    ['IQR extreme lower fence', analysis.extremeLow],
    ['IQR extreme upper fence', analysis.extremeHigh],
    ['Modified Z-score absolute threshold', analysis.settings.z],
    ['Expected minimum (inclusive)', analysis.settings.min],
    ['Expected maximum (inclusive)', analysis.settings.max],
    [
      'Rows requiring review (includes missing/invalid)',
      analysis.rows.filter((row) => row.priority !== 'No statistical flags').length,
    ],
    ...Object.entries(criteria).map(([key, selected]) => [`Sensitivity exclude ${key}`, selected]),
    ...summaryLabels
      .filter(([key]) => ['n', 'mean', 'median', 'sd', 'min', 'max'].includes(key))
      .map(([key, label]) => [`Sensitivity retained: ${label}`, comparison.summary[key]]),
    ['Excluded valid observations', comparison.excluded],
    ['Excluded valid observations (%)', comparison.percent],
    ['Change in mean (retained − all)', comparison.meanChange],
    ['Change in median (retained − all)', comparison.medianChange],
    ['Warnings', [...parsed.issues, ...analysis.warnings].join(' | ')],
    [
      'Interpretation',
      'Exploratory screening only. A statistical outlier or range violation is not a confirmed error.',
    ],
    [
      'CSV text protection',
      'Potential spreadsheet formulas in text fields receive a leading apostrophe. Numerical fields retain their numeric text.',
    ],
  ];
}
export function summaryCsv(
  analysis: Analysis,
  parsed: Parsed,
  variable: Variable,
  criteria: Exclusions,
): string {
  return csv([
    ['Statistic or setting', 'Value (blank = unavailable or not specified)'],
    ...summaryRows(analysis, parsed, variable, criteria),
  ]);
}
export function reportHtml(
  analysis: Analysis,
  parsed: Parsed,
  variable: Variable,
  criteria: Exclusions,
): string {
  const tr = (cells: unknown[], tag = 'td') =>
    `<tr>${cells.map((cell) => `<${tag}>${escapeHtml(cell === null || cell === undefined ? 'Unavailable / not specified' : cell)}</${tag}>`).join('')}</tr>`;
  const comparison = sensitivity(analysis, criteria);
  const compareRows = (['n', 'mean', 'median', 'sd', 'min', 'max'] as const).map((key) =>
    tr([
      summaryLabels.find(([k]) => k === key)![1],
      format(analysis.summary[key]),
      format(comparison.summary[key]),
    ]),
  );
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>DataSieve analysis report</title><style>body{font:16px/1.6 system-ui,sans-serif;color:#203b36;max-width:1000px;margin:48px auto;padding:0 24px}h1,h2{line-height:1.2}table{border-collapse:collapse;width:100%;margin:20px 0}td,th{padding:9px 12px;text-align:left;border-bottom:1px solid #d5ded9;overflow-wrap:anywhere}th{background:#eff4f1}p{max-width:85ch}.notice{padding:16px;background:#eff4f1}footer{margin-top:40px;font-size:13px}@media print{body{margin:0}tr{break-inside:avoid}}</style></head><body><h1>DataSieve · Analysis report</h1><p>${escapeHtml(variable.name || 'Unnamed variable')}${variable.unit ? ` (${escapeHtml(variable.unit)})` : ''} · ${new Date().toISOString()} · v1.0.0</p>${variable.synthetic ? '<p class="notice">Synthetic demonstration data. Not research observations.</p>' : ''}<p class="notice">Exploratory screening only. Statistical extremeness and plausibility violations do not establish a reporting error. Your data stays in your browser. All analyses run locally. No research data is uploaded or stored.</p><h2>Descriptive statistics and analysis settings</h2><table>${tr(['Statistic or setting', 'Value'], 'th')}${summaryRows(
    analysis,
    parsed,
    variable,
    criteria,
  )
    .map((row) => tr(row))
    .join(
      '',
    )}</table><h2>Sensitivity analysis</h2><p>Exploratory exclusion using the union of selected rules, with thresholds fixed to the full dataset. ${comparison.excluded} valid observation(s) excluded (${format(comparison.percent)}%). Change in mean: ${format(comparison.meanChange)}; change in median: ${format(comparison.medianChange)}.</p><table>${tr(['Measure', 'All valid', 'Retained'], 'th')}${compareRows.join('')}</table><h2>Definitions and limitations</h2>${methodText.map(([title, explanation]) => `<h3>${escapeHtml(title)}</h3><p>${escapeHtml(explanation)}</p>`).join('')}<h2>Cite DataSieve</h2><p>${escapeHtml(softwareCitation())}</p><h2>Method and software references</h2><ul>${references.map((reference) => `<li>${escapeHtml(reference.title)} <a href="${escapeHtml(reference.url)}">Source</a>. ${escapeHtml(reference.use)}</li>`).join('')}</ul><footer>Generated entirely locally by DataSieve. This report contains dataset summaries; share only as intended. CSV exports preserve original values, with leading apostrophes protecting text that spreadsheet software could execute as formulas.</footer></body></html>`;
}
export function download(
  filename: string,
  content: string | Uint8Array | Blob,
  mime: string,
): void {
  const url = URL.createObjectURL(
    new Blob([content instanceof Uint8Array ? new Uint8Array(content).buffer : content], {
      type: mime,
    }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
