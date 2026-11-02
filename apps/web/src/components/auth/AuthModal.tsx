import React, { useState } from 'react';
import { X, GraduationCap, User, Lock, Mail, Building, KeyRound, Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';
import type { UserRole } from '@webboard/contracts';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'QUICK_JOIN' | 'LOGIN' | 'REGISTER';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'QUICK_JOIN',
}) => {
  const { login, register, quickJoinClassroom, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'QUICK_JOIN' | 'LOGIN' | 'REGISTER'>(defaultTab);

  // Campos do formulário
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('STUDENT');
  const [institutionName, setInstitutionName] = useState('');
  const [classroomCode, setClassroomCode] = useState('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleQuickJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!name.trim() || !classroomCode.trim()) {
      setErrorMessage('Informe seu nome e o código fornecido pelo professor.');
      return;
    }
    try {
      await quickJoinClassroom(name, classroomCode);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao ingressar na turma.');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!email.trim() || !password) {
      setErrorMessage('Preencha seu email e senha.');
      return;
    }
    try {
      await login({ email: email.trim(), password });
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Credenciais inválidas.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!name.trim() || !email.trim() || !password) {
      setErrorMessage('Nome, email e senha são obrigatórios.');
      return;
    }
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        institutionName: institutionName.trim() || undefined,
        classroomCode: classroomCode.trim().toUpperCase() || undefined,
      });
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao criar conta.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#FAF9F6] border-3 border-black shadow-[6px_6px_0px_#000] p-6 text-black">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between pb-4 border-b-2 border-black mb-5">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#FFD700] border-2 border-black shadow-[2px_2px_0px_#000]">
              <GraduationCap className="w-5 h-5 text-black" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight uppercase">Acesso ao Webboard</h2>
              <p className="text-xs font-semibold text-neutral-600">Bancadas e Desafios de Robótica</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 border-2 border-black bg-white hover:bg-[#FF6B6B] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Abas Neobrutalistas */}
        <div className="grid grid-cols-3 gap-1 bg-neutral-200 p-1 border-2 border-black mb-5 text-xs font-bold uppercase">
          <button
            type="button"
            onClick={() => {
              setActiveTab('QUICK_JOIN');
              setErrorMessage(null);
            }}
            className={`py-2 px-1 text-center transition-all ${
              activeTab === 'QUICK_JOIN'
                ? 'bg-[#00E5FF] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                : 'text-neutral-700 hover:text-black'
            }`}
          >
            Turma
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('LOGIN');
              setErrorMessage(null);
            }}
            className={`py-2 px-1 text-center transition-all ${
              activeTab === 'LOGIN'
                ? 'bg-[#FFD700] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                : 'text-neutral-700 hover:text-black'
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('REGISTER');
              setErrorMessage(null);
            }}
            className={`py-2 px-1 text-center transition-all ${
              activeTab === 'REGISTER'
                ? 'bg-[#00E676] text-black border-2 border-black shadow-[2px_2px_0px_#000]'
                : 'text-neutral-700 hover:text-black'
            }`}
          >
            Cadastrar
          </button>
        </div>

        {/* Alerta de Erro */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-[#FFE5E5] border-2 border-[#D32F2F] text-[#D32F2F] text-xs font-bold shadow-[2px_2px_0px_#D32F2F]">
            {errorMessage}
          </div>
        )}

        {/* ABA 1: ENTRADA RÁPIDA DE ALUNO */}
        {activeTab === 'QUICK_JOIN' && (
          <form onSubmit={handleQuickJoin} className="space-y-4">
            <div className="p-3 bg-[#E1F5FE] border-2 border-black text-xs font-medium text-neutral-800">
              ⚡ <strong>Para alunos em sala de aula:</strong> Digite seu nome e o código de 6 dígitos que o professor exibiu no projetor.
            </div>

            <div>
              <label className="block text-xs font-black uppercase mb-1">Seu Nome / Apelido</label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-3 text-neutral-500" />
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Silva"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border-2 border-black bg-white font-medium text-sm focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black uppercase mb-1">Código da Turma</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3 top-3 text-neutral-500" />
                <input
                  type="text"
                  required
                  placeholder="Ex: ROB-8B ou ROB-2026"
                  value={classroomCode}
                  onChange={(e) => setClassroomCode(e.target.value.toUpperCase())}
                  className="w-full pl-9 pr-3 py-2 border-2 border-black bg-white font-mono font-bold text-sm tracking-wider uppercase focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[#00E5FF] hover:bg-[#00B4D8] border-2 border-black font-black uppercase text-sm shadow-[4px_4px_0px_#000] active:translate-x-1 active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Entrar na Turma e Abrir Bancada
            </button>
          </form>
        )}

        {/* ABA 2: LOGIN COM EMAIL E SENHA */}
        {activeTab === 'LOGIN' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase mb-1">Email Institucional</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-neutral-500" />
                <input
                  type="email"
                  required
                  placeholder="seu.email@escola.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border-2 border-black bg-white font-medium text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black uppercase mb-1">Senha</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-neutral-500" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border-2 border-black bg-white font-medium text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[#FFD700] hover:bg-[#FFC400] border-2 border-black font-black uppercase text-sm shadow-[4px_4px_0px_#000] active:translate-x-1 active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Acessar Minha Conta
            </button>
          </form>
        )}

        {/* ABA 3: CADASTRO COMPLETO */}
        {activeTab === 'REGISTER' && (
          <form onSubmit={handleRegister} className="space-y-3">
            <div>
              <label className="block text-xs font-black uppercase mb-1">Papel na Instituição</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('STUDENT')}
                  className={`py-2 px-3 border-2 border-black text-xs font-black uppercase ${
                    role === 'STUDENT'
                      ? 'bg-[#00E676] shadow-[2px_2px_0px_#000]'
                      : 'bg-white text-neutral-600'
                  }`}
                >
                  🎓 Sou Aluno
                </button>
                <button
                  type="button"
                  onClick={() => setRole('TEACHER')}
                  className={`py-2 px-3 border-2 border-black text-xs font-black uppercase ${
                    role === 'TEACHER'
                      ? 'bg-[#FFD700] shadow-[2px_2px_0px_#000]'
                      : 'bg-white text-neutral-600'
                  }`}
                >
                  👨‍🏫 Sou Professor
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-black uppercase mb-1">Nome Completo</label>
              <input
                type="text"
                required
                placeholder="Ex: Prof. Renato ou Maria"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-1.5 border-2 border-black bg-white font-medium text-sm focus:outline-none focus:ring-2 focus:ring-[#00E676]"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase mb-1">Email</label>
              <input
                type="email"
                required
                placeholder="email@instituicao.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-1.5 border-2 border-black bg-white font-medium text-sm focus:outline-none focus:ring-2 focus:ring-[#00E676]"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase mb-1">Senha</label>
              <input
                type="password"
                required
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-1.5 border-2 border-black bg-white font-medium text-sm focus:outline-none focus:ring-2 focus:ring-[#00E676]"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase mb-1">
                {role === 'TEACHER' ? 'Nome da Escola / Universidade' : 'Código da Turma (Opcional)'}
              </label>
              <input
                type="text"
                placeholder={role === 'TEACHER' ? 'Ex: Colégio Técnico Federal' : 'Ex: ROB-8B'}
                value={role === 'TEACHER' ? institutionName : classroomCode}
                onChange={(e) =>
                  role === 'TEACHER'
                    ? setInstitutionName(e.target.value)
                    : setClassroomCode(e.target.value.toUpperCase())
                }
                className="w-full px-3 py-1.5 border-2 border-black bg-white font-medium text-sm focus:outline-none focus:ring-2 focus:ring-[#00E676]"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 mt-2 bg-[#00E676] hover:bg-[#00C853] border-2 border-black font-black uppercase text-sm shadow-[4px_4px_0px_#000] active:translate-x-1 active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Criar Conta e Começar
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
