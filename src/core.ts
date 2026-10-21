/** Pure, deterministic analysis. No browser APIs, persistence, or network access. */
export type Delimiter = 'auto' | 'tab' | 'comma' | 'semicolon' | 'whitespace' | 'single';
export type Header = 'auto' | 'yes' | 'no';
export interface ParseOptions {
  delimiter: Delimiter;
  header: Header;
  idColumn: number;
  valueColumn: number;
}
export const defaultParse: ParseOptions = {
  delimiter: 'auto',
  header: 'auto',
  idColumn: 0,
  valueColumn: 1,
};
export interface Observation {
  row: number;
  id: string;
  originalId: string;
  original: string;
  value: number | null;
  status: 'valid' | 'missing' | 'invalid';
  issue: string;
}
export interface Parsed {
  rows: Observation[];
  columns: string[];
  delimiter: Exclude<Delimiter, 'auto'>;
  hasHeader: boolean;
  issues: string[];
  error: string | null;
}
export const MAX_ROWS = 50_000;
export const MAX_CHARACTERS = 5_000_000;

export function numeric(raw: string): {
  value: number | null;
  status: Observation['status'];
  decimalComma: boolean;
} {
  const text = raw.trim();
  if (/^(?:|na|n\/a|nan|null|missing|\.)$/i.test(text))
    return { value: null, status: 'missing', decimalComma: false };
  // A comma denotes a decimal separator only within a single, already delimited field.
  const decimalComma = /^[+-]?(?:\d+,\d+|,\d+)(?:e[+-]?\d+)?$/i.test(text);
  const normalized = decimalComma ? text.replace(',', '.') : text;
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized))
    return { value: null, status: 'invalid', decimalComma: false };
  const value = Number(normalized);
  // Do not silently turn underflowed, nonzero numbers into zero.
  const underflow = value === 0 && /[1-9]/.test(normalized.split(/e/i)[0]);
  return {
    value: Number.isFinite(value) && !underflow ? value : null,
    status: Number.isFinite(value) && !underflow ? 'valid' : 'invalid',
    decimalComma,
  };
}

function splitRecords(
  text: string,
  delimiter: string,
): { cells: string[][]; error: string | null } {
  const cells: string[][] = [];
  let record: string[] = [],
    cell = '',
    quoted = false,
    closed = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
        closed = true;
      } else cell += char;
    } else if (char === '"' && cell === '' && !closed) quoted = true;
    else if (char === delimiter) {
      record.push(cell);
      cell = '';
      closed = false;
    } else if (char === '\n' || char === '\r') {
      if (cell !== '' || record.length > 0 || closed) cells.push([...record, cell]);
      if (char === '\r' && text[i + 1] === '\n') i++;
      record = [];
      cell = '';
      closed = false;
    } else {
      if (closed || char === '"')
        return {
          cells: [],
          error:
            'Malformed quoted field. Quotes must enclose the entire field; double any quote inside it.',
        };
      cell += char;
    }
  }
  if (quoted)
    return { cells: [], error: 'Unclosed quoted field. Check the pasted CSV quotation marks.' };
  if (cell !== '' || record.length > 0 || closed) cells.push([...record, cell]);
  return { cells, error: null };
}

