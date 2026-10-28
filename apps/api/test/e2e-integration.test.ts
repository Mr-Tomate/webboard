import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../dist/app.js';
import { TelemetryRoomManager } from '../dist/telemetry/room-manager.js';
import type {
  CircuitDefinition,
  ChallengeDefinition,
} from '@webboard/contracts';
import type { FastifyInstance } from 'fastify';

describe('TIJOLO 6: Teste de Integracao E2E - Fluxo Completo de Aluno e Docente', () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;
  let roomManager: TelemetryRoomManager;
  const runId = `e2e_${Date.now().toString(36)}`;

  let tenantId: string;
  let teacherId: string;
  let studentId: string;
  let classroomId: string;
  let challengeId: string;
  let workspaceId: string;

  before(async () => {
    prisma = new PrismaClient();
    roomManager = new TelemetryRoomManager();
    app = await buildApp({ prisma, roomManager });
    await app.ready();

    // 1. Setup Institucional e Usuários no Banco
    const tenant = await prisma.tenant.create({
      data: {
        name: `Instituto de Tecnologia ${runId}`,
        slug: `inst-tech-${runId}`,
      },
    });
    tenantId = tenant.id;

    const teacher = await prisma.user.create({
      data: {
        tenantId,
        name: 'Prof. Renato Engenharia',
        email: `renato_${runId}@escola.com`,
        role: 'TEACHER',
      },
    });
    teacherId = teacher.id;

    const student = await prisma.user.create({
      data: {
        tenantId,
        name: 'Lucas Estudante',
        email: `lucas_${runId}@escola.com`,
        role: 'STUDENT',
      },
    });
    studentId = student.id;

    const classroom = await prisma.classroom.create({
      data: {
        tenantId,
        name: 'Turma de Robótica e Sistemas Embarcados',
        code: `ROB-${runId.toUpperCase()}`,
        members: {
          create: [
            { userId: teacherId, role: 'TEACHER' },
            { userId: studentId, role: 'STUDENT' },
          ],
        },
      },
    });
    classroomId = classroom.id;
  });

  after(async () => {
    // Limpeza de recursos
    if (workspaceId) {
      await prisma.workspace.deleteMany({ where: { id: workspaceId } });
    }
    if (challengeId) {
      await prisma.challenge.deleteMany({ where: { id: challengeId } });
    }
    if (classroomId) {
      await prisma.classroom.deleteMany({ where: { id: classroomId } });
    }
    if (tenantId) {
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }

    await app.close();
    await prisma.$disconnect();
  });

  test('Fase 1: Professor cadastra o Desafio Oficial na API', async () => {
    const challengePayload = {
      title: 'Desafio do Alarme com Resistor de Proteção',
      description: 'Ligue o LED no pino D13 com resistor protetor de 220 ohms.',
      difficulty: 'INTERMEDIATE' as const,
      kitPolicy: {
        mode: 'RESTRICTED_BOM',
        allowedComponents: [
          { type: 'MICROCONTROLLER_ARDUINO_UNO', maxQuantity: 1 },
          { type: 'ACTUATOR_LED', maxQuantity: 2 },
          { type: 'PASSIVE_RESISTOR', maxQuantity: 3 },
        ],
      },
      testSuite: [
        {
          id: 'tc_static_resistor',
          name: 'Verificacao Obrigatoria do Resistor de Protecao',
          isPublic: true,
          timeoutVirtualSeconds: 0,
          staticAssertions: [
            {
              type: 'COMPONENT_COUNT',
              componentType: 'ACTUATOR_LED',
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
      ],
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/challenges',
      payload: challengePayload,
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.ok(body.challengeId);
    challengeId = body.challengeId;
    assert.equal(body.title, challengePayload.title);
  });

  test('Fase 2: Conexão Realtime do Professor no Dashboard Panóptico', async () => {
    const teacherMessages: any[] = [];

    const teacherWs = await app.injectWS(
      `/ws/telemetry?role=teacher&classroomId=${classroomId}`,
      {},
      {
        onInit: (ws) => {
          ws.on('message', (raw) => {
            teacherMessages.push(JSON.parse(raw.toString()));
          });
        },
      }
    );

    await new Promise((r) => setTimeout(r, 60));
    assert.ok(teacherMessages.length >= 1);
    assert.equal(teacherMessages[0].type, 'CLASSROOM_SNAPSHOT');
    assert.equal(teacherMessages[0].payload.classroomId, classroomId);

    teacherWs.close();
  });

  test('Fase 3: Aluno cria Workspace, envia circuito perigoso (sem resistor) e Professor intervém', async () => {
    // 1. Aluno cria workspace
    const wsRes = await app.inject({
      method: 'POST',
      url: '/api/workspaces',
      payload: {
        name: 'Bancada Lucas E2E',
        type: 'SOLO',
        ownerId: studentId,
        classroomId,
        circuit: {
          schemaVersion: '1.0.0',
          circuitId: `ckt_lucas_${runId}`,
          components: [
            {
              id: 'mcu_01',
              type: 'MICROCONTROLLER_ARDUINO_UNO',
              isLocked: true,
              position: { x: 100, y: 100 },
              parameters: {},
            },
            {
              id: 'led_01',
              type: 'ACTUATOR_LED',
              isLocked: false,
              position: { x: 250, y: 100 },
              parameters: { color: 'RED' },
            },
          ],
          wires: [
            {
              id: 'w_fatal_direct',
              from: { componentId: 'mcu_01', pinId: 'D13' },
              to: { componentId: 'led_01', pinId: 'ANODE' },
              color: 'RED',
            },
          ],
        },
      },
    });

    assert.equal(wsRes.statusCode, 201);
    const wsBody = JSON.parse(wsRes.body);
    workspaceId = wsBody.id;

    // 2. Conectar sockets do Professor e do Aluno
    const teacherMessages: any[] = [];
    const teacherWs = await app.injectWS(
      `/ws/telemetry?role=teacher&classroomId=${classroomId}`,
      {},
      {
        onInit: (ws) => {
          ws.on('message', (raw) => teacherMessages.push(JSON.parse(raw.toString())));
        },
      }
    );

    const studentMessages: any[] = [];
    const studentWs = await app.injectWS(
      `/ws/telemetry?role=student&workspaceId=${workspaceId}&classroomId=${classroomId}`,
      {},
      {
        onInit: (ws) => {
          ws.on('message', (raw) => studentMessages.push(JSON.parse(raw.toString())));
        },
      }
    );

    // 3. Aluno submete o circuito incorreto para o desafio
    const subFailRes = await app.inject({
      method: 'POST',
      url: `/api/workspaces/${workspaceId}/submissions`,
      payload: {
        challengeId,
        userId: studentId,
        circuit: wsBody.circuit,
        codeText: 'void setup() { pinMode(13, OUTPUT); } void loop() { digitalWrite(13, HIGH); }',
        language: 'CPP',
      },
    });

    assert.equal(subFailRes.statusCode, 201);
    const subFailBody = JSON.parse(subFailRes.body);
    // AutoGrader rejeitou automaticamente por falta de resistor protetor
    assert.equal(subFailBody.evaluation.status, 'REJECTED_CIRCUIT');
    assert.match(subFailBody.evaluation.testResults[0].message, /resistor de proteção/);

    // 4. Aluno dispara alerta de falha elétrica no WebSocket
    studentWs.send(
      JSON.stringify({
        type: 'FAULT_ALERT',
        payload: {
          workspaceId,
          faultType: 'OVERCURRENT',
          message: 'LED destruído por sobrecorrente térmica (>30mA por >10ms)!',
        },
      })
    );

    // 5. Professor recebe alerta em tempo real no dashboard
    await new Promise((r) => setTimeout(r, 60));
    const faultMsg = teacherMessages.find(
      (m) => m.type === 'WORKSPACE_FAULT_ALERT'
    );
    assert.ok(faultMsg, 'Professor deve receber WORKSPACE_FAULT_ALERT');
    assert.equal(faultMsg.payload.faultType, 'OVERCURRENT');

    // 6. Professor envia nota pedagógica de orientação (RN-PED-01 e RN-PED-02)
    teacherWs.send(
      JSON.stringify({
        type: 'SEND_NOTE',
        payload: {
          workspaceId,
          author: 'Prof. Renato Engenharia',
          text: 'O LED queimou por sobrecorrente! Conecte um resistor de 220 ohms em série com o ANODE.',
          targetComponentId: 'led_01',
        },
      })
    );

    // 7. Bancada do aluno recebe a orientação pedagógica sem alteração nos fios
    await new Promise((r) => setTimeout(r, 60));
    const noteMsg = studentMessages.find(
      (m) => m.type === 'PEDAGOGICAL_NOTE_RECEIVED'
    );
    assert.ok(noteMsg, 'Aluno deve receber a nota de mentoria');
    assert.equal(noteMsg.payload.note.author, 'Prof. Renato Engenharia');
    assert.equal(noteMsg.payload.note.targetComponentId, 'led_01');

    teacherWs.close();
    studentWs.close();
  });

  test('Fase 4: Aluno insere o resistor de 220Ω, re-submete e obtém APPROVED com telemetria 100%', async () => {
    // 1. Docente conectado escutando o semáforo da sala
    const teacherMessages: any[] = [];
    const teacherWs = await app.injectWS(
      `/ws/telemetry?role=teacher&classroomId=${classroomId}`,
      {},
      {
        onInit: (ws) => {
          ws.on('message', (raw) => teacherMessages.push(JSON.parse(raw.toString())));
        },
      }
    );

    // 2. Aluno atualiza a bancada com resistor de 220 ohms
    const correctCircuit: CircuitDefinition = {
      schemaVersion: '1.0.0',
      circuitId: `ckt_lucas_${runId}`,
      components: [
        {
          id: 'mcu_01',
          type: 'MICROCONTROLLER_ARDUINO_UNO',
          isLocked: true,
          position: { x: 100, y: 100 },
          parameters: {},
        },
        {
          id: 'res_01',
          type: 'PASSIVE_RESISTOR',
          isLocked: false,
          position: { x: 200, y: 100 },
          parameters: { resistanceOhms: 220 },
        },
        {
          id: 'led_01',
          type: 'ACTUATOR_LED',
          isLocked: false,
          position: { x: 300, y: 100 },
          parameters: { color: 'RED' },
        },
      ],
      wires: [
        {
          id: 'w_d13_to_res',
          from: { componentId: 'mcu_01', pinId: 'D13' },
          to: { componentId: 'res_01', pinId: 'PIN_1' },
          color: 'GREEN',
        },
        {
          id: 'w_res_to_led',
          from: { componentId: 'res_01', pinId: 'PIN_2' },
          to: { componentId: 'led_01', pinId: 'ANODE' },
          color: 'RED',
        },
        {
          id: 'w_led_to_gnd',
          from: { componentId: 'led_01', pinId: 'CATHODE' },
          to: { componentId: 'mcu_01', pinId: 'GND_1' },
          color: 'BLACK',
        },
      ],
    };

    // Atualiza bancada via PUT
    await app.inject({
      method: 'PUT',
      url: `/api/workspaces/${workspaceId}`,
      payload: {
        circuit: correctCircuit,
        codeText: 'void setup() { pinMode(13, OUTPUT); } void loop() { digitalWrite(13, HIGH); }',
      },
    });

    // 3. Submissão Oficial v2 com circuito corrigido
    const subRes = await app.inject({
      method: 'POST',
      url: `/api/workspaces/${workspaceId}/submissions`,
      payload: {
        challengeId,
        userId: studentId,
        circuit: correctCircuit,
        codeText: 'void setup() { pinMode(13, OUTPUT); } void loop() { digitalWrite(13, HIGH); }',
        language: 'CPP',
      },
    });

    assert.equal(subRes.statusCode, 201);
    const subBody = JSON.parse(subRes.body);

    // AutoGrader headless avaliou e aprovou!
    assert.equal(subBody.versionNumber, 2);
    assert.equal(subBody.evaluation.status, 'APPROVED');
    assert.equal(subBody.evaluation.summary.passedTests, 1);
    assert.equal(subBody.evaluation.summary.failedTests, 0);

    // 4. Verificar se a telemetria WebSocket atualizou o professor
    await new Promise((r) => setTimeout(r, 60));
    const updateMsg = teacherMessages.find(
      (m) =>
        m.type === 'WORKSPACE_PULSE_UPDATED' &&
        m.payload.pulse.workspaceId === workspaceId &&
        m.payload.pulse.status === 'NORMAL'
    );
    assert.ok(updateMsg, 'Dashboard do professor deve receber status NORMAL após aprovação');
    assert.equal(updateMsg.payload.pulse.testSummary.passed, 1);
    assert.equal(updateMsg.payload.pulse.testSummary.total, 1);

    teacherWs.close();
  });
});
