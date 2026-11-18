import { describe, expect, it } from 'vitest';
import {
  CLEANED_FILE_NAME,
  buildCleanedFile,
  clampCoverPercent,
  coverAt,
  coverRect,
  paintPhoto,
  stripJpegMetadata,
  type PaintSurface,
} from './photo';

// ---------------------------------------------------------------------------
// A small raster with the rules of a 2D canvas, so that a test can read pixels.

type Rgba = [number, number, number, number];

interface RasterPicture {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
}

const solidPicture = (width: number, height: number, color: Rgba): RasterPicture => {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) pixels.set(color, i);
  return { width, height, pixels };
};

const COLORS: Record<string, [number, number, number]> = { '#000': [0, 0, 0], '#fff': [255, 255, 255] };

class Raster implements PaintSurface<RasterPicture> {
  globalAlpha = 1;
  globalCompositeOperation = 'source-over';
  fillStyle: string | object = '#000';
  readonly pixels: Uint8ClampedArray;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    // A new canvas is transparent.
    this.pixels = new Uint8ClampedArray(width * height * 4);
  }

  private blend(x: number, y: number, [r, g, b, a]: Rgba) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    // Only "source-over" paints on top of pixels that are there. With "destination-over", they stay.
    const index = (y * this.width + x) * 4;
    const below = this.pixels.subarray(index, index + 4);
    if (this.globalCompositeOperation !== 'source-over' && below[3] === 255) return;
    const alpha = (a / 255) * this.globalAlpha;
    const belowAlpha = (below[3] / 255) * (1 - alpha);
    const outAlpha = alpha + belowAlpha;
    const mix = (top: number, bottom: number) => (outAlpha === 0 ? 0 : (top * alpha + bottom * belowAlpha) / outAlpha);
    this.pixels.set([mix(r, below[0]), mix(g, below[1]), mix(b, below[2]), outAlpha * 255], index);
  }

  drawImage(picture: RasterPicture, left: number, top: number) {
    for (let y = 0; y < picture.height; y += 1) {
      for (let x = 0; x < picture.width; x += 1) {
        const index = (y * picture.width + x) * 4;
        this.blend(left + x, top + y, Array.from(picture.pixels.subarray(index, index + 4)) as Rgba);
      }
    }
  }

  fillRect(left: number, top: number, width: number, height: number) {
    if (typeof this.fillStyle !== 'string' || !COLORS[this.fillStyle]) throw new Error('The test raster does not know this color');
    const color: Rgba = [...COLORS[this.fillStyle], 255];
    for (let y = top; y < top + height; y += 1) for (let x = left; x < left + width; x += 1) this.blend(x, y, color);
  }

  at(x: number, y: number): number[] {
    const index = (y * this.width + x) * 4;
    return Array.from(this.pixels.subarray(index, index + 4));
  }
}

// ---------------------------------------------------------------------------
// A JPEG as a phone writes it: the picture, and many segments with hidden data.

const ascii = (text: string): number[] => Array.from(text, (char) => char.charCodeAt(0));
const u16 = (value: number): number[] => [(value >> 8) & 0xff, value & 0xff];
const u32 = (value: number): number[] => [...u16(value >>> 16), ...u16(value & 0xffff)];
const segment = (marker: number, payload: number[]): number[] => [0xff, marker, ...u16(payload.length + 2), ...payload];
const contains = (bytes: Uint8Array, needle: number[] | string): boolean =>
  Buffer.from(bytes).includes(Buffer.from(typeof needle === 'string' ? ascii(needle) : needle));

const MAKE = 'ACME Phone 12';
const TAKEN = '2026:11:18 10:15:00';
/** Latitude 40° 44' 12.34" and longitude 74° 10' 56.78", as EXIF stores them. */
const LATITUDE = [...u32(40), ...u32(1), ...u32(44), ...u32(1), ...u32(1234), ...u32(100)];
const LONGITUDE = [...u32(74), ...u32(1), ...u32(10), ...u32(1), ...u32(5678), ...u32(100)];

