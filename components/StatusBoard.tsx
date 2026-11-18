import { useMemo, useState } from 'react';
import { AlertCircle, Clock, LogOut, Navigation, Pencil, ShieldAlert, ShieldCheck, Users, type LucideIcon } from 'lucide-react';
import { useLocale, useT } from '../services/i18n';
import { isStatusUser } from '../services/schema';
import { isOverdue, makeStatusUpdate, sortForBoard } from '../services/status';
import { useOnlineMembers, useRecords, useSync } from '../services/sync';
import { timeAgo, useNow } from '../services/time';
import type { MemberStatus, StatusUser } from '../types';
import { EmptyState, Field, IconButton, ToolHeader, inputClass } from './ui';

const STATUSES: MemberStatus[] = ['safe', 'transit', 'support', 'detained'];
const CHECK_IN_MINUTES = [0, 15, 30, 60, 120];

const STATUS_STYLE: Record<MemberStatus, { color: string; icon: LucideIcon }> = {
  safe: { color: 'bg-emerald-500', icon: ShieldCheck },
  transit: { color: 'bg-yellow-500', icon: Navigation },
  support: { color: 'bg-orange-500', icon: AlertCircle },
  detained: { color: 'bg-red-600', icon: ShieldAlert },
};

export default function StatusBoard() {
  const t = useT();
  const locale = useLocale();
  const now = useNow(15_000);
  const { memberId, memberName, setMemberName } = useSync();
  const { records: users, map } = useRecords('users', isStatusUser);
  const online = useOnlineMembers();
  const me = users.find((user) => user.id === memberId);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(memberName);
  const [note, setNote] = useState(me?.note ?? '');
  const [checkInMinutes, setCheckInMinutes] = useState(0);

  const others = useMemo(() => sortForBoard(users.filter((user) => user.id !== memberId), now), [users, memberId, now]);

  const update = (status: MemberStatus) => {
    setMemberName(name);
    map.set(memberId, makeStatusUpdate({ id: memberId, name, status, note, checkInMinutes }));
    setIsEditing(false);
  };

  const displayName = (user: StatusUser) => user.name || t('common.anonymous');

  return (
    <div className="space-y-8">
      <ToolHeader title={t('status.title')} subtitle={t('status.subtitle')} />

      <section className="bg-slate-900 rounded-3xl p-6 md:p-8 text-white space-y-4">
        <h3 className="text-slate-400 font-bold uppercase tracking-widest text-xs">{t('status.mine')}</h3>
        {!me || isEditing ? (
          <div className="space-y-4 max-w-md">
            <Field label={t('status.name')}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('status.nameHint')} className={`${inputClass} !bg-slate-800 !border-slate-700 text-white`} />
            </Field>
            <Field label={t('status.note')}>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('status.noteHint')} className={`${inputClass} !bg-slate-800 !border-slate-700 text-white`} />
            </Field>
            <Field label={t('status.checkIn')}>
              <select value={checkInMinutes} onChange={(e) => setCheckInMinutes(Number(e.target.value))} className={`${inputClass} !bg-slate-800 !border-slate-700 text-white`}>
                {CHECK_IN_MINUTES.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes === 0 ? t('status.checkInNone') : t('status.checkInOption', { minutes })}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              {STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => update(status)}
                  className="p-3 rounded-xl border border-slate-700 hover:bg-slate-800 flex items-center gap-2 font-bold text-sm transition-colors"
                >
                  <span className={`w-3 h-3 rounded-full ${STATUS_STYLE[status].color}`} aria-hidden="true" />
                  {t(`status.option.${status}`)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <MemberSummary user={me} name={displayName(me)} now={now} locale={locale} dark />
            <div className="flex gap-1">
              <IconButton icon={Pencil} label={t('status.change')} className="hover:!bg-slate-800 hover:!text-white" onClick={() => setIsEditing(true)} />
              <IconButton icon={LogOut} label={t('status.leave')} className="hover:!bg-slate-800 hover:!text-white" onClick={() => map.delete(memberId)} />
            </div>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {others.length === 0 ? (
          <EmptyState icon={Users} title={t('status.empty')} />
        ) : (
          others.map((user) => (
            <div key={user.id} className={`p-4 rounded-2xl border bg-white ${isOverdue(user, now) ? 'border-red-400' : 'border-slate-200'}`}>
              <MemberSummary user={user} name={displayName(user)} now={now} locale={locale} />
              <p className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${online.has(user.id) ? 'bg-emerald-500' : 'bg-slate-300'}`} aria-hidden="true" />
                {online.has(user.id) ? t('status.online') : t('status.offline')}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

interface MemberSummaryProps {
  user: StatusUser;
  name: string;
  now: number;
  locale: string;
  dark?: boolean;
}

function MemberSummary({ user, name, now, locale, dark = false }: MemberSummaryProps) {
  const t = useT();
  const { color, icon: Icon } = STATUS_STYLE[user.status];
  const overdue = isOverdue(user, now);
  return (
    <div className="flex items-center gap-4 min-w-0">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-6 h-6 text-white" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <h4 className={`font-bold truncate ${dark ? 'text-white text-xl' : 'text-slate-900'}`}>{name}</h4>
        <p className={`text-xs font-bold ${dark ? 'text-emerald-400' : 'text-slate-600'}`}>
          {t(`status.option.${user.status}`)} <span className="font-normal text-slate-400">· {timeAgo(user.lastUpdated, now, locale)}</span>
        </p>
        {user.note && <p className={`text-xs break-words ${dark ? 'text-slate-300' : 'text-slate-500'}`}>{user.note}</p>}
        {overdue && (
          <p className="text-xs font-bold text-red-500 flex items-center gap-1">
            <Clock className="w-3 h-3" aria-hidden="true" /> {t('status.overdue')}
          </p>
        )}
        {!overdue && user.checkInBy !== null && (
          <p className="text-xs text-slate-400">
            {t('status.nextCheckIn', { time: new Date(user.checkInBy).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' }) })}
          </p>
        )}
      </div>
    </div>
  );
}
