/** Logic for the Resources page and the Share page. */
import { TOOLS, type ToolInfo } from '../tools';
import type { MessageKey, Translate } from './i18n';

/**
 * The address of this copy of the app, for the share text and the flyer.
 * The part after "#" is left out: it can hold a locked message or an invite.
 * A copy that is open from a file has no address that a different person can
 * open, so the result is null.
 */
export function appAddress(location: Pick<Location, 'protocol' | 'origin' | 'pathname'>): string | null {
  if (location.protocol !== 'https:' && location.protocol !== 'http:') return null;
  return location.origin + location.pathname;
}

/** The text message that a person sends to pass the app on. */
export function shareMessage(t: Translate, address: string): string {
  return t('sharePage.message', { address });
}

/** The tools that the flyer names, with the key of the text that says what each tool is for. */
const FLYER_USES: Partial<Record<ToolInfo['id'], MessageKey>> = {
  'secure-share': 'sharePage.flyerUse.message',
  'rights-card': 'sharePage.flyerUse.rights',
  'family-plan': 'sharePage.flyerUse.family',
  'resource-sheet': 'sharePage.flyerUse.sheet',
};

export interface FlyerTool {
  id: ToolInfo['id'];
  title: MessageKey;
  use: MessageKey;
}

/** The flyer lists its tools in the sequence of the registry. */
export function flyerTools(tools: readonly ToolInfo[] = TOOLS): FlyerTool[] {
  return tools.flatMap((tool) => {
    const use = FLYER_USES[tool.id];
    return use ? [{ id: tool.id, title: tool.title, use }] : [];
  });
}

export interface RichPart {
  kind: 'text' | 'code' | 'link';
  text: string;
}

/**
 * Splits a message into plain text, code, and link text, so that a component
 * can draw each part as an element. In a message, `backticks` mark code and
 * [square brackets] mark the text of a link. A mark with no partner is plain text.
 */
export function parseRich(message: string): RichPart[] {
  const parts: RichPart[] = [];
  const pattern = /`([^`]+)`|\[([^\]]+)\]/g;
  let last = 0;
  for (const match of message.matchAll(pattern)) {
    if (match.index > last) parts.push({ kind: 'text', text: message.slice(last, match.index) });
    if (match[1] !== undefined) parts.push({ kind: 'code', text: match[1] });
    else parts.push({ kind: 'link', text: match[2] });
    last = match.index + match[0].length;
  }
  if (last < message.length) parts.push({ kind: 'text', text: message.slice(last) });
  return parts;
}

/**
 * Puts text on the clipboard. The result is false if the browser has no
 * clipboard for this page or refuses the copy, so the page can say so.
 */
export async function copyText(
  text: string,
  clipboard: Pick<Clipboard, 'writeText'> | undefined = globalThis.navigator?.clipboard,
): Promise<boolean> {
  if (!clipboard) return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
