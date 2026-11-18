import { Fragment, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { FolderOpen, Lock, Printer } from 'lucide-react';
import {
  DEFAULT_ANSWERS,
  FIRST_STEPS,
  HOTLINE_ITEM_ID,
  HOTLINE_NOTE,
  LANGUAGE_LINKS,
  LEARN_MORE,
  PLAN_SECTIONS,
  type NotePart,
  type PlanItem,
} from '../content/familyPlan';
import { downloadBlob } from '../services/download';
import {
  MAX_PLAN_FILE_BYTES,
  PLAN_FILE_NAME,
  PLAN_FILE_TYPE,
  lockPlan,
  newPlan,
  setAnswer,
  unlockPlan,
  type PlanAnswers,
} from '../services/family';
import { useLocale, useT, type MessageKey } from '../services/i18n';
import { passphraseProblem } from '../services/passphrase';
import { useUnsavedWork } from '../services/unsaved';
import { Button, Field, Modal, Notice, PassphraseInput, ToolHeader, inputClass } from './ui';

const LINK_CLASS = 'underline font-medium text-emerald-700 hover:text-emerald-900';
const CARD_CLASS = 'bg-white p-6 rounded-3xl border border-slate-200 space-y-4';

/** An outside page opens in a new tab, and it does not get the address of this page. */
function OutsideLink({ text, href }: { text: string; href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={LINK_CLASS}>
      {text}
    </a>
  );
}

function NoteText({ parts }: { parts: readonly NotePart[] }) {
  return parts.map((part, index) => <Fragment key={index}>{typeof part === 'string' ? part : <OutsideLink {...part} />}</Fragment>);
}

/** The hotline note names the default number, so it shows only while the answer is that number. */
function hintOf(item: PlanItem, answer: string): ReactNode {
  if (item.id === HOTLINE_ITEM_ID) return answer === DEFAULT_ANSWERS[HOTLINE_ITEM_ID] ? <NoteText parts={HOTLINE_NOTE} /> : null;
  return item.hint ?? null;
}

interface OpenDialogProps {
  /** A rejected promise shows the message and keeps the dialog open for a new try. */
  onSubmit: (passphrase: string) => Promise<void>;
  onClose: () => void;
}

function OpenDialog({ onSubmit, onClose }: OpenDialogProps) {
  const t = useT();
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFailed(false);
    onSubmit(passphrase).catch(() => {
      setFailed(true);
      setBusy(false);
    });
  };

  return (
    <Modal title={t('family.open')} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-600 leading-relaxed">{t('family.openNote')}</p>
        <Field label={t('passphrase.label')}>
          <PassphraseInput value={passphrase} onChange={setPassphrase} autoFocus />
        </Field>
        {failed && <Notice tone="error">{t('family.openFailed')}</Notice>}
        <Button type="submit" className="w-full" disabled={busy || passphrase === ''}>
          {busy ? t('common.working') : t('family.openAction')}
        </Button>
      </form>
    </Modal>
  );
}

/**
 * The plan is in the memory of this page only. It goes to the device as a
 * locked file, or to paper. The prompts are reference content in English,
 * so they carry `lang="en"`. An answer can be in any language.
 */
