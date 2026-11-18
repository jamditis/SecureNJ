// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadBlob } from '../services/download';
import { I18nContext, i18nFor, translationOf } from '../services/i18n';
import PhotoCleaner from './PhotoCleaner';

vi.mock('../services/download', () => ({ downloadBlob: vi.fn() }));

// jsdom does not decode pictures and has no canvas. The test supplies a
// picture that "loads" on request, a context that records what is painted,
// and an encoder. The encoder is a bad one: it writes EXIF data into its
// JPEG, so the test shows that the saved file does not depend on the encoder.

const ascii = (text: string): number[] => Array.from(text, (char) => char.charCodeAt(0));
const segment = (marker: number, payload: number[]): number[] => [0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 0xff, ...payload];
const PICTURE_DATA = [...segment(0xdb, [0, 1, 2, 3]), ...segment(0xc0, [8, 0, 2, 0, 2, 1, 1, 0x11, 0]), ...segment(0xda, [1, 1, 0, 0, 63, 0]), 0x11, 0x22, 0x33];
const jpegWith = (hidden: string): Uint8Array =>
  Uint8Array.from([0xff, 0xd8, ...segment(0xe1, [...ascii('Exif'), 0, 0, ...ascii(hidden)]), ...PICTURE_DATA, 0xff, 0xd9]);

const ORIGINAL_SECRET = 'GPS 40.7357 N 74.1724 W, ACME Phone 12, 2026:11:18 10:15:00';
const ENCODER_SECRET = 'GPS data that a bad encoder copied';
const contains = (bytes: Uint8Array, text: string): boolean => Buffer.from(bytes).includes(Buffer.from(ascii(text)));

const originalPhoto = (name = 'IMG_20261118_Sam_Rivera.jpg') => new File([jpegWith(ORIGINAL_SECRET)], name, { type: 'image/jpeg' });

class FakeImage {
  static all: FakeImage[] = [];
  naturalWidth = 0;
  naturalHeight = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = '';
  constructor() {
    FakeImage.all.push(this);
  }
}

/** The browser finishes the decoding of a picture. The canvas is shown at half of this size. */
const finishDecoding = (image: FakeImage, ok = true) =>
  act(() => {
    if (!ok) return image.onerror?.();
    image.naturalWidth = 400;
    image.naturalHeight = 200;
    image.onload?.();
  });

interface Painted {
  kind: 'picture' | 'rect';
  color?: unknown;
  alpha?: number;
  rect?: number[];
}

let painted: Painted[] = [];
let encoded: Blob | null = null;
const toBlob = vi.fn();

const context = {
  globalAlpha: 1,
  globalCompositeOperation: 'source-over',
  fillStyle: '#000' as unknown,
  drawImage() {
    painted.push({ kind: 'picture' });
  },
  fillRect(...rect: number[]) {
    painted.push({ kind: 'rect', color: context.fillStyle, alpha: context.globalAlpha, rect });
  },
};

/** The black squares of the last full paint of the canvas. */
const coversOnCanvas = (): number[][] => {
  const last = painted.map((item) => item.kind).lastIndexOf('picture');
  return painted.slice(last + 1).map((item) => {
    expect(item).toMatchObject({ kind: 'rect', color: '#000', alpha: 1 });
    return item.rect ?? [];
  });
};

const savedFiles = () => vi.mocked(downloadBlob).mock.calls;
const savedBytes = async (index = 0) => new Uint8Array(await savedFiles()[index][0].arrayBuffer());

beforeEach(() => {
  painted = [];
  FakeImage.all = [];
  encoded = new Blob([jpegWith(ENCODER_SECRET)], { type: 'image/jpeg' });
  vi.stubGlobal('Image', FakeImage);
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:photo'), revokeObjectURL: vi.fn() });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => context) as never);
  toBlob.mockImplementation((callback: BlobCallback) => callback(encoded));
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(toBlob);
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 10, top: 20 } as DOMRect);
  for (const [name, value] of Object.entries({ clientWidth: 200, clientHeight: 100, clientLeft: 0, clientTop: 0 })) {
    Object.defineProperty(HTMLCanvasElement.prototype, name, { configurable: true, get: () => value });
  }
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.mocked(downloadBlob).mockClear();
  toBlob.mockReset();
  for (const name of ['clientWidth', 'clientHeight', 'clientLeft', 'clientTop']) Reflect.deleteProperty(HTMLCanvasElement.prototype, name);
  Reflect.deleteProperty(URL, 'createObjectURL');
  Reflect.deleteProperty(URL, 'revokeObjectURL');
});

