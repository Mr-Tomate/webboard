import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WorkbenchEngine } from '../src/engine/WorkbenchEngine.ts';
import type { CircuitDefinition } from '@webboard/contracts';

test('WorkbenchEngine: inicializa em MODO_EDICAO e valida netlist vazia', () => {
  const engine = new WorkbenchEngine({ autoLoop: false });
  assert.equal(engine.getMode(), 'MODO_EDICAO');
  assert.equal(engine.getFault(), null);
  assert.equal(engine.isSimulating(), false);

  const res = engine.validateNetlist();
  assert.equal(res.hasFault, false);
});

test('WorkbenchEngine: detecta curto circuito em T=0 e transita para ESTADO_FALHA_ENG (RN-BNC-04)', () => {
  const shortCircuit: CircuitDefinition = {
    schemaVersion: '1.0.0',
    circuitId: 'ckt_short',
    components: [
      {
        id: 'mcu_01',
        type: 'MICROCONTROLLER_ARDUINO_UNO',
        label: 'Arduino',
        isLocked: false,
        position: { x: 100, y: 100 },
        parameters: {}
      }
    ],
    wires: [
      {
        id: 'w_short',
        from: { componentId: 'mcu_01', pinId: '5V' },
        to: { componentId: 'mcu_01', pinId: 'GND_1' },
        color: 'RED'
      }
    ]
  };

  const engine = new WorkbenchEngine({ autoLoop: false });
  engine.loadCircuit(shortCircuit);

  let faultNotified = false;
  engine.onStateChange((mode, fault) => {
    if (mode === 'ESTADO_FALHA_ENG' && fault?.type === 'SHORT_CIRCUIT') {
      faultNotified = true;
    }
  });

  const started = engine.startSimulation();
  assert.equal(started, false);
  assert.equal(engine.getMode(), 'ESTADO_FALHA_ENG');
  assert.equal(faultNotified, true);
  assert.equal(engine.getFault()?.type, 'SHORT_CIRCUIT');
});

test('WorkbenchEngine: ciclo de vida de simulação e emissão de Dirty Flags', () => {
  const healthyCircuit: CircuitDefinition = {
    schemaVersion: '1.0.0',
    circuitId: 'ckt_blink',
    components: [
      {
        id: 'mcu_uno_01',
        type: 'MICROCONTROLLER_ARDUINO_UNO',
        label: 'Arduino',
        isLocked: false,
        position: { x: 100, y: 100 },
        parameters: {}
      },
      {
        id: 'res_01',
        type: 'PASSIVE_RESISTOR',
        label: 'Resistor 220R',
        isLocked: false,
        position: { x: 300, y: 100 },
        parameters: { resistanceOhms: 220 }
      },
      {
        id: 'led_01',
        type: 'ACTUATOR_LED',
        label: 'LED',
        isLocked: false,
        position: { x: 450, y: 100 },
        parameters: { color: 'RED' }
      }
    ],
    wires: [
      {
        id: 'w1',
        from: { componentId: 'mcu_uno_01', pinId: 'D13' },
        to: { componentId: 'res_01', pinId: 'PIN_1' },
        color: 'GREEN'
      },
      {
        id: 'w2',
        from: { componentId: 'res_01', pinId: 'PIN_2' },
        to: { componentId: 'led_01', pinId: 'ANODE' },
        color: 'RED'
      },
      {
        id: 'w3',
        from: { componentId: 'led_01', pinId: 'CATHODE' },
        to: { componentId: 'mcu_uno_01', pinId: 'GND_3' },
        color: 'BLACK'
      }
    ]
  };

  const engine = new WorkbenchEngine({ autoLoop: false });
  engine.loadCircuit(healthyCircuit);

  const dirtyReceived: string[] = [];
  engine.onDirty((ids) => {
    dirtyReceived.push(...Array.from(ids));
  });

  const started = engine.startSimulation();
  assert.equal(started, true);
  assert.equal(engine.getMode(), 'MODO_SIMULACAO');

  // Simula D13 indo para HIGH na CPU
  engine.handlePinOutputChange('mcu_uno_01', 'D13', 'HIGH');

  const ledState = engine.getElectricalState('led_01');
  assert.equal(ledState?.visualState, 'active');
  assert.ok(dirtyReceived.includes('led_01'));

  // Desliga
  engine.stopSimulation();
  assert.equal(engine.getMode(), 'MODO_EDICAO');
  assert.equal(engine.isSimulating(), false);
  engine.destroy();
});
