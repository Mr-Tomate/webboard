import React, { useState } from 'react';
import {
  Cpu,
  Radio,
  Lightbulb,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Plus,
  Lock
} from 'lucide-react';
import { COMPONENT_CATALOG } from '../../catalog/manifests.js';
import type { WorkbenchMode } from '@webboard/contracts';

interface CatalogSidebarProps {
  mode: WorkbenchMode;
  onAddComponent: (type: string) => void;
}

export const CatalogSidebar: React.FC<CatalogSidebarProps> = ({
  mode,
  onAddComponent
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isSimulating = mode === 'MODO_SIMULACAO';

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'MCU':
        return <Cpu className="w-4 h-4 text-cyan-400" />;
      case 'ACTUATOR':
        return <Lightbulb className="w-4 h-4 text-amber-400" />;
      case 'SENSOR':
        return <Radio className="w-4 h-4 text-emerald-400" />;
      case 'INPUT':
      case 'PASSIVE':
      default:
        return <Sliders className="w-4 h-4 text-indigo-400" />;
    }
  };

  const componentsList = Object.values(COMPONENT_CATALOG);

  return (
    <aside
      className={`absolute top-20 left-4 z-20 transition-all duration-300 ${
        isCollapsed ? 'w-12' : 'w-72'
      } bg-[#1a1a1e]/95 backdrop-blur border border-[#2e2e34] rounded-xl shadow-2xl flex flex-col max-h-[calc(100vh-140px)] overflow-hidden`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#2e2e34]">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs tracking-wider text-[#a1a1aa] uppercase">
              Componentes
            </span>
            {isSimulating && (
              <span title="Bloqueado em simulação (RN-BNC-01)">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
              </span>
            )}
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 rounded text-[#a1a1aa] hover:text-white hover:bg-[#26262c] transition-colors ml-auto cursor-pointer"
          title={isCollapsed ? 'Expandir catálogo' : 'Recolher catálogo'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Component List */}
      {!isCollapsed && (
        <div className="overflow-y-auto p-2 space-y-1.5 flex-1">
          {componentsList.map((comp) => (
            <div
              key={comp.id}
              onClick={() => !isSimulating && onAddComponent(comp.id)}
              className={`p-2.5 rounded-lg border transition-all flex items-center justify-between ${
                isSimulating
                  ? 'opacity-40 border-transparent bg-[#161619] cursor-not-allowed'
                  : 'border-[#26262c] bg-[#202025] hover:border-[#00e599]/60 hover:bg-[#25252b] cursor-pointer group'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-md bg-[#161619] border border-[#2e2e34]">
                  {getCategoryIcon(comp.category)}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-[#f4f4f5] truncate group-hover:text-[#00e599] transition-colors">
                    {comp.name}
                  </div>
                  <div className="text-[10px] text-[#71717a] flex items-center gap-1.5">
                    <span>{comp.category}</span>
                    <span>•</span>
                    <span>{comp.pins.length} pinos</span>
                  </div>
                </div>
              </div>

              {!isSimulating && (
                <div className="opacity-0 group-hover:opacity-100 p-1 rounded bg-[#00e599]/10 text-[#00e599] transition-opacity">
                  <Plus className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
};
