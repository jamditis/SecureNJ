import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, Copy, Lock, Unlock } from 'lucide-react';
import { decryptText, encryptText } from '../services/crypto';
import { useT, type MessageKey } from '../services/i18n';
import { LOCK_ROUTE, buildLockLink, linkQrCells, readLockLink, type QrCells } from '../services/lockLink';
import { passphraseProblem } from '../services/passphrase';
import { Button, Field, Notice, PassphraseInput, ToolHeader, inputClass } from './ui';

type Mode = 'lock' | 'unlock';
type CopyTarget = 'link' | 'text' | 'message';
const MODES = [
  { id: 'lock', icon: Lock },
  { id: 'unlock', icon: Unlock },
] as const;

/** A QR code needs a light margin of four cells to scan. */
const QR_MARGIN = 4;

function LinkQr({ cells, label }: { cells: QrCells; label: string }) {
  const total = cells.size + QR_MARGIN * 2;
  // At least three pixels for each cell, so that a camera can still read the code of a long link.
  const side = Math.max(192, total * 3);
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${total} ${total}`} width={side} height={side} className="max-w-full h-auto bg-white rounded-xl" shapeRendering="crispEdges">
      <rect width={total} height={total} fill="#ffffff" />
      {cells.dark.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x + QR_MARGIN} y={y + QR_MARGIN} width={1} height={1} fill="#0f172a" />
      ))}
    </svg>
  );
}

interface SecureShareProps {
  /** The part of the address after "#/secure-share/": the locked text, URI-encoded. */
  lockedFromLink?: string;
}

/** "Lock a message": locks text with a passphrase, and unlocks locked text. Nothing is stored. */
export default function SecureShare({ lockedFromLink = '' }: SecureShareProps) {
  const t = useT();
  const [fromLink] = useState(() => readLockLink(lockedFromLink));
  const [mode, setMode] = useState<Mode>(lockedFromLink === '' ? 'lock' : 'unlock');
  const [text, setText] = useState(fromLink.text);
  const [passphrase, setPassphrase] = useState('');
  // The result keeps its mode. Plain text can then never show as locked text or go into a link.
  const [result, setResult] = useState<{ mode: Mode; value: string } | null>(null);
  const [problem, setProblem] = useState<MessageKey | null>(fromLink.damaged ? 'lock.problem.damagedLink' : null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<CopyTarget | 'failed' | null>(null);

  // The locked text must not stay in the address bar, where a reload or a
  // screenshot shows it again.
  useEffect(() => {
    if (lockedFromLink !== '') window.history.replaceState(null, '', LOCK_ROUTE);
  }, [lockedFromLink]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setText('');
    setResult(null);
    setProblem(null);
    setCopied(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setProblem(null);
    setResult(null);
    setCopied(null);
    if (text.trim() === '') return setProblem(mode === 'lock' ? 'lock.problem.noMessage' : 'lock.problem.noLockedText');
    if (passphrase === '') return setProblem('lock.problem.noPassphrase');
    const weak = mode === 'lock' ? passphraseProblem(passphrase) : null;
    if (weak) return setProblem(`passphrase.problem.${weak}`);
    setBusy(true);
    try {
      setResult({ mode, value: mode === 'lock' ? await encryptText(text, passphrase) : await decryptText(text, passphrase) });
    } catch {
      setProblem(mode === 'lock' ? 'lock.problem.lockFailed' : 'lock.problem.unlockFailed');
    } finally {
      setBusy(false);
    }
  };

  const locked = result?.mode === 'lock' ? result.value : '';
  const unlocked = result?.mode === 'unlock' ? result.value : null;
  const link = useMemo(() => (locked ? buildLockLink(locked, window.location.href) : ''), [locked]);
  const qr = useMemo(() => (link ? linkQrCells(link) : null), [link]);

  const copy = async (target: CopyTarget, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(target);
    } catch {
      // The browser can refuse the clipboard, for example on a page that is not secure.
      setCopied('failed');
    }
  };

  const copyButton = (target: CopyTarget, value: string, label: MessageKey, variant: 'primary' | 'light') => (
    <Button variant={variant} onClick={() => void copy(target, value)}>
      {copied === target ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
      {copied === target ? t('common.copied') : t(label)}
    </Button>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <ToolHeader
        title={mode === 'lock' ? t('lock.messageTitle') : t('lock.unlockTitle')}
        subtitle={fromLink.text ? t('lock.fromLinkLede') : t('lock.messageLede')}
        synced={false}
      />

      <form onSubmit={(event) => void submit(event)} className="bg-white border border-slate-200 p-6 rounded-3xl space-y-5">
        <div role="group" aria-label={t('lock.tabs')} className="flex bg-slate-100 p-1 rounded-xl">
          {MODES.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={mode === id}
              disabled={busy}
              onClick={() => switchMode(id)}
              className={`flex-1 inline-flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-colors disabled:cursor-not-allowed ${mode === id ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-500'}`}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              {t(`lock.tab.${id}`)}
            </button>
          ))}
        </div>

        <Field label={mode === 'lock' ? t('lock.field.message') : t('lock.field.lockedText')}>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={mode === 'lock' ? 7 : 5}
            spellCheck={mode === 'lock'}
            className={`${inputClass} ${mode === 'lock' ? '' : 'font-mono break-all'}`}
          />
        </Field>
        <Field label={t('passphrase.label')}>
          <PassphraseInput value={passphrase} onChange={setPassphrase} allowGenerate={mode === 'lock'} />
        </Field>
        {mode === 'lock' && <p className="text-xs text-slate-500 leading-relaxed">{t('lock.messageHint')}</p>}
        {problem && <Notice tone="error">{t(problem)}</Notice>}
        <Button type="submit" variant={mode === 'lock' ? 'primary' : 'dark'} className="w-full" disabled={busy}>
          {busy ? t('common.working') : mode === 'lock' ? t('lock.lockMessage') : t('lock.unlockMessage')}
        </Button>
      </form>

      <div aria-live="polite" className="empty:hidden">
        {locked && (
          <section className="bg-white border border-slate-200 p-6 rounded-3xl space-y-4">
            <h3 className="font-bold text-lg text-slate-900">{t('lock.lockedHeading')}</h3>
            <div className="flex flex-wrap gap-2">
              {copyButton('link', link, 'lock.copyLink', 'primary')}
              {copyButton('text', locked, 'lock.copyText', 'light')}
            </div>
            {copied === 'failed' && <Notice tone="error">{t('lock.copyFailed')}</Notice>}
            <p data-testid="locked-text" className="font-mono text-xs text-slate-700 break-all bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-48 overflow-y-auto">
              {locked}
            </p>
            {qr && (
              <figure className="flex flex-col items-center gap-2">
                <LinkQr cells={qr} label={t('lock.qrLabel')} />
                <figcaption className="text-xs text-slate-500 text-center">{t('lock.qrCaption')}</figcaption>
              </figure>
            )}
            <p className="text-sm leading-relaxed p-3 rounded-xl border bg-amber-50 border-amber-200 text-amber-800">
              <strong>{t('lock.sendNoteLead')}</strong> {t('lock.sendNoteRest')}
            </p>
          </section>
        )}
        {unlocked !== null && (
          <section className="bg-white border border-slate-200 p-6 rounded-3xl space-y-4">
            <h3 className="font-bold text-lg text-slate-900">{t('lock.messageHeading')}</h3>
            <p data-testid="unlocked-text" className="text-sm text-slate-900 whitespace-pre-wrap break-words bg-slate-50 border border-slate-200 rounded-xl p-3">
              {unlocked}
            </p>
            {copyButton('message', unlocked, 'lock.copyMessage', 'light')}
            {copied === 'failed' && <Notice tone="error">{t('lock.copyFailed')}</Notice>}
            <p className="text-xs text-slate-500 leading-relaxed">{t('lock.clipboardHint')}</p>
          </section>
        )}
      </div>

      <section className="space-y-3">
        <h3 className="font-bold text-lg text-slate-900">{t('lock.how.title')}</h3>
        <ul className="list-disc pl-5 space-y-2 text-sm text-slate-600 leading-relaxed">
          <li>{t('lock.how.1')}</li>
          <li>{t('lock.how.2')}</li>
          <li>{t('lock.how.3')}</li>
        </ul>
      </section>
    </div>
  );
}
