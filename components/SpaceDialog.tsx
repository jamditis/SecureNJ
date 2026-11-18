import { useState, type FormEvent } from 'react';
import { Copy } from 'lucide-react';
import { DEFAULT_SIGNALING_URLS, ICE_SERVER_URLS } from '../services/config';
import { useT } from '../services/i18n';
import { makeInviteLink, type Invite } from '../services/invite';
import { isWeakPassphrase } from '../services/passphrase';
import { parseSignalingUrls } from '../services/space';
import { useSync } from '../services/sync';
import QrCode from './QrCode';
import { Button, Field, Modal, Notice, PassphraseInput, inputClass } from './ui';

interface SpaceDialogProps {
  onClose: () => void;
  /** From an invite link. It fills in the name and the servers, never the passphrase. */
  invite?: Invite | null;
}

/** Create, join, or leave a space. To create and to join are the same operation. */
export default function SpaceDialog({ onClose, invite = null }: SpaceDialogProps) {
  const t = useT();
  const { space, signaling, peers, join, leave } = useSync();
  const [name, setName] = useState(invite?.name ?? '');
  const [copied, setCopied] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [servers, setServers] = useState((invite ? invite.signaling : DEFAULT_SIGNALING_URLS).join('\n'));
  const [remember, setRemember] = useState(false);
  const [deleteCopy, setDeleteCopy] = useState(true);

  if (space) {
    const link = makeInviteLink(window.location.href, space);
    const copyLink = async () => {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    return (
      <Modal title={t('space.current', { name: space.name })} onClose={onClose}>
        <dl className="text-sm text-slate-600 space-y-2">
          <div className="flex justify-between gap-4">
            <dt>{t('space.peersLabel')}</dt>
            <dd className="font-bold">{peers}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>{t('space.signalingLabel')}</dt>
            <dd className="font-bold">{t(`space.signaling.${signaling}`)}</dd>
          </div>
        </dl>
        {signaling === 'none' && <Notice tone="warning">{t('space.noServerNote')}</Notice>}
        {signaling === 'connecting' && <Notice tone="warning">{t('space.connectingNote')}</Notice>}
        <section className="space-y-3 pt-4 border-t border-slate-100">
          <h4 className="font-bold text-slate-900">{t('invite.title')}</h4>
          <p className="text-sm text-slate-600 leading-relaxed">{t('invite.note')}</p>
          <div className="flex gap-2">
            <input readOnly value={link} aria-label={t('invite.link')} onFocus={(event) => event.target.select()} className={`${inputClass} font-mono`} />
            <Button variant="light" onClick={() => void copyLink()}>
              <Copy className="w-4 h-4" aria-hidden="true" /> {copied ? t('common.copied') : t('invite.copy')}
            </Button>
          </div>
          <div className="flex justify-center">
            <QrCode text={link} label={t('invite.qr')} />
          </div>
        </section>
        <div className="pt-4 border-t border-slate-100" />
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={deleteCopy}
            onChange={(event) => setDeleteCopy(event.target.checked)}
            className="mt-0.5 w-4 h-4 accent-emerald-600"
          />
          {t('space.deleteCopy')}
        </label>
        <Button
          variant="danger"
          className="w-full"
          onClick={() => {
            void leave(deleteCopy).then((deleted) => {
              if (!deleted) window.alert(t('space.deletePending'));
            });
          }}
        >
          {t('space.leave')}
        </Button>
      </Modal>
    );
  }

  const parsed = parseSignalingUrls(servers, window.location.protocol === 'https:');
  // The signaling server can test guesses of a weak passphrase, so a weak one is not accepted.
  const canJoin = name.trim() !== '' && !isWeakPassphrase(passphrase) && parsed.invalid.length === 0;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canJoin) return;
    join({ name: name.trim(), passphrase, signaling: parsed.urls }, remember);
    onClose();
  };

  return (
    <Modal title={t('space.joinTitle')} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {invite ? <Notice tone="warning">{t('invite.received', { name: invite.name })}</Notice> : <p className="text-sm text-slate-600 leading-relaxed">{t('space.intro')}</p>}
        <Field label={t('space.name')}>
          <input value={name} onChange={(event) => setName(event.target.value)} autoFocus={!invite} className={inputClass} />
        </Field>
        <Field label={t('space.passphrase')}>
          <PassphraseInput value={passphrase} onChange={setPassphrase} allowGenerate={!invite} autoFocus={!!invite} />
        </Field>
        <Field label={t('space.servers')}>
          <textarea
            value={servers}
            onChange={(event) => setServers(event.target.value)}
            rows={2}
            placeholder="wss://signaling.example.org"
            spellCheck={false}
            className={`${inputClass} font-mono`}
          />
        </Field>
        {parsed.invalid.length > 0 && <Notice tone="error">{t('space.badServers', { list: parsed.invalid.join(', ') })}</Notice>}
        {parsed.invalid.length === 0 && parsed.urls.length === 0 && <Notice tone="warning">{t('space.noServerNote')}</Notice>}
        {parsed.urls.length > 0 && (
          <Notice>{ICE_SERVER_URLS.length > 0 ? t('space.stunNote', { servers: ICE_SERVER_URLS.join(', ') }) : t('space.noStunNote')}</Notice>
        )}
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
            className="mt-0.5 w-4 h-4 accent-emerald-600"
          />
          {t('space.remember')}
        </label>
        <Button type="submit" className="w-full" disabled={!canJoin}>
          {t('space.join')}
        </Button>
      </form>
    </Modal>
  );
}