export function parseData(source: string, options: ParseOptions = defaultParse): Parsed {
  const empty: Parsed = {
    rows: [],
    columns: [],
    delimiter: 'single',
    hasHeader: false,
    issues: [],
    error: null,
  };
  if (source.length > MAX_CHARACTERS)
    return {
      ...empty,
      error:
        'Input exceeds 5 million characters. Analyze a smaller dataset; no rows have been imported.',
    };
  const text = source.replace(/^\uFEFF/, '');
  if (!text.trim()) return empty;
  const first = text.split(/\r\n?|\n/).find((line) => line.trim()) ?? '';
  let delimiter = options.delimiter;
  if (delimiter === 'auto') {
    const outsideQuotes = first.replace(/"(?:[^"]|"")*"/g, '');
    delimiter = outsideQuotes.includes('\t')
      ? 'tab'
      : outsideQuotes.includes(';')
        ? 'semicolon'
        : outsideQuotes.includes(',')
          ? 'comma'
          : /\S\s{2,}\S/.test(first)
            ? 'whitespace'
            : 'single';
    if (delimiter === 'comma' && /^[+\-\d.,eE\s]+$/.test(first)) {
      return {
        ...empty,
        error:
          'Ambiguous numeric commas: choose “CSV (comma)” for columns, or “Single column” for decimal-comma values. Nothing has been guessed.',
      };
    }
  }
  const tokenized =
    delimiter === 'whitespace'
      ? {
          cells: text
            .split(/\r\n?|\n/)
            .filter((line) => line.trim())
            .map((line) => line.trim().split(/\s{2,}/)),
          error: null,
        }
      : splitRecords(text, { tab: '\t', comma: ',', semicolon: ';', single: '\u0000' }[delimiter]);
  if (tokenized.error) return { ...empty, delimiter, error: tokenized.error };
  const records = tokenized.cells;
  if (!records.length) return { ...empty, delimiter };
  if (records.length > MAX_ROWS + 1)
    return {
      ...empty,
      delimiter,
      error: 'More than 50,000 rows. Analyze a smaller dataset; no rows have been imported.',
    };
  const width = records[0].length;
  const valueColumn = width === 1 ? 0 : options.valueColumn;
  const idColumn = width === 1 ? -1 : options.idColumn;
  if (valueColumn < 0 || valueColumn >= width || idColumn >= width)
    return {
      ...empty,
      delimiter,
      columns: records[0].map((_, i) => `Column ${i + 1}`),
      error: 'Selected columns do not exist. Choose valid identifier and value columns.',
    };
  if (valueColumn === idColumn)
    return {
      ...empty,
      delimiter,
      columns: records[0].map((_, i) => `Column ${i + 1}`),
      error: 'Identifier and numerical value columns must be different.',
    };
  const knownHeader =
    /^(?:sample[ _-]?(?:id|identifier)?|id|identifier|subject[ _-]?id|observation[ _-]?id)$/i;
  const hasHeader =
    options.header === 'yes' ||
    (options.header === 'auto' &&
      (idColumn >= 0
        ? knownHeader.test(records[0][idColumn].trim())
        : /^(?:value|measurement|observation)s?$/i.test(records[0][0].trim())));
  const data = hasHeader ? records.slice(1) : records;
  if (data.length > MAX_ROWS)
    return {
      ...empty,
      delimiter,
      error: 'More than 50,000 rows. Analyze a smaller dataset; no rows have been imported.',
    };
  const issues: string[] = [];
  if (
    options.header === 'auto' &&
    !hasHeader &&
    numeric(records[0][valueColumn]).status === 'invalid'
  )
    issues.push(
      'The first row was retained. If it contains column names, select “Headers present”.',
    );
  let commaCount = 0,
    duplicateCount = 0,
    generatedCount = 0,
    precisionCount = 0;
  const identifiers = new Set<string>();
  const rows = data.map((record, index): Observation => {
    const row = index + 1;
    const original = record[valueColumn] ?? '';
    const number = numeric(original);
    if (number.decimalComma) commaCount++;
    const originalId = idColumn >= 0 ? (record[idColumn] ?? '') : '';
    const id = originalId || `Row ${row}`;
    if (idColumn >= 0 && !originalId) generatedCount++;
    if (identifiers.has(id)) duplicateCount++;
    identifiers.add(id);
    const badWidth = record.length !== width;
    const significantDigits = original
      .trim()
      .split(/e/i)[0]
      .replace(/[^0-9]/g, '')
      .replace(/^0+/, '').length;
    const precisionIssue =
      !badWidth &&
      number.status === 'valid' &&
      (significantDigits > 15 ||
        (Number.isInteger(number.value) && !Number.isSafeInteger(number.value)));
    if (precisionIssue) precisionCount++;
    return {
      row,
      id,
      originalId,
      original,
      value: badWidth ? null : number.value,
      status: badWidth ? 'invalid' : number.status,
      issue: badWidth
        ? `Expected ${width} fields; found ${record.length}.`
        : number.status === 'invalid'
          ? 'Not a supported finite number (or outside numerical precision).'
          : number.status === 'missing'
            ? 'Missing observation.'
            : precisionIssue
              ? 'Binary64 precision may round this value; original text is preserved.'
              : '',
    };
  });
  if (commaCount)
    issues.push(
      `${commaCount} decimal-comma field(s) interpreted as decimals, never as thousands separators. Original text is preserved.`,
    );
  if (duplicateCount)
    issues.push(
      `${duplicateCount} repeated identifier(s) retained as separate rows. Source row numbers distinguish observations.`,
    );
  if (generatedCount)
    issues.push(
      `${generatedCount} empty identifier(s) given a “Row …” display label. Original empty identifiers are retained in exports.`,
    );
  if (precisionCount)
    issues.push(
      `${precisionCount} numerical field(s) exceed 15 significant digits or the safe integer range. Binary64 may round them; original text is preserved. Consider rescaling units.`,
    );
  return {
    rows,
    columns: records[0].map((name, i) =>
      hasHeader ? name || `Column ${i + 1}` : `Column ${i + 1}`,
    ),
    delimiter,
    hasHeader,
    issues,
    error: null,
  };
}

