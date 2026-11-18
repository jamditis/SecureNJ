import { useState, type FormEvent } from 'react';
import { DEFAULT_SIGNALING_URLS, ICE_SERVER_URLS } from '../services/config';
import { useT } from '../services/i18n';
import { parseSignalingUrls } from '../services/space';
import { useSync } from '../services/sync';
import { Button, Field, Modal, Notice, PassphraseInput, inputClass } from './ui';

/** Create, join, or leave a space. To create and to join are the same operation. */
export default function SpaceDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { space, signaling, peers, join, leave } = useSync();
  const [name, setName] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [servers, setServers] = useState(DEFAULT_SIGNALING_URLS.join('\n'));
  const [remember, setRemember] = useState(false);
  const [deleteCopy, setDeleteCopy] = useState(true);

  if (space) {
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
            void leave(deleteCopy).then(onClose);
          }}
        >
          {t('space.leave')}
        </Button>
      </Modal>
    );
  }

  const parsed = parseSignalingUrls(servers);
  const canJoin = name.trim() !== '' && passphrase.trim() !== '' && parsed.invalid.length === 0;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canJoin) return;
    join({ name: name.trim(), passphrase, signaling: parsed.urls }, remember);
    onClose();
  };

  return (
    <Modal title={t('space.joinTitle')} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-600 leading-relaxed">{t('space.intro')}</p>
        <Field label={t('space.name')}>
          <input value={name} onChange={(event) => setName(event.target.value)} autoFocus className={inputClass} />
        </Field>
        <Field label={t('space.passphrase')}>
          <PassphraseInput value={passphrase} onChange={setPassphrase} allowGenerate />
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
