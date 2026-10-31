import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../dist/app.js';
import { TelemetryRoomManager } from '../dist/telemetry/room-manager.js';
import type { FastifyInstance } from 'fastify';

describe('FASE 2 AVANCADA (EIXO D): Colaboração Concorrente no Workspace de Grupo', () => {
  let app: FastifyInstance;
  let roomManager: TelemetryRoomManager;
  const workspaceId = 'ws_grupo_robotica_01';
  const classroomId = 'turma_grupo_101';

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

  test('Handshake e Presença: Snapshots iniciais, MEMBER_JOINED e MEMBER_LEFT', async () => {
    const studentAMessages: any[] = [];
    const studentBMessages: any[] = [];
    const presenceWsId = 'ws_presence_lifecycle_01';

    // 1. Aluno A (Lucas) conecta no workspace
    const wsA = await app.injectWS(
      `/ws/telemetry?role=student&workspaceId=${presenceWsId}&classroomId=${classroomId}&userId=user_lucas&userName=Lucas`,
      {},
      {
        onInit: (ws) => {
          ws.on('message', (raw) => studentAMessages.push(JSON.parse(raw.toString())));
        },
      }
    );

    await new Promise((r) => setTimeout(r, 60));

    // Lucas deve receber snapshots iniciais de locks e presença
    const locksSnapshotA = studentAMessages.find((m) => m.type === 'WORKSPACE_LOCKS_SNAPSHOT');
    const presenceSnapshotA = studentAMessages.find((m) => m.type === 'PRESENCE_SNAPSHOT');

    assert.ok(locksSnapshotA, 'Lucas deve receber WORKSPACE_LOCKS_SNAPSHOT no boot');
    assert.deepEqual(locksSnapshotA.payload.locks, []);
    assert.ok(presenceSnapshotA, 'Lucas deve receber PRESENCE_SNAPSHOT no boot');
    assert.equal(presenceSnapshotA.payload.members.length, 1);
    assert.equal(presenceSnapshotA.payload.members[0].userId, 'user_lucas');

    // 2. Aluno B (Gabriel) conecta no mesmo workspace
    const wsB = await app.injectWS(
      `/ws/telemetry?role=student&workspaceId=${presenceWsId}&classroomId=${classroomId}&userId=user_gabriel&userName=Gabriel`,
      {},
      {
        onInit: (ws) => {
          ws.on('message', (raw) => studentBMessages.push(JSON.parse(raw.toString())));
        },
      }
    );

    await new Promise((r) => setTimeout(r, 60));

    // Lucas deve receber anúncio MEMBER_JOINED de Gabriel
    const memberJoinedA = studentAMessages.find(
      (m) => m.type === 'MEMBER_JOINED' && m.payload.member.userId === 'user_gabriel'
    );
    assert.ok(memberJoinedA, 'Lucas deve receber MEMBER_JOINED quando Gabriel entrar');
    assert.equal(memberJoinedA.payload.member.userName, 'Gabriel');

    // Gabriel deve receber PRESENCE_SNAPSHOT contendo Lucas e Gabriel
    const presenceSnapshotB = studentBMessages.find((m) => m.type === 'PRESENCE_SNAPSHOT');
    assert.ok(presenceSnapshotB);
    assert.equal(presenceSnapshotB.payload.members.length, 2);

    // Consulta via endpoint REST de presença
    const resPresence = await app.inject({
      method: 'GET',
      url: `/api/workspaces/${presenceWsId}/presence`,
    });
    assert.equal(resPresence.statusCode, 200);
    const bodyPresence = resPresence.json();
    assert.equal(bodyPresence.members.length, 2);

    // 3. Gabriel desconecta
    wsB.terminate();
    await new Promise((r) => setTimeout(r, 150));

    // Lucas deve receber anúncio MEMBER_LEFT de Gabriel
    const memberLeftA = studentAMessages.find(
      (m) => m.type === 'MEMBER_LEFT' && m.payload.userId === 'user_gabriel'
    );
    assert.ok(memberLeftA, 'Lucas deve receber MEMBER_LEFT quando Gabriel sair');

    wsA.close();
  });

  test('Soft-Locking: Aluno A bloqueia componente e Aluno B tem tentativa rejeitada', async () => {
    const studentAMessages: any[] = [];
    const studentBMessages: any[] = [];

    // 1. Aluno A (Lucas) conecta no workspace
    const wsA = await app.injectWS(
      `/ws/telemetry?role=student&workspaceId=${workspaceId}&classroomId=${classroomId}&userId=user_lucas&userName=Lucas`,
      {},
      {
        onInit: (ws) => {
          ws.on('message', (raw) => studentAMessages.push(JSON.parse(raw.toString())));
        },
      }
    );

    // 2. Aluno B (Gabriel) conecta no mesmo workspace
    const wsB = await app.injectWS(
      `/ws/telemetry?role=student&workspaceId=${workspaceId}&classroomId=${classroomId}&userId=user_gabriel&userName=Gabriel`,
      {},
      {
        onInit: (ws) => {
          ws.on('message', (raw) => studentBMessages.push(JSON.parse(raw.toString())));
        },
      }
    );

    await new Promise((r) => setTimeout(r, 60));

    // 3. Lucas bloqueia o LED ("led_01") para arrastar na bancada
    wsA.send(
      JSON.stringify({
        type: 'LOCK_COMPONENT',
        payload: {
          componentId: 'led_01',
        },
      })
    );

    await new Promise((r) => setTimeout(r, 60));

    // Gabriel deve receber o COMPONENT_LOCKED
    const lockMsgB = studentBMessages.find(
      (m) => m.type === 'COMPONENT_LOCKED' && m.payload.componentId === 'led_01'
    );
    assert.ok(lockMsgB, 'Gabriel deve receber notificacao de que led_01 esta bloqueado');
    assert.equal(lockMsgB.payload.userName, 'Lucas');
    assert.equal(lockMsgB.payload.userId, 'user_lucas');

    // Endpoint REST de locks ativos reflete o bloqueio
    const resLocks = await app.inject({
      method: 'GET',
      url: `/api/workspaces/${workspaceId}/locks`,
    });
    assert.equal(resLocks.statusCode, 200);
    const bodyLocks = resLocks.json();
    assert.equal(bodyLocks.locks.length, 1);
    assert.equal(bodyLocks.locks[0].componentId, 'led_01');

    // 4. Gabriel tenta travar o mesmo LED enquanto Lucas segura
    wsB.send(
      JSON.stringify({
        type: 'LOCK_COMPONENT',
        payload: {
          componentId: 'led_01',
        },
      })
    );

    await new Promise((r) => setTimeout(r, 60));

    const rejectMsgB = studentBMessages.find((m) => m.type === 'LOCK_REJECTED');
    assert.ok(rejectMsgB, 'Gabriel deve ter sua tentativa de lock rejeitada');
    assert.match(rejectMsgB.payload.reason, /Lucas/);

    // 5. Lucas solta o LED (UNLOCK_COMPONENT)
    wsA.send(
      JSON.stringify({
        type: 'UNLOCK_COMPONENT',
        payload: {
          componentId: 'led_01',
        },
      })
    );

    await new Promise((r) => setTimeout(r, 60));

    const unlockMsgB = studentBMessages.find(
      (m) => m.type === 'COMPONENT_UNLOCKED' && m.payload.componentId === 'led_01'
    );
    assert.ok(unlockMsgB, 'Gabriel deve receber a liberacao do componente led_01');

    wsA.close();
    wsB.close();
  });

  test('Cursores Remotos e Mutação de Circuito: Sincronização em tempo real sem eco local', async () => {
    const studentBMessages: any[] = [];
    const studentAMessages: any[] = [];

    const wsA = await app.injectWS(
      `/ws/telemetry?role=student&workspaceId=${workspaceId}&classroomId=${classroomId}&userId=user_lucas&userName=Lucas`,
      {},
      {
        onInit: (ws) => {
          ws.on('message', (raw) => studentAMessages.push(JSON.parse(raw.toString())));
        },
      }
    );

    const wsB = await app.injectWS(
      `/ws/telemetry?role=student&workspaceId=${workspaceId}&classroomId=${classroomId}&userId=user_gabriel&userName=Gabriel`,
      {},
      {
        onInit: (ws) => {
          ws.on('message', (raw) => studentBMessages.push(JSON.parse(raw.toString())));
        },
      }
    );

    await new Promise((r) => setTimeout(r, 60));

    // Lucas move o cursor pela bancada
    wsA.send(
      JSON.stringify({
        type: 'CURSOR_MOVE',
        payload: {
          position: { x: 340, y: 220 },
        },
      })
    );

    await new Promise((r) => setTimeout(r, 60));

    const cursorMsgB = studentBMessages.find(
      (m) => m.type === 'CURSOR_MOVED' && m.payload.userId === 'user_lucas'
    );
    assert.ok(cursorMsgB, 'Gabriel deve receber a posicao do cursor de Lucas');
    assert.equal(cursorMsgB.payload.position.x, 340);
    assert.equal(cursorMsgB.payload.position.y, 220);

    // Lucas insere um componente na bancada (CIRCUIT_MUTATION)
    wsA.send(
      JSON.stringify({
        type: 'CIRCUIT_MUTATION',
        payload: {
          action: 'ADD_COMPONENT',
          data: {
            id: 'res_220',
            type: 'RESISTOR',
            position: { x: 120, y: 180 },
          },
        },
      })
    );

    await new Promise((r) => setTimeout(r, 60));

    const mutationMsgB = studentBMessages.find(
      (m) => m.type === 'CIRCUIT_MUTATED' && m.payload.action === 'ADD_COMPONENT'
    );
    assert.ok(mutationMsgB, 'Gabriel deve receber a mutacao de circuito realizada por Lucas');
    assert.equal(mutationMsgB.payload.userId, 'user_lucas');
    assert.equal(mutationMsgB.payload.userName, 'Lucas');
    assert.equal((mutationMsgB.payload.data as any).id, 'res_220');

    // Confirma que Lucas NÃO recebeu eco local de sua própria mutação
    const echoMutationA = studentAMessages.find((m) => m.type === 'CIRCUIT_MUTATED');
    assert.equal(echoMutationA, undefined, 'Lucas não deve receber eco de sua própria mutação');

    wsA.close();
    wsB.close();
  });

  test('Prevenção de Deadlock: Desconexão abrupta do usuário libera automaticamente seus locks', async () => {
    const studentBMessages: any[] = [];
    const deadLockWsId = 'ws_deadlock_test_01';

    const wsB = await app.injectWS(
      `/ws/telemetry?role=student&workspaceId=${deadLockWsId}&classroomId=${classroomId}&userId=user_gabriel&userName=Gabriel`,
      {},
      {
        onInit: (ws) => {
          ws.on('message', (raw) => studentBMessages.push(JSON.parse(raw.toString())));
        },
      }
    );

    const wsA = await app.injectWS(
      `/ws/telemetry?role=student&workspaceId=${deadLockWsId}&classroomId=${classroomId}&userId=user_lucas&userName=Lucas`
    );

    await new Promise((r) => setTimeout(r, 60));

    // Lucas trava resistor
    wsA.send(
      JSON.stringify({
        type: 'LOCK_COMPONENT',
        payload: {
          componentId: 'res_01',
        },
      })
    );

    // Aguardar confirmação de que o lock foi recebido por Gabriel
    await new Promise((r) => setTimeout(r, 80));
    const lockReceived = studentBMessages.find(
      (m) => m.type === 'COMPONENT_LOCKED' && m.payload.componentId === 'res_01'
    );
    assert.ok(lockReceived, 'Gabriel deve ter recebido COMPONENT_LOCKED inicial');

    // Lucas encerra a conexão abruptamente (queda de rede / crash / terminate)
    wsA.terminate();

    // Aguardar o evento close no servidor e propagação
    await new Promise((r) => setTimeout(r, 120));

    // Gabriel deve receber desbloqueio automático do resistor
    const autoUnlock = studentBMessages.find(
      (m) => m.type === 'COMPONENT_UNLOCKED' && m.payload.componentId === 'res_01'
    );
    assert.ok(autoUnlock, 'Servidor deve liberar lock automaticamente em desconexao');

    wsB.close();
  });
});