export interface Summary {
  n: number;
  mean: number | null;
  median: number | null;
  sd: number | null;
  min: number | null;
  max: number | null;
  q1: number | null;
  q3: number | null;
  iqr: number | null;
  p1: number | null;
  p5: number | null;
  p95: number | null;
  p99: number | null;
  mad: number | null;
}
const finite = (value: number): number | null => (Number.isFinite(value) ? value : null);
/** Hyndman–Fan type 7; sorted input; convex interpolation avoids overflowing x[j+1]-x[j]. */
export function quantile(sorted: number[], p: number): number | null {
  if (p < 0 || p > 1 || !Number.isFinite(p))
    throw new Error('Quantile probability must be between zero and one.');
  if (!sorted.length) return null;
  const position = (sorted.length - 1) * p,
    index = Math.floor(position),
    fraction = position - index;
  if (fraction === 0) return sorted[index];
  const a = sorted[index],
    b = sorted[index + 1];
  return a === b
    ? a
    : Math.sign(a) === Math.sign(b)
      ? a + fraction * (b - a)
      : (1 - fraction) * a + fraction * b;
}
function compensatedSum(values: number[]): number {
  let total = 0,
    correction = 0;
  for (const value of values) {
    const y = value - correction,
      next = total + y;
    correction = next - total - y;
    total = next;
  }
  return total;
}
export function summarize(values: number[]): Summary {
  if (values.some((value) => !Number.isFinite(value)))
    throw new Error('Summary requires finite numbers.');
  const sorted = [...values].sort((a, b) => a - b),
    n = values.length;
  const empty: Summary = {
    n: 0,
    mean: null,
    median: null,
    sd: null,
    min: null,
    max: null,
    q1: null,
    q3: null,
    iqr: null,
    p1: null,
    p5: null,
    p95: null,
    p99: null,
    mad: null,
  };
  if (!n) return empty;
  const scale = Math.max(Math.abs(sorted[0]), Math.abs(sorted[n - 1]));
  const normalized = scale === 0 ? values.map(() => 0) : values.map((value) => value / scale);
  const normalizedMean = compensatedSum(normalized) / n;
  const mean = finite(normalizedMean * scale);
  // Center first when representable: preserves small variation around large offsets.
  const center = sorted[Math.floor(n / 2)];
  const deviations = values.map((value) => value - center);
  let sd: number | null = null;
  if (n > 1) {
    const differenceScale = deviations.every(Number.isFinite)
      ? deviations.reduce((max, value) => Math.max(max, Math.abs(value)), 0)
      : null;
    const scaled =
      differenceScale === null
        ? normalized
        : differenceScale === 0
          ? values.map(() => 0)
          : deviations.map((value) => value / differenceScale);
    const offset = compensatedSum(scaled) / n;
    sd = finite(
      Math.sqrt(compensatedSum(scaled.map((value) => (value - offset) ** 2)) / (n - 1)) *
        (differenceScale ?? scale),
    );
  }
  const median = quantile(sorted, 0.5)!;
  const q1 = quantile(sorted, 0.25)!,
    q3 = quantile(sorted, 0.75)!;
  const absolute = sorted.map((value) => Math.abs(value - median)).sort((a, b) => a - b);
  const madRaw = quantile(absolute, 0.5)!;
  return {
    n,
    mean,
    median,
    sd,
    min: sorted[0],
    max: sorted[n - 1],
    q1,
    q3,
    iqr: finite(q3 - q1),
    p1: quantile(sorted, 0.01),
    p5: quantile(sorted, 0.05),
    p95: quantile(sorted, 0.95),
    p99: quantile(sorted, 0.99),
    mad: finite(madRaw),
  };
}

