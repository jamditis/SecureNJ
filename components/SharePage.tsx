import { useState } from 'react';
import { Check, Copy, Printer } from 'lucide-react';
import { SOURCE_CODE_URL } from '../content/resources';
import { useT, type MessageKey } from '../services/i18n';
import { appAddress, copyText, flyerTools, parseRich, shareMessage } from '../services/sharePage';
import QrCode from './QrCode';
import { Button, Notice } from './ui';

const HOST_STEPS: MessageKey[] = [
  'sharePage.host.code',
  'sharePage.host.build',
  'sharePage.host.serve',
  'sharePage.host.origin',
  'sharePage.host.signaling',
  'sharePage.host.default',
];

/** Text with code and with the link to the source code. `parseRich` describes the marks. */
function RichText({ message }: { message: string }) {
  const t = useT();
  return (
    <>
      {parseRich(message).map((part, index) => {
        if (part.kind === 'code') {
          return (
            <code key={index} className="font-mono text-[0.9em] bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded break-words">
              {part.text}
            </code>
          );
        }
        if (part.kind === 'link') {
          return (
            <a
              key={index}
              href={SOURCE_CODE_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('sharePage.linkLabel', { name: part.text })}
              className="font-bold text-emerald-700 underline underline-offset-2 hover:text-emerald-900"
            >
              {part.text}
            </a>
          );
        }
        return part.text;
      })}
    </>
  );
}

/**
 * Ways to pass the app on: a text message, a flyer with a QR code, and the
 * steps to host a copy. Only the flyer goes on paper.
 */
export default function SharePage() {
  const t = useT();
  const address = appAddress(window.location);
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');
  const message = address === null ? '' : shareMessage(t, address);

  const copyMessage = async () => {
    setCopy((await copyText(message)) ? 'copied' : 'failed');
  };

  return (
    <div className="space-y-10">
      <div className="no-print">
        <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-3 tracking-tight">{t('sharePage.navTitle')}</h2>
        <p className="text-lg text-slate-600 max-w-2xl leading-relaxed">{t('sharePage.lede')}</p>
      </div>

      {address === null ? (
        <div className="no-print">
          <Notice tone="warning">{t('sharePage.noAddress')}</Notice>
        </div>
      ) : (
        <>
          <section className="no-print space-y-4">
            <h3 className="text-xl font-bold text-slate-900">{t('sharePage.textTitle')}</h3>
            <p className="bg-white border border-slate-200 rounded-2xl p-5 text-slate-700 leading-relaxed break-words">{message}</p>
            {copy === 'failed' && <Notice tone="error">{t('sharePage.copyFailed')}</Notice>}
            <Button onClick={() => void copyMessage()}>
              {copy === 'copied' ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
              {copy === 'copied' ? t('common.copied') : t('sharePage.copyMessage')}
            </Button>
            <p role="status" className="sr-only">
              {copy === 'copied' && t('common.copied')}
            </p>
          </section>

          <section className="no-print space-y-4">
            <div>
              <h3 className="text-xl font-bold text-slate-900">{t('sharePage.paperTitle')}</h3>
              <p className="text-slate-600 max-w-2xl">{t('sharePage.paperText')}</p>
            </div>
            <Button variant="dark" onClick={() => window.print()}>
              <Printer className="w-4 h-4" aria-hidden="true" /> {t('sharePage.print')}
            </Button>
          </section>

          <section
            aria-label={t('sharePage.flyerLabel')}
            className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row md:items-start gap-6 print:flex-row print:items-start print:border-0 print:rounded-none print:p-0"
          >
            <div className="flex-1 min-w-0 space-y-3">
              <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">{t('sharePage.flyerTitle')}</h3>
              <p className="text-slate-700">{t('sharePage.flyerIntro')}</p>
              <p className="font-bold text-slate-900 [overflow-wrap:anywhere]">{address}</p>
              <ul className="list-disc pl-5 space-y-1 text-slate-700">
                {flyerTools().map((tool) => (
                  <li key={tool.id}>
                    <strong>{t('sharePage.flyerItemTitle', { title: t(tool.title) })}</strong> {t(tool.use)}
                  </li>
                ))}
                <li>
                  <strong>{t('sharePage.flyerItemTitle', { title: t('resources.navTitle') })}</strong> {t('sharePage.flyerUse.resources')}
                </li>
              </ul>
              <p className="text-sm text-slate-600">{t('sharePage.flyerNote')}</p>
            </div>
            <div className="shrink-0">
              <QrCode text={address} label={t('sharePage.qrLabel', { address })} />
            </div>
          </section>
        </>
      )}

      <section className="no-print space-y-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900">{t('sharePage.hostTitle')}</h3>
          <p className="text-slate-600 max-w-2xl">{t('sharePage.hostIntro')}</p>
        </div>
        <ol className="list-decimal pl-5 space-y-2 text-slate-700 leading-relaxed max-w-3xl">
          {HOST_STEPS.map((step) => (
            <li key={step}>
              <RichText message={t(step)} />
            </li>
          ))}
        </ol>
        <p className="text-sm text-slate-600 max-w-3xl">
          <RichText message={t('sharePage.hostDocs')} />
        </p>
      </section>
    </div>
  );
}
