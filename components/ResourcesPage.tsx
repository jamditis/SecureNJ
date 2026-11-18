import { useId, useMemo, useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import type { AiPrompt } from '../content/resources';
import { resourcesText } from '../services/contentText';
import { useContentText, useLocale, useT } from '../services/i18n';
import { copyText } from '../services/sharePage';
import { Button, Notice } from './ui';

const CAUTIONS = ['people', 'settings', 'numbers', 'work'] as const;

/**
 * Outside links and AI prompts, from `content/resources.ts`. The name of a
 * link is in English in each language, so that a reader finds the same name
 * on the page that opens. A prompt is text that the visitor copies: the page
 * only shows it and copies it.
 */
export default function ResourcesPage() {
  const t = useT();
  const locale = useLocale();
  const content = useContentText();
  const text = useMemo(() => resourcesText(content), [content]);
  // The title of the prompt that was copied last, or of the one that the browser did not copy.
  const [copied, setCopied] = useState('');
  const [failed, setFailed] = useState('');

  const copy = async (prompt: AiPrompt) => {
    const done = await copyText(prompt.text);
    setCopied(done ? prompt.title : '');
    setFailed(done ? '' : prompt.title);
  };

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-3 tracking-tight">{t('resources.navTitle')}</h2>
        <p className="text-lg text-slate-600 max-w-2xl leading-relaxed">{t('resources.lede')}</p>
      </div>

      {locale !== 'en' && <Notice>{t('resources.namesNotice')}</Notice>}

      {text.groups.map((group) => (
        <section key={group.id} className="space-y-4">
          <h3 className="text-xl font-bold text-slate-900">{t(`resources.group.${group.id}`)}</h3>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {group.items.map((item) => (
              <li key={item.url} className="p-5 bg-white border border-slate-200 rounded-2xl">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t('resources.linkLabel', { name: item.name })}
                  className="inline-flex items-start gap-1.5 font-bold text-emerald-700 underline underline-offset-2 hover:text-emerald-900"
                >
                  <span lang="en">{item.name}</span>
                  <ExternalLink className="w-3.5 h-3.5 mt-1 shrink-0" aria-hidden="true" />
                </a>
                <p className="text-slate-600 text-sm leading-relaxed mt-1">
                  {item.note}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="space-y-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900">{t('resources.promptsTitle')}</h3>
          <p className="text-slate-600 max-w-2xl">{t('resources.promptsIntro')}</p>
        </div>
        <ul className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-2 text-sm text-amber-900 leading-relaxed">
          {CAUTIONS.map((id) => (
            <li key={id}>
              <strong>{t(`resources.caution.${id}.lead`)}</strong> {t(`resources.caution.${id}.text`)}
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {text.prompts.map((prompt) => (
            <PromptCard
              key={prompt.title}
              prompt={prompt}
              copied={copied === prompt.title}
              failed={failed === prompt.title}
              onCopy={() => void copy(prompt)}
            />
          ))}
        </div>
        <p role="status" className="sr-only">
          {copied && t('common.copied')}
        </p>
      </section>
    </div>
  );
}

function PromptCard({ prompt, copied, failed, onCopy }: { prompt: AiPrompt; copied: boolean; failed: boolean; onCopy: () => void }) {
  const t = useT();
  const titleId = useId();
  return (
    <article aria-labelledby={titleId} className="flex flex-col gap-3 p-5 bg-white border border-slate-200 rounded-2xl">
      <div>
        <h4 id={titleId} className="font-bold text-slate-900">
          {prompt.title}
        </h4>
        <p className="text-sm text-slate-500">{prompt.when}</p>
      </div>
      <p className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
        {prompt.text}
      </p>
      {failed && <Notice tone="error">{t('resources.copyFailed')}</Notice>}
      <Button variant="light" className="self-start" aria-describedby={titleId} onClick={onCopy}>
        {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
        {copied ? t('common.copied') : t('resources.copyPrompt')}
      </Button>
    </article>
  );
}