export interface Settings {
  mild: number;
  extreme: number;
  z: number;
  min: number | null;
  max: number | null;
}
export const defaultSettings: Settings = { mild: 1.5, extreme: 3, z: 3.5, min: null, max: null };
export type Priority =
  | 'No statistical flags'
  | 'Statistical outlier'
  | 'Extreme statistical outlier'
  | 'Outside expected range'
  | 'Invalid or missing value';
export interface Annotated extends Observation {
  iqrFlag: boolean | null;
  extremeFlag: boolean | null;
  zScore: number | null;
  zFlag: boolean | null;
  plausible: boolean | null;
  priority: Priority;
}
export interface Analysis {
  rows: Annotated[];
  summary: Summary;
  settings: Settings;
  mildLow: number | null;
  mildHigh: number | null;
  extremeLow: number | null;
  extremeHigh: number | null;
  warnings: string[];
}
export const priorityOrder: Record<Priority, number> = {
  'No statistical flags': 0,
  'Statistical outlier': 1,
  'Extreme statistical outlier': 2,
  'Outside expected range': 3,
  'Invalid or missing value': 4,
};

export function analyze(rows: Observation[], settings: Settings = defaultSettings): Analysis {
  if (
    ![settings.mild, settings.extreme, settings.z].every(
      (value) => Number.isFinite(value) && value > 0,
    ) ||
    settings.extreme < settings.mild
  )
    throw new Error(
      'Use positive thresholds with the extreme multiplier at least the mild multiplier.',
    );
  if (
    [settings.min, settings.max].some((value) => value !== null && !Number.isFinite(value)) ||
    (settings.min !== null && settings.max !== null && settings.min > settings.max)
  )
    throw new Error(
      'Expected minimum must not exceed expected maximum; boundaries must be finite.',
    );
  const summary = summarize(rows.filter((row) => row.status === 'valid').map((row) => row.value!));
  const boundary = (q: number | null, factor: number) =>
    q === null || summary.iqr === null ? null : finite(q + factor * summary.iqr);
  const mildLow = boundary(summary.q1, -settings.mild),
    mildHigh = boundary(summary.q3, settings.mild);
  const extremeLow = boundary(summary.q1, -settings.extreme),
    extremeHigh = boundary(summary.q3, settings.extreme);
  const warnings: string[] = [];
  if (summary.n < 4)
    warnings.push(
      'Fewer than four valid observations: quartiles and outlier flags are especially unstable. Sample SD requires at least two observations.',
    );
  if (summary.mad === 0 && summary.n)
    warnings.push(
      'MAD is zero: modified Z-scores and their flags are unavailable for every observation. IQR and plausibility checks remain independent.',
    );
  if (
    summary.n &&
    (summary.mad === null ||
      summary.iqr === null ||
      mildLow === null ||
      mildHigh === null ||
      extremeLow === null ||
      extremeHigh === null ||
      (summary.n > 1 && summary.sd === null))
  )
    warnings.push(
      'Some statistics or fences exceed floating-point range and are unavailable. Uncomputable IQR checks are not reported as negative flags. Consider rescaling measurement units.',
    );
  const result = rows.map((row): Annotated => {
    if (row.value === null || row.status !== 'valid')
      return {
        ...row,
        iqrFlag: null,
        extremeFlag: null,
        zScore: null,
        zFlag: null,
        plausible: null,
        priority: 'Invalid or missing value',
      };
    const value = row.value;
    const outside = (low: number | null, high: number | null): boolean | null =>
      (low !== null && value < low) || (high !== null && value > high)
        ? true
        : low === null || high === null
          ? null
          : false;
    const iqrFlag = outside(mildLow, mildHigh),
      extremeFlag = outside(extremeLow, extremeHigh);
    // Divide before subtracting when direct subtraction would overflow.
    const difference = value - summary.median!;
    const zScore =
      summary.mad === null || summary.mad === 0
        ? null
        : finite(
            Number.isFinite(difference)
              ? (0.6745 * difference) / summary.mad
              : (0.6745 * value) / summary.mad - (0.6745 * summary.median!) / summary.mad,
          );
    const zFlag = zScore === null ? null : Math.abs(zScore) > settings.z;
    const plausible =
      settings.min === null && settings.max === null
        ? null
        : !(
            (settings.min !== null && value < settings.min) ||
            (settings.max !== null && value > settings.max)
          );
    const priority: Priority =
      plausible === false
        ? 'Outside expected range'
        : extremeFlag
          ? 'Extreme statistical outlier'
          : iqrFlag || zFlag
            ? 'Statistical outlier'
            : 'No statistical flags';
    return { ...row, iqrFlag, extremeFlag, zScore, zFlag, plausible, priority };
  });
  if (
    result.some(
      (row) =>
        row.status === 'valid' && summary.mad !== 0 && summary.mad !== null && row.zScore === null,
    )
  )
    warnings.push(
      'Some modified Z-scores exceed numerical range and are unavailable; review these observations using the other methods.',
    );
  return { rows: result, summary, settings, mildLow, mildHigh, extremeLow, extremeHigh, warnings };
}

