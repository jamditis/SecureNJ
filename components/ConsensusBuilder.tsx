import { useMemo, useState, type FormEvent } from 'react';
import { Archive, CheckCircle2, Hand, Lock, Plus, ThumbsUp, Trash2, Unlock, XOctagon, type LucideIcon } from 'lucide-react';
import { tallyVotes, voteKey, type Outcome } from '../services/consensus';
import { useT } from '../services/i18n';
import { isProposal, isVote, keyOfId, keyOfVote } from '../services/schema';
import { useRecords, useSync } from '../services/sync';
import type { Proposal, Vote, VoteType } from '../types';
import { Button, EmptyState, IconButton, ToolHeader, inputClass } from './ui';

const OPTIONS: { type: VoteType; icon: LucideIcon; idle: string; active: string; bar: string }[] = [
  { type: 'support', icon: ThumbsUp, idle: 'bg-emerald-50 text-emerald-700 border-emerald-200', active: 'bg-emerald-600 text-white border-emerald-700', bar: 'bg-emerald-500' },
  { type: 'reservations', icon: CheckCircle2, idle: 'bg-yellow-50 text-yellow-800 border-yellow-200', active: 'bg-yellow-500 text-white border-yellow-600', bar: 'bg-yellow-400' },
  { type: 'stand-aside', icon: Hand, idle: 'bg-blue-50 text-blue-700 border-blue-200', active: 'bg-blue-600 text-white border-blue-700', bar: 'bg-blue-400' },
  { type: 'block', icon: XOctagon, idle: 'bg-red-50 text-red-700 border-red-200', active: 'bg-red-600 text-white border-red-700', bar: 'bg-red-500' },
];

const OUTCOME_STYLE: Record<Outcome, string> = {
  none: 'text-slate-400',
  blocked: 'text-red-700',
  reservations: 'text-yellow-700',
  consensus: 'text-emerald-700',
  'no-support': 'text-slate-600',
};

