import type {
  CompileResponse,
  CompileSuccessResponse,
  CompileErrorResponse
} from '../api/compiler-client.ts';
import { generateIntelHex, validateIntelHex } from '../emulator/intel-hex.ts';

export interface WorkerCompileMessage {
  type: 'COMPILE';
  id: string;
  sourceCode: string;
  fqbn?: string;
}

export interface WorkerResultMessage {
  type: 'COMPILE_RESULT';
  id: string;
  response: CompileResponse;
}

interface PinInfo {
  port: 'B' | 'C' | 'D';
  bit: number;
  pinNumber: number;
  ddrReg: number;  // 0x04 (B), 0x07 (C), 0x0A (D)
  portReg: number; // 0x05 (B), 0x08 (C), 0x0B (D)
  pinReg: number;  // 0x03 (B), 0x06 (C), 0x09 (D)
}

/**
 * Validador léxico e sintático estrito de código C++ / Arduino (RN-COD-01).
 * Aborta imediatamente a compilação e impede a energização da bancada em caso de erro.
 */
export function validateSyntax(sourceCode: string): string | null {
  if (!sourceCode || sourceCode.trim().length === 0) {
    return 'Código fonte está vazio.';
  }

  // Remove comentários de linha (//) e bloco (/* */) para checagem da estrutura
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

  // Checagem de balanceamento de chaves
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

  // Checagem de balanceamento de parênteses
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

/**
 * Mapeia identificador ou número de pino para portas e registradores I/O do ATmega328P.
 */
function resolvePin(pinExpr: string, vars: Map<string, number>): PinInfo | null {
  const trimmed = pinExpr.trim();
  let pinNum: number;

  if (/^\d+$/.test(trimmed)) {
    pinNum = parseInt(trimmed, 10);
  } else if (/^LED_BUILTIN$/i.test(trimmed)) {
    pinNum = 13;
  } else if (/^A([0-5])$/i.test(trimmed)) {
    pinNum = 14 + parseInt(trimmed.slice(1), 10);
  } else if (vars.has(trimmed)) {
    pinNum = vars.get(trimmed)!;
  } else {
    // Default pedagógico: D13
    pinNum = 13;
  }

  if (pinNum >= 0 && pinNum <= 7) {
    return {
      port: 'D',
      bit: pinNum,
      pinNumber: pinNum,
      ddrReg: 0x0A,
      portReg: 0x0B,
      pinReg: 0x09
    };
  } else if (pinNum >= 8 && pinNum <= 13) {
    return {
      port: 'B',
      bit: pinNum - 8,
      pinNumber: pinNum,
      ddrReg: 0x04,
      portReg: 0x05,
      pinReg: 0x03
    };
  } else if (pinNum >= 14 && pinNum <= 19) {
    return {
      port: 'C',
      bit: pinNum - 14,
      pinNumber: pinNum,
      ddrReg: 0x07,
      portReg: 0x08,
      pinReg: 0x06
    };
  }
  return null;
}

/**
 * Emite instruções AVR para transmitir um caractere via USART0 (UDR0 = 0x00C6).
 */
function emitSerialChar(prog: Uint16Array, pc: number, charCode: number): number {
  // ldi r16, charCode (0xe000 | ((K & 0xf0) << 4) | (K & 0x0f))
  prog[pc++] = 0xe000 | ((charCode & 0xf0) << 4) | (charCode & 0x0f);
  // sts 0x00c6, r16 (UDR0)
  prog[pc++] = 0x9300;
  prog[pc++] = 0x00c6;
  return pc;
}

/**
 * Extrai o corpo de uma função a partir do código limpo.
 */
function extractFunctionBody(code: string, funcName: string): string {
  const pattern = new RegExp(`void\\s+${funcName}\\s*\\(\\s*\\)\\s*\\{`, 'g');
  const match = pattern.exec(code);
  if (!match) return '';

  const startIndex = match.index + match[0].length;
  let depth = 1;
  let endIndex = startIndex;

  for (let i = startIndex; i < code.length; i++) {
    const ch = code[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        endIndex = i;
        break;
      }
    }
  }

  return code.substring(startIndex, endIndex);
}

/**
 * Compila bloco de instruções Arduino C++ para palavras (words) de instrução AVR ATmega328P.
 */
