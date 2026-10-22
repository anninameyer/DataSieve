import Plotly from 'plotly.js-cartesian-dist-min';
import type { Data, Layout } from 'plotly.js';
import { type Analysis } from './core';
import { escapeHtml } from './exports';
import { imagePdf, pngMetadata, tiff } from './figure-formats';

export { defaultPalette, figureCaption, type Palette, type FigureFormat } from './figure-model';
import {
  figureDescription,
  resolveFigureText,
  type FigureOptions,
  type FigureFormat,
} from './figure-model';
import { figureScale } from './plot-scale';

function dataUrlText(url: string): string {
  const comma = url.indexOf(',');
  if (comma < 0) throw new Error('Plotly returned an invalid figure.');
  return url.slice(0, comma).includes(';base64')
    ? new TextDecoder().decode(
        Uint8Array.from(atob(url.slice(comma + 1)), (char) => char.charCodeAt(0)),
      )
    : decodeURIComponent(url.slice(comma + 1));
}
async function canvasFromSvg(
  svg: string,
  width: number,
  height: number,
): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser cannot create the figure. Try SVG instead.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function exportFigure(
  analysis: Analysis,
  data: Data[],
  layout: Partial<Layout>,
  options: FigureOptions,
  output: FigureFormat,
) {
  if (!analysis.summary.n)
    throw new Error('Analyze numerical observations before exporting a figure.');
  const scaleError = figureScale(analysis, options.scale, options.pseudocount ?? 0).error;
  if (scaleError) throw new Error(scaleError);
  const pixelWidth = Math.round((options.widthMm / 25.4) * options.dpi),
    pixelHeight = Math.round((options.heightMm / 25.4) * options.dpi);
  if (
    ![options.widthMm, options.heightMm].every(
      (value) => Number.isFinite(value) && value >= 80 && value <= 300,
    ) ||
    ![300, 600].includes(options.dpi) ||
    pixelWidth * pixelHeight > 25_000_000
  )
    throw new Error(
      'Use dimensions from 80–300 mm and at most 25 million pixels. Reduce dimensions or resolution.',
    );
  const width = Math.round((options.widthMm / 25.4) * 96),
    height = Math.round((options.heightMm / 25.4) * 96);
  const caption = figureDescription(analysis, options);
  const text = resolveFigureText(options);
  const target = document.createElement('div');
  target.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:${height}px;pointer-events:none;`;
  target.setAttribute('aria-hidden', 'true');
  document.body.append(target);
  try {
    const exportLayout: Partial<Layout> = {
      ...layout,
      autosize: false,
      width,
      height,
      paper_bgcolor: '#ffffff',
      plot_bgcolor: '#ffffff',
      uirevision: undefined,
      margin: { l: 65, r: 20, t: 88, b: 170 },
      title: {
        text: text.title ? `${escapeHtml(text.title)}<br><sup>n = ${analysis.summary.n}</sup>` : '',
        font: { size: 16 },
        x: 0.08,
        xanchor: 'left',
      },
      xaxis: {
        ...layout.xaxis,
        title: { text: escapeHtml(text.xAxis) },
        autorange: options.kind !== 'box' && options.kind !== 'violin',
        ...(options.kind === 'box' || options.kind === 'violin'
          ? { range: [-0.45, 1] }
          : { range: undefined }),
      },
      yaxis: {
        ...layout.yaxis,
        title: { text: escapeHtml(text.yAxis) },
        showgrid: options.showGrid,
        autorange: true,
        range: undefined,
      },
      showlegend: true,
      legend: {
        orientation: 'h',
        x: 0,
        y: -0.24,
        xanchor: 'left',
        yanchor: 'top',
        font: { size: 10 },
      },
      shapes: layout.shapes?.map((shape) => ({ ...shape, showlegend: true })),
    };
    await Plotly.newPlot(target, data, exportLayout, {
      staticPlot: true,
      displayModeBar: false,
      responsive: false,
    });
    let svg = dataUrlText(await Plotly.toImage(target, { format: 'svg', width, height }));
    // SVG is editable; embedded metadata carries exact cutoffs, colors, and interpretation.
    svg = svg.replace(
      /(<svg\b[^>]*>)/,
      (match) => `${match}<metadata>${escapeHtml(caption)}</metadata>`,
    );
    if (output === 'svg')
      return { content: svg, mime: 'image/svg+xml;charset=utf-8', extension: 'svg' };
    const canvas = await canvasFromSvg(svg, pixelWidth, pixelHeight);
    try {
      if (output === 'png') {
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error('PNG generation failed; try SVG.'))),
            'image/png',
          ),
        );
        return {
          content: pngMetadata(new Uint8Array(await blob.arrayBuffer()), options.dpi, caption),
          mime: 'image/png',
          extension: 'png',
        };
      }
      const rgba = canvas.getContext('2d')!.getImageData(0, 0, pixelWidth, pixelHeight).data;
      return output === 'tiff'
        ? {
            content: tiff(pixelWidth, pixelHeight, rgba, options.dpi, caption),
            mime: 'image/tiff',
            extension: 'tiff',
          }
        : {
            content: imagePdf(pixelWidth, pixelHeight, rgba, options.dpi, text.title, caption),
            mime: 'application/pdf',
            extension: 'pdf',
          };
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  } finally {
    Plotly.purge(target);
    target.remove();
  }
}
