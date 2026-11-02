import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CompilerClient, validateArduinoSketch } from '../src/api/compiler-client.ts';
import { validateIntelHex } from '../src/emulator/intel-hex.ts';

const VALID_SKETCH = 'void setup() { pinMode(13, OUTPUT); }\nvoid loop() { digitalWrite(13, HIGH); }';

function mockFetch(handler: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) =>
    handler(String(input), init)) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

test('CompilerClient: envia POST /compile com sourceCode e fqbn e devolve o Intel HEX', async () => {
  let url = '';
  let body: any = null;
  const restore = mockFetch((u, init) => {
    url = u;
    body = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        success: true,
        hex: ':00000001FF',
        stdout: 'ok',
        compilationTimeMs: 42,
        cached: false,
        memoryUsage: { flashBytes: 1, flashMaxBytes: 2, sramBytes: 1, sramMaxBytes: 2 }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  });

  try {
    const res = await new CompilerClient('http://localhost:3002/').compile(VALID_SKETCH);
    assert.equal(url, 'http://localhost:3002/compile');
    assert.equal(body.sourceCode, VALID_SKETCH);
    assert.equal(body.fqbn, 'arduino:avr:uno');
    assert.equal(res.success, true);
    if (res.success) {
      assert.equal(res.hex, ':00000001FF');
      assert.equal(res.offline, undefined);
    }
  } finally {
    restore();
  }
});

test('CompilerClient: repassa erro 422 do compiler-worker (RN-COD-01) com stderr', async () => {
  const restore = mockFetch(
    () =>
      new Response(
        JSON.stringify({
          success: false,
          error: 'ERRO_COMPILACAO',
          message: '[RN-COD-01] Erro de compilação: x',
          stderr: "sketch.ino:3:5: error: 'foo' was not declared in this scope"
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      )
  );

  try {
    const res = await new CompilerClient().compile(VALID_SKETCH);
    assert.equal(res.success, false);
    if (!res.success) {
      assert.match(res.stderr, /was not declared/);
    }
  } finally {
    restore();
  }
});

test('CompilerClient: resposta malformada (HTTP 500 não-JSON) vira erro explícito', async () => {
  const restore = mockFetch(() => new Response('<html>Internal Error</html>', { status: 500 }));

  try {
    const res = await new CompilerClient().compile(VALID_SKETCH);
    assert.equal(res.success, false);
    if (!res.success) {
      assert.match(res.message, /HTTP 500/);
    }
  } finally {
    restore();
  }
});

test('CompilerClient: servidor offline aciona Tier 2 WasmCompiler com hex real e origin WASM_LOCAL', async () => {
  const restore = mockFetch(() => {
    throw new TypeError('fetch failed');
  });

  try {
    const ok = await new CompilerClient().compile(VALID_SKETCH);
    assert.equal(ok.success, true);
    if (ok.success) {
      assert.equal(ok.offline, true);
      assert.equal(ok.origin, 'WASM_LOCAL');
      assert.ok(ok.hex.length > 0, 'Hex não deve estar vazio no Tier 2 Wasm');
      assert.equal(validateIntelHex(ok.hex), null, 'Hex deve ser estruturalmente íntegro');
      assert.match(ok.stdout, /offline/i);
    }

    const bad = await new CompilerClient().compile('void setup() {}');
    assert.equal(bad.success, false);
    if (!bad.success) {
      assert.match(bad.message, /void loop\(\)/);
    }

    // Com wasmFallback: false, retorna o fallback superficial anterior (hex vazio)
    const superficial = await new CompilerClient('http://localhost:3002', { wasmFallback: false }).compile(VALID_SKETCH);
    assert.equal(superficial.success, true);
    if (superficial.success) {
      assert.equal(superficial.offline, true);
      assert.equal(superficial.hex, '');
      assert.match(superficial.stdout, /offline/);
    }
  } finally {
    restore();
  }
});

test('CompilerClient: timeout aborta a requisição e cai no compilador local', async () => {
  const restore = mockFetch(
    (_u, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      })
  );

  try {
    const res = await new CompilerClient('http://localhost:3002', { timeoutMs: 20 }).compile(VALID_SKETCH);
    assert.equal(res.success, true);
    if (res.success) {
      assert.equal(res.offline, true);
      assert.match(res.stdout, /tempo limite de 20ms/);
      assert.equal(res.origin, 'WASM_LOCAL');
      assert.ok(res.hex.length > 0);
    }
  } finally {
    restore();
  }
});

test('validateArduinoSketch: espelha as regras RN-COD-01 do compiler-worker', () => {
  assert.equal(validateArduinoSketch(VALID_SKETCH), null);
  assert.equal(validateArduinoSketch('int main() { return 0; }'), null);
  assert.match(validateArduinoSketch('   ') ?? '', /vazio/);
  assert.match(validateArduinoSketch('void loop() {}') ?? '', /setup/);
  assert.match(validateArduinoSketch('void setup() { \nvoid loop() {}') ?? '', /desbalanceadas/);
  assert.match(validateArduinoSketch('void setup() {}\nvoid loop() { foo(; }') ?? '', /Parênteses/);
  // Chaves dentro de comentários não contam
  assert.equal(validateArduinoSketch('void setup() {} // }}}\nvoid loop() {} /* { */'), null);
});
