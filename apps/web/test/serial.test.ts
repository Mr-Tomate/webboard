import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSerialMessage,
  appendToSerialBuffer,
  formatSerialTimestamp,
  DEFAULT_CPP_CODE,
  DEFAULT_PYTHON_CODE
} from '../src/utils/serial.ts';

test('createSerialMessage: formata mensagem com id unico e timestamp', () => {
  const msg = createSerialMessage('Hello Arduino', 'RX');
  assert.equal(msg.text, 'Hello Arduino');
  assert.equal(msg.direction, 'RX');
  assert.ok(msg.id.startsWith('msg_'));
  assert.ok(msg.timestamp.length >= 8);
});

test('appendToSerialBuffer: adiciona mensagem e respeita limite maximo de buffer', () => {
  let buffer = [];
  for (let i = 0; i < 10; i++) {
    buffer = appendToSerialBuffer(buffer, createSerialMessage(`Linha ${i}`, 'TX'), 5);
  }

  assert.equal(buffer.length, 5);
  assert.equal(buffer[0].text, 'Linha 5');
  assert.equal(buffer[4].text, 'Linha 9');
});

test('formatSerialTimestamp: formata hora com milissegundos', () => {
  const date = new Date(2026, 9, 28, 10, 30, 45, 123);
  const formatted = formatSerialTimestamp(date);
  assert.equal(formatted, '10:30:45.123');
});

test('templates de codigo base C++ e Python estao definidos', () => {
  assert.ok(DEFAULT_CPP_CODE.includes('void setup()'));
  assert.ok(DEFAULT_CPP_CODE.includes('void loop()'));
  assert.ok(DEFAULT_PYTHON_CODE.includes('import pyfirmata'));
});
