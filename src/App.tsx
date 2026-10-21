import { useMemo, useState, type ReactNode } from 'react';
import {
  analyze,
  defaultExclusions,
  defaultParse,
  defaultSettings,
  exampleData,
  isExcluded,
  numeric,
  parseData,
  priorityOrder,
  sensitivity,
  type Annotated,
  type Delimiter,
  type Exclusions,
  type Header,
  type ParseOptions,
  type Parsed,
  type Settings,
} from './core';
import {
  annotatedRows,
  delimited,
  download,
  format,
  reportHtml,
  summaryRows,
  summaryLabels,
  type Variable,
} from './exports';
import { Charts } from './Charts';
import { workbook } from './workbook';
import { methods, methodText, references, SOFTWARE, softwareCitation } from './references';

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    sieve: (
      <>
        <path d="M3 4h18l-7 9v6l-4 2v-8z" />
        <path d="M7 4v4m5-4v4m5-4v4" />
      </>
    ),
    paste: (
      <>
        <rect x="6" y="5" width="14" height="16" rx="2" />
        <path d="M9 5V3H4v14m5-6h8m-8 4h6" />
      </>
    ),
    chart: (
      <>
        <path d="M4 3v17h17M8 16v-5m5 5V6m5 10V9" />
      </>
    ),
    flag: (
      <>
        <path d="M5 21V4m0 0c4-4 10 4 14 0v10c-4 4-10-4-14 0" />
      </>
    ),
    compare: (
      <>
        <path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
      </>
    ),
    shield: (
      <>
        <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9 9a3 3 0 1 1 5 2c-2 1-2 1-2 3m0 3h.01" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    trash: (
      <>
        <path d="M4 6h16M9 6V3h6v3M7 6l1 15h8l1-15m-7-5v9m4-9v9" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name] || paths.chart}
    </svg>
  );
}
function SectionTitle({
  step,
  title,
  description,
  children,
}: {
  step: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <span className="eyebrow">{step}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
const initialParsed = parseData('');
const initialVariable: Variable = { name: '', unit: '', synthetic: false };
const flagText = (row: Annotated) =>
  row.status !== 'valid'
    ? 'Unavailable'
    : row.extremeFlag
      ? 'Extreme'
      : row.iqrFlag
        ? 'Mild'
        : row.iqrFlag === null
          ? 'Unavailable'
          : 'Within fences';
const EMPTY_ANALYSIS = analyze([]);
const PAGE_SIZE = 50;

export default function App() {
  const [source, setSource] = useState('');
  const [appliedSource, setAppliedSource] = useState('');
  const [options, setOptions] = useState<ParseOptions>(defaultParse);
  const [appliedOptions, setAppliedOptions] = useState<ParseOptions>(defaultParse);
  const [parsed, setParsed] = useState<Parsed>(initialParsed);
  const [variable, setVariable] = useState<Variable>(initialVariable);
  const [bounds, setBounds] = useState({ min: '', max: '' });
  const [thresholds, setThresholds] = useState({ mild: '1.5', extreme: '3', z: '3.5' });
  const [criteria, setCriteria] = useState<Exclusions>(defaultExclusions);
  const [search, setSearch] = useState('');
  const [flagged, setFlagged] = useState(false);
  const [sort, setSort] = useState('source');
  const [page, setPage] = useState(0);
  const [notice, setNotice] = useState('');
  const [tableFormat, setTableFormat] = useState<'csv' | 'tsv' | 'xlsx'>('csv');
  const [exportError, setExportError] = useState('');
  const preview = useMemo(() => parseData(source, options), [source, options]);
  const dirty =
    source !== appliedSource || JSON.stringify(options) !== JSON.stringify(appliedOptions);
  const validation = useMemo(() => {
    const min = bounds.min.trim() === '' ? null : numeric(bounds.min);
    const max = bounds.max.trim() === '' ? null : numeric(bounds.max);
    if ((min && min.status !== 'valid') || (max && max.status !== 'valid'))
      return {
        error: 'Enter a finite numerical boundary, or leave it blank.',
        settings: defaultSettings,
      };
    const settings: Settings = {
      mild: Number(thresholds.mild),
      extreme: Number(thresholds.extreme),
      z: Number(thresholds.z),
      min: min?.value ?? null,
      max: max?.value ?? null,
    };
    try {
      analyze([], settings);
      return { settings, error: '' };
    } catch (error) {
      return { settings, error: (error as Error).message };
    }
  }, [bounds, thresholds]);
  const analysis = useMemo(
    () => (validation.error ? EMPTY_ANALYSIS : analyze(parsed.rows, validation.settings)),
    [parsed, validation],
  );
  const comparison = useMemo(() => sensitivity(analysis, criteria), [analysis, criteria]);
  const filtered = useMemo(() => {
    let rows = analysis.rows.filter(
      (row) =>
        (!flagged || row.priority !== 'No statistical flags') &&
        row.id.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
    );
    if (sort !== 'source')
      rows = [...rows].sort((a, b) =>
        sort === 'priority'
          ? priorityOrder[b.priority] - priorityOrder[a.priority] || a.row - b.row
          : a.value === null
            ? b.value === null
              ? a.row - b.row
              : 1
            : b.value === null
              ? -1
              : (sort === 'descending' ? b.value - a.value : a.value - b.value) || a.row - b.row,
      );
    return rows;
  }, [analysis, flagged, search, sort]);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1));
  const reviewCount = analysis.rows.filter((row) => row.priority !== 'No statistical flags').length;
  const missing = parsed.rows.filter((row) => row.status === 'missing').length;
  const invalid = parsed.rows.filter((row) => row.status === 'invalid').length;
  const canExport = parsed.rows.length > 0 && !validation.error && !dirty;
  const variableLabel = variable.name
    ? variable.name + (variable.unit ? ` (${variable.unit})` : '')
    : variable.unit
      ? `Value (${variable.unit})`
      : 'Value';

  function applyDataset() {
    if (preview.error) return;
    setParsed(preview);
    setAppliedSource(source);
    setAppliedOptions(options);
    setPage(0);
    setSearch('');
    setFlagged(false);
    setCriteria(defaultExclusions);
    setNotice(`${preview.rows.length} rows analyzed locally.`);
  }
  function loadExample() {
    setSource(exampleData);
    setAppliedSource(exampleData);
    setOptions(defaultParse);
    setAppliedOptions(defaultParse);
    setParsed(parseData(exampleData));
    setVariable({ name: 'Salt percentage', unit: '%', synthetic: true });
    setBounds({ min: '0', max: '10' });
    setThresholds({ mild: '1.5', extreme: '3', z: '3.5' });
    setCriteria(defaultExclusions);
    setSearch('');
    setFlagged(false);
    setPage(0);
    setNotice(
      'Synthetic example loaded: 32 observations, including missing and non-numerical entries.',
    );
  }
  function clearSession() {
    setSource('');
    setAppliedSource('');
    setOptions(defaultParse);
    setAppliedOptions(defaultParse);
    setParsed(initialParsed);
    setVariable(initialVariable);
    setBounds({ min: '', max: '' });
    setThresholds({ mild: '1.5', extreme: '3', z: '3.5' });
    setCriteria(defaultExclusions);
    setSearch('');
    setFlagged(false);
    setSort('source');
    setPage(0);
    setNotice('Session cleared. No data is stored by RangeSieve.');
  }
  function exportFile(kind: string) {
    if (!canExport) return;
    setExportError('');
    try {
      if (kind === 'report')
        download(
          'RangeSieve-report.html',
          reportHtml(analysis, parsed, variable, criteria),
          'text/html;charset=utf-8',
        );
      else {
        const summary = [
          ['Statistic or setting', 'Value (blank = unavailable or not specified)'],
          ...summaryRows(analysis, parsed, variable, criteria),
        ];
        const rows =
          kind === 'summary' ? summary : annotatedRows(analysis, criteria, kind === 'flagged');
        if (tableFormat === 'xlsx') {
          const sheets = [{ name: kind === 'summary' ? 'Summary' : 'Observations', rows }];
          if (kind !== 'summary') sheets.push({ name: 'Analysis settings', rows: summary });
          sheets.push({
            name: 'Methods and citations',
            rows: [
              ['Topic', 'Explanation or citation'],
              ['Software', softwareCitation()],
              ['Creator ORCID', SOFTWARE.orcid],
              ...methodText.map(([title, text]) => [title, text]),
              ...references.map((reference) => [reference.title, reference.url]),
            ],
          });
          download(
            `RangeSieve-${kind}.xlsx`,
            workbook(sheets),
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          );
        } else
          download(
            `RangeSieve-${kind}.${tableFormat}`,
            delimited(rows, tableFormat === 'tsv' ? '\t' : ','),
            tableFormat === 'tsv'
              ? 'text/tab-separated-values;charset=utf-8'
              : 'text/csv;charset=utf-8',
          );
      }
      setNotice('Export generated locally. Your download contains analysis data.');
    } catch (error) {
      setExportError((error as Error).message);
    }
  }
  function setOption<K extends keyof ParseOptions>(key: K, value: ParseOptions[K]) {
    setOptions((current) => ({ ...current, [key]: value }));
  }
  const offline = location.protocol === 'file:';
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to analysis
      </a>
      <aside className="sidebar">
        <a className="brand" href="#main">
          <span className="brand-icon">
            <Icon name="sieve" size={25} />
          </span>
          <span>RangeSieve</span>
        </a>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav aria-label="Analysis workflow">
          {[
            ['input', 'paste', 'Paste data', '01'],
            ['explore', 'chart', 'Explore distributions', '02'],
            ['review', 'flag', 'Review observations', '03'],
            ['sensitivity', 'compare', 'Compare statistics', '04'],
            ['exports', 'download', 'Export results', '05'],
          ].map(([id, icon, label, number]) => (
            <a key={id} href={`#${id}`}>
              <Icon name={icon} />
              <span>{label}</span>
              <small>{number}</small>
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-card">
            <Icon name="shield" size={24} />
            <strong>Research stays with you.</strong>
            <p>
              No uploads. No accounts.
              <br />
              Just your data, in your browser.
            </p>
            <span className="status-dot">{offline ? 'Offline edition' : 'Local processing'}</span>
          </div>
          <a href="#methods" className="subtle-link">
            <Icon name="help" /> Methods &amp; limitations
          </a>
          {!offline && (
            <a className="subtle-link" href="./RangeSieve.html" download>
              <Icon name="download" /> Download offline edition
            </a>
          )}
          <button className="subtle-link" onClick={clearSession}>
            <Icon name="trash" /> Clear session
          </button>
          <small className="version">RangeSieve 1.0.0 · Open source</small>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span className="breadcrumb">
            Workspace <span>/</span> <strong>Dataset explorer</strong>
          </span>
          <div className="topbar-right">
            <span className="private-pill">
              <Icon name="shield" size={15} /> Private by design
            </span>
            <a href="#methods" aria-label="Read methods and help">
              <Icon name="help" />
            </a>
          </div>
        </header>
        <main id="main">
          <div className="page-heading">
            <div>
              <span className="eyebrow">THE DATA EXPLORATION WORKSPACE</span>
              <h1>
                A clearer view of your data<span>.</span>
              </h1>
              <p>Explore distributions. Spot unusual observations. Make informed decisions.</p>
            </div>
            <button className="button secondary" onClick={loadExample}>
              <Icon name="chart" size={17} /> Try an example
            </button>
          </div>
          <div className="privacy-notice">
            <Icon name="shield" size={19} />
            <p>
              Your data stays in your browser. All analyses run locally. No research data is
              uploaded or stored.
            </p>
          </div>
          <div className="sr-only" role="status" aria-live="polite">
            {notice}
          </div>
          <div className="workspace-grid">
            <section id="input" className="panel input-panel">
              <SectionTitle
                step="01 / START HERE"
                title="Bring your data"
                description="Copy two columns from your spreadsheet. Paste them below."
              />
              <label className="input-label" htmlFor="dataset">
                Sample identifier &amp; numerical value
              </label>
              <textarea
                id="dataset"
                value={source}
                spellCheck={false}
                autoComplete="off"
                placeholder={'Sample_ID\tValue\nS001\t2.5\nS002\t3.1\nS003\t2.8\nS004\t80.0'}
                onChange={(e) => {
                  setSource(e.target.value);
                  setVariable((current) => ({ ...current, synthetic: false }));
                }}
              />
              <p className="input-hint">
                Paste from Excel or Google Sheets. Tabs, CSV, and optional headers are supported. Up
                to 50,000 rows.
              </p>
              <details className="import-options">
                <summary>
                  Import settings{' '}
                  <span>
                    {preview.delimiter === 'single'
                      ? 'Single column'
                      : preview.delimiter.toUpperCase()}{' '}
                    · {preview.hasHeader ? 'Headers detected' : 'No headers detected'}
                  </span>
                </summary>
                <div className="field-grid">
                  <label>
                    Delimiter
                    <select
                      value={options.delimiter}
                      onChange={(e) => setOption('delimiter', e.target.value as Delimiter)}
                    >
                      <option value="auto">Detect automatically</option>
                      <option value="tab">Tabs (Excel)</option>
                      <option value="comma">CSV (comma)</option>
                      <option value="semicolon">Semicolon</option>
                      <option value="whitespace">Two or more spaces</option>
                      <option value="single">Single column</option>
                    </select>
                  </label>
                  <label>
                    Column headers
                    <select
                      value={options.header}
                      onChange={(e) => setOption('header', e.target.value as Header)}
                    >
                      <option value="auto">Detect common headers</option>
                      <option value="yes">Headers present</option>
                      <option value="no">No headers</option>
                    </select>
                  </label>
                  {preview.columns.length > 1 && (
                    <>
                      <label>
                        Identifier column
                        <select
                          value={options.idColumn}
                          onChange={(e) => setOption('idColumn', Number(e.target.value))}
                        >
                          {preview.columns.map((label, i) => (
                            <option key={i} value={i}>
                              {i + 1}. {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Numerical value column
                        <select
                          value={options.valueColumn}
                          onChange={(e) => setOption('valueColumn', Number(e.target.value))}
                        >
                          {preview.columns.map((label, i) => (
                            <option key={i} value={i}>
                              {i + 1}. {label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  )}
                </div>
                <p className="fine-print">
                  Header detection recognizes common identifier names. Review the preview; unknown
                  header names are retained until you select “Headers present”. Commas within a
                  field mean decimals, never thousands.
                </p>
              </details>
              {preview.error && (
                <p className="message error" role="alert">
                  {preview.error}
                </p>
              )}
              {source && !preview.error && (
                <p className="parse-preview">
                  {preview.rows.length} rows ·{' '}
                  {preview.rows.filter((row) => row.status === 'valid').length} numerical ·{' '}
                  {preview.rows.filter((row) => row.status !== 'valid').length} missing / invalid
                </p>
              )}
              {source && !preview.error && (
                <details className="preview-details">
                  <summary>Preview first {Math.min(3, preview.rows.length)} rows</summary>
                  <ul>
                    {preview.rows.slice(0, 3).map((row) => (
                      <li key={row.row}>
                        {row.id}: {row.original || '(empty)'} · {row.status}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {preview.issues.map((issue) => (
                <p key={issue} className="message warning">
                  {issue}
                </p>
              ))}
              <button
                className="button primary analyze-button"
                disabled={!source.trim() || Boolean(preview.error)}
                onClick={applyDataset}
              >
                Analyze dataset <Icon name="arrow" size={19} />
              </button>
              <div className="divider" />
              <div className="optional-heading">
                Variable information <span>OPTIONAL</span>
              </div>
              <div className="field-grid">
                <label className="wide">
                  Variable name
                  <input
                    value={variable.name}
                    autoComplete="off"
                    placeholder="e.g. Salt percentage"
                    onChange={(e) => setVariable({ ...variable, name: e.target.value })}
                  />
                </label>
                <label className="wide">
                  Measurement unit
                  <input
                    value={variable.unit}
                    autoComplete="off"
                    placeholder="e.g. %, mg/L, °C"
                    onChange={(e) => setVariable({ ...variable, unit: e.target.value })}
                  />
                </label>
              </div>
              <fieldset className="range-fieldset">
                <legend>
                  Expected range <span>Inclusive bounds</span>
                </legend>
                <div className="field-grid">
                  <label>
                    Minimum
                    <input
                      inputMode="decimal"
                      value={bounds.min}
                      placeholder="No minimum"
                      onChange={(e) => setBounds({ ...bounds, min: e.target.value })}
                    />
                  </label>
                  <label>
                    Maximum
                    <input
                      inputMode="decimal"
                      value={bounds.max}
                      placeholder="No maximum"
                      onChange={(e) => setBounds({ ...bounds, max: e.target.value })}
                    />
                  </label>
                </div>
                <p className="fine-print">
                  Use subject knowledge. Either boundary can be left blank.
                </p>
              </fieldset>
              {validation.error && (
                <p className="message error" role="alert">
                  {validation.error}
                </p>
              )}
            </section>
            <div className="analysis-column">
              {variable.synthetic && (
                <div className="example-banner">
                  <span className="dot" /> Synthetic example · Salt percentage{' '}
                  <button onClick={clearSession}>
                    Start with your data <span aria-hidden="true">↗</span>
                  </button>
                </div>
              )}
              {dirty && parsed.rows.length > 0 && (
                <p className="message warning" role="status">
                  Input has changed. Results show the last analyzed dataset. Select “Analyze
                  dataset” to update. Exports are paused until then.
                </p>
              )}
              <div className="stat-cards">
                <div className="stat-card">
                  <span>Valid observations</span>
                  <strong data-testid="valid-count">
                    {analysis.summary.n.toLocaleString('en')}
                  </strong>
                  <small>of {parsed.rows.length.toLocaleString('en')} input rows</small>
                </div>
                <div className="stat-card">
                  <span>Median{variable.unit ? ` (${variable.unit})` : ''}</span>
                  <strong>
                    {analysis.summary.median === null ? '—' : format(analysis.summary.median)}
                  </strong>
                  <small>Center of your distribution</small>
                </div>
                <div className="stat-card review-card">
                  <span>
                    To review <Icon name="flag" size={15} />
                  </span>
                  <strong data-testid="review-count">{reviewCount}</strong>
                  <small>{missing + invalid} missing or invalid</small>
                </div>
              </div>
              <section id="explore" className="panel chart-panel">
                <SectionTitle
                  step="02 / EXPLORE"
                  title="See the distribution"
                  description={
                    parsed.rows.length
                      ? `${variableLabel} · ${analysis.summary.n} valid observations`
                      : 'Patterns become clearer when you see the whole picture.'
                  }
                >
                  <span className="label-chip">INTERACTIVE</span>
                </SectionTitle>
                <Charts analysis={analysis} label={variableLabel} canExport={canExport} />
              </section>
              <section className="panel summary-panel">
                <div className="compact-heading">
                  <h3>At a glance</h3>
                  <span>Sample statistics · Type 7 quantiles</span>
                </div>
                <dl className="quick-stats">
                  {(['mean', 'sd', 'min', 'max', 'q1', 'q3', 'iqr'] as const).map((key) => (
                    <div key={key}>
                      <dt>
                        {summaryLabels
                          .find(([k]) => k === key)![1]
                          .replace(' (25th percentile)', '')
                          .replace(' (75th percentile)', '')
                          .replace('Sample standard deviation', 'Standard deviation')
                          .replace('Interquartile range', 'IQR')}
                      </dt>
                      <dd>
                        {analysis.summary[key] === null ? '—' : format(analysis.summary[key])}
                      </dd>
                    </div>
                  ))}
                </dl>
                <details>
                  <summary>All descriptive statistics &amp; thresholds</summary>
                  <div className="stats-detail">
                    <dl>
                      {summaryLabels.map(([key, label]) => (
                        <div key={key}>
                          <dt>{label}</dt>
                          <dd>{format(analysis.summary[key])}</dd>
                        </div>
                      ))}
                      <div>
                        <dt>Total input rows</dt>
                        <dd>{parsed.rows.length}</dd>
                      </div>
                      <div>
                        <dt>Missing values</dt>
                        <dd>{missing}</dd>
                      </div>
                      <div>
                        <dt>Non-numerical / invalid values</dt>
                        <dd>{invalid}</dd>
                      </div>
                      {[
                        ['Mild IQR lower fence', analysis.mildLow],
                        ['Mild IQR upper fence', analysis.mildHigh],
                        ['Extreme IQR lower fence', analysis.extremeLow],
                        ['Extreme IQR upper fence', analysis.extremeHigh],
                      ].map(([label, value]) => (
                        <div key={String(label)}>
                          <dt>{label}</dt>
                          <dd>{format(value as number | null)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </details>
              </section>
            </div>
          </div>
          {parsed.rows.length > 0 &&
            analysis.warnings.map((warning) => (
              <p className="message warning" key={warning}>
                {warning}
              </p>
            ))}
          <section id="review" className="panel results-panel">
            <SectionTitle
              step="03 / IDENTIFY & UNDERSTAND"
              title="Every observation, in context"
              description="Flags are an invitation to investigate. They are never a verdict on your data."
            >
              <span className="label-chip">{analysis.rows.length} ROWS</span>
            </SectionTitle>
            <details className="threshold-settings">
              <summary>
                Detection settings{' '}
                <span>
                  IQR ×{thresholds.mild} / ×{thresholds.extreme} · |Modified Z| &gt; {thresholds.z}
                </span>
              </summary>
              <div className="threshold-grid">
                <label>
                  Mild IQR multiplier
                  <input
                    type="number"
                    min="0.01"
                    step="0.1"
                    value={thresholds.mild}
                    onChange={(e) => setThresholds({ ...thresholds, mild: e.target.value })}
                  />
                </label>
                <label>
                  Extreme IQR multiplier
                  <input
                    type="number"
                    min="0.01"
                    step="0.1"
                    value={thresholds.extreme}
                    onChange={(e) => setThresholds({ ...thresholds, extreme: e.target.value })}
                  />
                </label>
                <label>
                  Modified Z-score threshold
                  <input
                    type="number"
                    min="0.01"
                    step="0.1"
                    value={thresholds.z}
                    onChange={(e) => setThresholds({ ...thresholds, z: e.target.value })}
                  />
                </label>
                <button
                  className="button secondary"
                  onClick={() => setThresholds({ mild: '1.5', extreme: '3', z: '3.5' })}
                >
                  Reset thresholds
                </button>
              </div>
              <p className="fine-print">
                Strictly outside the fences or threshold. Zero MAD makes modified Z-scores
                unavailable. <a href="#methods">Read definitions</a>.
              </p>
            </details>
            {validation.error && (
              <p className="message error" role="alert">
                {validation.error} Results are unavailable until settings are valid.
              </p>
            )}
            <div className="table-toolbar">
              <label className="search-field">
                <span className="sr-only">Search sample identifiers</span>
                <input
                  type="search"
                  placeholder="Search sample identifiers…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                />
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={flagged}
                  onChange={(e) => {
                    setFlagged(e.target.checked);
                    setPage(0);
                  }}
                />{' '}
                Only observations to review
              </label>
              <label className="sort-field">
                <span className="sr-only">Sort observations</span>
                <select
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="source">Source order</option>
                  <option value="ascending">Value: low to high</option>
                  <option value="descending">Value: high to low</option>
                  <option value="priority">Review priority</option>
                </select>
              </label>
            </div>
            <div className="table-scroll">
              <table className="results-table">
                <caption className="sr-only">
                  Annotated observations; all flags remain independent
                </caption>
                <thead>
                  <tr>
                    <th scope="col">
                      Sample ID <small>/ source row</small>
                    </th>
                    <th scope="col">Original value</th>
                    <th scope="col">IQR class</th>
                    <th scope="col">
                      Modified Z <small>/ flag</small>
                    </th>
                    <th scope="col">Expected range</th>
                    <th scope="col">Review classification</th>
                    <th scope="col">Sensitivity</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered
                    .slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
                    .map((row) => (
                      <tr key={row.row} className={isExcluded(row, criteria) ? 'excluded-row' : ''}>
                        <th scope="row">
                          <span className="sample-id">{row.id}</span>
                          <small>Row {row.row}</small>
                        </th>
                        <td className="numeric" title={row.issue || row.original}>
                          {row.original || <span className="muted">(empty)</span>}
                        </td>
                        <td>
                          <span
                            className={`iqr-class ${row.extremeFlag ? 'extreme-text' : row.iqrFlag ? 'mild-text' : ''}`}
                          >
                            {flagText(row)}
                          </span>
                        </td>
                        <td className="numeric">
                          {row.zScore === null ? 'Unavailable' : format(row.zScore)}
                          {row.zFlag && <span className="inline-flag">Flag</span>}
                        </td>
                        <td>
                          {row.status !== 'valid' ? (
                            'Unavailable'
                          ) : row.plausible === null ? (
                            'Not specified'
                          ) : row.plausible ? (
                            'Within range'
                          ) : (
                            <span className="outside-text">Outside range</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge priority-${priorityOrder[row.priority]}`}>
                            {row.priority}
                          </span>
                          {row.issue && <small className="row-issue">{row.issue}</small>}
                        </td>
                        <td>
                          {row.status !== 'valid'
                            ? 'Not numerical'
                            : isExcluded(row, criteria)
                              ? 'Excluded'
                              : 'Retained'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {!filtered.length && (
                <div className="table-empty">
                  {analysis.rows.length
                    ? 'No observations match your filters.'
                    : 'Analyze a dataset to inspect individual observations.'}
                </div>
              )}
            </div>
            <div className="table-footer">
              <span>
                {filtered.length
                  ? `${currentPage * PAGE_SIZE + 1}–${Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} of ${filtered.length} observations`
                  : '0 observations'}{' '}
                · Original rows are always preserved
              </span>
              <div>
                <button
                  className="button small secondary"
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Previous
                </button>
                <button
                  className="button small secondary"
                  disabled={(currentPage + 1) * PAGE_SIZE >= filtered.length}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </section>
          <section id="sensitivity" className="panel sensitivity-panel">
            <SectionTitle
              step="04 / COMPARE"
              title="How much do flagged values matter?"
              description="Explore how summary statistics change when you temporarily exclude observations."
            />
            <div className="sensitivity-grid">
              <div className="exclusion-options">
                <h3>Explore exclusions</h3>
                <p>
                  Exclude valid observations meeting <strong>any</strong> selected rule.
                </p>
                {(
                  [
                    ['plausible', 'Outside expected range'],
                    ['extreme', 'Extreme IQR outliers'],
                    ['iqr', 'All IQR outliers'],
                    ['z', 'Modified Z-score outliers'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={criteria[key]}
                      onChange={(e) => setCriteria({ ...criteria, [key]: e.target.checked })}
                    />
                    {label}
                  </label>
                ))}
                <div className="exclusion-summary">
                  <strong data-testid="excluded-count">{comparison.excluded}</strong>
                  <span>
                    valid observations excluded
                    <br />
                    <b>{format(comparison.percent)}%</b> of valid data
                  </span>
                </div>
              </div>
              <div className="comparison">
                <div className="table-scroll">
                  <table>
                    <caption className="sr-only">Sensitivity analysis comparison</caption>
                    <thead>
                      <tr>
                        <th scope="col">Statistic</th>
                        <th scope="col">All valid data</th>
                        <th scope="col">After exclusions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(['n', 'mean', 'median', 'sd', 'min', 'max'] as const).map((key) => (
                        <tr key={key}>
                          <th scope="row">{summaryLabels.find(([k]) => k === key)![1]}</th>
                          <td>{format(analysis.summary[key])}</td>
                          <td>{format(comparison.summary[key])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="change-stats">
                  <span>
                    Change in mean <strong>{format(comparison.meanChange)}</strong>
                  </span>
                  <span>
                    Change in median <strong>{format(comparison.medianChange)}</strong>
                  </span>
                </div>
                <p className="fine-print">
                  Changes = retained − all. Thresholds remain fixed to the complete dataset.
                </p>
              </div>
            </div>
            <p className="method-notice">
              <Icon name="help" size={19} />
              <span>
                Exploratory exclusion is not scientifically justified data cleaning. Investigate
                source records and apply domain knowledge before changing your dataset.
              </span>
            </p>
          </section>
          <section id="exports" className="panel export-panel">
            <SectionTitle
              step="05 / TAKE IT WITH YOU"
              title="Keep your analysis transparent"
              description="Download reproducible results, generated entirely in your browser."
            />
            <div className="tabular-export-settings">
              <label>
                Data export format
                <select
                  aria-label="Data export format"
                  value={tableFormat}
                  onChange={(event) => setTableFormat(event.target.value as 'csv' | 'tsv' | 'xlsx')}
                >
                  <option value="csv">CSV (comma-separated)</option>
                  <option value="tsv">TSV (tab-separated)</option>
                  <option value="xlsx">Excel workbook (.xlsx)</option>
                </select>
              </label>
              <p>Applies to datasets and summaries. The analysis report stays HTML.</p>
            </div>
            <div className="export-grid">
              {[
                [
                  'annotated',
                  'Complete dataset',
                  'Every row, original values, independent flags, and sensitivity exclusions.',
                  tableFormat.toUpperCase(),
                ],
                [
                  'flagged',
                  'Observations to review',
                  'Statistical flags, range violations, and missing or invalid entries.',
                  tableFormat.toUpperCase(),
                ],
                [
                  'summary',
                  'Statistical summary',
                  'All descriptive statistics, thresholds, and sensitivity settings.',
                  tableFormat.toUpperCase(),
                ],
                [
                  'report',
                  'Analysis report',
                  'A standalone, printable report with methods and limitations.',
                  'HTML',
                ],
              ].map(([kind, title, description, type]) => (
                <button
                  key={kind}
                  className="export-button"
                  disabled={!canExport}
                  onClick={() => exportFile(kind)}
                >
                  <div>
                    <span className="file-type">{type}</span>
                    <Icon name="download" size={18} />
                  </div>
                  <strong>{title}</strong>
                  <span>{description}</span>
                </button>
              ))}
            </div>
            <p className="fine-print">
              CSV and TSV use UTF-8 and spreadsheet formula protection. Excel stores original
              identifiers and values as text, parsed values as numbers, and includes methods and
              citations. Dashboard values are rounded for readability; numerical exports retain
              calculation precision. Blank summary fields mean unavailable or unspecified.
            </p>
            {exportError && (
              <p className="message error" role="alert">
                {exportError}
              </p>
            )}
          </section>
          <section id="methods" className="panel methods-panel">
            <SectionTitle
              step="BUILT FOR TRANSPARENT RESEARCH"
              title="Understand the methods"
              description="A flag is a starting point for investigation, not proof of an incorrect observation."
            />
            {methods.map((method) => (
              <details key={method.title}>
                <summary>{method.title}</summary>
                <p>{method.explanation}</p>
                {'formula' in method && <p className="method-formula">{method.formula}</p>}
                <div className="method-example">
                  <strong>Worked example</strong>
                  <p>{method.example}</p>
                </div>
                <p>{method.detail}</p>
              </details>
            ))}
            <p className="fine-print">
              Methods follow the{' '}
              <a
                href="https://www.itl.nist.gov/div898/handbook/eda/section3/eda35h.htm"
                target="_blank"
                rel="noreferrer"
              >
                NIST outlier screening reference
              </a>{' '}
              and{' '}
              <a
                href="https://stat.ethz.ch/R-manual/R-devel/library/stats/html/quantile.html"
                target="_blank"
                rel="noreferrer"
              >
                R’s type 7 quantile definition
              </a>
              . External references open only when you choose a link. Refreshing or closing clears
              entered data; RangeSieve uses no persistent browser storage. Browser or
              operating-system clipboard, form restoration, and downloads are outside the
              application’s control.
            </p>
          </section>
          <section id="citation" className="panel citation-panel">
            <SectionTitle
              step="REPRODUCIBLE RESEARCH"
              title="Cite RangeSieve"
              description="Credit the tool and record the version and thresholds used in your analysis."
            />
            <p>
              Created by {SOFTWARE.author} (
              <a href={SOFTWARE.profile} target="_blank" rel="noreferrer">
                {SOFTWARE.handle}
              </a>
              ).{' '}
              <a href={SOFTWARE.orcid} target="_blank" rel="noreferrer">
                ORCID: 0009-0006-3110-6598
              </a>
            </p>
            <blockquote className="software-citation">{softwareCitation()}</blockquote>
            <p>
              <a href={`https://doi.org/${SOFTWARE.doi}`} target="_blank" rel="noreferrer">
                Archived release · DOI: {SOFTWARE.doi}
              </a>
            </p>
            <button
              className="button secondary"
              onClick={() =>
                download('RangeSieve-citation.txt', softwareCitation(), 'text/plain;charset=utf-8')
              }
            >
              Download software citation
            </button>
            <p className="fine-print">
              Cite the version-specific DOI for the release you used. A software citation credits
              the creator; method references explain the statistical choices. Include the methods
              you actually used, following your journal’s policy.
            </p>
            <details>
              <summary>Method and software references</summary>
              <ul className="reference-list">
                {references.map((reference) => (
                  <li key={reference.id}>
                    <a href={reference.url} target="_blank" rel="noreferrer">
                      {reference.title}
                    </a>
                    <p>{reference.use}</p>
                  </li>
                ))}
              </ul>
            </details>
          </section>
          <footer className="page-footer">
            <span className="footer-brand">
              <Icon name="sieve" size={18} /> RangeSieve
            </span>
            <span>
              Created by {SOFTWARE.author} (
              <a href={SOFTWARE.profile} target="_blank" rel="noreferrer">
                {SOFTWARE.handle}
              </a>
              ) · <a href="#citation">Cite RangeSieve</a>
            </span>
            <span>v1.0.0 · MIT license</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
