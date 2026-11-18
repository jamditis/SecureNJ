import { useEffect, useState, type ComponentType } from 'react';
import { Database, Menu, Shield, X } from 'lucide-react';
import ConsensusBuilder from './components/ConsensusBuilder';
import Dashboard from './components/Dashboard';
import DeviceDialog from './components/DeviceDialog';
import EventCreator from './components/EventCreator';
import FamilyPlan from './components/FamilyPlan';
import LanguageSwitch from './components/LanguageSwitch';
import LimitsPage from './components/LimitsPage';
import LockFile from './components/LockFile';
import MutualAid from './components/MutualAid';
import PhoneTree from './components/PhoneTree';
import PhotoCleaner from './components/PhotoCleaner';
import ResourceSheet from './components/ResourceSheet';
import ResourcesPage from './components/ResourcesPage';
import RoomGate from './components/RoomGate';
import RightsCard from './components/RightsCard';
import SecureShare from './components/SecureShare';
import SharePage from './components/SharePage';
import ShiftRoster from './components/ShiftRoster';
import Sightings from './components/Sightings';
import StatusBoard from './components/StatusBoard';
import SupplyInventory from './components/SupplyInventory';
import TacticalWhiteboard from './components/TacticalWhiteboard';
import { Notice } from './components/ui';
import WitnessNotes from './components/WitnessNotes';
import { useI18n } from './services/i18n';
import { readInvite, type Invite } from './services/invite';
import { ToolScope, useRooms } from './services/sync';
import { hasUnsavedWork } from './services/unsaved';
import { PAGES, SECTIONS, TOOLS, goToPage, readRoute } from './tools';
import type { ToolId } from './types';

const VIEWS: Record<Exclude<ToolId, 'dashboard' | 'secure-share'>, ComponentType> = {
  limits: LimitsPage,
  resources: ResourcesPage,
  share: SharePage,
  'lock-file': LockFile,
  'event-creator': EventCreator,
  'rights-card': RightsCard,
  'family-plan': FamilyPlan,
  'phone-tree': PhoneTree,
  'witness-notes': WitnessNotes,
  'photo-cleaner': PhotoCleaner,
  'resource-sheet': ResourceSheet,
  'safety-alerts': Sightings,
  'status-board': StatusBoard,
  'mutual-aid': MutualAid,
  consensus: ConsensusBuilder,
  whiteboard: TacticalWhiteboard,
  'shift-roster': ShiftRoster,
  'supply-inventory': SupplyInventory,
};

interface PageProps {
  id: ToolId;
  /** The part of the address after the page, for example locked text in a link. */
  payload: string;
  title: string;
  /** True for a tool that has a room. */
  shared: boolean;
  onSelectTool: (id: ToolId) => void;
}

/** The content of one page, with the data scope that the page needs. */
function Page({ id, payload, title, shared, onSelectTool }: PageProps) {
  if (id === 'dashboard') return <Dashboard onSelectTool={onSelectTool} />;
  if (id === 'secure-share') return <SecureShare key={payload} lockedFromLink={payload} />;
  const View = VIEWS[id];
  if (id === 'limits' || id === 'resources' || id === 'share') return <View />;
  if (shared) {
    // Each shared tool has its own room. The key gives each tool a new form.
    return (
      <RoomGate key={id} tool={id} title={title}>
        <View />
      </RoomGate>
    );
  }
  return (
    <ToolScope tool={id}>
      <View />
    </ToolScope>
  );
}

