import { useEffect, useState, type ComponentType } from 'react';
import { Database, HardDrive, Languages, Menu, Shield, Users, X } from 'lucide-react';
import ConsensusBuilder from './components/ConsensusBuilder';
import Dashboard from './components/Dashboard';
import DeviceDialog from './components/DeviceDialog';
import EventCreator from './components/EventCreator';
import FamilyPlan from './components/FamilyPlan';
import LimitsPage from './components/LimitsPage';
import MutualAid from './components/MutualAid';
import PhoneTree from './components/PhoneTree';
import PhotoCleaner from './components/PhotoCleaner';
import ResourceSheet from './components/ResourceSheet';
import ResourcesPage from './components/ResourcesPage';
import RightsCard from './components/RightsCard';
import SecureShare from './components/SecureShare';
import SharePage from './components/SharePage';
import ShiftRoster from './components/ShiftRoster';
import Sightings from './components/Sightings';
import SpaceDialog from './components/SpaceDialog';
import StatusBoard from './components/StatusBoard';
import SupplyInventory from './components/SupplyInventory';
import TacticalWhiteboard from './components/TacticalWhiteboard';
import { Notice } from './components/ui';
import WitnessNotes from './components/WitnessNotes';
import { LOCALES, useI18n, type Locale } from './services/i18n';
import { readInvite } from './services/invite';
import { useSync } from './services/sync';
import { PAGES, SECTIONS, TOOLS, goToPage, readRoute } from './tools';
import type { ToolId } from './types';

const VIEWS: Record<Exclude<ToolId, 'dashboard' | 'secure-share'>, ComponentType> = {
  limits: LimitsPage,
  resources: ResourcesPage,
  share: SharePage,
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

export default function App() {
  const { t, locale, setLocale } = useI18n();
  const { space, peers, spaceFailed } = useSync();
  // An invite link opens the space dialog. The invite is then removed from the
  // address, so that it is not in the history or in a copied address.
  const [invite] = useState(() => {
    const found = readInvite(window.location.hash, window.location.protocol === 'https:');
    if (found) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/dashboard`);
    return found;
  });
  // The address holds the page, for example "#/phone-tree". A link to a page
  // then works, and so does the back button of the browser.
  const [route, setRoute] = useState(() => readRoute(window.location.hash));
  const activeTool = route.page;
  const setActiveTool = goToPage;
  useEffect(() => {
    const onHashChange = () => {
      setRoute(readRoute(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSpaceOpen, setIsSpaceOpen] = useState(invite !== null && space === null);
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
        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left text-sm font-medium transition-colors border ${activeTool === id ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'border-transparent hover:bg-slate-800 hover:text-white'}`}
      >
        <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
        {label}
      </button>
    </li>
  );
  const ActiveView = activeTool === 'dashboard' || activeTool === 'secure-share' ? null : VIEWS[activeTool];

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
        className={`no-print fixed inset-0 top-14 z-30 bg-slate-900 text-slate-300 transition-transform md:translate-x-0 md:static md:w-72 md:shrink-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
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
              onClick={() => setIsSpaceOpen(true)}
              className="w-full bg-slate-800 hover:bg-slate-700 rounded-xl p-4 text-left transition-colors"
            >
              <span className="flex items-center gap-2 text-white text-sm font-bold">
                {space ? <Users className="w-4 h-4 text-emerald-400" aria-hidden="true" /> : <HardDrive className="w-4 h-4 text-slate-400" aria-hidden="true" />}
                {space ? space.name : t('sync.localOnly')}
              </span>
              <span className="block text-xs text-slate-400 mt-1">{space ? t('nav.spacePeers', { count: peers }) : t('nav.spaceJoin')}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsDeviceOpen(true)}
              className="w-full flex items-center gap-2 px-4 py-2 rounded-xl text-left text-sm hover:bg-slate-800 hover:text-white transition-colors"
            >
              <Database className="w-4 h-4" aria-hidden="true" /> {t('device.open')}
            </button>
            <label className="flex items-center gap-2 px-4 text-sm">
              <Languages className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="sr-only">{t('language.label')}</span>
              <select
                value={locale}
                onChange={(event) => setLocale(event.target.value as Locale)}
                className="flex-1 bg-slate-800 text-white rounded-lg px-2 py-1.5 text-sm"
              >
                {(Object.keys(LOCALES) as Locale[]).map((code) => (
                  <option key={code} value={code} lang={code}>
                    {LOCALES[code].label}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs leading-relaxed text-slate-500">{t('nav.privacy')}</p>
          </div>
        </div>
      </nav>

      <main className="flex-1 min-w-0 p-4 md:p-10 lg:p-16">
        <div className="max-w-5xl mx-auto space-y-6">
          {spaceFailed && <Notice tone="error">{t('sync.spaceFailed')}</Notice>}
          {activeTool === 'secure-share' ? (
            <SecureShare key={route.payload} lockedFromLink={route.payload} />
          ) : ActiveView ? (
            <ActiveView />
          ) : (
            <Dashboard onSelectTool={setActiveTool} onOpenSpace={() => setIsSpaceOpen(true)} />
          )}
        </div>
      </main>

      {isSpaceOpen && <SpaceDialog onClose={() => setIsSpaceOpen(false)} invite={space ? null : invite} />}
      {isDeviceOpen && <DeviceDialog onClose={() => setIsDeviceOpen(false)} />}
    </div>
  );
}
