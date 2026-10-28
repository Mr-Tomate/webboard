import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIntelHex } from '../src/emulator/intel-hex.ts';
import { AVRBoard } from '../src/emulator/avr-board.ts';

test('parseIntelHex: decodifica registro de dados Intel HEX com sucesso', () => {
  const hex = ':0400000001020304F2\n:00000001FF';
  const target = new Uint8Array(16);
  parseIntelHex(hex, target);

  assert.equal(target[0], 0x01);
  assert.equal(target[1], 0x02);
  assert.equal(target[2], 0x03);
  assert.equal(target[3], 0x04);
  assert.equal(target[4], 0x00);
});

test('AVRBoard: inicializa CPU, executa instrucoes e emite transicao do pino D13', () => {
  const board = new AVRBoard();
  const pinTransitions: Array<{ pin: string; level: 'HIGH' | 'LOW' }> = [];

  board.onPinChange((pin, level) => {
    if (pin === 'D13') {
      pinTransitions.push({ pin, level });
    }
  });

  // Executa passos do firmware default
  board.step(500);

  // Deve ter transicionado D13
  assert.ok(pinTransitions.length >= 2, 'D13 deve ter alternado de estado');
  const hasHigh = pinTransitions.some((t) => t.level === 'HIGH');
  const hasLow = pinTransitions.some((t) => t.level === 'LOW');
  assert.ok(hasHigh, 'D13 deve ter atingido nivel HIGH');
  assert.ok(hasLow, 'D13 deve ter atingido nivel LOW');
});

test('AVRBoard: captura transmissao serial de boot da UART virtual', () => {
  const board = new AVRBoard();
  const serialOutputs: string[] = [];

  board.onSerialOutput((text) => {
    serialOutputs.push(text);
  });

  // Executa instrucoes de boot
  board.step(300);

  assert.ok(serialOutputs.length > 0, 'Deve ter emitido linha serial de boot');
  assert.ok(
    serialOutputs.some((line) => line.includes('WEBBOARD 16MHz READY')),
    'A mensagem de boot deve conter WEBBOARD 16MHz READY'
  );
});

test('AVRBoard: ciclo de vida start e stop', () => {
  const board = new AVRBoard();
  assert.equal(board.getActive(), false);

  board.start(1000);
  assert.equal(board.getActive(), true);

  board.stop();
  assert.equal(board.getActive(), false);
});
