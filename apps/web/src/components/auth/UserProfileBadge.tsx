import React, { useState, useRef, useEffect } from 'react';
import { User, LogIn, LogOut, GraduationCap, ChevronDown, Plus, School } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';
import { AuthModal } from './AuthModal.js';

export const UserProfileBadge: React.FC = () => {
  const { user, activeClassroom, classrooms, isAuthenticated, logout, selectClassroom, createClassroom } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCreatingClass, setIsCreatingClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
        setIsCreatingClass(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreateClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    try {
      await createClassroom(newClassName.trim());
      setNewClassName('');
      setIsCreatingClass(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao criar turma');
    }
  };

  if (!isAuthenticated || !user) {
    return (
      <>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#FFD700] hover:bg-[#FFC400] text-black font-black uppercase text-xs border-2 border-black shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
        >
          <LogIn className="w-4 h-4" />
          <span>Entrar / Código</span>
        </button>
        <AuthModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </>
    );
  }

  const isTeacher = user.role === 'TEACHER' || user.role === 'ADMIN';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsDropdownOpen((prev) => !prev)}
        className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-neutral-50 text-black border-2 border-black shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
      >
        <div
          className={`w-2.5 h-2.5 rounded-full ${
            isTeacher ? 'bg-[#FFD700]' : 'bg-[#00E676]'
          } border border-black`}
        />
        <div className="flex flex-col text-left">
          <span className="text-xs font-black truncate max-w-[130px]">{user.name}</span>
          <span className="text-[10px] font-bold text-neutral-600 truncate max-w-[130px]">
            {activeClassroom ? `Turma: ${activeClassroom.code}` : isTeacher ? 'Docente' : 'Aluno'}
          </span>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-neutral-700" />
      </button>

      {/* Menu Dropdown Neobrutalista */}
      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-[#FAF9F6] border-3 border-black shadow-[5px_5px_0px_#000] p-3 z-50 text-black animate-in fade-in duration-100">
          <div className="pb-2 border-b-2 border-black mb-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Conectado como</p>
            <p className="text-xs font-black truncate">{user.name}</p>
            <p className="text-[11px] text-neutral-600 truncate">{user.email}</p>
            {user.tenantName && (
              <p className="text-[10px] font-bold mt-1 text-neutral-700 flex items-center gap-1">
                <School className="w-3 h-3" /> {user.tenantName}
              </p>
            )}
          </div>

          {/* Lista de Turmas */}
          <div className="mb-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500 mb-1">
              Turmas ({classrooms.length})
            </p>
            {classrooms.length === 0 ? (
              <p className="text-xs text-neutral-500 italic py-1">Nenhuma turma vinculada.</p>
            ) : (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {classrooms.map((c) => {
                  const isActive = activeClassroom?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        selectClassroom(c);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full text-left px-2 py-1.5 text-xs font-bold border border-black flex items-center justify-between transition-colors ${
                        isActive
                          ? 'bg-[#00E5FF] text-black font-black'
                          : 'bg-white hover:bg-neutral-100'
                      }`}
                    >
                      <span className="truncate">{c.name}</span>
                      <span className="font-mono text-[10px] bg-black text-white px-1 py-0.5 ml-1">
                        {c.code}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Criar Turma (Docente) */}
          {isTeacher && (
            <div className="mb-3 pt-2 border-t border-neutral-300">
              {!isCreatingClass ? (
                <button
                  onClick={() => setIsCreatingClass(true)}
                  className="w-full py-1.5 px-2 bg-[#E1F5FE] hover:bg-[#B3E5FC] border border-black font-black text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Criar Nova Turma
                </button>
              ) : (
                <form onSubmit={handleCreateClassroom} className="space-y-2">
                  <input
                    type="text"
                    required
                    placeholder="Nome da Turma (ex: 8º B)"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-black bg-white focus:outline-none"
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <button
                      type="submit"
                      className="flex-1 py-1 bg-[#00E676] text-black font-black text-[11px] border border-black uppercase"
                    >
                      Criar
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCreatingClass(false)}
                      className="px-2 py-1 bg-neutral-200 text-black font-bold text-[11px] border border-black"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Botão de Logout */}
          <div className="pt-2 border-t-2 border-black">
            <button
              onClick={() => {
                logout();
                setIsDropdownOpen(false);
              }}
              className="w-full py-1.5 px-2 bg-[#FFE5E5] hover:bg-[#FF6B6B] hover:text-white border-2 border-black font-black text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" /> Desconectar da Conta
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
