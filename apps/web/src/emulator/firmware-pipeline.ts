import type { CompileResponse } from '../api/compiler-client.ts';
import { hexToProgramWords, validateIntelHex } from './intel-hex.ts';
import { createDefaultBlinkFirmware } from './firmware-samples.ts';

/**
 * Pipeline de Firmware: Monaco Editor → compiler-worker (POST /compile) → Intel HEX → flash AVR8js.
 *
 * Função pura e assíncrona (sem React), para que a regra "compilação reprovada aborta
 * a energização da bancada" seja testável de forma headless.
 */

export interface FirmwareCompiler {
  compile(sourceCode: string, fqbn?: string): Promise<CompileResponse>;
}

export type FirmwareLogLevel = 'SYSTEM' | 'ERROR';

export interface FirmwareLog {
  level: FirmwareLogLevel;
  text: string;
}

/** Origem do firmware gravado na flash virtual. */
export type FirmwareOrigin = 'COMPILED' | 'CACHED' | 'OFFLINE_FALLBACK';

export type FirmwareBuildResult =
  | { ok: true; program: Uint16Array; origin: FirmwareOrigin; logs: FirmwareLog[] }
  | { ok: false; logs: FirmwareLog[] };

export interface BuildFirmwareOptions {
  fqbn?: string;
  /** Máximo de linhas de stderr repassadas ao Monitor Serial. */
  maxStderrLines?: number;
}

function percent(used: number, max: number): string {
  if (!max) return '0.0';
  return ((used / max) * 100).toFixed(1);
}

export async function buildFirmware(
  compiler: FirmwareCompiler,
  sourceCode: string,
  options: BuildFirmwareOptions = {}
): Promise<FirmwareBuildResult> {
  const fqbn = options.fqbn ?? 'arduino:avr:uno';
  const maxStderrLines = options.maxStderrLines ?? 20;
  const logs: FirmwareLog[] = [
    { level: 'SYSTEM', text: `[COMPILADOR] Compilando sketch.ino para ${fqbn}...` }
  ];

  const abort = (): FirmwareBuildResult => {
    logs.push({
      level: 'ERROR',
      text: '[COMPILADOR] Energização abortada. Corrija o código e tente novamente.'
    });
    return { ok: false, logs };
  };

  let response: CompileResponse;
  try {
    response = await compiler.compile(sourceCode, fqbn);
  } catch (err: any) {
    logs.push({
      level: 'ERROR',
      text: `[COMPILADOR] Falha inesperada no cliente de compilação: ${err?.message ?? String(err)}`
    });
    return abort();
  }

  if (!response.success) {
    logs.push({ level: 'ERROR', text: response.message });
    const stderrLines = (response.stderr ?? '')
      .split(/\r?\n/)
      .map((l) => l.trimEnd())
      .filter((l) => l.length > 0);
    for (const line of stderrLines.slice(0, maxStderrLines)) {
      logs.push({ level: 'ERROR', text: line });
    }
    if (stderrLines.length > maxStderrLines) {
      logs.push({
        level: 'ERROR',
        text: `... (${stderrLines.length - maxStderrLines} linha(s) de stderr omitidas)`
      });
    }
    return abort();
  }

  // Compiler-worker inalcançável: sketch aprovado na validação local, mas sem binário real.
  if (!response.hex) {
    logs.push({ level: 'SYSTEM', text: response.stdout });
    logs.push({
      level: 'SYSTEM',
      text: '[COMPILADOR] Gravando firmware de demonstração (Blink D13) na flash virtual.'
    });
    return { ok: true, program: createDefaultBlinkFirmware(), origin: 'OFFLINE_FALLBACK', logs };
  }

  const hexError = validateIntelHex(response.hex);
  if (hexError) {
    logs.push({ level: 'ERROR', text: `[COMPILADOR] Firmware Intel HEX corrompido: ${hexError}` });
    return abort();
  }

  const program = hexToProgramWords(response.hex);
  const { flashBytes, flashMaxBytes, sramBytes, sramMaxBytes } = response.memoryUsage;
  const origin: FirmwareOrigin = response.cached ? 'CACHED' : 'COMPILED';

  logs.push({
    level: 'SYSTEM',
    text: response.cached
      ? '[COMPILADOR] Binário reaproveitado do cache SHA-256 (0 ms).'
      : `[COMPILADOR] Compilação concluída em ${response.compilationTimeMs} ms.`
  });
  logs.push({
    level: 'SYSTEM',
    text: `[COMPILADOR] Flash: ${flashBytes}/${flashMaxBytes} bytes (${percent(flashBytes, flashMaxBytes)}%) • SRAM: ${sramBytes}/${sramMaxBytes} bytes (${percent(sramBytes, sramMaxBytes)}%).`
  });

  return { ok: true, program, origin, logs };
}
