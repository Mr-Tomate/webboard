import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LocalWasmCompiler,
  compileArduinoLocally,
  validateSyntax
} from '../src/compiler/local-wasm-compiler.ts';
import { validateIntelHex, hexToProgramWords } from '../src/emulator/intel-hex.ts';
import { AVRBoard } from '../src/emulator/avr-board.ts';
import { buildFirmware } from '../src/emulator/firmware-pipeline.ts';

const BLINK_SKETCH = `
void setup() {
  pinMode(13, OUTPUT);
  Serial.begin(9600);
  Serial.println("WEBBOARD LOCAL WASM OK");
}

void loop() {
  digitalWrite(13, HIGH);
  delay(1000);
  digitalWrite(13, LOW);
  delay(1000);
}
`;

test('LocalWasmCompiler: Compilação offline de sketch Blink com geração de Intel HEX válido', async () => {
  const compiler = new LocalWasmCompiler();
  const res = await compiler.compile(BLINK_SKETCH, 'arduino:avr:uno');

  assert.equal(res.success, true);
  if (res.success) {
    assert.equal(res.offline, true);
    assert.equal(res.origin, 'WASM_LOCAL');
    assert.equal(res.cached, false);
    assert.ok(res.hex.length > 0, 'O Intel HEX não deve ser vazio');

    // Verifica formato dos registros Intel HEX
    const lines = res.hex.trim().split(/\r?\n/);
    assert.ok(lines.length >= 2, 'Deve ter pelo menos 1 registro de dados e 1 de EOF');
    assert.ok(lines[0].startsWith(':'), 'Todos os registros devem iniciar com ":"');
    assert.equal(lines[lines.length - 1], ':00000001FF', 'Último registro deve ser EOF (:00000001FF)');
  }
});

test('LocalWasmCompiler: Validação de integridade do HEX gerado com validateIntelHex', async () => {
  const res = await compileArduinoLocally(BLINK_SKETCH);
  assert.equal(res.success, true);

  if (res.success) {
    const error = validateIntelHex(res.hex);
    assert.equal(error, null, `O Intel HEX gerado deve ser 100% íntegro segundo validateIntelHex: ${error}`);
  }
});

test('LocalWasmCompiler: Rejeição de sketch inválido com ERRO_COMPILACAO e stderr (RN-COD-01)', async () => {
  // 1. Código vazio
  const emptyRes = await compileArduinoLocally('   \n  ');
  assert.equal(emptyRes.success, false);
  if (!emptyRes.success) {
    assert.equal(emptyRes.error, 'ERRO_COMPILACAO');
    assert.match(emptyRes.message, /\[RN-COD-01\]/);
    assert.match(emptyRes.stderr, /vazio/i);
  }

  // 2. Faltando loop()
  const noLoopRes = await compileArduinoLocally('void setup() { pinMode(13, OUTPUT); }');
  assert.equal(noLoopRes.success, false);
  if (!noLoopRes.success) {
    assert.equal(noLoopRes.error, 'ERRO_COMPILACAO');
    assert.match(noLoopRes.stderr, /void loop\(\)/);
  }

  // 3. Faltando setup()
  const noSetupRes = await compileArduinoLocally('void loop() { digitalWrite(13, HIGH); }');
  assert.equal(noSetupRes.success, false);
  if (!noSetupRes.success) {
    assert.equal(noSetupRes.error, 'ERRO_COMPILACAO');
    assert.match(noSetupRes.stderr, /void setup\(\)/);
  }

  // 4. Chaves desbalanceadas
  const unbalancedBraces = await compileArduinoLocally('void setup() { \nvoid loop() {}');
  assert.equal(unbalancedBraces.success, false);
  if (!unbalancedBraces.success) {
    assert.equal(unbalancedBraces.error, 'ERRO_COMPILACAO');
    assert.match(unbalancedBraces.stderr, /desbalanceadas/i);
  }

  // 5. Parênteses desbalanceados
  const unbalancedParens = await compileArduinoLocally('void setup() {} void loop() { delay(100; }');
  assert.equal(unbalancedParens.success, false);
  if (!unbalancedParens.success) {
    assert.equal(unbalancedParens.error, 'ERRO_COMPILACAO');
    assert.match(unbalancedParens.stderr, /parênteses/i);
  }
});

