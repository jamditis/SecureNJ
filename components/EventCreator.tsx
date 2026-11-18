import { useState, type FormEvent } from 'react';
import { Download } from 'lucide-react';
import { encryptText } from '../services/crypto';
import { downloadBlob } from '../services/download';
import { buildEventPage } from '../services/eventExport';
import { LOCALES, useLocale, useT } from '../services/i18n';
import { passphraseProblem } from '../services/passphrase';
import type { EventDetails } from '../types';
import { Button, Field, Notice, PassphraseInput, ToolHeader, inputClass } from './ui';

const EMPTY_EVENT: EventDetails = { title: '', date: '', location: '', description: '', safetyInfo: '' };

export default function EventCreator() {
  const t = useT();
  const locale = useLocale();
  const [details, setDetails] = useState(EMPTY_EVENT);
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);

  const field = (key: keyof EventDetails) => ({
    value: details[key],
    onChange: (event: { target: { value: string } }) => setDetails({ ...details, [key]: event.target.value }),
    className: inputClass,
    // The text of the event can be in a different language than the UI.
    dir: 'auto',
  });

  const exportPage = async () => {
    const payload = await encryptText(JSON.stringify(details), passphrase);
    // The person who opens the page reads these labels, in the language of the person who made it.
    const page = buildEventPage(payload, {
      lang: LOCALES[locale].htmlLang,
      dir: LOCALES[locale].dir,
      pageTitle: t('event.page.title'),
      prompt: t('event.page.prompt'),
      passphrase: t('passphrase.label'),
      unlock: t('event.page.unlock'),
      working: t('common.working'),
      wrong: t('crypto.failed'),
      unsupported: t('event.page.unsupported'),
      location: t('event.field.location'),
      description: t('event.field.description'),
      safety: t('event.field.safety'),
      print: t('event.page.print'),
    });
    downloadBlob(new Blob([page], { type: 'text/html' }), 'secure-event.html');
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    exportPage()
      .then(() => setMessage({ tone: 'info', text: t('event.saved') }))
      .catch(() => setMessage({ tone: 'error', text: t('event.failed') }))
      .finally(() => setBusy(false));
  };

  return (
    <div className="space-y-8">
      <ToolHeader title={t('event.title')} subtitle={t('event.subtitle')} synced={false} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <form onSubmit={submit} className="lg:col-span-2 bg-white border border-slate-200 p-6 rounded-3xl space-y-4">
          <Field label={t('event.field.title')}>
            <input {...field('title')} required />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={t('event.field.date')}>
              <input {...field('date')} required placeholder={t('event.hint.date')} />
            </Field>
            <Field label={t('event.field.location')}>
              <input {...field('location')} required />
            </Field>
          </div>
          <Field label={t('event.field.description')}>
            <textarea {...field('description')} rows={3} />
          </Field>
          <Field label={t('event.field.safety')}>
            <textarea {...field('safetyInfo')} rows={2} placeholder={t('event.hint.safety')} />
          </Field>
          <Field label={t('passphrase.label')}>
            <PassphraseInput value={passphrase} onChange={setPassphrase} allowGenerate />
          </Field>
          <Button type="submit" className="w-full" disabled={busy || passphraseProblem(passphrase) !== null}>
            <Download className="w-5 h-5" aria-hidden="true" /> {busy ? t('common.working') : t('event.generate')}
          </Button>
          {message && <Notice tone={message.tone}>{message.text}</Notice>}
        </form>

        <aside className="bg-slate-900 text-white p-6 rounded-3xl space-y-3 self-start">
          <h3 className="font-bold text-lg">{t('event.howTitle')}</h3>
          <ol className="space-y-2 text-sm text-slate-300 list-decimal ps-4">
            <li>{t('event.how.1')}</li>
            <li>{t('event.how.2')}</li>
            <li>{t('event.how.3')}</li>
            <li>{t('event.how.4')}</li>
          </ol>
          <p className="text-xs text-slate-400 leading-relaxed">{t('event.howNote')}</p>
        </aside>
      </div>
    </div>
  );
}
