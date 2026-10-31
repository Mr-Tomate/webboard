import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFirmware, type FirmwareCompiler } from '../src/emulator/firmware-pipeline.ts';
import { hexToProgramWords, validateIntelHex } from '../src/emulator/intel-hex.ts';
import { AVRBoard } from '../src/emulator/avr-board.ts';
import type { CompileResponse } from '../src/api/compiler-client.ts';

/** Codifica words AVR (little-endian) em Intel HEX com checksums válidos. */
function wordsToIntelHex(words: number[]): string {
  const bytes: number[] = [];
  for (const w of words) bytes.push(w & 0xff, (w >> 8) & 0xff);

  const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
  const lines: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 16) {
    const chunk = bytes.slice(offset, offset + 16);
    const record = [chunk.length, (offset >> 8) & 0xff, offset & 0xff, 0x00, ...chunk];
    const checksum = (0x100 - (record.reduce((a, b) => a + b, 0) & 0xff)) & 0xff;
    lines.push(':' + [...record, checksum].map(toHex).join(''));
  }
  lines.push(':00000001FF');
  return lines.join('\n');
}

/** Firmware mínimo: transmite "OK\r\n" pela UART e alterna D13 em loop. */
function sampleFirmwareWords(message = 'OK\r\n'): number[] {
  const w: number[] = [];
  for (const ch of message) {
    const c = ch.charCodeAt(0);
    w.push(0xe000 | ((c & 0xf0) << 4) | (c & 0x0f), 0x9300, 0x00c6); // ldi r16,c ; sts UDR0,r16
  }
  w.push(0x9a25); // sbi DDRB,5
  const loop = w.length;
  w.push(0x9a2d, 0x0000, 0x982d, 0x0000); // sbi PORTB,5 ; nop ; cbi PORTB,5 ; nop
  w.push(0xc000 | ((loop - (w.length + 1)) & 0xfff)); // rjmp loop
  return w;
}

function successResponse(hex: string, overrides: Partial<CompileResponse> = {}): CompileResponse {
  return {
    success: true,
    hex,
    stdout: 'Compilação concluída.',
    compilationTimeMs: 37,
    cached: false,
    memoryUsage: { flashBytes: 1240, flashMaxBytes: 32256, sramBytes: 182, sramMaxBytes: 2048 },
    ...overrides
  } as CompileResponse;
}

function stubCompiler(response: CompileResponse | Error): FirmwareCompiler & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async compile(source: string) {
      calls.push(source);
      if (response instanceof Error) throw response;
      return response;
    }
  };
}

test('validateIntelHex: aceita HEX íntegro e rejeita checksum, EOF e conteúdo inválidos', () => {
  const hex = wordsToIntelHex(sampleFirmwareWords());
  assert.equal(validateIntelHex(hex), null);

  assert.match(validateIntelHex('') ?? '', /vazio/);
  assert.match(validateIntelHex(':0400000001020304F3\n:00000001FF') ?? '', /checksum/);
  assert.match(validateIntelHex(':0400000001020304F2') ?? '', /fim de arquivo/);
  assert.match(validateIntelHex(':00000001FF') ?? '', /nenhum registro de dados/);
  assert.match(validateIntelHex('garbage') ?? '', /prefixo/);
  assert.match(validateIntelHex(':04000000010203F2\n:00000001FF') ?? '', /byte count/);
});

test('hexToProgramWords: reconstrói words little-endian na flash de 16K words', () => {
  const words = sampleFirmwareWords();
  const program = hexToProgramWords(wordsToIntelHex(words));
  assert.equal(program.length, 16384);
  assert.deepEqual(Array.from(program.slice(0, words.length)), words);
  assert.equal(program[words.length], 0);
});

