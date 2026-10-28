import test from 'node:test';
import assert from 'node:assert/strict';
import type { ChallengeDefinition, CircuitDefinition } from '@webboard/contracts';
import { AutoGrader } from '../dist/index.js';

function createCanonChallenge(): ChallengeDefinition {
  return {
    schemaVersion: '1.0.0',
    challengeId: 'ch_alarme_distancia_01',
    title: 'Alarme de Proximidade com Sensor Ultrassonico',
    difficulty: 'INTERMEDIATE',
    allowedLanguages: ['CPP', 'PYTHON'],
    kitPolicy: {
      mode: 'RESTRICTED_BOM',
      allowedComponents: [
        { type: 'MICROCONTROLLER_ARDUINO_UNO', maxQuantity: 1 },
        { type: 'SENSOR_ULTRASONIC_HCSR04', maxQuantity: 1 },
        { type: 'ACTUATOR_BUZZER', maxQuantity: 1 },
        { type: 'ACTUATOR_LED', maxQuantity: 2 },
        { type: 'PASSIVE_RESISTOR', maxQuantity: 4 },
      ],
    },
    initialCircuit: {
      components: [],
      wires: [],
    },
    testSuite: [
      {
        id: 'tc_public_01',
        name: 'Verificacao de Topologia e Seguranca Eletrica',
        isPublic: true,
        timeoutVirtualSeconds: 0.0,
        staticAssertions: [
          {
            type: 'COMPONENT_COUNT',
            componentType: 'ACTUATOR_BUZZER',
            expectedExactCount: 1,
          },
          {
            type: 'SERIES_PROTECTION_RESISTOR',
            targetComponentType: 'ACTUATOR_LED',
            minResistanceOhms: 150,
            maxResistanceOhms: 1000,
          },
        ],
        stimuli: [],
        dynamicAssertions: [],
      },
      {
        id: 'tc_public_02',
        name: 'Alerta Ativo para Obstaculo a Menos de 20cm',
        isPublic: true,
        timeoutVirtualSeconds: 3.0,
        staticAssertions: [],
        stimuli: [
          {
            atVirtualSecond: 0.0,
            target: 'environment.obstacles.obs_wall_01',
            action: 'SET_DISTANCE',
            value: 15.0,
          },
        ],
        dynamicAssertions: [
          {
            type: 'PIN_PULSE_FREQUENCY',
            targetPin: { componentType: 'ACTUATOR_BUZZER', pinId: 'VCC' },
            duringVirtualSeconds: { start: 0.5, end: 2.5 },
            expectedMinFrequencyHz: 1.0,
            expectedMaxFrequencyHz: 10.0,
          },
        ],
      },
      {
        id: 'tc_hidden_03',
        name: 'Silencio com Obstaculo Distante (Teste Oculto)',
        isPublic: false,
        timeoutVirtualSeconds: 2.0,
        staticAssertions: [],
        stimuli: [
          {
            atVirtualSecond: 0.0,
            target: 'environment.obstacles.obs_wall_01',
            action: 'SET_DISTANCE',
            value: 80.0,
          },
        ],
        dynamicAssertions: [
          {
            type: 'PIN_STEADY_STATE',
            targetPin: { componentType: 'ACTUATOR_BUZZER', pinId: 'VCC' },
            duringVirtualSeconds: { start: 0.5, end: 1.8 },
            expectedLevel: 'LOW',
          },
        ],
      },
    ],
  };
}

