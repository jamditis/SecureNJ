import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

/** A QR code as SVG. It is drawn in the browser: the text goes to no server. */
export default function QrCode({ text, label }: { text: string; label: string }) {
  const cells = useMemo(() => {
    const code = qrcode(0, 'M');
    code.addData(text);
    code.make();
    const size = code.getModuleCount();
    const dark: [number, number][] = [];
    for (let row = 0; row < size; row += 1) {
      for (let column = 0; column < size; column += 1) {
        if (code.isDark(row, column)) dark.push([column, row]);
      }
    }
    return { size, dark };
  }, [text]);

  // A QR code needs a light margin of four cells to scan.
  const margin = 4;
  const total = cells.size + margin * 2;
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${total} ${total}`} className="w-48 h-48 bg-white rounded-xl" shapeRendering="crispEdges">
      <rect width={total} height={total} fill="#ffffff" />
      {cells.dark.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x + margin} y={y + margin} width={1} height={1} fill="#0f172a" />
      ))}
    </svg>
  );
}
