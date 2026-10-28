import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCompilerApp } from '../dist/app.js';
import { ArduinoCompiler } from '../dist/compiler.js';
import { CompilationCache } from '../dist/cache.js';

test('Compiler Worker: Microservico de Compilacao C++ com Cache e Validacao RN-COD-01', async (t) => {
  const compiler = new ArduinoCompiler();
  const app = await buildCompilerApp(compiler);

  await t.test('GET /health retorna status ok do microservico', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'webboard-compiler-worker');
    assert.ok(Array.isArray(body.supportedTargets));
  });

  await t.test('RN-COD-01: Rejeita codigo sem funcao loop() com ERRO_COMPILACAO', async () => {
    const invalidCode = `
      void setup() {
        pinMode(13, OUTPUT);
      }
      // Faltando void loop()
    `;

    const res = await app.inject({
      method: 'POST',
      url: '/compile',
      payload: {
        sourceCode: invalidCode,
        fqbn: 'arduino:avr:uno',
      },
    });

    assert.equal(res.statusCode, 422);
    const body = JSON.parse(res.body);
    assert.equal(body.success, false);
    assert.equal(body.error, 'ERRO_COMPILACAO');
    assert.match(body.message, /\[RN-COD-01\]/);
    assert.match(body.stderr, /void loop/);
  });

  await t.test('RN-COD-01: Rejeita chaves desbalanceadas', async () => {
    const invalidBraces = `
      void setup() {
        pinMode(13, OUTPUT);
      
      void loop() {
      }
    `;

    const res = await app.inject({
      method: 'POST',
      url: '/compile',
      payload: {
        sourceCode: invalidBraces,
      },
    });

    assert.equal(res.statusCode, 422);
    const body = JSON.parse(res.body);
    assert.equal(body.error, 'ERRO_COMPILACAO');
    assert.match(body.message, /Chaves desbalanceadas/);
  });

  await t.test('Compilacao bem-sucedida gera binario Intel HEX valido', async () => {
    const blinkCode = `
      void setup() {
        pinMode(13, OUTPUT);
        Serial.begin(9600);
        Serial.println("HELLO FROM WORKER");
      }

      void loop() {
        digitalWrite(13, HIGH);
        delay(1000);
        digitalWrite(13, LOW);
        delay(1000);
      }
    `;

    const res = await app.inject({
      method: 'POST',
      url: '/compile',
      payload: {
        sourceCode: blinkCode,
        fqbn: 'arduino:avr:uno',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.equal(body.cached, false);
    assert.ok(body.hex);

    // Validar formato dos registros Intel HEX
    const lines = body.hex.trim().split('\n');
    assert.ok(lines.length >= 2, 'Deve ter pelo menos um registro de dados e um de EOF');
    assert.ok(lines[0].startsWith(':'), 'Primeira linha deve iniciar com ":"');
    assert.equal(lines[lines.length - 1], ':00000001FF', 'Ultima linha deve ser o EOF record');

    // Estatísticas de memória
    assert.ok(body.memoryUsage.flashBytes > 0);
    assert.equal(body.memoryUsage.flashMaxBytes, 32256);
  });

  await t.test('Cache: Re-compilacao do mesmo codigo retorna cached=true em 0ms', async () => {
    const blinkCode = `
      void setup() {
        pinMode(13, OUTPUT);
      }
      void loop() {
        digitalWrite(13, HIGH);
      }
    `;

    // 1. Primeira compilação
    const res1 = await app.inject({
      method: 'POST',
      url: '/compile',
      payload: { sourceCode: blinkCode },
    });
    assert.equal(res1.statusCode, 200);
    const body1 = JSON.parse(res1.body);
    assert.equal(body1.cached, false);

    // 2. Segunda compilação imediata
    const res2 = await app.inject({
      method: 'POST',
      url: '/compile',
      payload: { sourceCode: blinkCode },
    });
    assert.equal(res2.statusCode, 200);
    const body2 = JSON.parse(res2.body);
    assert.equal(body2.cached, true);
    assert.equal(body2.compilationTimeMs, 0);
    assert.equal(body2.hex, body1.hex);
  });

  await t.test('CompilationCache: controle de limite maximo de entradas', () => {
    const cache = new CompilationCache(3);
    cache.set('k1', { hex: 'h1', stdout: '', compilationTimeMs: 1, timestamp: 1 });
    cache.set('k2', { hex: 'h2', stdout: '', compilationTimeMs: 1, timestamp: 2 });
    cache.set('k3', { hex: 'h3', stdout: '', compilationTimeMs: 1, timestamp: 3 });
    cache.set('k4', { hex: 'h4', stdout: '', compilationTimeMs: 1, timestamp: 4 });

    // k1 deve ter sido descartado por FIFO
    assert.equal(cache.get('k1'), undefined);
    assert.ok(cache.get('k4'));
  });

  await app.close();
});
