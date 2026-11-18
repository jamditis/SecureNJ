/** Small shared parts that all tools use. Keep this file free of tool logic. */
import { useEffect, useId, useState, type ButtonHTMLAttributes, type FormEvent, type ReactNode } from 'react';
import { Dices, Eye, EyeOff, HardDrive, Lock, Wifi, WifiOff, X, type LucideIcon } from 'lucide-react';
import { useT } from '../services/i18n';
import { generatePassphrase, isWeakPassphrase } from '../services/passphrase';
import { useSync } from '../services/sync';

export const inputClass =
  'w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500';

const BUTTON_VARIANTS = {
  primary: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  dark: 'bg-slate-900 hover:bg-black text-white',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  light: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50',
  ghost: 'text-slate-500 hover:bg-slate-100',
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof BUTTON_VARIANTS;
}

export function Button({ variant = 'primary', className = '', type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${BUTTON_VARIANTS[variant]} ${className}`}
      {...rest}
    />
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  /** Read by screen readers and shown as a tooltip. */
  label: string;
}

export function IconButton({ icon: Icon, label, className = '', ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40 ${className}`}
      {...rest}
    >
      <Icon className="w-5 h-5" aria-hidden="true" />
    </button>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">{label}</span>
      {children}
    </label>
  );
}

/** Shows if the data of the open tool stays on this device or syncs to a space. */
export function SyncBadge() {
  const t = useT();
  const { space, peers } = useSync();
  if (!space) {
    return (
      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-bold">
        <HardDrive className="w-3 h-3" aria-hidden="true" /> {t('sync.localOnly')}
      </span>
    );
  }
  const Icon = peers > 0 ? Wifi : WifiOff;
  const color = peers > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700';
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-bold ${color}`}>
      <Icon className="w-3 h-3" aria-hidden="true" /> {t('sync.peers', { name: space.name, count: peers })}
    </span>
  );
}

interface ToolHeaderProps {
  title: string;
  subtitle: string;
  /** False for tools that keep data on the device and never sync. */
  synced?: boolean;
  children?: ReactNode;
}

export function ToolHeader({ title, subtitle, synced = true, children }: ToolHeaderProps) {
  const t = useT();
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 flex flex-wrap items-center gap-2">
          {title}
          {synced ? (
            <SyncBadge />
          ) : (
            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-bold">
              <Lock className="w-3 h-3" aria-hidden="true" /> {t('sync.deviceOnly')}
            </span>
          )}
        </h2>
        <p className="text-slate-500">{subtitle}</p>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const t = useT();
  const titleId = useId();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white rounded-3xl w-full max-w-lg p-6 md:p-8 shadow-2xl space-y-5 my-auto"
      >
        <div className="flex items-center justify-between gap-4">
          <h3 id={titleId} className="text-xl font-bold text-slate-900">
            {title}
          </h3>
          <IconButton icon={X} label={t('common.close')} onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text?: string }) {
  return (
    <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-slate-100">
      <Icon className="w-12 h-12 mx-auto mb-4 text-slate-300" aria-hidden="true" />
      <p className="text-lg font-bold text-slate-700">{title}</p>
      {text && <p className="text-slate-500 max-w-sm mx-auto mt-2 text-sm">{text}</p>}
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warning' | 'error'; children: ReactNode }) {
  const tones = {
    info: 'bg-slate-50 border-slate-200 text-slate-600',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    error: 'bg-red-50 border-red-200 text-red-700',
  };
  return (
    <p role={tone === 'error' ? 'alert' : undefined} className={`text-xs leading-relaxed p-3 rounded-xl border ${tones[tone]}`}>
      {children}
    </p>
  );
}

interface PassphraseInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Shows the button that makes a random passphrase. Use it where a passphrase is created. */
  allowGenerate?: boolean;
  autoFocus?: boolean;
}

export function PassphraseInput({ value, onChange, allowGenerate = false, autoFocus = false }: PassphraseInputProps) {
  const t = useT();
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="off"
          autoFocus={autoFocus}
          spellCheck={false}
          className={`${inputClass} font-mono`}
        />
        <IconButton
          icon={visible ? EyeOff : Eye}
          label={visible ? t('passphrase.hide') : t('passphrase.show')}
          onClick={() => setVisible(!visible)}
        />
        {allowGenerate && (
          <IconButton
            icon={Dices}
            label={t('passphrase.generate')}
            onClick={() => {
              onChange(generatePassphrase());
              setVisible(true);
            }}
          />
        )}
      </div>
      {allowGenerate && value !== '' && isWeakPassphrase(value) && <Notice tone="warning">{t('passphrase.weak')}</Notice>}
    </div>
  );
}

interface PassphraseModalProps {
  title: string;
  note: string;
  actionLabel: string;
  /** True when the passphrase is new. False when it opens data that exists. */
  create: boolean;
  /** A rejected promise shows the "wrong passphrase" message. */
  onSubmit: (passphrase: string) => Promise<void>;
  onClose: () => void;
}

export function PassphraseModal({ title, note, actionLabel, create, onSubmit, onClose }: PassphraseModalProps) {
  const t = useT();
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFailed(false);
    onSubmit(passphrase).then(onClose, () => {
      setFailed(true);
      setBusy(false);
    });
  };

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-600 leading-relaxed">{note}</p>
        <Field label={t('passphrase.label')}>
          <PassphraseInput value={passphrase} onChange={setPassphrase} allowGenerate={create} autoFocus />
        </Field>
        {failed && <Notice tone="error">{t('crypto.failed')}</Notice>}
        <Button type="submit" className="w-full" disabled={busy || passphrase === ''}>
          {busy ? t('common.working') : actionLabel}
        </Button>
      </form>
    </Modal>
  );
}
