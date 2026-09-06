import React from 'react';
import {
  LayoutDashboard,
  Users,
  Layers,
  PlayCircle,
  Crosshair,
  Flag,
  Activity,
  Trophy,
  AlertTriangle,
  HardDriveDownload,
  Settings,
  FlaskConical,
  ChevronDown,
  Lock,
} from 'lucide-react';
import type { DeviceConfig, UserRole } from '../types';

export type ActiveTab =
  | 'event'
  | 'participants'
  | 'waves'
  | 'start'
  | 'shooting'
  | 'finish'
  | 'live'
  | 'results'
  | 'attention'
  | 'backup'
  | 'settings'
  | 'simulator';

interface NavigationProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  conflictCount: number;
  attentionCount: number;
  deviceConfig: DeviceConfig | null;
  isTestMode: boolean;
}

const lockedTabByRole: Record<UserRole, ActiveTab> = {
  ADMIN: 'event',
  RACE_DIRECTOR: 'event',
  REGISTRATION: 'participants',
  START_OPERATOR: 'start',
  SHOOTING_OPERATOR: 'shooting',
  FINISH_OPERATOR: 'finish',
  VIEWER: 'live',
};

export const getLockedTabForRole = (role: UserRole): ActiveTab => lockedTabByRole[role];

interface TabConfig {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: 'emerald' | 'blue' | 'amber';
}

const tabConfig: Record<ActiveTab, TabConfig> = {
  event: { label: 'Overzicht', icon: LayoutDashboard },
  participants: { label: 'Deelnemers', icon: Users },
  waves: { label: 'Startgroepen', icon: Layers },
  start: { label: 'Start', icon: PlayCircle, color: 'emerald' },
  shooting: { label: 'Schieten', icon: Crosshair, color: 'blue' },
  finish: { label: 'Finish', icon: Flag, color: 'amber' },
  live: { label: 'Live uitslagen', icon: Activity },
  results: { label: 'Einduitslagen', icon: Trophy },
  attention: { label: 'Controle', icon: AlertTriangle },
  backup: { label: 'Back-up & herstel', icon: HardDriveDownload },
  settings: { label: 'Instellingen', icon: Settings },
  simulator: { label: 'Tests', icon: FlaskConical },
};

const standardButtonClasses = (active: boolean) =>
  `flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
    active
      ? 'bg-slate-800 text-white shadow-sm ring-1 ring-slate-700'
      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
  }`;

const operationButtonClasses = (tab: ActiveTab, active: boolean) => {
  const color = tabConfig[tab].color;
  if (color === 'emerald') {
    return active
      ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30'
      : 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-900/60';
  }
  if (color === 'blue') {
    return active
      ? 'bg-blue-500 text-slate-950 shadow-lg shadow-blue-500/30'
      : 'bg-blue-950/40 text-blue-300 border border-blue-500/40 hover:bg-blue-900/60';
  }
  return active
    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30'
    : 'bg-amber-950/40 text-amber-300 border border-amber-500/40 hover:bg-amber-900/60';
};

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  conflictCount,
  attentionCount,
  deviceConfig,
  isTestMode,
}) => {
  const problemCount = conflictCount + attentionCount;
  const lockedTab = deviceConfig?.isLocked ? getLockedTabForRole(deviceConfig.role) : null;

  const renderTabButton = (tab: ActiveTab, operation = false) => {
    const item = tabConfig[tab];
    const Icon = item.icon;
    const isActive = activeTab === tab;
    return (
      <button
        key={tab}
        type="button"
        onClick={(event) => {
          onSelectTab(tab);
          event.currentTarget.closest('details')?.removeAttribute('open');
        }}
        aria-current={isActive ? 'page' : undefined}
        className={
          operation
            ? `flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition ${operationButtonClasses(tab, isActive)}`
            : standardButtonClasses(isActive)
        }
      >
        <Icon className={`w-4 h-4 ${!operation && isActive ? 'text-amber-400' : ''}`} />
        <span>{item.label}</span>
        {tab === 'attention' && problemCount > 0 && (
          <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black text-white bg-red-500">
            {problemCount}
          </span>
        )}
      </button>
    );
  };

  if (lockedTab) {
    return (
      <nav aria-label="Vergrendelde postnavigatie" className="bg-slate-900 border-b border-slate-800 px-3 sm:px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 py-2">
          {renderTabButton(lockedTab, ['start', 'shooting', 'finish'].includes(lockedTab))}
          <span className="flex items-center gap-1.5 text-[11px] text-amber-300 font-semibold">
            <Lock className="w-3.5 h-3.5" /> Toestel vergrendeld voor deze post
          </span>
        </div>
      </nav>
    );
  }

  const mobileTabs: ActiveTab[] = [
    'event',
    'participants',
    'waves',
    'start',
    'shooting',
    'finish',
    'live',
    'results',
    'attention',
    'backup',
    'settings',
    ...(isTestMode ? (['simulator'] as ActiveTab[]) : []),
  ];

  const renderMenu = (label: string, tabs: ActiveTab[]) => {
    const groupActive = tabs.includes(activeTab);
    return (
      <details className="relative group">
        <summary className={`${standardButtonClasses(groupActive)} cursor-pointer list-none`}>
          <span>{label}</span>
          <ChevronDown className="w-3.5 h-3.5 transition group-open:rotate-180" />
        </summary>
        <div className="absolute left-0 top-full mt-1 min-w-52 z-50 rounded-xl border border-slate-700 bg-slate-900 p-1.5 shadow-2xl">
          {tabs.map((tab) => renderTabButton(tab))}
        </div>
      </details>
    );
  };

  return (
    <nav aria-label="Hoofdnavigatie" className="bg-slate-900 border-b border-slate-800 px-3 sm:px-4">
      <div className="md:hidden max-w-7xl mx-auto py-2">
        <label htmlFor="mobile-main-navigation" className="sr-only">Open onderdeel</label>
        <select
          id="mobile-main-navigation"
          value={activeTab}
          onChange={(event) => onSelectTab(event.target.value as ActiveTab)}
          className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm font-bold text-white"
        >
          {mobileTabs.map((tab) => (
            <option key={tab} value={tab}>
              {tabConfig[tab].label}{tab === 'attention' && problemCount > 0 ? ` (${problemCount})` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="hidden md:flex max-w-7xl mx-auto items-center gap-1.5 py-1.5">
        {renderTabButton('event')}
        {renderMenu('Voorbereiding', ['participants', 'waves'])}
        <div className="h-6 w-px bg-slate-700 mx-1" aria-hidden="true" />
        {renderTabButton('start', true)}
        {renderTabButton('shooting', true)}
        {renderTabButton('finish', true)}
        <div className="h-6 w-px bg-slate-700 mx-1" aria-hidden="true" />
        {renderMenu('Uitslagen', ['live', 'results'])}
        {renderTabButton('attention')}
        <div className="ml-auto">
          {renderMenu('Beheer', ['backup', 'settings', ...(isTestMode ? (['simulator'] as ActiveTab[]) : [])])}
        </div>
      </div>
    </nav>
  );
};