/** An EXIF segment with the phone model, the time, and a GPS position. */
function exifSegment(): number[] {
  const entry = (tag: number, type: number, count: number, value: number[]) => [...u16(tag), ...u16(type), ...u32(count), ...value];
  const make = [...ascii(MAKE), 0];
  const taken = [...ascii(TAKEN), 0];
  const ifd0Length = 2 + 3 * 12 + 4;
  const makeAt = 8 + ifd0Length;
  const takenAt = makeAt + make.length;
  const gpsAt = takenAt + taken.length;
  const gpsLength = 2 + 4 * 12 + 4;
  const latitudeAt = gpsAt + gpsLength;
  const longitudeAt = latitudeAt + LATITUDE.length;
  const tiff = [
    ...ascii('MM'),
    ...u16(42),
    ...u32(8),
    ...u16(3),
    ...entry(0x010f, 2, make.length, u32(makeAt)),
    ...entry(0x0132, 2, taken.length, u32(takenAt)),
    ...entry(0x8825, 4, 1, u32(gpsAt)),
    ...u32(0),
    ...make,
    ...taken,
    ...u16(4),
    ...entry(1, 2, 2, [...ascii('N'), 0, 0, 0]),
    ...entry(2, 5, 3, u32(latitudeAt)),
    ...entry(3, 2, 2, [...ascii('W'), 0, 0, 0]),
    ...entry(4, 5, 3, u32(longitudeAt)),
    ...u32(0),
    ...LATITUDE,
    ...LONGITUDE,
  ];
  return segment(0xe1, [...ascii('Exif'), 0, 0, ...tiff]);
}

const SOI = [0xff, 0xd8];
const EOI = [0xff, 0xd9];
const JFIF_FIELDS = [...ascii('JFIF'), 0, 1, 1, 1, ...u16(72), ...u16(72)];
const JFIF_PLAIN = segment(0xe0, [...JFIF_FIELDS, 0, 0]);
const THUMBNAIL = [201, 202, 203, 204, 205, 206];
const JFIF_WITH_THUMBNAIL = segment(0xe0, [...JFIF_FIELDS, 2, 1, ...THUMBNAIL]);
const ADOBE = segment(0xee, [...ascii('Adobe'), 0, 100, 0, 0, 0, 0, 1]);
const DQT = segment(0xdb, [0, ...Array.from({ length: 64 }, (_, i) => i + 1)]);
const SOF = segment(0xc0, [8, ...u16(2), ...u16(2), 1, 1, 0x11, 0]);
const DHT = segment(0xc4, [0, ...Array.from({ length: 16 }, () => 0), 7]);
const DRI = segment(0xdd, u16(1));
const SOS = segment(0xda, [1, 1, 0, 0, 63, 0]);
/** Compressed pixels, with a stuffed 0xff and a restart marker, as in a real scan. */
const SCAN = [0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56, 0x78, 0xff, 0x00];
const PICTURE = [...DQT, ...SOF, ...DHT, ...DRI, ...SOS, ...SCAN];

const XMP = segment(0xe1, ascii('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta><rdf:li>Home of Sam</rdf:li></x:xmpmeta>'));
const ICC = segment(0xe2, [...ascii('ICC_PROFILE'), 0, 1, 1, ...ascii('Display of the ACME laptop')]);
const MAKER = segment(0xe4, ascii('maker note serial 99887766'));
const IPTC = segment(0xed, [...ascii('Photoshop 3.0'), 0, ...ascii('8BIM byline Sam Rivera')]);
const COMMENT = segment(0xfe, ascii('Edited at the union office'));
const TRAILER = ascii('motion photo data after the end');

const phoneJpeg = (): Uint8Array =>
  Uint8Array.from([...SOI, ...JFIF_WITH_THUMBNAIL, ...exifSegment(), ...XMP, ...ICC, ...MAKER, ...IPTC, ...ADOBE, ...COMMENT, ...PICTURE, ...EOI, ...TRAILER]);

const HIDDEN: (string | number[])[] = [
  'Exif',
  MAKE,
  TAKEN,
  LATITUDE,
  LONGITUDE,
  'xmpmeta',
  'Home of Sam',
  'ICC_PROFILE',
  'ACME laptop',
  'serial 99887766',
  'Photoshop',
  'Sam Rivera',
  'union office',
  'motion photo',
  THUMBNAIL,
];

// ---------------------------------------------------------------------------

