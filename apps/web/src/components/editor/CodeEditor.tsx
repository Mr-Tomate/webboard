import React from 'react';
import Editor from '@monaco-editor/react';
import { Code2, FileCode, Check } from 'lucide-react';

export type SupportedLanguage = 'CPP' | 'PYTHON';

interface CodeEditorProps {
  language: SupportedLanguage;
  code: string;
  isReadOnly?: boolean;
  onChange: (value: string | undefined) => void;
  onLanguageChange: (lang: SupportedLanguage) => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  language,
  code,
  isReadOnly = false,
  onChange,
  onLanguageChange
}) => {
  const monacoLanguage = language === 'CPP' ? 'cpp' : 'python';

  return (
    <div className="flex flex-col h-full bg-[#18181b]">
      {/* Editor Sub-Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#1f1f23] border-b border-[#2e2e34]">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onLanguageChange('CPP')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              language === 'CPP'
                ? 'bg-[#27272a] text-[#00e599] font-bold border border-[#00e599]/40'
                : 'text-[#a1a1aa] hover:text-white hover:bg-[#27272a]'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>sketch.ino (C++)</span>
          </button>

          <button
            onClick={() => onLanguageChange('PYTHON')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              language === 'PYTHON'
                ? 'bg-[#27272a] text-[#00e599] font-bold border border-[#00e599]/40'
                : 'text-[#a1a1aa] hover:text-white hover:bg-[#27272a]'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>main.py (Python)</span>
          </button>
        </div>

        {isReadOnly && (
          <span className="text-[10px] text-amber-400 font-mono bg-amber-950/40 px-2 py-0.5 rounded border border-amber-500/30">
            SIMULAÇÃO ATIVA (SOMENTE LEITURA)
          </span>
        )}
      </div>

      {/* Monaco Editor Container */}
      <div className="flex-1 w-full h-full min-h-0">
        <Editor
          height="100%"
          language={monacoLanguage}
          value={code}
          theme="vs-dark"
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
    </div>
  );
};