test('buildFirmware: HEX compilado é gravado na flash e executado pelo AVR8js', async () => {
  const hex = wordsToIntelHex(sampleFirmwareWords('HEX REAL\r\n'));
  const compiler = stubCompiler(successResponse(hex));

  const result = await buildFirmware(compiler, 'void setup(){}\nvoid loop(){}');
  assert.equal(result.ok, true);
  assert.deepEqual(compiler.calls, ['void setup(){}\nvoid loop(){}']);
  if (!result.ok) return;

  assert.equal(result.origin, 'COMPILED');
  assert.ok(result.logs.every((l) => l.level === 'SYSTEM'));
  assert.ok(result.logs.some((l) => /37 ms/.test(l.text)));
  assert.ok(result.logs.some((l) => /Flash: 1240\/32256 bytes \(3\.8%\)/.test(l.text)));

  const board = new AVRBoard(result.program);
  const serial: string[] = [];
  const d13: string[] = [];
  board.onSerialOutput((line) => serial.push(line));
  board.onPinChange((pin, level) => pin === 'D13' && d13.push(level));
  board.step(300);

  assert.ok(serial.includes('HEX REAL'), `serial deveria conter o texto do firmware compilado: ${serial}`);
  assert.ok(!serial.some((l) => l.includes('WEBBOARD 16MHz READY')), 'não deve rodar o firmware de demonstração');
  assert.ok(d13.includes('HIGH') && d13.includes('LOW'));
});

test('buildFirmware: resultado em cache é identificado na origem e no log', async () => {
  const hex = wordsToIntelHex(sampleFirmwareWords());
  const result = await buildFirmware(stubCompiler(successResponse(hex, { cached: true })), 'x');
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.origin, 'CACHED');
    assert.ok(result.logs.some((l) => /cache SHA-256/.test(l.text)));
  }
});

test('buildFirmware: erro de compilação aborta a energização e repassa o stderr ao Monitor Serial', async () => {
  const stderr = Array.from({ length: 25 }, (_, i) => `sketch.ino:${i + 1}:1: error: linha ${i + 1}`).join('\n');
  const compiler = stubCompiler({
    success: false,
    error: 'ERRO_COMPILACAO',
    message: '[RN-COD-01] Falha ao compilar com arduino-cli.',
    stderr
  });

  const result = await buildFirmware(compiler, 'void loop() {', { maxStderrLines: 20 });
  assert.equal(result.ok, false);

  const errors = result.logs.filter((l) => l.level === 'ERROR').map((l) => l.text);
  assert.equal(errors[0], '[RN-COD-01] Falha ao compilar com arduino-cli.');
  assert.ok(errors.includes('sketch.ino:1:1: error: linha 1'));
  assert.ok(errors.includes('sketch.ino:20:1: error: linha 20'));
  assert.ok(!errors.includes('sketch.ino:21:1: error: linha 21'));
  assert.ok(errors.some((e) => /5 linha\(s\) de stderr omitidas/.test(e)));
  assert.match(errors[errors.length - 1], /Energização abortada/);
});

test('buildFirmware: HEX corrompido do servidor não é gravado na flash', async () => {
  const result = await buildFirmware(
    stubCompiler(successResponse(':0400000001020304F3\n:00000001FF')),
    'x'
  );
  assert.equal(result.ok, false);
  assert.ok(result.logs.some((l) => l.level === 'ERROR' && /corrompido: linha 1: checksum/.test(l.text)));
});

test('buildFirmware: compilador offline (hex vazio) grava firmware de demonstração com aviso', async () => {
  const result = await buildFirmware(
    stubCompiler(successResponse('', { offline: true, stdout: '[AVISO] Servidor de compilação offline.' })),
    'x'
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.origin, 'OFFLINE_FALLBACK');
  assert.ok(result.logs.some((l) => /offline/.test(l.text)));

  const serial: string[] = [];
  const board = new AVRBoard(result.program);
  board.onSerialOutput((line) => serial.push(line));
  board.step(300);
  assert.ok(serial.some((l) => l.includes('WEBBOARD 16MHz READY')));
});

test('buildFirmware: exceção inesperada do cliente é contida e aborta a energização', async () => {
  const result = await buildFirmware(stubCompiler(new Error('boom')), 'x');
  assert.equal(result.ok, false);
  assert.ok(result.logs.some((l) => /Falha inesperada.*boom/.test(l.text)));
});