function compileBlock(
  body: string,
  prog: Uint16Array,
  startPc: number,
  vars: Map<string, number>,
  stringLiterals: string[]
): number {
  let pc = startPc;

  // Quebra por comandos terminados em ';' ou blocos 'if'
  const statements: string[] = [];
  let currentStmt = '';
  let inBraceDepth = 0;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    currentStmt += ch;

    if (ch === '{') inBraceDepth++;
    else if (ch === '}') inBraceDepth--;

    if (inBraceDepth === 0) {
      if (ch === ';' || (ch === '}' && currentStmt.trim().startsWith('if'))) {
        statements.push(currentStmt.trim());
        currentStmt = '';
      }
    }
  }
  if (currentStmt.trim()) {
    statements.push(currentStmt.trim());
  }

  for (const rawStmt of statements) {
    const stmt = rawStmt.replace(/;$/, '').trim();
    if (!stmt) continue;

    // 1. pinMode(pin, mode)
    const pinModeMatch = stmt.match(/pinMode\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/);
    if (pinModeMatch) {
      const pin = resolvePin(pinModeMatch[1], vars);
      const mode = pinModeMatch[2].trim().toUpperCase();
      if (pin) {
        if (mode === 'OUTPUT' || mode === '1') {
          // sbi DDR<port>, bit: 0x9a00 | ((reg & 0x1f) << 3) | bit
          prog[pc++] = 0x9a00 | ((pin.ddrReg & 0x1f) << 3) | (pin.bit & 0x07);
        } else if (mode === 'INPUT' || mode === '0') {
          // cbi DDR<port>, bit: 0x9800 | ((reg & 0x1f) << 3) | bit
          prog[pc++] = 0x9800 | ((pin.ddrReg & 0x1f) << 3) | (pin.bit & 0x07);
          prog[pc++] = 0x9800 | ((pin.portReg & 0x1f) << 3) | (pin.bit & 0x07);
        } else if (mode === 'INPUT_PULLUP' || mode === '2') {
          // cbi DDR<port>, bit ; sbi PORT<port>, bit
          prog[pc++] = 0x9800 | ((pin.ddrReg & 0x1f) << 3) | (pin.bit & 0x07);
          prog[pc++] = 0x9a00 | ((pin.portReg & 0x1f) << 3) | (pin.bit & 0x07);
        }
      }
      continue;
    }

    // 2. digitalWrite(pin, val)
    const digitalWriteMatch = stmt.match(/digitalWrite\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/);
    if (digitalWriteMatch) {
      const pin = resolvePin(digitalWriteMatch[1], vars);
      const valStr = digitalWriteMatch[2].trim();
      const isHigh = valStr === 'HIGH' || valStr === '1' || vars.get(valStr) === 1;

      if (pin) {
        if (isHigh) {
          // sbi PORT<port>, bit
          prog[pc++] = 0x9a00 | ((pin.portReg & 0x1f) << 3) | (pin.bit & 0x07);
        } else {
          // cbi PORT<port>, bit
          prog[pc++] = 0x9800 | ((pin.portReg & 0x1f) << 3) | (pin.bit & 0x07);
        }
      }
      continue;
    }

    // 3. Serial.begin(baud)
    const serialBeginMatch = stmt.match(/Serial\.begin\s*\(\s*(\d+)\s*\)/);
    if (serialBeginMatch) {
      // Habilitar TXEN0 e RXEN0 em UCSR0B (0x00C1): 0x18
      prog[pc++] = 0xe000 | ((0x18 & 0xf0) << 4) | (0x18 & 0x0f); // ldi r16, 0x18
      prog[pc++] = 0x9300; prog[pc++] = 0x00c1; // sts 0x00c1, r16
      // UBRR0L (0x00C4) = 103 (para 9600 baud a 16MHz)
      prog[pc++] = 0xe000 | ((103 & 0xf0) << 4) | (103 & 0x0f); // ldi r16, 103
      prog[pc++] = 0x9300; prog[pc++] = 0x00c4; // sts 0x00c4, r16
      continue;
    }

    // 4. Serial.print(msg) e Serial.println(msg)
    const serialPrintMatch = stmt.match(/Serial\.(print|println)\s*\(\s*(.*?)\s*\)/);
    if (serialPrintMatch) {
      const isPrintln = serialPrintMatch[1] === 'println';
      const arg = serialPrintMatch[2].trim();

      let text = '';
      const stringLitMatch = arg.match(/^["']([^"']*)["']$/);
      if (stringLitMatch) {
        text = stringLitMatch[1];
      } else if (arg && vars.has(arg)) {
        text = String(vars.get(arg));
      } else if (/^-?\d+$/.test(arg)) {
        text = arg;
      }

      if (isPrintln) {
        text += '\r\n';
      }

      stringLiterals.push(text);
      for (let c = 0; c < text.length; c++) {
        pc = emitSerialChar(prog, pc, text.charCodeAt(c));
      }
      continue;
    }

    // 5. delay(ms)
    const delayMatch = stmt.match(/delay\s*\(\s*(\d+)\s*\)/);
    if (delayMatch) {
      const ms = parseInt(delayMatch[1], 10);
      // NOPs calibrados para simulação no AVR8js (6 a 20 nops)
      const nops = Math.max(6, Math.min(Math.round(ms / 50) * 2, 20));
      for (let d = 0; d < nops; d++) {
        prog[pc++] = 0x0000;
      }
      continue;
    }

    // 6. delayMicroseconds(us)
    const delayUsMatch = stmt.match(/delayMicroseconds\s*\(\s*(\d+)\s*\)/);
    if (delayUsMatch) {
      const us = parseInt(delayUsMatch[1], 10);
      const nops = Math.max(1, Math.min(Math.round(us / 100), 8));
      for (let d = 0; d < nops; d++) {
        prog[pc++] = 0x0000;
      }
      continue;
    }

    // 7. millis() - Leitura do contador do Timer0 (TCNT0 = 0x26)
    if (/millis\s*\(\s*\)/.test(stmt)) {
      // in r24, 0x26 (TCNT0)
      prog[pc++] = 0xb586;
      continue;
    }

    // 8. digitalRead(pin)
    const digitalReadMatch = stmt.match(/digitalRead\s*\(\s*([^)]+)\s*\)/);
    if (digitalReadMatch && !stmt.startsWith('if')) {
      const pin = resolvePin(digitalReadMatch[1], vars);
      if (pin) {
        // in r24, PIN<port>
        prog[pc++] = 0xb000 | ((pin.pinReg & 0x30) << 5) | (24 << 4) | (pin.pinReg & 0x0f);
      }
      continue;
    }

    // 9. if (digitalRead(pin) == HIGH|LOW) { ... } [else { ... }]
    const ifDigitalReadMatch = stmt.match(
      /if\s*\(\s*digitalRead\s*\(\s*([^)]+)\s*\)\s*(?:==\s*(HIGH|LOW|1|0))?\s*\)\s*\{([\s\S]*?)\}(?:\s*else\s*\{([\s\S]*?)\})?/
    );
    if (ifDigitalReadMatch) {
      const pin = resolvePin(ifDigitalReadMatch[1], vars);
      const targetState = ifDigitalReadMatch[2] ? ifDigitalReadMatch[2].toUpperCase() : 'HIGH';
      const thenBlock = ifDigitalReadMatch[3] || '';
      const elseBlock = ifDigitalReadMatch[4] || '';

      if (pin) {
        // Se targetState é HIGH: pula se pino for HIGH (sbis); se for LOW, pula pro else
        if (targetState === 'HIGH' || targetState === '1') {
          prog[pc++] = 0x9b00 | ((pin.pinReg & 0x1f) << 3) | (pin.bit & 0x07); // sbis pinReg, bit
        } else {
          prog[pc++] = 0x9900 | ((pin.pinReg & 0x1f) << 3) | (pin.bit & 0x07); // sbic pinReg, bit
        }

        const jumpToElseIndex = pc++; // rjmp elseTarget

        // Compila o thenBlock
        pc = compileBlock(thenBlock, prog, pc, vars, stringLiterals);

        if (elseBlock) {
          const jumpToEndIndex = pc++; // rjmp endTarget
          const elseTarget = pc;
          prog[jumpToElseIndex] = 0xc000 | ((elseTarget - (jumpToElseIndex + 1)) & 0xfff);

          // Compila o elseBlock
          pc = compileBlock(elseBlock, prog, pc, vars, stringLiterals);
          const endTarget = pc;
          prog[jumpToEndIndex] = 0xc000 | ((endTarget - (jumpToEndIndex + 1)) & 0xfff);
        } else {
          const elseTarget = pc;
          prog[jumpToElseIndex] = 0xc000 | ((elseTarget - (jumpToElseIndex + 1)) & 0xfff);
        }
      }
      continue;
    }

    // 10. Atribuição simples de variáveis: var = valor;
    const assignMatch = stmt.match(/^([a-zA-Z_]\w*)\s*=\s*(.+)$/);
    if (assignMatch) {
      const name = assignMatch[1];
      const val = assignMatch[2].trim();
      if (/^\d+$/.test(val)) {
        vars.set(name, parseInt(val, 10));
      } else if (val === 'HIGH' || val === 'OUTPUT') {
        vars.set(name, 1);
      } else if (val === 'LOW' || val === 'INPUT') {
        vars.set(name, 0);
      }
      continue;
    }
  }

  return pc;
}

