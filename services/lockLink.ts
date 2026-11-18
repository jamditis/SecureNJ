/**
 * The link of a locked message:
 * "<address of the app>#/secure-share/<encodeURIComponent(locked text)>".
 * The locked text is in the fragment of the address. A browser does not
 * send the fragment to a server. The published site made links of the same
 * form, so the old links and the new links both open.
 */
import qrcode from 'qrcode-generator';

/** The address of the tool with no locked text. */
export const LOCK_ROUTE = '#/secure-share';

/** `appAddress` is the address of the open app. Its query and its fragment are not used. */
export function buildLockLink(lockedText: string, appAddress: string): string {
  const base = appAddress.split(/[?#]/)[0];
  return `${base}${LOCK_ROUTE}/${encodeURIComponent(lockedText)}`;
}

// Base64 with or without the version prefix. The shortest locked text holds
// a salt (16 bytes), a nonce (12 bytes), and an authentication tag (16 bytes).
const LOCKED_TEXT = /^(?:snj2\.)?([A-Za-z0-9+/]+)={0,2}$/;
const MIN_BASE64_LENGTH = Math.ceil(((16 + 12 + 16) * 4) / 3);

export interface LinkPayload {
  /** The locked text, or "" when the link has none or is damaged. */
  text: string;
  damaged: boolean;
}

/**
 * Reads the part of the address after "#/secure-share/". A payload that
 * cannot be decoded, or that cannot be locked text, is a damaged link.
 */
export function readLockLink(payload: string): LinkPayload {
  if (payload === '') return { text: '', damaged: false };
  let text: string;
  try {
    // A mail program can break a long link over lines.
    text = decodeURIComponent(payload).replace(/\s+/g, '');
  } catch {
    return { text: '', damaged: true };
  }
  const body = LOCKED_TEXT.exec(text)?.[1] ?? '';
  return body.length >= MIN_BASE64_LENGTH ? { text, damaged: false } : { text: '', damaged: true };
}

export interface QrCells {
  /** The number of cells on one side. */
  size: number;
  /** The dark cells as [column, row]. */
  dark: [number, number][];
}

/**
 * The QR code of a link, or null when the link is too long for a QR code.
 * Error correction level "L" holds the longest text (2,953 bytes).
 */
export function linkQrCells(link: string): QrCells | null {
  const code = qrcode(0, 'L');
  try {
    code.addData(link);
    code.make();
  } catch {
    return null;
  }
  const size = code.getModuleCount();
  const dark: [number, number][] = [];
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      if (code.isDark(row, column)) dark.push([column, row]);
    }
  }
  return { size, dark };
}
