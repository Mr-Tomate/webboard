import test from 'node:test';
import assert from 'node:assert/strict';
import type { CircuitDefinition } from '@webboard/contracts';
import { NetlistSolver } from '../dist/index.js';

test('NetlistSolver agrupa pinos interligados em nos equipotenciais (NetNodes)', () => {
  const circuit: CircuitDefinition = {
    schemaVersion: '1.0.0',
    circuitId: 'ckt_test_nets',
    components: [
      {
        id: 'mcu_01',
        type: 'MICROCONTROLLER_ARDUINO_UNO',
        isLocked: true,
        position: { x: 0, y: 0 },
        parameters: {},
      },
      {
        id: 'res_01',
        type: 'PASSIVE_RESISTOR',
        isLocked: false,
        position: { x: 100, y: 0 },
        parameters: { resistanceOhms: 220 },
      },
      {
        id: 'led_01',
        type: 'ACTUATOR_LED',
        isLocked: false,
        position: { x: 200, y: 0 },
        parameters: { color: 'RED' },
      },
    ],
    wires: [
      {
        id: 'wire_d13_to_res',
        from: { componentId: 'mcu_01', pinId: 'D13' },
        to: { componentId: 'res_01', pinId: 'PIN_1' },
        color: 'GREEN',
      },
      {
        id: 'wire_res_to_led',
        from: { componentId: 'res_01', pinId: 'PIN_2' },
        to: { componentId: 'led_01', pinId: 'ANODE' },
        color: 'RED',
      },
      {
        id: 'wire_led_to_gnd',
        from: { componentId: 'led_01', pinId: 'CATHODE' },
        to: { componentId: 'mcu_01', pinId: 'GND_1' },
        color: 'BLACK',
      },
    ],
  };

  const result = NetlistSolver.solve(circuit);

  assert.equal(result.hasFault, false);
  assert.equal(result.nets.length, 3);

  const netD13 = result.getNetForPin('mcu_01', 'D13');
  assert.ok(netD13);
  assert.equal(netD13.pins.length, 2);
  assert.ok(netD13.wireIds.includes('wire_d13_to_res'));

  const netGnd = result.getNetForPin('mcu_01', 'GND_1');
  assert.ok(netGnd);
  assert.equal(netGnd.isGround, true);
  assert.equal(netGnd.voltage, 0.0);
});

test('TC-CORE-03: Fio direto entre 5V e GND dispara SHORT_CIRCUIT imediato (RN-BNC-04)', () => {
  const circuitCurto: CircuitDefinition = {
    schemaVersion: '1.0.0',
    circuitId: 'ckt_curto_direto',
    components: [
      {
        id: 'mcu_uno_01',
        type: 'MICROCONTROLLER_ARDUINO_UNO',
        isLocked: true,
        position: { x: 0, y: 0 },
        parameters: {},
      },
    ],
    wires: [
      {
        id: 'wire_fatal_curto',
        from: { componentId: 'mcu_uno_01', pinId: '5V' },
        to: { componentId: 'mcu_uno_01', pinId: 'GND_1' },
        color: 'RED',
      },
    ],
  };

  const result = NetlistSolver.solve(circuitCurto);

  assert.equal(result.hasFault, true);
  assert.ok(result.fault);
  assert.equal(result.fault.type, 'SHORT_CIRCUIT');
  assert.equal(result.fault.failedWireId, 'wire_fatal_curto');
  assert.match(result.fault.message, /\[FALHA ELÉTRICA\] Curto-circuito detectado/);
  assert.match(result.fault.message, /wire_fatal_curto/);
});

test('RN-BNC-04: Conflito logico entre dois pinos OUTPUT (HIGH vs LOW) dispara SHORT_CIRCUIT', () => {
  const circuitConflito: CircuitDefinition = {
    schemaVersion: '1.0.0',
    circuitId: 'ckt_conflito_logico',
    components: [
      {
        id: 'mcu_uno_01',
        type: 'MICROCONTROLLER_ARDUINO_UNO',
        isLocked: true,
        position: { x: 0, y: 0 },
        parameters: {},
      },
    ],
    wires: [
      {
        id: 'wire_bridge_output',
        from: { componentId: 'mcu_uno_01', pinId: 'D2' },
        to: { componentId: 'mcu_uno_01', pinId: 'D3' },
        color: 'YELLOW',
      },
    ],
  };

  // Simular pinos D2 em HIGH e D3 em LOW
  const result = NetlistSolver.solve(circuitConflito, (_compId, pinId) => {
    if (pinId === 'D2') {
      return {
        componentId: 'mcu_uno_01',
        pinId: 'D2',
        type: 'DIGITAL_IO',
        direction: 'OUTPUT',
        voltage: 5.0,
        digitalLevel: 'HIGH',
      };
    }
    if (pinId === 'D3') {
      return {
        componentId: 'mcu_uno_01',
        pinId: 'D3',
        type: 'DIGITAL_IO',
        direction: 'OUTPUT',
        voltage: 0.0,
        digitalLevel: 'LOW',
      };
    }
    return undefined;
  });

  assert.equal(result.hasFault, true);
  assert.ok(result.fault);
  assert.equal(result.fault.type, 'SHORT_CIRCUIT');
  assert.equal(result.fault.failedWireId, 'wire_bridge_output');
  assert.match(result.fault.message, /wire_bridge_output/);
  assert.match(result.fault.message, /mcu_uno_01:D2/);
  assert.match(result.fault.message, /mcu_uno_01:D3/);
});

test('Curto indireto atraves de múltiplos condutores identifica o caminho de falha', () => {
  const circuitCurtoMultiplo: CircuitDefinition = {
    schemaVersion: '1.0.0',
    circuitId: 'ckt_curto_multi_wire',
    components: [
      {
        id: 'mcu_uno_01',
        type: 'MICROCONTROLLER_ARDUINO_UNO',
        isLocked: true,
        position: { x: 0, y: 0 },
        parameters: {},
      },
      {
        id: 'terminal_block_01',
        type: 'PASSIVE_TERMINAL',
        isLocked: false,
        position: { x: 50, y: 50 },
        parameters: {},
      },
    ],
    wires: [
      {
        id: 'wire_5v_to_term',
        from: { componentId: 'mcu_uno_01', pinId: '5V' },
        to: { componentId: 'terminal_block_01', pinId: 'T1' },
        color: 'RED',
      },
      {
        id: 'wire_term_to_gnd',
        from: { componentId: 'terminal_block_01', pinId: 'T1' },
        to: { componentId: 'mcu_uno_01', pinId: 'GND_1' },
        color: 'BLACK',
      },
    ],
  };

  const result = NetlistSolver.solve(circuitCurtoMultiplo);

  assert.equal(result.hasFault, true);
  assert.ok(result.fault);
  assert.equal(result.fault.type, 'SHORT_CIRCUIT');
  assert.ok(
    result.fault.failedWireId === 'wire_5v_to_term' ||
      result.fault.failedWireId === 'wire_term_to_gnd'
  );
});