describe('cover geometry', () => {
  const picture = { width: 4000, height: 3000 };
  // The canvas is shown at 400 by 300 pixels, 20 pixels from the left and 50 from the top, with a border of 1 pixel.
  const box = { left: 20, top: 50, clientLeft: 1, clientTop: 1, clientWidth: 400, clientHeight: 300 };

  it('puts a cover on the spot of the picture that the user selected, when the picture is shown smaller', () => {
    expect(coverAt({ clientX: 121, clientY: 201 }, box, picture, 12)).toEqual({ x: 1000, y: 1500, size: 480 });
  });

  it('makes the cover a percentage of the picture width', () => {
    expect(coverAt({ clientX: 21, clientY: 51 }, box, picture, 3)?.size).toBe(120);
    expect(coverAt({ clientX: 21, clientY: 51 }, box, picture, 35)?.size).toBe(1400);
  });

  it('keeps the cover size between 3 and 35 percent', () => {
    expect(clampCoverPercent(0)).toBe(3);
    expect(clampCoverPercent(90)).toBe(35);
    expect(clampCoverPercent(20)).toBe(20);
    expect(clampCoverPercent(Number.NaN)).toBe(12);
    expect(coverAt({ clientX: 21, clientY: 51 }, box, picture, 500)?.size).toBe(1400);
  });

  it('adds no cover while the canvas has no size on the screen', () => {
    expect(coverAt({ clientX: 5, clientY: 5 }, { ...box, clientWidth: 0 }, picture, 12)).toBeNull();
    expect(coverAt({ clientX: 5, clientY: 5 }, { ...box, clientHeight: 0 }, picture, 12)).toBeNull();
  });

  it('centers the square on the spot and makes it 2 pixels larger on each side than the selected size', () => {
    expect(coverRect({ x: 100, y: 60, size: 20 })).toEqual({ x: 88, y: 48, width: 24, height: 24 });
  });

  it('rounds the edges of a cover outward, so that it is never smaller than selected', () => {
    const rect = coverRect({ x: 10.6, y: 10.2, size: 4.5 });
    expect(rect).toEqual({ x: 6, y: 5, width: 9, height: 9 });
    expect(rect.x).toBeLessThanOrEqual(10.6 - 4.5 / 2);
    expect(rect.x + rect.width).toBeGreaterThanOrEqual(10.6 + 4.5 / 2);
  });
});

describe('painting', () => {
  const FACE: Rgba = [200, 150, 120, 255];
  const size = { width: 40, height: 30 };

  it('makes each cover solid black in the pixels of the picture, with nothing of the picture left below it', () => {
    const raster = new Raster(size.width, size.height);
    // A context that was left half transparent and set to paint below must not make a weak cover.
    raster.globalAlpha = 0.3;
    raster.globalCompositeOperation = 'destination-over';
    const covers = [
      { x: 10, y: 10, size: 6 },
      { x: 39, y: 29, size: 6 },
    ];
    paintPhoto(raster, solidPicture(size.width, size.height, FACE), size, covers);

    let black = 0;
    for (let y = 0; y < size.height; y += 1) {
      for (let x = 0; x < size.width; x += 1) {
        const covered = covers.some((cover) => {
          const rect = coverRect(cover);
          return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
        });
        // One layer of pixels: a covered pixel is black and opaque, and all other pixels are the picture.
        expect(raster.at(x, y)).toEqual(covered ? [0, 0, 0, 255] : FACE);
        if (covered) black += 1;
      }
    }
    // The first cover is 10 by 10 pixels. The second is cut off at the corner of the picture.
    expect(black).toBe(100 + 6 * 6);
  });

  it('paints the picture with no covers when the list is empty', () => {
    const raster = new Raster(size.width, size.height);
    paintPhoto(raster, solidPicture(size.width, size.height, FACE), size, []);
    expect(raster.at(0, 0)).toEqual(FACE);
    expect(raster.at(39, 29)).toEqual(FACE);
  });

  it('makes the clear parts of a picture white, so that they do not look like covers', () => {
    const raster = new Raster(size.width, size.height);
    paintPhoto(raster, solidPicture(size.width, size.height, [0, 0, 0, 0]), size, [{ x: 10, y: 10, size: 6 }]);
    expect(raster.at(30, 20)).toEqual([255, 255, 255, 255]);
    expect(raster.at(10, 10)).toEqual([0, 0, 0, 255]);
  });
});

