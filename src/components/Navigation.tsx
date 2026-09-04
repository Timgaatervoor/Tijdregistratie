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
} from 'lucide-react';

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
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  conflictCount,
  attentionCount,
}) => {
  const tabs = [
    { id: 'event' as const, label: 'Event', icon: LayoutDashboard },
    { id: 'participants' as const, label: 'Deelnemers', icon: Users },
    { id: 'waves' as const, label: 'Waves', icon: Layers },
    // Prominent live timing buttons (Req 93)
    { id: 'start' as const, label: 'START', icon: PlayCircle, prominent: true, color: 'emerald' },
    { id: 'shooting' as const, label: 'SCHIETEN', icon: Crosshair, prominent: true, color: 'blue' },
    { id: 'finish' as const, label: 'FINISH', icon: Flag, prominent: true, color: 'amber' },
    { id: 'live' as const, label: 'Live Bord', icon: Activity },
    { id: 'results' as const, label: 'Resultaten', icon: Trophy },
    {
      id: 'attention' as const,
      label: 'Problemen',
      icon: AlertTriangle,
      badge: conflictCount + attentionCount > 0 ? conflictCount + attentionCount : undefined,
      badgeColor: conflictCount > 0 ? 'bg-red-500' : 'bg-amber-500',
    },
    { id: 'backup' as const, label: 'Back-up & Herstel', icon: HardDriveDownload },
    { id: 'settings' as const, label: 'Instellingen', icon: Settings },
    { id: 'simulator' as const, label: 'Simulator & Tests', icon: FlaskConical },
  ];

  return (
    <nav className="bg-slate-900 border-b border-slate-800 px-2 sm:px-4 overflow-x-auto no-scrollbar">
      <div className="max-w-7xl mx-auto flex items-center gap-1 py-1.5 min-w-max">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          if (tab.prominent) {
            let activeClasses = '';
            if (tab.color === 'emerald') {
              activeClasses = isActive
                ? 'bg-emerald-500 text-slate-950 font-black shadow-lg shadow-emerald-500/30'
                : 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-900/60 font-bold';
            } else if (tab.color === 'blue') {
              activeClasses = isActive
                ? 'bg-blue-500 text-slate-950 font-black shadow-lg shadow-blue-500/30'
                : 'bg-blue-950/40 text-blue-300 border border-blue-500/40 hover:bg-blue-900/60 font-bold';
            } else if (tab.color === 'amber') {
              activeClasses = isActive
                ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/30'
                : 'bg-amber-950/40 text-amber-300 border border-amber-500/40 hover:bg-amber-900/60 font-bold';
            }

            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs tracking-wider uppercase transition mx-1 ${activeClasses}`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition whitespace-nowrap relative ${
                isActive
                  ? 'bg-slate-800 text-white font-semibold shadow-sm ring-1 ring-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold text-slate-950 ${tab.badgeColor}`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
