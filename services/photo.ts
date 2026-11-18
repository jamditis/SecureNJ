/**
 * Logic of the photo cleaner: where a cover goes, how the picture is painted,
 * and which bytes of the encoded picture go into the saved file.
 *
 * The saved file is built in two steps, and neither step sees the file that
 * the user chose:
 *
 * 1. The decoded picture is painted on a canvas and the covers are painted on
 *    top of it, in the same pixels. The canvas then makes a new JPEG.
 * 2. `stripJpegMetadata` copies from that JPEG only the segments that hold
 *    the picture. A segment that can hold hidden data (EXIF with GPS, XMP,
 *    IPTC, a comment, a color profile, a thumbnail) is not copied, also when
 *    the encoder of a browser adds one.
 */

/** The side of a cover, as a percentage of the picture width. */
export const COVER_PERCENT_MIN = 3;
export const COVER_PERCENT_MAX = 35;
export const COVER_PERCENT_DEFAULT = 12;

/** Each cover is this number of pixels larger on each side than the selected size. */
export const COVER_MARGIN = 2;

export const COVER_COLOR = '#000';
/** A JPEG has no transparency. Clear parts of a PNG become white, so that they do not look like covers. */
export const BACKGROUND_COLOR = '#fff';

/** The name does not come from the original file: a file name can also tell who took a photo and when. */
export const CLEANED_FILE_NAME = 'cleaned-photo.jpg';
export const CLEANED_TYPE = 'image/jpeg';
export const CLEANED_QUALITY = 0.92;

/** A square cover. `x` and `y` are its center. All values are in pixels of the picture. */
export interface Cover {
  x: number;
  y: number;
  size: number;
}

export interface Size {
  width: number;
  height: number;
}

/** The position of a pointer in the window. */
export interface Point {
  clientX: number;
  clientY: number;
}

