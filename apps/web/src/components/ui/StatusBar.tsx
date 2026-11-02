import React from 'react';
import { Layers, GitCommit, Info, Users } from 'lucide-react';
import type { WorkbenchMode, WorkbenchFaultPayload } from '@webboard/contracts';
import type { PresenceMember } from '../../types/telemetry.js';

interface StatusBarProps {
  mode: WorkbenchMode;
  fault: WorkbenchFaultPayload | null;
  componentCount: number;
  wireCount: number;
  presenceMembers?: PresenceMember[];
  onOpenTeamModal?: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  mode,
  fault,
  componentCount,
  wireCount,
  presenceMembers,
  onOpenTeamModal,
}) => {
  const isSimulating = mode === 'MODO_SIMULACAO';

  return (
    <footer className="absolute bottom-3 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
      {/* Counters & Circuit Metrics */}
      <div className="flex items-center gap-3 bg-[#1a1a1e]/90 backdrop-blur border border-[#2e2e34] px-3.5 py-1.5 rounded-lg shadow-lg pointer-events-auto text-xs text-[#a1a1aa]">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-zinc-400" />
          <span>Componentes: <strong className="text-white">{componentCount}</strong></span>
        </div>
        <div className="h-3 w-px bg-[#2e2e34]" />
        <div className="flex items-center gap-1.5">
          <GitCommit className="w-3.5 h-3.5 text-zinc-400" />
          <span>Fios: <strong className="text-white">{wireCount}</strong></span>
        </div>

        {/* Eixo D: Indicador Interativo de Membros da Equipe Conectados */}
        {presenceMembers && presenceMembers.length > 0 && (
          <>
            <div className="h-3 w-px bg-[#2e2e34]" />
            <button
              type="button"
              onClick={onOpenTeamModal}
              className="flex items-center gap-1.5 text-sky-400 hover:text-white font-medium px-2 py-0.5 rounded bg-sky-950/50 hover:bg-sky-900/80 border border-sky-800/60 transition-all cursor-pointer group"
              title="Clique para ver quem está na equipe, seus status e convidar colegas"
            >
              <Users className="w-3.5 h-3.5 text-sky-400 group-hover:scale-110 transition-transform" />
              <span>
                Equipe: <strong className="text-sky-300 underline underline-offset-2">{presenceMembers.length} online</strong>
              </span>
            </button>
          </>
        )}
      </div>

      {/* Alerta de Falha se houver */}
      {fault && (
        <div className="bg-rose-950/90 backdrop-blur border border-rose-500/50 px-4 py-1.5 rounded-lg shadow-xl pointer-events-auto text-xs font-semibold text-rose-300 flex items-center gap-2">
          <span>⚠️ {fault.message}</span>
        </div>
      )}

      {/* Navigation & Interaction Hints */}
      <div className="flex items-center gap-2 bg-[#1a1a1e]/90 backdrop-blur border border-[#2e2e34] px-3.5 py-1.5 rounded-lg shadow-lg pointer-events-auto text-[11px] text-[#71717a]">
        <Info className="w-3.5 h-3.5 text-[#00e599]" />
        <span>
          {isSimulating
            ? 'Topologia travada em simulação. Interaja apenas com entradas físicas.'
            : 'Espaço + Arraste para Pan • Scroll para Zoom • Clique no pino para ligar fios • Snap 20px'}
        </span>
      </div>
    </footer>
  );
};