export default function ConsensusBuilder() {
  const t = useT();
  const { doc, memberId, memberName } = useSync();
  const { records: proposals, map: proposalMap } = useRecords('proposals', isProposal, keyOfId);
  const { records: votes, map: voteMap } = useRecords('votes', isVote, keyOfVote);
  const [text, setText] = useState('');

  const sorted = useMemo(
    () => [...proposals].sort((a, b) => Number(a.status === 'closed') - Number(b.status === 'closed') || b.timestamp - a.timestamp),
    [proposals],
  );

  const add = (event: FormEvent) => {
    event.preventDefault();
    if (text.trim() === '') return;
    const id = crypto.randomUUID();
    proposalMap.set(id, { id, text: text.trim(), timestamp: Date.now(), status: 'active' });
    setText('');
  };

  const castVote = (proposal: Proposal, type: VoteType) => {
    const key = voteKey(proposal.id, memberId);
    const current = voteMap.get(key);
    // A second click on the same option removes the vote.
    if (current?.type === type) voteMap.delete(key);
    else voteMap.set(key, { proposalId: proposal.id, memberId, type, concern: current?.concern ?? '', name: memberName });
  };

  const saveConcern = (vote: Vote, concern: string) => {
    voteMap.set(voteKey(vote.proposalId, vote.memberId), { ...vote, concern: concern.trim() });
  };

  const remove = (proposal: Proposal) => {
    if (!window.confirm(t('consensus.deleteConfirm'))) return;
    doc.transact(() => {
      proposalMap.delete(proposal.id);
      // The map can hold a bad record from a peer, so check each value.
      voteMap.forEach((vote: unknown, key) => {
        if (isVote(vote) && vote.proposalId === proposal.id) voteMap.delete(key);
      });
    });
  };

  return (
    <div className="space-y-8">
      <ToolHeader title={t('consensus.title')} subtitle={t('consensus.subtitle')} />

      <form onSubmit={add} className="bg-white p-4 rounded-3xl border border-slate-200 flex flex-col sm:flex-row gap-3">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t('consensus.placeholder')}
          aria-label={t('consensus.placeholder')}
          className={`${inputClass} flex-1`}
        />
        <Button type="submit" variant="dark">
          <Plus className="w-5 h-5" aria-hidden="true" /> {t('consensus.propose')}
        </Button>
      </form>

      <div className="space-y-6">
        {sorted.length === 0 ? (
          <EmptyState icon={Archive} title={t('consensus.empty')} />
        ) : (
          sorted.map((proposal) => {
            const proposalVotes = votes.filter((vote) => vote.proposalId === proposal.id);
            const tally = tallyVotes(proposalVotes);
            const mine = proposalVotes.find((vote) => vote.memberId === memberId);
            const concerns = proposalVotes.filter((vote) => vote.concern !== '' && (vote.type === 'reservations' || vote.type === 'block'));
            const closed = proposal.status === 'closed';
            return (
              <article key={proposal.id} className={`bg-white p-6 rounded-3xl border border-slate-200 space-y-4 ${closed ? 'opacity-75' : ''}`}>
                <div className="flex justify-between items-start gap-4">
                  <h3 className="text-xl font-bold text-slate-900 leading-tight break-words min-w-0">{proposal.text}</h3>
                  <div className="flex shrink-0">
                    <IconButton
                      icon={closed ? Unlock : Lock}
                      label={closed ? t('consensus.reopen') : t('consensus.close')}
                      onClick={() => proposalMap.set(proposal.id, { ...proposal, status: closed ? 'active' : 'closed' })}
                    />
                    <IconButton icon={Trash2} label={t('consensus.delete')} onClick={() => remove(proposal)} />
                  </div>
                </div>

                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex" aria-hidden="true">
                  {tally.total > 0 &&
                    OPTIONS.map((option) => (
                      <div key={option.type} style={{ width: `${(tally[option.type] / tally.total) * 100}%` }} className={`${option.bar} h-full`} />
                    ))}
                </div>
                <p className="flex flex-wrap justify-between gap-2 text-xs font-bold">
                  <span className={OUTCOME_STYLE[tally.outcome]}>
                    {closed ? `${t('consensus.closed')} · ` : ''}
                    {t(`consensus.outcome.${tally.outcome}`)}
                  </span>
                  <span className="text-slate-400">{t('consensus.total', { count: tally.total })}</span>
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {OPTIONS.map(({ type, icon: Icon, idle, active }) => (
                    <button
                      key={type}
                      type="button"
                      disabled={closed}
                      aria-pressed={mine?.type === type}
                      onClick={() => castVote(proposal, type)}
                      className={`p-3 rounded-xl border-2 font-bold text-sm flex flex-col items-center gap-1 transition-colors disabled:cursor-not-allowed ${mine?.type === type ? active : idle}`}
                    >
                      <Icon className="w-5 h-5" aria-hidden="true" />
                      {t(`consensus.vote.${type}`)}
                      <span className="text-xs font-normal">{tally[type]}</span>
                    </button>
                  ))}
                </div>

                {!closed && mine && (mine.type === 'reservations' || mine.type === 'block') && (
                  <ConcernForm key={mine.type} vote={mine} onSave={(concern) => saveConcern(mine, concern)} />
                )}

                {concerns.length > 0 && (
                  <ul className="space-y-2 text-sm">
                    {concerns.map((vote) => (
                      <li key={vote.memberId} className={`p-3 rounded-xl break-words ${vote.type === 'block' ? 'bg-red-50 text-red-900' : 'bg-yellow-50 text-yellow-900'}`}>
                        <strong>
                          {vote.name || t('common.anonymous')} ({t(`consensus.vote.${vote.type}`)}):
                        </strong>{' '}
                        {vote.concern}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}

function ConcernForm({ vote, onSave }: { vote: Vote; onSave: (concern: string) => void }) {
  const t = useT();
  const [concern, setConcern] = useState(vote.concern);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave(concern);
      }}
      className="flex flex-col sm:flex-row gap-2"
    >
      <input
        value={concern}
        onChange={(event) => setConcern(event.target.value)}
        placeholder={t('consensus.concernHint')}
        aria-label={t('consensus.concernHint')}
        className={`${inputClass} flex-1`}
      />
      <Button type="submit" variant="light" disabled={concern.trim() === vote.concern}>
        {t('consensus.saveConcern')}
      </Button>
    </form>
  );
}
