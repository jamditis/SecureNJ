import { useState, type FormEvent } from 'react';
import { Check, Copy, Lock, Unlock } from 'lucide-react';
import {
  MAX_CONTAINER_BYTES,
  MAX_FILE_BYTES,
  decryptFile,
  decryptText,
  encryptFile,
  encryptText,
} from '../services/crypto';
import { downloadBlob } from '../services/download';
import { useT } from '../services/i18n';
import { passphraseProblem } from '../services/passphrase';
import { Button, Field, Notice, PassphraseInput, ToolHeader, inputClass } from './ui';

type Mode = 'encrypt' | 'decrypt';
type Kind = 'text' | 'file';
const ENCRYPTED_FILE_NAME = 'encrypted-file.snj';

function Tabs<T extends string>({ options, value, onChange, label }: { options: readonly T[]; value: T; onChange: (v: T) => void; label: (v: T) => string }) {
  return (
    <div className="flex bg-slate-100 p-1 rounded-xl">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${value === option ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-500'}`}
        >
          {label(option)}
        </button>
      ))}
    </div>
  );
}

interface SecureShareProps {
  /** Locked text from a link of the form "#/secure-share/<locked text>". */
  lockedFromLink?: string;
}

export default function SecureShare({ lockedFromLink = '' }: SecureShareProps) {
  void lockedFromLink;
  const t = useT();
  const [mode, setMode] = useState<Mode>('encrypt');
  const [kind, setKind] = useState<Kind>('text');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [output, setOutput] = useState('');
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setText('');
    setFile(null);
    setOutput('');
    setMessage(null);
  };

  const run = async () => {
    if (kind === 'text') {
      setOutput(mode === 'encrypt' ? await encryptText(text, passphrase) : await decryptText(text, passphrase));
      return;
    }
    if (!file) return;
    // A file at the limit must decrypt again, so the limit for a container is higher.
    if (file.size > (mode === 'encrypt' ? MAX_FILE_BYTES : MAX_CONTAINER_BYTES)) {
      setMessage({ tone: 'error', text: t('share.tooLarge') });
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (mode === 'encrypt') {
      const sealed = await encryptFile({ name: file.name, type: file.type, bytes }, passphrase);
      // The name of the encrypted file must not show the name of the original.
      downloadBlob(new Blob([sealed], { type: 'application/octet-stream' }), ENCRYPTED_FILE_NAME);
      setMessage({ tone: 'info', text: t('share.fileSaved', { name: ENCRYPTED_FILE_NAME }) });
    } else {
      const plain = await decryptFile(bytes, passphrase);
      // A generic type makes the browser save the file. It never opens it inside the app.
      downloadBlob(new Blob([plain.bytes], { type: 'application/octet-stream' }), plain.name);
      setMessage({ tone: 'info', text: t('share.fileSaved', { name: plain.name }) });
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setOutput('');
    run()
      .catch(() => setMessage({ tone: 'error', text: t('crypto.failed') }))
      .finally(() => setBusy(false));
  };

  const copy = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasInput = kind === 'text' ? text.trim() !== '' : file !== null;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <ToolHeader title={t('share.title')} subtitle={t('share.subtitle')} synced={false} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <form onSubmit={submit} className="bg-white border border-slate-200 p-6 rounded-3xl space-y-5">
          <Tabs options={['encrypt', 'decrypt'] as const} value={mode} label={(v) => t(`share.mode.${v}`)} onChange={(v) => { setMode(v); reset(); }} />
          <Tabs options={['text', 'file'] as const} value={kind} label={(v) => t(`share.kind.${v}`)} onChange={(v) => { setKind(v); reset(); }} />

          {kind === 'text' ? (
            <Field label={mode === 'encrypt' ? t('share.textToEncrypt') : t('share.textToDecrypt')}>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} spellCheck={mode === 'encrypt'} className={`${inputClass} font-mono resize-none`} />
            </Field>
          ) : (
            <Field label={mode === 'encrypt' ? t('share.fileToEncrypt') : t('share.fileToDecrypt')}>
              <input
                key={mode}
                type="file"
                accept={mode === 'decrypt' ? '.snj' : undefined}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className={inputClass}
              />
            </Field>
          )}

          {kind === 'file' && mode === 'encrypt' && <Notice>{t('share.fileNote')}</Notice>}

          <Field label={t('passphrase.label')}>
            <PassphraseInput value={passphrase} onChange={setPassphrase} allowGenerate={mode === 'encrypt'} />
          </Field>

          <Button type="submit" variant={mode === 'encrypt' ? 'primary' : 'dark'} className="w-full" disabled={busy || !hasInput || passphrase === '' || (mode === 'encrypt' && passphraseProblem(passphrase) !== null)}>
            {mode === 'encrypt' ? <Lock className="w-4 h-4" aria-hidden="true" /> : <Unlock className="w-4 h-4" aria-hidden="true" />}
            {busy ? t('common.working') : t(`share.mode.${mode}`)}
          </Button>
          {message && <Notice tone={message.tone}>{message.text}</Notice>}
        </form>

        <div className="bg-slate-900 text-white p-6 rounded-3xl flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-lg">{t('share.output')}</h3>
            {output && (
              <Button variant="light" className="!px-3 !py-1.5 !text-xs" onClick={() => void copy()}>
                {copied ? <Check className="w-3 h-3" aria-hidden="true" /> : <Copy className="w-3 h-3" aria-hidden="true" />}
                {copied ? t('common.copied') : t('common.copy')}
              </Button>
            )}
          </div>
          <output className="flex-1 min-h-32 bg-slate-950/50 rounded-2xl p-4 border border-slate-800 font-mono text-xs text-slate-300 break-all whitespace-pre-wrap">
            {output || <span className="text-slate-600">{kind === 'text' ? t('share.outputEmpty') : t('share.outputFile')}</span>}
          </output>
          <p className="text-xs text-slate-400 leading-relaxed">{t('share.note')}</p>
        </div>
      </div>
    </div>
  );
}
