import React, { useState, useRef, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import {
  Code2,
  FileCode,
  Square,
  Lock,
  CheckCircle2,
  Cpu,
  Sparkles,
  Layers
} from 'lucide-react';

export type SupportedLanguage = 'CPP' | 'PYTHON';

interface CodeEditorProps {
  language: SupportedLanguage;
  code: string;
  isReadOnly?: boolean;
  onStopSimulation?: () => void;
  onChange: (value: string | undefined) => void;
  onLanguageChange: (lang: SupportedLanguage) => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  language,
  code,
  isReadOnly = false,
  onStopSimulation,
  onChange,
  onLanguageChange
}) => {
  const monacoLanguage = language === 'CPP' ? 'cpp' : 'python';
  const [editorEngine, setEditorEngine] = useState<'NATIVE' | 'MONACO'>('NATIVE');
  const [monacoAvailable, setMonacoAvailable] = useState<boolean | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // Calcula linhas totais
  const lines = code.split('\n');
  const lineCount = lines.length;

  // Sincroniza rolagem da calha de números de linha com o textarea
  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Suporte a indentação com TAB e auto-indent no ENTER no editor nativo
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isReadOnly) return;
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { selectionStart, selectionEnd, value } = textarea;

    // Tecla TAB (2 espaços)
    if (e.key === 'Tab') {
      e.preventDefault();
      const tabSpaces = '  ';

      if (e.shiftKey) {
        // Shift+Tab: Desindenta linha atual
        const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
        if (value.substring(lineStart, lineStart + 2) === tabSpaces) {
          const nextVal = value.substring(0, lineStart) + value.substring(lineStart + 2);
          onChange(nextVal);
          requestAnimationFrame(() => {
            textarea.selectionStart = Math.max(lineStart, selectionStart - 2);
            textarea.selectionEnd = Math.max(lineStart, selectionEnd - 2);
          });
        }
      } else {
        // Tab: Insere 2 espaços na posição do cursor
        const nextVal = value.substring(0, selectionStart) + tabSpaces + value.substring(selectionEnd);
        onChange(nextVal);
        requestAnimationFrame(() => {
          textarea.selectionStart = selectionStart + 2;
          textarea.selectionEnd = selectionStart + 2;
        });
      }
      return;
    }

    // Tecla ENTER (preserva indentação da linha anterior + auto-indent após '{')
    if (e.key === 'Enter') {
      const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
      const currentLine = value.substring(lineStart, selectionStart);
      const match = currentLine.match(/^\s*/);
      let indent = match ? match[0] : '';

      if (currentLine.trimEnd().endsWith('{')) {
        indent += '  ';
      }

      if (indent.length > 0) {
        e.preventDefault();
        const insertText = '\n' + indent;
        const nextVal = value.substring(0, selectionStart) + insertText + value.substring(selectionEnd);
        onChange(nextVal);
        requestAnimationFrame(() => {
          textarea.selectionStart = selectionStart + insertText.length;
          textarea.selectionEnd = selectionStart + insertText.length;
        });
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#141417]">
      {/* Editor Sub-Header: Seleção de Arquivo e Alternância de Engine */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#1a1a1e] border-b border-[#2e2e34]">
        {/* Abas de Arquivo (C++ vs Python) */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onLanguageChange('CPP')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
              language === 'CPP'
                ? 'bg-[#27272a] text-[#00e599] border border-[#00e599]/40 shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-[#202024]'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>sketch.ino (C++)</span>
          </button>

          <button
            onClick={() => onLanguageChange('PYTHON')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
              language === 'PYTHON'
                ? 'bg-[#27272a] text-[#00e599] border border-[#00e599]/40 shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-[#202024]'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>main.py (Python)</span>
          </button>
        </div>

        {/* Engine Switcher (Nativo 100% Offline vs Monaco CDN) */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setEditorEngine(editorEngine === 'NATIVE' ? 'MONACO' : 'NATIVE')}
            title={
              editorEngine === 'NATIVE'
                ? 'Atualmente no Editor Nativo (Instantâneo e 100% Offline). Clique para alternar para Monaco Editor.'
                : 'Atualmente no Monaco Editor. Clique para alternar para o Editor Nativo.'
            }
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-[#202024] hover:bg-[#27272a] text-zinc-300 border border-[#2e2e34] transition-colors cursor-pointer"
          >
            <Layers className="w-3 h-3 text-[#00e599]" />
            <span>{editorEngine === 'NATIVE' ? 'Nativo (Offline)' : 'Monaco'}</span>
          </button>
        </div>
      </div>

      {/* Banner de Aviso de Simulação Ativa (Somente Leitura - RN-BNC-01) */}
      {isReadOnly && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-amber-950/80 border-b border-amber-600/40 text-amber-300 text-xs font-mono">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>SIMULAÇÃO ATIVA: Edição bloqueada (RN-BNC-01)</span>
          </div>

          {onStopSimulation && (
            <button
              onClick={onStopSimulation}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-black font-bold text-[11px] transition-colors cursor-pointer"
            >
              <Square className="w-3 h-3 fill-black" />
              <span>Parar para Editar</span>
            </button>
          )}
        </div>
      )}

      {/* Área Central de Edição */}
      <div className="flex-1 w-full min-h-0 relative">
        {editorEngine === 'NATIVE' ? (
          /* Editor de Código Nativo Webboard (100% Offline, Zero Atraso, Calha de Linhas) */
          <div className="flex w-full h-full font-mono text-xs bg-[#121215] text-zinc-200 overflow-hidden">
            {/* Calha de Números de Linha */}
            <div
              ref={lineNumbersRef}
              className="w-12 py-3 bg-[#16161a] border-r border-[#27272a] text-zinc-600 text-right pr-2 select-none overflow-hidden shrink-0 leading-5"
            >
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i + 1}>{i + 1}</div>
              ))}
            </div>

            {/* Textarea de Edição com Destaque e Comportamento IDE */}
            <textarea
              ref={textareaRef}
              value={code}
              readOnly={isReadOnly}
              onChange={(e) => onChange(e.target.value)}
              onScroll={handleScroll}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect="off"
              className={`flex-1 w-full h-full p-3 bg-transparent resize-none outline-none leading-5 font-mono text-xs overflow-auto ${
                isReadOnly ? 'text-zinc-400 cursor-not-allowed' : 'text-emerald-300'
              }`}
              style={{
                tabSize: 2,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace"
              }}
              placeholder="// Digite aqui seu código Arduino C++..."
            />
          </div>
        ) : (
          /* Monaco Editor com Carregamento Gracioso e Fallback Seguro */
          <div className="w-full h-full">
            <Editor
              height="100%"
              language={monacoLanguage}
              value={code}
              theme="vs-dark"
              loading={
                <div className="flex flex-col items-center justify-center h-full text-zinc-500 font-mono text-xs gap-2">
                  <Cpu className="w-6 h-6 animate-pulse text-[#00e599]" />
                  <span>Carregando Monaco Editor...</span>
                  <button
                    onClick={() => setEditorEngine('NATIVE')}
                    className="mt-2 px-2.5 py-1 rounded bg-[#202024] text-zinc-300 border border-[#2e2e34] hover:text-[#00e599]"
                  >
                    Usar Editor Nativo (Instantâneo)
                  </button>
                </div>
              }
              options={{
                readOnly: isReadOnly,
                fontSize: 13,
                minimap: { enabled: false },
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                renderLineHighlight: 'all',
                overviewRulerBorder: false,
                folding: true
              }}
              onChange={onChange}
            />
          </div>
        )}
      </div>

      {/* Footer do Editor: Estatísticas e Alvo */}
      <div className="flex items-center justify-between px-3 py-1 bg-[#1a1a1e] border-t border-[#2e2e34] text-[11px] font-mono text-zinc-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-[#00e599]" />
            <span>Target: ATmega328P (16MHz)</span>
          </span>
          <span>•</span>
          <span>Linhas: {lineCount}</span>
          <span>•</span>
          <span>Caracteres: {code.length}</span>
        </div>

        <div className="flex items-center gap-2 text-zinc-500">
          <span>{editorEngine === 'NATIVE' ? 'Engine: Nativo 100% Offline' : 'Engine: Monaco'}</span>
        </div>
      </div>
    </div>
  );
};
