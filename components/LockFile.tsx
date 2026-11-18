import { useState, type FormEvent } from 'react';
import { FileLock } from 'lucide-react';
import { downloadBlob } from '../services/download';
import { useLocale, useT, type MessageKey } from '../services/i18n';
import { LOCKED_FILE_NAME, MAX_LOCKED_FILE_BYTES, MAX_LOCKED_FILE_MB, lockFile } from '../services/lockedFile';
import { passphraseProblem } from '../services/passphrase';
import { Button, Field, Notice, PassphraseInput, ToolHeader, inputClass } from './ui';

/** "Lock a file": makes one HTML file that opens in a browser with the passphrase. Nothing is stored. */
export default function LockFile() {
  const t = useT();
  const locale = useLocale();
  const [file, setFile] = useState<File | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [problem, setProblem] = useState<MessageKey | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setProblem(null);
    setSaved(false);
    if (!file) return setProblem('lock.problem.noFile');
    if (file.size > MAX_LOCKED_FILE_BYTES) return setProblem('lock.problem.fileTooLarge');
    const weak = passphraseProblem(passphrase);
    if (weak) return setProblem(`passphrase.problem.${weak}`);
    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      // The person who opens the file reads these labels, in the language of the person who made it.
      const page = await lockFile({ name: file.name, type: file.type, bytes }, passphrase, {
        lang: locale,
        pageTitle: t('lock.page.title'),
        prompt: t('lock.page.prompt'),
        passphrase: t('passphrase.label'),
        unlock: t('lock.page.unlock'),
        working: t('common.working'),
        wrong: t('lock.page.wrong'),
        unsupported: t('lock.page.unsupported'),
        done: t('lock.page.done'),
      });
      // The name of the locked file must not show the name of the original.
      downloadBlob(new Blob([page], { type: 'text/html' }), LOCKED_FILE_NAME);
      setSaved(true);
    } catch {
      setProblem('lock.problem.fileFailed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <ToolHeader title={t('lock.fileTitle')} subtitle={t('lock.fileLede')} synced={false} />

      <form onSubmit={(event) => void submit(event)} className="bg-white border border-slate-200 p-6 rounded-3xl space-y-5">
        <Field label={t('lock.field.file', { size: MAX_LOCKED_FILE_MB })}>
          <input
            type="file"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setSaved(false);
            }}
            className={inputClass}
          />
        </Field>
        <Field label={t('passphrase.label')}>
          <PassphraseInput value={passphrase} onChange={setPassphrase} allowGenerate />
        </Field>
        <p className="text-xs text-slate-500 leading-relaxed">{t('lock.fileHint')}</p>
        {problem && <Notice tone="error">{t(problem, { size: MAX_LOCKED_FILE_MB })}</Notice>}
        <Button type="submit" className="w-full" disabled={busy}>
          <FileLock className="w-4 h-4" aria-hidden="true" />
          {busy ? t('common.working') : t('lock.lockFile')}
        </Button>
        {saved && (
          <p role="status" className="text-sm leading-relaxed p-3 rounded-xl border bg-amber-50 border-amber-200 text-amber-800">
            <strong>{t('lock.savedLead', { name: LOCKED_FILE_NAME })}</strong> {t('lock.savedRest')}
          </p>
        )}
      </form>

      <section className="space-y-3">
        <h3 className="font-bold text-lg text-slate-900">{t('lock.know.title')}</h3>
        <ul className="list-disc pl-5 space-y-2 text-sm text-slate-600 leading-relaxed">
          <li>{t('lock.know.1')}</li>
          <li>{t('lock.know.2')}</li>
          <li>{t('lock.know.3')}</li>
          <li>{t('lock.know.4')}</li>
        </ul>
      </section>
    </div>
  );
}