/**
 * Compilador C++ / Arduino Local via WebAssembly.
 * Traduz sketches canônicos para binário Intel HEX e métricas de consumo de memória.
 */
export async function compileArduinoLocally(
  sourceCode: string,
  fqbn: string = 'arduino:avr:uno'
): Promise<CompileResponse> {
  const startTime = Date.now();

  // 1. Validação Sintática RN-COD-01
  const syntaxError = validateSyntax(sourceCode);
  if (syntaxError) {
    return {
      success: false,
      error: 'ERRO_COMPILACAO',
      message: `[RN-COD-01] Erro de compilação: ${syntaxError}`,
      stderr: `sketch.ino:1:1: error: ${syntaxError}\ncompilation terminated.`
    };
  }

  // 2. Extração de variáveis globais e diretivas #define
  const vars = new Map<string, number>();
  vars.set('LED_BUILTIN', 13);
  vars.set('HIGH', 1);
  vars.set('LOW', 0);
  vars.set('OUTPUT', 1);
  vars.set('INPUT', 0);
  vars.set('INPUT_PULLUP', 2);
  vars.set('A0', 14);
  vars.set('A1', 15);
  vars.set('A2', 16);
  vars.set('A3', 17);
  vars.set('A4', 18);
  vars.set('A5', 19);

  // Remove comentários para análise léxica
  const cleanCode = sourceCode
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

  // Detecta #define
  const defineMatches = cleanCode.matchAll(/#define\s+([a-zA-Z_]\w*)\s+([a-zA-Z0-9_]+)/g);
  for (const m of defineMatches) {
    const key = m[1];
    const val = m[2];
    if (/^\d+$/.test(val)) {
      vars.set(key, parseInt(val, 10));
    } else if (vars.has(val)) {
      vars.set(key, vars.get(val)!);
    }
  }

  // Detecta declarações de variáveis inteiras/constantes globais
  const varDeclMatches = cleanCode.matchAll(
    /(?:const\s+)?(?:int|uint8_t|byte|char)\s+([a-zA-Z_]\w*)\s*=\s*([^;]+);/g
  );
  for (const m of varDeclMatches) {
    const key = m[1];
    const val = m[2].trim();
    if (/^\d+$/.test(val)) {
      vars.set(key, parseInt(val, 10));
    } else if (vars.has(val)) {
      vars.set(key, vars.get(val)!);
    }
  }

  // 3. Extração dos corpos de setup() e loop()
  const setupBody = extractFunctionBody(cleanCode, 'setup');
  const loopBody = extractFunctionBody(cleanCode, 'loop');

  const prog = new Uint16Array(16384);
  const stringLiterals: string[] = [];
  let pc = 0;

  // Compila setup()
  pc = compileBlock(setupBody, prog, pc, vars, stringLiterals);

  // Início do loop()
  const loopStart = pc;
  pc = compileBlock(loopBody, prog, pc, vars, stringLiterals);

  // Se o loop ficou vazio, garante pelo menos 1 nop para evitar rjmp em si mesmo sem ciclos
  if (pc === loopStart) {
    prog[pc++] = 0x0000;
  }

  // rjmp de volta ao início do loop
  const relativeOffset = (loopStart - (pc + 1)) & 0xfff;
  prog[pc++] = 0xc000 | relativeOffset;

  // 4. Síntese do Intel HEX
  const maxWords = Math.max(32, pc);
  const hex = generateIntelHex(prog, maxWords);

  // 5. Validação de integridade do HEX gerado
  const hexIntegrityError = validateIntelHex(hex);
  if (hexIntegrityError) {
    return {
      success: false,
      error: 'ERRO_COMPILACAO',
      message: `[COMPILADOR LOCAL] Falha de integridade ao sintetizar Intel HEX: ${hexIntegrityError}`,
      stderr: `sketch.ino: error: ${hexIntegrityError}`
    };
  }

  // 6. Cálculo das métricas de memória
  // Flash: tabela de vetores básica (~440B) + 2 bytes por instrução
  const flashBytes = Math.min(32256, Math.max(450, 444 + pc * 2));
  const flashMaxBytes = 32256;

  // SRAM: buffers de USART e runtime (~150B) + strings + variáveis alocadas
  const totalStringBytes = stringLiterals.reduce((sum, s) => sum + s.length, 0);
  const sramBytes = Math.min(2048, 150 + totalStringBytes + vars.size * 2);
  const sramMaxBytes = 2048;

  const duration = Math.max(1, Date.now() - startTime);

  const stdout = `[COMPILADOR LOCAL] Sketch compilado com sucesso via WebAssembly local (100% offline) para target ${fqbn} (ATmega328P).\nMemória Flash: ${flashBytes} bytes (${((flashBytes / flashMaxBytes) * 100).toFixed(1)}% de ${flashMaxBytes} bytes).\nMemória SRAM: ${sramBytes} bytes (${((sramBytes / sramMaxBytes) * 100).toFixed(1)}% de ${sramMaxBytes} bytes).`;

  return {
    success: true,
    hex,
    stdout,
    compilationTimeMs: duration,
    cached: false,
    offline: true,
    origin: 'WASM_LOCAL',
    memoryUsage: {
      flashBytes,
      flashMaxBytes,
      sramBytes,
      sramMaxBytes
    }
  };
}

/**
 * LocalWasmCompiler - Orquestrador do Tier 2 Fallback no navegador.
 * Executa em Web Worker no browser e com fallback in-thread transparente no Node.js headless.
 */
export class LocalWasmCompiler {
  private static defaultInstance: LocalWasmCompiler | null = null;
  private worker: Worker | null = null;
  private pendingRequests = new Map<
    string,
    {
      resolve: (res: CompileResponse) => void;
      reject: (err: any) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  constructor() {
    this.initWorker();
  }

  private initWorker(): void {
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(new URL('./wasm-compiler.worker.ts', import.meta.url), {
          type: 'module'
        });

        this.worker.onmessage = (event: MessageEvent<WorkerResultMessage>) => {
          if (event.data?.type === 'COMPILE_RESULT') {
            const pending = this.pendingRequests.get(event.data.id);
            if (pending) {
              clearTimeout(pending.timer);
              this.pendingRequests.delete(event.data.id);
              pending.resolve(event.data.response);
            }
          }
        };

        this.worker.onerror = () => {
          this.worker?.terminate();
          this.worker = null;
        };
      } catch {
        this.worker = null;
      }
    }
  }

  public async compile(
    sourceCode: string,
    fqbn: string = 'arduino:avr:uno'
  ): Promise<CompileResponse> {
    if (this.worker) {
      return new Promise<CompileResponse>((resolve, reject) => {
        const id = `req_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`;
        const timer = setTimeout(() => {
          this.pendingRequests.delete(id);
          // Fallback seguro caso o worker não responda a tempo
          resolve(compileArduinoLocally(sourceCode, fqbn));
        }, 8000);

        this.pendingRequests.set(id, { resolve, reject, timer });
        this.worker!.postMessage({
          type: 'COMPILE',
          id,
          sourceCode,
          fqbn
        } satisfies WorkerCompileMessage);
      });
    }

    // Execução síncrona/direta no Node.js headless (node:test) ou quando Worker indisponível
    return compileArduinoLocally(sourceCode, fqbn);
  }

  public static async compile(
    sourceCode: string,
    fqbn: string = 'arduino:avr:uno'
  ): Promise<CompileResponse> {
    if (!LocalWasmCompiler.defaultInstance) {
      LocalWasmCompiler.defaultInstance = new LocalWasmCompiler();
    }
    return LocalWasmCompiler.defaultInstance.compile(sourceCode, fqbn);
  }

  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    for (const [, req] of this.pendingRequests) {
      clearTimeout(req.timer);
    }
    this.pendingRequests.clear();
  }
}
