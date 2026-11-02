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
  Loader2,
  Trophy,
  HelpCircle
} from 'lucide-react';
import type { WorkbenchMode, WorkbenchFaultPayload, WireColor } from '@webboard/contracts';
import { WireColorPalette } from './WireColorPalette.js';
import { Tooltip } from './Tooltip.js';
import type { ChallengeListItem } from '../../api/client.js';
import { UserProfileBadge } from '../auth/UserProfileBadge.js';

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
  isCompiling?: boolean;
  challenges?: ChallengeListItem[];
  activeChallengeId?: string;
  onSelectChallenge?: (challengeId: string) => void;
  onSelectWireColor: (color: WireColor) => void;
  onToggleCodePanel: () => void;
  onToggleView: () => void;
  onStartTour?: () => void;
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
  isCompiling = false,
  challenges,
  activeChallengeId,
  onSelectChallenge,
  onSelectWireColor,
  onToggleCodePanel,
  onToggleView,
  onStartTour,
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
  const rightOffset = isCodePanelOpen ? 'right-[536px]' : 'right-4';

  return (
    <header className={`absolute top-4 left-4 ${rightOffset} z-20 flex items-center justify-between pointer-events-none transition-all duration-300 ease-in-out`}>
      {/* Brand & Left Controls */}
      <div className="flex items-center gap-2 bg-[#1a1a1e]/90 backdrop-blur border border-[#2e2e34] px-3 py-1.5 rounded-lg shadow-xl pointer-events-auto">
        <Tooltip content="Webboard: Simulador de Robótica e Circuitos">
          <div className="flex items-center gap-2 font-bold text-sm tracking-wide text-[#00e599] cursor-pointer">
            <Zap className="w-5 h-5 fill-[#00e599]" />
            <span className="hidden sm:inline">WEBBOARD</span>
          </div>
        </Tooltip>

        <div className="h-4 w-px bg-[#2e2e34]" />

        {/* View Switcher Button (Aluno vs Professor) */}
        <Tooltip
          content={
            currentView === 'STUDENT_BENCH'
              ? 'Painel Panóptico do Professor (Visão da Turma)'
              : 'Retornar para a Bancada Interativa do Aluno'
          }
        >
          <button
            onClick={onToggleView}
            className="flex items-center gap-1.5 p-1.5 rounded-md text-xs font-semibold bg-[#26262c] hover:bg-[#323238] text-zinc-200 border border-[#3f3f46] transition-colors cursor-pointer"
          >
            {currentView === 'STUDENT_BENCH' ? (
              <GraduationCap className="w-4 h-4 text-amber-400" />
            ) : (
              <Monitor className="w-4 h-4 text-[#00e599]" />
            )}
          </button>
        </Tooltip>

        {/* Badge Compacto de Status de Modo */}
        {currentView === 'STUDENT_BENCH' && (
          <Tooltip
            content={
              isMirrorMode
                ? 'Modo Espelho Ativo (Apenas Leitura pedagógica)'
                : isSimulating
                ? 'Circuito Energizado (CPU ATmega328P a 16MHz)'
                : isFault
                ? 'Falha Elétrica Detectada (Curto ou Sobrecarga)'
                : 'Bancada Desenergizada (Modo de Edição Livre)'
            }
          >
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold bg-[#242429] border border-[#2e2e34] cursor-default">
              {isMirrorMode ? (
                <>
                  <Eye className="w-3.5 h-3.5 text-sky-400" />
                  <span className="text-[11px] text-sky-400">Espelho</span>
                  {onExitMirrorMode && (
                    <button
                      onClick={onExitMirrorMode}
                      className="ml-0.5 underline text-sky-300 hover:text-white cursor-pointer text-[10px]"
                    >
                      Sair
                    </button>
                  )}
                </>
              ) : isSimulating ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[11px] text-emerald-400">Ativo</span>
                </>
              ) : isFault ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span className="text-[11px] text-rose-400 font-bold">Falha</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-zinc-500" />
                  <span className="text-[11px] text-zinc-400">Edição</span>
                </>
              )}
            </div>
          </Tooltip>
        )}

        {/* Seletor de Desafio Dinâmico Compacto */}
        {currentView === 'STUDENT_BENCH' && challenges && challenges.length > 0 && (
          <>
            <div className="h-4 w-px bg-[#2e2e34]" />
            <Tooltip content="Desafio de Robótica Selecionado">
              <div className="flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <select
                  value={activeChallengeId || ''}
                  onChange={(e) => onSelectChallenge?.(e.target.value)}
                  disabled={isSimulating || isMirrorMode}
                  className="bg-[#242429] text-zinc-200 text-[11px] font-semibold px-1.5 py-0.5 rounded border border-[#3f3f46] hover:border-zinc-400 focus:outline-none focus:border-[#00e599] cursor-pointer max-w-[130px] truncate"
                >
                  {challenges.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.title}
                    </option>
                  ))}
                </select>
              </div>
            </Tooltip>
          </>
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

          <div
            id="tour-actions"
            className="flex items-center gap-1.5 bg-[#1a1a1e]/90 backdrop-blur border border-[#2e2e34] p-1 rounded-lg shadow-xl"
          >
            {/* Botão de Energização / Play */}
            <Tooltip
              content={
                isCompiling
                  ? 'Compilando sketch Arduino C++...'
                  : isSimulating
                  ? 'Desligar e Desenergizar a Bancada'
                  : 'Compilar código e Energizar a Bancada'
              }
            >
              <div id="tour-simulation-control">
                {!isSimulating ? (
                  <button
                    onClick={onStartSimulation}
                    disabled={isMirrorMode || isCompiling}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold text-xs tracking-wide bg-[#00e599] hover:bg-[#00c985] disabled:opacity-40 text-black transition-all shadow-md active:translate-y-0.5 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isCompiling ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 fill-black" />
                    )}
                    <span>{isCompiling ? 'Compilando...' : 'Ligar'}</span>
                  </button>
                ) : (
                  <button
                    onClick={onStopSimulation}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold text-xs tracking-wide bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md active:translate-y-0.5 cursor-pointer"
                  >
                    <Square className="w-4 h-4 fill-white" />
                    <span>Parar</span>
                  </button>
                )}
              </div>
            </Tooltip>

            <div className="h-4 w-px bg-[#2e2e34] my-auto mx-0.5" />

            {/* Salvar na Nuvem */}
            <Tooltip content="Salvar Bancada na Nuvem" shortcut="Ctrl+S">
              <button
                onClick={onSaveWorkspace}
                disabled={isMirrorMode || isSaving}
                className="p-1.5 rounded-md text-zinc-300 hover:text-white hover:bg-[#25252b] transition-colors cursor-pointer disabled:opacity-40"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              </button>
            </Tooltip>

            {/* Submeter Desafio */}
            <Tooltip content="Submeter Desafio para Auto-Avaliação">
              <button
                onClick={onSubmitChallenge}
                disabled={isMirrorMode || isSubmitting}
                className="p-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer disabled:opacity-40 shadow-sm"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </Tooltip>

            <div className="h-4 w-px bg-[#2e2e34] my-auto mx-0.5" />

            {/* Delete Selection */}
            <Tooltip content="Excluir Elemento Selecionado" shortcut="Del">
              <button
                onClick={onDeleteSelected}
                disabled={!hasSelection || isSimulating || isMirrorMode}
                className="p-1.5 rounded-md text-[#a1a1aa] hover:text-rose-400 hover:bg-[#25252b] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#a1a1aa] transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </Tooltip>

            {/* Clear Circuit */}
            <Tooltip content="Limpar Toda a Bancada">
              <button
                onClick={onClearWorkbench}
                disabled={isSimulating || isMirrorMode}
                className="p-1.5 rounded-md text-[#a1a1aa] hover:text-white hover:bg-[#25252b] disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>
        </div>
      )}

      {/* Right Controls */}
      <div className="flex items-center gap-1.5 pointer-events-auto">
        {/* Botão de Tutorial Guiado (Shepherd.js) */}
        {currentView === 'STUDENT_BENCH' && onStartTour && (
          <Tooltip content="Iniciar Tour Guiado da Bancada">
            <button
              onClick={onStartTour}
              className="p-2 rounded-lg bg-[#1a1a1e]/90 backdrop-blur border border-[#2e2e34] text-zinc-300 hover:text-[#00e599] hover:bg-[#25252b] transition-all shadow-xl cursor-pointer"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </Tooltip>
        )}

        {/* Controles de Zoom Compactos */}
        {currentView === 'STUDENT_BENCH' && (
          <div className="flex items-center gap-0.5 bg-[#1a1a1e]/90 backdrop-blur border border-[#2e2e34] p-1 rounded-lg shadow-xl">
            <Tooltip content="Reduzir Zoom (-)">
              <button
                onClick={onZoomOut}
                className="p-1.5 rounded-md text-[#a1a1aa] hover:text-white hover:bg-[#25252b] transition-colors cursor-pointer"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
            </Tooltip>

            <span className="text-[11px] font-mono text-[#71717a] min-w-9 text-center select-none">
              {Math.round(scale * 100)}%
            </span>

            <Tooltip content="Aumentar Zoom (+)">
              <button
                onClick={onZoomIn}
                className="p-1.5 rounded-md text-[#a1a1aa] hover:text-white hover:bg-[#25252b] transition-colors cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </Tooltip>

            <Tooltip content="Restaurar Zoom Original (100%)">
              <button
                onClick={onResetZoom}
                className="p-1.5 rounded-md text-[#a1a1aa] hover:text-[#00e599] hover:bg-[#25252b] transition-colors cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          </div>
        )}

        {/* Toggle Code / Serial Panel */}
        {currentView === 'STUDENT_BENCH' && (
          <Tooltip
            content={
              isCodePanelOpen
                ? 'Recolher Painel de Código'
                : 'Abrir Editor de Código Arduino C++ & Monitor Serial'
            }
          >
            <button
              id="tour-code-panel"
              onClick={onToggleCodePanel}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold text-xs tracking-wide transition-all shadow-xl cursor-pointer ${
                isCodePanelOpen
                  ? 'bg-[#27272a] text-[#00e599] border-[#00e599]/40 shadow-sm'
                  : 'bg-[#1a1a1e]/90 text-zinc-300 border-[#2e2e34] hover:border-zinc-500'
              }`}
            >
              <Code className="w-4 h-4" />
              <span>Código</span>
            </button>
          </Tooltip>
        )}

        {/* Badge de Identidade do Usuário / Login / Turma */}
        <UserProfileBadge />
      </div>
    </header>
  );
};