export interface Exclusions {
  plausible: boolean;
  extreme: boolean;
  iqr: boolean;
  z: boolean;
}
export const defaultExclusions: Exclusions = {
  plausible: false,
  extreme: false,
  iqr: false,
  z: false,
};
export function isExcluded(row: Annotated, criteria: Exclusions): boolean {
  return (
    row.status === 'valid' &&
    Boolean(
      (criteria.plausible && row.plausible === false) ||
      (criteria.extreme && row.extremeFlag) ||
      (criteria.iqr && row.iqrFlag) ||
      (criteria.z && row.zFlag),
    )
  );
}
export function sensitivity(analysis: Analysis, criteria: Exclusions) {
  const retained = analysis.rows.filter(
    (row) => row.status === 'valid' && !isExcluded(row, criteria),
  );
  const summary = summarize(retained.map((row) => row.value!));
  const excluded = analysis.summary.n - summary.n;
  return {
    summary,
    excluded,
    percent: analysis.summary.n ? (100 * excluded) / analysis.summary.n : 0,
    meanChange:
      summary.mean === null || analysis.summary.mean === null
        ? null
        : finite(summary.mean - analysis.summary.mean),
    medianChange:
      summary.median === null || analysis.summary.median === null
        ? null
        : finite(summary.median - analysis.summary.median),
  };
}

export const exampleData = `Sample_ID\tSalt_percentage
S001\t2.5
S002\t3.1
S003\t2.8
S004\t3.0
S005\t2.7
S006\t3.2
S007\t2.9
S008\t3.4
S009\t2.6
S010\t3.1
S011\t2.8
S012\t3.3
S013\t2.7
S014\t3.0
S015\t2.9
S016\t3.2
S017\t2.6
S018\t3.1
S019\t2.8
S020\t3.0
S021\t2.9
S022\t3.3
S023\t2.7
S024\t3.1
S025\t2.8
S026\t3.0
S027\t4.3
S028\t7.5
S029\t80.0
S030\t-1.0
S031\t
S032\tbelow detection`;
