import React from 'react';
import { CheckCircle2, XCircle, Clock, Trophy, X, Award } from 'lucide-react';
import type { EvaluationResult } from '@webboard/contracts';

interface SubmissionResultModalProps {
  evaluation: EvaluationResult | null;
  challengeTitle?: string;
  onClose: () => void;
}

export const SubmissionResultModal: React.FC<SubmissionResultModalProps> = ({
  evaluation,
  challengeTitle = 'Desafio de Circuito',
  onClose
}) => {
  if (!evaluation) return null;

  const isApproved = evaluation.status === 'APPROVED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-[#1a1a1e] border-2 border-[#2e2e34] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Banner */}
        <div
          className={`p-6 flex flex-col items-center justify-center text-center border-b border-[#2e2e34] ${
            isApproved
              ? 'bg-gradient-to-b from-emerald-950/60 to-[#1a1a1e]'
              : 'bg-gradient-to-b from-rose-950/60 to-[#1a1a1e]'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Relatório de Auto-Grading
            </span>
            <button
              onClick={onClose}
              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="my-2">
            {isApproved ? (
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 animate-bounce">
                <Trophy className="w-8 h-8 text-[#00e599]" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center shadow-lg shadow-rose-500/20">
                <XCircle className="w-8 h-8 text-rose-500" />
              </div>
            )}
          </div>

          <h2 className="text-xl font-black text-white tracking-tight mt-1">
            {isApproved ? 'Submissão Aprovada com Sucesso!' : 'Requisitos Não Atendidos'}
          </h2>
          <p className="text-xs text-zinc-400 mt-1">{challengeTitle}</p>
        </div>

        {/* Evaluation Summary Stats */}
        <div className="grid grid-cols-3 gap-2 p-4 bg-[#141417] border-b border-[#2e2e34] text-center text-xs">
          <div className="p-2 rounded-lg bg-[#1a1a1e] border border-[#2e2e34]">
            <span className="block text-zinc-500 text-[10px] uppercase font-bold">Casos Passados</span>
            <span className="text-base font-black text-emerald-400">
              {evaluation.summary.passedTests} / {evaluation.summary.totalTests}
            </span>
          </div>

          <div className="p-2 rounded-lg bg-[#1a1a1e] border border-[#2e2e34]">
            <span className="block text-zinc-500 text-[10px] uppercase font-bold">Falhas</span>
            <span className={`text-base font-black ${evaluation.summary.failedTests > 0 ? 'text-rose-400' : 'text-zinc-400'}`}>
              {evaluation.summary.failedTests}
            </span>
          </div>

          <div className="p-2 rounded-lg bg-[#1a1a1e] border border-[#2e2e34]">
            <span className="block text-zinc-500 text-[10px] uppercase font-bold">Tempo Virtual</span>
            <span className="text-base font-mono font-bold text-sky-400">
              {evaluation.totalExecutionVirtualSeconds.toFixed(1)}s
            </span>
          </div>
        </div>

        {/* Test Results Breakdown */}
        <div className="p-4 overflow-y-auto max-h-60 space-y-2">
          {evaluation.testResults.map((tr) => (
            <div
              key={tr.testCaseId}
              className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                tr.passed
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                  : 'bg-rose-950/20 border-rose-500/30 text-rose-200'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {tr.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between font-bold text-white mb-0.5">
                  <span className="truncate">{tr.testCaseId}</span>
                  <span className="font-mono text-[10px] text-zinc-400">
                    {tr.executionTimeVirtualSeconds.toFixed(1)}s
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-zinc-300">{tr.message}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-[#161619] border-t border-[#2e2e34] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-[#00e599] hover:bg-[#00c985] text-black transition-colors cursor-pointer"
          >
            Continuar na Bancada
          </button>
        </div>
      </div>
    </div>
  );
};
