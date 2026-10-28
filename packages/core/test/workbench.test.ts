import test from 'node:test';
import assert from 'node:assert/strict';
import type { CircuitDefinition } from '@webboard/contracts';
import { WorkbenchStateMachine, TopologyLockedError } from '../dist/index.js';

function createHealthyCircuit(): CircuitDefinition {
  return {
    schemaVersion: '1.0.0',
    circuitId: 'ckt_workbench_test',
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
        id: 'w1',
        from: { componentId: 'mcu_uno_01', pinId: 'D13' },
        to: { componentId: 'res_01', pinId: 'PIN_1' },
        color: 'GREEN',
      },
      {
        id: 'w2',
        from: { componentId: 'res_01', pinId: 'PIN_2' },
        to: { componentId: 'led_01', pinId: 'ANODE' },
        color: 'RED',
      },
      {
        id: 'w3',
        from: { componentId: 'led_01', pinId: 'CATHODE' },
        to: { componentId: 'mcu_uno_01', pinId: 'GND_1' },
        color: 'BLACK',
      },
    ],
  };
}

test('WorkbenchStateMachine controla transicoes MODO_EDICAO <-> MODO_SIMULACAO', () => {
  const wb = new WorkbenchStateMachine(createHealthyCircuit());
  assert.equal(wb.getMode(), 'MODO_EDICAO');

  const modeChanges: string[] = [];
  wb.onModeChange((newMode, prev) => {
    modeChanges.push(`${prev}->${newMode}`);
  });

  const startRes = wb.startSimulation();
  assert.equal(startRes.success, true);
  assert.equal(wb.getMode(), 'MODO_SIMULACAO');

  wb.stopSimulation();
  assert.equal(wb.getMode(), 'MODO_EDICAO');

  assert.deepEqual(modeChanges, [
    'MODO_EDICAO->MODO_SIMULACAO',
    'MODO_SIMULACAO->MODO_EDICAO',
  ]);
});

test('RN-BNC-01: Rejeita mutacoes estruturais durante MODO_SIMULACAO', () => {
  const wb = new WorkbenchStateMachine(createHealthyCircuit());
  wb.startSimulation();
  assert.equal(wb.getMode(), 'MODO_SIMULACAO');

  // 1. Tentar adicionar componente
  assert.throws(
    () => {
      wb.addComponent({
        id: 'comp_extra',
        type: 'PASSIVE_RESISTOR',
        isLocked: false,
        position: { x: 50, y: 50 },
        parameters: {},
      });
    },
    (err: any) => {
      assert.ok(err instanceof TopologyLockedError);
      assert.equal(err.rule, 'RN-BNC-01');
      assert.match(err.message, /\[RN-BNC-01\]/);
      return true;
    }
  );

  // 2. Tentar remover componente
  assert.throws(
    () => wb.removeComponent('res_01'),
    (err: any) => err instanceof TopologyLockedError && err.rule === 'RN-BNC-01'
  );

  // 3. Tentar adicionar fio
  assert.throws(
    () => {
      wb.addWire({
        id: 'w_extra',
        from: { componentId: 'mcu_uno_01', pinId: 'D2' },
        to: { componentId: 'mcu_uno_01', pinId: 'D3' },
        color: 'BLUE',
      });
    },
    (err: any) => err instanceof TopologyLockedError && err.rule === 'RN-BNC-01'
  );

  // 4. Tentar remover fio
  assert.throws(
    () => wb.removeWire('w1'),
    (err: any) => err instanceof TopologyLockedError && err.rule === 'RN-BNC-01'
  );

  // 5. Tentar alterar posicao
  assert.throws(
    () => wb.updateComponentPosition('res_01', { x: 500, y: 500 }),
    (err: any) => err instanceof TopologyLockedError && err.rule === 'RN-BNC-01'
  );
});

test('Detecao imediata de curto em T=0 transita para ESTADO_FALHA_ENG', () => {
  const cktCurto: CircuitDefinition = {
    schemaVersion: '1.0.0',
    circuitId: 'ckt_curto',
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
        id: 'w_curto_fatal',
        from: { componentId: 'mcu_uno_01', pinId: '5V' },
        to: { componentId: 'mcu_uno_01', pinId: 'GND_1' },
        color: 'RED',
      },
    ],
  };

  const wb = new WorkbenchStateMachine(cktCurto);
  const startRes = wb.startSimulation();

  assert.equal(startRes.success, false);
  assert.equal(wb.getMode(), 'ESTADO_FALHA_ENG');
  assert.ok(wb.getFault());
  assert.equal(wb.getFault()?.type, 'SHORT_CIRCUIT');
  assert.equal(wb.getFault()?.failedWireId, 'w_curto_fatal');

  // RN-BNC-02: Em ESTADO_FALHA_ENG, mutacoes tambem sao rejeitadas ate desligar
  assert.throws(
    () => wb.removeWire('w_curto_fatal'),
    (err: any) => err instanceof TopologyLockedError && err.rule === 'RN-BNC-02'
  );

  // Ao desligar, volta para MODO_EDICAO e permite correcao
  wb.stopSimulation();
  assert.equal(wb.getMode(), 'MODO_EDICAO');
  wb.removeWire('w_curto_fatal');
  assert.equal(wb.getCircuit().wires.length, 0);
});

test('Transicao automatica para ESTADO_FALHA_ENG por sobrecorrente termica', () => {
  const cktSemResistor: CircuitDefinition = {
    schemaVersion: '1.0.0',
    circuitId: 'ckt_queima_wb',
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
        id: 'w1',
        from: { componentId: 'mcu_uno_01', pinId: 'D13' },
        to: { componentId: 'led_01', pinId: 'ANODE' },
        color: 'RED',
      },
      {
        id: 'w2',
        from: { componentId: 'led_01', pinId: 'CATHODE' },
        to: { componentId: 'mcu_uno_01', pinId: 'GND_1' },
        color: 'BLACK',
      },
    ],
  };

  const wb = new WorkbenchStateMachine(cktSemResistor);
  wb.startSimulation();
  wb.setPinOutput('mcu_uno_01', 'D13', 'HIGH');

  // Passo de 5ms: ainda seguro
  wb.step(0.005);
  assert.equal(wb.getMode(), 'MODO_SIMULACAO');

  // Mais 5ms (total 10ms): atinge destruicao termica
  let capturedFault: any = null;
  wb.onFault((f) => {
    capturedFault = f;
  });

  wb.step(0.005);
  assert.equal(wb.getMode(), 'ESTADO_FALHA_ENG');
  assert.ok(capturedFault);
  assert.equal(capturedFault.type, 'OVERCURRENT');
  assert.equal(capturedFault.failedComponentId, 'led_01');

  // Tentar avancar congelado lanca erro
  assert.throws(() => wb.step(0.001), /Não é possível avançar a simulação enquanto a bancada estiver congelada/);
});

test('RN-BNC-03: Interatividade e estimulos sao permitidos em MODO_SIMULACAO', () => {
  const wb = new WorkbenchStateMachine(createHealthyCircuit());
  wb.startSimulation();

  // Nao deve lancar erro ao ajustar estimulos de ambiente ou pinos
  assert.doesNotThrow(() => {
    wb.setPinOutput('mcu_uno_01', 'D13', 'HIGH');
    wb.setEnvironmentObstacleDistance('obs_wall_01', 30.5);
    wb.setEnvironmentAmbientLightLux(500);
  });

  assert.equal(wb.getCircuit().environment?.obstacles?.[0].distanceCm, 30.5);
  assert.equal(wb.getCircuit().environment?.ambientLightLux, 500);
});
