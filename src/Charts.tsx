import { useEffect, useMemo, useRef, useState } from 'react';
import Plotly from 'plotly.js-cartesian-dist-min';
import type { BoxPlotData, Data, Layout, Shape } from 'plotly.js';
import { type Analysis, type Priority } from './core';
import { download, escapeHtml, format } from './exports';
import {
  defaultPalette,
  exportFigure,
  figureCaption,
  type FigureFormat,
  type Palette,
} from './figure-export';

const markerSymbols: Record<Priority, 'circle' | 'triangle-up' | 'square' | 'diamond'> = {
  'No statistical flags': 'circle',
  'Statistical outlier': 'triangle-up',
  'Extreme statistical outlier': 'square',
  'Outside expected range': 'diamond',
  'Invalid or missing value': 'circle',
};
function LegendSymbol({ priority, color }: { priority: Priority; color: string }) {
  return (
    <svg
      aria-hidden="true"
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill={color}
      stroke="#333"
      strokeWidth=".6"
    >
      {priority === 'Statistical outlier' ? (
        <path d="M6 1 11 11 1 11Z" />
      ) : priority === 'Extreme statistical outlier' ? (
        <rect x="2" y="2" width="8" height="8" />
      ) : priority === 'Outside expected range' ? (
        <path d="M6 0 12 6 6 12 0 6Z" />
      ) : (
        <circle cx="6" cy="6" r="4.5" />
      )}
    </svg>
  );
}
export type ChartKind = 'histogram' | 'box' | 'sorted';
export function Charts({
  analysis,
  label,
  canExport = true,
}: {
  analysis: Analysis;
  label: string;
  canExport?: boolean;
}) {
  const [kind, setKind] = useState<ChartKind>('histogram');
  const [bins, setBins] = useState(18);
  const [showMean, setShowMean] = useState(false);
  const [showMedian, setShowMedian] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showRange, setShowRange] = useState(true);
  const [showIqr, setShowIqr] = useState(false);
  const [error, setError] = useState('');
  const [palette, setPalette] = useState<Palette>({ ...defaultPalette });
  const [colorCodes, setColorCodes] = useState<Palette>({ ...defaultPalette });
  const [figureFormat, setFigureFormat] = useState<FigureFormat>('png');
  const [dpi, setDpi] = useState(300);
  const [widthMm, setWidthMm] = useState('180');
  const [heightMm, setHeightMm] = useState('140');
  const [exportBusy, setExportBusy] = useState(false);
  const [exportNotice, setExportNotice] = useState('');
  const colors: Record<Priority, string> = {
    'No statistical flags': palette.normal,
    'Statistical outlier': palette.mild,
    'Extreme statistical outlier': palette.extreme,
    'Outside expected range': palette.outside,
    'Invalid or missing value': '#777777',
  };
  const figureOptions = {
    kind,
    label,
    bins,
    showMean,
    showMedian,
    showGrid,
    showRange,
    showIqr,
    palette,
    dpi,
    widthMm: Number(widthMm),
    heightMm: Number(heightMm),
  };
  const element = useRef<HTMLDivElement>(null);
  const valid = useMemo(() => analysis.rows.filter((row) => row.status === 'valid'), [analysis]);
  const chart = useMemo(() => {
    const { summary } = analysis;
    const values = valid.map((row) => row.value!);
    const shapes: Partial<Shape>[] = [];
    const vertical = kind === 'histogram';
    const line = (
      value: number | null,
      color: string,
      dash: 'dot' | 'dash' | 'solid' | 'dashdot' = 'dash',
      name = '',
    ) => {
      if (value === null) return;
      shapes.push(
        vertical
          ? {
              type: 'line',
              name,
              x0: value,
              x1: value,
              y0: 0,
              y1: 1,
              yref: 'paper',
              line: { color, dash, width: name.startsWith('Median') ? 2.5 : 1.5 },
            }
          : {
              type: 'line',
              name,
              y0: value,
              y1: value,
              x0: 0,
              x1: 1,
              xref: 'paper',
              line: { color, dash, width: name.startsWith('Median') ? 2.5 : 1.5 },
            },
      );
    };
    if (showRange) {
      line(
        analysis.settings.min,
        palette.outside,
        'dash',
        `Expected minimum = ${format(analysis.settings.min)}`,
      );
      line(
        analysis.settings.max,
        palette.outside,
        'dash',
        `Expected maximum = ${format(analysis.settings.max)}`,
      );
    }
    if (showIqr) {
      line(analysis.mildLow, palette.mild, 'dot', `Mild lower fence = ${format(analysis.mildLow)}`);
      line(
        analysis.mildHigh,
        palette.mild,
        'dot',
        `Mild upper fence = ${format(analysis.mildHigh)}`,
      );
      line(
        analysis.extremeLow,
        palette.extreme,
        'dashdot',
        `Extreme lower fence = ${format(analysis.extremeLow)}`,
      );
      line(
        analysis.extremeHigh,
        palette.extreme,
        'dashdot',
        `Extreme upper fence = ${format(analysis.extremeHigh)}`,
      );
    }
    if (showMedian)
      line(summary.median, palette.median, 'solid', `Median = ${format(summary.median)}`);
    if (showMean) line(summary.mean, palette.mean, 'dash', `Mean = ${format(summary.mean)}`);
    let data: Data[];
    if (kind === 'histogram') {
      const low = summary.min ?? 0,
        high = summary.max ?? 1;
      // Plotly histogram bins are right-open: a small outer pad includes the maximum.
      const padding = low === high ? Math.max(0.5, Math.abs(low) * 0.01) : (high - low) * 1e-6;
      data = [
        {
          type: 'histogram',
          name: 'All valid observations',
          x: values,
          xbins: {
            start: low - padding,
            end: high + padding,
            size: (high - low + padding * 2) / bins,
          },
          marker: { color: palette.normal, line: { color: '#ffffff', width: 1.5 } },
          hovertemplate: 'Value: %{x}<br>Observations: %{y}<extra></extra>',
        },
      ];
    } else {
      const sorted = [...valid].sort((a, b) => a.value! - b.value!);
      data = [];
      if (kind === 'box' && summary.n) {
        const within = sorted.filter(
          (row) =>
            (analysis.mildLow === null || row.value! >= analysis.mildLow) &&
            (analysis.mildHigh === null || row.value! <= analysis.mildHigh),
        );
        // Supply our type-7 quartiles and observed whiskers; do not use Plotly's separate quartile convention.
        // The upstream types omit Plotly's documented precomputed-box attributes.
        const box: Partial<BoxPlotData> & {
          q1: number[];
          median: number[];
          q3: number[];
          lowerfence: number[];
          upperfence: number[];
        } = {
          type: 'box',
          orientation: 'v',
          x: [0],
          q1: [summary.q1!],
          median: [summary.median!],
          q3: [summary.q3!],
          lowerfence: [within[0]?.value ?? summary.q1!],
          upperfence: [within.at(-1)?.value ?? summary.q3!],
          boxpoints: false,
          width: 0.42,
          line: { color: palette.normal },
          fillcolor: 'rgba(127,127,127,0.08)',
          name: 'Distribution (type 7 quartiles)',
          showlegend: false,
          hoverinfo: 'skip',
        };
        data.push(box);
      }
      for (const [priority, color] of Object.entries(colors)) {
        const group = sorted
          .map((row, index) => ({ row, index }))
          .filter(({ row }) => row.priority === priority);
        if (!group.length) continue;
        data.push({
          type: 'scatter',
          mode: 'markers',
          name: priority,
          x: group.map(({ row, index }) =>
            kind === 'sorted' ? index + 1 : 0.36 + ((row.row * 37) % 97) / 300,
          ),
          y: group.map(({ row }) => row.value!),
          customdata: group.map(({ row }) => [
            escapeHtml(row.id),
            escapeHtml(row.original),
            row.row,
          ]),
          marker: {
            color,
            size: kind === 'box' ? 9 : 8,
            opacity: 0.85,
            symbol: markerSymbols[priority as Priority],
            line: { color: '#333333', width: 0.6 },
          },
          hovertemplate:
            '%{customdata[0]}<br>Original value: %{customdata[1]}<br>Source row: %{customdata[2]}<extra>' +
            escapeHtml(priority) +
            '</extra>',
        });
      }
    }
    const layout: Partial<Layout> = {
      autosize: true,
      margin: { l: 64, r: 30, t: 24, b: 58 },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      showlegend: false,
      font: { family: 'system-ui, sans-serif', size: 12, color: '#4a4a4a' },
      xaxis: {
        title: {
          text: vertical
            ? escapeHtml(label)
            : kind === 'sorted'
              ? 'Observation rank (ordered by value)'
              : '',
        },
        showgrid: false,
        zeroline: false,
        ...(kind === 'box' ? { showticklabels: false, range: [-0.45, 1] } : {}),
      },
      yaxis: {
        title: { text: vertical ? 'Observations' : escapeHtml(label) },
        showgrid: showGrid,
        gridcolor: '#e5e7eb',
        zeroline: false,
        ...(vertical ? { rangemode: 'tozero', dtick: summary.n < 10 ? 1 : undefined } : {}),
      },
      shapes,
      hovermode: 'closest',
      dragmode: 'zoom',
      uirevision: `${kind}-${analysis.rows.length}-${summary.min}-${summary.max}-${showRange}-${showIqr}`,
    };
    return { data, layout };
  }, [
    analysis,
    valid,
    kind,
    bins,
    showMean,
    showMedian,
    showGrid,
    showRange,
    showIqr,
    label,
    palette,
  ]);
  const unplottable =
    valid.length > 0 &&
    (!Number.isFinite(analysis.summary.max! - analysis.summary.min!) ||
      Math.max(Math.abs(analysis.summary.max!), Math.abs(analysis.summary.min!)) > 1e100 ||
      (Math.max(Math.abs(analysis.summary.max!), Math.abs(analysis.summary.min!)) > 0 &&
        Math.max(Math.abs(analysis.summary.max!), Math.abs(analysis.summary.min!)) < 1e-100));
  useEffect(() => {
    if (!element.current) return;
    if (!valid.length || unplottable) {
      Plotly.purge(element.current);
      setError('');
      return;
    }
    let current = true;
    setError('');
    Plotly.react(element.current, chart.data, chart.layout, {
      responsive: true,
      displaylogo: false,
      scrollZoom: false,
      modeBarButtonsToRemove: ['toImage', 'select2d', 'lasso2d'],
      doubleClick: 'reset',
    }).catch(() => {
      if (current)
        setError(
          'The chart could not be rendered. Review the table and try rescaling your measurement units.',
        );
    });
    return () => {
      current = false;
    };
  }, [chart, unplottable, valid.length]);
  useEffect(() => {
    const target = element.current;
    if (!target) return;
    const observer = new ResizeObserver(() => {
      if (target.classList.contains('js-plotly-plot')) void Plotly.Plots.resize(target);
    });
    observer.observe(target);
    return () => {
      observer.disconnect();
      Plotly.purge(target);
    };
  }, []);
  function changeColor(key: keyof Palette, value: string) {
    // Native pickers may emit continuous input events before their final change event.
    setPalette((current) => (current[key] === value ? current : { ...current, [key]: value }));
    setColorCodes((current) => (current[key] === value ? current : { ...current, [key]: value }));
    if (key === 'mean') setShowMean(true);
    if (key === 'median') setShowMedian(true);
    if (key === 'outside' && (analysis.settings.min !== null || analysis.settings.max !== null))
      setShowRange(true);
  }
  async function saveFigure() {
    if (!canExport || !valid.length || unplottable || exportBusy) return;
    setExportBusy(true);
    setExportNotice('Preparing figure locally…');
    try {
      const result = await exportFigure(
        analysis,
        chart.data,
        chart.layout,
        figureOptions,
        figureFormat,
      );
      download(
        `${kind === 'box' ? 'boxplot' : kind === 'sorted' ? 'sorted-observations' : 'histogram'}.${result.extension}`,
        result.content,
        result.mime,
      );
      setExportNotice(
        'Figure downloaded. Use the matching caption to report thresholds and methods.',
      );
    } catch (error) {
      setExportNotice((error as Error).message);
    } finally {
      setExportBusy(false);
    }
  }
  return (
    <>
      <div className="chart-toolbar">
        <div className="segmented" role="group" aria-label="Visualization type">
          {(
            [
              ['histogram', 'Histogram'],
              ['box', 'Boxplot'],
              ['sorted', 'Sorted observations'],
            ] as const
          ).map(([key, text]) => (
            <button key={key} aria-pressed={kind === key} onClick={() => setKind(key)}>
              {text}
            </button>
          ))}
        </div>
        {kind === 'histogram' && (
          <label className="bins">
            Bins{' '}
            <input
              aria-label="Number of histogram bins"
              type="range"
              min="5"
              max="80"
              value={bins}
              onChange={(event) => setBins(Number(event.target.value))}
            />
            <output>{bins}</output>
          </label>
        )}
      </div>
      <div
        className="chart"
        role="img"
        aria-label={`${kind} of ${valid.length} valid observations. Data and classifications are also available in the results table.`}
      >
        <div ref={element} className="plotly-target" />
        {(!valid.length || unplottable || error) && (
          <div className="chart-empty">
            {error ||
              (unplottable
                ? 'This numerical scale exceeds the chart’s supported range. Rescale units to visualize these observations; the original data and statistical results remain available below.'
                : 'Your distribution will appear here.')}
            <span>
              {!valid.length ? 'Paste a dataset or explore the synthetic example to begin.' : ''}
            </span>
          </div>
        )}
      </div>
      <div className="chart-options">
        <label>
          <input
            type="checkbox"
            checked={showMedian}
            onChange={(event) => setShowMedian(event.target.checked)}
          />{' '}
          Median line
        </label>
        <label>
          <input
            type="checkbox"
            checked={showMean}
            onChange={(e) => setShowMean(e.target.checked)}
          />{' '}
          Mean line
        </label>
        <label>
          <input
            type="checkbox"
            checked={showRange}
            onChange={(e) => setShowRange(e.target.checked)}
          />{' '}
          Expected bounds
        </label>
        <label>
          <input type="checkbox" checked={showIqr} onChange={(e) => setShowIqr(e.target.checked)} />{' '}
          IQR fences
        </label>
        <label>
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(event) => setShowGrid(event.target.checked)}
          />{' '}
          Horizontal grid lines
        </label>
        <span>Drag to zoom · Double-click to reset</span>
      </div>
      <div className="legend">
        {Object.entries(colors)
          .filter(([priority]) => priority !== 'Invalid or missing value')
          .map(([priority, color]) => (
            <span key={priority}>
              <LegendSymbol priority={priority as Priority} color={color} />
              {priority}
            </span>
          ))}
        {showMedian && (
          <span>
            <i className="median-mark" style={{ background: palette.median }} />
            Median {format(analysis.summary.median)}
          </span>
        )}
      </div>
      <p className="fine-print">
        {kind === 'histogram'
          ? 'Bars count all valid observations; colors below describe observation flags in the other plots.'
          : 'Hover over a point to see its identifier, original value, and source row. Colors show the highest review priority; rows can have multiple flags.'}
      </p>
      <details className="figure-settings">
        <summary>Figure colors &amp; manuscript export</summary>
        <p className="fine-print">
          Default colors follow Okabe–Ito blue, orange, reddish purple and black. Circles,
          triangles, squares and diamonds identify the four classes; line patterns also differ.
          Custom colors may reduce distinguishability. Use a color picker or enter a six-digit color
          code, such as #0072B2.
        </p>
        <p className="fine-print">
          Choosing a mean, median or expected-bound color also shows that reference line.
          Expected-bound lines require at least one expected minimum or maximum above; the chosen
          color also applies to any observations outside that range.
        </p>
        <div className="figure-colors">
          {(
            [
              ['normal', 'Typical observations / bars'],
              ['mild', 'Statistical outliers / mild fences'],
              ['extreme', 'Extreme IQR outliers / fences'],
              ['outside', 'Outside expected range / bounds'],
              ['median', 'Median line'],
              ['mean', 'Mean line'],
            ] as const
          ).map(([key, text]) => (
            <div className="figure-color-control" key={key}>
              <input
                type="color"
                aria-label={`Color for ${text}`}
                value={palette[key]}
                onInput={(event) => changeColor(key, event.currentTarget.value)}
                onChange={(event) => changeColor(key, event.currentTarget.value)}
              />
              <label className="figure-color-name" htmlFor={`figure-color-${key}`}>
                {text}
              </label>
              <input
                id={`figure-color-${key}`}
                className="color-hex"
                type="text"
                aria-label={`Hex color for ${text}`}
                aria-invalid={!/^#[0-9a-f]{6}$/i.test(colorCodes[key])}
                autoComplete="off"
                spellCheck={false}
                maxLength={7}
                value={colorCodes[key]}
                onChange={(event) => {
                  const value = event.target.value;
                  setColorCodes((current) => ({ ...current, [key]: value }));
                  const hex = value.startsWith('#') ? value : `#${value}`;
                  if (/^#[0-9a-f]{6}$/i.test(hex)) changeColor(key, hex);
                }}
                onBlur={() => setColorCodes((current) => ({ ...current, [key]: palette[key] }))}
              />
            </div>
          ))}
        </div>
        <button
          className="button small secondary"
          onClick={() => {
            setPalette({ ...defaultPalette });
            setColorCodes({ ...defaultPalette });
          }}
        >
          Reset figure colors
        </button>
        <div className="figure-export-controls">
          <label>
            Figure format
            <select
              aria-label="Figure format"
              value={figureFormat}
              onChange={(event) => setFigureFormat(event.target.value as FigureFormat)}
            >
              <option value="png">PNG</option>
              <option value="tiff">TIFF (lossless RGB)</option>
              <option value="pdf">PDF (lossless raster)</option>
              <option value="svg">SVG (editable vector)</option>
            </select>
          </label>
          <label>
            Resolution
            <select
              aria-label="Figure resolution"
              value={dpi}
              onChange={(event) => setDpi(Number(event.target.value))}
            >
              <option value="300">300 DPI</option>
              <option value="600">600 DPI</option>
            </select>
          </label>
          <label>
            Width (mm)
            <input
              type="number"
              min="80"
              max="300"
              value={widthMm}
              onChange={(event) => setWidthMm(event.target.value)}
            />
          </label>
          <label>
            Height (mm)
            <input
              type="number"
              min="80"
              max="300"
              value={heightMm}
              onChange={(event) => setHeightMm(event.target.value)}
            />
          </label>
        </div>
        <div className="figure-export-actions">
          <button
            className="button primary"
            disabled={!canExport || !valid.length || unplottable || exportBusy}
            onClick={saveFigure}
          >
            {exportBusy ? 'Preparing figure…' : 'Download figure'}
          </button>
          <button
            className="button secondary"
            disabled={!canExport || !valid.length}
            onClick={() =>
              download(
                `${kind === 'box' ? 'boxplot' : kind === 'sorted' ? 'sorted-observations' : 'histogram'}-caption.txt`,
                figureCaption(analysis, figureOptions),
                'text/plain;charset=utf-8',
              )
            }
          >
            Download figure caption
          </button>
        </div>
        <p className="fine-print">
          Exports include a legend and visible reference lines, reset zoom to show all valid
          observations, and preserve your colors. PNG, TIFF and PDF use the selected resolution; PDF
          contains a lossless image. SVG is vector. TIFF is uncompressed RGB. Pair the figure with
          its caption to document thresholds; figures always show the full dataset, without
          sensitivity exclusions.
        </p>
        {exportNotice && (
          <p className="message" role="status">
            {exportNotice}
          </p>
        )}
      </details>
    </>
  );
}
