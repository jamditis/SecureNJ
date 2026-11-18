/** Build-time settings. A group sets these in `.env.local` before it builds. */
import { parseSignalingUrls } from './space';

const env = import.meta.env as Record<string, string | undefined>;

/** The signaling servers that the space dialog shows as the default. */
export const DEFAULT_SIGNALING_URLS: string[] = parseSignalingUrls(env.VITE_SIGNALING_URLS ?? '').urls;

/**
 * STUN servers let two peers on different networks find a direct path.
 * A STUN server sees the IP address of each peer, but no room data.
 * An empty value limits sync to peers on the same local network.
 */
export const ICE_SERVER_URLS: string[] = (env.VITE_ICE_SERVERS ?? 'stun:stun.l.google.com:19302')
  .split(/[\s,]+/)
  .filter(Boolean);
