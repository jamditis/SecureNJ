import { useState, type ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { WeakPassphraseError } from '../services/crypto';
import { downloadBlob } from '../services/download';
import { useT, type MessageKey } from '../services/i18n';
import {
  WITNESS_FIELDS,
  WITNESS_FILE_NAME,
  WITNESS_FILE_TYPE,
  buildWitnessText,
  hasNotes,
  localDateTimeValue,
  lockWitnessNotes,
  type WitnessAnswers,
  type WitnessFieldId,
  type WitnessLabels,
} from '../services/witness';
import { useUnsavedWork } from '../services/unsaved';
import { Button, Field, Notice, PassphraseInput, ToolHeader, inputClass } from './ui';

const ACLU_GUIDE = 'https://www.aclu.org/know-your-rights/protesters-rights';
const PHOTO_CLEANER = '#/photo-cleaner';

const labelClass = 'block text-xs font-bold text-slate-500 uppercase tracking-widest';
const hintClass = 'text-sm text-slate-500';
const linkClass = 'font-bold underline underline-offset-2';

/** Puts a link at the `{link}` mark of a message. */
function WithLink({ text, children }: { text: string; children: ReactNode }) {
  const [before, after = ''] = text.split('{link}');
  return (
    <>
      {before}
      {children}
      {after}
    </>
  );
}

export default function WitnessNotes() {
  const t = useT();
  const [when, setWhen] = useState(() => localDateTimeValue(new Date()));
  const [answers, setAnswers] = useState<WitnessAnswers>({});
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  // The notes are in memory only. Ask before the browser drops notes that are not in a file.
  const unsaved = !saved && hasNotes(answers);
  useUnsavedWork(unsaved);

  // After a change, the file on the device is not the form on the screen: take the "saved" message away.
  const changeWhen = (value: string) => {
    setWhen(value);
    setSaved(false);
  };
  const changeAnswer = (id: WitnessFieldId, value: string) => {
    setAnswers((current) => ({ ...current, [id]: value }));
    setSaved(false);
  };
  const changePassphrase = (value: string) => {
    setPassphrase(value);
    setSaved(false);
  };

  const lockAndSave = async () => {
    setError(null);
    if (!hasNotes(answers)) {
      setError('witness.problem.empty');
      return;
    }
    const labels: WitnessLabels = {
      title: t('witness.title'),
      when: t('witness.field.when'),
      fields: {
        where: t('witness.field.where'),
        who: t('witness.field.who'),
        vehicles: t('witness.field.vehicles'),
        what: t('witness.field.what'),
        said: t('witness.field.said'),
        people: t('witness.field.people'),
        evidence: t('witness.field.evidence'),
      },
    };
    setBusy(true);
    try {
      const locked = await lockWitnessNotes(buildWitnessText(when, answers, labels), passphrase);
      downloadBlob(new Blob([locked], { type: WITNESS_FILE_TYPE }), WITNESS_FILE_NAME);
      setSaved(true);
    } catch (problem) {
      setError(problem instanceof WeakPassphraseError ? `passphrase.problem.${problem.problem}` : 'witness.failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <ToolHeader title={t('witness.title')} subtitle={t('witness.subtitle')} synced={false} />

      <div className="max-w-2xl space-y-3">
        <Notice tone="warning">
          <strong>{t('witness.safety.lead')}</strong>{' '}
          <WithLink text={t('witness.safety.text')}>
            <a href={ACLU_GUIDE} target="_blank" rel="noopener noreferrer" className={linkClass}>
              {t('witness.safety.link')}
            </a>
          </WithLink>
        </Notice>
        <Notice>{t('witness.notStored')}</Notice>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-5 max-w-2xl">
        <div className="space-y-1.5">
          <label htmlFor="wn-when" className={labelClass}>
            {t('witness.field.when')}
          </label>
          <input id="wn-when" type="datetime-local" value={when} onChange={(event) => changeWhen(event.target.value)} className={inputClass} />
        </div>

        {WITNESS_FIELDS.map((field) => {
          const id = `wn-${field.id}`;
          const control = {
            id,
            value: answers[field.id] ?? '',
            onChange: (event: { target: { value: string } }) => changeAnswer(field.id, event.target.value),
            'aria-describedby': `${id}-hint`,
            className: inputClass,
          };
          return (
            <div key={field.id} className="space-y-1.5">
              <label htmlFor={id} className={labelClass}>
                {t(`witness.field.${field.id}`)}
              </label>
              <p id={`${id}-hint`} className={hintClass}>
                {t(`witness.hint.${field.id}`)}
              </p>
              {field.long ? <textarea rows={4} {...control} /> : <input autoComplete="off" {...control} />}
            </div>
          );
        })}

        <Field label={t('passphrase.label')}>
          <PassphraseInput value={passphrase} onChange={changePassphrase} allowGenerate />
        </Field>

        {error && <Notice tone="error">{t(error)}</Notice>}

        <Button onClick={() => void lockAndSave()} disabled={busy}>
          <Lock className="w-5 h-5" aria-hidden="true" /> {busy ? t('common.working') : t('witness.save')}
        </Button>

        {/* The live region is on the page before the message, so a screen reader reads the message when it comes. */}
        <div role="status">
          {saved && <p className="text-sm leading-relaxed p-3 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-800">{t('witness.saved')}</p>}
        </div>
      </div>

      <section className="max-w-2xl space-y-3">
        <h3 className="text-lg font-bold text-slate-900">{t('witness.share.title')}</h3>
        <ul className="list-disc pl-5 space-y-2 text-sm text-slate-600 leading-relaxed">
          <li>{t('witness.share.lawyer')}</li>
          <li>{t('witness.share.consent')}</li>
          <li>{t('witness.share.officers')}</li>
          <li>
            <WithLink text={t('witness.share.photo')}>
              <a href={PHOTO_CLEANER} className={`${linkClass} text-emerald-700`}>
                {t('witness.share.photoLink')}
              </a>
            </WithLink>
          </li>
        </ul>
      </section>
    </div>
  );
}
