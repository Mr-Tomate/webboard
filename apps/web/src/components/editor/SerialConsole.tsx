import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal,
  Trash2,
  Send,
  Clock,
  ArrowDownCircle,
  Radio
} from 'lucide-react';
import {
  type SerialMessage,
  type BaudRate,
  SUPPORTED_BAUD_RATES
} from '../../utils/serial.js';

interface SerialConsoleProps {
  messages: SerialMessage[];
  baudRate: BaudRate;
  onBaudRateChange: (rate: BaudRate) => void;
  onSendMessage: (text: string) => void;
  onClear: () => void;
}

export const SerialConsole: React.FC<SerialConsoleProps> = ({
  messages,
  baudRate,
  onBaudRateChange,
  onSendMessage,
  onClear
}) => {
  const [inputText, setInputText] = useState('');
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [messages, autoScroll]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const getMessageColor = (direction: SerialMessage['direction']) => {
    switch (direction) {
      case 'RX':
        return 'text-emerald-400';
      case 'TX':
        return 'text-sky-400';
      case 'ERROR':
        return 'text-rose-400 font-bold';
      case 'SYSTEM':
      default:
        return 'text-zinc-400';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#121214] font-mono text-xs">
      {/* Console Top Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#1a1a1e] border-b border-[#2e2e34]">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-[#00e599]" />
          <span className="font-semibold text-zinc-300">Monitor Serial</span>

          <div className="flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded bg-[#242429] border border-[#2e2e34]">
            <Radio className="w-3 h-3 text-[#00e599] animate-pulse" />
            <select
              value={baudRate}
              onChange={(e) => onBaudRateChange(Number(e.target.value) as BaudRate)}
              className="bg-transparent text-[11px] text-zinc-200 focus:outline-none cursor-pointer"
            >
              {SUPPORTED_BAUD_RATES.map((rate) => (
                <option key={rate} value={rate} className="bg-[#1a1a1e] text-white">
                  {rate} baud
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowTimestamps(!showTimestamps)}
            title="Alternar carimbo de data/hora"
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              showTimestamps ? 'text-[#00e599] bg-[#27272a]' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            title="Alternar rolagem automática"
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              autoScroll ? 'text-[#00e599] bg-[#27272a]' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <ArrowDownCircle className="w-3.5 h-3.5" />
          </button>

          <div className="h-3 w-px bg-[#2e2e34] mx-1" />

          <button
            onClick={onClear}
            title="Limpar saída serial"
            className="p-1.5 rounded text-zinc-400 hover:text-rose-400 hover:bg-[#27272a] transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Message Output Window */}
      <div
        ref={logContainerRef}
        className="flex-1 overflow-y-auto p-3 space-y-1 select-text bg-[#0e0e11]"
      >
        {messages.length === 0 ? (
          <div className="text-zinc-600 italic py-4 text-center select-none">
            Nenhuma mensagem recebida na porta serial. Energize a bancada para iniciar a transmissão.
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="flex items-baseline gap-2 leading-relaxed">
              {showTimestamps && (
                <span className="text-[10px] text-zinc-600 select-none shrink-0">
                  [{msg.timestamp}]
                </span>
              )}
              <span className={`shrink-0 text-[10px] font-bold ${
                msg.direction === 'TX' ? 'text-sky-500' : 'text-emerald-500'
              }`}>
                {msg.direction === 'TX' ? '>>' : '<<'}
              </span>
              <span className={`break-all ${getMessageColor(msg.direction)}`}>
                {msg.text}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Serial Input Bar */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 p-2 bg-[#1a1a1e] border-t border-[#2e2e34]"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Enviar comando via UART (ex: 1, 0, STATUS)..."
          className="flex-1 bg-[#121214] border border-[#2e2e34] rounded px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-[#00e599]"
        />
        <button
          type="submit"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#00e599] hover:bg-[#00c985] text-black font-semibold text-xs transition-colors cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Enviar</span>
        </button>
      </form>
    </div>
  );
};
