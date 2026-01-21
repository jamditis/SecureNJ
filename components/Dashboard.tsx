
import React from 'react';
import { ToolId } from '../types';
import { 
  Calendar, 
  Users, 
  HelpingHand, 
  FileLock, 
  ArrowRight, 
  Zap, 
  CloudOff, 
  Lock, 
  Siren, 
  ThumbsUp, 
  PenTool, 
  UserCheck 
} from 'lucide-react';

interface DashboardProps {
  onSelectTool: (id: ToolId) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onSelectTool }) => {
  const tools = [
    {
      id: 'safety-alerts',
      title: 'Safety alerts',
      desc: 'Securely report and map sightings of enforcement activity in real-time to warn others.',
      icon: Siren,
      color: 'bg-red-500',
    },
    {
      id: 'status-board',
      title: 'Group check-in',
      desc: 'Live status dashboard for affinity groups to signal safety, arrests, or need for support.',
      icon: UserCheck,
      color: 'bg-violet-500',
    },
    {
      id: 'consensus',
      title: 'Consensus builder',
      desc: 'Run digital general assemblies with real-time temperature checks and proposal voting.',
      icon: ThumbsUp,
      color: 'bg-pink-500',
    },
    {
      id: 'whiteboard',
      title: 'Tactical whiteboard',
      desc: 'Collaborative canvas for planning routes, site maps, and formations.',
      icon: PenTool,
      color: 'bg-cyan-500',
    },
    {
      id: 'event-creator',
      title: 'Offline event coordinator',
      desc: 'Generate encrypted static HTML pages for sharing event details via Signal or email.',
      icon: Calendar,
      color: 'bg-blue-500',
    },
    {
      id: 'phone-tree',
      title: 'Emergency phone tree',
      desc: 'Build resilient communication networks where each person only knows their direct contacts.',
      icon: Users,
      color: 'bg-emerald-500',
    },
    {
      id: 'mutual-aid',
      title: 'Mutual aid board',
      desc: 'Post help requests and offers locally without a central database of participants.',
      icon: HelpingHand,
      color: 'bg-amber-500',
    },
    {
      id: 'secure-share',
      title: 'Secure file share',
      desc: 'Encrypt sensitive documents for "Sneakernet" sharing via USB or local transfer.',
      icon: FileLock,
      color: 'bg-indigo-500',
    },
  ];

  return (
    <div>
      <div className="mb-12">
        <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">
          Tools for local resilience
        </h2>
        <p className="text-lg text-slate-600 max-w-2xl leading-relaxed">
          High-privacy, zero-infrastructure tools for community organizations, legal aid groups, and local mutual aid networks. 
          Everything runs on your device.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onSelectTool(tool.id as ToolId)}
            className="group relative flex flex-col p-8 bg-white border border-slate-200 rounded-3xl text-left transition-all hover:shadow-2xl hover:shadow-emerald-500/10 hover:border-emerald-500/30 hover:-translate-y-1"
          >
            <div className={`${tool.color} w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform`}>
              <tool.icon className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-emerald-600 transition-colors">{tool.title}</h3>
            <p className="text-slate-600 mb-6 flex-1 leading-relaxed">{tool.desc}</p>
            <div className="flex items-center text-sm font-bold text-slate-400 group-hover:text-emerald-500 uppercase tracking-widest gap-2">
              Launch tool <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </div>
          </button>
        ))}
      </div>

      <div className="bg-slate-900 rounded-[2.5rem] p-8 md:p-12 text-white relative overflow-hidden">
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-10">
          <div className="flex flex-col gap-4">
            <div className="bg-emerald-500/20 w-12 h-12 rounded-xl flex items-center justify-center">
              <CloudOff className="text-emerald-400" />
            </div>
            <h4 className="font-bold text-lg">Offline first</h4>
            <p className="text-slate-400 text-sm leading-relaxed">Tools function without internet connection. Data is stored in your browser's local storage.</p>
          </div>
          <div className="flex flex-col gap-4">
            <div className="bg-emerald-500/20 w-12 h-12 rounded-xl flex items-center justify-center">
              <Lock className="text-emerald-400" />
            </div>
            <h4 className="font-bold text-lg">Fully encrypted</h4>
            <p className="text-slate-400 text-sm leading-relaxed">All sensitive data is encrypted using your chosen passphrase before being exported or shared.</p>
          </div>
          <div className="flex flex-col gap-4">
            <div className="bg-emerald-500/20 w-12 h-12 rounded-xl flex items-center justify-center">
              <Zap className="text-emerald-400" />
            </div>
            <h4 className="font-bold text-lg">Clone & own</h4>
            <p className="text-slate-400 text-sm leading-relaxed">The code is fully open and portable. You can run it on any laptop or local server with no setup.</p>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2"></div>
      </div>
    </div>
  );
};

export default Dashboard;
