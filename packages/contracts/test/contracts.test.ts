import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTRACTS_VERSION,
  type CircuitDefinition,
  type ChallengeDefinition,
  type SubmissionSnapshot,
  type ComponentManifest,
  type WorkbenchFaultPayload,
} from '../dist/index.js';

test('CONTRACTS_VERSION is defined', () => {
  assert.equal(CONTRACTS_VERSION, '1.0.0');
});

test('CircuitDefinition conforms to spec 05', () => {
  const circuit: CircuitDefinition = {
    schemaVersion: '1.0.0',
    circuitId: 'ckt_7f9a1b2c',
    environment: {
      temperatureCelsius: 25.0,
      ambientLightLux: 300,
      obstacles: [
        {
          id: 'obs_wall_01',
          targetSensorId: 'sensor_sonar_01',
          distanceCm: 45.5,
        },
      ],
    },
    components: [
      {
        id: 'mcu_uno_01',
        type: 'MICROCONTROLLER_ARDUINO_UNO',
        label: 'Arduino Uno R3',
        isLocked: true,
        position: { x: 100, y: 150 },
        parameters: {},
      },
      {
        id: 'res_01',
        type: 'PASSIVE_RESISTOR',
        label: 'Resistor 220R',
        isLocked: false,
        position: { x: 320, y: 180 },
        parameters: {
          resistanceOhms: 220,
          tolerancePercent: 5,
          powerRatingWatts: 0.25,
        },
      },
    ],
    wires: [
      {
        id: 'wire_01',
        from: { componentId: 'mcu_uno_01', pinId: 'D13' },
        to: { componentId: 'res_01', pinId: 'PIN_1' },
        color: 'GREEN',
        waypoints: [{ x: 200, y: 150 }],
      },
    ],
  };

  assert.equal(circuit.circuitId, 'ckt_7f9a1b2c');
  assert.equal(circuit.components.length, 2);
  assert.equal(circuit.wires[0].waypoints?.[0].x, 200);
});

test('ChallengeDefinition conforms to spec 05', () => {
  const challenge: ChallengeDefinition = {
    schemaVersion: '1.0.0',
    challengeId: 'ch_alarme_distancia_01',
    title: 'Alarme de Proximidade',
    difficulty: 'INTERMEDIATE',
    allowedLanguages: ['CPP', 'PYTHON'],
    kitPolicy: {
      mode: 'RESTRICTED_BOM',
      allowedComponents: [
        { type: 'MICROCONTROLLER_ARDUINO_UNO', maxQuantity: 1 },
      ],
    },
    initialCircuit: {
      components: [],
      wires: [],
    },
    testSuite: [
      {
        id: 'tc_public_01',
        name: 'Topologia e Protecao',
        isPublic: true,
        timeoutVirtualSeconds: 0.0,
        staticAssertions: [
          {
            type: 'COMPONENT_COUNT',
            componentType: 'ACTUATOR_BUZZER',
            expectedExactCount: 1,
          },
        ],
        stimuli: [],
        dynamicAssertions: [],
      },
    ],
  };

  assert.equal(challenge.challengeId, 'ch_alarme_distancia_01');
  assert.equal(challenge.testSuite.length, 1);
});

test('SubmissionSnapshot conforms to spec 05', () => {
  const snapshot: SubmissionSnapshot = {
    schemaVersion: '1.0.0',
    submissionId: 'sub_99a8b7c6',
    workspaceId: 'ws_turma_8b_equipe_03',
    challengeId: 'ch_alarme_distancia_01',
    versionNumber: 3,
    submittedAt: '2026-10-28T10:45:00Z',
    submittedBy: {
      userId: 'usr_aluno_lucas',
      collaboratorUserIds: ['usr_aluno_gabriel'],
    },
    payload: {
      code: {
        language: 'PYTHON',
        sourceText: 'import pyfirmata\n',
      },
      circuit: {
        circuitId: 'ckt_7f9a1b2c',
        components: [],
        wires: [],
      },
    },
    evaluation: {
      status: 'APPROVED',
      totalExecutionVirtualSeconds: 7.0,
      summary: {
        totalTests: 1,
        passedTests: 1,
        failedTests: 0,
      },
      testResults: [
        {
          testCaseId: 'tc_public_01',
          passed: true,
          executionTimeVirtualSeconds: 0.0,
          message: 'Topologia ok',
        },
      ],
    },
  };

  assert.equal(snapshot.submissionId, 'sub_99a8b7c6');
  assert.equal(snapshot.evaluation?.status, 'APPROVED');
});

test('ComponentManifest and FaultPayload conform to specs', () => {
  const manifest: ComponentManifest = {
    id: 'actuator_led',
    name: 'LED Difuso',
    category: 'ACTUATOR',
    dimensions: { width: 32, height: 48 },
    pins: [
      {
        id: 'ANODE',
        label: 'Anodo (+)',
        type: 'PASSIVE',
        anchorPosition: { x: 10, y: 48 },
      },
      {
        id: 'CATHODE',
        label: 'Catodo (-)',
        type: 'PASSIVE',
        anchorPosition: { x: 22, y: 48 },
      },
    ],
    defaultParameters: {
      color: 'RED',
      forwardVoltageVolts: 1.8,
    },
    visualStates: ['default', 'active', 'failure'],
  };

  const fault: WorkbenchFaultPayload = {
    type: 'SHORT_CIRCUIT',
    message: 'Curto circuito detectado',
    failedWireId: 'wire_01',
  };

  assert.equal(manifest.pins.length, 2);
  assert.equal(fault.type, 'SHORT_CIRCUIT');
});