/** The place of the canvas on the screen: the border box, the border, and the content size. */
export interface DisplayBox {
  left: number;
  top: number;
  clientLeft: number;
  clientTop: number;
  clientWidth: number;
  clientHeight: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function clampCoverPercent(percent: number): number {
  if (!Number.isFinite(percent)) return COVER_PERCENT_DEFAULT;
  return Math.min(COVER_PERCENT_MAX, Math.max(COVER_PERCENT_MIN, percent));
}

/**
 * The cover for a click or tap on the canvas. The canvas is shown smaller
 * than the picture, so the position is scaled to pixels of the picture.
 * Gives null while the canvas has no size on the screen.
 */
export function coverAt(point: Point, box: DisplayBox, picture: Size, percent: number): Cover | null {
  if (box.clientWidth <= 0 || box.clientHeight <= 0) return null;
  return {
    x: (point.clientX - box.left - box.clientLeft) * (picture.width / box.clientWidth),
    y: (point.clientY - box.top - box.clientTop) * (picture.height / box.clientHeight),
    size: (picture.width * clampCoverPercent(percent)) / 100,
  };
}

/** The pixels that a cover paints. The edges are rounded outward, so a cover is never smaller than selected. */
export function coverRect(cover: Cover): Rect {
  const side = Math.ceil(cover.size) + COVER_MARGIN * 2;
  return {
    x: Math.floor(cover.x - cover.size / 2) - COVER_MARGIN,
    y: Math.floor(cover.y - cover.size / 2) - COVER_MARGIN,
    width: side,
    height: side,
  };
}

/** The part of a 2D canvas context that the painter uses. A test supplies its own. */
export interface PaintSurface<Picture> {
  globalAlpha: number;
  globalCompositeOperation: string;
  fillStyle: string | object;
  drawImage(picture: Picture, x: number, y: number): void;
  fillRect(x: number, y: number, width: number, height: number): void;
}

/**
 * Paints the picture and then the covers into the same pixels. The covers
 * replace the pixels below them: they are not a layer, and the saved file has
 * no copy of what was below.
 */
export function paintPhoto<Picture>(surface: PaintSurface<Picture>, picture: Picture, size: Size, covers: readonly Cover[]): void {
  // Full opacity and plain "paint on top", so that a cover replaces the pixels below it.
  surface.globalAlpha = 1;
  surface.globalCompositeOperation = 'source-over';
  surface.fillStyle = BACKGROUND_COLOR;
  surface.fillRect(0, 0, size.width, size.height);
  surface.drawImage(picture, 0, 0);
  surface.fillStyle = COVER_COLOR;
  for (const cover of covers) {
    const rect = coverRect(cover);
    surface.fillRect(rect.x, rect.y, rect.width, rect.height);
  }
}

const MARKER_SOI = 0xd8;
const MARKER_EOI = 0xd9;
const MARKER_SOS = 0xda;
const MARKER_APP0 = 0xe0;
const MARKER_APP14 = 0xee;
const JFIF_ID = [0x4a, 0x46, 0x49, 0x46, 0x00]; // "JFIF" and a zero byte
const ADOBE_ID = [0x41, 0x64, 0x6f, 0x62, 0x65]; // "Adobe"
/** Marker, length, identifier, version, density unit, and density. A thumbnail can follow. */
const JFIF_FIXED_LENGTH = 16;
/** Marker, length, identifier, version, two flag fields, and the color transform. */
const ADOBE_SEGMENT_LENGTH = 16;

const isRestart = (marker: number): boolean => marker >= 0xd0 && marker <= 0xd7;

const startsWith = (segment: Uint8Array, id: readonly number[]): boolean => id.every((byte, index) => segment[4 + index] === byte);

/**
 * Gives the bytes of a segment to copy, or null for a segment to drop.
 * Only the segments that a decoder needs for the pixels are copied:
 * frame and scan headers, the tables, and two small headers with fixed fields.
 */
function keptSegment(marker: number, segment: Uint8Array): Uint8Array | null {
  // Frame headers and Huffman and arithmetic tables.
  if (marker >= 0xc0 && marker <= 0xcf) return segment;
  // Scan header, quantization tables, line count, restart interval, hierarchical headers.
  if (marker >= MARKER_SOS && marker <= 0xdf) return segment;
  if (marker === MARKER_APP0 && segment.length >= JFIF_FIXED_LENGTH + 2 && startsWith(segment, JFIF_ID)) {
    // The JFIF header can hold a thumbnail. Copy the fixed fields and set the thumbnail size to zero.
    const header = new Uint8Array(JFIF_FIXED_LENGTH + 2);
    header.set(segment.subarray(0, JFIF_FIXED_LENGTH));
    header[2] = 0;
    header[3] = JFIF_FIXED_LENGTH;
    return header;
  }
  // The decoder needs the Adobe header to read the colors. It has fixed fields only.
  if (marker === MARKER_APP14 && segment.length === ADOBE_SEGMENT_LENGTH && startsWith(segment, ADOBE_ID)) return segment;
  // All other application segments (EXIF, XMP, IPTC, color profile, maker data) and comments.
  return null;
}

/**
 * Copies a JPEG without the segments that can hold hidden data, and without
 * bytes after the end of the picture. The picture data is copied byte for
 * byte, so the pixels do not change. Gives null if the bytes are not a
 * complete JPEG.
 */
export function stripJpegMetadata(bytes: Uint8Array): Uint8Array<ArrayBuffer> | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== MARKER_SOI) return null;
  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  let hasScan = false;
  let pos = 2;
  while (pos < bytes.length) {
    if (bytes[pos] !== 0xff) return null;
    // More than one 0xff can come before a marker.
    while (bytes[pos + 1] === 0xff) pos += 1;
    const marker = bytes[pos + 1];
    if (marker === undefined) return null;
    if (marker === MARKER_EOI) {
      if (!hasScan) return null;
      parts.push(bytes.subarray(pos, pos + 2));
      return concat(parts);
    }
    // Markers with no length field. They have no meaning outside a scan.
    if (marker === 0x01 || isRestart(marker)) {
      pos += 2;
      continue;
    }
    if (marker === MARKER_SOI || pos + 4 > bytes.length) return null;
    const length = (bytes[pos + 2] << 8) | bytes[pos + 3];
    const end = pos + 2 + length;
    if (length < 2 || end > bytes.length) return null;
    const kept = keptSegment(marker, bytes.subarray(pos, end));
    if (kept) parts.push(kept);
    pos = end;
    if (marker === MARKER_SOS) {
      // The compressed pixels follow the scan header, up to the next marker.
      // Inside them, 0xff is followed by zero or by a restart marker.
      hasScan = true;
      const start = pos;
      while (pos < bytes.length) {
        if (bytes[pos] !== 0xff) pos += 1;
        else if (bytes[pos + 1] === 0x00 || isRestart(bytes[pos + 1])) pos += 2;
        else break;
      }
      parts.push(bytes.subarray(start, pos));
    }
  }
  return null;
}

function concat(parts: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Encodes the painted canvas. A canvas gives null if it cannot make the picture. */
export type EncodePhoto = (type: string, quality: number) => Promise<Blob | null>;

/**
 * Builds the file to save from the painted canvas. The only input is the
 * encoder of the canvas: the file that the user chose cannot reach the
 * result. Gives null if the browser made no JPEG.
 */
export async function buildCleanedFile(encode: EncodePhoto): Promise<Blob | null> {
  const encoded = await encode(CLEANED_TYPE, CLEANED_QUALITY);
  if (!encoded) return null;
  // A browser that cannot make a JPEG gives a PNG. The file name would then be wrong.
  const clean = stripJpegMetadata(new Uint8Array(await encoded.arrayBuffer()));
  if (!clean) return null;
  return new Blob([clean], { type: CLEANED_TYPE });
}
