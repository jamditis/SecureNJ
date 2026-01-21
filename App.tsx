
import React, { useState } from 'react';
import { 
  Shield, 
  Calendar, 
  Users, 
  HelpingHand, 
  FileLock, 
  Menu, 
  X,
  LayoutDashboard,
  Info,
  Siren,
  ThumbsUp,
  PenTool,
  UserCheck
} from 'lucide-react';
import { ToolId } from './types';
import Dashboard from './components/Dashboard';
import EventCreator from './components/EventCreator';
import PhoneTree from './components/PhoneTree';
import MutualAid from './components/MutualAid';
import SecureShare from './components/SecureShare';
import Sightings from './components/Sightings';
import ConsensusBuilder from './components/ConsensusBuilder';
import TacticalWhiteboard from './components/TacticalWhiteboard';
import StatusBoard from './components/StatusBoard';

const App: React.FC = () => {
  const [activeTool, setActiveTool] = useState<ToolId>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'safety-alerts', label: 'Safety alerts', icon: Siren },
    { id: 'status-board', label: 'Group check-in', icon: UserCheck },
    { id: 'consensus', label: 'Consensus builder', icon: ThumbsUp },
    { id: 'whiteboard', label: 'Tactical whiteboard', icon: PenTool },
    { id: 'event-creator', label: 'Event coordinator', icon: Calendar },
    { id: 'phone-tree', label: 'Phone tree', icon: Users },
    { id: 'mutual-aid', label: 'Mutual aid board', icon: HelpingHand },
    { id: 'secure-share', label: 'Secure file share', icon: FileLock },
  ] as const;

  const renderTool = () => {
    switch (activeTool) {
      case 'dashboard': return <Dashboard onSelectTool={setActiveTool} />;
      case 'event-creator': return <EventCreator />;
      case 'phone-tree': return <PhoneTree />;
      case 'mutual-aid': return <MutualAid />;
      case 'secure-share': return <SecureShare />;
      case 'safety-alerts': return <Sightings />;
      case 'consensus': return <ConsensusBuilder />;
      case 'whiteboard': return <TacticalWhiteboard />;
      case 'status-board': return <StatusBoard />;
      default: return <Dashboard onSelectTool={setActiveTool} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-emerald-400" />
          <span className="font-bold tracking-tight">Resilience Toolkit</span>
        </div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
          {isSidebarOpen ? <X /> : <Menu />}
        </button>
      </header>

      {/* Sidebar Navigation */}
      <nav className={`
        fixed inset-0 z-40 bg-slate-900 text-slate-300 transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:w-72 md:block
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 h-full flex flex-col">
          <div className="hidden md:flex items-center gap-3 mb-10">
            <div className="bg-emerald-500/10 p-2 rounded-lg">
              <Shield className="w-6 h-6 text-emerald-400" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Resilience Toolkit</h1>
          </div>

          <div className="space-y-1 overflow-y-auto max-h-[calc(100vh-200px)]">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTool(item.id as ToolId);
                    setIsSidebarOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-left
                    ${activeTool === item.id 
                      ? 'bg-emerald-500/10 text-emerald-400 shadow-sm border border-emerald-500/20' 
                      : 'hover:bg-slate-800 hover:text-white'}
                  `}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${activeTool === item.id ? 'text-emerald-400' : 'text-slate-500 group-hover:text-emerald-400'}`} />
                  <span className="font-medium text-sm">{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-auto pt-10 border-t border-slate-800">
            <div className="bg-slate-800/50 rounded-xl p-4 text-left">
              <div className="flex items-center gap-2 text-white mb-2">
                <Info className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold uppercase tracking-wider">Privacy First</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-400">
                All tools work locally. No data leaves your browser. No accounts, no central servers, no tracking.
              </p>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-10 lg:p-16">
        <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
          {renderTool()}
        </div>
      </main>
    </div>
  );
};

export default App;
