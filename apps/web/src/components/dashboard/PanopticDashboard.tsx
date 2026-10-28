import React, { useState } from 'react';
import {
  Users,
  Activity,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  MessageSquare,
  Search,
  Filter,
  Layers,
  FileCode,
  GraduationCap
} from 'lucide-react';
import type {
  StudentWorkspacePulse,
  StudentWorkspaceStatus
} from '../../types/telemetry.js';
import { computeClassroomSummary } from '../../utils/telemetry.js';
import { PedagogicalNoteModal } from './PedagogicalNoteModal.js';

interface PanopticDashboardProps {
  workspaces: StudentWorkspacePulse[];
  onMirrorWorkspace: (workspace: StudentWorkspacePulse) => void;
  onAddNote: (workspaceId: string, text: string, targetComponentId?: string) => void;
}

export const PanopticDashboard: React.FC<PanopticDashboardProps> = ({
  workspaces,
  onMirrorWorkspace,
  onAddNote
}) => {
  const [statusFilter, setStatusFilter] = useState<StudentWorkspaceStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorkspaceForNote, setSelectedWorkspaceForNote] = useState<StudentWorkspacePulse | null>(null);

  const summary = computeClassroomSummary(workspaces);

  const filteredWorkspaces = workspaces.filter((ws) => {
    const matchesStatus = statusFilter === 'ALL' || ws.status === statusFilter;
    const matchesSearch =
      ws.teamName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ws.students.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: StudentWorkspaceStatus) => {
    switch (status) {
      case 'NORMAL':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-500/40">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            NORMAL
          </span>
        );
      case 'DIFICULDADE':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-400 border border-amber-500/40 animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            DIFICULDADE
          </span>
        );
      case 'FALHA_CRÍTICA':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950/90 text-rose-300 border border-rose-500/50 animate-pulse">
            <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
            FALHA CRÍTICA
          </span>
        );
      case 'INATIVO':
      default:
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
            <Clock className="w-3.5 h-3.5" />
            INATIVO
          </span>
        );
    }
  };

  return (
    <div className="w-full h-full bg-[#121214] text-zinc-200 overflow-y-auto p-6 space-y-6">
      {/* Top Banner & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2e2e34] pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#1a1a1e] border border-[#2e2e34] text-[#00e599]">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <span>Painel Panóptico Docente</span>
                <span className="text-xs px-2 py-0.5 rounded bg-[#1f2025] text-[#00e599] border border-[#00e599]/30 font-mono">
                  AO VIVO
                </span>
              </h1>
              <p className="text-xs text-zinc-400">
                Turma 8B • Robótica & Circuitos Microcontrolados (Telemetria em Tempo Real)
              </p>
            </div>
          </div>
        </div>

        {/* Global Stats Bar */}
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 rounded-lg bg-[#1a1a1e] border border-[#2e2e34] flex items-center gap-3">
            <div className="text-center">
              <span className="block text-base font-extrabold text-white">{summary.totalWorkspaces}</span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Bancadas</span>
            </div>
            <div className="h-6 w-px bg-[#2e2e34]" />
            <div className="text-center">
              <span className="block text-base font-extrabold text-emerald-400">{summary.statusCounts.normal}</span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Normal</span>
            </div>
            <div className="h-6 w-px bg-[#2e2e34]" />
            <div className="text-center">
              <span className="block text-base font-extrabold text-amber-400">{summary.statusCounts.difficulty}</span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Dificuldade</span>
            </div>
            <div className="h-6 w-px bg-[#2e2e34]" />
            <div className="text-center">
              <span className="block text-base font-extrabold text-rose-400">{summary.statusCounts.critical}</span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Crítico</span>
            </div>
            <div className="h-6 w-px bg-[#2e2e34]" />
            <div className="text-center">
              <span className="block text-base font-extrabold text-[#00e599]">{summary.averageProgressPercent}%</span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Sucesso</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Status Filters */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#1a1a1e] border border-[#2e2e34]">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-[#27272a] text-white shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Todas ({workspaces.length})
          </button>
          <button
            onClick={() => setStatusFilter('FALHA_CRÍTICA')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              statusFilter === 'FALHA_CRÍTICA'
                ? 'bg-rose-950 text-rose-300 border border-rose-500/40 shadow'
                : 'text-rose-400 hover:bg-rose-950/40'
            }`}
          >
            Falhas Críticas ({summary.statusCounts.critical})
          </button>
          <button
            onClick={() => setStatusFilter('DIFICULDADE')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              statusFilter === 'DIFICULDADE'
                ? 'bg-amber-950 text-amber-300 border border-amber-500/40 shadow'
                : 'text-amber-400 hover:bg-amber-950/40'
            }`}
          >
            Em Dificuldade ({summary.statusCounts.difficulty})
          </button>
          <button
            onClick={() => setStatusFilter('NORMAL')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              statusFilter === 'NORMAL'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40 shadow'
                : 'text-emerald-400 hover:bg-emerald-950/40'
            }`}
          >
            Em Progresso ({summary.statusCounts.normal})
          </button>
        </div>

        {/* Search input */}
        <div className="relative min-w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por equipe ou aluno..."
            className="w-full bg-[#1a1a1e] border border-[#2e2e34] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#00e599]"
          />
        </div>
      </div>

      {/* Grid of Student Workspaces */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredWorkspaces.map((ws) => (
          <div
            key={ws.workspaceId}
            className={`rounded-xl border transition-all flex flex-col justify-between p-4 bg-[#18181c] shadow-lg ${
              ws.status === 'FALHA_CRÍTICA'
                ? 'border-rose-500/50 hover:border-rose-400 shadow-rose-950/20'
                : ws.status === 'DIFICULDADE'
                ? 'border-amber-500/50 hover:border-amber-400 shadow-amber-950/20'
                : 'border-[#2e2e34] hover:border-[#00e599]/60'
            }`}
          >
            <div className="space-y-3">
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-sm text-white">{ws.teamName}</h3>
                  <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5">
                    <Users className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{ws.students.join(', ')}</span>
                  </p>
                </div>
                {getStatusBadge(ws.status)}
              </div>

              {/* Challenge Title */}
              <div className="p-2.5 rounded-lg bg-[#131316] border border-[#26262c] text-xs">
                <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-0.5">
                  Desafio Atribuído:
                </span>
                <span className="font-semibold text-zinc-200">{ws.currentChallengeTitle}</span>
              </div>

              {/* Progress & Test Cases */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Progresso nos Testes:</span>
                  <span className="font-mono font-bold text-white">
                    {ws.testSummary.passed}/{ws.testSummary.total} aprovados
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-[#27272a] overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      ws.status === 'FALHA_CRÍTICA'
                        ? 'bg-rose-500'
                        : ws.status === 'DIFICULDADE'
                        ? 'bg-amber-500'
                        : 'bg-[#00e599]'
                    }`}
                    style={{
                      width: `${
                        ws.testSummary.total > 0
                          ? (ws.testSummary.passed / ws.testSummary.total) * 100
                          : 0
                      }%`
                    }}
                  />
                </div>
              </div>

              {/* Metrics Pills */}
              <div className="flex items-center gap-2 pt-1 text-[11px] text-zinc-400">
                <span className="flex items-center gap-1 bg-[#202025] px-2 py-0.5 rounded border border-[#2e2e34]">
                  <Layers className="w-3 h-3 text-zinc-400" />
                  <span>{ws.circuitMetrics.componentCount} peças</span>
                </span>
                <span className="flex items-center gap-1 bg-[#202025] px-2 py-0.5 rounded border border-[#2e2e34]">
                  <span>{ws.circuitMetrics.wireCount} fios</span>
                </span>
                <span className="flex items-center gap-1 bg-[#202025] px-2 py-0.5 rounded border border-[#2e2e34]">
                  <FileCode className="w-3 h-3 text-zinc-400" />
                  <span>{ws.codeLanguage}</span>
                </span>
                <span className="ml-auto text-[10px] text-zinc-500">
                  {ws.lastActivitySecondsAgo}s atrás
                </span>
              </div>

              {/* Recent Teacher Notes */}
              {ws.pedagogicalNotes.length > 0 && (
                <div className="p-2 rounded bg-amber-950/20 border border-amber-500/20 text-xs text-amber-200/90 space-y-1">
                  <span className="text-[10px] font-bold text-amber-400 uppercase flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    <span>Última Orientação do Docente:</span>
                  </span>
                  <p className="text-[11px] italic">
                    "{ws.pedagogicalNotes[ws.pedagogicalNotes.length - 1].text}"
                  </p>
                </div>
              )}
            </div>

            {/* Card Actions (Mentor Philosophy) */}
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[#26262c]">
              <button
                onClick={() => onMirrorWorkspace(ws)}
                title="Abrir em modo espelho (somente visualização - RN-PED-01)"
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-[#27272a] hover:bg-[#323236] text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Espelhar Bancada</span>
              </button>

              <button
                onClick={() => setSelectedWorkspaceForNote(ws)}
                title="Inserir anotação pedagógica orientada (RN-PED-02)"
                className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-[#00e599]/10 hover:bg-[#00e599]/20 text-[#00e599] border border-[#00e599]/30 font-semibold text-xs transition-colors cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Orientar</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal de Feedback do Professor */}
      <PedagogicalNoteModal
        workspace={selectedWorkspaceForNote}
        onClose={() => setSelectedWorkspaceForNote(null)}
        onSubmit={onAddNote}
      />
    </div>
  );
};
