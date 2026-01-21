
import React, { useState, useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { IndexeddbPersistence } from 'y-indexeddb';
import { 
  Wifi, 
  WifiOff, 
  UserCheck, 
  AlertCircle, 
  Navigation, 
  ShieldCheck, 
  HelpCircle,
  RefreshCw,
  Edit3
} from 'lucide-react';
import { StatusUser } from '../types';

const ROOM_NAME = 'status-board-v1';

const StatusBoard: React.FC = () => {
  const [users, setUsers] = useState<StatusUser[]>([]);
  const [myStatus, setMyStatus] = useState<StatusUser | null>(null);
  const [peers, setPeers] = useState(0);
  const [isEditing, setIsEditing] = useState(false);

  // Use local storage to remember who "I" am across reloads
  const [myId] = useState(() => {
    let id = localStorage.getItem('status_user_id');
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem('status_user_id', id);
    }
    return id;
  });

  const [myName, setMyName] = useState(() => localStorage.getItem('status_user_name') || 'Anonymous');

  const ydocRef = useRef<Y.Doc | null>(null);
  const usersMapRef = useRef<Y.Map<StatusUser> | null>(null);

  useEffect(() => {
    const ydoc = new Y.Doc();
    const usersMap = ydoc.getMap<StatusUser>('users');
    
    ydocRef.current = ydoc;
    usersMapRef.current = usersMap;

    const indexeddbProvider = new IndexeddbPersistence(ROOM_NAME, ydoc);
    const webrtcProvider = new WebrtcProvider(ROOM_NAME, ydoc, {
      signaling: ['wss://signaling.yjs.dev', 'wss://y-webrtc-signaling-eu.herokuapp.com']
    });

    webrtcProvider.on('peers', ({ webrtcPeers }: any) => {
      setPeers(webrtcPeers.size);
    });

    const updateState = () => {
      const allUsers = Array.from(usersMap.values()) as StatusUser[];
      setUsers(allUsers.sort((a, b) => a.name.localeCompare(b.name)));
      
      const me = allUsers.find(u => u.id === myId);
      if (me) setMyStatus(me);
    };

    usersMap.observe(updateState);
    updateState();

    // Heartbeat: Update my timestamp every 60s if I exist
    const interval = setInterval(() => {
        if (usersMap.has(myId)) {
            const current = usersMap.get(myId);
            if (current) {
                usersMap.set(myId, { ...current, lastUpdated: Date.now() });
            }
        }
    }, 60000);

    return () => {
      clearInterval(interval);
      webrtcProvider.destroy();
      indexeddbProvider.destroy();
      ydoc.destroy();
    };
  }, [myId]);

  const updateStatus = (status: StatusUser['status']) => {
    if (!usersMapRef.current) return;
    const user: StatusUser = {
        id: myId,
        name: myName,
        status,
        lastUpdated: Date.now(),
        note: ''
    };
    usersMapRef.current.set(myId, user);
    localStorage.setItem('status_user_name', myName);
    setIsEditing(false);
  };

  const timeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  };

  const getStatusColor = (status: string) => {
    switch(status) {
        case 'safe': return 'bg-emerald-500';
        case 'transit': return 'bg-yellow-500';
        case 'support': return 'bg-orange-500';
        case 'arrested': return 'bg-red-600';
        default: return 'bg-slate-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
        case 'safe': return ShieldCheck;
        case 'transit': return Navigation;
        case 'support': return AlertCircle;
        case 'arrested': return HelpCircle; // Euphemism
        default: return WifiOff;
    }
  };

  const getStatusLabel = (status: string) => {
      switch(status) {
          case 'safe': return 'Safe / Clear';
          case 'transit': return 'In Transit';
          case 'support': return 'Need Support';
          case 'arrested': return 'Detained';
          case 'offline': return 'Offline';
          default: return 'Unknown';
      }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            Group check-in
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
          <p className="text-slate-500">Signal your safety status to your affinity group.</p>
        </div>
      </div>

      {/* My Status Card */}
      <div className="bg-slate-900 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-xl">
        <div className="relative z-10">
            <h3 className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-4">My Current Status</h3>
            
            {!myStatus || isEditing ? (
                <div className="space-y-4 max-w-md">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">My Codename</label>
                        <input 
                            type="text" 
                            value={myName}
                            onChange={(e) => setMyName(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 p-3 rounded-xl mt-1 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                            placeholder="e.g. Red Sparrow"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {['safe', 'transit', 'support', 'arrested'].map(s => (
                             <button
                                key={s}
                                onClick={() => updateStatus(s as any)}
                                className="p-3 rounded-xl border border-slate-700 hover:bg-slate-800 flex items-center gap-2 font-bold text-sm capitalize transition-colors"
                             >
                                <div className={`w-3 h-3 rounded-full ${getStatusColor(s)}`} />
                                {getStatusLabel(s)}
                             </button>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className={`w-20 h-20 rounded-2xl ${getStatusColor(myStatus.status)} flex items-center justify-center shadow-lg`}>
                             {React.createElement(getStatusIcon(myStatus.status), { className: "w-10 h-10 text-white" })}
                        </div>
                        <div>
                            <h2 className="text-3xl font-bold">{myStatus.name}</h2>
                            <p className="text-emerald-400 font-medium flex items-center gap-2 mt-1">
                                {getStatusLabel(myStatus.status)}
                                <span className="text-slate-500 text-xs">• {timeAgo(myStatus.lastUpdated)}</span>
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setIsEditing(true)}
                        className="bg-slate-800 hover:bg-slate-700 p-3 rounded-xl transition-colors"
                    >
                        <Edit3 className="w-5 h-5" />
                    </button>
                </div>
            )}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.filter(u => u.id !== myId).length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-400 italic">
                Waiting for peers to join...
            </div>
        ) : (
            users.filter(u => u.id !== myId).map(user => {
                const Icon = getStatusIcon(user.status);
                // Check if stale (older than 5 mins)
                const isStale = Date.now() - user.lastUpdated > 5 * 60 * 1000;

                return (
                    <div key={user.id} className={`p-4 rounded-2xl border ${isStale ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-200'} flex items-center gap-4`}>
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isStale ? 'bg-slate-200' : getStatusColor(user.status)}`}>
                            <Icon className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-slate-900 truncate">{user.name}</h4>
                            <div className="flex items-center gap-2 text-xs">
                                <span className={`font-bold ${isStale ? 'text-slate-400' : 'text-slate-600'}`}>
                                    {isStale ? 'Offline?' : getStatusLabel(user.status)}
                                </span>
                                <span className="text-slate-400">• {timeAgo(user.lastUpdated)}</span>
                            </div>
                        </div>
                    </div>
                );
            })
        )}
      </div>
    </div>
  );
};

export default StatusBoard;
