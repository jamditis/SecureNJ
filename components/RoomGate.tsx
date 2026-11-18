/**
 * The door of each shared tool. A member opens the room of the tool with
 * the group name and the passphrase, or uses the tool on this device only.
 * The passphrase goes to key derivation and is then dropped: it is not
 * stored and not kept in memory.
 */
import { useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Copy, Download, HardDrive, Settings2, Upload, Users } from 'lucide-react';
import { NotABackupError, hasBackup, restoreBackup, sealBackup } from '../services/backup';
import { DEFAULT_SIGNALING_URLS, ICE_SERVER_URLS } from '../services/config';
import { MAX_CONTAINER_BYTES } from '../services/crypto';
import { downloadBlob } from '../services/download';
import { useT, type MessageKey } from '../services/i18n';
import { makeInviteLink } from '../services/invite';
import { passphraseProblem } from '../services/passphrase';
import { MAX_SPACE_NAME_LENGTH, parseSignalingUrls } from '../services/space';
import { MEMORY_ONLY_TOOLS, ToolScope, useRooms, useSync } from '../services/sync';
import QrCode from './QrCode';
import { Button, Field, Modal, Notice, PassphraseInput, PassphraseModal, inputClass } from './ui';

interface RoomGateProps {
  tool: string;
  /** The title of the tool, for the heading of the form. */
  title: string;
  children: ReactNode;
}

export default function RoomGate({ tool, title, children }: RoomGateProps) {
  const { rooms, localTools } = useRooms();
  if (!rooms[tool] && !localTools.has(tool)) return <GateForm tool={tool} title={title} />;
  return (
    <ToolScope tool={tool}>
      <RoomBar tool={tool} />
      {children}
    </ToolScope>
  );
}

function GateForm({ tool, title }: { tool: string; title: string }) {
  const t = useT();
  const { lastRoom, openRoom, setLocalOnly } = useRooms();
  const [name, setName] = useState(lastRoom?.name ?? '');
  const [passphrase, setPassphrase] = useState('');
  const [servers, setServers] = useState((lastRoom ? lastRoom.signaling : DEFAULT_SIGNALING_URLS).join('\n'));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const parsed = parseSignalingUrls(servers, window.location.protocol === 'https:');
  // The signaling server can test guesses of a weak passphrase, so a weak one is not accepted.
  const canOpen = name.trim() !== '' && passphraseProblem(passphrase) === null && parsed.invalid.length === 0 && !busy;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canOpen) return;
    setBusy(true);
    setFailed(false);
    const request = { name: name.trim(), passphrase, signaling: parsed.urls };
    // Drop the passphrase from the form at once. Only the derived keys stay, in memory.
    setPassphrase('');
    openRoom(tool, request).catch(() => {
      setFailed(true);
      setBusy(false);
    });
  };

  return (
    <form onSubmit={submit} className="max-w-xl mx-auto bg-white border border-slate-200 rounded-3xl p-6 md:p-8 space-y-4">
      <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
      <p className="text-sm text-slate-600 leading-relaxed">{t('room.intro')}</p>
      {MEMORY_ONLY_TOOLS.has(tool) && <Notice>{t('room.memoryOnly')}</Notice>}
      <Field label={t('room.name')}>
        <input value={name} onChange={(event) => setName(event.target.value)} dir="auto" autoComplete="off" maxLength={MAX_SPACE_NAME_LENGTH} className={inputClass} />
      </Field>
      <Field label={t('room.passphrase')}>
        <PassphraseInput value={passphrase} onChange={setPassphrase} allowGenerate />
      </Field>
      <Field label={t('space.servers')}>
        <textarea
          value={servers}
          onChange={(event) => setServers(event.target.value)}
          rows={2}
          placeholder="wss://signaling.example.org"
          spellCheck={false}
          dir="ltr"
          className={`${inputClass} font-mono`}
        />
      </Field>
      {parsed.invalid.length > 0 && <Notice tone="error">{t('space.badServers', { list: parsed.invalid.join(', ') })}</Notice>}
      {parsed.invalid.length === 0 && parsed.urls.length === 0 && <Notice tone="warning">{t('room.noServer')}</Notice>}
      {parsed.urls.length > 0 && (
        <Notice>{ICE_SERVER_URLS.length > 0 ? t('space.stunNote', { servers: ICE_SERVER_URLS.join(', ') }) : t('space.noStunNote')}</Notice>
      )}
      {failed && <Notice tone="error">{t('room.failed')}</Notice>}
      <Button type="submit" className="w-full" disabled={!canOpen}>
        <Users className="w-4 h-4" aria-hidden="true" /> {busy ? t('common.working') : t('room.open')}
      </Button>
      <Button variant="ghost" className="w-full" onClick={() => setLocalOnly(tool, true)}>
        <HardDrive className="w-4 h-4" aria-hidden="true" /> {t('room.localOnly')}
      </Button>
    </form>
  );
}

/** A small row above the tool: the way to the room settings, or to the room form. */
function RoomBar({ tool }: { tool: string }) {
  const t = useT();
  const { space } = useSync();
  const { setLocalOnly } = useRooms();
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="no-print flex flex-wrap justify-end gap-2 mb-4">
      {!space && (
        <Button variant="light" className="!px-3 !py-1.5 !text-xs" onClick={() => setLocalOnly(tool, false)}>
          <Users className="w-4 h-4" aria-hidden="true" /> {t('room.openInstead')}
        </Button>
      )}
      {(space || hasBackup(tool)) && (
      <Button variant="light" className="!px-3 !py-1.5 !text-xs" onClick={() => setIsOpen(true)}>
        <Settings2 className="w-4 h-4" aria-hidden="true" /> {space ? t('room.settings') : t('room.dataSettings')}
      </Button>
      )}
      {isOpen && <RoomDialog tool={tool} onClose={() => setIsOpen(false)} />}
    </div>
  );
}

