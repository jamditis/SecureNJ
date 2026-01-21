
import React, { useState, useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { IndexeddbPersistence } from 'y-indexeddb';
import { 
  ThumbsUp, 
  Hand, 
  PauseCircle, 
  XOctagon, 
  Plus, 
  Trash2, 
  Wifi, 
  WifiOff, 
  Archive,
  CheckCircle2
} from 'lucide-react';
import { Proposal, VoteType } from '../types';

const ROOM_NAME = 'consensus-v1';

const ConsensusBuilder: React.FC = () => {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [votes, setVotes] = useState<Record<string, Record<string, VoteType>>>({});
  const [peers, setPeers] = useState(0);
  const [myId, setMyId] = useState('');
  const [newProposalText, setNewProposalText] = useState('');

  const ydocRef = useRef<Y.Doc | null>(null);
  const proposalsMapRef = useRef<Y.Map<Proposal> | null>(null);
  const votesMapRef = useRef<Y.Map<string> | null>(null); // Key: "proposalId:userId", Value: VoteType

  useEffect(() => {
    // Generate a persistent ID for this user's browser session
    let id = localStorage.getItem('consensus_user_id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('consensus_user_id', id);
    }
    setMyId(id);

    const ydoc = new Y.Doc();
    const proposalsMap = ydoc.getMap<Proposal>('proposals');
    const votesMap = ydoc.getMap<string>('votes'); // Stores simpler string values

    ydocRef.current = ydoc;
    proposalsMapRef.current = proposalsMap;
    votesMapRef.current = votesMap;

    const indexeddbProvider = new IndexeddbPersistence(ROOM_NAME, ydoc);
    const webrtcProvider = new WebrtcProvider(ROOM_NAME, ydoc, {
      signaling: ['wss://signaling.yjs.dev', 'wss://y-webrtc-signaling-eu.herokuapp.com']
    });

    webrtcProvider.on('peers', ({ webrtcPeers }: any) => {
      setPeers(webrtcPeers.size);
    });

    const updateState = () => {
      // Update Proposals
      const allProposals = Array.from(proposalsMap.values()) as Proposal[];
      setProposals(allProposals.sort((a, b) => b.timestamp - a.timestamp));

      // Update Votes
      // Structure: { proposalId: { userId: voteType } }
      const newVotes: Record<string, Record<string, VoteType>> = {};
      votesMap.forEach((voteType, key) => {
        const [propId, userId] = key.split(':');
        if (!newVotes[propId]) newVotes[propId] = {};
        newVotes[propId][userId] = voteType as VoteType;
      });
      setVotes(newVotes);
    };

    proposalsMap.observe(updateState);
    votesMap.observe(updateState);
    updateState();

    return () => {
      webrtcProvider.destroy();
      indexeddbProvider.destroy();
      ydoc.destroy();
    };
  }, []);

  const addProposal = () => {
    if (!newProposalText.trim() || !proposalsMapRef.current) return;
    const id = crypto.randomUUID();
    const proposal: Proposal = {
      id,
      text: newProposalText,
      timestamp: Date.now(),
      status: 'active'
    };
    proposalsMapRef.current.set(id, proposal);
    setNewProposalText('');
  };

  const castVote = (proposalId: string, type: VoteType) => {
    if (!votesMapRef.current) return;
    const key = `${proposalId}:${myId}`;
    // Toggle off if clicking same vote
    if (votes[proposalId]?.[myId] === type) {
        votesMapRef.current.delete(key);
    } else {
        votesMapRef.current.set(key, type);
    }
  };

  const deleteProposal = (id: string) => {
    proposalsMapRef.current?.delete(id);
    // Cleanup votes for this proposal
    if (votesMapRef.current) {
        const keysToDelete: string[] = [];
        votesMapRef.current.forEach((_, key) => {
            if (key.startsWith(id + ':')) keysToDelete.push(key);
        });
        ydocRef.current?.transact(() => {
            keysToDelete.forEach(k => votesMapRef.current?.delete(k));
        });
    }
  };

  const getVoteCounts = (proposalId: string) => {
    const proposalVotes = votes[proposalId] || {};
    const counts = { support: 0, reservations: 0, 'stand-aside': 0, block: 0, total: 0 };
    Object.values(proposalVotes).forEach(v => {
        counts[v]++;
        counts.total++;
    });
    return counts;
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            Consensus builder
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
          <p className="text-slate-500">Real-time democratic decision making and temperature checks.</p>
        </div>
      </div>

      {/* New Proposal Input */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex gap-4">
          <input 
            type="text" 
            value={newProposalText}
            onChange={(e) => setNewProposalText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addProposal()}
            placeholder="What is the proposal?"
            className="flex-1 bg-slate-50 border border-slate-200 p-4 rounded-xl text-lg outline-none focus:ring-2 focus:ring-slate-900/10"
          />
          <button 
            onClick={addProposal}
            className="bg-slate-900 hover:bg-black text-white px-6 rounded-xl font-bold transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> Propose
          </button>
        </div>
      </div>

      {/* Active Proposals */}
      <div className="space-y-6">
        {proposals.length === 0 ? (
          <div className="text-center py-20 opacity-50">
            <Archive className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p className="text-lg font-medium text-slate-500">No active proposals.</p>
          </div>
        ) : (
          proposals.map(prop => {
            const counts = getVoteCounts(prop.id);
            const myVote = votes[prop.id]?.[myId];
            
            return (
              <div key={prop.id} className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                <div className="flex justify-between items-start mb-6">
                  <h3 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">{prop.text}</h3>
                  <button onClick={() => deleteProposal(prop.id)} className="text-slate-300 hover:text-red-500 p-2">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                {/* Vote Visualization Bar */}
                <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex mb-2">
                    {counts.total > 0 && (
                        <>
                            <div style={{ width: `${(counts.support / counts.total) * 100}%` }} className="bg-emerald-500 h-full transition-all duration-500" />
                            <div style={{ width: `${(counts.reservations / counts.total) * 100}%` }} className="bg-yellow-400 h-full transition-all duration-500" />
                            <div style={{ width: `${(counts['stand-aside'] / counts.total) * 100}%` }} className="bg-blue-400 h-full transition-all duration-500" />
                            <div style={{ width: `${(counts.block / counts.total) * 100}%` }} className="bg-red-500 h-full transition-all duration-500" />
                        </>
                    )}
                </div>
                <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-wider mb-8">
                    <span>Total Votes: {counts.total}</span>
                    <span>Consensus Meter</span>
                </div>

                {/* Voting Buttons */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <VoteButton 
                        label="Strong Support" 
                        color="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                        activeColor="bg-emerald-500 text-white border-emerald-600 shadow-emerald-500/30"
                        icon={ThumbsUp} 
                        count={counts.support}
                        isActive={myVote === 'support'}
                        onClick={() => castVote(prop.id, 'support')}
                    />
                     <VoteButton 
                        label="Reservations" 
                        color="bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100"
                        activeColor="bg-yellow-400 text-white border-yellow-500 shadow-yellow-400/30"
                        icon={CheckCircle2} 
                        count={counts.reservations}
                        isActive={myVote === 'reservations'}
                        onClick={() => castVote(prop.id, 'reservations')}
                    />
                    <VoteButton 
                        label="Stand Aside" 
                        color="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                        activeColor="bg-blue-500 text-white border-blue-600 shadow-blue-500/30"
                        icon={Hand} 
                        count={counts['stand-aside']}
                        isActive={myVote === 'stand-aside'}
                        onClick={() => castVote(prop.id, 'stand-aside')}
                    />
                    <VoteButton 
                        label="Block" 
                        color="bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                        activeColor="bg-red-500 text-white border-red-600 shadow-red-500/30"
                        icon={XOctagon} 
                        count={counts.block}
                        isActive={myVote === 'block'}
                        onClick={() => castVote(prop.id, 'block')}
                    />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

interface VoteButtonProps {
    label: string;
    color: string;
    activeColor: string;
    icon: any;
    count: number;
    isActive: boolean;
    onClick: () => void;
}

const VoteButton: React.FC<VoteButtonProps> = ({ label, color, activeColor, icon: Icon, count, isActive, onClick }) => (
    <button 
        onClick={onClick}
        className={`relative p-4 rounded-xl border-2 font-bold transition-all flex flex-col items-center gap-2 ${isActive ? activeColor + ' shadow-lg transform scale-105' : color}`}
    >
        <Icon className="w-6 h-6" />
        <span className="text-sm">{label}</span>
        {count > 0 && (
            <span className="absolute top-2 right-2 text-xs bg-white/30 px-1.5 py-0.5 rounded-md backdrop-blur-sm">
                {count}
            </span>
        )}
    </button>
);

export default ConsensusBuilder;
