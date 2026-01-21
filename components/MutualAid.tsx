
import React, { useState, useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { IndexeddbPersistence } from 'y-indexeddb';
import { 
  Plus, 
  Trash2, 
  Filter, 
  Megaphone, 
  Search, 
  Phone, 
  Settings, 
  Clock, 
  AlertTriangle,
  Download,
  Upload,
  RefreshCw,
  Wifi,
  WifiOff,
  Signal
} from 'lucide-react';
import { MutualAidPost } from '../types';

const CATEGORIES = ['Food', 'Shelter', 'Transportation', 'Childcare', 'Medical', 'Legal', 'Supplies', 'Labor', 'Other'];
const ROOM_NAME = 'mutual-aid-board-v1';

const MutualAid: React.FC = () => {
  const [posts, setPosts] = useState<MutualAidPost[]>([]);
  const [filter, setFilter] = useState<'all' | 'request' | 'offer'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // UI States
  const [isAdding, setIsAdding] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [peers, setPeers] = useState(0);
  const [isSynced, setIsSynced] = useState(false);
  
  // Settings State
  const [autoDeleteHours, setAutoDeleteHours] = useState(48);
  const [isAutoDeleteEnabled, setIsAutoDeleteEnabled] = useState(true);

  // Yjs References
  const ydocRef = useRef<Y.Doc | null>(null);
  const ymapRef = useRef<Y.Map<MutualAidPost> | null>(null);

  const [newPost, setNewPost] = useState<Partial<MutualAidPost>>({
    type: 'request',
    category: 'Food',
    title: '',
    description: '',
    contact: ''
  });

  // Initialize Yjs, WebRTC, and IndexedDB
  useEffect(() => {
    const ydoc = new Y.Doc();
    const ymap = ydoc.getMap<MutualAidPost>('posts');
    
    ydocRef.current = ydoc;
    ymapRef.current = ymap;

    // 1. Persistence (IndexedDB)
    const indexeddbProvider = new IndexeddbPersistence(ROOM_NAME, ydoc);
    indexeddbProvider.on('synced', () => {
        setIsSynced(true);
    });

    // 2. Network Sync (WebRTC)
    // Note: This connects to public signaling servers by default to find peers.
    // Data is transferred P2P.
    const webrtcProvider = new WebrtcProvider(ROOM_NAME, ydoc, {
      signaling: ['wss://signaling.yjs.dev', 'wss://y-webrtc-signaling-eu.herokuapp.com']
    });

    webrtcProvider.on('peers', ({ webrtcPeers }: any) => {
      setPeers(webrtcPeers.size);
    });

    // 3. Bind Yjs Data to React State
    const updateState = () => {
      const allPosts = Array.from(ymap.values()) as MutualAidPost[];
      // Sort by timestamp descending
      setPosts(allPosts.sort((a, b) => b.timestamp - a.timestamp));
    };

    ymap.observe(updateState);
    // Initial sync
    updateState();

    // Load local settings
    const savedSettings = localStorage.getItem('mutual-aid-settings');
    if (savedSettings) {
      const { hours, enabled } = JSON.parse(savedSettings);
      setAutoDeleteHours(hours);
      setIsAutoDeleteEnabled(enabled);
    }

    return () => {
      webrtcProvider.destroy();
      indexeddbProvider.destroy();
      ydoc.destroy();
    };
  }, []);

  // Save Settings
  useEffect(() => {
    localStorage.setItem('mutual-aid-settings', JSON.stringify({
      hours: autoDeleteHours,
      enabled: isAutoDeleteEnabled
    }));
  }, [autoDeleteHours, isAutoDeleteEnabled]);

  // Auto-delete Logic
  useEffect(() => {
    if (!isAutoDeleteEnabled || !ymapRef.current) return;

    const runCleanup = () => {
      const now = Date.now();
      const cutoff = now - (autoDeleteHours * 60 * 60 * 1000);
      const ymap = ymapRef.current!;
      
      // We wrap in a transaction for atomic update
      ydocRef.current?.transact(() => {
        ymap.forEach((post, key) => {
          if (post.timestamp < cutoff) {
            ymap.delete(key);
          }
        });
      });
    };

    const interval = setInterval(runCleanup, 60 * 1000); // Check every minute
    return () => clearInterval(interval);
  }, [isAutoDeleteEnabled, autoDeleteHours]);

  const addPost = () => {
    if (!newPost.title || !newPost.description || !ymapRef.current) return;
    const id = crypto.randomUUID();
    const post: MutualAidPost = {
      ...(newPost as MutualAidPost),
      id,
      timestamp: Date.now(),
      type: newPost.type as 'request' | 'offer'
    };
    
    ymapRef.current.set(id, post);
    setIsAdding(false);
    setNewPost({ type: 'request', category: 'Food', title: '', description: '', contact: '' });
  };

  const deletePost = (id: string) => {
    ymapRef.current?.delete(id);
  };

  const clearAllPosts = () => {
    if (window.confirm("Delete ALL posts? This will propagate to all connected devices.")) {
      ymapRef.current?.clear();
      setIsSettingsOpen(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !ydocRef.current) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const update = new Uint8Array(arrayBuffer);
        // Apply the binary update to the current doc
        Y.applyUpdate(ydocRef.current!, update);
        alert(`Merged board state successfully.`);
      } catch (err) {
        alert('Failed to import board state.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExport = () => {
    if (!ydocRef.current) return;
    // Encode the entire document state as a binary update
    const update = Y.encodeStateAsUpdate(ydocRef.current);
    const blob = new Blob([update], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mutual-aid-state-${new Date().toISOString().split('T')[0]}.bin`;
    link.click();
  };

  const filteredPosts = posts
    .filter(p => filter === 'all' || p.type === filter)
    .filter(p => categoryFilter === 'all' || p.category === categoryFilter)
    .filter(p => 
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            Mutual Aid Board
            {peers > 0 ? (
              <span className="flex items-center gap-1 bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                <Wifi className="w-3 h-3" /> Live Sync ({peers})
              </span>
            ) : (
              <span className="flex items-center gap-1 bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold" title="No peers found on network">
                <WifiOff className="w-3 h-3" /> Offline
              </span>
            )}
          </h2>
          <p className="text-slate-500">Connect help requests with local offers. Automatic P2P sync active.</p>
        </div>
        <div className="flex gap-2">
           <button
            onClick={() => setIsSettingsOpen(true)}
            className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 p-2.5 rounded-2xl transition-colors relative"
            title="Board Settings"
          >
            <Settings className="w-5 h-5" />
            {!isSynced && <span className="absolute top-0 right-0 w-3 h-3 bg-amber-500 rounded-full border-2 border-white"></span>}
          </button>
          <button
            onClick={() => setIsAdding(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-6 rounded-2xl transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> New Post
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col xl:flex-row gap-4 xl:items-center justify-between bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 flex-1">
          <div className="flex bg-slate-100 p-1.5 rounded-2xl">
            {['all', 'request', 'offer'].map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t as any)}
                className={`px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                  filter === t ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t}s
              </button>
            ))}
          </div>
          
          <div className="relative">
             <select 
               value={categoryFilter}
               onChange={(e) => setCategoryFilter(e.target.value)}
               className="appearance-none bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold py-3.5 px-4 pr-10 rounded-2xl outline-none cursor-pointer transition-colors"
             >
               <option value="all">All Categories</option>
               {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
             </select>
             <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div className="relative w-full xl:w-72">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search posts..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-100 p-2.5 pl-11 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
      </div>

      {/* Posts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPosts.length === 0 ? (
          <div className="col-span-full py-20 text-center opacity-50">
            <Megaphone className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p className="text-lg font-medium text-slate-500">No active posts found.</p>
          </div>
        ) : (
          filteredPosts.map(post => (
            <PostCard key={post.id} post={post} onDelete={deletePost} />
          ))
        )}
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Board Settings</h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl space-y-3">
                <h4 className="font-bold text-sm text-slate-700 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-500" /> Auto-Delete
                </h4>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Enable cleanup</span>
                  <input 
                    type="checkbox" 
                    checked={isAutoDeleteEnabled} 
                    onChange={(e) => setIsAutoDeleteEnabled(e.target.checked)}
                    className="w-5 h-5 accent-emerald-500"
                  />
                </div>
                {isAutoDeleteEnabled && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">Delete posts older than</span>
                    <input 
                      type="number" 
                      value={autoDeleteHours}
                      onChange={(e) => setAutoDeleteHours(Number(e.target.value))}
                      className="w-16 p-1 text-center bg-white border rounded-lg text-sm"
                    />
                    <span className="text-sm text-slate-500">hours</span>
                  </div>
                )}
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl space-y-3">
                <h4 className="font-bold text-sm text-slate-700 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-blue-500" /> Sneakernet Sync
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Export the full database state as a binary file to transfer to offline devices.
                  Uses CRDTs to merge changes intelligently without conflict.
                </p>
                <div className="flex gap-2">
                  <button onClick={handleExport} className="flex-1 bg-white border border-slate-200 text-slate-600 py-2 rounded-xl text-xs font-bold hover:bg-slate-50 flex items-center justify-center gap-1">
                    <Download className="w-3 h-3" /> Export State
                  </button>
                  <label className="flex-1 bg-white border border-slate-200 text-slate-600 py-2 rounded-xl text-xs font-bold hover:bg-slate-50 flex items-center justify-center gap-1 cursor-pointer">
                    <Upload className="w-3 h-3" /> Import File
                    <input type="file" className="hidden" onChange={handleImport} accept=".bin" />
                  </label>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-slate-100 flex items-start gap-3">
                 <Signal className="w-5 h-5 text-slate-400 mt-1" />
                 <div>
                   <p className="text-xs font-bold text-slate-700">Network Sync Status</p>
                   <p className="text-[10px] text-slate-400 mb-1">
                     We use a public signaling server to connect peers. Data is encrypted and shared directly (P2P).
                   </p>
                   <div className="flex items-center gap-2 mt-2">
                     <span className={`w-2 h-2 rounded-full ${peers > 0 ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                     <span className="text-xs font-bold text-slate-600">{peers} Peers Connected</span>
                   </div>
                 </div>
              </div>

              <hr className="border-slate-100" />

              <button 
                onClick={clearAllPosts}
                className="w-full bg-red-50 hover:bg-red-100 text-red-600 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <AlertTriangle className="w-4 h-4" /> Delete All Posts
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Post Modal */}
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-8 shadow-2xl relative overflow-hidden">
            <h3 className="text-2xl font-bold text-slate-900 mb-6">Create New Post</h3>
            <div className="space-y-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setNewPost({ ...newPost, type: 'request' })}
                  className={`flex-1 py-3 rounded-xl font-bold border transition-all ${
                    newPost.type === 'request' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}
                >
                  Help Request
                </button>
                <button
                  onClick={() => setNewPost({ ...newPost, type: 'offer' })}
                  className={`flex-1 py-3 rounded-xl font-bold border transition-all ${
                    newPost.type === 'offer' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}
                >
                  Help Offer
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1 tracking-widest">Category</label>
                  <select
                    value={newPost.category}
                    onChange={e => setNewPost({ ...newPost, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1 tracking-widest">Contact Info</label>
                  <input
                    type="text"
                    placeholder="Signal / Phone"
                    value={newPost.contact}
                    onChange={e => setNewPost({ ...newPost, contact: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1 tracking-widest">Title</label>
                <input
                  type="text"
                  placeholder="Short summary of need or offer"
                  value={newPost.title}
                  onChange={e => setNewPost({ ...newPost, title: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1 tracking-widest">Description</label>
                <textarea
                  rows={3}
                  placeholder="Provide more details..."
                  value={newPost.description}
                  onChange={e => setNewPost({ ...newPost, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  onClick={() => setIsAdding(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addPost}
                  className="flex-1 bg-slate-900 hover:bg-black text-white py-3 rounded-xl font-bold transition-colors shadow-lg"
                >
                  Post to Board
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PostCard: React.FC<{ post: MutualAidPost; onDelete: (id: string) => void }> = ({ post, onDelete }) => {
  const [showContact, setShowContact] = useState(false);
  const isRequest = post.type === 'request';
  
  // Calculate relative time
  const timeAgo = (timestamp: number) => {
    const minutes = Math.floor((Date.now() - timestamp) / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 hover:shadow-xl hover:shadow-slate-200/50 transition-all group flex flex-col h-full">
      <div className="flex justify-between items-start mb-4">
        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
          isRequest ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
        }`}>
          {isRequest ? 'Requesting' : 'Offering'}
        </span>
        <div className="flex items-center gap-2">
           <span className="text-xs font-medium text-slate-400">{timeAgo(post.timestamp)}</span>
           <button onClick={() => onDelete(post.id)} className="text-slate-200 hover:text-red-400 transition-colors">
              <Trash2 className="w-4 h-4" />
           </button>
        </div>
      </div>
      
      <div className="mb-4 flex-1">
        <h4 className="font-bold text-slate-900 text-lg leading-tight mb-2">{post.title}</h4>
        <div className="flex items-center gap-2 mb-3">
           <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{post.category}</span>
        </div>
        <p className="text-slate-600 text-sm leading-relaxed">{post.description}</p>
      </div>

      <div className="pt-4 border-t border-slate-50 mt-auto">
        {!showContact ? (
          <button 
            onClick={() => setShowContact(true)}
            className={`w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
               isRequest 
               ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' 
               : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
            }`}
          >
            <Phone className="w-4 h-4" /> Contact
          </button>
        ) : (
          <div className="bg-slate-900 text-white p-3 rounded-xl text-center animate-in zoom-in duration-200">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Contact Info</p>
            <p className="font-mono text-sm selection:bg-emerald-500 selection:text-white">{post.contact}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MutualAid;
