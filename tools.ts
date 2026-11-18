/** The lists of pages, sections, and tools. The navigation and the start page read them. */
import {
  BookOpen,
  Calendar,
  CalendarClock,
  ClipboardList,
  Eye,
  FileLock,
  HelpingHand,
  IdCard,
  ImageOff,
  LifeBuoy,
  ListChecks,
  MessageSquareLock,
  Package,
  PenTool,
  Share2,
  ShieldAlert,
  Siren,
  ThumbsUp,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { MessageKey } from './services/i18n';
import type { ToolId } from './types';

export type SectionId = 'send' | 'ready' | 'document' | 'group';

export interface SectionInfo {
  id: SectionId;
  title: MessageKey;
  intro: MessageKey;
}

export const SECTIONS: SectionInfo[] = [
  { id: 'send', title: 'section.send.title', intro: 'section.send.intro' },
  { id: 'ready', title: 'section.ready.title', intro: 'section.ready.intro' },
  { id: 'document', title: 'section.document.title', intro: 'section.document.intro' },
  { id: 'group', title: 'section.group.title', intro: 'section.group.intro' },
];

export type PageOnlyId = 'dashboard' | 'limits' | 'resources' | 'share';

export interface PageInfo {
  id: PageOnlyId;
  title: MessageKey;
  icon: LucideIcon;
}

/** Pages that are not tools. */
export const PAGES: PageInfo[] = [
  { id: 'dashboard', title: 'nav.overview', icon: BookOpen },
  { id: 'limits', title: 'limits.navTitle', icon: ShieldAlert },
  { id: 'resources', title: 'resources.navTitle', icon: LifeBuoy },
  { id: 'share', title: 'sharePage.navTitle', icon: Share2 },
];

export interface ToolInfo {
  id: Exclude<ToolId, PageOnlyId>;
  section: SectionId;
  title: MessageKey;
  description: MessageKey;
  icon: LucideIcon;
  color: string;
  /** `shared`: the data syncs with the room of the group. `device`: the data stays on this device. */
  scope: 'shared' | 'device';
}

export const TOOLS: ToolInfo[] = [
  { id: 'secure-share', section: 'send', title: 'lock.messageTitle', description: 'lock.messageSummary', icon: MessageSquareLock, color: 'bg-indigo-500', scope: 'device' },
  { id: 'lock-file', section: 'send', title: 'lock.fileTitle', description: 'lock.fileSummary', icon: FileLock, color: 'bg-purple-500', scope: 'device' },
  { id: 'event-creator', section: 'send', title: 'event.title', description: 'event.summary', icon: Calendar, color: 'bg-blue-500', scope: 'device' },

  { id: 'rights-card', section: 'ready', title: 'rights.title', description: 'rights.summary', icon: IdCard, color: 'bg-rose-500', scope: 'device' },
  { id: 'family-plan', section: 'ready', title: 'family.title', description: 'family.summary', icon: ListChecks, color: 'bg-fuchsia-500', scope: 'device' },
  { id: 'phone-tree', section: 'ready', title: 'tree.title', description: 'tree.summary', icon: Users, color: 'bg-emerald-500', scope: 'device' },

  { id: 'witness-notes', section: 'document', title: 'witness.title', description: 'witness.summary', icon: Eye, color: 'bg-sky-500', scope: 'device' },
  { id: 'photo-cleaner', section: 'document', title: 'photo.title', description: 'photo.summary', icon: ImageOff, color: 'bg-lime-600', scope: 'device' },
  { id: 'resource-sheet', section: 'document', title: 'sheet.title', description: 'sheet.summary', icon: ClipboardList, color: 'bg-stone-500', scope: 'device' },

  { id: 'safety-alerts', section: 'group', title: 'alerts.title', description: 'alerts.summary', icon: Siren, color: 'bg-red-500', scope: 'shared' },
  { id: 'status-board', section: 'group', title: 'status.title', description: 'status.summary', icon: UserCheck, color: 'bg-violet-500', scope: 'shared' },
  { id: 'mutual-aid', section: 'group', title: 'aid.title', description: 'aid.summary', icon: HelpingHand, color: 'bg-amber-500', scope: 'shared' },
  { id: 'consensus', section: 'group', title: 'consensus.title', description: 'consensus.summary', icon: ThumbsUp, color: 'bg-pink-500', scope: 'shared' },
  { id: 'whiteboard', section: 'group', title: 'board.title', description: 'board.summary', icon: PenTool, color: 'bg-cyan-500', scope: 'shared' },
  { id: 'shift-roster', section: 'group', title: 'shifts.title', description: 'shifts.summary', icon: CalendarClock, color: 'bg-teal-500', scope: 'shared' },
  { id: 'supply-inventory', section: 'group', title: 'supplies.title', description: 'supplies.summary', icon: Package, color: 'bg-orange-500', scope: 'shared' },
];

const ALL_IDS = new Set<string>([...PAGES.map((page) => page.id), ...TOOLS.map((tool) => tool.id)]);

/**
 * Reads the page from an address such as "#/phone-tree" or
 * "#/secure-share/<locked text>". An unknown page gives the start page.
 */
export function readRoute(hash: string): { page: ToolId; payload: string } {
  const [id = '', ...rest] = hash.replace(/^#\/?/, '').split('/');
  return ALL_IDS.has(id) ? { page: id as ToolId, payload: rest.join('/') } : { page: 'dashboard', payload: '' };
}

/** Opens a page. The change of the address makes the app show it. */
export function goToPage(id: ToolId): void {
  window.location.hash = `#/${id}`;
}
