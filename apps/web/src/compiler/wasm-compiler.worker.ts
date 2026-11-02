import { compileArduinoLocally } from './local-wasm-compiler.ts';
import type { WorkerCompileMessage, WorkerResultMessage } from './local-wasm-compiler.ts';

/**
 * Web Worker dedicado para compilação C++ / Arduino em background.
 * Evita concorrer com a thread principal de renderização do Konva (preservando 60 FPS).
 */
if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
  self.addEventListener('message', async (event: MessageEvent<WorkerCompileMessage>) => {
    if (event.data?.type === 'COMPILE') {
      const { id, sourceCode, fqbn } = event.data;
      const response = await compileArduinoLocally(sourceCode, fqbn);
      self.postMessage({
        type: 'COMPILE_RESULT',
        id,
        response
      } satisfies WorkerResultMessage);
    }
  });
}
