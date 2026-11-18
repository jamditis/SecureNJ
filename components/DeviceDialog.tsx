import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useT } from '../services/i18n';
import { useRooms } from '../services/sync';
import { Button, Modal } from './ui';

/** Erases all data that this browser holds for the app. A backup is in the settings of each tool. */
export default function DeviceDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { erase } = useRooms();
  const [confirmErase, setConfirmErase] = useState(false);

  return (
    <Modal title={t('device.eraseTitle')} onClose={onClose}>
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
    </Modal>
  );
}
