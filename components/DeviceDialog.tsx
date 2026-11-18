import { useRef, useState, type ChangeEvent } from 'react';
import { Download, Trash2, Upload } from 'lucide-react';
import { NotABackupError, restoreBackup, sealBackup } from '../services/backup';
import { MAX_CONTAINER_BYTES } from '../services/crypto';
import { downloadBlob } from '../services/download';
import { useT } from '../services/i18n';
import { useSync } from '../services/sync';
import { Button, Modal, Notice, PassphraseModal } from './ui';

/** Backup, restore, and erase for the data that this browser holds. */
export default function DeviceDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { doc, space, erase } = useSync();
  const [transfer, setTransfer] = useState<{ kind: 'backup' } | { kind: 'restore'; bytes: Uint8Array } | null>(null);
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [confirmErase, setConfirmErase] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const scope = space ? t('device.scopeSpace', { name: space.name }) : t('device.scopeLocal');

  const backup = async (passphrase: string) => {
    const name = `securenj-backup-${new Date().toISOString().slice(0, 10)}.snj`;
    downloadBlob(new Blob([await sealBackup(doc, passphrase)], { type: 'application/octet-stream' }), name);
    setMessage({ tone: 'info', text: t('device.backupSaved', { name }) });
  };

  const restore = async (bytes: Uint8Array, passphrase: string) => {
    try {
      await restoreBackup(doc, bytes, passphrase);
      setMessage({ tone: 'info', text: t('device.restored') });
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

  return (
    <Modal title={t('device.title')} onClose={onClose}>
      <section className="space-y-3">
        <h4 className="font-bold text-slate-900">{t('device.backupTitle')}</h4>
        <p className="text-sm text-slate-600 leading-relaxed">{t('device.backupNote', { scope })}</p>
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

      <section className="space-y-3 pt-5 border-t border-slate-100">
        <h4 className="font-bold text-slate-900">{t('device.eraseTitle')}</h4>
        <p className="text-sm text-slate-600 leading-relaxed">{t('device.eraseNote')}</p>
        {confirmErase ? (
          <Button variant="danger" className="w-full" onClick={() => void erase()}>
            <Trash2 className="w-4 h-4" aria-hidden="true" /> {t('device.eraseConfirm')}
          </Button>
        ) : (
          <Button variant="light" className="w-full !text-red-700 !border-red-200" onClick={() => setConfirmErase(true)}>
            <Trash2 className="w-4 h-4" aria-hidden="true" /> {t('device.erase')}
          </Button>
        )}
      </section>

      {transfer && (
        <PassphraseModal
          title={transfer.kind === 'backup' ? t('device.backup') : t('device.restore')}
          note={transfer.kind === 'backup' ? t('device.backupPassphraseNote') : t('device.restorePassphraseNote', { scope })}
          actionLabel={transfer.kind === 'backup' ? t('device.backup') : t('device.restore')}
          create={transfer.kind === 'backup'}
          onSubmit={(passphrase) => (transfer.kind === 'backup' ? backup(passphrase) : restore(transfer.bytes, passphrase))}
          onClose={() => setTransfer(null)}
        />
      )}
    </Modal>
  );
}
