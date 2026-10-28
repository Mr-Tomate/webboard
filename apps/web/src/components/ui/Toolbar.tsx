import React from 'react';
import {
  Play,
  Square,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Trash2,
  AlertTriangle,
  RotateCcw,
  Zap,
  Code,
  GraduationCap,
  Monitor,
  Eye,
  Save,
  Send,
  Loader2
} from 'lucide-react';
import type { WorkbenchMode, WorkbenchFaultPayload, WireColor } from '@webboard/contracts';
import { WireColorPalette } from './WireColorPalette.js';

export type ActiveAppView = 'STUDENT_BENCH' | 'TEACHER_DASHBOARD';

interface ToolbarProps {
  mode: WorkbenchMode;
  fault: WorkbenchFaultPayload | null;
  scale: number;
  hasSelection: boolean;
  hasSelectedWire: boolean;
  activeWireColor: WireColor;
  isCodePanelOpen: boolean;
  currentView: ActiveAppView;
  isMirrorMode?: boolean;
  isSaving?: boolean;
  isSubmitting?: boolean;
  onSelectWireColor: (color: WireColor) => void;
  onToggleCodePanel: () => void;
  onToggleView: () => void;
  onExitMirrorMode?: () => void;
  onStartSimulation: () => void;
  onStopSimulation: () => void;
  onSaveWorkspace: () => void;
  onSubmitChallenge: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onDeleteSelected: () => void;
  onClearWorkbench: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  mode,
  fault,
  scale,
  hasSelection,
  hasSelectedWire,
  activeWireColor,
  isCodePanelOpen,
  currentView,
  isMirrorMode = false,
  isSaving = false,
  isSubmitting = false,
  onSelectWireColor,
  onToggleCodePanel,
  onToggleView,
  onExitMirrorMode,
  onStartSimulation,
  onStopSimulation,
  onSaveWorkspace,
  onSubmitChallenge,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onDeleteSelected,
  onClearWorkbench
}) => {
  const isSimulating = mode === 'MODO_SIMULACAO';
  const isFault = mode === 'ESTADO_FALHA_ENG';

  return (
    <header className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
      {/* Brand & Mode Status */}
      <div className="flex items-center gap-3 bg-[#1a1a1e]/90 backdrop-blur border border-[#2e2e34] px-4 py-2 rounded-lg shadow-xl pointer-events-auto">
        <div className="flex items-center gap-2 font-bold text-sm tracking-wide text-[#00e599]">
          <Zap className="w-5 h-5 fill-[#00e599]" />
          <span>WEBBOARD</span>
        </div>

        <div className="h-4 w-px bg-[#2e2e34]" />

        {/* View Switcher Button (Aluno vs Professor) */}
        <button
          onClick={onToggleView}
          title="Alternar entre Bancada do Aluno e Painel Panóptico do Professor"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#26262c] hover:bg-[#323238] text-zinc-200 border border-[#3f3f46] transition-colors cursor-pointer"
        >
          {currentView === 'STUDENT_BENCH' ? (
            <>
              <GraduationCap className="w-3.5 h-3.5 text-amber-400" />
              <span>Painel Docente</span>
            </>
          ) : (
            <>
              <Monitor className="w-3.5 h-3.5 text-[#00e599]" />
              <span>Bancada Interativa</span>
            </>
          )}
        </button>

        {/* Badge de Modo */}
        {currentView === 'STUDENT_BENCH' && (
          <div className="flex items-center gap-2">
            {isMirrorMode ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-950/80 text-sky-400 border border-sky-500/30">
                <Eye className="w-3.5 h-3.5" />
                MODO ESPELHO (VIEW-ONLY • RN-PED-01)
                {onExitMirrorMode && (
                  <button
                    onClick={onExitMirrorMode}
                    className="ml-1 underline text-sky-300 hover:text-white cursor-pointer"
                  >
                    Sair
                  </button>
                )}
              </span>
            ) : isSimulating ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                SIMULAÇÃO ENERGIZADA
              </span>
            ) : isFault ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950/80 text-rose-400 border border-rose-500/30">
                <AlertTriangle className="w-3.5 h-3.5" />
                FALHA ELÉTRICA DETECTADA
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#242429] text-[#a1a1aa] border border-[#2e2e34]">
                <span className="w-2 h-2 rounded-full bg-zinc-500" />
                EDIÇÃO (Desenergizado)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Center Controls (Visible in Student Bench mode) */}
      {currentView === 'STUDENT_BENCH' && (
        <div className="flex items-center gap-2 pointer-events-auto">
          {!isSimulating && !isMirrorMode && (
            <WireColorPalette
              activeColor={activeWireColor}
              hasSelectedWire={hasSelectedWire}
              onSelectColor={onSelectWireColor}
            />
          )}

          <div className="flex items-center gap-2 bg-[#1a1a1e]/90 backdrop-blur border border-[#2e2e34] p-1.5 rounded-lg shadow-xl">
            {!isSimulating ? (
              <button
                onClick={onStartSimulation}
                disabled={isMirrorMode}
                className="flex items-center gap-2 px-4 py-2 rounded-md font-semibold text-xs tracking-wide bg-[#00e599] hover:bg-[#00c985] disabled:opacity-40 text-black transition-all shadow-md active:translate-y-0.5 cursor-pointer disabled:cursor-not-allowed"
              >
                <Play className="w-4 h-4 fill-black" />
                <span>ENERGIZAR BANCADA</span>
              </button>
            ) : (
              <button
                onClick={onStopSimulation}
                className="flex items-center gap-2 px-4 py-2 rounded-md font-semibold text-xs tracking-wide bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md active:translate-y-0.5 cursor-pointer"
              >
                <Square className="w-4 h-4 fill-white" />
                <span>DESLIGAR (PARAR)</span>
              </button>
            )}

            <div className="h-5 w-px bg-[#2e2e34] my-auto mx-1" />

            {/* Salvar na Nuvem */}
            <button
              onClick={onSaveWorkspace}
              disabled={isMirrorMode || isSaving}
              title="Salvar bancada na nuvem (Fastify API)"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-zinc-300 hover:text-white hover:bg-[#25252b] transition-colors cursor-pointer text-xs font-semibold disabled:opacity-40"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Salvar</span>
            </button>

            {/* Submeter Desafio */}
            <button
              onClick={onSubmitChallenge}
              disabled={isMirrorMode || isSubmitting}
              title="Submeter snapshot para auto-avaliação"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer text-xs font-bold disabled:opacity-40"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>Submeter</span>
            </button>

            <div className="h-5 w-px bg-[#2e2e34] my-auto mx-1" />

            {/* Delete Selection */}
            <button
              onClick={onDeleteSelected}
              disabled={!hasSelection || isSimulating || isMirrorMode}
              title="Excluir item selecionado (Delete)"
              className="p-2 rounded-md text-[#a1a1aa] hover:text-rose-400 hover:bg-[#25252b] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#a1a1aa] transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Clear Circuit */}
            <button
              onClick={onClearWorkbench}
              disabled={isSimulating || isMirrorMode}
              title="Limpar bancada"
              className="p-2 rounded-md text-[#a1a1aa] hover:text-white hover:bg-[#25252b] disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Right Controls */}
      <div className="flex items-center gap-2 pointer-events-auto">
        {currentView === 'STUDENT_BENCH' && (
          <div className="flex items-center gap-1 bg-[#1a1a1e]/90 backdrop-blur border border-[#2e2e34] p-1.5 rounded-lg shadow-xl">
            <button
              onClick={onZoomOut}
              title="Reduzir Zoom (-)"
              className="p-2 rounded-md text-[#a1a1aa] hover:text-white hover:bg-[#25252b] transition-colors cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <span className="text-xs font-mono text-[#71717a] min-w-12 text-center select-none">
              {Math.round(scale * 100)}%
            </span>

            <button
              onClick={onZoomIn}
              title="Aumentar Zoom (+)"
              className="p-2 rounded-md text-[#a1a1aa] hover:text-white hover:bg-[#25252b] transition-colors cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            <div className="h-4 w-px bg-[#2e2e34] mx-1" />

            <button
              onClick={onResetZoom}
              title="Restaurar visualização original (100%)"
              className="p-2 rounded-md text-[#a1a1aa] hover:text-[#00e599] hover:bg-[#25252b] transition-colors cursor-pointer"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Toggle Code / Serial Panel */}
        {currentView === 'STUDENT_BENCH' && (
          <button
            onClick={onToggleCodePanel}
            title={isCodePanelOpen ? 'Fechar painel de código' : 'Abrir editor de código e terminal'}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg border font-semibold text-xs tracking-wide transition-all shadow-xl cursor-pointer ${
              isCodePanelOpen
                ? 'bg-[#27272a] text-[#00e599] border-[#00e599]/40'
                : 'bg-[#1a1a1e]/90 text-zinc-300 border-[#2e2e34] hover:border-zinc-500'
            }`}
          >
            <Code className="w-4 h-4" />
            <span>CÓDIGO & SERIAL</span>
          </button>
        )}
      </div>
    </header>
  );
};
