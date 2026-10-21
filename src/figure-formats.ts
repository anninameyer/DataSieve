import { strToU8, zlibSync } from 'fflate';

function concat(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let i = 0; i < 8; i++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});
function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const result = new Uint8Array(data.length + 12),
    view = new DataView(result.buffer);
  view.setUint32(0, data.length);
  result.set(strToU8(type), 4);
  result.set(data, 8);
  let crc = 0xffffffff;
  for (const byte of result.subarray(4, 8 + data.length))
    crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  view.setUint32(8 + data.length, (crc ^ 0xffffffff) >>> 0);
  return result;
}
/** Preserve lossless canvas PNG pixels; add correct physical resolution and UTF-8 caption. */
export function pngMetadata(png: Uint8Array, dpi: number, caption: string): Uint8Array {
  if (
    png.length < 33 ||
    png.slice(0, 8).some((byte, i) => byte !== [137, 80, 78, 71, 13, 10, 26, 10][i])
  )
    throw new Error('Invalid PNG data.');
  const resolution = new Uint8Array(9),
    view = new DataView(resolution.buffer);
  view.setUint32(0, Math.round(dpi / 0.0254));
  view.setUint32(4, Math.round(dpi / 0.0254));
  resolution[8] = 1;
  const parts: Uint8Array[] = [png.slice(0, 8)];
  let offset = 8,
    ended = false;
  while (offset + 12 <= png.length) {
    const length = new DataView(png.buffer, png.byteOffset + offset, 4).getUint32(0);
    if (length > png.length - offset - 12) throw new Error('Truncated PNG data.');
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
    if (type !== 'pHYs') parts.push(png.slice(offset, offset + 12 + length));
    if (type === 'IHDR')
      parts.push(
        pngChunk('pHYs', resolution),
        pngChunk('iTXt', strToU8(`Description\0\0\0\0\0${caption}`)),
      );
    offset += length + 12;
    if (type === 'IEND') {
      ended = true;
      break;
    }
  }
  if (!ended) throw new Error('PNG has no end marker.');
  return concat(parts);
}
function validateImage(width: number, height: number, rgba: Uint8ClampedArray, dpi: number) {
  if (
    ![width, height, dpi].every((value) => Number.isInteger(value) && value > 0) ||
    width * height > 25_000_000 ||
    rgba.length !== width * height * 4
  )
    throw new Error('Unsupported figure size or pixel data.');
}
function rgbPixels(rgba: Uint8ClampedArray): Uint8Array {
  const rgb = new Uint8Array((rgba.length / 4) * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4) {
    const alpha = rgba[i + 3] / 255;
    for (let c = 0; c < 3; c++) rgb[j++] = Math.round(rgba[i + c] * alpha + 255 * (1 - alpha));
  }
  return rgb;
}
/** Baseline TIFF 6.0: one uncompressed RGB strip, 8-bit samples, real DPI tags. */
export function tiff(
  width: number,
  height: number,
  rgba: Uint8ClampedArray,
  dpi: number,
  caption: string,
): Uint8Array {
  validateImage(width, height, rgba, dpi);
  const rgb = rgbPixels(rgba);
  const description = strToU8(
    `Figure. ${caption}`.replace(
      /[^\x20-\x7e\n]/g,
      (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
    ) + '\0',
  );
  const software = strToU8('Figure export\0');
  const count = 15,
    extras = 8 + 2 + count * 12 + 4;
  const bits = extras,
    xResolution = bits + 8,
    yResolution = xResolution + 8,
    descriptionAt = yResolution + 8,
    softwareAt = descriptionAt + description.length;
  const pixelsAt = Math.ceil((softwareAt + software.length) / 4) * 4;
  const output = new Uint8Array(pixelsAt + rgb.length),
    view = new DataView(output.buffer);
  output.set([73, 73, 42, 0]);
  view.setUint32(4, 8, true);
  view.setUint16(8, count, true);
  const tags = [
    [256, 4, 1, width],
    [257, 4, 1, height],
    [258, 3, 3, bits],
    [259, 3, 1, 1],
    [262, 3, 1, 2],
    [270, 2, description.length, descriptionAt],
    [273, 4, 1, pixelsAt],
    [277, 3, 1, 3],
    [278, 4, 1, height],
    [279, 4, 1, rgb.length],
    [282, 5, 1, xResolution],
    [283, 5, 1, yResolution],
    [284, 3, 1, 1],
    [296, 3, 1, 2],
    [305, 2, software.length, softwareAt],
  ];
  tags.forEach(([tag, type, n, value], i) => {
    const offset = 10 + i * 12;
    view.setUint16(offset, tag, true);
    view.setUint16(offset + 2, type, true);
    view.setUint32(offset + 4, n, true);
    view.setUint32(offset + 8, value, true);
  });
  for (let i = 0; i < 3; i++) view.setUint16(bits + i * 2, 8, true);
  for (const at of [xResolution, yResolution]) {
    view.setUint32(at, dpi, true);
    view.setUint32(at + 4, 1, true);
  }
  output.set(description, descriptionAt);
  output.set(software, softwareAt);
  output.set(rgb, pixelsAt);
  return output;
}
function pdfText(text: string): string {
  let result = 'FEFF';
  for (let i = 0; i < text.length; i++) result += text.charCodeAt(i).toString(16).padStart(4, '0');
  return `<${result}>`;
}
/** PDF 1.4 containing a lossless RGB image at its specified print size (not vector). */
export function imagePdf(
  width: number,
  height: number,
  rgba: Uint8ClampedArray,
  dpi: number,
  title: string,
  caption: string,
): Uint8Array {
  validateImage(width, height, rgba, dpi);
  const pixels = zlibSync(rgbPixels(rgba), { level: 6 });
  const widthPt = (width / dpi) * 72,
    heightPt = (height / dpi) * 72;
  const content = strToU8(`q\n${widthPt} 0 0 ${heightPt} 0 0 cm\n/Im0 Do\nQ\n`);
  const objects = [
    strToU8('<< /Type /Catalog /Pages 2 0 R >>'),
    strToU8('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    strToU8(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${widthPt} ${heightPt}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
    ),
    concat([
      strToU8(
        `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${pixels.length} >>\nstream\n`,
      ),
      pixels,
      strToU8('\nendstream'),
    ]),
    concat([strToU8(`<< /Length ${content.length} >>\nstream\n`), content, strToU8('endstream')]),
    strToU8(
      `<< /Title ${pdfText(title)} /Subject ${pdfText(caption)} /Creator ${pdfText('Figure export')} >>`,
    ),
  ];
  const parts = [
      concat([strToU8('%PDF-1.4\n%'), new Uint8Array([226, 227, 207, 211]), strToU8('\n')]),
    ],
    offsets = [0];
  let offset = parts[0].length;
  objects.forEach((body, i) => {
    offsets.push(offset);
    const object = concat([strToU8(`${i + 1} 0 obj\n`), body, strToU8('\nendobj\n')]);
    parts.push(object);
    offset += object.length;
  });
  parts.push(
    strToU8(
      `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
        .slice(1)
        .map((position) => `${String(position).padStart(10, '0')} 00000 n \n`)
        .join(
          '',
        )}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${offset}\n%%EOF\n`,
    ),
  );
  return concat(parts);
}