function createCorrectCircuit(): CircuitDefinition {
  return {
    schemaVersion: '1.0.0',
    circuitId: 'ckt_aluno_solucao_ok',
    components: [
      {
        id: 'mcu_uno_01',
        type: 'MICROCONTROLLER_ARDUINO_UNO',
        isLocked: true,
        position: { x: 100, y: 100 },
        parameters: {},
      },
      {
        id: 'sonar_01',
        type: 'SENSOR_ULTRASONIC_HCSR04',
        isLocked: false,
        position: { x: 200, y: 100 },
        parameters: {},
      },
      {
        id: 'buzzer_01',
        type: 'ACTUATOR_BUZZER',
        isLocked: false,
        position: { x: 300, y: 100 },
        parameters: {},
      },
      {
        id: 'led_01',
        type: 'ACTUATOR_LED',
        isLocked: false,
        position: { x: 400, y: 100 },
        parameters: { color: 'RED' },
      },
      {
        id: 'res_01',
        type: 'PASSIVE_RESISTOR',
        isLocked: false,
        position: { x: 350, y: 100 },
        parameters: { resistanceOhms: 220 },
      },
    ],
    wires: [
      {
        id: 'w_res_led',
        from: { componentId: 'res_01', pinId: 'PIN_2' },
        to: { componentId: 'led_01', pinId: 'ANODE' },
        color: 'RED',
      },
      {
        id: 'w_d13_res',
        from: { componentId: 'mcu_uno_01', pinId: 'D13' },
        to: { componentId: 'res_01', pinId: 'PIN_1' },
        color: 'GREEN',
      },
      {
        id: 'w_buzzer',
        from: { componentId: 'mcu_uno_01', pinId: 'D8' },
        to: { componentId: 'buzzer_01', pinId: 'VCC' },
        color: 'YELLOW',
      },
      {
        id: 'w_gnd',
        from: { componentId: 'mcu_uno_01', pinId: 'GND_1' },
        to: { componentId: 'buzzer_01', pinId: 'GND' },
        color: 'BLACK',
      },
    ],
  };
}

test('AutoGrader: Rejeita circuito que viola KitPolicy BOM', () => {
  const challenge = createCanonChallenge();
  const circuitWithTooManyBuzzers = createCorrectCircuit();
  circuitWithTooManyBuzzers.components.push({
    id: 'buzzer_02',
    type: 'ACTUATOR_BUZZER',
    isLocked: false,
    position: { x: 300, y: 200 },
    parameters: {},
  });

  const result = AutoGrader.evaluate(challenge, {
    circuit: circuitWithTooManyBuzzers,
    code: { language: 'CPP', sourceText: '// codigo do aluno' },
  });

  assert.equal(result.status, 'REJECTED_CIRCUIT');
  assert.equal(result.summary.passedTests, 0);
  assert.match(result.testResults[0].message, /POLÍTICA DE KIT/);
  assert.match(result.testResults[0].message, /ACTUATOR_BUZZER/);
});

test('AutoGrader: Rejeita circuito onde LED nao possui resistor protetor (SERIES_PROTECTION_RESISTOR)', () => {
  const challenge = createCanonChallenge();
  const circuitSemResistor = createCorrectCircuit();
  circuitSemResistor.components = circuitSemResistor.components.filter(
    (c) => c.type !== 'PASSIVE_RESISTOR'
  );
  circuitSemResistor.wires = circuitSemResistor.wires.filter(
    (w) => w.id !== 'w_res_led' && w.id !== 'w_d13_res'
  );
  circuitSemResistor.wires.push({
    id: 'w_fatal_direct',
    from: { componentId: 'mcu_uno_01', pinId: 'D13' },
    to: { componentId: 'led_01', pinId: 'ANODE' },
    color: 'RED',
  });

  const result = AutoGrader.evaluate(challenge, {
    circuit: circuitSemResistor,
    code: { language: 'CPP', sourceText: '// codigo' },
  });

  assert.equal(result.status, 'REJECTED_CIRCUIT');
  assert.equal(result.testResults[0].passed, false);
  assert.match(result.testResults[0].message, /não possui resistor de proteção em série/);
});

test('AutoGrader: Avalia solucao correta e aprova todos os testes (Publicos e Ocultos)', () => {
  const challenge = createCanonChallenge();
  const correctCircuit = createCorrectCircuit();

  const result = AutoGrader.evaluate(
    challenge,
    {
      circuit: correctCircuit,
      code: {
        language: 'CPP',
        sourceText: '// logica do alarme implementada',
      },
    },
    { dtVirtualSeconds: 0.1 }
  );

  if (result.status !== 'APPROVED') {
    console.error('FALHA NO RESULTADO:', JSON.stringify(result, null, 2));
  }

  assert.equal(result.status, 'APPROVED');
  assert.equal(result.summary.totalTests, 3);
  assert.equal(result.summary.passedTests, 3);
  assert.equal(result.summary.failedTests, 0);
  assert.equal(result.testResults[0].passed, true);
  assert.equal(result.testResults[1].passed, true);
  assert.equal(result.testResults[2].passed, true);
});
