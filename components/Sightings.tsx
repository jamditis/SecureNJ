
import React, { useState, useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { IndexeddbPersistence } from 'y-indexeddb';
import { 
  AlertTriangle, 
  MapPin, 
  Clock, 
  Trash2, 
  Plus, 
  Siren, 
  Wifi, 
  WifiOff, 
  Settings, 
  Info,
  ShieldAlert,
  Eye
} from 'lucide-react';
import { Sighting } from '../types';

const ROOM_NAME = 'safety-alerts-v1';

const Sightings: React.FC = () => {
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [peers, setPeers] = useState(0);
  const [isSynced, setIsSynced] = useState(false);
  
  // UI States
  const [isReporting, setIsReporting] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Settings
  const [autoDeleteHours, setAutoDeleteHours] = useState(4); // Default to 4 hours for safety

  // Yjs References
  const ydocRef = useRef<Y.Doc | null>(null);
  const ymapRef = useRef<Y.Map<Sighting> | null>(null);

  const [newSighting, setNewSighting] = useState<Partial<Sighting>>({
    type: 'raid',
    location: '',
    description: ''
  });

  useEffect(() => {
    const ydoc = new Y.Doc();
    const ymap = ydoc.getMap<Sighting>('sightings');
    
    ydocRef.current = ydoc;
    ymapRef.current = ymap;

    // 1. Persistence
    const indexeddbProvider = new IndexeddbPersistence(ROOM_NAME, ydoc);
    indexeddbProvider.on('synced', () => setIsSynced(true));

    // 2. Network Sync
    const webrtcProvider = new WebrtcProvider(ROOM_NAME, ydoc, {
      signaling: ['wss://signaling.yjs.dev', 'wss://y-webrtc-signaling-eu.herokuapp.com']
    });

    webrtcProvider.on('peers', ({ webrtcPeers }: any) => {
      setPeers(webrtcPeers.size);
    });

    // 3. Bind State
    const updateState = () => {
      const all = Array.from(ymap.values()) as Sighting[];
      setSightings(all.sort((a, b) => b.timestamp - a.timestamp));
    };

    ymap.observe(updateState);
    updateState();

    return () => {
      webrtcProvider.destroy();
      indexeddbProvider.destroy();
      ydoc.destroy();
    };
  }, []);

  // Strict Auto-delete Logic
  useEffect(() => {
    if (!ymapRef.current) return;

    const runCleanup = () => {
      const now = Date.now();
      const cutoff = now - (autoDeleteHours * 60 * 60 * 1000);
      const ymap = ymapRef.current!;
      
      ydocRef.current?.transact(() => {
        ymap.forEach((item, key) => {
          if (item.timestamp < cutoff) {
            ymap.delete(key);
          }
        });
      });
    };

    // Run often (every 30s) given the sensitive nature of this data
    const interval = setInterval(runCleanup, 30 * 1000);
    return () => clearInterval(interval);
  }, [autoDeleteHours]);

  const addSighting = () => {
    if (!newSighting.location || !ymapRef.current) return;
    const id = crypto.randomUUID();
    const sighting: Sighting = {
      ...(newSighting as Sighting),
      id,
      timestamp: Date.now(),
      type: newSighting.type as 'raid' | 'checkpoint' | 'surveillance' | 'other'
    };
    
    ymapRef.current.set(id, sighting);
    setIsReporting(false);
    setNewSighting({ type: 'raid', location: '', description: '' });
  };

  const deleteSighting = (id: string) => {
    ymapRef.current?.delete(id);
  };

  const timeAgo = (timestamp: number) => {
    const minutes = Math.floor((Date.now() - timestamp) / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'raid': return 'bg-red-100 text-red-800 border-red-200';
      case 'checkpoint': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'surveillance': return 'bg-amber-100 text-amber-800 border-amber-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'raid': return 'Active raid';
      case 'checkpoint': return 'Checkpoint';
      case 'surveillance': return 'Surveillance';
      default: return 'Other activity';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            Safety alerts
            {peers > 0 ? (
              <span className="flex items-center gap-1 bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                <Wifi className="w-3 h-3" /> Live ({peers})
              </span>
            ) : (
              <span className="flex items-center gap-1 bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                <WifiOff className="w-3 h-3" /> Offline
              </span>
            )}
          </h2>
          <p className="text-slate-500">Real-time alerts about enforcement activity. Data deletes automatically.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 p-2.5 rounded-2xl transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIsReporting(true)}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-6 rounded-2xl transition-all shadow-lg shadow-red-600/20 flex items-center gap-2 animate-pulse"
          >
            <Siren className="w-5 h-5" /> Report sighting
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {isSettingsOpen && (
        <div className="bg-white border border-slate-200 p-6 rounded-3xl animate-in slide-in-from-top-2">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Settings className="w-4 h-4" /> Alert settings
          </h3>
          <div className="flex items-center gap-4">
            <label className="text-sm text-slate-600 font-medium">Auto-delete alerts after:</label>
            <select 
              value={autoDeleteHours}
              onChange={(e) => setAutoDeleteHours(Number(e.target.value))}
              className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm font-bold"
            >
              <option value={1}>1 hour</option>
              <option value={4}>4 hours (Recommended)</option>
              <option value={12}>12 hours</option>
              <option value={24}>24 hours</option>
            </select>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Alerts are ephemeral. Short retention windows protect the community and ensure map accuracy.
          </p>
        </div>
      )}

      {/* Alert List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sightings.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white rounded-[2.5rem] border border-slate-100">
            <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-10 h-10 text-emerald-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No active threats reported</h3>
            <p className="text-slate-500 max-w-sm mx-auto mt-2">
              The area is currently clear of reported activity. Stay vigilant and report if you see something.
            </p>
          </div>
        ) : (
          sightings.map(item => (
            <div key={item.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative group overflow-hidden">
              <div className={`absolute top-0 left-0 right-0 h-1.5 ${item.type === 'raid' ? 'bg-red-500' : 'bg-amber-500'}`}></div>
              <div className="flex justify-between items-start mb-4 pt-2">
                <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${getTypeStyle(item.type)}`}>
                  {getTypeLabel(item.type)}
                </span>
                <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {timeAgo(item.timestamp)}
                </span>
              </div>

              <h4 className="font-bold text-slate-900 text-lg mb-2 flex items-start gap-2">
                <MapPin className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                {item.location}
              </h4>
              
              <p className="text-slate-600 text-sm leading-relaxed mb-4 pl-7">
                {item.description}
              </p>

              <div className="pt-4 border-t border-slate-50 flex justify-end">
                <button 
                  onClick={() => deleteSighting(item.id)}
                  className="text-slate-300 hover:text-slate-500 text-xs font-bold flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Dismiss
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Report Modal */}
      {isReporting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-red-900/20 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] w-full max-w-lg p-8 shadow-2xl space-y-6">
            <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <Siren className="w-8 h-8 text-red-600" />
              Report activity
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {['raid', 'checkpoint', 'surveillance', 'other'].map(type => (
                   <button
                    key={type}
                    onClick={() => setNewSighting({ ...newSighting, type: type as any })}
                    className={`py-3 px-4 rounded-xl font-bold text-sm border transition-all ${
                      newSighting.type === type 
                        ? 'bg-slate-900 text-white border-slate-900' 
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                   >
                     {type.charAt(0).toUpperCase() + type.slice(1)}
                   </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1 tracking-widest">Location</label>
                <input
                  autoFocus
                  type="text"
                  placeholder="e.g. Intersection of 4th & King"
                  value={newSighting.location}
                  onChange={e => setNewSighting({ ...newSighting, location: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl font-medium outline-none focus:ring-2 focus:ring-red-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1 tracking-widest">Description</label>
                <textarea
                  rows={3}
                  placeholder="Describe vehicles, number of agents, or specific activity..."
                  value={newSighting.description}
                  onChange={e => setNewSighting({ ...newSighting, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500/20"
                />
              </div>

              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex gap-3 items-start">
                <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  <strong>Safety first:</strong> Do not photograph agents if it endangers you. This report will be broadcast to all nearby users immediately.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setIsReporting(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addSighting}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold shadow-lg shadow-red-600/20 transition-all"
                >
                  Broadcast alert
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sightings;
