import { useT, type MessageKey } from '../services/i18n';

const DOES: MessageKey[] = ['limits.does.1', 'limits.does.2', 'limits.does.3', 'limits.does.4'];
const HABITS: MessageKey[] = ['limits.habit.1', 'limits.habit.2', 'limits.habit.3', 'limits.habit.4'];
const NOT_COUNT = 13;

/**
 * The statement of what the site protects and what it does not. Each
 * sentence here is a claim about the code: when the code changes, check
 * this page and `docs/security.md` together.
 */
export default function LimitsPage() {
  const t = useT();
  const doesNot = Array.from({ length: NOT_COUNT }, (_, i) => ({
    lead: `limits.not.${i + 1}.lead` as MessageKey,
    text: `limits.not.${i + 1}.text` as MessageKey,
  }));
  return (
    <article className="space-y-8 max-w-3xl">
      <div>
        <h2 className="text-3xl font-extrabold text-slate-900 mb-3 tracking-tight">{t('limits.title')}</h2>
        <p className="text-lg text-slate-600 leading-relaxed">{t('limits.lede')}</p>
      </div>

      <section className="space-y-3">
        <h3 className="text-xl font-bold text-slate-900">{t('limits.doesTitle')}</h3>
        <ul className="list-disc pl-5 space-y-2 text-slate-700 leading-relaxed">
          {DOES.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-xl font-bold text-slate-900">{t('limits.doesNotTitle')}</h3>
        <ul className="list-disc pl-5 space-y-2 text-slate-700 leading-relaxed">
          {doesNot.map(({ lead, text }) => (
            <li key={lead}>
              <strong>{t(lead)}</strong> {t(text)}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-xl font-bold text-slate-900">{t('limits.habitsTitle')}</h3>
        <ul className="list-disc pl-5 space-y-2 text-slate-700 leading-relaxed">
          {HABITS.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}
