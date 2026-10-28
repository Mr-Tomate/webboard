import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../dist/app.js';
import { TelemetryRoomManager } from '../dist/telemetry/room-manager.js';
import type { StudentWorkspacePulse } from '../dist/telemetry/types.js';
import type { FastifyInstance } from 'fastify';

describe('Telemetria e WebSocket: Observabilidade Panóptica Docente e Pulsos de Bancada', () => {
  let app: FastifyInstance;
  let roomManager: TelemetryRoomManager;

  const mockPrisma: any = {
    $connect: async () => {},
    $disconnect: async () => {},
  };

  before(async () => {
    roomManager = new TelemetryRoomManager();
    app = await buildApp({ prisma: mockPrisma, roomManager });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test('TelemetryRoomManager: Calcula status semafóricos conforme spec 04', () => {
    const mgr = new TelemetryRoomManager();

    const normalPulse: StudentWorkspacePulse = {
      workspaceId: 'ws_01',
      teamName: 'Equipe Alpha',
      students: ['Aluno 1'],
      status: 'NORMAL',
      lastActivitySecondsAgo: 10,
      currentChallengeTitle: 'Desafio 1',
      circuitMetrics: {
        componentCount: 3,
        wireCount: 3,
        hasShortCircuit: false,
        hasThermalDestruction: false,
      },
      codeLanguage: 'CPP',
      compilationAttempts: 1,
      testSummary: { passed: 2, total: 2 },
      pedagogicalNotes: [],
    };
    assert.equal(mgr.determineStatus(normalPulse), 'NORMAL');

    // Falha Crítica por curto
    const shortPulse: StudentWorkspacePulse = {
      ...normalPulse,
      circuitMetrics: { ...normalPulse.circuitMetrics, hasShortCircuit: true },
    };
    assert.equal(mgr.determineStatus(shortPulse), 'FALHA_CRÍTICA');

    // Falha Crítica por destruição térmica
    const thermalPulse: StudentWorkspacePulse = {
      ...normalPulse,
      circuitMetrics: { ...normalPulse.circuitMetrics, hasThermalDestruction: true },
    };
    assert.equal(mgr.determineStatus(thermalPulse), 'FALHA_CRÍTICA');

    // Dificuldade por tentativas excessivas de compilação
    const diffPulse: StudentWorkspacePulse = {
      ...normalPulse,
      compilationAttempts: 4,
      testSummary: { passed: 0, total: 2 },
    };
    assert.equal(mgr.determineStatus(diffPulse), 'DIFICULDADE');

    // Inativo por falta de atividade (> 300s)
    const inactivePulse: StudentWorkspacePulse = {
      ...normalPulse,
      lastActivitySecondsAgo: 350,
    };
    assert.equal(mgr.determineStatus(inactivePulse), 'INATIVO');
  });

  test('TelemetryRoomManager: Agregação de turma e notas pedagógicas (RN-PED-01/02)', () => {
    const mgr = new TelemetryRoomManager();
    const classroomId = 'turma_mecatronica_101';

    mgr.processPulse({
      workspaceId: 'ws_bancada_01',
      classroomId,
      teamName: 'Bancada 01',
      students: ['Lucas'],
      status: 'NORMAL',
      lastActivitySecondsAgo: 5,
      currentChallengeTitle: 'Blink',
      circuitMetrics: {
        componentCount: 4,
        wireCount: 4,
        hasShortCircuit: false,
        hasThermalDestruction: false,
      },
      codeLanguage: 'CPP',
      compilationAttempts: 1,
      testSummary: { passed: 2, total: 2 },
      pedagogicalNotes: [],
    });

    mgr.processPulse({
      workspaceId: 'ws_bancada_02',
      classroomId,
      teamName: 'Bancada 02',
      students: ['Mariana'],
      status: 'NORMAL',
      lastActivitySecondsAgo: 12,
      currentChallengeTitle: 'Blink',
      circuitMetrics: {
        componentCount: 3,
        wireCount: 3,
        hasShortCircuit: true,
        hasThermalDestruction: false,
      },
      codeLanguage: 'CPP',
      compilationAttempts: 3,
      testSummary: { passed: 0, total: 2 },
      pedagogicalNotes: [],
    });

    const summary = mgr.computeClassroomSummary(classroomId);
    assert.equal(summary.totalWorkspaces, 2);
    assert.equal(summary.statusCounts.normal, 1);
    assert.equal(summary.statusCounts.critical, 1);
    assert.equal(summary.averageProgressPercent, 50); // (100% + 0%) / 2

    // Professor insere feedback contextual
    const note = mgr.addPedagogicalNote(classroomId, 'ws_bancada_02', {
      author: 'Prof. Carlos',
      text: 'Verifique se o terminal ANODE não está ligado direto no 5V sem resistor.',
      targetComponentId: 'led_01',
    });

    assert.ok(note);
    assert.equal(note.author, 'Prof. Carlos');

    const updated = mgr.getClassroomWorkspaces(classroomId);
    const ws2 = updated.find((w) => w.workspaceId === 'ws_bancada_02');
    assert.equal(ws2?.pedagogicalNotes.length, 1);
    assert.equal(ws2?.pedagogicalNotes[0].targetComponentId, 'led_01');
  });

  test('REST API: Envio de pulso via HTTP e consulta do resumo da turma', async () => {
    const classroomId = 'turma_robotica_a';
    const workspaceId = 'ws_aluno_teste_01';

    const pulsePayload: StudentWorkspacePulse = {
      workspaceId,
      classroomId,
      teamName: 'Equipe Delta',
      students: ['Ana Paula'],
      status: 'NORMAL',
      lastActivitySecondsAgo: 20,
      currentChallengeTitle: 'Sensor Ultrassônico',
      circuitMetrics: {
        componentCount: 5,
        wireCount: 6,
        hasShortCircuit: false,
        hasThermalDestruction: false,
      },
      codeLanguage: 'CPP',
      compilationAttempts: 1,
      testSummary: { passed: 3, total: 3 },
      pedagogicalNotes: [],
    };

    // 1. Enviar pulso
    const postRes = await app.inject({
      method: 'POST',
      url: `/api/workspaces/${workspaceId}/telemetry/pulse`,
      payload: pulsePayload,
    });
    assert.equal(postRes.statusCode, 200);
    const postBody = JSON.parse(postRes.body);
    assert.equal(postBody.success, true);
    assert.equal(postBody.updatedPulse.status, 'NORMAL');

    // 2. Consultar telemetria da sala
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/classrooms/${classroomId}/telemetry`,
    });
    assert.equal(getRes.statusCode, 200);
    const getBody = JSON.parse(getRes.body);
    assert.equal(getBody.classroomId, classroomId);
    assert.equal(getBody.workspaces.length, 1);
    assert.equal(getBody.summary.totalWorkspaces, 1);
    assert.equal(getBody.summary.averageProgressPercent, 100);

    // 3. Adicionar nota pedagógica via REST
    const noteRes = await app.inject({
      method: 'POST',
      url: `/api/workspaces/${workspaceId}/notes`,
      payload: {
        author: 'Professora Marina',
        text: 'Excelente organização da fiação!',
        classroomId,
      },
    });
    assert.equal(noteRes.statusCode, 201);
    const noteBody = JSON.parse(noteRes.body);
    assert.equal(noteBody.success, true);
    assert.equal(noteBody.note.author, 'Professora Marina');
  });

  test('WebSocket: Handshake docente recebe CLASSROOM_SNAPSHOT e escuta atualizações', async () => {
    const classroomId = 'turma_ws_realtime';
    const workspaceId = 'ws_aluno_ws_01';

    // 1. Docente conecta ao WebSocket com captura imediata via onInit
    const receivedMessages: any[] = [];
    const teacherSocket = await app.injectWS(
      `/ws/telemetry?role=teacher&classroomId=${classroomId}`,
      {},
      {
        onInit: (ws) => {
          ws.on('message', (raw) => {
            receivedMessages.push(JSON.parse(raw.toString()));
          });
        },
      }
    );

    // Aguardar mensagem inicial (CLASSROOM_SNAPSHOT)
    await new Promise((r) => setTimeout(r, 60));
    assert.ok(receivedMessages.length >= 1, 'Deve receber CLASSROOM_SNAPSHOT');
    assert.equal(receivedMessages[0].type, 'CLASSROOM_SNAPSHOT');
    assert.equal(receivedMessages[0].payload.classroomId, classroomId);

    // 2. Estudante conecta e prepara captura de mensagens enviadas a ele
    const studentReceived: any[] = [];
    const studentSocket = await app.injectWS(
      `/ws/telemetry?role=student&workspaceId=${workspaceId}&classroomId=${classroomId}`,
      {},
      {
        onInit: (ws) => {
          ws.on('message', (raw) => {
            studentReceived.push(JSON.parse(raw.toString()));
          });
        },
      }
    );

    const studentPulse: StudentWorkspacePulse = {
      workspaceId,
      classroomId,
      teamName: 'Equipe Realtime',
      students: ['João Pedro'],
      status: 'NORMAL',
      lastActivitySecondsAgo: 2,
      currentChallengeTitle: 'Buzzer Sonoro',
      circuitMetrics: {
        componentCount: 4,
        wireCount: 4,
        hasShortCircuit: false,
        hasThermalDestruction: false,
      },
      codeLanguage: 'CPP',
      compilationAttempts: 1,
      testSummary: { passed: 1, total: 2 },
      pedagogicalNotes: [],
    };

    studentSocket.send(
      JSON.stringify({
        type: 'PULSE',
        payload: studentPulse,
      })
    );

    // Aguardar o docente receber WORKSPACE_PULSE_UPDATED
    await new Promise((r) => setTimeout(r, 60));
    const updateMsg = receivedMessages.find(
      (m) => m.type === 'WORKSPACE_PULSE_UPDATED'
    );
    assert.ok(updateMsg, 'Docente deve receber WORKSPACE_PULSE_UPDATED');
    assert.equal(updateMsg.payload.pulse.workspaceId, workspaceId);

    // 3. Estudante dispara FAULT_ALERT (Curto-circuito)
    studentSocket.send(
      JSON.stringify({
        type: 'FAULT_ALERT',
        payload: {
          workspaceId,
          faultType: 'SHORT_CIRCUIT',
          message: 'Curto-circuito direto detectado entre 5V e GND!',
        },
      })
    );

    await new Promise((r) => setTimeout(r, 60));
    const faultMsg = receivedMessages.find(
      (m) => m.type === 'WORKSPACE_FAULT_ALERT'
    );
    assert.ok(faultMsg, 'Docente deve receber WORKSPACE_FAULT_ALERT');
    assert.equal(faultMsg.payload.faultType, 'SHORT_CIRCUIT');

    // 4. Docente envia SEND_NOTE para o aluno
    teacherSocket.send(
      JSON.stringify({
        type: 'SEND_NOTE',
        payload: {
          workspaceId,
          author: 'Prof. Orientador',
          text: 'Desconecte o fio vermelho que une D13 e GND antes de religar a bancada.',
        },
      })
    );

    await new Promise((r) => setTimeout(r, 60));
    const noteMsg = studentReceived.find(
      (m) => m.type === 'PEDAGOGICAL_NOTE_RECEIVED'
    );
    assert.ok(noteMsg, 'Estudante deve receber PEDAGOGICAL_NOTE_RECEIVED');
    assert.equal(noteMsg.payload.note.author, 'Prof. Orientador');

    teacherSocket.close();
    studentSocket.close();
  });
});
