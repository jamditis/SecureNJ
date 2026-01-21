
import React, { useState, useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { IndexeddbPersistence } from 'y-indexeddb';
import { 
  Wifi, 
  WifiOff, 
  Trash2, 
  PenTool, 
  Eraser, 
  Download 
} from 'lucide-react';
import { WhiteboardStroke } from '../types';

const ROOM_NAME = 'whiteboard-v1';
const COLORS = ['#000000', '#EF4444', '#10B981', '#3B82F6'];

const TacticalWhiteboard: React.FC = () => {
  const [peers, setPeers] = useState(0);
  const [activeColor, setActiveColor] = useState('#000000');
  const [isEraser, setIsEraser] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const strokesArrayRef = useRef<Y.Array<WhiteboardStroke> | null>(null);
  const currentStrokeRef = useRef<number[]>([]);

  useEffect(() => {
    const ydoc = new Y.Doc();
    const strokesArray = ydoc.getArray<WhiteboardStroke>('strokes');
    
    ydocRef.current = ydoc;
    strokesArrayRef.current = strokesArray;

    const indexeddbProvider = new IndexeddbPersistence(ROOM_NAME, ydoc);
    const webrtcProvider = new WebrtcProvider(ROOM_NAME, ydoc, {
      signaling: ['wss://signaling.yjs.dev', 'wss://y-webrtc-signaling-eu.herokuapp.com']
    });

    webrtcProvider.on('peers', ({ webrtcPeers }: any) => {
      setPeers(webrtcPeers.size);
    });

    // Drawing Logic
    const redraw = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      strokesArray.forEach(stroke => {
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.width;
        ctx.beginPath();
        if (stroke.points.length > 0) {
            ctx.moveTo(stroke.points[0], stroke.points[1]);
            for (let i = 2; i < stroke.points.length; i += 2) {
                ctx.lineTo(stroke.points[i], stroke.points[i+1]);
            }
        }
        ctx.stroke();
      });
    };

    strokesArray.observe(redraw);
    // Initial draw
    setTimeout(redraw, 100);

    // Resize handler
    const handleResize = () => {
        if (containerRef.current && canvasRef.current) {
            canvasRef.current.width = containerRef.current.offsetWidth;
            canvasRef.current.height = 600; // Fixed height
            redraw();
        }
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      webrtcProvider.destroy();
      indexeddbProvider.destroy();
      ydoc.destroy();
    };
  }, []);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const { x, y } = getCoords(e);
    currentStrokeRef.current = [x, y];
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const { x, y } = getCoords(e);
    currentStrokeRef.current.push(x, y);

    // Local echo for smoothness
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) {
        ctx.strokeStyle = isEraser ? '#F8FAFC' : activeColor;
        ctx.lineWidth = isEraser ? 20 : 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        const len = currentStrokeRef.current.length;
        if (len >= 4) {
             ctx.moveTo(currentStrokeRef.current[len-4], currentStrokeRef.current[len-3]);
             ctx.lineTo(x, y);
             ctx.stroke();
        }
    }
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    if (currentStrokeRef.current.length > 0 && strokesArrayRef.current) {
        const stroke: WhiteboardStroke = {
            points: currentStrokeRef.current,
            color: isEraser ? '#F8FAFC' : activeColor, // Slate-50 for eraser
            width: isEraser ? 20 : 3
        };
        strokesArrayRef.current.push([stroke]);
    }
    currentStrokeRef.current = [];
  };

  const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = (e as React.MouseEvent).clientX;
        clientY = (e as React.MouseEvent).clientY;
    }
    
    return {
        x: clientX - rect.left,
        y: clientY - rect.top
    };
  };

  const clearBoard = () => {
    if (confirm('Clear the entire board for everyone?')) {
        strokesArrayRef.current?.delete(0, strokesArrayRef.current.length);
    }
  };

  const downloadBoard = () => {
    const link = document.createElement('a');
    link.download = `tactical-map-${Date.now()}.png`;
    link.href = canvasRef.current?.toDataURL() || '';
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            Tactical whiteboard
            {peers > 0 ? (
              <span className="flex items-center gap-1 bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                <Wifi className="w-3 h-3" /> Live ({peers})
              </span>
            ) : (
              <span className="flex items-center gap-1 bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                <WifiOff className="w-3 h-3" /> Offline
              </span>
            )}
          </h2>
          <p className="text-slate-500">Shared canvas for mapping formations and routes.</p>
        </div>
        <div className="flex gap-2">
           <button onClick={downloadBoard} className="bg-white border border-slate-200 text-slate-600 p-2.5 rounded-xl hover:bg-slate-50">
             <Download className="w-5 h-5" />
           </button>
           <button onClick={clearBoard} className="bg-red-50 text-red-600 p-2.5 rounded-xl hover:bg-red-100">
             <Trash2 className="w-5 h-5" />
           </button>
        </div>
      </div>

      <div className="bg-white p-2 rounded-3xl border border-slate-200 shadow-sm">
        {/* Toolbar */}
        <div className="flex items-center justify-center gap-4 py-2 border-b border-slate-100 mb-2">
            {COLORS.map(c => (
                <button
                    key={c}
                    onClick={() => { setActiveColor(c); setIsEraser(false); }}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${activeColor === c && !isEraser ? 'scale-125 border-slate-900' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                />
            ))}
            <div className="w-px h-6 bg-slate-200 mx-2"></div>
            <button
                onClick={() => setIsEraser(!isEraser)}
                className={`p-2 rounded-xl transition-colors ${isEraser ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}
            >
                <Eraser className="w-5 h-5" />
            </button>
        </div>

        {/* Canvas Area */}
        <div ref={containerRef} className="relative bg-slate-50 rounded-2xl overflow-hidden touch-none" style={{ height: '600px' }}>
            <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="cursor-crosshair w-full h-full block"
            />
             <div className="absolute top-4 left-4 pointer-events-none opacity-30">
                <PenTool className="w-8 h-8 text-slate-400" />
             </div>
        </div>
      </div>
      <p className="text-center text-xs text-slate-400">
        Changes sync automatically to all connected peers.
      </p>
    </div>
  );
};

export default TacticalWhiteboard;
