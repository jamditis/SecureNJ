/**
 * Whiteboard geometry. All coordinates are fractions of the board width,
 * so a drawing has the same shape on a phone and on a large screen.
 */
import type { WhiteboardStroke } from '../types';

/** Board height divided by board width. */
export const BOARD_ASPECT = 0.625;
export const BOARD_BACKGROUND = '#f8fafc';

interface BoardRect {
  left: number;
  top: number;
  width: number;
}

export function toBoardPoint(clientX: number, clientY: number, rect: BoardRect): [number, number] {
  return [(clientX - rect.left) / rect.width, (clientY - rect.top) / rect.width];
}

/** Drops points that are too near the last point. This keeps strokes small. */
export function isFarEnough(points: number[], x: number, y: number, minDistance = 0.002): boolean {
  if (points.length < 2) return true;
  return Math.hypot(x - points[points.length - 2], y - points[points.length - 1]) >= minDistance;
}

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** True if the point is on the stroke. The eraser uses this. */
export function isNearStroke(stroke: WhiteboardStroke, x: number, y: number, radius: number): boolean {
  const { points } = stroke;
  const reach = radius + stroke.width / 2;
  if (points.length === 2) return Math.hypot(x - points[0], y - points[1]) <= reach;
  for (let i = 0; i + 3 < points.length; i += 2) {
    if (distanceToSegment(x, y, points[i], points[i + 1], points[i + 2], points[i + 3]) <= reach) return true;
  }
  return false;
}

/** The newest stroke of one member. Undo removes it. */
export function lastStrokeOf(strokes: WhiteboardStroke[], memberId: string): WhiteboardStroke | undefined {
  return strokes
    .filter((stroke) => stroke.by === memberId)
    .reduce<WhiteboardStroke | undefined>((last, s) => (!last || s.timestamp >= last.timestamp ? s : last), undefined);
}

type Context2D = Pick<
  CanvasRenderingContext2D,
  'beginPath' | 'moveTo' | 'lineTo' | 'stroke' | 'fillRect' | 'strokeStyle' | 'fillStyle' | 'lineWidth' | 'lineCap' | 'lineJoin'
>;

/** Draws all strokes, oldest first, on a canvas that is `widthPx` wide. */
export function drawBoard(ctx: Context2D, strokes: WhiteboardStroke[], widthPx: number): void {
  ctx.fillStyle = BOARD_BACKGROUND;
  ctx.fillRect(0, 0, widthPx, widthPx * BOARD_ASPECT);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  [...strokes]
    .sort((a, b) => a.timestamp - b.timestamp)
    .forEach(({ points, color, width }) => {
      if (points.length < 2) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, width * widthPx);
      ctx.beginPath();
      ctx.moveTo(points[0] * widthPx, points[1] * widthPx);
      // A single point is drawn as a dot.
      if (points.length === 2) ctx.lineTo(points[0] * widthPx, points[1] * widthPx);
      for (let i = 2; i + 1 < points.length; i += 2) {
        ctx.lineTo(points[i] * widthPx, points[i + 1] * widthPx);
      }
      ctx.stroke();
    });
}
