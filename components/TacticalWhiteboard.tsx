import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { Download, Eraser, Trash2, Undo2 } from 'lucide-react';
import { downloadBlob } from '../services/download';
import { useT } from '../services/i18n';
import { isWhiteboardStroke, keyOfId } from '../services/schema';
import { useRecords, useSync } from '../services/sync';
import { BOARD_ASPECT, drawBoard, isFarEnough, isNearStroke, lastStrokeOf, toBoardPoint } from '../services/whiteboard';
import { IconButton, ToolHeader } from './ui';

const COLORS = ['#0f172a', '#ef4444', '#10b981', '#3b82f6'];
/** Line widths as fractions of the board width. */
const WIDTHS = [0.003, 0.006, 0.012];
const ERASER_RADIUS = 0.012;
const EXPORT_WIDTH_PX = 1600;

/** The line that the user draws now. It is saved when the pointer goes up. */
interface ActiveLine {
  /** Only this pointer draws. A second finger or a palm is ignored. */
  pointerId: number;
  points: number[];
  color: string;
  width: number;
}

export default function TacticalWhiteboard() {
  const t = useT();
  const { doc, memberId } = useSync();
  const { records: strokes, map } = useRecords('strokes', isWhiteboardStroke, keyOfId);
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(WIDTHS[0]);
  const [isEraser, setIsEraser] = useState(false);
  const [boardWidth, setBoardWidth] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef<ActiveLine | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => setBoardWidth(Math.round(entry.contentRect.width)));
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || boardWidth === 0) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = boardWidth * ratio;
    canvas.height = boardWidth * BOARD_ASPECT * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    // A redraw must keep the line in progress: a line from a peer or a resize can come at any time.
    const active = activeRef.current;
    const inProgress = active && active.points.length > 0 ? [{ ...active, id: '', by: memberId, timestamp: Infinity }] : [];
    drawBoard(ctx, [...strokes, ...inProgress], boardWidth);
  }, [strokes, boardWidth, memberId]);

  useEffect(redraw, [redraw]);

  const pointOf = (event: PointerEvent<HTMLCanvasElement>) =>
    toBoardPoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());

  const erase = (x: number, y: number) => {
    const hit = strokes.filter((stroke) => isNearStroke(stroke, x, y, ERASER_RADIUS));
    if (hit.length > 0) doc.transact(() => hit.forEach((stroke) => map.delete(stroke.id)));
  };

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (activeRef.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const [x, y] = pointOf(event);
    if (isEraser) erase(x, y);
    // The eraser keeps no points, so it saves no line.
    activeRef.current = { pointerId: event.pointerId, points: isEraser ? [] : [x, y], color, width };
  };

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const active = activeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const [x, y] = pointOf(event);
    if (isEraser) {
      erase(x, y);
      return;
    }
    const { points } = active;
    if (!isFarEnough(points, x, y)) return;
    // Draw the new segment immediately. The full redraw comes after the save.
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = active.color;
      ctx.lineWidth = Math.max(1, active.width * boardWidth);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(points[points.length - 2] * boardWidth, points[points.length - 1] * boardWidth);
      ctx.lineTo(x * boardWidth, y * boardWidth);
      ctx.stroke();
    }
    points.push(x, y);
  };

  const onPointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    const active = activeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    activeRef.current = null;
    if (active.points.length === 0) return;
    const id = crypto.randomUUID();
    map.set(id, { id, by: memberId, timestamp: Date.now(), points: active.points, color: active.color, width: active.width });
  };

  const undo = () => {
    const last = lastStrokeOf(strokes, memberId);
    if (last) map.delete(last.id);
  };

  const clear = () => {
    if (window.confirm(t('board.clearConfirm'))) map.clear();
  };

  const download = () => {
    const canvas = document.createElement('canvas');
    canvas.width = EXPORT_WIDTH_PX;
    canvas.height = EXPORT_WIDTH_PX * BOARD_ASPECT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawBoard(ctx, strokes, EXPORT_WIDTH_PX);
    canvas.toBlob((blob) => blob && downloadBlob(blob, `whiteboard-${new Date().toISOString().slice(0, 10)}.png`));
  };

  return (
    <div className="space-y-6">
      <ToolHeader title={t('board.title')} subtitle={t('board.subtitle')}>
        <IconButton icon={Undo2} label={t('board.undo')} disabled={!lastStrokeOf(strokes, memberId)} onClick={undo} />
        <IconButton icon={Download} label={t('board.download')} onClick={download} />
        <IconButton icon={Trash2} label={t('board.clear')} className="hover:!text-red-600" disabled={strokes.length === 0} onClick={clear} />
      </ToolHeader>

      <div className="bg-white p-2 rounded-3xl border border-slate-200">
        <div className="flex flex-wrap items-center justify-center gap-3 py-2 border-b border-slate-100 mb-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={t('board.color', { color: c })}
              aria-pressed={color === c && !isEraser}
              onClick={() => {
                setColor(c);
                setIsEraser(false);
              }}
              className={`w-8 h-8 rounded-full border-2 ${color === c && !isEraser ? 'ring-2 ring-offset-2 ring-slate-900 border-white' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
          <span className="w-px h-6 bg-slate-200" aria-hidden="true" />
          {WIDTHS.map((w, i) => (
            <button
              key={w}
              type="button"
              aria-label={t('board.width', { size: i + 1 })}
              aria-pressed={width === w && !isEraser}
              onClick={() => {
                setWidth(w);
                setIsEraser(false);
              }}
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${width === w && !isEraser ? 'bg-slate-200' : 'hover:bg-slate-100'}`}
            >
              <span className="rounded-full bg-slate-900" style={{ width: 4 + i * 4, height: 4 + i * 4 }} />
            </button>
          ))}
          <span className="w-px h-6 bg-slate-200" aria-hidden="true" />
          <IconButton
            icon={Eraser}
            label={t('board.eraser')}
            aria-pressed={isEraser}
            className={isEraser ? '!bg-slate-900 !text-white' : ''}
            onClick={() => setIsEraser(!isEraser)}
          />
        </div>

        {/* The board is a picture with x from left to right, the same for each member, so its layer does not mirror. */}
        <div ref={containerRef} dir="ltr" className="rounded-2xl overflow-hidden touch-none">
          <canvas
            ref={canvasRef}
            aria-label={t('board.canvas')}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className={`block w-full ${isEraser ? 'cursor-cell' : 'cursor-crosshair'}`}
            style={{ aspectRatio: `1 / ${BOARD_ASPECT}` }}
          />
        </div>
      </div>
      <p className="text-center text-xs text-slate-400">{t('board.note')}</p>
    </div>
  );
}