describe('hidden data in the saved file', () => {
  it('does not copy EXIF with GPS, time, and phone model, or XMP, IPTC, maker data, a color profile, a comment, or a thumbnail', () => {
    const input = phoneJpeg();
    // The test data must hold each item, or the test proves nothing.
    for (const item of HIDDEN) expect(contains(input, item)).toBe(true);

    const output = stripJpegMetadata(input);
    if (!output) throw new Error('no output');
    for (const item of HIDDEN) expect(contains(output, item)).toBe(false);
  });

  it('copies the picture data byte for byte and nothing after the end of the picture', () => {
    const output = stripJpegMetadata(phoneJpeg());
    expect(Array.from(output ?? [])).toEqual([...SOI, ...JFIF_PLAIN, ...ADOBE, ...PICTURE, ...EOI]);
  });

  it('does not change a JPEG that holds the picture only', () => {
    const plain = [...SOI, ...JFIF_PLAIN, ...PICTURE, ...EOI];
    expect(Array.from(stripJpegMetadata(Uint8Array.from(plain)) ?? [])).toEqual(plain);
  });

  it('keeps all scans of a progressive JPEG', () => {
    const progressive = [...SOI, ...DQT, ...SOF, ...DHT, ...SOS, ...SCAN, ...DHT, ...SOS, 0x9a, 0xff, 0x00, ...COMMENT, ...SOS, 0xbc, ...EOI];
    const expected = [...SOI, ...DQT, ...SOF, ...DHT, ...SOS, ...SCAN, ...DHT, ...SOS, 0x9a, 0xff, 0x00, ...SOS, 0xbc, ...EOI];
    expect(Array.from(stripJpegMetadata(Uint8Array.from(progressive)) ?? [])).toEqual(expected);
  });

  it('does not copy an application segment that only starts like a known header', () => {
    const fakeAdobe = segment(0xee, [...ascii('Adobe'), 0, 100, 0, 0, 0, 0, 1, ...ascii('extra secret')]);
    const fakeJfif = segment(0xe0, [...ascii('JFXX'), 0, 0x13, ...ascii('thumbnail secret')]);
    const output = stripJpegMetadata(Uint8Array.from([...SOI, ...fakeJfif, ...fakeAdobe, ...PICTURE, ...EOI]));
    expect(Array.from(output ?? [])).toEqual([...SOI, ...PICTURE, ...EOI]);
  });

  it('gives nothing for bytes that are not a complete JPEG', () => {
    const png = Uint8Array.from([0x89, ...ascii('PNG\r\n'), 0x1a, 0x0a, 0, 0, 0, 13]);
    const full = [...SOI, ...JFIF_PLAIN, ...PICTURE, ...EOI];
    expect(stripJpegMetadata(png)).toBeNull();
    expect(stripJpegMetadata(new Uint8Array(0))).toBeNull();
    // Cut off in the pixels, in a segment, and before the pixels start.
    expect(stripJpegMetadata(Uint8Array.from(full.slice(0, -2)))).toBeNull();
    expect(stripJpegMetadata(Uint8Array.from(full.slice(0, 30)))).toBeNull();
    expect(stripJpegMetadata(Uint8Array.from([...SOI, ...JFIF_PLAIN, ...EOI]))).toBeNull();
    // The length of a segment points past the end of the data.
    expect(stripJpegMetadata(Uint8Array.from([...SOI, 0xff, 0xe1, 0xff, 0xff, 1, 2, 3, ...EOI]))).toBeNull();
  });
});

describe('the file to save', () => {
  const encoderThatGives = (bytes: Uint8Array | null, type = 'image/jpeg') => {
    const calls: [string, number][] = [];
    const encode = async (asType: string, quality: number) => {
      calls.push([asType, quality]);
      return bytes ? new Blob([Uint8Array.from(bytes)], { type }) : null;
    };
    return { calls, encode };
  };

  it('has no hidden data, also when the encoder of the browser writes some', async () => {
    const file = await buildCleanedFile(encoderThatGives(phoneJpeg()).encode);
    if (!file) throw new Error('no file');
    const bytes = new Uint8Array(await file.arrayBuffer());
    for (const item of HIDDEN) expect(contains(bytes, item)).toBe(false);
    expect(Array.from(bytes)).toEqual([...SOI, ...JFIF_PLAIN, ...ADOBE, ...PICTURE, ...EOI]);
    expect(file.type).toBe('image/jpeg');
  });

  it('is made from the canvas as a JPEG at quality 0.92', async () => {
    const { calls, encode } = encoderThatGives(phoneJpeg());
    await buildCleanedFile(encode);
    expect(calls).toEqual([['image/jpeg', 0.92]]);
  });

  it('is not made when the canvas gives no picture', async () => {
    expect(await buildCleanedFile(encoderThatGives(null).encode)).toBeNull();
  });

  it('is not made when the browser gives a different format than JPEG', async () => {
    const png = Uint8Array.from([0x89, ...ascii('PNG\r\n'), 0x1a, 0x0a, ...ascii('tEXt comment')]);
    expect(await buildCleanedFile(encoderThatGives(png, 'image/png').encode)).toBeNull();
  });

  it('has a fixed name that does not come from the original file', () => {
    expect(CLEANED_FILE_NAME).toBe('cleaned-photo.jpg');
  });
});