function RoomDialog({ tool, onClose }: { tool: string; onClose: () => void }) {
  const t = useT();
  const { doc, space, peers, signaling } = useSync();
  const { closeRoom } = useRooms();
  const [copied, setCopied] = useState(false);
  const [transfer, setTransfer] = useState<{ kind: 'backup' } | { kind: 'restore'; bytes: Uint8Array } | null>(null);
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const savedOnDevice = !MEMORY_ONLY_TOOLS.has(tool);
  const canBackUp = hasBackup(tool);

  const link = space ? makeInviteLink(window.location.href, space) : '';
  const copyLink = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const backup = async (passphrase: string) => {
    const name = `securenj-${tool}-${new Date().toISOString().slice(0, 10)}.snj`;
    downloadBlob(new Blob([await sealBackup(doc, tool, passphrase)], { type: 'application/octet-stream' }), name);
    setMessage({ tone: 'info', text: t('device.backupSaved', { name }) });
  };

  const restore = async (bytes: Uint8Array, passphrase: string) => {
    try {
      const count = await restoreBackup(doc, tool, bytes, passphrase);
      setMessage({ tone: 'info', text: t('room.restored', { count }) });
    } catch (error) {
      // A wrong passphrase stays in the passphrase dialog. A wrong file ends here.
      if (!(error instanceof NotABackupError)) throw error;
      setMessage({ tone: 'error', text: t('device.notBackup') });
    }
  };

  const pickFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_CONTAINER_BYTES) {
      setMessage({ tone: 'error', text: t('device.notBackup') });
      return;
    }
    setTransfer({ kind: 'restore', bytes: new Uint8Array(await file.arrayBuffer()) });
  };

  const leave = async (deleteCopy: boolean) => {
    if (deleteCopy && !window.confirm(t('room.clearConfirm'))) return;
    const deleted = await closeRoom(tool, deleteCopy);
    if (!deleted) window.alert(t('room.clearPending'));
  };

  return (
    <Modal title={space ? t('room.current', { name: space.name }) : t('room.dataSettings')} onClose={onClose}>
      {space && (
        <>
          <dl className="text-sm text-slate-600 space-y-2">
            <div className="flex justify-between gap-4">
              <dt>{t('space.peersLabel')}</dt>
              <dd className="font-bold">{peers}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>{t('space.signalingLabel')}</dt>
              <dd className="font-bold">{t(`space.signaling.${signaling}` as MessageKey)}</dd>
            </div>
          </dl>
          {signaling === 'none' && <Notice tone="warning">{t('room.noServer')}</Notice>}
          {signaling === 'connecting' && <Notice tone="warning">{t('space.connectingNote')}</Notice>}

          <section className="space-y-3 pt-4 border-t border-slate-100">
            <h4 className="font-bold text-slate-900">{t('invite.title')}</h4>
            <p className="text-sm text-slate-600 leading-relaxed">{t('invite.note')}</p>
            <div className="flex gap-2">
              <input readOnly value={link} dir="ltr" aria-label={t('invite.link')} onFocus={(event) => event.target.select()} className={`${inputClass} font-mono`} />
              <Button variant="light" onClick={() => void copyLink()}>
                <Copy className="w-4 h-4" aria-hidden="true" /> {copied ? t('common.copied') : t('invite.copy')}
              </Button>
            </div>
            <div className="flex justify-center">
              <QrCode text={link} label={t('invite.qr')} />
            </div>
          </section>
        </>
      )}

      {canBackUp && (
      <section className="space-y-3 pt-4 border-t border-slate-100">
        <h4 className="font-bold text-slate-900">{t('device.backupTitle')}</h4>
        <p className="text-sm text-slate-600 leading-relaxed">{t('room.backupNote')}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="light" className="flex-1" onClick={() => setTransfer({ kind: 'backup' })}>
            <Download className="w-4 h-4" aria-hidden="true" /> {t('device.backup')}
          </Button>
          <Button variant="light" className="flex-1" onClick={() => fileInput.current?.click()}>
            <Upload className="w-4 h-4" aria-hidden="true" /> {t('device.restore')}
          </Button>
          <input ref={fileInput} type="file" accept=".snj" className="hidden" onChange={pickFile} />
        </div>
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
      </section>
      )}

      {space && (
        <section className="flex flex-wrap gap-2 pt-4 border-t border-slate-100">
          <Button variant="light" className="flex-1" onClick={() => void leave(false)}>
            {t('room.leave')}
          </Button>
          {savedOnDevice && (
            <Button variant="danger" className="flex-1" onClick={() => void leave(true)}>
              {t('room.clear')}
            </Button>
          )}
        </section>
      )}

      {transfer && (
        <PassphraseModal
          title={transfer.kind === 'backup' ? t('device.backup') : t('device.restore')}
          note={transfer.kind === 'backup' ? t('device.backupPassphraseNote') : t('room.restoreNote')}
          actionLabel={transfer.kind === 'backup' ? t('device.backup') : t('device.restore')}
          create={transfer.kind === 'backup'}
          onSubmit={(passphrase) => (transfer.kind === 'backup' ? backup(passphrase) : restore(transfer.bytes, passphrase))}
          onClose={() => setTransfer(null)}
        />
      )}
    </Modal>
  );
}
