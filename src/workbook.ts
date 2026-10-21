import { strToU8, zipSync } from 'fflate';
import { SOFTWARE } from './references';

export interface Sheet {
  name: string;
  rows: unknown[][];
}
/** Minimal ECMA-376 workbook: typed cells, frozen headers, wrapped text and no formulas. */
function xml(value: string): string {
  return value
    .replace(
      /[&<>"']/g,
      (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!,
    )
    .replace(/\r/g, '&#13;');
}
function textCell(value: string): string {
  if (value.length > 32767)
    throw new Error(
      'An original field exceeds Excel’s 32,767-character cell limit. Use CSV or TSV to preserve it without truncation.',
    );
  // SpreadsheetML escapes controls and literal strings resembling its escape sequences.
  return xml(
    value
      .replace(/_x[\da-f]{4}_/gi, (match) => `_x005F_${match.slice(1)}`)
      .replace(
        /[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]/g,
        (char) => `_x${char.charCodeAt(0).toString(16).padStart(4, '0').toUpperCase()}_`,
      ),
  );
}
function column(index: number): string {
  let result = '';
  for (let n = index + 1; n; n = Math.floor((n - 1) / 26))
    result = String.fromCharCode(65 + ((n - 1) % 26)) + result;
  return result;
}
export function workbook(sheets: Sheet[]): Uint8Array {
  if (
    !sheets.length ||
    new Set(sheets.map((sheet) => sheet.name.toLowerCase())).size !== sheets.length
  )
    throw new Error('Workbook requires distinct sheet names.');
  const files: Record<string, Uint8Array> = {};
  const add = (name: string, content: string) => {
    files[name] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${content}`);
  };
  const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  add(
    '[Content_Types].xml',
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
  );
  add(
    '_rels/.rels',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>',
  );
  add(
    'docProps/core.xml',
    `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>RangeSieve analysis</dc:title><dc:creator>${xml(SOFTWARE.author)}</dc:creator><dc:description>Generated locally by RangeSieve ${SOFTWARE.version}. Research data is not uploaded.</dc:description></cp:coreProperties>`,
  );
  add(
    'xl/workbook.xml',
    `<workbook xmlns="${ns}" xmlns:r="${rel}"><sheets>${sheets.map((sheet, i) => `<sheet name="${xml(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
  );
  add(
    'xl/_rels/workbook.xml.rels',
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${rel}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="${rel}/styles" Target="styles.xml"/></Relationships>`,
  );
  add(
    'xl/styles.xml',
    `<styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF35566E"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
  );
  sheets.forEach((sheet, index) => {
    if (!sheet.name || sheet.name.length > 31 || /[\\/?*\[\]:]/.test(sheet.name))
      throw new Error('Unsupported Excel sheet name.');
    const width = sheet.rows.reduce((maximum, row) => Math.max(maximum, row.length), 1);
    if (width > 16384 || sheet.rows.length > 1048576)
      throw new Error('Data exceeds Excel worksheet limits.');
    const body = sheet.rows
      .map(
        (row, r) =>
          `<row r="${r + 1}"${r === 0 ? ' ht="32" customHeight="1"' : ''}>${row
            .map((value, c) => {
              const reference = `${column(c)}${r + 1}`,
                style = r === 0 ? 1 : 0;
              if (value === null || value === undefined)
                return `<c r="${reference}" s="${style}"/>`;
              if (typeof value === 'number' && Number.isFinite(value))
                return `<c r="${reference}" s="${style}" t="n"><v>${value}</v></c>`;
              if (typeof value === 'boolean')
                return `<c r="${reference}" s="${style}" t="b"><v>${value ? 1 : 0}</v></c>`;
              return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${textCell(String(value))}</t></is></c>`;
            })
            .join('')}</row>`,
      )
      .join('');
    add(
      `xl/worksheets/sheet${index + 1}.xml`,
      `<worksheet xmlns="${ns}"><dimension ref="A1:${column(width - 1)}${Math.max(1, sheet.rows.length)}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols><col min="1" max="${width}" width="${width <= 2 ? 65 : 24}" customWidth="1"/></cols><sheetData>${body}</sheetData>${sheet.rows.length ? `<autoFilter ref="A1:${column(width - 1)}${sheet.rows.length}"/>` : ''}</worksheet>`,
    );
  });
  return zipSync(files, { level: 6 });
}
