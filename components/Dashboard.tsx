import { ArrowRight, CloudOff, GitFork, HardDrive, Lock, Users } from 'lucide-react';
import { alertState } from '../services/alerts';
import { useT } from '../services/i18n';
import { statusOf } from '../services/aid';
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
import { useRecords, useSync } from '../services/sync';
import { useNow } from '../services/time';
import { SECTIONS, TOOLS } from '../tools';
import type { ToolId } from '../types';
import { Button } from './ui';

interface DashboardProps {
  onSelectTool: (id: ToolId) => void;
  onOpenSpace: () => void;
}

export default function Dashboard({ onSelectTool, onOpenSpace }: DashboardProps) {
  const t = useT();
  const now = useNow();
  const { space, peers } = useSync();
  const { records: sightings } = useRecords('sightings', isSighting, keyOfId);
  const { records: confirmations } = useRecords('confirmations', isConfirmation, keyOfConfirmation);
  const { records: users } = useRecords('users', isStatusUser, keyOfId);
  const { records: proposals } = useRecords('proposals', isProposal, keyOfId);
  const { records: posts } = useRecords('posts', isMutualAidPost, keyOfId);
  const { records: claims } = useRecords('claims', isAidClaim, keyOfClaim);
  const { records: shifts } = useRecords('shifts', isShift, keyOfId);
  const { records: signups } = useRecords('shiftSignups', isShiftSignup, keyOfSignup);
  const { records: supplies } = useRecords('supplies', isSupplyItem, keyOfId);
  const { records: adjustments } = useRecords('supplyAdjustments', isSupplyAdjustment, keyOfId);

  // What needs attention now, for each tool that has live data.
  const activity: Partial<Record<ToolId, string>> = {};
  const activeAlerts = sightings.filter((s) => alertState(s, confirmations) !== 'cleared').length;
  if (activeAlerts > 0) activity['safety-alerts'] = t('dashboard.alerts', { count: activeAlerts });
  const attention = users.filter((u) => needsAttention(u, now)).length;
  if (attention > 0) activity['status-board'] = t('dashboard.status', { count: attention });
  const openProposals = proposals.filter((p) => p.status === 'active').length;
  if (openProposals > 0) activity.consensus = t('dashboard.proposals', { count: openProposals });
  const openRequests = posts.filter((p) => p.type === 'request' && statusOf(p.id, claims) === 'open').length;
  if (openRequests > 0) activity['mutual-aid'] = t('dashboard.requests', { count: openRequests });
  const gaps = countGaps(shifts, signups, now);
  if (gaps > 0) activity['shift-roster'] = t('dashboard.shifts', { count: gaps });
  const low = countLow(supplies, adjustments);
  if (low > 0) activity['supply-inventory'] = t('dashboard.supplies', { count: low });

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-3 tracking-tight">{t('dashboard.heading')}</h2>
        <p className="text-lg text-slate-600 max-w-2xl leading-relaxed">{t('dashboard.intro')}</p>
      </div>

      <section className="bg-white border border-slate-200 rounded-3xl p-6 flex flex-col md:flex-row md:items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${space ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
          {space ? <Users aria-hidden="true" /> : <HardDrive aria-hidden="true" />}
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-slate-900">{space ? t('dashboard.inSpace', { name: space.name, count: peers }) : t('dashboard.noSpace')}</h3>
          <p className="text-sm text-slate-500">{space ? t('dashboard.inSpaceNote') : t('dashboard.noSpaceNote')}</p>
        </div>
        <Button variant={space ? 'light' : 'primary'} onClick={onOpenSpace}>
          {space ? t('space.manage') : t('space.joinTitle')}
        </Button>
      </section>

      {SECTIONS.map((section) => (
        <section key={section.id} className="space-y-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900">{t(section.title)}</h3>
            <p className="text-slate-600">{t(section.intro)}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TOOLS.filter((tool) => tool.section === section.id).map((tool) => (
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
                    {activity[tool.id] && <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">{activity[tool.id]}</span>}
                  </h4>
                  <p className="text-slate-600 text-sm leading-relaxed">{t(tool.description)}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 shrink-0 mt-1" aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>
      ))}

      <section className="bg-slate-900 rounded-3xl p-8 text-white grid grid-cols-1 md:grid-cols-3 gap-8">
        {(
          [
            { icon: CloudOff, title: 'dashboard.offlineTitle', text: 'dashboard.offlineText' },
            { icon: Lock, title: 'dashboard.cryptoTitle', text: 'dashboard.cryptoText' },
            { icon: GitFork, title: 'dashboard.ownTitle', text: 'dashboard.ownText' },
          ] as const
        ).map(({ icon: Icon, title, text }) => (
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