const openPhoto = async (user: ReturnType<typeof userEvent.setup>, file = originalPhoto()) => {
  await user.upload(screen.getByLabelText('Choose a photo'), file);
  await finishDecoding(FakeImage.all[FakeImage.all.length - 1]);
  return screen.getByRole('img', { name: 'Your photo. Select a spot to cover it.' });
};

describe('photo cleaner', () => {
  it('shows the cover controls only when a photo is open', async () => {
    const user = userEvent.setup();
    render(<PhotoCleaner />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save cleaned copy' })).toBeNull();
    expect(screen.getByText("What this can't do")).toBeTruthy();

    const canvas = await openPhoto(user);
    expect(canvas).toMatchObject({ width: 400, height: 200 });
    expect(screen.getByLabelText<HTMLInputElement>('Cover size')).toMatchObject({ type: 'range', min: '3', max: '35', value: '12' });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Undo' }).disabled).toBe(true);
    expect(screen.getByText('The covers are solid black, because blur can sometimes be reversed.', { exact: false })).toBeTruthy();
    expect(coversOnCanvas()).toEqual([]);
  });

  it('paints a black square on the selected spot, in the size of the slider at that time', async () => {
    const user = userEvent.setup();
    render(<PhotoCleaner />);
    const canvas = await openPhoto(user);

    // The canvas is shown at half size. 12% of 400 pixels is 48, and 2 pixels more on each side.
    fireEvent.click(canvas, { clientX: 110, clientY: 70 });
    expect(coversOnCanvas()).toEqual([[174, 74, 52, 52]]);

    // The slider changes the next cover only.
    fireEvent.change(screen.getByLabelText('Cover size'), { target: { value: '35' } });
    fireEvent.click(canvas, { clientX: 60, clientY: 45 });
    expect(coversOnCanvas()).toEqual([
      [174, 74, 52, 52],
      [28, -22, 144, 144],
    ]);
  });

  it('takes the last cover off with Undo', async () => {
    const user = userEvent.setup();
    render(<PhotoCleaner />);
    const canvas = await openPhoto(user);
    fireEvent.click(canvas, { clientX: 110, clientY: 70 });
    fireEvent.click(canvas, { clientX: 30, clientY: 40 });
    expect(coversOnCanvas()).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(coversOnCanvas()).toEqual([[174, 74, 52, 52]]);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(coversOnCanvas()).toEqual([]);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Undo' }).disabled).toBe(true);
  });

  it('saves the copy as cleaned-photo.jpg, whatever the name of the original, and says so', async () => {
    const user = userEvent.setup();
    render(<PhotoCleaner />);
    await openPhoto(user, originalPhoto('IMG_20261118_Sam_Rivera.jpg'));
    await user.click(screen.getByRole('button', { name: 'Save cleaned copy' }));

    expect(await screen.findByRole('status')).toHaveProperty('textContent', 'Saved as cleaned-photo.jpg. Look it over before you share it.');
    expect(savedFiles()).toHaveLength(1);
    expect(savedFiles()[0][1]).toBe('cleaned-photo.jpg');
    expect(savedFiles()[0][0].type).toBe('image/jpeg');
    expect(toBlob.mock.calls[0].slice(1)).toEqual(['image/jpeg', 0.92]);
  });

  it('saves a file without the hidden data of the original, also when the encoder of the browser writes hidden data', async () => {
    const user = userEvent.setup();
    render(<PhotoCleaner />);
    const original = originalPhoto();
    const read = [
      vi.spyOn(original, 'arrayBuffer'),
      vi.spyOn(original, 'text'),
      vi.spyOn(original, 'slice'),
      vi.spyOn(FileReader.prototype, 'readAsArrayBuffer'),
      vi.spyOn(FileReader.prototype, 'readAsDataURL'),
      vi.spyOn(FileReader.prototype, 'readAsText'),
    ];
    const canvas = await openPhoto(user, original);
    fireEvent.click(canvas, { clientX: 110, clientY: 70 });
    await user.click(screen.getByRole('button', { name: 'Save cleaned copy' }));
    await screen.findByRole('status');

    const bytes = await savedBytes();
    expect(contains(bytes, 'Exif')).toBe(false);
    expect(contains(bytes, 'GPS')).toBe(false);
    expect(contains(bytes, 'ACME Phone')).toBe(false);
    expect(contains(bytes, '2026:11:18')).toBe(false);
    expect(Array.from(bytes)).toEqual([0xff, 0xd8, ...PICTURE_DATA, 0xff, 0xd9]);

    // The code gives the original to the browser to decode, and does not read its bytes.
    for (const spy of read) expect(spy).not.toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalledWith(original);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo');
  });

  it('keeps the photo on the device: no request and nothing in the storage of the browser', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const send = vi.spyOn(XMLHttpRequest.prototype, 'send').mockImplementation(() => {});
    const beacon = vi.fn();
    Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: beacon });
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const openDatabase = vi.spyOn(indexedDB, 'open');

    render(<PhotoCleaner />);
    const canvas = await openPhoto(user);
    fireEvent.click(canvas, { clientX: 110, clientY: 70 });
    await user.click(screen.getByRole('button', { name: 'Save cleaned copy' }));
    await screen.findByRole('status');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(beacon).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(openDatabase).not.toHaveBeenCalled();
    Reflect.deleteProperty(navigator, 'sendBeacon');
  });

  it('takes the saved note away when the picture changes after the save', async () => {
    const user = userEvent.setup();
    render(<PhotoCleaner />);
    const canvas = await openPhoto(user);
    await user.click(screen.getByRole('button', { name: 'Save cleaned copy' }));
    await screen.findByRole('status');
    fireEvent.click(canvas, { clientX: 110, clientY: 70 });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('tells the user when the browser cannot open the image', async () => {
    const user = userEvent.setup();
    render(<PhotoCleaner />);
    await user.upload(screen.getByLabelText('Choose a photo'), new File(['x'], 'photo.heic', { type: 'image/heic' }));
    await finishDecoding(FakeImage.all[0], false);
    expect(screen.getByRole('alert').textContent).toBe('This browser cannot open that image. Try a JPEG or PNG.');
    expect(screen.queryByRole('img')).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo');
  });

  it('does not open a picture that has no size', async () => {
    const user = userEvent.setup();
    render(<PhotoCleaner />);
    await user.upload(screen.getByLabelText('Choose a photo'), new File(['<svg/>'], 'drawing.svg', { type: 'image/svg+xml' }));
    act(() => FakeImage.all[0].onload?.());
    expect(screen.getByRole('alert').textContent).toBe('This browser cannot open that image. Try a JPEG or PNG.');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('saves nothing and tells the user when the browser makes no JPEG', async () => {
    const user = userEvent.setup();
    render(<PhotoCleaner />);
    await openPhoto(user);

    encoded = null;
    await user.click(screen.getByRole('button', { name: 'Save cleaned copy' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Could not save this image.');

    encoded = new Blob([Uint8Array.from([0x89, ...ascii('PNG tEXt hidden comment')])], { type: 'image/png' });
    await user.click(screen.getByRole('button', { name: 'Save cleaned copy' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Could not save this image.');
    expect(savedFiles()).toHaveLength(0);
    expect(screen.queryByRole('status')).toBeNull();

    // The error goes away when a later save works.
    encoded = new Blob([jpegWith(ENCODER_SECRET)], { type: 'image/jpeg' });
    await user.click(screen.getByRole('button', { name: 'Save cleaned copy' }));
    await screen.findByRole('status');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(savedFiles()).toHaveLength(1);
  });

  it('starts with no covers and no saved note when the user chooses a different photo', async () => {
    const user = userEvent.setup();
    render(<PhotoCleaner />);
    const canvas = await openPhoto(user);
    fireEvent.click(canvas, { clientX: 110, clientY: 70 });
    await user.click(screen.getByRole('button', { name: 'Save cleaned copy' }));
    await screen.findByRole('status');

    await openPhoto(user, originalPhoto('second.jpg'));
    expect(coversOnCanvas()).toEqual([]);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Undo' }).disabled).toBe(true);
  });

  it('does not show a slow photo after the user chose a different one', async () => {
    const user = userEvent.setup();
    render(<PhotoCleaner />);
    await user.upload(screen.getByLabelText('Choose a photo'), originalPhoto('first.jpg'));
    await user.upload(screen.getByLabelText('Choose a photo'), new File(['x'], 'second.heic', { type: 'image/heic' }));
    const [first, second] = FakeImage.all;
    await finishDecoding(second, false);
    await finishDecoding(first);
    // The second file is the choice of the user. It did not open, so no picture is shown.
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByRole('alert').textContent).toBe('This browser cannot open that image. Try a JPEG or PNG.');
  });

  it('shows its text in Spanish', () => {
    const value = i18nFor('es');
    render(
      <I18nContext.Provider value={value}>
        <PhotoCleaner />
      </I18nContext.Provider>,
    );
    expect(screen.getByLabelText('Elige una foto')).toBeTruthy();
    expect(screen.getByText('Lo que esto no puede hacer')).toBeTruthy();
    expect(translationOf('es')['photo.saved']).toContain('{name}');
  });
});