export default function FamilyPlan() {
  const t = useT();
  const locale = useLocale();
  const [plan, setPlan] = useState<PlanAnswers>(newPlan);
  // The plan as it was at the start, at the last save, or at the last open. A change gives a new object.
  const [kept, setKept] = useState<PlanAnswers>(plan);
  const [savedPlan, setSavedPlan] = useState<PlanAnswers | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);
  /** The text of a file that waits for its passphrase. */
  const [fileText, setFileText] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const unsaved = plan !== kept;

  // The plan is not stored, so a reload or a closed tab loses it. The browser asks first.
  useUnsavedWork(unsaved);

  const save = async () => {
    setError(null);
    const problem = passphraseProblem(passphrase);
    if (problem) {
      setError(`passphrase.problem.${problem}`);
      return;
    }
    // A change during the encryption is not in the file, so it stays unsaved.
    const snapshot = plan;
    setBusy(true);
    try {
      const locked = await lockPlan(snapshot, passphrase);
      downloadBlob(new Blob([locked], { type: PLAN_FILE_TYPE }), PLAN_FILE_NAME);
      setKept(snapshot);
      setSavedPlan(snapshot);
    } catch {
      setError('family.saveFailed');
    } finally {
      setBusy(false);
    }
  };

  const pickFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // With no value, the same file can be selected again.
    event.target.value = '';
    if (!file) return;
    setError(null);
    if (unsaved && !window.confirm(t('family.replaceConfirm'))) return;
    if (file.size > MAX_PLAN_FILE_BYTES) {
      setError('family.openFailed');
      return;
    }
    try {
      setFileText(await file.text());
    } catch {
      setError('family.openFailed');
    }
  };

  const open = async (text: string, filePassphrase: string) => {
    const opened = await unlockPlan(text, filePassphrase);
    setPlan(opened);
    setKept(opened);
    setSavedPlan(null);
    // The next save then locks the plan with the passphrase that the person knows.
    setPassphrase(filePassphrase);
    setFileText(null);
  };

  return (
    <div className="space-y-8">
      <div className="no-print space-y-6">
        <ToolHeader title={t('family.title')} subtitle={t('family.lede')} synced={false} />
        <Notice tone="warning">{t('family.notice')}</Notice>
        {locale !== 'en' && (
          <div className="text-xs leading-relaxed p-3 rounded-xl border bg-slate-50 border-slate-200 text-slate-600 space-y-1">
            <p>{t('family.englishNotice')}</p>
            <ul className="list-disc pl-5">
              {LANGUAGE_LINKS.map((link) => (
                <li key={link.href} lang="en">
                  <OutsideLink {...link} />
                </li>
              ))}
            </ul>
          </div>
        )}

        <section className={CARD_CLASS}>
          <h3 className="font-bold text-slate-900 text-lg">{t('family.firstSteps')}</h3>
          <ol lang="en" className="list-decimal pl-5 space-y-1.5 text-sm text-slate-700">
            {FIRST_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p lang="en" className="text-xs text-slate-500 leading-relaxed">
            <NoteText parts={LEARN_MORE} />
          </p>
        </section>
      </div>

      <div className="space-y-6">
        <h3 className="hidden print:block text-2xl font-bold text-black">{t('family.printTitle')}</h3>
        {PLAN_SECTIONS.map((section) => (
          <section key={section.section} className={`${CARD_CLASS} print:border-0 print:p-0 print:rounded-none`}>
            <h3 lang="en" className="font-bold text-slate-900 text-lg print:text-black print:break-after-avoid">
              {section.section}
            </h3>
            {section.items.map((item) => {
              const id = `fp-${item.id}`;
              const answer = plan[item.id] ?? '';
              const hint = hintOf(item, answer);
              const control = {
                id,
                value: answer,
                'aria-describedby': hint ? `${id}-hint` : undefined,
                onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                  const { value } = event.target;
                  setPlan((current) => setAnswer(current, item.id, value));
                },
                className: `${inputClass} print:hidden`,
              };
              return (
                <div key={item.id} className="space-y-1.5 print:break-inside-avoid">
                  <label htmlFor={id} lang="en" className="block text-sm font-bold text-slate-700 print:text-black">
                    {item.label}
                  </label>
                  {hint && (
                    <p id={`${id}-hint`} lang="en" className="no-print text-xs text-slate-500 leading-relaxed">
                      {hint}
                    </p>
                  )}
                  {item.long ? <textarea rows={3} {...control} /> : <input autoComplete="off" {...control} />}
                  {/* On paper, a field cuts a long answer off. This copy grows with the answer, and an empty one leaves a line to write on. */}
                  <p className={`hidden print:block whitespace-pre-wrap break-words text-sm text-black border-b border-black ${item.long ? 'min-h-20' : 'min-h-8'}`}>
                    {answer}
                  </p>
                </div>
              );
            })}
          </section>
        ))}
      </div>

      <section className={`no-print ${CARD_CLASS}`}>
        <h3 className="font-bold text-slate-900 text-lg">{t('family.keep')}</h3>
        <Field label={t('family.passphrase')}>
          <PassphraseInput value={passphrase} onChange={setPassphrase} allowGenerate />
        </Field>
        {error && <Notice tone="error">{t(error)}</Notice>}
        {plan === savedPlan && (
          <p role="status" className="text-sm font-bold text-emerald-700">
            {t('family.saved', { file: PLAN_FILE_NAME })}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button disabled={busy} onClick={() => void save()}>
            <Lock className="w-4 h-4" aria-hidden="true" /> {busy ? t('common.working') : t('family.save')}
          </Button>
          <Button variant="light" onClick={() => fileInput.current?.click()}>
            <FolderOpen className="w-4 h-4" aria-hidden="true" /> {t('family.open')}
          </Button>
          <input ref={fileInput} type="file" accept=".txt,text/plain" aria-label={t('family.open')} className="hidden" onChange={(event) => void pickFile(event)} />
          <Button variant="light" onClick={() => window.print()}>
            <Printer className="w-4 h-4" aria-hidden="true" /> {t('family.print')}
          </Button>
        </div>
      </section>

      {fileText !== null && <OpenDialog onSubmit={(filePassphrase) => open(fileText, filePassphrase)} onClose={() => setFileText(null)} />}
    </div>
  );
}
