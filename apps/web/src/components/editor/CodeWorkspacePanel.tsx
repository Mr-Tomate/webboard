import React, { useState } from 'react';
import {
  Code,
  Terminal,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { CodeEditor, type SupportedLanguage } from './CodeEditor.js';
import { SerialConsole } from './SerialConsole.js';
import type { SerialMessage, BaudRate } from '../../utils/serial.js';

interface CodeWorkspacePanelProps {
  isOpen: boolean;
  onToggle: () => void;
  language: SupportedLanguage;
  code: string;
  isReadOnly?: boolean;
  onStopSimulation?: () => void;
  onCodeChange: (value: string | undefined) => void;
  onLanguageChange: (lang: SupportedLanguage) => void;
  serialMessages: SerialMessage[];
  baudRate: BaudRate;
  onBaudRateChange: (rate: BaudRate) => void;
  onSendSerialMessage: (text: string) => void;
  onClearSerial: () => void;
}

export const CodeWorkspacePanel: React.FC<CodeWorkspacePanelProps> = ({
  isOpen,
  onToggle,
  language,
  code,
  isReadOnly,
  onStopSimulation,
  onCodeChange,
  onLanguageChange,
  serialMessages,
  baudRate,
  onBaudRateChange,
  onSendSerialMessage,
  onClearSerial
}) => {
  const [activeTab, setActiveTab] = useState<'CODE' | 'SERIAL'>('CODE');

  return (
    <aside
      className={`absolute top-0 right-0 h-full z-20 flex transition-all duration-300 ease-in-out ${
        isOpen ? 'w-[520px]' : 'w-0'
      }`}
    >
      {/* Toggle Tab Button (Flutuante na borda esquerda do painel) */}
      <div className="relative">
        <button
          onClick={onToggle}
          title={isOpen ? 'Recolher Painel de Código' : 'Abrir Painel de Código e Terminal'}
          className="absolute top-20 -left-10 z-30 p-2 rounded-l-lg bg-[#1a1a1e] border-y border-l border-[#2e2e34] text-zinc-300 hover:text-[#00e599] transition-colors shadow-2xl cursor-pointer"
        >
          {isOpen ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      {/* Conteúdo Principal do Painel */}
      {isOpen && (
        <div className="w-full h-full flex flex-col bg-[#141417] border-l border-[#2e2e34] shadow-2xl overflow-hidden">
          {/* Header Superior com Abas */}
          <div className="flex items-center justify-between px-3 py-2 bg-[#1a1a1e] border-b border-[#2e2e34]">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('CODE')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'CODE'
                    ? 'bg-[#27272a] text-[#00e599] shadow-sm border border-[#00e599]/30'
                    : 'text-zinc-400 hover:text-white hover:bg-[#202024]'
                }`}
              >
                <Code className="w-4 h-4" />
                <span>Editor ({language === 'CPP' ? 'C++' : 'Python'})</span>
              </button>

              <button
                onClick={() => setActiveTab('SERIAL')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'SERIAL'
                    ? 'bg-[#27272a] text-[#00e599] shadow-sm border border-[#00e599]/30'
                    : 'text-zinc-400 hover:text-white hover:bg-[#202024]'
                }`}
              >
                <Terminal className="w-4 h-4" />
                <span>Monitor Serial</span>
                {serialMessages.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                    {serialMessages.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Área de Visualização Ativa */}
          <div className="flex-1 min-h-0 flex flex-col">
            {activeTab === 'CODE' ? (
              <CodeEditor
                language={language}
                code={code}
                isReadOnly={isReadOnly}
                onStopSimulation={onStopSimulation}
                onChange={onCodeChange}
                onLanguageChange={onLanguageChange}
              />
            ) : (
              <SerialConsole
                messages={serialMessages}
                baudRate={baudRate}
                onBaudRateChange={onBaudRateChange}
                onSendMessage={onSendSerialMessage}
                onClear={onClearSerial}
              />
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
