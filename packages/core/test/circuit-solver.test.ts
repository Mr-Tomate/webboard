import test from 'node:test';
import assert from 'node:assert/strict';
import type { CircuitDefinition } from '@webboard/contracts';
import { CircuitSolver } from '../dist/index.js';

test('TC-CORE-01: Blink Saudavel (Uno D13 -> R 220R -> LED -> GND)', () => {
  const circuit: CircuitDefinition = {
    schemaVersion: '1.0.0',
    circuitId: 'ckt_blink_saudavel',
    components: [
      {
        id: 'mcu_uno_01',
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
        parameters: { color: 'RED', forwardVoltageVolts: 1.8, maxCurrentAmperes: 0.03 },
      },
    ],
    wires: [
      {
        id: 'wire_d13_to_res',
        from: { componentId: 'mcu_uno_01', pinId: 'D13' },
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
        to: { componentId: 'mcu_uno_01', pinId: 'GND_1' },
        color: 'BLACK',
      },
    ],
  };

  const solver = new CircuitSolver(circuit);

  // 1. D13 em HIGH (5.0V)
  solver.setPinOutput('mcu_uno_01', 'D13', 'HIGH');
  const resHigh = solver.step(0.001); // 1ms

  assert.equal(resHigh.hasFault, false);
  const ledStateHigh = resHigh.componentStates.get('led_01');
  assert.ok(ledStateHigh);
  assert.equal(ledStateHigh.isConducting, true);
  assert.equal(ledStateHigh.visualState, 'active');
  assert.equal(ledStateHigh.isDestroyed, false);

  // Corrente esperada: (5.0V - 1.8V) / 220 Ohms = 14.545mA
  const currentMaHigh = ledStateHigh.currentAmperes * 1000;
  assert.ok(
    currentMaHigh >= 14.0 && currentMaHigh <= 15.0,
    `Corrente deve ser ~14.5mA, obteve ${currentMaHigh}mA`
  );

  // 2. D13 em LOW (0.0V)
  solver.setPinOutput('mcu_uno_01', 'D13', 'LOW');
  const resLow = solver.step(0.001);

  assert.equal(resLow.hasFault, false);
  const ledStateLow = resLow.componentStates.get('led_01');
  assert.ok(ledStateLow);
  assert.equal(ledStateLow.isConducting, false);
  assert.equal(ledStateLow.visualState, 'default');
  assert.equal(ledStateLow.currentAmperes, 0);
});

test('TC-CORE-02: Queima por Sobrecarga (Uno D13 -> LED -> GND sem R)', () => {
  const circuitSemResistor: CircuitDefinition = {
    schemaVersion: '1.0.0',
    circuitId: 'ckt_queima_sobrecorrente',
    components: [
      {
        id: 'mcu_uno_01',
        type: 'MICROCONTROLLER_ARDUINO_UNO',
        isLocked: true,
        position: { x: 0, y: 0 },
        parameters: {},
      },
      {
        id: 'led_01',
        type: 'ACTUATOR_LED',
        isLocked: false,
        position: { x: 100, y: 0 },
        parameters: { color: 'RED', forwardVoltageVolts: 1.8, maxCurrentAmperes: 0.03 },
      },
    ],
    wires: [
      {
        id: 'wire_d13_to_led',
        from: { componentId: 'mcu_uno_01', pinId: 'D13' },
        to: { componentId: 'led_01', pinId: 'ANODE' },
        color: 'RED',
      },
      {
        id: 'wire_led_to_gnd',
        from: { componentId: 'led_01', pinId: 'CATHODE' },
        to: { componentId: 'mcu_uno_01', pinId: 'GND_1' },
        color: 'BLACK',
      },
    ],
  };

  const solver = new CircuitSolver(circuitSemResistor);
  solver.setPinOutput('mcu_uno_01', 'D13', 'HIGH');

  // Passo 1: 5ms com corrente > 30mA (janela ainda nao atingiu 10ms)
  const res1 = solver.step(0.005);
  const led1 = res1.componentStates.get('led_01')!;
  assert.ok(led1.currentAmperes > 0.03, 'Corrente deve ser superior a 30mA');
  assert.equal(led1.isDestroyed, false);
  assert.equal(res1.hasFault, false);

  // Passo 2: mais 5ms (total 10ms de sobrecorrente crítica)
  const res2 = solver.step(0.005);
  const led2 = res2.componentStates.get('led_01')!;

  assert.equal(res2.hasFault, true);
  assert.ok(res2.fault);
  assert.equal(res2.fault.type, 'OVERCURRENT');
  assert.equal(res2.fault.failedComponentId, 'led_01');
  assert.match(
    res2.fault.message,
    /\[FALHA TÉRMICA\] Sobrecorrente crítica em led_01: Limite de corrente violado\. O componente foi desativado por queima\./
  );

  // O LED destruído apaga e cessa condução
  assert.equal(led2.isDestroyed, true);
  assert.equal(led2.visualState, 'destroyed');
  assert.equal(led2.isConducting, false);
  assert.equal(led2.currentAmperes, 0);
});

