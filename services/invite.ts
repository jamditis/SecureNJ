/**
 * An invite link carries the space name and the signaling servers. It never
 * carries the passphrase: a link goes through chat applications and browser
 * history. The data is in the part after "#", which a browser does not send
 * to the web server.
 */
import { MAX_SPACE_NAME_LENGTH, parseSignalingUrls } from './space';

export interface Invite {
  name: string;
  signaling: string[];
}

const PREFIX = '#join=';

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): string {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

const DIRECTION_CONTROL = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/;

/** `pageUrl` is the address of the app, with or without a "#" part. */
export function makeInviteLink(pageUrl: string, invite: Invite): string {
  const base = pageUrl.split('#')[0];
  return `${base}${PREFIX}${toBase64Url(JSON.stringify({ n: invite.name, s: invite.signaling }))}`;
}

/**
 * Reads an invite from the "#" part of an address. The link comes from
 * outside the app, so each field is checked. Returns null if the address
 * holds no valid invite.
 */
export function readInvite(hash: string, pageIsSecure: boolean): Invite | null {
  if (!hash.startsWith(PREFIX)) return null;
  try {
    const data: unknown = JSON.parse(fromBase64Url(hash.slice(PREFIX.length)));
    if (typeof data !== 'object' || data === null) return null;
    const { n: name, s: servers } = data as Record<string, unknown>;
    if (typeof name !== 'string' || name.trim() === '' || name.length > MAX_SPACE_NAME_LENGTH) return null;
    // The app shows the name inside a sentence. A direction control character can reverse that sentence.
    if (DIRECTION_CONTROL.test(name)) return null;
    const list = Array.isArray(servers) ? servers.filter((url): url is string => typeof url === 'string') : [];
    return { name: name.trim(), signaling: parseSignalingUrls(list.join(' '), pageIsSecure).urls };
  } catch {
    return null;
  }
}
