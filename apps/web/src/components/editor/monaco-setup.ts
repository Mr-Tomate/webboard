import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import EditorWorker from './editor.worker?worker';

/**
 * Configuração do Monaco Editor para execução 100% Offline via Vite Pipeline.
 *
 * Conecta o wrapper @monaco-editor/react à biblioteca monaco-editor compilada pelo Vite
 * e delega o worker para a thread nativa do navegador usando um worker local.
 */
if (typeof window !== 'undefined') {
  (window as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
    getWorker(_: unknown, _label: string) {
      return new EditorWorker();
    }
  };

  loader.config({ monaco });
}

export { monaco };
