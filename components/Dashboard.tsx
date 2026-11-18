import { ArrowRight, CloudOff, GitFork, Lock, Users, type LucideIcon } from 'lucide-react';
import { statusOf } from '../services/aid';
import { alertState } from '../services/alerts';
import { useT, type MessageKey } from '../services/i18n';
import {
  isAidClaim,
  isConfirmation,
  isMutualAidPost,
  isProposal,
  isSighting,
  isStatusUser,
  keyOfClaim,
  keyOfConfirmation,
  keyOfId,
} from '../services/schema';
import { countGaps, isShift, isShiftSignup, keyOfSignup } from '../services/shifts';
import { needsAttention } from '../services/status';
import { countLow, isSupplyAdjustment, isSupplyItem } from '../services/supplies';
import { ToolScope, useRecords, useRooms } from '../services/sync';
import { useNow } from '../services/time';
import { SECTIONS, TOOLS } from '../tools';
import type { ToolId } from '../types';
import { Notice } from './ui';

function Badge({ count, text }: { count: number; text: MessageKey }) {
  const t = useT();
  if (count === 0) return null;
  return <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">{t(text, { count })}</span>;
}

// Each badge reads the document of its own tool: the room if one is open,
// else the local document. A tool with no open room shows only local data.
function AlertsBadge() {
  const { records: sightings } = useRecords('sightings', isSighting, keyOfId);
  const { records: confirmations } = useRecords('confirmations', isConfirmation, keyOfConfirmation);
  return <Badge count={sightings.filter((s) => alertState(s, confirmations) !== 'cleared').length} text="dashboard.alerts" />;
}

function StatusBadge() {
  const now = useNow();
  const { records: users } = useRecords('users', isStatusUser, keyOfId);
  return <Badge count={users.filter((user) => needsAttention(user, now)).length} text="dashboard.status" />;
}

function ProposalsBadge() {
  const { records: proposals } = useRecords('proposals', isProposal, keyOfId);
  return <Badge count={proposals.filter((p) => p.status === 'active').length} text="dashboard.proposals" />;
}

function AidBadge() {
  const { records: posts } = useRecords('posts', isMutualAidPost, keyOfId);
  const { records: claims } = useRecords('claims', isAidClaim, keyOfClaim);
  return <Badge count={posts.filter((p) => p.type === 'request' && statusOf(p.id, claims) === 'open').length} text="dashboard.requests" />;
}

function ShiftsBadge() {
  const now = useNow();
  const { records: shifts } = useRecords('shifts', isShift, keyOfId);
  const { records: signups } = useRecords('shiftSignups', isShiftSignup, keyOfSignup);
  return <Badge count={countGaps(shifts, signups, now)} text="dashboard.shifts" />;
}

function SuppliesBadge() {
  const { records: supplies } = useRecords('supplies', isSupplyItem, keyOfId);
  const { records: adjustments } = useRecords('supplyAdjustments', isSupplyAdjustment, keyOfId);
  return <Badge count={countLow(supplies, adjustments)} text="dashboard.supplies" />;
}

const BADGES: Partial<Record<ToolId, () => React.ReactNode>> = {
  'safety-alerts': AlertsBadge,
  'status-board': StatusBadge,
  consensus: ProposalsBadge,
  'mutual-aid': AidBadge,
  'shift-roster': ShiftsBadge,
  'supply-inventory': SuppliesBadge,
};

const FACTS: { icon: LucideIcon; title: MessageKey; text: MessageKey }[] = [
  { icon: CloudOff, title: 'dashboard.offlineTitle', text: 'dashboard.offlineText' },
  { icon: Lock, title: 'dashboard.cryptoTitle', text: 'dashboard.cryptoText' },
  { icon: GitFork, title: 'dashboard.ownTitle', text: 'dashboard.ownText' },
];

export default function Dashboard({ onSelectTool }: { onSelectTool: (id: ToolId) => void }) {
  const t = useT();
  const { rooms } = useRooms();
  const openRooms = Object.keys(rooms).length;

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-3 tracking-tight">{t('dashboard.heading')}</h2>
        <p className="text-lg text-slate-600 max-w-2xl leading-relaxed">{t('dashboard.intro')}</p>
      </div>

      <Notice tone="warning">
        <strong>{t('dashboard.beforeTitle')}</strong> {t('dashboard.beforeText')}{' '}
        <button type="button" onClick={() => onSelectTool('limits')} className="underline font-bold">
          {t('dashboard.limitsLink')}
        </button>
      </Notice>

      {SECTIONS.map((section) => (
        <section key={section.id} className="space-y-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900">{t(section.title)}</h3>
            <p className="text-slate-600">{t(section.intro)}</p>
            {section.id === 'group' && (
              <p className="mt-1 text-sm text-slate-500 flex items-center gap-2">
                <Users className="w-4 h-4" aria-hidden="true" /> {t('dashboard.rooms', { count: openRooms })}. {t('dashboard.roomsNote')}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TOOLS.filter((tool) => tool.section === section.id).map((tool) => {
              const ToolBadge = BADGES[tool.id];
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => onSelectTool(tool.id)}
                  className="group flex items-start gap-4 p-5 bg-white border border-slate-200 rounded-2xl text-left transition-shadow hover:shadow-lg hover:border-emerald-500/40"
                >
                  <div className={`${tool.color} w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0`}>
                    <tool.icon className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-slate-900 flex flex-wrap items-center gap-2">
                      {t(tool.title)}
                      {ToolBadge && (
                        <ToolScope tool={tool.id}>
                          <ToolBadge />
                        </ToolScope>
                      )}
                    </h4>
                    <p className="text-slate-600 text-sm leading-relaxed">{t(tool.description)}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 shrink-0 mt-1" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <section className="bg-slate-900 rounded-3xl p-8 text-white grid grid-cols-1 md:grid-cols-3 gap-8">
        {FACTS.map(({ icon: Icon, title, text }) => (
          <div key={title} className="space-y-2">
            <Icon className="text-emerald-400" aria-hidden="true" />
            <h3 className="font-bold text-lg">{t(title)}</h3>
            <p className="text-slate-400 text-sm leading-relaxed">{t(text)}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