test('Lei de Ohm: Divisor de tensao resistivo (5V -> R1 1k -> Mid -> R2 1k -> GND)', () => {
  const circuitDivider: CircuitDefinition = {
    schemaVersion: '1.0.0',
    circuitId: 'ckt_voltage_divider',
    components: [
      {
        id: 'mcu_01',
        type: 'MICROCONTROLLER_ARDUINO_UNO',
        isLocked: true,
        position: { x: 0, y: 0 },
        parameters: {},
      },
      {
        id: 'res_top',
        type: 'PASSIVE_RESISTOR',
        isLocked: false,
        position: { x: 100, y: 0 },
        parameters: { resistanceOhms: 1000 },
      },
      {
        id: 'res_bottom',
        type: 'PASSIVE_RESISTOR',
        isLocked: false,
        position: { x: 200, y: 0 },
        parameters: { resistanceOhms: 1000 },
      },
    ],
    wires: [
      {
        id: 'w_5v_to_rtop',
        from: { componentId: 'mcu_01', pinId: '5V' },
        to: { componentId: 'res_top', pinId: 'PIN_1' },
        color: 'RED',
      },
      {
        id: 'w_mid',
        from: { componentId: 'res_top', pinId: 'PIN_2' },
        to: { componentId: 'res_bottom', pinId: 'PIN_1' },
        color: 'YELLOW',
      },
      {
        id: 'w_rbot_to_gnd',
        from: { componentId: 'res_bottom', pinId: 'PIN_2' },
        to: { componentId: 'mcu_01', pinId: 'GND_1' },
        color: 'BLACK',
      },
    ],
  };

  const solver = new CircuitSolver(circuitDivider);
  const result = solver.step(0.001);

  assert.equal(result.hasFault, false);

  const topState = result.componentStates.get('res_top')!;
  const botState = result.componentStates.get('res_bottom')!;

  // Corrente de 5V / (1k + 1k) = 2.5mA
  assert.ok(Math.abs(topState.currentAmperes - 0.0025) < 1e-4);
  assert.ok(Math.abs(botState.currentAmperes - 0.0025) < 1e-4);
  // Queda de tensão de 2.5V em cada resistor
  assert.ok(Math.abs(topState.voltageDrop - 2.5) < 1e-2);
  assert.ok(Math.abs(botState.voltageDrop - 2.5) < 1e-2);
});

test('LED polarizado reversamente nao conduz corrente', () => {
  const circuitReverso: CircuitDefinition = {
    schemaVersion: '1.0.0',
    circuitId: 'ckt_led_reverso',
    components: [
      {
        id: 'mcu_01',
        type: 'MICROCONTROLLER_ARDUINO_UNO',
        isLocked: true,
        position: { x: 0, y: 0 },
        parameters: {},
      },
      {
        id: 'led_01',
        type: 'ACTUATOR_LED',
        isLocked: false,
        position: { x: 100, y: 0 },
        parameters: { color: 'RED', forwardVoltageVolts: 1.8 },
      },
    ],
    wires: [
      // Anodo no GND e Catodo no 5V
      {
        id: 'w_anode_gnd',
        from: { componentId: 'led_01', pinId: 'ANODE' },
        to: { componentId: 'mcu_01', pinId: 'GND_1' },
        color: 'BLACK',
      },
      {
        id: 'w_cathode_5v',
        from: { componentId: 'led_01', pinId: 'CATHODE' },
        to: { componentId: 'mcu_01', pinId: '5V' },
        color: 'RED',
      },
    ],
  };

  const solver = new CircuitSolver(circuitReverso);
  const result = solver.step(0.001);

  assert.equal(result.hasFault, false);
  const led = result.componentStates.get('led_01')!;
  assert.equal(led.isConducting, false);
  assert.equal(led.currentAmperes, 0);
  assert.equal(led.visualState, 'default');
});