export default function App() {
  const { t } = useI18n();
  const { setLastRoom } = useRooms();
  const [invite, setInvite] = useState<Invite | null>(null);
  // The address holds the page, for example "#/phone-tree". A link to a page
  // then works, and so does the back button of the browser.
  const [route, setRoute] = useState(() => readRoute(window.location.hash));
  const activeTool = route.page;
  const setActiveTool = goToPage;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  useEffect(() => {
    const onAddress = () => {
      // An invite link can arrive at any time, also in a tab that is open. The
      // invite fills the form of each room, and it is removed from the address
      // so that it is not in a copied address. The member still types the passphrase.
      const found = readInvite(window.location.hash, window.location.protocol === 'https:');
      if (found) {
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/dashboard`);
        setInvite(found);
        setLastRoom(found);
      }
      const next = readRoute(window.location.hash);
      // Each change of page comes through here: a button, a link, the back button.
      if (next.page !== route.page && hasUnsavedWork() && !window.confirm(t('nav.unsavedConfirm'))) {
        // Go to the page again. This adds an entry to the history, so the back button still works.
        window.location.hash = `#/${route.page}`;
        return;
      }
      if (next.page !== route.page || next.payload !== route.payload) {
        setRoute(next);
        window.scrollTo(0, 0);
      }
    };
    onAddress();
    window.addEventListener('hashchange', onAddress);
    return () => window.removeEventListener('hashchange', onAddress);
  }, [route, t, setLastRoom]);
  const [isDeviceOpen, setIsDeviceOpen] = useState(false);

  const navButton = (id: ToolId, label: string, Icon: ComponentType<{ className?: string }>) => (
    <li key={id}>
      <button
        type="button"
        aria-current={activeTool === id ? 'page' : undefined}
        onClick={() => {
          setActiveTool(id);
          setIsSidebarOpen(false);
        }}
        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-start text-sm font-medium transition-colors border ${activeTool === id ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'border-transparent hover:bg-slate-800 hover:text-white'}`}
      >
        <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
        {label}
      </button>
    </li>
  );
  const activeInfo = TOOLS.find((tool) => tool.id === activeTool);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      <header className="no-print md:hidden bg-slate-900 text-white p-4 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-emerald-400" aria-hidden="true" />
          <span className="font-bold tracking-tight">{t('app.name')}</span>
        </div>
        <button type="button" aria-label={t('nav.menu')} aria-expanded={isSidebarOpen} onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
          {isSidebarOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </header>

      <nav
        aria-label={t('nav.label')}
        className={`no-print fixed inset-0 top-14 z-30 bg-slate-900 text-slate-300 transition-transform md:translate-x-0 md:rtl:translate-x-0 md:sticky md:top-0 md:h-screen md:w-72 md:shrink-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full'}`}
      >
        <div className="p-6 h-full flex flex-col gap-6 overflow-y-auto">
          <div className="hidden md:flex items-center gap-3">
            <div className="bg-emerald-500/10 p-2 rounded-lg">
              <Shield className="w-6 h-6 text-emerald-400" aria-hidden="true" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">{t('app.name')}</h1>
          </div>

          <ul className="space-y-1">{PAGES.map((page) => navButton(page.id, t(page.title), page.icon))}</ul>
          {SECTIONS.map((section) => (
            <div key={section.id}>
              <h2 className="px-4 mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">{t(section.title)}</h2>
              <ul className="space-y-1">
                {TOOLS.filter((tool) => tool.section === section.id).map((tool) => navButton(tool.id, t(tool.title), tool.icon))}
              </ul>
            </div>
          ))}

          <div className="mt-auto space-y-3">
            <button
              type="button"
              onClick={() => setIsDeviceOpen(true)}
              className="w-full flex items-center gap-2 px-4 py-2 rounded-xl text-start text-sm hover:bg-slate-800 hover:text-white transition-colors"
            >
              <Database className="w-4 h-4" aria-hidden="true" /> {t('device.open')}
            </button>
            <LanguageSwitch />
            <p className="text-xs leading-relaxed text-slate-500">{t('nav.privacy')}</p>
          </div>
        </div>
      </nav>

      {/* Spell check can send what a person types to a service. The page about limits says that it is off. */}
      <main spellCheck={false} autoCorrect="off" className="flex-1 min-w-0 p-4 md:p-10 lg:p-16">
        <div className="max-w-5xl mx-auto space-y-6">
          {invite && activeTool === 'dashboard' && <Notice tone="warning">{t('invite.received', { name: invite.name })}</Notice>}
          <Page id={activeTool} payload={route.payload} title={activeInfo ? t(activeInfo.title) : ''} shared={activeInfo?.scope === 'shared'} onSelectTool={setActiveTool} />
        </div>
      </main>

      {isDeviceOpen && <DeviceDialog onClose={() => setIsDeviceOpen(false)} />}
    </div>
  );
}
