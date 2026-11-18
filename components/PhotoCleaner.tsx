import { useEffect, useRef, useState, type ChangeEvent, type MouseEvent } from 'react';
import { Download, Undo2 } from 'lucide-react';
import { downloadBlob } from '../services/download';
import { useT } from '../services/i18n';
import {
  CLEANED_FILE_NAME,
  COVER_PERCENT_DEFAULT,
  COVER_PERCENT_MAX,
  COVER_PERCENT_MIN,
  buildCleanedFile,
  coverAt,
  paintPhoto,
  type Cover,
} from '../services/photo';
import { Button, Field, Notice, ToolHeader, inputClass } from './ui';

/**
 * The photo, the covers, and the result are in memory only. The file that the
 * user chose is given to the browser to decode and is not read by this code.
 */
export default function PhotoCleaner() {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Counts the files that the user chose, so that a slow photo does not replace a later one.
  const loadRef = useRef(0);
  const [picture, setPicture] = useState<HTMLImageElement | null>(null);
  const [covers, setCovers] = useState<Cover[]>([]);
  const [percent, setPercent] = useState(COVER_PERCENT_DEFAULT);
  const [problem, setProblem] = useState<'open' | 'save' | null>(null);
  const [saved, setSaved] = useState(false);
  // A save takes time. If the person changes something in that time, the file is not the form on the screen.
  const edits = useRef(0);
  const markChanged = () => {
    edits.current += 1;
    setSaved(false);
  };
  const [busy, setBusy] = useState(false);

  const pickFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    loadRef.current += 1;
    const load = loadRef.current;
    setProblem(null);
    markChanged();
    setCovers([]);
    setPicture(null);
    if (!file) return;
    const url = URL.createObjectURL(file);
    const next = new Image();
    const finish = (loaded: HTMLImageElement | null) => {
      URL.revokeObjectURL(url);
      if (load !== loadRef.current) return;
      setPicture(loaded);
      if (!loaded) setProblem('open');
    };
    // A picture with no size (some SVG files) cannot be painted.
    next.onload = () => finish(next.naturalWidth > 0 && next.naturalHeight > 0 ? next : null);
    next.onerror = () => finish(null);
    next.src = url;
  };

  // The canvas on the screen is the canvas that is saved: what the user sees is what the file holds.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !picture) return;
    const size = { width: picture.naturalWidth, height: picture.naturalHeight };
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (context) paintPhoto(context, picture, size, covers);
  }, [picture, covers]);

  const addCover = (event: MouseEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const bounds = canvas.getBoundingClientRect();
    const cover = coverAt(
      event,
      {
        left: bounds.left,
        top: bounds.top,
        clientLeft: canvas.clientLeft,
        clientTop: canvas.clientTop,
        clientWidth: canvas.clientWidth,
        clientHeight: canvas.clientHeight,
      },
      canvas,
      percent,
    );
    if (!cover) return;
    setCovers([...covers, cover]);
    markChanged();
  };

  const undo = () => {
    setCovers(covers.slice(0, -1));
    markChanged();
  };

  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setProblem(null);
    markChanged();
    const editsAtStart = edits.current;
    setBusy(true);
    const file = await buildCleanedFile((type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality))).catch(() => null);
    setBusy(false);
    if (!file) {
      setProblem('save');
      return;
    }
    downloadBlob(file, CLEANED_FILE_NAME);
    if (edits.current === editsAtStart) setSaved(true);
  };

  return (
    <div className="space-y-8">
      <ToolHeader title={t('photo.title')} subtitle={t('photo.lede')} synced={false} />

      <section className="bg-white border border-slate-200 p-6 rounded-3xl space-y-4">
        <Field label={t('photo.choose')}>
          <input type="file" accept="image/*" onChange={pickFile} className={inputClass} />
        </Field>
        {problem && <Notice tone="error">{t(`photo.problem.${problem}`)}</Notice>}

        {picture && (
          <>
            <p className="text-sm text-slate-600 leading-relaxed">
              <strong className="text-slate-900">{t('photo.tapLead')}</strong> {t('photo.tapNote')}
            </p>
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-48">
                <Field label={t('photo.coverSize')}>
                  <input
                    type="range"
                    min={COVER_PERCENT_MIN}
                    max={COVER_PERCENT_MAX}
                    value={percent}
                    onChange={(event) => setPercent(Number(event.target.value))}
                    className="w-full accent-emerald-600"
                  />
                </Field>
              </div>
              <Button variant="ghost" disabled={covers.length === 0} onClick={undo}>
                <Undo2 className="w-4 h-4" aria-hidden="true" /> {t('photo.undo')}
              </Button>
            </div>
            <canvas
              ref={canvasRef}
              role="img"
              aria-label={t('photo.canvasLabel')}
              onClick={addCover}
              className="block max-w-full h-auto mx-auto rounded-xl border border-slate-200 cursor-crosshair touch-manipulation"
            />
            <Button className="w-full" disabled={busy} onClick={save}>
              <Download className="w-4 h-4" aria-hidden="true" /> {busy ? t('common.working') : t('photo.save')}
            </Button>
            {saved && (
              <p role="status" className="text-sm font-bold text-emerald-700">
                {t('photo.saved', { name: CLEANED_FILE_NAME })}
              </p>
            )}
          </>
        )}
      </section>

      <section className="bg-white border border-slate-200 p-6 rounded-3xl space-y-3">
        <h3 className="font-bold text-lg text-slate-900">{t('photo.limitsTitle')}</h3>
        <ul className="space-y-2 text-sm text-slate-600 list-disc pl-5">
          <li>{t('photo.limit.visible')}</li>
          <li>{t('photo.limit.video')}</li>
          <li>{t('photo.limit.original')}</li>
        </ul>
      </section>
    </div>
  );
}
