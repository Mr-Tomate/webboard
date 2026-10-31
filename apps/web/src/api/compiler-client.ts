export interface CompileSuccessResponse {
  success: true;
  hex: string;
  stdout: string;
  compilationTimeMs: number;
  cached: boolean;
  memoryUsage: {
    flashBytes: number;
    flashMaxBytes: number;
    sramBytes: number;
    sramMaxBytes: number;
  };
  /** Presente (true) somente quando o resultado veio da validação local por falta de rede. */
  offline?: boolean;
}

export interface CompileErrorResponse {
  success: false;
  error: 'ERRO_COMPILACAO';
  message: string;
  stderr: string;
}

export type CompileResponse = CompileSuccessResponse | CompileErrorResponse;

export interface CompilerClientOptions {
  /** Tempo máximo de espera pela resposta do compiler-worker (ms). */
  timeoutMs?: number;
}

/**
 * Validação sintática RN-COD-01 espelhada do compiler-worker
 * (apps/compiler-worker/src/compiler.ts → ArduinoCompiler.validateSyntax).
 * Retorna a mensagem de erro ou null se o sketch for estruturalmente válido.
 */
export function validateArduinoSketch(sourceCode: string): string | null {
  if (!sourceCode || sourceCode.trim().length === 0) {
    return 'Código fonte está vazio.';
  }

  const cleanCode = sourceCode
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

  const hasSetup = /void\s+setup\s*\(\s*\)/.test(cleanCode);
  const hasLoop = /void\s+loop\s*\(\s*\)/.test(cleanCode);
  const hasMain = /int\s+main\s*\(\s*\)/.test(cleanCode);

  if (!hasMain && (!hasSetup || !hasLoop)) {
    if (!hasSetup && !hasLoop) {
      return "Funções obrigatórias 'void setup()' e 'void loop()' não foram encontradas.";
    }
    if (!hasSetup) return "Função obrigatória 'void setup()' não foi encontrada.";
    return "Função obrigatória 'void loop()' não foi encontrada.";
  }

  let openBraces = 0;
  for (const ch of cleanCode) {
    if (ch === '{') openBraces++;
    if (ch === '}') openBraces--;
    if (openBraces < 0) {
      return 'Chave de fechamento "}" sem chave de abertura correspondente.';
    }
  }
  if (openBraces !== 0) {
    return `Chaves desbalanceadas: ${openBraces} bloco(s) não foram fechados com "}".`;
  }

  let openParens = 0;
  for (const ch of cleanCode) {
    if (ch === '(') openParens++;
    if (ch === ')') openParens--;
    if (openParens < 0) {
      return 'Parêntese de fechamento ")" sem abertura correspondente.';
    }
  }
  if (openParens !== 0) {
    return 'Parênteses desbalanceados no código.';
  }

  return null;
}

function isCompileResponse(data: unknown): data is CompileResponse {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (d.success === true) return typeof d.hex === 'string';
  if (d.success === false) return typeof d.message === 'string';
  return false;
}

/**
 * CompilerClient - Cliente HTTP de Conexão com o Microserviço de Compilação Fastify.
 *
 * Envia o código C++ do Monaco Editor para a rota POST /compile (porta 3002).
 * - 200 → CompileSuccessResponse (Intel HEX).
 * - 400/422 → CompileErrorResponse (violação RN-COD-01 ou stderr do arduino-cli).
 * - Rede indisponível / timeout → validação local RN-COD-01 com `offline: true` e `hex` vazio.
 * - Resposta malformada (ex.: 500 HTML) → CompileErrorResponse explícito (nunca energiza às cegas).
 *
 * Conforme: docs/spec/07_linguagens_e_toolchains.md
 */
export class CompilerClient {
  private compilerUrl: string;
  private timeoutMs: number;

  constructor(compilerUrl: string = 'http://localhost:3002', options: CompilerClientOptions = {}) {
    this.compilerUrl = compilerUrl.replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? 15000;
  }

  public async compile(
    sourceCode: string,
    fqbn: string = 'arduino:avr:uno'
  ): Promise<CompileResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await fetch(`${this.compilerUrl}/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceCode, fqbn }),
        signal: controller.signal
      });
    } catch (err: any) {
      const reason = err?.name === 'AbortError'
        ? `tempo limite de ${this.timeoutMs}ms excedido`
        : (err?.message ?? 'Serviço offline');
      return this.localFallbackValidation(sourceCode, reason);
    } finally {
      clearTimeout(timer);
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (isCompileResponse(data)) {
      return data;
    }

    return {
      success: false,
      error: 'ERRO_COMPILACAO',
      message: `[COMPILADOR] Resposta inválida do servidor de compilação (HTTP ${res.status}).`,
      stderr: `compiler-worker: unexpected response (status ${res.status})`
    };
  }

  /**
   * Validador local de fallback se o microserviço compiler-worker não estiver rodando no host.
   * Aplica estritamente a validação RN-COD-01 para garantir integridade pedagógica.
   * Em caso de sucesso, devolve `hex` vazio e `offline: true` — o chamador decide o firmware.
   */
  private localFallbackValidation(sourceCode: string, networkError: string): CompileResponse {
    const syntaxError = validateArduinoSketch(sourceCode);
    if (syntaxError) {
      return {
        success: false,
        error: 'ERRO_COMPILACAO',
        message: `[RN-COD-01] Erro de compilação: ${syntaxError}`,
        stderr: `sketch.ino:1:1: error: ${syntaxError}\ncompilation terminated.`
      };
    }

    return {
      success: true,
      hex: '',
      offline: true,
      stdout: `[AVISO] Servidor de compilação offline (${networkError}). Executando com validação sintática local RN-COD-01.`,
      compilationTimeMs: 0,
      cached: false,
      memoryUsage: {
        flashBytes: 0,
        flashMaxBytes: 32256,
        sramBytes: 0,
        sramMaxBytes: 2048
      }
    };
  }
}