test('LocalWasmCompiler: Cálculo das métricas de memória Flash e SRAM', async () => {
  const sketchWithVars = `
  #define BUTTON_PIN 2
  const int ledPin = 13;
  int sensorValue = 0;

  void setup() {
    pinMode(ledPin, OUTPUT);
    pinMode(BUTTON_PIN, INPUT_PULLUP);
    Serial.begin(9600);
    Serial.println("TESTING MEMORY USAGE METRICS");
  }

  void loop() {
    sensorValue = digitalRead(BUTTON_PIN);
    if (sensorValue == LOW) {
      digitalWrite(ledPin, HIGH);
    } else {
      digitalWrite(ledPin, LOW);
    }
    delay(100);
  }
  `;

  const res = await LocalWasmCompiler.compile(sketchWithVars);
  assert.equal(res.success, true);

  if (res.success) {
    const { flashBytes, flashMaxBytes, sramBytes, sramMaxBytes } = res.memoryUsage;

    // Métricas para ATmega328P
    assert.equal(flashMaxBytes, 32256, 'Flash máxima do ATmega328P deve ser 32256 bytes');
    assert.equal(sramMaxBytes, 2048, 'SRAM máxima do ATmega328P deve ser 2048 bytes');

    // Consumo positivo e dentro dos limites
    assert.ok(flashBytes > 0 && flashBytes <= flashMaxBytes, `flashBytes inválido: ${flashBytes}`);
    assert.ok(sramBytes > 0 && sramBytes <= sramMaxBytes, `sramBytes inválido: ${sramBytes}`);

    // Mensagem de stdout deve reportar as métricas
    assert.match(res.stdout, /Memória Flash:/);
    assert.match(res.stdout, /Memória SRAM:/);
  }
});

test('LocalWasmCompiler: Execução funcional do HEX gerado no AVR8js (Serial e D13)', async () => {
  const res = await compileArduinoLocally(BLINK_SKETCH);
  assert.equal(res.success, true);
  if (!res.success) return;

  const programWords = hexToProgramWords(res.hex);
  const board = new AVRBoard(programWords);

  const serialMessages: string[] = [];
  const d13Levels: Array<'HIGH' | 'LOW'> = [];

  board.onSerialOutput((text) => serialMessages.push(text));
  board.onPinChange((pin, level) => {
    if (pin === 'D13') {
      d13Levels.push(level);
    }
  });

  // Executa passos na CPU virtual
  board.step(400);

  // 1. Deve ter transmitido a mensagem serial definida no sketch
  assert.ok(
    serialMessages.some((msg) => msg.includes('WEBBOARD LOCAL WASM OK')),
    `Serial deveria conter mensagem do sketch compilado: ${JSON.stringify(serialMessages)}`
  );

  // 2. Deve ter alternado D13 entre HIGH e LOW
  assert.ok(d13Levels.includes('HIGH'), 'D13 deve ter atingido HIGH');
  assert.ok(d13Levels.includes('LOW'), 'D13 deve ter atingido LOW');
});

test('LocalWasmCompiler: Integração no firmware-pipeline (buildFirmware com WASM_LOCAL)', async () => {
  const compiler = {
    compile: (source: string) => compileArduinoLocally(source)
  };

  const result = await buildFirmware(compiler, BLINK_SKETCH);
  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.origin, 'WASM_LOCAL');
    assert.ok(
      result.logs.some((l) =>
        l.text.includes('[COMPILADOR LOCAL] Sketch compilado com sucesso via WebAssembly local (100% offline).')
      ),
      'Log do Monitor Serial deve conter mensagem formal de compilação 100% offline'
    );
  }
});

test('LocalWasmCompiler: Tradução de instruções fundamentais (digitalRead, delayMicroseconds, millis)', async () => {
  const fullSketch = `
  void setup() {
    pinMode(2, INPUT);
    pinMode(13, OUTPUT);
    Serial.begin(9600);
  }

  void loop() {
    unsigned long t = millis();
    if (digitalRead(2) == HIGH) {
      digitalWrite(13, HIGH);
      delayMicroseconds(500);
    } else {
      digitalWrite(13, LOW);
    }
  }
  `;

  const res = await LocalWasmCompiler.compile(fullSketch);
  assert.equal(res.success, true);
  if (res.success) {
    assert.equal(validateIntelHex(res.hex), null);
    assert.ok(res.hex.includes(':'));
  }
});
