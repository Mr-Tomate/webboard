import React, { useState } from 'react';
import { MessageSquare, X, Send, ShieldAlert } from 'lucide-react';
import type { StudentWorkspacePulse } from '../../types/telemetry.js';

interface PedagogicalNoteModalProps {
  workspace: StudentWorkspacePulse | null;
  onClose: () => void;
  onSubmit: (workspaceId: string, noteText: string, targetComponentId?: string) => void;
}

export const PedagogicalNoteModal: React.FC<PedagogicalNoteModalProps> = ({
  workspace,
  onClose,
  onSubmit
}) => {
  const [noteText, setNoteText] = useState('');
  const [targetComponentId, setTargetComponentId] = useState('');

  if (!workspace) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    onSubmit(workspace.workspaceId, noteText.trim(), targetComponentId || undefined);
    setNoteText('');
    setTargetComponentId('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-[#1a1a1e] border-2 border-[#2e2e34] rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#242429] border-b border-[#2e2e34]">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#00e599]" />
            <h3 className="text-sm font-bold text-white">
              Feedback Pedagógico — {workspace.teamName}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-[#2d2d34] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="p-3 rounded-lg bg-[#141417] border border-[#2e2e34] text-xs text-zinc-400 space-y-1">
            <div className="flex items-center gap-1.5 text-zinc-300 font-semibold">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>Princípio do Professor Mentor (RN-PED-01 & RN-PED-02)</span>
            </div>
            <p>
              O educador não edita fios nem linhas de código diretamente. Suas notas
              são exibidas como orientações formativas na bancada do estudante.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Mensagem de Orientação:
            </label>
            <textarea
              rows={4}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Ex: Verifique a polaridade do LED ou se o resistor de 220Ω está no caminho do GND..."
              className="w-full bg-[#121214] border border-[#2e2e34] rounded-lg p-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#00e599]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Componente Alvo (Opcional para destaque no Canvas):
            </label>
            <input
              type="text"
              value={targetComponentId}
              onChange={(e) => setTargetComponentId(e.target.value)}
              placeholder="Ex: led_01, res_01, mcu_uno_01"
              className="w-full bg-[#121214] border border-[#2e2e34] rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#00e599]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2e2e34]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-[#27272a] transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-[#00e599] hover:bg-[#00c985] text-black transition-all shadow-md active:translate-y-0.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Enviar Orientação</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
