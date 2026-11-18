/** The list of tools. The navigation and the dashboard both read it. */
import {
  Calendar,
  CalendarClock,
  FileLock,
  HelpingHand,
  Package,
  PenTool,
  Siren,
  ThumbsUp,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { MessageKey } from './services/i18n';
import type { ToolId } from './types';

export interface ToolInfo {
  id: Exclude<ToolId, 'dashboard'>;
  title: MessageKey;
  description: MessageKey;
  icon: LucideIcon;
  color: string;
  /** `shared`: the data syncs with the space. `device`: the data stays on this device. */
  scope: 'shared' | 'device';
}

export const TOOLS: ToolInfo[] = [
  { id: 'safety-alerts', title: 'alerts.title', description: 'alerts.summary', icon: Siren, color: 'bg-red-500', scope: 'shared' },
  { id: 'status-board', title: 'status.title', description: 'status.summary', icon: UserCheck, color: 'bg-violet-500', scope: 'shared' },
  { id: 'consensus', title: 'consensus.title', description: 'consensus.summary', icon: ThumbsUp, color: 'bg-pink-500', scope: 'shared' },
  { id: 'whiteboard', title: 'board.title', description: 'board.summary', icon: PenTool, color: 'bg-cyan-500', scope: 'shared' },
  { id: 'mutual-aid', title: 'aid.title', description: 'aid.summary', icon: HelpingHand, color: 'bg-amber-500', scope: 'shared' },
  { id: 'shift-roster', title: 'shifts.title', description: 'shifts.summary', icon: CalendarClock, color: 'bg-teal-500', scope: 'shared' },
  { id: 'supply-inventory', title: 'supplies.title', description: 'supplies.summary', icon: Package, color: 'bg-orange-500', scope: 'shared' },
  { id: 'event-creator', title: 'event.title', description: 'event.summary', icon: Calendar, color: 'bg-blue-500', scope: 'device' },
  { id: 'phone-tree', title: 'tree.title', description: 'tree.summary', icon: Users, color: 'bg-emerald-500', scope: 'device' },
  { id: 'secure-share', title: 'share.title', description: 'share.summary', icon: FileLock, color: 'bg-indigo-500', scope: 'device' },
];
