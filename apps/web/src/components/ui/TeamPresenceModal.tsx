import React, { useState } from 'react';
import { X, Users, UserCheck, Shield, Lock, Copy, Check, UserPlus, Loader2, Sparkles, Monitor } from 'lucide-react';
import type { PresenceMember, ComponentLock } from '../../types/telemetry.js';

interface TeamPresenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  presenceMembers: PresenceMember[];
  currentUserId: string;
  workspaceId: string;
  workspaceName?: string;
  workspaceType?: 'SOLO' | 'GROUP';
  activeLocks?: Map<string, ComponentLock>;
  onAddMember?: (userId: string) => Promise<void>;
}

export const TeamPresenceModal: React.FC<TeamPresenceModalProps> = ({
  isOpen,
  onClose,
  presenceMembers,
  currentUserId,
  workspaceId,
  workspaceName = 'Bancada de Circuitos',
  workspaceType = 'SOLO',
  activeLocks,
  onAddMember,
}) => {
  const [newUserId, setNewUserId] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    const url = `${window.location.origin}?ws=${workspaceId}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserId.trim() || !onAddMember) return;
    setIsAdding(true);
    setFeedbackMessage(null);
    try {
      await onAddMember(newUserId.trim());
      setFeedbackMessage({ text: 'Colega adicionado com sucesso à equipe!' });
      setNewUserId('');
    } catch (err: any) {
      setFeedbackMessage({ text: err.message || 'Erro ao adicionar membro.', isError: true });
    } finally {
      setIsAdding(false);
    }
  };

  // Coleta os locks agrupados por usuário
  const userLocksMap = new Map<string, string[]>();
  if (activeLocks) {
    for (const [compId, lock] of activeLocks.entries()) {
      const list = userLocksMap.get(lock.userId) || [];
      list.push(compId);
      userLocksMap.set(lock.userId, list);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#FAF9F6] border-3 border-black shadow-[6px_6px_0px_#000] p-6 text-black">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between pb-4 border-b-2 border-black mb-5">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#00E5FF] border-2 border-black shadow-[2px_2px_0px_#000]">
              <Users className="w-5 h-5 text-black" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight uppercase">Equipe da Bancada</h2>
                <span
                  className={`px-2 py-0.5 text-[10px] font-black uppercase border border-black ${
                    workspaceType === 'GROUP'
                      ? 'bg-[#00E676] text-black'
                      : 'bg-[#FFD700] text-black'
                  }`}
                >
                  {workspaceType === 'GROUP' ? 'Grupo Colaborativo' : 'Bancada Individual'}
                </span>
              </div>
              <p className="text-xs font-semibold text-neutral-600 truncate max-w-xs">{workspaceName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 border-2 border-black bg-white hover:bg-[#FF6B6B] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback visual */}
        {feedbackMessage && (
          <div
            className={`mb-4 p-3 border-2 border-black text-xs font-bold shadow-[2px_2px_0px_#000] ${
              feedbackMessage.isError ? 'bg-[#FFE5E5] text-[#D32F2F]' : 'bg-[#E8F5E9] text-[#2E7D32]'
            }`}
          >
            {feedbackMessage.text}
          </div>
        )}

        {/* Lista de Membros Online */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-neutral-700 flex items-center gap-1.5">
              <span>Membros Conectados Agora</span>
              <span className="px-1.5 py-0.2 bg-black text-white text-[10px] font-mono rounded">
                {presenceMembers.length}
              </span>
            </h3>
            <button
              onClick={handleCopyLink}
              className="text-[11px] font-bold text-neutral-700 hover:text-black flex items-center gap-1 underline cursor-pointer"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-[#00C853]" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedLink ? 'Link Copiado!' : 'Copiar Link da Bancada'}
            </button>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {presenceMembers.length === 0 ? (
              <div className="p-4 border-2 border-dashed border-neutral-400 text-center text-xs font-semibold text-neutral-500">
                Nenhum membro detectado no socket.
              </div>
            ) : (
              presenceMembers.map((member) => {
                const isMe = member.userId === currentUserId;
                const lockedComponents = userLocksMap.get(member.userId) || [];

                return (
                  <div
                    key={member.userId}
                    className={`p-3 border-2 border-black flex items-center justify-between transition-all ${
                      isMe
                        ? 'bg-[#E1F5FE] shadow-[3px_3px_0px_#000]'
                        : 'bg-white shadow-[2px_2px_0px_#000]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-[#FFD700] border-2 border-black flex items-center justify-center font-black text-xs uppercase">
                          {member.userName.slice(0, 2)}
                        </div>
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#00E676] border border-black" />
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-black text-black">{member.userName}</span>
                          {isMe && (
                            <span className="px-1.5 py-0.5 bg-black text-white text-[10px] font-black uppercase tracking-wider">
                              Você
                            </span>
                          )}
                          {member.connections > 1 && (
                            <span className="px-1.5 py-0.5 bg-[#FFF9C4] border border-black text-[10px] font-bold text-neutral-800 flex items-center gap-1">
                              <Monitor className="w-3 h-3" /> {member.connections} abas
                            </span>
                          )}
                        </div>

                        {lockedComponents.length > 0 ? (
                          <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 mt-0.5">
                            <Lock className="w-3 h-3 text-amber-600" />
                            <span>Editando: {lockedComponents.join(', ')}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-neutral-500 font-medium">Observando a bancada</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-xs font-mono font-bold text-neutral-400">
                        {member.userId.slice(0, 6)}...
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Convidar Colega para o Grupo (RN-GRP-01) */}
        {onAddMember && (
          <div className="pt-4 border-t-2 border-black">
            <h4 className="text-xs font-black uppercase mb-1.5 flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-black" /> Convidar Colega para a Bancada
            </h4>
            <p className="text-[11px] text-neutral-600 mb-2">
              Digite o ID ou email do seu colega para integrá-lo a esta bancada em tempo real com cursores compartilhados:
            </p>

            <form onSubmit={handleAddMember} className="flex gap-2">
              <input
                type="text"
                required
                placeholder="Ex: aluno_carlos ou ID do usuário"
                value={newUserId}
                onChange={(e) => setNewUserId(e.target.value)}
                className="flex-1 px-3 py-2 border-2 border-black bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
              />
              <button
                type="submit"
                disabled={isAdding}
                className="px-4 py-2 bg-[#00E676] hover:bg-[#00C853] border-2 border-black font-black uppercase text-xs shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                Adicionar
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
